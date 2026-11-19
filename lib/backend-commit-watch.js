const cached=new Map();
export async function pageCommits(env,paths){
 if(!env.GH_OWNER||!env.GH_REPO||!env.GH_TOKEN)throw Error('源码提交检测需要 GH_OWNER、GH_REPO、GH_TOKEN');
 const branch=env.GH_BRANCH||'main',repo=[env.GH_OWNER,env.GH_REPO].map(encodeURIComponent).join('/');
 // Do not cache across credentials: revoked/rotated authorization must be rechecked.
 const key=JSON.stringify([repo,branch,env.GH_TOKEN,paths]);const hit=cached.get(key);if(hit&&hit.until>Date.now())return hit.value;
 const commits={};
 for(let offset=0;offset<paths.length;offset+=4){await Promise.all(paths.slice(offset,offset+4).map(async path=>{
  const url='https://api.github.com/repos/'+repo+'/commits?sha='+encodeURIComponent(branch)+'&path='+encodeURIComponent(path.replace(/^\//,''))+'&per_page=1';
  const r=await fetch(url,{headers:{Authorization:'Bearer '+env.GH_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'timeline-source-update-monitor'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('GitHub 源码提交查询失败 HTTP '+r.status);const rows=await r.json();if(!Array.isArray(rows))throw Error('GitHub 提交列表格式异常');commits[path]=rows[0]?.sha||null;
 }))}
 const value={commits,branch};if(cached.size>40)cached.clear();cached.set(key,{value,until:Date.now()+60000});return value;
}

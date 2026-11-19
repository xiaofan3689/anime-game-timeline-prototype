export async function reviewCatalog(request,env){
 const url=new URL('/data/events.json',request.url);
 let localError;
 try{
  if(!env.ASSETS?.fetch)throw Error('无静态资源绑定');
  const response=await env.ASSETS.fetch(new Request(url,{signal:AbortSignal.timeout(8000)}));
  if(!response.ok)throw Error('静态数据 HTTP '+response.status);
  return {games:games(await response.json()),source:'site'};
 }catch(e){localError=e}
 if(!env.GH_TOKEN||!env.GH_OWNER||!env.GH_REPO)throw Object.assign(Error('本站活动数据不可读取，且未配置仓库读取变量，请检查 data/events.json 和 GH_OWNER/GH_REPO/GH_TOKEN'),{status:503});
 try{
  const path=[env.GH_OWNER,env.GH_REPO].map(encodeURIComponent).join('/');
  const response=await fetch('https://api.github.com/repos/'+path+'/contents/data/events.json?ref='+encodeURIComponent(env.GH_BRANCH||'main'),{headers:{Authorization:'Bearer '+env.GH_TOKEN,Accept:'application/vnd.github.raw+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'timeline-review-catalog'},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('GitHub HTTP '+response.status);
  return {games:games(await response.json()),source:'repository'};
 }catch(e){console.warn(JSON.stringify({event:'review_catalog_unavailable',local:localError?.name,upstream:e.name}));throw Object.assign(Error('活动目录暂不可读取，请检查正式站 /data/events.json、仓库变量或 GitHub 服务状态'),{status:503})}
}
function games(data){if(!Array.isArray(data?.games)||!data.games.length)throw Error('游戏目录为空或格式无效');const result=data.games.map(g=>({id:g.id,name:g.name}));if(result.some(g=>typeof g.id!=='string'||typeof g.name!=='string'))throw Error('游戏目录格式无效');return result}

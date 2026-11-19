import {fail} from './collaborator-auth.js';
const enc=encodeURIComponent;
export const repoPath=repo=>'/repos/'+repo.split('/').map(enc).join('/');
export function mainRepo(env){if(!env.GH_OWNER||!env.GH_REPO||!env.GH_TOKEN)throw fail('管理员 GitHub 变量未配置',503);return env.GH_OWNER+'/'+env.GH_REPO}
export async function gh(token,path,method='GET',body){
 if(!token)throw fail('GitHub 授权缺失',503);
 const r=await fetch('https://api.github.com'+path,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'timeline-collaboration','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const result=await r.json().catch(()=>({}));if(!r.ok)throw fail('GitHub '+r.status+'：'+(result.message||'请求失败'),r.status===409?409:400);return result;
}
export const encodeText=text=>{const bytes=new TextEncoder().encode(text);let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)};
export const decodeText=text=>new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g,'')),c=>c.charCodeAt(0)));
export async function file(token,repo,ref,path='data/manual.json'){const r=await gh(token,repoPath(repo)+'/contents/'+path+'?ref='+enc(ref));if(!r.content)throw fail('文件过大或内容缺失');return {sha:r.sha,data:JSON.parse(decodeText(r.content))}}
export async function baseline(env){const repo=mainRepo(env),branch=env.GH_BRANCH||'main',r=await gh(env.GH_TOKEN,repoPath(repo)+'/branches/'+enc(branch)),content=await file(env.GH_TOKEN,repo,r.commit.sha);return {sha:r.commit.sha,fileSha:content.sha,data:content.data}}
async function key(env){if(!/^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY||''))throw fail('TOKEN_ENCRYPTION_KEY 需为64位十六进制机密',503);return crypto.subtle.importKey('raw',Uint8Array.from(env.TOKEN_ENCRYPTION_KEY.match(/../g),x=>parseInt(x,16)),'AES-GCM',false,['encrypt','decrypt'])}
export async function seal(env,email,token){const iv=crypto.getRandomValues(new Uint8Array(12)),data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(email)},await key(env),new TextEncoder().encode(token));return JSON.stringify({iv:[...iv],data:[...new Uint8Array(data)]})}
export async function unseal(env,email,cipher){try{const v=JSON.parse(cipher);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(v.iv),additionalData:new TextEncoder().encode(email)},await key(env),new Uint8Array(v.data)))}catch{throw fail('GitHub 令牌无法解密，请重新绑定',503)}}
export async function credential(env,email){
 const db=env.APPLICATION_DB,c=await db.prepare('SELECT * FROM collaborator_credentials WHERE email=?').bind(email).first();if(!c)throw fail('请先授权 GitHub App 或绑定本人 GitHub',409);
 const plain=await unseal(env,email,c.cipher);if(!plain.startsWith('{'))return {...c,token:plain,kind:'pat'};
 let payload=JSON.parse(plain);if(payload.kind!=='github-app')throw fail('GitHub 绑定格式无效',409);
 if(payload.expiresAt<Date.now()+120000){
  if(payload.refreshExpiresAt<=Date.now())throw fail('GitHub 授权已到期，请重新授权',401);
  const now=Date.now(),lock=await db.prepare('INSERT INTO collaborator_oauth_locks VALUES(?,?) ON CONFLICT(email) DO UPDATE SET until_at=excluded.until_at WHERE collaborator_oauth_locks.until_at<?').bind(email,now+60000,now).run();if(!lock.meta.changes)throw fail('GitHub 授权正在更新，请稍后重试',409);
  try{
   const {exchange}=await import('./collaborator-oauth.js');payload=await exchange(env,{grant_type:'refresh_token',refresh_token:payload.refreshToken});
   const cipher=await seal(env,email,JSON.stringify(payload));const changed=await db.prepare('UPDATE collaborator_credentials SET cipher=?,updated_at=? WHERE email=? AND cipher=?').bind(cipher,Date.now(),email,c.cipher).run();if(!changed.meta.changes)throw fail('GitHub 连接已变化，请重新加载',409);
  }finally{await db.prepare('DELETE FROM collaborator_oauth_locks WHERE email=? AND until_at=?').bind(email,now+60000).run()}
 }
 return {...c,token:payload.accessToken,kind:'github-app',expiresAt:payload.expiresAt};
}
export async function verifyCredential(env,token,forkRepo,expectedId){
 const user=await gh(token,'/user');if(expectedId&&Number(user.id)!==Number(expectedId))throw fail('GitHub 授权账号已变化',403);
 const upstream=await gh(token,repoPath(mainRepo(env)));if(upstream.private)throw fail('此发布路径仅支持公开主仓库');
 if(upstream.permissions?.push)throw fail('协作者账号已有主仓库写权限，请先移除权限再绑定',403);
 if(!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(forkRepo||''))throw fail('Fork 格式为 用户名/仓库名');
 const fork=await gh(token,repoPath(forkRepo));if(!fork.fork||fork.parent?.full_name?.toLowerCase()!==mainRepo(env).toLowerCase()||Number(fork.owner?.id)!==Number(user.id)||!fork.permissions?.push)throw fail('必须使用当前本人拥有且可写的项目直接 Fork',403);
 if(token.startsWith('ghu_'))await verifyInstallation(token,fork.id);
 return {user,fork};
}
export async function verifyInstallation(token,repositoryId){
 for(let page=1;page<=10;page++){
  const result=await gh(token,'/user/installations?per_page=100&page='+page);
  for(const install of result.installations||[]){
   if(install.suspended_at||install.permissions?.contents!=='write'||install.permissions?.pull_requests!=='write')continue;
   for(let rp=1;rp<=10;rp++){const repos=await gh(token,`/user/installations/${install.id}/repositories?per_page=100&page=${rp}`);if(repos.repositories?.some(x=>Number(x.id)===Number(repositoryId)))return install.id;if((repos.repositories||[]).length<100)break;}
  }
  if((result.installations||[]).length<100)break;
 }
 throw fail('GitHub App 尚未安装到本人 Fork，或 Contents / Pull requests 写权限不足',403);
}

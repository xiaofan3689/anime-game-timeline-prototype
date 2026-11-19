export const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export const fail=(message,status=400)=>Object.assign(Error(message),{status});
const decode=s=>{if(typeof s!=='string'||!/^[A-Za-z0-9_-]+$/.test(s))throw Error();const b=s.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(b+'='.repeat((4-b.length%4)%4)),c=>c.charCodeAt(0))};
const accessFail=(code,message,status=401)=>Object.assign(fail(message,status),{code});
function teamOrigin(value){
 const raw=String(value||'').trim().replace(/\/+$/,'');
 if(!raw)throw accessFail('ACCESS_TEAM_MISSING','未配置 ACCESS_TEAM_DOMAIN',503);
 const normalized=/^https:\/\//i.test(raw)?raw:'https://'+raw;
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(normalized))throw accessFail('ACCESS_TEAM_INVALID','ACCESS_TEAM_DOMAIN 应填写团队的 xxx.cloudflareaccess.com 域名',503);
 return new URL(normalized).origin;
}
export async function identity(request,env,audience=env.COLLABORATOR_ACCESS_AUD){
 if(request.method!=='GET'&&request.headers.get('Origin')!==new URL(request.url).origin)throw fail('请求来源无效',403);
 try{
  const team=teamOrigin(env.ACCESS_TEAM_DOMAIN),aud=String(audience||'').trim();
  if(!aud)throw accessFail('ACCESS_AUD_MISSING','未配置此接口对应的 Access AUD：协作者使用 COLLABORATOR_ACCESS_AUD，管理员使用 ACCESS_AUD',503);
  if(!request.headers.get('Cf-Access-Jwt-Assertion'))throw accessFail('ACCESS_JWT_MISSING','未收到 Access 登录凭证，请检查当前域名的接口路径保护并重新登录');
  const [h,p,s,...rest]=(request.headers.get('Cf-Access-Jwt-Assertion')||'').split('.');
  if(rest.length||!h||!p||!s)throw accessFail('ACCESS_JWT_INVALID','Access 登录凭证格式无效，请重新登录');
  const header=JSON.parse(new TextDecoder().decode(decode(h))),c=JSON.parse(new TextDecoder().decode(decode(p))),now=Date.now()/1000;
  if(!header||!c||header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid)throw accessFail('ACCESS_JWT_INVALID','Access 登录凭证格式或签名算法无效');
  if(c.iss!==team)throw accessFail('ACCESS_ISSUER_MISMATCH','Access 团队不匹配，请核对 ACCESS_TEAM_DOMAIN');
  if(!(Array.isArray(c.aud)?c.aud:[c.aud]).includes(aud))throw accessFail('ACCESS_AUD_MISMATCH','Access AUD 不匹配，请核对接口所在应用的 Application Audience (AUD)');
  if(!Number.isFinite(c.exp)||c.exp<=now)throw accessFail('ACCESS_JWT_EXPIRED','Access 登录已过期或有效期无效，请重新登录');
  if(c.nbf!==undefined&&(!Number.isFinite(c.nbf)||c.nbf>now))throw accessFail('ACCESS_JWT_NOT_YET_VALID','Access 登录凭证尚未生效，请重新登录');
  if(typeof c.email!=='string'||!c.email.trim())throw accessFail('ACCESS_EMAIL_MISSING','Access 凭证没有用户邮箱，请使用邮箱验证码或提供邮箱的身份登录');
  let jwk;
  try{const response=await fetch(team+'/cdn-cgi/access/certs');if(!response.ok)throw Error();const certs=await response.json();if(!Array.isArray(certs.keys))throw Error();jwk=certs.keys.find(k=>k.kid===header.kid&&k.kty==='RSA')}
  catch{throw accessFail('ACCESS_CERTS_UNAVAILABLE','暂时无法获取 Access 签名公钥，请查看服务端日志并稍后重试',503)}
  if(!jwk)throw accessFail('ACCESS_SIGNING_KEY_MISSING','Access 签名公钥不匹配，请核对团队域名并重新登录');
  let valid=false;
  try{const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(s),new TextEncoder().encode(h+'.'+p))}catch{throw accessFail('ACCESS_SIGNATURE_INVALID','Access 登录凭证签名校验失败，请重新登录')}
  if(!valid)throw accessFail('ACCESS_SIGNATURE_INVALID','Access 登录凭证签名校验失败，请重新登录');
  return c.email.trim().toLowerCase();
 }catch(e){const error=e.code?.startsWith('ACCESS_')?e:accessFail('ACCESS_JWT_INVALID','Access 登录凭证无效，请重新登录');console.warn(JSON.stringify({event:'access_auth_failed',code:error.code,path:new URL(request.url).pathname}));throw error}
}
export async function member(request,env){
 if(!env.APPLICATION_DB)throw fail('APPLICATION_DB 未绑定',503);
 const email=await identity(request,env),user=await env.APPLICATION_DB.prepare('SELECT * FROM collaborator_users WHERE email=? AND active=1').bind(email).first();
 if(!user)throw fail('账号未开通或已停用',403);
 let games=JSON.parse(user.games);if(Array.isArray(games)&&games.includes("*")){const {file,mainRepo}=await import("./collaborator-github.js");const feed=(await file(env.GH_TOKEN,mainRepo(env),env.GH_BRANCH||"main","data/events.json")).data;games=feed.games.map(g=>g.id)}if(!Array.isArray(games)||!games.every(x=>typeof x==='string'))throw fail('管理员分配的游戏范围无效',403);
 return {...user,email,games};
}
export async function admin(request,env){const email=await identity(request,env,env.ACCESS_AUD);if(email!==String(env.ADMIN_EMAIL||'').toLowerCase())throw fail('无管理员权限',403);if(!env.APPLICATION_DB)throw fail('APPLICATION_DB 未绑定',503);return email}
export async function body(request){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw fail('需要 JSON 请求',415);const raw=await request.text();if(raw.length>1500000)throw fail('请求过大',413);try{return JSON.parse(raw)}catch{throw fail('JSON 无效')}}
export async function audit(env,actor,id,action,detail=''){await env.APPLICATION_DB.prepare('INSERT INTO collaborator_audit_v79 VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor,id,action,detail,Date.now()).run()}
export const endpoint=fn=>async ctx=>{try{return await fn(ctx)}catch(e){return json({error:e.message||'请求失败',...(e.code?.startsWith('ACCESS_')?{code:e.code}:{})},e.status||400)}};

export const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export const fail=(message,status=400)=>Object.assign(Error(message),{status});
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function identity(request,env,audience=env.COLLABORATOR_ACCESS_AUD){
 if(request.method!=='GET'&&request.headers.get('Origin')!==new URL(request.url).origin)throw fail('请求来源无效',403);
 try{
  const team=String(env.ACCESS_TEAM_DOMAIN||'').replace(/\/$/,'');
  if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(team)||!audience)throw Error();
  const [h,p,s,...rest]=(request.headers.get('Cf-Access-Jwt-Assertion')||'').split('.');
  if(rest.length||!s)throw Error();
  const header=JSON.parse(new TextDecoder().decode(decode(h))),c=JSON.parse(new TextDecoder().decode(decode(p))),now=Date.now()/1000;
  if(header.alg!=='RS256'||!header.kid||c.iss!==team||!(Array.isArray(c.aud)?c.aud:[c.aud]).includes(audience)||!Number.isFinite(c.exp)||c.exp<=now||(c.nbf!==undefined&&(!Number.isFinite(c.nbf)||c.nbf>now))||typeof c.email!=='string')throw Error();
  const response=await fetch(team+'/cdn-cgi/access/certs');if(!response.ok)throw Error();
  const jwk=(await response.json()).keys?.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)throw Error();
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(s),new TextEncoder().encode(h+'.'+p)))throw Error();
  return c.email.trim().toLowerCase();
 }catch{throw fail('Access 身份验证失败，请检查登录、AUD 和路径保护',401)}
}
export async function member(request,env){
 if(!env.APPLICATION_DB)throw fail('APPLICATION_DB 未绑定',503);
 const email=await identity(request,env),user=await env.APPLICATION_DB.prepare('SELECT * FROM collaborator_users WHERE email=? AND active=1').bind(email).first();
 if(!user)throw fail('账号未开通或已停用',403);
 const games=JSON.parse(user.games);if(!Array.isArray(games)||!games.every(x=>typeof x==='string'))throw fail('管理员分配的游戏范围无效',403);
 return {...user,email,games};
}
export async function admin(request,env){const email=await identity(request,env,env.ACCESS_AUD);if(email!==String(env.ADMIN_EMAIL||'').toLowerCase())throw fail('无管理员权限',403);if(!env.APPLICATION_DB)throw fail('APPLICATION_DB 未绑定',503);return email}
export async function body(request){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw fail('需要 JSON 请求',415);const raw=await request.text();if(raw.length>1500000)throw fail('请求过大',413);try{return JSON.parse(raw)}catch{throw fail('JSON 无效')}}
export async function audit(env,actor,id,action,detail=''){await env.APPLICATION_DB.prepare('INSERT INTO collaborator_audit_v79 VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor,id,action,detail,Date.now()).run()}
export const endpoint=fn=>async ctx=>{try{return await fn(ctx)}catch(e){return json({error:e.message||'请求失败'},e.status||400)}};

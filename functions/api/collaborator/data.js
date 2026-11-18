import {emailFrom,json} from './auth.js';
export async function onRequest({request,env}){
 if(!['GET','PUT'].includes(request.method))return json({error:'方法不支持'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'来源无效'},403);
 if(!env.APPLICATION_DB)return json({error:'协作者数据库未配置'},503);
 const email=emailFrom(request);if(!email)return json({error:'请通过协作者 Access 登录'},401);
 const user=await env.APPLICATION_DB.prepare('SELECT * FROM collaborator_users WHERE email=? AND active=1').bind(email).first();
 if(!user)return json({error:'账号尚未开通或已停用'},403);
 if(request.method==='GET'){
  const manual=await env.APPLICATION_DB.prepare('SELECT data FROM collaborator_proposals WHERE email=? AND status IN (\'draft\',\'returned\') ORDER BY updated_at DESC LIMIT 1').bind(email).first();
  return json({email,games:JSON.parse(user.games),data:manual?JSON.parse(manual.data):null});
 }
 try{const body=await request.json();if(!body.data||!Array.isArray(body.data.games)||!Array.isArray(body.data.events))return json({error:'数据格式无效'},400);const allowed=new Set(JSON.parse(user.games));if(body.data.games.some(g=>!allowed.has(g.id))||body.data.events.some(e=>!allowed.has(e.gameId)))return json({error:'包含未获授权的游戏'},403);if(body.data.games.length>100||body.data.events.length>2000)return json({error:'数据数量超限'},400);const now=Date.now(),id=body.id||crypto.randomUUID();await env.APPLICATION_DB.prepare("INSERT INTO collaborator_proposals(id,email,base_sha,data,status,created_at,updated_at) VALUES (?,?,?,?, 'draft',?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,status='draft',updated_at=excluded.updated_at").bind(id,email,body.baseSha||'',JSON.stringify(body.data),now,now).run();return json({ok:true,id,status:'draft'});}catch{return json({error:'草稿保存失败'},500)}
}

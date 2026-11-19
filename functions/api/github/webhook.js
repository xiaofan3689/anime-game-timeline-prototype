import {json} from '../../../lib/collaborator-auth.js';
export async function onRequest({request,env}){
 if(request.method!=='POST')return json({error:'方法不支持'},405);
 if(!env.GITHUB_WEBHOOK_SECRET||!env.APPLICATION_DB)return json({error:'Webhook 尚未配置'},503);
 const raw=await request.text();if(raw.length>1500000)return json({error:'请求过大'},413);
 const sig=request.headers.get('X-Hub-Signature-256')||'';if(!/^sha256=[a-f0-9]{64}$/.test(sig))return json({error:'签名无效'},401);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.GITHUB_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('HMAC',key,Uint8Array.from(sig.slice(7).match(/../g),x=>parseInt(x,16)),new TextEncoder().encode(raw)))return json({error:'签名无效'},401);
 const delivery=request.headers.get('X-GitHub-Delivery')||'';if(!/^[a-zA-Z0-9-]{1,128}$/.test(delivery))return json({error:'投递 ID 无效'},400);
 const db=env.APPLICATION_DB;if(await db.prepare('SELECT id FROM collaborator_webhook_deliveries WHERE id=?').bind(delivery).first())return json({ok:true,duplicate:true});
 try{
  const b=JSON.parse(raw),event=request.headers.get('X-GitHub-Event');
  if(event==='github_app_authorization'&&b.action==='revoked'&&Number.isSafeInteger(b.sender?.id)){
   await db.prepare('DELETE FROM collaborator_credentials WHERE github_user_id=?').bind(b.sender.id).run();
  }
  if(event==='installation'&&['deleted','suspend'].includes(b.action)&&Number.isSafeInteger(b.installation?.account?.id))await db.prepare('DELETE FROM collaborator_credentials WHERE github_user_id=?').bind(b.installation.account.id).run();
  if(event==='installation_repositories'&&b.action==='removed')for(const repo of b.repositories_removed||[])if(typeof repo.full_name==='string')await db.prepare('DELETE FROM collaborator_credentials WHERE lower(fork_repo)=?').bind(repo.full_name.toLowerCase()).run();
  await db.prepare('INSERT OR IGNORE INTO collaborator_webhook_deliveries VALUES(?,?)').bind(delivery,Date.now()).run();
  await db.prepare('DELETE FROM collaborator_webhook_deliveries WHERE received_at<?').bind(Date.now()-30*86400000).run();return json({ok:true});
 }catch{return json({error:'处理失败，请重投递'},500)}
}

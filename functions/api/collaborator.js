import {sendApplicationMail} from '../../lib/qq-smtp.js';
import {pendingApplicationNotice,validApplicationClient} from '../../lib/application-notices.js';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const duplicate='您已申请提交，请勿重复提交';

export async function onRequest({request,env}){
 const db=env.APPLICATION_DB;
 if(!db)return reply({error:'申请服务尚未配置数据库，请联系管理员'},503);
 const url=new URL(request.url);
 try{
  if(request.method==='GET'){
   const generation=(await db.prepare("SELECT value FROM application_settings WHERE key='generation'").first())?.value||'1';
   const id=url.searchParams.get('id');
   if(!validApplicationClient(id))return reply({submitted:false,generation,notice:null});
   const [row,notice]=await Promise.all([
    db.prepare('SELECT 1 FROM collaborator_applications WHERE generation=? AND client_id=?').bind(generation,id).first(),
    pendingApplicationNotice(db,id)
   ]);
   return reply({submitted:!!row,generation,notice});
  }
  if(request.method!=='POST')return reply({error:'方法不支持'},405);
  if(request.headers.get('Origin')!==url.origin)return reply({error:'来源无效'},403);
  if(Number(request.headers.get('Content-Length'))>4096)return reply({error:'内容过长'},413);
  const raw=await request.text();
  if(raw.length>4096)return reply({error:'内容过长'},413);
  let b;
  try{b=JSON.parse(raw)}catch{return reply({error:'提交内容无效'},400)}
  if(!validApplicationClient(b?.clientId))return reply({error:'申请会话无效'},400);
  if(b.action==='acknowledge-notice'){
   if(typeof b.noticeId!=='string')return reply({error:'通知编号无效'},400);
   await db.prepare(`UPDATE collaborator_application_notices SET acknowledged_at=?
    WHERE id=? AND client_id=? AND acknowledged_at IS NULL`).bind(Date.now(),b.noticeId,b.clientId).run();
   return reply({ok:true});
  }
  const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
  if(typeof b.hasGithub!=='boolean'||typeof b.useGithub!=='boolean'||!/^\S+@\S+\.\S+$/.test(email)||email.length>254)return reply({error:'请填写有效回信邮箱'},400);
  if(b.useGithub&&!b.hasGithub)return reply({error:'选项不一致'},400);
  if(b.useGithub&&!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(b.username||''))return reply({error:'请填写有效 GitHub 用户名'},400);
  const id=crypto.randomUUID(),username=b.useGithub?b.username:'';
  const result=await db.prepare(`INSERT OR IGNORE INTO collaborator_applications
   (id,generation,client_id,email,has_github,use_github,username,status,created_at)
   SELECT ?,COALESCE((SELECT value FROM application_settings WHERE key='generation'),'1'),?,?,?,?,?,'pending',?
   WHERE NOT EXISTS (SELECT 1 FROM collaborator_applications WHERE lower(trim(email))=?)
     AND NOT EXISTS (SELECT 1 FROM collaborator_users WHERE lower(trim(email))=?)
     AND NOT EXISTS (SELECT 1 FROM collaborator_application_notices WHERE client_id=? AND acknowledged_at IS NULL)`)
   .bind(id,b.clientId,email,+b.hasGithub,+b.useGithub,username,new Date().toISOString(),email,email,b.clientId).run();
  if(!result.meta.changes){
   const notice=await pendingApplicationNotice(db,b.clientId);
   return reply(notice?{error:'请先确认申请通知',notice}:{error:duplicate},409);
  }
  if(!env.QQ_SMTP_USER||!env.QQ_SMTP_AUTH_CODE){
   await db.prepare('DELETE FROM collaborator_applications WHERE id=?').bind(id).run();
   return reply({error:'申请邮件尚未配置，请联系管理员'},503);
  }
  try{
   await sendApplicationMail(env,`回信邮箱：${email}\n拥有 GitHub：${b.hasGithub?'是':'否'}\n本人账号维护：${b.useGithub?'是':'否'}\nGitHub 用户名：${username||'未提供'}\n申请编号：${id}`);
  }catch{
   await db.prepare('DELETE FROM collaborator_applications WHERE id=?').bind(id).run();
   return reply({error:'邮件发送失败，请稍后重试'},502);
  }
  await db.prepare("UPDATE collaborator_applications SET status='sent' WHERE id=?").bind(id).run();
  return reply({ok:true});
 }catch(e){
  console.error('collaborator_application_failed',e.name);
  return reply({error:'申请处理失败，请稍后重试'},500);
 }
}

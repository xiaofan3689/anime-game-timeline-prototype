import {requireMailConfig,sendMail} from '../../lib/resend-mail.js';
import {pendingApplicationNotice,validApplicationClient} from '../../lib/application-notices.js';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const duplicate='您已申请提交，请勿重复提交';

const activeMessage='您已是协作者，无需反复提交';
const inactiveMessage='您的权限已被停用，请补充申请理由';
const underReview="status IN ('pending','sent','reviewing')";
const invitationPending=`status='approved' AND (NOT EXISTS (SELECT 1 FROM collaborator_users WHERE lower(trim(email))=?)
 OR EXISTS (SELECT 1 FROM collaborator_invitations WHERE application_id=a.id AND status='sent' AND expires_at>? AND a.reactivation_reason IS NOT NULL))`;
async function emailStatus(db,email){
 const [account,application]=await Promise.all([
  db.prepare('SELECT MAX(active) AS active FROM collaborator_users WHERE lower(trim(email))=?').bind(email).first(),
  db.prepare(`SELECT 1 FROM collaborator_applications a WHERE lower(trim(email))=? AND (${underReview} OR (${invitationPending})) LIMIT 1`)
   .bind(email,email,Date.now()).first()
 ]);
 if(application)return 'pending';
 if(account.active===1)return 'active';
 return account.active===0?'inactive':'new';
}
function stateResponse(state){
 const error={pending:duplicate,active:activeMessage,inactive:inactiveMessage}[state];
 return reply({state,error},error?409:200);
}

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
    db.prepare('SELECT email FROM collaborator_applications WHERE client_id=? ORDER BY created_at DESC,id LIMIT 1').bind(id).first(),
    pendingApplicationNotice(db,id)
   ]);
   const state=row?await emailStatus(db,row.email.trim().toLowerCase()):'new';
   return reply({submitted:state==='pending',state,generation,notice});
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
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return reply({error:'请填写有效回信邮箱'},400);
  const notice=await pendingApplicationNotice(db,b.clientId);
  if(notice)return reply({error:'请先确认申请通知',notice},409);
  const state=await emailStatus(db,email);
  if(b.action==='check-email'||state==='pending'||state==='active')return stateResponse(state);
  const reactivation=b.action==='reactivate';
  if(reactivation&&state!=='inactive')return reply({error:'账号状态已变化，请重新打开申请窗口'},409);
  if(!reactivation&&state==='inactive')return stateResponse(state);
  const reason=typeof b.reason==='string'?b.reason.trim():'';
  if(reactivation&&(!reason||reason.length>500))return reply({error:'请填写申请理由（最多 500 字）'},400);
  if(typeof b.hasGithub!=='boolean'||typeof b.useGithub!=='boolean')return reply({error:'请选择 GitHub 账号选项'},400);
  if(b.useGithub&&!b.hasGithub)return reply({error:'选项不一致'},400);
  if(b.useGithub&&!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(b.username||''))return reply({error:'请填写有效 GitHub 用户名'},400);
  const id=crypto.randomUUID(),username=b.useGithub?b.username:'',now=Date.now();
  const result=await db.prepare(`INSERT OR IGNORE INTO collaborator_applications
   (id,generation,client_id,email,has_github,use_github,username,status,created_at,reactivation_reason)
   SELECT ?,COALESCE(?,(SELECT value FROM application_settings WHERE key='generation'),'1'),?,?,?,?,?,?,?,?
   WHERE NOT EXISTS (SELECT 1 FROM collaborator_applications a
    WHERE (lower(trim(email))=? OR client_id=?) AND (${underReview} OR (lower(trim(email))=? AND (${invitationPending}))))
    AND NOT EXISTS (SELECT 1 FROM collaborator_users WHERE lower(trim(email))=? AND (?=0 OR active=1))
    AND (?=0 OR EXISTS (SELECT 1 FROM collaborator_users WHERE lower(trim(email))=? AND active=0))
    AND NOT EXISTS (SELECT 1 FROM collaborator_application_notices WHERE client_id=? AND acknowledged_at IS NULL)`)
   .bind(id,reactivation?'reactivation:'+id:null,b.clientId,email,+b.hasGithub,+b.useGithub,username,
    reactivation?'sent':'pending',new Date(now).toISOString(),reactivation?reason:null,email,b.clientId,
    email,email,now,email,+reactivation,+reactivation,email,b.clientId).run();
  if(!result.meta.changes){
   const currentNotice=await pendingApplicationNotice(db,b.clientId);
   if(currentNotice)return reply({error:'请先确认申请通知',notice:currentNotice},409);
   const current=await emailStatus(db,email);
   return stateResponse(current==='new'||(reactivation&&current==='inactive')?'pending':current);
  }
  if(reactivation)return reply({ok:true,state:'pending'});
  try{requireMailConfig(env)}catch{
   await db.prepare('DELETE FROM collaborator_applications WHERE id=?').bind(id).run();
   return reply({error:'申请邮件尚未配置，请联系管理员'},503);
  }
  try{
   await sendMail(env,`回信邮箱：${email}\n拥有 GitHub：${b.hasGithub?'是':'否'}\n本人账号维护：${b.useGithub?'是':'否'}\nGitHub 用户名：${username||'未提供'}\n申请编号：${id}`);
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

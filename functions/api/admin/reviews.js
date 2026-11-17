import {authorize} from './manual.js';
import {sendApplicationMail} from '../../../lib/qq-smtp.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const approved='这里是次元时刻申请协作者回复专用邮箱，恭喜您 协作者申请通过，管理员的QQ号将在另一封邮件另外告知，协作者权限下放进度也会随信通知。本邮件仅公布申请结果，感谢您支持次元时刻';
const refused='这里是次元时刻申请协作者回复专用邮箱，您本次协作者申请未通过，不过您仍然可以再次申请成为协作者，本邮件仅公布申请结果，感谢您支持次元时刻';
export async function onRequest(context){
 if(!await authorize(context))return json({error:'无管理员权限'},403);
 const db=context.env.APPLICATION_DB;
 if(!db)return json({error:'申请数据库未配置'},503);
 try{
  if(context.request.method==='GET'){
   const rows=await db.prepare("SELECT id,email,has_github,use_github,username,status,created_at FROM collaborator_applications ORDER BY created_at DESC LIMIT 1000").all();
   return json({applications:rows.results});
  }
  if(context.request.method!=='POST')return json({error:'方法不支持'},405);
  const input=await context.request.json();
  if(!['approve','refuse'].includes(input.action)||typeof input.id!=='string'||input.id.length>80)return json({error:'无效请求'},400);
  const reason=typeof input.reason==='string'?input.reason.trim():'';
  if(input.action==='refuse'&&(!reason||reason.length>500))return json({error:'请填写拒绝理由（最多500字）'},400);
  const row=await db.prepare('SELECT * FROM collaborator_applications WHERE id=?').bind(input.id).first();
  if(!row)return json({error:'申请不存在或已处理，请刷新'},404);
  if(row.status!=='sent')return json({error:'该申请已处理或正在处理中，请刷新查看'},409);
  const locked=await db.prepare("UPDATE collaborator_applications SET status='reviewing' WHERE id=? AND status='sent'").bind(row.id).run();
  if(!locked.meta.changes)return json({error:'正在被其他管理员处理'},409);
  try{
   await sendApplicationMail(context.env,input.action==='approve'?approved:refused+'\n\n拒绝理由：'+reason,row.email,'次元时刻：协作者申请审核结果');
  }catch{
   await db.prepare("UPDATE collaborator_applications SET status='sent' WHERE id=? AND status='reviewing'").bind(row.id).run();
   return json({error:'结果邮件未确认发送成功，申请已保留；请检查 QQ SMTP 日志后再重试'},502);
  }
  if(input.action==='approve')await db.prepare("UPDATE collaborator_applications SET status='approved' WHERE id=?").bind(row.id).run();
  else await db.prepare('DELETE FROM collaborator_applications WHERE id=?').bind(row.id).run();
  return json({ok:true,message:input.action==='approve'?'同意通知已交给邮件服务器；通过记录已保留。':'拒绝通知已交给邮件服务器；申请已删除，用户可重新申请。'});
 }catch{return json({error:'处理失败，请刷新核对状态；若显示处理中，请勿反复发送邮件'},500)}
}

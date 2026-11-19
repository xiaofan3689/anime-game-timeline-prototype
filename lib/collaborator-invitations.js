import {fail,audit} from './collaborator-auth.js';
export async function activate(env,email,accept=false){
 const db=env.APPLICATION_DB;if(!db)throw fail('APPLICATION_DB 未绑定',503);
 const user=await db.prepare('SELECT active FROM collaborator_users WHERE email=?').bind(email).first();
 if(user?.active===1)return {active:true,pending:false};
 const invite=await db.prepare("SELECT * FROM collaborator_invitations WHERE email=? AND status='sent' AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(email,Date.now()).first();
 if(!invite)return {active:false,pending:false};
 if(!accept)return {active:false,pending:true,games:JSON.parse(invite.games),expiresAt:invite.expires_at};
 const now=Date.now();
 await db.batch([
  db.prepare("INSERT INTO collaborator_users(email,role,active,games,created_at,updated_at) SELECT email,'collaborator',1,games,?,? FROM collaborator_invitations WHERE application_id=? AND email=? AND status='sent' AND expires_at>? ON CONFLICT(email) DO UPDATE SET active=1,games=excluded.games,updated_at=excluded.updated_at").bind(now,now,invite.application_id,email,now),
  db.prepare("UPDATE collaborator_invitations SET status='accepted' WHERE email=? AND status='sent'").bind(email)
 ]);
 const current=await db.prepare('SELECT active FROM collaborator_users WHERE email=?').bind(email).first();if(!current?.active)throw fail('激活邀请已失效，请联系管理员',409);
 await audit(env,email,null,'activated',invite.application_id);return {active:true,pending:false};
}
export async function reviewApplication(env,actor,input,sendMail){
 const db=env.APPLICATION_DB;
 if(!['approve','refuse','resend'].includes(input.action)||typeof input.id!=='string')throw fail('操作无效');
 const row=await db.prepare('SELECT * FROM collaborator_applications WHERE id=?').bind(input.id).first();if(!row)throw fail('申请不存在',404);
 if(input.action==='refuse'&&(!String(input.reason||'').trim()||String(input.reason).length>500))throw fail('请填写拒绝理由（最多500字）');
 const email=row.email.trim().toLowerCase(),now=Date.now(),isApprove=input.action!=='refuse';
 let games=[];
 if(isApprove){
  games=[...new Set(input.games||[])];if(!games.length||games.length>100||!games.every(x=>/^[a-z0-9-]{2,40}$/.test(x)))throw fail('请分配至少一个有效游戏 ID');
 }
 if((input.action==='resend'&&row.status!=='approved')||(input.action!=='resend'&&row.status!=='sent'))throw fail('申请状态已变化，请刷新',409);
 const original=row.status,lock=await db.prepare("UPDATE collaborator_applications SET status='reviewing' WHERE id=? AND status=?").bind(row.id,original).run();if(!lock.meta.changes)throw fail('申请正在处理',409);
 try{
  if(isApprove){
   const user=await db.prepare('SELECT active FROM collaborator_users WHERE email=?').bind(email).first();if(user?.active)throw fail('账号已经启用，请到账号管理调整范围');
   const site=new URL(env.SITE_URL);if(site.protocol!=='https:')throw fail('请先配置正式 HTTPS SITE_URL',503);
   await db.prepare("INSERT INTO collaborator_invitations VALUES(?,?,?,'prepared',?,?) ON CONFLICT(application_id) DO UPDATE SET email=excluded.email,games=excluded.games,status='prepared',expires_at=excluded.expires_at,created_at=excluded.created_at").bind(row.id,email,JSON.stringify(games),now+7*86400000,now).run();
   await sendMail(env,`你的次元时刻协作者申请已通过。\n维护游戏：${games.join('、')}\n请在7天内打开 ${site.origin}/collaborator/ ，使用本邮件收件地址登录并点击“确认激活维护权限”。\n打开邮件或预览链接不会自动激活。`,email,'次元时刻：协作者邀请与权限激活');
   await db.batch([db.prepare("UPDATE collaborator_invitations SET status='sent' WHERE application_id=? AND status='prepared'").bind(row.id),db.prepare("UPDATE collaborator_applications SET status='approved' WHERE id=? AND status='reviewing'").bind(row.id)]);
  }else{
   await sendMail(env,'你的次元时刻协作者申请未通过。\n拒绝理由：'+String(input.reason).trim(),email,'次元时刻：协作者申请审核结果');
   await db.prepare('DELETE FROM collaborator_applications WHERE id=?').bind(row.id).run();
  }
 }catch(e){await db.prepare("UPDATE collaborator_applications SET status=? WHERE id=? AND status='reviewing'").bind(original,row.id).run();throw fail('处理未完成，请核对邮件及申请状态后再重试：'+e.message,502)}
 await audit(env,actor,null,'application-'+input.action,row.id);return {ok:true,message:isApprove?'邀请已交给邮件服务器；用户登录获批邮箱并主动确认后激活。':'拒绝通知已提交，申请已删除。'};
}

import {admin,body,endpoint,fail,json} from '../../../lib/collaborator-auth.js';
import {listAnnouncements,parseAnnouncement} from '../../../lib/collaborator-announcements.js';

export const onRequest=endpoint(async({request,env})=>{
 await admin(request,env);
 const db=env.APPLICATION_DB;
 if(request.method==='GET')return json({announcements:await listAnnouncements(db)});
 if(request.method!=='POST')return json({error:'方法不支持'},405);
 const input=await body(request);
 const {title,message,expiresAt,requiresConfirmation}=parseAnnouncement(input);
 const now=Date.now();
 if(input.id===undefined){
  if(expiresAt!==null&&expiresAt<=now)throw fail('截止时间必须晚于当前时间');
  await db.prepare(`INSERT INTO collaborator_announcements
   (id,title,message,expires_at,requires_confirmation,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`)
   .bind(crypto.randomUUID(),title,message,expiresAt,requiresConfirmation,now,now).run();
 }else{
  if(typeof input.id!=='string'||!Number.isSafeInteger(input.revision))throw fail('公告版本无效');
  const result=await db.prepare(`UPDATE collaborator_announcements SET title=?,message=?,expires_at=?,
   requires_confirmation=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?`)
   .bind(title,message,expiresAt,requiresConfirmation,now,input.id,input.revision).run();
  if(!result.meta.changes)throw fail('公告已被修改，请刷新公告列表后重试',409);
 }
 return json({ok:true});
});

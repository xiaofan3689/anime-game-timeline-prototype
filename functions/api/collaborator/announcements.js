import {body,endpoint,fail,identity,json} from '../../../lib/collaborator-auth.js';
import {listAnnouncements} from '../../../lib/collaborator-announcements.js';

export const onRequest=endpoint(async({request,env})=>{
 const email=await identity(request,env);
 const db=env.APPLICATION_DB;
 if(!db)throw fail('APPLICATION_DB 未绑定',503);
 if(!await db.prepare('SELECT 1 FROM collaborator_users WHERE email=? AND active=1').bind(email).first()){
  throw fail('协作者账号未激活或已停用',403);
 }
 if(request.method==='GET')return json({announcements:await listAnnouncements(db,email)});
 if(request.method!=='POST')return json({error:'方法不支持'},405);
 const {id,revision,action}=await body(request)??{};
 if(typeof id!=='string'||!Number.isSafeInteger(revision)||!['seen','confirm'].includes(action))throw fail('公告操作无效');
 const now=Date.now();
 const result=await db.prepare(`INSERT INTO collaborator_announcement_receipts
  (announcement_id,email,revision,seen_at,confirmed_at)
  SELECT id,?,revision,?,? FROM collaborator_announcements
  WHERE id=? AND revision=? AND (expires_at IS NULL OR expires_at>?) AND (requires_confirmation=1 OR ?='seen')
  ON CONFLICT(announcement_id,email) DO UPDATE SET revision=excluded.revision,
   seen_at=excluded.seen_at,confirmed_at=CASE WHEN collaborator_announcement_receipts.revision=excluded.revision
    THEN COALESCE(collaborator_announcement_receipts.confirmed_at,excluded.confirmed_at) ELSE excluded.confirmed_at END`)
  .bind(email,now,action==='confirm'?now:null,id,revision,now,action).run();
 if(!result.meta.changes)throw fail('公告已更新或下线，请重新查看',409);
 return json({ok:true});
});

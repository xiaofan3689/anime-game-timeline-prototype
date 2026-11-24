import {fail} from './collaborator-auth.js';

export function parseAnnouncement(input) {
 const title=typeof input?.title==='string'?input.title.trim():'';
 const message=typeof input?.message==='string'?input.message.trim():'';
 const expiresAt=input?.expiresAt;
 if(!title||title.length>100||!message||message.length>5000)throw fail('请输入标题（最多 100 字）和正文（最多 5000 字）');
 if(expiresAt!==null&&(!Number.isSafeInteger(expiresAt)||expiresAt<1||expiresAt>253402300799999))throw fail('请选择有效的截止时间');
 if(typeof input.requiresConfirmation!=='boolean')throw fail('确认设置无效');
 return {title,message,expiresAt,requiresConfirmation:+input.requiresConfirmation};
}

export async function listAnnouncements(db,email=null) {
 const query=email
  ? `SELECT a.*, CASE WHEN r.seen_at IS NULL THEN 0 ELSE 1 END AS seen,
      CASE WHEN r.confirmed_at IS NULL THEN 0 ELSE 1 END AS confirmed
     FROM collaborator_announcements a
     LEFT JOIN collaborator_announcement_receipts r ON r.email=? AND r.announcement_id=a.id AND r.revision=a.revision
     WHERE a.expires_at IS NULL OR a.expires_at>? ORDER BY a.updated_at DESC,a.id`
  : 'SELECT * FROM collaborator_announcements ORDER BY updated_at DESC,id';
 const statement=db.prepare(query);
 return (await (email?statement.bind(email,Date.now()):statement).all()).results;
}

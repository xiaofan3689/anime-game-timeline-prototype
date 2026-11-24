export const validApplicationClient = value => typeof value === 'string' &&
 /^[a-zA-Z0-9-]{20,80}$/.test(value);

export async function pendingApplicationNotice(db, clientId) {
 return (await db.prepare(`SELECT id FROM collaborator_application_notices
  WHERE client_id=? AND acknowledged_at IS NULL ORDER BY created_at,id LIMIT 1`)
  .bind(clientId).first()) ?? null;
}

export async function rejectInvalidApplication(db, actor, id) {
 const now = Date.now();
 const results = await db.batch([
  db.prepare(`INSERT INTO collaborator_application_notices(id,client_id,created_at)
   SELECT id,client_id,? FROM collaborator_applications WHERE id=? AND status='sent'`).bind(now,id),
  db.prepare(`INSERT INTO collaborator_application_archive(id,email,username,has_github,status,reason,created_at,reviewed_at)
   SELECT id,email,username,has_github,'refused',?,created_at,? FROM collaborator_applications WHERE id=? AND status='sent'`)
   .bind('邮箱无效，已通知申请人重新提交',now,id),
  db.prepare(`INSERT INTO collaborator_audit_v79(id,actor,proposal_id,action,detail,created_at)
   SELECT ?,?,NULL,'application-invalid-email',id,? FROM collaborator_applications WHERE id=? AND status='sent'`)
   .bind(crypto.randomUUID(),actor,now,id),
  db.prepare("DELETE FROM collaborator_applications WHERE id=? AND status='sent'").bind(id)
 ]);
 return Boolean(results[0].meta.changes);
}

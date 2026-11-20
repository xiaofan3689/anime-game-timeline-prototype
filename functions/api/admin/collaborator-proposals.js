import {cleanupBranch} from '../../../lib/proposal-cleanup.js';
import {admin,body,json,endpoint,fail,audit} from '../../../lib/collaborator-auth.js';
import {inspectPR,mergePR} from '../../../lib/collaborator-publish.js';
import {gh,mainRepo,repoPath} from '../../../lib/collaborator-github.js';
export const onRequest=endpoint(async({request,env})=>{
 const actor=await admin(request,env),db=env.APPLICATION_DB,url=new URL(request.url);
 if(request.method==='GET'){
  if(url.searchParams.has('id')){const p=await db.prepare('SELECT * FROM collaborator_reviews_v79 WHERE id=?').bind(url.searchParams.get('id')).first();if(!p)throw fail('提案不存在',404);const {pr,changes}=await inspectPR(env,p);return json({id:p.id,headSha:p.head_sha,prUrl:p.pr_url,status:p.status,merged:pr.merged,changes})}
  const r=await db.prepare('SELECT id,email,login,status,head_sha,pr_url,note,created_at,updated_at FROM collaborator_reviews_v79 ORDER BY created_at DESC LIMIT 200').all();return json({items:r.results});
 }
 if(request.method!=='POST')return json({error:'方法不支持'},405);
 const b=await body(request),p=await db.prepare('SELECT * FROM collaborator_reviews_v79 WHERE id=?').bind(b.id||'').first();if(!p)throw fail('提案不存在',404);
 if(b.action==='merge'){
  if(!['pending','merging','merged'].includes(p.status))throw fail('提案状态不允许合并',409);
  if(p.status==='merged')return json({ok:true,mergeSha:p.merge_sha,message:'已合并'});
  if(p.status==='merging'&&Date.now()-p.updated_at<120000)throw fail('合并正在处理，请稍后检查',409);
  const r=await db.prepare("UPDATE collaborator_reviews_v79 SET status='merging',updated_at=? WHERE id=? AND (status='pending' OR (status='merging' AND updated_at<?))").bind(Date.now(),p.id,Date.now()-120000).run();if(!r.meta.changes)throw fail('提案正在处理',409);
  try{return json(await mergePR(env,p,actor,b.headSha))}catch(e){await db.prepare("UPDATE collaborator_reviews_v79 SET status='pending',note=?,updated_at=? WHERE id=? AND status='merging'").bind(e.message,Date.now(),p.id).run();throw e}
 }
 if(!['return','reject'].includes(b.action)||!['pending','failed'].includes(p.status))throw fail('操作或提案状态无效',409);
 const note=String(b.note||'').trim().slice(0,2000);if(!note)throw fail('请填写退回或拒绝原因');
 if(p.pr_number){const pr=await gh(env.GH_TOKEN,repoPath(mainRepo(env))+'/pulls/'+p.pr_number);if(pr.merged)throw fail('GitHub 上已合并，请先核对合并状态',409);if(pr.state==='open')await gh(env.GH_TOKEN,repoPath(mainRepo(env))+'/pulls/'+p.pr_number,'PATCH',{state:'closed'});}
 const r=await db.prepare("UPDATE collaborator_reviews_v79 SET status=?,note=?,updated_at=? WHERE id=? AND status IN ('pending','failed')").bind(b.action==='return'?'returned':'rejected',note,Date.now(),p.id).run();if(!r.meta.changes)throw fail('提案状态已变化',409);
 try{await cleanupBranch(env,p)}catch(e){if(p.status!=='failed')console.warn('temporary branch cleanup failed',e.message)}
 await audit(env,actor,p.id,b.action,note);return json({ok:true});
});

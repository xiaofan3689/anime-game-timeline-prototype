import {member,json,body,endpoint,fail} from '../../../lib/collaborator-auth.js';
import {baseline,file,mainRepo,gh,repoPath} from '../../../lib/collaborator-github.js';
import {scoped,mergeScoped,prepareCatalog} from '../../../lib/collaborator-data.js';
import {cleanupBranch} from '../../../lib/proposal-cleanup.js';
export const onRequest=endpoint(async({request,env})=>{
 const u=await member(request,env),db=env.APPLICATION_DB;await db.prepare('CREATE TABLE IF NOT EXISTS collaborator_revision_links(email TEXT PRIMARY KEY,id TEXT NOT NULL)').run();await db.prepare('CREATE TABLE IF NOT EXISTS collaborator_hidden_records(id TEXT PRIMARY KEY,email TEXT NOT NULL)').run();
 if(request.method==='GET'){
  let draft=await db.prepare('SELECT * FROM collaborator_drafts_v79 WHERE email=?').bind(u.email).first();
  if(!draft){const base=await baseline(env),catalog=(await file(env.GH_TOKEN,mainRepo(env),base.sha,'data/events.json')).data;
   await prepareCatalog(base.data,catalog);const initial=scoped(base.data,catalog,u.games);if(initial.games.length!==u.games.length)throw fail('分配的游戏 ID 不存在，请联系管理员',409);
   const previous=await db.prepare('SELECT MAX(draft_revision) AS revision FROM collaborator_reviews_v79 WHERE email=?').bind(u.email).first();
   const revision=Math.max(Date.now(),Number(previous?.revision||0)+1);
   await db.prepare('INSERT OR IGNORE INTO collaborator_drafts_v79 VALUES(?,?,?,?,?,?,?)').bind(u.email,base.sha,JSON.stringify(base.data),JSON.stringify(catalog),JSON.stringify(initial),revision,Date.now()).run();
   draft=await db.prepare('SELECT * FROM collaborator_drafts_v79 WHERE email=?').bind(u.email).first();
  }
  const data=JSON.parse(draft.data);if(data.games.some(g=>!u.games.includes(g.id)))throw fail('权限已变化，请点击重新加载最新数据',409);
  const items=await db.prepare('SELECT id,status,pr_url,note,head_sha,created_at FROM collaborator_reviews_v79 WHERE email=? AND id NOT IN (SELECT id FROM collaborator_hidden_records) ORDER BY created_at DESC LIMIT 50').bind(u.email).all();
  const catalog=JSON.parse(draft.catalog);return json({email:u.email,games:u.games,revision:draft.revision,baseSha:draft.base_sha,data,sourceEvents:catalog.events.filter(e=>u.games.includes(e.gameId)),items:items.results});
 }
 if(request.method==='DELETE'){await db.prepare('DELETE FROM collaborator_revision_links WHERE email=?').bind(u.email).run();
  await db.prepare('DELETE FROM collaborator_drafts_v79 WHERE email=?').bind(u.email).run();return json({ok:true});
 }
 if(request.method==='POST'){
  const b=await body(request),id=String(b.id||''),p=await db.prepare('SELECT * FROM collaborator_reviews_v79 WHERE id=? AND email=?').bind(id,u.email).first();if(!p)throw fail('提案不存在',404);
  if(b.action==='delete'){if(!['rejected','returned'].includes(p.status))throw fail('当前状态不能删除',409);await db.prepare('INSERT OR IGNORE INTO collaborator_hidden_records(id,email) VALUES(?,?)').bind(id,u.email).run();return json({ok:true})}
  if(b.action==='withdraw'){
 if(p.status!=='pending')throw fail('仅待审核提案可撤回',409);
 const lock=await db.prepare("UPDATE collaborator_reviews_v79 SET status='returned',note='协作者主动撤回修改',updated_at=? WHERE id=? AND email=? AND status='pending'").bind(Date.now(),p.id,u.email).run();if(!lock.meta.changes)throw fail('提案正在审批，请重试',409);
 if(p.pr_number){const pr=await gh(env.GH_TOKEN,repoPath(mainRepo(env))+'/pulls/'+p.pr_number);if(pr.merged)throw fail('PR已合并，不能撤回',409);if(pr.state==='open')await gh(env.GH_TOKEN,repoPath(mainRepo(env))+'/pulls/'+p.pr_number,'PATCH',{state:'closed'})}
 await cleanupBranch(env,p);b.action='restore';p.status='returned';
 }
  if(b.action==='restore'){
 await db.prepare('INSERT INTO collaborator_revision_links(email,id) VALUES(?,?) ON CONFLICT(email) DO UPDATE SET id=excluded.id').bind(u.email,p.id).run();if(p.status!=='returned')throw fail('只有退回提案可以重新修改',409);const draft=await db.prepare('SELECT revision FROM collaborator_drafts_v79 WHERE email=?').bind(u.email).first();const rev=Math.max(Date.now(),Number(draft?.revision||0)+1);const full=await db.prepare('SELECT * FROM collaborator_drafts_v79 WHERE email=?').bind(u.email).first();if(!full)throw fail('请先加载草稿',409);const data=JSON.stringify(scoped(JSON.parse(p.proposed),JSON.parse(full.catalog),u.games));mergeScoped(JSON.parse(full.snapshot),JSON.parse(full.catalog),JSON.parse(data),u.games);await db.prepare('UPDATE collaborator_drafts_v79 SET data=?,revision=?,updated_at=? WHERE email=?').bind(data,rev,rev,u.email).run();return json({ok:true,revision:rev})}
  throw fail('操作无效',400);
 }
 if(request.method!=='PUT')return json({error:'方法不支持'},405);
 const b=await body(request),draft=await db.prepare('SELECT * FROM collaborator_drafts_v79 WHERE email=?').bind(u.email).first();if(!draft)throw fail('请先加载最新数据',409);
 mergeScoped(JSON.parse(draft.snapshot),JSON.parse(draft.catalog),b.data,u.games);
 const rev=Math.max(Date.now(),Number(draft.revision)+1);const result=await db.prepare('UPDATE collaborator_drafts_v79 SET data=?,revision=?,updated_at=? WHERE email=? AND revision=?').bind(JSON.stringify(b.data),rev,rev,u.email,b.revision).run();
 if(!result.meta.changes)throw fail('草稿已在其他页面更新，请重新加载',409);return json({ok:true,revision:rev});
});


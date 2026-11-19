import {member,json,body,endpoint,fail} from '../../../lib/collaborator-auth.js';
import {baseline,file,mainRepo} from '../../../lib/collaborator-github.js';
import {scoped,mergeScoped,prepareCatalog} from '../../../lib/collaborator-data.js';
export const onRequest=endpoint(async({request,env})=>{
 const u=await member(request,env),db=env.APPLICATION_DB;
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
  const items=await db.prepare('SELECT id,status,pr_url,note,head_sha,created_at FROM collaborator_reviews_v79 WHERE email=? ORDER BY created_at DESC LIMIT 50').bind(u.email).all();
  const catalog=JSON.parse(draft.catalog);return json({email:u.email,games:u.games,revision:draft.revision,baseSha:draft.base_sha,data,sourceEvents:catalog.events.filter(e=>u.games.includes(e.gameId)),items:items.results});
 }
 if(request.method==='DELETE'){
  await db.prepare('DELETE FROM collaborator_drafts_v79 WHERE email=?').bind(u.email).run();return json({ok:true});
 }
 if(request.method!=='PUT')return json({error:'方法不支持'},405);
 const b=await body(request),draft=await db.prepare('SELECT * FROM collaborator_drafts_v79 WHERE email=?').bind(u.email).first();if(!draft)throw fail('请先加载最新数据',409);
 mergeScoped(JSON.parse(draft.snapshot),JSON.parse(draft.catalog),b.data,u.games);
 const rev=Math.max(Date.now(),Number(draft.revision)+1);const result=await db.prepare('UPDATE collaborator_drafts_v79 SET data=?,revision=?,updated_at=? WHERE email=? AND revision=?').bind(JSON.stringify(b.data),rev,rev,u.email,b.revision).run();
 if(!result.meta.changes)throw fail('草稿已在其他页面更新，请重新加载',409);return json({ok:true,revision:rev});
});


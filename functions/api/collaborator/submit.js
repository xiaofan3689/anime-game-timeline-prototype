import {requirePreview} from '../../../lib/content-preview.js';
import {member,body,json,endpoint,fail} from '../../../lib/collaborator-auth.js';
import {baseline,credential,gh,mainRepo} from '../../../lib/collaborator-github.js';
import {mergeScoped,canonical,diffData} from '../../../lib/collaborator-data.js';
import {buildPR} from '../../../lib/collaborator-publish.js';
import {delegated,robot,channel} from '../../../lib/github-app-installation.js';
import {usesOwnGithub} from '../../../lib/collaborator-mode.js';
export const onRequest=endpoint(async({request,env})=>{
 if(request.method!=='POST')return json({error:'方法不支持'},405);
 const u=await member(request,env),b=await body(request),db=env.APPLICATION_DB;await db.prepare('CREATE TABLE IF NOT EXISTS collaborator_revision_links(email TEXT PRIMARY KEY,id TEXT NOT NULL)').run();
 const draft=await db.prepare('SELECT * FROM collaborator_drafts_v79 WHERE email=?').bind(u.email).first();if(!draft||draft.revision!==b.revision)throw fail('草稿版本已变化，请重新加载',409);
 const before=JSON.parse(draft.snapshot),after=mergeScoped(before,JSON.parse(draft.catalog),JSON.parse(draft.data),u.games);
 await requirePreview(env,u.email,'collaborator',after);if(!diffData(before,after).length)throw fail('没有需要提交的修改');
 const mode=await usesOwnGithub(env,u.email)?'app-personal':'app-bot';if(!['app-personal','app-bot'].includes(mode))throw fail('请选择本人提交或机器人代提交');
 const bot=mode==='app-bot'?await robot(env):null;let c;if(bot)c={github_user_id:bot.user.id,login:bot.user.login,fork_repo:bot.forkRepo};else{const auth=await credential(env,u.email),user=await gh(auth.token,'/user');if(Number(user.id)!==Number(auth.github_user_id))throw fail('GitHub 身份已变化',409);c={github_user_id:user.id,login:user.login,fork_repo:mainRepo(env)}}const now=Date.now();
 const active=await db.prepare("SELECT id,draft_revision FROM collaborator_reviews_v79 WHERE email=? AND status IN ('pending','preparing','merging') LIMIT 1").bind(u.email).first();
 if(active&&active.draft_revision!==draft.revision)throw fail('你已有处理中提案，请等待审理结束后再提交新版本',409);
 const link=await db.prepare('SELECT id FROM collaborator_revision_links WHERE email=?').bind(u.email).first();
 if(link){const prior=await db.prepare('SELECT * FROM collaborator_reviews_v79 WHERE id=? AND email=?').bind(link.id,u.email).first();if(!prior||prior.status!=='returned')throw fail('关联提案状态已变化',409);
 await cleanupBranch(env,prior);
 const changed=await db.prepare("UPDATE collaborator_reviews_v79 SET status='failed',draft_revision=?,proposed=?,base_sha=?,snapshot=?,scope=?,head_sha=NULL,pr_number=NULL,pr_url=NULL,updated_at=? WHERE id=? AND status='returned'").bind(draft.revision,JSON.stringify(after),draft.base_sha,draft.snapshot,JSON.stringify(u.games),now,prior.id).run();if(!changed.meta.changes)throw fail('提案状态竞争',409);
 }
 let p=await db.prepare('SELECT * FROM collaborator_reviews_v79 WHERE email=? AND draft_revision=?').bind(u.email,draft.revision).first();
 if(p&&await channel(env,p.id)!==mode)throw fail('提案提交身份不可变，请另存新版本',409);
 if(p?.status==='pending'||p?.status==='merged')return json({ok:true,id:p.id,prUrl:p.pr_url,status:p.status});
 if(p&&!['failed','preparing'].includes(p.status))throw fail('提案已退回或拒绝，请修改后保存为新版本',409);
 if(p?.status==='preparing'&&now-p.updated_at<120000)throw fail('正在创建 PR，请稍后刷新；不要重复提交',409);
 const current=await baseline(env);if(canonical(current.data)!==canonical(before))throw fail('主仓库人工数据已变化，请重新加载最新数据',409);
 if(!p){const id=crypto.randomUUID();await db.batch([db.prepare("INSERT OR IGNORE INTO collaborator_reviews_v79(id,email,github_user_id,login,fork_repo,branch,base_sha,snapshot,proposed,scope,status,draft_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'failed',?,?,?)").bind(id,u.email,c.github_user_id,c.login,c.fork_repo,'collab-'+id,draft.base_sha,draft.snapshot,JSON.stringify(after),JSON.stringify(u.games),draft.revision,now,now),db.prepare('INSERT INTO collaborator_review_channels SELECT id,? FROM collaborator_reviews_v79 WHERE id=?').bind(mode,id)]);p=await db.prepare('SELECT * FROM collaborator_reviews_v79 WHERE email=? AND draft_revision=?').bind(u.email,draft.revision).first();if(await channel(env,p.id)!==mode)throw fail('提案身份竞争，请刷新',409);}
 const lock=await db.prepare("UPDATE collaborator_reviews_v79 SET status='preparing',updated_at=? WHERE id=? AND (status='failed' OR (status='preparing' AND updated_at<?))").bind(now,p.id,now-120000).run();if(!lock.meta.changes)throw fail('提案正在处理',409);
 try{const result=await buildPR(env,p);await db.prepare('DELETE FROM collaborator_revision_links WHERE email=? AND id=?').bind(u.email,p.id).run();return json({ok:true,...result})}catch(e){await db.prepare("UPDATE collaborator_reviews_v79 SET status='failed',note=?,updated_at=? WHERE id=? AND status='preparing'").bind(e.message,Date.now(),p.id).run();throw e}
});

import {admin,body,json,endpoint,audit} from '../../../lib/collaborator-auth.js';
import {setGithubMode} from '../../../lib/collaborator-mode.js';
export const onRequest=endpoint(async({request,env})=>{
 const actor=await admin(request,env),db=env.APPLICATION_DB;
 if(request.method==='GET'){const r=await db.prepare('SELECT u.email,u.active,u.games,u.github_id,u.updated_at,COALESCE(am.use_github,1) AS use_github,m.requested_at,m.approved_at,m.last_login_at FROM collaborator_users u LEFT JOIN collaborator_account_modes am ON am.email=u.email LEFT JOIN collaborator_account_meta m ON m.email=u.email ORDER BY u.email').all();return json({items:r.results})}
 if(request.method!=='PUT')return json({error:'方法不支持'},405);
 const b=await body(request),email=String(b.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Array.isArray(b.games)||b.games.length>100||!b.games.every(x=>x==='*'||/^[a-z0-9-]{2,40}$/.test(x)))throw Error('邮箱或游戏 ID 无效');
 const ids=b.allGames===true?["*"]:[...new Set(b.games)],now=Date.now();await db.prepare("INSERT INTO collaborator_users(email,active,games,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET active=excluded.active,games=excluded.games,updated_at=excluded.updated_at").bind(email,b.active===true?1:0,JSON.stringify(ids),now,now).run();
 if(b.active===true)await db.prepare('INSERT INTO collaborator_account_meta(email,approved_at) VALUES(?,?) ON CONFLICT(email) DO UPDATE SET approved_at=COALESCE(collaborator_account_meta.approved_at,excluded.approved_at)').bind(email,now).run();if(b.active!==true)await db.batch([db.prepare('DELETE FROM collaborator_credentials WHERE email=?').bind(email),db.prepare("UPDATE collaborator_invitations SET status='revoked' WHERE email=? AND status IN ('sent','prepared')").bind(email),db.prepare('DELETE FROM collaborator_oauth_states WHERE email=?').bind(email)]);
 await setGithubMode(env,email,b.useGithub===true);
 await audit(env,actor,null,'set-member',JSON.stringify({email,active:b.active===true,games:ids}));return json({ok:true});
});

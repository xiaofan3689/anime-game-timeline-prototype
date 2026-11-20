import {member,body,json,endpoint,audit} from '../../../lib/collaborator-auth.js';
import {seal,verifyCredential,credential,gh} from '../../../lib/collaborator-github.js';
import {usesOwnGithub} from '../../../lib/collaborator-mode.js';
export const onRequest=endpoint(async({request,env})=>{
 const u=await member(request,env),db=env.APPLICATION_DB;
 if(request.method==='GET'){const c=await db.prepare('SELECT login,fork_repo,updated_at FROM collaborator_credentials WHERE email=?').bind(u.email).first();return json({useGithub:await usesOwnGithub(env,u.email),connection:c,appConfigured:!!(env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET),installUrl:env.GITHUB_APP_SLUG&&/^[a-z0-9-]+$/.test(env.GITHUB_APP_SLUG)?'https://github.com/apps/'+env.GITHUB_APP_SLUG+'/installations/new':null})}
 if(request.method==='DELETE'){await db.prepare('DELETE FROM collaborator_credentials WHERE email=?').bind(u.email).run();await audit(env,u.email,null,'github-disconnect');return json({ok:true})}
 if(request.method!=='POST')return json({error:'方法不支持'},405);
 const b=await body(request);
 if(!b.token){const c=await credential(env,u.email);const {user,fork}=await verifyCredential(env,c.token,b.forkRepo,c.github_user_id);await db.prepare('UPDATE collaborator_credentials SET fork_repo=?,login=?,updated_at=? WHERE email=? AND github_user_id=?').bind(fork.full_name,user.login,Date.now(),u.email,user.id).run();return json({ok:true,login:user.login,forkRepo:fork.full_name})}
 if(typeof b.token!=='string'||b.token.length>500)throw Error('令牌格式无效');
 const user=await gh(b.token,'/user'),fork={full_name:''};
 const cipher=await seal(env,u.email,b.token);
 await db.prepare('INSERT INTO collaborator_credentials VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET github_user_id=excluded.github_user_id,login=excluded.login,fork_repo=excluded.fork_repo,cipher=excluded.cipher,updated_at=excluded.updated_at').bind(u.email,user.id,user.login,fork.full_name,cipher,Date.now()).run();
 await audit(env,u.email,null,'github-connect',user.login);return json({ok:true,login:user.login,forkRepo:fork.full_name});
});

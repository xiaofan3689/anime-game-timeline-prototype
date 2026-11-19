import {admin,body,json,endpoint} from '../../../lib/collaborator-auth.js';
import {reviewApplication} from '../../../lib/collaborator-invitations.js';
import {sendApplicationMail} from '../../../lib/qq-smtp.js';
import {file,mainRepo} from '../../../lib/collaborator-github.js';
export const onRequest=endpoint(async({request,env})=>{
 const actor=await admin(request,env);
 if(request.method==='GET'){
  const r=await env.APPLICATION_DB.prepare('SELECT id,email,has_github,use_github,username,status,created_at FROM collaborator_applications ORDER BY created_at DESC LIMIT 1000').all();
  const catalog=(await file(env.GH_TOKEN,mainRepo(env),env.GH_BRANCH||'main','data/events.json')).data;
  return json({applications:r.results,games:catalog.games.map(g=>({id:g.id,name:g.name}))});
 }
 if(request.method!=='POST')return json({error:'方法不支持'},405);
 const input=await body(request);if(input.allGames===true)input.games=['*'];
 if(input.action!=='refuse'&&input.allGames!==true){const catalog=(await file(env.GH_TOKEN,mainRepo(env),env.GH_BRANCH||'main','data/events.json')).data;if(!Array.isArray(input.games)||input.games.some(id=>!catalog.games.some(g=>g.id===id)))throw Error('分配的游戏不存在')}
 return json(await reviewApplication(env,actor,input,sendApplicationMail));
});

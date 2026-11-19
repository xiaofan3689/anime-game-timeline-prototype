import {member,json,endpoint} from '../../../../lib/collaborator-auth.js';
import {random,digest,oauthConfig} from '../../../../lib/collaborator-oauth.js';
export const onRequest=endpoint(async({request,env})=>{
 if(request.method!=='POST')return json({error:'方法不支持'},405);
 const u=await member(request,env),config=oauthConfig(env,request),state=random(),verifier=random(),db=env.APPLICATION_DB;
 await db.prepare('DELETE FROM collaborator_oauth_states WHERE expires_at<?').bind(Date.now()).run();
 await db.prepare('INSERT INTO collaborator_oauth_states VALUES(?,?,?,?)').bind(await digest(state),u.email,verifier,Date.now()+600000).run();
 const url=new URL('https://github.com/login/oauth/authorize');for(const [k,v] of Object.entries({client_id:config.client_id,redirect_uri:config.redirect_uri,state,scope:'offline_access',code_challenge:await digest(verifier),code_challenge_method:'S256'}))url.searchParams.set(k,v);
 return new Response(JSON.stringify({url:url.href}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':`__Host-collab-oauth=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`}});
});

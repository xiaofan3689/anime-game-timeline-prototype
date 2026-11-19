import {member,audit} from '../../../../lib/collaborator-auth.js';
import {digest,oauthConfig,exchange,saveOAuth} from '../../../../lib/collaborator-oauth.js';
export async function onRequest({request,env}){
 let success=false;
 try{
  if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  const u=await member(request,env),url=new URL(request.url),state=url.searchParams.get('state'),cookie=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-collab-oauth='))?.split('=')[1];
  if(!state||state!==cookie||state.length!==43)throw Error('State mismatch');
  const config=oauthConfig(env,request);
  const stored=await env.APPLICATION_DB.prepare('DELETE FROM collaborator_oauth_states WHERE state_hash=? AND email=? AND expires_at>? RETURNING verifier').bind(await digest(state),u.email,Date.now()).first();
  if(!stored||!url.searchParams.get('code')||url.searchParams.has('error'))throw Error('Expired state or denied');
  const payload=await exchange(env,{code:url.searchParams.get('code'),redirect_uri:config.redirect_uri,code_verifier:stored.verifier});
  const user=await saveOAuth(env,u.email,payload);await audit(env,u.email,null,'github-app-authorized',String(user.id));success=true;
 }catch{/* Never include code, state, access tokens or provider error bodies in redirects/logs. */}
 return new Response(null,{status:303,headers:{Location:'/collaborator/?github='+(success?'authorized':'failed'),'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':'__Host-collab-oauth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'}});
}

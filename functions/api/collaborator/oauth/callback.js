import {member,audit} from '../../../../lib/collaborator-auth.js';
import {digest,oauthConfig,exchange,saveOAuth} from '../../../../lib/collaborator-oauth.js';
export async function onRequest({request,env}){
 let success=false,stage='identity',reason='';const requestId=crypto.randomUUID();
 try{
  if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  const u=await member(request,env),url=new URL(request.url),state=url.searchParams.get('state'),cookie=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-collab-oauth='))?.split('=')[1];
  stage='state';if(!state||state!==cookie||state.length!==43)throw Error('State mismatch');
  stage='config';const config=oauthConfig(env,request);
  stage='state-store';const stored=await env.APPLICATION_DB.prepare('DELETE FROM collaborator_oauth_states WHERE state_hash=? AND email=? AND expires_at>? RETURNING verifier').bind(await digest(state),u.email,Date.now()).first();
  if(!stored||!url.searchParams.get('code')||url.searchParams.has('error'))throw Error('Expired state or denied');
  stage='exchange';const payload=await exchange(env,{code:url.searchParams.get('code'),redirect_uri:config.redirect_uri,code_verifier:stored.verifier});
  stage='save';const user=await saveOAuth(env,u.email,payload);stage='audit';await audit(env,u.email,null,'github-app-authorized',String(user.id));success=true;
 }catch(e){reason='OAUTH_'+stage.toUpperCase().replace(/-/g,'_');console.error(JSON.stringify({event:'collaborator_oauth_failed',requestId,stage,code:reason}));}
 return new Response(null,{status:303,headers:{Location:'/collaborator/?github='+(success?'authorized':'failed&oauth_error='+encodeURIComponent(reason)+'&request_id='+encodeURIComponent(requestId)),'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':'__Host-collab-oauth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'}});
}

import {fail} from './collaborator-auth.js';
import {seal,gh,repoPath,mainRepo} from './collaborator-github.js';
export const base64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const random=()=>base64url(crypto.getRandomValues(new Uint8Array(32)));
export const digest=async s=>base64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
export function oauthConfig(env,request){
 if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||!env.SITE_URL)throw fail('GitHub App 授权尚未配置',503);
 const site=new URL(env.SITE_URL);if(site.protocol!=='https:'||site.origin!==new URL(request.url).origin)throw fail('SITE_URL 与当前网站不一致',503);
 return {client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,redirect_uri:site.origin+'/api/collaborator/oauth/callback'};
}
export async function exchange(env,params){
 if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET)throw fail('GitHub App 未配置',503);
 const r=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,...params})});
 const b=await r.json();if(!r.ok||b.error||typeof b.access_token!=='string')throw fail('GitHub App 授权失败，请重新授权',401);
 if(!Number.isFinite(b.expires_in)||!b.refresh_token||!Number.isFinite(b.refresh_token_expires_in))throw fail('请为 GitHub App 启用过期用户令牌后重试',503);
 return {kind:'github-app',accessToken:b.access_token,refreshToken:b.refresh_token,expiresAt:Date.now()+b.expires_in*1000,refreshExpiresAt:Date.now()+b.refresh_token_expires_in*1000};
}
export async function saveOAuth(env,email,payload){
 const user=await gh(payload.accessToken,'/user');
 const cipher=await seal(env,email,JSON.stringify(payload));
 // Changing GitHub identity clears the previous Fork selection.
 await env.APPLICATION_DB.prepare("INSERT INTO collaborator_credentials VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET github_user_id=excluded.github_user_id,login=excluded.login,fork_repo=CASE WHEN collaborator_credentials.github_user_id=excluded.github_user_id THEN collaborator_credentials.fork_repo ELSE '' END,cipher=excluded.cipher,updated_at=excluded.updated_at").bind(email,user.id,user.login,'',cipher,Date.now()).run();return user;
}

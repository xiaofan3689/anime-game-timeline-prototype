import {base64url} from './collaborator-oauth.js';
import {gh,mainRepo,repoPath} from './collaborator-github.js';
import {fail} from './collaborator-auth.js';
function tlv(tag,bytes){const n=bytes.length,len=n<128?[n]:n<256?[129,n]:n<65536?[130,n>>8,n&255]:[131,n>>16,(n>>8)&255,n&255];return Uint8Array.from([tag,...len,...bytes])}
export async function appJWT(env){
 if(!env.GITHUB_APP_ID||!env.GITHUB_APP_PRIVATE_KEY)throw fail('GitHub App 安装令牌尚未配置',503);
 const pem=env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g,'\n'),raw=Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));
 const pkcs8=pem.includes('BEGIN RSA PRIVATE KEY')?tlv(48,[2,1,0,48,13,6,9,42,134,72,134,247,13,1,1,1,5,0,...tlv(4,raw)]):raw;
 const key=await crypto.subtle.importKey('pkcs8',pkcs8,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']),now=Math.floor(Date.now()/1000);
 const encoded=v=>base64url(new TextEncoder().encode(JSON.stringify(v))),data=encoded({alg:'RS256',typ:'JWT'})+'.'+encoded({iat:now-60,exp:now+540,iss:String(env.GITHUB_APP_ID)});
 return data+'.'+base64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(data)));
}
export async function robot(env){
 if(!/^\d+$/.test(String(env.GITHUB_MAIN_INSTALLATION_ID||''))||!/^[a-z0-9-]+$/.test(env.GITHUB_APP_SLUG||''))throw fail('主仓库 App 安装 ID 或 slug 未配置',503);
 const jwt=await appJWT(env),target=mainRepo(env);
 const installation=await gh(jwt,repoPath(target)+'/installation');if(String(installation.id)!==String(env.GITHUB_MAIN_INSTALLATION_ID)||String(installation.app_id)!==String(env.GITHUB_APP_ID)||installation.suspended_at)throw fail('主仓库 App 安装不匹配或已停用',403);
 const meta=await gh(env.GH_TOKEN,repoPath(target));
 const result=await gh(jwt,'/app/installations/'+env.GITHUB_MAIN_INSTALLATION_ID+'/access_tokens','POST',{repository_ids:[meta.id],permissions:{contents:'write',pull_requests:'write'}});
 const user=await gh(result.token,'/users/'+encodeURIComponent(env.GITHUB_APP_SLUG+'[bot]'));
 return {token:result.token,user,forkRepo:target};
}
export async function delegated(env){const target=mainRepo(env),user=await gh(env.GH_TOKEN,'/user');return {token:env.GH_TOKEN,user,forkRepo:target}}
export async function channel(env,id){return (await env.APPLICATION_DB.prepare('SELECT mode FROM collaborator_review_channels WHERE id=?').bind(id).first())?.mode||'personal'}

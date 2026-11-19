import {admin,body,json} from '../../../lib/collaborator-auth.js';
import {reviewApplication} from '../../../lib/collaborator-invitations.js';
import {reviewCatalog} from '../../../lib/review-catalog.js';
export async function onRequest({request,env}){
 let stage='authentication';const requestId=crypto.randomUUID();
 try{
  const actor=await admin(request,env);
  if(request.method==='GET'){
   stage='applications';
   const rows=await env.APPLICATION_DB.prepare('SELECT id,email,has_github,use_github,username,status,created_at FROM collaborator_applications ORDER BY created_at DESC LIMIT 1000').all();
   stage='catalog';const catalog=await reviewCatalog(request,env);
   const archive=await env.APPLICATION_DB.prepare('SELECT * FROM collaborator_application_archive ORDER BY reviewed_at DESC LIMIT 1000').all();return json({applications:[...(rows.results||[]),...(archive.results||[])],games:catalog.games,catalogSource:catalog.source});
  }
  if(request.method!=='POST')return json({error:'方法不支持'},405);
  stage='input';const input=await body(request);
  if(input.allGames===true)input.games=['*'];
  if(input.action!=='refuse'&&input.allGames!==true){stage='catalog';const catalog=await reviewCatalog(request,env);if(!Array.isArray(input.games)||input.games.some(id=>!catalog.games.some(g=>g.id===id)))return json({error:'分配的游戏不存在',code:'REVIEW_GAMES_INVALID'},400)}
  stage='review';
  const sendMail=async(...args)=>{const {sendApplicationMail}=await import('../../../lib/qq-smtp.js');return sendApplicationMail(...args)};
  return json(await reviewApplication(env,actor,input,sendMail));
 }catch(e){
  const code=e.code?.startsWith('ACCESS_')?e.code:'REVIEW_'+stage.toUpperCase()+'_FAILED';
  console.error(JSON.stringify({event:'admin_reviews_failed',requestId,stage,code,errorType:e.name}));
  let message=e.message||'请求失败';
  if(stage==='applications')message='申请记录读取失败，请检查 APPLICATION_DB 绑定及 applications.sql 表结构';
  return json({error:message,code,requestId},e.status||(['applications','catalog'].includes(stage)?503:400));
 }
}

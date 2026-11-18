import {authorize} from './manual.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function onRequest(context){
 const {request,env}=context;if(!await authorize(context))return json({error:'无管理员权限'},403);
 if(!env.APPLICATION_DB)return json({error:'APPLICATION_DB 未绑定'},503);
 try{
  if(request.method==='GET'){
   const offset=Math.min(1000000,Math.max(0,Number(new URL(request.url).searchParams.get('offset'))||0));
   const rows=await env.APPLICATION_DB.prepare('SELECT * FROM user_feedback ORDER BY created_at DESC,id DESC LIMIT 101 OFFSET ?').bind(offset).all();
   const items=rows.results.slice(0,100);return json({items,nextBefore:rows.results.length>100?offset+100:null});
  }
  if(request.method!=='POST')return json({error:'方法不支持'},405);
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'来源无效'},403);
  const text=await request.text();if(text.length>1024)return json({error:'请求过大'},413);const b=JSON.parse(text);
  if(!['pending','reviewing','resolved'].includes(b.status)||typeof b.id!=='string'||b.id.length!==36)return json({error:'状态无效'},400);
  const r=await env.APPLICATION_DB.prepare('UPDATE user_feedback SET status=?,updated_at=? WHERE id=?').bind(b.status,Date.now(),b.id).run();
  return r.meta.changes?json({ok:true}):json({error:'反馈不存在'},404);
 }catch{return json({error:'反馈读取或处理失败，请确认 feedback.sql 已执行'},500)}
}

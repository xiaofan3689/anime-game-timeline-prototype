import {sendApplicationMail} from '../../lib/qq-smtp.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const categories=['现有功能使用','未有功能需求','优化建议','其他'];
export async function onRequest({request,env}){
 if(request.method!=='POST')return json({error:'方法不支持'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'来源无效'},403);
 if(!env.APPLICATION_DB)return json({error:'反馈数据库未配置，请联系管理员'},503);
 try{
  const raw=await request.text();if(raw.length>16000)return json({error:'内容过长'},413);const b=JSON.parse(raw);
  const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
  const description=typeof b.description==='string'?b.description.trim():'';
  if(!/^[a-f0-9-]{36}$/.test(b.id||'')||!categories.includes(b.category)||!description||description.length>3000||email.length>254||!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email))return json({error:'请选择类别、填写有效邮箱及1—3000字的反馈描述'},400);
  const db=env.APPLICATION_DB;
  const prior=await db.prepare('SELECT category,email,description FROM user_feedback WHERE id=?').bind(b.id).first();
  if(prior){if(prior.category!==b.category||prior.email!==email||prior.description!==description)return json({error:'提交编号已使用，请关闭后重新填写'},409);return json({ok:true,message:'该反馈已记录，请勿重复提交。'})}
  const now=Date.now(),ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip))),v=>v.toString(16).padStart(2,'0')).join('');
  for(const [bucket,limit] of [[`ip:${digest}:${Math.floor(now/3600000)}`,5],[`day:${Math.floor(now/86400000)}`,100]]){
   const result=await db.prepare('INSERT INTO feedback_limits(bucket,count) VALUES (?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket).first();if(result.count>limit)return json({error:'反馈提交较频繁，请稍后再试'},429);
  }
  const result=await db.prepare("INSERT OR IGNORE INTO user_feedback(id,category,email,description,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind(b.id,b.category,email,description,now,now).run();
  if(!result.meta.changes)return json({ok:true,message:'反馈已记录，请勿重复提交。'});
  const site=new URL(request.url).origin;let sent=true;
  try{await sendApplicationMail(env,`收到一条用户建议反馈，待管理员审理。\n编号：${b.id}\n类别：${b.category}\n用户填写邮箱（未经本接口验证）：${email}\n\n反馈描述：\n${description}\n\n审理入口：${site}/admin/feedback.html`, env.FEEDBACK_NOTIFY_EMAIL || env.ADMIN_EMAIL || '', '次元时刻：用户反馈待审理')}catch{sent=false}
  try{await db.prepare('UPDATE user_feedback SET notification=? WHERE id=?').bind(sent?'accepted':'uncertain',b.id).run()}catch{/* Feedback is already saved: do not report submission failure. */}
  return json({ok:true,message:sent?'反馈已记录，审理通知已交给邮件服务器。':'反馈已记录，管理员可在后台查看；邮件通知暂未确认成功，请勿重复提交。'});
 }catch{return json({error:'反馈暂未确认保存，请检查网络后重试；管理员需确认 feedback.sql 已在绑定库执行'},500)}
}

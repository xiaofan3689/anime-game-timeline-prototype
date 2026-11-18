import {accountKey,stateOf} from '../../lib/email-session.js';
import {hash} from '../../lib/email-reminders.js';
import {sendApplicationMail} from '../../lib/qq-smtp.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const list=(x,max)=>Array.isArray(x)&&x.length<=max&&x.every(v=>typeof v==='string'&&v.length>0&&v.length<=160);
export async function onRequest({request,env}){
 if(request.method!=='POST')return json({error:'方法不支持'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'来源无效'},403);
 if(!env.APPLICATION_DB)return json({error:'邮件提醒数据库尚未配置'},503);
 try{
 const raw=await request.text();if(raw.length>100000)return json({error:'请求过大'},413);const b=JSON.parse(raw);
 if(!/^[a-f0-9]{64}$/.test(b.token||''))return json({error:'订阅凭证无效'},400);
 const db=env.APPLICATION_DB,rawKey=await hash(b.token),key=await accountKey(db,rawKey),now=Date.now();
 let row=await db.prepare('SELECT * FROM email_subscriptions WHERE token_hash=?').bind(key).first();
 if(b.action==='get')return json({email:row?.email||'',pendingEmail:row?.pending_email||'',active:!!row?.active,...(row?.email?stateOf(row):{})});
 if(b.action==='request-code'){
  const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
  if(email.length>254||!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email))return json({error:'请输入有效邮箱'},400);
  if(row&&now-row.code_sent<60000)return json({error:'请60秒后再试'},429);
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  for(const [bucket,limit] of [[`ip:${await hash(ip)}:${Math.floor(now/3600000)}`,10],[`mail:${await hash(email)}:${Math.floor(now/3600000)}`,5],[`day:${Math.floor(now/86400000)}`,100]]){
   const r=await db.prepare('INSERT INTO email_rate_limits(bucket,count) VALUES (?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket).first();if(r.count>limit)return json({error:'验证邮件发送频率已达上限，请稍后再试'},429);
  }
  const numbers=new Uint32Array(1);crypto.getRandomValues(numbers);const code=String(numbers[0]%1000000).padStart(6,'0');
  await db.prepare(`INSERT INTO email_subscriptions(token_hash,pending_email,code_hash,code_expires,code_sent,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(token_hash) DO UPDATE SET pending_email=excluded.pending_email,code_hash=excluded.code_hash,code_expires=excluded.code_expires,code_sent=excluded.code_sent,attempts=0`).bind(key,email,await hash(key+email+code),now+600000,now,now).run();
  try{await sendApplicationMail(env,`你的次元时刻邮件提醒验证码是：${code}\n10分钟内有效。只有在网站确认后才会启用或替换提醒邮箱。若非本人操作，请忽略。`,email,'次元时刻：验证提醒邮箱')}catch{return json({error:'验证码未确认发送成功，请稍后重试'},502)}
  return json({ok:true});
 }
 if(!row)return json({error:'请先验证邮箱'},400);
 if(b.action==='stop'){await db.prepare('UPDATE email_subscriptions SET active=0,revision=revision+1,updated_at=? WHERE token_hash=?').bind(now,key).run();return json({ok:true})}
 if(!['confirm','sync'].includes(b.action))return json({error:'操作无效'},400);
 if(!list(b.games,100)||!list(b.completed,2000))return json({error:'游戏或完成状态无效'},400);
 if(b.action==='confirm'){
  if(!row.pending_email||row.code_expires<now||row.attempts>=5)return json({error:'验证码过期或次数已用完，请重新获取'},400);
  const attempt=await db.prepare('UPDATE email_subscriptions SET attempts=attempts+1 WHERE token_hash=? AND attempts<5 AND code_expires>=? RETURNING attempts').bind(key,now).first();
  if(!attempt||await hash(key+row.pending_email+String(b.code))!==row.code_hash)return json({error:'验证码错误'},400);
  // Claim OTP once, before linking this browser to an already verified account.
  const claimed=await db.prepare('UPDATE email_subscriptions SET code_hash=NULL WHERE token_hash=? AND code_hash=? AND code_expires>=?').bind(key,row.code_hash,now).run();
  if(!claimed.meta.changes)return json({error:'验证码已使用，请重新获取'},409);
  const existing=await db.prepare('SELECT * FROM email_subscriptions WHERE email=?').bind(row.pending_email).first();
  if(existing){
   await db.prepare('INSERT INTO email_sessions(token_hash,account_hash) VALUES (?,?) ON CONFLICT(token_hash) DO UPDATE SET account_hash=excluded.account_hash').bind(rawKey,existing.token_hash).run();
   await db.prepare('UPDATE email_subscriptions SET active=1,pending_email=NULL,revision=revision+1 WHERE token_hash=?').bind(existing.token_hash).run();
   const restored=await db.prepare('SELECT * FROM email_subscriptions WHERE token_hash=?').bind(existing.token_hash).first();
   return json({ok:true,restored:true,...stateOf(restored)});
  }
  const result=await db.prepare('UPDATE email_subscriptions SET email=pending_email,pending_email=NULL,active=1,games=?,completed=?,revision=revision+1,updated_at=? WHERE token_hash=? AND pending_email=?').bind(JSON.stringify([...new Set(b.games)]),JSON.stringify([...new Set(b.completed)]),now,key,row.pending_email).run();
  if(!result.meta.changes)return json({error:'验证状态已变化，请重试'},409);
  row=await db.prepare('SELECT * FROM email_subscriptions WHERE token_hash=?').bind(key).first();
  return json({ok:true,restored:false,...stateOf(row)});
 }else{
  if(!row.active)return json({error:'提醒已停止，请验证邮箱重新启用'},409);
  if(!Number.isInteger(b.revision))return json({error:'请刷新页面加载最新同步版本'},409);
  const result=await db.prepare('UPDATE email_subscriptions SET games=?,completed=?,revision=revision+1,updated_at=? WHERE token_hash=? AND active=1 AND revision=?').bind(JSON.stringify([...new Set(b.games)]),JSON.stringify([...new Set(b.completed)]),now,key,b.revision).run();
  if(!result.meta.changes){const latest=await db.prepare('SELECT * FROM email_subscriptions WHERE token_hash=?').bind(key).first();return json({error:'其他浏览器已更新，已恢复最新状态，请刷新页面',conflict:true,...stateOf(latest)},409)}
  return json({ok:true,revision:b.revision+1});
 }
 return json({ok:true});
 }catch{return json({error:'邮件提醒处理失败，请稍后再试'},500)}
}

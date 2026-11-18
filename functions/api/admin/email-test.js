import {authorize} from './manual.js';
import {eligible,hash} from '../../../lib/email-reminders.js';
import {sendApplicationMail} from '../../../lib/qq-smtp.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const validList=(value,max)=>Array.isArray(value)&&value.length<=max&&value.every(x=>typeof x==='string'&&x.length>0&&x.length<=160);
export async function onRequest(context){
 const {request,env}=context;
 if(request.method!=='POST')return json({error:'方法不支持'},405);
 if(!await authorize(context))return json({error:'无管理员权限，请确认 Access 登录和管理员邮箱配置'},403);
 const site=new URL(request.url).origin;
 if(request.headers.get('Origin')!==site)return json({error:'来源无效'},403);
 if(!env.APPLICATION_DB)return json({error:'请先执行邮件提醒 SQL 并绑定 APPLICATION_DB'},503);
 let stage='读取请求';
 try{
  const raw=await request.text();if(raw.length>100000)return json({error:'请求过大'},413);
  const b=JSON.parse(raw);if(!/^[a-f0-9]{64}$/.test(b.token||'')||!validList(b.games,100)||!validList(b.completed,2000))return json({error:'浏览器订阅凭证或游戏／完成数据无效'},400);
  const key=await hash(b.token),db=env.APPLICATION_DB;
  stage='读取提醒订阅表';
  const sub=await db.prepare('SELECT email,active FROM email_subscriptions WHERE token_hash=?').bind(key).first();
  if(!sub?.email||!sub.active)return json({error:'请先在当前域名首页验证提醒邮箱并启用提醒；停止提醒的订阅不能用于测试'},409);
  // Preferences come from the current browser; recipients and event content come from the server.
  stage='读取本站活动文件';
  const feedURL=new URL('/data/events.json',site);
  const response=env.ASSETS?.fetch?await env.ASSETS.fetch(new Request(feedURL)):await fetch(feedURL,{cache:'no-store'});
  if(!response.ok)return json({error:`读取 /data/events.json 返回 HTTP ${response.status}；请检查文件是否部署、Access 是否误保护公共数据路径`,stage},502);
  const feedText=await response.text();
  let feed;try{feed=JSON.parse(feedText)}catch{return json({error:'本站 /data/events.json 返回的不是 JSON，可能是 Access 登录页、404 页面或部署错误。请检查公共数据路径及部署版本。',stage},502)}
  stage='校验活动数据';if(!Array.isArray(feed.events)||!Array.isArray(feed.games))return json({error:'活动数据格式无效'},502);
  if(!Number.isFinite(Date.parse(feed.generatedAt))||Date.now()-Date.parse(feed.generatedAt)>6*3600000)return json({error:'活动数据超过6小时未更新或更新时间无效，请先运行 Sync game events'},409);
  const events=eligible(feed,b.games,b.completed);
  if(!events.length)return json({ok:true,count:0,message:'当前浏览器所选游戏没有未完成且将在48小时内结束的活动，未发送邮件。'});
  const now=Date.now();
  stage='写入邮件发送频率表';
  const lock=await db.prepare('INSERT INTO email_rate_limits(bucket,count) VALUES (?,1) ON CONFLICT(bucket) DO NOTHING').bind(`admin-test:${key}:${Math.floor(now/60000)}`).run();
  if(!lock.meta.changes)return json({error:'本分钟已尝试发送测试邮件，请下一分钟再试'},429);
  stage='同步游戏与完成状态';
  await db.prepare('UPDATE email_subscriptions SET games=?,completed=?,revision=revision+1,updated_at=? WHERE token_hash=? AND active=1').bind(JSON.stringify([...new Set(b.games)]),JSON.stringify([...new Set(b.completed)]),now,key).run();
  stage='生成邮件内容';
  const names=Object.fromEntries(feed.games.map(g=>[g.id,g.name]));
  const text='【管理员手动测试】\n当前浏览器所选游戏中，以下活动未标记完成，并将在48小时内结束：\n\n'+events.map(e=>`${names[e.gameId]||e.gameId} · ${e.title}\n截止：${new Date(e.endAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）`).join('\n\n')+'\n\n查看活动：'+site+'/\n本邮件为手动测试，不占用自动提醒的发送记录。';
  try{await sendApplicationMail(env,text,sub.email,'次元时刻：管理员测试活动提醒')}catch{return json({error:'测试邮件未确认发送成功，请检查 QQ SMTP 配置和日志；不要立即重复点击'},502)}
  return json({ok:true,count:events.length,message:`已将 ${events.length} 项活动的测试提醒交给邮件服务器，收件邮箱：${sub.email}。请检查收件箱及垃圾箱。`});
 }catch(error){
  const detail=String(error?.message||'');let reason='服务器内部错误，请按错误编号查询日志';
  if(/no such table/i.test(detail))reason='缺少邮件提醒数据表；请在 Pages 绑定的那一个 D1 库执行 scripts/email-reminders.sql（旧申请 SQL 不包含这些表）';
  else if(/no such column|has no column/i.test(detail))reason='邮件提醒表结构与本版不一致；请检查 D1 的表字段，CREATE TABLE IF NOT EXISTS 不会补齐旧表字段，不要删除已有订阅';
  else if(/D1|SQLITE|database/i.test(detail))reason='D1 数据库操作失败，请检查生产环境绑定与数据库状态';
  else if(stage==='读取本站活动文件')reason='服务器请求本站活动文件失败；请检查域名、Cloudflare 路由及公共数据访问';
  else if(stage==='读取请求')reason='请求不是有效 JSON，请刷新后台后重试';
  const errorId=crypto.randomUUID();
  console.error(JSON.stringify({component:'admin-email-test',errorId,stage,errorType:error?.name||'Error',category:reason}));
  return json({error:`测试失败：${stage}。${reason}。错误编号：${errorId}`,stage,errorId},500);
 }
}

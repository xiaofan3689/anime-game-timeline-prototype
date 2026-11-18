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
 try{
  const raw=await request.text();if(raw.length>100000)return json({error:'请求过大'},413);
  const b=JSON.parse(raw);if(!/^[a-f0-9]{64}$/.test(b.token||'')||!validList(b.games,100)||!validList(b.completed,2000))return json({error:'浏览器订阅凭证或游戏／完成数据无效'},400);
  const key=await hash(b.token),db=env.APPLICATION_DB;
  const sub=await db.prepare('SELECT email,active FROM email_subscriptions WHERE token_hash=?').bind(key).first();
  if(!sub?.email||!sub.active)return json({error:'请先在当前域名首页验证提醒邮箱并启用提醒；停止提醒的订阅不能用于测试'},409);
  // Preferences come from the current browser; recipients and event content come from the server.
  const response=await fetch(new URL('/data/events.json',site),{cache:'no-store'});
  if(!response.ok)return json({error:'无法读取本站活动数据'},502);
  const feed=await response.json();if(!Array.isArray(feed.events)||!Array.isArray(feed.games))return json({error:'活动数据格式无效'},502);
  if(!Number.isFinite(Date.parse(feed.generatedAt))||Date.now()-Date.parse(feed.generatedAt)>6*3600000)return json({error:'活动数据超过6小时未更新或更新时间无效，请先运行 Sync game events'},409);
  const events=eligible(feed,b.games,b.completed);
  if(!events.length)return json({ok:true,count:0,message:'当前浏览器所选游戏没有未完成且将在48小时内结束的活动，未发送邮件。'});
  const now=Date.now();
  const lock=await db.prepare('INSERT INTO email_rate_limits(bucket,count) VALUES (?,1) ON CONFLICT(bucket) DO NOTHING').bind(`admin-test:${key}:${Math.floor(now/60000)}`).run();
  if(!lock.meta.changes)return json({error:'本分钟已尝试发送测试邮件，请下一分钟再试'},429);
  await db.prepare('UPDATE email_subscriptions SET games=?,completed=?,revision=revision+1,updated_at=? WHERE token_hash=? AND active=1').bind(JSON.stringify([...new Set(b.games)]),JSON.stringify([...new Set(b.completed)]),now,key).run();
  const names=Object.fromEntries(feed.games.map(g=>[g.id,g.name]));
  const text='【管理员手动测试】\n当前浏览器所选游戏中，以下活动未标记完成，并将在48小时内结束：\n\n'+events.map(e=>`${names[e.gameId]||e.gameId} · ${e.title}\n截止：${new Date(e.endAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）`).join('\n\n')+'\n\n查看活动：'+site+'/\n本邮件为手动测试，不占用自动提醒的发送记录。';
  try{await sendApplicationMail(env,text,sub.email,'次元时刻：管理员测试活动提醒')}catch{return json({error:'测试邮件未确认发送成功，请检查 QQ SMTP 配置和日志；不要立即重复点击'},502)}
  return json({ok:true,count:events.length,message:`已将 ${events.length} 项活动的测试提醒交给邮件服务器，收件邮箱：${sub.email}。请检查收件箱及垃圾箱。`});
 }catch{return json({error:'测试失败，请确认新增 SQL 已执行、数据库已绑定并查看服务端日志'},500)}
}

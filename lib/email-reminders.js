export const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
export function eligible(feed,games,completed,now=Date.now()){
 const chosen=new Set(games),done=new Set(completed),seen=new Set();
 return feed.events.filter(e=>{const end=Date.parse(e.endAt);if(typeof e.id!=='string'||seen.has(e.id)||!chosen.has(e.gameId)||done.has(e.id)||!Number.isFinite(end)||end<=now||end>now+48*3600000)return false;seen.add(e.id);return true}).sort((a,b)=>Date.parse(a.endAt)-Date.parse(b.endAt));
}
export async function runReminders(env,send){
 const db=env.APPLICATION_DB;if(!db||!env.SITE_URL)throw Error('缺少 APPLICATION_DB 或 SITE_URL');
 const site=new URL(env.SITE_URL);if(site.protocol!=='https:')throw Error('SITE_URL 必须为 HTTPS');
 const response=await fetch(new URL('/data/events.json',site),{cache:'no-store'});if(!response.ok)throw Error('活动数据读取失败');
 const feed=await response.json();if(!Array.isArray(feed.events)||!Array.isArray(feed.games))throw Error('活动数据无效');
 if(!Number.isFinite(Date.parse(feed.generatedAt))||Date.now()-Date.parse(feed.generatedAt)>6*3600000)throw Error('活动数据超过6小时未更新，暂停发送');
 const rows=await db.prepare('SELECT token_hash FROM email_subscriptions WHERE active=1 ORDER BY checked_at ASC LIMIT 50').all();
 for(const {token_hash:key} of rows.results){
  await db.prepare('UPDATE email_subscriptions SET checked_at=? WHERE token_hash=?').bind(Date.now(),key).run();
  const sub=await db.prepare('SELECT * FROM email_subscriptions WHERE token_hash=? AND active=1').bind(key).first();if(!sub)continue;
  const candidates=eligible(feed,JSON.parse(sub.games),JSON.parse(sub.completed));const claimed=[];
  for(const e of candidates){const result=await db.prepare("INSERT OR IGNORE INTO email_deliveries(token_hash,event_id,status,created_at) VALUES (?,?,'sending',?)").bind(key,e.id,Date.now()).run();if(result.meta.changes)claimed.push(e)}
  if(!claimed.length)continue;
  // Re-read immediately before sending: preferences may have changed during feed processing.
  const fresh=await db.prepare('SELECT active,revision FROM email_subscriptions WHERE token_hash=?').bind(key).first();
  if(!fresh?.active||fresh.revision!==sub.revision){for(const e of claimed)await db.prepare("DELETE FROM email_deliveries WHERE token_hash=? AND event_id=? AND status='sending'").bind(key,e.id).run();continue}
  const names=Object.fromEntries(feed.games.map(g=>[g.id,g.name]));
  const text='你所选游戏中，以下活动尚未标记完成，并将在48小时内结束：\n\n'+claimed.map(e=>`${names[e.gameId]||e.gameId} · ${e.title}\n截止：${new Date(e.endAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）`).join('\n\n')+'\n\n打开网站查看或标记完成：'+site.href+'\n如需停止提醒，请在原浏览器点击“邮件提醒 → 停止提醒”。\n提醒依据该浏览器最后成功同步的游戏选择及完成状态；以官方公告为准。';
  let outcome='sent';try{await send(env,text,sub.email,'次元时刻：活动即将结束提醒')}catch{outcome='uncertain'}
  for(const e of claimed)await db.prepare('UPDATE email_deliveries SET status=? WHERE token_hash=? AND event_id=?').bind(outcome,key,e.id).run();
 }
}

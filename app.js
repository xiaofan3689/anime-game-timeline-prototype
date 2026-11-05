const state = {feed: null, status: 'all', game: 'all', query: ''};
const el = id => document.getElementById(id);
const dateFmt = new Intl.DateTimeFormat('zh-CN', {month:'long',day:'numeric',weekday:'long'});
const timeFmt = new Intl.DateTimeFormat('zh-CN', {hour:'2-digit',minute:'2-digit',hour12:false});
const stampFmt = new Intl.DateTimeFormat('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
function safeUrl(value) {try {const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : null;} catch {return null;}}
function statusOf(event) {const now = Date.now(), start = Date.parse(event.startAt), end = Date.parse(event.endAt); return now < start ? 'upcoming' : now <= end ? 'live' : 'ended';}
function node(tag, className, content) {const n = document.createElement(tag); if(className)n.className=className;if(content!==undefined)n.textContent=content;return n;}
function render() {
  const feed = state.feed || {games:[],events:[],sources:[]};
  const gameMap = Object.fromEntries(feed.games.map(g=>[g.id,g]));
  const gameSelect = el('game-filter'), previous = state.game;
  gameSelect.replaceChildren(new Option('全部游戏','all'));
  feed.games.filter(g=>feed.events.some(e=>e.gameId===g.id)).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')).forEach(g=>gameSelect.add(new Option(g.name,g.id)));
  gameSelect.value = [...gameSelect.options].some(o=>o.value===previous) ? previous : 'all';state.game=gameSelect.value;
  const events = feed.events.filter(e=>Number.isFinite(Date.parse(e.startAt))&&Number.isFinite(Date.parse(e.endAt))).filter(e=>(state.status==='all'||statusOf(e)===state.status)&&(state.game==='all'||e.gameId===state.game)&&(!state.query||(e.title+' '+(gameMap[e.gameId]?.name||'')).toLowerCase().includes(state.query)) ).sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
  el('event-count').textContent=events.length;
  const timeline=el('timeline');timeline.replaceChildren();
  if(!events.length){const box=node('div','empty');box.append(node('strong','',feed.events.length?'没有符合条件的活动':'暂无已同步活动'),node('span','',feed.events.length?'试试调整筛选条件。':'请先运行同步任务；数据源暂不可用时可稍后刷新。'));timeline.append(box);return;}
  const groups = new Map();
  for(const event of events){const key=new Date(event.startAt).toLocaleDateString('en-CA');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(event);}
  for(const list of groups.values()){
    const group=node('section','date-group'),heading=node('div','date-title');heading.append(node('strong','',dateFmt.format(new Date(list[0].startAt))));group.append(heading);
    for(const event of list){const game=gameMap[event.gameId]||{name:event.gameId}, card=node('article','event-card'),time=node('div','time'),icon=node('div','game-icon'),body=node('div','event-body'),badge=node('span','badge '+statusOf(event));
      time.append(node('strong','',timeFmt.format(new Date(event.startAt))),node('small','','开始'));
      const iconUrl=safeUrl(game.iconUrl);if(iconUrl){const img=document.createElement('img');img.src=iconUrl;img.alt='';img.onerror=()=>{img.remove();icon.textContent=game.name.slice(0,1)};icon.append(img)}else icon.textContent=game.name.slice(0,1);
      body.append(node('h3','',event.title));const detail=node('p','');detail.append(node('span','',game.name+' · '+(event.category||'活动')+' · 至 '+stampFmt.format(new Date(event.endAt))));const source=safeUrl(event.sourceUrl);if(source){detail.append(node('span','','· '));const link=node('a','',event.sourceType==='manual'?'查看公告 ↗':'来源数据 ↗');link.href=source;link.target='_blank';link.rel='noopener noreferrer';detail.append(link)}body.append(detail);
      badge.textContent={live:'进行中',upcoming:'即将开始',ended:'已结束'}[statusOf(event)];card.append(time,icon,body,badge);group.append(card);
    }timeline.append(group);
  }
}
async function refresh(){el('refresh').disabled=true;el('sync-status').textContent='正在读取活动数据…';try{const response=await fetch('data/events.json?t='+Date.now(),{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);const feed=await response.json();if(feed.schemaVersion!==1||!Array.isArray(feed.events)||!Array.isArray(feed.games)||!Array.isArray(feed.sources))throw new Error('数据格式不正确');state.feed=feed;const stale=feed.sources.filter(s=>s.status!=='ok');const stamp=feed.generatedAt?stampFmt.format(new Date(feed.generatedAt)):'尚未同步';el('updated-at').textContent='生成于 '+stamp;el('side-updated').textContent=stamp;el('source-summary').textContent=feed.sources.length?(stale.length?stale.length+' 个来源使用旧数据':'全部正常'):'尚未采集';el('sync-status').textContent=stale.length?'部分来源同步失败，已保留旧数据':'已连接共享活动数据';render()}catch(error){el('sync-status').textContent='读取失败：'+error.message;if(!state.feed)render()}finally{el('refresh').disabled=false}}
document.querySelectorAll('[data-status]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-status]').forEach(x=>x.classList.toggle('active',x===b));state.status=b.dataset.status;render()}));
el('game-filter').addEventListener('change',e=>{state.game=e.target.value;render()});
el('search').addEventListener('input',e=>{state.query=e.target.value.trim().toLowerCase();render()});
el('refresh').addEventListener('click',refresh);
function tick(){el('clock').textContent=new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())}
tick();setInterval(tick,30000);setInterval(()=>{if(state.feed)render()},60000);setInterval(refresh,300000);refresh();

function activityBucket(e){if(status(e)==="ended")return 2;return typeof progress!=="undefined"&&progress[e.id]?.done?1:0}
function gameOrderRank(id){const i=gameOrder.indexOf(id);return i<0?100000:i}
let gameOrder=[];try{const saved=JSON.parse(localStorage.getItem("timeline-game-order-v1"));if(Array.isArray(saved))gameOrder=saved.filter(x=>typeof x==="string")}catch{}
function compareTimeline(a,b){const bucket=e=>status(e)==="ended"?2:(window.activityDone?.(e.id)?1:0);const section=bucket(a)-bucket(b);if(section)return section;const ended=activityBucket(a)-activityBucket(b);if(ended)return ended;if(status(a)==="ended")return Date.parse(b.endAt)-Date.parse(a.endAt);const rank=id=>{const i=gameOrder.indexOf(id);return i<0?100000:i};return rank(a.gameId)-rank(b.gameId)||a.gameId.localeCompare(b.gameId)||({live:0,upcoming:1}[status(a)]-{live:0,upcoming:1}[status(b)])||Date.parse(a.startAt)-Date.parse(b.startAt)}
const S={feed:null,status:"all",game:"all",query:"",selected:new Set(),scroll:null};
const $=id=>document.getElementById(id),DW=64,DAY=86400000,KEY="anime-timeline-games-v1";
const CN_ONLY_KEY="timeline-cn-only-v1";
let cnOnly=false;try{cnOnly=localStorage.getItem(CN_ONLY_KEY)==="true"}catch{}
const allowedGames=()=>S.feed.games.filter(g=>!cnOnly||!window.timelineIsForeignGame(g));
function persistRegionSelection(){try{localStorage.setItem(KEY,JSON.stringify([...S.selected]))}catch{}window.dispatchEvent(new Event("timeline-preferences-changed"))}
function enforceRegionSelection(){if(!cnOnly||!S.feed)return false;const ids=new Set(allowedGames().map(g=>g.id));const before=S.selected.size;S.selected=new Set([...S.selected].filter(id=>ids.has(id)));if(before!==S.selected.size){persistRegionSelection();return true}return false}
const domesticOnly=document.getElementById("cn-only-games");domesticOnly.checked=cnOnly;
domesticOnly.onchange=()=>{const draft=new Set([...document.querySelectorAll("#game-options input:checked")].map(x=>x.value));cnOnly=domesticOnly.checked;try{localStorage.setItem(CN_ONLY_KEY,String(cnOnly))}catch{}enforceRegionSelection();picker();for(const input of document.querySelectorAll("#game-options input"))input.checked=draft.has(input.value);normalizeGameOrder();render();if(orderDialog.open)openGameOrder()};
const colors=["#ded4ae","#a9bee0","#aaa5e1","#92d1ee","#f1b36f","#df77ce"];
const fmt=new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false});
function n(tag,cls,value){const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el}
function status(e){const now=Date.now();return now<Date.parse(e.startAt)?"upcoming":now<=Date.parse(e.endAt)?"live":"ended"}
function day(d){const x=new Date(d);x.setHours(0,0,0,0);return x}
function dayIndex(d,origin){return Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(origin.getFullYear(),origin.getMonth(),origin.getDate()))/DAY)}
function position(value,origin){const d=new Date(value),begin=day(d),next=new Date(begin);next.setDate(next.getDate()+1);return(dayIndex(d,origin)+(d-begin)/(next-begin))*DW}
function url(value){if(typeof value==="string"&&value.startsWith("/assets/")&&!value.includes("..")){try{return new URL(value,window.__PREVIEW_ORIGIN__||location.origin).href}catch{return null}};try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.href:null}catch{return null}}
function remain(end,now=Date.now()){
 const ms=Date.parse(end)-now;if(!Number.isFinite(ms))return "时间待确认";if(ms<=0)return "已结束";
 const seconds=Math.ceil(ms/1000),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),secs=seconds%60;
 if(ms>=7*DAY)return `${days}天`;
 if(ms>=DAY)return `${days}天 ${hours}小时`;
 if(ms>=3600000)return `${Math.floor(seconds/3600)}小时 ${minutes}分钟`;
 return `${Math.floor(seconds/60)}分钟 ${secs}秒`;
}
function load(ids){$("choose-games").disabled=!ids.length;if(!ids.length)return true;try{const saved=JSON.parse(localStorage.getItem(KEY));if(Array.isArray(saved)){S.selected=new Set(saved.filter(id=>ids.includes(id)));enforceRegionSelection();return true}}catch{}return false}
function save(){const ids=[...document.querySelectorAll("#game-options input:checked")].map(x=>x.value);if(!ids.length){$("picker-message").textContent="请至少选择一个游戏";return}S.selected=new Set(ids);window.dispatchEvent(new Event("timeline-preferences-changed"));try{localStorage.setItem(KEY,JSON.stringify(ids))}catch{}$("game-modal").hidden=true;normalizeGameOrder();render();openGameOrder()}
function icon(g){const box=n("span","game-art"),src=url(g.iconUrl);if(src){const img=n("img");img.src=src;img.alt="";img.onload=()=>box.classList.add("has-image");img.onerror=()=>img.remove();box.append(img)}return box}
function picker(first=false){if(!S.feed?.games?.length)return;const root=$("game-options");root.replaceChildren();$("picker-message").textContent="";for(const g of allowedGames()){const label=n("label","game-choice"),input=n("input"),copy=n("span","game-choice-copy");input.type="checkbox";input.value=g.id;input.checked=S.selected.has(g.id);copy.append(n("strong","",g.name),n("small","",g.version?`${g.version} · ${g.versionName||"当前版本"}`:"活动数据"));label.append(input,icon(g),copy);root.append(label)}$("game-modal").hidden=false}
function attachDrag(scroll){
 let drag=null,suppressClickUntil=0;
 scroll.addEventListener("pointerdown",e=>{
  suppressClickUntil=0;
  if(e.pointerType!=="mouse"||e.button!==0||e.target.closest("button"))return;
  drag={x:e.clientX,left:scroll.scrollLeft,id:e.pointerId,active:false};
 });
 scroll.addEventListener("pointermove",e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const delta=e.clientX-drag.x;
  if(!drag.active&&Math.abs(delta)>6){drag.active=true;scroll.setPointerCapture(e.pointerId);scroll.classList.add("dragging")}
  if(drag.active){e.preventDefault();scroll.scrollLeft=drag.left-delta}
 });
 const stop=e=>{if(!drag)return;if(drag.active)suppressClickUntil=Date.now()+350;drag=null;scroll.classList.remove("dragging")};
 scroll.addEventListener("pointerup",stop);scroll.addEventListener("pointercancel",stop);
 scroll.addEventListener("pointerleave",()=>{if(drag&&!drag.active)drag=null});
 scroll.addEventListener("lostpointercapture",stop);
 scroll.addEventListener("dragstart",e=>e.preventDefault());
 scroll.addEventListener("click",e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopPropagation();suppressClickUntil=0}},true);
 scroll.addEventListener("wheel",e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&!e.ctrlKey){scroll.scrollLeft+=e.deltaY;e.preventDefault()}},{passive:false});
}
function updateTitles(scroll){const left=scroll.scrollLeft;for(const bar of scroll.querySelectorAll(".event-bar")){const title=bar.querySelector("strong"),x=parseFloat(bar.style.left),width=parseFloat(bar.style.width),max=Math.max(0,width-title.offsetWidth-24);title.style.transform=`translateX(${Math.max(0,Math.min(left-x+20,max))}px)`}}
// Shared positioning state: sessionStorage retains a manually chosen date on reload.
let timelineManualDate=null;
try{const saved=Number(sessionStorage.getItem('timeline-view-date-v78'));if(saved>0&&Number.isFinite(saved))timelineManualDate=saved}catch{}
function timelineDateAt(left,origin){const days=left/DW,whole=Math.floor(days),a=new Date(origin),b=new Date(origin);a.setDate(a.getDate()+whole);b.setDate(b.getDate()+whole+1);return +a+(+b-+a)*(days-whole)}
function bindTimelinePosition(scroll,start){
 let interacting=false,down=null,last=scroll.scrollLeft;
 const mark=()=>{interacting=true};
 scroll.addEventListener('wheel',mark,{passive:true});
 scroll.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key))mark()});
 scroll.addEventListener('pointerdown',e=>{down=e.clientX;interacting=false});
 scroll.addEventListener('pointermove',e=>{if(down!==null&&Math.abs(e.clientX-down)>6)mark()},{passive:true});
 scroll.addEventListener('pointerup',()=>{down=null});
 scroll.addEventListener('pointercancel',()=>{down=null});
 scroll.addEventListener('touchstart',e=>{down=e.touches[0]?.clientX;interacting=false},{passive:true});
 scroll.addEventListener('touchmove',e=>{if(down!=null&&Math.abs(e.touches[0].clientX-down)>6)mark()},{passive:true});
 scroll.addEventListener('scroll',()=>{if(interacting&&Math.abs(scroll.scrollLeft-last)>.5){timelineManualDate=timelineDateAt(scroll.scrollLeft,start);try{sessionStorage.setItem('timeline-view-date-v78',String(timelineManualDate))}catch{}}last=scroll.scrollLeft;updateTitles(scroll)},{passive:true});
 scroll.tabIndex=0;scroll.setAttribute('aria-label','横向活动时间线，可用左右方向键移动日期');
 let placed=false;
 function place(){if(S.scroll!==scroll||!scroll.isConnected||!scroll.clientWidth||interacting)return;scroll.scrollLeft=timelineManualDate===null?Math.max(0,position(new Date(),start)-scroll.clientWidth*.3):Math.max(0,position(timelineManualDate,start));last=scroll.scrollLeft;placed=true;updateTitles(scroll)}
 requestAnimationFrame(()=>{place();requestAnimationFrame(place)});
 for(const ms of [100,400])setTimeout(place,ms);
 if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(()=>{if(!placed)place()});observer.observe(scroll);setTimeout(()=>observer.disconnect(),2000)}
}

function render(){const f=S.feed||{games:[],events:[],sources:[]},gm=Object.fromEntries(f.games.map(g=>[g.id,g])),select=$("game-filter"),old=S.game;select.replaceChildren(new Option("我的全部游戏","all"));f.games.filter(g=>S.selected.has(g.id)&&f.events.some(e=>e.gameId===g.id)).forEach(g=>select.add(new Option(g.name,g.id)));select.value=[...select.options].some(o=>o.value===old)?old:"all";S.game=select.value;const events=f.events.filter(e=>S.selected.has(e.gameId)&&Number.isFinite(Date.parse(e.startAt))&&Number.isFinite(Date.parse(e.endAt))).filter(e=>(S.status==="all"||status(e)===S.status)&&(S.game==="all"||e.gameId===S.game)&&(!S.query||(e.title+" "+(gm[e.gameId]?.name||"")).toLowerCase().includes(S.query))).sort(compareTimeline);$("event-count").textContent=events.length;const root=$("timeline"),oldScroll=S.scroll,oldLeft=oldScroll?.scrollLeft,hadBoard=!!oldScroll?.querySelector(".timeline-board");root.replaceChildren();if(!events.length){const empty=n("div","empty");empty.append(n("strong","",f.events.length?"所选游戏暂无符合条件的活动":"暂无已同步活动"),n("span","",f.events.length?"重新选择游戏或调整筛选条件。":"同步完成后活动会显示在这里。"));root.append(empty);S.scroll=null;return}const now=new Date(),start=day(new Date(Math.min(Date.now(),...events.map(e=>Date.parse(e.startAt)))));start.setDate(start.getDate()-2);const end=day(new Date(Math.max(Date.now(),...events.map(e=>Date.parse(e.endAt)))));end.setDate(end.getDate()+4);const days=Math.max(16,dayIndex(end,start)),scroll=n("div","timeline-scroll"),board=n("div","timeline-board"),head=n("div","date-head"),grid=n("div","grid"),lanes=n("div","lanes");board.style.width=days*DW+"px";for(let i=0;i<days;i++){const date=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i),cell=n("div","date-cell"+(date.toDateString()===now.toDateString()?" today":""));if(i===0||date.getDate()===1)cell.append(n("b","month-name",new Intl.DateTimeFormat("zh-CN",{month:"long"}).format(date)));cell.append(n("small","",new Intl.DateTimeFormat("zh-CN",{weekday:"short"}).format(date)),n("strong","",date.getDate()));head.append(cell);const line=n("i","grid-line");line.style.left=i*DW+"px";grid.append(line)}const marker=n("div","now-marker");marker.style.left=position(now,start)+"px";marker.append(n("span","","现在"));grid.append(marker);let previousGame=null,endedHeading=false,doneHeading=false,pendingGuide=null;for(const event of events){if(status(event)==="ended"){if(!endedHeading){lanes.append(n("div","ended-heading","已结束活动"));endedHeading=true}}else if(window.activityDone?.(event.id)){if(!doneHeading){lanes.append(n("div","ended-heading","已完成活动"));doneHeading=true}}else if(activityBucket(event)===1){if(!doneHeading){lanes.append(n("div","ended-heading","已完成活动"));doneHeading=true}}else if(previousGame!==event.gameId){const guide=n("button","game-guide",(gm[event.gameId]?.name||event.gameId)+" ↓");guide.type="button";guide.title="定位到此游戏的第一项活动";pendingGuide=guide;lanes.append(guide);previousGame=event.gameId}const lane=n("div","lane"),bar=n("a","event-bar "+status(event));lane.dataset.gameAnchor=event.gameId;if(pendingGuide){const target=lane;pendingGuide.onclick=()=>{const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:"start",inline:"nearest",behavior:reduced?"instant":"smooth"})};pendingGuide=null;}const x=position(event.startAt,start),last=position(event.endAt,start),width=Math.max(2,last-x);bar.style.left=x+"px";bar.style.width=width+"px";bar.style.setProperty("--c",colors[[...event.gameId].reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%colors.length]);const banner=url(event.imageUrl);if(banner)bar.style.setProperty("--banner",`url("${banner.replaceAll(String.fromCharCode(34),"")}")`);bar.href="#activity";bar.onclick=e=>{e.preventDefault();window.openActivity?.(event)};bar.title=`${event.title} · ${fmt.format(new Date(event.startAt))} 至 ${fmt.format(new Date(event.endAt))}`;bar.append(n("strong","",event.title+" · "+(gm[event.gameId]?.name||event.gameId)));lane.append(bar);if(status(event)==="live"){const badge=n("span","remaining-badge",remain(event.endAt));badge.dataset.countdownEnd=event.endAt;badge.style.left=last+8+"px";lane.append(badge)}lanes.append(lane)}board.append(head,grid,lanes);scroll.append(board);root.append(scroll);S.scroll=scroll;attachDrag(scroll);bindTimelinePosition(scroll,start);}
let feedRefreshing=false,feedAppliedAt=0;
function validHotFeed(feed){
 if(!feed||!Array.isArray(feed.games)||!Array.isArray(feed.events)||!Array.isArray(feed.sources)||!Number.isFinite(Date.parse(feed.generatedAt)))throw Error('活动数据格式无效');
 if(feed.games.some(g=>!g||typeof g.id!=='string'||typeof g.name!=='string')||new Set(feed.games.map(g=>g.id)).size!==feed.games.length)throw Error('游戏数据无效');
 if(feed.events.some(e=>!e||typeof e.id!=='string'||!e.id||typeof e.gameId!=='string'||typeof e.title!=='string'||!Number.isFinite(Date.parse(e.startAt))||!Number.isFinite(Date.parse(e.endAt))||Date.parse(e.endAt)<=Date.parse(e.startAt))||new Set(feed.events.map(e=>e.id)).size!==feed.events.length)throw Error('活动数据无效');
 return feed;
}
function hotFeedKey(feed){return JSON.stringify([feed.games,feed.events,feed.honkaiNews||null])}
function homeHotBusy(){return !!document.querySelector('dialog[open],#game-modal:not([hidden]),.timeline-scroll.dragging')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)}
async function refresh(options={}){
 const background=options.background===true;if(feedRefreshing||(background&&(document.hidden||homeHotBusy())))return;
 feedRefreshing=true;$('refresh').disabled=true;
 try{
  const response=await fetch('/data/events.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('HTTP '+response.status);
  const incoming=validHotFeed(await response.json());
  if(S.feed&&Date.parse(incoming.generatedAt)<Date.parse(S.feed.generatedAt))return;
  if(background&&homeHotBusy())return;
  const first=!S.feed,changed=first||hotFeedKey(incoming)!==hotFeedKey(S.feed);
  // Replace the authoritative snapshot, never union deleted activities back into it.
  S.feed=incoming;
  if(first){const ids=incoming.games.map(g=>g.id),saved=load(ids);if(ids.length&&!saved){S.selected=new Set();picker()}}
  const stale=incoming.sources.filter(x=>x.status!=='ok'),time=fmt.format(new Date(incoming.generatedAt));
  $('updated-at').textContent='生成于 '+time;$('side-updated').textContent=time;
  $('source-summary').textContent=stale.length?`${stale.length} 个来源使用旧数据`:'全部正常';
  $('sync-status').textContent=stale.length?'部分来源使用旧数据':'已连接共享活动数据';
  if(changed){const x=window.scrollX,y=window.scrollY;render();requestAnimationFrame(()=>window.scrollTo(x,y));window.dispatchEvent(new CustomEvent('timeline-feed-updated',{detail:{generatedAt:incoming.generatedAt}}))}
  feedAppliedAt=Date.now();
 }catch(error){$('sync-status').textContent=(S.feed?'自动更新暂不可用，保留上次数据：':'读取失败：')+error.message}
 finally{feedRefreshing=false;$('refresh').disabled=false}
}

document.querySelectorAll("[data-status]").forEach(button=>button.onclick=()=>{document.querySelectorAll("[data-status]").forEach(x=>x.classList.toggle("active",x===button));S.status=button.dataset.status;S.scroll=null;render()});$("game-filter").onchange=e=>{S.game=e.target.value;S.scroll=null;render()};$("search").oninput=e=>{S.query=e.target.value.trim().toLowerCase();render()};$("refresh").onclick=refresh;$("choose-games").onclick=()=>picker();$("save-games").onclick=save;$("select-all").onclick=()=>document.querySelectorAll("#game-options input").forEach(x=>x.checked=true);refresh();setInterval(()=>refresh({background:true}),60000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh({background:true})});window.addEventListener("online",()=>refresh({background:true}));setInterval(()=>{if(Date.now()-feedAppliedAt>60000)refresh({background:true})},10000);setInterval(()=>S.feed&&render(),60000);
document.getElementById("admin-entry").addEventListener("dblclick",()=>location.assign("/admin/"));

const orderButton=n("button","","游戏排序");orderButton.type="button";document.querySelector(".top-actions").append(orderButton);
const orderDialog=document.createElement("dialog");orderDialog.className="theme-dialog order-dialog";document.body.append(orderDialog);let orderDraft=[];
function drawOrder(){orderDialog.replaceChildren();orderDialog.append(n("h2","","游戏分组排序"),n("p","","仅显示已选择的游戏，可上下调整顺序。未选游戏自动隐藏，重新选择后会显示回来。"));const list=n("div","order-list");orderDialog.append(list);if(!orderDraft.length)list.append(n("p","","暂无已选游戏，请先在“选择游戏”中勾选。"));for(const [i,id] of orderDraft.entries()){const row=n("div","order-row"),name=n("span","",S.feed.games.find(g=>g.id===id)?.name||id);if(!S.selected.has(id)){row.classList.add("unselected");name.textContent+="（未选择）"}row.append(name);for(const [label,delta] of [["上移",-1],["下移",1]]){const b=n("button","",label);b.type="button";b.disabled=i+delta<0||i+delta>=orderDraft.length||S.selected.has(id)!==S.selected.has(orderDraft[i+delta]);b.setAttribute("aria-label",name.textContent+label);b.onclick=()=>{[orderDraft[i],orderDraft[i+delta]]=[orderDraft[i+delta],orderDraft[i]];drawOrder()};row.append(b)}list.append(row)}const save=n("button","","保存排序"),cancel=n("button","","取消");save.onclick=()=>{gameOrder=[...orderDraft,...gameOrder.filter(id=>!orderDraft.includes(id))];try{localStorage.setItem("timeline-game-order-v1",JSON.stringify(gameOrder))}catch{alert("浏览器禁止保存，排序仅在本次访问有效")}render();orderDialog.close()};cancel.onclick=()=>orderDialog.close();const actions=n("div","order-actions");actions.append(save,cancel);orderDialog.append(actions)}
function normalizedGameIds(ids,selected,previous){const unique=[...new Set(ids)],base=[...previous.filter(id=>unique.includes(id)),...unique.filter(id=>!previous.includes(id))];return [...base.filter(id=>selected.has(id)),...base.filter(id=>!selected.has(id))]}
function normalizeGameOrder(){gameOrder=normalizedGameIds(S.feed.games.map(g=>g.id),S.selected,gameOrder);try{localStorage.setItem("timeline-game-order-v1",JSON.stringify(gameOrder))}catch{}}
function openGameOrder(){if(!S.feed)return;orderDraft=normalizedGameIds(allowedGames().filter(g=>S.selected.has(g.id)).map(g=>g.id),S.selected,gameOrder);drawOrder();if(!orderDialog.open)orderDialog.showModal()}
orderButton.onclick=openGameOrder;

// Update text only; do not rebuild cards or move the timeline every second.
setInterval(()=>{if(document.hidden)return;document.querySelectorAll('[data-countdown-end]').forEach(el=>{el.textContent=(el.dataset.countdownPrefix||'')+remain(el.dataset.countdownEnd)})},1000);



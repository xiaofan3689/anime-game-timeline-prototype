function activityBucket(e){if(status(e)==="ended")return 2;return window.activityDone?.(e.id,e)?1:0}
function gameOrderRank(id){const i=gameOrder.indexOf(id);return i<0?100000:i}
let gameOrder=[];try{const saved=JSON.parse(localStorage.getItem("timeline-game-order-v1"));if(Array.isArray(saved))gameOrder=saved.filter(x=>typeof x==="string")}catch{}
function compareTimeline(a,b){const bucket=e=>status(e)==="ended"?2:(window.activityDone?.(e.id,e)?1:0);const section=bucket(a)-bucket(b);if(section)return section;const ended=activityBucket(a)-activityBucket(b);if(ended)return ended;if(status(a)==="ended")return Date.parse(b.endAt)-Date.parse(a.endAt);const rank=id=>{const i=gameOrder.indexOf(id);return i<0?100000:i};return rank(a.gameId)-rank(b.gameId)||a.gameId.localeCompare(b.gameId)||({live:0,upcoming:1}[status(a)]-{live:0,upcoming:1}[status(b)])||Date.parse(a.startAt)-Date.parse(b.startAt)}
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
const timelineRoot = $("timeline");
const timelineTools = n("div", "timeline-date-tools");
const todayButton = n("button", "", "回到今天");
const dateForm = n("form");
const dateLabel = n("label", "", "跳转日期");
const dateInput = n("input");
dateInput.type = "date";
dateInput.required = true;
dateInput.setAttribute("aria-label", "跳转日期");
todayButton.type = "button";
const dateSubmit = n("button", "", "跳转");
dateSubmit.type = "submit";
const dateFeedback = n("span", "timeline-date-feedback");
dateFeedback.setAttribute("role", "status");
dateLabel.append(dateInput);
dateForm.append(dateLabel, dateSubmit);
timelineTools.append(todayButton, dateForm, dateFeedback);
timelineTools.hidden = true;
const feedNotice = n("div", "timeline-feed-notice");
feedNotice.hidden = true;
timelineRoot.before(feedNotice, timelineTools);
const feedNoticeText = n("p");
feedNoticeText.setAttribute("role", "status");
const feedRetry = n("button", "", "重试");
feedRetry.type = "button";
feedRetry.onclick = () => refresh();
feedNotice.append(feedNoticeText, feedRetry);
function localDateValue(date) {
 return [date.getFullYear(), date.getMonth()+1, date.getDate()].map((part,i)=>String(part).padStart(i===0?4:2,"0")).join("-");
}
function showFeedNotice(message, retry = false) {
 feedNoticeText.textContent = message;
 feedNotice.hidden = !message;
 feedRetry.hidden = !retry;
}
function setStatusFilter(status) {
 S.status = status;
 for (const button of document.querySelectorAll("[data-status]")) {
  const active = button.dataset.status === status;
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
 }
}
function showTimelineEmpty(root, feed) {
 const empty = n("div","empty");
 if (!S.feed) {
  empty.append(n("strong","","活动数据尚未加载"));
 } else if (S.query || S.game !== "all" || S.status !== "all") {
  empty.append(n("strong","","没有符合筛选条件的活动"));
  const clear = n("button","","清除筛选");
  clear.type = "button";
  clear.onclick = () => {
   S.query = $("search").value = "";
   S.game = "all";
   setStatusFilter("all");
   render();
   $("search").focus({preventScroll:true});
  };
  empty.append(clear);
 } else if (!feed.events.length) {
  empty.append(n("strong","","暂无已同步活动"));
  const retry = n("button","","重试");
  retry.type = "button";
  retry.onclick = () => { retry.disabled=true; refresh().finally(()=>{retry.disabled=false}); };
  empty.append(retry);
 } else {
  empty.append(n("strong","",S.selected.size?"已选游戏暂无活动":"请先选择游戏"));
  const choose = n("button","","选择游戏");
  choose.type = "button";
  choose.onclick = () => picker();
  empty.append(choose);
 }
 root.append(empty);
}
function bindTimelinePosition(scroll,start,days){
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
 const lastDate = new Date(start);
 lastDate.setDate(lastDate.getDate()+days-1);
 dateInput.min = localDateValue(start);
 dateInput.max = localDateValue(lastDate);
 if (!dateInput.value || dateInput.value < dateInput.min || dateInput.value > dateInput.max) {
  dateInput.value = localDateValue(new Date());
 }
 function jump(date, today) {
  interacting = true;
  timelineManualDate = today ? null : +date;
  try {
   if (today) sessionStorage.removeItem("timeline-view-date-v78");
   else sessionStorage.setItem("timeline-view-date-v78",String(timelineManualDate));
  } catch {}
  scroll.scrollLeft = Math.max(0, position(date,start) - (today ? scroll.clientWidth*.3 : 0));
  last = scroll.scrollLeft;
  updateTitles(scroll);
  dateInput.value = localDateValue(date);
  dateFeedback.textContent = today ? "已回到今天" : "已跳转到 " + dateInput.value;
 }
 todayButton.onclick = () => jump(new Date(),true);
 dateForm.onsubmit = event => {
  event.preventDefault();
  if (!dateInput.reportValidity()) return;
  const [year,month,date] = dateInput.value.split("-").map(Number);
  const target = new Date(0);
  target.setFullYear(year, month-1, date);
  target.setHours(0,0,0,0);
  jump(target,false);
 };
 requestAnimationFrame(()=>{place();requestAnimationFrame(place)});
 for(const ms of [100,400])setTimeout(place,ms);
 if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(()=>{if(!placed)place()});observer.observe(scroll);setTimeout(()=>observer.disconnect(),2000)}
}

let endedArchiveOpen=false;
function createEndedArchive(count){
 const section=n("section","ended-archive");
 const button=n("button","ended-heading ended-archive-toggle");
 const rows=n("div","ended-archive-rows");
 rows.id="ended-archive-rows";
 button.type="button";
 button.setAttribute("aria-controls",rows.id);
 const update=()=>{
  rows.hidden=!endedArchiveOpen;
  button.setAttribute("aria-expanded",String(endedArchiveOpen));
  button.textContent=`${endedArchiveOpen?"收起":"展开"}已结束活动（${count}）`;
 };
 button.onclick=()=>{
  endedArchiveOpen=!endedArchiveOpen;
  update();
  updateTitles(section.closest(".timeline-scroll"));
 };
 update();
 section.append(button,rows);
 return {section,rows};
}
function render(){const f=S.feed||{games:[],events:[],sources:[]},gm=Object.fromEntries(f.games.map(g=>[g.id,g])),select=$("game-filter"),old=S.game;select.replaceChildren(new Option("我的全部游戏","all"));f.games.filter(g=>S.selected.has(g.id)&&f.events.some(e=>e.gameId===g.id)).forEach(g=>select.add(new Option(g.name,g.id)));select.value=[...select.options].some(o=>o.value===old)?old:"all";S.game=select.value;const events=f.events.filter(e=>S.selected.has(e.gameId)&&Number.isFinite(Date.parse(e.startAt))&&Number.isFinite(Date.parse(e.endAt))).filter(e=>(S.status==="all"||status(e)===S.status)&&(S.game==="all"||e.gameId===S.game)&&(!S.query||(e.title+" "+(gm[e.gameId]?.name||"")).toLowerCase().includes(S.query))).sort(compareTimeline);$("event-count").textContent=events.length;const root=$("timeline"),oldScroll=S.scroll,oldLeft=oldScroll?.scrollLeft,hadBoard=!!oldScroll?.querySelector(".timeline-board");root.replaceChildren();timelineTools.hidden=!events.length;if(!events.length){showTimelineEmpty(root,f);S.scroll=null;return}const now=new Date(),start=day(new Date(Math.min(Date.now(),...events.map(e=>Date.parse(e.startAt)))));start.setDate(start.getDate()-2);const end=day(new Date(Math.max(Date.now(),...events.map(e=>Date.parse(e.endAt)))));end.setDate(end.getDate()+4);const days=Math.max(16,dayIndex(end,start)),scroll=n("div","timeline-scroll"),board=n("div","timeline-board"),head=n("div","date-head"),grid=n("div","grid"),lanes=n("div","lanes");board.style.width=days*DW+"px";for(let i=0;i<days;i++){const date=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i),cell=n("div","date-cell"+(date.toDateString()===now.toDateString()?" today":""));if(i===0||date.getDate()===1)cell.append(n("b","month-name",new Intl.DateTimeFormat("zh-CN",{month:"long"}).format(date)));cell.append(n("small","",new Intl.DateTimeFormat("zh-CN",{weekday:"short"}).format(date)),n("strong","",date.getDate()));head.append(cell);const line=n("i","grid-line");line.style.left=i*DW+"px";grid.append(line)}const marker=n("div","now-marker");marker.style.left=position(now,start)+"px";marker.append(n("span","","现在"));grid.append(marker);let previousGame=null,endedArchive=null,doneHeading=false,pendingGuide=null;for(const event of events){if(status(event)==="ended"){if(!endedArchive){endedArchive=createEndedArchive(events.filter(e=>status(e)==="ended").length);lanes.append(endedArchive.section)}}else if(window.activityDone?.(event.id,event)){if(!doneHeading){lanes.append(n("div","ended-heading","已完成活动"));doneHeading=true}}else if(activityBucket(event)===1){if(!doneHeading){lanes.append(n("div","ended-heading","已完成活动"));doneHeading=true}}else if(previousGame!==event.gameId){const guide=n("button","game-guide",(gm[event.gameId]?.name||event.gameId)+" ↓");guide.type="button";guide.title="定位到此游戏的第一项活动";pendingGuide=guide;lanes.append(guide);previousGame=event.gameId}const lane=n("div","lane"),bar=n("a","event-bar "+status(event));lane.dataset.gameAnchor=event.gameId;if(pendingGuide){const target=lane;pendingGuide.onclick=()=>{const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:"start",inline:"nearest",behavior:reduced?"instant":"smooth"})};pendingGuide=null;}const x=position(event.startAt,start),last=position(event.endAt,start),width=Math.max(2,last-x);bar.style.left=x+"px";bar.style.width=width+"px";bar.style.setProperty("--c",colors[[...event.gameId].reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%colors.length]);const banner=url(event.imageUrl);if(banner)bar.style.setProperty("--banner",`url("${banner.replaceAll(String.fromCharCode(34),"")}")`);bar.href="#activity";bar.onclick=e=>{e.preventDefault();window.openActivity?.(event)};bar.title=`${event.title} · ${fmt.format(new Date(event.startAt))} 至 ${fmt.format(new Date(event.endAt))}`;bar.append(n("strong","",event.title+" · "+(gm[event.gameId]?.name||event.gameId)));lane.append(bar);if(status(event)==="live"){const badge=n("span","remaining-badge",remain(event.endAt));badge.dataset.countdownEnd=event.endAt;badge.style.left=last+8+"px";lane.append(badge)}(status(event)==="ended"?endedArchive.rows:lanes).append(lane)}board.append(head,grid,lanes);scroll.append(board);root.append(scroll);S.scroll=scroll;attachDrag(scroll);bindTimelinePosition(scroll,start,days);}
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
 feedRefreshing=true;$('refresh').disabled=true;feedRetry.disabled=true;
 if(!S.feed)showFeedNotice('正在加载活动数据…');
 try{
  const response=await fetch('/data/events.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('HTTP '+response.status);
  const incoming=validHotFeed(await response.json());
  incoming.events=incoming.events.filter(event=>!event.hidden&&!event.disabled);
  if(S.feed&&Date.parse(incoming.generatedAt)<Date.parse(S.feed.generatedAt))return;
  if(background&&homeHotBusy())return;
  const first=!S.feed,changed=first||hotFeedKey(incoming)!==hotFeedKey(S.feed);
  // Replace the authoritative snapshot, never union deleted activities back into it.
  S.feed=incoming;
  if(first){const ids=incoming.games.map(g=>g.id),saved=load(ids);if(ids.length&&!saved){S.selected=new Set();picker()}}
  const stale=incoming.sources.filter(x=>x.status!=='ok'),time=fmt.format(new Date(incoming.generatedAt));
  $('updated-at').textContent='生成于 '+time;$('side-updated').textContent=time;
  $('source-summary').textContent=stale.length?`${stale.length} 个来源使用旧数据`:'全部正常';
  showFeedNotice(stale.length ? `已连接共享活动数据，最近生成于 ${time}。` : "");
  $('sync-status').textContent=stale.length?'已连接共享活动数据，下方入口点击即可跳转，跳转后点击右下角顶部即可返回该页面':'已连接共享活动数据，下方入口点击即可跳转，跳转后点击右下角顶部即可返回该页面';
  if(changed){const x=window.scrollX,y=window.scrollY;render();requestAnimationFrame(()=>window.scrollTo(x,y));window.dispatchEvent(new CustomEvent('timeline-feed-updated',{detail:{generatedAt:incoming.generatedAt}}))}
  feedAppliedAt=Date.now();
 }catch(error){
  $('sync-status').textContent=S.feed?'更新暂不可用，已保留上次数据':'活动数据读取失败';
  showFeedNotice(S.feed ? '更新失败。当前显示的数据生成于 '+fmt.format(new Date(S.feed.generatedAt))+'。' : '读取活动失败，请检查网络后重试。',true);
  if(!S.feed)render();
 }
 finally{feedRefreshing=false;$('refresh').disabled=false;feedRetry.disabled=false}
}

setStatusFilter(S.status);
document.querySelectorAll("[data-status]").forEach(button=>button.onclick=()=>{setStatusFilter(button.dataset.status);S.scroll=null;render()});$("game-filter").onchange=e=>{S.game=e.target.value;S.scroll=null;render()};$("search").oninput=e=>{S.query=e.target.value.trim().toLowerCase();render()};$("refresh").onclick=refresh;$("choose-games").onclick=()=>picker();$("save-games").onclick=save;$("select-all").onclick=()=>document.querySelectorAll("#game-options input").forEach(x=>x.checked=true);refresh();setInterval(()=>refresh({background:true}),60000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh({background:true})});window.addEventListener("online",()=>refresh({background:true}));setInterval(()=>{if(Date.now()-feedAppliedAt>60000)refresh({background:true})},10000);setInterval(()=>S.feed&&render(),60000);
document.getElementById("admin-entry").addEventListener("dblclick",()=>location.assign(window.timelineSite?.opsPath("/admin/") || "/admin/"));

const orderButton=n("button","","游戏排序");orderButton.type="button";document.querySelector(".top-actions").append(orderButton);
const orderDialog=document.createElement("dialog");orderDialog.className="theme-dialog order-dialog";document.body.append(orderDialog);let orderDraft=[];
function drawOrder(){orderDialog.replaceChildren();orderDialog.append(n("h2","","游戏分组排序"),n("p","","仅显示已选择的游戏，可上下调整顺序。未选游戏自动隐藏，重新选择后会显示回来。"));const list=n("div","order-list");orderDialog.append(list);if(!orderDraft.length)list.append(n("p","","暂无已选游戏，请先在“选择游戏”中勾选。"));for(const [i,id] of orderDraft.entries()){const row=n("div","order-row"),name=n("span","",S.feed.games.find(g=>g.id===id)?.name||id);if(!S.selected.has(id)){row.classList.add("unselected");name.textContent+="（未选择）"}row.append(name);for(const [label,delta] of [["上移",-1],["下移",1]]){const b=n("button","",label);b.type="button";b.disabled=i+delta<0||i+delta>=orderDraft.length||S.selected.has(id)!==S.selected.has(orderDraft[i+delta]);b.setAttribute("aria-label",name.textContent+label);b.onclick=()=>{[orderDraft[i],orderDraft[i+delta]]=[orderDraft[i+delta],orderDraft[i]];drawOrder()};row.append(b)}list.append(row)}const save=n("button","","保存排序"),cancel=n("button","","取消");save.onclick=()=>{gameOrder=[...orderDraft,...gameOrder.filter(id=>!orderDraft.includes(id))];try{localStorage.setItem("timeline-game-order-v1",JSON.stringify(gameOrder))}catch{alert("浏览器禁止保存，排序仅在本次访问有效")}render();orderDialog.close()};cancel.onclick=()=>orderDialog.close();const actions=n("div","order-actions");actions.append(save,cancel);orderDialog.append(actions)}
function normalizedGameIds(ids,selected,previous){const unique=[...new Set(ids)],base=[...previous.filter(id=>unique.includes(id)),...unique.filter(id=>!previous.includes(id))];return [...base.filter(id=>selected.has(id)),...base.filter(id=>!selected.has(id))]}
function normalizeGameOrder(){gameOrder=normalizedGameIds(S.feed.games.map(g=>g.id),S.selected,gameOrder);try{localStorage.setItem("timeline-game-order-v1",JSON.stringify(gameOrder))}catch{}}
function openGameOrder(){if(!S.feed)return;orderDraft=normalizedGameIds(allowedGames().filter(g=>S.selected.has(g.id)).map(g=>g.id),S.selected,gameOrder);drawOrder();if(!orderDialog.open)orderDialog.showModal()}
orderButton.onclick=openGameOrder;

// Update text only; do not rebuild cards or move the timeline every second.
setInterval(()=>{if(document.hidden)return;document.querySelectorAll('[data-countdown-end]').forEach(el=>{el.textContent=(el.dataset.countdownPrefix||'')+remain(el.dataset.countdownEnd)})},1000);



// Game catalog acknowledgement is independent from the user's selected games.
(()=>{
 const seenKey='timeline-known-games-v115';let dialog=null,shown=[],readyAt=0,newVisitor=false;
 const releaseBaseline=["ys","nte","sr","zzz","ww","ak","end","ba-cn","ba-jp","ba-global","xtlr","infinitynikki","gf2","pgr","czn","bd2","nikke","hyrz","fgo","snowbreak","ap","sliver"];
 const read=()=>{try{const v=JSON.parse(localStorage.getItem(seenKey));return Array.isArray(v)?v:null}catch{return null}};
 const write=ids=>localStorage.setItem(seenKey,JSON.stringify([...new Set(ids)]));
 function check(){
  if(!S.feed||window.__PREVIEW_ORIGIN__)return;
  if(!readyAt){readyAt=Date.now()+1000;newVisitor=!$('game-modal').hidden;setTimeout(check,1000);return}
  if(Date.now()<readyAt)return;
  if(!$('game-modal').hidden)newVisitor=true;
  const ids=S.feed.games.map(g=>g.id);let prior=read();
  let existing=false;try{existing=Array.isArray(JSON.parse(localStorage.getItem(KEY)))}catch{}
  // The server release baseline preserves additions for returning browsers that were offline.
  if(newVisitor){try{write(ids)}catch{}return}
  if(!prior)prior=releaseBaseline;
  if(dialog?.open)return;
  const additions=S.feed.games.filter(g=>!prior.includes(g.id));if(!additions.length)return;
  if(!$('game-modal').hidden||document.querySelector('dialog[open]'))return;
  shown=additions.map(g=>g.id);dialog=document.createElement('dialog');dialog.className='game-picker game-update-dialog';
  dialog.append(n('h2','','游戏更新提醒'),n('p','','本网站新增以下游戏，如有需求可进行勾选，若无需求请点击关闭按钮'));
  const list=n('div','game-options');
  for(const g of additions){const label=n('label','game-choice'),input=n('input'),copy=n('span','game-choice-copy');input.type='checkbox';input.value=g.id;input.disabled=cnOnly&&window.timelineIsForeignGame(g);copy.append(n('strong','',g.name),n('small','',g.version?[g.version,g.versionName].filter(Boolean).join(' · '):'版本信息待更新'));label.append(input,icon(g),copy);list.append(label)}
  const message=n('p','picker-message'),actions=n('div','picker-actions'),saveButton=n('button','primary','保存并排序'),close=n('button','','关闭');saveButton.type=close.type='button';
  function finish(save){const picked=[...list.querySelectorAll('input:checked:not(:disabled)')].map(i=>i.value);if(save&&!picked.length){message.textContent='请勾选游戏，或点击关闭表示不选择。';return}
   const previous=new Set(S.selected);if(save)for(const id of picked)S.selected.add(id);
   try{if(save)localStorage.setItem(KEY,JSON.stringify([...S.selected]));write([...(read()||[]),...shown])}catch{S.selected=previous;message.textContent='浏览器无法保存，请允许本站存储后重试。';return}
   dialog.close();dialog.remove();dialog=null;if(save){enforceRegionSelection();normalizeGameOrder();render();window.dispatchEvent(new Event('timeline-preferences-changed'));openGameOrder()}
  }
  saveButton.onclick=()=>finish(true);close.onclick=()=>finish(false);dialog.addEventListener('cancel',e=>e.preventDefault());actions.append(saveButton,close);dialog.append(list,message,actions);document.body.append(dialog);dialog.showModal();
 }
 window.addEventListener('timeline-feed-updated',check);setInterval(check,2000);check();
})();

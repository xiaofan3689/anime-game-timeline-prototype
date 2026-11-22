
function checkinButton(e){const dates=(()=>{try{return JSON.parse(localStorage.getItem('daily-checkin:'+e.id))||[]}catch{return []}})(),today=new Date(Date.now()+8*3600000).toISOString().slice(0,10),target=Number(e.checkinTarget)||1,b=n('button','','标记签到 '+dates.length+'/'+target);b.disabled=dates.includes(today)||Date.now()<Date.parse(e.startAt)||Date.now()>=Date.parse(e.endAt);b.onclick=()=>{const next=[...new Set([...dates,today])];try{localStorage.setItem('daily-checkin:'+e.id,JSON.stringify(next))}catch{alert('签到保存失败');return}window.dispatchEvent(new Event('timeline-preferences-changed'));if(next.length>=target)smartUpdate(e.id,'done',true);else{smartRender();milestoneRender();window.updateActivityDialog?.()}};return b}
function activityHome(e){const href=url(e.activityUrl);if(!href)return null;const a=n('a','official-game-link','前往活动主页');a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a}
/* Local activity assistant: no account or external AI service required. */
const SMART_KEY="timeline-progress-v1";
let progress={};
try{progress=JSON.parse(localStorage.getItem(SMART_KEY))||{}}catch{}
window.activityDone=id=>!!progress[id]?.done;
const completionNotice = n("div", "completion-notice");
completionNotice.hidden = true;
document.body.append(completionNotice);
let completedAction = null;
let sortingHelpOpen = false;

function showCompletionNotice(root, activity) {
 const announcement = n("span","","已完成：" + activity.title);
 announcement.setAttribute("role","status");
 const undo = n("button","","撤销");
 const dismiss = n("button","","关闭提示");
 undo.type = dismiss.type = "button";
 undo.onclick = () => {
  completedAction = null;
  completionNotice.hidden = true;
  smartUpdate(activity.id,"done",false);
  const detail = activityDialog.open ? activityDialog.querySelector(".activity-actions button") :
   [...document.querySelectorAll(".smart-row")].find(row=>row.dataset.activityId===activity.id)?.querySelector("button");
  (detail || document.querySelector("#smart-panel .smart-reset"))?.focus({preventScroll:true});
 };
 dismiss.onclick = () => {
  completedAction = null;
  if (root === completionNotice) {
   root.hidden = true;
   (document.querySelector("#smart-panel .smart-row button") ||
    document.querySelector("#smart-panel .smart-reset"))?.focus({preventScroll:true});
  } else {
   root.remove();
   activityDialog.querySelector(".activity-actions button")?.focus({preventScroll:true});
  }
 };
 root.replaceChildren(announcement,undo,dismiss);
 root.hidden = false;
 return undo;
}
function smartRender(){
 const root=document.getElementById("smart-panel");if(!root||!S.feed)return;const previousTop=root.querySelector(".smart-pages")?.scrollTop||0;
 root.replaceChildren();
 const title=n("h2","","今天先做什么"),hint=n("p","smart-hint","优先展示一周内结束的活动，越临近结束越靠前；其余按游戏排序。" );root.append(title);
 const games=Object.fromEntries(S.feed.games.map(g=>[g.id,g.name]));
 const events=S.feed.events.filter(e=>S.selected.has(e.gameId)&&Date.parse(e.endAt)>Date.now()&&Date.parse(e.startAt)<=Date.now());
 const urgent=events.filter(e=>Date.parse(e.endAt)-Date.now()<=DAY);
 const summary = n("dl","smart-summary");
 for (const [label, count, className] of [
  ["24 小时内结束", urgent.length, "summary-urgent"],
  ["进行中", events.length, ""],
  ["已标记完成", events.filter(e=>progress[e.id]?.done).length, ""]
 ]) {
  const item = n("div",className);
  const value = n("dd");
  value.append(n("span","summary-value",String(count)),n("span","summary-unit","项"));
  item.append(n("dt","",label),value);
  summary.append(item);
 }
 const sortingHelp = n("details","smart-sorting-help");
 sortingHelp.open = sortingHelpOpen;
 sortingHelp.append(n("summary","","排序说明"),hint);
 sortingHelp.addEventListener("toggle",()=>{ sortingHelpOpen = sortingHelp.open; });
 root.append(summary,sortingHelp);
 const list=n("div","smart-list");
 const pending=events.filter(e=>!progress[e.id]?.done&&!e.featured).sort((a,b)=>{const now=Date.now(),week=7*DAY,nearA=Date.parse(a.endAt)-now<=week,nearB=Date.parse(b.endAt)-now<=week;return Number(nearB)-Number(nearA)||(nearA&&nearB?Date.parse(a.endAt)-Date.parse(b.endAt):0)||Number(Date.parse(b.endAt)-Date.now()<=7*DAY)-Number(Date.parse(a.endAt)-Date.now()<=7*DAY)||((Date.parse(a.endAt)-Date.now()<=7*DAY&&Date.parse(b.endAt)-Date.now()<=7*DAY)?Date.parse(a.endAt)-Date.parse(b.endAt):0)||gameOrderRank(a.gameId)-gameOrderRank(b.gameId)||a.gameId.localeCompare(b.gameId)||Number(!!progress[b.id]?.star)-Number(!!progress[a.id]?.star)||Date.parse(a.endAt)-Date.parse(b.endAt)});
 const pageSize=3,pageCount=Math.max(1,Math.ceil(pending.length/pageSize)),page=Math.max(0,Math.min(pageCount-1,Number(root.dataset.page||0)));root.dataset.page=page;
 list.classList.add("smart-pages");list.tabIndex=0;list.setAttribute("aria-label","今日活动，滚轮或上下滑动翻页");
 const indicator=n("p","smart-page-indicator",`共 ${pending.length} 项 · 上下滚动查看`);
 for(const [index,e] of pending.entries()){

  const row = n("article","smart-row");
  row.dataset.activityId = e.id;
  row.classList.toggle("ending-soon", Date.parse(e.endAt)-Date.now() <= DAY);
  const copy = n("div","smart-card-copy");
  const countdown = n("p","smart-countdown","剩余 " + remain(e.endAt));
  countdown.dataset.countdownEnd = e.endAt;
  countdown.dataset.countdownPrefix = "剩余 ";
  copy.append(n("strong","",e.title),n("p","smart-game-name",games[e.gameId]||e.gameId),countdown);

  const actions = n("div","smart-card-actions");
  const detail = n("button","smart-detail","查看详情");
  const follow = n("button","smart-follow",progress[e.id]?.star?"已关注":"关注");
  const done = n("button",e.dailyCheckin?"smart-daily-done":"","标记完成");
  detail.type = follow.type = done.type = "button";
  follow.setAttribute("aria-pressed",String(!!progress[e.id]?.star));
  detail.onclick = () => window.openActivity?.(e);
  follow.onclick = () => {
   smartUpdate(e.id,"star",!progress[e.id]?.star);
   [...root.querySelectorAll(".smart-row")].find(card=>card.dataset.activityId===e.id)
    ?.querySelector(".smart-follow")?.focus({preventScroll:true});
  };
  done.onclick = () => smartUpdate(e.id,"done",true);
  actions.append(detail, follow, done);
  if (e.dailyCheckin) actions.append(checkinButton(e));
  row.append(copy,actions);
  list.append(row);
 }
 if(!pending.length)list.append(n("p","",events.some(e=>!progress[e.id]?.done&&e.featured)?"未完成的进行中活动可在版本大事件查看。":events.length?"当前进行中的活动均已标记完成。":"所选游戏暂无进行中的活动。"));
 root.append(list,indicator);
 requestAnimationFrame(()=>{list.scrollTop=previousTop});
 const updatePage=()=>{const value=Math.max(0,Math.min(pageCount-1,Math.round(list.scrollTop/list.clientHeight)));root.dataset.page=value;indicator.textContent=`共 ${pending.length} 项 · 上下滚动查看`};
 list.addEventListener("scroll",updatePage,{passive:true});
 list.addEventListener("keydown",event=>{if(event.target!==list)return;const direction={ArrowDown:1,PageDown:1,ArrowUp:-1,PageUp:-1}[event.key];if(!direction)return;event.preventDefault();list.scrollTop=Math.max(0,Math.min(pageCount-1,Number(root.dataset.page)+direction))*list.clientHeight});

 const reset=n("button","smart-reset","恢复已完成活动");reset.onclick=openCompletedActivities;root.append(reset);
 const generated=Date.parse(S.feed.generatedAt);
 if(!Number.isFinite(generated)||Date.now()-generated>6*3600000)root.append(n("p","smart-warning","活动数据超过 6 小时未更新或更新时间无效，请核对官方公告后安排活动。"));
}
function smartPersist(){try{localStorage.setItem(SMART_KEY,JSON.stringify(progress))}catch{document.getElementById("smart-panel").append(n("p","smart-warning","浏览器禁止保存，当前标记将在刷新后丢失。"))}window.dispatchEvent(new Event("timeline-preferences-changed"));}
function smartUpdate(id,key,value){
 // Rebuilding cards removes the focused button. Restore document position after layout.
 const top=window.scrollY,left=window.scrollX;
 const wasDone = !!progress[id]?.done;
 const newlyDone = key === "done" && value && !wasDone;
 if (newlyDone) completedAction = S.feed?.events.find(event=>event.id===id) || null;
 if (key === "done" && !value && completedAction?.id === id) {
  completedAction = null;
  completionNotice.hidden = true;
 }
 const inDetails = activityDialog.open;
 progress[id]={...progress[id],[key]:value};render();smartPersist();window.updateActivityDialog?.();
 if (newlyDone && completedAction) {
  if (inDetails) {
   completionNotice.hidden = true;
   activityDialog.querySelector(".completion-notice button")?.focus({preventScroll:true});
  } else {
   showCompletionNotice(completionNotice,completedAction).focus({preventScroll:true});
  }
 }
 window.scrollTo({top,left,behavior:"instant"});
 requestAnimationFrame(()=>window.scrollTo({top,left,behavior:"instant"}));
}
const timelineRender=render;
render=function(){timelineRender();smartRender()};
smartRender();

const activityDialog=document.createElement("dialog");activityDialog.className="activity-dialog";document.body.append(activityDialog);let activeActivity=null;
window.updateActivityDialog=()=>{
 if(!activeActivity)return;const e=activeActivity;activityDialog.replaceChildren();
 const close=n("button","activity-close","关闭"),title=n("h2","",e.title),game=S.feed?.games.find(g=>g.id===e.gameId),actions=n("div","activity-actions");close.type="button";close.onclick=()=>activityDialog.close();
 activityDialog.append(close,title,n("p","",game?.name||e.gameId),n("p","",`${fmt.format(new Date(e.startAt))} — ${fmt.format(new Date(e.endAt))}`));
 const banner=url(e.imageUrl||game?.bannerUrl);if(banner){const img=document.createElement("img");img.src=banner;img.alt=e.title;img.onerror=()=>img.remove();activityDialog.append(img)}
 const star=n("button","",progress[e.id]?.star?"★ 取消关注":"☆ 关注"),done=n("button","",progress[e.id]?.done?"恢复未完成":"标记完成");star.type=done.type="button";star.onclick=()=>smartUpdate(e.id,"star",!progress[e.id]?.star);done.onclick=()=>smartUpdate(e.id,"done",!progress[e.id]?.done);actions.append(star,done);if(e.dailyCheckin)actions.append(checkinButton(e));const home=activityHome(e);if(home)actions.append(home);activityDialog.append(actions);
 if (completedAction?.id === e.id && progress[e.id]?.done) {
  const notice = n("div","completion-notice completion-notice-inline");
  activityDialog.append(notice);
  showCompletionNotice(notice,completedAction);
 }
};
window.openActivity=e=>{activeActivity=e;window.updateActivityDialog();if(!activityDialog.open)activityDialog.showModal()};
activityDialog.addEventListener("close",()=>{activeActivity=null});

// Keep a separate dialog so normal page re-rendering never closes the completed list.
const completedDialog=document.createElement('dialog');completedDialog.className='completed-dialog';completedDialog.setAttribute('aria-label','已完成活动');document.body.append(completedDialog);
function drawCompletedActivities(){
 const oldScroll=completedDialog.querySelector('.completed-list')?.scrollTop||0;
 completedDialog.replaceChildren();const title=n('h2','','已完成活动'),close=n('button','','关闭');close.type='button';close.onclick=()=>completedDialog.close();completedDialog.append(title,n('p','','可上下滚动查看，点击取消完成恢复单项活动。'));
 const list=n('div','completed-list');list.tabIndex=0;list.setAttribute('aria-label','已完成活动列表');
 const catalog=new Map((S.feed?.events||[]).map(e=>[e.id,e]));
 const now=Date.now();
 const ids=Object.keys(progress).filter(id=>{const event=catalog.get(id),end=Date.parse(event?.endAt);return progress[id]?.done&&Number.isFinite(end)&&end>now});
 for(const id of ids){const event=catalog.get(id),row=n('article','completed-row'),copy=n('div'),game=S.feed?.games.find(g=>g.id===event?.gameId);copy.append(n('strong','',event?.title||'已不在当前数据中的活动'),n('p','',event?`${game?.name||event.gameId} · ${fmt.format(new Date(event.endAt))}结束`:`活动记录：${id}`));const undo=n('button','','取消完成');undo.type='button';undo.onclick=()=>{smartUpdate(id,'done',false);drawCompletedActivities()};row.append(copy,undo);list.append(row)}
 if(!ids.length)list.append(n('p','','暂无尚未结束的已完成活动。'));completedDialog.append(list,close);list.scrollTop=oldScroll;
}
function openCompletedActivities(){drawCompletedActivities();if(!completedDialog.open)completedDialog.showModal()}

// Remove items that expire while this dialog stays open.
setInterval(()=>{if(completedDialog.open)drawCompletedActivities()},1000);

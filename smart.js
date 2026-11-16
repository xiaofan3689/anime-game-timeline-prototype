/* Local activity assistant: no account or external AI service required. */
const SMART_KEY="timeline-progress-v1";
let progress={};
try{progress=JSON.parse(localStorage.getItem(SMART_KEY))||{}}catch{}
window.activityDone=id=>!!progress[id]?.done;
function smartRender(){
 const root=document.getElementById("smart-panel");if(!root||!S.feed)return;const previousTop=root.querySelector(".smart-pages")?.scrollTop||0;
 root.replaceChildren();
 const title=n("h2","","今天先做什么"),hint=n("p","","优先展示一周内结束的活动，越临近结束越靠前；其余按游戏排序。" );root.append(title,hint);
 const games=Object.fromEntries(S.feed.games.map(g=>[g.id,g.name]));
 const events=S.feed.events.filter(e=>S.selected.has(e.gameId)&&Date.parse(e.endAt)>Date.now()&&Date.parse(e.startAt)<=Date.now());
 const urgent=events.filter(e=>Date.parse(e.endAt)-Date.now()<=DAY);
 root.append(n("p","smart-summary",`进行中 ${events.length} 项 · 24 小时内结束 ${urgent.length} 项 · 已标记完成 ${events.filter(e=>progress[e.id]?.done).length} 项`));
 const list=n("div","smart-list");
 const pending=events.filter(e=>!progress[e.id]?.done&&!e.featured).sort((a,b)=>{const now=Date.now(),week=7*DAY,nearA=Date.parse(a.endAt)-now<=week,nearB=Date.parse(b.endAt)-now<=week;return Number(nearB)-Number(nearA)||(nearA&&nearB?Date.parse(a.endAt)-Date.parse(b.endAt):0)||Number(Date.parse(b.endAt)-Date.now()<=7*DAY)-Number(Date.parse(a.endAt)-Date.now()<=7*DAY)||((Date.parse(a.endAt)-Date.now()<=7*DAY&&Date.parse(b.endAt)-Date.now()<=7*DAY)?Date.parse(a.endAt)-Date.parse(b.endAt):0)||gameOrderRank(a.gameId)-gameOrderRank(b.gameId)||a.gameId.localeCompare(b.gameId)||Number(!!progress[b.id]?.star)-Number(!!progress[a.id]?.star)||Date.parse(a.endAt)-Date.parse(b.endAt)});
 const pageSize=3,pageCount=Math.max(1,Math.ceil(pending.length/pageSize)),page=Math.max(0,Math.min(pageCount-1,Number(root.dataset.page||0)));root.dataset.page=page;
 list.classList.add("smart-pages");list.tabIndex=0;list.setAttribute("aria-label","今日活动，滚轮或上下滑动翻页");
 const indicator=n("p","smart-page-indicator",`${page+1} / ${pageCount} · 滚轮或上下滑动浏览`);let currentPageBody;
 for(const [index,e] of pending.entries()){
  if(index%pageSize===0){currentPageBody=n("div","smart-page");list.append(currentPageBody)}
  const row=n("article","smart-row"),copy=n("div"),hours=(Date.parse(e.endAt)-Date.now())/3600000;
  copy.append(n("strong","",e.title),n("p","",`${games[e.gameId]||e.gameId} · ${hours<24?"即将结束 · ":""}${remain(e.endAt)}后结束 · ${fmt.format(new Date(e.endAt))}`));
  const star=n("button","",progress[e.id]?.star?"★ 已关注":"☆ 关注"),done=n("button","","标记完成");
  star.onclick=()=>smartUpdate(e.id,"star",!progress[e.id]?.star);done.onclick=()=>smartUpdate(e.id,"done",true);
  row.append(copy,star,done);currentPageBody.append(row);
 }
 if(!pending.length)list.append(n("p","",events.length?"当前进行中的活动均已标记完成。":"所选游戏暂无进行中的活动。"));
 root.append(list,indicator);
 requestAnimationFrame(()=>{list.scrollTop=previousTop});
 const updatePage=()=>{const value=Math.max(0,Math.min(pageCount-1,Math.round(list.scrollTop/list.clientHeight)));root.dataset.page=value;indicator.textContent=`${value+1} / ${pageCount} · 滚轮或上下滑动浏览`};
 list.addEventListener("scroll",updatePage,{passive:true});
 list.addEventListener("keydown",event=>{if(event.target!==list)return;const direction={ArrowDown:1,PageDown:1,ArrowUp:-1,PageUp:-1}[event.key];if(!direction)return;event.preventDefault();list.scrollTop=Math.max(0,Math.min(pageCount-1,Number(root.dataset.page)+direction))*list.clientHeight});

 const reset=n("button","","恢复已完成活动");reset.onclick=()=>{for(const value of Object.values(progress))value.done=false;smartPersist();render()};root.append(reset);
 const generated=Date.parse(S.feed.generatedAt);
 if(!Number.isFinite(generated)||Date.now()-generated>6*3600000)root.append(n("p","smart-warning","活动数据超过 6 小时未更新或更新时间无效，请核对官方公告后安排活动。"));
}
function smartPersist(){try{localStorage.setItem(SMART_KEY,JSON.stringify(progress))}catch{document.getElementById("smart-panel").append(n("p","smart-warning","浏览器禁止保存，当前标记将在刷新后丢失。"))}}
function smartUpdate(id,key,value){progress[id]={...progress[id],[key]:value};render();smartPersist();window.updateActivityDialog?.()}
const timelineRender=render;
render=function(){timelineRender();smartRender()};
smartRender();

const activityDialog=document.createElement("dialog");activityDialog.className="activity-dialog";document.body.append(activityDialog);let activeActivity=null;
window.updateActivityDialog=()=>{
 if(!activeActivity)return;const e=activeActivity;activityDialog.replaceChildren();
 const close=n("button","activity-close","关闭"),title=n("h2","",e.title),game=S.feed?.games.find(g=>g.id===e.gameId),actions=n("div","activity-actions");close.type="button";close.onclick=()=>activityDialog.close();
 activityDialog.append(close,title,n("p","",game?.name||e.gameId),n("p","",`${fmt.format(new Date(e.startAt))} — ${fmt.format(new Date(e.endAt))}`));
 const banner=url(e.imageUrl||game?.bannerUrl);if(banner){const img=document.createElement("img");img.src=banner;img.alt=e.title;img.onerror=()=>img.remove();activityDialog.append(img)}
 const star=n("button","",progress[e.id]?.star?"★ 取消关注":"☆ 关注"),done=n("button","",progress[e.id]?.done?"恢复未完成":"标记完成");star.type=done.type="button";star.onclick=()=>smartUpdate(e.id,"star",!progress[e.id]?.star);done.onclick=()=>smartUpdate(e.id,"done",!progress[e.id]?.done);actions.append(star,done);activityDialog.append(actions);
};
window.openActivity=e=>{activeActivity=e;window.updateActivityDialog();if(!activityDialog.open)activityDialog.showModal()};
activityDialog.addEventListener("close",()=>{activeActivity=null});

/* Local activity assistant: no account or external AI service required. */
const SMART_KEY="timeline-progress-v1";
let progress={};
try{progress=JSON.parse(localStorage.getItem(SMART_KEY))||{}}catch{}
function smartRender(){
 const root=document.getElementById("smart-panel");if(!root||!S.feed)return;
 root.replaceChildren();
 const title=n("h2","","今天先做什么"),hint=n("p","","按结束时间排序，优先显示已关注和即将结束的活动。操作保存在当前浏览器。" );root.append(title,hint);
 const games=Object.fromEntries(S.feed.games.map(g=>[g.id,g.name]));
 const events=S.feed.events.filter(e=>S.selected.has(e.gameId)&&Date.parse(e.endAt)>Date.now()&&Date.parse(e.startAt)<=Date.now());
 const urgent=events.filter(e=>Date.parse(e.endAt)-Date.now()<=DAY);
 root.append(n("p","smart-summary",`进行中 ${events.length} 项 · 24 小时内结束 ${urgent.length} 项 · 已标记完成 ${events.filter(e=>progress[e.id]?.done).length} 项`));
 const versions=n("div","smart-list");for(const g of S.feed.games.filter(g=>S.selected.has(g.id)&&Number.isFinite(Date.parse(g.nextVersionAt)))){versions.append(n("p","",`${g.name} · 下版本 ${fmt.format(new Date(g.nextVersionAt))}（${g.nextVersionEstimated?"按公告 +42 天推算，以官方为准":"管理员确认时间"}）`))}root.append(versions);const list=n("div","smart-list");
 const pending=events.filter(e=>!progress[e.id]?.done).sort((a,b)=>Number(!!progress[b.id]?.star)-Number(!!progress[a.id]?.star)||Date.parse(a.endAt)-Date.parse(b.endAt));
 const pageSize=4,page=Math.max(0,Math.min(Math.floor((pending.length-1)/pageSize),Number(root.dataset.page||0)));root.dataset.page=page;const pageItems=pending.slice(page*pageSize,(page+1)*pageSize);
 const pager=n("div","smart-pager");const prev=n("button","","上一页"),next=n("button","","下一页");prev.disabled=page===0;next.disabled=(page+1)*pageSize>=pending.length;prev.onclick=()=>{root.dataset.page=page-1;smartRender()};next.onclick=()=>{root.dataset.page=page+1;smartRender()};pager.append(prev,n("span","",`${page+1} / ${Math.max(1,Math.ceil(pending.length/pageSize))}`),next);root.append(pager);
 for(const e of pageItems){
  const row=n("article","smart-row"),copy=n("div"),hours=(Date.parse(e.endAt)-Date.now())/3600000;
  copy.append(n("strong","",e.title),n("p","",`${games[e.gameId]||e.gameId} · ${hours<24?"即将结束 · ":""}${remain(e.endAt)}后结束 · ${fmt.format(new Date(e.endAt))}`));
  const star=n("button","",progress[e.id]?.star?"★ 已关注":"☆ 关注"),done=n("button","","标记完成");
  star.onclick=()=>smartUpdate(e.id,"star",!progress[e.id]?.star);done.onclick=()=>smartUpdate(e.id,"done",true);
  row.append(copy,star,done);list.append(row);
 }
 if(!pending.length)list.append(n("p","",events.length?"当前进行中的活动均已标记完成。":"所选游戏暂无进行中的活动。"));
 root.append(list);
 const reset=n("button","","恢复已完成活动");reset.onclick=()=>{for(const value of Object.values(progress))value.done=false;smartPersist();smartRender()};root.append(reset);
 const generated=Date.parse(S.feed.generatedAt);
 if(!Number.isFinite(generated)||Date.now()-generated>6*3600000)root.append(n("p","smart-warning","活动数据超过 6 小时未更新或更新时间无效，请核对官方公告后安排活动。"));
}
function smartPersist(){try{localStorage.setItem(SMART_KEY,JSON.stringify(progress))}catch{document.getElementById("smart-panel").append(n("p","smart-warning","浏览器禁止保存，当前标记将在刷新后丢失。"))}}
function smartUpdate(id,key,value){progress[id]={...progress[id],[key]:value};smartRender();smartPersist();window.updateActivityDialog?.()}
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

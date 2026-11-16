const milestones=document.createElement("section");milestones.className="smart-panel milestones";document.getElementById("smart-panel").before(milestones);
function milestoneRender(){
 if(!S.feed)return;milestones.replaceChildren(n("h2","","版本大事件"));const now=Date.now();let count=0;
 for(const g of S.feed.games.filter(g=>S.selected.has(g.id))){
 const at=Date.parse(g.previewAt),expiry=Date.parse(g.codesExpireAt),update=Date.parse(g.nextVersionAt);if(!Number.isFinite(at))continue;
 const updateDay=Number.isFinite(update)?day(new Date(update)).getTime():NaN;const updateNext=Number.isFinite(update)?new Date(new Date(updateDay).setDate(new Date(updateDay).getDate()+1)).getTime():NaN;if(now>=updateNext)continue;
 const endOfLive=new Date(at+8*3600000);endOfLive.setUTCHours(22,0,0,0);const ended=now>=endOfLive.getTime()-8*3600000;
 const card=n("article","milestone-card"),isExpired=Number.isFinite(expiry)&&now>=expiry;card.append(n("h3","",g.name));
 if(!ended){const imgUrl=url(g.previewBannerUrl);if(imgUrl){const img=document.createElement("img");img.src=imgUrl;img.alt=g.name+"版本前瞻";card.append(img)}card.append(n("p","",`前瞻直播：${fmt.format(new Date(at))}`));const live=url(g.previewUrl);if(live&&new URL(live).hostname==="live.bilibili.com"){const a=n("a","","前往 Bilibili 直播间 ↗");a.href=live;a.target="_blank";a.rel="noopener";card.append(a)}}
 if(!isExpired){for(const code of g.previewCodes||[]){const row=n("div","code-row"),copy=n("button","","复制");copy.onclick=async()=>{try{await navigator.clipboard.writeText(code);copy.textContent="已复制"}catch{copy.textContent="请长按选择复制"}};const text=n("code","",code);row.append(text,copy);card.append(row)}if(Number.isFinite(expiry))card.append(n("p","",`兑换截止：${fmt.format(new Date(expiry))}`))}
 else if(Number.isFinite(update)){card.append(n("p","",`版本更新：${fmt.format(new Date(update))}${g.nextVersionEstimated?"（预计）":""}`));if(now>=updateDay&&now<updateNext){card.classList.add("update-today");card.append(n("strong","","今日版本更新"))}}
 milestones.append(card);count++;
 }
 for(const e of S.feed.events.filter(e=>e.featured&&S.selected.has(e.gameId)&&status(e)!=="ended")){const card=n("article","milestone-card");card.append(n("h3","",e.title),n("p","",S.feed.games.find(g=>g.id===e.gameId)?.name||e.gameId));const star=n("button","",progress[e.id]?.star?"取消关注":"关注"),done=n("button","",progress[e.id]?.done?"恢复未完成":"标记完成"),detail=n("button","","查看详情");star.onclick=()=>smartUpdate(e.id,"star",!progress[e.id]?.star);done.onclick=()=>smartUpdate(e.id,"done",!progress[e.id]?.done);detail.onclick=()=>openActivity(e);card.append(star,done,detail);milestones.append(card);count++}
 if(!count)milestones.append(n("p","","所选游戏暂无版本大事件"));
}
const beforeMilestoneRender=render;render=function(){beforeMilestoneRender();milestoneRender()};milestoneRender();
async function refreshManualMilestones(){try{const r=await fetch("/data/manual.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)return;const manual=await r.json();if(!S.feed)return;for(const g of manual.games||[]){const target=S.feed.games.find(x=>x.id===g.id);if(target)Object.assign(target,g)}for(const e of manual.events||[]){const target=S.feed.events.find(x=>x.id===e.id);if(target)Object.assign(target,e);else if(e.featured)S.feed.events.push(e)}render()}catch{}}
setTimeout(refreshManualMilestones,1500);setInterval(refreshManualMilestones,60000);

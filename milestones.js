function officialLinkVisible(highlight,now){return highlight&&new Date(now+8*3600000).getUTCHours()>=6}
function versionMilestoneTiming(g,now){
 const parse=value=>typeof value==="string"&&value.trim()?Date.parse(value):NaN;
 const cnDay=t=>Number.isFinite(t)?new Date(t+8*3600000).toISOString().slice(0,10):"";
 // Bind this preview/code cycle to the first update at or after its announcement.
 const anchor=[parse(g.previewAt),parse(g.codesExpireAt)].filter(Number.isFinite).sort((a,b)=>a-b)[0];
 const dates=[g.updateReferenceAt,g.versionNoticeAt,g.nextVersionAt].map(parse).filter(Number.isFinite).sort((a,b)=>a-b);
 const relevant=Number.isFinite(anchor)?dates.filter(t=>cnDay(t)>=cnDay(anchor)):dates;
 const update=relevant[0]??NaN;
 const updateDay=Number.isFinite(update)?Date.parse(cnDay(update)+"T00:00:00+08:00"):NaN;
 return {update,highlight:Number.isFinite(updateDay)&&now>=updateDay&&now<updateDay+86400000,hidden:Number.isFinite(updateDay)&&now>=updateDay+86400000};
}
function featuredMilestoneVisible(e){return e.featured&&S.selected.has(e.gameId)&&status(e)!=="ended"&&!window.activityDone(e.id,e)}
const milestones=document.createElement("section");milestones.className="smart-panel milestones";const smartPanel=document.getElementById("smart-panel");const dashboard=document.createElement("div");dashboard.className="event-dashboard";smartPanel.before(dashboard);dashboard.append(milestones,smartPanel);
function previewCodesVisible(g,now){const start=Date.parse(g.previewAt),end=Date.parse(g.codesExpireAt);return Number.isFinite(start)&&Number.isFinite(end)&&now>=start&&now<end&&Array.isArray(g.previewCodes)&&g.previewCodes.some(c=>typeof c==='string'&&c.trim())}
function milestoneRender(){
 if(!S.feed)return;milestones.replaceChildren(n("h2","","版本大事件"));const now=Date.now();let count=0;
 for(const g of S.feed.games.filter(g=>S.selected.has(g.id))){
 const at=Date.parse(g.previewAt),expiry=Date.parse(g.codesExpireAt);const cnDay=t=>Number.isFinite(t)?new Date(t+8*3600000).toISOString().slice(0,10):"";
 const timing=versionMilestoneTiming(g,now),update=timing.update;
 const hasPreview=Number.isFinite(at);const hasCodes=Array.isArray(g.previewCodes)&&g.previewCodes.some(Boolean);const hasCodeDeadline=Number.isFinite(expiry);const recap=url(g.previewRecapUrl),showCodes=previewCodesVisible(g,now);if(!timing.highlight&&!hasPreview&&!hasCodes&&!hasCodeDeadline&&!recap)continue;if(timing.hidden&&!showCodes)continue;
 const highlight=timing.highlight;
 const endOfLive=new Date(at+8*3600000);endOfLive.setUTCHours(22,0,0,0);const ended=!Number.isFinite(at)||now>=endOfLive.getTime()-8*3600000;
 const card=n("article","milestone-card"),isExpired=Number.isFinite(expiry)&&now>=expiry;card.append(n("h3","",g.name));
 if(highlight){card.classList.add("update-today");card.append(n("strong","","今日版本更新"));const banner=url(g.previewBannerUrl),official=url(g.officialUrl);if(banner){const img=document.createElement("img");img.src=banner;img.alt=g.name+"版本更新";card.append(img)}}
 if(!ended&&!highlight&&!recap){const imgUrl=url(g.previewBannerUrl);if(imgUrl){const img=document.createElement("img");img.src=imgUrl;img.alt=g.name+"版本前瞻";card.append(img)}card.append(n("p","",`前瞻直播：${fmt.format(new Date(at))}`));const live=url(g.previewUrl);if(live&&new URL(live).hostname==="live.bilibili.com"){const a=n("a","","前往 Bilibili 直播间 ↗");a.href=live;a.target="_blank";a.rel="noopener";card.append(a)}}
 if(recap){const link=n("a","official-game-link","观看版本前瞻回顾长图");link.href=recap;link.target="_blank";link.rel="noopener noreferrer";card.append(link)}
 if(showCodes){for(const code of g.previewCodes.filter(c=>typeof c==='string'&&c.trim())){const row=n("div","code-row"),copy=n("button","","复制");copy.onclick=async()=>{try{await navigator.clipboard.writeText(code);copy.textContent="已复制"}catch{copy.textContent="请长按选择复制"}};const text=n("code","",code);row.append(text,copy);card.append(row)}if(Number.isFinite(expiry))card.append(n("p","",`兑换截止：${fmt.format(new Date(expiry))}`))}
 else if(isExpired&&Number.isFinite(update)){card.append(n("p","",`版本更新：${fmt.format(new Date(update))}${g.nextVersionEstimated&&!highlight?"（预计）":""}${Number.isFinite(Date.parse(g.preDownloadAt))&&now>=Date.parse(g.preDownloadAt)&&now<update?"（已开启预下载）":""}`));}
 if(highlight){const official=url(g.officialUrl);if(officialLinkVisible(highlight,now)&&official&&official.startsWith("https://")){const link=n("a","official-game-link","前往游戏官网");link.href=official;link.target="_blank";link.rel="noopener noreferrer";card.append(link)}}
 milestones.append(card);count++;
 }
 for(const e of S.feed.events.filter(featuredMilestoneVisible)){const card=n("article","milestone-card featured-event");card.append(n("h3","",e.title));const banner=url(e.imageUrl);if(banner){const img=document.createElement("img");img.src=banner;img.alt=e.title+"活动 Banner";card.append(img)}card.append(n("p","",S.feed.games.find(g=>g.id===e.gameId)?.name||e.gameId));const star=n("button","",progress[e.id]?.star?"取消关注":"关注"),done=n("button","",progress[e.id]?.done?"恢复未完成":"标记完成"),detail=n("button","","查看详情");star.className="featured-follow";star.onclick=()=>smartUpdate(e.id,"star",!progress[e.id]?.star);done.onclick=()=>smartUpdate(e.id,"done",!progress[e.id]?.done);detail.onclick=()=>openActivity(e);const actions=n("div","featured-card-actions");actions.append(star,detail);if(e.dailyCheckin)actions.append(checkinButton(e));else if(!e.recurring)actions.append(done);const home=activityHome(e);if(home)actions.append(home);card.append(actions);milestones.append(card);count++}
 milestones.classList.toggle("milestones-empty",!count);if(!count)milestones.append(n("p","","暂无版本大事件"));
}
const beforeMilestoneRender=render;render=function(){beforeMilestoneRender();milestoneRender()};milestoneRender();
// v92: all milestone data comes from the authoritative feed handled by app.js.

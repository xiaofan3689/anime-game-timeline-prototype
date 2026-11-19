const validUrl = value => !value || /^\/assets\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes("..") || /^https:\/\/[^\s]+$/i.test(value);
export function validate(data) {
  if (!data || !Array.isArray(data.games) || !Array.isArray(data.events) || data.games.length > 100 || data.events.length > 2000) throw Error("数据格式或数量无效");
  const games = data.games.map(g => {
    if (!g || !/^[a-z0-9-]{2,40}$/.test(g.id) || !g.name?.trim() || g.name.length > 80 || !validUrl(g.iconUrl)) throw Error("游戏 ID、名称或图标 URL 无效");
    for(const k of ["bannerUrl","previewBannerUrl","previewUrl","officialUrl","previewRecapUrl"])if(!validUrl(g[k]))throw Error("图片地址须为 HTTPS 或 /assets/ 路径");for(const k of ["versionNoticeAt","nextVersionAt","previewAt","codesExpireAt","previousVersionAt","preDownloadAt","updateReferenceAt"])if(g[k]&&!Number.isFinite(Date.parse(g[k])))throw Error("版本时间无效");return {disabled:g.disabled===true,id:g.id,name:g.name.trim(),iconUrl:g.iconUrl || "",version:g.version || null,versionName:g.versionName || null,bannerUrl:g.bannerUrl || null,versionNoticeAt:g.versionNoticeAt || null,nextVersionAt:g.nextVersionAt || null,nextVersionEstimated:g.nextVersionEstimated===true,syncWithSra:g.syncWithSra===true,previousVersionAt:g.previousVersionAt||null,updateReferenceAt:g.updateReferenceAt||null,preDownloadAt:g.preDownloadAt||null,officialUrl:g.officialUrl||null,previewRecapUrl:g.previewRecapUrl||null,previewBannerUrl:g.previewBannerUrl||null,previewUrl:g.previewUrl||null,previewAt:g.previewAt||null,codesExpireAt:g.codesExpireAt||null,previewCodes:Array.isArray(g.previewCodes)?g.previewCodes.filter(x=>typeof x==="string").slice(0,30):[]};
  });
  if (new Set(games.map(g=>g.id)).size !== games.length) throw Error("游戏 ID 重复");
  const events = data.events.map(e => {
    if (!e || !/^[a-z0-9-]{2,40}$/.test(e.gameId) || !e.title?.trim() || e.title.length > 160) throw Error("活动游戏或名称无效");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(e.startAt) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(e.endAt) || !(Date.parse(e.endAt)>Date.parse(e.startAt))) throw Error("活动时间无效，需包含时区且结束晚于开始");
    if (!validUrl(e.imageUrl) || !validUrl(e.sourceUrl)) throw Error("图片或公告链接无效，须使用 HTTPS");
    return {featured:e.featured===true,id:e.id || undefined,gameId:e.gameId,title:e.title.trim(),category:e.category || "活动",startAt:e.startAt,endAt:e.endAt,imageUrl:e.imageUrl || "",sourceUrl:e.sourceUrl || ""};
  });
  return {games,events};
}

export const gameFields=['disabled','id','name','iconUrl','version','versionName','bannerUrl','versionNoticeAt','nextVersionAt','nextVersionEstimated','syncWithSra','previousVersionAt','updateReferenceAt','preDownloadAt','officialUrl','previewRecapUrl','previewBannerUrl','previewUrl','previewAt','codesExpireAt','previewCodes'];
export const eventFields=['featured','id','gameId','title','category','startAt','endAt','imageUrl','sourceUrl'];
export const pick=(x,fields)=>Object.fromEntries(fields.filter(k=>x[k]!==undefined).map(k=>[k,x[k]]));
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value)}
export function scoped(snapshot,catalog,ids){const games=new Map(catalog.games.map(g=>[g.id,g]));for(const g of snapshot.games)games.set(g.id,{...games.get(g.id),...g});return {games:ids.map(id=>games.get(id)).filter(Boolean).map(g=>pick(g,gameFields)),events:snapshot.events.map((e,i)=>({...e,id:e.id||catalog.legacyIds?.[i]})).filter(e=>ids.includes(e.gameId)).map(e=>pick(e,eventFields))}}
export function mergeScoped(snapshot,catalog,input,ids){
 if(!input||!Array.isArray(input.games)||!Array.isArray(input.events))throw Error('数据结构无效');
 for(const [rows,keys] of [[input.games,gameFields],[input.events,eventFields]])for(const row of rows)if(!row||Object.keys(row).some(k=>!keys.includes(k)))throw Error('包含不允许的字段');
 const base=scoped(snapshot,catalog,ids),allowed=new Set(ids),known=new Map(base.games.map(g=>[g.id,g]));
 if(input.games.length!==base.games.length||input.games.some(g=>!known.has(g.id)||!allowed.has(g.id)))throw Error('不可增加、移除或改名游戏 ID');
 for(const g of input.games)if(!!g.disabled!==!!known.get(g.id).disabled)throw Error('停用或恢复游戏仅管理员可操作');
 const clean=validate(input),seen=new Set(),all=new Map([...catalog.events,...snapshot.events].map(e=>[e.id,e]));
 for(const e of clean.events){if(!allowed.has(e.gameId)||typeof e.id!=='string'||!e.id||e.id.length>200||seen.has(e.id))throw Error('活动 ID 或游戏范围无效');seen.add(e.id);const existing=all.get(e.id);if(existing&&existing.gameId!==e.gameId)throw Error('活动 ID 属于其他游戏');}
 const previous=new Map(base.games.map(g=>[g.id,validate({games:[g],events:[]}).games[0]]));
 const updates=clean.games.flatMap(g=>{const original=snapshot.games.find(x=>x.id===g.id);return canonical(g)===canonical(previous.get(g.id))?(original?[original]:[]):[g]});
  const gameMap=new Map(updates.map(g=>[g.id,g])),eventMap=new Map(clean.events.map(e=>[e.id,e]));
 const games=snapshot.games.map(g=>gameMap.get(g.id)||g);for(const g of updates)if(!snapshot.games.some(x=>x.id===g.id))games.push(g);
 const events=[];for(const [i,e] of snapshot.events.entries()){if(!allowed.has(e.gameId)){events.push(e);continue}const id=e.id||catalog.legacyIds?.[i],next=eventMap.get(id);if(next){const prior=validate({games:[],events:[{...e,id}]}).events[0];events.push(canonical(prior)===canonical(next)?e:next);eventMap.delete(id)}}events.push(...eventMap.values());
 return {games,events};
}
export function diffData(before,after){const changes=[];for(const section of ['games','events']){const a=new Map(before[section].map(x=>[x.id||[x.gameId,x.title,x.startAt].join("|"),x])),b=new Map(after[section].map(x=>[x.id||[x.gameId,x.title,x.startAt].join("|"),x]));for(const id of new Set([...a.keys(),...b.keys()]))if(canonical(a.get(id))!==canonical(b.get(id)))changes.push({section,id,before:a.get(id)||null,after:b.get(id)||null})}return changes}
export function checkScope(before,after,ids){for(const d of diffData(before,after)){const a=d.before,b=d.after;if(!ids.includes((a||b).gameId||(a||b).id)||(a&&b&&a.gameId!==b.gameId))throw Error('提案已超出当前授权范围')}}

export async function prepareCatalog(snapshot,catalog){catalog.legacyIds={};for(const [i,e] of snapshot.events.entries()){if(e.id)continue;let start=e.startAt.trim().replace(/Z$/,'+00:00');if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?:[+-]\d{2}:\d{2})$/.test(start))start=start.slice(0,16)+':00'+start.slice(16);const bytes=new TextEncoder().encode(`${e.gameId}|${e.title}|${start}`);const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));catalog.legacyIds[i]=[...digest].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20)}}


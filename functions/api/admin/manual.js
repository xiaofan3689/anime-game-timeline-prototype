const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const fail = (message, status) => json({error:message}, status);
const validUrl = value => !value || /^\/assets\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes("..") || /^https:\/\/[^\s]+$/i.test(value);
function validate(data) {
  if (!data || !Array.isArray(data.games) || !Array.isArray(data.events) || data.games.length > 100 || data.events.length > 2000) throw Error("数据格式或数量无效");
  const games = data.games.map(g => {
    if (!g || !/^[a-z0-9-]{2,40}$/.test(g.id) || !g.name?.trim() || g.name.length > 80 || !validUrl(g.iconUrl)) throw Error("游戏 ID、名称或图标 URL 无效");
    for(const k of ["bannerUrl","previewBannerUrl","previewUrl"])if(!validUrl(g[k]))throw Error("图片地址须为 HTTPS 或 /assets/ 路径");for(const k of ["versionNoticeAt","nextVersionAt","previewAt","codesExpireAt"])if(g[k]&&!Number.isFinite(Date.parse(g[k])))throw Error("版本时间无效");return {id:g.id,name:g.name.trim(),iconUrl:g.iconUrl || "",version:g.version || null,versionName:g.versionName || null,bannerUrl:g.bannerUrl || null,versionNoticeAt:g.versionNoticeAt || null,nextVersionAt:g.nextVersionAt || null,nextVersionEstimated:g.nextVersionEstimated===true,previewBannerUrl:g.previewBannerUrl||null,previewUrl:g.previewUrl||null,previewAt:g.previewAt||null,codesExpireAt:g.codesExpireAt||null,previewCodes:Array.isArray(g.previewCodes)?g.previewCodes.filter(x=>typeof x==="string").slice(0,30):[]};
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
async function authorize(context) {
  const {env,request} = context, token=request.headers.get("Cf-Access-Jwt-Assertion");
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAIL || !token) return false;
  const origin=new URL(request.url).origin;
  if (request.method!=="GET" && request.headers.get("Origin")!==origin) return false;
  try {
    const [head,payload,signature]=token.split(".");
    if (!head || !payload || !signature) return false;
    const decode=x=>Uint8Array.from(atob(x.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
    const header=JSON.parse(new TextDecoder().decode(decode(head))), claims=JSON.parse(new TextDecoder().decode(decode(payload)));
    const team=env.ACCESS_TEAM_DOMAIN.replace(/\/$/,"");
    if (header.alg!=="RS256" || !header.kid || claims.iss!==team || !(Array.isArray(claims.aud)?claims.aud.includes(env.ACCESS_AUD):claims.aud===env.ACCESS_AUD) || claims.exp*1000<Date.now() || claims.nbf*1000>Date.now() || claims.email?.toLowerCase()!==env.ADMIN_EMAIL.toLowerCase()) return false;
    const certs=await fetch(team+"/cdn-cgi/access/certs");
    if (!certs.ok) return false;
    const keys=(await certs.json()).keys || [], jwk=keys.find(k=>k.kid===header.kid && k.kty==="RSA");
    if (!jwk) return false;
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode(signature),new TextEncoder().encode(head+"."+payload));
  } catch {return false;}
}
async function github(env, method, body) {
  if (!env.GH_TOKEN || !env.GH_OWNER || !env.GH_REPO) throw Error("GitHub 环境变量未配置");
  const target=`https://api.github.com/repos/${encodeURIComponent(env.GH_OWNER)}/${encodeURIComponent(env.GH_REPO)}/contents/data/manual.json${method==="GET"?"?ref="+encodeURIComponent(env.GH_BRANCH||"main"):""}`;
  const response=await fetch(target,{method,headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+env.GH_TOKEN,"X-GitHub-Api-Version":"2022-11-28","User-Agent":"anime-game-timeline-admin","Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
  const result=await response.json().catch(()=>({}));
  if (!response.ok) throw Object.assign(Error(result.message || `GitHub ${response.status}`),{status:response.status});
  return result;
}
async function handle(context, write) {
  if (!await authorize(context)) return fail("管理员身份验证失败；请确认 Cloudflare Access 已覆盖 /admin/* 和 /api/admin/*。",403);
  try {
    if (!write) {
      const result=await github(context.env,"GET");
      const bytes=Uint8Array.from(atob(result.content.replace(/\s/g,"")),c=>c.charCodeAt(0));
      return json({sha:result.sha,data:JSON.parse(new TextDecoder().decode(bytes))});
    }
    if (!context.request.headers.get("Content-Type")?.startsWith("application/json")) return fail("需要 JSON 请求",415);
    const input=await context.request.json();
    if (!/^[a-f0-9]{40}$/.test(input.sha || "")) return fail("缺少 GitHub 文件版本，请刷新页面",400);
    const data=validate(input.data), bytes=new TextEncoder().encode(JSON.stringify(data,null,2)+"\n");
    const content=btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(""));
    const result=await github(context.env,"PUT",{message:"Update manual game events",content,sha:input.sha,branch:context.env.GH_BRANCH || "main"});
    const dispatch=await fetch(`https://api.github.com/repos/${encodeURIComponent(context.env.GH_OWNER)}/${encodeURIComponent(context.env.GH_REPO)}/dispatches`,{method:"POST",headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+context.env.GH_TOKEN,"X-GitHub-Api-Version":"2022-11-28","User-Agent":"anime-game-timeline-admin","Content-Type":"application/json"},body:JSON.stringify({event_type:"manual-events-updated"})});
    return json({ok:true,sha:result.content.sha,commitUrl:result.commit.html_url,syncTriggered:dispatch.ok,warning:dispatch.ok?null:"已保存到 GitHub，但未能立即触发同步；请手动运行 Sync game events。"});
  } catch(error) {return fail(error.status===409?"文件已被其他修改更新，请刷新后重试":error.message,error.status===409?409:error.status===404?404:400);}
}
export const onRequestGet=context=>handle(context,false);
export const onRequestPut=context=>handle(context,true);

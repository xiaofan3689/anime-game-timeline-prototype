import {admin,member,body,json,endpoint,fail} from './collaborator-auth.js';
import {canonical,validate,mergeScoped} from './collaborator-data.js';
import {baseline,file,mainRepo} from './collaborator-github.js';
export async function previewDigest(data){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(data))))].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function previewFeed(feed,manual){const games=new Map(feed.games.map(g=>[g.id,{...g}]));for(const g of manual.games){const old=games.get(g.id);games.set(g.id,{...old,...g,...(g.syncWithSra&&old?{version:old.version,versionName:old.versionName,bannerUrl:old.bannerUrl}:{})})}const events=new Map(feed.events.filter(e=>e.sourceType!=='manual').map(e=>[e.id,e]));for(const e of manual.events){if(e.disabled)events.delete(e.id);else events.set(e.id,{...e,sourceType:'manual'})}const disabled=new Set(manual.games.filter(g=>g.disabled).map(g=>g.id));return {...feed,games:[...games.values()].filter(g=>!disabled.has(g.id)),events:[...events.values()].filter(e=>!disabled.has(e.gameId)),generatedAt:new Date().toISOString()}}
export async function requirePreview(env,email,role,data){const digest=await previewDigest(data);const row=await env.APPLICATION_DB.prepare("SELECT id FROM content_previews WHERE email=? AND role=? AND digest=? AND status='verified' AND expires_at>? LIMIT 1").bind(email,role,digest,Date.now()).first();if(!row)throw fail('请先预览并确认验证当前草稿；修改草稿后需重新验证',409)}
export const previewEndpoint=role=>endpoint(async({request,env})=>{
 const email=role==='admin'?await admin(request,env):(await member(request,env)).email,db=env.APPLICATION_DB;
 if(request.method==='POST'){
  const input=await body(request);
  if(input.action){const row=await db.prepare("SELECT * FROM content_previews WHERE id=? AND email=? AND role=? AND status='open' AND expires_at>?").bind(input.id,email,role,Date.now()).first();if(!row)throw fail('预览地址已失效',410);if(!['verify','cancel'].includes(input.action))throw fail('操作无效');if(input.action==='verify'&&Date.now()-row.created_at<10000)throw fail('请预览至少10秒',409);await db.prepare("UPDATE content_previews SET status=? WHERE id=? AND status='open'").bind(input.action==='verify'?'verified':'cancelled',row.id).run();return json({ok:true})}
  let manual,catalog;
  if(role==='admin'&&input.proposalId){const proposal=await db.prepare('SELECT proposed FROM collaborator_reviews_v79 WHERE id=?').bind(input.proposalId).first();if(!proposal)throw fail('提案不存在',404);manual=JSON.parse(proposal.proposed);catalog=(await file(env.GH_TOKEN,mainRepo(env),env.GH_BRANCH||'main','data/events.json')).data}
  else if(role==='admin'){manual=validate(input.data);catalog=(await file(env.GH_TOKEN,mainRepo(env),env.GH_BRANCH||'main','data/events.json')).data}
  else{const user=await member(request,env),draft=await db.prepare('SELECT * FROM collaborator_drafts_v79 WHERE email=?').bind(email).first();if(!draft)throw fail('请先保存草稿');catalog=JSON.parse(draft.catalog);manual=mergeScoped(JSON.parse(draft.snapshot),catalog,JSON.parse(draft.data),user.games)}
  const id=crypto.randomUUID(),now=Date.now();await db.prepare('DELETE FROM content_previews WHERE expires_at<?').bind(now).run();await db.prepare('INSERT INTO content_previews VALUES(?,?,?,?,?,?,?,?,?)').bind(id,email,role,await previewDigest(manual),JSON.stringify(previewFeed(catalog,manual)),now,now+3600000,'open').run();return json({id,url:'/'+role+'/preview.html?id='+id})
 }
 if(request.method!=='GET')return json({error:'方法不支持'},405);
 const row=await db.prepare("SELECT * FROM content_previews WHERE id=? AND email=? AND role=? AND status='open' AND expires_at>?").bind(new URL(request.url).searchParams.get('id'),email,role,Date.now()).first();if(!row)throw fail('预览地址已失效',410);
 const response=await env.ASSETS.fetch(new Request(new URL('/',request.url)));if(!response.ok)throw fail('主页预览模板读取失败',503);return json({feed:JSON.parse(row.payload),html:await response.text()});
});

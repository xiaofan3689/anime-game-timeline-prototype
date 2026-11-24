(()=>{
const $=id=>document.getElementById(id);let busy=false,games=[];
const msg=s=>{$('review-message').textContent=s};
async function api(method='GET',body){const r=await fetch('/api/admin/reviews',{method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});let b;try{b=await r.json()}catch{throw Error('/api/admin/reviews 返回非 JSON（HTTP '+r.status+'）。'+(r.status>=500?'服务端或网关执行失败，请查看 Pages Functions 日志；这不能判定为登录失败。':'请检查接口响应与 Access 会话。'))}if(!r.ok)throw Error((b.error||'请求失败')+(b.code?' ['+b.code+']':'')+(b.requestId?' 请求编号：'+b.requestId:'')+'（HTTP '+r.status+'）');return b}
async function run(fn){if(busy)return;busy=true;try{await fn()}catch(e){msg(e.message)}finally{busy=false}}
async function load(){const b=await api();games=b.games||[];$('review-list').replaceChildren();const groups={};for(const [key,title] of [['approved','已通过申请'],['refused','已拒绝申请']]){const d=document.createElement('details'),s=document.createElement('summary');s.textContent=title;d.append(s);groups[key]=d}for(const row of b.applications){const card=document.createElement('article');card.className='review-item';const h=document.createElement('h3');h.textContent=row.email;const p=document.createElement('p');p.textContent='GitHub：'+(row.has_github?'有':'无')+' · '+(row.username||'未提供')+' · '+row.status;card.append(h,p);
if(row.reactivation_reason){
 const heading=document.createElement('h4'),reason=document.createElement('p');
 heading.textContent='恢复维护权限申请理由';reason.textContent=row.reactivation_reason;
 reason.style.whiteSpace='pre-wrap';reason.style.overflowWrap='anywhere';card.append(heading,reason);
}
const allLabel=document.createElement('label'),all=document.createElement('input');all.type='checkbox';allLabel.append(all,document.createTextNode('授予全部游戏（含后续新增游戏）'));card.append(allLabel);const scope=document.createElement('div');scope.className='application-game-scope';for(const g of games){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=g.id;label.append(input,document.createTextNode(g.name));scope.append(label)}
all.onchange=()=>{for(const input of scope.querySelectorAll('input')){input.checked=all.checked;input.disabled=all.checked}};if(['sent','approved'].includes(row.status)){card.append(scope);const approve=document.createElement('button');approve.textContent=row.status==='approved'?'重新发送激活邀请':'同意并发送激活邀请';approve.onclick=()=>run(async()=>{const selected=[...scope.querySelectorAll('input:checked')].map(x=>x.value);if(!selected.length)throw Error('请先选择允许维护的游戏');if(!confirm('向 '+row.email+' 发送邀请，维护范围：'+selected.join('、')+'？'))return;msg('正在处理，请勿重复点击…');const result=await api('POST',{id:row.id,action:row.status==='approved'?'resend':'approve',games:selected,allGames:all.checked});await load();msg(result.message)});card.append(approve)}
if(row.status==='sent'){const reject=document.createElement('button');reject.textContent='拒绝申请';reject.onclick=()=>{const reason=prompt('填写拒绝理由（会发送给申请人，最多500字）');if(!reason?.trim())return;run(async()=>{const result=await api('POST',{id:row.id,action:'refuse',reason:reason.trim()});await load();msg(result.message)})};const invalid=document.createElement('button');invalid.type='button';invalid.className='review-invalid-email';invalid.textContent='邮箱无效，删除申请并拒绝';
invalid.onclick=()=>run(async()=>{
 if(!confirm('将这条待审申请按邮箱无效退回？申请人会在提交申请的浏览器收到通知，确认后可以重新申请。'))return;
 msg('正在退回申请…');const result=await api('POST',{id:row.id,action:'invalid-email'});
 await load();msg(result.message);
});
const decisions=document.createElement('div');decisions.className='actions review-decisions';decisions.append(reject,invalid);card.append(decisions)}(groups[row.status]||$('review-list')).append(card)}for(const d of Object.values(groups))$('review-list').append(d);msg(b.applications.length?'已加载申请，请分配维护游戏后审批。':'暂无申请')}
$('reload-reviews').onclick=()=>run(load);run(load);
})();

;(()=>{if(document.querySelector('script[data-backend-updates]'))return;const script=document.createElement('script');script.src='/backend-updates.js?v=88';script.dataset.backendUpdates='1';document.body.append(script)})();


;(()=>{const info=document.querySelector('.editor>p');if(info)info.textContent='待审申请直接显示；已通过和已拒绝分别归档折叠。通过后发送激活邀请。普通拒绝发送邮件，邮箱无效时通过申请浏览器退回。两种处理均保留审批归档。';const nav=document.querySelector('.admin-nav');if(!nav)return;for(const [href,title] of [['/admin/collaborator-proposals.html','协作者修改审批与账号权限'],['/admin/feedback.html','用户反馈审理'],['/admin/','游戏、活动与邮件测试']]){if(nav.querySelector(`a[href="${href}"]`))continue;const a=document.createElement('a');a.href=href;a.textContent=title;nav.append(a)}})();

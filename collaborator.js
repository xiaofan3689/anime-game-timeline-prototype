(()=>{
if(window.self!==window.top||window.timelineSite?.onPublicSite||!document.getElementById('apply-collaborator'))return;
let clientId,returningBrowser=false;try{clientId=localStorage.getItem('application-client');returningBrowser=Boolean(clientId);if(!clientId){clientId=crypto.randomUUID();localStorage.setItem('application-client',clientId)}}catch{clientId=crypto.randomUUID()}
const dialog=document.createElement('dialog');dialog.className='application-dialog';dialog.setAttribute('aria-labelledby','application-dialog-title');dialog.innerHTML=`<form><h2 id="application-dialog-title">申请协作者</h2><div class="application-fields"><label>是否拥有 GitHub 账号<select name="hasGithub" required><option value="">请选择</option><option value="no">否</option><option value="yes">是</option></select></label><label hidden id="application-use">是否希望使用自己 GitHub 账号进行维护<select name="useGithub"><option value="">请选择</option><option value="no">否</option><option value="yes">是</option></select></label><label hidden id="application-user">GitHub 用户名<input name="username" maxlength="39" autocomplete="off"></label><label>回信邮箱<input name="email" type="email" required maxlength="254" autocomplete="email"></label></div><p role="status" class="application-message"></p><label id="application-reactivation" hidden>申请理由<textarea name="reason" rows="4" maxlength="500" disabled></textarea></label><div class="application-actions"><button type="button" data-cancel>取消</button><button type="submit">提交</button></div></form>`;document.body.append(dialog);
const f=dialog.querySelector('form'),message=dialog.querySelector('.application-message'),fields=dialog.querySelector('.application-fields'),actions=dialog.querySelector('.application-actions');const reasonField=dialog.querySelector('#application-reactivation'),reason=f.elements.reason;
let rememberedEmail='';try{rememberedEmail=localStorage.getItem('application-status-email')||''}catch{}
let stage='edit',busy=false,noticeId=null,acknowledgedNoticeId=null,watchNotices=false,checkingNotice=false;
try{watchNotices=Boolean(localStorage.getItem('application-submission-attempted')||localStorage.getItem('application-submitted-generation'))}catch{}
function update(){const has=f.elements.hasGithub.value==='yes';if(!has)f.elements.useGithub.value='';f.elements.useGithub.required=has;document.getElementById('application-use').hidden=!has;const use=has&&f.elements.useGithub.value==='yes';document.getElementById('application-user').hidden=!use;f.elements.username.required=use}
f.addEventListener('change',update);
function showReason(visible){reasonField.hidden=!visible;reason.disabled=!visible;reason.required=visible}
function edit(){showReason(false);dialog.querySelector('h2').textContent='申请协作者';stage='edit';fields.hidden=false;message.textContent='';f.elements.hasGithub.required=true;actions.innerHTML='<button type="button" data-cancel>取消</button><button type="submit">提交</button>';update()}
function submitted(text='您已申请提交，请勿重复提交'){showReason(false);stage='submitted';fields.hidden=true;f.elements.hasGithub.required=false;f.elements.useGithub.required=false;f.elements.username.required=false;message.textContent=text;dialog.querySelector('h2').textContent='申请协作者';actions.innerHTML='<button type="button" data-cancel>关闭</button>';if(!dialog.open)dialog.showModal()}
actions.addEventListener('click',e=>{if(e.target.hasAttribute('data-cancel')){if(stage==='confirm'||stage==='reactivate')edit();else dialog.close()}});
dialog.addEventListener('cancel',e=>{if(busy||stage==='notice')e.preventDefault()});
async function applicationStatus(){
 const r=await fetch('/api/collaborator?id='+encodeURIComponent(clientId),{cache:'no-store'}),b=await r.json();
 if(!r.ok)throw Error(b.error);return b;
}
function showNotice(notice){
 if(acknowledgedNoticeId===notice.id||(stage==='notice'&&noticeId===notice.id))return;
 submitted('管理员无法通过你填写的邮箱联系你，已退回申请。确认收到后，请使用有效邮箱重新申请。');
 stage='notice';noticeId=notice.id;
 dialog.querySelector('h2').textContent='协作者申请已退回';
 const button=document.createElement('button');button.type='button';button.textContent='我已收到';
 actions.replaceChildren(button);button.focus();
 button.onclick=async()=>{
  if(busy)return;
  busy=true;button.disabled=true;
  try{
   const r=await fetch('/api/collaborator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,action:'acknowledge-notice',noticeId})});
   if(!r.ok)throw Error('确认失败，请稍后重试。');
   watchNotices=false;
   try{
    localStorage.removeItem('application-submission-attempted');
    localStorage.removeItem('application-submitted-generation');
    localStorage.removeItem('application-status-email');
   }catch{}
   rememberedEmail='';acknowledgedNoticeId=noticeId;dialog.close();noticeId=null;f.reset();edit();
  }catch(e){message.textContent=e.message||'确认失败，请稍后重试。'}
  finally{busy=false;button.disabled=false}
 };
}
async function checkNotice(){
 if((!watchNotices&&!returningBrowser)||checkingNotice||document.hidden||busy||stage==='notice')return;
 checkingNotice=true;
 try{
  const b=await applicationStatus();returningBrowser=false;
  if(b.submitted)watchNotices=true;
  if(b.notice&&!busy)showNotice(b.notice);
 }catch{}finally{checkingNotice=false}
}
checkNotice();
document.addEventListener('visibilitychange',checkNotice);
window.addEventListener('pageshow',checkNotice);
setInterval(checkNotice,30000);
document.getElementById('apply-collaborator').onclick=async()=>{
 if(busy||stage==='notice')return;
 try{
  const b=await applicationStatus();
  if(b.notice){showNotice(b.notice);return}
  if(rememberedEmail){
   const result=await submitRequest({action:'check-email',email:rememberedEmail});
   if(result.notice){showNotice(result.notice);return}
   if(['pending','active'].includes(result.state)){submitted(result.error);return}
  }
  if(b.submitted||b.state==='active'){
   watchNotices=true;try{localStorage.setItem('application-submission-attempted','1')}catch{}
   submitted(b.state==='active'?'您已是协作者，无需反复提交':undefined);return;
  }
  f.reset();edit();f.elements.email.value=rememberedEmail;if(!dialog.open)dialog.showModal();
 }catch(e){alert(e.message||'申请服务暂不可用')}
};
async function submitRequest(payload){
 const r=await fetch('/api/collaborator',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({clientId,...payload})});
 const result=await r.json();
 if(!r.ok&&!result.notice&&!result.state)throw Error(result.error||'申请服务暂不可用');
 return result;
}
function rememberEmail(email){
 rememberedEmail=email;
 try{localStorage.setItem('application-status-email',email)}catch{}
}
function requestReason(text){
 stage='reactivate';showReason(true);fields.hidden=true;message.textContent=text;
 dialog.querySelector('h2').textContent='申请恢复维护权限';
 actions.innerHTML='<button type="button" data-cancel>返回</button><button type="submit">提交申请理由</button>';
 reason.focus();
}
f.onsubmit=async e=>{e.preventDefault();if(busy)return;if(stage==='edit'){stage='confirm';fields.hidden=true;dialog.querySelector('h2').textContent='审核说明';message.textContent='协作者审核需要时间，请申请者耐心等待，审核结果将在回信告知。请确认回信邮箱能够正常接收邮件，若通过申请我们将会在回信邮箱中告知后续事宜。';actions.innerHTML='<button type="button" data-cancel>返回</button><button type="submit">确认</button>';return}
 watchNotices=true;try{localStorage.setItem('application-submission-attempted','1')}catch{}
 busy=true;actions.querySelectorAll('button').forEach(b=>b.disabled=true);message.textContent='正在提交，请稍候…';
 try{
  const email=f.elements.email.value.trim(),reactivating=stage==='reactivate';
  const b=await submitRequest({action:reactivating?'reactivate':'submit',email,
   hasGithub:f.elements.hasGithub.value==='yes',useGithub:f.elements.useGithub.value==='yes',
   username:f.elements.username.value.trim(),reason:reactivating?reason.value:undefined});
  if(b.notice){showNotice(b.notice);return}
  if(b.state==='inactive'){requestReason(b.error);return}
  rememberEmail(email);
  if(b.ok){
   submitted(reactivating?'恢复权限申请已提交，请等待管理员审批。':'申请已提交，请留意回信邮箱。');
   return;
  }
  submitted(b.error);
 }catch(e){message.textContent=e.message||'提交失败'}
 finally{busy=false;actions.querySelectorAll('button').forEach(b=>b.disabled=false)}
};
})();

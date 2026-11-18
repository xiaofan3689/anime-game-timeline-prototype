(()=>{
 const button=document.createElement('button');button.type='button';button.textContent='建议反馈';document.querySelector('.top-actions').append(button);
 const dialog=document.createElement('dialog');dialog.className='feedback-dialog';dialog.setAttribute('aria-labelledby','feedback-title');
 dialog.innerHTML=`<form><h2 id="feedback-title">建议反馈</h2><label>反馈类别<select name="category" required><option value="">请选择</option><option>现有功能使用</option><option>未有功能需求</option><option>优化建议</option><option>其他</option></select></label><label>用户邮箱<input name="email" type="email" required maxlength="254" autocomplete="email" placeholder="请填写便于联系的邮箱"></label><p class="feedback-hint">如已登记邮件提醒，将自动填写该账号邮箱；你也可以手动填写。</p><label>反馈描述<textarea name="description" required maxlength="3000" rows="5" placeholder="请描述遇到的问题或希望增加的功能（最多3000字）"></textarea></label><p class="feedback-status" role="status" aria-live="polite"></p><div class="feedback-actions"><button type="button">取消</button><button type="submit">提交</button></div></form>`;
 document.body.append(dialog);const form=dialog.querySelector('form'),message=dialog.querySelector('.feedback-status'),cancel=form.querySelector('[type=button]'),submit=form.querySelector('[type=submit]');let id='',busy=false,revision=0;
 button.onclick=async()=>{
  if(dialog.open)return;form.reset();message.textContent='';id=crypto.randomUUID();const opening=++revision;dialog.showModal();
  const emailInput=form.elements.email;let edited=false;emailInput.oninput=()=>edited=true;
  try{const token=localStorage.getItem('timeline-email-token-v1');if(!token)return;const r=await fetch('/api/email-reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,action:'get'})});const b=await r.json();if(r.ok&&b.email&&dialog.open&&opening===revision&&!edited)emailInput.value=b.email}catch{/* Manual input remains available. */}
 };
 cancel.onclick=()=>{if(!busy)dialog.close()};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;submit.disabled=cancel.disabled=true;message.textContent='正在提交…';
  const input={id,category:form.elements.category.value,email:form.elements.email.value,description:form.elements.description.value};
  try{const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const b=await r.json();if(!r.ok)throw Error(b.error||'提交失败');message.textContent=b.message;form.elements.category.disabled=form.elements.email.disabled=form.elements.description.disabled=true;submit.hidden=true;cancel.textContent='关闭'}catch(e){message.textContent=e.message}finally{busy=false;submit.disabled=cancel.disabled=false}
 };
 dialog.addEventListener('close',()=>{revision++;form.elements.category.disabled=form.elements.email.disabled=form.elements.description.disabled=false;submit.hidden=false;cancel.textContent='取消'});
})();

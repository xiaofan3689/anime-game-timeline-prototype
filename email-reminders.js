(()=>{
 const credentialKey='timeline-email-token-v1';let token='',active=false,timer,sending=false,dirty=false;
 const button=document.createElement('button');button.type='button';button.textContent='邮件提醒';document.querySelector('.top-actions').prepend(button);
 const dialog=document.createElement('dialog');dialog.className='email-dialog';
 dialog.innerHTML=`<form><h2>邮件提醒</h2><p>提醒所选游戏中未完成、将在48小时内结束的活动。每项活动提醒一次。</p><p id="email-current"></p><label>提醒邮箱<input name="email" type="email" maxlength="254" required autocomplete="email"></label><button type="button" id="email-code">发送验证码</button><label>邮箱验证码<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code"></label><p>验证后替换原邮箱。选择游戏和完成标记会同步到服务端；关闭网页后按最后同步状态提醒。同一浏览器凭证用于管理订阅，请勿清除或分享。</p><p id="email-status" role="status" aria-live="polite"></p><div class="email-actions"><button type="button" id="email-stop">停止提醒</button><button type="button" id="email-close">关闭</button><button type="submit">提交并启用</button></div></form>`;
 document.body.append(dialog);const form=dialog.querySelector('form'),message=dialog.querySelector('#email-status'),current=dialog.querySelector('#email-current');
 function status(text){message.textContent=text;button.title=text}
 function credential(){if(token)return token;token=localStorage.getItem(credentialKey)||'';if(!/^[a-f0-9]{64}$/.test(token)){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem(credentialKey,token)}return token}
 async function api(action,extra={}){const r=await fetch('/api/email-reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:credential(),action,...extra})});const b=await r.json();if(!r.ok)throw Error(b.error||'请求失败');return b}
 function snapshot(){if(!S.feed)throw Error('活动数据尚未加载，请稍后再试');return {games:[...S.selected],completed:Object.keys(progress).filter(id=>progress[id]?.done)}}
 async function load(){const b=await api('get');active=b.active;form.elements.email.value=b.email||b.pendingEmail||'';current.textContent=b.email?`原邮箱：${b.email}（${active?'提醒已开启':'提醒已停止'}）`:'尚未设置提醒邮箱';dialog.querySelector('#email-stop').disabled=!active;return b}
 button.onclick=async()=>{dialog.showModal();status('正在读取…');try{await load();status('可修改邮箱并验证，或关闭此窗口。')}catch(e){status(e.message)}};
 dialog.querySelector('#email-close').onclick=()=>dialog.close();
 dialog.querySelector('#email-code').onclick=async e=>{if(!form.elements.email.reportValidity())return;const b=e.currentTarget;b.disabled=true;try{await api('request-code',{email:form.elements.email.value});status('验证码已交给邮件服务器，请查收，10分钟内有效。')}catch(e){status(e.message)}finally{b.disabled=false}};
 form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;try{await api('confirm',{code:form.elements.code.value,...snapshot()});await load();form.elements.code.value='';status('邮箱已保存，提醒已开启。游戏与完成状态已同步。')}catch(e){status(e.message)}finally{submit.disabled=false}};
 dialog.querySelector('#email-stop').onclick=async()=>{try{await api('stop');active=false;await load();status('已停止提醒。已保存的邮箱可查看；重新启用需验证。')}catch(e){status(e.message)}};
 async function sync(){if(!active)return;dirty=true;if(sending)return;sending=true;try{while(dirty&&active){dirty=false;await api('sync',snapshot());status('游戏选择与完成状态已同步')}}catch(e){dirty=true;status('状态同步失败：'+e.message+'；服务器暂按上次状态提醒。');clearTimeout(timer);timer=setTimeout(sync,30000)}finally{sending=false}}
 window.addEventListener('timeline-preferences-changed',()=>{clearTimeout(timer);timer=setTimeout(sync,300)});
 window.addEventListener('online',sync);window.addEventListener('focus',sync);
 window.addEventListener('storage',e=>{if(['anime-timeline-games-v1','timeline-progress-v1'].includes(e.key))location.reload()});
 // Restored subscriptions need a snapshot after the asynchronous feed is ready.
 (async()=>{try{if(!localStorage.getItem(credentialKey))return;await load();const poll=setInterval(()=>{if(S.feed){clearInterval(poll);sync()}},500);setTimeout(()=>clearInterval(poll),60000)}catch(e){button.title=e.message}})();
})();

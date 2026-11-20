(()=>{
 const credentialKey='timeline-email-token-v1';let token='',active=false,timer,sending=false,dirty=false,revision=null,refreshRequired=false,verifying=false;
 const button=document.createElement('button');button.type='button';button.textContent='邮件提醒';document.querySelector('.top-actions').prepend(button);
 const dialog=document.createElement('dialog');dialog.className='email-dialog';
 dialog.innerHTML=`<form><h2>邮件提醒</h2><p>提醒所选游戏中未完成、将在48小时内结束的活动。每项活动提醒一次。</p><p id="email-current"></p><label>邮箱账号<input name="email" type="email" maxlength="254" required autocomplete="email"></label><button type="button" id="email-code">发送验证码</button><label>邮箱验证码<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code"></label><p>验证后注册或切换邮箱账号，原账号数据保留。选择游戏和完成标记会同步到服务端；关闭网页后按最后同步状态提醒。其他浏览器验证同一邮箱后可恢复已选游戏和完成状态；凭证请勿分享。</p><p id="email-status" role="status" aria-live="polite"></p><div class="email-actions"><button type="button" id="email-stop">停止提醒</button><button type="button" id="email-close">关闭</button><button type="submit">验证并进入账号</button></div></form>`;
 document.body.append(dialog);const form=dialog.querySelector('form'),message=dialog.querySelector('#email-status'),current=dialog.querySelector('#email-current');
 function status(text){message.textContent=text;button.title=text}
 function credential(){if(token)return token;token=localStorage.getItem(credentialKey)||'';if(!/^[a-f0-9]{64}$/.test(token)){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem(credentialKey,token)}return token}
 async function api(action,extra={}){const r=await fetch('/api/email-reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:credential(),action,...extra})});const b=await r.json();if(b.conflict){restore(b);throw Error(b.error)}if(!r.ok)throw Error(b.error||'请求失败');return b}
 function newAccount(){clearCheckins();localStorage.removeItem('anime-timeline-games-v1');localStorage.setItem('timeline-progress-v1','{}');localStorage.removeItem('timeline-game-order-v1');localStorage.setItem('timeline-cn-only-v1','false');sessionStorage.setItem('timeline-new-account','1');location.reload()}
 function checkins(){const result={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('daily-checkin:')){try{result[k.slice(14)]=JSON.parse(localStorage.getItem(k))}catch{}}}return result}
 function clearCheckins(){for(const k of Object.keys(localStorage))if(k.startsWith('daily-checkin:'))localStorage.removeItem(k)}
 function snapshot(){if(!S.feed)throw Error('活动数据尚未加载，请稍后再试');return {checkins:checkins(),games:[...S.selected],completed:Object.keys(progress).filter(id=>progress[id]?.done)}}
 function restore(b){
  if(!Array.isArray(b.games)||!Array.isArray(b.completed))return;
  clearCheckins();for(const [id,days] of Object.entries(b.checkins||{}))localStorage.setItem('daily-checkin:'+id,JSON.stringify(days));
  const next=JSON.parse(localStorage.getItem('timeline-progress-v1')||'{}');
  for(const value of Object.values(next))if(value&&typeof value==='object')value.done=false;
  for(const id of b.completed)next[id]={...next[id],done:true};
  localStorage.setItem('anime-timeline-games-v1',JSON.stringify(b.games));
  localStorage.setItem('timeline-progress-v1',JSON.stringify(next));
  // Restore the shared game selection exactly; a browser-local CN filter cannot remove imported games.
  if(S.feed&&b.games.some(id=>window.timelineIsForeignGame?.(S.feed.games.find(g=>g.id===id)||{id}))){localStorage.setItem('timeline-cn-only-v1','false')}
  dialog.classList.add('email-refresh-only');
  current.textContent=`原邮箱：${b.email||form.elements.email.value}（${b.active?'提醒已开启':'提醒已停止'}）`;
  revision=b.revision;active=b.active;refreshRequired=true;dirty=false;clearTimeout(timer);
  status('已恢复此邮箱的游戏选择和完成情况，请刷新页面使所有区域同步。');
  let refresh=dialog.querySelector('#email-refresh');if(!refresh){refresh=document.createElement('button');refresh.id='email-refresh';refresh.type='button';refresh.textContent='刷新页面同步数据';refresh.onclick=()=>location.reload();form.append(refresh)}
  if(!dialog.open)dialog.showModal();
  requestAnimationFrame(()=>refresh.focus());
 }
 async function load(){const b=await api('get');active=b.active;form.elements.email.value=b.email||b.pendingEmail||'';current.textContent=b.email?`原邮箱：${b.email}（${active?'提醒已开启':'提醒已停止'}）`:'尚未设置提醒邮箱';dialog.querySelector('#email-stop').disabled=!active;return b}
 button.onclick=async()=>{dialog.showModal();status('正在读取…');try{const b=await load();if(revision!==null&&b.revision!==revision)restore(b);if(!refreshRequired)status('可修改邮箱并验证，或关闭此窗口。')}catch(e){status(e.message)}};
 dialog.querySelector('#email-close').onclick=()=>dialog.close();
 dialog.querySelector('#email-code').onclick=async e=>{if(!form.elements.email.reportValidity())return;const b=e.currentTarget;b.disabled=true;try{await api('request-code',{email:form.elements.email.value});status('验证码已交给邮件服务器，请查收，10分钟内有效。')}catch(e){status(e.message)}finally{b.disabled=false}};
 form.onsubmit=async e=>{e.preventDefault();if(refreshRequired){status('请先刷新页面再操作');return}const submit=form.querySelector('[type=submit]');submit.disabled=true;verifying=true;clearTimeout(timer);try{while(sending)await new Promise(r=>setTimeout(r,50));const b=await api('confirm',{code:form.elements.code.value,...snapshot()});active=true;revision=b.revision;form.elements.code.value='';if(b.newAccount){newAccount();return}else if(b.restored){restore(b)}else{await load();status('邮箱已保存，提醒已开启。游戏与完成状态已同步。')}}catch(e){status(e.message)}finally{verifying=false;submit.disabled=false}};
 dialog.querySelector('#email-stop').onclick=async()=>{try{await api('stop');active=false;await load();status('已停止提醒。已保存的邮箱可查看；重新启用需验证。')}catch(e){status(e.message)}};
 async function sync(){if(!active||refreshRequired||verifying)return;dirty=true;if(sending)return;sending=true;try{while(dirty&&active){dirty=false;const result=await api('sync',{...snapshot(),revision});revision=result.revision;status('游戏选择与完成状态已同步')}}catch(e){dirty=!refreshRequired;status('状态同步失败：'+e.message+'；服务器暂按上次状态提醒。');clearTimeout(timer);if(!refreshRequired)timer=setTimeout(sync,30000)}finally{sending=false}}
 window.addEventListener('timeline-preferences-changed',()=>{clearTimeout(timer);timer=setTimeout(sync,300)});
 async function pull(){if(refreshRequired||verifying||sending||dirty||!active)return;try{const b=await load();if(b.revision!==revision)restore(b)}catch(e){status(e.message)}}
 window.addEventListener('online',pull);window.addEventListener('focus',pull);setInterval(pull,30000);
 window.addEventListener('storage',e=>{if(['anime-timeline-games-v1','timeline-progress-v1'].includes(e.key))location.reload()});
 // Restored subscriptions need a snapshot after the asynchronous feed is ready.
 (async()=>{try{if(!localStorage.getItem(credentialKey))return;const b=await load();revision=b.revision;const poll=setInterval(()=>{if(S.feed){clearInterval(poll);if(sessionStorage.getItem('timeline-new-account')){sessionStorage.removeItem('timeline-new-account');status('新邮箱账号已建立，请先选择正在玩的游戏并保存。');return}if(Array.isArray(b.games)&&b.active){const local=snapshot();if(JSON.stringify(local.checkins)!==JSON.stringify(b.checkins||{})||JSON.stringify([...local.games].sort())!==JSON.stringify([...b.games].sort())||JSON.stringify([...local.completed].sort())!==JSON.stringify([...b.completed].sort()))restore(b)}}},500);setTimeout(()=>clearInterval(poll),60000)}catch(e){button.title=e.message}})();
})();

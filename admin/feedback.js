(()=>{
 const root=document.getElementById('feedback-records'),message=document.getElementById('feedback-admin-status'),reload=document.getElementById('feedback-reload'),more=document.getElementById('feedback-more');let before=null,busy=false;
 const element=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node};
 async function load(reset=false){if(busy)return;busy=true;reload.disabled=more.disabled=true;message.textContent='正在读取…';try{const r=await fetch('/api/admin/feedback'+(!reset&&before?'?offset='+before:''),{cache:'no-store'});const b=await r.json();if(!r.ok)throw Error(b.error||'读取失败');if(reset)root.replaceChildren();before=b.nextBefore;more.hidden=!before;
  for(const row of b.items){const card=element('article','');card.className='feedback-record';const heading=element('h2',row.category),email=element('p','用户填写邮箱：'+row.email),time=element('p',`提交：${new Date(row.created_at).toLocaleString('zh-CN')} · 编号：${row.id}`),description=element('p',row.description),notification=element('p','通知邮件：'+({accepted:'SMTP 已接受（不保证最终送达）',uncertain:'发送未确认，请查看记录，避免重复发信',sending:'发送中或结果尚未记录'}[row.notification]||row.notification)),label=element('label','审理状态 '),select=document.createElement('select');
   for(const [value,text] of [['pending','待审理'],['reviewing','审理中'],['resolved','已处理']])select.add(new Option(text,value));select.value=row.status;label.append(select);const result=element('p','');result.setAttribute('role','status');
   select.onchange=async()=>{select.disabled=true;try{const response=await fetch('/api/admin/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row.id,status:select.value})});const data=await response.json();if(!response.ok)throw Error(data.error||'保存失败');row.status=select.value;result.textContent='审理状态已保存（未向用户发送邮件）'}catch(e){select.value=row.status;result.textContent=e.message}finally{select.disabled=false}};
   card.append(heading,email,time,description,notification,label,result);root.append(card);
  }message.textContent=root.childElementCount?'已加载反馈，可调整审理状态。':'暂无用户反馈。';
 }catch(e){message.textContent=e.message}finally{busy=false;reload.disabled=more.disabled=false}}
 reload.onclick=()=>load(true);more.onclick=()=>load();load(true);
})();

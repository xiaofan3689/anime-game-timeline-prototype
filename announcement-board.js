const make=(tag,text)=>{
 const element=document.createElement(tag);
 if(text!==undefined)element.textContent=text;
 return element;
};
const formatDate=new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'});
const nowLabel=row=>row.expires_at===null?'长期公告':row.expires_at<=Date.now()?'已到期':'限时公告';
const isUnread=row=>row.requires_confirmation?!row.confirmed:!row.seen;

async function api(path,body){
 const response=await fetch(path,{
  method:body?'POST':'GET',cache:'no-store',
  headers:body?{'Content-Type':'application/json'}:undefined,
  body:body?JSON.stringify(body):undefined
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(Error(data.error||'公告服务暂不可用，请检查登录状态后重试。'),{status:response.status});
 return data;
}

function renderAnnouncement(row,manage,onAction){
 const item=make('article');
 item.className='announcement-item';
 const heading=make('h3',row.title);
 const metadata=make('p',nowLabel(row)+(row.expires_at===null?'':' · 截止 '+formatDate.format(row.expires_at)));
 metadata.className='announcement-meta';
 const content=make('p',row.message);
 content.className='announcement-message';
 item.append(heading,metadata,content);
 if(!manage&&!row.requires_confirmation)return item;
 const label=manage?'编辑':row.confirmed?'已确认':'确认收到';
 const button=make('button',label);
 button.type='button';
 button.disabled=!manage&&Boolean(row.confirmed);
 button.addEventListener('click',()=>onAction(row,button));
 item.append(button);
 return item;
}

const adminForm=document.getElementById('announcement-editor');
if(adminForm){
 const path='/api/admin/announcements',fields=adminForm.elements;
 const list=document.getElementById('announcement-list'),status=document.getElementById('announcement-status');
 const editorTitle=document.getElementById('announcement-editor-title');
 const expiration=document.getElementById('announcement-expiration');
 let editing=null;
 function syncType(){
  const limited=fields.kind.value==='limited';
  expiration.hidden=!limited;fields.expires.required=limited;
 }
 fields.kind.onchange=syncType;
 function fill(row){
  editing=row;adminForm.reset();
  editorTitle.textContent=row?'编辑公告':'发布公告';
  if(row){
   fields.title.value=row.title;
   fields.message.value=row.message;
   fields.confirmation.checked=Boolean(row.requires_confirmation);
   if(row.expires_at!==null){
    const date=new Date(row.expires_at);
    fields.kind.value='limited';
    fields.expires.value=new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
   }
  }
  fields.save.textContent=row?'保存修改':'发布公告';
  syncType();
 }
 async function refresh(){
  const {announcements}=await api(path);
  list.replaceChildren(...announcements.map(row=>renderAnnouncement(row,true,item=>{
   fill(item);fields.title.focus();
  })));
  if(!announcements.length)list.append(make('p','暂无公告。'));
 }
 async function load(){
  try{await refresh();status.textContent=''}catch(error){status.textContent=error.message}
 }
 fields.cancel.onclick=()=>fill(null);
 document.getElementById('announcement-refresh').onclick=load;
 adminForm.onsubmit=async event=>{
  event.preventDefault();
  if(fields.save.disabled)return;
  const expiresAt=fields.kind.value==='limited'?new Date(fields.expires.value).getTime():null;
  if(expiresAt!==null&&!Number.isFinite(expiresAt)){status.textContent='请选择有效的截止时间。';return}
  fields.save.disabled=true;
  try{
   await api(path,{id:editing?.id,revision:editing?.revision,title:fields.title.value,
    message:fields.message.value,expiresAt,requiresConfirmation:fields.confirmation.checked});
   fill(null);
   try{await refresh();status.textContent='公告已保存。'}catch{status.textContent='公告已保存。请点击刷新列表查看。'}
  }catch(error){status.textContent=error.message}
  finally{fields.save.disabled=false}
 };
 fill(null);
 load();
}

const board=document.querySelector('[data-announcement-board]');
if(board){
 const path='/api/collaborator/announcements',list=board.querySelector('[data-list]');
 const status=board.querySelector('[data-status]');
 const launcher=document.getElementById('announcement-launcher'),badge=launcher?.querySelector('[data-count]');
 const panel=launcher?board:null;
 let rows=[],signature='',reading=false,loading=false;
 const visible=()=>!document.hidden&&(!panel||!panel.hidden);

 function updateList(){
  const count=rows.filter(isUnread).length;
  if(badge){
   badge.hidden=count===0;
   badge.textContent=count>99?'99+':String(count);
   launcher.setAttribute('aria-label',count?'管理员公告，'+count+' 条未读或待确认':'管理员公告');
  }
  const next=JSON.stringify(rows);
  if(next===signature)return;
  signature=next;
  const focused=document.activeElement?.closest('[data-announcement-id]')?.dataset.announcementId;
  list.replaceChildren(...rows.map(row=>{
   const item=renderAnnouncement(row,false,confirm);
   item.dataset.announcementId=row.id;
   if(row.requires_confirmation&&!row.confirmed)item.dataset.confirmationPending='';
   if(focused===row.id)queueMicrotask(()=>{(item.querySelector('button:not(:disabled)')||status).focus()});
   return item;
  }));
  if(!rows.length)list.append(make('p','当前没有公告。'));
 }

 async function confirm(row,button){
  button.disabled=true;
  try{
   await api(path,{id:row.id,revision:row.revision,action:'confirm'});
   row.confirmed=1;row.seen=1;updateList();
   status.textContent='已确认收到。';status.focus();
  }catch(error){
   button.disabled=false;
   status.textContent=error.message;
   if(error.status===409)await refresh();
  }
 }

 async function recordSeen(){
  if(!visible()||reading)return;
  const unread=rows.filter(row=>!row.requires_confirmation&&!row.seen);
  if(!unread.length)return;
  reading=true;
  await Promise.allSettled(unread.map(async row=>{
   await api(path,{id:row.id,revision:row.revision,action:'seen'});
   const current=rows.find(item=>item.id===row.id&&item.revision===row.revision);
   if(current)current.seen=1;
  }));
  reading=false;
  updateList();
 }

 async function refresh(){
  if(document.hidden||loading)return;
  loading=true;
  try{
   const {announcements}=await api(path);
   rows=announcements;updateList();status.textContent='';
  }catch(error){
   if(!panel||!panel.hidden)status.textContent=error.message;
  }finally{loading=false}
  await recordSeen();
 }

 if(panel){
  const close=panel.querySelector('[data-close]');
  const setOpen=open=>{
   panel.hidden=!open;launcher.hidden=open;launcher.setAttribute('aria-expanded',String(open));
   (open?close:launcher).focus();
   if(open){void recordSeen();void refresh()}
  };
  launcher.onclick=()=>setOpen(true);
  close.onclick=()=>setOpen(false);
  panel.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.stopPropagation();setOpen(false)}
  });
 }
 document.addEventListener('visibilitychange',refresh);
 setInterval(refresh,30000);
 refresh();
}

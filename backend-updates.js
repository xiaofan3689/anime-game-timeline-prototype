(()=>{
 if(window.__backendUpdates)return;window.__backendUpdates=true;
 const toolbar=document.createElement('aside');toolbar.className='backend-update-bar';
 const text=document.createElement('span');text.textContent='页面更新检测已开启';text.setAttribute('role','status');
 const button=document.createElement('button');button.type='button';button.textContent='强制刷新';toolbar.append(text,button);document.body.prepend(toolbar);
 const style=document.createElement('style');style.textContent='.backend-update-bar{position:sticky;top:0;z-index:10000;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;background:#252238;color:#eee;border-bottom:1px solid #8274ae;font-size:13px}.backend-update-bar button{flex-shrink:0;min-height:38px;padding:7px 12px;cursor:pointer}.backend-update-bar.has-update{background:#513a20}.backend-update-bar span{overflow-wrap:anywhere}@media(max-width:680px){.backend-update-bar{font-size:12px;padding:8px;gap:6px}}';document.head.append(style);
 const page=new URL(location.href);page.hash='';page.searchParams.delete('_backend_refresh');
 const resources=()=>[...new Set([...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')].map(e=>new URL(e.src||e.href,location.href).href).filter(u=>new URL(u).origin===location.origin))];
 const initialResources=resources();let baseline=null,checking=false,changed=false,refreshing=false;
 const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 async function read(url,cache){const response=await fetch(url,{cache,credentials:'same-origin',signal:AbortSignal.timeout(12000)});if(!response.ok||response.redirected)throw Error('资源请求失败或登录已过期');const mime=response.headers.get('content-type')||'';if(url!==page.href&&mime.includes('text/html'))throw Error('资源返回登录页面');return response.text()}
 const handlers=new Map();
 window.backendHotUpdate={register(path,handler){if(!path.startsWith('/')||typeof handler?.apply!=='function'||typeof handler?.rollback!=='function')throw Error('热更模块必须提供 apply 和 rollback');handlers.set(path,handler);return ()=>{if(handlers.get(path)===handler)handlers.delete(path)}}};
 async function hotApply(previous,next){
  if(!previous.files||!next.files)return false;
  const paths=[...new Set([...Object.keys(previous.files),...Object.keys(next.files)])].filter(path=>previous.files[path]!==next.files[path]);
  if(!paths.length)return true;
  // Plan the whole update before touching the page. HTML and unregistered JS require reload.
  const links=[],modules=[];
  for(const path of paths){
   if(!next.files[path])return false;
   if(path.endsWith('.css')){const old=[...document.querySelectorAll('link[rel="stylesheet"][href]')].filter(link=>new URL(link.href,location.href).pathname===path);if(!old.length)return false;for(const link of old)links.push({link,path})}
   else if(handlers.has(path))modules.push({path,handler:handlers.get(path)});
   else return false;
  }
  const staged=[],applied=[];
  try{
   for(const {link,path} of links){const copy=link.cloneNode();const url=new URL(link.href,location.href);url.searchParams.set('_hot',next.files[path]);copy.href=url.href;copy.media='not all';staged.push({old:link,copy});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('样式加载超时')),15000);copy.onload=()=>{clearTimeout(timer);resolve()};copy.onerror=()=>{clearTimeout(timer);reject(Error('样式加载失败'))};link.after(copy)})}
   for(const {path,handler} of modules){const context={path,version:next.files[path],previous:previous.files[path],url:path+'?_hot='+next.files[path]};const state=await handler.prepare?.(context);const entry={handler,context,state};applied.push(entry);await handler.apply(context,state)}
   for(const {old,copy} of staged){copy.media=old.media;old.remove()}
   window.dispatchEvent(new CustomEvent('backend:hot-updated',{detail:{paths,version:next.version}}));
   return true;
  }catch(error){for(const {handler,context,state} of applied.reverse()){try{await handler.rollback(context,state)}catch{}}for(const {copy} of staged)copy.remove();console.warn('后台热更未完成，请保存后刷新');return false}
 }

 async function snapshot(){const role=location.pathname.startsWith('/admin/')?'admin':'collaborator';const response=await fetch('/api/'+role+'/page-version?page='+encodeURIComponent(page.pathname),{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error(data.error||'源码检测失败');if(!/^[a-f0-9]{64}$/.test(data.version||''))throw Error('源码版本无效');return data}
 async function check(){if(checking||changed||refreshing||document.hidden||!navigator.onLine)return;checking=true;try{if(!baseline){baseline=await snapshot();text.textContent='已开始监测 GitHub 对应页面源码提交';return}const latest=await snapshot();if(latest.version!==baseline.version){if(await hotApply(baseline,latest)){baseline=latest;text.textContent='页面已自动更新，编辑内容已保留';return}changed=true;toolbar.classList.add('has-update');text.textContent='本次更新无法自动应用，请先保存草稿，再点击强制刷新。'}else if(latest.repositoryVersion&&latest.repositoryVersion!==baseline.repositoryVersion){text.textContent='GitHub 已有相关源码提交，等待正式部署或核对提交内容；稍后自动重查。';toolbar.classList.add('has-update')}else text.textContent='监测中：暂未发现相关源码新提交'}catch(e){text.textContent='更新检测失败：'+e.message+'；可手动强制刷新。'}finally{checking=false}}
 button.onclick=async()=>{
  if(refreshing)return;if(!confirm('刷新可能丢失未保存的表单内容。请先保存草稿，确认现在强制刷新？'))return;
  refreshing=true;button.disabled=true;text.textContent='正在重新获取页面资源…';
  try{
   // Discover newly deployed dependencies as well as resources used by this open page.
   const html=await read(page.href,'reload'),doc=new DOMParser().parseFromString(html,'text/html');
   const next=[...doc.querySelectorAll('script[src],link[rel="stylesheet"][href]')].map(e=>new URL(e.getAttribute('src')||e.getAttribute('href'),page).href).filter(u=>new URL(u).origin===location.origin);
   for(const url of new Set([...resources(),...next]))await read(url,'reload');
   const destination=new URL(location.href);destination.searchParams.set('_backend_refresh',Date.now());location.replace(destination.href);
  }catch{refreshing=false;button.disabled=false;text.textContent='刷新未完成，请检查网络或重新登录后重试；电脑也可按 Ctrl+F5。'}
 };
 check();setInterval(check,90000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});window.addEventListener('online',check);
})();

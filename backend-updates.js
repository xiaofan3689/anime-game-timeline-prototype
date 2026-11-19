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
 async function snapshot(cache){const files=[page.href,...initialResources];const values=[];for(const url of files)values.push(await digest(await read(url,cache)));return values.join(':')}
 async function check(){if(checking||changed||refreshing||document.hidden||!navigator.onLine)return;checking=true;try{if(!baseline){baseline=await snapshot('force-cache')}const latest=await snapshot('no-cache');if(latest!==baseline){changed=true;toolbar.classList.add('has-update');text.textContent='检测到后台页面更新。请先保存草稿，再点击强制刷新。'}else text.textContent='页面已是最新版本'}catch{text.textContent='暂时无法检查更新，请检查网络或登录状态；可手动强制刷新。'}finally{checking=false}}
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

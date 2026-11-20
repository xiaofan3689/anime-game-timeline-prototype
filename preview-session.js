;(()=>{const l=document.createElement('link');l.rel='stylesheet';l.href='/preview-dialog.css?v=101';document.head.append(l)})();
function previewBootstrap(feed,id,siteOrigin){
 Object.defineProperty(window,"__PREVIEW_ORIGIN__",{value:siteOrigin});
 const reportError=e=>parent.postMessage({type:'draft-preview-error',id,message:String(e.message||e.reason?.message||'脚本或资源加载失败').slice(0,300)},'*');window.addEventListener('error',reportError);window.addEventListener('unhandledrejection',reportError);const memory={};
 Object.defineProperty(window,'localStorage',{value:{getItem:k=>k==='anime-timeline-games-v1'?JSON.stringify(feed.games.map(g=>g.id)):memory[k]||null,setItem:(k,v)=>memory[k]=String(v),removeItem:k=>delete memory[k]}});
 Object.defineProperty(window,'sessionStorage',{value:{getItem:k=>memory['session:'+k]||null,setItem:(k,v)=>memory['session:'+k]=String(v),removeItem:k=>delete memory['session:'+k]}});
 window.fetch=async input=>{const raw=typeof input==='string'?input:input.url;let target;try{target=new URL(raw,siteOrigin+'/')}catch{throw Error('预览请求地址无效')};const path=target.pathname;if(path==='/data/events.json')return new Response(JSON.stringify(feed),{headers:{'Content-Type':'application/json'}});throw Error('预览禁止正式数据请求和账号操作')};
 let ready=false;function report(){if(ready)return;ready=true;parent.postMessage({type:'draft-preview-ready',id},'*')}
 window.addEventListener('timeline-feed-updated',report,{once:true});
 window.addEventListener('load',()=>{if(document.querySelector('#timeline .timeline-board,#timeline .empty'))report()});
}
async function buildPreviewHTML(html,feed,id){
 const doc=new DOMParser().parseFromString(html,'text/html');
 doc.querySelectorAll('base').forEach(e=>e.remove());const base=doc.createElement('base');base.href=location.origin+'/';
 const script=doc.createElement('script');script.textContent='('+previewBootstrap.toString()+')('+JSON.stringify(feed).replace(/</g,()=>String.fromCharCode(92)+'u003c')+','+JSON.stringify(id)+','+JSON.stringify(location.origin)+');';
 const sources=[...doc.querySelectorAll('script')];const scripts=[];
 for(const old of sources){const src=old.getAttribute('src');if(src&&(/cdn-cgi\/|cloudflareinsights|rocket-loader/.test(src))){old.remove();continue}const type=old.getAttribute('type');if(type&& !['text/javascript','application/javascript','text/rocketscript','module'].includes(type))continue;
 const copy=doc.createElement('script');if(type==='module')throw Error('预览尚不支持此页面的模块脚本，请检查首页资源');if(src){const url=new URL(src,location.origin+'/');if(url.origin!==location.origin)throw Error('预览外部脚本需要适配：'+url.hostname);const response=await fetch(url,{cache:'no-store'});if(!response.ok||response.redirected||(response.headers.get('content-type')||'').includes('text/html'))throw Error('预览脚本读取失败：'+url.pathname);copy.textContent=await response.text()}else copy.textContent=old.textContent;old.remove();scripts.push(copy)}
 for(const copy of scripts)doc.body.append(copy);
 doc.head.prepend(base,script);return '<!doctype html>'+doc.documentElement.outerHTML;
}
(()=>{
 const role=location.pathname.split('/')[1],id=new URL(location.href).searchParams.get('id'),api='/api/'+role+'/preview',frame=document.querySelector('iframe'),dialog=document.querySelector('dialog'),status=document.querySelector('#status');let timer,elapsed=0,finishing=false;
 async function jsonRequest(options){const r=await fetch(api+(options?'':'?id='+encodeURIComponent(id)),options||{cache:'no-store'});let b;try{b=await r.json()}catch{throw Error('预览接口返回非 JSON（HTTP '+r.status+'），请检查登录和接口部署')}if(!r.ok)throw Error(b.error||'预览请求失败');return b}
 async function finish(action){if(finishing)return;finishing=true;try{await jsonRequest({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action})});clearInterval(timer);frame.remove();dialog.close();status.textContent=action==='verify'?'已验证，预览网址已失效。请回编辑页提交。':'预览网址已失效。请回编辑页修改。';window.close()}catch(e){status.textContent=e.message}finally{finishing=false}}
 function start(){elapsed=0;clearInterval(timer);timer=setInterval(()=>{if(document.hidden)return;if(++elapsed>=10){clearInterval(timer);dialog.showModal()}},1000)}
 document.querySelector('#more').onclick=()=>{dialog.close();start()};document.querySelector('#back').onclick=()=>finish('cancel');document.querySelector('#verify').onclick=()=>finish('verify');
 window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.data?.id!==id)return;if(event.data?.type==='draft-preview-error'){status.textContent='预览脚本错误：'+event.data.message;clearInterval(timer);return}if(event.data?.type!=='draft-preview-ready')return;status.textContent='草稿已加载，前台预览10秒后确认。';start()},{once:false});
 if(!id){status.textContent='缺少预览编号，请返回编辑页重新创建。';return}
 jsonRequest().then(async b=>{frame.srcdoc=await buildPreviewHTML(b.html,b.feed,id);status.textContent='正在加载草稿主页；尚未开始计时。'}).catch(e=>{status.textContent=e.message});
})();

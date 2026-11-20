;(()=>{const l=document.createElement('link');l.rel='stylesheet';l.href='/preview-dialog.css?v=101';document.head.append(l)})();
(()=>{
 const role=location.pathname.startsWith('/admin/')?'admin':'collaborator';let busy=false;
 window.launchContentPreview=async data=>{
  if(busy)return;busy=true;
  try{
   const r=await fetch('/api/'+role+'/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data||{})});
   let b;try{b=await r.json()}catch{throw Error('预览接口返回非 JSON（HTTP '+r.status+'），请检查 Access 登录及部署')}
   if(!r.ok)throw Error(b.error||'创建预览失败');
   const url=new URL(b.url,location.origin);if(url.origin!==location.origin||!url.pathname.startsWith('/'+role+'/preview'))throw Error('预览地址无效');
   document.getElementById('preview-ready')?.remove();
   const dialog=document.createElement('dialog');dialog.id='preview-ready';const text=document.createElement('p');text.textContent='草稿预览已准备好，请点击下方链接打开新窗口。';
   const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener';link.textContent='进入草稿预览';link.style.cssText='display:block;padding:12px;background:#655596;color:white';
   const close=document.createElement('button');close.type='button';close.textContent='暂不进入';close.onclick=()=>dialog.close();link.onclick=()=>dialog.close();dialog.append(text,link,close);document.body.append(dialog);dialog.showModal();
  }finally{busy=false}
 };
})();

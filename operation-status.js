(()=>{
 window.__operationStatusDispose?.();
 const status=document.getElementById('status');if(!status)return;
 let dock=document.getElementById('backend-top-dock');if(!dock){dock=document.createElement('div');dock.id='backend-top-dock';document.body.prepend(dock)}
 let spacer=document.getElementById('backend-top-spacer');if(!spacer){spacer=document.createElement('div');spacer.id='backend-top-spacer';document.body.prepend(spacer)}
 let style=document.getElementById('operation-status-style');if(!style){style=document.createElement('style');style.id='operation-status-style';document.head.append(style)}
 style.textContent='#backend-top-dock{position:fixed;inset:0 0 auto;z-index:10000;background:#252238;box-shadow:0 4px 16px #0006;max-height:35vh;overflow:auto}#backend-top-dock #status{position:static!important;margin:0!important;padding:12px 18px!important;background:#302943;color:#eee8ff;border-bottom:1px solid #796895;overflow-wrap:anywhere}#backend-top-dock .backend-update-bar{position:static!important;z-index:auto!important;margin:0}#backend-top-dock #status:empty{display:none}';
 status.removeAttribute('style');status.setAttribute('role','status');status.setAttribute('aria-live','polite');dock.append(status);
 const sync=()=>{document.querySelectorAll('.backend-update-bar').forEach(bar=>{if(bar.parentElement!==dock)dock.append(bar)});status.hidden=!status.textContent.trim();spacer.style.height=dock.offsetHeight+'px'};
 const mutations=new MutationObserver(sync);mutations.observe(document.body,{childList:true,subtree:true,characterData:true});const resize=new ResizeObserver(()=>{spacer.style.height=dock.offsetHeight+'px'});resize.observe(dock);sync();
 window.__operationStatusDispose=()=>{mutations.disconnect();resize.disconnect()};
})();
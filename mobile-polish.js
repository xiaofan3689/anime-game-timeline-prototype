(()=>{
 const source=document.querySelector('.anime-scene img'),header=document.querySelector('.topbar');if(!source||!header)return;
 const banner=document.createElement('div');banner.className='mobile-game-banner';banner.hidden=true;
 const image=document.createElement('img');image.alt='当前游戏背景';image.decoding='async';banner.append(image);header.after(banner);
 let current='';
 function sync(){const next=source.getAttribute('src')||'';if(next===current)return;current=next;banner.hidden=true;if(next){image.src=next}else image.removeAttribute('src')}
 image.onload=()=>{banner.hidden=false};image.onerror=()=>{banner.hidden=true};
 new MutationObserver(sync).observe(source,{attributes:true,attributeFilter:['src']});sync();
})();

(()=>{
 const header=document.querySelector('.topbar');if(!header)return;
 const gallery=document.createElement('section');gallery.className='mobile-gallery';gallery.setAttribute('aria-label','游戏展览区');
 const title=document.createElement('h2');title.textContent='游戏展览区';const track=document.createElement('div');track.className='mobile-gallery-track';track.tabIndex=0;track.setAttribute('aria-label','已选游戏图片，可左右滑动');gallery.append(title,track);(document.querySelector('.hero') || header).after(gallery);
 let signature='',index=0,touch=false;
 function draw(){
  const games=(S.feed?.games||[]).filter(g=>S.selected.has(g.id)&&url(g.bannerUrl));const next=JSON.stringify(games.map(g=>[g.id,g.name,g.bannerUrl]));if(next===signature)return;signature=next;track.replaceChildren();index=0;gallery.hidden=!games.length;
  for(const game of games){const slide=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=url(game.bannerUrl);img.alt=game.name;img.decoding='async';caption.textContent=game.name;img.onerror=()=>{img.hidden=true;caption.textContent=game.name+' · 图片暂不可用'};slide.append(img,caption);track.append(slide)}track.scrollLeft=0;
 }
 track.addEventListener('pointerdown',()=>touch=true);window.addEventListener('pointerup',()=>touch=false);window.addEventListener('pointercancel',()=>touch=false);
 track.addEventListener('scroll',()=>{index=Math.round(track.scrollLeft/Math.max(1,track.clientWidth))},{passive:true});
 track.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const count=track.children.length;if(!count)return;index=(index+(e.key==='ArrowRight'?1:-1)+count)%count;track.scrollTo({left:index*track.clientWidth,behavior:'smooth'})});
 setInterval(()=>{const count=track.children.length;if(document.hidden||touch||!matchMedia('(max-width:680px)').matches||count<2)return;index=(index+1)%count;track.scrollTo({left:index*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'})},10000);
 const previous=render;render=function(){previous();draw()};draw();
})();

(()=>{
 const frozen=document.createElement('div');frozen.className='timeline-frozen-dates';frozen.hidden=true;frozen.setAttribute('aria-hidden','true');document.body.append(frozen);
 let source=null,frame=0;
 function update(){frame=0;const scroll=document.querySelector('#timeline .timeline-scroll'),head=scroll?.querySelector('.date-head');if(!head){frozen.hidden=true;source=null;return}const r=scroll.getBoundingClientRect(),h=head.getBoundingClientRect().height;if(r.top>=0||r.bottom<=0||!h){frozen.hidden=true;return}if(source!==head){source=head;frozen.replaceChildren(head.cloneNode(true))}frozen.hidden=false;frozen.style.left=r.left+'px';frozen.style.top=Math.min(0,r.bottom-h)+'px';frozen.style.width=r.width+'px';frozen.style.height=h+'px';const copy=frozen.firstElementChild;copy.style.width=head.scrollWidth+'px';copy.style.transform=`translateX(${-scroll.scrollLeft}px)`}
 function schedule(){if(!frame)frame=requestAnimationFrame(update)}
 window.addEventListener('scroll',schedule,{passive:true,capture:true});window.addEventListener('resize',schedule,{passive:true});new MutationObserver(schedule).observe(document.getElementById('timeline'),{childList:true,subtree:true});schedule();
})();

document.querySelectorAll('.admin-fold-toggle').forEach(button=>{
 const list=document.getElementById(button.getAttribute('aria-controls'));if(!list)return;
 button.onclick=()=>{const expanded=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!expanded));list.hidden=expanded;button.querySelector('span').textContent=expanded?' ▸':' ▾'};
});

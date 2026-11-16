(() => {
 const button=document.createElement("button");
 button.type="button";button.className="back-to-top";button.textContent="↑ 顶部";button.setAttribute("aria-label","回到网站顶部");button.hidden=true;document.body.append(button);
 let returning=false;
 const threshold=()=>Math.max(400,window.innerHeight);
 const update=()=>{if(returning&&window.scrollY<=1)returning=false;button.hidden=returning||window.scrollY<threshold()};
 button.addEventListener("click",()=>{returning=true;button.hidden=true;window.scrollTo({top:0,left:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"})});
 // User input cancels suppression if they interrupt the trip to the top.
 const interrupt=()=>{if(returning){returning=false;update()}};
 window.addEventListener("wheel",interrupt,{passive:true});window.addEventListener("touchstart",interrupt,{passive:true});window.addEventListener("keydown",event=>{if(["ArrowDown","ArrowUp","PageDown","PageUp","Home","End"," "].includes(event.key))interrupt()});
 window.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update);update();
})();

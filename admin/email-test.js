(()=>{
 const button=document.getElementById('send-test-email'),status=document.getElementById('test-email-status');
 button.onclick=async()=>{
  button.disabled=true;status.textContent='正在检索并发送…';
  try{
   const token=localStorage.getItem('timeline-email-token-v1');if(!token)throw Error('请先返回首页，在同一浏览器中通过“邮件提醒”验证收件邮箱。');
   const games=JSON.parse(localStorage.getItem('anime-timeline-games-v1')||'[]');
   const progress=JSON.parse(localStorage.getItem('timeline-progress-v1')||'{}');
   const completed=Object.keys(progress).filter(id=>progress[id]?.done);
   const response=await fetch('/api/admin/email-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,games,completed})});
   const body=await response.json();if(!response.ok)throw Error(body.error||`HTTP ${response.status}`);
   status.textContent=body.message;
  }catch(e){status.textContent=e.message}finally{button.disabled=false}
 };
})();

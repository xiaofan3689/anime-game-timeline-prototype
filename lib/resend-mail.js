const address=/^[^\s<>,@]+@[^\s<>,@]+\.[a-zA-Z]{2,}$/;

export function requireMailConfig(env){
 const apiKey=(env.RESEND_API_KEY||'').trim();
 const from=(env.RESEND_FROM_EMAIL||'').trim();
 if(!apiKey||!address.test(from))throw Error('RESEND_CONFIG');
 return {apiKey,from};
}

export async function sendMail(env,text,recipient=env.APPLICATION_NOTIFY_EMAIL||env.ADMIN_EMAIL||'',subject='次元时刻：协作者申请'){
 const {apiKey,from}=requireMailConfig(env);
 recipient=recipient.trim();
 if(!address.test(recipient))throw Error('RESEND_RECIPIENT');
 let response;
 try{
  response=await fetch('https://api.resend.com/emails',{
   method:'POST',
   headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
   body:JSON.stringify({from:'次元时刻 <'+from+'>',to:[recipient],subject,text}),
   signal:AbortSignal.timeout(15000)
  });
 }catch{
  console.error('resend_request_failed');
  throw Error('RESEND_NETWORK');
 }
 const result=await response.json().catch(()=>null);
 if(!response.ok||typeof result?.id!=='string'||!result.id){
  console.error('resend_response_failed',{status:response.status});
  throw Error('RESEND_HTTP_'+response.status);
 }
 return result.id;
}

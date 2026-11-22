import { connect } from 'cloudflare:sockets';
const encode=value=>{const bytes=new TextEncoder().encode(value);let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text)};
export async function sendApplicationMail(env,text,recipient=env.APPLICATION_NOTIFY_EMAIL || env.ADMIN_EMAIL || "",subject="次元时刻：协作者申请"){
 if(!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(recipient))throw Error('SMTP_RECIPIENT');
 const user=(env.QQ_SMTP_USER||'').trim();
 if(!/^[a-zA-Z0-9._+-]+@qq\.com$/i.test(user)||!env.QQ_SMTP_AUTH_CODE)throw Error('SMTP_CONFIG');
 const socket=connect({hostname:'smtp.qq.com',port:465},{secureTransport:'on'});
 socket.closed.catch(()=>{});
 const reader=socket.readable.getReader(),writer=socket.writable.getWriter();
 const decoder=new TextDecoder();let buffer='',accepted=false;
 const timer=setTimeout(()=>{socket.close().catch(()=>{})},20000);
 const write=value=>writer.write(new TextEncoder().encode(value));
 async function response(codes){
  let count=0;
  while(true){
   let end=buffer.indexOf('\r\n');
   if(end<0){const chunk=await reader.read();if(chunk.done)throw Error('SMTP_CLOSED');buffer+=decoder.decode(chunk.value,{stream:true});if(buffer.length>65536)throw Error('SMTP_RESPONSE');continue}
   const line=buffer.slice(0,end);buffer=buffer.slice(end+2);if(++count>100)throw Error('SMTP_RESPONSE');
   const match=/^(\d{3})([ -])/.exec(line);if(!match)throw Error('SMTP_RESPONSE');
   if(match[2]==='-')continue;
   const code=Number(match[1]);if(!codes.includes(code))throw Error('SMTP_'+code);return;
  }
 }
 async function command(value,codes){await write(value+'\r\n');await response(codes)}
 try{
  await response([220]);await command('EHLO timeline.local',[250]);
  await command('AUTH LOGIN',[334]);await command(encode(user),[334]);await command(encode(env.QQ_SMTP_AUTH_CODE.trim()),[235]);
  await command('MAIL FROM:<'+user+'>',[250]);await command('RCPT TO:<'+recipient+'>',[250,251]);await command('DATA',[354]);
  const body=encode(text).match(/.{1,76}/g).join('\r\n');
  const mail=['From: <'+user+'>','To: <'+recipient+'>','Subject: =?UTF-8?B?'+encode(subject)+'?=','Date: '+new Date().toUTCString(),'Message-ID: <'+crypto.randomUUID()+'@qq.com>','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',body].join('\r\n');
  await write(mail+'\r\n.\r\n');await response([250]);accepted=true;
  // Acceptance is final: a QUIT/disconnect failure must not turn success into a retry.
 }finally{clearTimeout(timer);reader.releaseLock();writer.releaseLock();await socket.close().catch(()=>{})}
 return accepted;
}

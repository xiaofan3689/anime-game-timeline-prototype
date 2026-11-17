const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
export async function onRequest({request,env}){
 if(!env.APPLICATION_DB)return reply({error:"申请服务尚未配置数据库，请联系管理员"},503);
 const url=new URL(request.url);
 if(request.method==="GET"){
 const generation=(await env.APPLICATION_DB.prepare("SELECT value FROM application_settings WHERE key='generation'").first())?.value||'1';
 const id=url.searchParams.get('id')||'';
 const row=await env.APPLICATION_DB.prepare("SELECT status FROM collaborator_applications WHERE generation=? AND client_id=?").bind(generation,id).first();
 return reply({submitted:!!row,generation});
 }
 if(request.method!=="POST")return reply({error:"方法不支持"},405);
 if(request.headers.get('Origin')!==url.origin)return reply({error:"来源无效"},403);
 if(!env.RESEND_API_KEY||!env.APPLICATION_FROM)return reply({error:"申请邮件尚未配置，请联系管理员"},503);
 if(Number(request.headers.get('Content-Length'))>4096)return reply({error:"内容过长"},413);
 try{
 const raw=await request.text();if(raw.length>4096)return reply({error:"内容过长"},413);const b=JSON.parse(raw);
 if(!/^[a-zA-Z0-9-]{20,80}$/.test(b.clientId)||typeof b.hasGithub!=='boolean'||typeof b.useGithub!=='boolean'||!/^\S+@\S+\.\S+$/.test(b.email||'')||b.email.length>254)return reply({error:"请填写有效回信邮箱"},400);
 if(b.useGithub&&!b.hasGithub)return reply({error:"选项不一致"},400);
 if(b.useGithub&&!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(b.username||''))return reply({error:"请填写有效 GitHub 用户名"},400);
 const generation=(await env.APPLICATION_DB.prepare("SELECT value FROM application_settings WHERE key='generation'").first())?.value||'1';
 const email=b.email.trim().toLowerCase();const id=crypto.randomUUID();
 const result=await env.APPLICATION_DB.prepare("INSERT OR IGNORE INTO collaborator_applications (id,generation,client_id,email,has_github,use_github,username,status,created_at) VALUES (?,?,?,?,?,?,?,'pending',?)").bind(id,generation,b.clientId,email,+b.hasGithub,+b.useGithub,b.useGithub?b.username:'',new Date().toISOString()).run();
 if(!result.meta.changes)return reply({error:"您已申请提交，请勿重复提交"},409);
 try{
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'application-'+id},body:JSON.stringify({from:env.APPLICATION_FROM,to:['xiaofan3689@qq.com'],subject:'次元时刻：协作者申请',text:`回信邮箱：${email}\n拥有 GitHub：${b.hasGithub?'是':'否'}\n本人账号维护：${b.useGithub?'是':'否'}\nGitHub 用户名：${b.useGithub?b.username:'未提供'}\n申请编号：${id}`})});
 if(!r.ok)throw Error('send');
 }catch{await env.APPLICATION_DB.prepare('DELETE FROM collaborator_applications WHERE id=?').bind(id).run();return reply({error:"邮件发送失败，请稍后重试"},502)}
 await env.APPLICATION_DB.prepare("UPDATE collaborator_applications SET status='sent' WHERE id=?").bind(id).run();return reply({ok:true});
 }catch{return reply({error:"申请处理失败，请稍后重试"},500)}
}

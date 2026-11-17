import {authorize} from './manual.js';
export async function onRequestPost(context){
 if(!await authorize(context))return new Response('无管理员权限',{status:403});
 if(!context.env.APPLICATION_DB)return new Response('申请数据库未配置',{status:503});
 await context.env.APPLICATION_DB.batch([
 context.env.APPLICATION_DB.prepare('DELETE FROM collaborator_applications'),
 context.env.APPLICATION_DB.prepare("INSERT OR REPLACE INTO application_settings (key,value) VALUES ('generation',?)").bind(crypto.randomUUID())]);
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}

import {admin,json,body,endpoint,audit} from '../../../lib/collaborator-auth.js';
import {requirePreview} from '../../../lib/content-preview.js';
import {validate} from '../../../lib/collaborator-data.js';
import {baseline} from '../../../lib/collaborator-github.js';
import {createDataPR} from '../../../lib/github-data-pr.js';
// Preserve the authorize export used by existing admin APIs.
export async function authorize(ctx){try{await admin(ctx.request,ctx.env);return true}catch{return false}}
export const onRequest=endpoint(async({request,env})=>{
 const actor=await admin(request,env);
 if(request.method==='GET'){const base=await baseline(env);return json({sha:base.fileSha,data:base.data})}
 if(request.method!=='PUT')return json({error:'方法不支持'},405);
 const input=await body(request);if(!/^[a-f0-9]{40}$/.test(input.sha||''))throw Error('缺少文件版本，请刷新');
 await requirePreview(env,actor,'admin',validate(input.data));const result=await createDataPR(env,{path:'data/manual.json',data:validate(input.data),expectedFileSha:input.sha,title:'Administrator manual data proposal',branchPrefix:'admin-data'});
 await audit(env,actor,null,'administrator-pr',result.prUrl||'unchanged');
 return json({ok:true,sha:result.sha,commitUrl:result.prUrl||'',syncTriggered:false,warning:result.unchanged?'数据没有变化':(result.merged?'管理员提交已自动审核并合并；正式页面需等待活动同步与部署。'+(result.cleanupWarning||''):'已创建PR，请核对GitHub状态。')});
});


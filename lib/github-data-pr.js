import {gh,repoPath,mainRepo,baseline,encodeText,file} from './collaborator-github.js';
import {robot} from './github-app-installation.js';
import {fail} from './collaborator-auth.js';
import {canonical} from './collaborator-data.js';
export async function createDataPR(env,{path,data,expectedFileSha,expectedBase,title,branchPrefix='data'}){
 if(!['data/manual.json','data/events.json'].includes(path))throw fail('不允许发布此文件');
 const base=await baseline(env);if(expectedBase&&base.sha!==expectedBase)throw fail('主分支已变化，请重新生成数据后重试',409);
 const original=path==='data/manual.json'?{sha:base.fileSha,data:base.data}:await file(env.GH_TOKEN,mainRepo(env),base.sha,path);
 if(expectedFileSha&&original.sha!==expectedFileSha)throw fail('人工数据已变化，请刷新重试',409);
 if(canonical(original.data)===canonical(data))return {unchanged:true,sha:original.sha};
 const bot=await robot(env),repo=repoPath(mainRepo(env)),branch=branchPrefix+'-'+crypto.randomUUID();
 await gh(bot.token,repo+'/git/refs','POST',{ref:'refs/heads/'+branch,sha:base.sha});
 const commit=await gh(bot.token,repo+'/contents/'+path,'PUT',{message:title,branch,sha:original.sha,content:encodeText(JSON.stringify(data,null,2)+'\n'),author:{name:bot.user.login,email:`${bot.user.id}+${bot.user.login}@users.noreply.github.com`}});
 const pr=await gh(bot.token,repo+'/pulls','POST',{title,body:'受控数据提案，仅修改 '+path+'。请核对来源和差异后审核合并。\n基准 SHA：'+base.sha,head:branch,base:env.GH_BRANCH||'main',maintainer_can_modify:false});

 if(branchPrefix==='admin-data'){
  // The authenticated administrator has already validated this draft and requested submission.
  const head=commit.commit.sha,current=await gh(env.GH_TOKEN,repo+'/pulls/'+pr.number);
  if(current.head.sha!==head||current.head.ref!==branch||current.base.ref!==(env.GH_BRANCH||'main')||current.head.repo?.full_name?.toLowerCase()!==mainRepo(env).toLowerCase()||Number(current.user.id)!==Number(bot.user.id))throw fail('管理员PR内容已变化，自动审批已停止',409);
  const files=await gh(env.GH_TOKEN,repo+'/pulls/'+pr.number+'/files?per_page=100');if(current.changed_files!==1||files.length!==1||files[0].filename!==path)throw fail('PR包含非预期文件，自动审批已停止',409);
  await gh(env.GH_TOKEN,repo+'/pulls/'+pr.number+'/reviews','POST',{commit_id:head,event:'APPROVE',body:'管理员已在网站预览验证并主动提交；后台批准当前SHA。'});
  const merged=await gh(bot.token,repo+'/pulls/'+pr.number+'/merge','PUT',{sha:head,merge_method:'merge'});
  if(!merged.merged)throw fail('PR已创建但尚未合并：'+(merged.message||'请检查必需检查和分支规则')+'；'+pr.html_url,409);
  let cleanupWarning='';try{const ref=await gh(bot.token,repo+'/git/ref/heads/'+encodeURIComponent(branch));if(ref.object.sha!==head)throw Error('分支被修改');await gh(bot.token,repo+'/git/refs/heads/'+encodeURIComponent(branch),'DELETE')}catch{cleanupWarning='已合并，但临时分支清理未完成，请核对GitHub。'}
  return {sha:original.sha,commitSha:head,prUrl:pr.html_url,prNumber:pr.number,merged:true,mergeSha:merged.sha,cleanupWarning};
 }
 return {sha:original.sha,commitSha:commit.commit.sha,prUrl:pr.html_url,prNumber:pr.number};
}

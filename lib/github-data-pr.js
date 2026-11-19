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
 return {sha:original.sha,commitSha:commit.commit.sha,prUrl:pr.html_url,prNumber:pr.number};
}

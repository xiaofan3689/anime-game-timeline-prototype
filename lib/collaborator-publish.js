import {cleanupBranch} from './proposal-cleanup.js';
import {gh,repoPath,mainRepo,file,encodeText,credential,verifyCredential} from './collaborator-github.js';
import {fail,audit} from './collaborator-auth.js';
import {canonical,checkScope,diffData} from './collaborator-data.js';
import {robot,delegated,channel} from './github-app-installation.js';
const enc=encodeURIComponent;
export async function buildPR(env,p){
 const mode=await channel(env,p.id);if(['app-personal','app-bot'].includes(mode))return buildAppPR(env,p);const bot=mode==='robot'?await delegated(env):null;
 const c=bot?{token:bot.token,github_user_id:bot.user.id,fork_repo:bot.forkRepo}:await credential(env,p.email);if(Number(c.github_user_id)!==Number(p.github_user_id)||c.fork_repo.toLowerCase()!==p.fork_repo.toLowerCase())throw fail('GitHub 绑定已变化，请重新建立提案',409);
 const {user}=bot||await verifyCredential(env,c.token,c.fork_repo,p.github_user_id),fork=repoPath(p.fork_repo),main=repoPath(mainRepo(env));
 let ref;try{ref=await gh(c.token,fork+'/git/ref/heads/'+enc(p.branch))}catch{
  await gh(c.token,fork+'/git/refs','POST',{ref:'refs/heads/'+p.branch,sha:p.base_sha});ref=await gh(c.token,fork+'/git/ref/heads/'+enc(p.branch));
 }
 let head=ref.object.sha;
 if(head===p.base_sha){
  const original=await file(c.token,p.fork_repo,head);
 const email=`${user.id}+${user.login}@users.noreply.github.com`;
  const r=await gh(c.token,fork+'/contents/data/manual.json','PUT',{message:'Update assigned game data ('+p.id+')',content:encodeText(JSON.stringify(JSON.parse(p.proposed),null,2)+'\n'),sha:original.sha,branch:p.branch,author:{name:user.login,email},committer:{name:user.login,email}});head=r.commit.sha;
 }
 const content=await file(c.token,p.fork_repo,head),commit=await gh(c.token,fork+'/git/commits/'+head);
 if(canonical(content.data)!==canonical(JSON.parse(p.proposed))||commit.parents?.length!==1||commit.parents[0].sha!==p.base_sha||commit.author?.email!==`${user.id}+${user.login}@users.noreply.github.com`)throw fail('Fork 分支或提交作者被修改，不能继续此提案',409);
 await env.APPLICATION_DB.prepare('UPDATE collaborator_reviews_v79 SET head_sha=?,updated_at=? WHERE id=?').bind(head,Date.now(),p.id).run();
 const headFilter=enc((bot?bot.user.login:p.login)+':'+p.branch);
 let prs=await gh(c.token,main+'/pulls?state=all&head='+headFilter+'&base='+enc(env.GH_BRANCH||'main'));
 let pr=prs.find(x=>x.state==='open'&&x.head?.repo?.full_name?.toLowerCase()===p.fork_repo.toLowerCase());
 if(!pr)pr=await gh(c.token,main+'/pulls','POST',{title:'协作者数据修改 · '+p.id,body:'通过网站提交的游戏与活动修改。提案编号：'+p.id+'\n\n'+(bot?'机器人代提交；网站提交人保留在管理员审计记录。':'提交人身份由 GitHub 本人授权验证。')+' 请在管理员页面检查差异并批准。',head:bot?p.branch:p.login+':'+p.branch,base:env.GH_BRANCH||'main',maintainer_can_modify:false});
 if(Number(pr.user.id)!==Number(p.github_user_id)||pr.head.sha!==head||pr.state!=='open')throw fail('PR 发起人、提交或状态不符合预期，请管理员核对',409);
 await env.APPLICATION_DB.prepare("UPDATE collaborator_reviews_v79 SET status='pending',pr_number=?,pr_url=?,head_sha=?,note='',updated_at=? WHERE id=?").bind(pr.number,pr.html_url,head,Date.now(),p.id).run();
 await audit(env,p.email,p.id,'pr-created',head);return {id:p.id,prUrl:pr.html_url,headSha:head};
}
export async function inspectPR(env,p){
 if(!p.pr_number||!p.head_sha)throw fail('提案尚未建立 PR',409);
 const appMode=['app-personal','app-bot'].includes(await channel(env,p.id)),app=appMode?await robot(env):null;
 const repo=mainRepo(env),path=repoPath(repo),pr=await gh(env.GH_TOKEN,path+'/pulls/'+p.pr_number);
 if(pr.base.repo.full_name.toLowerCase()!==repo.toLowerCase()||pr.base.ref!==(env.GH_BRANCH||'main')||pr.head.repo?.full_name?.toLowerCase()!==p.fork_repo.toLowerCase()||pr.head.ref!==p.branch||pr.head.sha!==p.head_sha||Number(pr.user.id)!==Number(appMode?app.user.id:p.github_user_id))throw fail('PR 内容或身份已变化，原审批失效',409);
 const user=await env.APPLICATION_DB.prepare('SELECT games FROM collaborator_users WHERE email=? AND active=1').bind(p.email).first();if(!user)throw fail('协作者已停用',403);
 if(appMode&&await channel(env,p.id)==='app-bot'){if(Number(app.user.id)!==Number(p.github_user_id)||p.fork_repo.toLowerCase()!==repo.toLowerCase())throw fail('Bot身份已变化',409)}else if(appMode){const c=await credential(env,p.email),u=await gh(c.token,'/user');if(Number(u.id)!==Number(p.github_user_id)||p.fork_repo.toLowerCase()!==repo.toLowerCase())throw fail('提交作者身份或仓库已变化',409)}else if(await channel(env,p.id)==='robot'){const b=await delegated(env);if(Number(b.user.id)!==Number(p.github_user_id)||b.forkRepo.toLowerCase()!==p.fork_repo.toLowerCase())throw fail('机器人身份或安装已变化',403)}else{
 const connection=await credential(env,p.email);if(Number(connection.github_user_id)!==Number(p.github_user_id)||connection.fork_repo.toLowerCase()!==p.fork_repo.toLowerCase())throw fail('协作者 GitHub 绑定已撤销或改变',403);
 await verifyCredential(env,connection.token,connection.fork_repo,p.github_user_id);
 }
 const before=JSON.parse(p.snapshot),after=JSON.parse(p.proposed);checkScope(before,after,JSON.parse(user.games));
 const files=await gh(env.GH_TOKEN,path+'/pulls/'+p.pr_number+'/files?per_page=100');
 if(pr.changed_files!==1||files.length!==1||files[0].filename!=='data/manual.json'||files[0].status!=='modified'||pr.commits!==1)throw fail('PR 必须只含一个人工数据提交，不可改动代码或其他文件',409);
 const actual=(await file(env.GH_TOKEN,p.fork_repo,p.head_sha)).data;
 if(canonical(actual)!==canonical(after))throw fail('GitHub 文件与网站提案不一致',409);
 const originalCommit=await gh(env.GH_TOKEN,repoPath(p.fork_repo)+'/git/commits/'+p.head_sha);
 if(appMode&&originalCommit.author?.email!==`${p.github_user_id}+${p.login}@users.noreply.github.com`)throw fail('提交作者被修改',409);
 if(originalCommit.parents?.length!==1||originalCommit.parents[0].sha!==p.base_sha)throw fail('提案提交基准已变化',409);
 if(!pr.merged){const current=(await file(env.GH_TOKEN,repo,env.GH_BRANCH||'main')).data;if(canonical(current)!==canonical(before))throw fail('主仓库人工数据已更新，请重新加载并重新提交',409);if(pr.state!=='open')throw fail('PR 已关闭',409)}
 return {pr,changes:diffData(before,after)};
}
export async function mergePR(env,p,actor,head){
 if(head!==p.head_sha)throw fail('审批页面版本过期，请刷新差异',409);
 const {pr}=await inspectPR(env,p),path=repoPath(mainRepo(env));let mergeSha=pr.merge_commit_sha;
 if(!pr.merged){
  // An ordinary GitHub review; branch protection and required checks still apply.
  const mergeBot=await robot(env);
  const reviewToken=await channel(env,p.id)==='robot'?mergeBot.token:env.GH_TOKEN;
  await gh(reviewToken,path+'/pulls/'+p.pr_number+'/reviews','POST',{commit_id:p.head_sha,event:'APPROVE',body:'管理员在网站审核提案 '+p.id+' 并批准此 SHA。'});
  const result=await gh(mergeBot.token,path+'/pulls/'+p.pr_number+'/merge','PUT',{sha:p.head_sha,merge_method:'merge',commit_title:'Merge collaborator proposal '+p.id});
  if(!result.merged)throw fail('GitHub 未完成合并：'+(result.message||'请检查仓库规则'),409);mergeSha=result.sha;
 }
 try{await cleanupBranch(env,p)}catch(e){console.warn('temporary branch cleanup failed',e.message)}
 await env.APPLICATION_DB.prepare("UPDATE collaborator_reviews_v79 SET status='merged',merge_sha=?,note='',updated_at=? WHERE id=?").bind(mergeSha,Date.now(),p.id).run();
 await audit(env,actor,p.id,'merged',JSON.stringify({head:p.head_sha,mergeSha}));
 return {ok:true,mergeSha,prUrl:p.pr_url,message:'已合并主分支；请继续核对 Sync game events 和 Pages 部署结果'};
}

async function buildAppPR(env,p){
 const app=await robot(env),repo=mainRepo(env),path=repoPath(repo);const botMode=await channel(env,p.id)==='app-bot';const c=botMode?null:await credential(env,p.email),user=botMode?app.user:await gh(c.token,'/user');
 if(Number(user.id)!==Number(p.github_user_id)||user.login!==p.login||p.fork_repo.toLowerCase()!==repo.toLowerCase())throw fail('提交身份已变化，请保存新版本',409);
 let ref;try{ref=await gh(app.token,path+'/git/ref/heads/'+enc(p.branch))}catch(e){if(!e.message.includes('404'))throw e;await gh(app.token,path+'/git/refs','POST',{ref:'refs/heads/'+p.branch,sha:p.base_sha});ref=await gh(app.token,path+'/git/ref/heads/'+enc(p.branch))}
 let head=ref.object.sha;const email=p.github_user_id+'+'+p.login+'@users.noreply.github.com';
 if(head===p.base_sha){const original=await file(app.token,repo,head);const result=await gh(app.token,path+'/contents/data/manual.json','PUT',{message:'Update assigned game data ('+p.id+')',content:encodeText(JSON.stringify(JSON.parse(p.proposed),null,2)+'\n'),sha:original.sha,branch:p.branch,author:{name:p.login,email}});head=result.commit.sha}
 const actual=await file(app.token,repo,head),commit=await gh(app.token,path+'/git/commits/'+head);
 if(canonical(actual.data)!==canonical(JSON.parse(p.proposed))||commit.parents?.length!==1||commit.parents[0].sha!==p.base_sha||commit.author?.email!==email)throw fail('临时分支内容或作者不符合提案',409);
 await env.APPLICATION_DB.prepare('UPDATE collaborator_reviews_v79 SET head_sha=?,updated_at=? WHERE id=?').bind(head,Date.now(),p.id).run();
 const prs=await gh(app.token,path+'/pulls?state=all&head='+enc(repo.split('/')[0]+':'+p.branch)+'&base='+enc(env.GH_BRANCH||'main'));
 let pr=prs.find(x=>x.state==='open'&&x.head?.ref===p.branch&&x.head?.repo?.full_name?.toLowerCase()===repo.toLowerCase());
 if(!pr)pr=await gh(app.token,path+'/pulls','POST',{title:'协作者数据修改 · '+p.id,body:'提交作者：@'+p.login+'；PR由GitHub App代发。网站提案：'+p.id+'。须由网站管理员审核。',head:p.branch,base:env.GH_BRANCH||'main'});
 if(Number(pr.user.id)!==Number(app.user.id)||pr.head.sha!==head||pr.state!=='open')throw fail('PR身份或状态不符合预期',409);
 await env.APPLICATION_DB.prepare("UPDATE collaborator_reviews_v79 SET status='pending',pr_number=?,pr_url=?,head_sha=?,note='',updated_at=? WHERE id=?").bind(pr.number,pr.html_url,head,Date.now(),p.id).run();await audit(env,p.email,p.id,'app-pr-created',head);return {id:p.id,prUrl:pr.html_url,headSha:head};
}

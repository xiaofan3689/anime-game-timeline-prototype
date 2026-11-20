import {gh,repoPath,mainRepo,credential} from './collaborator-github.js';
import {channel} from './github-app-installation.js';
export async function cleanupBranch(env,p){
 if(p.branch!=='collab-'+p.id)throw Error('临时分支名称不匹配');
 let token=env.GH_TOKEN;if(await channel(env,p.id)!=='robot'){const c=await credential(env,p.email);if(c.fork_repo.toLowerCase()!==p.fork_repo.toLowerCase()||Number(c.github_user_id)!==Number(p.github_user_id))throw Error('分支所属授权已变化');token=c.token}
 const ref=repoPath(p.fork_repo)+'/git/ref/heads/'+encodeURIComponent(p.branch);let current;try{current=await gh(token,ref)}catch(e){if(e.message.includes('404'))return;throw e}
 if(current.object.sha!==p.head_sha)throw Error('分支已被修改，保留分支供核对');
 await gh(token,repoPath(p.fork_repo)+'/git/refs/heads/'+encodeURIComponent(p.branch),'DELETE');
}

import {gh,repoPath,mainRepo,file} from './collaborator-github.js';
const sha=s=>/^[a-f0-9]{40}$/.test(s||'');
async function includes(env,base,head){if(base===head)return true;if(!sha(base)||!sha(head))return false;const compare=await gh(env.GH_TOKEN,repoPath(mainRepo(env))+'/compare/'+base+'...'+head);return compare.status==='ahead'||compare.status==='identical'}
export async function releaseStatus(env,p){
 const state={merged:p.status==='merged',sync:'unknown',pages:'not-configured',deployed:false};if(!state.merged||!sha(p.merge_sha))return state;
 const pr=await gh(env.GH_TOKEN,repoPath(mainRepo(env))+'/pulls/'+p.pr_number),mergedAt=Date.parse(pr.merged_at);if(!pr.merged||!Number.isFinite(mergedAt))return {...state,error:'GitHub 合并时间无法确认'};
 try{
  const runs=await gh(env.GH_TOKEN,repoPath(mainRepo(env))+'/actions/workflows/sync.yml/runs?branch='+encodeURIComponent(env.GH_BRANCH||'main')+'&per_page=20');
  for(const run of runs.workflow_runs||[])if(Date.parse(run.created_at)>=mergedAt-1000&&await includes(env,p.merge_sha,run.head_sha)){state.sync=run.status==='completed'?run.conclusion:run.status;state.syncUrl=run.html_url;break;}
 }catch{state.sync='unavailable'}
 if(!env.CF_PAGES_READ_TOKEN||!env.CF_ACCOUNT_ID||!env.CF_PAGES_PROJECT)return state;
 const path='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(env.CF_ACCOUNT_ID)+'/pages/projects/'+encodeURIComponent(env.CF_PAGES_PROJECT);
 const r=await fetch(path,{headers:{Authorization:'Bearer '+env.CF_PAGES_READ_TOKEN}}),body=await r.json();if(!r.ok||!body.success)return {...state,pages:'unavailable'};
 const deployed=body.result?.canonical_deployment,commit=deployed?.deployment_trigger?.metadata?.commit_hash;
 state.pages=deployed?.latest_stage?.status||'unknown';
 if(deployed?.environment!=='production'||deployed?.is_skipped||!await includes(env,p.merge_sha,commit))return {...state,pages:'waiting-for-containing-commit'};
 state.deployedSha=commit;
 if(state.pages!=='success'||deployed.latest_stage.name!=='deploy')return state;
 const feed=(await file(env.GH_TOKEN,mainRepo(env),commit,'data/events.json')).data;
 if(!Number.isFinite(Date.parse(feed.generatedAt))||Date.parse(feed.generatedAt)<mergedAt)return {...state,pages:'waiting-for-fresh-feed'};
 // Deployment success is asserted only from the production canonical deployment,
 // its commit ancestry, and a feed generated after this proposal was merged.
 return {...state,pages:'success',deployed:true,message:'包含本次合并历史且已重新生成活动数据的版本已正式部署'};
}

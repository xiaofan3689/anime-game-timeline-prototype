import {gh,mainRepo,repoPath} from './collaborator-github.js';
import {fail} from './collaborator-auth.js';
export const imagePath=path=>typeof path==='string'&&/^assets\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|gif|avif|svg|ico)$/i.test(path)&&!path.includes('..');
export async function repositoryImages(env){
 const repo=mainRepo(env),branch=env.GH_BRANCH||'main';
 const head=await gh(env.GH_TOKEN,repoPath(repo)+'/branches/'+encodeURIComponent(branch));
 const tree=await gh(env.GH_TOKEN,repoPath(repo)+'/git/trees/'+encodeURIComponent(head.commit.sha)+'?recursive=1');
 if(tree.truncated)throw fail('仓库文件列表过大，暂时无法完整列出图片，请手动填写 /assets/ 路径',503);
 const images=(tree.tree||[]).filter(x=>x.type==='blob'&&imagePath(x.path)).map(x=>({path:'/'+x.path})).sort((a,b)=>a.path.localeCompare(b.path));
 return {images,branch,revision:head.commit.sha};
}

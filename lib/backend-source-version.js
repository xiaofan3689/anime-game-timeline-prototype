import {pageCommits} from './backend-commit-watch.js';
const pages=new Set(['/admin/','/admin/index.html','/admin/approvals','/admin/approvals.html','/admin/collaborator-proposals','/admin/collaborator-proposals.html','/collaborator/','/collaborator/index.html']);
const shared=new Set(['/operation-status.js','/preview-dialog.css','/responsive.css','/collaborator-page.css','/collaborator-page.js','/repository-images.css','/repository-images.js','/backend-updates.js','/ui-polish.css','/reference-ui.css','/interface-v138.css','/site-navigation.js']);
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join('');
export async function sourceVersion(request,env,role){
 const url=new URL(request.url),page=url.searchParams.get('page');
 if(!pages.has(page)||!page.startsWith('/'+role+'/'))throw Object.assign(Error('页面路径无效'),{status:400});
 if(!env.ASSETS?.fetch)throw Object.assign(Error('静态资源绑定不可用，暂时无法检测源码更新'),{status:503});
 const canonical=page.endsWith('/')?page+'index.html':page.endsWith('.html')?page:page+'.html';
 async function read(path){let response=await env.ASSETS.fetch(new Request(new URL(path,url.origin),{redirect:'manual'}));
  if([301,302,307,308].includes(response.status)){const next=new URL(response.headers.get('location'),url.origin);if(next.origin!==url.origin||!pages.has(next.pathname))throw Error('静态页面重定向异常');response=await env.ASSETS.fetch(new Request(next,{redirect:'manual'}))}
  if(!response.ok)throw Object.assign(Error('无法读取后台源码：'+path),{status:503});return response.text()}
 const html=await read(canonical),files=new Set(['/backend-updates.js']);
 for(const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi)){
  const ref=new URL(match[1],new URL(canonical,url.origin));if(ref.origin!==url.origin)continue;
  const path=ref.pathname;
  if(!/\.(?:js|css)$/i.test(path)||path.includes('..')||path.startsWith('/data/')||path.startsWith('/api/'))continue;
  if(path.startsWith('/'+role+'/')||shared.has(path))files.add(path);
 }
 // Image picker is injected by editing scripts, so include its source explicitly.
 files.add('/repository-images.js');files.add('/repository-images.css');files.add('/content-preview.js');files.add('/preview-session.js');
 const fileVersions={[canonical]:await hash(html)},parts=[canonical,fileVersions[canonical]];
 for(const path of [...files].sort()){const content=await read(path);fileVersions[path]=await hash(content);parts.push(path,fileVersions[path])}
 const watchPaths=[canonical,...files].sort();const repository=await pageCommits(env,watchPaths);return {version:await hash(parts.join('\n')),page:canonical,files:fileVersions,repositoryVersion:await hash(JSON.stringify(Object.entries(repository.commits).sort())),commits:repository.commits,branch:repository.branch};
}

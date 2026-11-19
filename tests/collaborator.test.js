import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {onRequest as dataAPI} from '../functions/api/collaborator/data.js';
import {onRequest as connectAPI} from '../functions/api/collaborator/github.js';
import {onRequest as submitAPI} from '../functions/api/collaborator/submit.js';
import {onRequest as adminAPI} from '../functions/api/admin/collaborator-proposals.js';
import {seal,unseal,encodeText} from '../lib/collaborator-github.js';
import {scoped,mergeScoped,prepareCatalog,diffData} from '../lib/collaborator-data.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const root=fileURLToPath(new URL('../',import.meta.url));
const temp=mkdtempSync(join(tmpdir(),'collab-v79-test-')),dbfile=join(temp,'test.sqlite');
const sqlite=new DatabaseSync(':memory:');
function sql(query,args=[],mode='run',script=false){if(script){sqlite.exec(query);return {}}const q=sqlite.prepare(query);if(mode==='first')return q.get(...args)||null;if(mode==='all')return {results:q.all(...args)};return {meta:{changes:Number(q.run(...args).changes)}}}
const db={prepare(q){return {bind(...args){return {async first(){return sql(q,args,'first')},async all(){return sql(q,args,'all')},async run(){return sql(q,args)}}},async all(){return sql(q,[],'all')}}}};
const env={APPLICATION_DB:db,ACCESS_TEAM_DOMAIN:'https://test.cloudflareaccess.com',ACCESS_AUD:'admin-aud',COLLABORATOR_ACCESS_AUD:'collab-aud',ADMIN_EMAIL:'admin@test.example',GH_OWNER:'owner',GH_REPO:'timeline',GH_BRANCH:'main',GH_TOKEN:'admin-fake',TOKEN_ENCRYPTION_KEY:'ab'.repeat(32)};
const alice='alice@test.example',base='1'.repeat(40),head='2'.repeat(40);
const baseData={games:[{id:'aa',name:'A',iconUrl:''},{id:'bb',name:'B',iconUrl:''}],events:[]};
const catalog={games:baseData.games,events:[{id:'foreign',gameId:'bb',title:'foreign',startAt:'2026-11-01T00:00:00+08:00',endAt:'2026-12-01T00:00:00+08:00'}]};
let mainData=structuredClone(baseData),forkData=null,ref=null,pr=null,createPR=0,createCommit=0,mergeCount=0,changedFiles=null,keys,tokens,fetchOriginal=globalThis.fetch;
function response(b,status=200){return Response.json(b,{status})}
before(async()=>{
 sql(readFileSync(join(root,'scripts/collaborators.sql'),'utf8'),[],'run',true);sql(readFileSync(join(root,'scripts/collaborators-v79.sql'),'utf8'),[],'run',true);
 sql('INSERT INTO collaborator_users VALUES(?,?,?,?,?,?,?)',[alice,'collaborator',1,'["aa"]',null,1,1]);
 keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test-key';
 tokens={};for(const [kind,email,aud] of [['alice',alice,'collab-aud'],['admin',env.ADMIN_EMAIL,'admin-aud'],['outsider','outsider@test.example','collab-aud']]){const h=Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url'),p=Buffer.from(JSON.stringify({iss:env.ACCESS_TEAM_DOMAIN,email,aud:[aud],exp:Date.now()/1000+3600})).toString('base64url'),s=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(h+'.'+p));tokens[kind]=h+'.'+p+'.'+Buffer.from(s).toString('base64url')}
 globalThis.fetch=async(input,options={})=>{
  const url=new URL(input),path=decodeURIComponent(url.pathname),method=options.method||'GET',b=options.body?JSON.parse(options.body):null;
  if(url.hostname==='test.cloudflareaccess.com')return response({keys:[jwk]});
  if(url.hostname!=='api.github.com')throw Error('Unexpected network '+url.hostname);
  if(path==='/user')return response({id:42,login:'alice'});
  if(path==='/repos/owner/timeline')return response({private:false,permissions:{push:options.headers.Authorization==='Bearer admin-fake'}});
  if(path==='/repos/alice/timeline')return response({fork:true,full_name:'alice/timeline',owner:{id:42},parent:{full_name:'owner/timeline'},permissions:{push:true}});
  if(path.endsWith('/branches/main'))return response({commit:{sha:base}});
  if(path.endsWith('/contents/data/events.json'))return response({sha:'events',content:encodeText(JSON.stringify(catalog))});
  if(path.endsWith('/git/refs')&&method==='POST'){ref=b.sha;return response({object:{sha:ref}},201)}
  if(path.includes('/git/ref/heads/'))return ref?response({object:{sha:ref}}):response({message:'Not Found'},404);
  if(path.endsWith('/contents/data/manual.json')){
   if(method==='PUT'){forkData=JSON.parse(Buffer.from(b.content,'base64').toString());ref=head;createCommit++;assert.equal(b.author.email,'42+alice@users.noreply.github.com');return response({commit:{sha:head}},201)}
   const value=path.includes('/alice/')&&url.searchParams.get('ref')===head?forkData:mainData;return response({sha:'file-sha',content:encodeText(JSON.stringify(value))});
  }
  if(path.includes('/git/commits/'))return response({parents:[{sha:base}],author:{email:'42+alice@users.noreply.github.com'}});
  if(path==='/repos/owner/timeline/pulls'){
   if(method==='POST'){createPR++;pr={number:1,html_url:'https://github.com/owner/timeline/pull/1',state:'open',merged:false,user:{id:42},base:{ref:'main',repo:{full_name:'owner/timeline'}},head:{sha:head,ref:ref&&b.head.split(':')[1],repo:{full_name:'alice/timeline'}},changed_files:1,commits:1};return response(pr,201)}return response(pr?[pr]:[]);
  }
  if(path.endsWith('/pulls/1/files'))return response(changedFiles||[{filename:'data/manual.json',status:'modified'}]);
  if(path.endsWith('/pulls/1/reviews')){assert.equal(b.commit_id,head);return response({id:1},201)}
  if(path.endsWith('/pulls/1/merge')){assert.equal(b.sha,head);assert.equal(b.merge_method,'merge');mergeCount++;pr.merged=true;pr.merge_commit_sha='3'.repeat(40);mainData=forkData;return response({merged:true,sha:pr.merge_commit_sha})}
  if(path.endsWith('/pulls/1')){if(method==='PATCH')pr.state=b.state;return response(pr)}
  throw Error('Unexpected API '+method+' '+path);
 };
});
after(()=>{globalThis.fetch=fetchOriginal;rmSync(temp,{recursive:true,force:true})});
async function request(fn,path,method='GET',input,who='alice',extra={}){const headers={'Cf-Access-Jwt-Assertion':tokens[who],...extra};if(method!=='GET')headers.Origin='https://site.test';if(input)headers['Content-Type']='application/json';const r=await fn({env,request:new Request('https://site.test'+path,{method,headers,body:input?JSON.stringify(input):undefined})});return {status:r.status,body:await r.json()}}
test('GET succeeds without Origin; forged email headers and wrong audience do not authenticate',async()=>{
 const a=await request(dataAPI,'/api/collaborator/data');assert.equal(a.status,200);assert.equal(a.body.data.games.length,1);assert.equal(a.body.data.games[0].id,'aa');
 assert.equal((await request(dataAPI,'/api/collaborator/data','GET',null,'outsider',{'X-Collaborator-Email':alice})).status,403);
 assert.equal((await request(dataAPI,'/api/collaborator/data','GET',null,'admin')).status,401);
 const bad=await dataAPI({env,request:new Request('https://site.test/api/collaborator/data',{headers:{'X-Collaborator-Email':alice,'Cf-Access-Authenticated-User-Email':alice}})});assert.equal(bad.status,401);
});
test('scope rejects foreign games, stolen event IDs, disabled changes, unknown fields; encryption binds email',async()=>{
 const data=scoped(baseData,catalog,['aa']);data.games[0].disabled=true;assert.throws(()=>mergeScoped(baseData,catalog,data,['aa']));data.games[0].disabled=false;
 data.events=[{...catalog.events[0],gameId:'aa'}];assert.throws(()=>mergeScoped(baseData,catalog,data,['aa']));data.events=[];data.games[0].evil='x';assert.throws(()=>mergeScoped(baseData,catalog,data,['aa']));
 const cipher=await seal(env,alice,'fake-user-token');assert(!cipher.includes('fake-user-token'));assert.equal(await unseal(env,alice,cipher),'fake-user-token');await assert.rejects(unseal(env,'other@test.example',cipher));
});
test('legacy events receive stable sync-compatible IDs; unchanged games preserved',async()=>{
 const snapshot=structuredClone(baseData),feed=structuredClone(catalog);snapshot.events=[{gameId:'aa',title:'legacy',startAt:'2026-11-01T00:00:00+08:00',endAt:'2026-12-01T00:00:00+08:00'}];await prepareCatalog(snapshot,feed);const data=scoped(snapshot,feed,['aa']);assert.match(data.events[0].id,/^[a-f0-9]{20}$/);const after=mergeScoped(snapshot,feed,data,['aa']);assert.deepEqual(after.games,snapshot.games);assert.equal(diffData(snapshot,after).length,0);data.events[0].title='edited';const edited=mergeScoped(snapshot,feed,data,['aa']);assert.equal(edited.events[0].id,data.events[0].id);
});
test('full draft → real-author Fork commit → own PR → SHA approval merge, with idempotent retry and attack checks',async()=>{
 const linked=await request(connectAPI,'/api/collaborator/github','POST',{token:'fake-user-token',forkRepo:'alice/timeline'});assert.equal(linked.status,200);
 const stored=sql('SELECT cipher FROM collaborator_credentials WHERE email=?',[alice],'first');assert(!stored.cipher.includes('fake-user-token'));
 const initial=(await request(dataAPI,'/api/collaborator/data')).body;initial.data.events.push({id:'event-a',gameId:'aa',title:'Test',startAt:'2026-11-01T00:00:00+08:00',endAt:'2026-12-01T00:00:00+08:00'});
 const saved=await request(dataAPI,'/api/collaborator/data','PUT',{data:initial.data,revision:initial.revision});assert.equal(saved.status,200);
 const stale=await request(dataAPI,'/api/collaborator/data','PUT',{data:initial.data,revision:initial.revision});assert.equal(stale.status,409);
 const first=await request(submitAPI,'/api/collaborator/submit','POST',{revision:saved.body.revision});assert.equal(first.status,200,JSON.stringify(first.body));assert.equal(createPR,1);assert.equal(createCommit,1);
 const retry=await request(submitAPI,'/api/collaborator/submit','POST',{revision:saved.body.revision});assert.equal(retry.status,200);assert.equal(createPR,1);
 assert.equal((await request(adminAPI,'/api/admin/collaborator-proposals','POST',{id:first.body.id,action:'merge',headSha:head})).status,401);
 const inspect=await request(adminAPI,'/api/admin/collaborator-proposals?id='+first.body.id,'GET',null,'admin');assert.equal(inspect.status,200,JSON.stringify(inspect.body));assert(inspect.body.changes.length);
 let approved=await request(adminAPI,'/api/admin/collaborator-proposals','POST',{id:first.body.id,action:'merge',headSha:'stale'},'admin');assert.equal(approved.status,409);assert.equal(mergeCount,0);
 pr.head.sha='4'.repeat(40);approved=await request(adminAPI,'/api/admin/collaborator-proposals','POST',{id:first.body.id,action:'merge',headSha:head},'admin');assert.equal(approved.status,409);assert.equal(mergeCount,0);pr.head.sha=head;
 changedFiles=[{filename:'.github/workflows/evil.yml',status:'added'}];approved=await request(adminAPI,'/api/admin/collaborator-proposals','POST',{id:first.body.id,action:'merge',headSha:head},'admin');assert.equal(approved.status,409);assert.equal(mergeCount,0);changedFiles=null;
 sql('UPDATE collaborator_users SET active=0 WHERE email=?',[alice]);approved=await request(adminAPI,'/api/admin/collaborator-proposals','POST',{id:first.body.id,action:'merge',headSha:head},'admin');assert.equal(approved.status,403);sql('UPDATE collaborator_users SET active=1 WHERE email=?',[alice]);
 mainData={...baseData,events:[{id:'admin-change',gameId:'bb'}]};approved=await request(adminAPI,'/api/admin/collaborator-proposals','POST',{id:first.body.id,action:'merge',headSha:head},'admin');assert.equal(approved.status,409);mainData=structuredClone(baseData);
 approved=await request(adminAPI,'/api/admin/collaborator-proposals','POST',{id:first.body.id,action:'merge',headSha:head},'admin');assert.equal(approved.status,200,JSON.stringify(approved.body));assert.equal(mergeCount,1);
 const repeat=await request(adminAPI,'/api/admin/collaborator-proposals','POST',{id:first.body.id,action:'merge',headSha:head},'admin');assert.equal(repeat.status,200);assert.equal(mergeCount,1);
 assert.equal(mainData.events[0].title,'Test');assert(sql('SELECT * FROM collaborator_audit_v79',[],'all').results.some(x=>x.action==='merged'));
});



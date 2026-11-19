import {admin,endpoint,json,fail} from '../../../lib/collaborator-auth.js';
import {releaseStatus} from '../../../lib/collaborator-release.js';
export const onRequest=endpoint(async({request,env})=>{
 await admin(request,env);if(request.method!=='GET')return json({error:'方法不支持'},405);
 const id=new URL(request.url).searchParams.get('id'),p=await env.APPLICATION_DB.prepare('SELECT * FROM collaborator_reviews_v79 WHERE id=?').bind(id||'').first();if(!p)throw fail('提案不存在',404);
 const cache=await env.APPLICATION_DB.prepare('SELECT * FROM collaborator_release_status WHERE id=?').bind(p.id).first();if(cache&&Date.now()-cache.checked_at<60000)return json(JSON.parse(cache.detail));
 const status=await releaseStatus(env,p),now=Date.now();await env.APPLICATION_DB.prepare('INSERT INTO collaborator_release_status VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET detail=excluded.detail,checked_at=excluded.checked_at').bind(p.id,JSON.stringify(status),now).run();return json({...status,checkedAt:now});
});

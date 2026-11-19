import {admin,endpoint,json} from '../../../lib/collaborator-auth.js';
import {sourceVersion} from '../../../lib/backend-source-version.js';
export const onRequest=endpoint(async({request,env})=>{await admin(request,env);if(request.method!=='GET')return json({error:'方法不支持'},405);return json(await sourceVersion(request,env,'admin'))});

import {identity,endpoint,json} from '../../../lib/collaborator-auth.js';
import {activate} from '../../../lib/collaborator-invitations.js';
export const onRequest=endpoint(async({request,env})=>{
 if(!['GET','POST'].includes(request.method))return json({error:'方法不支持'},405);
 const email=await identity(request,env);return json({email,...await activate(env,email,request.method==='POST')});
});

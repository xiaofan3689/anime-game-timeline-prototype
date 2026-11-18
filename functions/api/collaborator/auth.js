export function emailFrom(request){
 const value=request.headers.get('Cf-Access-Authenticated-User-Email')||request.headers.get('X-Collaborator-Email')||'';
 return value.trim().toLowerCase();
}
export const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

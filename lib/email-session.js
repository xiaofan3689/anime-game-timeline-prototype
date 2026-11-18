export async function accountKey(db,key){
 const session=await db.prepare('SELECT account_hash FROM email_sessions WHERE token_hash=?').bind(key).first();
 return session?.account_hash||key;
}
export const stateOf=row=>({games:JSON.parse(row.games),completed:JSON.parse(row.completed),revision:row.revision,active:!!row.active});

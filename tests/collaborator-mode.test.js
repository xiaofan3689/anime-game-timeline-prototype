import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {usesOwnGithub,setGithubMode} from '../lib/collaborator-mode.js';
test('approved applications initialize modes; manual changes override and remain independent',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE collaborator_applications(email TEXT,use_github INTEGER,status TEXT,created_at INTEGER); INSERT INTO collaborator_applications VALUES (\'a@example.com\',0,\'approved\',1),(\'b@example.com\',1,\'approved\',2),(\'c@example.com\',0,\'sent\',3);');
 db.exec(readFileSync(new URL('../scripts/collaborators-v100.sql',import.meta.url),'utf8'));
 const env={APPLICATION_DB:{prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){return db.prepare(sql).get(...args)},async run(){return db.prepare(sql).run(...args)}}}}};
 assert.equal(await usesOwnGithub(env,'a@example.com'),false);assert.equal(await usesOwnGithub(env,'b@example.com'),true);assert.equal(await usesOwnGithub(env,'c@example.com'),true);
 await setGithubMode(env,'a@example.com',true);assert.equal(await usesOwnGithub(env,'a@example.com'),true);await setGithubMode(env,'b@example.com',false);assert.equal(await usesOwnGithub(env,'b@example.com'),false);
 db.exec(readFileSync(new URL('../scripts/collaborators-v100.sql',import.meta.url),'utf8'));assert.equal(await usesOwnGithub(env,'b@example.com'),false);db.close();
});

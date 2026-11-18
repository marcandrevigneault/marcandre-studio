import { beforeEach, describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../../workers/studio-admin/index.js';
let env: any;
beforeEach(() => {
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync('workers/studio-admin/schema.sql','utf8'));
  env = { ADMIN_KEY: 'test-only', DB: { prepare(sql: string) {
    const stmt=db.prepare(sql); let values: any[]=[];
    return { bind(...v:any[]) {values=v;return this;}, async first(){return stmt.get(...values)??null;}, async all(){return {results:stmt.all(...values)};}, async run(){const r=stmt.run(...values);return {meta:{changes:Number(r.changes)}};} };
  } } };
});
const call = (path: string, body?: any, method?: string) => worker.fetch(new Request('https://worker'+path,{method:method??(body?'POST':'GET'),headers:{authorization:'Bearer test-only','content-type':'application/json'},body:body?JSON.stringify(body):undefined}),env);
describe('private admin data service',()=>{
  it('rejects access without the server secret',async()=>{expect((await worker.fetch(new Request('https://worker/stats'),env)).status).toBe(401);});
  it('changes credentials with a revision check and never overwrites a newer password',async()=>{
    const hash='scrypt:'+ 'a'.repeat(32)+':'+ 'b'.repeat(128);
    expect((await call('/credentials',{hash,revision:'revision-1',expectedRevision:null},'PUT')).status).toBe(200);
    expect((await call('/credentials',{hash,revision:'revision-2',expectedRevision:'old'},'PUT')).status).toBe(409);
    expect((await (await call('/credentials')).json()).revision).toBe('revision-1');
    expect((await call('/credentials',{hash,revision:'revision-2',expectedRevision:'revision-1'},'PUT')).status).toBe(200);
  });
  it('counts real events, deduplicates retries and groups sessions without full URLs',async()=>{
    const session=crypto.randomUUID(),id=crypto.randomUUID();
    await call('/events',{id,session,path:'/projects/video-qr/'});await call('/events',{id,session,path:'/projects/video-qr/'});
    await call('/events',{id:crypto.randomUUID(),session,path:'/about/'});
    const result=await (await call('/stats?days=7')).json();expect(result.totalViews).toBe(2);expect(result.totalVisits).toBe(1);expect(result.daily).toHaveLength(7);expect(result.pages).toHaveLength(2);
    expect((await call('/events',{id:crypto.randomUUID(),session,path:'/admin/login?password=oops'})).status).toBe(400);
  });
  it('limits password attempts across calls',async()=>{
    for(let i=0;i<10;i++)expect((await (await call('/attempt',{key:'a'.repeat(64)})).json()).allowed).toBe(true);
    expect((await (await call('/attempt',{key:'a'.repeat(64)})).json()).allowed).toBe(false);
  });
});

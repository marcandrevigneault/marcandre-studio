import {beforeEach,describe,it,expect,vi} from 'vitest';
import {GET,POST} from '../pages/api/pages/[page]';
import {pageDocumentSchema} from './page-builder-schema';
const mocks=vi.hoisted(()=>({read:vi.fn(),write:vi.fn(),session:vi.fn(),service:vi.fn()}));
vi.mock('./page-builder-store',async importOriginal=>({...await importOriginal<any>(),pageBuilderStore:()=>({read:mocks.read,write:mocks.write})}));
vi.mock('./admin-service',()=>({currentSession:mocks.session,sameOrigin:(r:Request)=>r.headers.get('origin')===new URL(r.url).origin,adminService:mocks.service}));
const document=pageDocumentSchema.parse({version:1,blocks:[{id:'hero',type:'hero'}]});
const sha='a'.repeat(40),newSha='b'.repeat(40),revision=crypto.randomUUID();
let draft:any;
function request(method='POST',body:any={action:'publish',document,sha,draftRevision:revision},headers:any={},page='home') {return {params:{page},request:new Request('https://studio/api/pages/'+page,{method,headers:{origin:'https://studio','content-type':'application/json',...headers},...(method==='GET'?{}:{body:JSON.stringify(body)})})} as any;}
beforeEach(()=>{vi.resetAllMocks();draft={document,baseSha:sha,revision};mocks.session.mockResolvedValue(true);mocks.read.mockResolvedValue({published:document,sha});mocks.write.mockResolvedValue(newSha);mocks.service.mockImplementation(async(_path,body,method)=>{
 if(!method)return {draft};
 if(body.expectedRevision!==(draft?.revision??null))throw {status:409};
 if(method==='DELETE'){draft=null;return {ok:true};}
 draft={document:body.document,baseSha:body.baseSha,revision:body.revision};return {ok:true};
});});
describe('page API',()=>{
 it('requires current authentication for reads and writes',async()=>{mocks.session.mockResolvedValue(false);expect((await GET(request('GET'))).status).toBe(401);expect((await POST(request())).status).toBe(401);expect(mocks.service).not.toHaveBeenCalled();});
 it('rejects CSRF, unknown pages and unsupported content types',async()=>{expect((await POST(request('POST',{}, {origin:'https://evil'}))).status).toBe(403);expect((await GET(request('GET',undefined,{},'nope'))).status).toBe(404);expect((await POST(request('POST',{}, {'content-type':'text/plain'}))).status).toBe(415);});
 it('returns published and private draft without upgrading its baseline',async()=>{draft.baseSha=null;const response=await GET(request('GET'));expect(await response.json()).toEqual({published:document,sha,draft});expect(response.headers.get('cache-control')).toContain('no-store');expect(mocks.service).toHaveBeenCalledTimes(1);});
 it('rejects unsafe URLs, malformed revisions and oversized bodies',async()=>{
  for(const patch of [{document:{version:1,blocks:[{id:'x',type:'button',href:'javascript:alert(1)'}]}},{sha:'bad'},{draftRevision:'bad'},{sha:undefined}])expect((await POST(request('POST',{action:'draft',document,sha,draftRevision:revision,...patch}))).status).toBe(400);
  expect((await POST(request('POST',{x:'a'.repeat(250001)}))).status).toBe(413);expect(mocks.write).not.toHaveBeenCalled();
 });
 it('saves with exact draft revision and supplied baseline, including null',async()=>{const response=await POST(request('POST',{action:'draft',document,sha:null,draftRevision:revision}));expect(response.status).toBe(200);expect(await response.json()).toEqual({draftRevision:draft.revision});expect(draft.baseSha).toBeNull();expect(draft.revision).not.toBe(revision);});
 it('preserves newer drafts on stale saves and deletes',async()=>{const original=structuredClone(draft);for(const action of ['draft','discard'])expect((await POST(request('POST',{action,document,sha,draftRevision:crypto.randomUUID()}))).status).toBe(409);expect(draft).toEqual(original);});
 it('discards only the exact draft revision',async()=>{expect(await (await POST(request('POST',{action:'discard',draftRevision:revision}))).json()).toEqual({ok:true});expect(draft).toBeNull();});
 it('requires matching prepared revision, baseline and document before publishing',async()=>{
  for(const patch of [{draftRevision:null},{draftRevision:crypto.randomUUID()},{sha:null},{document:pageDocumentSchema.parse({version:1,blocks:[{id:'different',type:'text'}]})}])expect((await POST(request('POST',{action:'publish',document,sha,draftRevision:revision,...patch}))).status).toBe(409);
  expect(mocks.write).not.toHaveBeenCalled();
 });
 it('compares canonical parsed documents and advances the baseline after publishing',async()=>{const response=await POST(request('POST',{action:'publish',document:{blocks:[{type:'hero',id:'hero'}],version:1},sha,draftRevision:revision}));expect(response.status).toBe(200);expect(await response.json()).toEqual({sha:newSha,draftRevision:draft.revision});expect(draft.baseSha).toBe(newSha);expect(draft.revision).not.toBe(revision);});
 it('keeps the draft when GitHub fails or conflicts',async()=>{const original=structuredClone(draft);for(const status of [500,409,422]){mocks.write.mockRejectedValue({status});expect((await POST(request())).status).toBe(status===500?503:409);expect(draft).toEqual(original);}});
 it('preserves a newer draft saved while the GitHub write is in flight',async()=>{
  const newer={document:pageDocumentSchema.parse({version:1,blocks:[{id:'newer',type:'text'}]}),baseSha:sha,revision:crypto.randomUUID()};
  mocks.write.mockImplementation(async()=>{draft=structuredClone(newer);return newSha;});
  const response=await POST(request());
  expect(await response.json()).toEqual({sha:newSha,draftRevision:revision,draftConflict:true});
  expect(draft).toEqual(newer);
 });
 it.each([409,503])('reports publication success when subsequent draft CAS fails (%s)',async(status)=>{mocks.service.mockImplementation(async(_p,_b,method)=>{if(!method)return {draft};throw {status};});const response=await POST(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({sha:newSha,draftRevision:revision,draftConflict:true});expect(draft.revision).toBe(revision);});
});

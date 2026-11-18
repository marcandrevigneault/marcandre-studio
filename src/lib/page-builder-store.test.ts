import { describe, it, expect } from 'vitest';
import { makePageBuilderStore } from './page-builder-store';
import { pageDocumentSchema } from './page-builder-schema';
const document = pageDocumentSchema.parse({version:1,blocks:[{id:'title',type:'text'}]});
const sha = 'a'.repeat(40), next = 'b'.repeat(40);
function fixture(initial: any = null, conflict = 409) {
 let file = initial;
 const client = {rest:{repos:{
  async getContent({path,ref}:any) { expect(path).toBe('src/content/pages/home.json'); expect(ref).toBe('main'); if(!file)throw {status:404};return {data:{type:'file',sha:file.sha,content:Buffer.from(JSON.stringify(file.document)).toString('base64')}}; },
  async createOrUpdateFileContents({path,branch,sha:expected,content}:any) {expect(path).toBe('src/content/pages/home.json');expect(branch).toBe('main');if(expected!==(file?.sha??undefined))throw {status:conflict};file={sha:next,document:JSON.parse(Buffer.from(content,'base64').toString())};return {data:{content:{sha:next}}};}
 }}};
 return makePageBuilderStore(client as any,{owner:'owner',repo:'repo',branch:'main'});
}
describe('published pages',()=>{
 it('falls back on missing pages and persists canonical JSON',async()=>{const store=fixture();expect((await store.read('home')).sha).toBeNull();expect(await store.write('home',document,null)).toBe(next);expect(await store.read('home')).toEqual({published:document,sha:next});});
 it.each([409,422])('preserves content on stale or missing SHA (%s)',async(status)=>{const store=fixture({sha,document},status);for(const expected of [null,'c'.repeat(40)])await expect(store.write('home',document,expected)).rejects.toMatchObject({status:409});expect(await store.read('home')).toEqual({published:document,sha});});
 it('rejects unknown page paths and invalid revisions',async()=>{const store=fixture();await expect(store.read('../secret' as any)).rejects.toMatchObject({status:404});await expect(store.write('home',document,'invalid')).rejects.toMatchObject({status:400});});
});

import { describe, expect, it } from 'vitest';
import { pageDocumentSchema, newPageBlock } from './page-builder-schema';
describe('page builder documents',()=>{
 it('rejects executable URLs, raw styling, unknown fields and duplicate block IDs',()=>{
  const block=newPageBlock('image');
  for(const src of ['javascript:alert(1)','//evil.test/p.png','data:text/html,x','/\\evil.test'])expect(pageDocumentSchema.safeParse({version:1,blocks:[{...block,src}]}).success).toBe(false);
  expect(pageDocumentSchema.safeParse({version:1,blocks:[{...block,background:'url(evil)'}]}).success).toBe(false);
  expect(pageDocumentSchema.safeParse({version:1,blocks:[block,block]}).success).toBe(false);
  expect(pageDocumentSchema.safeParse({version:1,blocks:[{...block,html:'<script>bad</script>'}]}).success).toBe(false);
 });
 it('accepts safe bilingual blocks with bounded controls',()=>{
  const block=newPageBlock('hero');block.title={fr:'Bonjour',en:'Hello'};block.backgroundImage='https://media.example.com/a.jpg';
  expect(pageDocumentSchema.parse({version:1,blocks:[block]}).blocks[0].title.en).toBe('Hello');
  expect(pageDocumentSchema.safeParse({version:1,blocks:[{...block,padding:900}]}).success).toBe(false);
 });
});

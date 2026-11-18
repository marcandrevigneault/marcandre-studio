import { describe,it,expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PageBlocks from '../components/page-builder/PageBlocks';
import { defaultPage } from './page-builder-defaults';
import { pageDocumentSchema } from './page-builder-schema';
describe('public page builder rendering',()=>{
 it('preserves bilingual home content and inactive sections',()=>{
  const html=renderToStaticMarkup(createElement(PageBlocks,{document:defaultPage('home')}));
  expect(html).toContain('Un studio pour');expect(html).toContain('A studio for');expect(html).toContain('href="/projects/"');
  expect(html).not.toContain('href="/photography/"');expect(html).not.toContain('contenteditable');
 });
 it('escapes text instead of executing user HTML',()=>{
  const doc=defaultPage('about');doc.blocks[0].title.fr='<script>alert(1)</script>';
  const html=renderToStaticMarkup(createElement(PageBlocks,{document:doc}));expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');
 });
 it('does not render unsafe links while previewing an unsaved document',()=>{
  const doc=defaultPage('home');doc.blocks[1].items[2].href='javascript:alert(1)';doc.blocks[0].backgroundImage='javascript:alert(1)';
  const html=renderToStaticMarkup(createElement(PageBlocks,{document:doc}));expect(html).not.toContain('javascript:');
 });
 it('keeps all defaults schema-valid and distinct',()=>{for(const id of ['home','projects','about']as const)expect(pageDocumentSchema.safeParse(defaultPage(id)).success).toBe(true);});
});

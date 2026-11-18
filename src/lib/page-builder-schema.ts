import { z } from 'zod';
export const PAGE_IDS = ['home','projects','about'] as const;
export type PageId = typeof PAGE_IDS[number];
export type PageLanguage = 'fr' | 'en';
export const PAGE_PATHS: Record<PageId,string> = {home:'/',projects:'/projects/',about:'/about/'};
export function isPageId(value: unknown): value is PageId { return typeof value==='string' && (PAGE_IDS as readonly string[]).includes(value); }
const localized = z.object({fr:z.string().max(12000),en:z.string().max(12000)}).strict();
const empty = {fr:'',en:''};
export function safePageUrl(value: string, media = false) {
  if(value==='')return true;
  if(value.length>2048||/[\s\\\u0000-\u001f\u007f]/.test(value))return false;
  if(value.startsWith('/')&&!value.startsWith('//'))return true;
  if(!media && (/^#[\w-]+$/.test(value)||/^mailto:[^@]+@[^@]+$/.test(value)))return true;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
}
const link=z.string().refine(v=>safePageUrl(v),'Lien invalide : utilisez https:// ou un chemin du site.');
const media=z.string().refine(v=>safePageUrl(v,true),'Média invalide : utilisez https:// ou un chemin du site.');
const color=z.string().regex(/^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8})?$/);
const id=z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
export const pageItemSchema=z.object({id,title:localized.default(empty),text:localized.default(empty),src:media.default(''),alt:localized.default(empty),href:link.default(''),disabled:z.boolean().default(false)}).strict();
export const BLOCK_TYPES=['hero','text','image','video','button','columns','cards'] as const;
export const pageBlockSchema=z.object({
 id,type:z.enum(BLOCK_TYPES),title:localized.default(empty),text:localized.default(empty),eyebrow:localized.default(empty),buttonLabel:localized.default(empty),src:media.default(''),alt:localized.default(empty),href:link.default(''),backgroundImage:media.default(''),color:color.default(''),background:color.default(''),padding:z.number().int().min(0).max(160).default(40),align:z.enum(['left','center','right']).default('left'),width:z.enum(['normal','wide','full']).default('wide'),columns:z.number().int().min(2).max(4).default(2),items:z.array(pageItemSchema).max(20).default([]),
}).strict();
export const pageDocumentSchema=z.object({version:z.literal(1),blocks:z.array(pageBlockSchema).min(1).max(60)}).strict().superRefine((doc,ctx)=>{
 const ids=new Set<string>();for(const block of doc.blocks){for(const key of [block.id,...block.items.map(i=>i.id)]){if(ids.has(key))ctx.addIssue({code:'custom',message:'Chaque bloc doit avoir un identifiant unique.'});ids.add(key);}}
});
export type PageDocument=z.infer<typeof pageDocumentSchema>;
export type PageBlock=z.infer<typeof pageBlockSchema>;
export type PageItem=z.infer<typeof pageItemSchema>;
export type BlockType=typeof BLOCK_TYPES[number];
export function newPageBlock(type:BlockType):PageBlock {
 return pageBlockSchema.parse({id:crypto.randomUUID(),type,title:{fr:type==='hero'?'Votre titre':type==='text'?'Nouveau texte':'',en:type==='hero'?'Your title':type==='text'?'New text':''},text:{fr:type==='text'?'Écrivez votre texte ici.':'',en:type==='text'?'Write your text here.':''},buttonLabel:type==='button'?{fr:'En savoir plus',en:'Learn more'}:empty,items:type==='columns'||type==='cards'?[{id:crypto.randomUUID(),title:{fr:'Première colonne',en:'First column'}},{id:crypto.randomUUID(),title:{fr:'Deuxième colonne',en:'Second column'}}]:[]});
}

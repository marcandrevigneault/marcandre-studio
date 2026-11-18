import { pageDocumentSchema, type PageDocument, type PageId } from './page-builder-schema';
const l=(fr:string,en=fr)=>({fr,en});
const defaults:Record<PageId,unknown>={
 home:{version:1,blocks:[
  {id:'home-intro',type:'hero',padding:144,eyebrow:l('Photographe · Scientifique · Créateur','Photographer · Scientist · Maker'),title:l('Un studio pour\nce que j’aime créer.','A studio for\nthings I love to make.'),text:l('Photographie, art, projets et science se côtoient ici, chacun à sa façon. Entrez, prenez le temps.','Photography, art, projects and scientific writing — each gathered here in its own light. Wander in.')},
  {id:'home-sections',type:'cards',padding:0,columns:4,items:[
   {id:'home-photo',title:l('Photographie','Photography'),text:l('À venir','Coming soon'),href:'/photography/',disabled:true},
   {id:'home-art',title:l('Art'),text:l('À venir','Coming soon'),href:'/art/',disabled:true},
   {id:'home-projects',title:l('Projets','Projects'),text:l('Des expériences à essayer','Experiments you can try'),href:'/projects/'},
   {id:'home-science',title:l('Science'),text:l('À venir','Coming soon'),href:'/science/',disabled:true},
   {id:'home-video',title:l('Vidéo','Video'),text:l('À venir','Coming soon'),disabled:true},
   {id:'home-poetry',title:l('Poésie','Poetry'),text:l('À venir','Coming soon'),disabled:true},
   {id:'home-travel',title:l('Voyage','Travel'),text:l('À venir','Coming soon'),disabled:true},
  ]},
 ]},
 projects:{version:1,blocks:[
  {id:'projects-intro',type:'hero',padding:96,eyebrow:l('Projets','Projects'),title:l('Des idées qui prennent forme.','Ideas, put to work.'),text:l('De petites expériences. Des possibilités inattendues.','Small experiments. Unexpected possibilities.')},
  {id:'projects-video-qr',type:'columns',padding:32,columns:2,items:[
   {id:'projects-qr-image',src:'/examples/video-qr/poster.png',alt:l('Une image pixellisée de La Bête lumineuse','A pixelated frame from La Bête lumineuse'),href:'/projects/video-qr/'},
   {id:'projects-qr-copy',title:l('Un peu de cinéma dans un QR.','A little cinema in a QR.'),text:l('Compressez un extrait. Scannez le code. Retrouvez la vidéo.\n\nDécouvrir Vidéo QR →','Compress a clip. Scan the code. Watch it come back.\n\nExplore Video QR →'),href:'/projects/video-qr/'},
  ]},
 ]},
 about:{version:1,blocks:[
  {id:'about-intro',type:'hero',padding:96,width:'normal',eyebrow:l('À propos','About'),title:l('Marc-André Vigneault')},
  {id:'about-text',type:'text',padding:0,width:'normal',text:l('J’aime créer et explorer : photographie, vidéo, science, voyage et, à l’occasion, poésie. Ce studio rassemble tout ça.\n\nJ’aime comprendre comment les choses fonctionnent, autant qu’observer la lumière qui les révèle. Mes textes rendent la science accessible, de l’hydroponie à l’optique. Dans les galeries, je laisse les images parler.\n\nÉcrivez-moi un mot, ou prenez simplement le temps d’explorer.',"I'm a maker with a wide field of view — photography, video, science, travel, and the occasional poem. This is where those threads live together.\n\nBy day I'm drawn to how things work; by light I'm drawn to how they look. The science writing here is my attempt to explain ideas clearly — from hydroponics to optics — and the galleries are where I let images simply be.\n\nSay hello — or just look around.")},
  {id:'about-links',type:'columns',padding:32,width:'normal',columns:2,items:[{id:'about-email',title:l('Courriel','Email'),href:'mailto:marcandre.vigneault.96@gmail.com'},{id:'about-github',title:l('GitHub'),href:'https://github.com/marcandrevigneault'}]},
 ]},
};
export function defaultPage(id:PageId):PageDocument {return pageDocumentSchema.parse(defaults[id]);}

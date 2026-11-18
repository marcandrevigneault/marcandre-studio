import React, { useEffect, useRef, type CSSProperties } from 'react';
import { safePageUrl } from '../../lib/page-builder-schema';
import type { PageBlock, PageDocument, PageLanguage } from '../../lib/page-builder-schema';
import './page-blocks.css';
type Field='title'|'text'|'eyebrow'|'buttonLabel';
type Localized={fr:string;en:string};
function Copy({value,language='fr',editable=false,onChange,label}:{value:Localized;language?:PageLanguage;editable?:boolean;onChange?:(text:string)=>void;label?:string}) {
 const ref=useRef<HTMLSpanElement>(null);
 useEffect(()=>{if(editable&&ref.current&&document.activeElement!==ref.current)ref.current.textContent=value[language];},[value,language,editable]);
 if(!editable)return <span data-i18n-fr={value.fr} data-i18n-en={value.en}>{value[language]}</span>;
 return <span ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-label={label} aria-multiline="true" data-placeholder={label} onInput={event=>onChange?.(event.currentTarget.innerText)} onBlur={event=>{event.currentTarget.textContent=value[language];}} onPaste={event=>{
  event.preventDefault();const text=event.clipboardData.getData('text/plain');const selection=window.getSelection();if(!selection?.rangeCount)return;const range=selection.getRangeAt(0);if(!event.currentTarget.contains(range.commonAncestorContainer))return;range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);onChange?.(event.currentTarget.innerText);
 }} />;
}
export function BlockView({block:b,language='fr',editable=false,onTextChange,onItemChange}:{block:PageBlock;language?:PageLanguage;editable?:boolean;onTextChange?:(field:Field,value:string)=>void;onItemChange?:(itemId:string,field:'title'|'text',value:string)=>void}) {
 const source=(value:string)=>safePageUrl(value,true)?value:'';
 const link=(value:string)=>safePageUrl(value)?value:undefined;
 const has=(value:Localized)=>editable||!!value.fr||!!value.en;
 const copy=(field:Field,label:string)=><Copy value={b[field]} language={language} editable={editable} label={label} onChange={value=>onTextChange?.(field,value)}/>;
 const style={ '--page-block-padding':`${b.padding}px`,'--page-block-columns':b.columns,textAlign:b.align,...(b.color?{color:b.color,'--ink':b.color,'--muted':b.color}:{}),...(b.background?{backgroundColor:b.background,'--page-card-background':b.background}:{}),...(source(b.backgroundImage)?{backgroundImage:`url("${b.backgroundImage.replace(/"/g,'%22')}")`}:{}),} as CSSProperties;
 const text=<>{has(b.eyebrow)&&<p className="page-block-eyebrow">{copy('eyebrow','Sous-titre')}</p>}{has(b.title)&&(b.type==='hero'?<h1>{copy('title','Titre')}</h1>:<h2>{copy('title','Titre')}</h2>)}{has(b.text)&&<div className="page-block-text">{copy('text','Texte')}</div>}</>;
 const action=has(b.buttonLabel)&&<a className="page-block-button" href={editable?undefined:link(b.href)||undefined} aria-disabled={!b.href||undefined}>{copy('buttonLabel','Texte du bouton')}</a>;
 return <section className={`page-block page-block-${b.type} page-block-width-${b.width}`} style={style} data-page-block-id={b.id}>
  <div className="page-block-inner">
   {b.type==='hero'||b.type==='text'?<>{text}{b.href||b.buttonLabel.fr||b.buttonLabel.en?action:null}</>:null}
   {b.type==='button'?action:null}
   {b.type==='image'?<figure>{source(b.src)?<img src={source(b.src)} alt={b.alt[language]} data-i18n-fr-alt={b.alt.fr} data-i18n-en-alt={b.alt.en} loading="lazy"/>:editable?<div className="page-media-empty">Choisissez une image dans les réglages.</div>:null}{has(b.text)&&<figcaption>{copy('text','Légende')}</figcaption>}</figure>:null}
   {b.type==='video'?<>{source(b.src)?<video src={source(b.src)} controls={!editable} preload="metadata" playsInline aria-label={b.alt[language]} data-i18n-fr-aria-label={b.alt.fr} data-i18n-en-aria-label={b.alt.en}/>:editable?<div className="page-media-empty">Ajoutez une adresse de vidéo MP4 ou WebM.</div>:null}{has(b.text)&&<div className="page-block-text">{copy('text','Légende')}</div>}</>:null}
   {b.type==='columns'||b.type==='cards'?<>{(b.title.fr||b.title.en)&&<h2>{copy('title','Titre')}</h2>}<div className="page-block-grid">{b.items.map(item=>{
    const Tag=item.href&&link(item.href)&&!item.disabled&&!editable?'a':'div';return <Tag key={item.id} href={Tag==='a'?link(item.href):undefined} className={`page-block-item${item.disabled?' is-unavailable':''}`} aria-disabled={item.disabled||undefined}>
     {source(item.src)&&<img src={source(item.src)} alt={item.alt[language]} data-i18n-fr-alt={item.alt.fr} data-i18n-en-alt={item.alt.en} loading="lazy"/>}
     {has(item.title)&&<h3><Copy value={item.title} language={language} editable={editable} label="Titre de la carte" onChange={value=>onItemChange?.(item.id,'title',value)}/></h3>}
     {has(item.text)&&<div className="page-block-text"><Copy value={item.text} language={language} editable={editable} label="Texte de la carte" onChange={value=>onItemChange?.(item.id,'text',value)}/></div>}
    </Tag>;
   })}</div></>:null}
  </div>
 </section>;
}
export default function PageBlocks({document,language='fr'}:{document:PageDocument;language?:PageLanguage}) {return <div className="page-blocks">{document.blocks.map(block=><BlockView key={block.id} block={block} language={language}/>)}</div>;}

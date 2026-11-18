import { useEffect, useRef, useState, useId, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { BLOCK_TYPES, newPageBlock, pageDocumentSchema, pageItemSchema, safePageUrl, type BlockType, type PageBlock, type PageDocument, type PageId, type PageItem, type PageLanguage } from '../../lib/page-builder-schema';
import { BlockView } from './PageBlocks';
import './builder.css';

const labels: Record<BlockType, string> = { hero: 'Bannière', text: 'Texte', image: 'Image', video: 'Vidéo', button: 'Bouton', columns: 'Colonnes', cards: 'Cartes' };
const mediaChoices = ['/examples/video-qr/la-bete-lumineuse-3662-7.jpg', '/examples/video-qr/poster.png'];
const serialize = (document: PageDocument) => JSON.stringify(document);
type Snapshot = { published: PageDocument; sha: string | null; draft: null | { document: PageDocument; baseSha: string | null; revision: string } };
type History = { past: PageDocument[]; current: PageDocument; future: PageDocument[] };
type TextField = 'title' | 'text' | 'eyebrow' | 'buttonLabel' | 'alt';
class RequestError extends Error { constructor(message: string, readonly status = 0) { super(message); } }
async function request<T>(pageId: PageId, body?: unknown): Promise<T> {
  const response = await fetch(`/api/pages/${pageId}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof result?.error === 'string' ? result.error : '';
    throw new RequestError(response.status === 409 ? 'Conflit : une autre version existe. Votre contenu local est conservé. Rechargez seulement après avoir copié vos changements.' : response.status === 400 ? `Validation refusée. ${detail}` : response.status === 503 ? 'Service indisponible. Votre contenu local est conservé; réessayez plus tard.' : `Requête refusée (${response.status}). ${detail}`, response.status);
  }
  if (!result) throw new RequestError('Réponse illisible. Votre contenu local est conservé.');
  return result as T;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id=useId();
  return <div className="pb-field"><label htmlFor={id}>{label}</label>{isValidElement(children)?cloneElement(children as ReactElement<{id?:string}>,{id}):children}</div>;
}
function SortableBlock({ block, selected, index, count, onSelect, move, duplicate, remove, children }: { block: PageBlock; selected: boolean; index: number; count: number; onSelect: () => void; move: (offset: number) => void; duplicate: () => void; remove: () => void; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return <div ref={setNodeRef} className={`pb-block${selected ? ' pb-selected' : ''}${isDragging ? ' pb-dragging' : ''}`} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})` : undefined, transition }} onClick={onSelect} onFocus={onSelect}>
    <div className="pb-block-tools" aria-label={`Actions du bloc ${index + 1}`}>
      <button type="button" className="pb-handle" {...attributes} {...listeners} aria-label={`Déplacer le bloc ${index + 1} : ${labels[block.type]}`}>⠿</button>
      <button type="button" onClick={onSelect} aria-pressed={selected}>{index + 1}. {labels[block.type]}</button>
      <button type="button" disabled={index === 0} onClick={() => move(-1)} aria-label="Monter le bloc">↑</button>
      <button type="button" disabled={index === count - 1} onClick={() => move(1)} aria-label="Descendre le bloc">↓</button>
      <button type="button" disabled={count >= 60} onClick={event => { event.stopPropagation(); duplicate(); }}>Dupliquer</button>
      <button type="button" disabled={count <= 1} onClick={event => { event.stopPropagation(); remove(); }}>Supprimer</button>
    </div>
    {children}
  </div>;
}
function Settings({ block, language, update }: { block: PageBlock; language: PageLanguage; update: (patch: Partial<PageBlock>) => void }) {
  const text = (field: TextField, label: string) => <Field key={field} label={`${label} (${language.toUpperCase()})`}><textarea rows={field === 'text' ? 4 : 2} maxLength={12000} value={block[field][language]} onChange={e => update({ [field]: { ...block[field], [language]: e.target.value } })} /></Field>;
  const url = (field: 'src' | 'href' | 'backgroundImage', label: string) => <Field label={label}><input type="text" inputMode="url" value={block[field]} aria-invalid={!safePageUrl(block[field], field !== 'href')} onChange={e => update({ [field]: e.target.value })} /></Field>;
  const itemUpdate = (id: string, patch: Partial<PageItem>) => update({ items: block.items.map(item => item.id === id ? { ...item, ...patch } : item) });
  return <>
    <h2>Réglages · {labels[block.type]}</h2>
    <p className="pb-hint">Cliquez aussi sur le texte dans la page pour le modifier.</p>
    {(block.type === 'hero' || block.type === 'text') && <>{text('eyebrow', 'Sous-titre')}{text('title', 'Titre')}{text('text', 'Texte')}</>}
    {(block.type === 'cards' || block.type === 'columns') && text('title', 'Titre')}
    {(block.type === 'image' || block.type === 'video') && text('text', 'Légende')}
    {(block.type === 'hero' || block.type === 'text' || block.type === 'button') && <>{text('buttonLabel', 'Texte du bouton')}{url('href', 'Lien du bouton (https://, /page ou #ancre)')}</>}
    {(block.type === 'image' || block.type === 'video') && <>{url('src', 'Adresse du média')}{text('alt', 'Description du média')}{block.type === 'image' && <MediaPicker choose={src => update({ src })} />}</>}
    <details open><summary>Apparence</summary>
      {url('backgroundImage', 'Image de fond (URL)')}<MediaPicker choose={backgroundImage => update({ backgroundImage })} />
      <Field label="Couleur du texte (hexadécimal)"><input placeholder="#18212b" value={block.color} onChange={e => update({ color: e.target.value })} /></Field>
      <Field label="Couleur de fond (hexadécimal)"><input placeholder="#ffffff" value={block.background} onChange={e => update({ background: e.target.value })} /></Field>
      <Field label={`Espacement intérieur : ${block.padding} px`}><input type="range" min="0" max="160" step="1" value={block.padding} onChange={e => update({ padding: Number(e.target.value) })} /></Field>
      <Field label="Alignement"><select value={block.align} onChange={e => update({ align: e.target.value as PageBlock['align'] })}><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></Field>
      <Field label="Largeur"><select value={block.width} onChange={e => update({ width: e.target.value as PageBlock['width'] })}><option value="normal">Normale</option><option value="wide">Large</option><option value="full">Pleine largeur</option></select></Field>
    </details>
    {(block.type === 'columns' || block.type === 'cards') && <details open><summary>Cartes et colonnes</summary>
      <Field label="Nombre de colonnes"><select value={block.columns} onChange={e => update({ columns: Number(e.target.value) })}>{[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
      {block.items.map((item, i) => <fieldset className="pb-item" key={item.id}><legend>Élément {i + 1}</legend>
        {(['title', 'text', 'alt'] as const).map(field => <Field key={field} label={`${field === 'title' ? 'Titre' : field === 'text' ? 'Texte' : 'Description de l’image'} (${language.toUpperCase()})`}><textarea rows={2} maxLength={12000} value={item[field][language]} onChange={e => itemUpdate(item.id, { [field]: { ...item[field], [language]: e.target.value } })} /></Field>)}
        <Field label="Image (URL)"><input value={item.src} aria-invalid={!safePageUrl(item.src, true)} onChange={e => itemUpdate(item.id, { src: e.target.value })} /></Field>
        <MediaPicker choose={src => itemUpdate(item.id, { src })} />
        <Field label="Lien"><input value={item.href} aria-invalid={!safePageUrl(item.href)} onChange={e => itemUpdate(item.id, { href: e.target.value })} /></Field>
        <label className="pb-check"><input type="checkbox" checked={item.disabled} onChange={e => itemUpdate(item.id, { disabled: e.target.checked })} /> Désactiver cet élément</label>
        <button type="button" onClick={() => update({ items: block.items.filter(other => other.id !== item.id) })}>Supprimer cet élément</button>
      </fieldset>)}
      <button type="button" disabled={block.items.length >= 20} onClick={() => update({ items: [...block.items, pageItemSchema.parse({ id: crypto.randomUUID() })] })}>Ajouter un élément</button>
    </details>}
  </>;
}
function MediaPicker({ choose }: { choose: (url: string) => void }) {
  return <details className="pb-media"><summary>Médias disponibles</summary><div>{mediaChoices.map((src, i) => <button type="button" key={src} onClick={() => choose(src)} aria-label={`Utiliser ${i ? 'l’affiche vidéo' : 'La Bête lumineuse'}`}><img src={src} alt={i ? 'Affiche vidéo' : 'La Bête lumineuse'} loading="lazy" /></button>)}</div></details>;
}

export default function PageBuilder({ pageId }: { pageId: PageId }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [history, setHistory] = useState<History | null>(null);
  const [saved, setSaved] = useState('');
  const [sha, setSha] = useState<string | null>(null);
  const [revision, setRevision] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [language, setLanguage] = useState<PageLanguage>('fr');
  const [mobile, setMobile] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [publishedHere, setPublishedHere] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const autoOpened = useRef(false);
  const leaving = useRef(false);
  const opener = useRef<HTMLButtonElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const dirty = !!history && serialize(history.current) !== saved;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const selected = history?.current.blocks.find(block => block.id === selectedId);

  useEffect(() => {
    if (!editing) return;
    // Keep the published DOM intact and restore the exact pre-editor state.
    const published = [...document.querySelectorAll<HTMLElement>('[data-page-published]')].map(node => ({ node, hidden: node.hidden, display: node.style.getPropertyValue('display'), priority: node.style.getPropertyPriority('display') }));
    const languageButtons = [...document.querySelectorAll<HTMLElement>('[data-set-language]')].map(node => ({ node, disabled: node.getAttribute('disabled'), aria: node.getAttribute('aria-disabled'), inert: node.inert }));
    published.forEach(({ node }) => { node.hidden = true; node.style.setProperty('display', 'none', 'important'); });
    languageButtons.forEach(({ node }) => { node.setAttribute('disabled', ''); node.setAttribute('aria-disabled', 'true'); node.inert = true; });
    const preventLanguage = (event: Event) => { if (event.target instanceof Element && event.target.closest('[data-set-language]')) { event.preventDefault(); event.stopImmediatePropagation(); } };
    document.addEventListener('click', preventLanguage, true);
    const sizeToolbar = () => toolbar.current?.parentElement?.style.setProperty('--pb-toolbar-height', `${toolbar.current.offsetHeight}px`);
    sizeToolbar();
    const observer = new ResizeObserver(sizeToolbar);
    if (toolbar.current) observer.observe(toolbar.current);
    toolbar.current?.focus();
    return () => {
      observer.disconnect();
      published.forEach(({ node, hidden, display, priority }) => { node.hidden = hidden; if (display) node.style.setProperty('display', display, priority); else node.style.removeProperty('display'); });
      languageButtons.forEach(({ node, disabled, aria, inert }) => { if (disabled === null) node.removeAttribute('disabled'); else node.setAttribute('disabled', disabled); if (aria === null) node.removeAttribute('aria-disabled'); else node.setAttribute('aria-disabled', aria); node.inert = inert; });
      document.removeEventListener('click', preventLanguage, true);
      opener.current?.focus();
    };
  }, [editing]);
  useEffect(() => {
    if (!editing || (!dirty && !busy)) return;
    const warn = (event: BeforeUnloadEvent) => { if (!leaving.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing, dirty, busy]);
  useEffect(() => { if (!autoOpened.current && new URLSearchParams(window.location.search).get('builder') === '1') { autoOpened.current = true; void open(); } }, []);

  function applySnapshot(snapshot: Snapshot) {
    const document = pageDocumentSchema.parse(snapshot.draft ? snapshot.draft.document : snapshot.published);
    setHistory({ past: [], current: document, future: [] }); setSaved(serialize(document)); setConflicted(false);
    setSha(snapshot.draft ? snapshot.draft.baseSha : snapshot.sha); setRevision(snapshot.draft?.revision ?? null);
    setSelectedId(document.blocks[0]?.id ?? null);
    setStatus(snapshot.draft ? 'Brouillon chargé · non publié' : 'Version publiée chargée');
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); } catch (cause) { if (cause instanceof RequestError && cause.status === 409) setConflicted(true); setError(cause instanceof Error ? cause.message : 'Erreur réseau. Votre contenu local est conservé.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function open() {
    await run(async () => { leaving.current = false; applySnapshot(await request<Snapshot>(pageId)); setLanguage(document.documentElement.lang.startsWith('en') ? 'en' : 'fr'); setEditing(true); });
  }
  function change(transform: (document: PageDocument) => PageDocument) {
    if (lock.current) return;
    setHistory(previous => {
      if (!previous) return previous;
      const next = transform(previous.current);
      if (serialize(next) === serialize(previous.current)) return previous;
      return { past: [...previous.past, previous.current].slice(-60), current: next, future: [] };
    });
  }
  function updateBlock(id: string, patch: Partial<PageBlock>) { change(doc => ({ ...doc, blocks: doc.blocks.map(block => block.id === id ? { ...block, ...patch } : block) })); }
  function travel(direction: 'undo' | 'redo') {
    if (lock.current) return;
    setHistory(previous => {
      if (!previous) return previous;
      if (direction === 'undo' && previous.past.length) return { past: previous.past.slice(0, -1), current: previous.past[previous.past.length - 1], future: [previous.current, ...previous.future].slice(0, 60) };
      if (direction === 'redo' && previous.future.length) return { past: [...previous.past, previous.current].slice(-60), current: previous.future[0], future: previous.future.slice(1) };
      return previous;
    });
  }
  function validatedDocument() {
    const result = pageDocumentSchema.safeParse(history?.current);
    if (!result.success) throw new Error(`Corrigez les champs avant d’enregistrer : ${result.error.issues.slice(0, 4).map(issue => `${issue.path.join('.')} — ${issue.message}`).join(' ; ')}`);
    return result.data;
  }
  async function saveDraft(document: PageDocument) {
    try {
      const result = await request<{ draftRevision: string }>(pageId, { action: 'draft', document, sha, draftRevision: revision });
      if (typeof result.draftRevision !== 'string') throw new RequestError('Réponse de sauvegarde incomplète.');
      setRevision(result.draftRevision); setSaved(serialize(document)); return result.draftRevision;
    } catch (cause) {
      // A lost response may hide a successful save. Only acknowledge an exact match;
      // never adopt an unrelated revision or a newer publication base on retry.
      if (!(cause instanceof RequestError) || !cause.status || cause.status >= 500) {
        const remote = await request<Snapshot>(pageId).catch(() => null);
        if (remote?.draft && remote.draft.baseSha === sha && serialize(pageDocumentSchema.parse(remote.draft.document)) === serialize(document)) {
          setRevision(remote.draft.revision); setSaved(serialize(document)); return remote.draft.revision;
        }
      }
      throw cause;
    }
  }
  function save(publish = false) {
    if (conflicted) return;
    void run(async () => {
      const document = validatedDocument();
      const draftRevision = await saveDraft(document);
      setStatus('Brouillon enregistré · non publié');
      if (!publish) return;
      const result = await request<{ sha: string; draftRevision: string; draftConflict?: boolean }>(pageId, { action: 'publish', document, sha, draftRevision });
      if (typeof result.sha !== 'string' || typeof result.draftRevision !== 'string') throw new RequestError('Réponse de publication incomplète. Vérifiez la version en ligne avant de réessayer.');
      setSha(result.sha); if (!result.draftConflict) setRevision(result.draftRevision); setPublishedHere(true);
      setStatus('Publication lancée · mise en ligne après reconstruction du site (environ une minute)');
      if (result.draftConflict) { setConflicted(true); setError('La page est publiée, mais le brouillon a changé ailleurs. Votre contenu local est conservé. Rechargez avant de poursuivre.'); }
    });
  }
  function reload() {
    if (!window.confirm('Recharger la version du serveur ? Le contenu local et l’historique seront remplacés. Copiez vos changements avant de continuer.')) return;
    void run(async () => applySnapshot(await request<Snapshot>(pageId)));
  }
  function discard() {
    if (conflicted) return;
    if (!window.confirm('Supprimer le brouillon et abandonner vos changements locaux pour revenir à la dernière publication ?')) return;
    void run(async () => {
      if (revision !== null) await request(pageId, { action: 'discard', draftRevision: revision });
      setRevision(null);
      applySnapshot(await request<Snapshot>(pageId));
      setStatus('Brouillon supprimé · dernière version du serveur chargée');
    });
  }
  function close() {
    if (lock.current || (dirty && !window.confirm('Quitter sans enregistrer les changements locaux ?'))) return;
    leaving.current = true; setEditing(false); setError('');
    const url = new URL(window.location.href); url.searchParams.delete('builder');
    if (publishedHere) window.location.replace(url.toString());
    else window.history.replaceState(null, '', url.toString());
  }
  if (!editing || !history) return <div className="pb-launcher"><button ref={opener} type="button" disabled={busy} onClick={() => void open()}>{busy ? 'Chargement…' : 'Modifier la page'}</button>{error && <p role="alert">{error}</p>}</div>;
  return <div className="pb-editor">
    <div ref={toolbar} tabIndex={-1} className="pb-toolbar" role="region" aria-label="Éditeur de page">
      <div className="pb-toolbar-row"><strong>Modifier · {pageId === 'home' ? 'Accueil' : pageId === 'projects' ? 'Projets' : 'À propos'}</strong>
        <button type="button" disabled={busy || !history.past.length} onClick={() => travel('undo')}>Annuler</button><button type="button" disabled={busy || !history.future.length} onClick={() => travel('redo')}>Rétablir</button>
        <label className="pb-language">Langue <select aria-label="Langue du contenu" value={language} disabled={busy} onChange={e => setLanguage(e.target.value as PageLanguage)}><option value="fr">FR</option><option value="en">EN</option></select></label>
        <button type="button" aria-pressed={mobile} onClick={() => setMobile(!mobile)}>Mobile 375 px</button>
        <button type="button" aria-expanded={settingsOpen} aria-controls="pb-settings" onClick={() => setSettingsOpen(!settingsOpen)}>Réglages</button>
        <button type="button" disabled={busy || conflicted} onClick={() => save()}>Enregistrer le brouillon</button><button className="pb-primary" type="button" disabled={busy || conflicted} onClick={() => save(true)}>Publier</button><button type="button" disabled={busy} onClick={close}>Quitter</button>
      </div>
      <div className="pb-palette" aria-label="Ajouter un bloc"><span>Ajouter :</span>{BLOCK_TYPES.map(type => <button type="button" key={type} disabled={busy || history.current.blocks.length >= 60} onClick={() => { const block = newPageBlock(type); change(doc => ({ ...doc, blocks: [...doc.blocks, block] })); setSelectedId(block.id); }}>+ {labels[type]}</button>)}</div>
      <p className="pb-status" role="status">{busy ? 'Opération en cours…' : dirty ? 'Modifications locales non enregistrées' : status}</p>
      {error && <p className="pb-error" role="alert">{error}</p>}
    </div>
    <div className={`pb-workspace${settingsOpen ? ' pb-with-settings' : ''}`}>
      <div className="pb-stage" aria-busy={busy}>
        <div className={`pb-canvas${mobile ? ' pb-mobile' : ''}`} inert={busy} onClickCapture={event => { if (event.target instanceof Element && event.target.closest('a')) event.preventDefault(); }} onAuxClickCapture={event => event.preventDefault()}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (over && active.id !== over.id) change(doc => ({ ...doc, blocks: arrayMove(doc.blocks, doc.blocks.findIndex(b => b.id === active.id), doc.blocks.findIndex(b => b.id === over.id)) })); }}>
            <SortableContext items={history.current.blocks.map(block => block.id)} strategy={verticalListSortingStrategy}>
              {history.current.blocks.map((block, index) => <SortableBlock key={block.id} block={block} selected={block.id === selectedId} index={index} count={history.current.blocks.length} onSelect={() => setSelectedId(block.id)} move={offset => change(doc => ({ ...doc, blocks: arrayMove(doc.blocks, index, index + offset) }))} duplicate={() => { const copy = { ...structuredClone(block), id: crypto.randomUUID(), items: block.items.map(item => ({ ...structuredClone(item), id: crypto.randomUUID() })) }; change(doc => ({ ...doc, blocks: [...doc.blocks.slice(0, index + 1), copy, ...doc.blocks.slice(index + 1)] })); setSelectedId(copy.id); }} remove={() => { change(doc => ({ ...doc, blocks: doc.blocks.filter(b => b.id !== block.id) })); setSelectedId(history.current.blocks[index + 1]?.id ?? history.current.blocks[index - 1]?.id ?? null); }}>
                <BlockView key={language} block={{ ...block, src: safePageUrl(block.src, true) ? block.src : '', href: safePageUrl(block.href) ? block.href : '', backgroundImage: safePageUrl(block.backgroundImage, true) ? block.backgroundImage : '', items: block.items.map(item => ({ ...item, src: safePageUrl(item.src, true) ? item.src : '', href: safePageUrl(item.href) ? item.href : '' })) }} language={language} editable onTextChange={(field, value) => updateBlock(block.id, { [field]: { ...block[field], [language]: value } })} onItemChange={(id, field, value) => updateBlock(block.id, { items: block.items.map(item => item.id === id ? { ...item, [field]: { ...item[field], [language]: value } } : item) })} />
              </SortableBlock>)}
            </SortableContext>
          </DndContext>
        </div>
      </div>
      {settingsOpen && <aside id="pb-settings" className="pb-settings" aria-label="Réglages du bloc" inert={busy}>
        {selected ? <Settings key={`${selected.id}-${language}`} block={selected} language={language} update={patch => updateBlock(selected.id, patch)} /> : <p>Sélectionnez un bloc dans la page.</p>}
        <div className="pb-document-actions"><button type="button" onClick={reload}>Recharger depuis le serveur</button><button type="button" disabled={conflicted} onClick={discard}>Abandonner le brouillon</button><p className="pb-hint">Enregistrer conserve un brouillon privé. Seul « Publier » modifie la page publique.</p></div>
      </aside>}
    </div>
  </div>;
}

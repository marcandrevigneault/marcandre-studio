import { visitorView } from '../lib/visitor-view';
import type { ArticleEdit, ArticleLanguage } from '../lib/article-editing';

const session = fetch('/api/auth/session', { cache: 'no-store' }).then(response => response.json());
document.querySelectorAll<HTMLElement>('[data-article-editor]').forEach(initialize);
function initialize(root: HTMLElement) {
  const article = root.closest<HTMLElement>('[data-editable-region]') ?? document.querySelector<HTMLElement>('article.article')!;
  const bodyContainer = article.querySelector<HTMLElement>('[data-article-body]')!;
  const form = root.querySelector<HTMLFormElement>('form')!;
  const opener = root.querySelector<HTMLButtonElement>('.editor-open')!;
  const login = root.querySelector<HTMLAnchorElement>('.editor-login')!;
  const hint = root.querySelector<HTMLElement>('.editor-hint')!;
  const status = root.querySelector<HTMLElement>('.editor-status')!;
  const preview = root.querySelector<HTMLElement>('.preview-panel')!;
  const fields = Object.fromEntries(['title', 'subtitle', 'summary', 'body'].map(key => [key, form.elements.namedItem(key)])) as Record<keyof ArticleEdit, HTMLInputElement | HTMLTextAreaElement>;
  let authenticated = false, busy = false, baseline = '', sha: string | null = null;
  let editLanguage: ArticleLanguage = 'fr';
  const language = (): ArticleLanguage => document.documentElement.lang === 'en' ? 'en' : 'fr';
  const say = (fr: string, en: string) => language() === 'fr' ? fr : en;
  const draft = (): ArticleEdit => ({ title: fields.title.value, subtitle: fields.subtitle.value, summary: fields.summary.value, body: fields.body.value });
  const dirty = () => !form.hidden && JSON.stringify(draft()) !== baseline;
  const url = () => `/api/articles/${encodeURIComponent(root.dataset.articleEditor!)}?lang=${editLanguage}`;
  function message(text: string, error = false) { status.textContent = text; status.dataset.error = String(error); }
  function setBusy(value: boolean) {
    busy = value;
    root.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.disabled = value);
    // Prevent edits arriving after the saved snapshot was captured.
    Object.values(fields).forEach(field => field.readOnly = value);
  }
  function lockLanguage(value: boolean) {
    if (value) document.documentElement.dataset.articleEditingLanguage = editLanguage;
    else delete document.documentElement.dataset.articleEditingLanguage;
    document.querySelectorAll<HTMLButtonElement>('[data-set-language]').forEach(b => b.disabled = value); }
  function loginLink() {
    const target = new URL(location.href); target.searchParams.set('edit', root.dataset.articleEditor!); target.searchParams.set('lang', language());
    login.href = `/admin/login?returnTo=${encodeURIComponent(target.pathname + target.search)}`;
  }
  login.addEventListener('click', loginLink);
  async function responseData(response: Response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) { login.hidden = false; loginLink(); throw new Error(say('Session expirée. Reconnectez-vous dans un autre onglet, puis réessayez. Votre texte reste ici.', 'Session expired. Sign in in another tab, then retry. Your text remains here.')); }
      if (response.status === 409) throw new Error(say('Une version plus récente existe. Copiez votre texte avant de recharger la page. Aucun changement n’a été écrasé.', 'A newer version exists. Copy your text before reloading. No changes were overwritten.'));
      throw new Error(say(response.status === 400 ? 'Vérifiez le titre et la longueur des champs. Votre texte reste ici.' : 'Le service est indisponible. Votre texte reste ici ; réessayez dans un instant.', data.error || 'Could not reach the server. Your text is preserved.'));
    }
    return data;
  }
  async function open() {
    if (busy || !form.hidden) return;
    if (!authenticated) return;
    if (document.querySelector('[data-editor-active]')) { message(say('Enregistrez ou annulez le texte déjà ouvert avant d’en modifier un autre.', 'Save or cancel the open text before editing another section.')); return; }
    root.dataset.editorActive = 'true';
    editLanguage = language(); setBusy(true); message(say('Chargement de la dernière version…', 'Loading the latest version…'));
    try {
      const data = await responseData(await fetch(url(), { cache: 'no-store' }));
      for (const key of Object.keys(fields) as (keyof ArticleEdit)[]) fields[key].value = data[key];
      sha = data.sha; baseline = JSON.stringify(draft());
      root.querySelector('.editor-language')!.textContent = editLanguage === 'fr' ? 'Français' : 'English';
      fields.body.lang = editLanguage; form.hidden = false; bodyContainer.hidden = true; preview.hidden = true;
      opener.hidden = true; hint.hidden = true; lockLanguage(true); message(''); fields.body.focus();
    } catch (error) { delete root.dataset.editorActive; message(error instanceof Error ? error.message : 'Connection error', true); }
    finally { setBusy(false); }
  }
  function close() {
    delete root.dataset.editorActive;
    form.hidden = true; bodyContainer.hidden = false; opener.hidden = false; hint.hidden = false; lockLanguage(false); opener.focus();
  }
  opener.addEventListener('click', open);
  article.addEventListener('dblclick', event => {
    const target = event.target as HTMLElement;
    if (!target.closest('a,button,input,textarea,.inline-editor') && target.closest('.head,[data-article-body],[data-article-title],[data-article-subtitle],[data-article-summary]')) void open();
  });
  root.querySelector('.editor-cancel')!.addEventListener('click', () => {
    if (busy || (dirty() && !confirm(say('Abandonner les modifications non enregistrées ?', 'Discard unsaved changes?')))) return;
    close(); message('');
  });
  function showPreview(data: ArticleEdit, html: string) {
    root.querySelector('.preview-title')!.textContent = data.title;
    root.querySelector('.preview-subtitle')!.textContent = data.subtitle;
    root.querySelector('.preview-body')!.innerHTML = html; // Sanitized Markdown returned by our authenticated API.
    preview.hidden = false;
  }
  async function submit(action: 'preview' | 'publish') {
    if (busy || !form.reportValidity()) return;
    const data = draft(); setBusy(true); message(say(action === 'preview' ? 'Préparation de l’aperçu…' : 'Enregistrement…', action === 'preview' ? 'Preparing preview…' : 'Saving…'));
    try {
      const result = await responseData(await fetch(url(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...data, sha, action }) }));
      if (action === 'preview') { showPreview(data, result.html); message(say('Aperçu seulement — rien n’est publié.', 'Preview only — nothing has been published.')); }
      else {
        sha = result.sha; baseline = JSON.stringify(data);
        const body = bodyContainer.querySelector<HTMLElement>(`[data-language-content="${editLanguage}"]`);
        if (body) body.innerHTML = result.html;
        for (const key of ['title', 'subtitle', 'summary'] as const) {
          const element = article.querySelector<HTMLElement>(`[data-article-${key}] [data-i18n-fr]`);
          if (element) { element.setAttribute(`data-i18n-${editLanguage}`, data[key]); if (language() === editLanguage) element.textContent = data[key]; }
        }
        document.dispatchEvent(new Event('studio:article-updated'));
        close(); message(say('Enregistré. La publication est en cours ; les visiteurs verront la nouvelle version après la reconstruction du site.', 'Saved. Publishing is underway; visitors will see the update after the site rebuilds.'));
      }
    } catch (error) { message(error instanceof Error ? error.message : say('Échec de l’enregistrement. Votre texte reste ici.', 'Save failed. Your text remains here.'), true); }
    finally { setBusy(false); }
  }
  root.querySelector('.editor-preview')!.addEventListener('click', () => void submit('preview'));
  form.addEventListener('submit', event => { event.preventDefault(); void submit('publish'); });
  form.addEventListener('input', () => { preview.hidden = true; });
  window.addEventListener('beforeunload', event => { if (dirty() || busy) { event.preventDefault(); event.returnValue = ''; } });
  loginLink();
  session.then(data => {
    authenticated = data.authenticated === true && !visitorView();
    if (authenticated) {
      login.hidden = true; opener.hidden = false; hint.hidden = false;
      const requested = new URL(location.href).searchParams.get('edit');
      if (requested === root.dataset.articleEditor || (requested === '1' && !root.closest('[data-editable-region]'))) void open();
    }
  }).catch(() => { /* Editing stays hidden unless an administrator session is confirmed. */ });
}

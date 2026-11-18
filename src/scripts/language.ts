type Language = 'fr' | 'en';
const valid = (value: string | null): value is Language => value === 'fr' || value === 'en';
const query = new URL(location.href).searchParams.get('lang');
let stored: string | null = null;
try { stored = localStorage.getItem('studio-language'); } catch { /* Storage can be disabled. */ }
// Keep existing shared article links pointing at the visible translated section.
const headingPairs: { fr: HTMLElement; en: HTMLElement; anchor: string; frenchAnchor: string }[] = [];
function refreshHeadingPairs() {
  headingPairs.length = 0;
  const frenchBody = document.querySelector('[data-language-content="fr"]');
  const englishBody = document.querySelector('[data-language-content="en"]');
  if (!frenchBody || !englishBody) return;
  const headings = (body: Element) => [...body.querySelectorAll<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')].map(heading => {
    heading.dataset.languageOriginalId ??= heading.id;
    heading.id = heading.dataset.languageOriginalId;
    return heading;
  });
  const fr = headings(frenchBody), en = headings(englishBody);
  if (fr.length === en.length && fr.every((heading, index) => heading.tagName === en[index].tagName)) {
    fr.forEach((heading, index) => headingPairs.push({fr: heading, en: en[index], anchor: en[index].id, frenchAnchor: heading.id}));
  }
}
refreshHeadingPairs();
function apply(language: Language) {
  const locked = document.documentElement.dataset.articleEditingLanguage;
  if (locked && locked !== language) return;
  document.documentElement.lang = language;
  document.querySelectorAll<HTMLElement>('[data-i18n-fr]').forEach(element => {
    element.textContent = element.getAttribute(`data-i18n-${language}`) ?? element.getAttribute('data-i18n-fr');
  });
  for (const attribute of ['alt', 'aria-label', 'title', 'content', 'placeholder']) {
    document.querySelectorAll(`[data-i18n-fr-${attribute}]`).forEach(element => {
      element.setAttribute(attribute, element.getAttribute(`data-i18n-${language}-${attribute}`) ?? element.getAttribute(`data-i18n-fr-${attribute}`) ?? '');
    });
  }
  document.querySelectorAll<HTMLElement>('[data-set-language]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.setLanguage === language));
  });
  for (const pair of headingPairs) {
    pair.fr.id = language === 'fr' ? pair.anchor : `i18n-hidden-fr-${pair.frenchAnchor}`;
    pair.en.id = language === 'en' ? pair.anchor : `i18n-hidden-en-${pair.anchor}`;
  }
  scrollToFragment();
  try { localStorage.setItem('studio-language', language); } catch { /* Optional persistence. */ }
}
apply(valid(query) ? query : valid(stored) ? stored : 'fr');
document.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLElement>('[data-set-language]');
  const language = button?.dataset.setLanguage ?? null;
  if (!valid(language)) return;
  apply(language);
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) { url.searchParams.set('lang', language); history.replaceState(null, '', url); }
});
window.addEventListener('storage', event => {
  if (event.key === 'studio-language' && valid(event.newValue)) {
    apply(event.newValue);
    const url = new URL(location.href);
    if (url.searchParams.has('lang')) { url.searchParams.set('lang', event.newValue); history.replaceState(null, '', url); }
  }
});

function scrollToFragment() {
  if (location.hash) {
    let anchor = location.hash.slice(1);
    try { anchor = decodeURIComponent(anchor); } catch { /* Malformed fragments remain literal. */ }
    const pair = headingPairs.find(item => item.anchor === anchor || item.frenchAnchor === anchor);
    if (pair) (document.documentElement.lang === 'fr' ? pair.fr : pair.en).scrollIntoView();
  }
}
window.addEventListener('hashchange', scrollToFragment);

document.addEventListener('studio:article-updated', () => { refreshHeadingPairs(); apply(document.documentElement.lang === 'en' ? 'en' : 'fr'); });

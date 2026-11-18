const KEY = 'studio-visitor-view';
/** Presentation-only preview; authentication and traffic exclusion stay intact. */
export function visitorView(): boolean {
  if (typeof window === 'undefined') return false;
  const requested = new URL(location.href).searchParams.get('visitor') === '1';
  try {
    if (requested) sessionStorage.setItem(KEY, '1');
    return requested || sessionStorage.getItem(KEY) === '1';
  } catch { return requested; }
}
export function exitVisitorView() {
  try { sessionStorage.removeItem(KEY); } catch { /* Storage may be blocked. */ }
}

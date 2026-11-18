import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Gallery } from './types';
import { fetchGalleries, deleteGallery } from './api-client';
import './dashboard.css';

interface Stats {
  days: number;
  startedAt: string | null;
  totalViews: number;
  totalVisits: number;
  daily: { day: string; views: number; visits: number }[];
  pages: { path: string; views: number }[];
  updatedAt: string;
}

const number = new Intl.NumberFormat('fr-CA');
const dayLabel = (value: string) => new Intl.DateTimeFormat('fr-CA', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
}).format(new Date(`${value}T00:00:00Z`));
const timestamp = (value: string) => new Intl.DateTimeFormat('fr-CA', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
}).format(new Date(value));

// Treat a malformed response as unavailable, never as a zero-traffic period.
function isStats(value: unknown, days: number): value is Stats {
  if (!value || typeof value !== 'object') return false;
  const s = value as Stats;
  const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  const date = (d: unknown) => typeof d === 'string' && Number.isFinite(Date.parse(d));
  return s.days === days && (s.startedAt === null || date(s.startedAt)) && date(s.updatedAt)
    && count(s.totalViews) && count(s.totalVisits)
    && Array.isArray(s.daily) && s.daily.every(d => d && typeof d.day === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(d.day) && date(d.day) && count(d.views) && count(d.visits))
    && Array.isArray(s.pages) && s.pages.every(p => p && typeof p.path === 'string' && count(p.views));
}

function Traffic({ stats }: { stats: Stats }) {
  const peak = Math.max(1, ...stats.daily.map(d => Math.max(d.views, d.visits)));
  return <>
    <p className="dashboard-note">
      {stats.startedAt ? <>Collecte activée le {timestamp(stats.startedAt)} UTC.</> : 'La collecte n’a pas encore été activée.'}
      {' '}Aucun historique antérieur. Les visites sont des sessions approximatives; les administrateurs connectés sont exclus.
    </p>
    {stats.startedAt && stats.totalViews === 0 && <p className="dashboard-empty">Aucune page vue enregistrée sur cette période.</p>}
    {stats.startedAt && stats.daily.length > 0 && <>
      <div className="dashboard-legend"><span><i /> Pages vues</span><span><i className="visits" /> Visites</span><span>Jours en UTC</span></div>
      <div className="dashboard-chart" aria-hidden="true">
        {stats.daily.map(d => <div className="dashboard-bar-group" key={d.day} title={`${dayLabel(d.day)} UTC : ${d.views} pages vues, ${d.visits} visites`}>
          <div className="dashboard-bars"><i style={{ height: `${d.views / peak * 100}%` }} /><i className="visits" style={{ height: `${d.visits / peak * 100}%` }} /></div>
        </div>)}
      </div>
      <div className="dashboard-chart-axis" aria-hidden="true"><span>{dayLabel(stats.daily[0].day)}</span><span>{dayLabel(stats.daily[stats.daily.length - 1].day)}</span></div>
      <details className="dashboard-details"><summary>Consulter les chiffres par jour</summary>
        <div className="dashboard-table-wrap"><table><caption>Activité quotidienne — dates en UTC</caption><thead><tr><th scope="col">Jour (UTC)</th><th scope="col">Pages vues</th><th scope="col">Visites</th></tr></thead>
          <tbody>{stats.daily.map(d => <tr key={d.day}><th scope="row">{d.day}</th><td>{number.format(d.views)}</td><td>{number.format(d.visits)}</td></tr>)}</tbody>
        </table></div>
      </details>
    </>}
    <div className="dashboard-pages"><h3>Pages consultées</h3>
      {stats.pages.length === 0 ? <p className="dashboard-note">Aucune page enregistrée sur cette période.</p> :
        <div className="dashboard-table-wrap"><table><caption className="dashboard-sr">Pages consultées sur {stats.days} jours</caption><thead><tr><th scope="col">Chemin</th><th scope="col">Pages vues</th></tr></thead><tbody>
          {stats.pages.map(p => <tr key={p.path}><th scope="row"><code>{p.path}</code></th><td>{number.format(p.views)}</td></tr>)}
        </tbody></table></div>}
    </div>
    <p className="dashboard-note dashboard-updated">Mise à jour : {timestamp(stats.updatedAt)} UTC</p>
  </>;
}

function PasswordSettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setError(''); setSuccess('');
    if (newPassword.length < 12 || newPassword.length > 256) {
      setError('Le nouveau mot de passe doit contenir de 12 à 256 caractères.'); return;
    }
    if (newPassword === currentPassword) {
      setError('Choisissez un mot de passe différent du mot de passe actuel.'); return;
    }
    if (newPassword !== confirmation) {
      setError('La confirmation ne correspond pas au nouveau mot de passe.'); return;
    }
    busy.current = true; setPending(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const messages: Record<number, string> = {
        400: 'Vérifiez les champs : le nouveau mot de passe doit contenir de 12 à 256 caractères.',
        401: 'Le mot de passe actuel est incorrect ou votre session a expiré. Réessayez ou reconnectez-vous.',
        429: 'Trop de tentatives. Réessayez dans 15 minutes.',
        409: 'Une autre modification a eu lieu. Reconnectez-vous avec le mot de passe actuel avant de réessayer.',
        429: 'Trop de tentatives. Patientez 15 minutes avant de réessayer.',
        503: 'Le changement de mot de passe est temporairement indisponible. Réessayez plus tard.',
      };
      if (!response.ok) throw new Error(messages[response.status] || 'Impossible de modifier le mot de passe. Réessayez.');
      const result = await response.json();
      if (result?.ok !== true) throw new Error('Le serveur n’a pas confirmé la modification.');
      setSuccess('Mot de passe modifié. Votre session reste ouverte; les autres sessions sont déconnectées.');
    } catch (cause) {
      setError(cause instanceof TypeError ? 'Connexion interrompue. La modification n’a pas pu être confirmée.' : cause instanceof Error ? cause.message : 'Impossible de confirmer la modification.');
    } finally {
      // Clear secrets after every request; never persist them outside this form.
      setCurrentPassword(''); setNewPassword(''); setConfirmation('');
      busy.current = false; setPending(false);
    }
  }

  return <section className="dashboard-panel" id="securite" aria-labelledby="security-title">
    <header className="dashboard-section-head"><div><p className="dashboard-kicker">03 / Paramètres</p><h2 id="security-title">Sécurité du compte</h2></div></header>
    <p className="dashboard-note">Changez votre mot de passe. Les autres sessions seront automatiquement déconnectées.</p>
    <form className="dashboard-password" onSubmit={submit} aria-busy={pending}>
      <fieldset disabled={pending}><legend className="dashboard-sr">Changer le mot de passe</legend>
        <label htmlFor="current-password">Mot de passe actuel<input className="input" id="current-password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>
        <label htmlFor="new-password">Nouveau mot de passe<input className="input" id="new-password" name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={256} aria-describedby="password-help" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
        <label htmlFor="confirm-password">Confirmer le nouveau mot de passe<input className="input" id="confirm-password" name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
      </fieldset>
      <p className="dashboard-note" id="password-help">De 12 à 256 caractères. Une phrase longue et unique est idéale.</p>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      <p className="dashboard-status" role="status">{pending ? 'Modification en cours…' : success}</p>
      <button className="btn" type="submit" disabled={pending}>{pending ? 'Modification…' : 'Modifier le mot de passe'}</button>
    </form>
  </section>;
}

export default function Dashboard() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [galleryError, setGalleryError] = useState('');
  const [galleryReload, setGalleryReload] = useState(0);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const deleteBusy = useRef(false);
  const [galleryStatus, setGalleryStatus] = useState('');
  const [days, setDays] = useState<7 | 30>(7);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsPending, setStatsPending] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [statsReload, setStatsReload] = useState(0);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setGalleryError('');
    fetchGalleries().then(data => { if (active) setGalleries(data); })
      .catch(() => { if (active) setGalleryError('Impossible de charger les galeries. Vérifiez votre connexion et réessayez.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [galleryReload]);

  useEffect(() => {
    const controller = new AbortController();
    setStatsPending(true); setStatsError(''); setStats(null);
    async function load() {
      try {
        const response = await fetch(`/api/admin/stats?days=${days}`, { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error(response.status === 401 ? 'Votre session a expiré. Reconnectez-vous pour consulter les statistiques.' : 'Les statistiques sont indisponibles. Réessayez dans quelques instants.');
        const data: unknown = await response.json();
        if (!isStats(data, days)) throw new Error('Les statistiques reçues sont incomplètes. Réessayez.');
        if (!controller.signal.aborted) setStats(data);
      } catch (cause) {
        if (!controller.signal.aborted) setStatsError(cause instanceof TypeError ? 'Impossible de charger les statistiques. Vérifiez votre connexion.' : cause instanceof Error ? cause.message : 'Les statistiques sont indisponibles.');
      } finally {
        if (!controller.signal.aborted) setStatsPending(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [days, statsReload]);

  async function onDelete(gallery: Gallery) {
    if (deleteBusy.current || !window.confirm(`Supprimer la galerie « ${gallery.title || gallery.slug} » ? Cette suppression est définitive et enregistrée dans le dépôt.`)) return;
    deleteBusy.current = true; setDeleting(gallery.slug); setDeleteError(''); setGalleryStatus('');
    try {
      await deleteGallery(gallery.slug);
      setGalleries(gs => gs.filter(g => g.slug !== gallery.slug));
      setGalleryStatus(`La galerie « ${gallery.title || gallery.slug} » a été supprimée.`);
    } catch {
      setDeleteError(`La suppression de « ${gallery.title || gallery.slug} » n’a pas pu être confirmée. Actualisez la liste avant de réessayer.`);
    } finally { deleteBusy.current = false; setDeleting(null); }
  }

  async function onLogout() {
    if (loggingOut) return;
    setLoggingOut(true); setLogoutError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('logout');
      window.location.href = '/admin/login';
    } catch { setLogoutError('Déconnexion impossible. Vérifiez votre connexion et réessayez.'); setLoggingOut(false); }
  }

  const visibleStats = !statsPending && !statsError && stats?.days === days ? stats : null;
  const metric = (value: number | undefined) => statsPending ? '…' : value === undefined ? '—' : number.format(value);
  return <div className="dashboard" lang="fr">
    <header className="dashboard-topbar"><a className="dashboard-wordmark" href="/admin">Studio<span>.</span></a><span className="dashboard-top-label">Administration</span>
      <div className="dashboard-top-actions"><a href="/" className="dashboard-text-link">Voir le site <span aria-hidden="true">↗</span></a><button className="btn ghost" type="button" disabled={loggingOut} onClick={onLogout}>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'}</button></div>
    </header>
    <div className="dashboard-content">
      {logoutError && <p className="dashboard-error" role="alert">{logoutError}</p>}
      <div className="dashboard-intro"><div><p className="dashboard-kicker">Votre espace de travail</p><h1>Tableau de bord<span>.</span></h1><p className="dashboard-note">Un regard sur le site. Une place pour vos prochaines idées.</p></div><a className="btn" href="/admin/new">+ Nouvelle galerie</a></div>
      <nav className="dashboard-nav" aria-label="Sections du tableau de bord"><a href="#activite">Vue d’ensemble</a><a href="#contenus">Articles & liens</a><a href="#galeries">Galeries</a><a href="#securite">Sécurité</a></nav>
      <section id="activite" aria-labelledby="activity-title">
        <header className="dashboard-section-head"><div><p className="dashboard-kicker">01 / Audience</p><h2 id="activity-title">L’activité du site</h2></div>
          <div className="dashboard-period" role="group" aria-label="Période des statistiques">{([7, 30] as const).map(period => <button key={period} type="button" aria-pressed={days === period} onClick={() => { if (period !== days) { setStats(null); setStatsPending(true); setStatsError(''); setDays(period); } }}>{period} jours</button>)}</div>
        </header>
        <div className="dashboard-metrics" aria-busy={statsPending}>
          <div className="dashboard-metric"><span>Visites</span><strong>{metric(visibleStats?.startedAt ? visibleStats.totalVisits : undefined)}</strong><small>Sessions approximatives · {days} jours</small></div>
          <div className="dashboard-metric"><span>Pages vues</span><strong>{metric(visibleStats?.startedAt ? visibleStats.totalViews : undefined)}</strong><small>Consultations enregistrées · {days} jours</small></div>
          <div className="dashboard-metric"><span>Galeries</span><strong>{loading ? '…' : galleryError ? '—' : number.format(galleries.length)}</strong><small>{loading ? 'Chargement de la collection' : galleryError ? 'Collection indisponible' : `${galleries.filter(g => !g.draft).length} publiées · ${galleries.filter(g => g.draft).length} brouillons`}</small></div>
        </div>
        <div className="dashboard-panel dashboard-traffic" aria-busy={statsPending}>
          <p className="dashboard-status" role="status">{statsPending ? 'Chargement des statistiques…' : visibleStats ? `Statistiques sur ${days} jours chargées.` : ''}</p>
          {statsError && <div className="dashboard-feedback"><p className="dashboard-error" role="alert">{statsError}</p><button type="button" className="btn ghost" onClick={() => setStatsReload(n => n + 1)}>Réessayer</button><a className="dashboard-text-link" href="/admin/login">Se reconnecter</a></div>}
          {visibleStats && <Traffic stats={visibleStats} />}
        </div>
      </section>
      <section className="dashboard-panel" id="contenus" aria-labelledby="content-title"><header className="dashboard-section-head"><div><p className="dashboard-kicker">02 / Publication</p><h2 id="content-title">Articles & liens utiles</h2></div></header>
        <div className="dashboard-links"><a href="/projects/video-qr/?edit=page-video-qr-intro"><span className="dashboard-kicker">Article · Projet</span><strong>Vidéo QR <span aria-hidden="true">↗</span></strong><span>Modifier le texte d’introduction</span></a><a href="/science/"><span className="dashboard-kicker">Lecture</span><strong>Science <span aria-hidden="true">↗</span></strong><span>Section à venir</span></a><a href="/"><span className="dashboard-kicker">Site public</span><strong>Le site <span aria-hidden="true">↗</span></strong><span>Voir le site tel que vos visiteurs</span></a></div>
      </section>
      <section className="dashboard-panel" id="galeries" aria-labelledby="gallery-title"><header className="dashboard-section-head"><div><p className="dashboard-kicker">Photographie</p><h2 id="gallery-title">Vos galeries</h2></div><div className="dashboard-gallery-actions"><button type="button" className="dashboard-text-button" disabled={loading || deleting !== null} onClick={() => setGalleryReload(n => n + 1)}>Actualiser</button><a className="dashboard-text-link" href="/admin/new">+ Créer</a></div></header>
        <div aria-busy={loading}><p className="dashboard-status" role="status">{loading ? 'Chargement des galeries…' : deleting ? 'Suppression en cours…' : galleryStatus}</p>
          {galleryError && <div className="dashboard-feedback"><p className="dashboard-error" role="alert">{galleryError}</p><button className="btn ghost" type="button" onClick={() => setGalleryReload(n => n + 1)}>Réessayer</button></div>}
          {deleteError && <p className="dashboard-error" role="alert">{deleteError}</p>}
          {!loading && !galleryError && (galleries.length === 0 ? <p className="dashboard-empty">Votre collection commence ici. <a href="/admin/new">Créez votre première galerie.</a></p> : <ul className="dashboard-gallery-list">{galleries.map(g => <li className="dashboard-gallery" key={g.slug}>
            <a className="dashboard-thumb" href={`/admin/${g.slug}/edit`} aria-label={`Modifier ${g.title || g.slug}`}>{g.cover ? <img src={g.cover} alt="" loading="lazy" /> : <span aria-hidden="true">◇</span>}</a>
            <div className="dashboard-gallery-meta"><a className="dashboard-gallery-title" href={`/admin/${g.slug}/edit`}>{g.title || g.slug}</a><span className="dashboard-gallery-path">/photography/{g.slug}</span><div className="dashboard-badges"><span>{g.draft ? 'Brouillon' : 'Publiée'}</span>{g.featured && <span>★ À la une</span>}</div></div>
            <div className="dashboard-gallery-actions"><a className="btn ghost" href={`/admin/${g.slug}/edit`} aria-label={`Modifier ${g.title || g.slug}`}>Modifier</a><button className="dashboard-text-button dashboard-delete" type="button" disabled={deleting !== null} onClick={() => onDelete(g)} aria-label={`Supprimer ${g.title || g.slug}`}>{deleting === g.slug ? 'Suppression…' : 'Supprimer'}</button></div>
          </li>)}</ul>)}
        </div>
      </section>
      <PasswordSettings />
      <footer className="dashboard-footer">Studio<span>.</span> <span>Un espace pour créer, publier et suivre.</span></footer>
    </div>
  </div>;
}

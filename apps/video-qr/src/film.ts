import './film.css';
import QRCode from 'qrcode';
import { compressVideo, playableVideo, cancelMedia, MAX_INPUT_BYTES } from './media';
import { packVideo } from './packet';
import { exportFile } from './export';
import { fitEstimate, estimateBytes, nextSmaller, VIDEO_BUDGET, type FilmSettings } from './film-budget';
import { LANGUAGE_KEY, resolveLanguage, translateError, translateProgress, type Language } from './i18n';

const copy = {
  eyebrow: ['LA BÊTE LUMINEUSE / CINÉMA DE POCHE', 'LA BÊTE LUMINEUSE / POCKET CINEMA'],
  title: ['Un passage, un QR.', 'One passage, one QR.'],
  pageTitle: ['Un passage, un QR — La bête lumineuse', 'One passage, one QR — La bête lumineuse'],
  language: ['Langue', 'Language'],
  intro: ['Un extrait du film en basse résolution. Ses vrais octets dans un QR, sans lien.', 'A clip from the low-resolution film. Its actual bytes in a QR, without a link.'],
  passage: ['01 / Choisir le passage', '01 / Choose the passage'],
  sourcePreview: ['Aperçu du film', 'Film preview'],
  settings: ['Réglages de l’extrait', 'Clip settings'],
  start: ['Début du passage', 'Passage start'],
  precision: ['Position (secondes)', 'Position (seconds)'],
  slidersHint: ['Réglages liés : votre dernier choix est prioritaire.', 'Linked settings: your latest choice takes priority.'],
  duration: ['Durée', 'Duration'], width: ['Largeur', 'Width'],
  fps: ['Cadence', 'Frame rate'], audio: ['Débit audio', 'Audio bitrate'],
  capacity: ['02 / Faire tenir le film', '02 / Fit the film'],
  estimatedCapacity: ['Capacité estimée', 'Estimated capacity'],
  estimate: ['Estimation : {bytes} / {budget} octets', 'Estimate: {bytes} / {budget} bytes'],
  estimateHint: ['La taille réelle est vérifiée ; les réglages diminuent si nécessaire.', 'Actual size is verified; settings are reduced if needed.'],
  generate: ['Générer le QR', 'Generate QR'], cancel: ['Annuler', 'Cancel'],
  downloadHint: ['La compression utilise le film d’environ 18 Mo et un moteur vidéo local. L’aperçu peut aussi télécharger des données du film. Le traitement reste sur votre appareil.', 'Compression uses the roughly 18 MB film and a local video engine. The preview may also download film data. Processing stays on your device.'],
  processing: ['Traitement local · comment ça marche', 'Local processing · how it works'],
  colorMode: ['Image', 'Image'], color: ['Couleur', 'Color'], grayscale: ['Noir et blanc', 'Black & white'],
  colorLevels: ['Palette avant encodage', 'Palette before encoding'], fullPalette: ['Complète', 'Full'],
  colors: ['{count} couleurs', '{count} colors'], grayLevels: ['{count} niveaux de gris', '{count} gray levels'],
  audioEnabled: ['Son activé', 'Sound enabled'], volume: ['Volume', 'Volume'],
  expandQR: ['Agrandir le code QR', 'Enlarge QR code'], close: ['Fermer', 'Close'],
  qrLabel: ['Code QR de l’extrait', 'Clip QR code'],
  scanHint: ['Retrouvez cet extrait en important le PNG dans le décodeur Video QR.', 'Recover this clip by importing the PNG into the Video QR decoder.'],
  resultPreview: ['Aperçu de l’extrait compressé', 'Compressed clip preview'],
  saveQR: ['Enregistrer le PNG', 'Save PNG'], saveVideo: ['Enregistrer le WebM', 'Save WebM'],
  loading: ['Lecture des métadonnées du film…', 'Reading film metadata…'],
  ready: ['Choisissez un passage et générez votre QR.', 'Choose a passage and generate your QR.'],
  changed: ['Réglages modifiés. Générez un nouveau QR.', 'Settings changed. Generate a new QR.'],
  metadataError: ['Impossible de lire la durée du film. Rechargez la page pour réessayer.', 'Could not read the film duration. Reload the page to try again.'],
  sourceError: ['Impossible de lire le film. Vérifiez la connexion et rechargez la page.', 'Could not read the film. Check your connection and reload the page.'],
  downloading: ['Téléchargement du film pour la compression…', 'Downloading the film for compression…'],
  attempt: ['Essai {attempt}/20 — {progress}', 'Attempt {attempt}/20 — {progress}'],
  preparing: ['Préparation de la compression…', 'Preparing compression…'],
  measured: ['Taille réelle : {bytes} / {budget} octets (essai {attempt}).', 'Measured size: {bytes} / {budget} bytes (attempt {attempt}).'],
  success: ['L’extrait tient dans un seul QR. La taille réelle a été vérifiée.', 'The clip fits in one QR. Its actual size has been verified.'],
  fittingFailed: ['Cet extrait ne tient pas dans un QR après {attempt} essais. Aucun QR n’a été créé. Choisissez un autre passage.', 'This clip does not fit in one QR after {attempt} attempts. No QR was created. Choose another passage.'],
  cancelled: ['Génération annulée. Aucun ancien QR n’est proposé.', 'Generation cancelled. No previous QR is offered.'],
  failure: ['La génération a échoué. {error}', 'Generation failed. {error}'],
  downloadError: ['Téléchargement du film impossible (HTTP {code}).', 'Film download failed (HTTP {code}).'],
  fileSize: ['Le film téléchargé est vide ou dépasse 100 Mio.', 'The downloaded film is empty or exceeds 100 MiB.'],
  packetError: ['La validation du paquet unique a échoué.', 'Single-packet validation failed.'],
  playbackError: ['QR prêt, mais aperçu indisponible. Vous pouvez enregistrer le WebM. {error}', 'QR ready, but preview unavailable. You can save the WebM. {error}'],
  invalidStart: ['Saisissez une position valide dans le film.', 'Enter a valid position within the film.'],
  silent: ['Sans son', 'Silent'], fpsUnit: ['{value} i/s', '{value} fps'], audioUnit: ['{value} kbit/s', '{value} kbps'],
  exporting: ['Préparation de l’exportation…', 'Preparing export…'],
  exported: ['Fichier exporté. Choisissez où l’enregistrer.', 'File exported. Choose where to save it.'],
  exportError: ['Exportation impossible. {error}', 'Export failed. {error}'],
} satisfies Record<string, [string, string]>;
type Key = keyof typeof copy;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => el<HTMLInputElement>(id);
const button = (id: string) => el<HTMLButtonElement>(id);
const source = el<HTMLVideoElement>('film-preview');
const preview = el<HTMLVideoElement>('result-preview');
const canvas = el<HTMLCanvasElement>('qr');
const qrDialog = el<HTMLDialogElement>('qr-dialog');
let qrFocus: HTMLElement | null = null;
let stored: string | null = null;
try { stored = localStorage.getItem(LANGUAGE_KEY); } catch { /* Optional storage. */ }
let language = resolveLanguage(location.search, stored);
const t = (key: Key, params: Record<string, string | number> = {}) =>
  copy[key][language === 'fr' ? 0 : 1].replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));
const number = (value: number) => value.toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA');
let message: () => string = () => t('loading');
let settings: FilmSettings = fitEstimate({ duration: 2, width: 32, fps: 2, audioKbps: 4, colorMode: 'color', colorLevels: 0, volume: 1 }, 'duration');
let previousAudioKbps = 4;
let previousVolume = 1;
let start = 600;
let filmDuration = 0;
let epoch = 0;
let busy = false;
let exporting = false;
let download: AbortController | undefined;
let cachedFilm: File | undefined;
let measured: { bytes: number; attempt: number } | undefined;
let resultBlob: Blob | undefined;
let playbackURL = '';
let validPacket = false;
const keys = ['duration', 'width', 'fps', 'audioKbps'] as const;

function status(render: () => string) { message = render; el('status').textContent = message(); }
function renderValues() {
  for (const key of keys) input(key).value = String(settings[key]);
  el<HTMLSelectElement>('colorMode').value = settings.colorMode ?? 'color';
  const palette = el<HTMLSelectElement>('colorLevels');
  palette.value = String(settings.colorLevels ?? 0);
  for (const option of palette.options) {
    const levels = Number(option.value);
    option.textContent = levels === 0 ? t('fullPalette') : t(settings.colorMode === 'grayscale' ? 'grayLevels' : 'colors', { count: settings.colorMode === 'grayscale' ? levels : levels ** 3 });
  }
  const volume = Math.round((settings.volume ?? 1) * 100);
  input('volume').value = String(volume);
  el('volume-value').textContent = volume ? volume + ' %' : t('silent');
  input('volume').setAttribute('aria-valuetext', el('volume-value').textContent!);
  input('audio-enabled').checked = settings.audioKbps > 0 && volume > 0;
  // Keep source listening consistent with the requested clip. Color processing applies on generation.
  source.style.filter = settings.colorMode === 'grayscale' ? 'grayscale(1)' : '';
  source.muted = !input('audio-enabled').checked;
  source.volume = settings.volume ?? 1;
  input('start').value = String(start);
  input('start-seconds').value = String(start);
  const minutes = Math.floor(start / 60);
  const seconds = (start % 60).toFixed(1).padStart(4, '0');
  el('timestamp').textContent = `${minutes}:${seconds}`;
  el('duration-value').textContent = number(settings.duration) + ' s';
  el('width-value').textContent = settings.width + ' px';
  el('fps-value').textContent = t('fpsUnit', { value: settings.fps });
  el('audioKbps-value').textContent = settings.audioKbps ? t('audioUnit', { value: settings.audioKbps }) : t('silent');
  for (const key of keys) input(key).setAttribute('aria-valuetext', el(key + '-value').textContent!);
  input('start').setAttribute('aria-valuetext', el('timestamp').textContent!);
  el('estimate').textContent = t('estimate', { bytes: number(estimateBytes(settings)), budget: number(VIDEO_BUDGET) });
  el<HTMLProgressElement>('capacity-meter').value = Math.min(VIDEO_BUDGET, estimateBytes(settings));
  el('measured').textContent = measured ? t('measured', { bytes: number(measured.bytes), budget: number(VIDEO_BUDGET), attempt: measured.attempt }) : '';
}
function renderLanguage() {
  document.documentElement.lang = language;
  document.title = t('pageTitle');
  document.querySelectorAll<HTMLElement>('[data-copy]').forEach(node => { node.textContent = t(node.dataset.copy as Key); });
  document.querySelectorAll<HTMLElement>('[data-label]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.label as Key)); });
  el<HTMLImageElement>('large-qr').alt = t('qrLabel');
  for (const value of ['fr', 'en']) button(value).setAttribute('aria-pressed', String(language === value));
  el('status').textContent = message();
  renderValues();
}
for (const value of ['fr', 'en'] as const) button(value).onclick = () => {
  language = value;
  try { localStorage.setItem(LANGUAGE_KEY, value); } catch { /* Optional storage. */ }
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) { url.searchParams.set('lang', value); history.replaceState(history.state, '', url); }
  renderLanguage();
};
window.addEventListener('storage', event => {
  if (event.key !== LANGUAGE_KEY && event.key !== null) return;
  language = resolveLanguage(location.search, event.newValue);
  renderLanguage();
});
function controls() {
  button('generate').disabled = busy || filmDuration < .5 || !input('start-seconds').validity.valid;
  button('cancel').hidden = !busy;
  button('download-qr').disabled = !validPacket || exporting;
  button('download-video').disabled = !validPacket || exporting;
}
function clearResult() {
  qrFocus = null;
  if (qrDialog.open) qrDialog.close();
  el<HTMLImageElement>('large-qr').removeAttribute('src');
  validPacket = false; resultBlob = undefined;
  preview.pause(); preview.removeAttribute('src'); preview.load(); preview.hidden = true;
  if (playbackURL) URL.revokeObjectURL(playbackURL);
  playbackURL = ''; el('result').hidden = true;
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
}
function invalidate() {
  epoch++; download?.abort(); download = undefined; cancelMedia(); busy = false;
  clearResult(); measured = undefined; controls();
}
function clampToFilm() {
  if (!filmDuration) return;
  settings.duration = Math.min(settings.duration, Math.floor(Math.min(6, filmDuration) * 2) / 2);
  input('duration').max = String(Math.floor(Math.min(6, filmDuration) * 2) / 2);
  const maxStart = Math.max(0, Math.floor((filmDuration - settings.duration) * 10) / 10);
  start = Math.min(maxStart, Math.max(0, start));
  input('start').max = input('start-seconds').max = String(maxStart);
}
function seekPreview() {
  source.pause();
  if (filmDuration) source.currentTime = start;
}
for (const key of keys) input(key).oninput = () => {
  invalidate();
  const value = Number(input(key).value);
  if (key === 'audioKbps' && value > 0) previousAudioKbps = value;
  settings = fitEstimate({ ...settings, [key]: value }, key);
  clampToFilm(); renderValues(); seekPreview(); controls();
  status(() => t('changed'));
};
function changeExtra(next: FilmSettings, changed: keyof FilmSettings) {
  invalidate();
  settings = fitEstimate(next, changed);
  clampToFilm(); renderValues(); seekPreview(); controls();
  status(() => t('changed'));
}
el<HTMLSelectElement>('colorMode').onchange = () => {
  const colorMode = el<HTMLSelectElement>('colorMode').value === 'grayscale' ? 'grayscale' : 'color';
  changeExtra({ ...settings, colorMode }, 'colorMode');
};
el<HTMLSelectElement>('colorLevels').onchange = () => {
  const colorLevels = Number(el<HTMLSelectElement>('colorLevels').value) as 0 | 2 | 4 | 8;
  changeExtra({ ...settings, colorLevels }, 'colorLevels');
};
input('audio-enabled').onchange = () => {
  const enabled = input('audio-enabled').checked;
  if (!enabled) {
    if (settings.audioKbps > 0) previousAudioKbps = settings.audioKbps;
    if ((settings.volume ?? 1) > 0) previousVolume = settings.volume ?? 1;
  }
  changeExtra({
    ...settings, audioKbps: enabled ? settings.audioKbps || previousAudioKbps : 0,
    volume: enabled && settings.volume === 0 ? previousVolume : settings.volume ?? 1,
  }, 'audioKbps');
};
input('volume').oninput = () => {
  const volume = Number(input('volume').value) / 100;
  if (volume > 0) previousVolume = volume;
  changeExtra({ ...settings, volume }, 'volume');
};
function changeStart(control: HTMLInputElement) {
  invalidate();
  if (!control.validity.valid || !Number.isFinite(control.valueAsNumber)) {
    status(() => t('invalidStart')); controls(); return;
  }
  start = control.valueAsNumber;
  clampToFilm(); renderValues(); seekPreview(); controls();
  status(() => t('changed'));
}
input('start').oninput = () => changeStart(input('start'));
input('start-seconds').oninput = () => changeStart(input('start-seconds'));
function readMetadata() {
  if (!Number.isFinite(source.duration) || source.duration < .5) {
    filmDuration = 0; invalidate(); el<HTMLFieldSetElement>('controls').disabled = true;
    status(() => t('metadataError')); return;
  }
  filmDuration = source.duration; clampToFilm(); renderValues(); seekPreview();
  el<HTMLFieldSetElement>('controls').disabled = false; controls(); status(() => t('ready'));
}
source.onloadedmetadata = readMetadata;
source.onerror = () => {
  filmDuration = 0; invalidate(); el<HTMLFieldSetElement>('controls').disabled = true;
  status(() => t('sourceError'));
};
source.onplay = () => {
  if (filmDuration && (source.currentTime < start || source.currentTime >= start + settings.duration)) source.currentTime = start;
};
source.ontimeupdate = () => {
  if (!source.paused && source.currentTime >= start + settings.duration) source.pause();
};
button('cancel').onclick = () => { invalidate(); renderValues(); status(() => t('cancelled')); };

class FilmError extends Error {
  constructor(readonly key: Key, readonly params: Record<string, string | number> = {}) { super(key); }
}
const errorText = (error: unknown) => error instanceof FilmError ? t(error.key, error.params) : translateError(language, error);
button('generate').onclick = async () => {
  if (busy || !filmDuration || !input('start-seconds').reportValidity()) return;
  invalidate(); busy = true; controls(); measured = undefined; renderValues(); source.pause();
  const job = epoch;
  const current = () => job === epoch;
  const controller = new AbortController(); download = controller;
  let candidate = { ...settings };
  const cutStart = start;
  try {
    if (!cachedFilm) {
      status(() => t('downloading'));
      const response = await fetch('/examples/video-qr/la-bete-lumineuse.webm', { signal: controller.signal });
      if (!current()) return;
      if (!response.ok) throw new FilmError('downloadError', { code: response.status });
      if (Number(response.headers.get('content-length')) > MAX_INPUT_BYTES) { controller.abort(); throw new FilmError('fileSize'); }
      const blob = await response.blob();
      if (!current()) return;
      if (!blob.size || blob.size > MAX_INPUT_BYTES) throw new FilmError('fileSize');
      cachedFilm = new File([blob], 'la-bete-lumineuse.webm', { type: 'video/webm' });
    }
    for (let attempt = 1; attempt <= 20; attempt++) {
      if (!current()) return;
      settings = { ...candidate }; clampToFilm(); renderValues();
      status(() => t('attempt', { attempt, progress: t('preparing') }));
      const data = await compressVideo(cachedFilm, { start: cutStart, ...candidate }, progress => {
        if (current()) status(() => t('attempt', { attempt, progress: translateProgress(language, progress) }));
      });
      if (!current()) return;
      measured = { bytes: data.byteLength, attempt }; renderValues();
      if (data.byteLength <= VIDEO_BUDGET) {
        const packets = await packVideo(data);
        if (!current()) return;
        if (packets.length !== 1) throw new FilmError('packetError');
        // Render offscreen: an obsolete asynchronous job must never overwrite a newer QR.
        const rendered = document.createElement('canvas');
        await QRCode.toCanvas(rendered, [{ data: packets[0], mode: 'byte' }], {
          version: 40, errorCorrectionLevel: 'L', margin: 4, scale: 4,
          color: { dark: '#171916', light: '#ffffff' },
        });
        if (!current()) return;
        canvas.width = rendered.width; canvas.height = rendered.height;
        canvas.getContext('2d')!.drawImage(rendered, 0, 0);
        resultBlob = new Blob([new Uint8Array(data)], { type: 'video/webm' });
        validPacket = true; el('result').hidden = false;
        // Keep downloads available even if the optional playback conversion fails.
        controls();
        try {
          const playable = await playableVideo(data);
          if (!current()) return;
          playbackURL = URL.createObjectURL(playable); preview.src = playbackURL; preview.hidden = false;
          status(() => t('success'));
        } catch (error) {
          if (current()) status(() => t('playbackError', { error: errorText(error) }));
        }
        return;
      }
      const smaller = nextSmaller(candidate);
      if (!smaller || attempt === 20) {
        status(() => t('fittingFailed', { attempt })); return;
      }
      candidate = smaller;
    }
  } catch (error) {
    if (current()) status(() => t('failure', { error: errorText(error) }));
  } finally {
    if (current()) { busy = false; download = undefined; controls(); }
  }
};
preview.onerror = () => { if (validPacket) status(() => t('playbackError', { error: '' })); };
async function save(kind: 'qr' | 'video') {
  if (!validPacket || !resultBlob || exporting) return;
  const job = epoch;
  exporting = true; controls(); status(() => t('exporting'));
  try {
    const blob = kind === 'qr'
      ? await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      : resultBlob;
    if (job !== epoch || !validPacket) return;
    if (!blob) throw new Error('Could not prepare this file for sharing.');
    await exportFile(blob, kind === 'qr' ? 'la-bete-lumineuse-qr.png' : 'la-bete-lumineuse-extrait.webm');
    if (job === epoch) status(() => t('exported'));
  } catch (error) {
    if (job === epoch) status(() => t('exportError', { error: errorText(error) }));
  } finally { exporting = false; controls(); }
}
button('expand-qr').onclick = () => {
  if (!validPacket) return;
  qrFocus = document.activeElement instanceof HTMLElement ? document.activeElement : button('expand-qr');
  el<HTMLImageElement>('large-qr').src = canvas.toDataURL('image/png');
  qrDialog.showModal();
};
button('close-qr').onclick = () => qrDialog.close();
qrDialog.addEventListener('close', () => {
  el<HTMLImageElement>('large-qr').removeAttribute('src');
  if (validPacket && qrFocus?.isConnected) qrFocus.focus();
  qrFocus = null;
});
button('download-qr').onclick = () => void save('qr');
button('download-video').onclick = () => void save('video');
window.addEventListener('pagehide', () => { invalidate(); source.pause(); });
window.addEventListener('pageshow', event => { if (event.persisted) { renderValues(); controls(); status(() => t('ready')); } });
renderLanguage(); controls();
if (source.readyState >= 1) readMetadata();

// The embedded tool follows the site's language even when storage is unavailable.
if (parent !== window) {
  try {
    const followSiteLanguage = () => {
      const value = parent.document.documentElement.lang;
      if (value === 'fr' || value === 'en') { language = value; renderLanguage(); }
    };
    followSiteLanguage();
    new MutationObserver(followSiteLanguage).observe(parent.document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  } catch { /* Cross-origin embedding retains the normal language preference. */ }
}

// Only content sizes drive the iframe; no viewport-height sizing.
if (parent !== window) {
  let lastHeight = 0;
  const notifyHeight = () => {
    const height = Math.ceil(el('film-app').getBoundingClientRect().height);
    if (height !== lastHeight) {
      lastHeight = height;
      parent.postMessage({ type: 'film-generator-height', height }, location.origin);
    }
  };
  new ResizeObserver(notifyHeight).observe(document.body);
  notifyHeight();
}

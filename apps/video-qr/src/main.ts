import './style.css';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { packVideo, PacketCollector } from './packet';
import { exportFile } from './export';
import { compressVideo, playableVideo, cancelMedia } from './media';

// Only this static template uses HTML. File names, errors and codec messages use textContent.
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="masthead"><a class="wordmark" href="https://marcandre-studio.vercel.app/projects/video-qr/">M—A <span>STUDIO / EXPERIMENT 01</span></a><span class="local-badge"><i></i> ON YOUR DEVICE</span></header>
  <main>
    <section class="intro"><p class="eyebrow">A POCKET CINEMA</p><h1>Video<span class="qr-mark">QR</span><span class="title-dot">.</span></h1><p>A tiny film. Inside a code.</p></section>
    <nav class="switcher" aria-label="Workspace"><button id="encode-tab" aria-pressed="true" aria-controls="encode-panel">01 <span>Encode</span><span aria-hidden="true">↗</span></button><button id="decode-tab" aria-pressed="false" aria-controls="decode-panel">02 <span>Decode</span><span aria-hidden="true">↙</span></button></nav>
    <section id="encode-panel" aria-labelledby="encode-tab" class="workspace">
      <div class="controls"><div class="section-head"><h2>Make it small.</h2><span>VIDEO → QR</span></div>
        <label class="upload" for="video-file"><span class="upload-symbol" aria-hidden="true">＋</span><strong>Choose a video</strong><span>Up to 100 MB · stays on this device</span><input id="video-file" type="file" accept="video/*"></label>
        <p id="source-name" class="file-name">No clip selected</p><video id="source-video" controls playsinline preload="metadata" hidden aria-label="Original video preview"></video>
        <fieldset id="settings"><legend>01 / THE CUT</legend><div class="field-row"><label>Start (seconds)<input id="trim-start" type="number" min="0" max="86400" step="0.1" value="0" required></label><label>Length (seconds)<input id="trim-duration" type="number" min="0.1" max="10" step="0.1" value="3" required></label></div>
          <label>Detail preset<select id="preset"><option value="tiny">Tiny · 24 px / 2 fps / 4 kbps audio</option><option value="small">Small · 48 px / 4 fps / 6 kbps audio</option><option value="clear">Clear · 96 px / 8 fps / 12 kbps audio</option></select></label>
          <p class="hint">10 seconds maximum. Less detail travels further.</p>
          <p class="sublegend">02 / THE CARRIER</p><div class="mode-options"><label><input type="radio" name="mode" value="single" checked><span>Single code<small>Refuses clips that do not fit.</small></span></label><label><input type="radio" name="mode" value="sequence"><span>Sequence<small>Collect every frame to play.</small></span></label></div>
        </fieldset><div class="actions"><button id="encode" class="primary" disabled>Make QR <span aria-hidden="true">↗</span></button><button id="cancel" hidden>Cancel</button></div>
      </div>
      <div class="output"><div class="section-head"><h2>Your carrier.</h2><span id="output-count">—</span></div><div id="qr-empty" class="empty-state"><div class="empty-glyph" aria-hidden="true">▗ ▖<br>▝ ▘</div><p>Small enough to carry.<br>Ready when you are.</p></div><div id="qr-result" hidden><div class="qr-paper"><canvas id="qr-canvas" width="740" height="740" aria-label="Video QR code" role="img"></canvas></div><p id="frame-info" class="frame-info"></p><div class="frame-controls"><button id="previous" aria-label="Previous QR frame">←</button><button id="animate" aria-pressed="false">Play sequence</button><button id="next" aria-label="Next QR frame">→</button></div><p id="sequence-help" class="hint">Each frame holds part of your film. Scan them all, in any order.</p><div class="downloads"><button id="save-qr">Save PNG ↓</button><button id="save-encoded">Save WebM ↓</button></div></div></div>
    </section>
    <section id="decode-panel" aria-labelledby="decode-tab" class="workspace" hidden>
      <div class="controls"><div class="section-head"><h2>Bring it back.</h2><span>QR → VIDEO</span></div><label class="upload" for="qr-files"><span class="upload-symbol" aria-hidden="true">↙</span><strong>Import QR images</strong><span>PNG · select one or several frames</span><input id="qr-files" type="file" accept="image/png" multiple></label><div class="actions"><button id="camera-start" class="primary">Use camera</button><button id="camera-stop" hidden>Stop camera</button><button id="example">Try example ↗</button></div><p class="hint">Camera opens only when you ask. Use good light and keep the full code in view.</p><video id="camera" autoplay muted playsinline hidden aria-label="QR scanner camera preview"></video><div class="collection"><div><span id="collection-count">0 frames collected</span><button id="reset">Reset</button></div><progress id="collection-progress" value="0" max="1" aria-label="QR frames collected"></progress></div></div>
      <div class="output"><div class="section-head"><h2>The little picture.</h2><span>RECONSTRUCTED</span></div><div id="decode-empty" class="empty-state"><div class="play-glyph" aria-hidden="true">▷</div><p>A code becomes a film.<br>No link. The actual bytes.</p></div><div id="decoded-result" hidden><video id="decoded-video" controls playsinline aria-label="Decoded video"></video><p class="hint">Tiny by design. Every byte made the trip.</p><button id="save-decoded" class="download-link">Save WebM ↓</button></div></div>
    </section>
    <div class="status-line"><span aria-hidden="true">↳</span><p id="status" role="status" aria-live="polite" aria-atomic="true">Choose a clip to begin.</p></div>
    <footer><span>LESS DATA. MORE IMAGINATION.</span><details><summary>About this experiment</summary><p>Local compression. Real video bytes in versioned QR packets. Larger clips need a sequence. Legacy WebP/Opus QR format is not yet available. Camera needs HTTPS or localhost.</p></details></footer>
  </main>`;

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const button = (id: string) => el<HTMLButtonElement>(id);
const input = (id: string) => el<HTMLInputElement>(id);
const video = (id: string) => el<HTMLVideoElement>(id);
const status = (message: string) => { el('status').textContent = message; };
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const MAX_INPUT = 100 * 1024 * 1024;
const MAX_VIDEO = 8 * 1024 * 1024;
let screen: 'encode' | 'decode' = 'encode';
let source: File | undefined;
let sourceDuration = 0;
let sourceURL = '';
let encodedBlob: Blob | undefined;
let playbackURL = '';
let recoveredBlob: Blob | undefined;
let exporting = false;
let packets: Uint8Array[] = [];
let frame = 0;
let encodeEpoch = 0;
let decodeEpoch = 0;
let sourceEpoch = 0;
let busy = false;
let importing = false;
let completed = false;
let collector = new PacketCollector();
let animation: ReturnType<typeof setInterval> | undefined;
let stream: MediaStream | undefined;
let cameraEpoch = 0;
let cameraTimer: ReturnType<typeof setTimeout> | undefined;
let exampleAbort: AbortController | undefined;
const scanCanvas = document.createElement('canvas');
const scanContext = scanCanvas.getContext('2d', { willReadFrequently: true })!;
const revoke = (url: string) => { if (url) URL.revokeObjectURL(url); };
const blobOf = (data: Uint8Array) => new Blob([new Uint8Array(data)], { type: 'video/webm' });
function stopAnimation() {
  clearInterval(animation); animation = undefined;
  button('animate').textContent = 'Play sequence'; button('animate').setAttribute('aria-pressed', 'false');
}
function stopCamera() {
  cameraEpoch++; clearTimeout(cameraTimer);
  stream?.getTracks().forEach(track => track.stop()); stream = undefined;
  video('camera').pause(); video('camera').srcObject = null; video('camera').hidden = true;
  button('camera-stop').hidden = true; button('camera-start').disabled = importing || completed;
}
function cancelEncoding() {
  encodeEpoch++; if (busy) cancelMedia(); busy = false;
  button('encode').disabled = !source || !sourceDuration;
  button('cancel').hidden = true; el<HTMLFieldSetElement>('settings').disabled = false;
}
function switchScreen(next: typeof screen) {
  if (next === screen) return;
  stopAnimation(); stopCamera(); cancelEncoding();
  video('source-video').pause(); video('decoded-video').pause();
  if (completed && !playbackURL) {
    // Playback preparation is disposable; verified recovery is not.
    cancelMedia();
  }
  // Invalidate pending import/decode operations before switching workspaces.
  decodeEpoch++; exampleAbort?.abort(); importing = false;
  button('example').disabled = false; input('qr-files').disabled = false;
  button('camera-start').disabled = completed;
  screen = next;
  for (const name of ['encode', 'decode']) {
    el(`${name}-panel`).hidden = name !== next;
    button(`${name}-tab`).setAttribute('aria-pressed', String(name === next));
  }
  status(next === 'encode' ? 'Choose a clip, then make a code.' : 'Import a QR image or start the camera.');
  if (next === 'decode' && completed) {
    if (playbackURL) status('Film recovered. Press play.');
    else void preparePlayback(decodeEpoch);
  }
}
button('encode-tab').onclick = () => switchScreen('encode');
button('decode-tab').onclick = () => switchScreen('decode');
function clearEncoded() {
  stopAnimation(); packets = []; frame = 0; encodedBlob = undefined;
  el('qr-result').hidden = true; el('qr-empty').hidden = false; el('output-count').textContent = '—';
}
input('video-file').onchange = () => {
  cancelEncoding(); clearEncoded(); sourceEpoch++;
  source = undefined; sourceDuration = 0; revoke(sourceURL); sourceURL = '';
  const preview = video('source-video'); preview.pause(); preview.removeAttribute('src'); preview.load(); preview.hidden = true;
  button('encode').disabled = true; el('source-name').textContent = 'No clip selected';
  const file = input('video-file').files?.[0];
  if (!file) return;
  if (!file.size || file.size > MAX_INPUT) { status('Choose a nonempty video under 100 MB.'); return; }
  const epoch = sourceEpoch;
  source = file; el('source-name').textContent = file.name;
  sourceURL = URL.createObjectURL(file); preview.hidden = false;
  preview.onloadedmetadata = () => {
    if (epoch !== sourceEpoch) return;
    if (!Number.isFinite(preview.duration) || preview.duration < .1 || preview.duration > 86400) {
      source = undefined; status('This clip has no supported duration. Try another video.'); return;
    }
    sourceDuration = preview.duration;
    input('trim-start').value = '0'; input('trim-start').max = String(Math.max(0, sourceDuration - .1));
    input('trim-duration').value = String(Math.min(3, Math.floor(sourceDuration * 10) / 10));
    button('encode').disabled = false; status('Clip ready. Choose a short cut.');
  };
  preview.onerror = () => { if (epoch === sourceEpoch) { source = undefined; button('encode').disabled = true; status('This browser cannot read that video. Try MP4 or WebM.'); } };
  preview.src = sourceURL;
};
function drawFrame() {
  if (!packets.length) return;
  // Byte segments preserve arbitrary packet bytes; text encoding would corrupt them.
  void QRCode.toCanvas(el<HTMLCanvasElement>('qr-canvas'), [{ data: packets[frame], mode: 'byte' }], {
    version: 40, errorCorrectionLevel: 'L', margin: 4, scale: 4,
    color: { dark: '#171916', light: '#ffffff' },
  }).catch(error => status(`Could not render this frame. ${errorText(error)}`));
  el('frame-info').textContent = `FRAME ${String(frame + 1).padStart(2, '0')} / ${String(packets.length).padStart(2, '0')}`;
  button('previous').disabled = packets.length < 2; button('next').disabled = packets.length < 2;
  button('animate').hidden = packets.length < 2; el('sequence-help').hidden = packets.length < 2;
}
button('encode').onclick = async () => {
  if (!source || busy) return;
  const start = Number(input('trim-start').value), duration = Number(input('trim-duration').value);
  if (!input('trim-start').reportValidity() || !input('trim-duration').reportValidity() || !Number.isFinite(start + duration) || start + duration > sourceDuration + .05) {
    status('Keep the cut within the source video, up to 10 seconds.'); return;
  }
  const preset = el<HTMLSelectElement>('preset').value;
  const [width, fps, audioKbps] = preset === 'clear' ? [96, 8, 12] : preset === 'small' ? [48, 4, 6] : [24, 2, 4];
  const single = document.querySelector<HTMLInputElement>('input[name="mode"]:checked')!.value === 'single';
  clearEncoded(); busy = true; button('encode').disabled = true; button('cancel').hidden = false;
  el<HTMLFieldSetElement>('settings').disabled = true;
  const epoch = ++encodeEpoch;
  status('Preparing local compression. The first run may take a moment…');
  try {
    const data = await compressVideo(source, { start, duration, width, fps, audioKbps }, message => { if (epoch === encodeEpoch) status(message); });
    if (epoch !== encodeEpoch) return;
    if (data.byteLength > MAX_VIDEO) throw new Error('Compressed clip exceeds 8 MB. Choose a shorter, smaller cut.');
    const result = await packVideo(data);
    if (epoch !== encodeEpoch) return;
    if (single && result.length !== 1) throw new Error(`This cut needs ${result.length} QR frames. Shorten it or explicitly choose Sequence and try again.`);
    packets = result; frame = 0; drawFrame();
    encodedBlob = blobOf(data);
    el('qr-empty').hidden = true; el('qr-result').hidden = false;
    el('output-count').textContent = `${data.byteLength.toLocaleString()} BYTES`;
    status(`${packets.length === 1 ? 'One code' : `${packets.length} frames`}. Your video is inside.`);
  } catch (error) { if (epoch === encodeEpoch) status(errorText(error)); }
  finally { if (epoch === encodeEpoch) { busy = false; button('encode').disabled = !source; button('cancel').hidden = true; el<HTMLFieldSetElement>('settings').disabled = false; } }
};
button('cancel').onclick = () => { cancelEncoding(); status('Compression cancelled.'); };
button('previous').onclick = () => { stopAnimation(); frame = (frame - 1 + packets.length) % packets.length; drawFrame(); };
button('next').onclick = () => { stopAnimation(); frame = (frame + 1) % packets.length; drawFrame(); };
button('animate').onclick = () => {
  if (animation) { stopAnimation(); return; }
  if (packets.length < 2) return;
  button('animate').textContent = 'Pause sequence'; button('animate').setAttribute('aria-pressed', 'true');
  animation = setInterval(() => { frame = (frame + 1) % packets.length; drawFrame(); }, 1800);
};
async function saveFile(blob: Blob, filename: string) {
  if (exporting) return;
  exporting = true;
  const controls = ['save-qr', 'save-encoded', 'save-decoded'];
  controls.forEach(id => { button(id).disabled = true; });
  status('Preparing export…');
  try { await exportFile(blob, filename); status('Export opened. Choose where to save your file.'); }
  catch (error) { status(`Export could not finish. ${errorText(error)}`); }
  finally { exporting = false; controls.forEach(id => { button(id).disabled = false; }); }
}
button('save-qr').onclick = () => {
  if (!packets.length || exporting) return;
  const name = `video-qr-${String(frame + 1).padStart(3, '0')}-of-${packets.length}.png`;
  el<HTMLCanvasElement>('qr-canvas').toBlob(blob => {
    if (!blob) { status('Could not export this frame.'); return; }
    void saveFile(blob, name);
  }, 'image/png');
};
button('save-encoded').onclick = () => { if (encodedBlob) void saveFile(encodedBlob, 'video-qr.webm'); };
button('save-decoded').onclick = () => { if (recoveredBlob) void saveFile(recoveredBlob, 'recovered-video.webm'); };
function clearDecoded() {
  const player = video('decoded-video'); player.pause(); player.removeAttribute('src'); player.load();
  revoke(playbackURL); playbackURL = ''; recoveredBlob = undefined;
  el('decoded-result').hidden = true; el('decode-empty').hidden = false;
}
button('reset').onclick = () => {
  stopCamera(); decodeEpoch++; exampleAbort?.abort(); cancelMedia(); collector = new PacketCollector(); completed = false; importing = false;
  clearDecoded(); input('qr-files').value = ''; input('qr-files').disabled = false;
  button('example').disabled = false; button('camera-start').disabled = false;
  el('collection-count').textContent = '0 frames collected'; el<HTMLProgressElement>('collection-progress').value = 0;
  status('Collection cleared. Ready for a new film.');
};
async function collect(data: Uint8Array, epoch: number) {
  if (epoch !== decodeEpoch || completed) return;
  const result = await collector.add(data);
  if (epoch !== decodeEpoch) return;
  el('collection-count').textContent = `${result.received} / ${result.total} frames collected`;
  const progress = el<HTMLProgressElement>('collection-progress'); progress.max = result.total || 1; progress.value = result.received;
  status(`${result.received} of ${result.total} frames collected.`);
  if (!result.complete) return;
  completed = true; stopCamera();
  recoveredBlob = blobOf(result.complete);
  el('decoded-result').hidden = false; el('decode-empty').hidden = true;
  await preparePlayback(epoch);
}
async function preparePlayback(epoch: number) {
  const recovered = recoveredBlob;
  if (!recovered || epoch !== decodeEpoch) return;
  status('All frames recovered. Preparing playback…');
  try {
    const data = new Uint8Array(await recovered.arrayBuffer());
    if (epoch !== decodeEpoch) return;
    const blob = await playableVideo(data);
    if (epoch !== decodeEpoch) return;
    playbackURL = URL.createObjectURL(blob); video('decoded-video').src = playbackURL;
    status('Film recovered. Press play.');
  } catch (error) { if (epoch === decodeEpoch) status(`Film recovered; playback unavailable. Save the WebM. ${errorText(error)}`); }
}
async function scanImage(blob: Blob, epoch: number) {
  if (!blob.size || blob.size > 20 * 1024 * 1024) throw new Error('Each PNG must be under 20 MB.');
  // Read PNG dimensions before asking the browser to allocate a decoded bitmap.
  const header = new DataView(await blob.slice(0, 24).arrayBuffer());
  if (header.byteLength < 24 || header.getUint32(0) !== 0x89504e47 || header.getUint32(4) !== 0x0d0a1a0a || header.getUint32(12) !== 0x49484452) throw new Error('Choose a valid PNG image.');
  const width = header.getUint32(16), height = header.getUint32(20);
  if (!width || !height || width > 8192 || height > 8192 || width * height > 24_000_000) throw new Error('Image too large. Use a PNG under 24 megapixels and 8192 px per side.');
  if (epoch !== decodeEpoch) return;
  const bitmap = await createImageBitmap(blob);
  try {
    if (epoch !== decodeEpoch) return;
    const scale = Math.min(1, 2048 / Math.max(width, height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
    if (!code) throw new Error('No readable QR found. Import the original PNG with its white border.');
    await collect(new Uint8Array(code.binaryData), epoch);
  } finally { bitmap.close(); }
}
async function importImages(files: Blob[]) {
  if (importing || completed) { status(completed ? 'Reset to collect another film.' : 'An import is already running.'); return; }
  if (files.length > 512) { status('Import up to 512 PNGs at a time.'); return; }
  stopCamera(); importing = true; const epoch = decodeEpoch;
  input('qr-files').disabled = true; button('example').disabled = true; button('camera-start').disabled = true;
  let errors = 0; let lastError = '';
  try {
    for (const file of files) {
      if (epoch !== decodeEpoch || completed) break;
      try { await scanImage(file, epoch); } catch (error) { errors++; lastError = errorText(error); }
    }
    if (errors && epoch === decodeEpoch && !completed) status(`${errors} image${errors === 1 ? '' : 's'} could not be added. ${lastError}`);
  } finally {
    if (epoch === decodeEpoch) { importing = false; input('qr-files').disabled = false; button('example').disabled = false; button('camera-start').disabled = completed; }
  }
}
input('qr-files').onchange = () => { const files = Array.from(input('qr-files').files || []); input('qr-files').value = ''; void importImages(files); };
button('example').onclick = async () => {
  if (importing || completed) { status('Reset to try the example.'); return; }
  const epoch = decodeEpoch; exampleAbort?.abort(); exampleAbort = new AbortController();
  button('example').disabled = true; status('Opening the example QR…');
  try {
    const response = await fetch('./examples/demo-qr.png', { signal: exampleAbort.signal });
    if (!response.ok) throw new Error('Example QR is not available yet. Import a PNG to try decoding.');
    const blob = await response.blob(); if (epoch !== decodeEpoch) return;
    await importImages([blob]);
  } catch (error) { if (epoch === decodeEpoch) status(errorText(error)); }
  finally { if (epoch === decodeEpoch) button('example').disabled = importing; }
};
button('camera-start').onclick = async () => {
  if (importing || completed) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { status('Camera needs HTTPS or localhost and a supported browser. You can still import PNGs.'); return; }
  stopCamera(); const epoch = cameraEpoch; button('camera-start').disabled = true; button('camera-stop').hidden = false;
  status('Waiting for camera permission…');
  try {
    const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    if (epoch !== cameraEpoch || screen !== 'decode' || document.hidden) { media.getTracks().forEach(track => track.stop()); return; }
    stream = media; const preview = video('camera'); preview.srcObject = media; preview.hidden = false; await preview.play();
    if (epoch !== cameraEpoch) return;
    status('Keep the full code steady in view.');
    const tick = async () => {
      if (epoch !== cameraEpoch || !stream || completed) return;
      if (preview.readyState >= 2 && preview.videoWidth && preview.videoHeight) {
        const scale = Math.min(1, 1920 / Math.max(preview.videoWidth, preview.videoHeight));
        scanCanvas.width = Math.max(1, Math.round(preview.videoWidth * scale)); scanCanvas.height = Math.max(1, Math.round(preview.videoHeight * scale));
        try {
          scanContext.drawImage(preview, 0, 0, scanCanvas.width, scanCanvas.height);
          const pixels = scanContext.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
          const code = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' });
          if (code) await collect(new Uint8Array(code.binaryData), decodeEpoch);
        } catch (error) { if (epoch === cameraEpoch) status(errorText(error)); }
      }
      if (epoch === cameraEpoch && !completed) cameraTimer = setTimeout(() => void tick(), 400);
    };
    void tick();
  } catch (error) {
    if (epoch !== cameraEpoch) return;
    stopCamera(); status(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Camera permission was declined. Allow camera access in browser settings, or import PNGs.' : `Camera unavailable. ${errorText(error)} Import PNGs instead.`);
  }
};
button('camera-stop').onclick = () => { stopCamera(); status('Camera stopped. Your collected frames are kept.'); };
video('decoded-video').onerror = () => { if (completed) status('Playback is not supported here. Save the recovered WebM to play it elsewhere.'); };
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopCamera(); stopAnimation(); video('source-video').pause(); video('decoded-video').pause(); } });
window.addEventListener('pagehide', event => {
  stopCamera(); stopAnimation(); cancelEncoding(); decodeEpoch++; exampleAbort?.abort(); cancelMedia();
  video('source-video').pause(); video('decoded-video').pause();
  if (!event.persisted) { revoke(sourceURL); revoke(playbackURL); }
});
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  importing = false; input('qr-files').disabled = false; button('example').disabled = false;
  if (screen === 'decode' && completed && !playbackURL) void preparePlayback(decodeEpoch);
});

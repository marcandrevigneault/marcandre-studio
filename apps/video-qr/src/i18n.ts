export type Language = 'fr' | 'en';
export const LANGUAGE_KEY = 'studio-language';
export type Params = Record<string, string | number>;
const french: Record<string, string> = {
  "STUDIO / EXPERIMENT 01": "STUDIO / EXPÉRIENCE 01",
  "ON YOUR DEVICE": "SUR VOTRE APPAREIL",
  "A POCKET CINEMA": "UN CINÉMA DE POCHE",
  "Video": "Vidéo",
  "A tiny film. Inside a code.": "Un petit film. Dans un code.",
  "Workspace": "Espace de travail",
  "Encode": "Encoder",
  "Decode": "Décoder",
  "Make it small.": "En petit format.",
  "VIDEO → QR": "VIDÉO → QR",
  "Choose a video": "Choisir une vidéo",
  "Up to 100 MB · stays on this device": "Jusqu’à 100 Mo · reste sur cet appareil",
  "No clip selected": "Aucun extrait sélectionné",
  "Original video preview": "Aperçu de la vidéo originale",
  "01 / THE CUT": "01 / L’EXTRAIT",
  "Start (seconds)": "Début (secondes)",
  "Length (seconds)": "Durée (secondes)",
  "Detail preset": "Niveau de détail",
  "Tiny · 24 px / 2 fps / 4 kbps audio": "Minimal · 24 px / 2 i/s / audio 4 kbit/s",
  "Small · 48 px / 4 fps / 6 kbps audio": "Petit · 48 px / 4 i/s / audio 6 kbit/s",
  "Clear · 96 px / 8 fps / 12 kbps audio": "Net · 96 px / 8 i/s / audio 12 kbit/s",
  "10 seconds maximum. Less detail travels further.": "10 secondes maximum. Moins de détails, plus de possibilités.",
  "02 / THE CARRIER": "02 / LE SUPPORT",
  "Single code": "Code unique",
  "Refuses clips that do not fit.": "Refuse les extraits trop volumineux.",
  "Sequence": "Séquence",
  "Collect every frame to play.": "Recueillez chaque image pour lire la vidéo.",
  "Make QR": "Créer le QR",
  "Cancel": "Annuler",
  "Your carrier.": "Votre support.",
  "Small enough to carry.": "Assez petit pour l’emporter.",
  "Ready when you are.": "Prêt quand vous l’êtes.",
  "Video QR code": "Code QR vidéo",
  "Previous QR frame": "Image QR précédente",
  "Play sequence": "Lire la séquence",
  "Pause sequence": "Mettre la séquence en pause",
  "Next QR frame": "Image QR suivante",
  "Each frame holds part of your film. Scan them all, in any order.": "Chaque image contient une partie du film. Scannez-les toutes, dans n’importe quel ordre.",
  "Save PNG ↓": "Enregistrer le PNG ↓",
  "Save WebM ↓": "Enregistrer le WebM ↓",
  "Bring it back.": "Retrouvez votre film.",
  "QR → VIDEO": "QR → VIDÉO",
  "Import QR images": "Importer des images QR",
  "PNG · select one or several frames": "PNG · sélectionnez une ou plusieurs images",
  "Use camera": "Utiliser la caméra",
  "Stop camera": "Arrêter la caméra",
  "Try example ↗": "Essayer l’exemple ↗",
  "Camera opens only when you ask. Use good light and keep the full code in view.": "La caméra s’ouvre à votre demande. Éclairez bien le code et gardez-le entièrement visible.",
  "QR scanner camera preview": "Aperçu de la caméra de lecture QR",
  "0 frames collected": "0 image recueillie",
  "Reset": "Réinitialiser",
  "QR frames collected": "Images QR recueillies",
  "The little picture.": "Le petit film.",
  "RECONSTRUCTED": "RECONSTITUÉ",
  "A code becomes a film.": "Un code devient un film.",
  "No link. The actual bytes.": "Pas un lien. Les vrais octets.",
  "Decoded video": "Vidéo décodée",
  "Tiny by design. Every byte made the trip.": "Petit par choix. Chaque octet est arrivé à destination.",
  "Choose a clip to begin.": "Choisissez un extrait pour commencer.",
  "LESS DATA. MORE IMAGINATION.": "MOINS DE DONNÉES. PLUS D’IMAGINATION.",
  "About this experiment": "À propos de cette expérience",
  "Local compression. Real video bytes in versioned QR packets. Larger clips need a sequence. Legacy WebP/Opus QR format is not yet available. Camera needs HTTPS or localhost.": "Compression locale. Les octets de la vidéo sont dans des paquets QR versionnés. Les extraits plus volumineux nécessitent une séquence. L’ancien format QR WebP/Opus n’est pas encore disponible. La caméra nécessite HTTPS ou localhost.",
  "Choose a clip, then make a code.": "Choisissez un extrait, puis créez un code.",
  "Import a QR image or start the camera.": "Importez une image QR ou démarrez la caméra.",
  "Film recovered. Press play.": "Film récupéré. Lancez la lecture.",
  "Choose a nonempty video under 100 MB.": "Choisissez une vidéo non vide de moins de 100 Mo.",
  "This clip has no supported duration. Try another video.": "La durée de cet extrait n’est pas prise en charge. Essayez une autre vidéo.",
  "Clip ready. Choose a short cut.": "Extrait prêt. Choisissez un court passage.",
  "This browser cannot read that video. Try MP4 or WebM.": "Ce navigateur ne peut pas lire cette vidéo. Essayez un fichier MP4 ou WebM.",
  "Keep the cut within the source video, up to 10 seconds.": "Choisissez un extrait de 10 secondes maximum, compris dans la vidéo source.",
  "Preparing local compression. The first run may take a moment…": "Préparation de la compression locale. Le premier lancement peut prendre un moment…",
  "Compressed clip exceeds 8 MB. Choose a shorter, smaller cut.": "L’extrait compressé dépasse 8 Mo. Choisissez un passage plus court et moins détaillé.",
  "Compression cancelled.": "Compression annulée.",
  "Preparing export…": "Préparation de l’exportation…",
  "Export opened. Choose where to save your file.": "Exportation ouverte. Choisissez où enregistrer votre fichier.",
  "Could not export this frame.": "Impossible d’exporter cette image.",
  "Collection cleared. Ready for a new film.": "Collecte effacée. Prêt pour un nouveau film.",
  "All frames recovered. Preparing playback…": "Toutes les images sont récupérées. Préparation de la lecture…",
  "Each PNG must be under 20 MB.": "Chaque PNG doit faire moins de 20 Mo.",
  "Choose a valid PNG image.": "Choisissez une image PNG valide.",
  "Image too large. Use a PNG under 24 megapixels and 8192 px per side.": "Image trop grande. Utilisez un PNG de moins de 24 mégapixels et de 8192 px maximum par côté.",
  "No readable QR found. Import the original PNG with its white border.": "Aucun QR lisible trouvé. Importez le PNG original avec sa bordure blanche.",
  "Reset to collect another film.": "Réinitialisez pour recueillir un autre film.",
  "An import is already running.": "Une importation est déjà en cours.",
  "Import up to 512 PNGs at a time.": "Importez jusqu’à 512 PNG à la fois.",
  "Reset to try the example.": "Réinitialisez pour essayer l’exemple.",
  "Opening the example QR…": "Ouverture du QR d’exemple…",
  "Example QR is not available yet. Import a PNG to try decoding.": "Le QR d’exemple n’est pas encore disponible. Importez un PNG pour essayer le décodage.",
  "Camera needs HTTPS or localhost and a supported browser. You can still import PNGs.": "La caméra nécessite HTTPS ou localhost et un navigateur compatible. Vous pouvez aussi importer des PNG.",
  "Waiting for camera permission…": "En attente de l’autorisation d’utiliser la caméra…",
  "Keep the full code steady in view.": "Gardez le code entier bien visible et stable.",
  "Camera permission was declined. Allow camera access in browser settings, or import PNGs.": "L’accès à la caméra a été refusé. Autorisez-le dans les paramètres du navigateur ou importez des PNG.",
  "Camera stopped. Your collected frames are kept.": "Caméra arrêtée. Vos images recueillies sont conservées.",
  "Playback is not supported here. Save the recovered WebM to play it elsewhere.": "La lecture n’est pas prise en charge ici. Enregistrez le WebM récupéré pour le lire ailleurs.",
  "Something went wrong. Please try again.": "Une erreur est survenue. Veuillez réessayer.",
  "Loading local video engine…": "Chargement du moteur vidéo local…",
  "Encoding locally…": "Encodage local…",
  "Media job cancelled.": "Traitement vidéo annulé.",
  "Encoded video is empty or exceeds 8 MiB. Try a shorter or smaller clip.": "La vidéo encodée est vide ou dépasse 8 Mio. Essayez un extrait plus court ou moins détaillé.",
  "Choose a nonempty video no larger than 100 MiB.": "Choisissez une vidéo non vide de 100 Mio maximum.",
  "Video must contain 1 byte to 8 MiB.": "La vidéo doit contenir entre 1 octet et 8 Mio.",
  "Invalid packet size.": "Taille de paquet invalide.",
  "Unsupported or malformed Video QR header.": "En-tête Video QR non pris en charge ou mal formé.",
  "Invalid packet count or index.": "Nombre ou index de paquets invalide.",
  "Invalid packet payload length.": "Longueur des données du paquet invalide.",
  "Collection reset; packet cancelled.": "Collecte réinitialisée ; paquet annulé.",
  "Mixed video sequences. Reset before scanning another video.": "Séquences vidéo différentes. Réinitialisez avant de scanner une autre vidéo.",
  "Conflicting duplicate packet.": "Paquet en double avec des données différentes.",
  "Video integrity check failed (SHA-256). Scan the sequence again.": "Échec de la vérification d’intégrité vidéo (SHA-256). Scannez de nouveau la séquence.",
  "Invalid export filename.": "Nom de fichier d’exportation invalide.",
  "Export is empty or exceeds 12 MB.": "L’exportation est vide ou dépasse 12 Mo.",
  "Could not prepare this file for sharing.": "Impossible de préparer ce fichier pour le partage.",
  "Could not read export data.": "Impossible de lire les données à exporter.",
  "Invalid settings: duration ≤10s, even width 16–640px, fps 1–30, audio 0–128 kbps, nonnegative start.": "Paramètres invalides : durée ≤10 s, largeur paire de 16 à 640 px, 1 à 30 i/s, audio de 0 à 128 kbit/s et début positif ou nul.",
  "Video QR — a pocket cinema": "Vidéo QR — un cinéma de poche",
  "A tiny film, carried by a QR code. Encode and recover short videos on your device.": "Un petit film dans un code QR. Encodez et récupérez de courtes vidéos sur votre appareil.",
  "Language": "Langue",
  "Could not render this frame. {error}": "Impossible d’afficher cette image. {error}",
  "FRAME {current} / {total}": "IMAGE {current} / {total}",
  "This cut needs {count} QR frames. Shorten it or explicitly choose Sequence and try again.": "Cet extrait nécessite {count} images QR. Raccourcissez-le ou choisissez Séquence et réessayez.",
  "{bytes} BYTES": "{bytes} OCTETS",
  "One code. Your video is inside.": "Un code. Votre vidéo est à l’intérieur.",
  "{count} frames. Your video is inside.": "{count} images. Votre vidéo est à l’intérieur.",
  "Export could not finish. {error}": "L’exportation n’a pas pu se terminer. {error}",
  "{received} / {total} frames collected": "{received} / {total} images recueillies",
  "{received} of {total} frames collected.": "{received} images sur {total} recueillies.",
  "Film recovered; playback unavailable. Save the WebM. {error}": "Film récupéré ; lecture indisponible. Enregistrez le WebM. {error}",
  "{count} image could not be added. {error}": "{count} image n’a pas pu être ajoutée. {error}",
  "{count} images could not be added. {error}": "{count} images n’ont pas pu être ajoutées. {error}",
  "Camera unavailable. {error} Import PNGs instead.": "Caméra indisponible. {error} Importez des PNG.",
  "Encoding… {percent}%": "Encodage… {percent} %",
  "Video encoding failed (FFmpeg exit {code}). Try a shorter or smaller clip.": "Échec de l’encodage vidéo (code FFmpeg {code}). Essayez un extrait plus court ou moins détaillé.",
  "Video processing failed: {error}": "Échec du traitement vidéo : {error}"
};

export function resolveLanguage(search: string, persisted: string | null): Language {
  const explicit = new URLSearchParams(search).get('lang');
  return explicit === 'fr' || explicit === 'en' ? explicit : persisted === 'en' ? 'en' : 'fr';
}
export function translate(language: Language, key: string, params: Params = {}): string {
  const text = language === 'fr' ? french[key] ?? key : key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));
}
// The media/packet/export APIs keep their existing messages and contracts.
export function translateError(language: Language, error: unknown): string {
  if (!(error instanceof Error)) return translate(language, 'Something went wrong. Please try again.');
  const message = error.message;
  if (language === 'en') return message;
  if (french[message]) return translate(language, message);
  const encoding = /^Video encoding failed \(FFmpeg exit (-?\d+)\)\. Try a shorter or smaller clip\.$/.exec(message);
  if (encoding) return translate(language, 'Video encoding failed (FFmpeg exit {code}). Try a shorter or smaller clip.', { code: encoding[1] });
  const frames = /^This cut needs (\d+) QR frames\. Shorten it or explicitly choose Sequence and try again\.$/.exec(message);
  if (frames) return translate(language, 'This cut needs {count} QR frames. Shorten it or explicitly choose Sequence and try again.', { count: frames[1] });
  if (message.startsWith('Video processing failed: ')) return translate(language, 'Video processing failed: {error}', { error: message.slice(25) });
  return 'Erreur technique : ' + message;
}
export function translateProgress(language: Language, message: string): string {
  const progress = /^Encoding… (\d+)%$/.exec(message);
  return progress ? translate(language, 'Encoding… {percent}%', { percent: progress[1] }) : translate(language, message);
}

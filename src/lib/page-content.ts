import type { ArticleEdit, ArticleLanguage } from './article-editing';
// Stable block IDs keep prose editable independently of the interactive components.
const blocks: Record<string, Record<ArticleLanguage, ArticleEdit>> = {
  'page-video-qr-intro': {
    fr: { title: 'Un peu de cinéma.\nDans un code QR.', subtitle: 'Vidéo QR / Faire plus avec moins', summary: '', body: 'Réduire une vidéo, garder le son et faire tenir le tout dans un QR. Scannez-le pour retrouver l’extrait, sans lien vers un fichier vidéo.' },
    en: { title: 'A little cinema.\nInside a QR code.', subtitle: 'Video QR / An experiment in less', summary: '', body: 'Shrink a video, keep its sound, and put the bytes inside a QR. Scan it to bring the clip back — no video link required.' },
  },
  'page-video-qr-sample-01': {
    fr: { title: '2 heures. 18,44 Mo.', subtitle: '01 / Tout le film, en tout petit', summary: '96 × 59 pixels · 8 images/s · son mono.', body: 'Un aperçu de 8 secondes du film compressé. Le film entier ne tient pas dans un seul QR.' },
    en: { title: '2 hours. 18.44 MB.', subtitle: '01 / The whole film, made tiny', summary: '96 × 59 pixels · 8 FPS · mono audio.', body: 'An eight-second preview of the compressed film. The full film does not fit in a single QR.' },
  },
  'page-video-qr-sample-02': {
    fr: { title: '« Elle fait même pas d’ombre »', subtitle: '02 / Un extrait, un QR', summary: '3 secondes · son inclus · un seul QR.', body: 'Passage à 28:56 du film, réencodé avec cet outil.' },
    en: { title: '« Elle fait même pas d’ombre »', subtitle: '02 / One clip, one QR', summary: '3 seconds · sound included · a single QR.', body: 'A passage at 28:56 in the film, re-encoded with this tool.' },
  },
  'page-video-qr-sample-03': {
    fr: { title: 'Un extrait sans son.', subtitle: '03 / À essayer', summary: '3 secondes · 36 × 22 pixels · 3 images/s · sans son.', body: 'Scannez le QR avec le décodeur, ou téléchargez l’image pour l’importer.' },
    en: { title: 'A silent clip.', subtitle: '03 / Try it', summary: '3 seconds · 36 × 22 pixels · 3 FPS · no audio.', body: 'Scan the QR with the decoder, or download the image to import it.' },
  },
  'page-video-qr-generator': {
    fr: { title: 'Choisissez votre petit morceau de cinéma.', subtitle: 'À vous de jouer', summary: '', body: 'Parcourez le film, ajustez les curseurs et créez un QR contenant votre extrait. Le calcul se fait sur votre appareil.' },
    en: { title: 'Choose your little piece of cinema.', subtitle: 'Your turn', summary: '', body: 'Explore the film, adjust the sliders, and make a QR containing your clip. Processing stays on your device.' },
  },
};
export function originalPageBlock(slug: string, language: ArticleLanguage): ArticleEdit | null {
  return Object.hasOwn(blocks, slug) ? blocks[slug][language] ?? null : null;
}

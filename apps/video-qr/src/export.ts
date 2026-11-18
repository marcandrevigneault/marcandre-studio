import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** Export only application-generated names, never file names supplied by an upload. */
export async function exportFile(blob: Blob, filename: string): Promise<void> {
  if (!/^[a-z0-9][a-z0-9-]{0,79}\.(png|webm)$/.test(filename)) {
    throw new Error('Invalid export filename.');
  }
  if (!blob.size || blob.size > 12 * 1024 * 1024) throw new Error('Export is empty or exceeds 12 MB.');
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.hidden = true;
    document.body.append(link);
    try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
    return;
  }
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not prepare this file for sharing.'));
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== 'string' || !value.includes(',')) reject(new Error('Could not read export data.'));
      else resolve(value.slice(value.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
  // Stable, app-controlled names overwrite our bounded cache instead of accumulating files.
  const written = await Filesystem.writeFile({ path: `video-qr/${filename}`, data: base64, directory: Directory.Cache, recursive: true });
  await Share.share({ title: 'Video QR', files: [written.uri], dialogTitle: 'Save or share your Video QR' });
}

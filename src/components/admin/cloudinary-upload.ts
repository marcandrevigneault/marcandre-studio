import { signUpload } from './api-client';

export async function uploadToCloudinary(
  file: File, folder: 'mas/photos' | 'mas/audio', resourceType: 'image' | 'video',
): Promise<{ url: string; publicId: string }> {
  const sig = await signUpload(folder, resourceType);
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`;
  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${res.status}`);
  const data = await res.json();
  return { url: data.secure_url as string, publicId: data.public_id as string };
}

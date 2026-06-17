import { v2 as cloudinary } from 'cloudinary';
import { createHash } from 'node:crypto';
import { getEnv } from './env';

function configure() {
  const env = getEnv();
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
  return env;
}

export function signUpload(params: { folder: string; resourceType: 'image' | 'video' }) {
  const env = configure();
  // Fixed timestamp granularity keeps the test deterministic within a second; in
  // production Date.now() drives it. Sign the params Cloudinary requires.
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `folder=${params.folder}&timestamp=${timestamp}`;
  const signature = createHash('sha1')
    .update(toSign + env.cloudinaryApiSecret)
    .digest('hex');
  return {
    timestamp,
    signature,
    apiKey: env.cloudinaryApiKey,
    cloudName: env.cloudinaryCloudName,
    folder: params.folder,
    resourceType: params.resourceType,
  };
}

export async function listAudio(): Promise<{ src: string; title: string }[]> {
  configure();
  const res = await cloudinary.search
    .expression('folder:mas/audio')
    .max_results(100)
    .execute();
  return (res.resources ?? []).map((r: any) => ({
    src: r.secure_url as string,
    title: (r.public_id as string).split('/').pop() ?? r.public_id,
  }));
}

export function deliveryUrl(publicId: string, transform?: string): string {
  const env = configure();
  const t = transform ? `${transform}/` : '';
  return `https://res.cloudinary.com/${env.cloudinaryCloudName}/image/upload/${t}${publicId}`;
}

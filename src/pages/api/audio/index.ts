import type { APIRoute } from 'astro';
import { listAudio } from '../../../lib/cloudinary';

export const prerender = false;

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await listAudio()), {
    status: 200, headers: { 'content-type': 'application/json' },
  });

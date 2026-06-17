import type { APIRoute } from 'astro';
import { z } from 'zod';
import { signUpload } from '../../../lib/cloudinary';

export const prerender = false;

const schema = z.object({
  folder: z.enum(['mas/photos', 'mas/audio']),
  resourceType: z.enum(['image', 'video']),
});

export const POST: APIRoute = async ({ request }) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'bad params' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(signUpload(parsed.data)), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
};

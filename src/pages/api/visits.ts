import type { APIRoute } from 'astro';
import { adminService, sameOrigin, currentSession, adminConfigured } from '../../lib/admin-service';
import { validEvent } from '../../../workers/studio-admin/index.js';
export const prerender = false;
export const POST: APIRoute = async ({request,url}) => {
  if(!sameOrigin(request))return new Response(null,{status:403});
  if(!adminConfigured()||url.hostname!=='marcandre-studio.vercel.app'||/bot|crawler|spider|headless/i.test(request.headers.get('user-agent')??''))return new Response(null,{status:204});
  try {
    if(await currentSession(request.headers.get('cookie')))return new Response(null,{status:204});
    const raw=await request.text();if(raw.length>1024)return new Response(null,{status:413});
    let event;try{event=JSON.parse(raw);}catch{return new Response(null,{status:400});}
    if(!validEvent(event))return new Response(null,{status:400});
    await adminService('/events',{id:event.id,session:event.session,path:event.path});
    return new Response(null,{status:204});
  }catch{return new Response(null,{status:503});}
};

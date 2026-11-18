import type { APIRoute } from 'astro';
import { verifyPassword, createSessionCookie, isSecureRequest } from '../../../lib/auth';
import { adminConfigured, credentials, sameOrigin, allowPasswordAttempt } from '../../../lib/admin-service';
import { matchesPassword } from '../../../lib/admin-security';
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  const fail=(status:number,error:string)=>Response.json({ok:false,error},{status,headers:{'cache-control':'no-store'}});
  if (!sameOrigin(request)) return fail(403,'Origine refusée.');
  try {
    const raw=await request.text();if(raw.length>4096)return fail(413,'Requête trop grande.');
    let data;try{data=JSON.parse(raw);}catch{return fail(400,'Requête invalide.');}
    if(typeof data.password!=='string'||data.password.length>256)return fail(401,'Mot de passe incorrect.');
    if(!await allowPasswordAttempt(request))return fail(429,'Trop de tentatives. Réessayez dans 15 minutes.');
    const saved=adminConfigured()?await credentials():null;
    const valid=saved?await matchesPassword(data.password,saved.hash):verifyPassword(data.password);
    if(!valid)return fail(401,'Mot de passe incorrect.');
    return Response.json({ok:true},{headers:{'cache-control':'no-store','set-cookie':createSessionCookie(isSecureRequest(request),saved?.revision)}});
  } catch {return fail(503,'Connexion indisponible. Réessayez dans un instant.');}
};

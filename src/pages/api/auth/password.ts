import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { credentials, adminService, currentSession, sameOrigin, allowPasswordAttempt } from '../../../lib/admin-service';
import { hashPassword, matchesPassword, validNewPassword } from '../../../lib/admin-security';
import { createSessionCookie, isSecureRequest } from '../../../lib/auth';
export const prerender = false;
const json = (data: unknown, status = 200) => Response.json(data, {status, headers:{'cache-control':'no-store'}});
export const POST: APIRoute = async ({request}) => {
  if (!sameOrigin(request)) return json({error:'Origine refusée.'},403);
  try {
    if (!await currentSession(request.headers.get('cookie'))) return json({error:'Reconnectez-vous.'},401);
    const raw = await request.text(); if(raw.length>4096) return json({error:'Requête trop grande.'},413);
    let data;try{data=JSON.parse(raw);}catch{return json({error:'Requête invalide.'},400);}
    if (!validNewPassword(data.newPassword) || typeof data.currentPassword !== 'string' || data.currentPassword.length > 256) return json({error:'Le nouveau mot de passe doit contenir entre 12 et 256 caractères.'},400);
    if (!await allowPasswordAttempt(request)) return json({error:'Trop de tentatives. Réessayez dans 15 minutes.'},429);
    const saved = await credentials();
    if (!await matchesPassword(data.currentPassword, saved.hash)) return json({error:'Le mot de passe actuel est incorrect.'},401);
    if (data.newPassword === data.currentPassword) return json({error:'Choisissez un mot de passe différent.'},400);
    const revision=randomUUID();
    await adminService('/credentials',{hash:await hashPassword(data.newPassword),revision,expectedRevision:saved.revision},'PUT');
    return Response.json({ok:true},{headers:{'cache-control':'no-store','set-cookie':createSessionCookie(isSecureRequest(request),revision)}});
  } catch(error:any) {return json({error:error.status===409?'Le mot de passe vient de changer. Reconnectez-vous.':'Modification indisponible. Réessayez.'},error.status===409?409:503);}
};

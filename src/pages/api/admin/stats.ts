import type { APIRoute } from 'astro';
import { adminService, currentSession } from '../../../lib/admin-service';
export const prerender = false;
export const GET: APIRoute = async ({request,url}) => {
  try {
    if(!await currentSession(request.headers.get('cookie')))return Response.json({error:'unauthorized'},{status:401});
    const days=url.searchParams.get('days')==='7'?7:30;
    return Response.json(await adminService(`/stats?days=${days}`),{headers:{'cache-control':'private, no-store'}});
  }catch{return Response.json({error:'Statistiques indisponibles.'},{status:503,headers:{'cache-control':'no-store'}});}
};

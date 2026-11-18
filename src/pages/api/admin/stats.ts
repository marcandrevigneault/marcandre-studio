import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { pageViews, publicPages } from '../../../lib/page-views';
import { adminService, currentSession } from '../../../lib/admin-service';
export const prerender = false;
export const GET: APIRoute = async ({request,url}) => {
  try {
    if(!await currentSession(request.headers.get('cookie')))return Response.json({error:'unauthorized'},{status:401});
    const days=url.searchParams.get('days')==='7'?7:30;
    const [stats, galleries, articles] = await Promise.all([
      adminService(`/stats?days=${days}`),
      getCollection('galleries', entry => !entry.data.draft),
      getCollection('articles', entry => !entry.data.draft),
    ]);
    const catalog = [...publicPages,
      ...galleries.map(entry => ({path: `/photography/${entry.id}/`, title: entry.data.title})),
      ...articles.map(entry => ({path: `/science/${entry.id}/`, title: entry.data.title})),
    ];
    return Response.json({...stats, pages: pageViews(stats.pages, catalog)},{headers:{'cache-control':'private, no-store'}});
  }catch{return Response.json({error:'Statistiques indisponibles.'},{status:503,headers:{'cache-control':'no-store'}});}
};

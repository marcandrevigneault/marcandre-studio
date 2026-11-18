const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validEvent(event) {
  return uuid.test(event?.id) && uuid.test(event?.session) && typeof event?.path === 'string' && event.path.length < 200 && /^\/(?:$|(?:projects|about|photography|art|science)(?:\/[a-z0-9-]+)*\/?)$/.test(event.path);
}
export default {
  async fetch(request, env) {
    if (!env.ADMIN_KEY || request.headers.get('authorization') !== `Bearer ${env.ADMIN_KEY}`) return json({ error: 'Unauthorized' }, 401);
    const url = new URL(request.url), db = env.DB;
    const draftPage = /^\/page-drafts\/(home|projects|about)$/.exec(url.pathname)?.[1];
    try {
      let body;
      if (['POST', 'PUT'].includes(request.method) || (draftPage && request.method === 'DELETE')) {
        const text = await request.text(); if (draftPage ? new TextEncoder().encode(text).length > 300000 : text.length > 4096) return json({error:'Too large'},413);
        try { body = JSON.parse(text); } catch { return json({error:'Invalid JSON'},400); }
      }
      if (draftPage) {
        if (request.method === 'GET') {
          const row = await db.prepare('SELECT content, revision FROM page_drafts WHERE page=?').bind(draftPage).first();
          return json({draft: row ? {...JSON.parse(row.content), revision: row.revision} : null});
        }
        if (request.method === 'PUT') {
          const document = body?.document;
          const validSha = body?.baseSha === null || (typeof body?.baseSha === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(body.baseSha));
          const validRevision = value => typeof value === 'string' && uuid.test(value);
          const validDocument = document?.version === 1 && Array.isArray(document.blocks)
            && document.blocks.length >= 1 && document.blocks.length <= 60
            && document.blocks.every(block => block && typeof block.id === 'string'
              && /^[a-zA-Z0-9_-]{1,80}$/.test(block.id)
              && ['hero','text','image','video','button','columns','cards'].includes(block.type));
          if (!validSha || !validDocument || !validRevision(body?.revision)
            || !(body.expectedRevision === null || validRevision(body.expectedRevision))
            || body.revision === body.expectedRevision) return json({error:'Invalid draft'},400);
          const content = JSON.stringify({document,baseSha:body.baseSha});
          const result = body.expectedRevision === null
            ? await db.prepare('INSERT OR IGNORE INTO page_drafts (page,content,revision) VALUES (?,?,?)').bind(draftPage,content,body.revision).run()
            : await db.prepare('UPDATE page_drafts SET content=?,revision=? WHERE page=? AND revision=?').bind(content,body.revision,draftPage,body.expectedRevision).run();
          return result.meta.changes === 1 ? json({ok:true}) : json({error:'Draft changed'},409);
        }
        if (request.method === 'DELETE') {
          if (typeof body?.expectedRevision !== 'string' || !uuid.test(body.expectedRevision)) return json({error:'Invalid revision'},400);
          const result = await db.prepare('DELETE FROM page_drafts WHERE page=? AND revision=?').bind(draftPage,body.expectedRevision).run();
          return result.meta.changes === 1 ? json({ok:true}) : json({error:'Draft changed'},409);
        }
      }
      if (url.pathname === '/credentials') {
        if (request.method === 'GET') {
          const row = await db.prepare('SELECT hash, revision FROM credentials WHERE id = 1').first();
          return row ? json(row) : json({ error: 'Not initialized' }, 503);
        }
        if (request.method === 'PUT') {
          if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(body?.hash) || !/^[\w-]{8,80}$/.test(body?.revision)) return json({ error: 'Invalid credential' }, 400);
          let result;
          if (body.expectedRevision === null) result = await db.prepare('INSERT OR IGNORE INTO credentials (id,hash,revision) VALUES (1,?,?)').bind(body.hash,body.revision).run();
          else if (typeof body.expectedRevision === 'string') result = await db.prepare('UPDATE credentials SET hash=?,revision=? WHERE id=1 AND revision=?').bind(body.hash,body.revision,body.expectedRevision).run();
          else return json({error:'Invalid revision'},400);
          return result.meta.changes === 1 ? json({ok:true}) : json({error:'Credential changed'},409);
        }
      }
      if (url.pathname === '/attempt' && request.method === 'POST') {
        if (!/^[a-f0-9]{64}$/.test(body?.key)) return json({error:'Invalid key'},400);
        const bucket = Math.floor(Date.now()/900000);
        const row = await db.prepare('INSERT INTO attempts (key,bucket,count) VALUES (?,?,1) ON CONFLICT(key,bucket) DO UPDATE SET count=count+1 RETURNING count').bind(body.key,bucket).first();
        return json({allowed:row.count<=10});
      }
      if (url.pathname === '/events' && request.method === 'POST') {
        if (!validEvent(body)) return json({error:'Invalid event'},400);
        const now = new Date().toISOString();
        await db.prepare('INSERT OR IGNORE INTO events (id,at,day,path,session) VALUES (?,?,?,?,?)').bind(body.id,now,now.slice(0,10),body.path,body.session).run();
        return json({ok:true});
      }
      if (url.pathname === '/stats' && request.method === 'GET') {
        const days = url.searchParams.get('days') === '7' ? 7 : 30;
        const start = new Date(); start.setUTCDate(start.getUTCDate()-days+1); const since = start.toISOString().slice(0,10);
        const totals = await db.prepare('SELECT COUNT(*) AS totalViews,COUNT(DISTINCT session) AS totalVisits FROM events WHERE day>=?').bind(since).first();
        const rows = await db.prepare('SELECT day,COUNT(*) AS views,COUNT(DISTINCT session) AS visits FROM events WHERE day>=? GROUP BY day ORDER BY day').bind(since).all();
        const pages = await db.prepare('SELECT path,COUNT(*) AS views FROM events WHERE day>=? GROUP BY path ORDER BY views DESC, path ASC').bind(since).all();
        const started = await db.prepare("SELECT value FROM metadata WHERE key='startedAt'").first();
        const daily = Array.from({length:days},(_,i)=>{const date=new Date(start);date.setUTCDate(date.getUTCDate()+i);const day=date.toISOString().slice(0,10);return rows.results.find(r=>r.day===day)??{day,views:0,visits:0};});
        return json({days,startedAt:started?.value??null,...totals,daily,pages:pages.results,updatedAt:new Date().toISOString()});
      }
      return json({error:'Not found'},404);
    } catch { return json({ error: 'Storage unavailable' }, 503); }
  },
  async scheduled(_event, env) {
    const cutoff = new Date(Date.now()-90*86400000).toISOString().slice(0,10);
    await env.DB.prepare('DELETE FROM events WHERE day < ?').bind(cutoff).run();
    await env.DB.prepare('DELETE FROM attempts WHERE bucket < ?').bind(Math.floor(Date.now()/900000)-1).run();
  }
};

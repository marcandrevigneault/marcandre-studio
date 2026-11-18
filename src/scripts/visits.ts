// Session-only measurement: no cookie, fingerprint, query string or referrer is sent.
// A visit is a tab session with less than 30 minutes of inactivity.
async function measure() {
  if (!['mytinylab.vercel.app','marcandre-studio.vercel.app'].includes(location.hostname) || location.pathname.startsWith('/admin') || navigator.doNotTrack === '1' || (navigator as any).globalPrivacyControl) return;
  try {
    const response=await fetch('/api/auth/session',{cache:'no-store'});
    if(!response.ok||(await response.json()).authenticated)return;
    const now=Date.now();let session;
    try { session=JSON.parse(sessionStorage.getItem('studio-visit')??'null'); } catch { session=null; }
    if(!session||typeof session.id!=='string'||!Number.isFinite(session.at)||now-session.at>30*60*1000)session={id:crypto.randomUUID(),at:now};
    session.at=now;sessionStorage.setItem('studio-visit',JSON.stringify(session));
    await fetch('/api/visits',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),session:session.id,path:location.pathname}),keepalive:true});
  }catch{ /* Measurement must never interrupt the website. */ }
}
if(document.visibilityState==='visible')void measure();
else document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void measure();},{once:true});

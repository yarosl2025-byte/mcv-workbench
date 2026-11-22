// MCV Workbench service worker: network first (fresh code when online, 4 s timeout), cache when offline.
const CACHE='mcv-v0.4.0';
const SHELL=["./","css/app.css","fonts/ibm-plex-sans-cyrillic-400-normal.woff2","fonts/ibm-plex-sans-cyrillic-500-normal.woff2","fonts/ibm-plex-sans-cyrillic-600-normal.woff2","fonts/ibm-plex-sans-cyrillic-700-normal.woff2","fonts/ibm-plex-sans-latin-400-normal.woff2","fonts/ibm-plex-sans-latin-500-normal.woff2","fonts/ibm-plex-sans-latin-600-normal.woff2","fonts/ibm-plex-sans-latin-700-normal.woff2","icons/apple-180.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","index.html","js/app.js","js/clo.js","js/rhrs.js","js/store.js","js/tanks.js","manifest.webmanifest"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
  if(/\.(woff2|png)$/.test(u.pathname)){e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request)));return}
  e.respondWith(new Promise(resolve=>{let done=false;
    const fromCache=()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('./'));
    const t=setTimeout(()=>fromCache().then(r=>{if(r&&!done){done=true;resolve(r)}}),4000);
    fetch(e.request,{cache:'no-cache'}).then(res=>{clearTimeout(t);if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}if(!done){done=true;resolve(res)}})
      .catch(()=>{clearTimeout(t);fromCache().then(r=>{if(!done){done=true;resolve(r||Response.error())}})});
  }))});

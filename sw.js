/* Ring Timer — service worker: deja la app utilizable sin cobertura. */
var CACHE = 'ringtimer-v5';

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.add(new Request('./', {cache:'reload'})); })
      .catch(function(){})
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys()
      .then(function(ks){
        return Promise.all(ks.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

/* La página nos dice su propia URL para guardarla en la primera visita,
   sin esperar a una recarga. */
self.addEventListener('message', function(e){
  var d = e.data || {};
  if(!d.cache) return;
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.add(new Request(d.cache, {cache:'reload'}));
    }).catch(function(){})
  );
});

/* Cache primero: arranca instantáneo y funciona sin red.
   En segundo plano refresca la copia guardada cuando hay conexión. */
self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  /* Sólo lo de esta app. Sin esta línea se cachearía también la
     API de Spotify, y como esto es «cache primero», la canción que
     sonase la primera vez se quedaría clavada para siempre: la app
     preguntaría qué suena y el propio service worker le devolvería
     la respuesta vieja sin llegar a preguntar. */
  var url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req, {ignoreSearch:true}).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && (res.ok || res.type === 'opaque')){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
        }
        return res;
      }).catch(function(){
        if(hit) return hit;
        if(req.mode === 'navigate') return caches.match('./', {ignoreSearch:true});
        return Response.error();
      });
      return hit || net;
    })
  );
});

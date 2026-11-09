// Service worker mínimo: permite instalar o quadro como app. Não guarda cópia das páginas (sempre busca a versão nova).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><body style='font-family:sans-serif;padding:24px;text-align:center'><h2>Sem internet</h2><p>O quadro precisa de conexão. Tente de novo em instantes.</p></body>", { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Quadro · Vital", { body: d.body || "", tag: d.tag, renotify: true, icon: "icon-192.png", badge: "icon-192.png", data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of cs) { if (c.url.includes("/quadro/")) { await c.focus(); c.postMessage({ abrir: url }); return; } }
    await self.clients.openWindow(url);
  })());
});

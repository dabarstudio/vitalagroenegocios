/* Vital · scripts comuns do site (menu, ano, Radar) */
(function () {
  "use strict";
  try { document.querySelectorAll(".ano").forEach(function (e) { e.textContent = new Date().getFullYear(); }); } catch (_) {}
  var m = document.querySelector(".menu");
  if (m) {
    m.addEventListener("click", function (e) { if (e.target.closest("a")) m.open = false; });
    document.addEventListener("click", function (e) { if (m.open && !m.contains(e.target)) m.open = false; });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && m.open) { m.open = false; m.querySelector("summary").focus(); } });
  }
})();

window.Radar = (function () {
  "use strict";
  var CFG = window.VITAL_CONFIG || {}, URL = (CFG.supabaseUrl || "") + "/functions/v1/radar", p = null;
  var M = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var TAG = { reforma: "Reforma", rural: "Produtor rural", contabil: "Contábil" };
  function dados() {
    return p || (p = fetch(URL).then(function (r) { if (!r.ok) throw new Error("radar " + r.status); return r.json(); })
      .then(function (j) { if (!j || !j.noticias) throw new Error("radar vazio"); return j; }));
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function quando(iso) {
    var d = new Date(iso), h = new Date();
    var dd = Math.round((new Date(h.getFullYear(), h.getMonth(), h.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    return dd <= 0 ? "hoje" : dd === 1 ? "ontem" : dd < 7 ? "há " + dd + " dias" : d.getDate() + " " + M[d.getMonth()];
  }
  function num(v, d) { return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function variacao(v) {
    if (v == null || isNaN(v)) return '<span class="x"></span>';
    var c = v > 0.05 ? "up" : v < -0.05 ? "dn" : "";
    return '<span class="x ' + c + '">' + (v > 0.05 ? "▲ " : v < -0.05 ? "▼ " : "") + num(Math.abs(v), 1) + "%</span>";
  }
  function noticias(lista, comTag) {
    if (!lista || !lista.length) return '<p class="nota">Sem notícias novas neste tema nos últimos dias.</p>';
    return lista.map(function (i) {
      var href = /^https?:\/\//.test(i.l) ? i.l : "#";
      return '<a class="nw" href="' + esc(href) + '" target="_blank" rel="noopener"><span class="nw-m">' + (comTag && i.c ? "<i>" + TAG[i.c] + "</i>" : "") + esc(i.f) + " · " + quando(i.d) + '</span><span class="nw-t">' + esc(i.t) + "</span></a>";
    }).join("");
  }
  function misturar(n, qtd) {
    var vistos = {}, out = [];
    ["reforma", "rural", "contabil"].forEach(function (c) { (n[c] || []).forEach(function (i) { if (!vistos[i.l]) { vistos[i.l] = 1; out.push({ t: i.t, l: i.l, f: i.f, d: i.d, c: c }); } }); });
    out.sort(function (a, b) { return b.d.localeCompare(a.d); });
    // garante variedade: no máximo 2 do mesmo tema nos primeiros itens
    var cont = {}, res = [], resto = [];
    out.forEach(function (i) { cont[i.c] = (cont[i.c] || 0) + 1; (cont[i.c] <= 2 ? res : resto).push(i); });
    return res.concat(resto).slice(0, qtd);
  }
  function cotacoes(lista, so) {
    var l = so ? so.map(function (n) { return (lista || []).filter(function (c) { return c.n === n; })[0]; }).filter(Boolean) : (lista || []);
    if (!l.length) return '<p class="nota">Cotações indisponíveis no momento.</p>';
    return l.map(function (c) {
      return '<div class="cot"><b>' + esc(c.n) + '</b><span class="v">' + esc(c.txt) + "</span><small>" + esc(c.u) + " · " + esc(c.d) + "</small>" + variacao(c["var"]) + "</div>";
    }).join("");
  }
  function dolar(d) {
    if (!d) return "";
    return '<div class="dolar"><b>Dólar comercial</b><span class="v">R$ ' + num(d.v, 4) + "</span><small>PTAX venda · " + d.d.split("-").reverse().join("/") + "</small>" + variacao(d["var"]) + "</div>";
  }
  function atualizado(j) {
    try { var d = new Date(j.atualizado); return "Atualizado " + (quando(j.atualizado) === "hoje" ? "hoje" : quando(j.atualizado)) + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch (_) { return ""; }
  }
  function erro(el) { if (el) el.innerHTML = '<p class="nota">Não foi possível carregar agora. Tente de novo em alguns minutos.</p>'; }
  /* abas de notícias: <div data-abas> com botões [data-aba] e um alvo [data-lista] */
  function abas(raiz, j, inicial) {
    var bts = raiz.querySelectorAll("[data-aba]"), alvo = raiz.querySelector("[data-lista]");
    function mostra(c, foco) {
      bts.forEach(function (b) { var on = b.dataset.aba === c; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && foco) b.focus(); });
      alvo.innerHTML = noticias(j.noticias[c] || []);
    }
    bts.forEach(function (b, k) {
      b.addEventListener("click", function () { mostra(b.dataset.aba); try { history.replaceState(null, "", "#" + b.dataset.aba); } catch (_) {} });
      b.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!d) return;
        var n = bts[(k + d + bts.length) % bts.length]; mostra(n.dataset.aba, true);
      });
    });
    mostra(inicial && j.noticias[inicial] ? inicial : bts[0].dataset.aba);
  }
  return { dados: dados, noticias: noticias, misturar: misturar, cotacoes: cotacoes, dolar: dolar, atualizado: atualizado, erro: erro, abas: abas };
})();

window.Papo = (function () {
  "use strict";
  var CFG = window.VITAL_CONFIG || {}, URL = (CFG.supabaseUrl || "") + "/functions/v1/papo", p = null;
  var M = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var S = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function dados() {
    return p || (p = fetch(URL).then(function (r) { if (!r.ok) throw new Error("papo " + r.status); return r.json(); }).then(function (j) {
      var agora = Date.now();
      var eps = (j.episodios || []).map(function (e) {
        var h = (e.hora || "12:00").split(":"), d = e.data.split("-");
        var ini = Date.UTC(+d[0], +d[1] - 1, +d[2], +h[0] + 3, +h[1]); // horário de Brasília
        return { data: e.data, hora: e.hora || "12:00", tema: e.tema, convidado: e.convidado, link: e.link, resumo: e.resumo, aprendizados: e.aprendizados || [], ini: ini, fim: ini + 3600e3 };
      });
      return { proximos: eps.filter(function (e) { return e.fim > agora; }), anteriores: eps.filter(function (e) { return e.fim <= agora; }).reverse() };
    }));
  }
  function quando(e) { return S[new Date(e.data + "T12:00:00").getDay()] + ", " + +e.data.slice(8) + " de " + M[+e.data.slice(5, 7) - 1] + " · " + e.hora.replace(":00", "h").replace(":", "h"); }
  function titulo(e) { return e.tema ? esc(e.tema) : "Tema a definir"; }
  function com(e) { return e.convidado ? "com " + esc(e.convidado) : "Convidado a confirmar"; }
  function agenda(e) {
    var f = function (t) { return new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent("Papo de Porteira" + (e.tema ? " · " + e.tema : "")) +
      "&dates=" + f(e.ini) + "/" + f(e.fim) + "&details=" + encodeURIComponent("Live da Vital Agro & Negócios no Instagram" + (e.convidado ? ", com " + e.convidado : "") + ". instagram.com/vital_consultoria") +
      "&location=" + encodeURIComponent("Instagram @vital_consultoria");
  }
  function item(e, tipo) {
    var d = e.data.split("-");
    var acoes = tipo === "past"
      ? (e.link ? '<a class="btn green" href="' + esc(e.link) + '" target="_blank" rel="noopener">Assistir</a>' : "")
      : '<a class="btn ghost" href="' + agenda(e) + '" target="_blank" rel="noopener">Pôr na agenda</a>';
    return '<div class="ep ' + tipo + '"><div class="dt"><b>' + +d[2] + "</b><small>" + M[+d[1] - 1] + "</small></div>" +
      '<div class="tx"><h3>' + titulo(e) + (tipo === "next" ? '<span class="badge">próximo</span>' : "") + "</h3>" +
      "<p>" + (tipo === "past" ? com(e) + (e.resumo ? ". " + esc(e.resumo) : "") : quando(e) + " · " + com(e)) + "</p>" +
      (tipo === "past" && e.aprendizados && e.aprendizados.length ? '<details class="apr"><summary>' + e.aprendizados.length + ' aprendizado' + (e.aprendizados.length > 1 ? "s" : "") + ' do episódio</summary><ol>' + e.aprendizados.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></details>" : "") + "</div>" +
      '<div class="ac">' + acoes + "</div></div>";
  }
  function lista(eps, tipo) {
    if (!eps.length) return '<p class="nota">' + (tipo === "past" ? "Os episódios gravados aparecem aqui." : "A próxima temporada será anunciada em breve.") + "</p>";
    return '<div class="eps">' + eps.map(function (e, k) { return item(e, tipo === "up" && k === 0 ? "next" : tipo === "up" ? "up" : "past"); }).join("") + "</div>";
  }
  return { dados: dados, lista: lista, quando: quando, titulo: titulo, com: com, agenda: agenda };
})();

/* gráficos simples em SVG (uma série, uma cor; dica ao passar o mouse) */
window.Graf = (function () {
  "use strict";
  var M = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(v, d) { return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function rotulo(d) { var p = String(d).split("-"); return p.length >= 2 ? M[+p[1] - 1] + "/" + p[0].slice(2) : d; }
  /* linha: pts = [{d:"2026-09-01", v:15}], o = {un:"%", dec:2, alt:220} */
  function linha(pts, o) {
    o = o || {}; if (!pts || pts.length < 2) return '<p class="nota">Dados insuficientes.</p>';
    var W = 640, H = o.alt || 220, L = 44, R = 16, T = 16, B = 28, n = pts.length;
    var vs = pts.map(function (p) { return p.v; }), mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs);
    if (o.zero) mn = Math.min(0, mn); var pad = (mx - mn) * 0.12 || 1; mn = o.zero ? mn : mn - pad; mx = mx + pad;
    var x = function (i) { return L + (W - L - R) * i / (n - 1); }, y = function (v) { return T + (H - T - B) * (1 - (v - mn) / (mx - mn)); };
    var tk = [0, 1, 2, 3].map(function (k) { return mn + (mx - mn) * k / 3; });
    var passo = Math.ceil(n / 6), ult = pts[n - 1];
    var g = '<svg class="gsvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.titulo || "Gráfico") + '">';
    g += tk.map(function (v) { return '<line class="g-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="g-ax" x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + num(v, o.decEixo == null ? 0 : o.decEixo) + '</text>'; }).join("");
    g += '<polyline class="g-line" points="' + pts.map(function (p, i) { return x(i) + "," + y(p.v); }).join(" ") + '"/>';
    g += pts.map(function (p, i) { return (i % passo === 0 && n - 1 - i >= passo / 2) || i === n - 1 ? '<text class="g-ax" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="' + (i === n - 1 ? "end" : "middle") + '">' + rotulo(p.d) + '</text>' : ""; }).join("");
    g += '<circle class="g-pt" cx="' + x(n - 1) + '" cy="' + y(ult.v) + '" r="4.5"/><text class="g-lbl" x="' + (x(n - 1) - 8) + '" y="' + (y(ult.v) - 10) + '" text-anchor="end">' + num(ult.v, o.dec || 0) + (o.un || "") + '</text>';
    g += pts.map(function (p, i) { var w = (W - L - R) / (n - 1); return '<rect class="g-hit" x="' + (x(i) - w / 2) + '" y="' + T + '" width="' + w + '" height="' + (H - T - B) + '"><title>' + rotulo(p.d) + ": " + num(p.v, o.dec || 0) + (o.un || "") + '</title></rect>'; }).join("");
    return g + "</svg>";
  }
  /* barras verticais: itens = [{r:"2024", v:123}], o = {un:"", dec:0, destaque: índice} */
  function barras(itens, o) {
    o = o || {}; if (!itens || !itens.length) return '<p class="nota">Sem dados.</p>';
    var W = 640, H = o.alt || 240, L = 12, R = 12, T = 22, B = 30, n = itens.length;
    var mx = Math.max.apply(null, itens.map(function (i) { return i.v; })) * 1.08;
    var bw = (W - L - R) / n, gap = Math.min(18, bw * 0.28);
    var g = '<svg class="gsvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.titulo || "Gráfico de barras") + '"><line class="g-base" x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/>';
    g += itens.map(function (it, i) {
      var h = (H - T - B) * it.v / mx, x0 = L + i * bw + gap / 2, w = bw - gap, y0 = H - B - h, r = Math.min(4, w / 2);
      var path = "M" + x0 + "," + (H - B) + "V" + (y0 + r) + "Q" + x0 + "," + y0 + " " + (x0 + r) + "," + y0 + "H" + (x0 + w - r) + "Q" + (x0 + w) + "," + y0 + " " + (x0 + w) + "," + (y0 + r) + "V" + (H - B) + "Z";
      var mostra = n <= 8 || i === n - 1 || i === o.destaque || it.v === mx / 1.08;
      return '<path class="g-bar' + (i === o.destaque || (o.destaque == null && i === n - 1) ? " on" : "") + '" d="' + path + '"><title>' + esc(it.r) + ": " + num(it.v, o.dec || 0) + (o.un || "") + '</title></path>' +
        (mostra ? '<text class="g-lbl" x="' + (x0 + w / 2) + '" y="' + (y0 - 6) + '" text-anchor="middle">' + num(it.v, o.dec || 0) + '</text>' : "") +
        ((n <= 12 || i % Math.ceil(n / 12) === 0 || i === n - 1) ? '<text class="g-ax" x="' + (x0 + w / 2) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(it.r) + '</text>' : "");
    }).join("");
    return g + "</svg>";
  }
  /* minigráfico para os cartões de indicador */
  function mini(pts) {
    if (!pts || pts.length < 2) return "";
    var W = 120, H = 34, vs = pts.map(function (p) { return p.v; }), mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs), n = pts.length;
    var y = function (v) { return 3 + (H - 6) * (1 - (v - mn) / ((mx - mn) || 1)); };
    return '<svg class="gmini" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><polyline points="' + pts.map(function (p, i) { return (W * i / (n - 1)) + "," + y(p.v); }).join(" ") + '"/></svg>';
  }
  return { linha: linha, barras: barras, mini: mini, num: num, rotulo: rotulo };
})();

/* acesso direto ao banco público (só o que as regras de acesso permitem a qualquer visitante) */
window.Api = (function () {
  "use strict";
  var CFG = window.VITAL_CONFIG || {}, U = CFG.supabaseUrl || "", K = CFG.supabaseAnonKey || "";
  function h(extra) { var o = { apikey: K, "Content-Type": "application/json" }; for (var k in extra) o[k] = extra[k]; return o; }
  function ler(caminho) { return fetch(U + "/rest/v1/" + caminho, { headers: h() }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function gravar(tabela, dados) { return fetch(U + "/rest/v1/" + tabela, { method: "POST", headers: h({ Prefer: "return=minimal" }), body: JSON.stringify(dados) }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); }); }
  function rpc(fn, args) { return fetch(U + "/rest/v1/rpc/" + fn, { method: "POST", headers: h(), body: JSON.stringify(args || {}) }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return r.status === 204 ? null : r.json(); }); }
  function assinar(bucket, caminhos) {
    if (!caminhos.length) return Promise.resolve({});
    return fetch(U + "/storage/v1/object/sign/" + bucket, { method: "POST", headers: h(), body: JSON.stringify({ expiresIn: 3600, paths: caminhos }) })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (l) { var o = {}; (l || []).forEach(function (x) { if (x.signedURL) o[x.path] = U + "/storage/v1" + x.signedURL; }); return o; });
  }
  return { ler: ler, gravar: gravar, rpc: rpc, assinar: assinar };
})();

/* galeria de mídias aprovadas */
window.Midias = (function () {
  "use strict";
  var CATS = { eventos: "Eventos (RESAR/REMAR)", visitas: "Visitas técnicas", papo: "Papo de Porteira", socios: "Sócios na mídia", bastidores: "Bastidores" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function dataBR(d) { if (!d) return ""; var p = d.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function embed(u) {
    var m = u.match(/instagram\.com\/(p|reel|tv)\/([\w-]+)/); if (m) return "https://www.instagram.com/" + m[1] + "/" + m[2] + "/embed";
    m = u.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{6,})/); if (m) return "https://www.youtube-nocookie.com/embed/" + m[1];
    return null;
  }
  function carregar() {
    return Api.ler("midias?select=id,tipo,categoria,titulo,legenda,data,caminho,url&status=eq.aprovado&order=data.desc.nullslast,criado_em.desc&limit=200")
      .then(function (l) { return Api.assinar("midias", l.filter(function (x) { return x.caminho; }).map(function (x) { return x.caminho; })).then(function (u) { l.forEach(function (x) { x.src = x.caminho ? u[x.caminho] : null; }); return l; }); });
  }
  function card(x, k) {
    var meio;
    if (x.tipo === "foto" && x.src) meio = '<button class="mfoto" type="button" data-k="' + k + '" aria-label="Ampliar: ' + esc(x.titulo) + '"><img src="' + esc(x.src) + '" alt="' + esc(x.titulo) + '" loading="lazy"></button>';
    else if (x.tipo === "video" && x.src) meio = '<video controls preload="metadata" src="' + esc(x.src) + '"></video>';
    else if (x.url && embed(x.url)) meio = '<iframe src="' + esc(embed(x.url)) + '" loading="lazy" title="' + esc(x.titulo) + '" allowfullscreen></iframe>';
    else meio = '<a class="mlink" href="' + esc(x.url || "#") + '" target="_blank" rel="noopener">Abrir</a>';
    return '<figure class="mcard' + (x.tipo === "link" ? " emb" : "") + '">' + meio + '<figcaption><span class="mcat">' + esc(CATS[x.categoria] || "") + (x.data ? " · " + dataBR(x.data) : "") + '</span><b>' + esc(x.titulo) + "</b>" + (x.legenda ? "<span>" + esc(x.legenda) + "</span>" : "") + "</figcaption></figure>";
  }
  return { carregar: carregar, card: card, CATS: CATS };
})();

/* Usuário logado: troca "Entrar" pelo nome, com menu (Minha área · Projetos · Sair) */
(function () {
  "use strict";
  var u = null, tem = false;
  try {
    u = JSON.parse(localStorage.getItem("vital_user") || "null");
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^sb-.+-auth-token$/.test(k)) { var t = JSON.parse(localStorage.getItem(k) || "null"); if (t && (t.refresh_token || (t.currentSession && t.currentSession.refresh_token))) tem = true; } }
  } catch (_) { return; }
  if (!u || !tem) return;
  var esc = function (s) { return String(s || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var nome = (u.n || "Minha conta").trim().split(/\s+/)[0];
  var equipe = u.p === "admin" || u.p === "equipe";
  var links = '<a href="/vitalagroenegocios/cliente/">Minha área</a>' + (equipe ? '<a href="/vitalagroenegocios/projetos/">Projetos</a><a href="/vitalagroenegocios/projetos/#minhas">Minhas tarefas</a>' : "") + '<button type="button" class="sair">Sair</button>';
  var a = document.querySelector(".links > .btn.entrar");
  if (a) {
    var d = document.createElement("details"); d.className = "userm";
    d.innerHTML = '<summary class="btn entrar" title="Você está conectado">' + a.innerHTML.replace(/Entrar\s*$/, "") + esc(nome) + ' <span aria-hidden="true">▾</span></summary><div class="drop">' + links + "</div>";
    a.replaceWith(d);
    document.addEventListener("click", function (e) { if (d.open && !d.contains(e.target)) d.open = false; });
  }
  var m = document.querySelector(".menu .drop .drop-entrar");
  if (m) { m.textContent = "Minha área · " + nome; if (equipe) m.insertAdjacentHTML("afterend", '<a href="/vitalagroenegocios/projetos/">Projetos</a>'); }
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".sair")) return;
    try { Object.keys(localStorage).forEach(function (k) { if (/^sb-.+-auth-token$/.test(k) || k === "vital_user") localStorage.removeItem(k); }); } catch (_) {}
    location.reload();
  });
})();

/* usabilidade: barra de contato no celular e âncoras estáveis */
(function () {
  "use strict";
  var bar = document.getElementById("ctabar");
  if (bar && "IntersectionObserver" in window) {
    document.body.classList.add("temcta");
    var hero = document.querySelector(".hero,.phero"), alvo = [document.getElementById("simulacao"), document.getElementById("contato")].filter(Boolean);
    var passou = !hero, perto = false;
    function upd() { bar.classList.toggle("on", passou && !perto); }
    if (hero) new IntersectionObserver(function (e) { passou = !e[0].isIntersecting; upd(); }).observe(hero);
    if (alvo.length) { var vis = {}; var io = new IntersectionObserver(function (es) { es.forEach(function (x) { vis[x.target.id] = x.isIntersecting; }); perto = Object.keys(vis).some(function (k) { return vis[k]; }); upd(); }); alvo.forEach(function (a) { io.observe(a); }); }
    upd();
  }
  /* quando a página abre num #link, mantém o destino no lugar enquanto o conteúdo termina de carregar */
  var h = location.hash && location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (h && "ResizeObserver" in window) {
    var ativo = true, para = function () { ativo = false; };
    ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (ev) { window.addEventListener(ev, para, { once: true, passive: true }); });
    var ro = new ResizeObserver(function () { if (ativo) h.scrollIntoView({ block: "start" }); });
    ro.observe(document.body);
    setTimeout(function () { ativo = false; ro.disconnect(); }, 5000);
  }
})();

/* Papo de Porteira em evidência: faixa no topo de todas as páginas e destaque na página inicial.
   O episódio diário sai às 05:55 no YouTube e no Spotify (o player mostra sempre o mais recente); as lives com convidado vêm da agenda "Lives". */
(function () {
  "use strict";
  if (!document.querySelector("header.top")) return;
  var path = location.pathname.replace(/\/+$/, "/");
  if (/\/papo-de-porteira\/$/.test(path)) return;
  var YT = "https://www.youtube.com/@vitalconsultoria116/videos", SP = "https://open.spotify.com/show/60zUO3JtyC6l69njrLQPwA", IG = "https://www.instagram.com/vital_consultoria/";
  var LISTA = "UUhqbLLQXrY01vRDKrtpYVfA", BASE = "/vitalagroenegocios/papo-de-porteira/", DIA = 864e5;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var st = document.createElement("style");
  st.textContent = ".ppbar{background:#E5F1E0;color:#132018;font-size:.9rem;border-bottom:1px solid #D8E2D9}" +
    ".ppbar .wrap{display:flex;align-items:center;gap:6px 12px;flex-wrap:wrap;padding-top:7px;padding-bottom:7px}" +
    ".ppbar b{font-weight:700}.ppbar .tag{background:#00582F;color:#fff;border-radius:999px;padding:2px 10px;font-weight:700;font-size:.78rem;letter-spacing:.02em;text-transform:uppercase}" +
    ".ppbar a.go{color:#00582F;font-weight:700;text-decoration:underline;text-underline-offset:3px}" +
    ".ppbar .x{margin-left:auto;background:none;border:0;color:#00582F;font-size:1.1rem;cursor:pointer;padding:2px 6px;opacity:.8}.ppbar .x:hover{opacity:1}" +
    ".ppdest{padding:28px 0 0}.ppdest .card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:22px;align-items:center;background:#fff;border:1px solid #D8E2D9;border-left:6px solid #00582F;border-radius:16px;padding:20px 22px;box-shadow:0 6px 24px rgba(0,88,47,.08)}" +
    ".ppdest h2{font-size:clamp(1.2rem,2.4vw,1.6rem);margin:6px 0 6px;font-weight:700}.ppdest p{margin:0;color:#56685C}" +
    ".ppdest .ac{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.ppdest .prox{margin-top:12px;font-size:.92rem}" +
    ".ppdest .vid{position:relative;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#000}.ppdest .vid iframe{position:absolute;inset:0;width:100%;height:100%;border:0}" +
    "@media (max-width:760px){.ppdest .card{grid-template-columns:minmax(0,1fr)}}";
  document.head.appendChild(st);
  var hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  var saiu = new Date(Date.now() - 3 * 3600e3).toISOString().slice(11, 16) >= "05:55";
  var chave = "papo-faixa-" + hoje, fechado = false;
  try { fechado = localStorage.getItem("papo-faixa") === chave; } catch (_) {}
  if (!fechado) {
    var bar = document.createElement("div"); bar.className = "ppbar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "Papo de Porteira");
    bar.innerHTML = '<div class="wrap"><span class="tag">' + (saiu ? "Novo episódio" : "Episódio diário") + '</span><span>🎙️ <b>Papo de Porteira</b> ' + (saiu ? "de hoje já está no ar" : "novo todo dia às 05:55") + '</span><a class="go" href="' + YT + '" target="_blank" rel="noopener">▶ YouTube</a><a class="go" href="' + SP + '" target="_blank" rel="noopener">🎧 Spotify</a><a class="go" href="' + IG + '" target="_blank" rel="noopener">📸 Instagram</a><button class="x" type="button" aria-label="Fechar aviso">✕</button></div>';
    document.querySelector("header.top").insertAdjacentElement("afterend", bar);
    bar.querySelector(".x").onclick = function () { bar.remove(); try { localStorage.setItem("papo-faixa", chave); } catch (_) {} };
  }
  var hero = /\/vitalagroenegocios\/$/.test(path) && document.querySelector("main .hero");
  if (!hero) return;
  var s = document.createElement("section"); s.className = "ppdest"; s.setAttribute("aria-label", "Papo de Porteira");
  s.innerHTML = '<div class="wrap"><div class="card"><div><span class="eyebrow">Papo de Porteira · novo episódio todo dia às 05:55</span>' +
    "<h2>O podcast da Vital para quem produz e empreende.</h2><p>Impostos, gestão, crédito e o dia a dia da propriedade e da empresa, numa conversa direta com os sócios da Vital.</p>" +
    '<p class="prox" id="ppProx" hidden></p>' +
    '<div class="ac"><a class="btn green" href="' + YT + '" target="_blank" rel="noopener">▶ YouTube</a><a class="btn ghost" href="' + SP + '" target="_blank" rel="noopener">🎧 Spotify</a><a class="btn ghost" href="' + IG + '" target="_blank" rel="noopener">📸 Instagram</a><a class="btn ghost" href="' + BASE + '">Ver tudo</a></div></div>' +
    '<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/videoseries?list=' + LISTA + '" title="Episódio mais recente do Papo de Porteira" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div></div></div>';
  hero.insertAdjacentElement("afterend", s);
  if (window.Papo) window.Papo.dados().then(function (d) {
    var prox = (d.proximos || [])[0]; if (!prox || prox.ini - Date.now() > 14 * DIA) return;
    var el = document.getElementById("ppProx"); if (!el) return;
    var vivo = prox.ini <= Date.now();
    el.innerHTML = (vivo ? "🔴 <b>Ao vivo agora</b>: " : "Próxima live com convidado: ") + "<b>" + esc(prox.tema || "tema a definir") + "</b>" + (prox.convidado ? ", com " + esc(prox.convidado) : "") + (vivo ? "" : " · " + esc(window.Papo.quando(prox)) + ' · <a href="' + window.Papo.agenda(prox) + '" target="_blank" rel="noopener">pôr na agenda</a>');
    el.hidden = false;
  }).catch(function () {});
})();

/* Presença no Google: endereço oficial, prévia para WhatsApp/redes e ficha da empresa para o Google.
   Na troca de domínio, mudar só SITE abaixo (e o sitemap.xml). */
(function () {
  "use strict";
  var SITE = "https://dabarstudio.github.io/vitalagroenegocios/";
  var BASE = "/vitalagroenegocios/";
  var rel = location.pathname.indexOf(BASE) === 0 ? location.pathname.slice(BASE.length) : location.pathname.replace(/^\//, "");
  var url = SITE + rel.replace(/index\.html$/, "");
  var head = document.head;
  function meta(attr, k, v) { if (!v || head.querySelector("meta[" + attr + '="' + k + '"]')) return; var m = document.createElement("meta"); m.setAttribute(attr, k); m.content = v; head.appendChild(m); }
  if (!head.querySelector('link[rel="canonical"]')) { var l = document.createElement("link"); l.rel = "canonical"; l.href = url; head.appendChild(l); }
  var d = head.querySelector('meta[name="description"]'), desc = d ? d.content : "";
  var tit = document.title.replace(/\s*·\s*Vital Agro & Negócios$/, "");
  meta("property", "og:type", rel ? "website" : "website");
  meta("property", "og:site_name", "Vital Agro & Negócios");
  meta("property", "og:locale", "pt_BR");
  meta("property", "og:title", tit);
  meta("property", "og:description", desc);
  meta("property", "og:url", url);
  meta("property", "og:image", SITE + "logo.png");
  meta("name", "twitter:card", "summary");
  var YT = "https://www.youtube.com/@vitalconsultoria116", SP = "https://open.spotify.com/show/60zUO3JtyC6l69njrLQPwA", IG = "https://www.instagram.com/vital_consultoria/";
  var org = {
    "@type": ["AccountingService", "ProfessionalService"], "@id": SITE + "#empresa",
    name: "Vital Agro & Negócios", legalName: "Vital Agro e Negócios LTDA", taxID: "54.146.859/0001-32",
    url: SITE, logo: SITE + "logo.png", image: SITE + "logo.png",
    description: "Contabilidade, BPO financeiro, regularização fiscal e planejamento tributário para produtores rurais e empresas.",
    telephone: "+55 62 99174-4354",
    address: { "@type": "PostalAddress", addressLocality: "Alexânia", addressRegion: "GO", addressCountry: "BR" },
    areaServed: [{ "@type": "State", name: "Goiás" }, { "@type": "Country", name: "Brasil" }],
    knowsAbout: ["Contabilidade rural", "Produtor rural", "Livro Caixa Digital do Produtor Rural", "Reforma Tributária IBS e CBS", "BPO financeiro", "Planejamento tributário", "Holding rural"],
    sameAs: [IG, YT, SP]
  };
  var g = [];
  if (!rel) g.push(org, { "@type": "WebSite", "@id": SITE + "#site", url: SITE, name: "Vital Agro & Negócios", inLanguage: "pt-BR", publisher: { "@id": SITE + "#empresa" } });
  else {
    g.push({ "@type": "WebPage", url: url, name: tit, description: desc, inLanguage: "pt-BR", isPartOf: { "@id": SITE + "#site" }, publisher: { "@id": SITE + "#empresa" } });
    var partes = rel.replace(/\/$/, "").split("/"), itens = [{ "@type": "ListItem", position: 1, name: "Início", item: SITE }];
    var nomes = { servicos: "Serviços", "papo-de-porteira": "Papo de Porteira", noticias: "Notícias" };
    partes.forEach(function (p, i) { itens.push({ "@type": "ListItem", position: i + 2, name: i === partes.length - 1 ? tit : (nomes[p] || p), item: SITE + partes.slice(0, i + 1).join("/") + "/" }); });
    g.push({ "@type": "BreadcrumbList", itemListElement: itens });
  }
  if (/^papo-de-porteira\/?$/.test(rel)) g.push({ "@type": "PodcastSeries", name: "Papo de Porteira", url: url, description: "Podcast diário da Vital Agro & Negócios para o produtor rural e o empresário: impostos, gestão, crédito e o dia a dia da propriedade e da empresa.", inLanguage: "pt-BR", sameAs: [YT, SP, IG], publisher: { "@id": SITE + "#empresa" } });
  var s = document.createElement("script"); s.type = "application/ld+json";
  s.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": g });
  head.appendChild(s);
})();

/* Vital · CPG & CRC engine — roda no navegador (e no Node para testes). Precisa de JSZip, XLSX (SheetJS) e jsPDF. */
const VCPG = (() => {
  const CFG = {
    cpg: { aba: "DBCPG", tabela: "Tabela14", titulo: "Contas a pagar", vencApos: "2025-10-01", anoAberto: 2025, ordem: "valor",
           filtrosTopo: [["Considerar", "s"], ["Balanço", "s"], ["Pessoa", "(Vários itens)"]] },
    crc: { aba: "DBCRC", tabela: "Tabela1", titulo: "Contas a Receber", vencApos: "2024-01-01", anoAberto: 2026, ordem: "nome",
           filtrosTopo: [["considerar", "s"], ["Balanço", "s"]] },
    nDados: 25, limite: 1000, seguro: 900,
  };
  const COL = { num: 0, nome: 1, data: 5, venc: 21, pag: 22, total2: 23, pago: 24 };

  // ---------------------------------------------------------------- utilidades
  const colNum = (c) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const colName = (n) => { let s = ""; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; } return s; };
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const unesc = (t) => t.replace(/_x0009_/g, "\t").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&");
  const serialISO = (iso) => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 864e5);
  const isoSerial = (n) => new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5).toISOString().slice(0, 10);
  const fimDoMes = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10); // mes 1..12
  const brl = (v) => Math.abs(v) < 0.005 ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const brData = (iso) => iso.split("-").reverse().join("/");

  // ---------------------------------------------------------------- planilha
  async function abrir(zip) {
    const wb = await zip.file("xl/workbook.xml").async("string");
    const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
    const relMap = {};
    for (const m of rels.matchAll(/<Relationship\b([^>]*)\/>/g)) {
      const id = m[1].match(/Id="([^"]+)"/)?.[1], t = m[1].match(/Target="([^"]+)"/)?.[1];
      if (id && t) relMap[id] = t.replace(/^\/?xl\//, "");
    }
    const abas = {};
    for (const m of wb.matchAll(/<sheet\b([^>]*)\/>/g)) abas[unesc(m[1].match(/name="([^"]+)"/)[1])] = "xl/" + relMap[m[1].match(/r:id="([^"]+)"/)[1]];
    let sst = [];
    const sf = zip.file("xl/sharedStrings.xml");
    if (sf) sst = [...(await sf.async("string")).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")));
    return { zip, abas, sst };
  }
  async function tabelaDaAba(ctx, caminho, nome) {
    const relp = caminho.replace(/worksheets\/(sheet\d+\.xml)$/, "worksheets/_rels/$1.rels");
    const f = ctx.zip.file(relp); if (!f) return null;
    for (const m of (await f.async("string")).matchAll(/Target="\.\.\/tables\/(table\d+\.xml)"/g)) {
      const p = "xl/tables/" + m[1], x = await ctx.zip.file(p).async("string");
      if ((x.match(/\bname="([^"]+)"/) || [])[1] === nome) return { caminho: p, xml: x };
    }
    return null;
  }
  function valor(attrs, inner, sst) {
    const t = (attrs.match(/\bt="([^"]+)"/) || [])[1];
    if (t === "inlineStr") return unesc([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
    const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
    if (v === undefined) return null;
    if (t === "s") return sst[+v] ?? "";
    if (t === "str" || t === "e") return unesc(v);
    if (t === "b") return v === "1";
    return +v;
  }
  const linhasXml = (xml) => [...xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)].map((m) => ({ r: +(m[1].match(/\br="(\d+)"/) || [])[1], attrs: m[1], corpo: m[2] || "" }));
  function celulas(corpo, sst) {
    const out = {};
    for (const m of corpo.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = (m[1].match(/\br="([A-Z]+)\d+"/) || [])[1]; if (!ref) continue;
      out[ref] = { attrs: m[1], inner: m[2] || "", v: valor(m[1], m[2] || "", sst), s: (m[1].match(/\bs="(\d+)"/) || [])[1] || null, f: ((m[2] || "").match(/<f>([\s\S]*?)<\/f>/) || [])[1] || null };
    }
    return out;
  }
  /* Lê a base (linhas 3+) da aba: [[25 valores]] e o cabeçalho. */
  async function lerBase(ctx, tipo) {
    const cfg = CFG[tipo], cam = ctx.abas[cfg.aba]; if (!cam) throw new Error(`A planilha não tem a aba ${cfg.aba}.`);
    const xml = await ctx.zip.file(cam).async("string");
    const rows = linhasXml(xml);
    const cab = celulas((rows.find((r) => r.r === 2) || { corpo: "" }).corpo, ctx.sst);
    const head = Object.keys(cab).sort((a, b) => colNum(a) - colNum(b)).map((k) => String(cab[k].v ?? ""));
    const dados = rows.filter((r) => r.r >= 3).map((r) => { const c = celulas(r.corpo, ctx.sst); return Array.from({ length: CFG.nDados }, (_, i) => c[colName(i + 1)] ? c[colName(i + 1)].v : null); })
      .filter((r) => r.some((x) => x !== null && x !== ""));
    return { head, dados };
  }

  // ---------------------------------------------------------------- exportações do Connectere
  function lerExportacao(XLSX, buf) {
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
    const head = (aoa[0] || []).map((x) => String(x ?? "").trim());
    if (head[1] !== "Razão Social" || head[21] !== "Vencimento") throw new Error("A exportação do Connectere veio num formato inesperado (colunas diferentes).");
    const rows = aoa.slice(1).map((r) => Array.from({ length: CFG.nDados }, (_, i) => (r[i] === undefined ? null : r[i]))).filter((r) => r.some((x) => x !== null && x !== ""));
    return { head, rows };
  }
  const notas = (rows) => rows.reduce((m, r) => (typeof r[0] === "number" && r[0] > m ? r[0] : m), 0);

  // ---------------------------------------------------------------- substituir a base
  function celula(ref, s, v) {
    const sa = s ? ` s="${s}"` : "";
    if (v === null || v === undefined || v === "") return s ? `<c r="${ref}"${sa}/>` : "";
    if (typeof v === "number") return `<c r="${ref}"${sa}><v>${v}</v></c>`;
    if (typeof v === "boolean") return `<c r="${ref}"${sa} t="b"><v>${v ? 1 : 0}</v></c>`;
    const t = esc(v), sp = t !== t.trim() || t.includes("\t") ? ' xml:space="preserve"' : "";
    return `<c r="${ref}"${sa} t="inlineStr"><is><t${sp}>${t}</t></is></c>`;
  }
  /* rows: [{v:[25], lote}] ; dataBal: serial do balanço */
  async function substituir(ctx, tipo, rows, dataBal) {
    const cfg = CFG[tipo], cam = ctx.abas[cfg.aba];
    let xml = await ctx.zip.file(cam).async("string");
    const tab = await tabelaDaAba(ctx, cam, cfg.tabela);
    if (!tab) throw new Error(`A aba ${cfg.aba} não tem a tabela ${cfg.tabela}.`);
    const ref = tab.xml.match(/\bref="A2:([A-Z]+)\d+"/); if (!ref) throw new Error(`Não li o tamanho da tabela ${cfg.tabela}.`);
    const ultCol = ref[1], nCols = colNum(ultCol);
    const lin = linhasXml(xml);
    const cab = celulas((lin.find((r) => r.r === 2) || { corpo: "" }).corpo, ctx.sst);
    const head = {}; for (const k in cab) head[k] = String(cab[k].v ?? "").trim().toLowerCase();
    const modelo = celulas((lin.find((r) => r.r === 3) || { corpo: "" }).corpo, ctx.sst);
    const PAD = { B: null, G: null, F: "5", V: "1", W: tipo === "cpg" ? "1" : "5", I: tipo === "cpg" ? "15" : "3" };
    const sty = (c) => (c in PAD ? (modelo[c] && modelo[c].s) || PAD[c] : (modelo[c] && modelo[c].s) || "3");
    const extras = []; for (let i = CFG.nDados + 1; i <= nCols; i++) extras.push(colName(i));
    const corpo = rows.map((o, n) => {
      const r = n + 3, v = o.v;
      let cs = "";
      for (let i = 0; i < CFG.nDados; i++) cs += celula(colName(i + 1) + r, sty(colName(i + 1)), v[i]);
      const t2 = +v[COL.total2] || 0, vp = +v[COL.pago] || 0, pg = v[COL.pag];
      const saldo = typeof pg === "number" && pg > dataBal ? t2 : t2 - vp;
      const bal = typeof v[COL.data] === "number" && v[COL.data] <= dataBal ? "s" : "n";
      for (const c of extras) {
        const m = modelo[c], h = head[c] || "", s = m && m.s ? ` s="${m.s}"` : "";
        if (m && m.f) {
          const f = m.f;
          let cache = "";
          if (h === "saldo a pagar") cache = `<v>${Math.round(saldo * 1e6) / 1e6}</v>`;
          else if (h === "considerar") cache = `<v>${saldo <= 0 ? "n" : "s"}</v>`;
          else if (h === "balanço") cache = `<v>${bal}</v>`;
          else if (h === "pessoa") cache = `<v>${esc(v[COL.nome] ?? "")}</v>`;
          const t = h === "saldo a pagar" ? "" : ' t="str"';
          cs += `<c r="${c}${r}"${s}${cache ? t : ""}><f>${f}</f>${cache}</c>`;
        } else if (h === "lote") cs += `<c r="${c}${r}"${s}><v>${o.lote}</v></c>`;
      }
      return `<row r="${r}" spans="1:${nCols}">${cs}</row>`;
    }).join("");
    const a = xml.search(/<row\b[^>]*\br="3"/), b = xml.indexOf("</sheetData>");
    xml = (a >= 0 ? xml.slice(0, a) : xml.slice(0, b)) + corpo + xml.slice(b);
    const ult = rows.length + 2;
    xml = xml.replace(/(<c r="AC1"[^>]*>(?:<f>[^<]*<\/f>)?<v>)[^<]*(<\/v>)/, `$1${dataBal}$2`)
      .replace(/<dimension ref="[^"]+"\/>/, `<dimension ref="A1:${ultCol}${ult}"/>`)
      .replace(/<pane [^>]*\/>/, '<pane xSplit="1" ySplit="2" topLeftCell="B3" activePane="bottomRight" state="frozen"/>')
      .replace(/<selection pane="bottomRight"[^>]*\/>/, '<selection pane="bottomRight" activeCell="B3" sqref="B3"/>');
    ctx.zip.file(cam, xml);
    let tx = tab.xml.replace(/ref="A2:[A-Z]+\d+"/g, `ref="A2:${ultCol}${ult}"`)
      .replace(/(<autoFilter [^>]*?)>[\s\S]*?<\/autoFilter>/, "$1/>").replace(/<sortState\b[\s\S]*?<\/sortState>/g, "").replace(/<sortState\b[^>]*\/>/g, "");
    ctx.zip.file(tab.caminho, tx);
    // célula da data do balanço na aba do relatório (AC1 = 'ABA'!D2)
    const f = (xml.match(/<c r="AC1"[^>]*><f>([^<]*)<\/f>/) || [])[1];
    const m = f && unesc(f).match(/^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+)$/);
    if (m && ctx.abas[m[1]]) {
      const camR = ctx.abas[m[1]], ref2 = m[2] + m[3];
      let x = await ctx.zip.file(camR).async("string");
      const re = new RegExp(`(<c r="${ref2}"[^>]*?)(?:/>|>([\\s\\S]*?)</c>)`);
      const mm = x.match(re);
      if (mm) { const at = mm[1].replace(/\st="[^"]*"/, ""); x = x.replace(re, `${at}><v>${dataBal}</v></c>`); ctx.zip.file(camR, x); }
    }
    return { linhas: rows.length };
  }
  async function finalizar(ctx) {
    for (const p of Object.keys(ctx.zip.files).filter((p) => /^xl\/pivotCache\/pivotCacheDefinition\d+\.xml$/.test(p))) {
      let x = await ctx.zip.file(p).async("string");
      if (!/refreshOnLoad=/.test(x)) x = x.replace("<pivotCacheDefinition ", '<pivotCacheDefinition refreshOnLoad="1" ');
      ctx.zip.file(p, x);
    }
    let wb = await ctx.zip.file("xl/workbook.xml").async("string");
    wb = /<calcPr\b[^>]*fullCalcOnLoad/.test(wb) ? wb : wb.replace(/<calcPr\b/, '<calcPr fullCalcOnLoad="1"');
    ctx.zip.file("xl/workbook.xml", wb);
    if (ctx.zip.file("xl/calcChain.xml")) {
      ctx.zip.remove("xl/calcChain.xml");
      const r = await ctx.zip.file("xl/_rels/workbook.xml.rels").async("string");
      ctx.zip.file("xl/_rels/workbook.xml.rels", r.replace(/<Relationship\b[^>]*calcChain[^>]*\/>/g, ""));
      const ct = await ctx.zip.file("[Content_Types].xml").async("string");
      ctx.zip.file("[Content_Types].xml", ct.replace(/<Override PartName="\/xl\/calcChain.xml"[^>]*\/>/g, ""));
    }
  }

  // ---------------------------------------------------------------- relatório (tabela dinâmica)
  const limpo = (s) => String(s ?? "");
  /* filtros: [{relatorio, acao, pessoa, data_balanco|null}] */
  function filtrosDoDia(filtros, tipo, dataISO) {
    // exclusão vale do balanço informado em diante (só volta com nova ordem); "mostrar somente" vale só para o balanço informado
    const f = filtros.filter((x) => x.relatorio === tipo && (!x.data_balanco || (x.acao === "excluir" ? x.data_balanco <= dataISO : x.data_balanco === dataISO)));
    return { excluir: new Set(f.filter((x) => x.acao === "excluir").map((x) => x.pessoa)), incluir: f.filter((x) => x.acao === "incluir").map((x) => x.pessoa), regras: f };
  }
  function relatorio(dados, tipo, dataISO, filtros) {
    const cfg = CFG[tipo], D = serialISO(dataISO), vmin = serialISO(cfg.vencApos);
    const { excluir, incluir, regras } = filtrosDoDia(filtros, tipo, dataISO), inc = incluir.length ? new Set(incluir) : null;
    const itens = [], exVal = new Map();
    for (const v of dados) {
      const t2 = +v[COL.total2] || 0, vp = +v[COL.pago] || 0, pg = v[COL.pag];
      const saldo = typeof pg === "number" && pg > D ? t2 : t2 - vp;
      if (!(saldo > 0) || !(typeof v[COL.data] === "number" && v[COL.data] <= D)) continue;
      if (!(typeof v[COL.venc] === "number" && v[COL.venc] > vmin)) continue;
      const nome = limpo(v[COL.nome]);
      if (excluir.has(nome)) { exVal.set(nome, (exVal.get(nome) || 0) + saldo); continue; }
      if (inc && !inc.has(nome)) continue;
      const vi = isoSerial(v[COL.venc]);
      itens.push({ nome, saldo, ano: +vi.slice(0, 4), mes: +vi.slice(5, 7) });
    }
    const anos = [...new Set(itens.map((x) => x.ano))].sort((a, b) => a - b);
    const cols = [];
    for (const a of anos) {
      if (a === cfg.anoAberto) { for (const m of [...new Set(itens.filter((x) => x.ano === a).map((x) => x.mes))].sort((x, y) => x - y)) cols.push({ k: "m", a, m }); cols.push({ k: "t", a }); }
      else cols.push({ k: "a", a });
    }
    const soma = (lst, c) => lst.filter((x) => x.ano === c.a && (c.k !== "m" || x.mes === c.m)).reduce((s, x) => s + x.saldo, 0);
    const porNome = new Map(); for (const x of itens) { if (!porNome.has(x.nome)) porNome.set(x.nome, []); porNome.get(x.nome).push(x); }
    let linhas = [...porNome.entries()].map(([nome, l]) => ({ nome, vals: cols.map((c) => soma(l, c)), total: l.reduce((s, x) => s + x.saldo, 0) }));
    linhas = cfg.ordem === "valor" ? linhas.sort((a, b) => b.total - a.total) : linhas.sort((a, b) => a.nome.trim().toLowerCase().localeCompare(b.nome.trim().toLowerCase(), "pt-BR"));
    return { tipo, dataISO, cols, linhas, totais: cols.map((c) => soma(itens, c)), total: itens.reduce((s, x) => s + x.saldo, 0), excluidos: [...excluir], incluidos: incluir,
      notas: regras.map((r) => ({ acao: r.acao, pessoa: String(r.pessoa).trim(), desde: r.data_balanco || null, pedido: r.solicitado_por || "", valor: r.acao === "excluir" ? exVal.get(r.pessoa) || 0 : null })) };
  }
  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const SIGLA = { cpg: "CPG", crc: "CRC" };
  /* marca (opcional): { empresa, logo:{data,w,h}, vital:{data,w,h}, rodape } — cabeçalho com a logo do cliente e rodapé da Vital */
  function pdf(jsPDF, rel, marca) {
    const cfg = CFG[rel.tipo], M = marca || {};
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const titulo = `${SIGLA[rel.tipo] || cfg.titulo} ${brData(rel.dataISO)}${M.empresa ? " · " + M.empresa : ""}`;
    doc.setProperties({ title: titulo, author: "Vital Agro & Negócios" });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const L = 32, R = W - 32, FS = 6.6, RH = 9.2, ncol = rel.cols.length + 1, colw = Math.min(66, (R - L - 230) / ncol);
    const xcol = Array.from({ length: ncol }, (_, i) => R - colw * (ncol - i));
    const azul = [47, 85, 151], linha = [180, 198, 231], verde = [29, 92, 47], cinza = [90, 104, 94], tinta = [31, 42, 34];
    const TOPO = 78, BASE = H - 44;
    const txt = (s, x, y, dir) => doc.text(String(s), x, y, dir ? { align: "right" } : undefined);
    const img = (o, x, y, h) => { if (!o || !o.data) return 0; const w = h * o.w / o.h; doc.addImage(o.data, o.fmt || "PNG", x, y, w, h); return w; };
    const topo = () => {
      const lw = img(M.logo, L, 18, 46);
      const x = L + (lw ? lw + 14 : 0);
      doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(...azul);
      doc.text(`${SIGLA[rel.tipo] || cfg.titulo} ${brData(rel.dataISO)}`, x, 38);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...tinta);
      doc.text(`${M.empresa ? M.empresa + " · " : ""}${cfg.titulo} · saldo por pessoa e vencimento · balanço de ${brData(rel.dataISO)}`, x, 54);
      doc.setDrawColor(...verde); doc.setLineWidth(1.2); doc.line(L, 70, R, 70);
    };
    const header = (y) => {
      doc.setFontSize(FS); doc.setFillColor(...azul); doc.rect(L, y - 7, R - L, 3 * RH, "F");
      doc.setTextColor(255); doc.setFont("helvetica", "bold"); txt(rel.tipo === "crc" ? "Soma de SALDO A RECEBER" : "Soma de SALDO A PAGAR", L + 2, y); txt("VENCIMENTO", xcol[0] + 2, y);
      doc.setFont("helvetica", "normal");
      let prev = null;
      rel.cols.forEach((c, i) => {
        const xr = xcol[i] + colw - 2;
        if (c.k === "m") { if (prev !== c.a) txt(c.a, xr, y + RH, true); txt(MES[c.m - 1], xr, y + 2 * RH, true); }
        else if (c.k === "t") txt(`${c.a} Total`, xr, y + RH, true);
        else txt(c.a, xr, y + RH, true);
        prev = c.a;
      });
      txt("Total Geral", R - 2, y + RH, true); txt("Pessoa", L + 2, y + 2 * RH);
      doc.setTextColor(0);
      return y + 3 * RH;
    };
    const row = (y, nome, vals, neg) => {
      doc.setFontSize(FS); doc.setFont("helvetica", neg ? "bold" : "normal");
      txt(nome.trim().slice(0, 62), L + 2, y);
      vals.forEach((q, i) => txt(brl(q), xcol[i] + colw - 2, y, true));
      doc.setDrawColor(...linha); doc.setLineWidth(0.4); doc.line(L, y + 2.5, R, y + 2.5);
    };
    const pagina = () => { topo(); return header(TOPO + 14); };
    let y = pagina();
    for (const l of rel.linhas) { if (y > BASE - 6) { doc.addPage(); y = pagina(); } row(y, l.nome, [...l.vals, l.total]); y += RH; }
    if (y > BASE - 6) { doc.addPage(); y = pagina(); }
    row(y, "Total Geral", [...rel.totais, rel.total], true);
    y += RH * 2.5;
    const ex = (rel.notas || []).filter((x) => x.acao === "excluir").sort((a, b) => b.valor - a.valor || a.pessoa.localeCompare(b.pessoa, "pt-BR"));
    const so = (rel.notas || []).filter((x) => x.acao === "incluir");
    if (M.notas !== false && (ex.length || so.length)) {
      const quebra = (h) => { if (y + h > BASE - 6) { doc.addPage(); topo(); y = TOPO + 14; } };
      const par = (s, tam, cor, neg) => { doc.setFont("helvetica", neg ? "bold" : "normal"); doc.setFontSize(tam); doc.setTextColor(...cor); const ls = doc.splitTextToSize(s, R - L); quebra(ls.length * tam * 1.3); doc.text(ls, L, y); y += ls.length * tam * 1.3; };
      quebra(60); par("Notas explicativas", 11, verde, true); y += 2;
      let k = 0;
      if (ex.length) {
        const tot = ex.reduce((s, x) => s + x.valor, 0);
        par(`${++k}. Exclusões aplicadas. As pessoas abaixo foram retiradas deste relatório por orientação da contabilidade e não entram no Total Geral. Somam R$ ${brl(tot)} em saldo ${rel.tipo === "crc" ? "a receber" : "a pagar"} no balanço de ${brData(rel.dataISO)}. A exclusão vale até nova orientação.`, 8, tinta);
        y += 4;
        const cx = [L, L + 300, L + 420, L + 560], cab = ["Pessoa", "Saldo não considerado", "Vale desde", "Pedido por"];
        const linhaN = (v, neg, fundo) => { quebra(RH + 2); if (fundo) { doc.setFillColor(...fundo); doc.rect(L, y - 7, R - L, RH + 1, "F"); }
          doc.setFont("helvetica", neg ? "bold" : "normal"); doc.setFontSize(7.4); doc.setTextColor(...(fundo === azul ? [255, 255, 255] : tinta));
          v.forEach((s, i) => i === 1 ? doc.text(String(s), cx[2] - 16, y, { align: "right" }) : doc.text(String(s).slice(0, i === 0 ? 70 : 60), cx[i] + 2, y));
          if (!fundo) { doc.setDrawColor(...linha); doc.setLineWidth(0.4); doc.line(L, y + 2.5, R, y + 2.5); } y += RH + 1; };
        linhaN(cab, true, azul);
        ex.forEach((x) => linhaN([x.pessoa, x.valor ? "R$ " + brl(x.valor) : "sem saldo", x.desde ? "Balanço de " + brData(x.desde) : "Todos os balanços", x.pedido || "–"]));
        linhaN(["Total excluído", "R$ " + brl(tot), "", ""], true);
        y += 6;
      }
      if (so.length) par(`${++k}. Este relatório mostra somente: ${so.map((x) => x.pessoa).sort((a, b) => a.localeCompare(b, "pt-BR")).join("; ")}.`, 8, tinta);
    }
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      doc.setDrawColor(...verde); doc.setLineWidth(0.8); doc.line(L, H - 34, R, H - 34);
      const vw = img(M.vital, L, H - 30, 22);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...cinza);
      doc.text(M.rodape || "Vital Agro & Negócios LTDA · CNPJ 54.146.859/0001-32 · CRC-GO GO-005215/O-1 · Alexânia/GO · @vital_consultoria", L + (vw ? vw + 8 : 0), H - 16);
      doc.text(`Página ${p} de ${n}`, R, H - 16, { align: "right" });
    }
    return new Uint8Array(doc.output("arraybuffer"));
  }
  /* Últimos dias de mês entre dois meses (AAAA-MM), inclusive. */
  function fechamentos(de, ate) {
    const out = []; let [a, m] = de.split("-").map(Number); const [a2, m2] = ate.split("-").map(Number);
    while (a < a2 || (a === a2 && m <= m2)) { out.push(fimDoMes(a, m)); m++; if (m > 12) { m = 1; a++; } }
    return out;
  }
  const nomePdf = (tipo, dataISO) => `${CFG[tipo].titulo} ${brData(dataISO).replace(/\//g, "-")}.pdf`;

  return { CFG, abrir, lerBase, lerExportacao, notas, substituir, finalizar, relatorio, pdf, fechamentos, nomePdf, serialISO, isoSerial, fimDoMes, brData, brl };
})();
if (typeof module !== "undefined") module.exports = VCPG;

/* VitalDFC engine — runs in the browser (and in Node for tests). Needs JSZip and XLSX (SheetJS). */
const VDFC = (() => {
  const CFG = {
    lc: { sheet: "Livro Caixa", table: "Tabela1", nData: 6 },
    emp: { sheet: "Empréstimos", table: "Tabela8", nData: 24, tipoCol: "AH", dvFrom: 5 },
    tr: { sheet: "Transf", table: "Tabela118", nData: 13 },
    fluxo: { sheet: "Fluxo de Caixa", rowMonths: 3, rowReal: 7, real: "Realizado",
             acum: "SALDO ACUMULADO", bancos: "SALDOS BANCÁRIOS", dif: "DIFERENÇA CONCILIAÇÃO" },
    versoes: "VERSÕES",
    limite: 1000,
    socios: ["José Paulo Tinazo", "Saulo Afonso Tinazo", "Vitor Afonso Tinazo", "Paula Tinazo"],
    descontinuadas: ["Sicredi - JP - C/C"],
    bloqueadas: ["CEF - JP - C/C", "CEF - Saulo - C/C", "CEF - Vitor - C/C"],
    transitorias: ["Acerto", "Relação de Troca"],
    previdencia: ["BRASILPREV", "PREVID"],
    tol: 1,
  };

  // ---------------------------------------------------------------- helpers
  const colNum = (c) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const colName = (n) => { let s = ""; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; } return s; };
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const unesc = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const norm = (s) => String(s ?? "").replace(/\t/g, " ").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
  const serial = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
  const fromSerial = (n) => { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000); return d; };
  const ym = (n) => { if (typeof n !== "number") return null; const d = fromSerial(n); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const brl = (v) => (v < 0 ? "-" : "") + "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") { const m = v.match(/^\s*(-?)\s*R\$\s*(-?)\s*([\d.]+,\d+)\s*$/); if (m) { const x = parseFloat(m[3].replace(/\./g, "").replace(",", ".")); return (m[1] || m[2]) ? -x : x; } }
    return 0;
  };

  // ---------------------------------------------------------------- workbook structure
  async function abrir(zip) {
    const wb = await zip.file("xl/workbook.xml").async("string");
    const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
    const relMap = {};
    for (const m of rels.matchAll(/<Relationship\b([^>]*)\/>/g)) {
      const id = m[1].match(/Id="([^"]+)"/)?.[1], t = m[1].match(/Target="([^"]+)"/)?.[1];
      if (id && t) relMap[id] = t.replace(/^\/?xl\//, "");
    }
    const sheets = {};
    for (const m of wb.matchAll(/<sheet\b([^>]*)\/>/g)) {
      const name = unesc(m[1].match(/name="([^"]+)"/)[1]);
      const rid = m[1].match(/r:id="([^"]+)"/)[1];
      sheets[name] = "xl/" + relMap[rid];
    }
    let sst = [];
    const sf = zip.file("xl/sharedStrings.xml");
    if (sf) {
      const s = await sf.async("string");
      sst = [...s.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")));
    }
    return { zip, sheets, sst };
  }

  async function tabelaDaAba(ctx, sheetPath, nome) {
    const relPath = sheetPath.replace(/worksheets\/([^/]+)$/, "worksheets/_rels/$1.rels");
    const rels = await ctx.zip.file(relPath).async("string");
    for (const m of rels.matchAll(/Target="([^"]*tables\/[^"]+)"/g)) {
      const p = "xl/tables/" + m[1].split("/").pop();
      const t = await ctx.zip.file(p).async("string");
      if (new RegExp(`\\bname="${nome}"`).test(t)) return p;
    }
    throw new Error(`Tabela ${nome} não encontrada na aba.`);
  }

  // valor de uma célula <c ...>...</c>
  function valorCelula(attrs, inner, sst) {
    if (inner == null) return null;
    const t = attrs.match(/ t="(\w+)"/)?.[1];
    if (t === "inlineStr") return unesc([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
    const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    if (v == null) return null;
    if (t === "s") return sst[+v];
    if (t === "str" || t === "e") return unesc(v);
    if (t === "b") return v === "1";
    return parseFloat(v);
  }

  function linhasXml(xml) {
    const i = xml.indexOf("<sheetData>") + 11, j = xml.indexOf("</sheetData>");
    if (i < 11) return { head: xml, rows: [], tail: "", i: -1, j: -1 };
    return { i, j, rows: xml.slice(i, j).match(/<row [^>]*?(?:\/>|>[\s\S]*?<\/row>)/g) || [] };
  }
  const rowNum = (r) => +r.match(/^<row r="(\d+)"/)[1];
  const CELL = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

  function celulas(rowXml, sst) {
    const out = {};
    for (const m of rowXml.matchAll(CELL)) out[m[1]] = valorCelula(m[3], m[4], sst);
    return out;
  }

  // ---------------------------------------------------------------- exportações do Connectere
  function lerExportacao(XLSX, buf) {
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
    const header = (rows.shift() || []).map((h) => String(h ?? "").trim());
    return { header, rows: rows.filter((r) => r.some((v) => v !== null && v !== "")) };
  }

  function classificar(nomeArquivo, exp) {
    const h = exp.header.join("|"), n = norm(nomeArquivo);
    if (/^Data\|Conta\|Pessoa\|Hist/.test(h)) return "lc";
    if (/^#\|Data\|Documento\|Hist[oó]rico\|Origem\|Destino/.test(h)) return "tr";
    if (/^#\|Pessoa\|Data\|Documento/.test(h)) {
      if (/DISPON|SAIDA|_S\b/.test(n)) return "di";
      if (/OBTID|ENTRADA|_E\b/.test(n)) return "ob";
      // heurística: disponibilizados = pessoas majoritariamente sócios e linha de crédito com nome de sócio
      const socios = CFG.socios.map(norm);
      const eh = exp.rows.filter((r) => socios.some((s) => norm(r[9]).startsWith(s))).length;
      return eh > exp.rows.length * 0.5 ? "di" : "ob";
    }
    return null;
  }

  function preencherNumero(rows) {
    let ult = null;
    for (const r of rows) { if (r[0] === null || r[0] === "") r[0] = ult; else ult = r[0]; }
    return rows;
  }
  const contar = (rows) => new Set(rows.map((r) => r[0]).filter((x) => x !== null)).size;

  function montarBases(lista) {
    // lista: [{nome, tipo, exp}]
    const out = { lc: [], ob: [], di: [], tr: [], contagens: [] };
    const off = { ob: 0, di: 0, tr: 0 };
    for (const it of lista) {
      if (it.tipo === "lc") {
        out.lc.push(...it.exp.rows.filter((r) => typeof r[0] === "number").map((r) => [r[0], r[1], r[2], r[3], r[4], r[5]]));
        out.contagens.push([it.nome, it.exp.rows.length, false]);
        continue;
      }
      const n = it.tipo === "tr" ? CFG.tr.nData : CFG.emp.nData;
      const rows = preencherNumero(it.exp.rows.map((r) => { const x = r.slice(0, n); while (x.length < n) x.push(null); return x; }));
      let mx = 0;
      for (const r of rows) if (typeof r[0] === "number") { mx = Math.max(mx, r[0]); r[0] = r[0] + off[it.tipo]; }
      off[it.tipo] += mx;
      const k = contar(rows);
      out.contagens.push([it.nome, k, k >= CFG.limite]);
      if (it.tipo === "tr") out.tr.push(...rows);
      else out[it.tipo].push(...rows.map((r) => [...r, it.tipo === "ob" ? "OBTIDOS" : "DISPONIBILIZADOS"]));
    }
    return out;
  }

  // ---------------------------------------------------------------- substituição de tabela (XML)
  function template(rowXml) {
    const t = {};
    for (const m of rowXml.matchAll(CELL)) {
      const col = m[1], attrs = m[3], inner = m[4] || "";
      const s = attrs.match(/ s="(\d+)"/)?.[1] || null;
      const f = inner.match(/<f([^>]*)>([\s\S]*?)<\/f>/);
      t[col] = { s, f: f ? [f[1], f[2]] : null, str: / t="str"/.test(attrs) };
    }
    return t;
  }

  function celulaNova(ref, v, s) {
    const sa = s ? ` s="${s}"` : "";
    if (v === null || v === undefined || v === "") return s ? `<c r="${ref}"${sa}/>` : "";
    if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${sa}><v>${v}</v></c>`;
    if (typeof v === "boolean") v = String(v);
    return `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }

  function linhaNova(r, dados, tmpl, ncols, extra) {
    let out = `<row r="${r}" spans="1:${ncols}">`;
    for (let ci = 1; ci <= ncols; ci++) {
      const col = colName(ci), tp = tmpl[col] || { s: null, f: null, str: false }, ref = col + r;
      if (tp.f) out += `<c r="${ref}"${tp.s ? ` s="${tp.s}"` : ""}${tp.str ? ' t="str"' : ""}><f${tp.f[0]}>${tp.f[1]}</f></c>`;
      else out += celulaNova(ref, ci <= dados.length ? dados[ci - 1] : (extra?.[col] ?? null), tp.s);
    }
    return out + "</row>";
  }

  const renum = (rowXml, n) => rowXml.replace(/^<row r="\d+"/, `<row r="${n}"`).replace(/<c r="([A-Z]+)\d+"/g, (_, c) => `<c r="${c}${n}"`).replace(/ hidden="1"/, "");

  async function substituir(ctx, cfg, novos, { manter = null, extraCol = null, log = () => {} } = {}) {
    const sheetPath = ctx.sheets[cfg.sheet];
    const tabPath = await tabelaDaAba(ctx, sheetPath, cfg.table);
    let tab = await ctx.zip.file(tabPath).async("string");
    const ref = tab.match(/<table\b[^>]*\bref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/);
    const hdr = +ref[2], lastCol = ref[3], ncols = colNum(lastCol);
    let xml = await ctx.zip.file(sheetPath).async("string");
    const L = linhasXml(xml);
    const head = L.rows.filter((r) => rowNum(r) <= hdr);
    const data = L.rows.filter((r) => rowNum(r) > hdr);
    const tmpl = template(data[data.length - 1]);
    const kept = manter ? data.filter((r) => manter(celulas(r, ctx.sst))) : [];
    const out = head.slice();
    let n = hdr + 1;
    for (const r of kept) out.push(renum(r, n++));
    for (const d of novos) {
      const extra = extraCol ? { [extraCol]: d[d.length - 1] } : null;
      out.push(linhaNova(n++, extraCol ? d.slice(0, -1) : d, tmpl, ncols, extra));
    }
    const last = n - 1;
    xml = xml.slice(0, L.i) + out.join("") + xml.slice(L.j);
    xml = xml.replace(/<dimension ref="A1:([A-Z]+)\d+"\/>/, (_, c) => `<dimension ref="A1:${colNum(c) > ncols ? c : lastCol}${last}"/>`);
    if (cfg.tipoCol) xml = xml.replace(new RegExp(`sqref="${cfg.tipoCol}${cfg.dvFrom}:${cfg.tipoCol}\\d+"`), `sqref="${cfg.tipoCol}${cfg.dvFrom}:${cfg.tipoCol}${last}"`);
    ctx.zip.file(sheetPath, xml);
    const novoRef = `A${hdr}:${lastCol}${last}`;
    tab = tab.replace(/(<table\b[^>]*\bref=")[A-Z]+\d+:[A-Z]+\d+"/, `$1${novoRef}"`)
      .replace(/<autoFilter ref="[^"]+"( xr:uid="[^"]+")?\s*(\/>|>[\s\S]*?<\/autoFilter>)/, (_, u) => `<autoFilter ref="${novoRef}"${u || ""}/>`)
      .replace(/<sortState [\s\S]*?<\/sortState>/g, "");
    ctx.zip.file(tabPath, tab);
    log(`${cfg.sheet}: ${kept.length} linhas mantidas, ${novos.length} novas (tabela ${cfg.table} = ${novoRef}).`);
    return { mantidas: kept.length, novas: novos.length, ref: novoRef };
  }

  async function finalizar(ctx, textoVersao, log = () => {}, responsavel = "VITAL") {
    const z = ctx.zip;
    let wb = await z.file("xl/workbook.xml").async("string");
    wb = wb.replace(/<calcPr([^>]*?)\/>/, (_, a) => `<calcPr${a.replace(/ fullCalcOnLoad="\d"/, "")} fullCalcOnLoad="1"/>`);
    z.file("xl/workbook.xml", wb);
    let rels = await z.file("xl/_rels/workbook.xml.rels").async("string");
    z.file("xl/_rels/workbook.xml.rels", rels.replace(/<Relationship [^>]*Target="calcChain.xml"[^>]*\/>/, ""));
    let ct = await z.file("[Content_Types].xml").async("string");
    z.file("[Content_Types].xml", ct.replace(/<Override [^>]*PartName="\/xl\/calcChain.xml"[^>]*\/>/, ""));
    z.remove("xl/calcChain.xml");
    const alvo = [CFG.lc.table, CFG.emp.table, CFG.tr.table];
    for (const f of Object.keys(z.files).filter((p) => /^xl\/pivotCache\/pivotCacheDefinition\d+\.xml$/.test(p))) {
      let s = await z.file(f).async("string");
      const nome = s.match(/<worksheetSource [^>]*name="([^"]+)"/)?.[1];
      if (alvo.includes(nome) && !/refreshOnLoad/.test(s)) z.file(f, s.replace("<pivotCacheDefinition ", '<pivotCacheDefinition refreshOnLoad="1" '));
    }
    // aba VERSÕES
    const vp = ctx.sheets[CFG.versoes];
    if (vp) {
      let v = await z.file(vp).async("string");
      const L = linhasXml(v);
      const ult = L.rows[L.rows.length - 1];
      const nr = rowNum(ult) + 1;
      const st = {}; for (const m of ult.matchAll(CELL)) st[m[1]] = m[3].match(/ s="(\d+)"/)?.[0] || "";
      const hoje = new Date();
      const d = serial(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate());
      const is = (c, t) => `<c r="${c}${nr}"${st[c] || ""} t="inlineStr"><is><t xml:space="preserve">${esc(t)}</t></is></c>`;
      const row = `<row r="${nr}"><c r="A${nr}"${st.A || ""}><v>${d}</v></c>${is("B", responsavel)}${is("C", "FECHAMENTOS")}${is("D", textoVersao)}</row>`;
      v = v.slice(0, L.j) + row + v.slice(L.j);
      v = v.replace(/<dimension ref="A1:([A-Z]+)\d+"\/>/, (_, c) => `<dimension ref="A1:${c}${nr}"/>`);
      z.file(vp, v);
    }
    log("Recálculo completo e atualização das tabelas dinâmicas programados para a abertura no Excel.");
  }

  // ---------------------------------------------------------------- leitura do Fluxo para apontamentos
  async function lerFluxo(ctx, hoje = new Date()) {
    const F = CFG.fluxo;
    const xml = await ctx.zip.file(ctx.sheets[F.sheet]).async("string");
    const L = linhasXml(xml);
    const byRow = {};
    for (const r of L.rows) { const n = rowNum(r); if (n <= 200) byRow[n] = celulas(r, ctx.sst); }
    const meses = [];
    const real = byRow[F.rowReal] || {}, cab = byRow[F.rowMonths] || {};
    for (const [col, v] of Object.entries(real)) {
      if (v === F.real && typeof cab[col] === "number") {
        const d = fromSerial(cab[col]);
        const fechado = d.getUTCFullYear() * 12 + d.getUTCMonth() < hoje.getFullYear() * 12 + hoje.getMonth();
        meses.push({ col, m: ym(cab[col]), fechado });
      }
    }
    meses.sort((a, b) => a.m.localeCompare(b.m));
    const achar = (rot) => +Object.keys(byRow).find((n) => norm(byRow[n].A) === norm(rot));
    const iA = achar(F.acum), iB = achar(F.bancos), iD = achar(F.dif);
    const contas = {};
    for (let n = iB + 1; n < iD; n++) if (byRow[n]?.A) contas[String(byRow[n].A).trim()] = Object.fromEntries(meses.map((x) => [x.m, byRow[n][x.col] ?? null]));
    const serie = (n) => Object.fromEntries(meses.map((x) => [x.m, byRow[n]?.[x.col] ?? null]));
    return { meses, contas, acumulado: serie(iA), bancos: serie(iB), diferenca: serie(iD) };
  }

  async function colunaA(ctx, aba) {
    const p = ctx.sheets[aba]; if (!p) return null;
    const xml = await ctx.zip.file(p).async("string");
    const set = new Set();
    for (const m of xml.matchAll(/<c r="A\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = valorCelula(m[1], m[2], ctx.sst); if (typeof v === "string") set.add(v.toUpperCase());
    }
    return set;
  }

  // ---------------------------------------------------------------- apontamentos
  function apontar({ fluxo, bases, dfcDireto, correlacao }) {
    const ap = [];
    const add = (sev, cat, mes, valor, desc, acao, det) => ap.push({ sev, cat, mes, valor, desc, acao, det: det || [] });
    const fech = fluxo.meses.filter((x) => x.fechado).map((x) => x.m);
    const lista = new Set(Object.keys(fluxo.contas));
    // 1 saldos
    for (const [conta, vals] of Object.entries(fluxo.contas)) {
      const br = fech.filter((m) => vals[m] === null || vals[m] === "");
      if (br.length && br.length === fech.length) add("Baixa", "Saldos bancários", "", null, `${conta}: nenhum saldo informado no período.`, "Informar 0 ou retirar a conta da lista de SALDOS BANCÁRIOS.");
      else if (br.length && CFG.descontinuadas.includes(conta)) add("Média", "Saldos bancários", br[0], null, `${conta}: conta descontinuada, saldo em branco em ${br.join(", ")}.`, "Lançar no Connectere o encerramento (reclassificar o saldo devedor para o passivo) e informar 0 a partir do mês do lançamento.");
      else if (br.length) add("Alta", "Saldos bancários", br[0], null, `${conta}: saldo não informado em ${br.join(", ")} (a soma considera zero).`, "Informar o saldo do extrato; se a conta estiver zerada, digitar 0.");
      const seq = fech.map((m) => vals[m]).filter((x) => typeof x === "number");
      if (!CFG.bloqueadas.includes(conta) && seq.length >= 3 && new Set(seq.map((x) => x.toFixed(2))).size === 1 && Math.abs(seq[0]) > CFG.tol)
        add("Baixa", "Saldos bancários", "", seq[0], `${conta}: mesmo saldo em ${seq.length} meses seguidos.`, "Confirmar no extrato se é saldo real ou valor repetido do mês anterior.");
    }
    // 2 transferências com contas fora da lista
    const fora = new Map();
    for (const r of bases.tr) {
      const m = ym(r[1]); if (!fech.includes(m) || !lista.has(r[9])) continue;
      const outra = r[7] === "Debito" ? r[4] : r[5];
      if (lista.has(outra)) continue;
      const ef = r[7] === "Debito" ? num(r[6]) : -num(r[6]);
      const k = m + "|" + outra; const o = fora.get(k) || { m, outra, v: 0, det: [] };
      o.v += ef; o.det.push([fromSerial(r[1]).toISOString().slice(0, 10).split("-").reverse().join("/"), String(r[3] ?? "").trim().slice(0, 70), r[4], r[5], ef]);
      fora.set(k, o);
    }
    for (const o of [...fora.values()].sort((a, b) => a.m.localeCompare(b.m))) {
      if (Math.abs(o.v) <= CFG.tol) continue;
      const on = norm(o.outra);
      const prev = o.det.some((d) => CFG.previdencia.some((k) => norm(d[1]).includes(k)));
      let cat = "Aplicações (C/A)", acao = "Incluir o saldo da aplicação em SALDOS BANCÁRIOS (equivalente de caixa).";
      if (CFG.transitorias.some((t) => on.includes(norm(t)))) { cat = "Contas transitórias"; acao = "Separar no Fluxo como movimento sem caixa (barter/compensação)."; }
      else if (prev) { cat = "Resgates de previdência"; acao = "Lançar no Fluxo como entrada 'Resgate de previdência' (investimento)."; }
      add(Math.abs(o.v) > 1000 ? "Alta" : "Média", cat, o.m, o.v, `${o.outra}: ${o.v > 0 ? "entrou" : "saiu"} ${brl(Math.abs(o.v))} nas contas da lista sem passar pelo Fluxo.`, acao, o.det);
    }
    // 5 Livro Caixa sem correspondência (ano corrente)
    const faltas = new Map();
    for (const r of bases.lc) {
      const conta = String(r[1] ?? "").toUpperCase(); if (!conta.trim()) continue;
      const v = num(r[4]) - num(r[5]);
      for (const [nome, set] of [["DFC - DIRETO (PROC FC)", dfcDireto], ["Correlação (PROC S&C)", correlacao]]) {
        if (set && !set.has(conta)) { const k = nome + "|" + r[1]; const o = faltas.get(k) || { nome, conta: r[1], n: 0, v: 0 }; o.n++; o.v += v; faltas.set(k, o); }
      }
    }
    for (const o of faltas.values()) add("Média", "Plano de contas", "", o.v, `Livro Caixa: conta "${String(o.conta).trim()}" não existe em ${o.nome} (${o.n} lançamento${o.n > 1 ? "s" : ""}).`, "Incluir a conta na aba indicada para que entre no Fluxo; se for conta \"NÃO USAR\", reclassificar no Connectere.");
    // 6/7 empréstimos
    const soc = CFG.socios.map(norm);
    const ehSocio = (p) => { const n = norm(p); return soc.some((s) => n.startsWith(s) || s.startsWith(n)); };
    const vistos = new Set(), outros = {}, naoSoc = {};
    for (const r of [...bases.ob, ...bases.di]) {
      const tipo = r[r.length - 1], pn = norm(r[1]);
      if (pn.includes("TINAZO") && !ehSocio(r[1]) && !vistos.has(pn)) { vistos.add(pn); add("Média", "Nomes de sócios", "", null, `"${String(r[1]).trim()}" parece sócio, mas não está na lista de sócios do Fluxo.`, "Ajustar o cadastro no Connectere ou incluir o nome nas linhas de Retiradas."); }
      const mp = ym(r[18]), w = num(r[22]);
      if (tipo === "OBTIDOS" && fech.includes(mp) && Math.abs(w) > 0.005) outros[mp] = (outros[mp] || 0) + w;
      const md = ym(r[2]);
      if (tipo === "DISPONIBILIZADOS" && fech.includes(md) && !ehSocio(r[1])) { const k = md + "|" + String(r[1]).trim(); naoSoc[k] = (naoSoc[k] || 0) + num(r[7]); }
    }
    for (const [m, v] of Object.entries(outros).sort()) add("Baixa", "Empréstimos", m, v, `"Outros valores" pagos nas parcelas (multas, tarifas, descontos): ${brl(v)}.`, "Avaliar incluir a coluna Outros valores na amortização do Fluxo.");
    for (const [k, v] of Object.entries(naoSoc).sort()) { const [m, p] = k.split("|"); add("Baixa", "Empréstimos", m, v, `Empréstimo disponibilizado a não sócio (${p}): ${brl(v)}, fora das linhas de Retiradas.`, "Verificar a classificação no Connectere."); }
    // 8 limite
    for (const [nome, k, lim] of bases.contagens) if (lim) add("Alta", "Exportações", "", k, `${nome}: ${k} registros, o limite de ${CFG.limite} do Connectere. A exportação pode estar incompleta.`, "Exportar de novo dividindo por período (ex.: até 31/12/2024 e a partir de 01/01/2025) e enviar as partes.");
    // diferença (valores da última gravação no Excel)
    let ant = null;
    for (const m of fech) {
      const d = fluxo.diferenca[m];
      if (typeof d === "number") { const v = ant === null ? d : d - ant; if (Math.abs(v) > CFG.tol) add("Info", "Diferença de conciliação", m, v, `Variação da diferença em ${m}: ${brl(v)} (acumulada ${brl(d)}).`, "Ver os apontamentos do mesmo mês."); ant = d; }
    }
    const ordem = { Alta: 0, "Média": 1, Baixa: 2, Info: 3 };
    ap.sort((a, b) => ordem[a.sev] - ordem[b.sev] || (a.mes || "").localeCompare(b.mes || "") || a.cat.localeCompare(b.cat));
    return ap;
  }

  // ---------------------------------------------------------------- orquestração
  async function processar({ JSZip, XLSX, planilhaBuf, exportacoes, hoje = new Date(), log = () => {}, responsavel = "VITAL", origem = "PÁGINA VITALDFC" }) {
    const lista = exportacoes.map((e) => ({ nome: e.nome, exp: e.exp || lerExportacao(XLSX, e.buf), tipo: e.tipo }));
    for (const it of lista) if (!it.tipo) it.tipo = classificar(it.nome, it.exp);
    const faltam = ["lc", "ob", "di", "tr"].filter((t) => !lista.some((x) => x.tipo === t));
    if (faltam.length) throw new Error("Faltam exportações: " + faltam.map((t) => ({ lc: "Livro Caixa", ob: "Empréstimos obtidos", di: "Empréstimos disponibilizados", tr: "Transferências" }[t])).join(", "));
    const bases = montarBases(lista);
    log(`Bases lidas: Livro Caixa ${bases.lc.length} · Obtidos ${bases.ob.length} · Disponibilizados ${bases.di.length} · Transferências ${bases.tr.length}`);
    const zip = await JSZip.loadAsync(planilhaBuf);
    const ctx = await abrir(zip);
    for (const c of [CFG.lc, CFG.emp, CFG.tr, CFG.fluxo]) if (!ctx.sheets[c.sheet]) throw new Error(`A planilha não tem a aba "${c.sheet}".`);
    // apontamentos usam o estado salvo (saldos digitados e diferença da última gravação)
    const fluxo = await lerFluxo(ctx, hoje);
    const dfcDireto = await colunaA(ctx, "DFC - DIRETO"), correlacao = await colunaA(ctx, "Correlação");
    const ano = Math.min(...bases.lc.map((r) => r[0]).filter((x) => typeof x === "number"));
    const anoIni = fromSerial(ano).getUTCFullYear();
    const corte = serial(anoIni, 1, 1);
    const res = {};
    res.lc = await substituir(ctx, CFG.lc, bases.lc, { manter: (c) => typeof c.A === "number" && c.A < corte, log });
    res.emp = await substituir(ctx, CFG.emp, [...bases.ob, ...bases.di], { extraCol: CFG.emp.tipoCol, log });
    res.tr = await substituir(ctx, CFG.tr, bases.tr, { log });
    await finalizar(ctx, `ATUALIZAÇÃO DAS BASES PELO ${origem}: LIVRO CAIXA ${bases.lc.length} LINHAS A PARTIR DE 01/01/${anoIni}, EMPRÉSTIMOS ${bases.ob.length + bases.di.length}, TRANSFERÊNCIAS ${bases.tr.length}.`, log, String(responsavel).toUpperCase());
    const ap = apontar({ fluxo, bases, dfcDireto, correlacao });
    return { zip, bases, res, fluxo, apontamentos: ap, anoIni };
  }

  return { CFG, processar, lerExportacao, classificar, apontar, brl, ym, _t: { colName, colNum, montarBases, lerFluxo, abrir } };
})();
if (typeof module !== "undefined") module.exports = VDFC;

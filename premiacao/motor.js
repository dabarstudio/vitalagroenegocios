/* Premiação COE e CCA — motor de cálculo. Roda no navegador e no Node (testes). Precisa do XLSX (SheetJS). */
const VCOE = (() => {
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
  const brl = (v) => (v < 0 ? "-" : "") + "R$ " + Math.abs(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (v) => (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
  const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
  // "2.200,00" | "2200" | 2200 | "R$ 1.900,00" -> número
  const num = (v) => {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    let s = String(v ?? "").replace(/R\$|\s/g, "");
    if (!s) return 0;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const x = parseFloat(s);
    return isFinite(x) ? x : 0;
  };

  // Critérios padrão (planilha de premiação recebida em nov/2026)
  const PADRAO = { op: 0.07, cca: 0.02, hc: 0.01, cotas: 5, status: ["Valorizada"] };

  // Colunas que o motor procura no relatório do sistema do COE (pelo título)
  const CAMPOS = { ficha: ["FICHA"], data: ["DATA ATEND.", "DATA ATEND", "DATA"], paciente: ["NOME DO PACIENTE", "PACIENTE"],
    valor: ["VALOR"], status: ["STATUS"], operador: ["OPERADOR"], tipo: ["TIPO DE CLIENTE"], convenio: ["CONVENIO"],
    ambulancia: ["AMBULANCIA"], percurso: ["PERCURSO"], origem: ["ORIGEM"], destino: ["DESTINO"] };

  /* ---------- leitura da base do COE ---------- */
  function lerBase(buf) {
    const wb = XLSX.read(buf, { type: "array", cellDates: false, raw: false });
    let melhor = null;
    for (const nome of wb.SheetNames) {
      const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: "" });
      for (let i = 0; i < Math.min(linhas.length, 15); i++) {
        const h = linhas[i].map(norm);
        if (h.includes("OPERADOR") && h.includes("VALOR")) { melhor = { nome, linhas, i, h }; break; }
      }
      if (melhor) break;
    }
    if (!melhor) throw new Error("Não encontrei as colunas \"Operador\" e \"Valor\" no arquivo. Envie o relatório de fichas exportado do sistema do COE.");
    const idx = {};
    for (const [k, nomes] of Object.entries(CAMPOS)) { const j = nomes.map((n) => melhor.h.indexOf(n)).find((j) => j >= 0); idx[k] = j ?? -1; }
    const pega = (l, k) => idx[k] >= 0 ? l[idx[k]] : "";
    const fichas = [];
    for (const l of melhor.linhas.slice(melhor.i + 1)) {
      if (!l.some((c) => String(c).trim() !== "")) continue;
      const ficha = String(pega(l, "ficha")).trim();
      if (!ficha && !String(pega(l, "operador")).trim()) continue;
      let data = pega(l, "data");
      if (typeof data === "number") { const d = new Date(Date.UTC(1899, 11, 30) + data * 864e5); data = d.toISOString().slice(0, 10).split("-").reverse().join("/"); }
      fichas.push({ ficha, data: String(data).trim(), paciente: String(pega(l, "paciente")).trim(), valor: num(pega(l, "valor")),
        status: String(pega(l, "status")).trim(), operador: String(pega(l, "operador")).trim().replace(/\s+/g, " "),
        tipo: String(pega(l, "tipo")).trim(), convenio: String(pega(l, "convenio")).trim(), ambulancia: String(pega(l, "ambulancia")).trim(),
        percurso: String(pega(l, "percurso")).trim(), origem: String(pega(l, "origem")).trim(), destino: String(pega(l, "destino")).trim() });
    }
    const faltando = ["valor", "operador", "status"].filter((k) => idx[k] < 0);
    return { aba: melhor.nome, fichas, faltando, temTipo: idx.tipo >= 0 };
  }

  /* ---------- leitura dos critérios (planilha de premiação) ---------- */
  // Procura linhas "rótulo | percentual | regra". Devolve só o que conseguir ler; o resto fica com o valor anterior.
  function lerCriterios(buf) {
    const wb = XLSX.read(buf, { type: "array" });
    const achou = {}, linhasLidas = [];
    for (const nome of wb.SheetNames) {
      const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: "" });
      for (const l of linhas) {
        const textos = l.filter((c) => typeof c === "string" && c.trim()).map(norm);
        const nums = l.filter((c) => typeof c === "number" && c > 0 && c < 1);
        if (!textos.length || !nums.length) continue;
        const t = textos.join(" | "), v = nums[0];
        const dividido = t.match(/DIVIDID[OA]\s+(?:PARA|POR|EM|ENTRE)\s+(\d+)/);
        if (/HOME ?CARE/.test(t) && /DIVIDID|COTA|RATEI/.test(t)) { achou.hc = v; if (dividido) achou.cotas = +dividido[1]; linhasLidas.push(t); }
        else if (/PARTICULAR/.test(t) && /\bCCA\b/.test(t) && !/OPERADOR/.test(t)) { achou.cca = v; linhasLidas.push(t); }
        else if (/PARTICULAR/.test(t) && /OPERADOR|COE/.test(t)) { achou.op = v; linhasLidas.push(t); }
      }
    }
    return { achou, linhasLidas };
  }

  /* ---------- cálculo ---------- */
  // cfg: { op, cca, hc, cotas, status[], hcFat, equipe:[{nome, sistema:[nomes no relatório], funcao:"COE"|"CCA"|"", hc:bool}] }
  function calcular(fichas, cfg, temTipo = true) {
    const statusOk = new Set((cfg.status || PADRAO.status).map(norm));
    const pessoaDe = {};
    for (const p of cfg.equipe || []) for (const n of [p.nome, ...(p.sistema || [])]) if (n) pessoaDe[norm(n)] = p;
    const linhas = fichas.map((f) => {
      const p = pessoaDe[norm(f.operador)] || null;
      const particular = !temTipo || !f.tipo || norm(f.tipo) === "PARTICULAR";
      const valida = statusOk.has(norm(f.status)) && f.valor > 0 && particular;
      let motivo = "";
      if (!statusOk.has(norm(f.status))) motivo = "Status " + (f.status || "em branco");
      else if (!(f.valor > 0)) motivo = "Valor zerado";
      else if (!particular) motivo = "Não é particular (" + f.tipo + ")";
      else if (!p) motivo = "Operador não cadastrado";
      else if (p.funcao !== "COE" && p.funcao !== "CCA") motivo = "Fora da premiação";
      // o CCA também recebe o percentual das remoções particulares que ele mesmo fechou
      const premia = valida && p && (p.funcao === "COE" || p.funcao === "CCA");
      return { ...f, pessoa: p ? p.nome : "", funcao: p ? p.funcao : "", valida, premia, motivo: premia ? "" : motivo, premio: premia ? r2(f.valor * cfg.op) : 0 };
    });
    const fatValido = r2(linhas.filter((l) => l.valida).reduce((s, l) => s + l.valor, 0));
    const ccas = (cfg.equipe || []).filter((p) => p.funcao === "CCA");
    const hcPart = (cfg.equipe || []).filter((p) => p.hc);
    const poolHc = r2((cfg.hcFat || 0) * cfg.hc);
    const cota = cfg.cotas > 0 ? poolHc / cfg.cotas : 0;
    const pessoas = (cfg.equipe || []).filter((p) => p.nome).map((p) => {
      const minhas = linhas.filter((l) => l.pessoa === p.nome && l.valida);
      const part = r2(linhas.filter((l) => l.pessoa === p.nome).reduce((s, l) => s + l.premio, 0));
      const cca = p.funcao === "CCA" && ccas.length ? r2(fatValido * cfg.cca / ccas.length) : 0;
      const hc = p.hc ? r2(cota) : 0;
      return { nome: p.nome, funcao: p.funcao || "–", remocoes: minhas.length, faturado: r2(minhas.reduce((s, l) => s + l.valor, 0)), part, cca, hc, total: r2(part + cca + hc) };
    }).filter((p) => p.funcao !== "–" || p.total > 0);
    const tot = (k) => r2(pessoas.reduce((s, p) => s + p[k], 0));
    const alertas = [];
    const semCad = [...new Set(linhas.filter((l) => l.valida && !l.pessoa).map((l) => l.operador || "(em branco)"))];
    if (semCad.length) alertas.push({ nivel: "alta", txt: `Operador sem cadastro na equipe: ${semCad.join(", ")}. Essas fichas não foram premiadas.` });
    if (!ccas.length && fatValido > 0) alertas.push({ nivel: "alta", txt: `Nenhuma pessoa marcada como CCA: ${brl(fatValido * cfg.cca)} (${pct(cfg.cca)} das particulares) ficaram sem destino.` });
    if (cfg.hc > 0 && !(cfg.hcFat > 0)) alertas.push({ nivel: "media", txt: "Faturamento do Home Care do mês não informado: a parcela de Home Care está zerada." });
    if (cfg.hc > 0 && hcPart.length !== cfg.cotas) alertas.push({ nivel: "media", txt: `${hcPart.length} pessoa(s) marcadas para o Home Care, mas o critério divide em ${cfg.cotas} cotas. ${hcPart.length > cfg.cotas ? "O total pago passa do previsto." : "Sobra parte do valor sem destino."}` });
    const fora = linhas.filter((l) => !l.premia);
    return { linhas, pessoas, fatValido, qtdValidas: linhas.filter((l) => l.valida).length, poolHc, cota: r2(cota), fora, alertas,
      tot: { part: tot("part"), cca: tot("cca"), hc: tot("hc"), total: tot("total"), remocoes: tot("remocoes"), faturado: tot("faturado") } };
  }

  // Monta a equipe inicial a partir dos operadores da base (aproveitando a configuração do mês anterior)
  function equipeSugerida(fichas, anterior) {
    const eq = (anterior || []).map((p) => ({ ...p, sistema: [...(p.sistema || [])] }));
    const conhecido = new Set(eq.flatMap((p) => [p.nome, ...(p.sistema || [])]).map(norm));
    for (const op of [...new Set(fichas.map((f) => f.operador).filter(Boolean))]) {
      if (conhecido.has(norm(op))) continue;
      const nome = op.length > 2 && op === op.toUpperCase() ? op.charAt(0) + op.slice(1).toLowerCase() : op;
      eq.push({ nome, sistema: [op], funcao: "COE", hc: true, novo: true }); conhecido.add(norm(op));
    }
    return eq;
  }

  return { norm, num, brl, pct, r2, PADRAO, lerBase, lerCriterios, calcular, equipeSugerida };
})();
if (typeof module !== "undefined") module.exports = VCOE;

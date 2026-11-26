/* Painel dos sócios · Balanced Scorecard (Kaplan & Norton)
   4 perspectivas: Financeira · Clientes e mercado · Processos internos · Aprendizado e crescimento.
   Dados: RPC bsc_painel (só sócios) + metas em bsc_metas. */
(function () {
const CFG = window.VITAL_CONFIG;
const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MC = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const brl = (v) => (v == null || isNaN(v)) ? "–" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const nf = (v) => (v == null || isNaN(v)) ? "–" : Number(v).toLocaleString("pt-BR");
const pc = (v) => (v == null || !isFinite(v)) ? "–" : Math.round(v) + "%";
const mesRot = (ym) => MC[+ym.slice(5, 7) - 1] + "/" + ym.slice(2, 4);
const S = { mes: new Date().toISOString().slice(0, 7), d: null, equipe: [] };

/* metas editáveis pelos sócios: chave, rótulo, unidade, sentido (maior é melhor?) */
const METAS = [
  ["clientes_ativos", "Clientes ativos", "n", 1],
  ["receita_mes", "Receita do mês (R$)", "brl", 1],
  ["margem_pct", "Margem do mês (%)", "pct", 1],
  ["recorrente_pct", "Receita recorrente (% da receita)", "pct", 1],
  ["nps", "NPS (últimos 12 meses)", "n", 1],
  ["conversao_pct", "Conversão do funil (%)", "pct", 1],
  ["leads_mes", "Leads novos no mês", "n", 1],
  ["obrig_prazo_pct", "Obrigações entregues no prazo (%)", "pct", 1],
  ["inadimplencia_max", "Inadimplência máxima (R$)", "brl", -1],
  ["concentracao_max", "Concentração nos 5 maiores (máx. %)", "pct", -1],
  ["treinamento_pct", "Investimento em treinamento (% da receita)", "pct", 1],
];
const metaDe = (k) => S.d && S.d.metas && S.d.metas[k] != null ? +S.d.metas[k] : null;
/* semáforo: atingiu a meta = verde; até 10% abaixo = amarelo; pior = vermelho */
function sinal(k, v) {
  const m = metaDe(k), def = METAS.find((x) => x[0] === k); if (m == null || v == null || !isFinite(v) || !def) return "";
  const dir = def[3]; if (dir > 0) return v >= m ? "s-ok" : v >= m * 0.9 ? "s-at" : "s-ruim";
  return v <= m ? "s-ok" : v <= m * 1.1 ? "s-at" : "s-ruim";
}
const metaTxt = (k) => { const m = metaDe(k), def = METAS.find((x) => x[0] === k); if (m == null) return ""; return `<span class="meta">meta ${def[2] === "brl" ? brl(m) : def[2] === "pct" ? pc(m) : nf(m)}</span>`; };

function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }

/* ---------- carga ---------- */
async function carregar() {
  $("#app").innerHTML = `<p class="note">Carregando o painel…</p>`;
  const { data, error } = await sb.rpc("bsc_painel", { p_mes: S.mes + "-01" });
  if (error) { $("#app").innerHTML = `<div class="sec bloq"><h2>Não foi possível carregar</h2><p class="note">${esc(error.message)}</p></div>`; return; }
  S.d = data; desenhar();
}

/* ---------- componentes ---------- */
const tile = (k, rot, v, det, cls) => `<div class="ft ${cls || ""}"><span class="k">${rot}</span><span class="v">${v}</span>${det || ""}</div>`;
const delta = (a, b, fmt, inv) => { if (a == null || b == null || !isFinite(a) || !isFinite(b) || b === 0) return `<span class="d">sem comparação</span>`;
  const x = (a - b) / Math.abs(b) * 100, bom = inv ? x < 0 : x > 0; return `<span class="d ${Math.abs(x) < 0.5 ? "" : bom ? "up" : "dn"}">${x > 0 ? "▲" : x < 0 ? "▼" : "="} ${Math.abs(Math.round(x))}% vs mês anterior</span>`; };
const mi = (rot, v, cls, extra) => `<div class="mi ${cls || ""}"><span>${rot}</span><b>${v}</b>${extra || ""}</div>`;
const barras = (L, fmt) => { const mx = Math.max(1, ...L.map((x) => x[1])); return `<div class="hb">${L.map(([n, v]) => `<div class="r"><span title="${esc(n)}">${esc(n)}</span><i style="width:${Math.max(1, v / mx * 100)}%"></i><em>${fmt ? fmt(v) : nf(v)}</em></div>`).join("")}</div>`; };
function colunas(serie, val, orc, rot) {
  const mx = Math.max(1, ...serie.map((s) => Math.max(+val(s) || 0, +(orc ? orc(s) : 0) || 0)));
  return `<div class="cc">${serie.map((s, i) => { const v = +val(s) || 0, o = orc ? +orc(s) || 0 : 0;
    return `<div class="${i === serie.length - 1 ? "cur" : ""}" data-tip="${esc(rot(s))}"><i style="height:${v / mx * 100}%"></i>${o ? `<u style="bottom:${o / mx * 100}%"></u>` : ""}</div>`; }).join("")}</div>
    <div class="ccx">${serie.map((s) => `<span>${MC[+String(s.m).slice(5, 7) - 1]}</span>`).join("")}</div>`;
}

/* ---------- desenho ---------- */
function desenhar() {
  const d = S.d, se = d.serie || [], cur = se[se.length - 1] || {}, ant = se[se.length - 2] || {};
  const res = (s) => (+s.receita || 0) - (+s.custos || 0) - (+s.despesas || 0) - (+s.impostos || 0);
  const marg = (s) => +s.receita ? res(s) / +s.receita * 100 : null;
  const recPct = (s) => +s.receita ? +s.recorrente / +s.receita * 100 : null;
  const ticket = (s) => +s.pagantes ? +s.receita / +s.pagantes : null;
  const cl = d.clientes || {}, sit = cl.situacao || {}, ativos = +sit.ativo || 0;
  const nps = d.nps || {}, fu = d.funil || {}, pr = d.processos || {}, ob = pr.obrig_mes || {}, qd = pr.quadro || {};
  const conv = (fu.ganhos_12m + fu.perdidos_12m) ? fu.ganhos_12m / (fu.ganhos_12m + fu.perdidos_12m) * 100 : null;
  const obPrazo = ob.entregues ? ob.no_prazo / ob.entregues * 100 : null;
  const top = d.top_clientes || [], conc = d.receita_12m ? top.reduce((a, x) => a + +x.valor, 0) / d.receita_12m * 100 : null;
  const trein = d.receita_12m ? (+d.treinamento_12m || 0) / d.receita_12m * 100 : null;
  const inad = d.inadimplencia || {};
  const pessoasEq = (qd.pessoas || []).filter((p) => S.equipe.some((n) => n && (n === p.nome || n.split(" ")[0] === p.nome.split(" ")[0])));
  const nPessoas = Math.max(1, (+d.equipe || 0) + 1);
  const mesAtual = S.mes === new Date().toISOString().slice(0, 7);
  const ult = d.ult_lancamento ? new Date(d.ult_lancamento + "T12:00").toLocaleDateString("pt-BR") : "–";

  $("#app").innerHTML = `
  <div class="bhead"><div><div class="eyeb">Gestão · sócios · Balanced Scorecard</div><h1>Como está a Vital</h1>
      <p class="note">Financeiro lançado até ${ult}${mesAtual ? " · mês em andamento" : ""}. Toque numa barra para ver o valor.</p></div>
    <div class="row"><div class="mesnav" role="group" aria-label="Mês"><button type="button" id="mAnt" aria-label="Mês anterior">‹</button><b>${mesRot(S.mes)}</b><button type="button" id="mProx" aria-label="Próximo mês" ${mesAtual ? "disabled" : ""}>›</button></div>
      <button class="btn" id="bMetas" type="button">🎯 Metas</button></div></div>

  <div class="faixa">
    ${tile("", "Clientes ativos", nf(ativos), metaTxt("clientes_ativos") || `<span class="d">${nf(cur.pagantes)} pagaram no mês</span>`, sinal("clientes_ativos", ativos))}
    ${tile("", "Receita do mês", brl(cur.receita), delta(+cur.receita, +ant.receita) + (cur.orc_receita ? `<span class="meta">orçado ${brl(cur.orc_receita)} · ${pc(cur.receita / cur.orc_receita * 100)}</span>` : ""), sinal("receita_mes", +cur.receita))}
    ${tile("", "Receita recorrente", brl(cur.recorrente), `<span class="d">${pc(recPct(cur))} da receita</span>${metaTxt("recorrente_pct")}`, sinal("recorrente_pct", recPct(cur)))}
    ${tile("", "Resultado do mês", brl(res(cur)), `<span class="d">margem ${pc(marg(cur))}</span>${metaTxt("margem_pct")}`, sinal("margem_pct", marg(cur)))}
    ${tile("", "NPS · 12 meses", nps.nps12 == null ? "–" : nf(nps.nps12), `<span class="d">${nf(nps.n12)} resposta(s)</span>${metaTxt("nps")}`, sinal("nps", nps.nps12))}
    ${tile("", "Obrigações no prazo", pc(obPrazo), `<span class="d">${nf(pr.obrig_atrasadas)} atrasada(s) em aberto</span>${metaTxt("obrig_prazo_pct")}`, sinal("obrig_prazo_pct", obPrazo))}
  </div>

  <div class="persp">
    <section class="pp"><h2><i>💰</i>Financeira</h2><p class="q">A Vital está crescendo com lucro e caixa?</p>
      <div class="leg"><span><span class="sw" style="background:var(--brand-2)"></span>Receita</span><span><span class="ln"></span>Orçado</span></div>
      ${colunas(se, (s) => s.receita, (s) => s.orc_receita, (s) => `${mesRot(String(s.m).slice(0, 7))}: receita ${brl(s.receita)}${s.orc_receita ? " · orçado " + brl(s.orc_receita) : ""} · resultado ${brl(res(s))}`)}
      <div class="mini">
        ${mi("Custos + despesas do mês", brl((+cur.custos || 0) + (+cur.despesas || 0) + (+cur.impostos || 0)), "", cur.orc_gastos ? `<span class="meta">orçado ${brl(cur.orc_gastos)}</span>` : "")}
        ${mi("Ticket médio por cliente pagante", brl(ticket(cur)))}
        ${mi("Caixa (conta Cora)", brl(d.caixa))}
        ${mi("Honorários vencidos", brl(inad.valor), sinal("inadimplencia_max", +inad.valor), `<span class="meta">${nf(inad.qtd)} guia(s) no portal Dabar</span>`)}
        ${mi("Receita 12 meses", brl(d.receita_12m))}
        ${mi("Concentração nos 5 maiores", pc(conc), sinal("concentracao_max", conc), metaTxt("concentracao_max"))}
      </div>
      <div><div class="st">Receita por serviço · 12 meses</div>${(d.por_servico_12m || []).length ? barras((d.por_servico_12m || []).map((x) => [x.categoria, +x.valor]), brl) : `<p class="vazio">Sem receitas classificadas.</p>`}</div>
      <div><div class="st">5 maiores clientes · 12 meses</div>${top.length ? barras(top.map((x) => [x.cliente, +x.valor]), brl) : `<p class="vazio">Sem dados.</p>`}</div>
      <a class="btn sm" href="/vitalagroenegocios/projetos/#financeiro">Abrir o financeiro</a>
    </section>

    <section class="pp"><h2><i>🤝</i>Clientes e mercado</h2><p class="q">Os clientes estão satisfeitos, ficando e chegando?</p>
      <div class="mini">
        ${mi("Ativos", nf(ativos), sinal("clientes_ativos", ativos))}
        ${mi("Pagaram no mês", nf(cur.pagantes), "", `<span class="meta">${nf(ant.pagantes)} no mês anterior</span>`)}
        ${mi("Novos no mês", nf(cur.novos), "", `<span class="meta">1º pagamento no mês</span>`)}
        ${mi("Inativos / encerrados", nf((+sit.inativo || 0) + (+sit.encerrado || 0)))}
      </div>
      <div><div class="st">Clientes ativos por serviço</div>${(cl.por_servico || []).length ? barras(cl.por_servico.map((x) => [x.servico, +x.n])) : `<p class="vazio">Nenhum serviço marcado nos clientes ativos.</p>`}</div>
      <div><div class="st">Satisfação (NPS) · 12 meses</div>
        ${nps.n12 ? `<div class="npsb" role="img" aria-label="${nps.prom} promotores, ${nps.neut} neutros, ${nps.detr} detratores"><i style="width:${nps.prom / nps.n12 * 100}%;background:#2E8B57"></i><i style="width:${nps.neut / nps.n12 * 100}%;background:#D9A23A"></i><i style="width:${nps.detr / nps.n12 * 100}%;background:#C7432F"></i></div>
          <div class="leg" style="margin-top:6px"><span><span class="sw" style="background:#2E8B57"></span>${nps.prom} promotores</span><span><span class="sw" style="background:#D9A23A"></span>${nps.neut} neutros</span><span><span class="sw" style="background:#C7432F"></span>${nps.detr} detratores</span></div>`
        : `<p class="vazio">Ainda não há respostas. Crie os links do NPS e envie aos clientes.</p>`}
        ${nps.pedidos ? `<p class="al2" style="margin-top:8px">🙋 ${nps.pedidos} pedido(s) de acesso à Área do Cliente aguardando.</p>` : ""}
        <a class="btn sm" style="margin-top:8px" href="/vitalagroenegocios/cliente/#nps">Abrir o NPS</a></div>
      <div><div class="st">Qualitativo (Raio-X da porteira)</div>
        <p class="${cl.raiox ? "al2 ok" : "al2"}">${cl.raiox ? `${nf(cl.raiox)} de ${nf(ativos)} clientes ativos com Raio-X preenchido.` : `Nenhum cliente com Raio-X preenchido ainda. É ele que mostra nicho, porteira para dentro, sucessão e oportunidades.`}</p>
        <a class="btn sm" style="margin-top:8px" href="/vitalagroenegocios/projetos/#clientes">Preencher o Raio-X</a></div>
    </section>

    <section class="pp full"><h2><i>📈</i>Comercial · funil de vendas</h2><p class="q">Quantos negócios estão entrando e quantos viram clientes?</p>
      <div class="mini">
        ${mi("Leads novos no mês", nf(fu.leads_mes), sinal("leads_mes", fu.leads_mes), metaTxt("leads_mes"))}
        ${mi("Ganhos no mês", nf(fu.ganhos_mes && fu.ganhos_mes.n), "", fu.ganhos_mes && +fu.ganhos_mes.valor ? `<span class="meta">${brl(fu.ganhos_mes.valor)}</span>` : "")}
        ${mi("Conversão · 12 meses", pc(conv), sinal("conversao_pct", conv), `<span class="meta">${nf(fu.ganhos_12m)} ganhos · ${nf(fu.perdidos_12m)} perdidos</span>`)}
        ${mi("Ciclo médio de venda", fu.ciclo_dias == null ? "–" : nf(fu.ciclo_dias) + " dias")}
        ${mi("Em negociação (pipeline)", brl(fu.pipeline), "", `<span class="meta">ponderado ${brl(fu.ponderado)}</span>`)}
        ${mi("Sem próxima ação", nf(fu.sem_acao), fu.sem_acao ? "s-at" : "", `<span class="meta">de ${nf(fu.abertos)} em aberto</span>`)}
      </div>
      <div class="persp" style="gap:18px">
        <div><div class="st">Onde estão os negócios abertos</div><div class="funil" style="margin-top:8px">${(() => { const E = fu.etapas || [], mx = Math.max(1, ...E.map((e) => +e.n));
          return E.map((e) => `<div class="fe"><span>${esc(e.nome)}</span><div class="fb"><i style="width:${Math.max(12, e.n / mx * 100)}%">${nf(e.n)}${+e.valor ? " · " + brl(e.valor) : ""}</i></div></div>`).join("")
            + `<div class="fe g"><span>Ganhos 12m</span><div class="fb"><i style="width:${Math.max(12, fu.ganhos_12m / Math.max(mx, fu.ganhos_12m, fu.perdidos_12m) * 100)}%">${nf(fu.ganhos_12m)}</i></div></div>`
            + `<div class="fe p"><span>Perdidos 12m</span><div class="fb"><i style="width:${Math.max(12, fu.perdidos_12m / Math.max(mx, fu.ganhos_12m, fu.perdidos_12m) * 100)}%">${nf(fu.perdidos_12m)}</i></div></div>`; })()}</div></div>
        <div><div class="st">Leads e ganhos por mês</div>
          <div class="leg" style="margin:6px 0"><span><span class="sw" style="background:var(--brand-2)"></span>Leads</span><span><span class="ln"></span>Ganhos</span></div>
          ${colunas(fu.serie || [], (s) => s.leads, (s) => s.ganhos, (s) => `${mesRot(s.m)}: ${s.leads} lead(s), ${s.ganhos} ganho(s)`)}
        </div>
      </div>
      <div class="persp" style="gap:18px">
        <div><div class="st">De onde vêm os clientes ganhos · 12 meses</div>${(fu.origem_ganhos || []).length ? barras(fu.origem_ganhos.map((x) => [x.origem, +x.n])) : `<p class="vazio">Sem ganhos no período.</p>`}</div>
        <div><div class="st">Por que perdemos · 12 meses</div>${(fu.motivos_perda || []).length ? barras(fu.motivos_perda.map((x) => [x.motivo, +x.n])) : `<p class="vazio">Sem perdas no período.</p>`}</div>
      </div>
      ${(fu.origem_ganhos || []).some((x) => x.origem === "Não informada") || (fu.motivos_perda || []).some((x) => x.motivo === "Não informado") ? `<p class="note">Dica: preencher a origem e o motivo de perda nos cartões do funil deixa estes gráficos úteis para decidir onde investir.</p>` : ""}
      <div class="row"><a class="btn sm primary" href="/vitalagroenegocios/projetos/#quadros">Abrir o funil de vendas</a><a class="btn sm" href="/vitalagroenegocios/projetos/#comercial">Comercial e indicadores</a></div>
    </section>

    <section class="pp"><h2><i>⚙️</i>Processos internos</h2><p class="q">Estamos entregando no prazo e com qualidade?</p>
      <div class="mini">
        ${mi("Obrigações do mês no prazo", pc(obPrazo), sinal("obrig_prazo_pct", obPrazo), `<span class="meta">${nf(ob.no_prazo)} de ${nf(ob.entregues)} entregues · ${nf(ob.total)} no mês</span>`)}
        ${mi("Obrigações atrasadas", nf(pr.obrig_atrasadas), pr.obrig_atrasadas ? "s-ruim" : "s-ok")}
        ${mi("Tarefas concluídas no mês (todos os quadros)", nf(qd.concluidas), "", `<span class="meta">${nf(qd.criadas)} criadas</span>`)}
        ${mi("Tarefas no prazo", pc(qd.com_prazo ? qd.no_prazo / qd.com_prazo * 100 : null), "", `<span class="meta">${nf(qd.atrasadas)} atrasada(s)</span>`)}
        ${mi("Projetos em andamento", nf(pr.proj_andamento), "", `<span class="meta">${nf(pr.proj_concluidos_mes)} concluído(s) no mês</span>`)}
        ${mi("Dias médios para concluir", qd.dias_medios == null ? "–" : String(qd.dias_medios).replace(".", ","))}
      </div>
      <div class="row"><a class="btn sm" href="/vitalagroenegocios/kpi/">Tarefas em detalhe</a><a class="btn sm" href="/vitalagroenegocios/projetos/">Projetos</a></div>
    </section>

    <section class="pp"><h2><i>🌱</i>Aprendizado e crescimento</h2><p class="q">A equipe está crescendo e dando conta?</p>
      <div class="mini">
        ${mi("Pessoas (sócios + equipe)", nf(nPessoas))}
        ${mi("Receita por pessoa · 12m", brl(d.receita_12m / nPessoas))}
        ${mi("Investido em treinamento · 12m", brl(d.treinamento_12m), sinal("treinamento_pct", trein), `<span class="meta">${pc(trein)} da receita</span>${metaTxt("treinamento_pct")}`)}
      </div>
      <div><div class="st">Tarefas da equipe Vital no mês</div>${pessoasEq.length ? `<div class="tablewrap" style="margin-top:6px"><table class="t"><thead><tr><th>Pessoa</th><th class="num">Concluídas</th><th class="num">No prazo</th><th class="num">Abertas</th><th class="num">Atrasadas</th></tr></thead><tbody>${pessoasEq.sort((a, b) => b.concluidas - a.concluidas).map((p) => `<tr><td>${esc(p.nome)}</td><td class="num">${nf(p.concluidas)}</td><td class="num">${nf(p.no_prazo)}</td><td class="num">${nf(p.abertas)}</td><td class="num">${nf(p.atrasadas)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="vazio">Sem tarefas da equipe no mês.</p>`}</div>
    </section>
  </div>`;

  $("#mAnt").onclick = () => { S.mes = addMes(S.mes, -1); carregar(); };
  $("#mProx").onclick = () => { S.mes = addMes(S.mes, 1); carregar(); };
  $("#bMetas").onclick = dlgMetas;
  ligarTips();
}
const addMes = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };

/* dica ao passar o mouse ou tocar numa barra */
function ligarTips() {
  const tip = $("#tip");
  const mostra = (el, x, y) => { tip.textContent = el.dataset.tip; tip.hidden = false; const w = tip.offsetWidth; tip.style.left = Math.min(innerWidth - w - 8, Math.max(8, x - w / 2)) + "px"; tip.style.top = (y - tip.offsetHeight - 12) + "px"; };
  document.querySelectorAll("[data-tip]").forEach((el) => {
    el.onmousemove = (e) => mostra(el, e.clientX, e.clientY); el.onmouseleave = () => tip.hidden = true;
    el.onclick = (e) => { const r = el.getBoundingClientRect(); mostra(el, r.left + r.width / 2, r.top); setTimeout(() => tip.hidden = true, 2500); e.stopPropagation(); };
  });
}

/* metas */
function dlgMetas() {
  const f = $("#dlgF");
  f.innerHTML = `<h2 style="font-size:1.2rem">🎯 Metas dos sócios</h2><p class="note">Com a meta definida, o indicador fica verde quando atinge, amarelo quando está até 10% fora e vermelho quando passa disso. Deixe em branco para não usar meta.</p>
    <div class="grid2">${METAS.map(([k, rot, u]) => `<div class="field"><label for="mt_${k}">${rot}</label><input id="mt_${k}" inputmode="decimal" value="${metaDe(k) == null ? "" : String(metaDe(k)).replace(".", ",")}" placeholder="${u === "brl" ? "R$" : u === "pct" ? "%" : ""}"></div>`).join("")}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel">Cancelar</button><button class="btn primary" id="mtSalvar" type="button">Salvar metas</button></div>`;
  $("#dlg").showModal();
  $("#mtSalvar").onclick = async () => {
    const up = [], del = [];
    METAS.forEach(([k]) => { const t = $("#mt_" + k).value.trim().replace(/\./g, "").replace(",", "."); if (t === "") del.push(k); else if (!isNaN(+t)) up.push({ chave: k, valor: +t, atualizado_em: new Date().toISOString() }); });
    if (up.length) { const { error } = await sb.from("bsc_metas").upsert(up); if (error) return toast("Não foi possível salvar: " + error.message); }
    if (del.length) await sb.from("bsc_metas").delete().in("chave", del);
    $("#dlg").close(); toast("Metas salvas."); carregar();
  };
}

/* ---------- entrada ---------- */
async function iniciar() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = "/vitalagroenegocios/cliente/?volta=/vitalagroenegocios/bsc/"; return; }
  const { data: p } = await sb.from("perfis").select("papel, socio").eq("user_id", session.user.id).maybeSingle();
  if (!p || !(p.papel === "admin" || (p.papel === "equipe" && p.socio))) { $("#app").innerHTML = `<div class="sec bloq"><h2>Área exclusiva dos sócios</h2><p><a class="btn" href="/vitalagroenegocios/cliente/">Voltar para a Área do cliente</a></p></div>`; return; }
  const eq = await sb.rpc("bsc_equipe_nomes"); S.equipe = (eq.data || []).filter(Boolean);
  carregar();
}
window.__BSC = { S, desenhar };
iniciar();
})();

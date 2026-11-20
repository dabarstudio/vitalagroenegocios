/* ===== Fichas técnicas, CMV, markup e precificação (Vital) =====
   Aba "Fichas e preços" dentro do painel do cliente (ex.: Ateliê de Delícias).
   - Insumos com preço da embalagem; receitas-base (massas, recheios) e produtos finais.
   - Custo recalculado em cascata (insumo → receita-base → produto), CMV = custo ÷ preço, markup = preço ÷ custo.
   - Mês a mês: cada mês guarda os preços dos insumos e de venda (tabela ft_hist), para acompanhar o CMV ao longo do tempo.
   - Equipe Vital importa a planilha de fichas (.xlsx); a equipe e o cliente atualizam preços pelo portal.
   Tabelas: ft_base (catálogo atual, 1 por empresa), ft_hist (preços de cada mês), ft_base_versoes (cópias de segurança). */
(function(){
let S, sb, esc, toast, VITAL;
const bind = () => { VITAL = window.VITAL || {}; ({S, sb, esc, toast} = VITAL); return !!sb; };
const F = { emp:"", base:null, hist:{}, tab:"geral", sel:null, f:{cat:"", q:"", st:""}, fi:{q:"", st:""}, emps:new Set(), carregado:false, sim:{} };
const brl = v => (v==null||!isFinite(v)) ? "–" : v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const brl0 = v => (v==null||!isFinite(v)) ? "–" : v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const pct = (v,d=1) => (v==null||!isFinite(v)) ? "–" : (v*100).toLocaleString("pt-BR",{maximumFractionDigits:d,minimumFractionDigits:d})+"%";
const n2 = (v,d=2) => (v==null||!isFinite(v)) ? "–" : v.toLocaleString("pt-BR",{maximumFractionDigits:d});
const nz = t => String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const MC = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const mesAtual = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); };
const mesC = m => { const [a,b]=m.split("-"); return MC[+b-1]+"/"+a.slice(2); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random().toString(16).slice(2));
const eq = () => S && (S.papel==="admin" || S.papel==="equipe");
const $ = s => document.querySelector(s);

/* ===== estilo (identidade do cliente, escopo .ftw) ===== */
function css(){ if (document.getElementById("ftCss")) return; const st=document.createElement("style"); st.id="ftCss"; st.textContent=`
.ftw{--ft-a:#B5476B;--ft-a2:#F6D9E1;--ft-c:#5B3A29;--ft-cr:#FFF8F1;--ft-g:#C9A227;--ft-ok:#2F855A;--ft-wa:#B7791F;--ft-ba:#C53030}
@media (prefers-color-scheme:dark){ :root:not([data-theme="light"]) .ftw{--ft-a:#E58AA8;--ft-a2:#4A2632;--ft-c:#F3E3D6;--ft-cr:#2A211C} }
:root[data-theme="dark"] .ftw{--ft-a:#E58AA8;--ft-a2:#4A2632;--ft-c:#F3E3D6;--ft-cr:#2A211C}
.ftw .fthero{display:flex;gap:14px;align-items:center;background:linear-gradient(135deg,var(--ft-a2),var(--ft-cr));border:1px solid var(--line);border-radius:16px;padding:14px 16px}
.ftw .fthero h3{margin:0;font-family:"Playfair Display",Georgia,serif;font-style:italic;color:var(--ft-c);font-size:1.35rem}
.ftw .fthero p{margin:2px 0 0;color:var(--ft-c);opacity:.8;font-size:.9rem}
.ftw .ftmono{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:var(--ft-a);color:#fff;font-family:Georgia,serif;font-style:italic;font-size:1.3rem;flex:none}
.ftw .ftlogo{height:56px;max-width:110px;object-fit:contain;border-radius:12px;background:#fff;padding:3px;border:1px solid var(--line);flex:none}
.ftw .fttabs{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 4px}
.ftw .fttabs button{border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:999px;padding:6px 14px;font-weight:600;cursor:pointer}
.ftw .fttabs button[aria-selected="true"]{background:var(--ft-a);border-color:var(--ft-a);color:#fff}
.ftw .ftk{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.ftw .ftk .card{padding:12px 14px}
.ftw .ftk b{display:block;font-size:1.35rem;color:var(--ft-c)}
.ftw .ftk small{color:var(--muted)}
.ftw .chip{display:inline-block;border-radius:999px;padding:2px 9px;font-size:.78rem;font-weight:700;white-space:nowrap}
.ftw .c-ok{background:#E6F4EA;color:#22543D}.ftw .c-wa{background:#FEF3C7;color:#92400E}.ftw .c-ba{background:#FDE2E2;color:#9B2C2C}.ftw .c-na{background:var(--surface-2);color:var(--muted)}
.ftw table.ftt{width:100%;border-collapse:collapse;font-size:.9rem}
.ftw table.ftt th{text-align:left;font-size:.78rem;color:var(--muted);font-weight:700;border-bottom:1px solid var(--line);padding:6px 8px;white-space:nowrap;position:sticky;top:0;background:var(--surface)}
.ftw table.ftt td{border-bottom:1px solid var(--line);padding:6px 8px;vertical-align:top}
.ftw table.ftt td.n,.ftw table.ftt th.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.ftw table.ftt tr[data-fp]{cursor:pointer}.ftw table.ftt tr[data-fp]:hover td{background:var(--ft-cr)}
.ftw .ftbar{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin:6px 0 10px}
.ftw .ftbar label{display:flex;flex-direction:column;font-size:.78rem;color:var(--muted);gap:3px}
.ftw .ftbar input,.ftw .ftbar select{min-height:36px;border:1px solid var(--line);border-radius:10px;padding:4px 10px;background:var(--surface);color:var(--fg);font:inherit}
.ftw .ftin{width:96px;min-height:32px;border:1px solid var(--line);border-radius:8px;padding:2px 8px;text-align:right;font:inherit;background:var(--surface);color:var(--fg)}
.ftw .ftbtn{border:1px solid var(--ft-a);background:var(--ft-a);color:#fff;border-radius:10px;padding:7px 14px;font-weight:700;cursor:pointer}
.ftw .ftbtn.sec{background:transparent;color:var(--ft-a)}
.ftw .ftdet{border:1px solid var(--ft-a2);border-radius:14px;padding:14px;background:var(--surface)}
.ftw .ftdet h4{margin:0 0 4px;font-size:1.1rem;color:var(--ft-c)}
.ftw .ftmes td.h{font-weight:700;text-align:center}
.ftw .ftsub td{color:var(--muted);font-size:.85rem}
.ftw .ftnote{font-size:.85rem;color:var(--muted)}
.ftw .ftwarn{border-left:4px solid var(--ft-g);background:var(--ft-cr);padding:8px 12px;border-radius:8px;font-size:.88rem;color:var(--ft-c)}
.ftw .tw{overflow-x:auto}
@media (max-width:700px){ .ftw .hide-m{display:none} .ftw table.ftt{font-size:.84rem} .ftw .fthero h3{font-size:1.1rem} }
`; document.head.appendChild(st); }

/* ===== motor de custo ===== */
const baseUn = u => { u=nz(u).replace(/[^a-z]/g,""); if (/^(g|gr|grama|gramas)$/.test(u)) return ["g",1]; if (u==="kg"||u==="kgs") return ["g",1000];
  if (u==="ml") return ["ml",1]; if (u==="l"||u==="lt"||u==="litro") return ["ml",1000]; if (/^(m|metro|metros)$/.test(u)) return ["m",1]; return ["un",1]; };
function precosDoMes(mes){ // {ins:{id:[preco,qtd]}, venda:{id:preco}} com o último valor até o mês
  const out={ins:{},venda:{}}; const ms=Object.keys(F.hist).sort().filter(m=>!mes||m<=mes);
  for (const m of ms){ const h=F.hist[m]||{}; Object.assign(out.ins,h.ins||{}); Object.assign(out.venda,h.venda||{}); }
  return out; }
function motor(mes){ // devolve funções de custo para um mês (null = preços atuais)
  if (mes===mesAtual()) mes=null; const B=F.base, P=mes?precosDoMes(mes):null, insMap={}, fMap={};
  B.insumos.forEach(i=>{ const p=P&&P.ins[i.id]; insMap[i.id]={...i, preco:p?p[0]:i.preco, qtd:p?p[1]:i.qtd}; });
  B.fichas.forEach(f=>fMap[f.id]=f);
  const memo={};
  const unitIns = i => (i && i.qtd>0 && i.preco!=null) ? i.preco/i.qtd : null; // custo por g/ml/un
  function custo(fid, pilha=[]){ if (memo[fid]) return memo[fid]; const f=fMap[fid]; if (!f) return {total:null, pend:["receita não encontrada"], linhas:[]};
    if (pilha.includes(fid)) return {total:null, pend:["receita circular"], linhas:[]};
    let total=0; const pend=[], linhas=[];
    for (const it of f.itens||[]){ const [u,mult]=baseUn(it.un); const q=(+it.qtd||0); /* a quantidade está na unidade do insumo (como na planilha) */ let c=null, ok=true, uni=null, ref=null;
      if (it.ins){ const i=insMap[it.ins]; ref=i; uni=unitIns(i); if (uni==null || (uni===0 && !/agua/.test(nz(i&&i.nome)))) { ok=false; pend.push(it.n+" sem preço"); } else c=q*uni;
        const fam=x=>x==="ml"?"g":x; if (i && i.un && (fam(u)!==fam(i.un) || mult!==1) && !/agua/.test(nz(i.nome))) { pend.push(it.n+": unidade na ficha ("+it.un+") diferente do insumo ("+i.un+"), conferir"); } }
      else if (it.sub){ const s=custo(it.sub,[...pilha,fid]); const sf=fMap[it.sub]; ref=sf; const rg=sf&&sf.rend&&sf.rend.qtd>0?sf.rend.qtd*(baseUn(sf.rend.un)[1]):null;
        if (s.total==null||!rg) { ok=false; pend.push(it.n+" (receita) sem custo"); } else { uni=s.total/rg; c=q*uni; } if (s.pend.length) pend.push(...s.pend.map(p=>it.n+" › "+p)); }
      else { ok=false; if (!/agua/.test(nz(it.n))) pend.push(it.n+" não cadastrado"); else ok=true; }
      if (c!=null) total+=c; linhas.push({...it, q, u, uni, c, ok, ref}); }
    return memo[fid]={total, pend:[...new Set(pend)], linhas}; }
  function produto(f){ const c=custo(f.id); const v=f.venda||{}; const mult=v.mult||1; const rq=f.rend&&f.rend.qtd>0?f.rend.qtd:1;
    const cu = c.total!=null ? c.total/rq*mult : null; const pv = P && P.venda[f.id]!=null ? P.venda[f.id] : v.preco;
    const meta=(B.config&&B.config.cmv_meta)||0.30, div=1-somaMk(); const sug = cu!=null ? cu/meta : null; const sugC = cu!=null && div>0 && somaMk()>0 ? cu/div : null;
    const cmv = cu!=null && pv>0 ? cu/pv : null; return {f, custo:cu, preco:pv, cmv, mkp: cu>0&&pv>0?pv/cu:null, sug, sugC, margem: pv>0&&cu!=null?pv-cu:null, pend:c.pend, linhas:c.linhas, total:c.total, rq, mult}; }
  return {custo, produto, insMap, fMap};
}
const somaMk = () => { const c=(F.base&&F.base.config)||{}; const extra=(+c.impostos||0)+(+c.taxas||0)+(+c.fixas||0)+(+c.lucro||0); return extra>0 ? (+c.cmv_meta||0.30)+extra : 0; };
function status(r){ const meta=(F.base.config&&F.base.config.cmv_meta)||0.30;
  if (r.custo==null) return ["c-na","sem custo"]; if (!(r.preco>0)) return ["c-na","sem preço"];
  if (r.cmv<=meta) return ["c-ok","dentro da meta"]; if (r.cmv<=meta+0.07) return ["c-wa","atenção"]; return ["c-ba","acima da meta"]; }

/* ===== dados ===== */
async function carregarEmpresas(){ if (!bind()) return; try { const r=await sb.from("ft_base").select("empresa"); F.emps=new Set((r.data||[]).map(x=>nz(x.empresa))); } catch {} F.carregado=true; }
async function carregar(emp){ const [a,b]=await Promise.all([sb.from("ft_base").select("dados,atualizado_em").eq("empresa",emp).maybeSingle(), sb.from("ft_hist").select("mes,dados").eq("empresa",emp)]);
  F.emp=emp; F.base=a.data?a.data.dados:null; F.atu=a.data?a.data.atualizado_em:null; F.hist={}; (b.data||[]).forEach(h=>F.hist[h.mes]=h.dados); }
function snapshot(){ const B=F.base, ins={}, venda={}; B.insumos.forEach(i=>ins[i.id]=[i.preco,i.qtd]); B.fichas.forEach(f=>{ if (f.venda&&f.venda.preco!=null) venda[f.id]=f.venda.preco; }); return {ins,venda}; }
async function salvar(motivo, mes){ const B=F.base; B.atualizado={em:new Date().toISOString(), por:(S.perfil&&S.perfil.nome)||"", motivo};
  const m=mes||mesAtual(), snap=snapshot();
  const r1=await sb.from("ft_base").upsert({empresa:F.emp, dados:B, atualizado_em:new Date().toISOString()}); if (r1.error) { toast("Não foi possível salvar: "+r1.error.message); return false; }
  await sb.from("ft_hist").upsert({empresa:F.emp, mes:m, dados:snap, atualizado_em:new Date().toISOString()});
  F.hist[m]=snap; const hoje=new Date().toISOString().slice(0,10); // cópia de segurança: 1 por dia (as importações também guardam a versão anterior)
  if (F.verDia!==hoje) { F.verDia=hoje; sb.from("ft_base_versoes").insert({empresa:F.emp, dados:B, motivo}).then(()=>{}); }
  F.emps.add(nz(F.emp)); return true; }

/* ===== tela ===== */
async function renderFT(el, emp){ if (!bind()) return; css(); el.innerHTML=`<div class="card"><p class="note" style="margin:0">Carregando fichas técnicas…</p></div>`;
  if (F.emp!==emp || !F.base) { try { await carregar(emp); } catch(e){ el.innerHTML=`<div class="card">Não foi possível carregar as fichas.</div>`; return; } }
  desenha(el); }
function hero(){ const logo = VITAL.marcaDe ? VITAL.marcaDe(F.emp) : null; const B=F.base;
  return `<div class="fthero">${logo?`<img class="ftlogo" src="${logo}" alt="Logo ${esc(F.emp)}">`:`<div class="ftmono" aria-hidden="true">${esc(F.emp.split(/\s+/).filter(w=>w.length>2).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"✦")}</div>`}
    <div><h3>Fichas técnicas e preços · ${esc(F.emp)}</h3><p>Custo de cada receita, CMV, markup e preço sugerido, mês a mês. Meta de CMV: <b>${pct((B&&B.config&&B.config.cmv_meta)||0.30,0)}</b>${F.atu?` · atualizado em ${new Date(F.atu).toLocaleDateString("pt-BR")}`:""}</p></div></div>`; }
function desenha(el){ el=el||$("#ftRoot")&&$("#ftRoot").parentElement; if (!el) return;
  if (!F.base) { el.innerHTML=`<div class="ftw" id="ftRoot">${hero()}<div class="card" style="margin-top:12px"><p style="margin:0 0 8px"><b>Ainda não há fichas técnicas para este cliente.</b></p>
    <p class="ftnote" style="margin:0 0 10px">${eq()?"Importe a planilha de fichas técnicas (.xlsx). O portal lê os insumos, as receitas-base e os produtos e calcula o custo de tudo automaticamente.":"A equipe da Vital vai carregar as fichas técnicas aqui em breve."}</p>
    ${eq()?`<label class="ftbtn" style="display:inline-block">Importar planilha (.xlsx)<input type="file" id="ftImp" accept=".xlsx,.xlsm" hidden></label>`:""}</div></div>`; ligar(); return; }
  const tabs=[["geral","Visão geral"],["prod","Produtos"],["ins","Insumos"],["mes","Mês a mês"],["base","Receitas-base"]].concat(eq()?[["cfg","Configurar e importar"]]:[]);
  el.innerHTML=`<div class="ftw" id="ftRoot">${hero()}<nav class="fttabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" data-ftt="${k}" aria-selected="${F.tab===k}">${l}</button>`).join("")}</nav><div id="ftBody" class="stack"></div></div>`;
  corpo(); ligar(); }
function corpo(){ const b=$("#ftBody"); if (!b) return; b.innerHTML=({geral:vGeral, prod:vProd, ins:vIns, mes:vMes, base:vBase, cfg:vCfg})[F.tab](); ligar(); }

function produtosRows(mes){ const M=motor(mes); return F.base.fichas.filter(f=>f.tipo==="produto"&&f.ativo!==false).map(f=>M.produto(f)); }
function vGeral(){ const rows=produtosRows(null), meta=(F.base.config&&F.base.config.cmv_meta)||0.30;
  const comP=rows.filter(r=>r.cmv!=null), acima=comP.filter(r=>r.cmv>meta), semP=rows.filter(r=>!(r.preco>0)), semC=rows.filter(r=>r.pend.length);
  const med=comP.length?comP.reduce((s,r)=>s+r.cmv,0)/comP.length:null;
  const meses=mesesLista(); const serie=meses.map(m=>{ const rr=produtosRows(m).filter(r=>r.cmv!=null); return [m, rr.length?rr.reduce((s,r)=>s+r.cmv,0)/rr.length:null, rr.length]; });
  const alta=altasInsumos();
  const pior=[...comP].sort((a,b)=>b.cmv-a.cmv).slice(0,8);
  return `<div class="ftk">
    <div class="card"><small>Produtos com ficha</small><b>${rows.length}</b><small>${comP.length} com preço de venda</small></div>
    <div class="card"><small>CMV médio das fichas</small><b>${pct(med)}</b><small>meta ${pct(meta,0)}</small></div>
    <div class="card"><small>Acima da meta</small><b style="color:${acima.length?"var(--ft-ba)":"var(--ft-ok)"}">${acima.length}</b><small>de ${comP.length} produtos com preço</small></div>
    <div class="card"><small>Sem preço de venda</small><b>${semP.length}</b><small>cadastre para calcular o CMV</small></div>
    <div class="card"><small>Fichas com pendência</small><b style="color:${semC.length?"var(--ft-wa)":"var(--ft-ok)"}">${semC.length}</b><small>insumo sem preço ou não cadastrado</small></div></div>
    <div class="card"><h4 style="margin:0 0 6px">CMV médio das fichas, mês a mês</h4>${grafico(serie, meta)}<p class="ftnote" style="margin:6px 0 0">Média simples dos produtos com preço. Cada mês usa os preços de insumos e de venda registrados naquele mês. O CMV real da loja (compras ÷ faturamento) fica no Resumo do painel. A diferença entre os dois mostra desperdício, gramatura fora da ficha ou produtos sem ficha.</p></div>
    <div class="grid2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">
    <div class="card"><h4 style="margin:0 0 6px">Produtos com maior CMV</h4><div class="tw"><table class="ftt"><thead><tr><th>Produto</th><th class="n">Custo</th><th class="n">Preço</th><th class="n">CMV</th></tr></thead><tbody>${pior.map(r=>`<tr data-fp="${r.f.id}"><td>${esc(r.f.nome)}</td><td class="n">${brl(r.custo)}</td><td class="n">${brl(r.preco)}</td><td class="n"><span class="chip ${status(r)[0]}">${pct(r.cmv)}</span></td></tr>`).join("")||`<tr><td colspan="4" class="ftnote">Nenhum produto com preço ainda.</td></tr>`}</tbody></table></div></div>
    <div class="card"><h4 style="margin:0 0 6px">Insumos que mais subiram</h4>${alta.length?`<div class="tw"><table class="ftt"><thead><tr><th>Insumo</th><th class="n">Antes</th><th class="n">Agora</th><th class="n">Variação</th></tr></thead><tbody>${alta.slice(0,8).map(a=>`<tr><td>${esc(a.nome)}</td><td class="n">${brl(a.de)}</td><td class="n">${brl(a.para)}</td><td class="n"><span class="chip ${a.v>0?"c-ba":"c-ok"}">${a.v>0?"+":""}${pct(a.v)}</span></td></tr>`).join("")}</tbody></table></div>`:`<p class="ftnote" style="margin:0">Aparece a partir do segundo mês de preços registrados. A cada atualização de preço o portal guarda o valor do mês.</p>`}</div></div>`; }
function mesesLista(){ const ms=new Set(Object.keys(F.hist)); ms.add(mesAtual()); return [...ms].sort().slice(-12); }
function altasInsumos(){ const ms=Object.keys(F.hist).filter(m=>m<mesAtual()).sort(); if (!ms.length) return []; const a=precosDoMes(ms[ms.length-1]).ins, b={}; F.base.insumos.forEach(i=>b[i.id]=[i.preco,i.qtd]); const out=[];
  F.base.insumos.forEach(i=>{ const x=a[i.id], y=b[i.id]; if (!x||!y||!(x[1]>0)||!(y[1]>0)) return; const de=x[0]/x[1]*(i.qtd||1), para=y[0]/y[1]*(i.qtd||1); if (de>0 && Math.abs(para/de-1)>0.001) out.push({nome:i.nome, de, para, v:para/de-1}); });
  return out.sort((p,q)=>q.v-p.v); }
function grafico(serie, meta){ const W=640,H=190,pl=70,pb=24,pt=10; const vals=serie.map(s=>s[1]).filter(v=>v!=null); const mx=Math.max(meta*1.6, ...vals.map(v=>v*1.15), 0.1);
  const bw=(W-pl-10)/Math.max(serie.length,1); const y=v=>pt+(H-pt-pb)*(1-v/mx);
  const bars=serie.map((s,i)=>{ const x=pl+i*bw+bw*0.2, w=bw*0.6; if (s[1]==null) return `<text x="${x+w/2}" y="${H-pb-4}" font-size="10" text-anchor="middle" fill="currentColor" opacity=".5">–</text>`;
    const c=s[1]<=meta?"var(--ft-ok)":s[1]<=meta+0.07?"var(--ft-g)":"var(--ft-ba)"; return `<rect x="${x}" y="${y(s[1])}" width="${w}" height="${H-pb-y(s[1])}" rx="4" fill="${c}"><title>${mesC(s[0])}: CMV ${pct(s[1])} (${s[2]} produtos)</title></rect><text x="${x+w/2}" y="${y(s[1])-4}" font-size="11" text-anchor="middle" fill="currentColor">${pct(s[1],0)}</text>`; }).join("");
  const lab=serie.map((s,i)=>`<text x="${pl+i*bw+bw/2}" y="${H-6}" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">${mesC(s[0])}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;color:var(--fg)" role="img" aria-label="CMV médio por mês"><line x1="${pl}" x2="${W-6}" y1="${y(meta)}" y2="${y(meta)}" stroke="var(--ft-a)" stroke-dasharray="5 4"/><text x="${pl-4}" y="${y(meta)+4}" font-size="10" text-anchor="end" fill="var(--ft-a)">meta ${pct(meta,0)}</text>${bars}${lab}</svg>`; }

function vProd(){ const rows=produtosRows(null); const cats=[...new Set(rows.map(r=>r.f.cat||"Outros"))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const q=nz(F.f.q); let rr=rows.filter(r=>(!F.f.cat||r.f.cat===F.f.cat)&&(!q||nz(r.f.nome).includes(q)));
  if (F.f.st) rr=rr.filter(r=>status(r)[1]===F.f.st); rr.sort((a,b)=>(a.f.cat||"").localeCompare(b.f.cat||"","pt-BR")||a.f.nome.localeCompare(b.f.nome,"pt-BR"));
  const mk=somaMk()>0;
  const det=F.sel?detalhe(F.sel):"";
  return `<div class="ftbar"><label>Categoria<select id="ftCat"><option value="">Todas</option>${cats.map(c=>`<option ${c===F.f.cat?"selected":""}>${esc(c)}</option>`).join("")}</select></label>
    <label>Situação<select id="ftSt"><option value="">Todas</option>${["dentro da meta","atenção","acima da meta","sem preço","sem custo"].map(s=>`<option ${s===F.f.st?"selected":""}>${s}</option>`).join("")}</select></label>
    <label>Buscar<input id="ftQ" type="search" value="${esc(F.f.q)}" placeholder="Nome do produto"></label><span style="flex:1"></span><button class="ftbtn sec" id="ftCsv" type="button">Baixar CSV</button></div>
    ${det}
    <div class="card tw" style="padding:0"><table class="ftt"><thead><tr><th>Produto</th><th class="hide-m">Categoria</th><th class="n">Custo</th><th class="n">Preço</th><th class="n">CMV</th><th class="n hide-m">Markup</th><th class="n">Preço sugerido</th>${mk?`<th class="n hide-m">Sugerido (markup completo)</th>`:""}<th class="n hide-m">Margem R$</th></tr></thead>
    <tbody>${rr.map(r=>{ const [c,t]=status(r); return `<tr data-fp="${r.f.id}"><td>${esc(r.f.nome)}${r.pend.length?` <span class="chip c-wa" title="${esc(r.pend.join(" · "))}">⚠ ${r.pend.length}</span>`:""}${r.f.venda&&r.f.venda.un&&r.f.venda.un!=="un"?` <small class="ftnote">/${esc(r.f.venda.un)}</small>`:""}</td><td class="hide-m">${esc(r.f.cat||"")}</td><td class="n">${brl(r.custo)}</td><td class="n">${brl(r.preco)}</td><td class="n"><span class="chip ${c}" title="${t}">${r.cmv!=null?pct(r.cmv):t}</span></td><td class="n hide-m">${r.mkp?n2(r.mkp)+"×":"–"}</td><td class="n">${brl(r.sug)}</td>${mk?`<td class="n hide-m">${brl(r.sugC)}</td>`:""}<td class="n hide-m">${brl(r.margem)}</td></tr>`; }).join("")||`<tr><td colspan="9" class="ftnote">Nenhum produto neste filtro.</td></tr>`}</tbody></table></div>
    <p class="ftnote">Toque no produto para ver a receita, o custo de cada ingrediente, simular um novo preço e ver a evolução mês a mês. <b>Preço sugerido</b> = custo ÷ meta de CMV (${pct((F.base.config&&F.base.config.cmv_meta)||0.30,0)}), o mesmo que markup de ${n2(1/((F.base.config&&F.base.config.cmv_meta)||0.30))}×.</p>`; }
function detalhe(id){ const M=motor(null), f=M.fMap[id]; if (!f) return ""; const r=f.tipo==="produto"?M.produto(f):null, c=M.custo(id); const meta=(F.base.config&&F.base.config.cmv_meta)||0.30;
  const linhas=c.linhas.map(l=>`<tr><td>${esc(l.n)}${l.sub?` <small class="ftnote">(receita)</small>`:""}${!l.ok?` <span class="chip c-wa">sem custo</span>`:""}</td><td class="n">${n2(+l.qtd,3)} ${esc(l.un||"")}</td><td class="n hide-m">${l.uni!=null?brl(l.uni*({g:1000,ml:1000}[l.u]||1))+"/"+({g:"kg",ml:"L"}[l.u]||l.u):"–"}</td><td class="n">${brl(l.c)}</td><td class="n hide-m">${c.total>0&&l.c!=null?pct(l.c/c.total):"–"}</td></tr>`).join("");
  const sim=F.sim[id]; const simCmv = r&&sim>0&&r.custo!=null ? r.custo/sim : null;
  const hist = r ? mesesLista().map(m=>{ const x=motor(m).produto(f); return [m,x]; }) : [];
  const edit=true;
  return `<div class="ftdet" id="ftDet"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><h4>${esc(f.nome)}</h4><div class="ftnote">${esc(f.cat||"")} · rende ${n2(f.rend&&f.rend.qtd,3)} ${esc(f.rend&&f.rend.un||"")}${r&&r.mult>1?` · vendido por ${esc(f.venda.un)} (${r.mult} un)`:""}${f.peso_g?` · peso final ${n2(f.peso_g,0)} g`:""}</div></div><button class="ftbtn sec" type="button" id="ftFecha">Fechar</button></div>
    ${c.pend.length?`<p class="ftwarn" style="margin:8px 0">⚠ ${c.pend.map(esc).join(" · ")}</p>`:""}
    ${r?`<div class="ftk" style="margin:10px 0"><div class="card"><small>Custo ${r.mult>1?"por "+esc(f.venda.un):"por unidade"}</small><b>${brl(r.custo)}</b></div>
      <div class="card"><small>Preço de venda</small><b>${brl(r.preco)}</b>${edit?`<small><input class="ftin" id="ftPv" inputmode="decimal" value="${r.preco!=null?n2(r.preco):""}" aria-label="Novo preço de venda"> <button class="ftbtn" type="button" id="ftPvS" style="padding:4px 10px">Salvar</button></small>`:""}</div>
      <div class="card"><small>CMV</small><b><span class="chip ${status(r)[0]}" style="font-size:1rem">${pct(r.cmv)}</span></b><small>meta ${pct(meta,0)}</small></div>
      <div class="card"><small>Markup aplicado</small><b>${r.mkp?n2(r.mkp)+"×":"–"}</b><small>ideal ${n2(1/meta)}×</small></div>
      <div class="card"><small>Preço sugerido</small><b>${brl(r.sug)}</b><small>${r.preco>0&&r.sug?(r.sug>r.preco?"+"+pct(r.sug/r.preco-1)+" sobre o atual":"preço atual já cobre a meta"):""}</small></div></div>
      <div class="card" style="margin-bottom:10px"><b>Simular preço</b> <input class="ftin" id="ftSim" inputmode="decimal" value="${sim?n2(sim):""}" placeholder="R$"> ${simCmv!=null?`→ CMV <span class="chip ${simCmv<=meta?"c-ok":simCmv<=meta+0.07?"c-wa":"c-ba"}">${pct(simCmv)}</span> · margem ${brl(sim-r.custo)} · markup ${n2(sim/r.custo)}×`:`<span class="ftnote">digite um preço para ver o CMV</span>`}</div>`:`<p class="ftnote">Receita-base: custo total ${brl(c.total)} · ${f.rend&&f.rend.qtd?brl(c.total/(f.rend.qtd*baseUn(f.rend.un)[1])*1000)+" por kg":""}</p>`}
    <div class="tw"><table class="ftt"><thead><tr><th>Ingrediente</th><th class="n">Qtd</th><th class="n hide-m">Preço</th><th class="n">Custo</th><th class="n hide-m">% do custo</th></tr></thead><tbody>${linhas}<tr><td><b>Total da receita</b></td><td></td><td class="hide-m"></td><td class="n"><b>${brl(c.total)}</b></td><td class="hide-m"></td></tr></tbody></table></div>
    ${hist.length>1?`<div class="tw" style="margin-top:10px"><table class="ftt ftmes"><thead><tr><th>Mês</th>${hist.map(h=>`<th class="n">${mesC(h[0])}</th>`).join("")}</tr></thead><tbody><tr><td>Custo</td>${hist.map(h=>`<td class="n">${brl(h[1].custo)}</td>`).join("")}</tr><tr><td>Preço</td>${hist.map(h=>`<td class="n">${brl(h[1].preco)}</td>`).join("")}</tr><tr><td>CMV</td>${hist.map(h=>`<td class="n"><span class="chip ${status(h[1])[0]}">${pct(h[1].cmv)}</span></td>`).join("")}</tr></tbody></table></div>`:""}
    ${f.preparo&&f.preparo.length?`<details style="margin-top:10px"><summary><b>Modo de preparo</b></summary><ol class="ftnote">${f.preparo.map(p=>`<li>${esc(p.replace(/^\d+\s*[-–.)]\s*/,""))}</li>`).join("")}</ol></details>`:""}</div>`; }

function vIns(){ const M=motor(null); const uso={}; F.base.fichas.forEach(f=>(f.itens||[]).forEach(it=>{ const k=it.ins||(it.sub&&"s:"+it.sub); if (k) (uso[k]=uso[k]||new Set()).add(f.id); }));
  const ms=Object.keys(F.hist).filter(m=>m<mesAtual()).sort(), ant=ms.length?precosDoMes(ms[ms.length-1]).ins:{};
  const q=nz(F.fi.q); let L=F.base.insumos.filter(i=>!q||nz(i.nome).includes(q));
  if (F.fi.st==="sem") L=L.filter(i=>!(i.preco>0)&&!/agua/.test(nz(i.nome))); if (F.fi.st==="emb") L=L.filter(i=>/embal/i.test(i.cat||""));
  L.sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  const sem=F.base.insumos.filter(i=>!(i.preco>0)&&!/agua/.test(nz(i.nome))).length, naoCad=pendNaoCad();
  return `<div class="ftbar"><label>Buscar<input id="ftQi" type="search" value="${esc(F.fi.q)}" placeholder="Nome do insumo"></label><label>Mostrar<select id="ftSi"><option value="">Todos (${F.base.insumos.length})</option><option value="sem" ${F.fi.st==="sem"?"selected":""}>Sem preço (${sem})</option><option value="emb" ${F.fi.st==="emb"?"selected":""}>Embalagens</option></select></label><span style="flex:1"></span>${eq()?`<button class="ftbtn sec" type="button" id="ftNovoIns">+ Novo insumo</button>`:""}<button class="ftbtn" type="button" id="ftSalvaIns">Salvar preços</button></div>
    ${naoCad.length?`<p class="ftwarn">⚠ ${naoCad.length} ingrediente(s) usados nas fichas ainda não estão cadastrados como insumo: ${naoCad.slice(0,12).map(esc).join(", ")}${naoCad.length>12?"…":""}. ${eq()?"Cadastre com “+ Novo insumo” usando o mesmo nome.":""}</p>`:""}
    <div class="card tw" style="padding:0"><table class="ftt"><thead><tr><th>Insumo</th><th class="hide-m">Tipo</th><th class="n">Embalagem</th><th class="n">Preço da embalagem</th><th class="n">Custo por kg/L/un</th><th class="n hide-m">Mês anterior</th><th class="n hide-m">Fichas</th></tr></thead><tbody>
    ${L.map(i=>{ const a=ant[i.id]; let cu=i.qtd>0&&i.preco!=null?i.preco/i.qtd*({g:1000,ml:1000}[i.un]||1):null; if (i.ficha){ const sf=M.fMap[i.ficha], c=M.custo(i.ficha), rg=sf&&sf.rend&&sf.rend.qtd?sf.rend.qtd*baseUn(sf.rend.un)[1]:null; cu=c.total!=null&&rg?c.total/rg*1000:null; } const ca=a&&a[1]>0?a[0]/a[1]*({g:1000,ml:1000}[i.un]||1):null; const v=ca&&cu?cu/ca-1:null;
      return `<tr><td>${esc(i.nome)}${i.ficha?` <small class="ftnote">(receita)</small>`:""}</td><td class="hide-m">${esc(i.cat||"")}</td><td class="n">${i.ficha?"–":`<input class="ftin" data-iq="${i.id}" inputmode="decimal" value="${n2(i.qtd,3)}" style="width:80px"> ${esc(i.un)}`}</td><td class="n">${i.ficha?`<span class="ftnote">vem da receita</span>`:`<input class="ftin" data-ip="${i.id}" inputmode="decimal" value="${i.preco!=null?n2(i.preco):""}" placeholder="R$">`}</td><td class="n">${brl(cu)}${{g:"/kg",ml:"/L"}[i.un]||"/"+esc(i.un)}</td><td class="n hide-m">${v!=null&&Math.abs(v)>0.001?`<span class="chip ${v>0?"c-ba":"c-ok"}">${v>0?"+":""}${pct(v)}</span>`:"–"}</td><td class="n hide-m">${(uso[i.id]||uso["s:"+i.ficha]||{size:0}).size}</td></tr>`; }).join("")}</tbody></table></div>
    <p class="ftnote">Mude o preço quando comprar mais caro ou mais barato e toque em <b>Salvar preços</b>. Todas as fichas que usam o insumo são recalculadas na hora, e o portal guarda o preço do mês para o acompanhamento mês a mês.</p>`; }
function pendNaoCad(){ const s=new Set(); F.base.fichas.forEach(f=>(f.itens||[]).forEach(it=>{ if (!it.ins&&!it.sub&&!/agua/.test(nz(it.n))) s.add(it.n); })); return [...s].sort((a,b)=>a.localeCompare(b,"pt-BR")); }

function vMes(){ const ms=mesesLista(); const rows=F.base.fichas.filter(f=>f.tipo==="produto"&&f.ativo!==false&&f.venda&&f.venda.preco>0);
  const Ms=ms.map(m=>motor(m)); const q=nz(F.f.q);
  const L=rows.filter(f=>!q||nz(f.nome).includes(q)).sort((a,b)=>(a.cat||"").localeCompare(b.cat||"","pt-BR")||a.nome.localeCompare(b.nome,"pt-BR"));
  return `<div class="ftbar"><label>Buscar<input id="ftQ" type="search" value="${esc(F.f.q)}" placeholder="Nome do produto"></label><span style="flex:1"></span>${eq()?`<button class="ftbtn sec" type="button" id="ftFechar">Registrar preços de ${mesC(mesAtual())}</button>`:""}</div>
    ${ms.length<2?`<p class="ftwarn">O acompanhamento começa em ${mesC(ms[0])}. A partir do próximo mês, cada atualização de preço entra numa nova coluna e dá para ver o CMV de cada produto subir ou descer.</p>`:""}
    <div class="card tw" style="padding:0"><table class="ftt ftmes"><thead><tr><th>Produto · CMV</th>${ms.map(m=>`<th class="n">${mesC(m)}</th>`).join("")}<th class="n">Variação</th></tr></thead><tbody>
    ${L.map(f=>{ const xs=Ms.map(M=>M.produto(f)); const a=xs.find(x=>x.cmv!=null), z=[...xs].reverse().find(x=>x.cmv!=null); const v=a&&z&&a!==z?z.cmv-a.cmv:null;
      return `<tr data-fp="${f.id}"><td>${esc(f.nome)}</td>${xs.map(x=>`<td class="n"><span class="chip ${status(x)[0]}">${pct(x.cmv)}</span></td>`).join("")}<td class="n">${v!=null?`${v>0?"▲ +":"▼ "}${n2(v*100,1)} p.p.`:"–"}</td></tr>`; }).join("")}</tbody></table></div>
    <p class="ftnote">p.p. = pontos percentuais. Cada coluna usa os preços de insumos e de venda daquele mês.</p>`; }

function vBase(){ const M=motor(null); const L=F.base.fichas.filter(f=>f.tipo==="base").sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  const usos=id=>F.base.fichas.filter(f=>(f.itens||[]).some(it=>it.sub===id)).length; const det=F.sel&&M.fMap[F.sel]&&M.fMap[F.sel].tipo==="base"?detalhe(F.sel):"";
  return `${det}<div class="card tw" style="padding:0"><table class="ftt"><thead><tr><th>Receita-base (massas, recheios, cremes)</th><th class="n">Rendimento</th><th class="n">Custo total</th><th class="n">Custo por kg</th><th class="n hide-m">Usada em</th></tr></thead><tbody>
    ${L.map(f=>{ const c=M.custo(f.id), rg=f.rend&&f.rend.qtd?f.rend.qtd*baseUn(f.rend.un)[1]:null; return `<tr data-fp="${f.id}"><td>${esc(f.nome)}${c.pend.length?` <span class="chip c-wa" title="${esc(c.pend.join(" · "))}">⚠ ${c.pend.length}</span>`:""}</td><td class="n">${n2(f.rend&&f.rend.qtd,3)} ${esc(f.rend&&f.rend.un||"")}</td><td class="n">${brl(c.total)}</td><td class="n">${c.total!=null&&rg?brl(c.total/rg*1000):"–"}</td><td class="n hide-m">${usos(f.id)} produto(s)</td></tr>`; }).join("")}</tbody></table></div>
    <p class="ftnote">O custo por kg da receita-base entra automaticamente nos produtos que a usam.</p>`; }

function vCfg(){ const c=F.base.config||{}; const imp=F.base.importacao||{};
  return `<div class="card"><h4 style="margin:0 0 8px">Metas de precificação</h4><div class="ftbar">
    <label>Meta de CMV (%)<input class="ftin" id="cfMeta" inputmode="decimal" value="${n2((c.cmv_meta||0.30)*100,1)}"></label>
    <label>Impostos sobre a venda (%)<input class="ftin" id="cfImp" inputmode="decimal" value="${n2((c.impostos||0)*100,1)}"></label>
    <label>Taxas de cartão e app (%)<input class="ftin" id="cfTax" inputmode="decimal" value="${n2((c.taxas||0)*100,1)}"></label>
    <label>Despesas fixas (% da receita)<input class="ftin" id="cfFix" inputmode="decimal" value="${n2((c.fixas||0)*100,1)}"></label>
    <label>Lucro desejado (%)<input class="ftin" id="cfLuc" inputmode="decimal" value="${n2((c.lucro||0)*100,1)}"></label>
    <button class="ftbtn" type="button" id="cfSalva">Salvar metas</button></div>
    <p class="ftnote" style="margin:0">Com só a meta de CMV, o preço sugerido é custo ÷ meta. Se preencher impostos, taxas, despesas fixas e lucro, aparece também o <b>markup completo</b>: preço = custo ÷ (1 − CMV − impostos − taxas − fixas − lucro)${somaMk()>=1?` <b style="color:var(--ft-ba)">· a soma passou de 100%, revise os percentuais</b>`:""}.</p></div>
    <div class="card"><h4 style="margin:0 0 8px">Importar planilha de fichas técnicas</h4>
    <p class="ftnote" style="margin:0 0 8px">Lê a aba <b>Insumos</b> e uma aba por ficha (Nome do produto, Ingredientes, Unidade, Quantidade, Preço de venda). Os preços que já foram atualizados pelo portal são mantidos quando o insumo tem o mesmo nome; o resto vem da planilha. Antes de trocar, o portal guarda uma cópia da versão atual.</p>
    ${imp.arquivo?`<p class="ftnote" style="margin:0 0 8px">Última importação: <b>${esc(imp.arquivo)}</b> em ${new Date(imp.em).toLocaleString("pt-BR")}${imp.por?" por "+esc(imp.por):""} · ${imp.resumo?esc(imp.resumo):""}</p>`:""}
    <label class="ftbtn" style="display:inline-block">Importar planilha (.xlsx)<input type="file" id="ftImp" accept=".xlsx,.xlsm" hidden></label>
    <label style="margin-left:10px;font-size:.88rem"><input type="checkbox" id="ftImpPlan"> usar os preços da planilha mesmo onde o portal tem preço mais novo</label></div>
    ${imp.avisos&&imp.avisos.length?`<div class="card"><h4 style="margin:0 0 6px">Pontos para revisar na planilha</h4><ul class="ftnote" style="margin:0">${imp.avisos.slice(0,60).map(a=>`<li>${esc(a)}</li>`).join("")}</ul>${imp.avisos.length>60?`<p class="ftnote">e mais ${imp.avisos.length-60}…</p>`:""}</div>`:""}`; }

/* ===== eventos ===== */
const num = s => { s=String(s||"").trim().replace(/[R$\s]/g,""); if (!s) return null; if (s.includes(",")) s=s.replace(/\./g,"").replace(",","."); const v=parseFloat(s); return isFinite(v)?v:null; };
function ligar(){ const R=$("#ftRoot"); if (!R) return;
  R.querySelectorAll("[data-ftt]").forEach(b=>b.onclick=()=>{ F.tab=b.dataset.ftt; F.sel=null; R.querySelectorAll("[data-ftt]").forEach(x=>x.setAttribute("aria-selected",x===b)); corpo(); });
  R.querySelectorAll("[data-fp]").forEach(t=>t.onclick=()=>{ F.sel=t.dataset.fp; const f=F.base.fichas.find(x=>x.id===F.sel); if (f&&f.tipo==="base"&&F.tab!=="base") F.tab="base"; else if (f&&f.tipo==="produto"&&F.tab!=="prod") F.tab="prod"; desenha(); setTimeout(()=>{ const d=$("#ftDet"); d&&d.scrollIntoView({behavior:"smooth",block:"start"}); },30); });
  const on=(id,ev,fn)=>{ const e=$(id); if (e) e[ev]=fn; };
  on("#ftFecha","onclick",()=>{ F.sel=null; corpo(); });
  on("#ftCat","onchange",e=>{ F.f.cat=e.target.value; corpo(); }); on("#ftSt","onchange",e=>{ F.f.st=e.target.value; corpo(); });
  on("#ftQ","oninput",e=>{ F.f.q=e.target.value; clearTimeout(F.tq); F.tq=setTimeout(()=>{ corpo(); const q=$("#ftQ"); if(q){ q.focus(); q.setSelectionRange(q.value.length,q.value.length);} },350); });
  on("#ftQi","oninput",e=>{ F.fi.q=e.target.value; clearTimeout(F.tq); F.tq=setTimeout(()=>{ corpo(); const q=$("#ftQi"); if(q){ q.focus(); q.setSelectionRange(q.value.length,q.value.length);} },350); });
  on("#ftSi","onchange",e=>{ F.fi.st=e.target.value; corpo(); });
  on("#ftSim","onchange",e=>{ F.sim[F.sel]=num(e.target.value); corpo(); });
  on("#ftPvS","onclick",async()=>{ const v=num($("#ftPv").value); const f=F.base.fichas.find(x=>x.id===F.sel); if (!f) return; f.venda=f.venda||{mult:1,un:"un"}; f.venda.preco=v; f.venda.portal=true; if (await salvar("preço de venda: "+f.nome)) { toast("Preço salvo."); corpo(); } });
  on("#ftSalvaIns","onclick",async()=>{ let n=0; R.querySelectorAll("[data-ip]").forEach(inp=>{ const i=F.base.insumos.find(x=>x.id===inp.dataset.ip); const v=num(inp.value); if (i && v!==i.preco && !(v==null&&i.preco==null)) { i.preco=v; i.atualizado_portal=true; i.atual=new Date().toISOString().slice(0,10); n++; } });
    R.querySelectorAll("[data-iq]").forEach(inp=>{ const i=F.base.insumos.find(x=>x.id===inp.dataset.iq); const v=num(inp.value); if (i && v>0 && v!==i.qtd) { i.qtd=v; i.atualizado_portal=true; n++; } });
    if (!n) { toast("Nenhum preço mudou."); return; } if (await salvar(n+" preço(s) de insumo")) { toast(n+" alteração(ões) salvas. As fichas foram recalculadas."); corpo(); } });
  on("#ftNovoIns","onclick",async()=>{ const nome=prompt("Nome do insumo (igual ao da ficha):"); if (!nome) return; const un=(prompt("Unidade: g, ml, un ou m","g")||"g").trim().toLowerCase(); const qtd=num(prompt("Quantidade na embalagem (ex.: 1000)","1000")); const preco=num(prompt("Preço da embalagem (R$)",""));
    const i={id:uid(), nome:nome.trim(), un:baseUn(un)[0], qtd:qtd||1, preco, cat:"Matéria-prima", atual:new Date().toISOString().slice(0,10)}; F.base.insumos.push(i);
    F.base.fichas.forEach(f=>(f.itens||[]).forEach(it=>{ if (!it.ins&&!it.sub&&nz(it.n)===nz(i.nome)) it.ins=i.id; }));
    if (await salvar("novo insumo: "+i.nome)) { toast("Insumo cadastrado."); corpo(); } });
  on("#ftFechar","onclick",async()=>{ if (await salvar("registro do mês "+mesC(mesAtual()))) { toast("Preços de "+mesC(mesAtual())+" registrados."); corpo(); } });
  on("#ftCsv","onclick",()=>{ const rows=produtosRows(null); const L=[["Produto","Categoria","Custo","Preço","CMV %","Markup","Preço sugerido","Pendências"]].concat(rows.map(r=>[r.f.nome,r.f.cat||"",r.custo,r.preco,r.cmv!=null?r.cmv*100:"",r.mkp,r.sug,r.pend.join(" | ")]));
    const csv="﻿"+L.map(l=>l.map(v=>typeof v==="number"?String(Math.round(v*100)/100).replace(".",","):'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\n"); const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="fichas-"+nz(F.emp).replace(/\s+/g,"-")+"-"+mesAtual()+".csv"; a.click(); });
  on("#cfSalva","onclick",async()=>{ const g=id=>{ const v=num($(id).value); return v==null?0:v/100; }; F.base.config={cmv_meta:g("#cfMeta")||0.30, impostos:g("#cfImp"), taxas:g("#cfTax"), fixas:g("#cfFix"), lucro:g("#cfLuc")}; if (await salvar("metas de precificação")) { toast("Metas salvas."); desenha(); } });
  on("#ftImp","onchange",e=>{ const f=e.target.files[0]; if (f) importar(f, $("#ftImpPlan")&&$("#ftImpPlan").checked); });
}

/* ===== importação da planilha (SheetJS) ===== */
function xlsxLib(){ if (window.XLSX) return Promise.resolve(window.XLSX); return new Promise((ok,er)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload=()=>ok(window.XLSX); s.onerror=er; document.head.appendChild(s); }); }
const PULA = ["fichas","fichas bolos","menu rapido","insumos","itens sem custo"];
function lerPlanilha(XLSX, wb){ const avisos=[]; const sh=n=>wb.Sheets[n]; const cel=(ws,r,c)=>ws[XLSX.utils.encode_cell({r:r-1,c:c-1})];
  const v=(ws,r,c)=>{ const x=cel(ws,r,c); return x?x.v:null; }, fm=(ws,r,c)=>{ const x=cel(ws,r,c); return x&&x.f?String(x.f):null; };
  const rng=ws=>XLSX.utils.decode_range(ws["!ref"]||"A1:A1");
  const acha=(ws,t)=>{ const R=rng(ws), q=nz(t); for (let r=R.s.r+1;r<=Math.min(R.e.r+1,120);r++) for (let c=R.s.c+1;c<=Math.min(R.e.c+1,40);c++){ const x=v(ws,r,c); if (typeof x==="string"&&nz(x).startsWith(q)) return [r,c]; } return null; };
  const numero=x=>typeof x==="number"?x:(typeof x==="string"&&/[\d]/.test(x)?parseFloat(x.replace(/\./g,"").replace(",",".").replace(/[^\d.]/g,""))||null:null);
  // insumos
  const wsI=sh(wb.SheetNames.find(n=>nz(n)==="insumos")); if (!wsI) throw new Error("A planilha não tem a aba Insumos.");
  const hI=acha(wsI,"Descrição")||acha(wsI,"Descricao")||[2,2]; const insumos=[]; const RI=rng(wsI);
  for (let r=hI[0]+1;r<=RI.e.r+1;r++){ const nome=v(wsI,r,hI[1]); if (!nome||!String(nome).trim()) continue; const f=fm(wsI,r,hI[1]+3); let link=null;
    if (f){ const m=f.match(/^'?([^'!]+)'?!/); if (m) link=m[1]; }
    const unT=String(v(wsI,r,hI[1]+1)||""), qtd=numero(v(wsI,r,hI[1]+2)), preco=numero(v(wsI,r,hI[1]+3)); const tipo=String(v(wsI,r,hI[1]+4)||""), det=String(v(wsI,r,hI[1]+5)||"");
    const at=v(wsI,r,hI[1]+6); insumos.push({id:uid(), nome:String(nome).trim(), un:baseUn(unT)[0], qtd:qtd||1, preco:link?null:preco, cat:/embal/i.test(det)?"Embalagem":/pb/i.test(tipo)?"Receita":"Matéria-prima", det:det&&!/embal/i.test(det)?det:"", atual:at instanceof Date?at.toISOString().slice(0,10):(typeof at==="number"&&at>40000?new Date(Date.UTC(1899,11,30)+at*864e5).toISOString().slice(0,10):""), linkAba:link});
    if (!link && !(preco>0) && !/agua/.test(nz(nome))) avisos.push("Insumo sem preço: "+nome); }
  // categorias do Menu rápido
  const cats={}; const wsM=sh(wb.SheetNames.find(n=>nz(n)==="menu rapido"));
  if (wsM){ const R=rng(wsM); let cat=null; for (let r=1;r<=R.e.r+1;r++){ const b=v(wsM,r,2); if (typeof b==="string"&&/\(\d+\)\s*$/.test(b)) { cat=b.replace(/\s*\(\d+\)\s*$/,"").replace(/^[^\p{L}]+/u,"").trim(); continue; } if (!cat) continue; for (let c=2;c<=12;c++){ const x=v(wsM,r,c); if (typeof x==="string"&&x.trim()) cats[nz(x)]=cat; } } }
  // fichas
  const fichas=[];
  for (const aba of wb.SheetNames){ if (PULA.includes(nz(aba))) continue; const ws=sh(aba); const h=acha(ws,"Ingredientes"); if (!h) { avisos.push("Aba sem tabela de ingredientes: "+aba); continue; }
    const [r0,c0]=h; const np=acha(ws,"Nome do produto"); const nome=String((np&&v(ws,np[0],np[1]+1))||aba).trim();
    const ru=acha(ws,"Rendimento un"), rk=acha(ws,"Rendimento total"); const rendTxt=String((ru&&v(ws,ru[0],ru[1]+1))||"").trim(), rendG=rk?v(ws,rk[0],rk[1]+1):null;
    const lab=t=>{ const p=acha(ws,t); if (!p) return null; for (const dc of [1,2]) { const x=v(ws,p[0],p[1]+dc); if (typeof x==="number") return x; } return null; };
    const itens=[]; let r=r0+1;
    while (r<r0+45){ const n=v(ws,r,c0); if (n==null||String(n).trim()==="") { if (v(ws,r+1,c0)==null) break; r++; continue; } if (/^preparo/.test(nz(n))) break;
      itens.push({n:String(n).trim(), un:String(v(ws,r,c0+1)||"").trim(), qtd:numero(v(ws,r,c0+2))||0, cp:typeof v(ws,r,c0+3)==="number"?v(ws,r,c0+3):null}); r++; }
    const qp=lab("Quantidade produzida"), pvL=lab("Preço de venda")||lab("Preco de venda"), temCento=!!acha(ws,"Custo cento"), ct=lab("Custo total");
    let pv=pvL; if (pv==null){ for (let rr=8;rr<=20;rr++){ const f=fm(ws,rr,10); if (f&&/^J\d+\/J\d+$/.test(f.replace(/\s/g,""))) { const [, b]=f.match(/J(\d+)/g).map(x=>+x.slice(1)); const vb=v(ws,b,10), va=v(ws,rr,10); if (typeof vb==="number"&&vb>=10&&typeof va==="number"&&va>0&&va<1.2) pv=vb; } } }
    const prep=[]; const pp=acha(ws,"Preparo"); if (pp) for (let rr=pp[0]+1;rr<pp[0]+25;rr++){ const t=v(ws,rr,pp[1]); if (t) prep.push(String(t).trim()); }
    const m1=rendTxt.match(/\d+(?:[.,]\d+)?/); const rq=m1?parseFloat(m1[0].replace(",",".")):null; if (/\bse for\b|\/\s*se\b/i.test(rendTxt)) avisos.push(aba+": a ficha tem duas versões no mesmo rendimento (“"+rendTxt.slice(0,60)+"”); separe em duas fichas"); let peso=null; const pg=numero(rendG); if (pg) peso=/kg/i.test(String(rendG))?pg*1000:pg; else { const m=rendTxt.match(/(\d+[\d.,]*)\s*g\b/i); if (m) peso=numero(m[1]); }
    const cat=cats[nz(aba)]||cats[nz(nome)]||null;
    fichas.push({id:uid(), aba, nome, cat, itens, prep, rendTxt, rq, qp, pv, temCento, ct, peso}); }
  // tipo de cada ficha: base (aparece como insumo com link ou na categoria massas/recheios) ou produto
  const porAba={}; fichas.forEach(f=>porAba[nz(f.aba)]=f);
  const baseIds=new Set(); insumos.forEach(i=>{ if (i.linkAba){ const f=porAba[nz(i.linkAba)]; if (f) { baseIds.add(f.id); i.ficha=f.id; } else avisos.push("Insumo "+i.nome+" aponta para a aba “"+i.linkAba+"”, que não existe."); } });
  fichas.forEach(f=>{ if (/cremes|recheio|massa/i.test(f.cat||"")) baseIds.add(f.id); });
  const insPorNome={}; insumos.forEach(i=>insPorNome[nz(i.nome)]=i); const fPorNome={}; fichas.forEach(f=>{ fPorNome[nz(f.nome)]=f; fPorNome[nz(f.aba)]=f; });
  const final=fichas.map(f=>{ const tipo=baseIds.has(f.id)?"base":"produto";
    const itens=f.itens.map(it=>{ const i=insPorNome[nz(it.n)]; let o={n:it.n, un:it.un, qtd:it.qtd};
      if (i && i.ficha) o.sub=i.ficha; else if (i) o.ins=i.id; else if (fPorNome[nz(it.n)]) { o.sub=fPorNome[nz(it.n)].id; baseIds.add(o.sub); } else if (!/agua/.test(nz(it.n))) { const sg=parecido(it.n, insumos); avisos.push(f.aba+": “"+it.n+"” não está na aba Insumos"+(sg?" (parece com “"+sg+"”)":"")); }
      return o; });
    let rend, venda=null;
    if (tipo==="base"){ const kg=f.qp>0?f.qp:(f.peso?f.peso/1000:null); rend=kg?{qtd:kg,un:"kg"}:{qtd:1,un:"kg"}; if (!kg) avisos.push(f.aba+": receita-base sem quantidade produzida (considerei 1 kg)"); }
    else { const q=f.rq||f.qp||1; rend={qtd:q, un:"un"}; const cento=f.temCento||(q>=100&&f.pv>=50); venda={preco:f.pv||null, mult:cento?100:1, un:cento?"cento":"un"}; if (!f.pv) avisos.push(f.aba+": sem preço de venda na ficha"); }
    let cat=f.cat; if (!cat){ const m=f.aba.match(/^bolo\s*([\d,]+)\s*kg/i)||f.nome.match(/^bolo\s*([\d,]+)\s*kg/i); cat = m?"Bolos "+m[1].replace(".",",")+" kg":/^bolo\s*500/i.test(f.aba)?"Bolos 500 g":tipo==="base"?(/massa/i.test(f.aba)?"Massas":"Cremes e recheios"):/bolo/i.test(f.aba)?"Outros bolos":"Outros"; }
    return {id:f.id, aba:f.aba, nome:f.nome, cat, tipo, rend, venda, peso_g:f.peso||null, itens, preparo:f.prep, cmv_planilha:null, custo_planilha:f.ct}; });
  final.forEach(f=>{ if (baseIds.has(f.id)&&f.tipo!=="base") { f.tipo="base"; f.venda=null; } });
  insumos.forEach(i=>{ delete i.linkAba; });
  return {insumos, fichas:final, avisos:[...new Set(avisos)]}; }
function parecido(n, insumos){ const tk=t=>new Set(nz(t).replace(/[^a-z0-9 ]/g," ").split(" ").filter(w=>w.length>1&&!["de","com","p","g","pra","para"].includes(w)));
  const a=tk(n); let best=null, bs=0; for (const i of insumos){ const b=tk(i.nome); const inter=[...a].filter(x=>b.has(x)||[...b].some(y=>y.startsWith(x.slice(0,5))&&x.length>4)).length; const sc=inter/Math.max(a.size,b.size,1); if (sc>bs){ bs=sc; best=i.nome; } } return bs>=0.5?best:null; }
async function importar(file, usarPlanilha){ try { toast("Lendo a planilha…"); const XLSX=await xlsxLib(); const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellFormula:true,cellDates:true});
  const novo=lerPlanilha(XLSX, wb); const antigo=F.base;
  if (antigo && !usarPlanilha){ // preserva preços atualizados pelo portal (por nome) e IDs, para o histórico continuar ligado
    const ai={}; antigo.insumos.forEach(i=>ai[nz(i.nome)]=i); const af={}; antigo.fichas.forEach(f=>af[nz(f.aba||f.nome)]=f); const mapI={}, mapF={};
    novo.insumos.forEach(i=>{ const a=ai[nz(i.nome)]; if (a){ mapI[i.id]=a.id; i.id=a.id; if (!i.ficha && a.atualizado_portal && a.preco!=null) { i.preco=a.preco; i.qtd=a.qtd; } } });
    novo.fichas.forEach(f=>{ const a=af[nz(f.aba||f.nome)]; if (a){ mapF[f.id]=a.id; f.id=a.id; if (a.venda&&a.venda.portal&&f.venda) f.venda.preco=a.venda.preco; } });
    novo.insumos.forEach(i=>{ if (i.ficha&&mapF[i.ficha]) i.ficha=mapF[i.ficha]; });
    novo.fichas.forEach(f=>f.itens.forEach(it=>{ if (it.ins&&mapI[it.ins]) it.ins=mapI[it.ins]; if (it.sub&&mapF[it.sub]) it.sub=mapF[it.sub]; })); }
  if (antigo) await sb.from("ft_base_versoes").insert({empresa:F.emp, dados:antigo, motivo:"antes da importação de "+file.name});
  const nProd=novo.fichas.filter(f=>f.tipo==="produto").length, nBase=novo.fichas.length-nProd;
  F.base={versao:1, config:(antigo&&antigo.config)||{cmv_meta:0.30}, insumos:novo.insumos, fichas:novo.fichas,
    importacao:{arquivo:file.name, em:new Date().toISOString(), por:(S.perfil&&S.perfil.nome)||"", resumo:`${novo.insumos.length} insumos, ${nBase} receitas-base, ${nProd} produtos`, avisos:novo.avisos}};
  if (await salvar("importação de "+file.name)) { toast("Planilha importada: "+F.base.importacao.resumo+"."); F.tab="geral"; desenha(); }
  } catch(e){ console.warn(e); toast("Não foi possível ler a planilha: "+(e.message||e)); } }


/* ===== integração com o painel ===== */
window.renderFT = renderFT;
window.FT_TEM = emp => F.emps.has(nz(emp)) || (eq() && /ateli/i.test(String(emp||"")));
window.FT = { F, lerPlanilha, motor, carregarEmpresas };
const ini = () => { if (!bind()) return setTimeout(ini, 400); carregarEmpresas().then(()=>{ if (VITAL.renderPainel && document.querySelector("#v-painel:not([hidden]) .pnh") && !document.querySelector('[data-mzs="ft"],[data-pns="ft"]') && F.emps.size) VITAL.renderPainel(); }); };
ini();
})();

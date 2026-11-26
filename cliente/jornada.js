/* ===== Jornada do Cliente + NPS (Vital) =====
   Cliente: aba "Minha jornada" (trilha lúdica com o que já foi feito e o próximo passo) e pesquisa NPS
   a cada marco concluído e a cada 3 meses. Equipe: edita a jornada de cada cliente (com modelos prontos).
   Sócios: painel NPS (nota, evolução mensal, por cliente e comentários). Tabelas: jor_marcos, nps_respostas.
   Documentos: cada etapa pode ter arquivos (ent_arquivos.marco) e há "Documentos da empresa" fixos (ent_arquivos.fixo).
   Princípio: o documento já está no portal ANTES de o cliente precisar. A equipe publica ao concluir cada etapa
   (checklist de documentos essenciais + lembrete ao marcar "feito"). Se o cliente procurar e não achar, o portal
   avisa a equipe sozinho ("faltou", em aut_eventos) e a pendência aparece no editor e no painel dos sócios. */
(function(){
/* o script principal da Área do cliente roda dentro de uma função; ele expõe o que a jornada precisa em window.VITAL */
let S, sb, esc, toast, fmtD, MC, empresasConhecidas, goV, regV, WA;
const bind = () => { const v = window.VITAL || {}; ({S, sb, esc, toast, fmtD, MC, empresasConhecidas} = v); goV = v.go; regV = v.reg; WA = v.WA || "5562991744354"; return !!sb; };
const J = { emp:"", marcos:[], emps:[], docs:[], visto:"", edit:false, nps:{f:"", emp:""} };
const STA = { feito:["✅","Feito","ok"], agora:["⏳","Agora","ag"], proximo:["🔜","Próximo","pr"] };
const MODELOS = {
  abertura: ["🏢 Abertura de empresa", [
    ["🤝","Conversa inicial e proposta","Entendemos o seu negócio e escolhemos juntos o melhor caminho."],
    ["📐","Planejamento tributário","Calculamos o regime e o pró-labore que deixam o imposto mais baixo."],
    ["📝","Contrato social e documentos","Preparamos o contrato da empresa e juntamos os documentos."],
    ["🏷️","Nome e endereço aprovados","A Junta Comercial aprovou o nome e a Prefeitura liberou o endereço."],
    ["📨","Pedido do CNPJ na Receita","Enviamos a \"ficha de nascimento\" da empresa para a Receita Federal."],
    ["✍️","Sua assinatura pelo gov.br","Você assina tudo pelo celular, sem cartório."],
    ["🎂","CNPJ na mão!","A empresa nasceu! Já pode emitir nota fiscal."],
    ["⚙️","Empresa pronta para rodar","Simples Nacional, nota fiscal, conta bancária e primeiro pró-labore."]]],
  diagnostico: ["🔎 Diagnóstico", [
    ["🤝","Reunião de entendimento","Ouvimos como a empresa funciona hoje e o que te incomoda."],
    ["📥","Coleta de dados","Você nos manda os documentos e nós organizamos tudo."],
    ["🧠","Análise","Cruzamos os números para achar riscos e oportunidades."],
    ["📊","Relatório pronto","Um relatório visual, fácil de entender, com o plano de ação."],
    ["🎯","Apresentação e plano de ação","Explicamos cada ponto e combinamos os próximos passos."]]],
  bpo: ["💼 BPO financeiro", [
    ["🤝","Início do BPO","Combinamos rotina, prazos e acessos."],
    ["🗂️","Plano de contas e centros de custo","Cada real passa a ter \"endereço\" certo."],
    ["🏦","Conciliação bancária em dia","Banco e planilha batendo, sem diferença."],
    ["📊","Painéis financeiros no portal","DRE e fluxo de caixa para acompanhar pelo celular."],
    ["📅","Reunião mensal de resultados","Todo mês olhamos juntos os números e as decisões."]]],
  irpf: ["🧾 Imposto de Renda", [
    ["📥","Envio dos documentos","Informes, recibos e despesas: a lista vem pronta."],
    ["🧮","Conferência e cálculo","Testamos o modelo que paga menos imposto."],
    ["✅","Declaração enviada","Transmitida à Receita, com recibo."],
    ["🗓️","Acompanhamento da malha","Ficamos de olho até a declaração ser processada."]]],
  regularizacao: ["🧹 Regularização", [
    ["🔎","Levantamento das pendências","Descobrimos tudo o que está em aberto."],
    ["🧮","Cálculo e melhor caminho","Parcelamento, desconto ou pagamento: escolhemos o mais vantajoso."],
    ["📄","Pendências resolvidas","Guias geradas, declarações entregues e parcelamentos feitos."],
    ["🏅","Certidões em dia","Empresa regular e certidões liberadas."]]]
};

/* catálogo do autoatendimento: o que o cliente costuma pedir ao escritório */
const AUTO = [
  {k:"cnpj", ess:1, ic:"🪪", t:"Cartão CNPJ", re:/cnpj|cart[aã]o cnpj|comprovante de inscri/i, ext:["Emitir na Receita Federal (grátis, na hora)","https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp"]},
  {k:"contrato", ess:1, ic:"📜", t:"Contrato social", re:/contrato[ _]social|altera[cç][aã]o contratual|ato constitutivo/i},
  {k:"simples", ess:1, ic:"🧾", t:"Comprovante do Simples Nacional", re:/simples/i, ext:["Consultar a opção no site do Simples","https://www8.receita.fazenda.gov.br/SimplesNacional/aplicacoes.aspx?id=21"]},
  {k:"das", ic:"💳", t:"Guia do imposto (DAS)", re:/\bdas\b|guia/i},
  {k:"certidao", ic:"🏅", t:"Certidão negativa", re:/certid/i, ext:["Emitir a certidão federal","https://www.gov.br/receitafederal/pt-br/servicos/certidoes/emitir-certidao"]},
  {k:"prolabore", ic:"💼", t:"Pró-labore (recibo ou plano)", re:/pr[oó][-_ ]?labore|holerite/i},
  {k:"relatorio", ic:"📊", t:"Relatórios da Vital", re:/relat[oó]rio|dre|fluxo|diagn[oó]stico|planejamento/i}
];
const ICO = n => { const e = (String(n||"").split(".").pop()||"").toLowerCase(); return e==="pdf"?"📕":/xls|csv/.test(e)?"📗":/doc/.test(e)?"📘":/png|jpe?g/.test(e)?"🖼️":"📄"; };

const $j = s => document.querySelector(s);
const eq = () => S.papel==="admin" || S.papel==="equipe";
const soc = () => S.papel==="admin" || !!(S.perfil && S.perfil.socio);
const dia = d => d ? String(d).slice(0,10).split("-").reverse().join("/") : "";

const CSS = `
.jor-hero{border-radius:18px;padding:18px 20px;background:linear-gradient(135deg,#00582F,#007941 55%,#79C25B);color:#fff;position:relative;overflow:hidden}
.jor-hero h2{font-size:1.45rem;color:#fff}.jor-hero p{margin:4px 0 0;opacity:.95}
.jor-hero .conf{position:absolute;right:14px;top:10px;font-size:1.7rem;letter-spacing:4px;opacity:.9}
.jor-bar{margin-top:14px;background:rgba(255,255,255,.25);height:22px;border-radius:12px;overflow:hidden;position:relative}
.jor-bar span{display:block;height:100%;background:linear-gradient(90deg,#FFC83D,#FFE08A);border-radius:12px;transition:width .8s}
.jor-bar em{position:absolute;right:10px;top:1px;font-style:normal;font-weight:800;font-size:.85rem}
.jor-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.jor-k{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;text-align:center}
.jor-k b{display:block;font-family:var(--display);font-size:1.6rem;color:var(--brand)}.jor-k span{font-size:.85rem;color:var(--muted)}
.jor-next{display:flex;gap:12px;align-items:center;border-radius:16px;padding:14px 16px;background:#FFF8E3;border:2px solid #FFE3A3}
.jor-next .e{font-size:2rem}.jor-next b{display:block}.jor-next span{color:var(--muted);font-size:.92rem}
.jor-trail{display:grid;gap:10px}
.jor-st{display:grid;grid-template-columns:52px 1fr;gap:12px;position:relative}
.jor-st:not(:last-child)::before{content:"";position:absolute;left:25px;top:50px;bottom:-12px;width:3px;background:#E1F0D9}
.jor-ic{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-size:1.5rem;border:3px solid var(--leaf);background:var(--surface)}
.jor-st.feito .jor-ic{background:var(--brand-2);border-color:var(--brand-2)}
.jor-st.agora .jor-ic{background:#FFC83D;border-color:#FF8A3D;box-shadow:0 0 0 6px #FFF1C9}
.jor-st.proximo .jor-ic{border-style:dashed;border-color:#B9C7BF}
.jor-c{background:#F7FBF5;border-radius:12px;padding:9px 13px;border-left:5px solid var(--leaf)}
.jor-st.agora .jor-c{background:#FFF8E3;border-left-color:#FF8A3D}.jor-st.proximo .jor-c{background:var(--surface);border-left-color:#C9D3CD}
.jor-c b{font-size:1rem}.jor-c p{margin:2px 0 0;font-size:.92rem;color:var(--fg)}.jor-c small{float:right;color:var(--muted);font-weight:700}
.jor-tag{display:inline-block;font-size:.7rem;font-weight:800;padding:1px 8px;border-radius:9px;margin-left:6px;vertical-align:2px;color:#fff}
.jor-tag.ok{background:var(--brand-2)}.jor-tag.ag{background:#FF8A3D}.jor-tag.pr{background:#9AA79F}
.jor-vazio{text-align:center;padding:30px 16px;border:2px dashed var(--line);border-radius:16px;color:var(--muted)}
.jor-ed{display:grid;gap:8px}
.jor-row{display:grid;grid-template-columns:46px 1fr 130px 130px 92px;gap:8px;align-items:start;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:8px}
.jor-row input,.jor-row select,.jor-row textarea{width:100%;border:1px solid var(--line);border-radius:8px;padding:6px 8px;background:var(--bg)}
.jor-row textarea{min-height:44px;resize:vertical;margin-top:4px}
.jor-row .acts{display:flex;gap:4px;flex-wrap:wrap}.jor-row .acts button{border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:4px 7px;cursor:pointer}
.jor-row label.chk{font-size:.8rem;display:flex;gap:4px;align-items:center;margin-top:4px}
@media (max-width:720px){.jor-row{grid-template-columns:46px 1fr}.jor-row>*:nth-child(n+3){grid-column:1/-1}.jor-kpis{grid-template-columns:1fr 1fr 1fr}}
.nps-ov{position:fixed;inset:0;background:rgba(15,23,18,.55);z-index:50;display:grid;place-items:center;padding:16px}
.nps-box{background:var(--surface);border-radius:20px;max-width:560px;width:100%;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.nps-box h3{font-size:1.2rem}.nps-box p{color:var(--muted);margin:6px 0 12px}
.nps-esc{display:grid;grid-template-columns:repeat(11,1fr);gap:4px}
.nps-esc button{border:0;border-radius:10px;padding:10px 0;font-weight:800;cursor:pointer;color:#fff}
.nps-esc button[aria-pressed="true"]{outline:3px solid var(--fg);transform:scale(1.08)}
.nps-leg{display:flex;justify-content:space-between;font-size:.8rem;color:var(--muted);margin-top:4px}
.nps-box textarea{width:100%;min-height:70px;border:1px solid var(--line);border-radius:10px;padding:8px;margin-top:10px;background:var(--bg)}
.nps-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.nps-k{border-radius:16px;padding:14px;text-align:center;cursor:pointer;border:2px solid transparent;font:inherit;color:inherit}
.nps-k b{display:block;font-family:var(--display);font-size:1.9rem}.nps-k span{font-size:.85rem}
.nps-k[aria-pressed="true"]{border-color:var(--fg)}
.nps-k.t{background:linear-gradient(135deg,#00582F,#79C25B);color:#fff}.nps-k.p{background:#E1F2E5;color:#1F7A3F}.nps-k.n{background:#FFF3D6;color:#9A6200}.nps-k.d{background:#FBE4E1;color:#B3261E}
.nps-meses{display:grid;grid-template-columns:repeat(12,1fr);gap:6px;align-items:end;height:150px;padding:8px;background:var(--surface);border:1px solid var(--line);border-radius:14px}
.nps-m{display:flex;flex-direction:column;align-items:center;justify-content:end;height:100%;font-size:.72rem;color:var(--muted);cursor:pointer}
.nps-m i{display:block;width:70%;border-radius:6px 6px 0 0;min-height:3px}
.nps-m b{color:var(--fg);font-size:.78rem}
.nps-emps{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.nps-e{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px;cursor:pointer;text-align:left;font:inherit;color:inherit}
.nps-e b{display:block}.nps-e[aria-pressed="true"]{border-color:var(--brand);box-shadow:0 0 0 2px var(--leaf)}
.nps-com{display:grid;gap:8px}
.nps-c{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.nps-n{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;color:#fff;font-weight:800;margin-right:8px}
.jor-docs{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.jor-doc{display:flex;gap:10px;align-items:center;text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px 12px;cursor:pointer;font:inherit;color:inherit}
.jor-doc:hover{border-color:var(--brand);box-shadow:0 0 0 2px var(--leaf)}
.jor-doc .i{font-size:1.6rem}.jor-doc b{display:block;font-size:.95rem;line-height:1.2}.jor-doc span{font-size:.78rem;color:var(--muted)}
.jor-novo{display:inline-block;background:#FF8A3D;color:#fff;font-size:.66rem;font-weight:800;border-radius:8px;padding:0 6px;margin-left:4px;vertical-align:1px}
.jor-mdocs{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.jor-mdocs button{border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:4px 9px;font-size:.82rem;cursor:pointer;color:inherit}
.jor-mdocs button:hover{border-color:var(--brand)}
.jor-auto{background:linear-gradient(135deg,#F1F8EC,#FFF8E3);border:1px solid #DCEBD2;border-radius:18px;padding:14px 16px}
.jor-auto h3{margin:0 0 2px}.jor-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.jor-chip{border:1px solid var(--line);background:var(--surface);border-radius:20px;padding:7px 12px;cursor:pointer;font:inherit;color:inherit;font-weight:600}
.jor-chip:hover{border-color:var(--brand);background:#F7FBF5}
.jor-res{display:grid;gap:8px;margin-top:12px}
.jor-res .op{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.jor-new{display:flex;gap:10px;align-items:center;background:#FFF1E6;border:2px solid #FFD2B0;border-radius:14px;padding:10px 14px}
.jor-dt{width:100%;border-collapse:collapse}.jor-dt td,.jor-dt th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;font-size:.9rem}
.jor-dt select{border:1px solid var(--line);border-radius:8px;padding:4px 6px;background:var(--bg);max-width:240px}
.aut-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.aut-k{border-radius:14px;padding:12px;text-align:center;background:var(--surface);border:1px solid var(--line)}
.aut-k b{display:block;font-family:var(--display);font-size:1.6rem;color:var(--brand)}.aut-k span{font-size:.82rem;color:var(--muted)}
@media (max-width:720px){.aut-grid{grid-template-columns:1fr 1fr}}
@media (max-width:720px){.nps-grid{grid-template-columns:1fr 1fr}.nps-esc button{padding:8px 0;font-size:.85rem}}
`;
const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
const corNota = n => n>=9 ? "#1F7A3F" : n>=7 ? "#E0A100" : "#B3261E";

async function empresasJornada(){
  if (!eq()) { if (!S.minhasEmp) { const g = await sb.from("gestor_empresas").select("empresa").eq("user_id", S.user.id); S.minhasEmp = (g.data||[]).map(x=>x.empresa); } return [...S.minhasEmp]; }
  const nomes = new Set(await empresasConhecidas());
  const {data} = await sb.from("jor_marcos").select("empresa").limit(5000); (data||[]).forEach(r => nomes.add(r.empresa));
  return [...nomes].filter(Boolean).sort((a,b)=>a.localeCompare(b,"pt-BR"));
}
async function carregarMarcos(emp){
  const {data, error} = await sb.from("jor_marcos").select("*").eq("empresa", emp).order("ordem").order("criado_em");
  if (error) { toast("A jornada ainda não está disponível."); return []; }
  return data||[];
}

window.renderJornada = async function(){
  if (!bind()) return;
  const v = $j("#v-jornada"); if (!v) return;
  v.innerHTML = `<div class="card">Carregando a jornada…</div>`;
  J.emps = await empresasJornada();
  if (!J.emp || !J.emps.includes(J.emp)) J.emp = J.emps[0] || "";
  J.marcos = J.emp ? await carregarMarcos(J.emp) : [];
  J.docs = J.emp ? await carregarDocs(J.emp) : [];
  J.faltou = J.emp && eq() ? await carregarFaltou(J.emp) : [];
  desenhar();
};
async function carregarFaltou(emp){
  const {data, error} = await sb.from("aut_eventos").select("item, em").eq("empresa", emp).eq("acao","faltou").order("em",{ascending:false}).limit(50);
  if (error || !data) return [];
  const vistos = new Set(); return data.filter(f => { if (vistos.has(f.item)) return false; vistos.add(f.item); const x = AUTO.find(i=>i.k===f.item); return !(x && x.re && J.docs.some(a => x.re.test(a.titulo+" "+a.nome_arquivo) && a.criado_em > f.em)); });
}
async function carregarDocs(emp){
  let r = await sb.from("ent_arquivos").select("id, empresa, titulo, categoria, caminho, nome_arquivo, tamanho, criado_em, marco, fixo").eq("empresa", emp).order("criado_em", {ascending:false}).limit(500);
  if (r.error) r = await sb.from("ent_arquivos").select("id, empresa, titulo, categoria, caminho, nome_arquivo, tamanho, criado_em").eq("empresa", emp).order("criado_em", {ascending:false}).limit(500);
  return (r.data||[]).filter(a => !String(a.titulo||"").startsWith("[COE]"));
}
const chaveVisto = () => "vital_jor_visto_"+((S.user&&S.user.id)||"")+"_"+J.emp;
const novo = a => !eq() && J.visto && a.criado_em > J.visto;
async function baixarDoc(id, origem){
  const a = J.docs.find(x=>x.id===id); if (!a) return;
  try { if (regV) await regV("baixar", a.id); } catch {}
  if (origem) logAuto(origem.item, origem.acao);
  try { const {data, error} = await sb.storage.from("entregaveis").createSignedUrl(a.caminho, 60, {download: a.nome_arquivo}); if (error) throw error; location.assign(data.signedUrl); }
  catch { toast("Não foi possível baixar agora. Tente de novo."); }
}
function logAuto(item, acao){ if (eq() || !J.emp) return; sb.from("aut_eventos").insert({empresa:J.emp, item, acao}).then(()=>{}, ()=>{}); }
const botaoDoc = a => `<button class="jor-doc" data-doc="${a.id}"><span class="i">${ICO(a.nome_arquivo)}</span><span><b>${esc(a.titulo)}${novo(a)?`<span class="jor-novo">NOVO</span>`:""}</b><span>${fmtD(a.criado_em)} · toque para baixar</span></span></button>`;

function desenhar(){
  const v = $j("#v-jornada"), M = J.marcos, n = M.length, f = M.filter(m=>m.status==="feito").length;
  const pct = n ? Math.round(f*100/n) : 0, agora = M.find(m=>m.status==="agora") || M.find(m=>m.status==="proximo");
  const sel = J.emps.length>1 || eq() ? `<div class="field" style="min-width:240px"><label for="jEmp">${eq()?"Cliente":"Empresa"}</label><select id="jEmp">${J.emps.length?"":`<option value="">Nenhuma empresa</option>`}${J.emps.map(e=>`<option ${e===J.emp?"selected":""}>${esc(e)}</option>`).join("")}</select></div>` : "";
  const topo = `<div class="row" style="justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap"><div><div class="eyebrow">${eq()?"Jornada dos clientes":"Minha jornada"}</div><h2 style="font-size:1.35rem">${eq()?"Como cada cliente vê a evolução com a Vital":"Sua evolução com a Vital 🚀"}</h2></div>${sel}${eq()?`<button class="btn ${J.edit?"":"primary"}" id="jEd">${J.edit?"👀 Ver como o cliente":"✏️ Editar jornada"}</button>`:""}</div>`;
  if (eq() && J.edit) { v.innerHTML = topo + editor(); ligarEditor(); return; }
  if (!n) { v.innerHTML = topo + `<div class="jor-vazio"><div style="font-size:2.4rem">🗺️</div><b>${eq()?"Este cliente ainda não tem jornada.":"Sua jornada está sendo preparada."}</b><p>${eq()?"Clique em \"Editar jornada\" e use um modelo pronto (abertura, diagnóstico, BPO, IRPF ou regularização).":"Em breve você vai acompanhar aqui cada etapa do seu trabalho com a Vital."}</p></div>`; ligarTopo(); return; }
  const fim = f===n;
  try { J.visto = localStorage.getItem(chaveVisto()) || ""; } catch { J.visto = ""; }
  const fixos = J.docs.filter(a => a.fixo), novos = J.docs.filter(novo);
  v.innerHTML = topo + `
    <div class="jor-hero"><div class="conf">${fim?"🎉🥳🎊":"✨"}</div>
      <h2>${fim?"Tudo pronto! Parabéns! 🎉":pct>=50?"Mais da metade do caminho! 💪":"Começamos com tudo! 🌱"}</h2>
      <p>${esc(J.emp)} · ${f} de ${n} etapas concluídas</p>
      <div class="jor-bar"><span style="width:${pct}%"></span><em>${pct}%</em></div></div>
    <div class="jor-kpis"><div class="jor-k"><b>${f}</b><span>✅ etapas feitas</span></div><div class="jor-k"><b>${M.filter(m=>m.status==="agora").length}</b><span>⏳ em andamento</span></div><div class="jor-k"><b>${M.filter(m=>m.status==="proximo").length}</b><span>🔜 próximas</span></div></div>
    ${novos.length ? `<div class="jor-new"><span style="font-size:1.6rem">📬</span><div><b>${novos.length===1?"Chegou 1 documento novo":"Chegaram "+novos.length+" documentos novos"} para você</b><div class="note" style="margin:0">${novos.slice(0,3).map(a=>esc(a.titulo)).join(" · ")}</div></div></div>` : ""}
    ${agora && !fim ? `<div class="jor-next"><div class="e">${esc(agora.icone||"👉")}</div><div><b>Agora: ${esc(agora.titulo)}</b><span>${esc(agora.descricao||"")}${agora.data?` · previsão ${dia(agora.data)}`:""}</span></div></div>` : ""}
    ${fixos.length ? `<h3 style="margin-top:6px">📁 Documentos da empresa <span class="note" style="font-weight:400">sempre à mão, baixe quando quiser</span></h3><div class="jor-docs">${fixos.map(botaoDoc).join("")}</div>` : ""}
    ${autoHtml()}
    <h3 style="margin-top:6px">🗺️ A trilha</h3>
    <div class="jor-trail">${M.map(m => { const s = STA[m.status]||STA.proximo;
      return `<div class="jor-st ${m.status}"><div class="jor-ic">${esc(m.icone||"⭐")}</div><div class="jor-c"><small>${m.status==="feito"&&m.concluido_em?dia(m.concluido_em):m.data?dia(m.data):""}</small><b>${esc(m.titulo)}</b><span class="jor-tag ${s[2]}">${s[1].toUpperCase()}</span>${m.descricao?`<p>${esc(m.descricao)}</p>`:""}${docsDoMarco(m.id)}</div></div>`; }).join("")}</div>
    ${!eq() ? `<p class="note" style="text-align:center">💬 Dúvidas sobre alguma etapa? <a href="https://wa.me/${WA}?text=${encodeURIComponent("Olá! Sou cliente da Vital ("+J.emp+") e tenho uma dúvida sobre a minha jornada.")}" target="_blank" rel="noopener">Fale com a Vital pelo WhatsApp</a>.</p>` : ""}`;
  ligarTopo();
  if (!eq()) { try { localStorage.setItem(chaveVisto(), new Date().toISOString()); } catch {} }
}
function docsDoMarco(id){
  const L = J.docs.filter(a => a.marco===id); if (!L.length) return "";
  return `<div class="jor-mdocs">${L.map(a=>`<button data-doc="${a.id}" title="Baixar">📎 ${esc(a.titulo)}${novo(a)?`<span class="jor-novo">NOVO</span>`:""}</button>`).join("")}</div>`;
}
function autoHtml(){
  if (eq() && !J.docs.length) return "";
  return `<div class="jor-auto"><h3>🗂️ Procurando algum documento?</h3><p class="note" style="margin:0">Está tudo aqui, pronto para baixar a qualquer hora. Toque no que você precisa:</p>
    <div class="jor-chips">${AUTO.map(x=>`<button class="jor-chip" data-auto="${x.k}">${x.ic} ${esc(x.t)}</button>`).join("")}</div><div id="jRes"></div></div>`;
}
/* mostra o que já existe para o item; se não existir, oferece o caminho rápido (site oficial) e só depois o pedido à Vital */
function resolverAuto(k, alvo, acaoAchou){
  const x = AUTO.find(i=>i.k===k); if (!x || !alvo) return;
  const achados = x.re ? J.docs.filter(a => x.re.test(a.titulo+" "+a.nome_arquivo)) : [];
  if (!achados.length) logAuto(x.k, "faltou");
  alvo.innerHTML = `<div class="jor-res">
    ${achados.length ? `<div class="op" style="border-color:#BFE5C8;background:#F1F8EC"><span>✅ <b>Está aqui!</b> Toque para baixar:</span></div><div class="jor-docs">${achados.slice(0,6).map(a=>botaoDoc(a).replace('data-doc=', `data-item="${x.k}" data-doc=`)).join("")}</div>`
      : `<div class="op" style="border-color:#FFD2B0;background:#FFF6EE"><span>🔔 <b>${esc(x.t)}</b> ainda não está no seu portal. <b>A Vital já foi avisada</b> e vai colocar aqui para você.</span></div>`}
    ${x.ext ? `<div class="op"><span>⚡ ${achados.length?"Precisa de uma via com a data de hoje?":"Se precisar agora mesmo:"} <b>${esc(x.ext[0])}</b>${x.k==="cnpj"||x.k==="certidao"?` <span class="note">(use o CNPJ da empresa)</span>`:""}</span><a class="btn sm" href="${x.ext[1]}" target="_blank" rel="noopener" data-ext="${x.k}">Abrir</a></div>` : ""}
  </div>`;
  alvo.querySelectorAll("[data-doc]").forEach(b => b.onclick = () => baixarDoc(b.dataset.doc, {item:x.k, acao:acaoAchou}));
  alvo.querySelectorAll("[data-ext]").forEach(a => a.addEventListener("click", () => logAuto(x.k, "link")));
}
function ligarTopo(){
  const s = $j("#jEmp"); if (s) s.onchange = async () => { J.emp = s.value; J.marcos = await carregarMarcos(J.emp); J.docs = await carregarDocs(J.emp); J.faltou = eq() ? await carregarFaltou(J.emp) : []; desenhar(); };
  document.querySelectorAll("#v-jornada [data-doc]").forEach(b => b.onclick = () => baixarDoc(b.dataset.doc, b.dataset.item ? {item:b.dataset.item, acao:"achou"} : null));
  document.querySelectorAll("#v-jornada [data-auto]").forEach(b => b.onclick = () => resolverAuto(b.dataset.auto, $j("#jRes"), "achou"));
  const b = $j("#jEd"); if (b) b.onclick = () => { J.edit = !J.edit; desenhar(); };
}

/* ----- editor da equipe ----- */
function editor(){
  const M = J.marcos;
  return `<div class="card stack">
    <div class="row" style="gap:8px;flex-wrap:wrap;align-items:end">
      <div class="field"><label for="jMod">Aplicar modelo</label><select id="jMod"><option value="">Escolha…</option>${Object.entries(MODELOS).map(([k,[t]])=>`<option value="${k}">${t}</option>`).join("")}</select></div>
      <button class="btn" id="jModOk">➕ Adicionar etapas do modelo</button>
      <button class="btn" id="jNovo">➕ Etapa em branco</button>
      <span class="note" style="margin-left:auto">Traduza o "contabilês": linguagem simples, como numa conversa · o cliente vê exatamente este texto.</span>
    </div>
    ${J.emp ? "" : `<p class="note">Escolha um cliente acima.</p>`}
    <div class="jor-ed">${M.map((m,i) => `<div class="jor-row" data-id="${m.id}">
      <input aria-label="Ícone" data-f="icone" value="${esc(m.icone||"")}" maxlength="4" style="text-align:center;font-size:1.3rem">
      <div><input aria-label="Título" data-f="titulo" value="${esc(m.titulo)}"><textarea aria-label="Explicação para o cliente" data-f="descricao" placeholder="Explique em uma frase simples">${esc(m.descricao||"")}</textarea></div>
      <div><select aria-label="Situação" data-f="status">${Object.entries(STA).map(([k,s])=>`<option value="${k}" ${m.status===k?"selected":""}>${s[0]} ${s[1]}</option>`).join("")}</select><label class="chk"><input type="checkbox" data-f="pede_nps" ${m.pede_nps?"checked":""}> pedir NPS ao concluir</label></div>
      <div><input type="date" aria-label="Previsão" data-f="data" value="${m.data||""}"><small class="note">${m.concluido_em?"feito em "+dia(m.concluido_em):"previsão"}</small></div>
      <div class="acts"><button data-a="up" ${i?"":"disabled"} title="Subir">⬆️</button><button data-a="dn" ${i<M.length-1?"":"disabled"} title="Descer">⬇️</button><button data-a="del" title="Excluir">🗑️</button></div>
    </div>`).join("")}</div>
    <p class="note" id="jMsg" role="status"></p></div>
    ${J.emp ? docsEditor() : ""}`;
}
function docsEditor(){
  const D = J.docs, temCol = D.some(a => "marco" in a) || !D.length;
  const ess = AUTO.filter(x=>x.ess).map(x => [x, D.some(a => x.re.test(a.titulo+" "+a.nome_arquivo))]);
  const falt = (J.faltou||[]);
  return `<div class="card stack"><h3 style="margin:0">✅ Documentos essenciais no portal</h3><p class="note" style="margin:0">O cliente deve encontrar estes documentos sem precisar pedir. Publique assim que a etapa for concluída.</p>
    <div class="jor-chips">${ess.map(([x,ok])=>`<span class="jor-chip" style="cursor:default;${ok?"background:#F1F8EC;border-color:#BFE5C8":"background:#FFF6EE;border-color:#FFD2B0"}">${ok?"✅":"⚠️"} ${esc(x.t)}${ok?"":" · falta publicar"}</span>`).join("")}</div>
    ${falt.length ? `<div class="op" style="display:block;background:#FFF6EE;border:1px solid #FFD2B0;border-radius:12px;padding:10px 12px"><b>🔔 O cliente procurou e não achou:</b> ${falt.map(f=>esc((AUTO.find(x=>x.k===f.item)||{t:f.item}).t)+" ("+fmtD(f.em)+")").join(" · ")}</div>` : ""}
  </div>
  <div class="card stack"><div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><div><h3 style="margin:0">📎 Documentos da jornada</h3><p class="note" style="margin:2px 0 0">Ligue cada arquivo publicado a uma etapa e fixe os principais (Cartão CNPJ, contrato social, Simples) em "Documentos da empresa". O cliente baixa quando quiser, sem pedir ao escritório.</p></div>
      <button class="btn primary sm" id="jPub">+ Publicar documento para ${esc(J.emp)}</button></div>
    ${!temCol ? `<p class="note">⚠️ Falta rodar a atualização do banco (colunas marco e fixo em ent_arquivos).</p>` : ""}
    ${D.length ? `<div class="tablewrap"><table class="jor-dt"><thead><tr><th>Documento</th><th>Etapa da jornada</th><th>Documentos da empresa</th></tr></thead><tbody>${D.map(a=>`<tr data-arq="${a.id}"><td>${ICO(a.nome_arquivo)} <b>${esc(a.titulo)}</b><div class="note" style="margin:0">${esc(a.categoria||"")} · ${fmtD(a.criado_em)}</div></td>
      <td><select data-g="marco"><option value="">— nenhuma —</option>${J.marcos.map(m=>`<option value="${m.id}" ${a.marco===m.id?"selected":""}>${esc((m.icone||"")+" "+m.titulo)}</option>`).join("")}</select></td>
      <td><label class="chk" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-g="fixo" ${a.fixo?"checked":""}> fixar</label></td></tr>`).join("")}</tbody></table></div>` : `<p class="note" style="margin:0">Nenhum arquivo publicado para este cliente ainda.</p>`}
    <p class="note" id="jDocMsg" role="status" style="margin:0"></p></div>`;
}
async function salvarCampo(id, campo, valor){
  const patch = {[campo]: valor===""?null:valor};
  const {data, error} = await sb.from("jor_marcos").update(patch).eq("id", id).select().single();
  if (error) { $j("#jMsg").textContent = "Não salvou: "+error.message; return; }
  const i = J.marcos.findIndex(m=>m.id===id); if (i>=0) J.marcos[i] = data;
  $j("#jMsg").textContent = "Salvo ✓";
  if (campo==="status") { desenhar(); if (valor==="feito" && !J.docs.some(a=>a.marco===id)) toast("📎 Etapa concluída! Se ela gerou algum documento, publique e ligue aqui: o cliente vai procurar na jornada."); }
}
function ligarEditor(){
  ligarTopo();
  document.querySelectorAll(".jor-row").forEach(r => {
    const id = r.dataset.id;
    r.querySelectorAll("[data-f]").forEach(el => { el.onchange = () => salvarCampo(id, el.dataset.f, el.type==="checkbox" ? el.checked : el.value.trim()); });
    r.querySelectorAll("[data-a]").forEach(b => b.onclick = async () => {
      const i = J.marcos.findIndex(m=>m.id===id);
      if (b.dataset.a==="del") { if (!confirm("Excluir esta etapa da jornada?")) return; await sb.from("jor_marcos").delete().eq("id", id); J.marcos.splice(i,1); desenhar(); return; }
      const j = b.dataset.a==="up" ? i-1 : i+1; if (j<0 || j>=J.marcos.length) return;
      [J.marcos[i], J.marcos[j]] = [J.marcos[j], J.marcos[i]];
      await Promise.all(J.marcos.map((m,k) => sb.from("jor_marcos").update({ordem:k+1}).eq("id", m.id)));
      J.marcos.forEach((m,k)=>m.ordem=k+1); desenhar();
    });
  });
  const add = async (linhas) => {
    if (!J.emp) { toast("Escolha um cliente."); return; }
    const base = J.marcos.length;
    const regs = linhas.map(([icone,titulo,descricao],k) => ({empresa:J.emp, ordem:base+k+1, icone, titulo, descricao, status:"proximo"}));
    const {data, error} = await sb.from("jor_marcos").insert(regs).select();
    if (error) { toast("Não foi possível adicionar: "+error.message); return; }
    J.marcos.push(...data); desenhar();
  };
  $j("#jModOk").onclick = () => { const k = $j("#jMod").value; if (k) add(MODELOS[k][1]); };
  const pb = $j("#jPub"); if (pb) pb.onclick = () => { S.emp = J.emp; if (goV) goV("pub"); };
  document.querySelectorAll(".jor-dt [data-arq]").forEach(tr => tr.querySelectorAll("[data-g]").forEach(el => el.onchange = async () => {
    const campo = el.dataset.g, val = campo==="fixo" ? el.checked : (el.value||null);
    const {error} = await sb.from("ent_arquivos").update({[campo]: val}).eq("id", tr.dataset.arq);
    const msg = $j("#jDocMsg"); if (error) { msg.textContent = "Não salvou: "+error.message; return; }
    const a = J.docs.find(x=>x.id===tr.dataset.arq); if (a) a[campo] = val; msg.textContent = "Salvo ✓ O cliente já vê assim.";
  }));
  $j("#jNovo").onclick = () => add([["⭐","Nova etapa",""]]);
}

/* ----- pesquisa NPS para o cliente ----- */
window.npsVerificar = async function(){
  if (!bind()) return;
  if (eq() || !S.user) return;
  let pulou = {}; try { pulou = JSON.parse(sessionStorage.getItem("vital_nps_pulou")||"{}"); } catch {}
  const emps = await empresasJornada();
  for (const emp of emps) {
    if (pulou[emp]) continue;
    const {data, error} = await sb.rpc("nps_pendente", {emp});
    if (error || !data || !data.length) continue;
    abrirNPS(emp, data[0]); return;
  }
};
function abrirNPS(emp, p){
  const ov = document.createElement("div"); ov.className = "nps-ov"; ov.setAttribute("role","dialog"); ov.setAttribute("aria-modal","true");
  const titulo = p.motivo==="marco" ? `Concluímos: <b>${esc(p.titulo)}</b> 🎉` : `Já faz um tempinho que trabalhamos juntos 💚`;
  ov.innerHTML = `<div class="nps-box"><h3>${titulo}</h3>
    <p>De 0 a 10, quanto você indicaria a Vital para um amigo ou colega?</p>
    <div class="nps-esc">${[...Array(11).keys()].map(n=>`<button type="button" data-n="${n}" style="background:${corNota(n)}" aria-pressed="false" aria-label="Nota ${n}">${n}</button>`).join("")}</div>
    <div class="nps-leg"><span>😕 Nada provável</span><span>Muito provável 😍</span></div>
    <textarea id="npsCom" placeholder="Quer contar o motivo? (opcional) O que podemos fazer melhor?"></textarea>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px"><button class="btn ghost" id="npsDepois">Agora não</button><button class="btn primary" id="npsOk" disabled>Enviar</button></div>
    <p class="note" id="npsMsg" role="status"></p></div>`;
  document.body.appendChild(ov);
  let nota = null;
  ov.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { nota = +b.dataset.n; ov.querySelectorAll("[data-n]").forEach(x=>x.setAttribute("aria-pressed", x===b)); ov.querySelector("#npsOk").disabled = false; });
  ov.querySelector("#npsDepois").onclick = () => { try { const pl = JSON.parse(sessionStorage.getItem("vital_nps_pulou")||"{}"); pl[emp]=1; sessionStorage.setItem("vital_nps_pulou", JSON.stringify(pl)); } catch {} ov.remove(); };
  ov.querySelector("#npsOk").onclick = async () => {
    const {error} = await sb.from("nps_respostas").insert({empresa:emp, nota, comentario:ov.querySelector("#npsCom").value.trim()||null, motivo:p.motivo, marco:p.marco||null, nome:(S.perfil&&S.perfil.nome)||null});
    if (error) { ov.querySelector("#npsMsg").textContent = "Não foi possível enviar: "+error.message; return; }
    ov.querySelector(".nps-box").innerHTML = `<div style="text-align:center;padding:10px"><div style="font-size:3rem">${nota>=9?"🥳":"💚"}</div><h3>Obrigado!</h3><p>Sua opinião ajuda a Vital a melhorar sempre.</p><button class="btn primary" id="npsFim">Fechar</button></div>`;
    ov.querySelector("#npsFim").onclick = () => ov.remove();
  };
}

/* ----- painel NPS para os sócios ----- */
window.renderNPS = async function(){
  if (!bind()) return;
  const v = $j("#v-nps"); if (!v) return;
  if (!soc()) { v.innerHTML = `<div class="card">Área exclusiva dos sócios.</div>`; return; }
  v.innerHTML = `<div class="card">Carregando o NPS…</div>`;
  const {data, error} = await sb.from("nps_respostas").select("*").order("em", {ascending:false}).limit(5000);
  if (error) { v.innerHTML = `<div class="card">O NPS ainda não está disponível (${esc(error.message)}).</div>`; return; }
  J.respostas = data||[];
  const de = new Date(Date.now()-90*864e5).toISOString();
  const ae = await sb.from("aut_eventos").select("empresa, item, acao, em").gte("em", de).order("em",{ascending:false}).limit(5000);
  J.aut = ae.error ? null : (ae.data||[]);
  desenharNPS();
};
function autHtml(){
  if (!J.aut) return "";
  const A = J.aut, c = a => A.filter(e=>e.acao===a).length, nomeI = k => (AUTO.find(x=>x.k===k)||{t:k}).t;
  const falt = []; const vis = new Set(); A.filter(e=>e.acao==="faltou").forEach(e => { const kk = e.empresa+"|"+e.item; if (!vis.has(kk)) { vis.add(kk); falt.push(e); } });
  return `<h3>🗂️ Autoatendimento no portal <span class="note" style="font-weight:400">(últimos 90 dias)</span></h3>
    <div class="aut-grid"><div class="aut-k"><b>${c("achou")+c("evitou_whats")}</b><span>📥 documentos achados pelo próprio cliente</span></div><div class="aut-k"><b>${c("evitou_whats")}</b><span>💬 conversas de WhatsApp evitadas</span></div><div class="aut-k"><b>${c("link")}</b><span>⚡ emitidos direto no site oficial</span></div><div class="aut-k" style="${falt.length?"background:#FFF6EE;border-color:#FFD2B0":""}"><b>${falt.length}</b><span>🔔 procurados e não achados</span></div></div>
    ${falt.length ? `<div class="nps-com">${falt.slice(0,20).map(e=>`<div class="nps-c">🔔 <b>${esc(e.empresa)}</b> procurou <b>${esc(nomeI(e.item))}</b> em ${fmtD(e.em)} · publique na jornada do cliente</div>`).join("")}</div>` : `<p class="note">Nenhum documento faltando: tudo o que os clientes procuraram já estava no portal. 🎉</p>`}`;
}
function calc(rs){ const n = rs.length, p = rs.filter(r=>r.nota>=9).length, d = rs.filter(r=>r.nota<=6).length; return {n, p, d, ne:n-p-d, nps: n ? Math.round((p-d)*100/n) : null}; }
function desenharNPS(){
  const v = $j("#v-nps"), F = J.nps, todos = J.respostas;
  const base = F.emp ? todos.filter(r=>r.empresa===F.emp) : todos;
  const k = calc(base);
  const filtro = F.f==="p" ? r=>r.nota>=9 : F.f==="n" ? r=>r.nota>=7&&r.nota<=8 : F.f==="d" ? r=>r.nota<=6 : ()=>true;
  const lista = base.filter(filtro);
  const meses = [...Array(12).keys()].map(i => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-11+i); return d.toISOString().slice(0,7); });
  const porMes = meses.map(m => calc(base.filter(r=>r.em.slice(0,7)===m)));
  const emps = [...new Set(todos.map(r=>r.empresa))].map(e => [e, calc(todos.filter(r=>r.empresa===e))]).sort((a,b)=>(a[1].nps??999)-(b[1].nps??999));
  const zona = x => x==null ? ["–","#8A968C","sem respostas"] : x>=75 ? ["🤩","#1F7A3F","zona de excelência"] : x>=50 ? ["😃","#5E9E2F","zona de qualidade"] : x>=0 ? ["😐","#B07A00","zona de aperfeiçoamento"] : ["😟","#B3261E","zona crítica"];
  const z = zona(k.nps);
  v.innerHTML = `<div class="row" style="justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap"><div><div class="eyebrow">Gestão · sócios</div><h2 style="font-size:1.35rem">NPS dos clientes 💚</h2></div>${F.emp?`<button class="btn" id="npsTodos">Ver todos os clientes</button>`:""}</div>
    <div class="nps-grid">
      <button class="nps-k t" data-f="" aria-pressed="${!F.f}"><b>${k.nps==null?"–":k.nps} ${z[0]}</b><span>NPS ${F.emp?"· "+esc(F.emp):"geral"} · ${z[2]}</span></button>
      <button class="nps-k p" data-f="p" aria-pressed="${F.f==="p"}"><b>${k.p}</b><span>😍 promotores (9–10)</span></button>
      <button class="nps-k n" data-f="n" aria-pressed="${F.f==="n"}"><b>${k.ne}</b><span>🙂 neutros (7–8)</span></button>
      <button class="nps-k d" data-f="d" aria-pressed="${F.f==="d"}"><b>${k.d}</b><span>😟 detratores (0–6)</span></button>
    </div>
    <p class="note">NPS = % de promotores − % de detratores. ${k.n} resposta(s). Toque num card para ver os comentários que formam o número.</p>
    <h3>📈 Evolução mês a mês</h3>
    <div class="nps-meses">${porMes.map((c,i) => { const h = c.nps==null ? 0 : Math.max(4, (c.nps+100)/2); const cz = zona(c.nps)[1];
      return `<div class="nps-m" title="${c.n} resposta(s)"><b>${c.nps==null?"":c.nps}</b><i style="height:${h}%;background:${cz}"></i>${MC[+meses[i].slice(5,7)-1]}</div>`; }).join("")}</div>
    <h3>🏢 Por cliente <span class="note" style="font-weight:400">(os que mais precisam de atenção primeiro)</span></h3>
    <div class="nps-emps">${emps.length ? emps.map(([e,c]) => `<button class="nps-e" data-emp="${esc(e)}" aria-pressed="${F.emp===e}"><b>${zona(c.nps)[0]} ${esc(e)}</b><span class="note">NPS ${c.nps} · ${c.n} resposta(s) · ${c.d} detrator(es)</span></button>`).join("") : `<p class="note">Ainda não há respostas. Elas chegam quando um marco da jornada é concluído e a cada 3 meses.</p>`}</div>
    ${F.emp ? "" : autHtml()}
    <h3>💬 O que os clientes disseram</h3>
    <div class="nps-com">${lista.length ? lista.slice(0, F.todos ? 500 : 30).map(r => `<div class="nps-c"><span class="nps-n" style="background:${corNota(r.nota)}">${r.nota}</span><b>${esc(r.empresa)}</b> · ${esc(r.nome||"")} · ${fmtD(r.em)} · ${r.motivo==="marco"?"após um marco":"trimestral"}${r.comentario?`<p style="margin:6px 0 0">“${esc(r.comentario)}”</p>`:""}</div>`).join("") : `<p class="note">Nenhuma resposta neste filtro.</p>`}</div>${lista.length>30 && !F.todos ? `<button class="btn" id="npsMais">Ver todos os ${lista.length} comentários</button>` : ""}`;
  v.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { F.f = b.dataset.f; desenharNPS(); });
  v.querySelectorAll("[data-emp]").forEach(b => b.onclick = () => { F.emp = F.emp===b.dataset.emp ? "" : b.dataset.emp; desenharNPS(); });
  const t = $j("#npsTodos"); if (t) t.onclick = () => { F.emp = ""; desenharNPS(); };
  const m = $j("#npsMais"); if (m) m.onclick = () => { F.todos = true; desenharNPS(); };
}
/* ----- gatilho: antes de chamar a Vital no WhatsApp, mostrar o que já está no portal ----- */
document.addEventListener("click", async e => {
  const a = e.target.closest && e.target.closest('a[href*="wa.me/"]'); if (!a || a.dataset.direto) return;
  if (!bind() || !S || !S.papel || eq() || !(a.href.includes("wa.me/"+WA))) return;
  e.preventDefault(); e.stopPropagation();
  if (!J.emp) { J.emps = await empresasJornada(); J.emp = J.emps[0] || ""; }
  if (J.emp && !J.docs.length) J.docs = await carregarDocs(J.emp);
  const ov = document.createElement("div"); ov.className = "nps-ov"; ov.setAttribute("role","dialog"); ov.setAttribute("aria-modal","true");
  ov.innerHTML = `<div class="nps-box"><h3>💬 Antes de chamar, talvez já esteja aqui</h3><p>Os documentos da ${esc(J.emp||"sua empresa")} ficam no portal, prontos para baixar a qualquer hora.</p>
    <div class="jor-chips">${AUTO.map(x=>`<button class="jor-chip" data-wauto="${x.k}">${x.ic} ${esc(x.t)}</button>`).join("")}</div><div id="wRes"></div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:12px"><button class="btn ghost" id="wFechar">Fechar</button><a class="btn primary" id="wSeguir" data-direto="1" href="${a.href}" target="_blank" rel="noopener">Não é isso, quero falar com a Vital</a></div></div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll("[data-wauto]").forEach(b => b.onclick = () => resolverAuto(b.dataset.wauto, ov.querySelector("#wRes"), "evitou_whats"));
  ov.querySelector("#wFechar").onclick = () => ov.remove();
  ov.querySelector("#wSeguir").addEventListener("click", () => { logAuto("conversa", "whatsapp"); setTimeout(() => ov.remove(), 300); });
  ov.addEventListener("click", ev => { if (ev.target===ov) ov.remove(); });
}, true);
})();

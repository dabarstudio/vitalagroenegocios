/* ===== Easter eggs da Vital =====
   - Mascote no canto da tela (muda conforme o setor do cliente): toque para ouvir uma piada; 5 toques = chuva temática.
   - 7 toques na logo da Vital = chuva temática + recado.
   - Código Konami (↑↑↓↓←→←→BA) ou digitar "vital" = chuva temática.
   - Recado no console do navegador, frase do dia no rodapé e festa (confete) no quadro de tarefas.
   O setor sai do nome da empresa (window.VITAL_EMP, definido pela Área do cliente e pelo Quadro). */
(function(){
if (window.VitalEgg) return;
const LS = { get(k){ try { return localStorage.getItem(k); } catch { return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch {} } };
const calmo = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const embed = () => document.documentElement.classList.contains("embed") || new URLSearchParams(location.search).get("embed")==="1";

const SET = {
  vital:   { re:/vital/i, masc:"🐄", nome:"Mimosa", modo:"Modo Porteira Aberta", chuva:["🌱","🐄","🌾","💚","🚜"],
    piadas:["Psiu! Caixa não é lucro, e lucro não é caixa. 🤫","Aqui a porteira está sempre aberta pra você. 🚪🐄","Contador que entende de boi? Temos. 🐂","Quem planta gestão colhe resultado. 🌱","O Leão até ruge, mas aqui ele não morde. 🦁","Planilha sem fórmula é igual pasto sem cerca: o gado foge. 🐮","Muuu-ito prazer! Eu sou a Mimosa, a mascote da Vital. 🐄"] },
  ambul:   { re:/arcanjo|ambul|emerg|resgate|sa[uú]de/i, masc:"🚑", nome:"Sirenildo", modo:"Modo Plantão 24h", chuva:["🚑","➕","🩺","💙","🚨"],
    piadas:["Sirene ligada! 🚨 Aqui o plantão financeiro é 24h, sem hora extra.","Pressão arterial do caixa: 12 por 8. Paciente estável! 🩺","Código vermelho só no DRE dos concorrentes. 😎","Ambulância boa é a que roda… e tem centro de custo certinho. 🚑","Boleto chegou três vezes? Calma, é um cartão só no quadro. 😅","Tempo-resposta da Vital: mais rápido que sirene em avenida vazia. 🏁","Transferência entre Life e Health não é receita. Já tentamos, o DRE não deixou. 😂"] },
  confeit: { re:/ateli|del[ií]cia|confeit|doce|bolo|padaria|caf[eé]/i, masc:"🧁", nome:"Brigadeirinha", modo:"Modo Confeitaria", chuva:["🧁","🎂","🍫","🍓","✨","🍰"],
    piadas:["Cada glitterzinho no bolo: R$ 35. A Vital aprova! ✨😂","Receita sem balança é bolo sem fermento: não cresce. ⚖️🎂","CMV de 30%? Isso sim é bolo bem recheado… de lucro. 🍰","Chantilly subiu? A gente sobe o preço com charme. 💅","Brigadeiro bom é o que segue a ficha técnica. 🍫","Bolo de 1 kg que sai com 1,1 kg é presente pro cliente… e prejuízo pra você. 😅","No Natal, panetone-bolo com preço certo é o verdadeiro milagre. 🎄"] },
  soja:    { re:/tnz|agro|gr[aã]o|soja|milho|agr[ií]cola|agrovista|s[aã]o gabriel/i, masc:"🌱", nome:"Grãozinho", modo:"Modo Safra", chuva:["🌱","🌾","🫘","🌽","🚜"],
    piadas:["Planta soja, colhe DFC. 🌱📊","Choveu na hora certa e o caixa fechou: dia perfeito no campo. 🌧️","Saca cheia, planilha cheia, coração tranquilo. 🌾","O Connectere exportou mil linhas? Bora pra segunda remessa! 🚜","Aqui a única praga é a do \"esqueci de lançar\". 🐛","Safra boa é a que termina com o fluxo de caixa no verde. 💚"] },
  boi:     { re:/vera cruz|pecu[aá]ria|boi|gado|nelore/i, masc:"🐂", nome:"Boi Bandido", modo:"Modo Invernada", chuva:["🐂","🌾","🌽","🐄","🤠"],
    piadas:["Boi gordo e caixa gordo: combinação perfeita. 🐂","Safrinha de sorgo com rateio certinho? Até o boi aplaude. 👏","Livro Caixa rural em dia: o Leão passa reto pela porteira. 🦁🚪","Arrendamento em sacas, conta em reais, risada em dobro. 🌽","Pecuária e agricultura separadas: cada boi no seu pasto. 🤠"] },
  leite:   { re:/retiro|leite|latic[ií]n|queij/i, masc:"🐄", nome:"Mimosa", modo:"Modo Ordenha", chuva:["🐄","🥛","🧀","🌾"],
    piadas:["Muuuito bem! A Mimosa aprova o seu LCDPR. 🐄","Leite tirado, nota lançada, ordenha concluída. 🥛","Vaca feliz dá mais leite. Cliente feliz dá mais indicação. 😉","Queijo curado é bom. Dívida curada é melhor ainda. 🧀","De manhã a ordenha, de tarde o fluxo de caixa. Vida de produtor! ☀️"] },
  tech:    { re:/tecnolog|amais|a mais|pluss|software|sistema|\bti\b/i, masc:"💻", nome:"Bit", modo:"Modo Deploy", chuva:["💻","☕","🐞","🚀","⌨️"],
    piadas:["Ctrl+Z não funciona em prejuízo. Por isso a gente concilia todo mês. 💻","Conciliação bancária: o único deploy que ninguém quer fazer na sexta. 😅","Bug no caixa? O debugger se chama DRE. 🐞","Café vira código, código vira receita, receita vira DRE. ☕","Funciona na minha máquina… e no extrato também! ✅","404 de dinheiro não encontrado? Aqui não. 🚀"] },
  diesel:  { re:/diesel|oficina|mec[aâ]nic|auto ?pe[cç]|pe[cç]as/i, masc:"🔧", nome:"Graxinha", modo:"Modo Oficina", chuva:["🔧","🚛","🛢️","⚙️","🔩"],
    piadas:["Troca de óleo do caixa a cada 30 dias. 🛢️","Motor diesel e planilha bem feita aguentam qualquer estrada. 🚛","Ordem de serviço lançada é ordem de serviço cobrada. 🔧","Barulho estranho no motor a gente escuta. No caixa, a Vital escuta. 👂","Peça trocada sem nota é parafuso a menos no lucro. 🔩"] },
  arq:     { re:/arquitet|maresia|urbanis|engenh|constru/i, masc:"📐", nome:"Régua", modo:"Modo Prancheta", chuva:["📐","🏠","🌊","✏️","🏖️"],
    piadas:["Planta baixa e imposto mais baixo ainda (salve o Fator R!). 📐","Projeto aprovado na prefeitura e no fluxo de caixa. 🏖️","Medida certa no projeto, pró-labore certo na empresa. ✏️","Escritório em casa, CNPJ na mão e pé na areia. 🌊"] }
};
const FRASES = ["Caixa não é lucro, lucro não é caixa.","Preço se forma com custo, não com o preço do vizinho.","O que não é medido não é gerenciado.","Despesa pequena todo dia vira despesa grande no fim do mês.","Separar a conta da empresa da conta pessoal é o primeiro passo.","Ponto de equilíbrio é onde a angústia acaba.","Estoque parado é dinheiro dormindo.","Quem não sabe o custo vende no prejuízo e acha que está ganhando.","Fluxo de caixa é o GPS da empresa.","Imposto planejado é imposto menor.","Margem boa é melhor que muita venda.","Conciliou o mês? Então você sabe onde está o dinheiro."];

const emp = () => String(window.VITAL_EMP || "");
const setor = () => { const e=emp(); if (e) for (const k of ["ambul","confeit","leite","boi","diesel","arq","tech","soja","vital"]) if (SET[k].re.test(e)) return SET[k]; return SET.vital; };

/* ===== estilo ===== */
const st=document.createElement("style"); st.textContent=`
.vegg-m{position:fixed;left:12px;bottom:14px;z-index:70;width:48px;height:48px;border-radius:50%;border:1px solid rgba(0,0,0,.12);background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.18);font-size:26px;line-height:1;display:grid;place-items:center;cursor:pointer;padding:0;transition:transform .15s}
.vegg-m:hover{transform:scale(1.08)}
.vegg-m.wig{animation:vegg-wig .9s ease-in-out}
@keyframes vegg-wig{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}40%{transform:rotate(12deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(5deg)}}
.vegg-psiu{position:fixed;left:66px;bottom:26px;z-index:70;background:#00582F;color:#fff;font:700 12px/1 system-ui,sans-serif;padding:6px 9px;border-radius:999px;pointer-events:none;animation:vegg-in .3s ease-out}
.vegg-b{position:fixed;left:12px;bottom:72px;z-index:71;max-width:min(300px,calc(100vw - 24px));background:#fff;color:#18241B;border:1px solid #D3DECD;border-radius:16px 16px 16px 4px;box-shadow:0 10px 28px rgba(0,0,0,.18);padding:12px 14px;font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;animation:vegg-in .2s ease-out}
.vegg-b b{display:block;font-size:12px;color:#57665A;margin-bottom:4px}
.vegg-b .vegg-x{position:absolute;top:4px;right:6px;border:0;background:transparent;color:#57665A;font-size:12px;cursor:pointer;padding:4px}
.vegg-b small{display:block;margin-top:6px;color:#57665A;font-size:12px}
@keyframes vegg-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.vegg-c{position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden}
.vegg-c span{position:absolute;top:-8vh;will-change:transform;animation:vegg-cai linear forwards}
@keyframes vegg-cai{to{transform:translateY(118vh) rotate(var(--r,360deg))}}
.vegg-t{position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:10000;background:#00582F;color:#fff;font:800 18px/1.3 system-ui,sans-serif;padding:12px 18px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);text-align:center;max-width:calc(100vw - 32px);animation:vegg-in .25s ease-out}
.vegg-frase{font-size:.82rem;opacity:.8;margin:6px 0 0;font-style:italic}
body.vegg-on footer{padding-bottom:72px!important}
@media print{.vegg-m,.vegg-b,.vegg-psiu,.vegg-c,.vegg-t{display:none!important}}`;
document.head.appendChild(st);

/* ===== efeitos ===== */
function aviso(txt, ms=3200){ const t=document.createElement("div"); t.className="vegg-t"; t.setAttribute("role","status"); t.textContent=txt; document.body.appendChild(t); setTimeout(()=>t.remove(), ms); }
function chuva(itens, n=46){ if (calmo()) return; const c=document.createElement("div"); c.className="vegg-c"; c.setAttribute("aria-hidden","true");
  for (let i=0;i<n;i++){ const s=document.createElement("span"); s.textContent=itens[i%itens.length]; const d=2.6+Math.random()*2.6;
    s.style.cssText=`left:${Math.random()*100}vw;font-size:${18+Math.random()*22}px;animation-duration:${d}s;animation-delay:${Math.random()*1.4}s;--r:${(Math.random()*720-360)|0}deg`; c.appendChild(s); }
  document.body.appendChild(c); setTimeout(()=>c.remove(), 6000); }
function festa(msg, itens){ const s=setor(); chuva(itens||["🎉","🎊","✨"].concat(s.chuva.slice(0,2)), 60); if (msg) aviso(msg); }
function modo(){ const s=setor(); chuva(s.chuva); aviso(`${s.masc} ${s.modo} ativado!`); }

/* ===== mascote ===== */
let bolha=null, toques=0, tT=null, idx=+(LS.get("vegg.i")||0);
function fechaBolha(){ if (bolha){ bolha.remove(); bolha=null; } }
function falar(){ const s=setor(); const extra=window.VITAL_EGG_EXTRA||[]; const L=[...extra, ...s.piadas]; const txt=L[idx%L.length]; idx++; LS.set("vegg.i", idx);
  fechaBolha(); bolha=document.createElement("div"); bolha.className="vegg-b"; bolha.setAttribute("role","status");
  bolha.innerHTML=`<button class="vegg-x" type="button" aria-label="Esconder a mascote por 7 dias" title="Esconder por 7 dias">esconder ✕</button><b>${s.masc} ${s.nome} diz:</b><span></span><small>Toque de novo para outra… ou 5 vezes seguidas 😉</small>`;
  bolha.querySelector("span").textContent=txt; document.body.appendChild(bolha);
  bolha.querySelector(".vegg-x").onclick=()=>{ LS.set("vegg.off", String(Date.now()+7*864e5)); fechaBolha(); const m=document.querySelector(".vegg-m"); m&&m.remove(); document.body.classList.remove("vegg-on"); };
  /* a frase fica na tela até o próximo toque na mascote (sem troca automática) */ }
function mascote(){ if (embed()) return; const off=+(LS.get("vegg.off")||0); if (off>Date.now()) return; if (document.querySelector(".vegg-m")) return;
  const b=document.createElement("button"); b.type="button"; b.className="vegg-m"; b.setAttribute("aria-label","Mascote da Vital: toque para uma surpresa");
  const pinta=()=>{ const s=setor(); b.textContent=s.masc; b.title=`${s.nome} · toque aqui 👀`; }; pinta(); document.body.appendChild(b); document.body.classList.add("vegg-on");
  b.onclick=()=>{ pinta(); toques++; clearTimeout(tT); tT=setTimeout(()=>toques=0, 2500); if (toques>=5){ toques=0; fechaBolha(); modo(); return; } falar(); };
  setInterval(()=>{ pinta(); if (!calmo() && document.visibilityState==="visible") { b.classList.remove("wig"); void b.offsetWidth; b.classList.add("wig"); } }, 40000);
  if (!LS.get("vegg.psiu")) { setTimeout(()=>{ const p=document.createElement("div"); p.className="vegg-psiu"; p.textContent="psiu! 👀"; document.body.appendChild(p); b.classList.add("wig"); setTimeout(()=>p.remove(), 6000); LS.set("vegg.psiu","1"); }, 2500); }
  else setTimeout(()=>{ if (!calmo()) b.classList.add("wig"); }, 3000); }

/* ===== 7 toques na logo ===== */
let lt=0, ltT=null, navT=null;
document.addEventListener("click", e=>{ const el=e.target.closest && e.target.closest("a.logo, .logo img, img[src*='logo.png']"); if (!el) return;
  const a=el.closest("a"); if (a && a.href) { e.preventDefault(); clearTimeout(navT); }
  lt++; clearTimeout(ltT); ltT=setTimeout(()=>lt=0, 2500);
  if (lt>=7){ lt=0; const s=setor(); chuva(s.chuva.concat(["💚"])); aviso(`Você achou o segredo da logo! ${s.masc} Quem planta gestão colhe resultado.`, 4200); return; }
  if (a && a.href && lt===1) navT=setTimeout(()=>{ if (lt<=1) { if (a.target==="_blank") open(a.href,"_blank","noopener"); else location.href=a.href; } }, 450); }, true);

/* ===== Konami ou "vital" ===== */
const K=["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"]; let kp=0, buf="";
document.addEventListener("keydown", e=>{ const t=e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  const k=e.key.length===1?e.key.toLowerCase():e.key; kp = (k===K[kp]) ? kp+1 : (k===K[0]?1:0); if (kp===K.length){ kp=0; modo(); }
  if (e.key.length===1){ buf=(buf+e.key.toLowerCase()).slice(-5); if (buf==="vital"){ buf=""; modo(); } } });

/* ===== console ===== */
try { console.log("%c🐄 Muuu! Curioso, né?","font:800 18px system-ui;color:#00582F"); console.log("%cA Vital também gosta de olhar por baixo do capô. 🚜 Gestão, controladoria e números do campo. Fale com a gente pelo site!","font:13px system-ui;color:#57665A"); console.log("%cDica: tente ↑ ↑ ↓ ↓ ← → ← → B A nesta página. 😉","font:12px system-ui;color:#79C25B"); } catch {}

/* ===== frase do dia no rodapé ===== */
function frase(){ const f=document.querySelector("footer"); if (!f || f.querySelector(".vegg-frase")) return; const d=new Date(); const i=(d.getFullYear()*372+d.getMonth()*31+d.getDate())%FRASES.length;
  const p=document.createElement("p"); p.className="vegg-frase"; p.textContent="💡 Frase do dia: "+FRASES[i]; f.appendChild(p); }

const ini=()=>{ mascote(); frase(); };
if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", ini); else ini();
window.VitalEgg = { festa, modo, chuva, aviso, setor };
})();

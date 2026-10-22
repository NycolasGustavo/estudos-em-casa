/* Estudos em Casa — front-end (sem build, sem dependências) */
(function () {
"use strict";

/* ---------------- utilidades ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtN = n => (Math.round(Number(n) * 10) / 10).toFixed(1).replace(".", ",");
const clsNota = n => n >= 8.5 ? "s-ok" : n >= 7 ? "s-warn" : "s-bad";
const hoje = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const dataBR = s => { if (!s) return ""; const [y, m, d] = String(s).slice(0, 10).split("-"); return d ? `${d}/${m}` : s; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 3200); }
const MATERIAS = ["Português", "Matemática", "PLE", "Inglês", "Disciplinar", "Artes", "Informática", "Educação Física"];
const TIPOS_NOTA = ["Prova (escola)", "Simulado (escola)", "Trabalho (escola)", "Atividade (escola)", "Tarefa de casa (escola)", "Olimpíada"];

/* ---------------- API ---------------- */
let sess = store.get("estudos-sessao", null);
async function api(acao, dados = {}) {
  const cfg = window.ESTUDOS || {};
  if (!cfg.url || !cfg.chave) throw new Error("O site ainda não foi ligado ao banco de dados (config.js).");
  const corpo = { acao, dados: Object.assign({ token: sess && sess.token }, dados) };
  let r;
  try {
    const res = await fetch(cfg.url + "/rest/v1/rpc/api", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.chave, Authorization: "Bearer " + cfg.chave },
      body: JSON.stringify(corpo)
    });
    r = await res.json();
  } catch (e) { throw new Error("Sem conexão com o servidor. Confira a internet e tente de novo."); }
  if (!r || r.ok === undefined) throw new Error((r && r.message) || "Resposta inesperada do servidor.");
  if (!r.ok) {
    if (r.erro === "sessao") { sair(true); throw new Error(r.msg || "Entre de novo."); }
    throw new Error(r.erro || "Algo deu errado.");
  }
  return r.dados;
}
function sair(silencioso) {
  if (sess && !silencioso) api("sair").catch(() => { });
  sess = null; store.del("estudos-sessao");
  location.hash = "#/entrar"; render();
}

/* ---------------- roteador ---------------- */
const app = $("#app");
let cache = {};
window.addEventListener("hashchange", render);
function rota() { return (location.hash || "#/").slice(1).split("?")[0].split("/").filter(Boolean); }
async function render() {
  const r = rota();
  if (!sess) { if (r[0] !== "entrar") { location.hash = "#/entrar"; return; } return telaLogin(); }
  const adulto = sess.papel === "adulto";
  app.className = "wrap" + (adulto && r[0] === "adulto" ? " wide" : "");
  try {
    if (r[0] === "entrar") { if (adulto) { location.href = "painel.html"; return; } location.hash = "#/"; return; }
    if (r[0] === "prova") return await telaProva(decodeURIComponent(r[1]));
    if (r[0] === "resultado") return await telaResultado(decodeURIComponent(r[1]));
    if (r[0] === "tabuada") return await telaTabuada(decodeURIComponent(r[1] || ""));
    if (r[0] === "pausa") return await telaPausa(decodeURIComponent(r[1] || ""));
    if (r[0] === "pare") return await telaPare(decodeURIComponent(r[1] || ""));
    if (r[0] === "revisar") return await telaRevisar();
    if (r[0] === "video") { pararFala(); return await telaVideo(decodeURIComponent(r[1] || "")); }
    if (r[0] === "adulto" && adulto) {
      if (r[1] === "tentativa") return await telaTentativaAdulto(decodeURIComponent(r[2]));
      if (r[1] === "ver") return await telaVerProva(decodeURIComponent(r[2]));
      if (r[1] === "correcao") return await telaAdulto("correcao");
      location.href = "painel.html"; return;
    }
    if (adulto && !r[0]) { location.href = "painel.html"; return; }
    pararFala(); app.onkeydown = null; return await telaAluna(r[0] === "aluna" ? (r[1] || "hoje") : (r[0] || "hoje"));
  } catch (e) {
    app.innerHTML = topo() + `<div class="panel stack"><h2>Não consegui carregar</h2><p>${esc(e.message)}</p><div><button id="tentar">Tentar de novo</button></div></div>`;
    $("#tentar").onclick = render;
  }
}
function topo(extra = "") {
  return `<header class="top"><a class="brand" href="${sess && sess.papel === "adulto" ? "painel.html" : "#/"}" style="text-decoration:none"><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" fill="var(--accent)"/><path d="M6 9c3-1.5 5.5-1.5 8 0v11c-2.5-1.5-5-1.5-8 0zM22 9c-3-1.5-5.5-1.5-8 0v11c2.5-1.5 5-1.5 8 0z" fill="#fff"/></svg>Estudos em Casa</a><div class="row">${extra}<span class="muted hide-sm">${esc(sess.nome)}</span><button class="mini ghost" id="sair">Sair</button></div></header>`;
}
document.addEventListener("click", e => { if (e.target.id === "sair") sair(); });
function carregando(msg = "Carregando…") { app.innerHTML = (sess ? topo() : "") + `<p class="muted" style="padding:30px 0">${msg}</p>`; }

/* ---------------- login ---------------- */
function telaLogin() {
  app.className = "wrap";
  let pin = "";
  const agora = new Date(), aula = infoAula(agora);
  const saud = agora.getHours() < 12 ? "Bom dia" : agora.getHours() < 18 ? "Boa tarde" : "Boa noite";
  app.innerHTML = `<div class="login2"><section class="lg-arte">
      <div class="lg-marca"><svg width="34" height="34" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" fill="#fff"/><path d="M6 9c3-1.5 5.5-1.5 8 0v11c-2.5-1.5-5-1.5-8 0zM22 9c-3-1.5-5.5-1.5-8 0v11c2.5-1.5 5-1.5 8 0z" fill="#2F55C9"/></svg><span>Estudos em Casa</span></div>
      <div class="lg-sol">${solSVG("fome", 0, 190)}</div>
      <h1>${saud}!</h1><p>A Sol está esperando você para estudar.</p>
      <div class="lg-aula">${ico("escola", 18)}<span>${DIAS[agora.getDay()]} · ${aula.aulas.length ? `aula de ${esc(aula.titulo)} às 13:15` : esc(aula.linha)}</span></div>
    </section>
    <section class="lg-form">
      <h2>Digite o seu PIN</h2><p class="muted small">São 6 números. Pode usar o teclado do computador.</p>
      <div class="pin" id="pin"></div>
      <div class="erro" id="erro"></div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "OK"].map(k => `<button data-k="${k}" class="${k === "OK" ? "ok" : k === "⌫" ? "apaga" : ""}" aria-label="${k === "⌫" ? "apagar" : k === "OK" ? "entrar" : k}">${k === "OK" ? "Entrar" : k}</button>`).join("")}</div>
    </section></div>`;
  const pinsEl = $("#pin");
  const desenha = () => { const n = Math.max(6, pin.length); pinsEl.innerHTML = Array.from({ length: n }, (_, i) => `<span class="${i < pin.length ? "f" : ""}">${i < pin.length ? "•" : ""}</span>`).join(""); };
  const enviar = async () => {
    if (!pin) return;
    $("#erro").textContent = "Conferindo…";
    try { const d = await api("login", { pin }); sess = d; store.set("estudos-sessao", d); if (d.papel === "adulto") { location.href = "painel.html"; return; } location.hash = "#/"; render(); }
    catch (e) { $("#erro").textContent = e.message; pin = ""; desenha(); }
  };
  desenha();
  const tecla = k => { if (k === "⌫") pin = pin.slice(0, -1); else if (k === "OK") return enviar(); else if (pin.length < 8) { pin += k; $("#erro").textContent = ""; } desenha(); if (pin.length === 6 && k !== "⌫") setTimeout(enviar, 150); };
  app.querySelectorAll(".pad button").forEach(b => b.onclick = () => tecla(b.dataset.k));
  document.onkeydown = e => { if (!$("#pin")) { document.onkeydown = null; return; } if (/^\d$/.test(e.key)) tecla(e.key); else if (e.key === "Backspace") tecla("⌫"); else if (e.key === "Enter") enviar(); };
}

/* ---------------- gráficos ---------------- */
function grafico(series, { xs, yMax = 10, refs = [], altura = 220, rotulos } = {}) {
  const W = 640, H = altura, L = 34, R = 12, T = 12, B = 30;
  const n = xs.length;
  const X = i => n <= 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (n - 1);
  const Y = v => T + (1 - v / yMax) * (H - T - B);
  let g = "";
  [0, 2, 4, 6, 8, 10].forEach(v => g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`);
  refs.forEach(r => g += `<line x1="${L}" x2="${W - R}" y1="${Y(r.v)}" y2="${Y(r.v)}" stroke="${r.cor}" stroke-dasharray="5 4" stroke-width="1.3"/>`);
  const passo = Math.max(1, Math.ceil(n / 8));
  xs.forEach((x, i) => { if (i % passo === 0 || i === n - 1) g += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${esc(rotulos ? rotulos[i] : x)}</text>`; });
  series.forEach(s => {
    const pts = s.vals.map((v, i) => v == null ? null : [X(i), Y(v)]);
    let d = "", aberto = false;
    pts.forEach(p => { if (!p) { aberto = false; return; } d += (aberto ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); aberto = true; });
    if (s.ligar) { d = ""; pts.filter(Boolean).forEach((p, i) => d += (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)); }
    g += `<path d="${d}" fill="none" stroke="${s.cor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach((p, i) => { if (p) g += `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 || !pts[i + 1] ? 4.5 : 3.2}" fill="${s.cor}"><title>${esc(s.nome)} · ${esc(rotulos ? rotulos[i] : xs[i])}: ${fmtN(s.vals[i])}</title></circle>`; });
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de notas">${g}</svg>`;
}
function semanaISO(s) {
  const d = new Date(String(s).slice(0, 10) + "T12:00:00");
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dia);
  const ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { ano: t.getUTCFullYear(), sem: Math.ceil(((t - ini) / 864e5 + 1) / 7) };
}
function anel(n) {
  const r = 52, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, n / 10));
  const cor = n >= 8.5 ? "var(--ok)" : n >= 7 ? "var(--sun)" : "var(--bad)";
  return `<svg class="ring" viewBox="0 0 130 130" aria-hidden="true"><circle cx="65" cy="65" r="${r}" fill="none" stroke="var(--line)" stroke-width="12"/><circle cx="65" cy="65" r="${r}" fill="none" stroke="${cor}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 65 65)"/><text x="65" y="75" text-anchor="middle" font-family="Bricolage Grotesque, Figtree, sans-serif" font-size="32" font-weight="600" fill="currentColor">${fmtN(n)}</text></svg>`;
}

/* ---------------- tela da aluna ---------------- */
const MATCOR = { "Português": "#7A4FD6", "Matemática": "#D2632A", "PLE": "#A23E8C", "Inglês": "#C2413A", "Artes": "#B8860B", "Educação Física": "#8E5A2B", "Leitura": "#7A4FD6", "Disciplinar": "#0E7C86", "Informática": "#5E6483", "Geral": "#7A6A53" };
const corMat = m => MATCOR[m] || "#5E6483";
const ehGrande = t => /prova|simulado|olimp|trabalho/i.test(t || "");
const ehCasa = t => /\(casa\)/i.test(t || "");
const tipoCurto = t => String(t || "").replace(/\s*\((escola|casa)\)\s*/i, "") || "Atividade";
const diasAte = d => Math.round((new Date(d + "T12:00:00") - new Date(hoje() + "T12:00:00")) / 864e5);
const quando = n => n === 0 ? "hoje" : n === 1 ? "amanhã" : n > 1 ? `em ${n} dias` : n === -1 ? "ontem" : `há ${-n} dias`;
const TIPO_PROVA = { simulado: "Simulado", prova: "Prova", atividade: "Atividade", revisao: "Revisão", aquecimento: "Aquecimento", reforco: "Reforço" };
const VALE_NOTA = t => t === "prova" || t === "simulado";
const CHECK_ENTREGA = [["li", "Li cada pergunta com calma, até o fim."], ["tipo", "Nos problemas, vi se era juntar, tirar, comparar, repartir ou vezes."], ["conferi", "Conferi as contas e as respostas antes de entregar."]];
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const AULAS = { 1: ["Disciplinar", "Educação Física"], 2: ["Inglês", "PLE · Leitura e Escrita"], 3: ["Artes", "Informática"], 4: ["Português"], 5: ["Matemática"] };
const MANHA = {
  1: [["Revisão de ontem", "Matemática de sexta"], ["Preparar a aula", "Disciplinar"], ["Missão do dia", "Português"]],
  2: [["Revisão de ontem", "Disciplinar"], ["Preparar a aula", "Leitura e Inglês"], ["Extra", "Ler em voz alta"]],
  3: [["Revisão de ontem", "Leitura de terça"], ["Missão do dia", "Matemática"]],
  4: [["Revisão de ontem", "Matemática de quarta"], ["Preparar a aula", "Português"]],
  5: [["Revisão de ontem", "Português de quinta"], ["Preparar a aula", "Matemática"]],
  6: [["Simulado ou prova", "Português e Matemática"], ["Livro", "Ler um pouco"]]
};
const ICO = {
  hoje: '<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
  aulas: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  notas: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  materias: '<path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 0 2 2h13"/>',
  agenda: '<path d="M9 4h6M9 2h6v4H9z"/><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 12h6M9 16h4"/>',
  livros: '<path d="M2 5c3-1.5 6-1.5 10 0v15c-4-1.5-7-1.5-10 0zM22 5c-3-1.5-6-1.5-10 0v15c4-1.5 7-1.5 10 0z"/>',
  gravar: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/>',
  escola: '<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-5h6v5M12 8.5v.01"/>',
  casa: '<path d="M3 11l9-7 9 7M5 9.5V21h14V9.5M10 21v-6h4v6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  erros: '<path d="M5 3h11l3 3v15H5z"/><path d="M9 10l6 6M15 10l-6 6"/>',
  cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  aprender: '<rect x="2" y="4" width="20" height="14" rx="3"/><path d="M10 8.5v5l4.5-2.5z" fill="currentColor"/><path d="M8 21h8"/>',
  som: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>'
};
const ico = (n, s = 22) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;
const MUNDO = { escola: { nome: "ESCOLA", cor: "var(--escola)", ico: "escola" }, casa: { nome: "CASA", cor: "var(--casa)", ico: "casa" } };
const faixa = (m, txt) => `<div class="faixa" style="--w:${MUNDO[m].cor}">${ico(MUNDO[m].ico, 22)}<b>${MUNDO[m].nome}</b>${txt ? `<span>${txt}</span>` : ""}</div>`;

/* fala (texto para voz) */
function falar(texto, lang = "pt-BR") {
  try {
    const s = window.speechSynthesis; if (!s) return toast("Este navegador não tem leitura em voz alta.");
    s.cancel();
    const u = new SpeechSynthesisUtterance(String(texto).replace(/\*\*/g, ""));
    u.lang = lang; u.rate = lang === "pt-BR" ? 0.95 : 0.85;
    const v = s.getVoices().find(v => v.lang && v.lang.replace("_", "-").toLowerCase().startsWith(lang.toLowerCase().slice(0, 5)));
    if (v) u.voice = v;
    s.speak(u);
  } catch (e) { toast("Não consegui ler em voz alta."); }
}
function pararFala() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { } }

/* widget da aula de hoje */
function infoAula(agora = new Date()) {
  const dia = agora.getDay(), aulas = AULAS[dia];
  const min = agora.getHours() * 60 + agora.getMinutes(), ini = 13 * 60 + 15, fim = 17 * 60 + 15;
  if (!aulas) {
    let d = new Date(agora); do { d.setDate(d.getDate() + 1); } while (!AULAS[d.getDay()]);
    return { titulo: "Sem aula hoje", linha: `${DIAS[d.getDay()]}: ${AULAS[d.getDay()].join(" e ")}`, estado: "folga", aulas: [] };
  }
  let estado, linha;
  if (min < ini) { const f = ini - min; estado = "antes"; linha = `Começa em ${f >= 60 ? Math.floor(f / 60) + "h" + String(f % 60).padStart(2, "0") : f + " min"}`; }
  else if (min < fim) { estado = "agora"; linha = "Aula agora · termina às 17:15"; }
  else { estado = "depois"; linha = "As aulas de hoje terminaram"; }
  return { titulo: aulas.join(" e "), linha, estado, aulas };
}
function widgetAula() {
  const a = infoAula();
  return `<div class="aula-w ${a.estado}" id="aula-w" tabindex="0">${ico("escola", 26)}<div><span class="aw-k">${a.estado === "folga" ? "Escola" : "Aula de hoje · 13:15 às 17:15"}</span><b>${esc(a.titulo)}</b><span class="aw-l">${esc(a.linha)}</span></div>
    <div class="aw-tip" role="tooltip"><b>${DIAS[new Date().getDay()]}</b>${a.aulas.length ? a.aulas.map(x => `<div>${esc(x)}</div>`).join("") + "<div class='muted small'>13:15 às 17:15</div>" : `<div class="muted small">${esc(a.linha)}</div>`}</div></div>`;
}
setInterval(() => { const w = document.getElementById("aula-w"); if (w) w.outerHTML = widgetAula(); }, 30000);

/* concha da aluna: menu lateral */
const NAV = [["hoje", "Hoje"], ["aprender", "Aprender"], ["aulas", "Agenda"], ["notas", "Minhas notas"], ["materias", "Matérias"], ["livros", "Livros"], ["erros", "Caderno de erros"]];
function concha(aba, titulo, corpo, d) {
  const of = d ? ofensiva(d) : null;
  const base = sess.papel === "adulto" ? "#/aluna/" : "#/";
  return `<div class="shell"><aside class="side"><a class="brand" href="${base}hoje"><svg width="30" height="30" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" fill="var(--accent)"/><path d="M6 9c3-1.5 5.5-1.5 8 0v11c-2.5-1.5-5-1.5-8 0zM22 9c-3-1.5-5.5-1.5-8 0v11c2.5-1.5 5-1.5 8 0z" fill="#fff"/></svg><span>Estudos<br>em Casa</span></a>
    <nav class="snav">${NAV.map(([k, l]) => `<a href="${base}${k}" class="${aba === k ? "on" : ""}">${ico(k)}<span>${l}</span></a>`).join("")}</nav>
    ${of ? `<a class="side-of" href="${base}hoje" title="Ofensiva: dias seguidos com todo o estudo feito">${chamaSVG(of.hojeOk || of.dias > 0, 26)}<b>${of.dias}</b><span>${of.dias === 1 ? "dia" : "dias"} de ofensiva</span></a>` : ""}<div class="side-foot">${sess.papel === "adulto" ? `<a class="btn ghost mini" href="painel.html">Painel dos adultos</a>` : ""}<span>${esc(sess.nome)}</span><button class="mini ghost" id="sair">Sair</button></div></aside>
    <main class="main"><div class="mtop"><h1>${titulo}</h1>${widgetAula()}</div><div class="stack" id="corpo">${corpo}</div></main></div>`;
}

function cartaoNota(n) {
  const m = MUNDO[n.origem];
  const corpo = `<div class="mundo" style="--w:${m.cor}">${ico(m.ico, 26)}<b>${m.nome}</b></div>
    <div class="nc-l"><div class="row" style="gap:6px"><span class="mchip" style="--mc:${corMat(n.materia)}">${esc(n.materia)}</span><span class="tam ${n.grande ? "g" : "p"}">${n.grande ? "Avaliação grande" : "Atividade pequena"}</span></div>
    <b class="nc-t">${esc(n.titulo || tipoCurto(n.tipo))}</b><span class="muted small">${tipoCurto(n.tipo)} · ${dataBR(n.data)}${n.total ? ` · ${n.acertos} de ${n.total}` : ""}</span>${n.comentario ? `<span class="small nc-c">“${esc(n.comentario)}”</span>` : ""}</div>
    <span class="score ${clsNota(n.nota)}">${fmtN(n.nota)}</span>`;
  return n.tentativa ? `<a class="ncard" style="--w:${m.cor}" href="#/resultado/${encodeURIComponent(n.tentativa)}">${corpo}</a>` : `<div class="ncard" style="--w:${m.cor}">${corpo}</div>`;
}
function cartaoProva(p) {
  const iniciada = !!store.get("rasc-" + p.id);
  return `<div class="pcard" style="--mc:${corMat(p.materia)}"><div class="stack" style="gap:6px;flex:1;min-width:0">
     <div class="row" style="gap:6px"><span class="mchip" style="--mc:${corMat(p.materia)}">${esc(p.materia)}</span><span class="tag">${TIPO_PROVA[p.tipo] || "Prova"}</span>${iniciada ? '<span class="tag warn">em andamento</span>' : ""}${p.liberarEm && p.liberarEm < hoje() ? `<span class="tag bad">era para ${dataBR(p.liberarEm)}</span>` : ""}</div>
     <h3>${esc(p.titulo)}</h3>${p.descricao ? `<p class="muted small">${esc(p.descricao)}</p>` : ""}
     ${(p.assuntos || []).length ? `<div class="small"><b>O que cai:</b> ${(p.assuntos || []).slice(0, 6).map(esc).join(" · ")}</div>` : ""}
     <span class="muted small">${p.totalQuestoes} perguntas${p.minutos ? ` · cerca de ${p.minutos} min` : ""}</span></div>
     <a class="btn" href="#/prova/${encodeURIComponent(p.id)}">${iniciada ? "Continuar" : "Começar"}</a></div>`;
}
function cartaoAgenda(a, podeApagar) {
  const n = diasAte(a.data);
  return `<div class="acard ${n < 0 ? "passou" : ""}" style="--mc:${corMat(a.materia)}"><div class="adata"><b>${dataBR(a.data)}</b><span>${quando(n)}</span></div>
    <div style="flex:1;min-width:0"><div class="row" style="gap:6px"><span class="mchip" style="--mc:${corMat(a.materia)}">${esc(a.materia)}</span><b>${esc(a.tipo)}</b></div>
    ${a.conteudo ? `<div class="small">${esc(a.conteudo)}</div>` : ""}<span class="muted small">${a.confirmado ? "✓ visto por um adulto" : "aguardando o visto de um adulto"}</span></div>
    ${podeApagar && !a.confirmado ? `<button class="mini ghost" data-agdel="${esc(a.id)}">Apagar</button>` : ""}</div>`;
}

async function telaAluna(aba) {
  app.className = "shell-wrap";
  if (aba === "agenda") aba = "aulas";
  if (!NAV.some(t => t[0] === aba) && aba !== "ler" && aba !== "ensina") aba = "hoje";
  if (telaAluna.ultima !== aba) { semanaOff = 0; telaAluna.ultima = aba; }
  if (!cache.aluna) app.innerHTML = `<p class="muted" style="padding:40px">Carregando…</p>`;
  const d = await api("inicioAluna");
  cache.aluna = d;
  const primeiro = (d.nome || sess.nome || "").split(" ")[0];
  const T = { hoje: `Oi, <span class="hl">${esc(primeiro)}</span>!`, aulas: "Minha agenda", notas: "Minhas notas", materias: "Matérias", agenda: "Agenda", livros: "Livros", ler: "Ler em voz alta", ensina: "Me ensina", erros: "Caderno de erros", aprender: "Aprender com vídeos" };
  const f = { hoje: abaHoje, aulas: abaAulas, notas: abaNotas, materias: abaMaterias, agenda: abaAgenda, livros: abaLivros, ler: abaLer, ensina: abaEnsina, erros: abaErros, aprender: abaAprender }[aba];
  app.innerHTML = concha(aba === "ler" || aba === "ensina" ? "hoje" : aba, T[aba], f(d), d);
  ligarAluna(d);
}

/* ---------- datas e estado dos itens do plano ---------- */
const addDias = (iso, n) => { const x = new Date(iso + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const segundaDe = iso => { const x = new Date(iso + "T12:00:00"); return addDias(iso, -((x.getDay() + 6) % 7)); };
const DCURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const diaSem = iso => new Date(iso + "T12:00:00").getDay();
let semanaOff = 0;
function itemFeito(d, plano, it) {
  if (it.provaId) { const p = d.provas.find(x => x.id === it.provaId); return !!(p && p.feita); }
  return d.feitos.includes(it.id);
}
// feito | hoje | atrasado | bloqueado
function estadoItem(d, dia, it) {
  if (itemFeito(d, null, it)) return "feito";
  if (descartado(d, it)) return "descartado";
  const h = d.hoje || hoje();
  if (dia > h) return "bloqueado";
  return dia < h ? "atrasado" : "hoje";
}
const urlLer = it => `#/${sess.papel === "adulto" ? "aluna/" : ""}ler?item=${encodeURIComponent(it.id)}`;
function acaoItem(d, it) {
  if (it.provaId) return `<a class="btn" href="#/prova/${encodeURIComponent(it.provaId)}">${store.get("rasc-" + it.provaId) ? "Continuar" : "Começar"}</a>`;
  if (it.acao === "tabuada") return `<a class="btn" href="#/tabuada/${encodeURIComponent(it.id)}">Jogar</a>`;
  if (it.acao === "erros") return `<a class="btn" href="#/revisar">Revisar</a>`;
  if (it.acao === "video" && it.yt) return `<a class="btn" href="${urlVideo(it.yt, it.id)}">${ico("aprender", 18)} Assistir</a>`;
  if (it.acao === "gravar" || it.acao === "ler") return `<a class="btn" href="${urlLer(it)}">Ler</a>`;
  if (it.acao === "livro") return `<button class="ghost" data-feito="${esc(it.id)}">Li hoje</button>`;
  if (it.acao === "pare") return `<a class="btn" href="#/pare/${encodeURIComponent(it.id)}">Jogar</a>`;
  if (it.acao === "pausa") return `<a class="btn" href="#/pausa/${encodeURIComponent(it.id)}">Fazer a pausa</a>`;
  if (it.acao === "meensina") return `<span style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;white-space:nowrap">${sess.papel !== "adulto" ? `<a class="btn ghost mini" href="#/ensina?item=${encodeURIComponent(it.id)}">Gravar (opcional)</a>` : ""}<span class="trava">${ico("check", 18)} Um adulto marca à tarde</span></span>`;
  return `<button class="ghost" data-feito="${esc(it.id)}">Marcar feito</button>`;
}
const MOMENTO = { aquecimento: ["Aquecimento", "#B8860B"], frio: ["Revisão de ontem · sangue frio", "#0E7C86"], quente: ["Preparar a aula de hoje · sangue quente", "#D2632A"], missao: ["Missão do dia", "#7A4FD6"], video: ["Aula em vídeo · aprender", "#D2632A"], ingles: ["Inglês", "#0E7C86"], meensina: ["Me ensina · com um adulto", "#2F7D4F"], pausa: ["Pausa ativa · mexa o corpo", "#2F7D4F"], recuperacao: ["Recuperação dos erros", "#B7791F"], prova: ["Prova · vale nota", "#C2413A"], simulado: ["Simulado · vale nota", "#C2413A"], extra: ["Extra", "#5E6483"], livro: ["Livro", "#5E6483"] };
function linhaItem(d, dia, it, i, ativo, depoisPausa) {
  const st = estadoItem(d, dia, it);
  const m = MOMENTO[it.momento] || ["Atividade", "#5E6483"];
  let botao;
  if (st === "feito") botao = `<span class="feito">${ico("check", 18)} Feito</span>`;
  else if (st === "bloqueado") botao = `<span class="trava">${ico("cadeado", 18)} Abre ${DCURTO[diaSem(dia)].toLowerCase()} ${dataBR(dia)}</span>`;
  else if (depoisPausa) botao = `<span class="trava">${ico("cadeado", 18)} Depois da pausa</span>`;
  else botao = acaoItem(d, it);
  return `<div class="item ${st === "feito" ? "ok" : ""} ${st === "bloqueado" ? "lock" : ""} ${ativo ? "ativo" : ""}"><div class="inum">${st === "feito" ? ico("check", 20) : st === "bloqueado" ? ico("cadeado", 18) : i + 1}</div>
    <div class="ibody"><span class="mom" style="--mm:${m[1]}">${m[0]}${it.minutos ? ` · ${it.minutos} min` : ""}</span><b>${esc(it.titulo)}</b>${it.descricao ? `<span class="muted small">${esc(it.descricao)}</span>` : ""}</div>${botao}</div>`;
}

/* ---------- Sol, a gatinha, e a ofensiva ---------- */
function dataFeito(d, it) {
  if (it.provaId) { const ts = d.historico.filter(x => x.provaId === it.provaId).map(x => x.data).sort(); return ts[0] || null; }
  const f = (d.feitosInfo || {})[it.id]; return f ? f.data : null;
}
function itensDoDia(d, dia) {
  const p = d.plano.find(x => x._id === dia); const its = p && p.itens ? p.itens.slice() : [];
  const h = d.hoje || hoje();
  if (dia === h && its.length && ((d.erros && d.erros.devidos > 0) || d.feitos.includes(h + "-erros")))
    its.splice(Math.min(1, its.length), 0, { id: h + "-erros", momento: "aquecimento", titulo: "Revisar meus erros", descricao: "Questões que você errou antes e voltaram para você vencer.", minutos: 5, acao: "erros" });
  return its;
}
const descartado = (d, it) => { const a = (d.feitosInfo || {})["adiado-" + it.id]; return !!(a && a.acao === "descartar"); };
function avaliacaoDe(d, dia) { return (d.diario || []).find(x => x.data === dia) || null; }
// ok | falhou | pendente | neutro
function statusDia(d, dia) {
  const h = d.hoje || hoje(), its = itensDoDia(d, dia).filter(it => !descartado(d, it) && it.acao !== "meensina");
  const av = avaliacaoDe(d, dia);
  if (!its.length || (av && av.folga)) return "neutro";
  const ok = its.every(it => { const f = dataFeito(d, it); return f && f <= dia; });
  if (ok) return "ok";
  if (dia === h) return "pendente";
  return diaSem(dia) === 0 ? "neutro" : "falhou";
}
function ofensiva(d) {
  const h = d.hoje || hoje(); const primeiro = d.plano.length ? d.plano[0]._id : h;
  let n = 0, quebrouOntem = false, dia = h, primeiroVisto = true;
  while (dia >= primeiro) {
    const st = statusDia(d, dia);
    if (st === "ok") n++;
    else if (st === "falhou") { if (primeiroVisto) quebrouOntem = true; break; }
    if (st !== "neutro" && st !== "pendente") primeiroVisto = false;
    if (dia !== h && st === "neutro") { /* folga não conta nem quebra */ }
    dia = addDias(dia, -1);
  }
  return { dias: n, quebrouOntem, hojeOk: statusDia(d, h) === "ok" };
}
function comidaHoje(d) {
  const h = d.hoje || hoje(), its = itensDoDia(d, h).filter(it => it.acao !== "meensina");
  const feitosHoje = new Set(Object.keys(d.feitosInfo || {}).filter(k => (d.feitosInfo[k] || {}).data === h && !k.startsWith("adiado-")));
  d.historico.filter(x => x.data === h).forEach(x => feitosHoje.add("prova:" + x.provaId));
  const deHoje = its.filter(it => { const f = dataFeito(d, it); return f === h; }).length;
  return { comeu: feitosHoje.size, plano: its.length, deHoje };
}
function humorSol(d) {
  const h = d.hoje || hoje(), of = ofensiva(d), c = comidaHoje(d);
  const ontem = avaliacaoDe(d, addDias(h, -1));
  if (of.hojeOk) return ["feliz", "A Sol está de barriga cheia e muito feliz. Obrigada por cuidar dela!"];
  if (!c.plano) return ["dormindo", diaSem(h) === 0 ? "Domingo a Sol tira uma soneca. Até amanhã!" : "Hoje não tem estudo. A Sol está tirando uma soneca."];
  if (ontem && (ontem.cor === "vermelho" || ontem.cor === "preto") && !c.comeu) return ["preocupada", "A Sol ficou preocupada com ontem. Vamos fazer um dia verde hoje?"];
  if (of.quebrouOntem && !c.comeu) return ["triste", "A Sol sentiu sua falta ontem. Vamos recomeçar a ofensiva hoje?"];
  if (c.comeu) return ["comendo", `Nham! Faltam ${Math.max(0, c.plano - c.deHoje)} atividade${c.plano - c.deHoje === 1 ? "" : "s"} para a Sol ficar de barriga cheia.`];
  return ["fome", "A Sol está com fome e esperando você. Cada atividade é uma porção de ração!"];
}
function solSVG(humor, cheio = 0, tam = 150) {
  const olhos = {
    feliz: `<path d="M63 57q5-6 10 0M87 57q5-6 10 0" stroke="#2B2B3A" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    comendo: `<path d="M63 57q5-6 10 0M87 57q5-6 10 0" stroke="#2B2B3A" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    dormindo: `<path d="M63 57q5 5 10 0M87 57q5 5 10 0" stroke="#2B2B3A" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    triste: `<circle cx="68" cy="58" r="4.5" fill="#2B2B3A"/><circle cx="92" cy="58" r="4.5" fill="#2B2B3A"/><path d="M61 52l11-4M99 52l-11-4" stroke="#2B2B3A" stroke-width="2.5" stroke-linecap="round"/><path d="M66 64q-2 6 1 8" stroke="#5BA8F0" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    preocupada: `<circle cx="68" cy="58" r="4.5" fill="#2B2B3A"/><circle cx="92" cy="58" r="4.5" fill="#2B2B3A"/><path d="M62 50l11-3M98 50l-11-3" stroke="#2B2B3A" stroke-width="2.5" stroke-linecap="round"/>`,
    fome: `<circle cx="68" cy="58" r="5" fill="#2B2B3A"/><circle cx="92" cy="58" r="5" fill="#2B2B3A"/><circle cx="69.5" cy="56.5" r="1.6" fill="#fff"/><circle cx="93.5" cy="56.5" r="1.6" fill="#fff"/>`
  }[humor];
  const boca = humor === "triste" || humor === "preocupada" ? `<path d="M74 75q6-5 12 0" stroke="#2B2B3A" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
    : humor === "comendo" ? `<ellipse cx="80" cy="73" rx="4" ry="3.5" fill="#E2687E"/>`
    : `<path d="M74 70q3 4 6 0q3 4 6 0" stroke="#2B2B3A" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  const extra = humor === "dormindo" ? `<text x="112" y="34" font-size="16" font-weight="800" fill="#8A94A6">z</text><text x="122" y="22" font-size="12" font-weight="800" fill="#8A94A6">z</text>`
    : humor === "feliz" ? `<path d="M118 26c-4-6-12-2-8 5l8 7 8-7c4-7-4-11-8-5z" fill="#E2687E"/>`
    : humor === "fome" ? `<g><ellipse cx="124" cy="28" rx="16" ry="11" fill="#fff" stroke="#C9CCD6"/><circle cx="106" cy="40" r="3" fill="#fff" stroke="#C9CCD6"/><path d="M116 28c4-4 9-4 12 0c-3 4-8 4-12 0zM128 28l4-3v6z" fill="#F2A33A"/></g>` : "";
  const nivel = 129 - 12 * Math.max(0, Math.min(1, cheio));
  return `<svg viewBox="0 0 160 150" width="${tam}" height="${Math.round(tam * 150 / 160)}" role="img" aria-label="Sol, a gatinha (${humor})">
    <path d="M118 112c22-4 26-30 10-36" stroke="#E9ECF2" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M118 112c22-4 26-30 10-36" stroke="#C9CCD6" stroke-width="1.5" fill="none" stroke-linecap="round" transform="translate(0,0)" opacity=".0"/>
    <ellipse cx="80" cy="108" rx="40" ry="28" fill="#fff" stroke="#C9CCD6" stroke-width="2"/>
    <ellipse cx="62" cy="132" rx="9" ry="6" fill="#fff" stroke="#C9CCD6" stroke-width="2"/><ellipse cx="96" cy="132" rx="9" ry="6" fill="#fff" stroke="#C9CCD6" stroke-width="2"/>
    <path d="M54 44L49 14L74 33z" fill="#fff" stroke="#C9CCD6" stroke-width="2" stroke-linejoin="round"/><path d="M106 44L111 14L86 33z" fill="#fff" stroke="#C9CCD6" stroke-width="2" stroke-linejoin="round"/>
    <path d="M56 38L53 21L67 32z" fill="#F7B6C2"/><path d="M104 38L107 21L93 32z" fill="#F7B6C2"/>
    <circle cx="80" cy="60" r="31" fill="#fff" stroke="#C9CCD6" stroke-width="2"/>
    ${humor === "feliz" || humor === "comendo" ? `<circle cx="61" cy="68" r="5" fill="#F7B6C2" opacity=".8"/><circle cx="99" cy="68" r="5" fill="#F7B6C2" opacity=".8"/>` : ""}
    ${olhos}<path d="M77 64h6l-3 3.5z" fill="#E2687E"/>${boca}
    <path d="M52 66l-16-3M52 70l-15 3M108 66l16-3M108 70l15 3" stroke="#B8BDC9" stroke-width="1.5" stroke-linecap="round"/>
    <g transform="translate(0,0)"><path d="M110 129h34l-4 13h-26z" fill="#2F55C9"/><rect x="113" y="${nivel}" width="28" height="${129 - nivel}" fill="#B5763A" rx="2"/><rect x="108" y="127" width="38" height="4" rx="2" fill="#24439F"/></g>
    ${extra}</svg>`;
}
const chamaSVG = (acesa, t = 22) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6c0 2 1 3 2 3c0-4-1-6 1-9z" fill="${acesa ? "#FF8A1F" : "#C9CCD6"}"/><path d="M12 12c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5.8-2.5 1.5-3c0 1 .5 1.5 1 1.5c0-2 0-3 .5-4z" fill="${acesa ? "#FFD34A" : "#E9ECF2"}"/></svg>`;
function cardSol(d) {
  const of = ofensiva(d), c = comidaHoje(d), [humor, frase] = humorSol(d);
  const h = d.hoje || hoje();
  const verdes = (d.diario || []).filter(x => x.cor === "verde" && x.data > addDias(h, -7)).length;
  const chave = "sol-comeu-" + h, antes = store.get(chave, 0), nham = c.comeu > antes;
  store.set(chave, c.comeu);
  return `<section class="sol-card ${nham ? "nham" : ""}"><div class="sol-ofensiva">${chamaSVG(of.hojeOk || of.dias > 0, 30)}<div><b>${of.dias}</b><span>dia${of.dias === 1 ? "" : "s"} de ofensiva</span></div></div>
    <div class="sol-pet">${solSVG(humor, c.plano ? c.deHoje / c.plano : 0, 170)}${nham ? `<span class="sol-nham">Nham! Você alimentou a Sol!</span>` : ""}</div>
    <p class="sol-frase">${esc(frase)}</p>
    ${c.plano ? `<div class="sol-tigela"><span>Tigela de hoje</span><div class="bar" style="height:12px"><i style="width:${c.deHoje / c.plano * 100}%;background:#B5763A"></i></div><b>${c.deHoje} de ${c.plano}</b></div>` : ""}
    <div class="sol-cora" title="Dias verdes nos últimos 7 dias">${Array.from({ length: 5 }, (_, i) => `<span class="${i < verdes ? "on" : ""}">♥</span>`).join("")}<small>dias verdes da semana</small></div>
    <p class="muted small" style="margin:0">A chama acende quando você termina <b>todo</b> o estudo do dia, no próprio dia. Domingo e dias de folga não apagam a chama.</p></section>`;
}
const CHECK = [
  ["caderno", "Copiou toda a matéria no caderno, com capricho", "Copie toda a matéria no caderno e capriche na letra."],
  ["sala", "Terminou as atividades de sala, sem nada em branco", "Termine as atividades da sala antes de guardar o caderno."],
  ["deveres", "Mostrou os deveres de casa feitos (ou combinou quando vai fazer)", "Faça os deveres de casa e mostre para um adulto."],
  ["agenda", "Anotou na agenda os recados e as provas da professora", "Preste atenção nos recados da professora e anote tudo na agenda."],
  ["aula", "Explicou com clareza o que aprendeu na aula", "Preste atenção na aula para conseguir explicar o que aprendeu."],
  ["estudo", "Fez todo o estudo da manhã no app", "Faça todo o estudo da manhã antes de ir para a aula."],
  ["ontem", "Cumpriu o que ficou devendo do dia anterior", "Não esqueça o que ficou devendo."]
];
const COR_DIA = { verde: ["Dia verde", "var(--ok)", "Mandou muito bem! Tudo certo hoje."], amarelo: ["Dia amarelo", "var(--sun)", "Quase lá! Faltou só um pouquinho."], vermelho: ["Dia vermelho", "var(--bad)", "Esse dia precisou de ajuda. Amanhã é uma nova chance."], preto: ["Dia preto", "#2A2A2A", "Um exercício ficou escondido em branco. Vamos conversar."], folga: ["Dia de folga", "var(--soft)", "Descanse bem."] };
function ultimaAvaliacao(d, antesDe) { return (d.diario || []).filter(x => antesDe ? x.data < antesDe : true).sort((a, b) => b.data.localeCompare(a.data))[0] || null; }
function cardDia(d) {
  const h = d.hoje || hoje();
  const av = (d.diario || []).filter(x => x.data <= h).sort((a, b) => b.data.localeCompare(a.data))[0];
  if (!av) return `<section class="panel stack"><h3>Como foi o seu dia</h3><span class="muted small">No café da tarde, um adulto confere o seu dia. A cor aparece aqui.</span></section>`;
  const cor = av.folga ? COR_DIA.folga : COR_DIA[av.cor] || ["Dia avaliado", "var(--soft)", ""];
  const quando_ = av.data === h ? "Hoje" : av.data === addDias(h, -1) ? "Ontem" : `${DIAS[diaSem(av.data)]}, ${dataBR(av.data)}`;
  let lista = "";
  if (av.itens) lista = CHECK.filter(([k]) => av.itens[k] != null).map(([k, t]) => `<li class="${av.itens[k] ? "sim" : "nao"}">${av.itens[k] ? ico("check", 16) : "✕"} ${t}</li>`).join("");
  else { const chk = (v, t) => v == null ? "" : `<li class="${v ? "sim" : "nao"}">${v ? ico("check", 16) : "✕"} ${t}</li>`; lista = chk(av.agenda, "Agenda completa") + chk(av.cadernos, "Cadernos em dia") + chk(av.aula, "Contou como foi a aula"); }
  if (av.escondeu) lista += `<li class="nao">✕ Escondeu um exercício em branco</li>`;
  return `<section class="dia-card" style="--dc:${cor[1]}"><div class="dc-top"><span class="dc-bola"></span><div><span class="dc-q">${quando_} · conferido no café da tarde</span><b>${cor[0]}</b><span>${esc(cor[2])}</span></div></div>
    <ul class="dc-lista">${lista}</ul>
    ${av.obs ? `<div class="dc-recado"><b>Recado de casa</b>${esc(av.obs)}</div>` : ""}${av.combinado ? `<div class="dc-recado comb"><b>Combinado</b>${esc(av.combinado)}</div>` : ""}</section>`;
}
// o que ficou devendo do último dia avaliado (aparece no dia seguinte)
function cardDevendo(d) {
  const h = d.hoje || hoje(), av = ultimaAvaliacao(d, h);
  if (!av || av.folga) return "";
  const lembretes = av.devendo || [], deveres = av.deveres || [];
  if (!lembretes.length && !deveres.length) return "";
  return `<section class="painel-mundo" style="--w:#B8860B"><div class="faixa" style="--w:#B8860B"><b>FICOU DEVENDO</b><span>de ${av.data === addDias(h, -1) ? "ontem" : dataBR(av.data)} · o adulto vai conferir hoje à tarde</span></div><div class="pm-corpo">
    ${lembretes.length ? `<ul class="dev-l">${lembretes.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    ${deveres.length ? `<div class="itens">${deveres.map((t, i) => { const id = `${av.data}-dever-${i}`, ok = d.feitos.includes(id); return `<div class="item ${ok ? "ok" : ""}"><div class="inum">${ok ? ico("check", 20) : i + 1}</div><div class="ibody"><span class="mom" style="--mm:#B8860B">Dever de casa</span><b>${esc(t)}</b></div>${ok ? `<span class="feito">${ico("check", 18)} Feito</span>` : `<button class="ghost" data-feito="${esc(id)}">Fiz</button>`}</div>`; }).join("")}</div>` : ""}</div></section>`;
}

/* ---------- caderno de erros ---------- */
function abaErros(d) {
  const e = d.erros || { devidos: 0, ativos: 0, vencidos: 0, porHabilidade: [] };
  const porMat = {}; e.porHabilidade.forEach(x => (porMat[x.materia] = porMat[x.materia] || []).push(x));
  return `<div class="erros-top"><div class="panel stack"><h2>${e.devidos ? `${e.devidos} para revisar hoje` : "Nada para revisar hoje"}</h2>
      <p class="muted" style="margin:0">Toda questão que você erra vem para este caderno. Ela volta depois de <b>1 dia</b>, <b>3 dias</b>, <b>7 dias</b> e <b>21 dias</b>. Acertou 4 vezes seguidas? <b>Venceu!</b> Errou? Ela volta amanhã.</p>
      ${e.devidos ? `<div><a class="btn" href="#/revisar">Revisar agora</a></div>` : ""}</div>
    <div class="kpi-e"><b>${e.ativos}</b><span>no caderno</span></div><div class="kpi-e ok"><b>${e.vencidos}</b><span>vencidos</span></div></div>
   ${Object.keys(porMat).map(m => `<section class="panel stack" style="border-top:5px solid ${corMat(m)}"><h3 style="color:${corMat(m)}">${esc(m)}</h3><div class="list">${porMat[m].map(x => `<div class="li"><div><b>${esc(poderDe(x.habilidade).nome)}</b><div class="muted small">${esc(x.habilidade)}</div></div><div class="row" style="gap:6px">${x.devidos ? `<span class="tag warn">${x.devidos} hoje</span>` : ""}${x.ativos ? `<span class="tag">${x.ativos} no caderno</span>` : ""}${x.vencidos ? `<span class="tag ok">${x.vencidos} vencido${x.vencidos > 1 ? "s" : ""}</span>` : ""}</div></div>`).join("")}</div></section>`).join("") || `<div class="panel muted">Seu caderno está vazio. Os erros das próximas atividades aparecem aqui.</div>`}`;
}
async function telaRevisar() {
  app.className = "wrap";
  carregando("Buscando seus erros…");
  const qs = await api("errosHoje");
  const volta = sess.papel === "adulto" ? "#/aluna/hoje" : "#/hoje";
  const h = (cache.aluna && cache.aluna.hoje) || hoje();
  let i = 0, res = null, acertos = 0, valor = "", enviando = false;
  const desenha = () => {
    if (!qs.length) { app.innerHTML = `<div class="tab-wrap"><div class="tab-card stack"><h1>Nada para revisar agora</h1><p>Os erros voltam no dia certo. Volte amanhã!</p><a class="btn" href="${volta}">Voltar para Hoje</a></div></div>`; return; }
    if (i >= qs.length) {
      app.innerHTML = `<div class="tab-wrap"><div class="tab-card stack"><h1>${acertos} de ${qs.length}!</h1><p>${acertos === qs.length ? "Você venceu todos de hoje!" : "Os que você errou voltam amanhã para uma nova chance."}</p><span class="muted small" id="rv-s">Salvando…</span><a class="btn" href="${volta}">Voltar para Hoje</a></div></div>`;
      api("marcarFeito", { item: h + "-erros" }).then(() => { const s = $("#rv-s"); if (s) s.textContent = "A Sol ganhou mais uma porção!"; }).catch(() => { });
      return;
    }
    const e = qs[i], q = e.questao, tipo = q.tipo || "mc";
    let corpo;
    if (tipo === "mc") corpo = `<div class="opts">${(q.opcoes || []).map((o, j) => { const L = "ABCDEFG"[j]; return `<button class="opt optb ${valor === L ? "sel" : ""} ${res && valor === L ? (res.certo ? "certa" : "errada") : ""}" data-rv="${L}" ${res ? "disabled" : ""}><span class="l">${L}</span><span>${esc(o)}</span></button>`; }).join("")}</div>`;
    else corpo = `<div class="row">${tipo === "ditado" || q.falar ? `<button class="ouvir" data-fala="${esc(q.falar || "")}" data-lang="${esc(q.lang || "pt-BR")}">${ico("som", 18)} Ouvir</button>` : ""}<div class="resp-in"><input id="rv-in" value="${esc(valor)}" placeholder="Sua resposta" autocomplete="off" spellcheck="false" ${res ? "readonly" : ""}>${q.unidade ? `<span>${esc(q.unidade)}</span>` : ""}</div></div>`;
    const fb = res ? `<div class="fb ${res.certo ? "ok" : "no"}">${res.certo ? (res.resolvido ? "<b>Venceu!</b> Essa questão saiu do caderno." : `<b>Isso mesmo!</b> Ela volta no dia ${dataBR(res.proxima)} para você confirmar.`) : `<b>Ainda não.</b> A resposta certa é <b>${esc(res.correta)}</b>. Ela volta amanhã.`}${res.aviso ? `<div style="margin-top:6px"><b>Atenção:</b> ${esc(res.aviso)}</div>` : ""}${res.explicacao ? `<div style="margin-top:6px">${md(res.explicacao)}</div>` : ""}</div>` : "";
    app.innerHTML = `<div class="ptop"><div class="row between"><b style="font-family:var(--display);color:var(--accent)">Caderno de erros</b><span class="muted">${i + 1} de ${qs.length}</span></div><div class="pbar"><i style="width:${(i + (res ? 1 : 0)) / qs.length * 100}%"></i></div></div>
      <div class="stack" style="max-width:900px;margin:0 auto">
      <div class="row" style="gap:6px"><span class="mchip" style="--mc:${corMat(e.materia)}">${esc(e.materia)}</span><span class="tag">${esc(poderDe(e.habilidade || "").nome)}</span>${e.vezes > 1 ? `<span class="tag warn">já errou ${e.vezes} vezes</span>` : ""}</div>
      ${q._lead ? `<div class="lead">${esc(q._lead)}</div>` : ""}${q._texto ? renderTexto(q._texto) : ""}
      <div class="q"><div class="q-h"><span class="num">${i + 1}</span><span>${md(q.enunciado)}</span></div>${q.apoio ? renderTexto(q.apoio) : ""}${corpo}${fb}</div>
      <div class="nav">${res ? `<span></span><button id="rv-prox">${i === qs.length - 1 ? "Terminar" : "Próxima"}</button>` : `<a class="btn ghost" href="${volta}">Sair</a><button id="rv-ok" ${enviando ? "disabled" : ""}>Conferir</button>`}</div></div>`;
    const inp = $("#rv-in"); if (inp && !res) inp.focus();
  };
  app.onkeydown = ev => { if (ev.key === "Enter" && ev.target.id === "rv-in") { const b = $("#rv-ok"); if (b) b.click(); } };
  app.onclick = async ev => {
    const b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.fala != null) { falar(b.dataset.fala, b.dataset.lang || "pt-BR"); return; }
    if (b.dataset.rv) { valor = b.dataset.rv; desenha(); return; }
    if (b.id === "rv-ok") {
      const inp = $("#rv-in"); if (inp) valor = inp.value;
      if (!String(valor).trim()) return toast("Responda primeiro.");
      enviando = true; desenha();
      try { res = await api("responderErro", { id: qs[i].id, resposta: valor }); if (res.certo) acertos++; } catch (e) { toast(e.message); }
      enviando = false; desenha(); return;
    }
    if (b.id === "rv-prox") { i++; res = null; valor = ""; desenha(); window.scrollTo({ top: 0 }); }
  };
  desenha();
}

/* flashcards */
function cartoesHTML(s) {
  const cs = s.cartoes || [];
  if (!s._fila) { s._fila = cs.map((_, i) => i); s._sabia = 0; s._virado = false; }
  if (!s._fila.length) return `<div class="fc-fim stack"><h3>Você sabe todos os ${cs.length} cartões!</h3><div><button data-fc="de-novo">Embaralhar de novo</button></div></div>`;
  const c = cs[s._fila[0]];
  return `<div class="fc-wrap"><span class="muted small">${cs.length - s._fila.length} de ${cs.length} já sabe · faltam ${s._fila.length}</span>
    <button class="fc ${s._virado ? "virado" : ""}" data-fc="virar" aria-label="Virar o cartão"><span class="fc-lado">${s._virado ? "verso" : "frente"}</span><b>${md(s._virado ? c.verso : c.frente)}</b><small>${s._virado ? "" : "clique para virar"}</small></button>
    ${s._virado ? `<div class="row" style="justify-content:center;gap:10px"><button class="ghost" data-fc="nao">Ainda não</button><button data-fc="sabia">Eu sabia!</button></div>` : ""}</div>`;
}

/* ---------- Hoje ---------- */
function abaHoje(d) {
  const h = d.hoje || hoje();
  const plano0 = d.plano.find(p => p._id === h);
  const plano = plano0 ? Object.assign({}, plano0, { itens: itensDoDia(d, h) }) : null;
  const dataTxt = `${DIAS[diaSem(h)]}, ${dataBR(h)}`;
  let estudo;
  if (plano && plano.itens && plano.itens.length) {
    const manha = plano.itens.filter(it => it.acao !== "meensina");
    const feitos = manha.filter(it => itemFeito(d, plano, it)).length;
    const prox = plano.itens.findIndex(it => it.acao !== "meensina" && !itemFeito(d, plano, it));
    estudo = `<section class="painel-mundo" style="--w:var(--casa)">${faixa("casa", `Estudo de hoje · ${plano.minutos || 45} minutos`)}
      <div class="pm-corpo"><span class="muted">${feitos === manha.length ? "<b>Tudo feito hoje! Parabéns!</b>" : `Faça na ordem, de cima para baixo. ${feitos} de ${manha.length} feitos.`}</span>
      <div class="bar" style="height:12px"><i style="width:${feitos / (manha.length || 1) * 100}%;background:var(--casa)"></i></div>
      <div class="itens">${(() => { const ip = plano.itens.findIndex(it => it.acao === "pausa" && !itemFeito(d, plano, it)); return plano.itens.map((it, i) => linhaItem(d, h, it, i, i === prox, ip >= 0 && i > ip && !itemFeito(d, plano, it) && it.acao !== "meensina")).join(""); })()}</div></div></section>`;
  } else {
    const prox = d.plano.filter(p => p._id > h && (p.itens || []).length).sort((a, b) => a._id.localeCompare(b._id))[0];
    estudo = `<section class="painel-mundo" style="--w:var(--casa)">${faixa("casa", "Estudo de hoje")}<div class="pm-corpo">
      <p>${diaSem(h) === 0 ? "Domingo é dia de descanso. Aproveite!" : "Hoje não tem estudo marcado."}</p>
      ${prox ? `<p><b>O próximo estudo abre ${DIAS[diaSem(prox._id)].toLowerCase()}, ${dataBR(prox._id)}</b> (${prox.itens.length} atividades, ${prox.minutos || 45} minutos):</p><div class="itens">${prox.itens.map((it, i) => linhaItem(d, prox._id, it, i, false)).join("")}</div>` : ""}</div></section>`;
  }
  const atrasados = [];
  d.plano.filter(p => p._id < h).forEach(p => (p.itens || []).forEach(it => { const ad = (d.feitosInfo || {})["adiado-" + it.id]; if (estadoItem(d, p._id, it) === "atrasado" && it.provaId && (p._id >= addDias(h, -3) || (ad && ad.acao === "refazer" && ad.ate >= h))) atrasados.push([p._id, it]); }));
  const aula = infoAula(), proxEsc = d.agenda.filter(a => diasAte(a.data) >= 0).slice(0, 3);
  const lendo = d.livros.filter(l => l.status === "lendo");
  return `<p class="hoje-data">${dataTxt}</p>
   <div class="home3"><div class="stack c1">${cardHumor(d)}${cardDevendo(d)}${estudo}
    ${atrasados.length ? `<section class="painel-mundo" style="--w:var(--bad)"><div class="faixa" style="--w:var(--bad)"><b>FICOU PARA TRÁS</b><span>faça quando terminar o de hoje</span></div><div class="pm-corpo"><div class="itens">${atrasados.slice(-4).map(([dia, it], i) => linhaItem(d, dia, Object.assign({}, it, { descricao: `Era para ${DCURTO[diaSem(dia)].toLowerCase()}, ${dataBR(dia)}` }), i, false)).join("")}</div></div></section>` : ""}
   </div><aside class="stack c2">${cardSol(d)}${cardEstrelas(d)}${cardDia(d)}</aside><aside class="stack c3">
    <section class="painel-mundo" style="--w:var(--escola)">${faixa("escola", "Hoje à tarde")}<div class="pm-corpo">${aula.aulas.length ? `${aula.aulas.map(a => `<div class="aula-l"><span class="mchip" style="--mc:${corMat(a.split(" ")[0])}">${esc(a)}</span></div>`).join("")}<span class="muted small">13:15 às 17:15 · ${esc(aula.linha)}</span>` : `<span>${esc(aula.linha)}</span>`}
      <h3 style="margin-top:8px">Vem aí na escola</h3>${proxEsc.length ? proxEsc.map(a => cartaoAgenda(a, false)).join("") : `<span class="muted small">Nenhuma prova anotada. Ouviu falar de prova? Anote na Agenda.</span>`}</div></section>${cardRecompensa(d)}
    <section class="panel stack"><h3>Lendo agora</h3>${lendo.length ? lendo.map(l => `<div><b>${esc(l.titulo)}</b><div class="muted small">desde ${dataBR(l.inicio)}</div></div>`).join("") : `<span class="muted small">Nenhum livro. Comece um na aba Livros.</span>`}</section>
   </aside></div>
   ${minhaSemana(d)}`;
}
function navSemana(ini) {
  const fim = addDias(ini, 6);
  return `<div class="semnav"><button class="ghost mini" data-sem="-1" ${semanaOff <= -1 ? "disabled" : ""}>‹ Anterior</button><b>${semanaOff === 0 ? "Esta semana" : semanaOff > 0 ? "Próxima semana" : "Semana passada"} · ${dataBR(ini)} a ${dataBR(fim)}</b><button class="ghost mini" data-sem="1" ${semanaOff >= 1 ? "disabled" : ""}>Próxima ›</button></div>`;
}
function minhaSemana(d) {
  const h = d.hoje || hoje(), ini = addDias(segundaDe(h), 7 * semanaOff);
  const dias = Array.from({ length: 7 }, (_, i) => addDias(ini, i));
  const cor = Object.fromEntries((d.diario || []).map(x => [x.data, x.cor]));
  const col = dia => {
    const p = d.plano.find(x => x._id === dia), its = itensDoDia(d, dia), av = avaliacaoDe(d, dia);
    const esc_ = d.agenda.filter(a => a.data === dia);
    const feitos = its.filter(it => itemFeito(d, p, it)).length;
    const lista = its.map(it => {
      const st = estadoItem(d, dia, it);
      const ic = st === "feito" ? ico("check", 15) : st === "bloqueado" ? ico("cadeado", 14) : st === "atrasado" ? "!" : st === "descartado" ? "–" : "•";
      const tit = `<span class="si-ic">${ic}</span><span class="si-t">${esc(it.titulo)}</span>`;
      const pode = (st === "hoje" || st === "atrasado") && (it.provaId || it.acao === "tabuada" || it.acao === "pare" || it.acao === "gravar" || it.acao === "ler" || (it.acao === "video" && it.yt));
      const href = it.provaId ? `#/prova/${encodeURIComponent(it.provaId)}` : it.acao === "video" ? urlVideo(it.yt, it.id) : it.acao === "tabuada" ? `#/tabuada/${encodeURIComponent(it.id)}` : it.acao === "pare" ? `#/pare/${encodeURIComponent(it.id)}` : urlLer(it);
      return pode ? `<a class="sitem s-${st}" href="${href}">${tit}</a>` : `<div class="sitem s-${st}" ${st === "bloqueado" ? `title="Abre no dia ${dataBR(dia)}"` : ""}>${tit}</div>`;
    }).join("");
    const corAv = av ? (av.folga ? "var(--soft)" : (COR_DIA[av.cor] || [0, "var(--line)"])[1]) : "";
    return `<div class="sdia ${dia === h ? "hoje" : ""} ${dia < h ? "passado" : ""}" ${corAv ? `style="border-top:7px solid ${corAv}"` : ""} title="${av ? (av.folga ? "Dia de folga" : (COR_DIA[av.cor] || ["Dia avaliado"])[0]) : ""}"><div class="sd-h"><b>${DCURTO[diaSem(dia)]}</b><span>${dataBR(dia)}</span></div>
      ${its.length ? `<div class="sd-prog">${dia > h ? `${ico("cadeado", 13)} ${dia === addDias(h, 1) ? "abre amanhã" : "ainda fechado"}` : `${feitos} de ${its.length} feitos`}</div>` : ""}
      <div class="sd-lista">${lista || `<span class="muted small">${diaSem(dia) === 0 ? "Descanso" : "Sem estudo"}</span>`}</div>
      ${esc_.map(a => `<div class="sd-esc" style="--mc:${corMat(a.materia)}">${ico("escola", 13)} ${esc(a.tipo)} de ${esc(a.materia)}</div>`).join("")}</div>`;
  };
  return `<section class="panel stack"><div class="row between"><h2>Minha semana</h2>${navSemana(ini)}</div>
    <p class="muted small" style="margin:0">${ico("check", 13)} feito · ! ficou para trás · ${ico("cadeado", 12)} ainda não abriu: cada atividade abre no dia dela. A faixa colorida em cima de cada dia é a cor que o adulto deu no café da tarde.</p>
    <div class="sem-grid">${dias.map(col).join("")}</div></section>`;
}

/* ---------- Minhas aulas ---------- */
/* ---------- Agenda: semana + caderno de anotações ---------- */
const TIPOS_AG = ["Prova", "Trabalho", "Simulado", "Apresentação", "Atividade avaliada", "Dever de casa", "Recado", "Material para levar"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function fraseAgenda(a) {
  const m = a.materia && a.materia !== "Geral" ? a.materia : "";
  const det = a.conteudo ? esc(a.conteudo) : "";
  if (a.tipo === "Material para levar") return { tinta: "verde", html: `<b>Levar:</b> ${det || esc(m)}` };
  if (a.tipo === "Recado") return { tinta: "preta", html: `<b>Recado${m ? ` de ${esc(m)}` : ""}:</b> ${det}` };
  if (a.tipo === "Dever de casa") return { tinta: "azul", html: `<b>Dever${m ? ` de ${esc(m)}` : ""}</b>${det ? ` — ${det}` : ""}` };
  return { tinta: "vermelha", html: `<b>${esc(a.tipo)}${m ? ` de ${esc(m)}` : ""}</b>${det ? ` — ${det}` : ""}` };
}
function cadernoAgenda(d) {
  const h = d.hoje || hoje(), adulto = sess.papel === "adulto";
  const futuras = d.agenda.filter(a => a.data >= h), passadas = d.agenda.filter(a => a.data < h).slice(-5).reverse();
  const porDia = {}; futuras.forEach(a => (porDia[a.data] = porDia[a.data] || []).push(a));
  const entrada = (a, ativa) => { const f = fraseAgenda(a); const pode = ativa && (adulto || !a.confirmado);
    return `<li class="cd-i t-${f.tinta}"><span class="cd-txt">${f.html}</span>${a.confirmado ? `<span class="cd-visto" title="Um adulto já viu">visto</span>` : `<span class="cd-esp" title="Esperando um adulto ver">aguardando visto</span>`}${pode ? `<button class="cd-apagar" data-agdel="${esc(a.id)}" title="Apagar esta anotação">apagar</button>` : ""}</li>`; };
  const dia = (dt, itens, ativa) => `<div class="cd-dia ${ativa ? "" : "passou"}"><div class="cd-data"><b>${dt.slice(8, 10)}</b><span>${DCURTO[diaSem(dt)].toLowerCase()}</span></div><div class="cd-corpo"><span class="cd-quando">${ativa ? quando(diasAte(dt)) : "já passou"}</span><ul>${itens.map(a => entrada(a, ativa)).join("")}</ul></div></div>`;
  const mes = MESES[+h.slice(5, 7) - 1];
  return `<aside class="caderno"><div class="cad-capa"><span class="cad-etq">Minha agenda · 4º ano</span></div><div class="cad-espiral" aria-hidden="true"></div>
    <div class="cad-folha">
      <div class="cad-mes">${mes} <small>${h.slice(0, 4)}</small></div>
      ${Object.keys(porDia).sort().map(dt => dia(dt, porDia[dt], true)).join("") || `<p class="cad-vazio">Nada anotado ainda. Ouviu a professora falar de prova, trabalho, dever ou recado? Escreva aqui embaixo!</p>`}
      ${passadas.length ? `<div class="cad-sep">o que já passou</div>${passadas.map(a => dia(a.data, [a], false)).join("")}` : ""}
      <div class="cad-nova">
        <div class="cad-mes pequeno">Nova anotação</div>
        <div class="cn-linha"><label>dia<input type="date" id="ag-data" min="${h}"></label><label>matéria<select id="ag-mat">${[...MATERIAS, "Geral"].map(m => `<option>${m}</option>`).join("")}</select></label></div>
        <div class="cn-linha"><label>o que é<select id="ag-tipo">${TIPOS_AG.map(t => `<option>${t}</option>`).join("")}</select></label></div>
        <div class="cn-linha"><label class="lg">detalhes<input id="ag-cont" placeholder="ex.: frações, páginas 40 a 52"></label></div>
        <button id="ag-salvar" class="cn-btn">✎ Anotar na agenda</button>
        <p class="cn-dica">Um adulto vê a sua anotação e dá o <b>visto</b>.</p>
      </div>
    </div></aside>`;
}
function abaAulas(d) {
  const h = d.hoje || hoje(), ini = addDias(segundaDe(h), 7 * semanaOff);
  const dias = [0, 1, 2, 3, 4].map(i => addDias(ini, i));
  const rot = (m, t, s) => `<div class="ag-rot" style="--w:${m === "casa" ? "var(--casa)" : "var(--escola)"}">${ico(m, 20)}<b>${t}</b>${s ? `<span>${s}</span>` : ""}</div>`;
  const head = dias.map(x => `<div class="ag-head ${x === h ? "hoje" : ""}"><b>${DIAS[diaSem(x)]}</b><span>${dataBR(x)}${x === h ? " · hoje" : ""}</span></div>`).join("");
  const aulas = dias.map(x => `<div class="ag-cel ${x === h ? "hoje" : ""}">${AULAS[diaSem(x)].map(a => `<div class="gaula" style="--mc:${corMat(a.split(" ")[0])}">${esc(a)}</div>`).join("")}</div>`).join("");
  const provas = dias.map(x => { const ag = d.agenda.filter(a => a.data === x); return `<div class="ag-cel ${x === h ? "hoje" : ""}">${ag.map(a => `<div class="ag-ev" style="--mc:${corMat(a.materia)}"><b>${esc(a.tipo)}</b><span>${esc(a.materia)}</span>${a.conteudo ? `<small>${esc(a.conteudo)}</small>` : ""}</div>`).join("") || `<span class="vazio">—</span>`}</div>`; }).join("");
  const nomeMom = it => MOMENTO[it.momento] ? MOMENTO[it.momento][0].split(" · ")[0] : (it.momento || "");
  const casa = dias.map(x => { const its = d.plano.find(y => y._id === x) ? itensDoDia(d, x) : MANHA[diaSem(x)].map(([k, v]) => ({ titulo: v, momento: k })); return `<div class="ag-cel ${x === h ? "hoje" : ""}">${its.map(it => `<div class="gm"><span>${esc(nomeMom(it))}</span><b>${esc(it.titulo)}</b></div>`).join("")}</div>`; }).join("");
  const fds = [5, 6].map(i => addDias(ini, i)).map(x => { const p = d.plano.find(y => y._id === x); return `<div class="panel stack"><h3>${DIAS[diaSem(x)]} · ${dataBR(x)}</h3>${p ? p.itens.map(it => `<div class="gm"><span>${esc(nomeMom(it))}</span><b>${esc(it.titulo)}</b></div>`).join("") : `<span class="muted">${diaSem(x) === 0 ? "Descanso. Só 10 minutos com um adulto para olhar a semana." : "Simulado ou prova e um pouco de livro."}</span>`}</div>`; }).join("");
  return `<div class="agenda-lay"><div class="stack">
     <div class="row between"><p class="muted" style="margin:0">Escola à tarde, das <b>13:15 às 17:15</b>. De manhã, em casa, você estuda para chegar afiada.</p>${navSemana(ini)}</div>
     <div class="agrid"><div></div>${head}
       ${rot("escola", "Aulas", "13:15 às 17:15")}${aulas}
       ${rot("escola", "Provas e trabalhos", "da sua agenda")}${provas}
       ${rot("casa", "De manhã", "45 minutos")}${casa}</div>
     <div class="grid2">${fds}</div></div>
   ${cadernoAgenda(d)}</div>`;
}

/* ---------- gráfico com datas no eixo x ---------- */
function graficoTempo(series, { altura = 260, meta = 8.5, compacto = false } = {}) {
  const W = compacto ? 420 : 760, H = altura, L = 30, R = compacto ? 10 : 70, T = 14, B = 26;
  const todos = series.flatMap(s => s.pts.map(p => p.x)).sort();
  if (!todos.length) return `<p class="muted small" style="margin:8px 0">Sem notas ainda.</p>`;
  const t0 = new Date(addDias(todos[0], -2) + "T12:00:00").getTime(), t1 = new Date(addDias(todos[todos.length - 1], 2) + "T12:00:00").getTime();
  const X = iso => L + (new Date(iso + "T12:00:00").getTime() - t0) / Math.max(1, t1 - t0) * (W - L - R);
  const Y = v => T + (1 - v / 10) * (H - T - B);
  let g = `<rect x="${L}" y="${Y(7)}" width="${W - L - R}" height="${Y(0) - Y(7)}" fill="var(--bad)" opacity=".06"/>`;
  [0, 2, 4, 6, 8, 10].forEach(v => g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" class="ax">${v}</text>`);
  g += `<line x1="${L}" x2="${W - R}" y1="${Y(meta)}" y2="${Y(meta)}" stroke="var(--sun)" stroke-dasharray="6 4" stroke-width="1.5"/>${compacto ? "" : `<text x="${W - R + 4}" y="${Y(meta) + 4}" class="ax">meta 8,5</text>`}`;
  const nt = compacto ? 3 : 6;
  for (let i = 0; i <= nt; i++) { const t = t0 + (t1 - t0) * i / nt; const iso = new Date(t).toISOString().slice(0, 10); g += `<text x="${X(iso)}" y="${H - 6}" text-anchor="middle" class="ax">${dataBR(iso)}</text>`; }
  series.forEach(s => {
    const pts = s.pts.slice().sort((a, b) => a.x.localeCompare(b.x));
    if (pts.length > 1) g += `<path d="${pts.map((p, i) => (i ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.y).toFixed(1)).join("")}" fill="none" stroke="${s.cor}" stroke-width="2" ${s.tracejado ? 'stroke-dasharray="6 4"' : ""} stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach(p => {
      const cx = X(p.x).toFixed(1), cy = Y(p.y).toFixed(1), tip = esc(`${s.nome} · ${dataBR(p.x)} · ${p.rotulo || ""}: ${fmtN(p.y)}`);
      g += s.forma === "quadrado" ? `<rect x="${cx - 4.5}" y="${cy - 4.5}" width="9" height="9" rx="2" fill="${s.cor}" stroke="var(--card)" stroke-width="2"/>` : `<circle cx="${cx}" cy="${cy}" r="5" fill="${s.cor}" stroke="var(--card)" stroke-width="2"/>`;
      g += `<circle cx="${cx}" cy="${cy}" r="12" fill="transparent" data-tip="${tip}"/>`;
    });
    if (!compacto && pts.length) { const u = pts[pts.length - 1]; g += `<text x="${Math.min(W - R + 4, X(u.x) + 8)}" y="${Y(u.y) + 4}" class="ax lbl">${esc(s.curto || "")}</text>`; }
  });
  return `<svg class="tchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de notas no tempo">${g}</svg>`;
}
/* ---------- Aprender: aulas em vídeo (YouTube dentro do app) ---------- */
const MIN_ASSISTIDO = 80; // % do vídeo para contar como assistido
const vidPct = (d, yt) => { const a = (d.assistidos || {})[yt]; return a ? Math.min(100, Math.round(+a.pct || 0)) : 0; };
const thumb = yt => `https://i.ytimg.com/vi/${encodeURIComponent(yt)}/mqdefault.jpg`;
const urlVideo = (yt, item) => `#/video/${encodeURIComponent(yt)}${item ? `?item=${encodeURIComponent(item)}` : ""}`;
function cartaoVideo(d, v, item) {
  const p = vidPct(d, v.yt), ok = p >= MIN_ASSISTIDO;
  return `<a class="vcard ${ok ? "ok" : ""}" href="${urlVideo(v.yt, item)}" style="--mc:${corMat(v.materia)}">
    <span class="vthumb"><img src="${thumb(v.yt)}" alt="" loading="lazy"><span class="vplay">▶</span>${v.minutos ? `<span class="vdur">${v.minutos} min</span>` : ""}${ok ? `<span class="vok">${ico("check", 16)} assistido</span>` : ""}</span>
    <span class="vinfo"><span class="mchip" style="--mc:${corMat(v.materia)}">${esc(v.materia)}</span><b>${esc(v.titulo)}</b><span class="muted small">${esc(v.assunto || "")}${v.canal ? ` · ${esc(v.canal)}` : ""}</span>
    <span class="vbar"><i style="width:${p}%"></i></span></span></a>`;
}
function abaAprender(d) {
  const V = (d.videos || []).slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  if (!V.length) return `<div class="panel"><p class="muted">Ainda não há aulas em vídeo. Os adultos vão colocar as primeiras aqui.</p></div>`;
  const h = d.hoje || hoje();
  const deHoje = itensDoDia(d, h).filter(it => it.acao === "video" && it.yt).map(it => ({ it, v: V.find(x => x.yt === it.yt) || { yt: it.yt, titulo: it.titulo, materia: it.materia || "" } }));
  const mats = [...new Set(V.map(v => v.materia))];
  const vistos = V.filter(v => vidPct(d, v.yt) >= MIN_ASSISTIDO).length;
  return `${deHoje.length ? `<section class="panel stack"><h2>Para hoje</h2><div class="vgrid">${deHoje.map(x => cartaoVideo(d, x.v, x.it.id)).join("")}</div></section>` : ""}
    <p class="muted" style="margin:0">Aulas curtas de professores para você <b>aprender</b> antes de praticar. Assista com atenção: o vídeo conta como assistido quando você vê pelo menos ${MIN_ASSISTIDO}% dele. Você já assistiu <b>${vistos} de ${V.length}</b>.</p>
    ${mats.map(m => { const vs = V.filter(v => v.materia === m); return `<section class="stack"><h2 style="color:${corMat(m)}">${esc(m)}</h2><div class="vgrid">${vs.map(v => cartaoVideo(d, v)).join("")}</div></section>`; }).join("")}`;
}
let ytApi = null;
function carregarYT() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApi) return ytApi;
  ytApi = new Promise((ok, falha) => {
    window.onYouTubeIframeAPIReady = () => ok(window.YT);
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.onerror = () => { ytApi = null; falha(new Error("Não consegui carregar o vídeo. Confira a internet.")); };
    document.head.appendChild(s);
  });
  return ytApi;
}
const mmss = s => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
async function telaVideo(yt) {
  app.className = "shell-wrap";
  const q = new URLSearchParams(location.hash.split("?")[1] || ""), itemId = q.get("item") || "";
  const d = cache.aluna || (cache.aluna = await api("inicioAluna"));
  const v = (d.videos || []).find(x => x.yt === yt) || { yt, titulo: "Aula em vídeo", materia: "" };
  let item = null; (d.plano || []).forEach(p => (p.itens || []).forEach(it => { if (it.id === itemId) item = it; }));
  const volta = sess.papel === "adulto" ? "#/aluna/" : "#/";
  const ant = (d.assistidos || {})[yt] || {};
  const outros = (d.videos || []).filter(x => x.materia === v.materia && x.yt !== yt).slice(0, 4);
  const corpo = `<div class="vlay"><div class="stack">
      <div class="vplayer" id="vp"><div id="yt-alvo"></div><div class="vescudo" id="vescudo" title="Clique para pausar ou continuar"></div>
        <div class="vfim" id="vfim" hidden></div><div class="vanuncio" id="vanuncio" hidden>Propaganda do YouTube. Espere terminar: a aula começa logo depois.</div><div class="vcarga" id="vcarga">Carregando a aula…</div></div>
      <div class="vctl"><button id="v-play" class="vbtn" aria-label="Tocar">▶</button><span class="vtempo" id="v-tempo">0:00 / 0:00</span>
        <input type="range" id="v-seek" min="0" max="1000" value="0" aria-label="Posição do vídeo">
        <button class="vbtn sm" id="v-volta" title="Voltar 10 segundos">↺ 10</button>
        <select id="v-vel" aria-label="Velocidade"><option value="0.75">0,75×</option><option value="1" selected>1×</option><option value="1.25">1,25×</option></select>
        <button class="vbtn sm" id="v-tela" title="Tela cheia">⛶</button></div>
      <section class="panel stack"><span class="mchip" style="--mc:${corMat(v.materia)}">${esc(v.materia || "Aula")}</span><h2 style="margin:0">${esc(v.titulo)}</h2>
        <span class="muted small">${esc(v.assunto || "")}${v.canal ? ` · aula do canal ${esc(v.canal)}` : ""}</span>
        ${item && item.descricao ? `<p style="margin:0">${esc(item.descricao)}</p>` : v.porque ? `<p style="margin:0">${esc(v.porque)}</p>` : ""}</section></div>
    <aside class="stack"><section class="panel stack"><h3>Seu progresso</h3><div class="vprog"><b id="v-pct">${Math.min(100, Math.round(+ant.pct || 0))}%</b><span class="muted small">assistido · precisa de ${MIN_ASSISTIDO}%</span></div><div class="bar" style="height:12px"><i id="v-bar" style="width:${Math.min(100, +ant.pct || 0)}%;background:var(--casa)"></i></div>
        <p class="muted small" style="margin:0">Pular partes não conta. Se não entender, use <b>↺ 10</b> para ouvir de novo.</p>
        <span id="v-st" class="small"></span><a class="btn ghost" href="${volta}${itemId ? "hoje" : "aprender"}">Voltar</a></section>
      <section class="panel stack"><h3>Enquanto assiste</h3><ol class="passos"><li>Preste atenção no exemplo que o professor faz.</li><li>Se puder, anote no caderno uma coisa que você aprendeu.</li><li>No fim, conte para um adulto o que entendeu.</li></ol></section>
      ${outros.length ? `<section class="panel stack"><h3>Mais aulas de ${esc(v.materia)}</h3>${outros.map(o => `<a class="vmini" href="${urlVideo(o.yt)}"><img src="${thumb(o.yt)}" alt="" loading="lazy"><span><b>${esc(o.titulo)}</b><span class="muted small">${vidPct(d, o.yt)}% assistido</span></span></a>`).join("")}</section>` : ""}</aside></div>`;
  app.innerHTML = concha(itemId ? "hoje" : "aprender", "Aula em vídeo", corpo, d);
  // assistir de verdade: conta só os segundos que tocaram
  const vistos = new Set((ant.vistos || "").split(",").filter(Boolean).map(Number));
  let player = null, dur = 0, timer = null, ultEnvio = 0, enviando = false, concluido = (+ant.pct || 0) >= MIN_ASSISTIDO, ultT = -1, querTocar = false, esperando = 0;
  const pct = () => dur ? Math.min(100, vistos.size / Math.max(1, Math.floor(dur)) * 100) : 0;
  const enviar = async (forcar) => {
    if (enviando || !dur || sess.papel === "adulto") return; const agora = Date.now(); if (!forcar && agora - ultEnvio < 20000) return;
    enviando = true; ultEnvio = agora;
    try { await api("videoAssistido", { yt, item: itemId || undefined, pct: Math.round(pct()), duracao: Math.round(dur), vistos: [...vistos].sort((a, b) => a - b).join(","), posicao: Math.round((player && player.getCurrentTime && player.getCurrentTime()) || 0) });
      d.assistidos = d.assistidos || {}; d.assistidos[yt] = Object.assign({}, d.assistidos[yt], { pct: Math.max(+((d.assistidos[yt] || {}).pct) || 0, Math.round(pct())), vistos: [...vistos].join(",") });
      if (itemId && pct() >= MIN_ASSISTIDO && !d.feitos.includes(itemId)) d.feitos.push(itemId); }
    catch (e) { const st = $("#v-st"); if (st) st.textContent = "Não salvou o progresso: " + e.message; }
    enviando = false;
  };
  const atualizar = () => {
    if (!player || !player.getCurrentTime) return;
    const t = player.getCurrentTime() || 0; dur = player.getDuration() || dur;
    const estado = player.getPlayerState();
    const an = $("#vanuncio"); if (an) { if (querTocar && estado !== 1 && estado !== 2 && estado !== 0) { esperando++; an.hidden = esperando < 3; } else { esperando = 0; an.hidden = true; } }
    if (estado === 1) { const s = Math.floor(t); if (ultT >= 0 && s >= ultT && s - ultT <= 3) for (let k = ultT; k <= s; k++) vistos.add(k); ultT = s; }
    else ultT = Math.floor(t);
    const p = Math.round(pct()), e = $("#v-pct"); if (!e) { clearInterval(timer); return; }
    e.textContent = p + "%"; $("#v-bar").style.width = p + "%";
    $("#v-tempo").textContent = `${mmss(t)} / ${mmss(dur)}`;
    if (document.activeElement !== $("#v-seek")) $("#v-seek").value = dur ? Math.round(t / dur * 1000) : 0;
    $("#v-play").textContent = estado === 1 ? "❚❚" : "▶";
    if (!concluido && p >= MIN_ASSISTIDO) { concluido = true; enviar(true); $("#v-st").innerHTML = `<b style="color:var(--casa)">${ico("check", 16)} Aula assistida!</b> Muito bem.`; toast("Aula assistida! A Sol ganhou mais uma porção."); }
    else enviar(false);
  };
  const fim = () => {
    const f = $("#vfim"); if (!f) return; const ok = pct() >= MIN_ASSISTIDO;
    f.hidden = false;
    f.innerHTML = ok ? `<b>Muito bem!</b><span>Você assistiu a aula. Agora conte para um adulto o que aprendeu.</span><a class="btn" href="${volta}${itemId ? "hoje" : "aprender"}">Voltar</a>`
      : `<b>Quase!</b><span>Você viu ${Math.round(pct())}% da aula. Para contar, precisa de ${MIN_ASSISTIDO}%: volte nas partes que pulou.</span><button id="v-denovo">Assistir de novo</button>`;
    enviar(true);
  };
  try {
    const YT = await carregarYT();
    player = new YT.Player("yt-alvo", { host: "https://www.youtube.com", videoId: yt,
      playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, disablekb: 1, fs: 0, cc_load_policy: 0, hl: "pt-BR", start: ant.posicao && (+ant.pct || 0) < 95 ? Math.max(0, +ant.posicao - 3) : 0 },
      events: {
        onReady: () => { dur = player.getDuration(); const c = $("#vcarga"); if (c) c.hidden = true; timer = setInterval(atualizar, 1000); },
        onStateChange: e => { if (e.data === 0) fim(); else { const f = $("#vfim"); if (f && e.data === 1) f.hidden = true; } },
        onError: () => { const c = $("#vcarga"); if (c) { c.hidden = false; c.textContent = "Este vídeo não abriu aqui. Peça para um adulto avisar o Claude."; } }
      } });
  } catch (e) { const c = $("#vcarga"); if (c) c.textContent = e.message; }
  const toca = () => { if (!player || !player.getPlayerState) return; if (player.getPlayerState() === 1) { querTocar = false; player.pauseVideo(); } else { querTocar = true; player.playVideo(); } };
  $("#vescudo").onclick = toca; $("#v-play").onclick = toca;
  $("#v-volta").onclick = () => player && player.seekTo(Math.max(0, player.getCurrentTime() - 10), true);
  $("#v-seek").onchange = e => { if (player && dur) { player.seekTo(e.target.value / 1000 * dur, true); ultT = -1; } };
  $("#v-vel").onchange = e => player && player.setPlaybackRate(Number(e.target.value));
  $("#v-tela").onclick = () => { const vp = $("#vp"); if (document.fullscreenElement) document.exitFullscreen(); else if (vp.requestFullscreen) vp.requestFullscreen(); else if (vp.webkitRequestFullscreen) vp.webkitRequestFullscreen(); };
  $("#vp").addEventListener("click", e => { if (e.target.id === "v-denovo") { player.seekTo(0, true); player.playVideo(); } });
  const sair = () => { enviar(true); clearInterval(timer); window.removeEventListener("hashchange", sair); try { player && player.destroy(); } catch (e) { } };
  window.addEventListener("hashchange", sair);
  document.addEventListener("visibilitychange", () => { if (document.hidden) { enviar(true); try { player && player.pauseVideo(); } catch (e) { } } }, { once: true });
}

/* ---------- gráfico principal das notas: média de cada semana, escola ao lado de casa ---------- */
const MESC = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function semanasDe(grupos, max = 8) {
  const sem = {};
  grupos.forEach((g, gi) => g.pts.forEach(p => { const s = segundaDe(p.x); (sem[s] = sem[s] || grupos.map(() => []))[gi].push(p); }));
  return Object.keys(sem).sort().slice(-max).map(s => ({ s, por: sem[s].map(a => ({ pts: a, m: a.length ? a.reduce((t, p) => t + p.y, 0) / a.length : null })) }));
}
function graficoHistoria(grupos, { meta = 8.5 } = {}) {
  const S = semanasDe(grupos);
  if (!S.length) return `<p class="muted small" style="margin:8px 0">Sem notas ainda.</p>`;
  const W = 760, H = 290, L = 30, R = 64, T = 22, B = 40, ng = grupos.length;
  const Y = v => T + (1 - v / 10) * (H - T - B), passo = (W - L - R) / S.length, bw = Math.min(46, passo * .8 / ng);
  let g = `<rect x="${L}" y="${Y(7)}" width="${W - L - R}" height="${Y(0) - Y(7)}" fill="var(--bad)" opacity=".05"/>`;
  [0, 5, 7, 10].forEach(v => g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" class="ax">${v}</text>`);
  g += `<text x="${W - R + 6}" y="${Y(7) + 4}" class="ax">7 mínimo</text>`;
  S.forEach((w, i) => {
    const cx = L + passo * (i + .5), x0 = cx - bw * ng / 2;
    w.por.forEach((c, gi) => {
      if (c.m == null) return;
      const x = x0 + gi * bw + 2, y = Y(c.m), cor = grupos[gi].cor;
      const tip = esc(`${grupos[gi].nome} · semana de ${dataBR(w.s)} · média ${fmtN(c.m)}\n` + c.pts.map(p => `${dataBR(p.x)} ${p.rotulo || ""}: ${fmtN(p.y)}`).join("\n"));
      g += `<rect x="${x}" y="${y}" width="${bw - 4}" height="${Y(0) - y}" rx="4" fill="${cor}" opacity="${c.m < 7 ? .55 : .9}"/>`;
      g += `<text x="${x + (bw - 4) / 2}" y="${y - 6}" text-anchor="middle" class="ax lbl">${fmtN(c.m)}</text>`;
      g += `<rect x="${x}" y="${T}" width="${bw - 4}" height="${Y(0) - T}" fill="transparent" data-tip="${tip}"/>`;
    });
    const fim = addDias(w.s, 6), atual = w.s === segundaDe(hoje());
    g += `<text x="${cx}" y="${H - 22}" text-anchor="middle" class="ax ${atual ? "lbl" : ""}">${atual ? "esta semana" : "semana de"}</text><text x="${cx}" y="${H - 8}" text-anchor="middle" class="ax">${dataBR(w.s).slice(0, 5)} a ${dataBR(fim).slice(0, 5)}</text>`;
  });
  g += `<line x1="${L}" x2="${W - R}" y1="${Y(meta)}" y2="${Y(meta)}" stroke="var(--sun)" stroke-dasharray="6 4" stroke-width="2"/><text x="${W - R + 6}" y="${Y(meta) + 4}" class="ax lbl">meta ${fmtN(meta)}</text>`;
  return `<svg class="tchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Média das notas por semana, escola e casa, com a meta 8,5">${g}</svg>`;
}
function manchete(grupos, meta = 8.5) {
  const S = semanasDe(grupos);
  const frases = grupos.map((g, gi) => {
    const ws = S.filter(w => w.por[gi].m != null); if (!ws.length) return "";
    const u = ws[ws.length - 1], a = ws[ws.length - 2], m = u.por[gi].m, lugar = g.nome === "Escola" ? "na escola" : "em casa";
    const quando = u.s === segundaDe(hoje()) ? "Nesta semana" : `Na semana de ${dataBR(u.s).slice(0, 5)}`;
    const comp = a ? (m > a.por[gi].m + .2 ? `, subiu de ${fmtN(a.por[gi].m)}` : m < a.por[gi].m - .2 ? `, caiu de ${fmtN(a.por[gi].m)}` : ", igual à semana anterior") : "";
    const est = m >= meta ? "na meta" : m >= 7 ? "perto da meta" : "abaixo de 7: hora de reforçar";
    return `${quando}, ${lugar}: <b>${fmtN(m)}</b> (${est}${comp})`;
  }).filter(Boolean);
  return frases.length ? frases.join(". ") + "." : "Minhas notas por semana";
}

document.addEventListener("mouseover", e => {
  const t = e.target.closest && e.target.closest("[data-tip]"); let tip = document.getElementById("tip");
  if (!t) { if (tip) tip.hidden = true; return; }
  if (!tip) { tip = document.createElement("div"); tip.id = "tip"; document.body.appendChild(tip); }
  tip.textContent = t.dataset.tip; tip.hidden = false; const r = t.getBoundingClientRect();
  tip.style.left = Math.min(window.innerWidth - 260, r.left + r.width / 2 - 10) + "px"; tip.style.top = Math.max(window.scrollY + 4, r.top + window.scrollY - tip.offsetHeight - 8) + "px";
});

/* ---------- Minhas notas ---------- */
let filtroMat = "Todas", notasVer = "todas";
const ehProvaEscola = t => /prova|simulado|olimp/i.test(t || "");
function todasNotas(d) {
  const L = d.avaliacoes.filter(a => !ehCasa(a.tipo)).map(a => ({ data: a.data, materia: a.materia, tipo: tipoCurto(a.tipo), titulo: a.titulo, nota: Number(a.nota), comentario: a.comentario, origem: "escola", classe: ehProvaEscola(a.tipo) ? "prova" : "atividade" }));
  d.historico.filter(x => x.status === "corrigida").forEach(x => L.push({ data: x.data, materia: x.materia, tipo: TIPO_PROVA[x.tipo] || "Atividade", titulo: x.titulo, nota: Number(x.nota), origem: "casa", classe: VALE_NOTA(x.tipo) ? "prova" : "atividade", tentativa: x.id }));
  return L.filter(n => !isNaN(n.nota)).sort((a, b) => String(b.data).localeCompare(String(a.data)));
}
const SERIES_NOTA = [
  { k: "escola-prova", origem: "escola", classe: "prova", nome: "Provas da escola", curto: "Provas escola", cor: "#2F55C9", tracejado: false, forma: "circulo" },
  { k: "escola-atividade", origem: "escola", classe: "atividade", nome: "Atividades da escola", curto: "Ativ. escola", cor: "#2F55C9", tracejado: true, forma: "quadrado" },
  { k: "casa-prova", origem: "casa", classe: "prova", nome: "Provas e simulados de casa", curto: "Provas casa", cor: "#1E8A5A", tracejado: false, forma: "circulo" },
  { k: "casa-atividade", origem: "casa", classe: "atividade", nome: "Atividades de casa", curto: "Ativ. casa", cor: "#1E8A5A", tracejado: true, forma: "quadrado" }
];
const amostra = s => `<svg width="34" height="12" aria-hidden="true"><line x1="1" y1="6" x2="33" y2="6" stroke="${s.cor}" stroke-width="2.5" ${s.tracejado ? 'stroke-dasharray="5 3"' : ""}/>${s.forma === "quadrado" ? `<rect x="13" y="2" width="8" height="8" rx="2" fill="${s.cor}"/>` : `<circle cx="17" cy="6" r="4" fill="${s.cor}"/>`}</svg>`;
function abaNotas(d) {
  const todas = todasNotas(d);
  const mats = ["Todas", ...new Set(todas.map(n => n.materia))];
  const notas = todas.filter(n => filtroMat === "Todas" || n.materia === filtroMat);
  const med = a => a.length ? a.reduce((s, n) => s + n.nota, 0) / a.length : null;
  const de = s => notas.filter(n => n.origem === s.origem && n.classe === s.classe);
  const visivel = s => notasVer === "todas" || notasVer === s.classe || notasVer === s.origem || notasVer === s.k;
  const tiles = SERIES_NOTA.map(s => {
    const a = de(s).slice().reverse(), m = med(a), u = a.length ? a[a.length - 1].nota : null, ant = a.length > 1 ? med(a.slice(0, -1)) : null;
    const tend = u != null && ant != null ? (u > ant + .2 ? `<span class="tend up">▲ subiu</span>` : u < ant - .2 ? `<span class="tend down">▼ caiu</span>` : `<span class="tend">= igual</span>`) : "";
    return `<button class="ntile ${visivel(s) ? "on" : ""}" data-nver="${s.k}" style="--w:${s.cor}"><span class="nt-h">${amostra(s)}${s.nome}</span><b class="${m != null ? clsNota(m) : ""}">${m != null ? fmtN(m) : "–"}</b><span class="nt-r">${a.length} nota${a.length === 1 ? "" : "s"}${u != null ? ` · última ${fmtN(u)}` : ""} ${tend}</span></button>`;
  }).join("");
  const grupos = [["escola", "Escola", "var(--escola)"], ["casa", "Casa", "var(--casa)"]].map(([o, nome, cor]) => ({ nome, cor,
    pts: SERIES_NOTA.filter(s => s.origem === o && visivel(s)).flatMap(s => de(s).map(n => ({ x: n.data, y: n.nota, prova: s.classe === "prova", rotulo: n.titulo || n.tipo }))) }));
  const barras = [...new Set(notas.map(n => n.materia))].map(m => {
    const e = med(notas.filter(n => n.materia === m && n.origem === "escola")), c = med(notas.filter(n => n.materia === m && n.origem === "casa"));
    const bar = (v, cor, rot) => `<div class="mb-l"><span>${rot}</span><div class="mb-t"><i style="width:${v != null ? v * 10 : 0}%;background:${cor}"></i><em style="left:85%"></em></div><b>${v != null ? fmtN(v) : "–"}</b></div>`;
    return `<div class="mb"><b style="color:${corMat(m)}">${esc(m)}</b>${bar(e, "#2F55C9", "Escola")}${bar(c, "#1E8A5A", "Casa")}</div>`;
  }).join("") || `<p class="muted small">Sem notas ainda.</p>`;
  const VER = [["todas", "Todas"], ["prova", "Só provas"], ["atividade", "Só atividades"], ["escola", "Só escola"], ["casa", "Só casa"]];
  return `<div class="row between"><div class="chips">${mats.map(m => `<button data-fmat="${esc(m)}" class="${m === filtroMat ? "on" : ""}">${esc(m)}</button>`).join("")}</div><span class="muted small">Notas de 0 a 10 · meta 8,5 · abaixo de 7 = hora de reforçar</span></div>
   <div class="ntiles">${tiles}</div>
   <div class="notas-grid"><section class="panel stack"><div class="row between"><span class="muted small" style="font-weight:700;letter-spacing:.02em">MINHAS NOTAS SEMANA A SEMANA</span><div class="seg">${VER.map(([k, t]) => `<button data-nver="${k}" class="${notasVer === k ? "on" : ""}">${t}</button>`).join("")}</div></div>
      <h3 style="margin:0;line-height:1.3">${manchete(grupos)}</h3>
      <div class="leg-sem"><span><i style="background:var(--escola)"></i>Escola</span><span><i style="background:var(--casa)"></i>Casa</span><span><i class="tr"></i>meta 8,5</span></div><p class="muted small" style="margin:0">Cada barra é a <b>média da semana</b>. Barra apagada = média abaixo de 7. Passe o dedo ou o mouse na barra para ver cada nota.</p>
      ${graficoHistoria(grupos)}</section>
    <section class="panel stack"><h3>Média por matéria</h3><p class="muted small" style="margin:0">Todas as notas. A risquinha é a meta 8,5.</p>${barras}</section></div>
   <section class="panel stack"><h3>Todas as notas</h3><div class="nlist">${notas.map(n => { const s = SERIES_NOTA.find(x => x.origem === n.origem && x.classe === n.classe); const l = `<span class="nl-d">${dataBR(n.data)}</span><span class="nl-o" style="--w:var(--${n.origem})">${n.origem === "casa" ? "Casa" : "Escola"}</span><span class="nl-t"><b>${esc(n.titulo || n.tipo)}</b><small>${amostra(s)} ${esc(n.materia)} · ${esc(n.tipo)}${n.classe === "prova" ? " · vale nota" : ""}</small></span><span class="nl-n ${clsNota(n.nota)}">${fmtN(n.nota)}</span>`; return n.tentativa ? `<a class="nl" href="#/resultado/${encodeURIComponent(n.tentativa)}">${l}</a>` : `<div class="nl">${l}</div>`; }).join("") || `<p class="muted">Nenhuma nota ainda.</p>`}</div></section>`;
}

/* ---------- recompensa da semana ---------- */
function cardEstrelas(d) {
  const e = d.estrelas || { saldo: 0, hoje: 0, semana: 0, ultimas: [] }, r = d.recompensa || {}, preco = Number(r.estrelas) || 0;
  const falta = preco ? Math.max(0, preco - e.saldo) : 0;
  return `<section class="panel stack estrelas-c"><div class="row between"><h3 style="margin:0">⭐ Estrelas de foco</h3><b class="est-n">${e.saldo}</b></div>
    <span class="small">Hoje: <b>+${e.hoje}</b> · nesta semana: <b>+${e.semana}</b></span>
    ${preco ? `<div class="bar" style="height:10px"><i style="width:${Math.min(100, e.saldo / preco * 100)}%;background:#E0A93B"></i></div><span class="small">${falta ? `Faltam <b>${falta}</b> estrelas para: ${esc(r.texto || "a recompensa")}` : `Você já pode trocar por: <b>${esc(r.texto || "a recompensa")}</b>! Peça para um adulto.`}</span>` : ""}
    <span class="muted small">Você ganha estrelas quando para e pensa, mostra a conta, confere antes de entregar, faz com calma, faz o caderno de erros e joga o Pare!</span>
    ${(e.ultimas || []).filter(x => x.qtd > 0).slice(0, 3).map(x => `<span class="small">+${x.qtd} ${esc(x.motivo || "")}</span>`).join("")}</section>`;
}
const HUMORES = [["animada", "😄", "Animada"], ["bem", "🙂", "Bem"], ["maisoumenos", "😐", "Mais ou menos"], ["triste", "😟", "Triste ou preocupada"], ["irritada", "😠", "Irritada"]];
let humorSel = null;
function cardHumor(d) {
  if (d.humorHoje || sess.papel === "adulto") return "";
  return `<section class="panel stack humor-c"><h3 style="margin:0">Como você está chegando hoje?</h3>
    <div class="humor-ops">${HUMORES.map(([k, e, t]) => `<button type="button" class="humor-op ${humorSel === k ? "sel" : ""}" data-humor="${k}"><span>${e}</span><small>${t}</small></button>`).join("")}</div>
    ${humorSel ? `<span class="small">E a sua energia?</span><div class="row" style="gap:8px;flex-wrap:wrap">${[["cansada", "🪫 Cansada"], ["normal", "🔋 Normal"], ["eletrica", "⚡ Elétrica"]].map(([k, t]) => `<button type="button" class="ghost" data-energia="${k}">${t}</button>`).join("")}</div>` : ""}</section>`;
}
function respiracao(fim) {
  const ov = document.createElement("div"); ov.className = "resp-ov";
  ov.innerHTML = `<div class="resp-box stack"><h2>Vamos respirar juntas</h2><p>Siga a bolinha: ela cresce quando você puxa o ar e diminui quando você solta.</p><div class="resp-bola"></div><b id="resp-txt">Puxe o ar…</b><span class="muted small" id="resp-n"></span><div class="row" style="justify-content:center;gap:8px"><button class="ghost" id="resp-pular">Pular</button></div></div>`;
  document.body.appendChild(ov);
  let n = 0; const total = 12;
  const passo = () => { if (!document.body.contains(ov)) return; const dentro = n % 2 === 0; const t = $("#resp-txt"); if (t) t.textContent = dentro ? "Puxe o ar…" : "Solte devagar…"; ov.querySelector(".resp-bola").classList.toggle("grande", dentro); falar(dentro ? "Puxe o ar" : "Solte devagar"); const c = $("#resp-n"); if (c) c.textContent = `${Math.floor(n / 2) + 1} de ${total / 2}`; n++; if (n > total) { acabar(true); return; } setTimeout(passo, 5000); };
  const acabar = ok => { if (!document.body.contains(ov)) return; ov.remove(); fim(ok); };
  ov.querySelector("#resp-pular").onclick = () => acabar(false);
  setTimeout(passo, 600);
}
function cardRecompensa(d) {
  const r = d.recompensa; if (!r || !r.texto) return "";
  const h = d.hoje || hoje(), ini = segundaDe(h), meta = Number(r.meta) || 4;
  const verdes = (d.diario || []).filter(x => x.cor === "verde" && x.data >= ini && x.data <= addDias(ini, 6)).length;
  const ok = verdes >= meta;
  return `<section class="recomp ${ok ? "ok" : ""}"><span class="rc-k">Recompensa da semana</span><b>${esc(r.texto)}</b>
    <div class="rc-dots">${Array.from({ length: meta }, (_, i) => `<i class="${i < verdes ? "on" : ""}"></i>`).join("")}</div>
    <span class="small">${ok ? "Conseguiu! Você ganhou a recompensa desta semana!" : `${verdes} de ${meta} dias verdes nesta semana. Faltam ${meta - verdes}.`}</span></section>`;
}

/* ---------- Matérias e superpoderes ---------- */
const PODERES = [
  [/causa|conectivo|por que/i, "Caçadora de Porquês", "descobre o motivo das coisas que acontecem no texto"],
  [/operação|problemas de compara/i, "Detetive das Contas", "lê um problema e descobre qual conta resolve"],
  [/tempos? verb/i, "Viajante do Tempo", "sabe se uma ação já aconteceu, está acontecendo ou ainda vai acontecer"],
  [/vai um|adição/i, "Mestra do Vai-Um", "soma números grandes sem se perder, mesmo quando a conta passa de 9"],
  [/zeros|empresta|subtra/i, "Domadora do Empresta-Um", "faz contas de menos até quando aparece zero no meio"],
  [/resto/i, "Divisora Justa", "reparte as coisas igualzinho e ainda sabe quanto sobra"],
  [/divis/i, "Divisora Justa", "reparte as coisas em partes iguais"],
  [/multiplica/i, "Multiplicadora Turbo", "descobre rapidinho quanto dá quando grupos iguais se repetem"],
  [/numeração/i, "Guardiã dos Números", "lê números grandes e sabe quanto vale cada algarismo"],
  [/geometr/i, "Arquiteta das Formas", "reconhece formas e sólidos de olhos fechados"],
  [/fraç/i, "Rainha das Frações", "entende pedaços de um inteiro, como fatias de pizza"],
  [/medidas de tempo|hora/i, "Senhora do Relógio", "calcula quanto tempo as coisas duram"],
  [/monet|dinheiro/i, "Caixa do Mercado", "faz contas com dinheiro e troco"],
  [/localizar/i, "Olho de Águia", "acha no texto exatamente a informação que a pergunta pede"],
  [/infer|figurad|contexto/i, "Leitora de Mentes", "entende o que o texto quer dizer, mesmo quando não está escrito"],
  [/finalidade|gênero/i, "Descobridora de Textos", "sabe para que serve cada texto: aviso, convite, receita ou história"],
  [/pontua/i, "Voz do Texto", "entende o que cada sinal (. ? ! ,) faz com a frase"],
  [/plural/i, "Mestra dos Plurais", "escreve o plural certinho, até das palavras difíceis em -ão"],
  [/adjetivo/i, "Pintora de Palavras", "encontra as palavras que dizem como as coisas são"],
  [/substantivo/i, "Dona dos Nomes", "reconhece as palavras que dão nome a tudo"],
  [/ortografia|acentu/i, "Escritora Caprichosa", "escreve as palavras do jeito certo, com acento e tudo"],
  [/humor|moral|tema/i, "Leitora Esperta", "entende a graça e a lição das histórias"],
  [/fato/i, "Juíza da Verdade", "separa o que é fato do que é opinião"],
  [/pronome|referência/i, "Ligadora de Pistas", "descobre de quem ou do que o texto está falando"],
  [/polu|ambiente/i, "Protetora do Planeta", "sabe o que suja o ambiente e como cuidar dele"],
  [/cardea|regiões/i, "Exploradora de Mapas", "se localiza pelo Sol e pelos pontos cardeais"],
  [/vocabul|inglês/i, "Poliglota", "entende palavras em inglês"]
];
const poderDe = hab => { const p = PODERES.find(([re]) => re.test(hab)); return p ? { nome: p[1], frase: p[2] } : { nome: hab, frase: `acerta "${hab}" quase sempre` }; };
const nivel = n => n >= 10 ? ["Ouro", "#C99A06"] : n >= 5 ? ["Prata", "#8A94A6"] : ["Bronze", "#B0703C"];
function abaMaterias(d) {
  const notas = todasNotas(d);
  const mats = [...new Set(["Português", "Matemática", ...notas.map(n => n.materia)])];
  const med = a => a.length ? a.reduce((s, n) => s + n.nota, 0) / a.length : null;
  const cards = mats.map(m => {
    const ns = notas.filter(n => n.materia === m && n.classe === "prova").slice().reverse();
    const e = med(ns.filter(n => n.origem === "escola").slice(-5)), c = med(ns.filter(n => n.origem === "casa").slice(-5));
    const prox = d.agenda.find(a => a.materia === m && diasAte(a.data) >= 0);
    return `<div class="panel stack" style="border-top:5px solid ${corMat(m)}"><div class="row between"><h3 style="color:${corMat(m)};font-size:20px">${esc(m)}</h3><span class="muted small">média das provas</span></div>
      <div class="row" style="gap:12px"><div class="mini-m" style="--w:var(--escola)">${ico("escola", 18)}<div><b class="${e != null ? clsNota(e) : ""}">${e != null ? fmtN(e) : "–"}</b><span>na escola</span></div></div><div class="mini-m" style="--w:var(--casa)">${ico("casa", 18)}<div><b class="${c != null ? clsNota(c) : ""}">${c != null ? fmtN(c) : "–"}</b><span>em casa</span></div></div></div>
      ${prox ? `<div class="expl">Próxima na escola: <b>${esc(prox.tipo)}</b> ${quando(diasAte(prox.data))} (${dataBR(prox.data)})${prox.conteudo ? ` · ${esc(prox.conteudo)}` : ""}</div>` : ""}</div>`;
  }).join("");
  // agrupa habilidades no mesmo superpoder
  const G = {};
  d.habilidades.forEach(h => { const p = poderDe(h.habilidade); const k = h.materia + "|" + p.nome; const g = G[k] = G[k] || { materia: h.materia, nome: p.nome, frase: p.frase, certas: 0, total: 0 }; g.certas += Number(h.certas); g.total += Number(h.total); });
  const lista = Object.values(G).map(g => Object.assign(g, { pct: Math.round(g.certas / g.total * 100) }));
  const poderes = lista.filter(g => g.total >= 2 && g.pct >= 85).sort((a, b) => b.total - a.total);
  const construcao = lista.filter(g => g.pct < 85).sort((a, b) => b.pct - a.pct).slice(0, 6);
  const estrela = '<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor"/></svg>';
  return `<section class="poderes stack"><div><h2>Meus superpoderes</h2><p class="muted" style="margin:4px 0 0">Cada superpoder é uma coisa que você <b>já sabe fazer muito bem</b>: acertou pelo menos 85% das vezes. Quanto mais você acerta, mais ele sobe de nível: Bronze, Prata e Ouro.</p></div>
    ${poderes.length ? `<div class="pgrid">${poderes.map(g => { const nv = nivel(g.total); return `<div class="poder" style="--mc:${corMat(g.materia)}"><div class="pd-top"><span class="pd-ic">${estrela}</span><span class="pd-nv" style="--nv:${nv[1]}">${nv[0]}</span></div><b class="pd-nome">${esc(g.nome)}</b><p>Você ${esc(g.frase)}.</p><span class="pd-rod">${esc(g.materia)} · acertou ${g.certas} de ${g.total}</span></div>`; }).join("")}</div>` : `<div class="panel muted">Seu primeiro superpoder aparece quando você acertar a mesma coisa em atividades diferentes.</div>`}
   </section>
   ${construcao.length ? `<section class="panel stack"><h2>Superpoderes em construção</h2><p class="muted small" style="margin:0">Quando a barra passar da linha amarela, vira superpoder! É nisso que vêm os próximos treinos.</p>
     <div class="list">${construcao.map(g => `<div class="li"><div style="flex:1;min-width:0"><b>${esc(g.nome)}</b><div class="muted small">${esc(g.materia)} · você ${esc(g.frase)} · acertou ${g.certas} de ${g.total}</div><div class="bar meta85"><i style="width:${Math.max(4, g.pct)}%"></i><em></em></div></div></div>`).join("")}</div></section>` : ""}
   <h2>Minhas matérias</h2><div class="grid2">${cards}</div>`;
}

function abaAgenda(d) {
  const futuras = d.agenda.filter(a => diasAte(a.data) >= 0), passadas = d.agenda.filter(a => diasAte(a.data) < 0);
  return `<div class="home"><div class="stack col-main"><section class="stack"><h2>Próximas provas e trabalhos</h2>${futuras.length ? `<div class="cards one">${futuras.map(a => cartaoAgenda(a, true)).join("")}</div>` : `<div class="panel muted">Nada anotado ainda.</div>`}</section>
   ${passadas.length ? `<section class="stack"><h3>Última semana</h3><div class="cards one">${passadas.map(a => cartaoAgenda(a, false)).join("")}</div></section>` : ""}</div>
   <aside class="col-side"><div class="painel-mundo" style="--w:var(--escola)">${faixa("escola", "Anotar prova ou trabalho")}<div class="pm-corpo stack"><p class="muted small">Ouviu a professora falar de prova, trabalho ou apresentação? Anote aqui no mesmo dia, com a data e o que vai cair. Um adulto confere depois.</p>
    <div class="form"><label class="f">Data<input type="date" id="ag-data" min="${hoje()}"></label>
     <label class="f">Matéria<select id="ag-mat">${MATERIAS.map(m => `<option>${m}</option>`).join("")}</select></label>
     <label class="f">O que é<select id="ag-tipo"><option>Prova</option><option>Trabalho</option><option>Simulado</option><option>Apresentação</option><option>Atividade avaliada</option></select></label>
     <label class="f" style="grid-column:1/-1">O que vai cair<input id="ag-cont" placeholder="ex.: frações e problemas, páginas 40 a 52"></label>
     <button id="ag-salvar">Anotar</button></div></div></div></aside></div>`;
}
function estrelas(n) { n = Number(n) || 0; return `<span class="estrelas" aria-label="${n} de 5 estrelas">${"★".repeat(n)}<span>${"★".repeat(5 - n)}</span></span>`; }

/* ---------- Livros ---------- */
function abaLivros(d) {
  const h = d.hoje || hoje(), ano = h.slice(0, 4);
  const lidosAno = d.livros.filter(l => l.status === "lido" && String(l.fim).startsWith(ano)).length;
  const meta = d.metaLivros || 0;
  const lendo = d.livros.filter(l => l.status === "lendo"), lidos = d.livros.filter(l => l.status === "lido");
  return `<div class="panel stack"><div class="row between"><h2>Meus livros de ${ano}</h2><b style="font-family:var(--display);font-size:24px">${lidosAno}${meta ? ` de ${meta}` : ""}</b></div>${meta ? `<div class="bar"><i style="width:${Math.min(100, lidosAno / meta * 100)}%"></i></div>` : ""}</div>
   <div class="home"><div class="stack col-main">
   <section class="stack"><h2>Lendo agora</h2>${lendo.length ? lendo.map(l => `<div class="panel stack"><div class="row between"><div><b>${esc(l.titulo)}</b><div class="muted small">${esc(l.autor || "")}${l.autor ? " · " : ""}${esc(l.formato || "")} · comecei em ${dataBR(l.inicio)}</div></div><div class="row"><button class="ghost mini" data-lvedit="${esc(l.id)}">Corrigir</button><button class="mini" data-terminar="${esc(l.id)}">Terminei!</button></div></div>
      <div class="form" data-edit-form="${esc(l.id)}" hidden><label class="f" style="grid-column:1/-1">Nome do livro<input data-ed-tit="${esc(l.id)}" value="${esc(l.titulo)}"></label><label class="f">Autor<input data-ed-aut="${esc(l.id)}" value="${esc(l.autor || "")}"></label><label class="f">Comecei a ler em<input type="date" data-ed-ini="${esc(l.id)}" value="${esc(l.inicio)}" max="${h}"></label><div><button data-lvsalvar="${esc(l.id)}">Salvar</button></div></div>
      <div class="stack" data-fim-form="${esc(l.id)}" hidden><span class="small">Quantas estrelas você dá para este livro?</span><div class="stars" data-stars="${esc(l.id)}">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-st="${i}" aria-label="${i} estrelas">★</button>`).join("")}</div>
      <label class="f">Uma frase sobre o livro<input data-frase="${esc(l.id)}" placeholder="ex.: Gostei quando..."></label><div><button data-fim-ok="${esc(l.id)}">Salvar</button></div></div></div>`).join("") : `<div class="panel muted">Nenhum livro em andamento.</div>`}</section>
   <section class="stack"><h2>Já li</h2>${lidos.length ? `<div class="panel list">${lidos.map(l => `<div class="li"><div><b>${esc(l.titulo)}</b><div class="muted small">${esc(l.autor || "")}${l.autor ? " · " : ""}de ${dataBR(l.inicio)} a ${dataBR(l.fim)}</div>${l.frase ? `<div class="small">“${esc(l.frase)}”</div>` : ""}</div>${l.estrelas ? estrelas(l.estrelas) : ""}</div>`).join("")}</div>` : `<div class="panel muted">O primeiro livro terminado aparece aqui.</div>`}</section></div>
   <aside class="col-side"><div class="panel stack"><h3>Comecei um livro</h3><div class="form"><label class="f" style="grid-column:1/-1">Nome do livro<input id="lv-titulo"></label><label class="f">Autor<input id="lv-autor"></label>
     <label class="f">Comecei a ler em<input type="date" id="lv-ini" value="${h}" max="${h}"></label>
     <label class="f">Como estou lendo<select id="lv-fmt"><option>Papel</option><option>Áudio</option></select></label><button id="lv-comecar">Começar</button></div></div></aside></div>`;
}

/* ---------- Ler em voz alta (sem gravação por enquanto) ---------- */
function abaLer(d) {
  const q = new URLSearchParams((location.hash.split("?")[1] || ""));
  const itemId = q.get("item") || "";
  let texto = "", titulo = "Leitura em voz alta", feito = d.feitos.includes(itemId);
  d.plano.forEach(p => (p.itens || []).forEach(it => { if (it.id === itemId) { texto = it.texto || ""; titulo = it.titulo; } }));
  const volta = sess.papel === "adulto" ? "#/aluna/hoje" : "#/hoje";
  return `<div class="home"><div class="stack col-main"><div class="panel stack"><h2>${esc(titulo)}</h2>
     ${texto ? `<div class="texto"><div class="leia">${esc(texto).replace(/\n/g, "<br>")}</div></div>` : `<p class="muted">Pegue o livro que você está lendo e escolha uma página.</p>`}</div></div>
   <aside class="col-side"><div class="panel stack"><h3>Como fazer</h3><ol class="passos"><li>Leia o texto uma vez em silêncio.</li><li>Agora leia <b>em voz alta</b>, para um adulto ou para você mesma.</li><li>Voz de pergunta no <b>?</b>, voz forte no <b>!</b> e uma voz diferente para cada personagem.</li></ol>
     ${feito ? `<span class="feito">${ico("check", 18)} Feito</span>` : itemId ? `<button data-feito="${esc(itemId)}" data-volta="${volta}">Li em voz alta</button>` : ""}<a class="btn ghost" href="${volta}">Voltar para Hoje</a></div></aside></div>`;
}

function abaEnsina(d) {
  const q = new URLSearchParams((location.hash.split("?")[1] || "")), itemId = q.get("item") || ((d.hoje || hoje()) + "-meensina");
  const volta = sess.papel === "adulto" ? "#/aluna/hoje" : "#/hoje";
  return `<div class="home"><div class="stack col-main"><div class="panel stack"><h2>Me ensina: grave a sua explicação</h2>
     <p>Explique como se estivesse ensinando alguém. Fale devagar, em 1 ou 2 minutos.</p>
     <ol class="passos"><li><b>O que eu aprendi hoje no app:</b> "Hoje eu aprendi que…"</li><li><b>Um problema, passo a passo:</b> "Primeiro eu li… É juntar, tirar ou comparar, porque… A conta é… Deu…"</li><li><b>Uma coisa da aula de hoje na escola.</b></li></ol>
     <div class="grav"><video id="gv" autoplay muted playsinline style="width:100%;max-width:420px;border-radius:12px;background:#111"></video>
       <div class="row" style="gap:8px;flex-wrap:wrap"><button id="g-ligar">Ligar câmera e microfone</button><button id="g-rec" hidden>Gravar</button><button id="g-stop" class="ghost" hidden>Parar</button></div>
       <span class="muted small" id="g-st"></span>
       <div id="g-prev" class="stack" hidden><video id="gp" controls playsinline style="width:100%;max-width:420px;border-radius:12px"></video><div class="row" style="gap:8px"><button class="ghost" id="g-ref">Gravar de novo</button><button id="g-env">Enviar para os adultos</button></div></div>
       <input type="hidden" id="g-tit" value="Me ensina"><input type="hidden" id="g-item" value="${esc(itemId)}-video"><input type="hidden" id="g-tipo" value="meensina"></div></div></div>
   <aside class="col-side"><div class="panel stack"><h3>Para que serve</h3><p class="small">Ensinar é o melhor jeito de aprender. Quem explica precisa pensar com calma em cada passo. À tarde, um adulto assiste e conversa com você.</p><a class="btn ghost" href="${volta}">Voltar para Hoje</a></div></aside></div>`;
}
function ligarGravador() {
  let stream = null, rec = null, partes = [], blob = null, t0 = 0;
  const st = m => { const e = $("#g-st"); if (e) e.textContent = m; };
  $("#g-ligar").onclick = async () => {
    try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); $("#gv").srcObject = stream; $("#g-ligar").hidden = true; $("#g-rec").hidden = false; st("Quando estiver pronta, clique em Gravar."); }
    catch (e) { st("Não consegui ligar a câmera. Peça para um adulto liberar a câmera e o microfone no navegador."); }
  };
  $("#g-rec").onclick = () => {
    partes = []; blob = null;
    const tipo = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
    rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    rec.ondataavailable = e => e.data.size && partes.push(e.data);
    rec.onstop = () => { blob = new Blob(partes, { type: rec.mimeType || "video/webm" }); $("#gp").src = URL.createObjectURL(blob); $("#g-prev").hidden = false; st(`Gravação de ${Math.round((Date.now() - t0) / 1000)} segundos.`); };
    rec.start(1000); t0 = Date.now(); $("#g-rec").hidden = true; $("#g-stop").hidden = false; st("Gravando…");
  };
  $("#g-stop").onclick = () => { rec && rec.state !== "inactive" && rec.stop(); $("#g-stop").hidden = true; $("#g-rec").hidden = false; };
  $("#g-ref").onclick = () => { $("#g-prev").hidden = true; blob = null; };
  $("#g-env").onclick = async () => {
    if (!blob) return; const b = $("#g-env"); b.disabled = true; st("Enviando… não feche a página.");
    try {
      const cfg = window.ESTUDOS;
      const ext = /mp4/.test(blob.type) ? "mp4" : "webm";
      const r = await fetch(cfg.url + "/functions/v1/gravacoes", { method: "POST", headers: { "Content-Type": "application/json", apikey: cfg.chave, Authorization: "Bearer " + cfg.chave }, body: JSON.stringify({ token: sess.token, acao: "upload", ext }) }).then(x => x.json());
      if (!r.ok) throw new Error(r.erro || "Falha ao preparar o envio.");
      const up = await fetch(r.dados.signedUrl, { method: "PUT", headers: { "Content-Type": blob.type || "video/webm" }, body: blob });
      if (!up.ok) throw new Error("O envio do vídeo falhou.");
      await api("registrarGravacao", { caminho: r.dados.caminho, tipo: ($("#g-tipo") || {}).value || "leitura", titulo: $("#g-tit").value, segundos: Math.round((Date.now() - t0) / 1000), item: $("#g-item").value || undefined });
      if (stream) stream.getTracks().forEach(t => t.stop());
      toast("Vídeo enviado! Os adultos vão assistir."); location.hash = sess.papel === "adulto" ? "#/aluna/hoje" : "#/hoje";
    } catch (e) { b.disabled = false; st(e.message); }
  };
  window.addEventListener("hashchange", function parar() { if (stream) stream.getTracks().forEach(t => t.stop()); window.removeEventListener("hashchange", parar); });
}
function ligarAluna(d) {
  const corpo = $("#corpo");
  if ($("#g-ligar")) ligarGravador();
  const exec = async (acao, dados, msg, b) => { if (b) b.disabled = true; try { await api(acao, dados); toast(msg); render(); } catch (e) { toast(e.message); if (b) b.disabled = false; } };
  corpo.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.humor) { humorSel = b.dataset.humor; render(); return; }
    if (b.dataset.energia) {
      const h = humorSel, en = b.dataset.energia; b.disabled = true;
      const salvarH = respirou => api("registrarHumor", { humor: h, energia: en, respirou }).then(() => { humorSel = null; cache.aluna = null; render(); }).catch(err => toast(err.message));
      if (h === "triste" || h === "irritada") { toast("Obrigada por contar. Antes de começar, 1 minuto de respiração."); respiracao(ok => salvarH(ok)); }
      else salvarH(false);
      return;
    }
    if (b.dataset.fmat) { filtroMat = b.dataset.fmat; render(); }
    else if (b.dataset.nver) { notasVer = notasVer === b.dataset.nver && b.dataset.nver.includes("-") ? "todas" : b.dataset.nver; render(); }
    else if (b.dataset.sem) { semanaOff = Math.max(-1, Math.min(1, semanaOff + Number(b.dataset.sem))); render(); }
    else if (b.dataset.feito) { if (b.dataset.volta) { b.disabled = true; api("marcarFeito", { item: b.dataset.feito }).then(() => { toast("Muito bem!"); location.hash = b.dataset.volta; }).catch(e => { toast(e.message); b.disabled = false; }); } else exec("marcarFeito", { item: b.dataset.feito }, "Muito bem!", b); }
    else if (b.dataset.lvedit) { const f = corpo.querySelector(`[data-edit-form="${b.dataset.lvedit}"]`); f.hidden = !f.hidden; }
    else if (b.dataset.lvsalvar) { const id = b.dataset.lvsalvar, v = k => corpo.querySelector(`[data-ed-${k}="${id}"]`).value; exec("livroEditar", { id, titulo: v("tit"), autor: v("aut"), inicio: v("ini") }, "Livro atualizado.", b); }
    else if (b.id === "ag-salvar") { const data = $("#ag-data").value; if (!data) return toast("Escolha a data."); exec("agendaAdicionar", { data, materia: $("#ag-mat").value, tipo: $("#ag-tipo").value, conteudo: $("#ag-cont").value }, "Anotado! Um adulto vai conferir.", b); }
    else if (b.dataset.agdel) { if (b.dataset.conf) { if (sess.papel === "adulto") exec("apagarDoc", { col: "agenda", id: b.dataset.agdel }, "Apagado.", b); else exec("agendaRemover", { id: b.dataset.agdel }, "Apagado.", b); } else { b.dataset.conf = 1; b.textContent = "apagar mesmo?"; b.classList.add("armado"); setTimeout(() => { if (b.isConnected) { delete b.dataset.conf; b.textContent = "apagar"; b.classList.remove("armado"); } }, 4000); } }
    else if (b.id === "lv-comecar") { const t = $("#lv-titulo").value.trim(); if (!t) return toast("Escreva o nome do livro."); exec("livroComecar", { titulo: t, autor: $("#lv-autor").value, formato: $("#lv-fmt").value, inicio: $("#lv-ini").value }, "Bom livro!", b); }
    else if (b.dataset.terminar) { const f = corpo.querySelector(`[data-fim-form="${b.dataset.terminar}"]`); f.hidden = !f.hidden; }
    else if (b.dataset.st) { const box = b.parentElement; box.dataset.val = b.dataset.st; box.querySelectorAll("button").forEach(x => x.classList.toggle("on", Number(x.dataset.st) <= Number(b.dataset.st))); }
    else if (b.dataset.fimOk) { const id = b.dataset.fimOk; const st = Number(corpo.querySelector(`[data-stars="${id}"]`).dataset.val || 0); if (!st) return toast("Escolha as estrelas."); exec("livroTerminar", { id, estrelas: st, frase: corpo.querySelector(`[data-frase="${id}"]`).value }, "Parabéns por terminar o livro!", b); }
  };
}

/* jogo "Pare!": treino e medida do controle inibitório (ir / não ir) */
async function telaPare(itemId) {
  app.className = "wrap";
  const volta = sess.papel === "adulto" ? "#/aluna/hoje" : "#/hoje";
  let d = null; try { d = cache.aluna || (cache.aluna = await api("inicioAluna")); } catch (e) { }
  const ult = ((d && d.jogos) || []).find(j => j.jogo === "pare");
  let nivel = ult ? Number(ult.nivel) || 1 : 1;
  if (ult && ult.falsos <= 3 && ult.omissoes <= 4) nivel = Math.min(5, nivel + 1); else if (ult && ult.falsos >= 8) nivel = Math.max(1, nivel - 1);
  const DUR = 1150 - 100 * (nivel - 1), ISI = 550, N = 20;
  const r = n => 2 + Math.floor(Math.random() * n);
  const CORES = [["VERDE", "#1E9E4A"], ["AZUL", "#2F55C9"], ["VERMELHO", "#D23B3B"], ["AMARELO", "#C9A100"]];
  const RODADAS = [
    { titulo: "Rodada 1", regra: "Aperte quando a conta for de MAIS. Não aperte na conta de MENOS.", gera: () => { const go = Math.random() < .7, a = r(8), b = r(8); return { go, html: `<span class="pare-conta">${a} ${go ? "+" : "−"} ${b}</span>` }; } },
    { titulo: "Rodada 2", regra: "Aperte quando a COR das letras for VERDE. Não ligue para a palavra escrita.", gera: () => { const go = Math.random() < .6; const tinta = go ? CORES[0] : CORES[1 + Math.floor(Math.random() * 3)]; const palavra = Math.random() < .6 ? CORES[Math.floor(Math.random() * 4)][0] : tinta[0]; return { go, html: `<span class="pare-cor" style="color:${tinta[1]}">${palavra}</span>` }; } },
    { titulo: "Rodada 3", regra: "Agora é o contrário! Aperte na conta de MENOS. Não aperte na conta de MAIS.", gera: () => { const go = Math.random() < .7, a = r(8), b = r(8); return { go, html: `<span class="pare-conta">${a} ${go ? "−" : "+"} ${b}</span>` }; } }
  ];
  let ri = 0, i = 0, estim = null, t0 = 0, apertou = false, rodando = false, timers = [];
  const res = RODADAS.map(() => ({ acertos: 0, omissoes: 0, falsos: 0, rts: [] }));
  const limpa = () => { timers.forEach(clearTimeout); timers = []; };
  const intro = () => {
    rodando = false;
    app.innerHTML = `<div class="tab-wrap"><div class="tab-card stack"><h1>Pare! · ${RODADAS[ri].titulo} de 3</h1><p style="font-size:20px">${RODADAS[ri].regra}</p>
      <p class="muted">Aperte a <b>barra de espaço</b> ou o botão grande. Se errar, tudo bem: o importante é <b>segurar o dedo</b> quando não é para apertar. Nível ${nivel}.</p>
      <div class="row"><button id="pr-ir">Começar a rodada</button><button class="ghost ouvir" data-fala="${esc(RODADAS[ri].regra)}">${ico("som", 18)} Ouvir</button>${ri === 0 ? `<a class="btn ghost" href="${volta}">Voltar</a>` : ""}</div></div></div>`;
    falar(RODADAS[ri].regra);
  };
  const tela = h => { app.innerHTML = `<div class="tab-wrap"><div class="tab-card stack" style="align-items:center"><span class="muted">${RODADAS[ri].titulo} · ${Math.min(i + 1, N)} de ${N}</span><div class="pare-alvo">${h}</div><button id="pr-ap" class="pare-btn">AGORA!</button></div></div>`; };
  const proximo = () => {
    if (i >= N) { ri++; i = 0; if (ri >= RODADAS.length) return fim(); return intro(); }
    estim = RODADAS[ri].gera(); apertou = false; t0 = performance.now(); tela(estim.html);
    timers.push(setTimeout(() => {
      const rr = res[ri];
      if (estim.go && !apertou) rr.omissoes++;
      if (!estim.go && !apertou) rr.acertos++;
      tela(`<span class="pare-fix">+</span>`); i++;
      timers.push(setTimeout(proximo, ISI));
    }, DUR));
  };
  const aperta = () => {
    if (!rodando || !estim || apertou) return; apertou = true;
    const rr = res[ri], rt = Math.round(performance.now() - t0);
    if (estim.go) { rr.acertos++; rr.rts.push(rt); } else { rr.falsos++; const a = $(".pare-alvo"); if (a) a.classList.add("erro"); }
  };
  const fim = async () => {
    rodando = false; limpa();
    const tot = res.reduce((a, x) => ({ acertos: a.acertos + x.acertos, omissoes: a.omissoes + x.omissoes, falsos: a.falsos + x.falsos, rts: a.rts.concat(x.rts) }), { acertos: 0, omissoes: 0, falsos: 0, rts: [] });
    const rt = tot.rts.length ? Math.round(tot.rts.reduce((a, b) => a + b, 0) / tot.rts.length) : null;
    app.innerHTML = `<div class="tab-wrap"><div class="tab-card stack"><h1>${tot.falsos <= 3 ? "Que freio!" : "Muito bem!"}</h1>
      <p>Você acertou <b>${tot.acertos}</b> de ${N * RODADAS.length}: apertou na hora certa ou segurou o dedo quando não era para apertar.</p>
      <ul class="passos"><li>Apertou quando não era para apertar: <b>${tot.falsos}</b> ${tot.falsos <= 3 ? "(ótimo controle!)" : "(da próxima vez, espere um pouquinho antes de apertar)"}</li><li>Deixou passar: <b>${tot.omissoes}</b></li></ul>
      <span class="muted small" id="pr-s">Salvando…</span><a class="btn" href="${volta}">Voltar para Hoje</a></div></div>`;
    try { await api("registrarJogo", { jogo: "pare", acertos: tot.acertos, omissoes: tot.omissoes, falsos: tot.falsos, total: N * RODADAS.length, rtMedio: rt == null ? "" : rt, nivel, item: itemId, rodadas: res.map(x => ({ acertos: x.acertos, omissoes: x.omissoes, falsos: x.falsos })) }); cache.aluna = null; $("#pr-s").textContent = "Resultado salvo. +1 estrela de foco!"; }
    catch (e) { $("#pr-s").textContent = e.message; }
  };
  app.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.fala) { falar(b.dataset.fala); return; }
    if (b.id === "pr-ir") { pararFala(); rodando = true; i = 0; tela(`<span class="pare-fix">+</span>`); timers.push(setTimeout(proximo, 900)); }
    if (b.id === "pr-ap") aperta();
  };
  app.onkeydown = e => { if (e.code === "Space") { e.preventDefault(); aperta(); } };
  window.addEventListener("hashchange", function sair() { limpa(); app.onkeydown = null; window.removeEventListener("hashchange", sair); });
  intro();
}

/* pausa ativa entre os dois blocos de estudo */
async function telaPausa(itemId) {
  app.className = "wrap";
  const volta = sess.papel === "adulto" ? "#/aluna/hoje" : "#/hoje", LIM = 300;
  let t0 = 0, timer = null;
  const ideias = ["10 polichinelos", "Alongar os braços para cima e encostar nos pés", "Beber um copo de água", "Ir até a janela e respirar fundo 5 vezes", "10 agachamentos devagar"];
  const tela = () => {
    const rest = t0 ? Math.max(0, LIM - Math.round((Date.now() - t0) / 1000)) : LIM;
    const mm = Math.floor(rest / 60), ss = String(rest % 60).padStart(2, "0");
    return `<div class="tab-wrap"><div class="tab-card stack"><h1>Pausa ativa</h1><p>Você terminou a primeira parte! Agora <b>5 minutos longe da tela</b>, mexendo o corpo. O cérebro volta mais atento.</p>
      <ol class="passos">${ideias.map(x => `<li>${x}</li>`).join("")}</ol>
      <div class="tab-conta" id="pz-t">${mm}:${ss}</div>
      ${!t0 ? `<div class="row"><button id="pz-ir">Começar a pausa</button><a class="btn ghost" href="${volta}">Voltar</a></div>` : rest > 0 ? `<p class="muted">Quando o relógio zerar, o botão libera.</p><button disabled>Volto em ${mm}:${ss}</button>` : `<button id="pz-fim">Voltei! Continuar o estudo</button>`}</div></div>`;
  };
  const desenha = () => { app.innerHTML = tela(); };
  app.onclick = async e => {
    if (e.target.id === "pz-ir") { t0 = Date.now(); falar("Pausa ativa. Cinco minutos longe da tela. Mexa o corpo e beba água."); timer = setInterval(() => { if (!location.hash.startsWith("#/pausa/")) { clearInterval(timer); return; } desenha(); if (Date.now() - t0 >= LIM * 1000) { clearInterval(timer); falar("A pausa acabou. Vamos voltar!"); } }, 1000); desenha(); }
    if (e.target.id === "pz-fim") { e.target.disabled = true; try { await api("marcarFeito", { item: itemId }); } catch (err) { } cache.aluna = null; location.hash = volta; }
  };
  desenha();
}

/* tabuada relâmpago */
async function telaTabuada(itemId) {
  app.className = "wrap";
  const N = 20, LIM = 120;
  // tabuada da semana: o item do plano pode trazer "foco" (ex.: 6) e "revisar" (ex.: [6] já vistas)
  let it = null;
  try { const d = cache.aluna || (cache.aluna = await api("inicioAluna")); (d.plano || []).forEach(p => (p.itens || []).forEach(x => { if (x.id === itemId) it = x; })); } catch (e) { }
  const foco = it && Number(it.foco) >= 2 ? Number(it.foco) : 0;
  const revisar = it && Array.isArray(it.revisar) ? it.revisar.map(Number).filter(n => n >= 2) : [];
  const pesos = [2, 3, 4, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9];
  const sorteia = a => { const b = 2 + Math.floor(Math.random() * 9); return Math.random() < .5 ? [a, b] : [b, a]; };
  let qs;
  if (foco) {
    // 14 contas da tabuada da semana (todos os fatos de 2 a 10, embaralhados) + 6 de revisão
    const fatos = [2, 3, 4, 5, 6, 7, 8, 9, 10].sort(() => Math.random() - .5);
    const doFoco = Array.from({ length: 14 }, (_, k) => { const b = fatos[k % fatos.length]; return Math.random() < .5 ? [foco, b] : [b, foco]; });
    const outras = revisar.length ? revisar : [2, 3, 4, 5];
    const rev = Array.from({ length: N - 14 }, () => sorteia(outras[Math.floor(Math.random() * outras.length)]));
    qs = doFoco.concat(rev).sort(() => Math.random() - .5);
  } else qs = Array.from({ length: N }, () => sorteia(pesos[Math.floor(Math.random() * pesos.length)]));
  let i = 0, ac = 0, t0 = 0, timer = null, erros = [];
  const volta = sess.papel === "adulto" ? "#/aluna/hoje" : "#/hoje";
  const tela = () => {
    if (!t0) return `<div class="tab-wrap"><div class="tab-card stack"><h1>Tabuada relâmpago</h1>${foco ? `<div class="expl">Tabuada da semana: <b>a do ${foco}</b>. A maioria das contas é dela; algumas são de revisão.${it && it.dica ? ` Dica: ${esc(it.dica)}` : ""}</div>` : ""}<p>São <b>${N} contas</b> de vezes em até <b>2 minutos</b>. Digite a resposta e aperte <b>Enter</b>.</p><div class="row"><button id="tb-ir">Começar</button><a class="btn ghost" href="${volta}">Voltar</a></div></div></div>`;
    if (i >= N) return "";
    const rest = Math.max(0, LIM - Math.round((Date.now() - t0) / 1000));
    return `<div class="tab-wrap"><div class="tab-card stack"><div class="row between"><span class="muted">${i + 1} de ${N}</span><b id="tb-t">${rest}s</b></div><div class="tab-conta">${qs[i][0]} × ${qs[i][1]} =</div><input id="tb-r" inputmode="numeric" autocomplete="off" class="tab-in"><div class="pbar"><i style="width:${i / N * 100}%"></i></div></div></div>`;
  };
  const fim = async () => {
    clearInterval(timer);
    const seg = Math.round((Date.now() - t0) / 1000);
    app.innerHTML = `<div class="tab-wrap"><div class="tab-card stack"><h1>${ac} de ${N}!</h1><p>Você levou ${seg} segundos${ac ? `, cerca de ${(seg / ac).toFixed(1).replace(".", ",")} segundos por conta certa` : ""}.</p>${erros.length ? `<div class="expl">Para treinar: ${erros.map(e => `${e[0]} × ${e[1]} = <b>${e[0] * e[1]}</b>`).join(" · ")}</div>` : `<div class="expl">Nenhum erro!</div>`}<span class="muted small" id="tb-s">Salvando…</span><a class="btn" href="${volta}">Voltar para Hoje</a></div></div>`;
    try { await api("registrarTabuada", { acertos: ac, total: N, segundos: seg, foco: foco || "" }); $("#tb-s").textContent = "Resultado salvo."; } catch (e) { $("#tb-s").textContent = e.message; }
  };
  const desenha = () => { app.innerHTML = tela(); const r = $("#tb-r"); if (r) r.focus(); };
  app.onclick = e => { if (e.target.id === "tb-ir") { t0 = Date.now(); timer = setInterval(() => { const rest = LIM - Math.round((Date.now() - t0) / 1000); const t = $("#tb-t"); if (t) t.textContent = Math.max(0, rest) + "s"; if (rest <= 0) { i = N; fim(); } }, 500); desenha(); } };
  app.onkeydown = e => { if (e.key !== "Enter" || e.target.id !== "tb-r" || i >= N) return; const v = parseInt(e.target.value, 10); if (v === qs[i][0] * qs[i][1]) ac++; else erros.push(qs[i]); i++; if (i >= N) fim(); else desenha(); };
  desenha();
}

/* ---------------- textos e questões ---------------- */
function quadroTirinha(fala, quem, personagens, extra) {
  const P = {
    vovo: x => `<rect x="${x - 16}" y="112" width="32" height="44" rx="9" fill="#9B7BC8"/><circle cx="${x}" cy="98" r="14" fill="#F2C9A0"/><circle cx="${x}" cy="81" r="8" fill="#BFC3CC"/><circle cx="${x - 5}" cy="98" r="4" fill="#fff" stroke="#1F2B28"/><circle cx="${x + 5}" cy="98" r="4" fill="#fff" stroke="#1F2B28"/><path d="M${x - 4} 106 q4 3 8 0" stroke="#1F2B28" fill="none"/>`,
    menino: x => `<rect x="${x - 12}" y="124" width="24" height="32" rx="7" fill="#4B8FD9"/><circle cx="${x}" cy="112" r="12" fill="#D9A57A"/><path d="M${x - 12} 110 a12 12 0 0 1 24 0 z" fill="#5A3A22"/><circle cx="${x - 4}" cy="113" r="1.5" fill="#1F2B28"/><circle cx="${x + 4}" cy="113" r="1.5" fill="#1F2B28"/><path d="M${x - 4} 118 q4 3 8 0" stroke="#1F2B28" fill="none"/>`,
    menina: x => `<rect x="${x - 12}" y="124" width="24" height="32" rx="7" fill="#E46A8C"/><circle cx="${x}" cy="112" r="12" fill="#E8B48C"/><path d="M${x - 14} 116 a14 14 0 0 1 28 0 l0 10 l-5 0 l0 -10 a9 9 0 0 0 -18 0 l0 10 l-5 0 z" fill="#3B2A1E"/><circle cx="${x - 4}" cy="113" r="1.5" fill="#1F2B28"/><circle cx="${x + 4}" cy="113" r="1.5" fill="#1F2B28"/><path d="M${x - 4} 118 q4 3 8 0" stroke="#1F2B28" fill="none"/>`,
    adulto: x => `<rect x="${x - 15}" y="108" width="30" height="48" rx="8" fill="#3E8E7E"/><circle cx="${x}" cy="94" r="13" fill="#D9A57A"/><path d="M${x - 13} 92 a13 13 0 0 1 26 0 z" fill="#2B2B2B"/><circle cx="${x - 4}" cy="95" r="1.5" fill="#1F2B28"/><circle cx="${x + 4}" cy="95" r="1.5" fill="#1F2B28"/><path d="M${x - 4} 101 q4 3 8 0" stroke="#1F2B28" fill="none"/>`
  };
  const a = P[personagens[0]] || P.vovo, b = P[personagens[1]] || P.menino;
  const tx = quem === 0 ? 60 : 140;
  const lines = []; let cur = "";
  String(fala).split(" ").forEach(w => { if ((cur + " " + w).trim().length > 24) { lines.push(cur.trim()); cur = w; } else cur += " " + w; }); lines.push(cur.trim());
  const h = lines.length * 14 + 14;
  return `<svg viewBox="0 0 200 170" role="img" aria-label="${esc(fala)}"><rect x="8" y="6" width="184" height="${h}" rx="10" fill="#fff" stroke="#1F2B28"/><path d="M${tx - 6} ${h + 5} L${tx} ${h + 17} L${tx + 6} ${h + 5}" fill="#fff" stroke="#1F2B28"/><rect x="${tx - 5}" y="${h + 3}" width="10" height="4" fill="#fff"/>${lines.map((l, i) => `<text x="100" y="${22 + i * 14}" text-anchor="middle" font-size="11.5" font-family="Figtree, sans-serif" fill="#1F2B28">${esc(l)}</text>`).join("")}<line x1="10" y1="157" x2="190" y2="157" stroke="#C9CCD6"/>${a(60)}${b(140)}${extra ? `<circle cx="159" cy="132" r="5" fill="#F2B705"/>` : ""}</svg>`;
}
function renderTexto(t) {
  if (!t) return "";
  if (Array.isArray(t)) return t.map(renderTexto).join("");
  const cred = t.credito ? `<div class="credit">${esc(t.credito)}</div>` : "";
  switch (t.tipo) {
    case "poema": return `<div class="texto">${t.titulo ? `<h2>${esc(t.titulo)}</h2>` : ""}<div class="poema">${(t.estrofes || []).map(e => e.map(esc).join("\n")).join("\n\n")}</div>${cred}</div>`;
    case "cartaz": return `<div class="cartaz">${(t.linhas || []).map(l => `<div class="${esc(l.estilo || "")}">${esc(l.t)}</div>`).join("")}</div>${cred}`;
    case "tirinha": return `<div class="tira">${(t.quadros || []).map(q => quadroTirinha(q.fala, q.quem, t.personagens || ["vovo", "menino"], q.objeto)).join("")}</div>${cred}`;
    case "html": return `<div>${t.html}</div>${cred}`;
    case "imagem": return `<div class="texto" style="text-align:center">${t.svg || ""}</div>${cred}`;
    default: return `<div class="texto">${t.titulo ? `<h2>${esc(t.titulo)}</h2>` : ""}${(t.paragrafos || []).map(p => { const b = /^\*\*/.test(p); return `<p${b ? ' style="font-weight:600"' : ""}>${esc(p.replace(/^\*\*/, ""))}</p>`; }).join("")}${cred}</div>`;
  }
}
const PENSE_ROT = { juntar: ["Juntar", "+", "ao todo, no total, os dois juntos"], tirar: ["Tirar", "−", "gastou, perdeu, deu, sobrou"], comparar: ["Comparar", "−", "a mais, a menos, a diferença, quanto falta"], repartir: ["Repartir", "÷", "dividir igual, quanto cada um"], vezes: ["Vezes", "×", "grupos iguais, dobro, triplo"] };
const PENSE_DICA = "Leia a pergunta de novo, devagar. \"A mais\", \"a menos\", \"a diferença\" e \"quanto falta\" são COMPARAR (conta de menos: maior menos menor). \"Ao todo\" é JUNTAR. \"Gastou\" ou \"sobrou\" é TIRAR. \"Cada um\" é REPARTIR. \"Grupos iguais\", \"dobro\" e \"triplo\" é VEZES.";
function penseHTML(q, ps) {
  const pe = q.pense || {}, ops = pe.opcoes || ["juntar", "tirar", "comparar", "repartir", "vezes"];
  const fala = "Pare e pense. O que a pergunta pede? " + ops.map(o => (PENSE_ROT[o] || [o])[0]).join(", ") + "?";
  if (ps.ok && (!pe.conta || ps.contaOk)) return `<div class="pense ok"><b>${ico("check", 16)} Pensei antes:</b> ${esc((PENSE_ROT[ps.escolha] || [ps.escolha])[0])}${ps.conta ? ` · conta: <b>${esc(ps.conta)}</b>` : ""}</div>`;
  let h = `<div class="pense"><div class="row between"><b>✋ Pare e pense</b><button class="ouvir mini ghost" type="button" data-fala="${esc(fala)}">${ico("som", 16)}</button></div>`;
  if (!ps.ok) {
    h += `<p style="margin:6px 0">Antes de responder: <b>o que a pergunta pede?</b></p><div class="pense-ops">${ops.map(o => { const r = PENSE_ROT[o] || [o, "", ""]; const errou = (ps.escolhas || []).includes(o); return `<button type="button" class="pense-op ${errou ? "no" : ""}" data-pense-op="${esc(o)}" data-pense-q="${esc(q.id)}" ${errou ? "disabled" : ""}><b>${esc(r[0])} ${esc(r[1])}</b><small>${esc(r[2])}</small></button>`; }).join("")}</div>`;
    if (ps.fb === "no") h += `<div class="fb no" style="margin-top:8px"><b>Ainda não.</b> ${md(ps.dica || PENSE_DICA)}</div>`;
  } else {
    h += `<div class="fb ok" style="margin:6px 0"><b>Isso!</b> É ${esc((PENSE_ROT[ps.escolha] || [ps.escolha])[0]).toLowerCase()}.</div><p style="margin:6px 0">Agora <b>escreva a conta</b> que você vai fazer:</p><div class="resp-in"><input data-pense-conta="${esc(q.id)}" value="${esc(ps.conta || "")}" placeholder="Ex.: 52 − 35" autocomplete="off"><button type="button" class="mini" data-pense-pronto="${esc(q.id)}">Pronto</button></div>`;
  }
  return h + `</div>`;
}
function renderQuestao(q, valor, modo, info) {
  // modo: fazer | revisao   (no modo fazer, info = estado do "Pare e pense" da questão)
  const tipo = q.tipo || "mc";
  let corpo = "";
  if (tipo === "mc") {
    corpo = `<div class="opts" role="radiogroup">${(q.opcoes || []).map((o, i) => {
      const L = "ABCDEFG"[i]; const sel = valor === L;
      let extra = "";
      if (modo === "revisao" && info) { if (info.correta && L === String(info.correta).toUpperCase()) extra = " certa"; else if (sel) extra = " errada"; }
      return `<label class="opt${sel ? " sel" : ""}${extra}"><input type="radio" name="r-${esc(q.id)}" value="${L}" ${sel ? "checked" : ""} ${modo === "revisao" ? "disabled" : ""} data-q="${esc(q.id)}"><span class="l">${L}</span><span>${esc(o)}</span></label>`;
    }).join("")}</div>`;
  } else if (tipo === "ditado") {
    corpo = `<div class="row"><button class="ouvir" type="button" data-fala="${esc(q.falar || "")}" data-lang="${esc(q.lang || "pt-BR")}">${ico("som", 18)} Ouvir</button><div class="resp-in"><input data-q="${esc(q.id)}" value="${esc(valor || "")}" placeholder="Escreva aqui" autocomplete="off" autocapitalize="off" spellcheck="false" ${modo === "revisao" ? "readonly" : ""}></div></div>`;
  } else if (tipo === "aberta") {
    corpo = `<textarea data-q="${esc(q.id)}" rows="${q.linhas || 4}" placeholder="Escreva aqui a sua resposta" ${modo === "revisao" ? "readonly" : ""}>${esc(valor || "")}</textarea>`;
  } else {
    corpo = `<div class="resp-in"><input data-q="${esc(q.id)}" ${tipo === "numero" ? 'inputmode="decimal"' : ""} value="${esc(valor || "")}" placeholder="${tipo === "numero" ? "Escreva só o número" : "Resposta"}" autocomplete="off" ${modo === "revisao" ? "readonly" : ""}>${q.unidade ? `<span>${esc(q.unidade)}</span>` : ""}</div>`;
  }
  if (q.falar && tipo !== "ditado") corpo = `<div class="row" style="margin-bottom:8px"><button class="ouvir" type="button" data-fala="${esc(q.falar)}" data-lang="${esc(q.lang || "pt-BR")}">${ico("som", 18)} Ouvir</button></div>` + corpo;
  let rodape = "";
  if (modo === "revisao" && info) {
    const st = info.status === "pendente" ? `<span class="tag warn">esperando correção</span>` : Number(info.pontos) >= Number(info.max) ? `<span class="tag ok">certo</span>` : `<span class="tag bad">errado</span>`;
    rodape = `<div class="row">${st}${info.correta && tipo !== "mc" ? `<span class="muted">Resposta esperada: <b>${esc(info.correta)}</b></span>` : ""}</div>${info.comentario ? `<div class="expl">${esc(info.comentario)}</div>` : ""}${q.explicacao ? `<div class="expl">${esc(q.explicacao)}</div>` : ""}`;
  }
  if (modo === "fazer" && q.pense) { const ps = info || {}; const pronto = ps.ok && (!q.pense.conta || ps.contaOk); corpo = penseHTML(q, ps) + (pronto ? corpo : ""); }
  if (modo === "revisao" && info && info.raciocinio && info.raciocinio.pense) { const rc = info.raciocinio; rodape += `<div class="expl">Pensou: ${esc((PENSE_ROT[rc.pense] || [rc.pense])[0])}${rc.ok1 === false ? " (acertou o tipo depois)" : ""}${rc.conta ? ` · conta: ${esc(rc.conta)}` : ""}</div>`; }
  return `<div class="q" id="q-${esc(q.id)}"><div class="q-h"><span class="num">${q.numero}</span><span>${md(q.enunciado)}</span></div>${q.apoio ? renderTexto(q.apoio) : ""}${corpo}${rodape}</div>`;
}

/* ---------------- lição interativa (parte de ensinar da atividade) ---------------- */
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
const textoFala = s => s.tipo === "cartoes" && s._fila && s._fila.length ? (s._virado ? s.cartoes[s._fila[0]].verso : s.cartoes[s._fila[0]].frente).replace(/\*\*/g, "") : [s.titulo, ...(s.paragrafos || []), s.destaque, s.enunciado, ...((s.passos || []).slice(0, (s._n || 0)))].filter(Boolean).join(". ").replace(/\*\*/g, "");
function blocosHTML(s) {
  const n = s._v != null ? s._v : (s._c != null ? null : s.numero);
  const c = s._c || [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];
  const valor = c[0] * 100 + c[1] * 10 + c[2];
  const col = (k, q, cls) => `<div class="bcol"><span class="bk">${k}</span><div class="bpecas">${Array.from({ length: q }, () => `<i class="${cls}"></i>`).join("")}</div><b>${q}</b></div>`;
  return `<div class="blocos">${col("Centenas", c[0], "pc")}${col("Dezenas", c[1], "pd")}${col("Unidades", c[2], "pu")}</div>
   <div class="row" style="gap:8px;flex-wrap:wrap"><button class="ghost mini" data-bl="c2d">Trocar 1 centena por 10 dezenas</button><button class="ghost mini" data-bl="d2u">Trocar 1 dezena por 10 unidades</button><button class="ghost mini" data-bl="reset">Começar de novo</button></div>
   <p class="small">Mesmo trocando as peças, o número continua sendo <b>${valor}</b>. É isso que o "empresta um" faz na conta armada!</p>`;
}
function fracaoHTML(s) {
  const n = s.partes || 4, on = s._on || [];
  return `<div class="fracao">${Array.from({ length: n }, (_, i) => `<button class="fpart ${on.includes(i) ? "on" : ""}" data-fp="${i}" aria-label="parte ${i + 1}"></button>`).join("")}</div><p class="fr-txt"><b>${on.length}/${n}</b> pintado (${on.length} de ${n} partes iguais)</p>`;
}
function praticaHTML(s) {
  s._r = s._r || {};
  return (s.questoes || []).map((q, i) => {
    const r = s._r[i];
    const fb = r ? `<div class="fb ${r.ok ? "ok" : "no"}">${r.ok ? "Isso mesmo! " : "Ainda não. "}${md(r.ok ? (q.explicacao || "") : (q.dica || q.explicacao || "Tente de novo."))}</div>` : "";
    const corpo = q.opcoes ? `<div class="opts">${q.opcoes.map((o, j) => { const L = "ABCDEF"[j]; const sel = r && r.v === L; return `<button class="opt optb ${sel ? (r.ok ? "certa" : "errada") : ""}" data-pq="${i}" data-pv="${L}"><span class="l">${L}</span><span>${esc(o)}</span></button>`; }).join("")}</div>`
      : `<div class="resp-in"><input data-pin="${i}" value="${esc(r ? r.v : "")}" placeholder="Resposta" autocomplete="off">${q.unidade ? `<span>${esc(q.unidade)}</span>` : ""}<button class="mini" data-pck="${i}">Conferir</button></div>`;
    return `<div class="q"><div class="q-h"><span class="num">${i + 1}</span><span>${md(q.enunciado)}</span><button class="ouvir mini ghost" data-fala="${esc(q.falar || q.enunciado)}" data-lang="${esc(q.lang || s.lang || "pt-BR")}">${ico("som", 16)}</button></div>${corpo}${fb}</div>`;
  }).join("");
}
function jogoHTML(s) {
  const qs = s.questoes || [];
  if (s._fim) return `<div class="jogo stack"><h3>${s._ac} de ${qs.length}!</h3><p>${s._ac === qs.length ? "Perfeito!" : "Boa! Quer tentar de novo?"}</p><div><button data-jg="ir">Jogar de novo</button></div></div>`;
  if (s._i == null) return `<div class="jogo stack"><p>${md(s.instrucao || "Responda o mais rápido que conseguir.")}</p><p class="muted small">${qs.length} perguntas · ${s.segundos || 60} segundos</p><div><button data-jg="ir">Começar o desafio</button></div></div>`;
  const q = qs[s._i];
  return `<div class="jogo stack"><div class="row between"><span class="muted">${s._i + 1} de ${qs.length}</span><b data-jt>${s._rest}s</b></div><div class="jg-p">${md(q.p)}</div><div class="jg-ops">${q.opcoes.map((o, j) => `<button class="jg-op" data-jo="${j}">${esc(o)}</button>`).join("")}</div></div>`;
}
function renderSecao(s, i, n, materia) {
  let corpo = "";
  if (s.tipo === "exemplo") {
    const k = s._n || 0;
    corpo = `${s.enunciado ? `<div class="ex-en">${md(s.enunciado)}</div>` : ""}<ol class="passos">${(s.passos || []).slice(0, k).map(p => `<li>${md(p)}</li>`).join("")}</ol>
      ${k < (s.passos || []).length ? `<button data-passo="1">${k ? "Próximo passo" : "Mostrar o primeiro passo"}</button>` : `<div class="fb ok">Pronto! Viu como se faz?</div>`}`;
  } else if (s.tipo === "blocos") corpo = blocosHTML(s);
  else if (s.tipo === "fracao") corpo = fracaoHTML(s);
  else if (s.tipo === "pratica") corpo = praticaHTML(s);
  else if (s.tipo === "jogo") corpo = jogoHTML(s);
  else if (s.tipo === "cartoes") corpo = cartoesHTML(s);
  const texto = `${(s.paragrafos || []).map(p => `<p>${md(p)}</p>`).join("")}${s.html ? `<div class="visual">${s.html}</div>` : ""}${s.destaque ? `<div class="destaque">${md(s.destaque)}</div>` : ""}`;
  const ouvir = s.tipo !== "jogo" ? `<button class="ouvir ghost" data-ouvir="1">${ico("som", 18)} Ouvir</button>` : "";
  const ROT = { explica: "Entender", exemplo: "Ver como se faz", blocos: "Mexer nas peças", fracao: "Mexer nas peças", pratica: "Fazer junto", jogo: "Desafio", cartoes: "Cartões" };
  return `<div class="licao stack"><div class="row between"><span class="mom" style="--mm:${corMat(materia)}">${ROT[s.tipo] || "Aprender"} · parte ${i + 1} de ${n}</span>${ouvir}</div>
    <h2>${esc(s.titulo || "")}</h2>${texto}${corpo}</div>`;
}

/* ---------------- fazer prova ---------------- */
function assuntosDe(qs) { const c = {}; qs.forEach(q => { const a = q.assunto || q.habilidade; if (a) c[a] = (c[a] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a]); }
function barrasAssunto(respostas) {
  const g = {}; respostas.filter(r => r.status === "corrigida").forEach(r => { const k = r.assunto || r.habilidade || "Outros"; g[k] = g[k] || [0, 0]; g[k][1]++; if (Number(r.pontos) >= Number(r.max)) g[k][0]++; });
  return Object.keys(g).map(k => { const pct = Math.round(g[k][0] / g[k][1] * 100); return `<div class="li"><div style="flex:1;min-width:0"><b>${esc(k)}</b><div class="bar" style="margin-top:6px"><i style="width:${pct}%;background:${pct >= 85 ? "var(--ok)" : pct >= 60 ? "var(--sun)" : "var(--bad)"}"></i></div></div><span class="score" style="font-size:16px">${g[k][0]}/${g[k][1]}</span></div>`; }).join("");
}
async function telaProva(id) {
  carregando("Abrindo a prova…");
  const p = await api("prova", { id });
  const chave = "rasc-" + id;
  const st = Object.assign({ etapa: -1, resp: {}, inicio: null, pense: {}, primeira: {}, conf: {}, qi: 0, ck: {} }, store.get(chave, {}));
  const TREINO = !VALE_NOTA(p.tipo);
  ["pense", "primeira", "conf", "ck"].forEach(k => { st[k] = st[k] || {}; });
  const qs = []; (p.blocos || []).forEach((b, bi) => (b.questoes || []).forEach(q => qs.push(Object.assign({ bloco: bi }, q))));
  let confirmar = false, enviando = false;
  const salvar = () => store.set(chave, st);
  const resp = () => qs.filter(q => String(st.resp[q.id] || "").trim()).length;
  const AUTO = q => ["mc", "numero", "curta", "ditado"].includes(q.tipo || "mc");
  const pensePronto = q => !q.pense || (st.pense[q.id] && st.pense[q.id].ok && (!q.pense.conta || st.pense[q.id].contaOk));
  function fbConf(q) {
    const c = st.conf[q.id]; if (!c) return "";
    if (c.certo) return `<div class="fb ok"><b>${c.n > 1 ? "Agora sim!" : "Isso mesmo!"}</b>${c.aviso ? ` ${esc(c.aviso)}` : ""}${c.n > 1 && c.explicacao ? `<div style="margin-top:6px">${md(c.explicacao)}</div>` : ""}</div>`;
    if (c.n < 2) return `<div class="fb no"><b>Ainda não.</b> Leia a pergunta de novo, devagar, e refaça a conta. Depois clique em <b>Conferir de novo</b>. (A primeira resposta é a que vale nota, mas tentar de novo ajuda você a aprender.)</div>`;
    return `<div class="fb no"><b>Ainda não.</b> Veja como se faz:${c.explicacao ? `<div style="margin-top:6px">${md(c.explicacao)}</div>` : ""}</div>`;
  }
  function desenha() {
    let html = "";
    if (st.etapa === -1 || (st.etapa < 0 && !p.licao)) {
      html = `<header class="top"><a class="brand" href="#/" style="text-decoration:none"><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" fill="var(--accent)"/><path d="M6 9c3-1.5 5.5-1.5 8 0v11c-2.5-1.5-5-1.5-8 0zM22 9c-3-1.5-5.5-1.5-8 0v11c2.5-1.5 5-1.5 8 0z" fill="#fff"/></svg>Estudos em Casa</a><a class="btn ghost mini" href="${sess.papel === "adulto" ? "#/aluna/hoje" : "#/hoje"}">Voltar</a></header>
      <div class="hello"><span class="mchip" style="--mc:${corMat(p.materia)};justify-self:start">${esc(p.materia)}</span><h1>${esc(p.titulo)}</h1>${p.descricao ? `<p>${esc(p.descricao)}</p>` : ""}<p class="muted">${TIPO_PROVA[p.tipo] || "Prova"} · ${p.licao ? `${p.licao.length} partes para aprender e ` : ""}${qs.length} perguntas${p.minutos ? ` · cerca de ${p.minutos} minutos` : ""}</p></div>
      ${p.licao ? `<div class="panel stack"><h3>Como funciona</h3><ol class="passos"><li><b>Aprender:</b> você lê, ouve e mexe nas peças (pode usar o botão Ouvir).</li><li><b>Fazer junto:</b> você tenta e o app mostra se acertou na hora.</li><li><b>Agora é com você:</b> ${qs.length} perguntas no final, <b>sem áudio</b>, igual na escola.</li></ol></div>` : ""}
      ${assuntosDe(qs).length ? `<div class="panel stack"><h3>O que cai nesta prova</h3><div class="chips">${assuntosDe(qs).map(a => `<span class="mchip" style="--mc:${corMat(p.materia)}">${esc(a)}</span>`).join("")}</div></div>` : ""}
      <div class="panel stack" ${p.licao ? "hidden" : ""}><h3>Como funciona</h3><p>${esc(p.instrucoes || "Leia com calma. Você pode voltar e trocar as respostas até entregar.")}</p><p class="muted small">Você pode parar e continuar depois: as respostas ficam guardadas neste aparelho até você entregar.</p></div>
      ${p.dica ? `<div class="confirm" style="border-style:solid"><p><b>Dica:</b> ${esc(p.dica)}</p></div>` : ""}
      <label class="ck-ent" style="justify-content:flex-start"><input type="checkbox" data-adulto="1" ${st.adulto ? "checked" : ""}> Estou fazendo com um adulto do meu lado</label>
      <div class="nav"><span></span><button id="comecar">${resp() ? "Continuar de onde parei" : "Começar"}</button></div>`;
    } else if (st.etapa === -2) {
      const n = p.licao.length, li = Math.min(st.li || 0, n - 1);
      html = `<div class="ptop"><div class="row between"><b style="font-family:var(--display);color:var(--accent)">${esc(p.titulo)}</b><span class="muted">Aprender · ${li + 1} de ${n}</span></div><div class="pbar"><i style="width:${(li + 1) / (n + 1) * 100}%"></i></div></div>
        <div class="qcol" style="max-width:900px">${renderSecao(p.licao[li], li, n, p.materia)}</div>
        <div class="nav" style="max-width:900px"><button class="ghost" id="l-volta">${li === 0 ? "Início" : "Voltar"}</button><button id="l-prox">${li === n - 1 ? "Agora é com você →" : "Próximo"}</button></div>`;
    } else if (TREINO && st.etapa < p.blocos.length) {
      const qi = Math.min(st.qi || 0, qs.length - 1), q = qs[qi]; st.etapa = q.bloco;
      const b = p.blocos[q.bloco] || {};
      const c = st.conf[q.id];
      const qh = renderQuestao(q, st.resp[q.id], "fazer", st.pense[q.id]) + (pensePronto(q) ? fbConf(q) : "");
      const botao = !pensePronto(q) ? `<button id="prox" disabled>Primeiro, pare e pense ↑</button>`
        : AUTO(q) && !c ? `<button id="conferir">Conferir</button>`
        : AUTO(q) && c && !c.certo && c.n < 2 ? `<span class="row" style="gap:8px"><button class="ghost" id="conferir">Conferir de novo</button><button id="prox">${qi === qs.length - 1 ? "Revisar e entregar" : "Próxima"}</button></span>`
        : `<button id="prox">${qi === qs.length - 1 ? "Revisar e entregar" : "Próxima"}</button>`;
      html = barra() + `<div class="stack">${p.licao && qi === 0 ? `<div class="sem-audio">${ico("som", 20)} <b>Agora é com você.</b> Uma pergunta de cada vez. Leia com calma e confira cada resposta.</div>` : ""}<span class="muted">Pergunta ${qi + 1} de ${qs.length}</span>${b.lead ? `<div class="lead">${esc(b.lead)}</div>` : ""}
        ${b.texto ? `<div class="leitura"><div class="leitura-texto">${renderTexto(b.texto)}</div><div class="stack">${qh}</div></div>` : `<div class="stack qcol">${qh}</div>`}
        <div class="nav"><button class="ghost" id="voltar">${qi === 0 ? (p.licao ? "Voltar à lição" : "Início") : "Anterior"}</button>${botao}</div></div>`;
    } else if (st.etapa < p.blocos.length) {
      const b = p.blocos[st.etapa];
      const qsB = qs.filter(q => q.bloco === st.etapa).map(q => renderQuestao(q, st.resp[q.id], "fazer", st.pense[q.id])).join("");
      html = barra() + `<div class="stack">${p.licao && st.etapa === 0 ? `<div class="sem-audio">${ico("som", 20)} <b>Agora é com você.</b> Leia sozinha, com calma. Aqui não tem áudio, igual na escola.</div>` : ""}${b.titulo ? `<h2 style="color:var(--accent)">${esc(b.titulo)}</h2>` : ""}${b.lead ? `<div class="lead">${esc(b.lead)}</div>` : ""}
        ${b.texto ? `<div class="leitura"><div class="leitura-texto">${renderTexto(b.texto)}</div><div class="stack">${qsB}</div></div>` : `<div class="stack qcol">${qsB}</div>`}
        <div class="nav"><button class="ghost" id="voltar">${st.etapa === 0 ? (p.licao ? "Voltar à lição" : "Início") : "Voltar"}</button><button id="prox">${st.etapa === p.blocos.length - 1 ? "Revisar e entregar" : "Próximo"}</button></div></div>`;
    } else {
      const faltam = qs.filter(q => !String(st.resp[q.id] || "").trim());
      html = barra() + `<div class="stack"><h2>Revisão</h2><p class="muted">Toque num número para voltar à questão.</p>
        <div class="review">${qs.map(q => `<button class="cell ${String(st.resp[q.id] || "").trim() ? "done" : "miss"}" data-goto="${esc(q.id)}">${q.numero}<small>${q.tipo === "mc" || !q.tipo ? (st.resp[q.id] || "—") : (String(st.resp[q.id] || "").trim() ? "ok" : "—")}</small></button>`).join("")}</div>
        ${faltam.length ? `<div class="confirm"><p>Faltam <b>${faltam.length}</b>: ${faltam.map(q => q.numero).join(", ")}. Questão em branco conta como erro.</p></div>` : `<div class="panel">Todas as questões respondidas.</div>`}
        ${confirmar ? `<div class="confirm"><div class="row between"><h3 style="margin:0">Antes de entregar, confira</h3><button class="ouvir mini ghost" type="button" data-fala="${esc(CHECK_ENTREGA.map(x => x[1]).join(". "))}">${ico("som", 16)}</button></div>
          <div class="stack" style="gap:6px;margin:10px 0">${CHECK_ENTREGA.map(([k, t]) => `<label class="ck-ent"><input type="checkbox" data-ck="${k}" ${st.ck[k] ? "checked" : ""}> ${esc(t)}</label>`).join("")}</div>
          <p class="small muted">Depois de entregar não dá mais para mudar as respostas.</p><div class="nav"><button class="ghost" id="nao">Ainda não</button><button id="sim" ${enviando || CHECK_ENTREGA.some(([k]) => !st.ck[k]) ? "disabled" : ""}>${enviando ? "Enviando…" : "Sim, entregar"}</button></div></div>`
        : `<div class="nav"><button class="ghost" id="voltar">Voltar</button><button id="entregar">Entregar</button></div>`}</div>`;
    }
    app.innerHTML = html;
    trava(false);
  }
  // trava contra chute: cada parte só libera o "Próximo" depois de um tempo mínimo de leitura
  const SEG_Q = Number(p.segundosPorQuestao) || (VALE_NOTA(p.tipo) ? 20 : 15), SEG_LICAO = 10;
  st.tb = st.tb || {};
  function chaveTrava() { if (st.etapa === -2) return "l" + Math.min(st.li || 0, p.licao.length - 1); if (TREINO && st.etapa >= 0 && st.etapa < (p.blocos || []).length) { const q = qs[Math.min(st.qi || 0, qs.length - 1)]; return st.conf[q.id] || !pensePronto(q) ? null : "q" + q.id; } if (st.etapa >= 0 && st.etapa < (p.blocos || []).length) return "b" + st.etapa; return null; }
  function exigido(k) { if (k[0] === "q") return SEG_Q; if (k[0] === "l") { const sec = p.licao[Number(k.slice(1))] || {}; return sec.tipo === "jogo" || sec.tipo === "pratica" || sec.tipo === "cartoes" ? 0 : SEG_LICAO; } const n = qs.filter(q => q.bloco === Number(k.slice(1))).length; return Math.min(150, n * SEG_Q); }
  function trava(conta) {
    if (sess.papel === "adulto") return;
    const k = chaveTrava(); if (!k) return;
    if (conta && !document.hidden) { st.tb[k] = (st.tb[k] || 0) + 1; if (st.tb[k] % 5 === 0) salvar(); }
    const b = $(k[0] === "l" ? "#l-prox" : k[0] === "q" ? "#conferir, #prox" : "#prox"); if (!b) return;
    if (!b.dataset.lbl) b.dataset.lbl = b.textContent;
    const falta = exigido(k) - (st.tb[k] || 0);
    if (falta > 0) { b.disabled = true; b.textContent = k[0] === "l" ? `Leia com atenção · ${falta}s` : k[0] === "q" ? `Leia de novo e confira · ${falta}s` : `Responda com calma · ${falta}s`; b.title = "O botão libera sozinho. Use o tempo para ler de novo e conferir."; }
    else if (b.disabled) { b.disabled = false; b.textContent = b.dataset.lbl; b.title = ""; }
  }
  const relogio = setInterval(() => { if (!document.body.contains(app) || !location.hash.startsWith("#/prova/")) { clearInterval(relogio); return; } trava(true); }, 1000);
  function barra() {
    const pct = Math.round(resp() / qs.length * 100);
    return `<div class="ptop"><div class="row between"><b style="font-family:var(--display);color:var(--accent)">${esc(p.titulo)}</b><span class="muted" id="cont">${resp()}/${qs.length}</span></div><div class="pbar"><i style="width:${pct}%"></i></div></div>`;
  }
  const atualizaBarra = () => { const c = $("#cont"); if (c) c.textContent = `${resp()}/${qs.length}`; const i = $(".pbar i"); if (i) i.style.width = Math.round(resp() / qs.length * 100) + "%"; };
  app.oninput = app.onchange = e => {
    const t = e.target;
    if (t.dataset && t.dataset.penseConta) { const ps = st.pense[t.dataset.penseConta] = st.pense[t.dataset.penseConta] || {}; ps.conta = t.value; salvar(); return; }
    if (t.dataset && t.dataset.adulto) { st.adulto = t.checked; salvar(); return; }
    if (t.dataset && t.dataset.ck) { st.ck[t.dataset.ck] = t.checked; salvar(); const sb = $("#sim"); if (sb && !enviando) sb.disabled = CHECK_ENTREGA.some(([k]) => !st.ck[k]); return; }
    if (!t.dataset || !t.dataset.q) return;
    st.resp[t.dataset.q] = t.value; salvar();
    if (t.type === "radio") t.closest(".opts").querySelectorAll(".opt").forEach(o => o.classList.toggle("sel", o.contains(t)));
    atualizaBarra();
  };
  app.onclick = async e => {
    const b = e.target.closest("button"); if (!b) return;
    const topoPg = () => window.scrollTo({ top: 0 });
    const sec = st.etapa === -2 ? p.licao[st.li || 0] : null;
    if (b.dataset.fala != null) { falar(b.dataset.fala, b.dataset.lang || "pt-BR"); return; }
    if (b.dataset.ouvir && sec) { falar(textoFala(sec), sec.lang || "pt-BR"); return; }
    if (sec && b.dataset.passo) { sec._n = (sec._n || 0) + 1; desenha(); falar(sec.passos[sec._n - 1].replace(/\*\*/g, ""), sec.lang || "pt-BR"); return; }
    if (sec && b.dataset.bl) { const c = sec._c || [Math.floor(sec.numero / 100), Math.floor(sec.numero / 10) % 10, sec.numero % 10];
      if (b.dataset.bl === "c2d" && c[0] > 0) { c[0]--; c[1] += 10; } else if (b.dataset.bl === "d2u" && c[1] > 0) { c[1]--; c[2] += 10; } else if (b.dataset.bl === "reset") { sec._c = null; desenha(); return; }
      sec._c = c; desenha(); return; }
    if (sec && b.dataset.fp != null) { const k = Number(b.dataset.fp); sec._on = sec._on || []; sec._on = sec._on.includes(k) ? sec._on.filter(x => x !== k) : sec._on.concat(k); desenha(); return; }
    if (sec && b.dataset.pq != null) { const i = Number(b.dataset.pq), q = sec.questoes[i]; sec._r = sec._r || {}; sec._r[i] = { v: b.dataset.pv, ok: String(b.dataset.pv).toUpperCase() === String(q.correta).toUpperCase() }; desenha(); return; }
    if (sec && b.dataset.pck != null) { const i = Number(b.dataset.pck), q = sec.questoes[i]; const v = (document.querySelector(`[data-pin="${i}"]`) || {}).value || ""; const nv = s => String(s).trim().toLowerCase().replace(",", ".").replace(/\s+/g, " ").replace(/[.!]$/, ""); sec._r = sec._r || {}; const semTil = x => nv(x).normalize("NFD").replace(/[\u0300-\u0302\u0303]/g, "").normalize("NFC"); const ultNum = x => { const m = String(x).match(/\d+(?:[.,]\d+)?/g); return m ? m[m.length - 1].replace(",", ".") : null; };
      sec._r[i] = { v, ok: [].concat(q.resposta).some(r => nv(r) === nv(v) || semTil(r) === semTil(v) || (/^\d+([.,]\d+)?$/.test(String(r).trim()) && ultNum(v) === String(r).trim().replace(",", "."))) }; desenha(); return; }
    if (sec && b.dataset.jg) { sec._i = 0; sec._ac = 0; sec._fim = false; sec._rest = sec.segundos || 60; clearInterval(sec._t); sec._t = setInterval(() => { sec._rest--; const t = document.querySelector("[data-jt]"); if (t) t.textContent = sec._rest + "s"; if (sec._rest <= 0) { clearInterval(sec._t); sec._fim = true; desenha(); } }, 1000); desenha(); return; }
    if (sec && b.dataset.jo != null) { const q = sec.questoes[sec._i]; if (Number(b.dataset.jo) === Number(q.correta)) sec._ac++; sec._i++; if (sec._i >= sec.questoes.length) { clearInterval(sec._t); sec._fim = true; } desenha(); return; }
    if (sec && b.dataset.fc) { const f = b.dataset.fc; if (f === "virar") sec._virado = !sec._virado; else if (f === "sabia") { sec._fila.shift(); sec._virado = false; } else if (f === "nao") { sec._fila.push(sec._fila.shift()); sec._virado = false; } else if (f === "de-novo") { sec._fila = null; } desenha(); if (f === "virar" && sec._virado) { const c = sec.cartoes[sec._fila[0]]; c && c.falarVerso !== false && falar(String(c.verso).replace(/\*\*/g, "")); } return; }
    if (b.dataset.penseOp) {
      const qid = b.dataset.penseQ, q = qs.find(x => x.id === qid), ps = st.pense[qid] = st.pense[qid] || { escolhas: [] };
      ps.escolhas = ps.escolhas || []; b.disabled = true;
      try { const r = await api("conferir", { id, qid, modo: "pense", escolha: b.dataset.penseOp }); ps.escolhas.push(b.dataset.penseOp); if (ps.ok1 == null) ps.ok1 = !!r.certo;
        if (r.certo) { ps.ok = true; ps.escolha = b.dataset.penseOp; ps.fb = "ok"; if (!(q.pense && q.pense.conta)) falar("Isso! Agora responda."); } else { ps.fb = "no"; ps.dica = r.dica; } }
      catch (err) { toast(err.message); }
      salvar(); desenha(); return;
    }
    if (b.dataset.pensePronto) {
      const qid = b.dataset.pensePronto, ps = st.pense[qid] = st.pense[qid] || {};
      const v = String(($(`[data-pense-conta="${qid}"]`) || {}).value || ps.conta || "").trim();
      if (!/\d/.test(v)) { toast("Escreva a conta com os números, por exemplo 52 − 35."); return; }
      ps.conta = v; ps.contaOk = true; salvar(); desenha(); return;
    }
    if (b.id === "conferir") {
      const q = qs[Math.min(st.qi || 0, qs.length - 1)], v = String(st.resp[q.id] || "").trim();
      if (!v) { toast("Responda primeiro. Depois clique em Conferir."); return; }
      b.disabled = true;
      try { const r = await api("conferir", { id, qid: q.id, resposta: v }); if (st.primeira[q.id] == null) st.primeira[q.id] = st.resp[q.id];
        const c = st.conf[q.id] || { n: 0 }; st.conf[q.id] = { certo: r.certo, explicacao: r.explicacao, aviso: r.aviso, n: c.n + 1, respostas: (c.respostas || []).concat(v) };
        falar(r.certo ? "Isso mesmo!" : "Ainda não. Leia a explicação."); }
      catch (err) { toast(err.message); }
      salvar(); desenha(); return;
    }
    if (TREINO && st.etapa >= 0 && st.etapa < p.blocos.length && (b.id === "prox" || b.id === "voltar")) {
      pararFala();
      if (b.id === "prox") { if ((st.qi || 0) < qs.length - 1) { st.qi = (st.qi || 0) + 1; st.etapa = qs[st.qi].bloco; } else st.etapa = p.blocos.length; }
      else { if ((st.qi || 0) > 0) { st.qi--; st.etapa = qs[st.qi].bloco; } else if (p.licao) { st.etapa = -2; st.li = p.licao.length - 1; } else st.etapa = -1; }
      salvar(); desenha(); topoPg(); return;
    }
    if (b.id === "l-prox") { pararFala(); if ((st.li || 0) < p.licao.length - 1) { st.li = (st.li || 0) + 1; } else { st.etapa = 0; st.licaoOk = true; } salvar(); desenha(); topoPg(); return; }
    if (b.id === "l-volta") { pararFala(); if ((st.li || 0) > 0) st.li--; else st.etapa = -1; salvar(); desenha(); topoPg(); return; }
    if (b.id === "comecar") { if (!st.inicio) st.inicio = new Date().toISOString(); if (p.licao && !st.licaoOk) { st.etapa = -2; st.li = st.li || 0; } else st.etapa = Math.max(0, st.etapa); salvar(); desenha(); topoPg(); }
    else if (b.id === "prox") { st.etapa++; salvar(); desenha(); topoPg(); }
    else if (b.id === "voltar") { if (TREINO && st.etapa >= p.blocos.length) { st.etapa = qs[qs.length - 1].bloco; st.qi = qs.length - 1; } else if (st.etapa === 0 && p.licao) { st.etapa = -2; st.li = p.licao.length - 1; } else st.etapa--; confirmar = false; salvar(); desenha(); topoPg(); }
    else if (b.dataset.goto) { const q = qs.find(x => x.id === b.dataset.goto); st.etapa = q.bloco; st.qi = qs.indexOf(q); salvar(); desenha(); const el = document.getElementById("q-" + q.id); if (el) el.scrollIntoView({ block: "center" }); }
    else if (b.id === "entregar") { confirmar = true; desenha(); }
    else if (b.id === "nao") { confirmar = false; desenha(); }
    else if (b.id === "sim" && !enviando) {
      enviando = true; desenha();
      try {
        const rac = {};
        qs.forEach(q => { const ps = st.pense[q.id], c = st.conf[q.id]; if (!ps && !c) return;
          rac[q.id] = Object.assign({}, ps ? { pense: (ps.escolhas || [])[0] || ps.escolha, escolhas: ps.escolhas || [], ok1: ps.ok1, conta: ps.conta || "" } : {}, c ? { conferiu: c.n, respostas: c.respostas || [], final: st.resp[q.id] } : {}); });
        const envio = Object.assign({}, st.resp, st.primeira, { __raciocinio: rac, __adulto: !!st.adulto, __checklist: CHECK_ENTREGA.every(([k]) => st.ck[k]) });
        const r = await api("entregar", { id, respostas: envio, inicio: st.inicio });
        store.del(chave); cache.ultimo = r;
        app.onclick = app.oninput = app.onchange = null;
        location.hash = "#/resultado/" + encodeURIComponent(r.tentativaId);
      } catch (err) { enviando = false; desenha(); toast(err.message + " Suas respostas continuam salvas neste aparelho."); }
    }
  };
  desenha();
}

/* ---------------- resultado (aluna) ---------------- */
async function telaResultado(tid) {
  app.onclick = app.oninput = app.onchange = null;
  carregando();
  const d = await api("tentativa", { id: tid });
  const t = d.tentativa;
  const msg = t.status === "aguardando" ? "Entregue! Falta um adulto corrigir as questões escritas." : t.nota >= 8.5 ? "Excelente! Você leu com atenção." : t.nota >= 7 ? "Bom trabalho! Dá para ir ainda mais longe." : "Você terminou! Agora vamos treinar juntos o que faltou.";
  const info = {}; d.respostas.forEach(r => info[r.questaoId] = r);
  const qs = []; (d.prova.blocos || []).forEach(b => (b.questoes || []).forEach(q => qs.push(q)));
  const cel = q => { const r = info[q.id] || {}; const c = r.status === "pendente" ? "pend" : Number(r.pontos) >= Number(r.max) ? "ok" : "no"; return `<div class="cell ${c}">${q.numero}<small>${c === "pend" ? "corrigir" : c === "ok" ? "certo" : "errou"}</small></div>`; };
  const erradas = qs.filter(q => info[q.id] && info[q.id].status !== "pendente" && Number(info[q.id].pontos) < Number(info[q.id].max));
  let revisao = "";
  if (t.revisaoLiberada) {
    revisao = `<div class="stack"><h2>Revisão da prova</h2>${(d.prova.blocos || []).map(b => `${b.lead ? `<div class="lead">${esc(b.lead)}</div>` : ""}${renderTexto(b.texto)}${(b.questoes || []).map(q => renderQuestao(q, d.respostasMarcadas[q.id], "revisao", info[q.id])).join("")}`).join("")}</div>`;
  }
  const extra = sess.papel === "adulto" ? `<a class="btn ghost mini" href="#/adulto/tentativa/${encodeURIComponent(tid)}">Ver como adulto</a>` : "";
  const refazer = (cache.ultimo && cache.ultimo.tentativaId === tid) ? !!cache.ultimo.refazer : (!VALE_NOTA(t.tipo) && qs.length >= 4 && Number(t.minutos) * 60 <= qs.length * 30);
  const avisoRapido = refazer ? `<div class="confirm" style="border-style:solid;border-color:var(--sun)"><h3 style="margin:0 0 4px">Foi rápido demais</h3><p style="margin:0">Você levou ${t.minutos} minuto${t.minutos > 1 ? "s" : ""} para ${qs.length} questões. Assim não dá para aprender. Essa atividade <b>volta para você refazer com calma</b>: leia a explicação, ouça e responda de novo.</p></div>` : "";
  const ganhou = cache.ultimo && cache.ultimo.tentativaId === tid ? Number(cache.ultimo.estrelas) || 0 : 0;
  const bannerEst = ganhou ? `<div class="confirm" style="border-style:solid;border-color:#E0A93B;background:#FFF8E6"><b>⭐ +${ganhou} estrela${ganhou > 1 ? "s" : ""} de foco!</b> Você ganhou por parar e pensar, mostrar a conta, conferir e fazer com calma.</div>` : "";
  app.innerHTML = topo(extra) + `<div class="stack">${bannerEst}${avisoRapido}
    <div class="panel"><div class="row" style="gap:22px">${anel(t.nota)}<div class="stack" style="gap:6px;flex:1;min-width:200px"><span class="mchip" style="--mc:${corMat(t.materia)};justify-self:start">${esc(t.materia)}</span><h2>${esc(msg)}</h2><p class="muted">${esc(t.titulo)} · ${t.pontos} de ${t.max} pontos · ${t.minutos} min</p></div></div></div>
    <div class="panel stack"><h3>Acertos por assunto</h3><div class="list">${barrasAssunto(d.respostas)}</div></div>
    <div class="panel stack"><h3>Como foi cada questão</h3><div class="review">${qs.map(cel).join("")}</div>
    ${(() => { const tl = qs.filter(q => info[q.id] && /^(Faltou o til|Faltou o acento|Resposta certa!)/.test(info[q.id].comentario || "")); return tl.length ? `<div class="expl"><b>Contou como certo, mas atenção:</b> ${tl.map(q => `questão ${q.numero}: ${esc(String(info[q.id].comentario).replace(/^Resposta certa! /, "").replace(/ \(.*$/, ""))}`).join(" · ")}</div>` : ""; })()}
    ${erradas.length && !t.revisaoLiberada ? `<p class="muted">Para revisar com um adulto:</p><div class="list">${erradas.map(q => `<div class="li"><span><b>${q.numero}.</b> ${esc(q.habilidade || "")}</span></div>`).join("")}</div>` : ""}
    ${!t.revisaoLiberada ? `<p class="muted small">Quando um adulto liberar a revisão, você vai ver aqui as respostas certas e as explicações.</p>` : ""}</div>
    ${revisao}
    <div><a class="btn" href="${sess.papel === "adulto" ? "#/aluna/hoje" : "#/hoje"}">Voltar para Hoje</a></div></div>`;
}

/* ---------------- painel dos adultos ---------------- */
async function telaAdulto(aba, sub) {
  carregando();
  const d = await api("painelAdulto");
  cache.adulto = d;
  const tabs = [["geral", "Visão geral"], ["materias", "Matérias"], ["habilidades", "Habilidades"], ["correcao", "Correção", d.pendentesCorrecao.length], ["provas", "Provas"], ["etapa0", "Etapa 0"], ["escola", "Notas da escola"], ["livros", "Livros"], ["metas", "Metas"]];
  const f = { geral: adGeral, materias: adMaterias, habilidades: adHabilidades, correcao: adCorrecao, provas: adProvas, etapa0: adEtapa0, escola: adEscola, livros: adLivros, metas: adMetas }[aba] || adGeral;
  app.innerHTML = topo(`<a class="btn ghost mini" href="painel.html">Voltar ao painel</a>`) +
    `<h2 style="margin:8px 0 14px">Correção das respostas escritas</h2><div class="stack" id="corpo">${f(d, sub)}</div>`;
  ligarAdulto(aba, d);
}
function pontosSerie(d) {
  const P = [];
  d.tentativas.filter(t => t.status === "corrigida").forEach(t => P.push({ data: t.data, materia: t.materia, nota: t.nota, grupo: "casa", titulo: t.titulo }));
  d.notas.forEach(n => {
    if (n.nota == null || n.nota === "") return; const v = Number(n.nota); if (isNaN(v)) return;
    const g = /casa/i.test(n.tipo) && !/escola/i.test(n.tipo) ? "casa" : /prova|simulado|olimp/i.test(n.tipo) ? "prova" : "escola";
    P.push({ data: String(n.data).slice(0, 10), materia: n.materia, nota: v, grupo: g, titulo: n.titulo });
  });
  return P;
}
function statusMateria(ps) {
  const ult = ps.slice().sort((a, b) => a.data.localeCompare(b.data)).slice(-4);
  if (!ult.length) return null;
  const m = ult.reduce((s, p) => s + p.nota, 0) / ult.length;
  return { media: m, chip: m >= 8.5 ? ["ok", "no alvo"] : m >= 7 ? ["warn", "atenção"] : ["bad", "reforço"] };
}
function adGeral(d) {
  const P = pontosSerie(d);
  const mats = [...new Set(P.map(p => p.materia))];
  const pend = d.provas.filter(p => !p.arquivada && p.feitas < p.permitidas);
  const fracas = d.habilidades.filter(h => h.total >= 3 && h.pct < 60).sort((a, b) => a.pct - b.pct).slice(0, 5);
  const ult = d.tentativas.slice(0, 6);
  const hojeD = d.diario.find(x => x.data === hoje());
  return `<div class="kpis">
     <div class="kpi"><b>${pend.length}</b><span>provas esperando por ela</span></div>
     <div class="kpi"><b>${d.pendentesCorrecao.length}</b><span>respostas para corrigir</span></div>
     <div class="kpi"><b>${d.tentativas.length}</b><span>provas feitas em casa</span></div>
     <div class="kpi"><b>${hojeD ? `<span class="tag ${hojeD.cor === "verde" ? "ok" : hojeD.cor === "amarelo" ? "warn" : "bad"}" style="font-size:16px">${esc(hojeD.cor)}</span>` : "—"}</b><span>cor de hoje</span></div></div>
   <div class="grid3">${mats.map(m => { const s = statusMateria(P.filter(p => p.materia === m)); return `<a class="panel" href="#/adulto/materias/${encodeURIComponent(m)}" style="text-decoration:none;color:inherit"><div class="row between"><b>${esc(m)}</b>${s ? `<span class="tag ${s.chip[0]}">${s.chip[1]}</span>` : ""}</div><div class="score ${s ? clsNota(s.media) : ""}" style="text-align:left;font-size:28px">${s ? fmtN(s.media) : "—"}</div><span class="muted small">média dos 4 últimos registros</span></a>`; }).join("") || `<div class="panel muted">Sem notas ainda.</div>`}</div>
   <div class="grid2"><div class="panel stack"><h3>Últimas provas em casa</h3>${ult.length ? `<div class="list">${ult.map(t => `<a class="li" href="#/adulto/tentativa/${encodeURIComponent(t.id)}"><div><b>${esc(t.titulo)}</b><div class="muted">${esc(t.materia)} · ${dataBR(t.data)} · ${t.minutos} min${t.status === "aguardando" ? " · corrigir" : ""}</div></div><span class="score ${clsNota(t.nota)}">${fmtN(t.nota)}</span></a>`).join("")}</div>` : `<p class="muted">Nenhuma ainda.</p>`}</div>
   <div class="panel stack"><h3>Habilidades para reforço</h3>${fracas.length ? `<div class="list">${fracas.map(h => `<div class="li"><div><b>${esc(h.habilidade)}</b><div class="muted">${esc(h.materia)} · ${h.certas}/${h.total} em ${h.provas} prova(s)</div></div><span class="tag bad">${h.pct}%</span></div>`).join("")}</div>` : `<p class="muted">Nenhuma habilidade abaixo de 60% (com pelo menos 3 questões).</p>`}</div></div>`;
}
function adMaterias(d, sub) {
  const P = pontosSerie(d);
  const mats = [...new Set(P.map(p => p.materia).concat(["Português", "Matemática"]))];
  const m = sub ? decodeURIComponent(sub) : mats[0];
  const ps = P.filter(p => p.materia === m);
  const ano = Number(hoje().slice(0, 4));
  const semAtual = semanaISO(hoje()).sem;
  const ini = Math.max(1, Math.min(...ps.filter(p => semanaISO(p.data).ano === ano).map(p => semanaISO(p.data).sem), semAtual) - 1);
  const xs = []; for (let s = ini; s <= Math.max(semAtual, ini + 3); s++) xs.push(s);
  const serie = g => xs.map(s => { const v = ps.filter(p => p.grupo === g && semanaISO(p.data).ano === ano && semanaISO(p.data).sem === s).map(p => p.nota); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
  const A = serie("prova"), B = serie("escola"), C = serie("casa");
  const pares = xs.map((_, i) => [C[i], A[i] != null ? A[i] : B[i]]).filter(p => p[0] != null && p[1] != null);
  let corr = "";
  if (pares.length >= 4) {
    const mx = pares.reduce((s, p) => s + p[0], 0) / pares.length, my = pares.reduce((s, p) => s + p[1], 0) / pares.length;
    const num = pares.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0), den = Math.sqrt(pares.reduce((s, p) => s + (p[0] - mx) ** 2, 0) * pares.reduce((s, p) => s + (p[1] - my) ** 2, 0));
    const r = den ? num / den : 0;
    corr = `Correlação casa × escola: <b>${r.toFixed(2).replace(".", ",")}</b> (${pares.length} semanas). ${r > 0.5 ? "O treino em casa está aparecendo na escola." : r < 0.2 ? "O treino em casa ainda não se reflete na escola: revise se a prova de casa cobre o que a escola cobra." : "Relação moderada."}`;
  } else corr = `A correlação casa × escola aparece com 4 semanas que tenham nota nas duas linhas (agora: ${pares.length}).`;
  const s = statusMateria(ps);
  const mediaG = g => { const v = ps.filter(p => p.grupo === g); return v.length ? fmtN(v.reduce((a, p) => a + p.nota, 0) / v.length) : "—"; };
  return `<div class="chips">${mats.map(x => `<button data-mat="${esc(x)}" class="${x === m ? "on" : ""}">${esc(x)}</button>`).join("")}</div>
   <div class="kpis"><div class="kpi"><b>${mediaG("prova")}</b><span>provas da escola</span></div><div class="kpi"><b>${mediaG("escola")}</b><span>atividades da escola</span></div><div class="kpi"><b>${mediaG("casa")}</b><span>em casa</span></div><div class="kpi"><b>${s ? `<span class="tag ${s.chip[0]}" style="font-size:16px">${s.chip[1]}</span>` : "—"}</b><span>situação</span></div></div>
   <div class="panel stack"><div class="row between"><h3>${esc(m)} · semana a semana</h3><span class="muted small">semanas ${xs[0]} a ${xs[xs.length - 1]} de ${ano}</span></div>
   ${grafico([{ nome: "Provas da escola", cor: "var(--c1)", vals: A }, { nome: "Atividades da escola", cor: "var(--c2)", vals: B }, { nome: "Em casa", cor: "var(--c3)", vals: C }], { xs, rotulos: xs.map(x => "S" + x), refs: [{ v: 8.5, cor: "var(--ok)" }, { v: 7, cor: "var(--bad)" }] })}
   <div class="legend"><span><i style="background:var(--c1)"></i>Provas da escola</span><span><i style="background:var(--c2)"></i>Atividades da escola</span><span><i style="background:var(--c3)"></i>Em casa</span><span><i style="background:var(--ok)"></i>8,5 meta</span><span><i style="background:var(--bad)"></i>7 mínimo</span></div>
   <p class="small">${corr}</p></div>
   <div class="panel stack"><h3>Registros de ${esc(m)}</h3><div class="scroll"><table class="t"><tr><th>Data</th><th>Onde</th><th>Título</th><th>Nota</th></tr>${ps.sort((a, b) => b.data.localeCompare(a.data)).map(p => `<tr><td>${dataBR(p.data)}</td><td>${p.grupo === "casa" ? "Casa" : p.grupo === "prova" ? "Prova escola" : "Atividade escola"}</td><td>${esc(p.titulo)}</td><td class="${clsNota(p.nota)}"><b>${fmtN(p.nota)}</b></td></tr>`).join("")}</table></div></div>`;
}
function adHabilidades(d) {
  const H = d.habilidades.slice().sort((a, b) => a.materia.localeCompare(b.materia) || a.pct - b.pct);
  return `<div class="panel stack"><h3>Mapa de habilidades</h3><p class="muted">Cada questão das provas de casa soma na sua habilidade. O alerta só acende com pelo menos 3 questões.</p>
   <div class="scroll"><table class="t"><tr><th>Matéria</th><th>Habilidade</th><th>Acertos</th><th>%</th><th>Provas</th><th>Última</th><th>Situação</th></tr>
   ${H.map(h => { const s = h.total < 3 ? ["", "poucos dados"] : h.pct >= 80 ? ["ok", "dominada"] : h.pct >= 60 ? ["warn", "atenção"] : ["bad", "reforço"]; return `<tr><td>${esc(h.materia)}</td><td>${esc(h.habilidade)}</td><td>${h.certas}/${h.total}</td><td><b>${h.pct}%</b></td><td>${h.provas}</td><td>${dataBR(h.ultima)}</td><td><span class="tag ${s[0]}">${s[1]}</span></td></tr>`; }).join("") || `<tr><td colspan="7" class="muted">Sem dados ainda.</td></tr>`}</table></div></div>`;
}
function adCorrecao(d) {
  if (!d.pendentesCorrecao.length) return `<div class="panel"><p class="muted">Nenhuma resposta escrita esperando correção.</p></div>`;
  return d.pendentesCorrecao.map((r, i) => `<div class="panel stack" data-corr="${i}"><div class="row between"><span class="tag">${esc(r.materia)} · questão ${r.numero}</span><span class="muted small">${dataBR(r.data)}</span></div>
    <p><b>${esc(r.enunciado)}</b></p>${r.criterio ? `<p class="muted small">Critério: ${esc(r.criterio)}</p>` : ""}
    <div class="expl" style="white-space:pre-wrap">${esc(r.resposta)}</div>
    <div class="form"><label class="f">Pontos (máx. ${r.max})<input type="number" min="0" max="${r.max}" step="0.5" id="pt-${i}"></label><label class="f" style="grid-column:span 2">Comentário para ela (opcional)<input id="cm-${i}"></label><button data-salvar-corr="${i}">Salvar correção</button></div></div>`).join("");
}
function adProvas(d) {
  return `<div class="panel stack"><h3>Provas no sistema</h3><p class="muted">As provas são criadas pelo Claude direto no banco de dados. Peça numa conversa: "gera uma prova de… para a Isabella".</p>
   <div class="scroll"><table class="t"><tr><th>Prova</th><th>Matéria</th><th>Criada</th><th>Questões</th><th>Feitas</th><th></th></tr>
   ${d.provas.map(p => `<tr><td><b>${esc(p.titulo)}</b>${p.arquivada ? ' <span class="tag">arquivada</span>' : ""}</td><td>${esc(p.materia)}</td><td>${dataBR(p.criadaEm)}</td><td>${p.totalQuestoes}</td><td>${p.feitas}/${p.permitidas}</td><td class="row"><a class="btn ghost mini" href="#/adulto/ver/${encodeURIComponent(p.id)}">Ver com gabarito</a>${p.feitas >= p.permitidas ? `<button class="mini ghost" data-reabrir="${esc(p.id)}">Liberar nova tentativa</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">Nenhuma prova ainda.</td></tr>`}</table></div></div>
   <div class="panel stack"><h3>Todas as tentativas</h3><div class="list">${d.tentativas.map(t => `<a class="li" href="#/adulto/tentativa/${encodeURIComponent(t.id)}"><div><b>${esc(t.titulo)}</b><div class="muted">${dataBR(t.data)} · ${t.minutos} min · ${t.status}${t.revisaoLiberada ? " · revisão liberada" : ""}</div></div><span class="score ${clsNota(t.nota)}">${fmtN(t.nota)}</span></a>`).join("") || `<p class="muted">Nenhuma.</p>`}</div></div>`;
}
function adEtapa0(d) {
  const h = hoje();
  const reg = d.diario.find(x => x.data === h) || {};
  const sim = v => v === true || String(v).toUpperCase() === "TRUE";
  const cores = [["verde", "Verde"], ["amarelo", "Amarelo"], ["vermelho", "Vermelho"], ["preto", "Preto"]];
  const ult = d.diario.slice(0, 56).slice().reverse();
  const sem = {};
  d.diario.forEach(x => { const s = semanaISO(x.data); const k = s.ano + "-" + String(s.sem).padStart(2, "0"); sem[k] = sem[k] || { verde: 0, amarelo: 0, vermelho: 0, preto: 0 }; if (sem[k][x.cor] != null) sem[k][x.cor]++; });
  const ks = Object.keys(sem).sort().slice(-10);
  return `<div class="panel stack"><div class="row between"><h3>Visto do dia</h3><input type="date" id="e0-data" value="${h}" style="width:auto"></div>
    <div class="cores">${cores.map(([v, l]) => `<label><input type="radio" name="e0-cor" value="${v}" ${reg.cor === v ? "checked" : ""}><span class="dias"><span class="d-${v}"></span></span>${l}</label>`).join("")}</div>
    <div class="grid3">${[["foto", "Foto da manhã enviada"], ["agenda", "Agenda anotada"], ["cadernos", "Cadernos conferidos"], ["aula", "Contou a aula"]].map(([k, l]) => `<label class="check"><input type="checkbox" id="e0-${k}" ${sim(reg[k]) ? "checked" : ""}>${l}</label>`).join("")}</div>
    <div class="form"><label class="f">Estrelas (pendências marcadas)<input type="number" min="0" id="e0-estrelas" value="${esc(reg.estrelas || 0)}"></label><label class="f">Brancos escondidos<input type="number" min="0" id="e0-branco" value="${esc(reg.branco || 0)}"></label><label class="f" style="grid-column:span 2">Observação<input id="e0-obs" value="${esc(reg.obs || "")}"></label><button id="e0-salvar">Salvar o dia</button></div></div>
   <div class="panel stack"><h3>Últimos dias</h3><div class="dias">${ult.map(x => `<span class="d-${esc(x.cor)}" title="${dataBR(x.data)}: ${esc(x.cor)}${x.obs ? " · " + esc(x.obs) : ""}"></span>`).join("") || '<span class="muted">Nenhum registro.</span>'}</div></div>
   <div class="panel stack"><h3>Semana a semana</h3><div class="scroll"><table class="t"><tr><th>Semana</th><th>Verde</th><th>Amarelo</th><th>Vermelho</th><th>Preto</th></tr>${ks.reverse().map(k => `<tr><td>${k.replace("-", " · S")}</td><td>${sem[k].verde}</td><td>${sem[k].amarelo}</td><td>${sem[k].vermelho}</td><td>${sem[k].preto}</td></tr>`).join("")}</table></div></div>`;
}
function adEscola(d) {
  return `<div class="panel stack"><h3>Registrar nota da escola</h3><div class="form">
    <label class="f">Data<input type="date" id="n-data" value="${hoje()}"></label>
    <label class="f">Matéria<select id="n-materia">${MATERIAS.map(m => `<option>${m}</option>`).join("")}</select></label>
    <label class="f">Tipo<select id="n-tipo">${TIPOS_NOTA.map(m => `<option>${m}</option>`).join("")}</select></label>
    <label class="f" style="grid-column:span 2">Título / conteúdo<input id="n-titulo" placeholder="ex.: Prova de frações"></label>
    <label class="f">Acertos<input type="number" id="n-acertos" min="0"></label><label class="f">Total<input type="number" id="n-total" min="1"></label>
    <label class="f">ou Nota (0–10)<input type="number" id="n-nota" min="0" max="10" step="0.1"></label>
    <button id="n-salvar">Registrar</button></div></div>
   <div class="panel stack"><h3>Notas registradas</h3><div class="scroll"><table class="t"><tr><th>Data</th><th>Matéria</th><th>Tipo</th><th>Título</th><th>Nota</th><th></th></tr>
   ${d.notas.slice().sort((a, b) => String(b.data).localeCompare(String(a.data))).map(n => `<tr><td>${dataBR(n.data)}</td><td>${esc(n.materia)}</td><td>${esc(n.tipo)}</td><td>${esc(n.titulo)}</td><td class="${n.nota == null ? "" : clsNota(Number(n.nota))}"><b>${n.nota == null || n.nota === "" ? "—" : fmtN(n.nota)}</b>${n.total ? ` <span class="muted small">(${n.acertos}/${n.total})</span>` : ""}</td><td><button class="mini ghost" data-excluir="Notas|${esc(n.id)}">Excluir</button></td></tr>`).join("") || `<tr><td colspan="6" class="muted">Nenhuma.</td></tr>`}</table></div></div>`;
}
function adLivros(d) {
  const ano = hoje().slice(0, 4);
  const lidos = d.livros.filter(l => l.status === "lido" && String(l.fim || "").startsWith(ano)).length;
  return `<div class="kpis"><div class="kpi"><b>${lidos}${d.metaLivros ? ` / ${d.metaLivros}` : ""}</b><span>livros lidos em ${ano}</span></div><div class="kpi"><b>${d.livros.filter(l => l.status === "lendo").length}</b><span>lendo agora</span></div></div>
   <div class="panel stack"><h3>Adicionar ou atualizar livro</h3><div class="form">
    <label class="f" style="grid-column:span 2">Título<input id="l-titulo"></label><label class="f">Autor<input id="l-autor"></label>
    <label class="f">Formato<select id="l-formato"><option>papel</option><option>audiolivro</option></select></label>
    <label class="f">Status<select id="l-status"><option>lendo</option><option>lido</option><option>na fila</option></select></label>
    <label class="f">Início<input type="date" id="l-inicio" value="${hoje()}"></label><label class="f">Fim<input type="date" id="l-fim"></label>
    <label class="f" style="grid-column:span 2">A frase dela sobre o livro<input id="l-frase"></label><input type="hidden" id="l-id"><button id="l-salvar">Salvar livro</button></div></div>
   <div class="panel stack"><h3>Livros</h3><div class="list">${d.livros.map(l => `<div class="li"><div><b>${esc(l.titulo)}</b><div class="muted">${esc(l.autor || "")} · ${esc(l.formato || "")} · ${esc(l.status || "")}${l.fim ? " · " + dataBR(l.fim) : ""}</div>${l.frase ? `<div class="small">“${esc(l.frase)}”</div>` : ""}</div><div class="row"><button class="mini ghost" data-editar-livro="${esc(l.id)}">Editar</button><button class="mini ghost" data-excluir="Livros|${esc(l.id)}">Excluir</button></div></div>`).join("") || `<p class="muted">Nenhum livro ainda.</p>`}</div></div>`;
}
function adMetas(d) {
  const per = [...new Set(d.metas.map(m => m.periodo))];
  return `<div class="panel stack"><h3>Nova meta</h3><div class="form"><label class="f">Período<input id="m-periodo" placeholder="ex.: T4 2026" value="${esc(per[0] || "")}"></label><label class="f">Área<input id="m-area" placeholder="ex.: Leitura"></label><label class="f" style="grid-column:span 2">Meta<input id="m-texto"></label><button id="m-salvar">Adicionar</button></div></div>
   ${per.map(p => { const ms = d.metas.filter(m => m.periodo === p); const ok = ms.filter(m => m.feito === true || String(m.feito).toUpperCase() === "TRUE").length; return `<div class="panel stack"><div class="row between"><h3>${esc(p)}</h3><span class="muted">${ok}/${ms.length}</span></div><div class="bar"><i style="width:${ms.length ? ok / ms.length * 100 : 0}%"></i></div>${ms.map(m => `<label class="check"><input type="checkbox" data-meta="${esc(m.id)}" ${m.feito === true || String(m.feito).toUpperCase() === "TRUE" ? "checked" : ""}><span>${m.area ? `<b>${esc(m.area)}:</b> ` : ""}${esc(m.texto)}</span></label>`).join("")}</div>`; }).join("")}`;
}
function ligarAdulto(aba, d) {
  const corpo = $("#corpo");
  const salvar = async (abaN, dados, msg) => { try { await api("salvar", { aba: abaN, dados }); toast(msg || "Salvo."); render(); } catch (e) { toast(e.message); } };
  corpo.onclick = async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.mat) { location.hash = "#/adulto/materias/" + encodeURIComponent(b.dataset.mat); }
    else if (b.dataset.reabrir) { b.disabled = true; try { await api("reabrir", { provaId: b.dataset.reabrir }); toast("Nova tentativa liberada."); render(); } catch (err) { toast(err.message); b.disabled = false; } }
    else if (b.dataset.excluir) { const [a, id] = b.dataset.excluir.split("|"); if (b.dataset.conf) { await api("excluir", { aba: a, id }); toast("Excluído."); render(); } else { b.dataset.conf = 1; b.textContent = "Confirmar"; } }
    else if (b.dataset.salvarCorr != null) {
      const i = b.dataset.salvarCorr, r = d.pendentesCorrecao[i];
      const pts = $("#pt-" + i).value; if (pts === "") return toast("Informe os pontos.");
      b.disabled = true;
      try { await api("corrigir", { tentativaId: r.tentativaId, questaoId: r.questaoId, pontos: Number(pts), comentario: $("#cm-" + i).value }); toast("Correção salva."); render(); } catch (err) { toast(err.message); b.disabled = false; }
    }
    else if (b.id === "e0-salvar") {
      const cor = (corpo.querySelector('input[name="e0-cor"]:checked') || {}).value; if (!cor) return toast("Escolha a cor do dia.");
      salvar("Diario", { data: $("#e0-data").value, cor, foto: $("#e0-foto").checked, agenda: $("#e0-agenda").checked, cadernos: $("#e0-cadernos").checked, aula: $("#e0-aula").checked, estrelas: Number($("#e0-estrelas").value || 0), branco: Number($("#e0-branco").value || 0), obs: $("#e0-obs").value }, "Dia salvo.");
    }
    else if (b.id === "n-salvar") {
      const ac = $("#n-acertos").value, tt = $("#n-total").value, nt = $("#n-nota").value;
      if (!$("#n-titulo").value || (!nt && !(ac && tt))) return toast("Preencha o título e a nota (ou acertos e total).");
      salvar("Notas", { data: $("#n-data").value, materia: $("#n-materia").value, tipo: $("#n-tipo").value, titulo: $("#n-titulo").value, acertos: ac, total: tt, nota: nt ? Number(nt) : "" }, "Nota registrada.");
    }
    else if (b.id === "l-salvar") {
      if (!$("#l-titulo").value) return toast("Informe o título.");
      salvar("Livros", { id: $("#l-id").value || undefined, titulo: $("#l-titulo").value, autor: $("#l-autor").value, formato: $("#l-formato").value, status: $("#l-status").value, inicio: $("#l-inicio").value, fim: $("#l-fim").value, frase: $("#l-frase").value }, "Livro salvo.");
    }
    else if (b.dataset.editarLivro) {
      const l = d.livros.find(x => String(x.id) === b.dataset.editarLivro);
      ["titulo", "autor", "formato", "status", "inicio", "fim", "frase", "id"].forEach(k => { const el = $("#l-" + k); if (el) el.value = l[k] || ""; });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    else if (b.id === "m-salvar") { if (!$("#m-texto").value) return; salvar("Metas", { periodo: $("#m-periodo").value, area: $("#m-area").value, texto: $("#m-texto").value, feito: false }, "Meta adicionada."); }
  };
  corpo.onchange = async e => {
    const t = e.target;
    if (t.dataset.meta) { try { await api("salvar", { aba: "Metas", dados: { id: t.dataset.meta, feito: t.checked } }); toast(t.checked ? "Meta concluída." : "Meta reaberta."); } catch (err) { toast(err.message); t.checked = !t.checked; } }
    if (t.id === "e0-data") { const r = d.diario.find(x => x.data === t.value) || {}; corpo.querySelectorAll('input[name="e0-cor"]').forEach(i => i.checked = i.value === r.cor);["foto", "agenda", "cadernos", "aula"].forEach(k => $("#e0-" + k).checked = r[k] === true || String(r[k]).toUpperCase() === "TRUE"); $("#e0-estrelas").value = r.estrelas || 0; $("#e0-branco").value = r.branco || 0; $("#e0-obs").value = r.obs || ""; }
  };
}
async function telaTentativaAdulto(tid) {
  carregando();
  const d = await api("tentativa", { id: tid });
  const t = d.tentativa;
  const info = {}; d.respostas.forEach(r => info[r.questaoId] = r);
  const hab = {}; d.respostas.filter(r => r.status === "corrigida").forEach(r => { const k = r.habilidade || "—"; hab[k] = hab[k] || [0, 0]; hab[k][1]++; if (Number(r.pontos) >= Number(r.max)) hab[k][0]++; });
  app.className = "wrap wide";
  app.innerHTML = topo(`<a class="btn ghost mini" href="painel.html">Voltar ao painel</a>`) + `<div class="stack">
   <div class="panel"><div class="row" style="gap:22px">${anel(t.nota)}<div class="stack" style="gap:6px;flex:1;min-width:220px"><span class="tag" style="justify-self:start">${esc(t.materia)}</span><h2>${esc(t.titulo)}</h2><p class="muted">${dataBR(t.data)} · ${t.pontos}/${t.max} pontos · ${t.minutos} min · ${t.status}</p>
     <div class="row"><button id="rev">${t.revisaoLiberada ? "Esconder a revisão dela" : "Liberar revisão para ela"}</button>${t.status === "aguardando" ? `<a class="btn ghost" href="#/adulto/correcao">Corrigir questões escritas</a>` : ""}</div></div></div></div>
   <div class="panel stack"><h3>Por habilidade</h3><div class="scroll"><table class="t"><tr><th>Habilidade</th><th>Acertos</th></tr>${Object.keys(hab).map(k => `<tr><td>${esc(k)}</td><td class="${hab[k][0] === hab[k][1] ? "s-ok" : "s-bad"}"><b>${hab[k][0]}/${hab[k][1]}</b></td></tr>`).join("")}</table></div></div>
   <div class="stack">${(d.prova.blocos || []).map(b => `${b.lead ? `<div class="lead">${esc(b.lead)}</div>` : ""}${renderTexto(b.texto)}${(b.questoes || []).map(q => renderQuestao(q, d.respostasMarcadas[q.id], "revisao", info[q.id]) + (q.habilidade ? `<p class="muted small" style="margin-top:-8px">Habilidade: ${esc(q.habilidade)}${q.bncc ? " · " + esc(q.bncc) : ""}</p>` : "")).join("")}`).join("")}</div></div>`;
  $("#rev").onclick = async () => { try { await api("liberarRevisao", { id: tid, valor: !t.revisaoLiberada }); toast(t.revisaoLiberada ? "Revisão escondida." : "Revisão liberada para ela."); render(); } catch (e) { toast(e.message); } };
}
async function telaVerProva(id) {
  carregando();
  const p = await api("prova", { id });
  app.className = "wrap";
  app.innerHTML = topo(`<a class="btn ghost mini" href="painel.html">Voltar ao painel</a>`) + `<div class="stack"><h1>${esc(p.titulo)}</h1><p class="muted">${esc(p.materia)} · ${p.totalQuestoes} questões · gabarito visível só para adultos</p>
   ${(p.blocos || []).map(b => `${b.titulo ? `<h2>${esc(b.titulo)}</h2>` : ""}${b.lead ? `<div class="lead">${esc(b.lead)}</div>` : ""}${renderTexto(b.texto)}${(b.questoes || []).map(q => renderQuestao(q, q.tipo === "mc" || !q.tipo ? q.correta : "", "revisao", { correta: q.correta != null ? q.correta : (q.aceitas || []).join(" / ") || q.criterio, status: "corrigida", pontos: 1, max: 1 }) + `<p class="muted small" style="margin-top:-8px">${esc(q.habilidade || "")}${q.bncc ? " · " + esc(q.bncc) : ""}</p>`).join("")}`).join("")}</div>`;
}

render();
})();

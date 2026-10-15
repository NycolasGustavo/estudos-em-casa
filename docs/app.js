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
const MATERIAS = ["Português", "Matemática", "Ciências", "História", "Geografia", "Inglês", "Arte", "Ed. Física", "Ensino Religioso"];
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
  app.innerHTML = `<div class="login stack"><div class="brand" style="justify-content:center;font-size:24px"><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" fill="var(--accent)"/><path d="M6 9c3-1.5 5.5-1.5 8 0v11c-2.5-1.5-5-1.5-8 0zM22 9c-3-1.5-5.5-1.5-8 0v11c2.5-1.5 5-1.5 8 0z" fill="#fff"/></svg>Estudos em Casa</div>
    <p class="muted">Digite o seu PIN</p>
    <div class="pin" id="pin">${"<span></span>".repeat(4)}</div>
    <div class="erro" id="erro"></div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "OK"].map(k => `<button data-k="${k}" aria-label="${k === "⌫" ? "apagar" : k}">${k}</button>`).join("")}</div>
    <p class="muted small">PIN com mais de 4 números? Use o teclado e aperte Enter.</p></div>`;
  const pinsEl = $("#pin");
  const desenha = () => { const n = Math.max(4, pin.length); pinsEl.innerHTML = Array.from({ length: n }, (_, i) => `<span class="${i < pin.length ? "f" : ""}">${i < pin.length ? "•" : ""}</span>`).join(""); };
  const enviar = async () => {
    if (!pin) return;
    $("#erro").textContent = "Conferindo…";
    try { const d = await api("login", { pin }); sess = d; store.set("estudos-sessao", d); if (d.papel === "adulto") { location.href = "painel.html"; return; } location.hash = "#/"; render(); }
    catch (e) { $("#erro").textContent = e.message; pin = ""; desenha(); }
  };
  const tecla = k => { if (k === "⌫") pin = pin.slice(0, -1); else if (k === "OK") return enviar(); else if (pin.length < 8) pin += k; desenha(); };
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
const MATCOR = { "Português": "#7A4FD6", "Matemática": "#D2632A", "Ciências": "#C2185B", "História": "#8E5A2B", "Geografia": "#0E7C86", "Inglês": "#C2413A", "Arte": "#B8860B", "Artes": "#B8860B", "Educação Física": "#5E6483", "Ensino Religioso": "#7A6A53", "Leitura": "#7A4FD6", "Disciplinar": "#0E7C86", "Informática": "#5E6483" };
const corMat = m => MATCOR[m] || "#5E6483";
const ehGrande = t => /prova|simulado|olimp|trabalho/i.test(t || "");
const ehCasa = t => /\(casa\)/i.test(t || "");
const tipoCurto = t => String(t || "").replace(/\s*\((escola|casa)\)\s*/i, "") || "Atividade";
const diasAte = d => Math.round((new Date(d + "T12:00:00") - new Date(hoje() + "T12:00:00")) / 864e5);
const quando = n => n === 0 ? "hoje" : n === 1 ? "amanhã" : n > 1 ? `em ${n} dias` : n === -1 ? "ontem" : `há ${-n} dias`;
const TIPO_PROVA = { simulado: "Simulado", prova: "Prova", atividade: "Atividade", revisao: "Revisão", aquecimento: "Aquecimento", reforco: "Reforço" };
const VALE_NOTA = t => t === "prova" || t === "simulado";
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
  cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
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
const NAV = [["hoje", "Hoje"], ["aulas", "Minhas aulas"], ["notas", "Minhas notas"], ["materias", "Matérias"], ["agenda", "Agenda"], ["livros", "Livros"]];
function concha(aba, titulo, corpo) {
  const base = sess.papel === "adulto" ? "#/aluna/" : "#/";
  return `<div class="shell"><aside class="side"><a class="brand" href="${base}hoje"><svg width="30" height="30" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" fill="var(--accent)"/><path d="M6 9c3-1.5 5.5-1.5 8 0v11c-2.5-1.5-5-1.5-8 0zM22 9c-3-1.5-5.5-1.5-8 0v11c2.5-1.5 5-1.5 8 0z" fill="#fff"/></svg><span>Estudos<br>em Casa</span></a>
    <nav class="snav">${NAV.map(([k, l]) => `<a href="${base}${k}" class="${aba === k ? "on" : ""}">${ico(k)}<span>${l}</span></a>`).join("")}</nav>
    <div class="side-foot">${sess.papel === "adulto" ? `<a class="btn ghost mini" href="painel.html">Painel dos adultos</a>` : ""}<span>${esc(sess.nome)}</span><button class="mini ghost" id="sair">Sair</button></div></aside>
    <main class="main"><div class="mtop"><h1>${titulo}</h1>${widgetAula()}</div><div class="stack" id="corpo">${corpo}</div></main></div>`;
}

function todasNotas(d) {
  const L = d.avaliacoes.map(a => ({ data: a.data, materia: a.materia, tipo: a.tipo, titulo: a.titulo, nota: Number(a.nota), comentario: a.comentario, acertos: a.acertos, total: a.total, origem: ehCasa(a.tipo) ? "casa" : "escola", grande: ehGrande(a.tipo) }));
  d.historico.filter(h => h.status === "corrigida" && VALE_NOTA(h.tipo)).forEach(h => L.push({ data: h.data, materia: h.materia, tipo: TIPO_PROVA[h.tipo] + " (casa)", titulo: h.titulo, nota: h.nota, acertos: h.pontos, total: h.max, origem: "casa", grande: true, tentativa: h.id }));
  return L.filter(n => !isNaN(n.nota)).sort((a, b) => String(b.data).localeCompare(String(a.data)));
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
    ${a.conteudo ? `<div class="small">${esc(a.conteudo)}</div>` : ""}<span class="muted small">${a.confirmado ? "✓ conferido por um adulto" : "esperando um adulto conferir"}</span></div>
    ${podeApagar && !a.confirmado ? `<button class="mini ghost" data-agdel="${esc(a.id)}">Apagar</button>` : ""}</div>`;
}

async function telaAluna(aba) {
  app.className = "shell-wrap";
  if (!NAV.some(t => t[0] === aba) && aba !== "ler") aba = "hoje";
  if (telaAluna.ultima !== aba) { semanaOff = 0; telaAluna.ultima = aba; }
  if (!cache.aluna) app.innerHTML = `<p class="muted" style="padding:40px">Carregando…</p>`;
  const d = await api("inicioAluna");
  cache.aluna = d;
  const primeiro = (d.nome || sess.nome || "").split(" ")[0];
  const T = { hoje: `Oi, <span class="hl">${esc(primeiro)}</span>!`, aulas: "Minhas aulas", notas: "Minhas notas", materias: "Matérias", agenda: "Agenda", livros: "Livros", ler: "Ler em voz alta" };
  const f = { hoje: abaHoje, aulas: abaAulas, notas: abaNotas, materias: abaMaterias, agenda: abaAgenda, livros: abaLivros, ler: abaLer }[aba];
  app.innerHTML = concha(aba === "ler" ? "hoje" : aba, T[aba], f(d));
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
  const h = d.hoje || hoje();
  if (dia > h) return "bloqueado";
  return dia < h ? "atrasado" : "hoje";
}
const urlLer = it => `#/${sess.papel === "adulto" ? "aluna/" : ""}ler?item=${encodeURIComponent(it.id)}`;
function acaoItem(d, it) {
  if (it.provaId) return `<a class="btn" href="#/prova/${encodeURIComponent(it.provaId)}">${store.get("rasc-" + it.provaId) ? "Continuar" : "Começar"}</a>`;
  if (it.acao === "tabuada") return `<a class="btn" href="#/tabuada/${encodeURIComponent(it.id)}">Jogar</a>`;
  if (it.acao === "gravar" || it.acao === "ler") return `<a class="btn" href="${urlLer(it)}">Ler</a>`;
  if (it.acao === "livro") return `<button class="ghost" data-feito="${esc(it.id)}">Li hoje</button>`;
  return `<button class="ghost" data-feito="${esc(it.id)}">Marcar feito</button>`;
}
const MOMENTO = { aquecimento: ["Aquecimento", "#B8860B"], frio: ["Revisão de ontem · sangue frio", "#0E7C86"], quente: ["Preparar a aula de hoje · sangue quente", "#D2632A"], missao: ["Missão do dia", "#7A4FD6"], prova: ["Prova · vale nota", "#C2413A"], simulado: ["Simulado · vale nota", "#C2413A"], extra: ["Extra", "#5E6483"], livro: ["Livro", "#5E6483"] };
function linhaItem(d, dia, it, i, ativo) {
  const st = estadoItem(d, dia, it);
  const m = MOMENTO[it.momento] || ["Atividade", "#5E6483"];
  let botao;
  if (st === "feito") botao = `<span class="feito">${ico("check", 18)} Feito</span>`;
  else if (st === "bloqueado") botao = `<span class="trava">${ico("cadeado", 18)} Abre ${DCURTO[diaSem(dia)].toLowerCase()} ${dataBR(dia)}</span>`;
  else botao = acaoItem(d, it);
  return `<div class="item ${st === "feito" ? "ok" : ""} ${st === "bloqueado" ? "lock" : ""} ${ativo ? "ativo" : ""}"><div class="inum">${st === "feito" ? ico("check", 20) : st === "bloqueado" ? ico("cadeado", 18) : i + 1}</div>
    <div class="ibody"><span class="mom" style="--mm:${m[1]}">${m[0]}${it.minutos ? ` · ${it.minutos} min` : ""}</span><b>${esc(it.titulo)}</b>${it.descricao ? `<span class="muted small">${esc(it.descricao)}</span>` : ""}</div>${botao}</div>`;
}

/* ---------- Hoje ---------- */
function abaHoje(d) {
  const h = d.hoje || hoje();
  const plano = d.plano.find(p => p._id === h);
  const dataTxt = `${DIAS[diaSem(h)]}, ${dataBR(h)}`;
  let estudo;
  if (plano && plano.itens && plano.itens.length) {
    const feitos = plano.itens.filter(it => itemFeito(d, plano, it)).length;
    const prox = plano.itens.findIndex(it => !itemFeito(d, plano, it));
    estudo = `<section class="painel-mundo" style="--w:var(--casa)">${faixa("casa", `Estudo de hoje · ${plano.minutos || 45} minutos`)}
      <div class="pm-corpo"><span class="muted">${feitos === plano.itens.length ? "<b>Tudo feito hoje! Parabéns!</b>" : `Faça na ordem, de cima para baixo. ${feitos} de ${plano.itens.length} feitos.`}</span>
      <div class="bar" style="height:12px"><i style="width:${feitos / plano.itens.length * 100}%;background:var(--casa)"></i></div>
      <div class="itens">${plano.itens.map((it, i) => linhaItem(d, h, it, i, i === prox)).join("")}</div></div></section>`;
  } else {
    const prox = d.plano.filter(p => p._id > h && (p.itens || []).length).sort((a, b) => a._id.localeCompare(b._id))[0];
    estudo = `<section class="painel-mundo" style="--w:var(--casa)">${faixa("casa", "Estudo de hoje")}<div class="pm-corpo">
      <p>${diaSem(h) === 0 ? "Domingo é dia de descanso. Aproveite!" : "Hoje não tem estudo marcado."}</p>
      ${prox ? `<p><b>O próximo estudo abre ${DIAS[diaSem(prox._id)].toLowerCase()}, ${dataBR(prox._id)}</b> (${prox.itens.length} atividades, ${prox.minutos || 45} minutos):</p><div class="itens">${prox.itens.map((it, i) => linhaItem(d, prox._id, it, i, false)).join("")}</div>` : ""}</div></section>`;
  }
  const atrasados = [];
  d.plano.filter(p => p._id < h).forEach(p => (p.itens || []).forEach(it => { if (estadoItem(d, p._id, it) === "atrasado" && it.provaId) atrasados.push([p._id, it]); }));
  const aula = infoAula(), proxEsc = d.agenda.filter(a => diasAte(a.data) >= 0).slice(0, 3);
  const lendo = d.livros.filter(l => l.status === "lendo");
  return `<p class="hoje-data">${dataTxt}</p>
   <div class="home"><div class="stack col-main">${estudo}
    ${atrasados.length ? `<section class="painel-mundo" style="--w:var(--bad)"><div class="faixa" style="--w:var(--bad)"><b>FICOU PARA TRÁS</b><span>faça quando terminar o de hoje</span></div><div class="pm-corpo"><div class="itens">${atrasados.slice(-4).map(([dia, it], i) => linhaItem(d, dia, Object.assign({}, it, { descricao: `Era para ${DCURTO[diaSem(dia)].toLowerCase()}, ${dataBR(dia)}` }), i, false)).join("")}</div></div></section>` : ""}
   </div><aside class="stack col-side">
    <section class="painel-mundo" style="--w:var(--escola)">${faixa("escola", "Hoje à tarde")}<div class="pm-corpo">${aula.aulas.length ? `${aula.aulas.map(a => `<div class="aula-l"><span class="mchip" style="--mc:${corMat(a.split(" ")[0])}">${esc(a)}</span></div>`).join("")}<span class="muted small">13:15 às 17:15 · ${esc(aula.linha)}</span>` : `<span>${esc(aula.linha)}</span>`}
      <h3 style="margin-top:8px">Vem aí na escola</h3>${proxEsc.length ? proxEsc.map(a => cartaoAgenda(a, false)).join("") : `<span class="muted small">Nenhuma prova anotada. Ouviu falar de prova? Anote na Agenda.</span>`}</div></section>
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
    const p = d.plano.find(x => x._id === dia), its = (p && p.itens) || [];
    const esc_ = d.agenda.filter(a => a.data === dia);
    const feitos = its.filter(it => itemFeito(d, p, it)).length;
    const lista = its.map(it => {
      const st = estadoItem(d, dia, it);
      const ic = st === "feito" ? ico("check", 15) : st === "bloqueado" ? ico("cadeado", 14) : st === "atrasado" ? "!" : "•";
      const tit = `<span class="si-ic">${ic}</span><span class="si-t">${esc(it.titulo)}</span>`;
      const pode = (st === "hoje" || st === "atrasado") && (it.provaId || it.acao === "tabuada" || it.acao === "gravar" || it.acao === "ler");
      const href = it.provaId ? `#/prova/${encodeURIComponent(it.provaId)}` : it.acao === "tabuada" ? `#/tabuada/${encodeURIComponent(it.id)}` : urlLer(it);
      return pode ? `<a class="sitem s-${st}" href="${href}">${tit}</a>` : `<div class="sitem s-${st}" ${st === "bloqueado" ? `title="Abre no dia ${dataBR(dia)}"` : ""}>${tit}</div>`;
    }).join("");
    return `<div class="sdia ${dia === h ? "hoje" : ""} ${dia < h ? "passado" : ""}"><div class="sd-h"><b>${DCURTO[diaSem(dia)]}</b><span>${dataBR(dia)}</span>${cor[dia] ? `<i class="sd-cor d-${esc(cor[dia])}" title="cor do dia"></i>` : ""}</div>
      ${its.length ? `<div class="sd-prog">${dia > h ? `${ico("cadeado", 13)} ${dia === addDias(h, 1) ? "abre amanhã" : "ainda fechado"}` : `${feitos} de ${its.length} feitos`}</div>` : ""}
      <div class="sd-lista">${lista || `<span class="muted small">${diaSem(dia) === 0 ? "Descanso" : "Sem estudo"}</span>`}</div>
      ${esc_.map(a => `<div class="sd-esc" style="--mc:${corMat(a.materia)}">${ico("escola", 13)} ${esc(a.tipo)} de ${esc(a.materia)}</div>`).join("")}</div>`;
  };
  return `<section class="panel stack"><div class="row between"><h2>Minha semana</h2>${navSemana(ini)}</div>
    <p class="muted small" style="margin:0">${ico("check", 13)} feito · ! ficou para trás · ${ico("cadeado", 12)} ainda não abriu: cada atividade abre no dia dela.</p>
    <div class="sem-grid">${dias.map(col).join("")}</div></section>`;
}

/* ---------- Minhas aulas ---------- */
function abaAulas(d) {
  const h = d.hoje || hoje(), ini = addDias(segundaDe(h), 7 * semanaOff);
  const dias = [0, 1, 2, 3, 4].map(i => addDias(ini, i));
  const rot = (m, t, s) => `<div class="ag-rot" style="--w:${m === "casa" ? "var(--casa)" : "var(--escola)"}">${ico(m, 22)}<b>${t}</b>${s ? `<span>${s}</span>` : ""}</div>`;
  const head = dias.map(x => `<div class="ag-head ${x === h ? "hoje" : ""}"><b>${DIAS[diaSem(x)]}</b><span>${dataBR(x)}${x === h ? " · hoje" : ""}</span></div>`).join("");
  const aulas = dias.map(x => `<div class="ag-cel ${x === h ? "hoje" : ""}">${AULAS[diaSem(x)].map(a => `<div class="gaula" style="--mc:${corMat(a.split(" ")[0])}">${esc(a)}</div>`).join("")}</div>`).join("");
  const provas = dias.map(x => { const ag = d.agenda.filter(a => a.data === x); return `<div class="ag-cel ${x === h ? "hoje" : ""}">${ag.map(a => `<div class="ag-ev" style="--mc:${corMat(a.materia)}"><b>${esc(a.tipo)}</b><span>${esc(a.materia)}</span>${a.conteudo ? `<small>${esc(a.conteudo)}</small>` : ""}</div>`).join("") || `<span class="vazio">—</span>`}</div>`; }).join("");
  const casa = dias.map(x => { const p = d.plano.find(y => y._id === x); const its = p ? p.itens : MANHA[diaSem(x)].map(([k, v]) => ({ titulo: v, momento: k })); return `<div class="ag-cel ${x === h ? "hoje" : ""}">${its.map(it => `<div class="gm"><span>${esc(MOMENTO[it.momento] ? MOMENTO[it.momento][0].split(" · ")[0] : it.momento || "")}</span><b>${esc(it.titulo)}</b></div>`).join("")}</div>`; }).join("");
  const fds = [5, 6].map(i => addDias(ini, i)).map(x => { const p = d.plano.find(y => y._id === x); return `<div class="panel stack"><h3>${DIAS[diaSem(x)]} · ${dataBR(x)}</h3>${p ? p.itens.map(it => `<div class="gm"><span>${esc(MOMENTO[it.momento] ? MOMENTO[it.momento][0].split(" · ")[0] : "")}</span><b>${esc(it.titulo)}</b></div>`).join("") : `<span class="muted">${diaSem(x) === 0 ? "Descanso. Só 10 minutos com um adulto para olhar a semana." : "Simulado ou prova e um pouco de livro."}</span>`}</div>`; }).join("");
  return `<div class="row between"><p class="muted" style="margin:0">Escola sempre à tarde, das <b>13:15 às 17:15</b>. De manhã, em casa, você estuda para chegar afiada.</p>${navSemana(ini)}</div>
   <div class="agrid"><div></div>${head}
     ${rot("escola", "Aulas", "13:15 às 17:15")}${aulas}
     ${rot("escola", "Provas e trabalhos", "da sua Agenda")}${provas}
     ${rot("casa", "De manhã", "45 minutos")}${casa}</div>
   <div class="grid2">${fds}</div>`;
}

/* ---------- Minhas notas ---------- */
let filtroMat = "Todas", filtroClasse = "prova";
const ehProvaEscola = t => /prova|simulado|olimp/i.test(t || "");
function todasNotas(d) {
  const L = d.avaliacoes.filter(a => !ehCasa(a.tipo)).map(a => ({ data: a.data, materia: a.materia, tipo: tipoCurto(a.tipo), titulo: a.titulo, nota: Number(a.nota), comentario: a.comentario, origem: "escola", classe: ehProvaEscola(a.tipo) ? "prova" : "atividade" }));
  d.historico.filter(x => x.status === "corrigida").forEach(x => L.push({ data: x.data, materia: x.materia, tipo: TIPO_PROVA[x.tipo] || "Atividade", titulo: x.titulo, nota: Number(x.nota), origem: "casa", classe: VALE_NOTA(x.tipo) ? "prova" : "atividade", tentativa: x.id }));
  return L.filter(n => !isNaN(n.nota)).sort((a, b) => String(b.data).localeCompare(String(a.data)));
}
function abaNotas(d) {
  const todas = todasNotas(d);
  const mats = ["Todas", ...new Set(todas.map(n => n.materia))];
  const notas = todas.filter(n => filtroMat === "Todas" || n.materia === filtroMat);
  const med = a => a.length ? a.reduce((s, n) => s + n.nota, 0) / a.length : null;
  const q = (o, c) => { const a = notas.filter(n => n.origem === o && n.classe === c); const m = med(a); return `<button class="q4-c ${filtroClasse === c ? "on" : ""}" data-fclasse="${c}" style="--w:var(--${o})"><b class="${m != null ? clsNota(m) : ""}">${m != null ? fmtN(m) : "–"}</b><span>${a.length} nota${a.length === 1 ? "" : "s"}</span></button>`; };
  const serie = notas.filter(n => n.classe === filtroClasse).slice().reverse();
  const xs = serie.map(n => n.data);
  const graf = serie.length ? grafico([{ nome: "Escola", cor: "var(--escola)", vals: serie.map(n => n.origem === "escola" ? n.nota : null), ligar: true }, { nome: "Casa", cor: "var(--casa)", vals: serie.map(n => n.origem === "casa" ? n.nota : null), ligar: true }], { xs, rotulos: xs.map(dataBR), refs: [{ v: 8.5, cor: "var(--sun)" }], altura: 230 }) : `<p class="muted">Ainda não tem ${filtroClasse === "prova" ? "provas" : "atividades"} com nota${filtroMat !== "Todas" ? " em " + esc(filtroMat) : ""}.</p>`;
  return `<div class="chips">${mats.map(m => `<button data-fmat="${esc(m)}" class="${m === filtroMat ? "on" : ""}">${esc(m)}</button>`).join("")}</div>
   <div class="notas-top"><div class="q4"><span></span><div class="q4-h" style="--w:var(--escola)">${ico("escola", 18)} Escola</div><div class="q4-h" style="--w:var(--casa)">${ico("casa", 18)} Casa</div>
     <div class="q4-r">Provas e simulados<small>valem nota</small></div>${q("escola", "prova")}${q("casa", "prova")}
     <div class="q4-r">Atividades<small>para treinar</small></div>${q("escola", "atividade")}${q("casa", "atividade")}</div>
   <div class="panel stack"><div class="row between"><h3>${filtroClasse === "prova" ? "Provas e simulados" : "Atividades"} ao longo do tempo</h3><div class="seg"><button data-fclasse="prova" class="${filtroClasse === "prova" ? "on" : ""}">Provas</button><button data-fclasse="atividade" class="${filtroClasse === "atividade" ? "on" : ""}">Atividades</button></div></div>
     ${graf}<div class="legend"><span><i style="background:var(--escola)"></i>Escola</span><span><i style="background:var(--casa)"></i>Casa</span><span><i style="background:var(--sun)"></i>Meta 8,5</span></div></div></div>
   <section class="panel stack"><h3>Todas as notas</h3><div class="nlist">${notas.map(n => { const l = `<span class="nl-d">${dataBR(n.data)}</span><span class="nl-o" style="--w:var(--${n.origem})">${n.origem === "casa" ? "Casa" : "Escola"}</span><span class="nl-t"><b>${esc(n.titulo || n.tipo)}</b><small>${esc(n.materia)} · ${esc(n.tipo)}${n.classe === "prova" ? " · vale nota" : ""}</small></span><span class="nl-n ${clsNota(n.nota)}">${fmtN(n.nota)}</span>`; return n.tentativa ? `<a class="nl" href="#/resultado/${encodeURIComponent(n.tentativa)}">${l}</a>` : `<div class="nl">${l}</div>`; }).join("") || `<p class="muted">Nenhuma nota ainda.</p>`}</div></section>`;
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
      await api("registrarGravacao", { caminho: r.dados.caminho, tipo: "leitura", titulo: $("#g-tit").value, segundos: Math.round((Date.now() - t0) / 1000), item: $("#g-item").value || undefined });
      if (stream) stream.getTracks().forEach(t => t.stop());
      toast("Vídeo enviado! Os adultos vão assistir."); location.hash = sess.papel === "adulto" ? "#/aluna/hoje" : "#/hoje";
    } catch (e) { b.disabled = false; st(e.message); }
  };
  window.addEventListener("hashchange", function parar() { if (stream) stream.getTracks().forEach(t => t.stop()); window.removeEventListener("hashchange", parar); });
}
function ligarAluna(d) {
  const corpo = $("#corpo");
  const exec = async (acao, dados, msg, b) => { if (b) b.disabled = true; try { await api(acao, dados); toast(msg); render(); } catch (e) { toast(e.message); if (b) b.disabled = false; } };
  corpo.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.fmat) { filtroMat = b.dataset.fmat; render(); }
    else if (b.dataset.fclasse) { filtroClasse = b.dataset.fclasse; render(); }
    else if (b.dataset.sem) { semanaOff = Math.max(-1, Math.min(1, semanaOff + Number(b.dataset.sem))); render(); }
    else if (b.dataset.feito) { if (b.dataset.volta) { b.disabled = true; api("marcarFeito", { item: b.dataset.feito }).then(() => { toast("Muito bem!"); location.hash = b.dataset.volta; }).catch(e => { toast(e.message); b.disabled = false; }); } else exec("marcarFeito", { item: b.dataset.feito }, "Muito bem!", b); }
    else if (b.dataset.lvedit) { const f = corpo.querySelector(`[data-edit-form="${b.dataset.lvedit}"]`); f.hidden = !f.hidden; }
    else if (b.dataset.lvsalvar) { const id = b.dataset.lvsalvar, v = k => corpo.querySelector(`[data-ed-${k}="${id}"]`).value; exec("livroEditar", { id, titulo: v("tit"), autor: v("aut"), inicio: v("ini") }, "Livro atualizado.", b); }
    else if (b.id === "ag-salvar") { const data = $("#ag-data").value; if (!data) return toast("Escolha a data."); exec("agendaAdicionar", { data, materia: $("#ag-mat").value, tipo: $("#ag-tipo").value, conteudo: $("#ag-cont").value }, "Anotado! Um adulto vai conferir.", b); }
    else if (b.dataset.agdel) { if (b.dataset.conf) exec("agendaRemover", { id: b.dataset.agdel }, "Apagado.", b); else { b.dataset.conf = 1; b.textContent = "Confirmar"; } }
    else if (b.id === "lv-comecar") { const t = $("#lv-titulo").value.trim(); if (!t) return toast("Escreva o nome do livro."); exec("livroComecar", { titulo: t, autor: $("#lv-autor").value, formato: $("#lv-fmt").value, inicio: $("#lv-ini").value }, "Bom livro!", b); }
    else if (b.dataset.terminar) { const f = corpo.querySelector(`[data-fim-form="${b.dataset.terminar}"]`); f.hidden = !f.hidden; }
    else if (b.dataset.st) { const box = b.parentElement; box.dataset.val = b.dataset.st; box.querySelectorAll("button").forEach(x => x.classList.toggle("on", Number(x.dataset.st) <= Number(b.dataset.st))); }
    else if (b.dataset.fimOk) { const id = b.dataset.fimOk; const st = Number(corpo.querySelector(`[data-stars="${id}"]`).dataset.val || 0); if (!st) return toast("Escolha as estrelas."); exec("livroTerminar", { id, estrelas: st, frase: corpo.querySelector(`[data-frase="${id}"]`).value }, "Parabéns por terminar o livro!", b); }
  };
}

/* tabuada relâmpago */
async function telaTabuada(itemId) {
  app.className = "wrap";
  const N = 20, LIM = 120;
  const pesos = [2, 3, 4, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9];
  const qs = Array.from({ length: N }, () => { const a = pesos[Math.floor(Math.random() * pesos.length)], b = 2 + Math.floor(Math.random() * 8); return Math.random() < .5 ? [a, b] : [b, a]; });
  let i = 0, ac = 0, t0 = 0, timer = null, erros = [];
  const volta = sess.papel === "adulto" ? "#/aluna/hoje" : "#/hoje";
  const tela = () => {
    if (!t0) return `<div class="tab-wrap"><div class="tab-card stack"><h1>Tabuada relâmpago</h1><p>São <b>${N} contas</b> de vezes em até <b>2 minutos</b>. Digite a resposta e aperte <b>Enter</b>.</p><div class="row"><button id="tb-ir">Começar</button><a class="btn ghost" href="${volta}">Voltar</a></div></div></div>`;
    if (i >= N) return "";
    const rest = Math.max(0, LIM - Math.round((Date.now() - t0) / 1000));
    return `<div class="tab-wrap"><div class="tab-card stack"><div class="row between"><span class="muted">${i + 1} de ${N}</span><b id="tb-t">${rest}s</b></div><div class="tab-conta">${qs[i][0]} × ${qs[i][1]} =</div><input id="tb-r" inputmode="numeric" autocomplete="off" class="tab-in"><div class="pbar"><i style="width:${i / N * 100}%"></i></div></div></div>`;
  };
  const fim = async () => {
    clearInterval(timer);
    const seg = Math.round((Date.now() - t0) / 1000);
    app.innerHTML = `<div class="tab-wrap"><div class="tab-card stack"><h1>${ac} de ${N}!</h1><p>Você levou ${seg} segundos${ac ? `, cerca de ${(seg / ac).toFixed(1).replace(".", ",")} segundos por conta certa` : ""}.</p>${erros.length ? `<div class="expl">Para treinar: ${erros.map(e => `${e[0]} × ${e[1]} = <b>${e[0] * e[1]}</b>`).join(" · ")}</div>` : `<div class="expl">Nenhum erro!</div>`}<span class="muted small" id="tb-s">Salvando…</span><a class="btn" href="${volta}">Voltar para Hoje</a></div></div>`;
    try { await api("registrarTabuada", { acertos: ac, total: N, segundos: seg }); $("#tb-s").textContent = "Resultado salvo."; } catch (e) { $("#tb-s").textContent = e.message; }
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
function renderQuestao(q, valor, modo, info) {
  // modo: fazer | revisao
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
    corpo = `<div class="resp-in"><input data-q="${esc(q.id)}" ${tipo === "numero" ? 'inputmode="decimal"' : ""} value="${esc(valor || "")}" placeholder="Resposta" autocomplete="off" ${modo === "revisao" ? "readonly" : ""}>${q.unidade ? `<span>${esc(q.unidade)}</span>` : ""}</div>`;
  }
  let rodape = "";
  if (modo === "revisao" && info) {
    const st = info.status === "pendente" ? `<span class="tag warn">esperando correção</span>` : Number(info.pontos) >= Number(info.max) ? `<span class="tag ok">certo</span>` : `<span class="tag bad">errado</span>`;
    rodape = `<div class="row">${st}${info.correta && tipo !== "mc" ? `<span class="muted">Resposta esperada: <b>${esc(info.correta)}</b></span>` : ""}</div>${info.comentario ? `<div class="expl">${esc(info.comentario)}</div>` : ""}${q.explicacao ? `<div class="expl">${esc(q.explicacao)}</div>` : ""}`;
  }
  return `<div class="q" id="q-${esc(q.id)}"><div class="q-h"><span class="num">${q.numero}</span><span>${md(q.enunciado)}</span></div>${q.apoio ? renderTexto(q.apoio) : ""}${corpo}${rodape}</div>`;
}

/* ---------------- lição interativa (parte de ensinar da atividade) ---------------- */
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
const textoFala = s => [s.titulo, ...(s.paragrafos || []), s.destaque, s.enunciado, ...((s.passos || []).slice(0, (s._n || 0)))].filter(Boolean).join(". ").replace(/\*\*/g, "");
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
  const texto = `${(s.paragrafos || []).map(p => `<p>${md(p)}</p>`).join("")}${s.html ? `<div class="visual">${s.html}</div>` : ""}${s.destaque ? `<div class="destaque">${md(s.destaque)}</div>` : ""}`;
  const ouvir = s.tipo !== "jogo" ? `<button class="ouvir ghost" data-ouvir="1">${ico("som", 18)} Ouvir</button>` : "";
  const ROT = { explica: "Entender", exemplo: "Ver como se faz", blocos: "Mexer nas peças", fracao: "Mexer nas peças", pratica: "Fazer junto", jogo: "Desafio" };
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
  const st = Object.assign({ etapa: -1, resp: {}, inicio: null }, store.get(chave, {}));
  const qs = []; (p.blocos || []).forEach((b, bi) => (b.questoes || []).forEach(q => qs.push(Object.assign({ bloco: bi }, q))));
  let confirmar = false, enviando = false;
  const salvar = () => store.set(chave, st);
  const resp = () => qs.filter(q => String(st.resp[q.id] || "").trim()).length;
  function desenha() {
    let html = "";
    if (st.etapa === -1 || (st.etapa < 0 && !p.licao)) {
      html = `<header class="top"><a class="brand" href="#/" style="text-decoration:none"><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" fill="var(--accent)"/><path d="M6 9c3-1.5 5.5-1.5 8 0v11c-2.5-1.5-5-1.5-8 0zM22 9c-3-1.5-5.5-1.5-8 0v11c2.5-1.5 5-1.5 8 0z" fill="#fff"/></svg>Estudos em Casa</a><a class="btn ghost mini" href="${sess.papel === "adulto" ? "#/aluna/hoje" : "#/hoje"}">Voltar</a></header>
      <div class="hello"><span class="mchip" style="--mc:${corMat(p.materia)};justify-self:start">${esc(p.materia)}</span><h1>${esc(p.titulo)}</h1>${p.descricao ? `<p>${esc(p.descricao)}</p>` : ""}<p class="muted">${TIPO_PROVA[p.tipo] || "Prova"} · ${p.licao ? `${p.licao.length} partes para aprender e ` : ""}${qs.length} perguntas${p.minutos ? ` · cerca de ${p.minutos} minutos` : ""}</p></div>
      ${p.licao ? `<div class="panel stack"><h3>Como funciona</h3><ol class="passos"><li><b>Aprender:</b> você lê, ouve e mexe nas peças (pode usar o botão Ouvir).</li><li><b>Fazer junto:</b> você tenta e o app mostra se acertou na hora.</li><li><b>Agora é com você:</b> ${qs.length} perguntas no final, <b>sem áudio</b>, igual na escola.</li></ol></div>` : ""}
      ${assuntosDe(qs).length ? `<div class="panel stack"><h3>O que cai nesta prova</h3><div class="chips">${assuntosDe(qs).map(a => `<span class="mchip" style="--mc:${corMat(p.materia)}">${esc(a)}</span>`).join("")}</div></div>` : ""}
      <div class="panel stack" ${p.licao ? "hidden" : ""}><h3>Como funciona</h3><p>${esc(p.instrucoes || "Leia com calma. Você pode voltar e trocar as respostas até entregar.")}</p><p class="muted small">Você pode parar e continuar depois: as respostas ficam guardadas neste aparelho até você entregar.</p></div>
      ${p.dica ? `<div class="confirm" style="border-style:solid"><p><b>Dica:</b> ${esc(p.dica)}</p></div>` : ""}
      <div class="nav"><span></span><button id="comecar">${resp() ? "Continuar de onde parei" : "Começar"}</button></div>`;
    } else if (st.etapa === -2) {
      const n = p.licao.length, li = Math.min(st.li || 0, n - 1);
      html = `<div class="ptop"><div class="row between"><b style="font-family:var(--display);color:var(--accent)">${esc(p.titulo)}</b><span class="muted">Aprender · ${li + 1} de ${n}</span></div><div class="pbar"><i style="width:${(li + 1) / (n + 1) * 100}%"></i></div></div>
        <div class="qcol" style="max-width:900px">${renderSecao(p.licao[li], li, n, p.materia)}</div>
        <div class="nav" style="max-width:900px"><button class="ghost" id="l-volta">${li === 0 ? "Início" : "Voltar"}</button><button id="l-prox">${li === n - 1 ? "Agora é com você →" : "Próximo"}</button></div>`;
    } else if (st.etapa < p.blocos.length) {
      const b = p.blocos[st.etapa];
      const qsB = qs.filter(q => q.bloco === st.etapa).map(q => renderQuestao(q, st.resp[q.id], "fazer")).join("");
      html = barra() + `<div class="stack">${p.licao && st.etapa === 0 ? `<div class="sem-audio">${ico("som", 20)} <b>Agora é com você.</b> Leia sozinha, com calma. Aqui não tem áudio, igual na escola.</div>` : ""}${b.titulo ? `<h2 style="color:var(--accent)">${esc(b.titulo)}</h2>` : ""}${b.lead ? `<div class="lead">${esc(b.lead)}</div>` : ""}
        ${b.texto ? `<div class="leitura"><div class="leitura-texto">${renderTexto(b.texto)}</div><div class="stack">${qsB}</div></div>` : `<div class="stack qcol">${qsB}</div>`}
        <div class="nav"><button class="ghost" id="voltar">${st.etapa === 0 ? (p.licao ? "Voltar à lição" : "Início") : "Voltar"}</button><button id="prox">${st.etapa === p.blocos.length - 1 ? "Revisar e entregar" : "Próximo"}</button></div></div>`;
    } else {
      const faltam = qs.filter(q => !String(st.resp[q.id] || "").trim());
      html = barra() + `<div class="stack"><h2>Revisão</h2><p class="muted">Toque num número para voltar à questão.</p>
        <div class="review">${qs.map(q => `<button class="cell ${String(st.resp[q.id] || "").trim() ? "done" : "miss"}" data-goto="${esc(q.id)}">${q.numero}<small>${q.tipo === "mc" || !q.tipo ? (st.resp[q.id] || "—") : (String(st.resp[q.id] || "").trim() ? "ok" : "—")}</small></button>`).join("")}</div>
        ${faltam.length ? `<div class="confirm"><p>Faltam <b>${faltam.length}</b>: ${faltam.map(q => q.numero).join(", ")}. Questão em branco conta como erro.</p></div>` : `<div class="panel">Todas as questões respondidas.</div>`}
        ${confirmar ? `<div class="confirm"><h3>Entregar agora?</h3><p>Depois de entregar não dá mais para mudar as respostas.</p><div class="nav"><button class="ghost" id="nao">Ainda não</button><button id="sim" ${enviando ? "disabled" : ""}>${enviando ? "Enviando…" : "Sim, entregar"}</button></div></div>`
        : `<div class="nav"><button class="ghost" id="voltar">Voltar</button><button id="entregar">Entregar</button></div>`}</div>`;
    }
    app.innerHTML = html;
  }
  function barra() {
    const pct = Math.round(resp() / qs.length * 100);
    return `<div class="ptop"><div class="row between"><b style="font-family:var(--display);color:var(--accent)">${esc(p.titulo)}</b><span class="muted" id="cont">${resp()}/${qs.length}</span></div><div class="pbar"><i style="width:${pct}%"></i></div></div>`;
  }
  const atualizaBarra = () => { const c = $("#cont"); if (c) c.textContent = `${resp()}/${qs.length}`; const i = $(".pbar i"); if (i) i.style.width = Math.round(resp() / qs.length * 100) + "%"; };
  app.oninput = app.onchange = e => {
    const t = e.target; if (!t.dataset || !t.dataset.q) return;
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
    if (sec && b.dataset.pck != null) { const i = Number(b.dataset.pck), q = sec.questoes[i]; const v = (document.querySelector(`[data-pin="${i}"]`) || {}).value || ""; const nv = s => String(s).trim().toLowerCase().replace(",", ".").replace(/\s+/g, " ").replace(/[.!]$/, ""); sec._r = sec._r || {}; sec._r[i] = { v, ok: [].concat(q.resposta).some(r => nv(r) === nv(v)) }; desenha(); return; }
    if (sec && b.dataset.jg) { sec._i = 0; sec._ac = 0; sec._fim = false; sec._rest = sec.segundos || 60; clearInterval(sec._t); sec._t = setInterval(() => { sec._rest--; const t = document.querySelector("[data-jt]"); if (t) t.textContent = sec._rest + "s"; if (sec._rest <= 0) { clearInterval(sec._t); sec._fim = true; desenha(); } }, 1000); desenha(); return; }
    if (sec && b.dataset.jo != null) { const q = sec.questoes[sec._i]; if (Number(b.dataset.jo) === Number(q.correta)) sec._ac++; sec._i++; if (sec._i >= sec.questoes.length) { clearInterval(sec._t); sec._fim = true; } desenha(); return; }
    if (b.id === "l-prox") { pararFala(); if ((st.li || 0) < p.licao.length - 1) { st.li = (st.li || 0) + 1; } else { st.etapa = 0; st.licaoOk = true; } salvar(); desenha(); topoPg(); return; }
    if (b.id === "l-volta") { pararFala(); if ((st.li || 0) > 0) st.li--; else st.etapa = -1; salvar(); desenha(); topoPg(); return; }
    if (b.id === "comecar") { if (!st.inicio) st.inicio = new Date().toISOString(); if (p.licao && !st.licaoOk) { st.etapa = -2; st.li = st.li || 0; } else st.etapa = Math.max(0, st.etapa); salvar(); desenha(); topoPg(); }
    else if (b.id === "prox") { st.etapa++; salvar(); desenha(); topoPg(); }
    else if (b.id === "voltar") { if (st.etapa === 0 && p.licao) { st.etapa = -2; st.li = p.licao.length - 1; } else st.etapa--; confirmar = false; salvar(); desenha(); topoPg(); }
    else if (b.dataset.goto) { const q = qs.find(x => x.id === b.dataset.goto); st.etapa = q.bloco; salvar(); desenha(); const el = document.getElementById("q-" + q.id); if (el) el.scrollIntoView({ block: "center" }); }
    else if (b.id === "entregar") { confirmar = true; desenha(); }
    else if (b.id === "nao") { confirmar = false; desenha(); }
    else if (b.id === "sim" && !enviando) {
      enviando = true; desenha();
      try {
        const r = await api("entregar", { id, respostas: st.resp, inicio: st.inicio });
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
  app.innerHTML = topo(extra) + `<div class="stack">
    <div class="panel"><div class="row" style="gap:22px">${anel(t.nota)}<div class="stack" style="gap:6px;flex:1;min-width:200px"><span class="mchip" style="--mc:${corMat(t.materia)};justify-self:start">${esc(t.materia)}</span><h2>${esc(msg)}</h2><p class="muted">${esc(t.titulo)} · ${t.pontos} de ${t.max} pontos · ${t.minutos} min</p></div></div></div>
    <div class="panel stack"><h3>Acertos por assunto</h3><div class="list">${barrasAssunto(d.respostas)}</div></div>
    <div class="panel stack"><h3>Como foi cada questão</h3><div class="review">${qs.map(cel).join("")}</div>
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

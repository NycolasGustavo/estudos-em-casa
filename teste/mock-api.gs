/**
 * Estudos em Casa — backend (Google Apps Script)
 * Planilha = banco de dados. Pasta do Drive = provas (arquivos .json).
 * O gabarito nunca sai daqui para a tela da aluna: a correção é feita no servidor.
 */
const TZ = "America/Sao_Paulo";
const VERSAO = "1.0";

const ABAS = {
  Config: ["chave", "valor"],
  Pessoas: ["nome", "papel", "pin", "email", "recebe_email"],
  Tentativas: ["id", "provaId", "titulo", "materia", "tipo", "inicio", "fim", "minutos", "pontos", "max", "nota", "status", "revisaoLiberada", "respostas"],
  Respostas: ["tentativaId", "provaId", "data", "materia", "questaoId", "numero", "tipo", "habilidade", "assunto", "bncc", "resposta", "correta", "pontos", "max", "status", "comentario"],
  Notas: ["id", "data", "materia", "tipo", "titulo", "acertos", "total", "nota", "obs"],
  Livros: ["id", "titulo", "autor", "formato", "inicio", "fim", "status", "frase"],
  Diario: ["data", "cor", "foto", "agenda", "cadernos", "aula", "estrelas", "branco", "obs"],
  Metas: ["id", "periodo", "area", "texto", "feito"],
  Liberacoes: ["provaId", "extras"]
};

/* ============ instalação ============ */
function configurar() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(ABAS).forEach(nome => {
    let s = ss.getSheetByName(nome);
    if (!s) s = ss.insertSheet(nome);
    if (s.getLastRow() === 0) s.appendRow(ABAS[nome]);
    s.setFrozenRows(1);
  });
  ["Página1", "Sheet1", "Planilha1"].forEach(n => { const x = ss.getSheetByName(n); if (x && ss.getSheets().length > 1 && x.getLastRow() === 0) ss.deleteSheet(x); });
  importarDadosIniciais_();
  const cfg = lerConfig_();
  if (!cfg.pasta_provas_id) {
    const pasta = DriveApp.createFolder("Estudos em Casa · Provas");
    setConfig_("pasta_provas_id", pasta.getId());
  }
  // força a autorização de e-mail e Drive
  MailApp.getRemainingDailyQuota();
  DriveApp.getFolderById(lerConfig_().pasta_provas_id).getName();
  return "Tudo pronto. Agora implante como App da Web.";
}

/** Lê o arquivo "estudos-seed.json" (criado pelo Claude no Drive) e preenche a planilha vazia. Roda uma vez só. */
function importarDadosIniciais_() {
  if (linhas_("Pessoas").length) return;
  const it = DriveApp.getFilesByName("estudos-seed.json");
  if (!it.hasNext()) return;
  const seed = JSON.parse(it.next().getBlob().getDataAsString("UTF-8"));
  Object.keys(seed.config || {}).forEach(k => setConfig_(k, seed.config[k]));
  const sp = aba_("Pessoas"); sp.getRange("C:C").setNumberFormat("@");
  (seed.pessoas || []).forEach(p => anexar_("Pessoas", p));
  (seed.notas || []).forEach(n => anexar_("Notas", n));
  (seed.metas || []).forEach(m => anexar_("Metas", m));
  (seed.livros || []).forEach(l => anexar_("Livros", l));
  (seed.tentativas || []).forEach(t => {
    const p = provaPorId_(t.provaId);
    registrarTentativa_(p, t.respostas, new Date(t.inicio), new Date(t.fim), false);
  });
}

/* ============ entrada HTTP ============ */
function doGet() {
  return json_({ ok: true, app: "Estudos em Casa", versao: VERSAO });
}

function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents || "{}"); } catch (err) { return json_({ ok: false, erro: "Pedido inválido." }); }
  try {
    const acao = req.acao;
    if (acao === "login") return json_(login_(req.pin));
    const sess = sessao_(req.token);
    if (!sess) return json_({ ok: false, erro: "sessao", msg: "Entre de novo com o seu PIN." });
    const A = sess.papel === "adulto";
    const rotas = {
      eu: () => ({ nome: sess.nome, papel: sess.papel }),
      sair: () => { PropertiesService.getScriptProperties().deleteProperty(req.token); return {}; },
      inicioAluna: () => inicioAlunaV2_(),
      livroComecar: () => acaoAluna_("livroComecar", req, sess),
      livroTerminar: () => acaoAluna_("livroTerminar", req, sess),
      agendaAdicionar: () => acaoAluna_("agendaAdicionar", req, sess),
      agendaRemover: () => acaoAluna_("agendaRemover", req, sess),
      marcarFeito: () => acaoAluna_("marcarFeito", req, sess),
      registrarTabuada: () => acaoAluna_("registrarTabuada", req, sess),
      registrarGravacao: () => acaoAluna_("registrarGravacao", req, sess),
      prova: () => provaParaAluna_(req.id, A),
      entregar: () => entregar_(req, sess),
      tentativa: () => tentativaDetalhe_(req.id, A),
      // adultos
      painelAdulto: () => exige_(A) || painelAdulto_(),
      corrigir: () => exige_(A) || corrigirAberta_(req, sess),
      liberarRevisao: () => exige_(A) || liberarRevisao_(req.id, req.valor !== false),
      reabrir: () => exige_(A) || reabrir_(req.provaId),
      salvar: () => exige_(A) || salvar_(req.aba, req.dados),
      excluir: () => exige_(A) || excluir_(req.aba, req.id),
      docs: () => exige_(A) || docsJson_(),
      gravarDoc: () => exige_(A) || gravarDoc_(req),
      apagarDoc: () => exige_(A) || (delete (DOCS[req.col] || {})[req.id], {})
    };
    if (!rotas[acao]) return json_({ ok: false, erro: "Ação desconhecida." });
    const r = rotas[acao]();
    if (r && r.ok === false) return json_(r);
    return json_({ ok: true, dados: r });
  } catch (err) {
    return json_({ ok: false, erro: String(err && err.message || err) });
  }
}

function exige_(adulto) { if (!adulto) throw new Error("Só para adultos."); return null; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ============ sessão ============ */
function login_(pin) {
  pin = String(pin || "").trim();
  if (!pin) return { ok: false, erro: "Digite o PIN." };
  const z = v => String(v).trim().replace(/^0+(?=\d)/, "");
  const p = linhas_("Pessoas").find(x => z(x.pin) === z(pin));
  if (!p) { Utilities.sleep(600); return { ok: false, erro: "PIN não encontrado." }; }
  const token = "t_" + Utilities.getUuid().replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty(token, JSON.stringify({ nome: p.nome, papel: p.papel, em: Date.now() }));
  return { ok: true, dados: { token, nome: p.nome, papel: p.papel } };
}
function sessao_(token) {
  if (!token) return null;
  const v = PropertiesService.getScriptProperties().getProperty(token);
  return v ? JSON.parse(v) : null;
}

/* ============ planilha ============ */
function aba_(nome) {
  const s = SpreadsheetApp.getActive().getSheetByName(nome);
  if (!s) throw new Error("Aba " + nome + " não existe. Rode a função configurar.");
  return s;
}
function linhas_(nome) {
  const s = aba_(nome);
  const v = s.getDataRange().getValues();
  const cab = v.shift() || [];
  return v.filter(r => r.some(c => c !== "")).map(r => {
    const o = {};
    cab.forEach((h, i) => { o[h] = r[i] instanceof Date ? fmtData_(r[i], h) : r[i]; });
    return o;
  });
}
function fmtData_(d, campo) {
  return Utilities.formatDate(d, TZ, (campo === "inicio" || campo === "fim") && d.getHours() + d.getMinutes() > 0 ? "yyyy-MM-dd'T'HH:mm:ss" : "yyyy-MM-dd");
}
function anexar_(nome, obj) {
  const s = aba_(nome);
  const cab = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  s.appendRow(cab.map(h => obj[h] === undefined || obj[h] === null ? "" : obj[h]));
}
function atualizar_(nome, filtro, patch) {
  const s = aba_(nome);
  const v = s.getDataRange().getValues();
  const cab = v[0];
  let n = 0;
  for (let i = 1; i < v.length; i++) {
    const o = {}; cab.forEach((h, j) => o[h] = v[i][j]);
    if (filtro(o)) {
      Object.keys(patch).forEach(k => { const j = cab.indexOf(k); if (j >= 0) s.getRange(i + 1, j + 1).setValue(patch[k]); });
      n++;
    }
  }
  return n;
}
function lerConfig_() { const c = {}; linhas_("Config").forEach(r => c[r.chave] = r.valor); return c; }
function setConfig_(k, v) { if (!atualizar_("Config", r => r.chave === k, { valor: v })) anexar_("Config", { chave: k, valor: v }); }
function hoje_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"); }

/* ============ provas (Drive) ============ */
function todasProvas_() {
  const cache = CacheService.getScriptCache();
  const c = cache.get("provas");
  if (c) return JSON.parse(c);
  const pasta = DriveApp.getFolderById(lerConfig_().pasta_provas_id);
  const it = pasta.getFiles();
  const out = [];
  while (it.hasNext()) {
    const f = it.next();
    if (!/\.json$/i.test(f.getName())) continue;
    try {
      const p = JSON.parse(f.getBlob().getDataAsString("UTF-8"));
      numerar_(p);
      out.push(p);
    } catch (err) { /* arquivo inválido: ignora */ }
  }
  out.sort((a, b) => String(b.criadaEm || "").localeCompare(String(a.criadaEm || "")));
  try { cache.put("provas", JSON.stringify(out), 60); } catch (e) { /* grande demais para o cache */ }
  return out;
}
function numerar_(p) {
  let n = 0;
  (p.blocos || []).forEach(b => (b.questoes || []).forEach(q => { n++; q.numero = n; q.id = q.id || ("q" + n); }));
  p.totalQuestoes = n;
}
function provaPorId_(id) {
  const p = todasProvas_().find(x => x.id === id);
  if (!p) throw new Error("Prova não encontrada.");
  return p;
}
function semGabarito_(p) {
  const c = JSON.parse(JSON.stringify(p));
  (c.blocos || []).forEach(b => (b.questoes || []).forEach(q => {
    delete q.correta; delete q.aceitas; delete q.criterio; delete q.explicacao; delete q.tolerancia;
  }));
  return c;
}
function meta_(p) {
  return { id: p.id, titulo: p.titulo, materia: p.materia, tipo: p.tipo, criadaEm: p.criadaEm, liberarEm: p.liberarEm || "", prazo: p.prazo || "", minutos: p.minutos || "", totalQuestoes: p.totalQuestoes, descricao: p.descricao || "" };
}
function tentativasPermitidas_(provaId, p) {
  const lib = linhas_("Liberacoes").filter(r => r.provaId === provaId).reduce((s, r) => s + Number(r.extras || 0), 0);
  return Number(p.tentativas || 1) + lib;
}
function provaParaAluna_(id, adulto) {
  const p = provaPorId_(id);
  return adulto ? p : semGabarito_(p);
}

/* ============ correção ============ */
function norm_(s, semAcento) {
  s = String(s == null ? "" : s).toLowerCase().trim().replace(/\s+/g, " ").replace(/[.!]$/, "");
  if (semAcento) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return s;
}
function corrigeQuestao_(q, r) {
  const max = Number(q.pontos || 1);
  const vazio = r === undefined || r === null || String(r).trim() === "";
  if (q.tipo === "aberta") return vazio ? { pontos: 0, max, status: "corrigida" } : { pontos: "", max, status: "pendente" };
  if (vazio) return { pontos: 0, max, status: "corrigida" };
  let ok = false;
  if (q.tipo === "numero") {
    const a = parseFloat(String(r).replace(/\./g, "").replace(",", "."));
    const b = parseFloat(String(q.correta).replace(",", "."));
    ok = !isNaN(a) && Math.abs(a - b) <= Number(q.tolerancia || 0) + 1e-9;
  } else if (q.tipo === "curta") {
    const lista = (q.aceitas || [q.correta]).map(x => norm_(x, q.ignorarAcentos));
    ok = lista.indexOf(norm_(r, q.ignorarAcentos)) >= 0;
  } else {
    ok = String(r).trim().toUpperCase() === String(q.correta).trim().toUpperCase();
  }
  return { pontos: ok ? max : 0, max, status: "corrigida" };
}
function nota_(pontos, max) { return max ? Math.round(pontos / max * 100) / 10 : 0; }

function entregar_(req, sess) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const p = provaPorId_(req.id);
    const feitas = linhas_("Tentativas").filter(t => t.provaId === p.id).length;
    if (sess.papel !== "adulto" && feitas >= tentativasPermitidas_(p.id, p)) throw new Error("Esta prova já foi entregue.");
    const fim = new Date();
    const inicio = req.inicio ? new Date(req.inicio) : fim;
    return registrarTentativa_(p, req.respostas || {}, inicio, fim, true);
  } finally { lock.releaseLock(); }
}

function registrarTentativa_(p, resp, inicio, fim, comEmail) {
  const minutos = Math.max(1, Math.round((fim - inicio) / 60000));
  const tid = p.id + "-" + fim.getTime();
  let pontos = 0, max = 0, pend = 0;
  const itens = [];
  const dataStr = Utilities.formatDate(fim, TZ, "yyyy-MM-dd");
  (p.blocos || []).forEach(b => (b.questoes || []).forEach(q => {
    const r = resp[q.id];
    const c = corrigeQuestao_(q, r);
    max += c.max;
    if (c.status === "pendente") pend++; else pontos += c.pontos;
    itens.push({ id: q.id, numero: q.numero, status: c.status, certo: c.status === "corrigida" ? c.pontos >= c.max : null });
    anexar_("Respostas", {
      tentativaId: tid, provaId: p.id, data: dataStr, materia: q.materia || p.materia, questaoId: q.id, numero: q.numero, tipo: q.tipo || "mc",
      habilidade: q.habilidade || "", assunto: q.assunto || "", bncc: q.bncc || "", resposta: r == null ? "" : String(r),
      correta: q.tipo === "aberta" ? (q.criterio || "") : (q.correta != null ? String(q.correta) : (q.aceitas || []).join(" | ")),
      pontos: c.pontos, max: c.max, status: c.status, comentario: ""
    });
  }));
  const t = {
    id: tid, provaId: p.id, titulo: p.titulo, materia: p.materia, tipo: p.tipo || "prova",
    inicio: Utilities.formatDate(inicio, TZ, "yyyy-MM-dd'T'HH:mm:ss"), fim: Utilities.formatDate(fim, TZ, "yyyy-MM-dd'T'HH:mm:ss"),
    minutos, pontos, max, nota: nota_(pontos, max), status: pend ? "aguardando" : "corrigida",
    revisaoLiberada: false, respostas: JSON.stringify(resp)
  };
  anexar_("Tentativas", t);
  if (comEmail) { try { emailResultado_(p, t, itens, pend); } catch (err) { /* e-mail não bloqueia a entrega */ } }
  return { tentativaId: tid, nota: t.nota, pontos, max, minutos, pendentes: pend, itens };
}

function emailResultado_(p, t, itens, pend) {
  const dest = linhas_("Pessoas").filter(x => x.papel === "adulto" && x.email && String(x.recebe_email).toUpperCase() !== "FALSE").map(x => x.email);
  if (!dest.length) return;
  const cfg = lerConfig_();
  const aluna = cfg.aluna_nome || "A aluna";
  const resp = linhas_("Respostas").filter(r => r.tentativaId === t.id);
  const hab = {};
  resp.forEach(r => { if (r.status !== "corrigida") return; const k = r.habilidade || "—"; hab[k] = hab[k] || [0, 0]; hab[k][1]++; if (Number(r.pontos) >= Number(r.max)) hab[k][0]++; });
  const linhas = resp.map(r => {
    const ok = r.status === "pendente" ? "corrigir" : (Number(r.pontos) >= Number(r.max) ? "✓" : "✗");
    const bg = r.status === "pendente" ? "#FFF4CF" : ok === "✓" ? "#E3F4EA" : "#FBE5E3";
    return `<tr style="background:${bg}"><td style="padding:4px 8px">${r.numero}</td><td style="padding:4px 8px">${esc_(r.habilidade)}</td><td style="padding:4px 8px">${esc_(String(r.resposta).slice(0, 80)) || "—"}</td><td style="padding:4px 8px">${esc_(String(r.correta).slice(0, 80))}</td><td style="padding:4px 8px;text-align:center">${ok}</td></tr>`;
  }).join("");
  const fracos = Object.keys(hab).filter(k => hab[k][0] < hab[k][1]).map(k => `${esc_(k)} (${hab[k][0]}/${hab[k][1]})`);
  const html = `<div style="font-family:Arial,sans-serif;color:#1F2B28;max-width:680px">
<h2 style="margin:0">${esc_(aluna)} · ${esc_(p.titulo)}</h2>
<p style="color:#5E6E69;margin:4px 0 12px">${esc_(p.materia)} · ${t.fim.replace("T", " ")} · ${t.minutos} min</p>
<p style="font-size:20px;margin:0 0 6px"><b>Nota ${String(t.nota).replace(".", ",")}</b> · ${t.pontos}/${t.max} pontos${pend ? ` · <b>${pend} questão(ões) aberta(s) para corrigir</b>` : ""}</p>
${fracos.length ? `<p style="margin:0 0 6px">Errou em: ${fracos.join("; ")}</p>` : ""}
<table style="border-collapse:collapse;font-size:13px;width:100%;margin-top:8px"><tr style="background:#2F7D6D;color:#fff"><th style="padding:6px 8px;text-align:left">Nº</th><th style="padding:6px 8px;text-align:left">Habilidade</th><th style="padding:6px 8px;text-align:left">Resposta</th><th style="padding:6px 8px;text-align:left">Esperado</th><th></th></tr>${linhas}</table>
${cfg.site_url ? `<p style="margin-top:14px"><a href="${cfg.site_url}#/adulto/tentativa/${encodeURIComponent(t.id)}">Abrir no Estudos em Casa</a></p>` : ""}</div>`;
  MailApp.sendEmail({ to: dest.join(","), subject: `${aluna} · ${p.titulo} · nota ${String(t.nota).replace(".", ",")}`, htmlBody: html, name: "Estudos em Casa" });
}
function esc_(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/* ============ telas ============ */
function resumoTentativa_(t) {
  return { id: t.id, provaId: t.provaId, titulo: t.titulo, materia: t.materia, tipo: t.tipo, data: String(t.fim).slice(0, 10), minutos: t.minutos, pontos: t.pontos, max: t.max, nota: Number(t.nota), status: t.status, revisaoLiberada: t.revisaoLiberada === true || String(t.revisaoLiberada).toUpperCase() === "TRUE" };
}
function habilidades_(resp) {
  const m = {};
  resp.filter(r => r.status === "corrigida" && r.habilidade).forEach(r => {
    const k = r.materia + "||" + r.habilidade;
    m[k] = m[k] || { materia: r.materia, habilidade: r.habilidade, assunto: r.assunto, certas: 0, total: 0, provas: {} , ultima: "" };
    m[k].total++; if (Number(r.pontos) >= Number(r.max)) m[k].certas++;
    m[k].provas[r.provaId] = 1; if (String(r.data) > m[k].ultima) m[k].ultima = String(r.data);
  });
  return Object.keys(m).map(k => { const h = m[k]; h.provas = Object.keys(h.provas).length; h.pct = Math.round(h.certas / h.total * 100); return h; });
}
function inicioAluna_() {
  const cfg = lerConfig_();
  const provas = todasProvas_();
  const tent = linhas_("Tentativas");
  const h = hoje_();
  const pendentes = provas.filter(p => !p.arquivada && (!p.liberarEm || p.liberarEm <= h))
    .filter(p => tent.filter(t => t.provaId === p.id).length < tentativasPermitidas_(p.id, p)).map(meta_);
  const notasEscola = linhas_("Notas").map(n => ({ data: n.data, materia: n.materia, tipo: n.tipo, titulo: n.titulo, nota: Number(n.nota) }));
  const diario = linhas_("Diario").sort((a, b) => String(b.data).localeCompare(String(a.data)));
  let seq = 0;
  for (const d of diario) { if (d.cor === "verde" || d.cor === "amarelo") seq++; else break; }
  return {
    nome: cfg.aluna_nome || "",
    pendentes,
    historico: tent.map(t => Object.assign(resumoTentativa_(t), { fim: String(t.fim) })).sort((a, b) => b.fim.localeCompare(a.fim)),
    notasEscola,
    habilidades: habilidades_(linhas_("Respostas")),
    livros: linhas_("Livros"),
    metaLivros: Number(cfg["meta_livros_" + h.slice(0, 4)] || 0),
    sequencia: seq,
    diario: diario.slice(0, 35).map(d => ({ data: d.data, cor: d.cor }))
  };
}
function tentativaDetalhe_(id, adulto) {
  const t = linhas_("Tentativas").find(x => x.id === id);
  if (!t) throw new Error("Tentativa não encontrada.");
  const r = resumoTentativa_(t);
  const mostra = adulto || r.revisaoLiberada;
  const p = provaPorId_(t.provaId);
  const resp = linhas_("Respostas").filter(x => x.tentativaId === id).map(x => {
    const o = { questaoId: x.questaoId, numero: x.numero, tipo: x.tipo, habilidade: x.habilidade, resposta: x.resposta, pontos: x.pontos, max: x.max, status: x.status, comentario: x.comentario };
    if (mostra) o.correta = x.correta;
    return o;
  });
  return { tentativa: r, respostasMarcadas: JSON.parse(t.respostas || "{}"), respostas: resp, prova: mostra ? p : semGabarito_(p) };
}
function painelAdulto_() {
  const cfg = lerConfig_();
  const provas = todasProvas_();
  const tent = linhas_("Tentativas").map(t => Object.assign(resumoTentativa_(t), { fim: String(t.fim) }));
  const resp = linhas_("Respostas");
  const pend = resp.filter(r => r.status === "pendente").map(r => {
    let enun = "", criterio = "";
    try { const p = provaPorId_(r.provaId); (p.blocos || []).forEach(b => (b.questoes || []).forEach(q => { if (q.id === r.questaoId) { enun = q.enunciado; criterio = q.criterio || ""; } })); } catch (e) { }
    return { tentativaId: r.tentativaId, provaId: r.provaId, questaoId: r.questaoId, numero: r.numero, materia: r.materia, habilidade: r.habilidade, resposta: r.resposta, max: r.max, enunciado: enun, criterio, data: r.data };
  });
  return {
    aluna: cfg.aluna_nome || "",
    provas: provas.map(p => Object.assign(meta_(p), { feitas: tent.filter(t => t.provaId === p.id).length, permitidas: tentativasPermitidas_(p.id, p), arquivada: !!p.arquivada })),
    tentativas: tent.sort((a, b) => b.fim.localeCompare(a.fim)),
    habilidades: habilidades_(resp),
    pendentesCorrecao: pend,
    notas: linhas_("Notas"),
    livros: linhas_("Livros"),
    diario: linhas_("Diario").sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 140),
    metas: linhas_("Metas"),
    metaLivros: Number(cfg["meta_livros_" + hoje_().slice(0, 4)] || 0)
  };
}

/* ============ ações dos adultos ============ */
function recalcula_(tid) {
  const resp = linhas_("Respostas").filter(r => r.tentativaId === tid);
  let pontos = 0, max = 0, pend = 0;
  resp.forEach(r => { max += Number(r.max || 0); if (r.status === "pendente") pend++; else pontos += Number(r.pontos || 0); });
  atualizar_("Tentativas", t => t.id === tid, { pontos, max, nota: nota_(pontos, max), status: pend ? "aguardando" : "corrigida" });
}
function corrigirAberta_(req, sess) {
  const pts = Number(req.pontos);
  if (isNaN(pts)) throw new Error("Pontuação inválida.");
  const n = atualizar_("Respostas", r => r.tentativaId === req.tentativaId && r.questaoId === req.questaoId,
    { pontos: pts, status: "corrigida", comentario: (req.comentario || "") + (req.comentario ? " — " + sess.nome : "") });
  if (!n) throw new Error("Questão não encontrada.");
  recalcula_(req.tentativaId);
  return {};
}
function liberarRevisao_(id, valor) { atualizar_("Tentativas", t => t.id === id, { revisaoLiberada: valor }); return {}; }
function reabrir_(provaId) { anexar_("Liberacoes", { provaId, extras: 1 }); return {}; }

const EDITAVEIS = { Notas: "id", Livros: "id", Diario: "data", Metas: "id" };
function salvar_(aba, dados) {
  const chave = EDITAVEIS[aba];
  if (!chave) throw new Error("Aba não editável.");
  dados = dados || {};
  if (!dados[chave]) dados[chave] = aba.toLowerCase().slice(0, 3) + "-" + Date.now();
  if (aba === "Notas" && dados.total && dados.acertos !== "" && dados.acertos != null && (dados.nota === "" || dados.nota == null)) dados.nota = nota_(Number(dados.acertos), Number(dados.total));
  const cab = ABAS[aba];
  const limpo = {}; cab.forEach(h => { if (dados[h] !== undefined) limpo[h] = dados[h]; });
  if (!atualizar_(aba, r => String(r[chave]) === String(dados[chave]), limpo)) anexar_(aba, limpo);
  return { id: dados[chave] };
}
function excluir_(aba, id) {
  const chave = EDITAVEIS[aba];
  if (!chave) throw new Error("Aba não editável.");
  const s = aba_(aba);
  const v = s.getDataRange().getValues();
  const j = v[0].indexOf(chave);
  for (let i = v.length - 1; i >= 1; i--) {
    const val = v[i][j] instanceof Date ? fmtData_(v[i][j], chave) : String(v[i][j]);
    if (val === String(id)) s.deleteRow(i + 1);
  }
  return {};
}

/* coleções do painel (imitação da tabela app.docs) */
var DOCS = { avaliacoes: {}, notas: {}, leitura: {}, medicoes: {}, metas: {}, dias: {} };
function docsJson_() { const o = {}; Object.keys(DOCS).forEach(c => o[c] = Object.keys(DOCS[c]).map(id => Object.assign({}, DOCS[c][id], { _id: id }))); return o; }
function gravarDoc_(req) { const id = req.id || ("d" + Date.now() + Math.floor(Math.random() * 1000)); const c = DOCS[req.col]; if (!c) throw new Error("coleção inválida"); c[id] = req.merge ? Object.assign({}, c[id] || {}, req.data) : Object.assign({}, req.data); return { id }; }

DOCS.agenda = {}; DOCS.plano = {}; DOCS.feitos = {}; DOCS.gravacoes = {};
function inicioAlunaV2_() {
  const b = inicioAluna_();
  const h = hoje_();
  b.hoje = h;
  b.avaliacoes = Object.keys(DOCS.avaliacoes).map(id => { const a = DOCS.avaliacoes[id]; return { id, data: a.data, materia: a.materia, tipo: a.tipo, titulo: a.titulo || "", nota: a.nota, acertos: a.acertos, total: a.total, comentario: a.obs || "" }; });
  b.agenda = Object.keys(DOCS.agenda).map(id => Object.assign({ id }, DOCS.agenda[id])).sort((x, y) => x.data.localeCompare(y.data));
  b.livros = Object.keys(DOCS.leitura).map(id => { const l = DOCS.leitura[id]; return Object.assign({ id, status: l.fim ? "lido" : "lendo" }, l); });
  b.pendentes = b.pendentes.map(p => Object.assign(p, { assuntos: ["Multiplicação", "Escrita de números"] }));
  const tent = linhas_("Tentativas");
  b.provas = todasProvas_().filter(p => !p.arquivada).map(p => Object.assign(meta_(p), { feita: tent.some(t => t.provaId === p.id), liberada: !p.liberarEm || p.liberarEm <= h }));
  b.plano = Object.keys(DOCS.plano).sort().map(id => Object.assign({}, DOCS.plano[id], { _id: id }));
  b.feitos = Object.keys(DOCS.feitos);
  return b;
}
function acaoAluna_(acao, d, sess) {
  const id = "x" + Date.now(); const h = hoje_();
  if (acao === "livroComecar") DOCS.leitura[id] = { titulo: d.titulo, autor: d.autor || "", formato: d.formato, inicio: h, fim: "", criadoPor: sess.nome };
  if (acao === "livroTerminar") Object.assign(DOCS.leitura[d.id], { fim: h, estrelas: d.estrelas, frase: d.frase });
  if (acao === "agendaAdicionar") DOCS.agenda[id] = { data: d.data, materia: d.materia, tipo: d.tipo, conteudo: d.conteudo, confirmado: false, criadoPor: sess.nome };
  if (acao === "agendaRemover") delete DOCS.agenda[d.id];
  if (acao === "marcarFeito") DOCS.feitos[String(d.item).slice(0, 80)] = { data: h, quem: sess.nome };
  if (acao === "registrarTabuada") { DOCS.medicoes[id] = { data: h, tabuadaSeg: d.segundos, tabuadaAcertos: d.acertos, tabuadaTotal: d.total }; DOCS.feitos[d.item || h + "-tabuada"] = { data: h }; }
  if (acao === "registrarGravacao") { DOCS.gravacoes[id] = { data: h, tipo: d.tipo, titulo: d.titulo, caminho: d.caminho, segundos: d.segundos, quem: sess.nome }; DOCS.feitos[d.item || h + "-gravar"] = { data: h }; }
  return { id };
}

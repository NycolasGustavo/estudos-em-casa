// Hoje com semana e itens bloqueados, aulas com agenda, notas simples, superpoderes, livro com data e leitura.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.speechSynthesis && (window.speechSynthesis.speak = () => {}); });
  const U = 'http://localhost:8787/';
  await p.goto(U); await p.waitForSelector('.pad'); for (const k of '1111') await p.click(`.pad button[data-k="${k}"]`); await p.click('.pad button[data-k="OK"]');
  await p.waitForSelector('.sem-grid');
  // faz uma atividade atrasada (de sexta) para ter nota de casa
  await p.goto(U + '#/prova/2026-10-16-pt-como-adjetivo'); await p.waitForSelector('#comecar'); await p.click('#comecar');
  for (let i = 0; i < 4; i++) await p.click('#l-prox');
  for (const [i, l] of ['B', 'A', 'A', 'B', 'C', 'B'].entries()) await p.check(`input[data-q="q${i + 1}"][value="${l}"]`, { force: true });
  await p.click('#prox'); await p.click('#entregar'); await p.click('#sim'); await p.waitForTimeout(800);
  // agenda: uma prova na quinta
  await p.goto(U + '#/agenda'); await p.waitForSelector('#ag-salvar'); await p.fill('#ag-data', '2026-10-22'); await p.selectOption('#ag-mat', 'Português'); await p.fill('#ag-cont', 'verbos'); await p.click('#ag-salvar'); await p.waitForTimeout(400);
  await p.goto(U + '#/hoje'); await p.waitForSelector('.sem-grid'); await p.waitForTimeout(300); await p.screenshot({ path: 'teste/v3-hoje.png', fullPage: true });
  await p.click('[data-sem="1"]'); await p.waitForTimeout(300); await p.screenshot({ path: 'teste/v3-semana-prox.png', clip: { x: 240, y: 700, width: 1126, height: 400 } }).catch(() => {});
  for (const aba of ['aulas', 'notas', 'materias']) { await p.goto(U + '#/' + aba); await p.waitForSelector('#corpo'); await p.waitForTimeout(300); await p.screenshot({ path: `teste/v3-${aba}.png`, fullPage: true }); }
  await p.goto(U + '#/notas'); await p.waitForSelector('[data-fclasse="atividade"]'); await p.click('.seg [data-fclasse="atividade"]'); await p.waitForTimeout(300); await p.screenshot({ path: 'teste/v3-notas-ativ.png', fullPage: true });
  await p.goto(U + '#/livros'); await p.waitForSelector('#lv-comecar'); await p.fill('#lv-titulo', 'Diário de um Banana'); await p.fill('#lv-ini', '2026-10-01'); await p.click('#lv-comecar'); await p.waitForSelector('[data-lvedit]');
  await p.click('[data-lvedit]'); await p.fill('[data-ed-ini]', '2026-09-28'); await p.click('[data-lvsalvar]'); await p.waitForTimeout(500);
  console.log('livro:', await p.textContent('.col-main .panel .muted.small'));
  await p.screenshot({ path: 'teste/v3-livros.png', fullPage: true });
  console.log('nav:', await p.$$eval('.snav a span', a => a.map(x => x.textContent)));
  console.log('erros:', errs); await b.close();
})();

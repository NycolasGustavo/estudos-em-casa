// Testa a nova tela da aluna (menu lateral, Hoje, aulas, notas), a lição interativa, a tabuada e o ditado.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.addInitScript(() => { window.speechSynthesis && (window.speechSynthesis.speak = () => {}); });
  const pin = async v => { await p.waitForSelector('.pad'); for (const k of v) await p.click(`.pad button[data-k="${k}"]`); await p.click('.pad button[data-k="OK"]'); };
  const U = 'http://localhost:8787/';
  await p.goto(U); await pin('1111'); await p.waitForSelector('.side'); await p.waitForSelector('.item');
  await p.screenshot({ path: 'teste/s-hoje.png' }); await p.screenshot({ path: 'teste/s-hoje-full.png', fullPage: true });
  console.log('itens hoje:', await p.$$eval('.item b', a => a.map(x => x.textContent)));
  await p.hover('.aula-w'); await p.waitForTimeout(200); await p.screenshot({ path: 'teste/s-widget.png', clip: { x: 800, y: 0, width: 566, height: 380 } });
  for (const aba of ['aulas', 'notas', 'materias', 'agenda', 'livros', 'gravar']) { await p.goto(U + '#/' + aba); await p.waitForSelector('.main'); await p.waitForTimeout(250); await p.screenshot({ path: `teste/s-${aba}.png`, fullPage: true }); }
  await p.click('[data-fmundo="casa"]').catch(() => {});
  // marcar livro como feito
  await p.goto(U + '#/hoje'); await p.waitForSelector('.item'); if (await p.$('[data-feito]')) { await p.click('[data-feito]'); await p.waitForTimeout(400); }
  // lição PT
  await p.goto(U + '#/prova/2026-10-16-pt-como-adjetivo'); await p.waitForSelector('#comecar'); await p.screenshot({ path: 'teste/s-capa.png', fullPage: true });
  await p.click('#comecar'); await p.waitForSelector('.licao'); await p.click('[data-ouvir]'); await p.screenshot({ path: 'teste/s-licao1.png', fullPage: true });
  await p.click('#l-prox'); await p.waitForSelector('[data-pq]'); await p.click('[data-pq="0"][data-pv="B"]'); await p.screenshot({ path: 'teste/s-pratica-erro.png', fullPage: true });
  await p.click('[data-pq="0"][data-pv="A"]'); await p.click('[data-pq="1"][data-pv="B"]');
  await p.click('#l-prox'); await p.click('#l-prox'); await p.fill('[data-pin="1"]', 'delicioso'); await p.click('[data-pck="1"]'); await p.screenshot({ path: 'teste/s-pratica-ok.png', fullPage: true });
  await p.click('#l-prox'); await p.waitForSelector('.sem-audio'); await p.screenshot({ path: 'teste/s-fixacao.png', fullPage: true });
  for (const [i, l] of ['B', 'B', 'A', 'B', 'C', 'A'].entries()) await p.check(`input[data-q="q${i + 1}"][value="${l}"]`, { force: true });
  await p.click('#prox'); await p.click('#entregar'); await p.click('#sim'); await p.waitForSelector('.score, .result, h1'); await p.waitForTimeout(500); await p.screenshot({ path: 'teste/s-resultado.png', fullPage: true });
  // lição Mat com blocos e exemplo
  await p.goto(U + '#/prova/2026-10-16-mat-conta-armada'); await p.waitForSelector('#comecar'); await p.click('#comecar'); await p.waitForSelector('.licao'); await p.screenshot({ path: 'teste/s-mat1.png', fullPage: true });
  await p.click('#l-prox'); await p.click('[data-passo]'); await p.click('[data-passo]'); await p.screenshot({ path: 'teste/s-mat-ex.png', fullPage: true });
  await p.click('#l-prox'); await p.click('[data-bl="c2d"]'); await p.click('[data-bl="d2u"]'); await p.screenshot({ path: 'teste/s-mat-blocos.png', fullPage: true });
  // jogo do plural
  await p.goto(U + '#/prova/2026-10-19-pt-plural-ao'); await p.waitForSelector('#comecar'); await p.click('#comecar'); await p.click('#l-prox'); await p.click('[data-jg]');
  for (let i = 0; i < 3; i++) await p.click('[data-jo="0"]'); await p.screenshot({ path: 'teste/s-jogo.png', fullPage: true });
  // tabuada
  await p.goto(U + '#/hoje'); await p.waitForSelector('.item'); await p.click('a[href*="tabuada"]'); await p.waitForSelector('#tb-ir'); await p.click('#tb-ir');
  for (let i = 0; i < 20; i++) { const t = await p.textContent('.tab-conta'); const [a, c] = t.match(/\d+/g).map(Number); await p.fill('#tb-r', String(i % 7 ? a * c : 0)); await p.press('#tb-r', 'Enter'); }
  await p.waitForSelector('#tb-s'); await p.waitForTimeout(500); await p.screenshot({ path: 'teste/s-tabuada.png' });
  await p.goto(U + '#/hoje'); await p.waitForSelector('.item'); await p.waitForTimeout(300); await p.screenshot({ path: 'teste/s-hoje-depois.png', fullPage: true });
  console.log('feitos:', await p.$$eval('.item.ok b', a => a.map(x => x.textContent)));
  console.log('erros:', errs); await b.close();
})();

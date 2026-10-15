// Café da tarde (adulto) -> Hoje da aluna com Sol, cor do dia, ficou devendo; caderno de erros; cartões.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const nova = async () => { const p = await b.newPage({ viewport: { width: 1366, height: 800 } }); p.on('pageerror', e => errs.push(e.message)); await p.addInitScript(() => { window.speechSynthesis && (window.speechSynthesis.speak = () => {}); }); return p; };
  const pin = async (p, v) => { await p.goto('http://localhost:8787/'); await p.waitForSelector('.pad'); for (const k of v) await p.click(`.pad button[data-k="${k}"]`); await p.click('.pad button[data-k="OK"]'); };
  // adulto
  let p = await nova(); await pin(p, '9999'); await p.waitForURL(/painel/); await p.waitForFunction(() => /sincronizados/.test(document.getElementById('status').textContent));
  await p.click('[data-tab="etapa0"]'); await p.fill('#d-data', '2026-10-18'); await p.dispatchEvent('#d-data', 'change'); await p.waitForTimeout(200);
  for (const k of ['caderno', 'sala', 'deveres', 'aula']) await p.click(`[data-vc="${k}"][data-v="1"]`);
  await p.click('[data-vc="agenda"][data-v="0"]');
  if (await p.$('[data-vc="estudo"]')) await p.click('[data-vc="estudo"][data-v="1"]');
  await p.fill('#d-deveres', 'Matemática: página 42, exercícios 1 a 5'); await p.fill('#d-obs', 'Adorei como você explicou a aula de Ciências!');
  await p.screenshot({ path: 'teste/v4-cafe.png', fullPage: true });
  await p.click('#f-dia button[type=submit]'); await p.waitForTimeout(600); console.log('msg:', await p.textContent('#m-dia'));
  await p.close();
  // aluna
  p = await nova(); await pin(p, '1111'); await p.waitForSelector('.sol-card'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'teste/v4-hoje.png', fullPage: true });
  await p.click('a[href="#/revisar"]'); await p.waitForSelector('[data-rv], #rv-in');
  await p.click('[data-rv="A"]'); await p.click('#rv-ok'); await p.waitForSelector('#rv-prox'); await p.screenshot({ path: 'teste/v4-revisar-erro.png' });
  await p.click('#rv-prox'); await p.fill('#rv-in', 'cantarei'); await p.click('#rv-ok'); await p.waitForSelector('#rv-prox'); await p.screenshot({ path: 'teste/v4-revisar-ok.png' });
  await p.click('#rv-prox'); await p.fill('#rv-in', '263'); await p.click('#rv-ok'); await p.waitForSelector('#rv-prox'); await p.click('#rv-prox'); await p.waitForTimeout(600);
  await p.screenshot({ path: 'teste/v4-revisar-fim.png' });
  await p.goto('http://localhost:8787/#/erros'); await p.waitForSelector('.erros-top'); await p.screenshot({ path: 'teste/v4-erros.png', fullPage: true });
  await p.goto('http://localhost:8787/#/prova/2026-10-19-pt-plural-ao'); await p.waitForSelector('#comecar'); await p.click('#comecar'); await p.click('#l-prox'); await p.waitForSelector('[data-fc]');
  await p.click('[data-fc="virar"]'); await p.screenshot({ path: 'teste/v4-cartao.png' }); await p.click('[data-fc="sabia"]'); await p.click('[data-fc="virar"]'); await p.click('[data-fc="nao"]');
  console.log('cartões:', await p.textContent('.fc-wrap .muted'));
  await p.goto('http://localhost:8787/#/hoje'); await p.waitForSelector('.sol-card'); await p.screenshot({ path: 'teste/v4-hoje2.png', fullPage: true });
  console.log('erros:', errs); await b.close();
})();

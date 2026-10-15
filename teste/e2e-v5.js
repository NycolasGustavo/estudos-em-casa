// Telas largas (1920): painel com menu lateral, visão geral, checklist; aluna: hoje, agenda-caderno, notas.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const nova = async (w = 1920) => { const p = await b.newPage({ viewport: { width: w, height: 1000 } }); p.on('pageerror', e => errs.push(e.message)); return p; };
  const pin = async (p, v) => { await p.goto('http://localhost:8787/'); await p.waitForSelector('.pad'); for (const k of v) await p.click(`.pad button[data-k="${k}"]`); await p.click('.pad button[data-k="OK"]'); };
  let p = await nova(); await pin(p, '9999'); await p.waitForURL(/painel/); await p.waitForFunction(() => /sincronizados/.test(document.getElementById('status').textContent));
  await p.click('[data-tab="etapa0"]'); await p.fill('#d-data', '2026-10-18'); await p.dispatchEvent('#d-data', 'change');
  for (const k of ['caderno', 'sala', 'deveres', 'aula']) await p.click(`[data-vc="${k}"][data-v="1"]`); await p.click('[data-vc="agenda"][data-v="0"]');
  if (await p.$('[data-vc="estudo"]')) await p.click('[data-vc="estudo"][data-v="1"]');
  await p.fill('#d-obs', 'Muito bem na aula!'); await p.click('#f-dia button[type=submit]'); await p.waitForTimeout(500);
  await p.fill('#rc-txt', 'Sorvete no sábado'); await p.click('#rc-salvar'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'teste/v5-a-check.png', fullPage: true });
  await p.click('[data-tab="geral"]'); await p.waitForTimeout(300); await p.screenshot({ path: 'teste/v5-a-geral.png', fullPage: true });
  await p.click('[data-tab="materias"]'); await p.waitForTimeout(300); await p.screenshot({ path: 'teste/v5-a-mat.png' });
  await p.close();
  p = await nova(); await pin(p, '1111'); await p.waitForSelector('.sol-card'); await p.waitForTimeout(300); await p.screenshot({ path: 'teste/v5-k-hoje.png' });
  await p.goto('http://localhost:8787/#/aulas'); await p.waitForSelector('.caderno'); await p.fill('#ag-data', '2026-10-22'); await p.selectOption('#ag-mat', 'Português'); await p.fill('#ag-cont', 'verbos'); await p.click('#ag-salvar'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'teste/v5-k-agenda.png' });
  await p.goto('http://localhost:8787/#/notas'); await p.waitForSelector('.ntiles'); await p.waitForTimeout(300); await p.screenshot({ path: 'teste/v5-k-notas.png', fullPage: true });
  await p.close(); p = await nova(1366); await pin(p, '1111'); await p.waitForSelector('.sol-card'); await p.screenshot({ path: 'teste/v5-k-hoje-1366.png' });
  console.log('erros:', errs); await b.close();
})();

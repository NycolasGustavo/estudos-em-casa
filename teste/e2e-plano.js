// Painel dos adultos: aba Plano e constância e o "Estudo de hoje" na visão geral.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8787/'); await p.waitForSelector('.pad'); for (const k of '9999') await p.click(`.pad button[data-k="${k}"]`); await p.click('.pad button[data-k="OK"]');
  await p.waitForURL(/painel/); await p.waitForFunction(() => /sincronizados/.test(document.getElementById('status').textContent));
  await p.click('[data-tab="geral"]'); await p.screenshot({ path: 'teste/a-geral-hoje.png' });
  await p.click('[data-tab="plano"]'); await p.waitForTimeout(300); await p.screenshot({ path: 'teste/a-plano.png', fullPage: true });
  console.log('erros:', errs); await b.close();
})();

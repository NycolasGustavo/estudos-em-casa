// Teste de ponta a ponta: node teste/server.js & depois NODE_PATH=$(npm root -g) node teste/e2e.js
const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:880}});const errs=[];
p.on('pageerror',e=>errs.push(e.message));
const pin=async v=>{await p.waitForSelector('.pad');for(const k of v)await p.click(`.pad button[data-k="${k}"]`);await p.click('.pad button[data-k="OK"]');};
await p.goto('http://localhost:8787/');await pin('1111');await p.waitForSelector('.pcard a.btn');await p.click('.pcard a.btn');
await p.click('#comecar');await (await p.$('input[value="B"]')).evaluate(i=>i.closest('label').click());
await p.fill('input[data-q="q2"]','36');await p.fill('input[data-q="q3"]','Trinta e seis');await p.fill('textarea[data-q="q4"]','3 vezes 12');
await p.click('#prox');await p.click('#entregar');await p.click('#sim');await p.waitForSelector('.ring');
console.log('resultado:',await p.textContent('.panel p.muted'));
await p.click('#sair');await pin('9999');await p.waitForSelector('.kpis');await p.goto('http://localhost:8787/#/adulto/correcao');
await p.waitForSelector('[data-salvar-corr]');await p.fill('#pt-0','2');await p.click('[data-salvar-corr="0"]');await p.waitForTimeout(500);
await p.goto('http://localhost:8787/#/adulto/geral');await p.waitForSelector('.kpis');console.log('kpis:',await p.textContent('.kpis'));
console.log('erros:',errs);await b.close();})();

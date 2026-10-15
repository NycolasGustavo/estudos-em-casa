// Teste do painel dos adultos: node teste/server.js & depois NODE_PATH=$(npm root -g) node teste/e2e-painel.js
const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});const errs=[];
p.on('pageerror',e=>errs.push(e.message));
const pin=async v=>{await p.waitForSelector('.pad');for(const k of v)await p.click(`.pad button[data-k="${k}"]`);await p.click('.pad button[data-k="OK"]');};
await p.goto('http://localhost:8787/');await pin('1111');await p.waitForSelector('.pcard a.btn');await p.click('.pcard a.btn');
await p.click('#comecar');await (await p.$('input[value="B"]')).evaluate(i=>i.closest('label').click());
await p.fill('input[data-q="q2"]','36');await p.fill('input[data-q="q3"]','trinta e seis');await p.fill('textarea[data-q="q4"]','3 vezes 12');
await p.click('#prox');await p.click('#entregar');await p.click('#sim');await p.waitForSelector('.ring');await p.screenshot({path:'teste/k-resultado.png'});
await p.click('#sair');await pin('9999');await p.waitForURL(/painel\.html/);await p.waitForFunction(()=>/sincronizados/.test(document.getElementById('status').textContent));
await p.screenshot({path:'teste/p-geral.png'});
for(const t of ['materias','etapa0','metas','provas']){await p.click(`nav.tabs button[data-tab="${t}"]`);await p.waitForTimeout(150);await p.screenshot({path:`teste/p-${t}.png`,fullPage:true});}
await p.click('nav.tabs button[data-tab="materias"]');await p.fill('#r-tit','Prova de frações');await p.selectOption('#r-mat','Matemática');await p.fill('#r-ac','8');await p.fill('#r-tot','10');await p.click('#f-reg button[type=submit]');await p.waitForTimeout(500);
console.log('msg:',await p.textContent('#m-reg'),'| registros mat:',await p.$$eval('#t-reg tr',r=>r.length));
await p.click('nav.tabs button[data-tab="metas"]');await p.check('[data-meta="m1"]');await p.waitForTimeout(400);
console.log('meta feita:',await p.$eval('[data-meta="m1"]',e=>e.checked));
await p.click('nav.tabs button[data-tab="provas"]');await p.click('a[href="index.html#/adulto/correcao"]');await p.waitForSelector('[data-salvar-corr]');await p.fill('#pt-0','2');await p.click('[data-salvar-corr="0"]');await p.waitForTimeout(500);
await p.click('a[href="painel.html"]');await p.waitForFunction(()=>/sincronizados/.test(document.getElementById('status').textContent));
await p.click('nav.tabs button[data-tab="materias"]');await p.click('[data-mat="Matemática"]');await p.waitForTimeout(200);await p.screenshot({path:'teste/p-mat.png',fullPage:true});
console.log('erros:',errs);await b.close();})();

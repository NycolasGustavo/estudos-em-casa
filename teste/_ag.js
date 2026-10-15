const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
const nova=async()=>{const p=await b.newPage({viewport:{width:1600,height:1000}});p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));return p;};
const pin=async(p,v)=>{await p.goto('http://localhost:8787/');await p.waitForSelector('.pad');for(const k of v)await p.click(`.pad button[data-k="${k}"]`);await p.click('.pad button[data-k="OK"]');};
let p=await nova();await pin(p,'1111');await p.waitForSelector('.sol-card');
await p.goto('http://localhost:8787/#/aulas');await p.waitForSelector('#ag-salvar');await p.fill('#ag-data','2026-10-20');await p.click('#ag-salvar');await p.waitForTimeout(600);
console.log('kid itens:',await p.$$eval('.cad-l',a=>a.map(x=>x.textContent.trim())));
// kid delete
const x=await p.$('[data-agdel]'); if(x){await x.click();await p.waitForTimeout(200);console.log('apos 1 clique:',await p.$$eval('[data-agdel]',a=>a.map(x=>x.textContent)));}
await p.close();
p=await nova();await pin(p,'9999');await p.waitForURL(/painel/);await p.waitForFunction(()=>/sincronizados/.test(document.getElementById('status').textContent));
console.log('agenda painel:',await p.$$eval('#g-agenda tr',a=>a.map(x=>x.textContent.slice(0,80))));
const ok=await p.$('#g-agenda [data-agok]'); if(ok){await ok.click();await p.waitForTimeout(500);}
console.log('depois confirmar:',await p.$$eval('#g-agenda tr',a=>a.map(x=>x.textContent.slice(0,80))));
const del=await p.$('#g-agenda [data-del]'); if(del){await del.click();await p.waitForTimeout(100);await (await p.$('#g-agenda [data-del].armed')).click();await p.waitForTimeout(600);}
console.log('depois excluir:',await p.$$eval('#g-agenda tr',a=>a.map(x=>x.textContent.slice(0,80))));
console.log('erros',errs);await b.close();})();

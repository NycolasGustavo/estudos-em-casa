// Servidor de teste: serve o site e imita a API do banco (POST /rest/v1/rpc/api) com uma implementação em JS do mesmo contrato.
const http=require('http'),fs=require('fs'),path=require('path'),vm=require('vm');
const SITE=path.join(__dirname,'../docs'), PROVAS=path.join(__dirname,'provas');
const sheets={}; const props={}; const mails=[];
function parts(d){const f=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});const o={};f.formatToParts(d).forEach(p=>o[p.type]=p.value);if(o.hour==='24')o.hour='00';return o;}
function toCell(v){ if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v+'T12:00:00-03:00'); return v; }
function mkSheet(name){const rows=[];const s={name,rows,
 getDataRange:()=>({getValues:()=>rows.length?rows.map(r=>r.slice()):[[]]}),
 appendRow:r=>rows.push(r.map(toCell)), getLastRow:()=>rows.length, getLastColumn:()=>rows[0]?rows[0].length:0,
 getRange:(r,c,nr,nc)=>({setNumberFormat:()=>{},getValues:()=>rows.slice(r-1,r-1+(nr||1)).map(x=>x.slice(c-1,c-1+(nc||1))),setValue:v=>{rows[r-1][c-1]=toCell(v);}}),
 setFrozenRows:()=>{}, deleteRow:i=>rows.splice(i-1,1)};return s;}
const ss={getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=mkSheet(n))};
const ctx={console,JSON,Math,Date,String,Number,Object,Array,Error,parseFloat,isNaN,encodeURIComponent,
 SpreadsheetApp:{getActive:()=>ss},
 DriveApp:{getFilesByName:n=>{let d=n==='estudos-seed.json';return{hasNext:()=>d,next:()=>{d=false;return{getBlob:()=>({getDataAsString:()=>fs.readFileSync(path.join(__dirname,'seed-exemplo.json'),'utf8')})}}}},createFolder:()=>({getId:()=>'pasta-teste'}),getFolderById:()=>({getName:()=>'Provas',getFiles:()=>{const fs_=fs.readdirSync(PROVAS).map(f=>({getName:()=>f,getBlob:()=>({getDataAsString:()=>fs.readFileSync(path.join(PROVAS,f),'utf8')})}));let i=0;return{hasNext:()=>i<fs_.length,next:()=>fs_[i++]};}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v,deleteProperty:k=>delete props[k]})},
 CacheService:{getScriptCache:()=>({get:()=>null,put:()=>{}})},
 LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},
 Utilities:{getUuid:()=>require('crypto').randomUUID(),sleep:()=>{},formatDate:(d,tz,f)=>{const o=parts(d);return f.replace('yyyy',o.year).replace('MM',o.month).replace('dd',o.day).replace("'T'",'T').replace('HH',o.hour).replace('mm',o.minute).replace('ss',o.second);}},
 MailApp:{sendEmail:m=>{mails.push(m);fs.writeFileSync(path.join(__dirname,'ultimo-email.html'),m.htmlBody);},getRemainingDailyQuota:()=>100},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({s,setMimeType(){return this;}})}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'mock-api.gs'),'utf8'),ctx);
vm.runInContext('configurar()',ctx);
vm.runInContext(`DOCS.avaliacoes['a1']={data:'2026-10-07',materia:'Português',tipo:'Simulado (escola)',titulo:'Simulado 2',acertos:5,total:10,nota:5};DOCS.avaliacoes['a2']={data:'2026-10-08',materia:'Matemática',tipo:'Prova (casa)',titulo:'Contas',acertos:2,total:9,nota:2.2};DOCS.metas['m1']={periodo:'T4 2026',pilar:'Leitura',titulo:'Ler 3 livros',status:'aberta',ordem:1};`,ctx);
sheets.Diario.appendRow(['2026-10-14','verde',true,true,true,true,0,0,'']);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
http.createServer((req,res)=>{
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'});res.end();return;}
 if(req.url==='/rest/v1/rpc/api'&&req.method==='POST'){let b='';req.on('data',c=>b+=c);req.on('end',()=>{let out;try{const j=JSON.parse(b);out=ctx.doPost({postData:{contents:JSON.stringify(Object.assign({acao:j.acao},j.dados||{}))}}).s;}catch(e){out=JSON.stringify({ok:false,erro:String(e)});}res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(out);});return;}
 if(req.url==='/__dump'){res.end(JSON.stringify({Tentativas:sheets.Tentativas.rows,Respostas:sheets.Respostas.rows.length,mails:mails.length}));return;}
 let f=req.url.split('?')[0]; if(f==='/')f='/index.html';
 if(f==='/config.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end('window.ESTUDOS={url:"http://localhost:8787",chave:"teste"};');return;}
 const p=path.join(SITE,f); if(!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'text/plain'});res.end(fs.readFileSync(p));
}).listen(8787,()=>console.log('ok 8787'));

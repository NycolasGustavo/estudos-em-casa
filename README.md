# Estudos em Casa

Provas, notas e acompanhamento de estudos em casa.

- `docs/`: o site (GitHub Pages). Sem build, sem dependências.
- `apps-script/Code.gs`: o backend. Roda no Google Apps Script, ligado à planilha **Estudos em Casa · Dados**.
- `FORMATO-PROVA.md`: o formato dos arquivos de prova.
- `teste/`: servidor local que roda o `Code.gs` real com imitações das APIs do Google, mais um teste de ponta a ponta.

Os dados (pessoas, PINs, notas, respostas) ficam só na planilha do Google. Este repositório não guarda dados pessoais nem gabaritos.

## Instalação (uma vez)

1. Abra a planilha **Estudos em Casa · Dados** → **Extensões → Apps Script**.
2. Apague o conteúdo de `Código.gs`, cole o conteúdo de `apps-script/Code.gs` e salve.
3. No menu de funções, escolha **configurar** → **Executar** → autorize.
4. **Implantar → Nova implantação → App da Web**. Executar como: **Eu**. Quem pode acessar: **Qualquer pessoa**. Copie a URL `/exec`.
5. Cole a URL em `docs/config.js`.
6. GitHub: **Settings → Pages → Deploy from a branch → main / docs**.

Ao atualizar o `Code.gs`: **Implantar → Gerenciar implantações → editar → Nova versão** (a URL continua a mesma).

## Teste local

```
node teste/server.js            # http://localhost:8787  (PIN aluna 1111, adulto 9999)
NODE_PATH=$(npm root -g) node teste/e2e.js
```

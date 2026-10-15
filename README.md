# Estudos em Casa

Provas, notas e acompanhamento de estudos em casa.

- `docs/`: o site (GitHub Pages). HTML, CSS e JS puros, sem build.
- Banco de dados: **Supabase** (projeto `estudos-em-casa`). Tabelas no esquema privado `app`, que não é exposto pela API.
  O site só conversa com uma função, `public.api(acao, dados)`, que confere o PIN/sessão de cada pessoa e faz a correção.
  O gabarito nunca vai para o navegador da aluna.
- `FORMATO-PROVA.md`: o formato das provas (gravadas na tabela `app.provas`, coluna `conteudo`).
- `teste/`: servidor local que imita a API do banco e um teste de ponta a ponta do site.

Este repositório não guarda dados pessoais, PINs nem gabaritos: tudo isso fica no banco.

## Como as provas entram

O Claude grava a prova direto no banco, numa conversa:

```sql
insert into app.provas (id, conteudo) values ('2026-10-20-mat-divisao', '{ ...json da prova... }');
```

Um gatilho numera as questões e preenche título, matéria e datas a partir do JSON.

## Teste local

```
node teste/server.js            # http://localhost:8787  (PIN aluna 1111, adulto 9999)
NODE_PATH=$(npm root -g) node teste/e2e.js
```

# Formato de prova

Cada prova é um JSON gravado em `app.provas.conteudo` no Supabase. O gabarito fica no banco e nunca vai para a tela da aluna: a função `public.api` remove `correta`, `aceitas`, `criterio`, `explicacao` e `tolerancia` antes de enviar a prova.

```json
{
  "id": "2026-10-20-mat-divisao",        // único; sugestão: data-matéria-tema
  "titulo": "Divisão com resto",
  "materia": "Matemática",               // Português, Matemática, PLE, Inglês, Disciplinar, Artes, Informática, Educação Física
  "tipo": "prova",                       // prova | simulado | atividade | reforco
  "criadaEm": "2026-10-20",
  "liberarEm": "2026-10-21",             // opcional: só aparece a partir desta data
  "prazo": "2026-10-23",                 // opcional
  "minutos": 40,                         // tempo sugerido
  "tentativas": 1,                       // opcional (padrão 1)
  "arquivada": false,                    // opcional: some da lista dela
  "instrucoes": "…", "dica": "…",
  "blocos": [
    {
      "titulo": "Parte 1",               // opcional
      "lead": "Leia o texto para responder às questões 1 a 3.",
      "texto": { … },                    // opcional; ver tipos abaixo (pode ser uma lista)
      "questoes": [ … ]
    }
  ]
}
```

## Tipos de texto de apoio

| tipo | campos |
|---|---|
| `prosa` (padrão) | `titulo`, `paragrafos[]` (parágrafo começando com `**` sai em negrito), `credito` |
| `poema` | `titulo`, `estrofes[[versos]]`, `credito` |
| `cartaz` | `linhas[{t, estilo: grande \| destaque}]` |
| `tirinha` | `personagens[a, b]` (vovo, menino, menina, adulto), `quadros[{fala, quem: 0\|1, objeto}]` |
| `imagem` | `svg` (SVG em texto) |
| `html` | `html` (conteúdo livre) |

## Tipos de questão

Todas aceitam `enunciado`, `habilidade`, `assunto`, `bncc`, `pontos` (padrão 1), `explicacao` (aparece na revisão), `apoio` (texto de apoio só da questão).

| tipo | correção | campos |
|---|---|---|
| `mc` | automática | `opcoes[]`, `correta` (letra) |
| `numero` | automática | `correta` (número), `tolerancia`, `unidade` |
| `curta` | automática | `aceitas[]`, `ignorarAcentos` |
| `aberta` | adulto corrige no site | `criterio`, `linhas` |

A `habilidade` é o que alimenta o mapa de habilidades. Use sempre o mesmo nome para a mesma habilidade.

## Atividades com lição (`licao`)

Antes das questões, uma atividade pode ter uma lição em partes (`licao: [...]`). Cada parte tem `tipo` e `titulo`, e pode ter `paragrafos`, `html` (visual) e `destaque`. Todas as partes, menos o jogo, têm botão **Ouvir** (voz do navegador; `lang: "en-US"` para inglês). As questões finais (`blocos`) nunca têm áudio, exceto o ditado.

| tipo | campos | o que faz |
|---|---|---|
| `explica` | paragrafos, html, destaque | explicação |
| `exemplo` | enunciado, passos[] | exemplo resolvido, um passo por clique |
| `blocos` | numero | peças de centena/dezena/unidade para trocar (empresta um) |
| `fracao` | partes | barra para pintar frações |
| `pratica` | questoes[{enunciado, opcoes, correta:"A"} ou {enunciado, resposta:[...]}, dica, explicacao, falar?, lang?] | "fazer junto" com correção na hora |
| `jogo` | questoes[{p, opcoes, correta: índice}], segundos, instrucao | desafio cronometrado |
| `cartoes` | cartoes[{frente, verso}] | flashcards: vira o cartão, "Eu sabia!" ou "Ainda não" (volta para o fim do monte) |

Questão `ditado` (nos blocos): `{tipo:"ditado", falar:"palavra", correta:"palavra"}`.

`tipo` da prova: `atividade`, `revisao`, `aquecimento`, `reforco` (não valem nota) e `simulado`, `prova` (valem nota e entram no boletim).

## Plano do dia (`app.docs`, col `plano`, id = data)

```json
{"data":"2026-10-16","minutos":45,"itens":[
  {"id":"2026-10-16-tabuada","momento":"aquecimento","titulo":"Tabuada relâmpago","minutos":5,"acao":"tabuada"},
  {"id":"<id da prova>","momento":"frio|quente|missao|prova|simulado|extra","titulo":"...","minutos":10,"provaId":"<id da prova>"},
  {"id":"2026-10-16-gravar","momento":"extra","titulo":"Gravar a leitura","acao":"gravar","texto":"texto para ler"},
  {"id":"2026-10-16-livro","momento":"livro","titulo":"Ler o meu livro","acao":"livro"}]}
```
Aula em vídeo no plano: `{"id":"2026-10-22-video-<yt>","momento":"video","acao":"video","yt":"<id de 11 letras do YouTube>","titulo":"Aula: ...","minutos":8,"materia":"Matemática","descricao":"..."}`. Ela assiste dentro do app (player sem links para o YouTube) e o item fica feito quando ela vê 80% do vídeo; pular partes não conta.

Item com `provaId` fica feito quando ela entrega a prova. Os outros, quando ela marca (ou termina a tabuada / envia a gravação).

## Caderno de erros

Toda questão de correção automática (mc, numero, curta, ditado) que ela errar entra em `app.erros` sozinha (gatilho em `app.respostas`). Volta em 1, 3, 7 e 21 dias; errou, volta no dia seguinte; 4 acertos seguidos e sai do caderno. Em "Hoje" aparece o item "Revisar meus erros" quando há questões do dia. Por isso, escreva `explicacao` nas questões: ela aparece na revisão.

## Café da tarde (visto do dia)

Documento em `app.docs` col `dias`, id = data: `{data, cor, folga, itens:{caderno,sala,deveres,agenda,aula,estudo,ontem}, devendo:[lembretes], deveres:[textos], escondeu, branco, estrelas, obs, combinado, notasEscola, quem}`. A cor é automática: tudo feito = verde, 1–2 faltando = amarelo, 3+ = vermelho, escondeu exercício em branco = preto. `devendo` e `deveres` aparecem para ela no dia seguinte.

## Aulas em vídeo (`app.docs`, col `videos`, id = id do YouTube)

`{titulo, canal, materia, assunto, minutos, ordem, porque, oculto?}`. Aparecem na aba **Aprender** do app, agrupadas por matéria. Antes de cadastrar, confira que o vídeo permite incorporação (`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json` responde 200). O player usa o host youtube.com (o youtube-nocookie devolve erro 150 nesses vídeos). Vídeos monetizados podem mostrar propaganda antes da aula.
O quanto ela assistiu fica em col `assistidos` (id = id do vídeo): `{pct, duracao, vistos, posicao, data, vezes}`.

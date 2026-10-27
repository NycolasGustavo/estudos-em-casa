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

Todas aceitam `enunciado`, `habilidade`, `assunto`, `bncc`, `pontos` (padrão 1), `explicacao` (aparece na revisão), `apoio` (texto de apoio só da questão) e `falar` + `lang` (mostra o botão Ouvir; `lang: "en-US"` para inglês).

O `ditado` compara o texto exato (sem diferenciar maiúsculas). **Colher de chá do til (desde 21/10):** em `ditado` e `curta`, a palavra certa escrita só sem o til (ã, õ) conta como certa, mas a resposta recebe o comentário "Faltou o til. O certo é: …", que aparece no resultado, na revisão e no caderno de erros. Outros acentos continuam valendo; para aceitá-los, use `curta` com `ignorarAcentos: true`. **Número escrito em frase (desde 22/10):** em `numero`, se a resposta não for só o número, vale o último número escrito ("Tem 33 alunos", "128 - 95 = 33"); conta como certa com o comentário "Resposta certa! Da próxima vez, escreva só o número". O "Faça junto" da lição segue a mesma regra e também aceita a falta do til.

Trava contra chute: em cada bloco, o botão de seguir só libera depois de 15 s por questão (20 s em prova e simulado; mude com `segundosPorQuestao`), e cada parte da lição pede 10 s. Atividade que não vale nota feita com 30 s ou menos por questão (contando a lição) volta uma vez para ela refazer. **Desde 22/10:** a nova tentativa só é liberada se, além de rápida (≤ 30 s por questão), a nota ficar abaixo de 8. Rápida com nota boa vale normalmente; o painel continua marcando com ⚡.

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
Momentos: aquecimento, frio, quente, missao, video, ingles, recuperacao, prova, simulado, extra, livro, meensina.

**Tabuada da semana:** o item `acao:"tabuada"` aceita `foco` (a tabuada da semana: 14 das 20 contas são dela), `revisar` (tabuadas já vistas para as outras 6 contas, ex. `[2,3,4,5]`) e `dica` (aparece na tela inicial). O resultado grava `tabuadaFoco` em `medicoes`. Sem `foco`, as contas são sorteadas como antes. Sequência combinada: 6 (22 a 30/10), 7 (3 a 6/11), 8, 9.

**Me ensina:** item `{"id":"AAAA-MM-DD-meensina","acao":"meensina","momento":"meensina","titulo":"Me ensina","minutos":10}` no fim do plano de cada dia de aula, e no documento do plano o campo `meEnsina: [{p, r}]` com a pergunta armadilha do dia e a resposta. A aluna vê "Um adulto marca à tarde" e não consegue marcar sozinha (a API recusa). O adulto marca no visto do café da tarde (linha "Me ensina"), onde aparece a pergunta do dia; ao salvar o dia, o item fica feito. O item não conta nos minutos da manhã, na tigela da Sol nem na ofensiva.
```
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

## Funções executivas (desde 22/10/2026)

Base: laudo neuropsicológico (atenção e controle inibitório baixos, memória operacional abaixo da média, memória auditiva como ponto forte). Plano completo em `claude/funcoes-executivas-plano.md` no projeto.

- **`pense` nas questões de problema:** `{"correta": "comparar" | ["tirar","comparar"], "conta": true, "dica": "..."}`. Tipos: `juntar`, `tirar`, `comparar`, `repartir`, `vezes` (ou `opcoes` própria). As alternativas só aparecem depois que ela acerta o tipo (conferido no servidor, `api('conferir', {modo:'pense'})`) e escreve a conta, se `conta: true`. `sem_gabarito` esconde `pense.correta`. Vale em treinos e provas. Use em todo problema com enunciado; não use em cálculo puro nem em Português.
  - **`pense.tipo: "medida"`** (perímetro ou área): opções `perimetro` ("a volta") e `area` ("o de dentro"). `conta: true` quando há medidas para somar/multiplicar; `false` em figuras de quadradinhos.
  - **`pense.tipo: "classe"`** (substantivo ou adjetivo, Português): `{"tipo":"classe","palavra":"azul","opcoes":["sim","nao"],"correta":"sim"}`. Pergunta "dá para dizer *muito azul*?"; depois mostra a regra (dá → adjetivo; não dá → substantivo). Uma palavra por questão, opções `["substantivo (é nome)","adjetivo (diz como é)"]`. **Até nova ordem, não fazer múltipla escolha de substantivo/adjetivo sem este pense.**
- **Realce automático** no enunciado (treino, prova e caderno): "não", "a mais", "a menos", "diferença", "quanto falta", "mais que", "menos que".
- **Caderno de erros:** no máximo 8 por dia, até 3 por habilidade, agrupados, com a regra curta antes do primeiro cartão do grupo (`REGRAS` em `app.js`). Cada cartão mostra, quando existe, uma **questão diferente da mesma habilidade** (já liberada; evita questões que dependem de figura da lição); a correção usa a questão mostrada. Habilidades dominadas podem ser arquivadas (`app.erros.arquivado = true`, conta à parte de "vencidos").
- **Treinos** (tudo que não é `prova`/`simulado`): uma questão por tela, botão **Conferir** (`api('conferir')`), retorno imediato. A **primeira** resposta conferida é a que vale nota; a segunda tentativa só ensina. A explicação aparece depois da 2ª tentativa. Provas continuam com todas as questões na tela e sem retorno.
- **Entrega:** checklist de 3 itens obrigatório. A entrega envia `__raciocinio` (por questão: tipo escolhido, acertou de primeira, conta, tentativas), `__adulto` (marcou "estou com um adulto") e `__checklist`. O raciocínio fica em `app.respostas.raciocinio` e aparece no painel em "Ver respostas".
- **Itens de plano:** `acao: "pausa"` (5 min, os itens seguintes ficam travados até a pausa terminar; entra depois de ~30 min de estudo) e `acao: "pare"` (jogo Pare! de ir/não ir, 3 min, logo depois da tabuada; nível sobe sozinho; grava em `jogos`).
- **Estrelas de foco** (`docs` col `estrelas`, dadas só pelo servidor): +1 pense certo de primeira, +1 conta mostrada, +1 checklist, +2 feito com calma (sem cair na trava), +2 caderno de erros do dia, +1 jogo Pare!. Troca: preço em estrelas na recompensa (visto do café da tarde); o adulto desconta no painel.
- **Termômetro** (`humor`, um por dia): carinha + energia ao abrir "Hoje". Triste ou irritada abre 1 minuto de respiração guiada.
- **Me ensina gravado:** `#/ensina?item=...` usa o gravador (tipo `meensina`); o adulto assiste em Plano › Gravações.
- **Painel › Foco e autocontrole:** `app.fe_resumo()` por semana.

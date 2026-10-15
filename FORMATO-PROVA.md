# Formato de prova

Cada prova é um arquivo `.json` na pasta **Estudos em Casa · Provas** do Google Drive. O site lista os arquivos da pasta. O gabarito fica no servidor (Apps Script) e nunca vai para a tela da aluna.

```json
{
  "id": "2026-10-20-mat-divisao",        // único; sugestão: data-matéria-tema
  "titulo": "Divisão com resto",
  "materia": "Matemática",               // Português, Matemática, Ciências, História, Geografia, Inglês…
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

# Fonte Oculta — Sistema de Criação de Conteúdo (@afonteoculta)

> Este arquivo é lido automaticamente em toda nova conversa Claude nesta pasta.
> Contém tudo que o Claude precisa saber para operar o sistema completo.

---

## O QUE É ESTE PROJETO

Sistema automatizado de criação e publicação de carrosséis para o Instagram **@afonteoculta**.

O conteúdo segue o **Método Jordânico** — 10 slides com arco emocional dramático, preset visual `esoterico`, e CTA fixo "COMENTE FONTE" no slide 10.

Nicho: espiritualidade, epigenética, frequência, traumas, dinheiro, consciência.
Produto final: Tecnologia Sonora / Desbloqueio Neural (enviado no DM para quem comenta).

---

## PIPELINE COMPLETO — COMO CRIAR UM CARROSSEL

```
1. Criar carrossel-[tema].py  (baseado no carrossel-template.py)
2. python carrossel-[tema].py  →  gera slides no Desktop/carrossel-[tema]/
3. Dashboard: http://localhost:3131  →  botão INSTAGRAM publica no @afonteoculta
```

Para iniciar o dashboard:
```bash
cd C:/Users/julia/nano-banana-mcp/dashboard
node server.js
# Abre: http://localhost:3131
```

---

## ARQUIVOS PRINCIPAIS

### Geração de Carrosseis
| Arquivo | Função |
|---|---|
| `carrossel-template.py` | Template base — copiar para criar novo carrossel |
| `compose_util_v3.py` | Motor de composição visual v3 oficial (texto + imagem + layout + preset) |
| `prompt_builder.py` | Aplica DNA visual da marca ao prompt antes de enviar à API |
| `register_carousel.py` | Registra carrossel gerado no carousels.json |

### Publicação Instagram
| Arquivo | Função |
|---|---|
| `instagram_publisher.py` | Pipeline completo: Backblaze B2 upload → Meta API containers → publicar |
| `b2_uploader.py` | Upload de JPEGs/PNGs para Backblaze B2 e retorna URLs públicas (converte PNG→JPEG via Pillow) |
| `publish_instagram.py` | CLI chamado pelo dashboard (--id, --caption, --list) |

### Dashboard
| Arquivo | Função |
|---|---|
| `dashboard/server.js` | Servidor Node.js porta 3131 |
| `dashboard/public/index.html` | Frontend do dashboard (aba Carrosséis + aba Oráculo) |
| `dashboard/data/carousels.json` | Banco de dados de todos os carrosséis |
| `dashboard/data/oraculo_data.json` | Cache local de todos os 843 posts com métricas completas |

### Métricas (Oráculo Completo)
| Arquivo | Função |
|---|---|
| `oraculo_completo.py` | Busca TODOS os 843 posts + métricas via Meta API. Salva em oraculo_data.json |

Métricas coletadas por post: `likes`, `comments`, `reach`, `saved`, `shares`, `follows`, `total_interactions`, `engagement`

**ATENÇÃO:** `follows` só é retornado para posts do tipo FEED. Reels retornam 0 — limitação da Meta API.
O sync faz 2 requests por post (~8-10min para 843 posts). Rodar direto do terminal:
```bash
python oraculo_completo.py
```

### Carrosséis Gerados (recentes)
| Arquivo | Tema | Status |
|---|---|---|
| `carrossel-niceia.py` | Niceia e a Terceirização do Divino (Tema 6) | pronto |
| `carrossel-sal-escravo.py` | O Sal do Escravo — etimologia salário/servidão | gerado |
| `carrossel-design-pobreza.py` | O Design da Pobreza — SELIC R$756bi 2023 | gerado |
| `carrossel-dinheiro-que-foge.py` | O Dinheiro que Foge — memória de escassez | gerado |

---

## COMO CRIAR NOVO CARROSSEL

1. Copiar `carrossel-template.py` → `carrossel-[slug].py`
2. Preencher: `TEMA`, `TEMA_SLUG`, `FORMATO`, `CAPTION`, `NOTAS`
3. Preencher 10 slides seguindo o Método Jordânico:
   - S1 DISRUPÇÃO → S2 DESCIDA → S3 NOMEAÇÃO → S4 PROFUNDIDADE
   - S5 QUEDA FUNDA → S6 ESPELHO → S7 ASCENSÃO → S8 CRISTALIZAÇÃO
   - S9 SETUP CTA → S10 CTA FIXO (título sempre "COMENTE\nFONTE")
4. Todos os slides usam `layout: "fullbleed"` — **NÃO usar "card"** (removido do padrão visual)
5. S10 usa `layout: "fullbleed"` com portal dourado único por tema
6. Rodar: `python -X utf8 carrossel-[slug].py`

### Regras de prompt de imagem (IMPORTANTE)
- Escrever em inglês, descritivo e narrativo
- **Incluir figuras humanas** — obrigatório (não silhueta no vazio)
- Cores psicodélicas/esotéricas específicas — o `prompt_builder.py` adiciona o DNA visual automaticamente
- NÃO escrever "no text", "portrait", "4:5" — o prompt_builder já adiciona
- Cada slide deve ter identidade visual própria, não uniforme

### Modelo de geração de imagem
**OpenAI `gpt-image-2`** — modelo mais avançado disponível na conta
- Endpoint: `https://api.openai.com/v1/images/generations`
- Tamanho: `1024x1536` (portrait — redimensionado para 1080x1350 pelo compose_util)
- Output: `b64_json`
- Key: `OPENAI_API_KEY` no `.env`

---

## VARIÁVEIS DE AMBIENTE (.env)

```
OPENAI_API_KEY=...             # OpenAI — gpt-image-2 (geração de imagens)
GEMINI_API_KEY=...             # Gemini — legado, não usar para imagens novas
META_ACCESS_TOKEN=...          # System User Token — não expira
INSTAGRAM_ACCOUNT_ID=17841470086196558
FACEBOOK_PAGE_ID=582907918233766
```

O token `META_ACCESS_TOKEN` é um **System User Token** gerado via Meta Business Suite.
Não é token de usuário comum — não expira e tem permissões `instagram_content_publish` e `instagram_manage_insights`.

---

## FLUXO DE PUBLICAÇÃO INSTAGRAM

```
Dashboard → botão "INSTAGRAM" → publish_instagram.py --id carrossel-XX
  → instagram_publisher.py
    → b2_uploader.py  (faz upload dos slides, retorna URLs públicas)
    → Meta API POST /{IG_USER_ID}/media  (cria container por slide)
    → Meta API POST /{IG_USER_ID}/media  (cria container carrossel)
    → Meta API GET /{carousel_id}  (aguarda status FINISHED)
    → Meta API POST /{IG_USER_ID}/media_publish  (publica)
```

---

## SISTEMA DE DESIGN — REGRAS ATUAIS (atualizado 2026-06-13)

### compose_util_v3.py — DNA Visual
O arquivo `compose_util_v3.py` é o motor de composição v3 oficial. **NÃO mexer sem atualizar este doc.**

**Layouts / Modos disponíveis:**
| Layout / Modo | Uso | Alinhamento |
|---|---|---|
| `image` (fullbleed) | Padrão para todos os slides com imagem | **Esquerda Inteligente** |
| `text` | Fundo preto puro, sem imagem | Esquerda + barra de acento vertical |
| `card` | Imagem em card arredondado no topo + texto abaixo | Esquerda |

**Regras fixas de design (Modo `image` / Fullbleed):**
- **Alinhamento Inteligente à Esquerda:** O texto é alinhado à esquerda na margem `MARGIN_L` (72px) no rodapé. Isso cria uma coluna compacta no lado esquerdo do rodapé, deixando os personagens e o foco visual da ilustração (geralmente concentrados no centro/direita) completamente visíveis e limpos.
- **Gradiente de Rodapé Profundo:** O fundo do slide possui um gradiente de contraste preto ultra-profundo com transição para preto puro (`#000000`) na base, com opacidade máxima de 250, eliminando textos sobrepostos difíceis de ler.
- **Watermark:** Um único watermark `@afonteoculta` no canto superior esquerdo (26px, Inter Regular, cor do preset).
- **Canvas:** **1080 × 1350px** (proporção 4:5, imagens brutas recortadas de 1024×1536).
- **Tipografia:** Título (Franklin Gothic Heavy) | Corpo (Inter Regular) | Destaques `**texto**` (cor de acento do preset) | Itálicos `*texto*` (Inter Regular levemente itálico).

**Presets disponíveis:**
| Preset | Cores | Uso ideal |
|--------|-------|-----------|
| `manuscrito_sagrado` | Dourado antigo, warm | Espiritualidade, sagrado |
| `cinematografico` | Azul elétrico | Ciência, sistema |
| `cinematografico_crimson` | Vermelho confronto | Raiva, revelação |
| `esoterico_minimalista` | Roxo violeta | Padrão atual — todos os temas |
| `dramatico` | Preto intenso, ouro | Corpo, alavanca |
| `etereo_luminoso` | Âmbar luminoso | Espírito, amor |

---

## MÉTRICAS — ORÁCULO COMPLETO

```bash
python oraculo_completo.py              # sync completo (~8-10 min para 843 posts)
python oraculo_completo.py --report     # relatório no terminal
```

Endpoints do dashboard:
- `POST /api/oraculo/sync` — chama oraculo_completo.py (timeout: 5min — rodar direto se der timeout)
- `GET /api/oraculo/completo` — retorna oraculo_data.json

**Totais atuais (último sync 2026-04-28):**
- 843 posts | 3.68M likes | 298K comentários | 849K saves | 1.66M shares | 38.6M alcance | **24.189 seguidores ganhos**

---

## NOTAS TÉCNICAS

- **Encoding Windows**: todos os scripts incluem `sys.stdout.reconfigure(encoding="utf-8")` para evitar erro cp1252 com emojis
- **Slides de saída**: `Desktop/carrossel-[slug]/slide-01.jpg` até `slide-10.jpg`
- **Formato A**: caption mais revelação. **Formato B**: caption mais identificação/loop
- **Score do revisor**: sempre 15.0 (máximo) — revisão autônoma interna ao script

---

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **nano-banana-mcp** (9524 symbols, 18092 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "master"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/nano-banana-mcp/context` | Codebase overview, check index freshness |
| `gitnexus://repo/nano-banana-mcp/clusters` | All functional areas |
| `gitnexus://repo/nano-banana-mcp/processes` | All execution flows |
| `gitnexus://repo/nano-banana-mcp/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

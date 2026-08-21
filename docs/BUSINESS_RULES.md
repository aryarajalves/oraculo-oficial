# Regras de Negócio do Sistema (BUSINESS_RULES.md)

Este documento centraliza todas as decisões e diretrizes de negócio do Oráculo Manager, servindo como a única fonte de verdade para regras de domínio, integrações e comportamentos esperados.

---

## 1. Biblioteca de Referências Visuais e Assistente IA

### 1.1. Upload e Gestão de Imagens
- **Formatos Suportados:** Imagens nos formatos `image/jpeg`, `image/png`, `image/webp` e `image/gif`.
- **Armazenamento:** As imagens são gravadas com identificadores únicos para evitar conflitos de nomes. Ficam armazenadas no MinIO (`library/`) com fallback para o sistema de arquivos local (`backend/storage/library/`).
- **Acesso:** As imagens são servidas via endpoint autenticado `/api/library/:id/image`, suportando token via Header `Authorization: Bearer <token>` ou query param `?token=<token>` para renderização de tags `<img>`.
- **Deleção:** A exclusão de uma imagem da biblioteca remove o registro do banco de dados e apaga o arquivo físico correspondente. Modais de confirmação devem seguir o padrão estrito (backdrop escuro, sem fechar por clique externo, apenas 1 botão de fechar/cancelar além da ação).

### 1.2. Assistente de Criação IA com Referências
- **Seleção de Referências:** O usuário pode selecionar imagens clicando no botão circular de seleção dos cards da galeria ou digitando `@` no input do chat para abrir o menu de autocomplete.
- **Enriquecimento de Prompt:** Quando há referências ativas selecionadas, o assistente analisa as características visuais (estilo, composição, paleta, personagens) e funde as instruções do usuário em um prompt visual final detalhado.
- **Geração de Imagens:** Utiliza o provedor de imagem configurado no sistema (`ACTIVE_IMAGE_PROVIDER` / OpenAI / `gpt-image-2`).
- **Histórico e Persistência:** As conversas e imagens geradas no assistente são salvas no PostgreSQL associadas ao e-mail do usuário autenticado. O botão "Limpar" reseta a conversa atual.

---

## 2. Permissões de Acesso por Página
- Cada usuário ou convite possui um mapa de permissões com status `liberado`, `em_breve` ou `bloqueado`.
- Páginas controladas: `carrosseis`, `criador`, `calendario`, `biblioteca`, `financeiro`, `reels`, `fabrica`, `oraculo`, `radar`.
- Super Admin possui acesso total permanente e irrestrito.

---

## 3. Gestão Financeira e Custos de Carrosséis
- **Cotação de Câmbio Base:** 1 USD = R$ 5,00 (Parâmetro fixo definido pelo usuário: 1 dólar é igual a 5 reais).
- **Custos de Imagem por Provedor:**
  - OpenAI GPT Image 2 / DALL-E 3: $0.08 por imagem gerada via API.
  - Flux Schnell (via Fal): $0.003 por imagem gerada via API.
  - Google Imagen 3 (Gemini): $0.015 por imagem gerada via API.
  - GPT Image Mini / DALL-E 2: $0.020 por imagem gerada via API.
- **Slides Gratuitos (Text-Only):** Slides com layout tipográfico sem imagem gerada via API são computados com custo R$ 0,00 e contabilizados no indicador de **Economia Gerada**.
- **Métricas:** O painel consolida Custo Total (BRL/USD), Economia Gerada, Custo Médio por Carrossel, Custo Médio por Slide Pago, e Distribuição Percentual por Provedor de IA.

---

## 4. Perguntas em Aberto

- [ ] [NOVO] Qual o limite máximo desejado para tamanho de upload por imagem na Biblioteca (ex: 20MB)?
- [ ] [NOVO] Deseja limitar o número máximo de imagens de referência selecionadas simultaneamente no chat (ex: até 5 referências)?
- [x] Deseja tornar a taxa de câmbio USD -> BRL configurável dinamicamente através da aba de Configurações, ou manter o valor fixo base?
  - *Resposta do Usuário:* Utilizar o parâmetro fixo de 1 dólar = 5 reais (1 USD = R$ 5,00).
- [ ] [NOVO] Deseja que a aba Financeiro inclua no futuro os custos de outras ferramentas (ex: assistente de referências da Biblioteca ou clonador de Reels)?


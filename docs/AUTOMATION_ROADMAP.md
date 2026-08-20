# Roadmap de Automações e Qualidade — Oráculo

Este documento serve como um guia de melhorias de infraestrutura de testes, automação e qualidade de código que podemos implementar ao longo do tempo no projeto Oráculo.

---

## 🚀 Fase 1: Análise Estática e Qualidade de Código (Concluído ✅)
* [x] **Configurar Ruff no Backend:** Linter e formatador ultrarápido para toda a base de código Python.
* [x] **Configurar ESLint no Backend:** Validação de erros comuns e variáveis mortas nos arquivos JavaScript/Node.js do Dashboard.
* [x] **Configurar ESLint no Frontend:** Validação de boas práticas, hooks e sintaxe em React + Vite.
* [x] **Adicionar Regra de Execução:** Instruções documentadas no `CLAUDE.md` e regras de commit exigindo a passagem dos linters.

---

## 🤖 Fase 2: Testes de Ponta a Ponta (E2E) com Playwright
Criar robôs simulados para testar o comportamento visual e funcional do Dashboard no navegador.
* [ ] **Fluxo de Autenticação:** Teste automatizado que tenta fazer login com a credencial padrão e valida se o dashboard carrega.
* [ ] **Fluxo de Criação de Carrossel:** Simular o preenchimento de briefing de carrossel, envio à fila e validação de que não houve erro na tela.
* [ ] **Gerenciamento de Usuários:** Validar fluxos de criação de novos convites, edição e deleção de usuários administrativos.
* [ ] **Prevenção de Tela Branca:** Teste de fumaça que acessa todas as abas principais e garante que nenhuma crasha com tela branca.

---

## 📈 Fase 3: Monitoramento de Erros Ativo (Sentry)
Integrar um painel de monitoramento ativo para detectar erros em tempo real no servidor e no navegador do usuário final.
* [ ] **Configuração do Sentry SDK no Backend (Node/Python):** Capturar erros 500 no Express e exceções não tratadas em scripts Python.
* [ ] **Configuração do Sentry no Frontend (React):** Capturar crashes de renderização causados por dados inesperados vindos das APIs.
* [ ] **Integração de Notificações:** Enviar alertas de erro ricos em detalhes direto para o Telegram, Discord ou Slack do desenvolvedor.

---

## ⚙️ Fase 4: Integração Contínua (CI) no GitHub Actions
Automação de testes a cada atualização enviada para a nuvem.
* [ ] **Criar workflow `.github/workflows/ci.yml`:** Roda toda vez que houver um `git push` ou Pull Request.
* [ ] **Automação de Linters no CI:** Rodar `ruff` e `eslint` no servidor do GitHub e rejeitar commits com erros.
* [ ] **Automação de Testes Unitários no CI:** Rodar toda a suite de testes locais e reportar se houver alguma quebra de funcionalidade.

---

## 🎨 Fase 5: Regressão Visual Automatizada
Garantir que atualizações visuais ou de CSS não quebrem o design system "Premium" estabelecido.
* [ ] **Snapshot Baseline:** Gerar capturas de tela das páginas perfeitas para servirem como base estável.
* [ ] **Comparação de Layout:** Automatizar testes do Playwright que comparam o layout atual com o baseline a cada modificação visual de CSS/HTML.

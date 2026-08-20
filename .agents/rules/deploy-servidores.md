---
trigger: always_on
---

# Regra de Deploy e Webhooks Multi-Servidor (Portainer)

Toda vez que o usuário solicitar no chat a atualização de um ou mais servidores (ex: "atualize o servidor Haucacau", "atualize todos os servidores", "faça deploy no cliente X"), o agente deve orquestrar a execução através dos Webhooks do Portainer configurados no GitHub Actions.

**Protocolo Obrigatório:**

1. **Mapeamento de Nomes:**
   - O usuário pode se referir aos servidores pelo nome cadastrado no GitHub Secrets com o prefixo `WEBHOOK_` (ex: `WEBHOOK_HAUCAU`, `WEBHOOK_OFICIAL`, `WEBHOOK_TESTES`).
   - Se o usuário pedir para atualizar um servidor específico (ex: *"Haucacau"*), o agente deve acionar o target correspondente (`HAUCAU`).
   - Se o usuário pedir *"todos"*, o agente deve acionar o target `ALL`.

2. **Disparo do Deploy:**
   - O agente pode disparar o workflow [`.github/workflows/deploy.yml`](file:///c:/Users/aryar/.gemini/antigravity/scratch/Projetos%20Serios/Oraculo%20-%20Manager/.github/workflows/deploy.yml) via GitHub CLI (`gh workflow run deploy.yml -f target="<ALVO>"`) ou instruir/confirmar o disparo para o usuário.

3. **Confirmação e Relatório:**
   - O agente deve sempre confirmar quais servidores estão sendo atualizados e reportar o resultado com clareza em português do Brasil.

4. **Rollback:**
   - Em caso de rollback solicitado pelo usuário, o agente deve orientar ou acionar a re-execução da versão anterior desejada no Portainer/Docker Hub.

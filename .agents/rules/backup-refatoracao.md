---
trigger: always_on
---

# Regra de Backup Prévio para Refatoração

Toda vez que você for realizar uma refatoração estrutural, modularização ou divisão de código em arquivos existentes (seja no Backend ou Frontend), é obrigatório criar uma cópia de segurança (backup) do arquivo original antes de aplicar qualquer alteração.

**Protocolo Obrigatório:**

1. **Criação de Cópia de Segurança:** Antes de modificar, extrair ou substituir o arquivo a ser refatorado, crie uma cópia de segurança contendo a versão original intacta (ex: `caminho/do/arquivo.original.bak`, `caminho/do/arquivo.bak.jsx` ou na pasta `_backups/`).
2. **Proteção no .gitignore:** Todo padrão de backup (`*.bak`, `*.backup`, `*.orig`, `*.original.*`, `*.bak.*`, `_backups/`, `backups/`) está configurado no `.gitignore` para garantir que arquivos de backup nunca sejam versionados ou commitados no repositório.
3. **Notificação ao Usuário:** Informe explicitamente na sua resposta que o backup do arquivo foi realizado antes do início das modificações.
4. **Validação Pós-Refatoração:** Conclua a refatoração seguindo as regras de modularização, linters e testes E2E. O backup serve como ponto seguro de restauração (rollback) caso qualquer regressão seja detectada durante os testes.
5. **Limpeza Responsável:** Backups temporários que fiquem dentro das pastas de código fonte (`frontend/src/` ou `backend/`) só devem ser removidos ou arquivados após a confirmação de que todos os testes foram aprovados e a funcionalidade está 100% íntegra.

Isso garante que refatorações complexas nunca resultem em perda de código ou comportamentos históricos do sistema, e que arquivos temporários não poluam o repositório.

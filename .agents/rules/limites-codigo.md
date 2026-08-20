---
trigger: always_on
---

# Regra de Limites de Código (Clean Code)

Para garantir que o projeto permaneça manutenível e que o agente consiga processar os arquivos sem perder o contexto, estabelecemos limites rígidos de tamanho de arquivo.

**Limites Obrigatórios:**
1. **Backend (Python):** Nenhum arquivo deve ultrapassar **1.000 linhas**.
2. **Frontend (React, JSX, JS, TS, TSX e CSS):** Nenhum arquivo deve ultrapassar **500 linhas**.

**Ações ao atingir o limite:**
- Se uma nova funcionalidade for fazer um arquivo ultrapassar esses limites, você **DEVE** realizar a modularização (quebra do arquivo) antes de prosseguir com a implementação.
- Priorize a extração de componentes (frontend) e serviços/utilitários (backend) para arquivos separados.

Isso evita a criação de "Arquivos Monolíticos" que são difíceis de testar e debugar.

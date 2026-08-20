---
trigger: always_on
---

# Regra de Padrão de Commits (Conventional Commits)

Todas as mensagens de commit devem seguir o padrão **Conventional Commits** para manter o histórico legível e facilitar o rastreamento de bugs em produção.

**Formato obrigatório:**
```
<tipo>: <descrição curta em português>
```

**Tipos permitidos:**
| Tipo | Quando usar |
|------|-------------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `chore` | Atualização de deps, configs, scripts sem impacto no usuário |
| `refactor` | Refatoração sem mudança de comportamento |
| `style` | Ajustes visuais/CSS sem mudança de lógica |
| `docs` | Alterações em documentação ou regras de agente |
| `test` | Adição ou correção de testes |

**Exemplos corretos:**
```
feat: adicionar envio de áudio em grupos
fix: corrigir toast de plano insuficiente no mobile
chore: atualizar dependências do backend
refactor: extrair WaStatusContext do App.jsx
style: ajustar cores do badge PRO/LITE no sidebar
docs: adicionar regra de gerenciamento de estado
test: adicionar teste de rota de revogar mensagem
```

**Exemplos incorretos (proibidos):**
```
ajuste
fix bug
testando
alteração
wip
```

**Idioma obrigatório: Português do Brasil**
- O título do commit **deve** estar em português do Brasil.
- A descrição do corpo (quando necessária) **deve** estar em português do Brasil.
- Nunca escrever mensagens de commit em inglês ou qualquer outro idioma.

**Regras adicionais:**
1. Descrição em letras minúsculas, sem ponto final.
2. Máximo de 72 caracteres na linha do título.
3. Se a mudança for grande, adicione um corpo explicativo após uma linha em branco, também em português.
4. Nunca use "WIP" como commit final — finalize antes de commitar.

## Validação de Qualidade e Testes (Obrigatório)

Antes de realizar qualquer commit e, obrigatoriamente, antes de atualizar o repositório no GitHub (Push):
1. **Sempre rodar os linters** para identificar bugs, variáveis mortas ou código quebrado.
2. **Ao realizar refatorações de código (`refactor:`)**, você deve obrigatoriamente rodar a suíte de testes E2E para confirmar que a integridade e funcionamento do sistema não foram afetados.
3. **Ao criar novas mecânicas, código novo ou atualizar trechos existentes**, você deve executar a verificação de linting e rodar os testes correspondentes.

**Comandos de Validação:**
- **Varredura de Vulnerabilidades (Frontend & Backend):** `npm run security:check`
- **Linter Python (Backend):** `docker exec oraculo_backend ruff check .`
- **Linter Node.js (Backend):** `docker exec oraculo_backend npm --prefix backend run lint`
- **Linter React (Frontend):** `npm --prefix frontend run lint`
- **Testes E2E (Dashboard):** `docker exec oraculo_backend npm --prefix backend run test:e2e`

---

## Envio para o GitHub (Git Push)

- O agente **NUNCA** deve executar comandos de envio para o repositório remoto (ex: `git push`) de forma automática ou autônoma.
- O `git push` só é permitido se o usuário pedir explicitamente para enviar as alterações para o GitHub (ex: "envie para o github", "faça push no master", "suba as atualizações"). Caso contrário, limite-se a commitar localmente.
- **Versionamento da Imagem Docker:** Antes de realizar qualquer `git push` que acione o build de imagem Docker, o agente **DEVE OBRIGATORIAMENTE** perguntar ao usuário qual será o número da versão da imagem (conforme regra `versao-docker-hub.md`), atualizar o `package.json` com essa versão e só então realizar o envio.
- **Importante:** A validação dos linters e a varredura de vulnerabilidades de segurança (`npm run security:check`) listados acima devem estar 100% livres de erros antes de qualquer envio. O hook pre-push do Git bloqueará automaticamente o push caso existam vulnerabilidades críticas/altas.


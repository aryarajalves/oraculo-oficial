# 📖 Guia de Configuração: Webhooks do Portainer no GitHub Secrets

Este guia mostra como pegar os Webhooks nos seus servidores Portainer e cadastrá-los no GitHub com nomes amigáveis para atualização automática via Chat.

---

## 🎯 1. Pegar o Webhook no Portainer (Em cada Servidor)

1. Acesse o **Portainer** do servidor.
2. No menu lateral esquerdo, clique em **`Services`** (Serviços).
3. Clique no serviço da aplicação (ex: `oraculo_oraculo` ou `oraculo`).
4. Role até a seção **Service Webhook**.
5. Ative a chave: **`Create a service webhook`** (deixe em **ON**).
6. Clique no botão azul **`Copy link`**.

---

## 🔑 2. Cadastrar no GitHub Secrets

1. Acesse o seu repositório no GitHub: `https://github.com/aryarajalves/oraculo-oficial`
2. Vá em **Settings** > **Secrets and variables** > **Actions** > **New repository secret**.
3. Crie os secrets usando o prefixo **`WEBHOOK_`** seguido do nome do servidor:

| Nome do Secret | Valor (URL do Portainer) | Exemplo de Uso no Chat |
| :--- | :--- | :--- |
| **`WEBHOOK_HAUCAU`** | `https://painelhaucau.../api/webhooks/...` | *"Atualize o servidor Haucacau"* |
| **`WEBHOOK_OFICIAL`** | `https://oraculo-oficial.../api/webhooks/...` | *"Atualize o servidor Oficial"* |
| **`WEBHOOK_TESTES`** | `https://teste.../api/webhooks/...` | *"Atualize o servidor de Testes"* |
| **`WEBHOOK_CLIENTE_A`** | `https://clienteA.../api/webhooks/...` | *"Atualize o Cliente A"* |

---

## 💬 3. Como Disparar pelo Chat

Uma vez cadastrados os secrets, basta me dizer no chat:
- *"Atualize o servidor Haucacau para a versão 1.1.4"*
- *"Atualize todos os servidores agora"*

O GitHub Actions chamará os Webhooks correspondentes e o Portainer atualizará a aplicação na hora! 🚀

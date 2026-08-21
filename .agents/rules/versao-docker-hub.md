---
trigger: always_on
---

# Regra de Versionamento de Imagens Docker (Docker Hub & CI/CD)

Toda vez que for realizar uma atualização no repositório remoto (GitHub) que vá disparar o build e publicação de imagens Docker no Docker Hub, o agente **DEVE OBRIGATORIAMENTE** perguntar ao usuário qual será o número da versão da imagem antes de executar o push.

**Protocolo Obrigatório:**

1. **Consulta Prévia ao Usuário:** Nunca assuma ou incremente a versão da imagem Docker de forma automática. Pergunte explicitamente ao usuário:
   > *"Qual versão você deseja definir para a imagem Docker desta atualização (ex: 1.1.3, 1.2.0)?"*

2. **Repositório Único no Docker Hub:** A imagem Docker deve ser gerada **estritamente e unicamente** no repositório principal `<usuario>/oraculo`. Nunca criar ou publicar no repositório `oraculo-worker`.

3. **Tag Estrita (Sem Extras):** A imagem publicada deve conter **apenas e exclusivamente** a tag da versão fornecida pelo usuário (ex: `aryalvesfernandes/oraculo:1.1.3`).
   - ❌ **Proibido:** Tag `latest`.
   - ❌ **Proibido:** Tag de commit SHA (números longos aleatórios).

4. **Persistência da Última Versão Usada:** Após o usuário informar a versão, o agente deve salvar a versão em:
   - `package.json` (raiz e backend) na propriedade `"version"`.
   - `VERSION` na raiz do projeto contendo o número da última versão implantada.

5. **Atualizações de Código sem Build Docker (Skip Docker):** Se o usuário desejar atualizar apenas o repositório GitHub sem gerar nova imagem Docker (ex: ajustes de documentação, README, testes ou código intermediário), adicione a flag `[skip docker]` na mensagem do commit. O pipeline do GitHub Actions validará os testes mas não fará o build nem o deploy de imagem Docker.

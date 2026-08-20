---
trigger: always_on
---

# Regra de Versionamento de Imagens Docker (Docker Hub & CI/CD)

Toda vez que for realizar uma atualização no repositório remoto (GitHub) que vá disparar o build e publicação de imagens Docker no Docker Hub, o agente **DEVE OBRIGATORIAMENTE** perguntar ao usuário qual será o número da versão da imagem antes de executar o push.

**Protocolo Obrigatório:**

1. **Consulta Prévia ao Usuário:** Nunca assuma ou incremente a versão da imagem Docker de forma automática. Pergunte explicitamente ao usuário:
   > *"Qual versão você deseja definir para a imagem Docker desta atualização (ex: 1.1.3, 1.2.0)?"*

2. **Proibição da Tag `latest`:** **NUNCA** gerar ou publicar a tag `latest`. A imagem Docker deve ser tagueada **estritamente** com a versão fornecida pelo usuário (ex: `1.1.3`) e o `<commit-sha>`.

3. **Persistência da Última Versão Usada:** Após o usuário informar a versão, o agente deve salvar a versão em:
   - `package.json` (raiz e backend) na propriedade `"version"`.
   - `VERSION` na raiz do projeto contendo o número da última versão implantada.

4. **Tags Geradas no Docker Hub:** A imagem publicada deve conter apenas:
   - `<usuario>/oraculo:<versao-informada>` (ex: `aryalvesfernandes/oraculo:1.1.3`)
   - `<usuario>/oraculo:<commit-sha>` (para rastreabilidade)

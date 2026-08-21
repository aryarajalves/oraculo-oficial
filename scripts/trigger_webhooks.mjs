#!/usr/bin/env node
/**
 * scripts/trigger_webhooks.mjs
 * 
 * Executa o acionamento de Webhooks do Portainer nos servidores configurados
 * de forma segura e transparente.
 */

import { execSync } from 'child_process';

const envVars = process.env;
const webhookKeys = Object.keys(envVars).filter(k => k.startsWith('WEBHOOK_') && envVars[k]);

console.log('════════════════════════════════════════════════════════════════════');
console.log('  🚀 ACIONAMENTO DE WEBHOOKS — PORTAINER MULTI-SERVIDOR');
console.log('════════════════════════════════════════════════════════════════════\n');

if (webhookKeys.length === 0) {
  console.log('ℹ️ Nenhum secret com prefixo WEBHOOK_ configurado nesta execução.');
  process.exit(0);
}

console.log(`🎯 ${webhookKeys.length} servidor(es) encontrado(s) para atualização:\n`);

let hasErrors = false;

for (const key of webhookKeys) {
  const serverName = key.replace('WEBHOOK_', '');
  const url = envVars[key];

  if (!url || !url.startsWith('http')) {
    console.log(`⚠️ [ ${serverName} ] URL inválida ou vazia, pulando.`);
    continue;
  }

  console.log(`📡 Notificando Portainer de [ ${serverName} ]...`);

  try {
    const cmd = `curl -s -o /dev/null -w "%{http_code}" -X POST "${url}"`;
    const statusCode = execSync(cmd).toString().trim();

    if (statusCode === '200' || statusCode === '204' || statusCode === '202') {
      console.log(`✅ [ ${serverName} ] Atualização aceita pelo Portainer! (HTTP ${statusCode})`);
    } else {
      console.log(`⚠️ [ ${serverName} ] Portainer respondeu com código HTTP: ${statusCode}`);
    }
  } catch (err) {
    console.error(`❌ [ ${serverName} ] Erro ao chamar Webhook:`, err.message);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.log('\n⚠️ Algumas notificações falharam.');
} else {
  console.log('\n🎉 Todos os Webhooks foram acionados com sucesso!');
}

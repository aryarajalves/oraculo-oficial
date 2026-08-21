#!/usr/bin/env node
/**
 * scripts/trigger_webhooks.mjs
 * 
 * Executa o acionamento de Webhooks do Portainer nos servidores configurados
 * com suporte a SSL flexível (-k), redirecionamentos (-L) e logs detalhados.
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
  const url = envVars[key].trim();

  if (!url || !url.startsWith('http')) {
    console.log(`⚠️ [ ${serverName} ] URL inválida ou vazia, pulando.`);
    continue;
  }

  console.log(`📡 Notificando Portainer de [ ${serverName} ]...`);

  try {
    // Flags do curl:
    // -k: Aceita certificados SSL auto-assinados / Cloudflare / Let's Encrypt
    // -L: Segue redirecionamentos HTTP -> HTTPS
    // --max-time 45: Timeout de 45 segundos
    // -sS: Silencioso mas exibe mensagens de erro caso falhe
    const cmd = `curl -k -L --max-time 45 -sS -o /dev/null -w "%{http_code}" -X POST "${url}"`;
    const statusCode = execSync(cmd).toString().trim();

    if (statusCode === '200' || statusCode === '204' || statusCode === '202') {
      console.log(`✅ [ ${serverName} ] Atualização aceita com sucesso pelo Portainer! (HTTP ${statusCode})`);
    } else {
      console.log(`⚠️ [ ${serverName} ] Portainer respondeu com código HTTP: ${statusCode}`);
    }
  } catch (err) {
    console.error(`❌ [ ${serverName} ] Erro de conexão ao tentar chamar o Webhook:`);
    console.error(err.message);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.log('\n⚠️ Algumas notificações falharam. Verifique os detalhes acima.');
} else {
  console.log('\n🎉 Todos os Webhooks foram acionados com sucesso!');
}

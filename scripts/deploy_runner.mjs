#!/usr/bin/env node
/**
 * scripts/deploy_runner.mjs
 * 
 * Script auxiliar para acionar deploys e webhooks de múltiplos servidores
 * diretamente via CLI / GitHub Actions.
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
const target = (args[0] || 'ALL').toUpperCase();

console.log('════════════════════════════════════════════════════════════════════');
console.log('  🚀 ORÁCULO — DISPARADOR DE DEPLOY MULTI-SERVIDOR (PORTAINER)');
console.log('════════════════════════════════════════════════════════════════════\n');
console.log(`🎯 Alvo do Deploy: ${target}`);

try {
  console.log('\n📡 Disparando workflow de deploy no GitHub Actions...');
  const cmd = `gh workflow run deploy.yml -f target="${target}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('\n✅ Workflow de deploy disparado com sucesso no GitHub Actions!');
} catch (err) {
  console.log('\nℹ️ Nota: GitHub CLI não autenticado localmente. O deploy pode ser acionado diretamente pelo chat ou pela aba Actions do GitHub.');
}

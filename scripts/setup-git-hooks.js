#!/usr/bin/env node
/**
 * scripts/setup-git-hooks.js
 * 
 * Instala o hook pre-push do Git para garantir que a varredura
 * de vulnerabilidades seja executada antes de qualquer `git push`.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const HOOKS_DIR = path.join(ROOT_DIR, '.git', 'hooks');

const prePushScript = `#!/bin/sh
# Git Pre-Push Hook — Oráculo Security Auditor
echo ""
echo "🛡️  [Git Pre-Push] Executando varredura de vulnerabilidades antes de enviar ao GitHub..."
echo ""

node scripts/security_audit.mjs --pre-push
RESULT=$?

if [ $RESULT -ne 0 ]; then
  echo ""
  echo "⛔ [Git Pre-Push] Push cancelado! Corrija as vulnerabilidades críticas/altas ou execute 'npm run security:fix'."
  echo ""
  exit 1
fi

echo "✅ [Git Pre-Push] Varredura de segurança aprovada. Prosseguindo com o push..."
exit 0
`;

function installHooks() {
  if (!fs.existsSync(HOOKS_DIR)) {
    console.log('⚠️  Pasta .git/hooks não encontrada. Ignorando instalação de hooks.');
    return;
  }

  const hookPath = path.join(HOOKS_DIR, 'pre-push');
  fs.writeFileSync(hookPath, prePushScript, { mode: 0o755, encoding: 'utf-8' });
  console.log(`✅ Hook pre-push instalado com sucesso em: ${hookPath}`);
}

installHooks();

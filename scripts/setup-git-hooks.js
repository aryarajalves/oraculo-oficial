#!/usr/bin/env node
/**
 * scripts/setup-git-hooks.js
 * 
 * Instala os hooks do Git:
 *  - pre-commit: Executa a auditoria de limites de código e testes unitários antes do commit.
 *  - pre-push: Executa a validação completa e auditoria de vulnerabilidades antes do push.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const HOOKS_DIR = path.join(ROOT_DIR, '.git', 'hooks');

const preCommitScript = `#!/bin/sh
# Git Pre-Commit Hook — Oráculo Automated Quality & Test Runner
echo ""
echo "🔍 [Git Pre-Commit] Executando validações automáticas de qualidade e testes..."
echo ""

node scripts/test_runner.mjs
RESULT=$?

if [ $RESULT -ne 0 ]; then
  echo ""
  echo "⛔ [Git Pre-Commit] Commit bloqueado! Corrija os erros ou limites de código antes de commitar."
  echo ""
  exit 1
fi

echo "✅ [Git Pre-Commit] Todas as validações foram aprovadas. Realizando commit..."
exit 0
`;

const prePushScript = `#!/bin/sh
# Git Pre-Push Hook — Oráculo Security & Full Test Suite
echo ""
echo "🛡️  [Git Pre-Push] Executando suíte completa de testes e auditoria de segurança..."
echo ""

node scripts/test_runner.mjs --full
RESULT=$?

if [ $RESULT -ne 0 ]; then
  echo ""
  echo "⛔ [Git Pre-Push] Push cancelado! Existem testes falhando ou vulnerabilidades críticas/altas."
  echo ""
  exit 1
fi

echo "✅ [Git Pre-Push] Varredura e testes 100% aprovados. Prosseguindo com o push..."
exit 0
`;

function installHooks() {
  if (!fs.existsSync(HOOKS_DIR)) {
    console.log('⚠️  Pasta .git/hooks não encontrada. Ignorando instalação de hooks.');
    return;
  }

  // 1. Instala pre-commit
  const preCommitPath = path.join(HOOKS_DIR, 'pre-commit');
  fs.writeFileSync(preCommitPath, preCommitScript, { mode: 0o755, encoding: 'utf-8' });
  console.log(`✅ Hook pre-commit instalado com sucesso em: ${preCommitPath}`);

  // 2. Instala pre-push
  const prePushPath = path.join(HOOKS_DIR, 'pre-push');
  fs.writeFileSync(prePushPath, prePushScript, { mode: 0o755, encoding: 'utf-8' });
  console.log(`✅ Hook pre-push instalado com sucesso em: ${prePushPath}`);
}

installHooks();

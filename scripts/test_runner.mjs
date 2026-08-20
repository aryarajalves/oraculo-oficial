#!/usr/bin/env node
/**
 * scripts/test_runner.mjs
 * 
 * Executor Unificado de Testes e Validações do Oráculo.
 * Executa de forma estruturada:
 *  1. Limites de Código (Clean Code: Frontend/CSS <= 500 linhas, Backend <= 1000 linhas)
 *  2. Testes Unitários do Backend (Pytest)
 *  3. Verificação de Compilação / Build do Frontend (Vite)
 *  4. Auditoria de Segurança (Opcional ou com flag --full)
 */

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// Utilitários de Cores
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const printHeader = (title) => {
  console.log(`\n${colors.cyan}${colors.bright}================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}================================================================${colors.reset}\n`);
};

const runStep = (name, command, args, cwd = ROOT_DIR) => {
  const startTime = Date.now();
  process.stdout.write(`⏳ ${colors.bright}${name}...${colors.reset} `);

  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf-8',
    shell: true,
    env: process.env,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (result.status === 0) {
    console.log(`${colors.green}✓ PASSOU${colors.reset} ${colors.dim}(${duration}s)${colors.reset}`);
    return { name, passed: true, duration, output: result.stdout };
  } else {
    console.log(`${colors.red}✗ FALHOU${colors.reset} ${colors.dim}(${duration}s)${colors.reset}`);
    if (result.stdout) console.log(`${colors.dim}${result.stdout.trim()}${colors.reset}`);
    if (result.stderr) console.log(`${colors.red}${result.stderr.trim()}${colors.reset}`);
    return { name, passed: false, duration, error: result.stderr || result.stdout };
  }
};

async function main() {
  const args = process.argv.slice(2);
  const isFull = args.includes('--full') || args.includes('-f');
  const onlyLimits = args.includes('--limits');
  const onlyUnit = args.includes('--unit');
  const onlyBuild = args.includes('--build');

  printHeader('ORÁCULO — EXECUTOR UNIFICADO DE TESTES');

  const results = [];
  const overallStart = Date.now();

  // 1. Limites de Código (Clean Code)
  if (!onlyUnit && !onlyBuild) {
    const limitsRes = runStep(
      'Auditoria de Limites de Código (Frontend, CSS e Backend)',
      'pytest',
      ['backend/tests/test_code_limits.py', '-q']
    );
    results.push(limitsRes);
    if (onlyLimits) return printSummary(results, overallStart);
  }

  // 2. Testes Unitários de Refatoração
  if (!onlyLimits && !onlyBuild) {
    const unitRes = runStep(
      'Suíte de Testes Unitários (Módulos e Conformidade)',
      'pytest',
      [
        'backend/tests/test_dashboard_refactor.py',
        'backend/tests/test_pipeline_modal_refactor.py',
        'backend/tests/test_edit_slide_modal_refactor.py',
        'backend/tests/test_logs_viewer_refactor.py',
        '-q'
      ]
    );
    results.push(unitRes);
    if (onlyUnit) return printSummary(results, overallStart);
  }

  // 3. Validação de Compilação do Frontend (Vite)
  if (!onlyLimits && !onlyUnit) {
    const buildRes = runStep(
      'Build e Validação de Módulos (Vite Frontend)',
      'npm',
      ['run', 'build'],
      path.join(ROOT_DIR, 'frontend')
    );
    results.push(buildRes);
    if (onlyBuild) return printSummary(results, overallStart);
  }

  // 4. Auditoria de Segurança (se flag --full)
  if (isFull) {
    const secRes = runStep(
      'Auditoria de Segurança de Dependências (NPM Audit)',
      'node',
      ['scripts/security_audit.mjs']
    );
    results.push(secRes);
  }

  printSummary(results, overallStart);
}

function printSummary(results, overallStart) {
  const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(2);
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const allPassed = passedCount === totalCount;

  console.log(`\n${colors.bright}────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.bright}  RESUMO DA EXECUÇÃO:${colors.reset}`);
  console.log(`  Total de Etapas:  ${totalCount}`);
  console.log(`  Aprovadas:        ${colors.green}${passedCount}${colors.reset}`);
  console.log(`  Falhas:           ${allPassed ? '0' : `${colors.red}${totalCount - passedCount}${colors.reset}`}`);
  console.log(`  Tempo Total:      ${totalDuration}s`);
  console.log(`${colors.bright}────────────────────────────────────────────────────────────────${colors.reset}`);

  if (allPassed) {
    console.log(`\n${colors.green}${colors.bright}🎉 TODOS OS TESTES E VALIDAÇÕES FORAM APROVADOS COM SUCESSO!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bright}❌ ALGUNS TESTES FALHARAM. VERIFIQUE OS LOGS ACIMA.${colors.reset}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Erro inesperado no executor de testes:', err);
  process.exit(1);
});

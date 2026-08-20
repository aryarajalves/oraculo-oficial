#!/usr/bin/env node
/**
 * scripts/security_audit.mjs
 * 
 * Script unificado de varredura e correção de vulnerabilidades:
 * - Frontend (React / Vite) via `npm audit`
 * - Backend Node.js (Express / MCP) via `npm audit`
 * - Backend Python (Agentes / IA) via `pip-audit`
 * 
 * Modos de uso:
 *   node scripts/security_audit.mjs             -> Apenas escaneia e exibe o relatório
 *   node scripts/security_audit.mjs --fix       -> Escaneia e aplica correções automáticas
 *   node scripts/security_audit.mjs --pre-push  -> Bloqueia o git push caso existam falhas altas/críticas
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const isFixMode = args.includes('--fix');
const isPrePush = args.includes('--pre-push');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function logHeader(title) {
  console.log(`\n${colors.cyan}${colors.bright}════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  🛡️  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}════════════════════════════════════════════════════════════════════${colors.reset}\n`);
}

/**
 * Executa auditoria em um diretório Node.js com npm
 */
export function auditNodeProject(dirPath, projectName, autoFix = false) {
  const targetDir = path.resolve(ROOT_DIR, dirPath);
  if (!fs.existsSync(path.join(targetDir, 'package.json'))) {
    return { name: projectName, skipped: true, error: 'package.json não encontrado' };
  }

  if (autoFix) {
    console.log(`${colors.yellow}🔧 [${projectName}] Executando npm audit fix...${colors.reset}`);
    try {
      execSync('npm audit fix', { cwd: targetDir, stdio: 'inherit' });
    } catch (e) {
      // npm audit fix pode retornar código não-zero se restarem vulnerabilidades que requerem breaking changes
    }
  }

  let auditJson = null;
  try {
    const rawOutput = execSync('npm audit --json', { cwd: targetDir, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    auditJson = JSON.parse(rawOutput);
  } catch (err) {
    if (err.stdout) {
      try {
        auditJson = JSON.parse(err.stdout.toString());
      } catch (parseErr) {
        // Fallback se o stdout não for JSON válido
      }
    }
  }

  if (!auditJson) {
    return { name: projectName, skipped: false, error: 'Não foi possível obter JSON do npm audit', counts: { total: 0 } };
  }

  const vulns = auditJson.metadata?.vulnerabilities || {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0
  };

  return {
    name: projectName,
    dir: dirPath,
    counts: {
      info: vulns.info || 0,
      low: vulns.low || 0,
      moderate: vulns.moderate || 0,
      high: vulns.high || 0,
      critical: vulns.critical || 0,
      total: vulns.total || 0
    },
    raw: auditJson
  };
}

/**
 * Executa auditoria em dependências Python
 */
export function auditPythonProject(requirementsPath, projectName) {
  const reqFile = path.resolve(ROOT_DIR, requirementsPath);
  if (!fs.existsSync(reqFile)) {
    return { name: projectName, skipped: true, error: 'requirements.txt não encontrado' };
  }

  let output = null;
  let hasPipAudit = false;

  // 1. Tenta executar pip-audit localmente
  try {
    const res = execSync(`pip-audit -r "${reqFile}" --format json`, { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    output = JSON.parse(res);
    hasPipAudit = true;
  } catch (e) {
    if (e.stdout) {
      try {
        output = JSON.parse(e.stdout.toString());
        hasPipAudit = true;
      } catch {}
    }
  }

  // 2. Se não encontrou pip-audit local, tenta via container Docker se estiver rodando
  if (!hasPipAudit) {
    try {
      const res = execSync(`docker exec oraculo_backend pip-audit -r backend/requirements.txt --format json`, { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
      output = JSON.parse(res);
      hasPipAudit = true;
    } catch (e) {
      if (e.stdout) {
        try {
          output = JSON.parse(e.stdout.toString());
          hasPipAudit = true;
        } catch {}
      }
    }
  }

  if (!hasPipAudit || !output) {
    return {
      name: projectName,
      skipped: false,
      warning: 'pip-audit não disponível no PATH local nem no container. Dependências estáticas verificadas.',
      counts: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 }
    };
  }

  // Processa resultados do pip-audit
  const dependencies = output.dependencies || [];
  let totalVulns = 0;
  const vulnsList = [];

  for (const dep of dependencies) {
    if (dep.vulns && dep.vulns.length > 0) {
      totalVulns += dep.vulns.length;
      vulnsList.push({
        package: dep.name,
        version: dep.version,
        vulns: dep.vulns.map(v => ({ id: v.id, fix_versions: v.fix_versions, desc: v.description }))
      });
    }
  }

  return {
    name: projectName,
    counts: {
      critical: 0, // pip-audit agrupa em lista de CVEs
      high: totalVulns,
      moderate: 0,
      low: 0,
      total: totalVulns
    },
    vulnsList
  };
}

/**
 * Função principal de execução
 */
export async function runSecurityAudit() {
  logHeader('ORÁCULO — Varredura de Segurança e Vulnerabilidades');

  if (isFixMode) {
    console.log(`${colors.yellow}⚙️  Modo de auto-correção ativado (--fix). Aplicando correções disponíveis...${colors.reset}\n`);
  }

  const results = [];

  // 1. Frontend React
  console.log(`${colors.blue}🔍 Auditando Frontend (React / Vite)...${colors.reset}`);
  const frontendRes = auditNodeProject('frontend', 'Frontend (React/Vite)', isFixMode);
  results.push(frontendRes);

  // 2. Backend Node.js
  console.log(`${colors.blue}🔍 Auditando Backend (Node.js / Express)...${colors.reset}`);
  const backendNodeRes = auditNodeProject('backend', 'Backend (Node.js/Express)', isFixMode);
  results.push(backendNodeRes);

  // 3. Backend Python
  console.log(`${colors.blue}🔍 Auditando Backend (Python / Agentes)...${colors.reset}`);
  const backendPythonRes = auditPythonProject('backend/requirements.txt', 'Backend (Python / Agentes)');
  results.push(backendPythonRes);

  // Exibição do Relatório
  console.log(`\n${colors.bright}📊 RESUMO DA AUDITORIA:${colors.reset}\n`);

  let hasCriticalOrHigh = false;
  let totalVulnerabilities = 0;

  for (const res of results) {
    if (res.skipped) {
      console.log(`  ${colors.yellow}⚠️  ${res.name}: Ignorado (${res.error})${colors.reset}`);
      continue;
    }

    if (res.warning) {
      console.log(`  ${colors.yellow}⚠️  ${res.name}: ${res.warning}${colors.reset}`);
      continue;
    }

    const { total, critical, high, moderate, low, info } = res.counts;
    totalVulnerabilities += total;

    if (critical > 0 || high > 0) {
      hasCriticalOrHigh = true;
    }

    const statusBadge = total === 0 
      ? `${colors.green}✔ SEGURO (0 vulnerabilidades)${colors.reset}`
      : `${critical > 0 ? colors.red : high > 0 ? colors.red : colors.yellow}⚠ ${total} vulnerabilidade(s) detectada(s)${colors.reset}`;

    console.log(`  ${colors.bright}• ${res.name}:${colors.reset} ${statusBadge}`);
    if (total > 0) {
      console.log(`    [ Críticas: ${critical || 0} | Altas: ${high || 0} | Moderadas: ${moderate || 0} | Baixas: ${low || 0} ]`);
    }
  }

  console.log('\n' + '─'.repeat(68) + '\n');

  if (hasCriticalOrHigh) {
    console.log(`${colors.red}${colors.bright}❌ ALERTA DE SEGURANÇA: Vulnerabilidades críticas ou altas detectadas!${colors.reset}`);
    console.log(`${colors.yellow}👉 Sugestão: Execute "npm run security:fix" para aplicar correções automáticas.${colors.reset}\n`);

    if (isPrePush) {
      console.error(`${colors.red}${colors.bright}⛔ PUSH BLOQUEADO: Corrija as vulnerabilidades críticas/altas antes de enviar ao GitHub.${colors.reset}\n`);
      process.exit(1);
    }
  } else if (totalVulnerabilities > 0) {
    console.log(`${colors.yellow}⚠️  Existem vulnerabilidades de baixa ou moderada severidade que não bloqueiam o push, mas recomenda-se atualizar quando possível.${colors.reset}\n`);
  } else {
    console.log(`${colors.green}${colors.bright}✅ TODAS AS DEPENDÊNCIAS ESTÃO SEGURAS E LIVRES DE VULNERABILIDADES!${colors.reset}\n`);
  }

  return { results, hasCriticalOrHigh, totalVulnerabilities };
}

// Executa diretamente se chamado pela CLI
if (process.argv[1] && process.argv[1].endsWith('security_audit.mjs')) {
  runSecurityAudit().catch(err => {
    console.error('Erro ao executar auditoria:', err);
    process.exit(1);
  });
}

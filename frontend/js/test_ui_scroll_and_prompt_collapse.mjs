/**
 * test_ui_scroll_and_prompt_collapse.mjs
 * Valida se as alterações de UI (scroll da lista de carrosséis e cards retráteis no PipelineModal)
 * foram implementadas corretamente.
 *
 * USO:
 *   node frontend/js/test_ui_scroll_and_prompt_collapse.mjs
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FALHOU: ${msg}`);
    failed++;
  }
}

console.log('\n📋 Testes de UI: Scroll na Lista e Cards Retráteis\n');

// TESTE 1: Verificar se .main-area em base.css possui overflow-y: auto
console.log('Teste 1: Verificar se .main-area possui overflow-y: auto no base.css');
try {
  const baseCssPath = path.resolve('frontend/src/css/base.css');
  const cssContent = fs.readFileSync(baseCssPath, 'utf-8');
  
  const mainAreaMatch = cssContent.match(/\.main-area\s*\{([^}]+)\}/);
  assert(mainAreaMatch !== null, 'Classe .main-area encontrada no base.css');
  if (mainAreaMatch) {
    const properties = mainAreaMatch[1];
    assert(properties.includes('overflow-y: auto'), '.main-area possui overflow-y: auto para permitir rolagem');
  }
} catch (err) {
  console.error('  ❌ Erro ao ler base.css:', err.message);
  failed += 2;
}

// TESTE 2: Verificar se PipelineModal.jsx possui a lógica de recolhimento de prompts
console.log('\nTeste 2: Verificar funcionalidade de recolher/expandir prompts em PipelineModal.jsx');
try {
  const modalPath = path.resolve('frontend/src/components/PipelineModal.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');

  assert(modalContent.includes('collapsedAgents'), 'Estado collapsedAgents declarado no componente');
  assert(modalContent.includes('toggleAgentCollapse'), 'Função toggleAgentCollapse implementada');
  assert(modalContent.includes('toggleAllAgents'), 'Função toggleAllAgents implementada');
  assert(modalContent.includes('Recolher Todos'), 'Botão "Recolher Todos" presente na interface');
  assert(modalContent.includes('!isCollapsed'), 'Renderização condicional do prompt pre-block implementada');
} catch (err) {
  console.error('  ❌ Erro ao ler PipelineModal.jsx:', err.message);
  failed += 5;
}

console.log(`\n📊 Resultado: ${passed} passou / ${failed} falhou\n`);
process.exit(failed > 0 ? 1 : 0);

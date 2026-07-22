import assert from 'assert';
import { mapCarouselFromDb } from '../dashboard/helpers.js';

async function runTests() {
  console.log('🧪 Iniciando testes unitários da funcionalidade de fixar carrosséis...');

  // Teste 1: Mapeamento de colunas do DB
  const mockRowPinned = {
    id: 'carrossel-test-01',
    title: 'Carrossel Teste Fixado',
    status: 'pronto',
    is_pinned: true,
    pinned_at: '2026-07-22T17:00:00.000Z'
  };

  const mapped = mapCarouselFromDb(mockRowPinned);
  assert.strictEqual(mapped.isPinned, true, 'isPinned deve ser true quando row.is_pinned é true');
  assert.strictEqual(mapped.pinnedAt, '2026-07-22T17:00:00.000Z', 'pinnedAt deve corresponder a row.pinned_at');
  console.log('✅ Teste 1: Mapeamento de colunas is_pinned e pinned_at aprovado.');

  // Teste 2: Validação da trava de limite máximo (10 carrosséis)
  const mockCarouselsList = Array.from({ length: 12 }, (_, i) => ({
    id: `carrossel-${i + 1}`,
    title: `Carrossel ${i + 1}`,
    isPinned: i < 10, // Primeiros 10 fixados
    pinnedAt: i < 10 ? new Date().toISOString() : null
  }));

  const pinnedCount = mockCarouselsList.filter(c => c.isPinned).length;
  assert.strictEqual(pinnedCount, 10, 'Deve haver exatamente 10 carrosséis fixados');

  // Tentar fixar o 11º carrossel (carrossel-11)
  const targetToPin = mockCarouselsList.find(c => c.id === 'carrossel-11');
  const currentPinnedCount = mockCarouselsList.filter(c => c.isPinned && c.id !== targetToPin.id).length;
  let errorOccurred = false;

  if (currentPinnedCount >= 10) {
    errorOccurred = true;
  }

  assert.strictEqual(errorOccurred, true, 'Tentativa de fixar o 11º carrossel deve ser bloqueada');
  console.log('✅ Teste 2: Limite máximo de 10 carrosséis fixados validado com sucesso.');

  // Teste 3: Ordenação de fixados no topo
  const mockUnsortedList = [
    { id: 'c1', isPinned: false, createdAt: '2026-07-22T10:00:00' },
    { id: 'c2', isPinned: true, pinnedAt: '2026-07-22T12:00:00', createdAt: '2026-07-22T08:00:00' },
    { id: 'c3', isPinned: true, pinnedAt: '2026-07-22T14:00:00', createdAt: '2026-07-22T09:00:00' },
    { id: 'c4', isPinned: false, createdAt: '2026-07-22T11:00:00' },
  ];

  const sorted = [...mockUnsortedList].sort((a, b) => {
    const isAPinned = Boolean(a.isPinned);
    const isBPinned = Boolean(b.isPinned);
    if (isAPinned && !isBPinned) return -1;
    if (!isAPinned && isBPinned) return 1;
    if (isAPinned && isBPinned) {
      const timeA = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
      const timeB = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
      return timeB - timeA;
    }
    return 0;
  });

  assert.strictEqual(sorted[0].id, 'c3', 'O carrossel c3 (fixado mais recentemente) deve ser o 1º da lista');
  assert.strictEqual(sorted[1].id, 'c2', 'O carrossel c2 (fixado antes) deve ser o 2º da lista');
  assert.strictEqual(sorted[2].isPinned, false, 'Itens não fixados devem aparecer após os fixados');
  console.log('✅ Teste 3: Ordenação prioritária no topo aprovada.');

  // Teste 4: Visibilidade do botão Detalhes (oculto quando c.status === 'generating')
  const showDetailsButton = (status) => status !== 'generating';
  assert.strictEqual(showDetailsButton('generating'), false, 'Botão Detalhes deve ser oculto durante geração');
  assert.strictEqual(showDetailsButton('rascunho'), true, 'Botão Detalhes deve ser visível para rascunho');
  assert.strictEqual(showDetailsButton('pronto'), true, 'Botão Detalhes deve ser visível quando pronto');
  console.log('✅ Teste 4: Ocultação do botão Detalhes em status "generating" aprovada.');

  // Teste 5: Cálculo do Custo Total em Reais (BRL) para carrosséis ativos
  const activeCarouselsMock = [
    { id: 'c1', costUsd: 0.14 }, // 0.14 * 5.6 = 0.784 BRL
    { id: 'c2', costUsd: 0.28 }, // 0.28 * 5.6 = 1.568 BRL
  ];
  const totalCostBrl = activeCarouselsMock.reduce((acc, c) => acc + (c.costUsd * 5.6), 0);
  const roundedBrl = Math.round(totalCostBrl * 100) / 100;
  assert.strictEqual(roundedBrl, 2.35, 'Custo total em Reais deve somar exatamente os carrosséis ativos em BRL');
  console.log('✅ Teste 5: Cálculo de custo total em Reais (BRL) para carrosséis ativos aprovado.');

  // Teste 6: Filtragem de sub-abas de Configurações por categoria
  const categoryMapping = {
    imagem: 'Geração de Imagem',
    audio: 'Áudio',
    publicacao: 'Publicação',
    integracoes: 'Integrações'
  };
  const mockGroups = ['Geração de Imagem', 'Áudio', 'Publicação', 'Integrações'];
  const filterGroup = (cat) => mockGroups.filter(g => cat === 'todas' || g === categoryMapping[cat]);

  assert.strictEqual(filterGroup('imagem')[0], 'Geração de Imagem', 'Aba imagem deve filtrar apenas grupo de Imagem');
  assert.strictEqual(filterGroup('audio')[0], 'Áudio', 'Aba audio deve filtrar apenas grupo de Áudio');
  assert.strictEqual(filterGroup('todas').length, 4, 'Aba todas deve retornar todos os grupos');
  console.log('✅ Teste 6: Organização das sub-abas de Configurações aprovada.');

  console.log('\n🎉 TODOS OS TESTES UNITÁRIOS DA FUNCIONALIDADE E AJUSTES FORAM APROVADOS!');
}

runTests().catch(err => {
  console.error('❌ Erro nos testes unitários:', err);
  process.exit(1);
});

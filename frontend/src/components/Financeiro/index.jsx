import React, { useState, useEffect, useMemo, useCallback } from 'react';
import FinanceiroStats from './FinanceiroStats';
import FinanceiroBreakdown from './FinanceiroBreakdown';
import FinanceiroFilters from './FinanceiroFilters';
import FinanceiroTable from './FinanceiroTable';
import CarouselDetailsModal from '../Dashboard/modals/CarouselDetailsModal';

export default function Financeiro({ showToast }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: null,
    providers: [],
    byStatus: {},
    topThemes: [],
    carousels: []
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  const [selectedDetailsCarousel, setSelectedDetailsCarousel] = useState(null);

  const loadFinancialData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('fo_token');
      const res = await fetch('/api/financial/summary', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Falha ao carregar dados financeiros');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err);
      showToast && showToast('❌ Erro ao carregar dados financeiros.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadFinancialData();
  }, [loadFinancialData]);

  // Filtragem e Ordenação
  const filteredCarousels = useMemo(() => {
    let list = Array.isArray(data.carousels) ? [...data.carousels] : [];

    // Busca textual
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.theme?.toLowerCase().includes(q) ||
          c.id?.toLowerCase().includes(q)
      );
    }

    // Filtro por provedor
    if (selectedProvider !== 'all') {
      list = list.filter((c) => (c.imageProvider || 'gpt-image-2') === selectedProvider);
    }

    // Filtro por status
    if (selectedStatus !== 'all') {
      list = list.filter((c) => (c.status || '').toLowerCase() === selectedStatus.toLowerCase());
    }

    // Ordenação
    list.sort((a, b) => {
      if (sortBy === 'cost_desc') return (b.costBrl || 0) - (a.costBrl || 0);
      if (sortBy === 'cost_asc') return (a.costBrl || 0) - (b.costBrl || 0);
      if (sortBy === 'slides_desc') return (b.totalSlides || 0) - (a.totalSlides || 0);
      if (sortBy === 'saved_desc') return (b.savedBrl || 0) - (a.savedBrl || 0);
      // Padrão: mais recentes
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return list;
  }, [data.carousels, searchTerm, selectedProvider, selectedStatus, sortBy]);

  return (
    <div className="financeiro-wrapper">
      {/* Cabeçalho */}
      <div className="financeiro-header-row">
        <div className="financeiro-title-group">
          <h2>
            <span>💰</span> Gestão Financeira de Carrosséis
          </h2>
          <p>
            Acompanhe em tempo real os custos acumulados em APIs de IA, volume de slides e economia gerada.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="financeiro-rate-badge">
            <span>💵 Cotação Base:</span>
            <strong>1 USD = R$ {Number(data.summary?.usdRate || 5.00).toFixed(2)}</strong>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadFinancialData}
            title="Recarregar dados"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px' }}
          >
            🔄 {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Cards de Métricas Principais (KPIs) */}
      <FinanceiroStats summary={data.summary} />

      {/* Gráficos e Distribuição por Provedores */}
      <FinanceiroBreakdown
        providers={data.providers}
        summary={data.summary}
        topThemes={data.topThemes}
      />

      {/* Filtros e Busca */}
      <FinanceiroFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedProvider={selectedProvider}
        setSelectedProvider={setSelectedProvider}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        sortBy={sortBy}
        setSortBy={setSortBy}
        providers={data.providers}
        totalCount={data.carousels?.length || 0}
        filteredCount={filteredCarousels.length}
      />

      {/* Tabela de Carrosséis */}
      <FinanceiroTable
        carousels={filteredCarousels}
        onOpenDetails={(carousel) => setSelectedDetailsCarousel(carousel)}
      />

      {/* Modal de Detalhes do Carrossel */}
      {selectedDetailsCarousel && (
        <CarouselDetailsModal
          selectedDetailsCarousel={selectedDetailsCarousel}
          setSelectedDetailsCarousel={setSelectedDetailsCarousel}
          handleOpenCaptionModal={() => {}}
        />
      )}
    </div>
  );
}

import React from 'react';

export default function FinanceiroStats({ summary }) {
  if (!summary) return null;

  return (
    <div className="financeiro-kpi-grid">
      <div className="financeiro-kpi-card" style={{ '--accent': '#22c55e' }}>
        <div className="financeiro-kpi-label">
          <span>Custo Total Acumulado</span>
          <span style={{ color: '#22c55e' }}>💰 BRL</span>
        </div>
        <div className="financeiro-kpi-value" style={{ color: '#22c55e' }}>
          R$ {Number(summary.totalCostBrl || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="financeiro-kpi-sub">
          Equivalente a ${Number(summary.totalCostUsd || 0).toFixed(2)} USD
        </div>
      </div>

      <div className="financeiro-kpi-card" style={{ '--accent': '#10b981' }}>
        <div className="financeiro-kpi-label">
          <span>Economia (Text-Only)</span>
          <span style={{ color: '#10b981' }}>✨ Grátis</span>
        </div>
        <div className="financeiro-kpi-value" style={{ color: '#10b981' }}>
          R$ {Number(summary.totalSavedBrl || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="financeiro-kpi-sub">
          ${Number(summary.totalSavedUsd || 0).toFixed(2)} economizados em API
        </div>
      </div>

      <div className="financeiro-kpi-card" style={{ '--accent': 'var(--cyan, #38bdf8)' }}>
        <div className="financeiro-kpi-label">
          <span>Carrosséis Produzidos</span>
          <span style={{ color: '#38bdf8' }}>📊 Total</span>
        </div>
        <div className="financeiro-kpi-value">
          {summary.totalCarousels || 0}
        </div>
        <div className="financeiro-kpi-sub">
          Total de carrosséis no banco
        </div>
      </div>

      <div className="financeiro-kpi-card" style={{ '--accent': 'var(--purple, #a855f7)' }}>
        <div className="financeiro-kpi-label">
          <span>Volume de Slides</span>
          <span style={{ color: '#a855f7' }}>🖼️ Slides</span>
        </div>
        <div className="financeiro-kpi-value">
          {summary.totalSlides || 0}
        </div>
        <div className="financeiro-kpi-sub">
          <span style={{ color: '#f43f5e', fontWeight: 600 }}>{summary.totalPaidSlides || 0} pagos</span>
          {' · '}
          <span style={{ color: '#22c55e', fontWeight: 600 }}>{summary.totalFreeSlides || 0} grátis</span>
        </div>
      </div>

      <div className="financeiro-kpi-card" style={{ '--accent': 'var(--gold, #c9a84c)' }}>
        <div className="financeiro-kpi-label">
          <span>Custo Médio / Carrossel</span>
          <span style={{ color: 'var(--gold, #c9a84c)' }}>🎯 Média</span>
        </div>
        <div className="financeiro-kpi-value">
          R$ {Number(summary.avgCostPerCarouselBrl || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="financeiro-kpi-sub">
          ${Number(summary.avgCostPerCarouselUsd || 0).toFixed(2)} USD por carrossel
        </div>
      </div>

      <div className="financeiro-kpi-card" style={{ '--accent': '#06b6d4' }}>
        <div className="financeiro-kpi-label">
          <span>Custo Médio / Slide Pago</span>
          <span style={{ color: '#06b6d4' }}>⚡ Por Imagem</span>
        </div>
        <div className="financeiro-kpi-value">
          R$ {Number(summary.avgCostPerSlideBrl || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="financeiro-kpi-sub">
          ${Number(summary.avgCostPerSlideUsd || 0).toFixed(3)} USD por imagem de IA
        </div>
      </div>
    </div>
  );
}

// frontend/src/components/Biblioteca/BibliotecaTopbar.jsx — Barra Superior da Biblioteca
import React from 'react';

export default function BibliotecaTopbar({
  searchQuery,
  onSearchChange,
  categories,
  selectedCategory,
  onCategoryChange,
  sortOrder,
  onSortOrderChange,
  totalImages,
  selectedCount,
  onToggleSelectAll,
  onOpenUpload
}) {
  return (
    <div className="biblioteca-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
      <div className="biblioteca-title-wrap">
        <h1>
          <span>🖼️</span> Biblioteca de Referências
        </h1>
        <p>Gerencie imagens de referência para criação e aprimoramento de carrosséis e artes</p>
      </div>

      <div className="biblioteca-actions-bar" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="biblioteca-search-input"
          placeholder="Buscar imagens..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        {/* Dropdown de Categorias */}
        <select
          className="biblioteca-select-filter"
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          title="Filtrar por Categoria"
        >
          {categories.map(cat => (
            <option key={cat} value={cat} style={{ background: '#18181b', color: '#fff' }}>
              {cat === 'Todas' ? '📁 Todas as Categorias' : `🏷️ ${cat}`}
            </option>
          ))}
        </select>

        {/* Dropdown de Ordenação */}
        <select
          className="biblioteca-select-filter"
          value={sortOrder}
          onChange={(e) => onSortOrderChange(e.target.value)}
          title="Ordenar Imagens"
        >
          <option value="date_desc" style={{ background: '#18181b', color: '#fff' }}>🕒 Mais recentes (Últimos uploads)</option>
          <option value="date_asc" style={{ background: '#18181b', color: '#fff' }}>⏳ Mais antigas (Primeiros uploads)</option>
          <option value="name_asc" style={{ background: '#18181b', color: '#fff' }}>🔤 Ordem Alfabética (A → Z)</option>
          <option value="name_desc" style={{ background: '#18181b', color: '#fff' }}>🔡 Ordem Alfabética (Z → A)</option>
        </select>

        {/* Botão Selecionar Todas */}
        {totalImages > 0 && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={onToggleSelectAll}
            title={selectedCount === totalImages ? "Desmarcar Todas" : "Selecionar Todas as Imagens"}
            style={{ fontSize: '13px', padding: '8px 12px' }}
          >
            {selectedCount === totalImages ? 'Desmarcar Todas' : `☑️ Selecionar Todas (${totalImages})`}
          </button>
        )}

        <button
          className="btn btn-gold"
          onClick={onOpenUpload}
        >
          + Fazer Upload
        </button>
      </div>
    </div>
  );
}

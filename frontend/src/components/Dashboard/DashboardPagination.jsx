import React from 'react';

export default function DashboardPagination({
  pageSize,
  onPageSizeChange,
  currentPage,
  totalPages,
  onPageChange,
  totalItems
}) {
  if (totalItems === 0) return null;

  return (
    <div className="pagination" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="pagination-info" style={{ margin: 0 }}>Mostrar</span>
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(e.target.value)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
            outline: 'none',
            fontFamily: 'inherit'
          }}
        >
          <option value="20">20 por página</option>
          <option value="50">50 por página</option>
          <option value="100">100 por página</option>
        </select>
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls" style={{ margin: 0 }}>
          <button 
            type="button"
            className="page-btn" 
            disabled={currentPage === 1} 
            onClick={() => onPageChange(currentPage - 1)}
          >
            Anterior
          </button>
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`page-btn ${currentPage === idx + 1 ? 'active' : ''}`}
              onClick={() => onPageChange(idx + 1)}
            >
              {idx + 1}
            </button>
          ))}
          <button 
            type="button"
            className="page-btn" 
            disabled={currentPage === totalPages} 
            onClick={() => onPageChange(currentPage + 1)}
          >
            Próxima
          </button>
        </div>
      )}

      <span className="pagination-info" style={{ margin: 0 }}>
        Página {currentPage} de {totalPages} ({totalItems} no total)
      </span>
    </div>
  );
}

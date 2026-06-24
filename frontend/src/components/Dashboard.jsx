import React, { useState, useEffect } from 'react';

export default function Dashboard({
  allCarousels,
  stats,
  filterStatus,
  setFilterStatus,
  onOpenLightbox,
  onOpenEditModal,
  onLoadCarousels,
  showToast,
  onOpenHistoryModal,
  onLoadChatHistory
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCards, setExpandedCards] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [selectedDetailsCarousel, setSelectedDetailsCarousel] = useState(null);
  const PAGE_SIZE = 12;

  // Filter & Pagination
  const filtered = allCarousels.filter(c => {
    if (filterStatus === 'all') return true;
    return c.status === filterStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);

  // Reseta seleção ao mudar o filtro
  useEffect(() => {
    setSelectedIds([]);
  }, [filterStatus]);

  const toggleExpand = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectCard = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allFilteredIds = filtered.map(c => c.id);
    const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.includes(id));
    if (isAllSelected) {
      setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleStatusChange = async (carouselId, status) => {
    try {
      const res = await fetch(`/api/carousels/${carouselId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(`Status atualizado para: ${status.toUpperCase()}`);
        onLoadCarousels();
      }
    } catch (e) {
      showToast('Erro ao atualizar status.');
    }
  };

  const handlePublish = async (carouselId) => {
    try {
      const res = await fetch(`/api/carousels/${carouselId}/publish`, { method: 'POST' });
      if (res.ok) {
        showToast('✓ Publicado no Instagram!');
        onLoadCarousels();
      } else {
        const err = await res.json();
        alert('Erro: ' + (err.error || 'Falha ao publicar'));
      }
    } catch (e) {
      showToast('Erro ao conectar ao Instagram.');
    }
  };

  const handleDownloadZip = async (carouselId) => {
    showToast('Preparando download do ZIP...');
    try {
      const res = await fetch(`/api/carousels/${carouselId}/download-zip`);
      if (res.ok) {
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `carrossel-${carouselId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('✓ ZIP baixado com sucesso!');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('Erro ao baixar ZIP: ' + (err.error || 'sem slides'));
      }
    } catch (e) {
      showToast('Erro de conexão ao baixar ZIP.');
    }
  };

  const confirmDeleteIndividual = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`/api/carousels/${deleteTargetId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Carrossel excluído com sucesso.');
        setSelectedIds(prev => prev.filter(x => x !== deleteTargetId));
        setDeleteTargetId(null);
        onLoadCarousels();
      }
    } catch (e) {
      showToast('Erro ao excluir carrossel.');
    }
  };

  const confirmDeleteBulk = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetch('/api/carousels/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (res.ok) {
        showToast(`${selectedIds.length} carrosséis excluídos.`);
        setSelectedIds([]);
        setIsBulkDeleteModalOpen(false);
        onLoadCarousels();
      }
    } catch (e) {
      showToast('Erro ao excluir carrosséis em lote.');
    }
  };

  const allFilteredIds = filtered.map(c => c.id);
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.includes(id));

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card" style={{ '--accent': 'var(--gold)' }}>
          <div className="stat-num">{stats?.total || 0}</div>
          <div className="stat-label">Carrosséis produzidos</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--cyan)' }}>
          <div className="stat-num">{stats?.slides || 0}</div>
          <div className="stat-label">Slides gerados</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--green)' }}>
          <div className="stat-num">{stats?.aprovados || 0}</div>
          <div className="stat-label">Aprovados / prontos</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--purple)' }}>
          <div className="stat-num">{stats?.publicados || 0}</div>
          <div className="stat-label">Publicados</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--green)' }}>
          <div className="stat-num">{stats?.cost ? Number(stats.cost).toFixed(2) : '0.00'}</div>
          <div className="stat-label">Custo total (USD)</div>
        </div>
      </div>

      <div className="section">
        <div className="section-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="section-title">Carrosséis</div>
            {filtered.length > 0 && (
              <button 
                className="btn btn-outline btn-sm"
                onClick={handleSelectAll}
                style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}
              >
                {isAllSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            )}
            {selectedIds.length > 0 && (
              <button
                className="btn-danger btn-sm"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                🗑 Excluir Selecionados ({selectedIds.length})
              </button>
            )}
          </div>
          <div className="filter-row">
            {['all', 'rascunho', 'pronto', 'aprovado', 'agendado', 'publicado'].map(status => (
              <button
                key={status}
                className={`btn btn-outline btn-sm ${filterStatus === status ? 'active' : ''}`}
                onClick={() => { setFilterStatus(status); setCurrentPage(1); }}
                style={status === 'agendado' ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}}
              >
                {status === 'all' ? 'Todos' : status.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="carousel-grid">
          {paginated.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">⏳</div>
              <div className="empty-text">Nenhum carrossel encontrado.</div>
            </div>
          ) : (
            paginated.map(c => {
              const isExpanded = expandedCards[c.id];
              const isSelected = selectedIds.includes(c.id);
              return (
                <div className={`carousel-card ${isSelected ? 'selected' : ''}`} key={c.id} style={{ position: 'relative' }}>
                  {/* Checkbox de seleção em lote */}
                  <div 
                    onClick={(e) => e.stopPropagation()} 
                    style={{ 
                      position: 'absolute', 
                      top: '12px', 
                      left: '12px', 
                      zIndex: 20, 
                      background: 'rgba(0, 0, 0, 0.75)', 
                      borderRadius: '4px', 
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255, 255, 255, 0.15)'
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => handleSelectCard(c.id)}
                      style={{ 
                        width: '16px', 
                        height: '16px', 
                        cursor: 'pointer',
                        accentColor: 'var(--gold)'
                      }}
                    />
                  </div>

                  <div className="card-header" onClick={() => toggleExpand(c.id)}>
                    {c.slides && c.slides.length > 0 ? (
                      <img src={`/api/carousels/${c.id}/image/${c.slides[0]}`} className="card-thumb" alt="" />
                    ) : (
                      <div className="card-thumb-placeholder">🎨</div>
                    )}
                    <div className="card-meta">
                      <div className="card-title">{c.title}</div>
                      <div className="card-badges">
                        <span className="badge badge-format">F: {c.format}</span>
                        <span className={`badge badge-${c.status}`}>{c.status}</span>
                        {c.cost > 0 && <span className="card-cost">${c.cost}</span>}
                      </div>
                      <div className="card-date">
                        {c.scheduledDate ? `📅 ${c.scheduledDate} ${c.scheduledTime || ''}` : new Date(c.createdAt || Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <>
                      <div className="slide-strip open">
                        {c.slides?.map((slide, idx) => (
                          <div className="slide-thumb-wrap" key={idx}>
                            <img
                              src={`/api/carousels/${c.id}/image/${slide}`}
                              className="slide-thumb"
                              alt=""
                              onClick={() => onOpenLightbox(c.id, c.slides, idx)}
                            />
                            <div className="slide-thumb-num">{idx + 1}</div>
                            <div className="slide-actions-overlay">
                              <button className="slide-icon-btn slide-icon-btn-dl" onClick={() => {
                                const a = document.createElement('a');
                                a.href = `/api/carousels/${c.id}/image/${slide}`;
                                a.download = slide;
                                a.click();
                              }}>↓</button>
                              <button className="slide-icon-btn slide-icon-btn-edit" onClick={() => onOpenEditModal(c.id, slide)}>✎</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {c.caption && <div className="caption-box open">{c.caption}</div>}
                    </>
                  )}

                  <div className="card-footer">
                    <select
                      className="status-select"
                      value={c.status}
                      onChange={(e) => handleStatusChange(c.id, e.target.value)}
                    >
                      <option value="rascunho">Rascunho</option>
                      <option value="pronto">Pronto</option>
                      <option value="aprovado">Aprovado</option>
                      <option value="publicado">Publicado</option>
                    </select>

                    <div className="card-actions">
                      {c.chatHistory && c.chatHistory.length > 0 && (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ borderColor: 'var(--gold, #e0a96d)', color: 'var(--gold, #e0a96d)' }}
                          onClick={(e) => { e.stopPropagation(); onLoadChatHistory(c.chatHistory); }}
                        >
                          💬 Ver no Chat
                        </button>
                      )}

                      <button
                        className="btn btn-outline btn-sm"
                        onClick={(e) => { e.stopPropagation(); setSelectedDetailsCarousel(c); }}
                      >
                        🔎 Detalhes
                      </button>

                      <button
                        className="btn-instagram btn-sm"
                        disabled={c.status === 'publicado'}
                        onClick={() => handlePublish(c.id)}
                      >
                        {c.status === 'publicado' ? '✓ Postado' : '✈ Postar'}
                      </button>
                      {c.slides && c.slides.length > 0 && c.totalSlides > 0 && c.slides.length === c.totalSlides && (
                        <button 
                          className="btn btn-outline btn-sm" 
                          onClick={(e) => { e.stopPropagation(); handleDownloadZip(c.id); }} 
                          title="Baixar todos os slides em ZIP"
                        >
                          Baixar
                        </button>
                      )}
                      <button className="btn-danger btn-sm" onClick={() => setDeleteTargetId(c.id)}>✕</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">Página {currentPage} de {totalPages}</span>
            <div className="pagination-controls">
              <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>Anterior</button>
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  className={`page-btn ${currentPage === idx + 1 ? 'active' : ''}`}
                  onClick={() => setCurrentPage(idx + 1)}
                >
                  {idx + 1}
                </button>
              ))}
              <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>Próxima</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Exclusão Individual */}
      {deleteTargetId && (
        <div className="form-modal open">
          <div className="form-box">
            <h3 className="form-title" style={{ color: 'var(--red, #f43f5e)', fontSize: '16px' }}>Confirmar Exclusão</h3>
            <p style={{ margin: '14px 0 24px', color: '#e4e4e7', fontSize: '14px', lineHeight: '1.5' }}>
               Você tem certeza que deseja excluir permanentemente este carrossel? Esta ação não pode ser desfeita e removerá todos os arquivos físicos e registros.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-outline" onClick={() => setDeleteTargetId(null)}>Cancelar</button>
              <button className="btn btn-danger" style={{ backgroundColor: 'var(--red, #f43f5e)', color: '#ffffff', border: 'none' }} onClick={confirmDeleteIndividual}>Excluir permanentemente</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão em Lote */}
      {isBulkDeleteModalOpen && (
        <div className="form-modal open">
          <div className="form-box">
            <h3 className="form-title" style={{ color: 'var(--red, #f43f5e)', fontSize: '16px' }}>Confirmar Exclusão em Lote</h3>
            <p style={{ margin: '14px 0 24px', color: '#e4e4e7', fontSize: '14px', lineHeight: '1.5' }}>
              Você tem certeza que deseja excluir permanentemente os <strong>{selectedIds.length}</strong> carrosséis selecionados? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-outline" onClick={() => setIsBulkDeleteModalOpen(false)}>Cancelar</button>
              <button className="btn btn-danger" style={{ backgroundColor: 'var(--red, #f43f5e)', color: '#ffffff', border: 'none' }} onClick={confirmDeleteBulk}>Excluir permanentemente</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Carrossel */}
      {selectedDetailsCarousel && (
        <div className="form-modal open">
          <div className="form-box" style={{ maxWidth: '440px', padding: '24px' }}>
            <h3 className="form-title" style={{ color: 'var(--gold, #C9A84C)', fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ℹ️ Detalhes do Carrossel
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: '#e4e4e7', fontSize: '13px' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Título</span>
                <strong style={{ fontSize: '14px', color: '#ffffff' }}>{selectedDetailsCarousel.title || 'Sem título'}</strong>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Tema</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--cyan, #38bdf8)' }}>{selectedDetailsCarousel.theme || 'Não definido'}</span>
                </div>
                <div style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Slides</span>
                  <span style={{ fontWeight: '600' }}>{selectedDetailsCarousel.slides?.length || 0} / {selectedDetailsCarousel.totalSlides || 10}</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Qualidade / Resolução</span>
                <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>{selectedDetailsCarousel.imageQuality || 'Alta (high)'}</span>
              </div>

              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Criado em (Horário de Brasília)</span>
                <span style={{ fontWeight: '500' }}>
                  {new Date(selectedDetailsCarousel.createdAt || Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Custo Total (USD)</span>
                  <span style={{ color: '#f43f5e', fontWeight: '600' }}>${Number(selectedDetailsCarousel.cost || 0).toFixed(2)}</span>
                </div>
                <div style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Custo Total (BRL)</span>
                  <span style={{ color: '#22c55e', fontWeight: '600' }}>R$ {Number((selectedDetailsCarousel.cost || 0) * 5.60).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Custo / Slide (USD)</span>
                  <span style={{ fontWeight: '500' }}>
                    ${Number(selectedDetailsCarousel.totalSlides > 0 ? (selectedDetailsCarousel.cost || 0) / selectedDetailsCarousel.totalSlides : 0).toFixed(4)}
                  </span>
                </div>
                <div style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Custo / Slide (BRL)</span>
                  <span style={{ fontWeight: '500' }}>
                    R$ {Number(selectedDetailsCarousel.totalSlides > 0 ? ((selectedDetailsCarousel.cost || 0) * 5.60) / selectedDetailsCarousel.totalSlides : 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-outline" style={{ padding: '8px 20px' }} onClick={() => setSelectedDetailsCarousel(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

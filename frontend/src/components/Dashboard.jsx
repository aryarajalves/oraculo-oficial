import React, { useState, useEffect } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';

export default function Dashboard({
  allCarousels,
  stats,
  filterStatus,
  setFilterStatus,
  onOpenLightbox,
  onOpenEditModal,
  onLoadCarousels,
  onLoadStats,
  showToast,
  onOpenHistoryModal,
  onLoadChatHistory
}) {
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCards, setExpandedCards] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [selectedDetailsCarousel, setSelectedDetailsCarousel] = useState(null);
  const [isCaptionMaximized, setIsCaptionMaximized] = useState(false);
  const [retryingId, setRetryingId] = useState(null);

  // Trava scroll do body quando qualquer modal estiver aberto
  const anyModalOpen = !!selectedDetailsCarousel || isBulkDeleteModalOpen || !!deleteTargetId || isCaptionMaximized;
  useScrollLock(anyModalOpen);

  const handleRetryGeneration = async (carouselId) => {
    if (retryingId) return;
    setRetryingId(carouselId);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/carousels/${carouselId}/retry`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Erro ao iniciar retentativa', 'error');
        setRetryingId(null);
        return;
      }
      showToast('🔄 Retentativa iniciada! Acompanhe no chat do carrossel.', 'success');
      setTimeout(() => { onLoadCarousels(); onLoadStats(); setRetryingId(null); }, 3000);
    } catch (e) {
      showToast('Erro de conexão ao tentar recriar', 'error');
      setRetryingId(null);
    }
  };

  const handlePageSizeChange = (val) => {
    setPageSize(Number(val));
    setCurrentPage(1);
  };

  // Filter & Pagination
  const filtered = allCarousels.filter(c => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'rascunho') {
      return c.status === 'rascunho' || c.status === 'generating';
    }
    return c.status === filterStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStartIndex = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(pageStartIndex, pageStartIndex + pageSize);

  // Reseta seleção ao mudar o filtro
  useEffect(() => {
    setSelectedIds([]);
  }, [filterStatus]);

  const toggleExpand = (id) => {
    setExpandedCards(prev => (prev[id] ? {} : { [id]: true }));
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
        if (onLoadStats) onLoadStats();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || err.detail || 'Erro ao excluir carrossel.');
      }
    } catch (e) {
      showToast('Erro de conexão ao excluir carrossel.');
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
        if (onLoadStats) onLoadStats();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || err.detail || 'Erro ao excluir carrosséis.');
      }
    } catch (e) {
      showToast('Erro de conexão ao excluir carrosséis.');
    }
  };

  const allFilteredIds = filtered.map(c => c.id);
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.includes(id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)' }}>
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
          <div className="stat-num" style={{ fontSize: stats?.cost && stats.cost > 0 ? '28px' : undefined }}>R$ {stats?.cost ? (Number(stats.cost) * 5.6).toFixed(2) : '0,00'}</div>
          <div className="stat-label">Custo total (BRL)</div>
        </div>
      </div>

      <div className="section" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'flex-start' }}>
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
                      <img src={`/api/carousels/${c.id}/image/${c.slides[0]}?token=${encodeURIComponent(localStorage.getItem('fo_token') || '')}`} className="card-thumb" alt="" />
                    ) : (
                      <div className="card-thumb-placeholder">{c.status === 'generating' ? '⏳' : '🎨'}</div>
                    )}
                    <div className="card-meta">
                      <div className="card-title">{c.title}</div>
                      <div className="card-badges">
                        <span className="badge badge-format">F: {c.format}</span>
                        <span className={`badge badge-${c.status}`}>{c.status === 'generating' ? 'gerando' : c.status}</span>
                        {c.preset === 'escala' && (
                          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 'bold' }}>MOCK</span>
                        )}
                      </div>
                      <div className="card-date">
                        {c.scheduledDate ? `📅 ${c.scheduledDate} ${c.scheduledTime || ''}` : new Date(c.createdAt || Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <>
                      <div className="slide-strip open">
                        {Array.from({ length: c.status === 'generating' ? (c.totalSlides || 10) : (c.slides?.length || 0) }).map((_, idx) => {
                          const slide = c.slides && c.slides[idx];
                          if (slide) {
                            return (
                              <div className="slide-thumb-wrap" key={idx}>
                                <img
                                  src={`/api/carousels/${c.id}/image/${slide}?token=${encodeURIComponent(localStorage.getItem('fo_token') || '')}`}
                                  className="slide-thumb"
                                  alt=""
                                />
                                <div className="slide-thumb-num">{idx + 1}</div>
                                <div className="slide-actions-overlay" style={{ cursor: 'pointer' }} onClick={() => onOpenLightbox(c.id, c.slides, idx)}>
                                  <button className="slide-icon-btn" title="Visualizar/Maximizar" style={{ background: 'var(--green, #22c55e)', color: '#fff' }}>👁</button>
                                  <button className="slide-icon-btn slide-icon-btn-dl" title="Baixar" onClick={(e) => {
                                    e.stopPropagation();
                                    const a = document.createElement('a');
                                    a.href = `/api/carousels/${c.id}/image/${slide}?token=${encodeURIComponent(localStorage.getItem('fo_token') || '')}`;
                                    a.download = slide;
                                    a.click();
                                  }}>↓</button>
                                  <button className="slide-icon-btn slide-icon-btn-edit" title="Editar" onClick={(e) => {
                                     e.stopPropagation();
                                     onOpenEditModal(c.id, slide, c.slides);
                                   }}>✎</button>
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div className="slide-thumb-wrap" key={idx}>
                                <div className="slide-thumb-loading">
                                  <div className="slide-thumb-spinner"></div>
                                </div>
                                <div className="slide-thumb-num">{idx + 1}</div>
                              </div>
                            );
                          }
                        })}
                      </div>
                      {c.caption && <div className="caption-box open">{c.caption_full || c.caption}</div>}
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

                      {c.status === 'rascunho' && c.lastPayload && c.lastPayload.slides && c.lastPayload.slides.length > 0 && (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ borderColor: '#22c55e', color: '#22c55e', opacity: retryingId === c.id ? 0.6 : 1 }}
                          disabled={!!retryingId}
                          onClick={(e) => { e.stopPropagation(); handleRetryGeneration(c.id); }}
                          title="Recriar carrossel usando o roteiro anterior"
                        >
                          {retryingId === c.id ? '⏳ Recriando...' : '🔄 Recriar'}
                        </button>
                      )}

                      <button
                        className="btn btn-outline btn-sm"
                        onClick={(e) => { e.stopPropagation(); setSelectedDetailsCarousel(c); }}
                      >
                        🔎 Detalhes
                      </button>

                      {c.slides && c.slides.length > 0 && (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ borderColor: '#a855f7', color: '#a855f7' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const firstSlide = typeof c.slides[0] === 'string' ? c.slides[0] : c.slides[0].filename;
                            onOpenEditModal(c.id, firstSlide, c.slides);
                          }}
                        >
                          ✏️ Editar
                        </button>
                      )}

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
        </div>

        {filtered.length > 0 && (
          <div className="pagination" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pagination-info" style={{ margin: 0 }}>Mostrar</span>
              <select
                value={pageSize}
                onChange={e => handlePageSizeChange(e.target.value)}
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
            )}

            <span className="pagination-info" style={{ margin: 0 }}>
              Página {currentPage} de {totalPages} ({filtered.length} no total)
            </span>
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
          <div className="form-box" style={{ maxWidth: '550px', padding: '24px' }}>
            <h3 className="form-title" style={{ color: 'var(--gold, #C9A84C)', fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ℹ️ Detalhes do Carrossel
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: '#e4e4e7', fontSize: '13px' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                <span style={{ color: 'var(--gold, #C9A84C)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Título / Gancho
                  {selectedDetailsCarousel.preset === 'escala' && (
                    <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold' }}>MOCK</span>
                  )}
                </span>
                <strong style={{ fontSize: '16px', color: '#ffffff', lineHeight: '1.4', display: 'block' }}>{selectedDetailsCarousel.title || 'Sem título'}</strong>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                  <span style={{ color: 'var(--gold, #C9A84C)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>Tema</span>
                  <span style={{ fontFamily: 'monospace', color: '#ffffff', fontSize: '14px', fontWeight: '600', background: 'rgba(56, 189, 248, 0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'inline-block' }}>{selectedDetailsCarousel.theme || 'Não definido'}</span>
                </div>
                <div style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Slides</span>
                  <span style={{ fontWeight: '600' }}>{selectedDetailsCarousel.slides?.length || 0} / {selectedDetailsCarousel.totalSlides || 10}</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Qualidade / Resolução</span>
                <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>
                  {(() => {
                    const q = selectedDetailsCarousel.imageQuality;
                    if (q === 'low') return 'Baixa (Low)';
                    if (q === 'medium') return 'Média (Medium)';
                    if (q === 'high') return 'Alta (High)';
                    if (q === 'hd') return 'HD (DALL-E 3)';
                    if (q === 'standard') return 'Padrão (DALL-E 3)';
                    if (q === 'auto') return 'Automático (Auto)';
                    return q || 'Alta (High)';
                  })()}
                </span>
              </div>

              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Criado em (Horário de Brasília)</span>
                <span style={{ fontWeight: '500' }}>
                  {new Date(selectedDetailsCarousel.createdAt || Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                </span>
              </div>

              {selectedDetailsCarousel.caption && (
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase' }}>Legenda (Caption)</span>
                    <button 
                      className="btn btn-outline btn-sm" 
                      style={{ fontSize: '10px', padding: '2px 8px', height: 'auto', minHeight: 'auto', border: '1px solid rgba(201, 168, 76, 0.4)', color: 'var(--gold)' }}
                      onClick={() => setIsCaptionMaximized(true)}
                    >
                      ↗ Maximizar
                    </button>
                  </div>
                  <div style={{ 
                    maxHeight: '80px', 
                    overflowY: 'auto', 
                    backgroundColor: 'rgba(0,0,0,0.2)', 
                    padding: '8px', 
                    borderRadius: '4px', 
                    whiteSpace: 'pre-wrap', 
                    fontSize: '11px',
                    color: '#d4d4d8'
                  }}>
                    {selectedDetailsCarousel.caption_full || selectedDetailsCarousel.caption}
                  </div>
                </div>
              )}

              {selectedDetailsCarousel.notes && (
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Conteúdo / Roteiro (Slides e Prompts)</span>
                  <div style={{ 
                    maxHeight: '150px', 
                    overflowY: 'auto', 
                    backgroundColor: 'rgba(0,0,0,0.2)', 
                    padding: '8px', 
                    borderRadius: '4px', 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#a1a1aa'
                  }}>
                    {selectedDetailsCarousel.notes}
                  </div>
                </div>
              )}

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

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>IA dos Slides (Imagens)</span>
                  <span style={{ fontWeight: '500', color: '#06b6d4' }}>
                    {(() => {
                      const provider = selectedDetailsCarousel.imageProvider;
                      if (!provider || provider === 'gpt-image-2') return 'OpenAI GPT Image 2';
                      if (provider === 'dall-e-3') return 'OpenAI DALL-E 3';
                      if (provider === 'fal') return 'Flux Schnell (via Fal)';
                      if (provider === 'gemini') return 'Google Imagen 3';
                      if (provider === 'gpt-image-1-mini') return 'GPT Image 1 Mini';
                      if (provider === 'dall-e-2') return 'OpenAI DALL-E 2';
                      return provider.toUpperCase();
                    })()}
                  </span>
                </div>
                <div style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>LLM do Briefing, Prompt & Copy</span>
                  <span style={{ fontWeight: '500', color: 'var(--gold, #C9A84C)' }}>
                    {(() => {
                      const lastAssistantMsg = (selectedDetailsCarousel.chatHistory || []).slice().reverse().find(m => m.role === 'assistant' && m.model);
                      const model = lastAssistantMsg ? lastAssistantMsg.model : (selectedDetailsCarousel.copyModel || 'N/A');
                      return model.toUpperCase();
                    })()}
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

      {/* Modal Ampliado de Legenda (Caption Maximizado) */}
      {isCaptionMaximized && selectedDetailsCarousel && (
        <div className="form-modal open" style={{ zIndex: 1100 }}>
          <div className="form-box" style={{ maxWidth: '700px', width: '90%', padding: '24px', background: '#121214' }}>
            <h3 className="form-title" style={{ color: 'var(--gold, #C9A84C)', fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
              📝 Legenda Completa
            </h3>
            <div style={{ 
              backgroundColor: 'rgba(0,0,0,0.3)', 
              padding: '16px', 
              borderRadius: '6px', 
              whiteSpace: 'pre-wrap', 
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#f4f4f5',
              maxHeight: '60vh',
              overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {selectedDetailsCarousel.caption_full || selectedDetailsCarousel.caption}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '12px' }}>
              <button 
                className="btn btn-outline" 
                style={{ padding: '8px 20px' }} 
                onClick={() => {
                  navigator.clipboard.writeText(selectedDetailsCarousel.caption_full || selectedDetailsCarousel.caption);
                  showToast('Legenda copiada para a área de transferência!');
                }}
              >
                Copiar Texto
              </button>
              <button className="btn btn-outline" style={{ padding: '8px 20px', borderColor: 'var(--gold)' }} onClick={() => setIsCaptionMaximized(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

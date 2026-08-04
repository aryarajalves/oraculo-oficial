import React, { useState, useEffect } from 'react';

export default function Lightbox({ isOpen, onClose, carouselId, slides = [], initialIndex = 0, onOpenEditModal, showToast }) {
  const [index, setIndex] = useState(initialIndex);
  const [editMode, setEditMode] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [meta, setMeta] = useState({ title: '', body: '' });
  const [isMaximized, setIsMaximized] = useState(false);
  const [imageVersion, setImageVersion] = useState(1);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    setIndex(initialIndex);
    setEditMode(false);
    setSelectedZone(null);
    setIsMaximized(false);
    setImageLoading(true);
    if (isOpen) {
      setImageVersion(Date.now());
    }
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
    };
  }, [isOpen]);

  const getSlideFilename = (item) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    return item.filename || item.name || '';
  };

  // Pré-carregamento automático de todos os slides do carrossel na memória do navegador
  useEffect(() => {
    if (isOpen && carouselId && slides && slides.length > 0) {
      const token = encodeURIComponent(localStorage.getItem('fo_token') || '');
      slides.forEach((item) => {
        const slideName = getSlideFilename(item);
        if (!slideName) return;
        const img = new Image();
        img.src = `/api/carousels/${carouselId}/image/${slideName}?token=${token}&v=${imageVersion}`;
      });
    }
  }, [isOpen, carouselId, slides, imageVersion]);

  // Navegação rápida via teclas de seta do teclado (Left/Right/Escape)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') {
        setIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setIndex(prev => Math.min((slides ? slides.length - 1 : 0), prev + 1));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, slides, onClose]);

  useEffect(() => {
    if (isOpen && carouselId && slides && slides[index]) {
      setImageLoading(true);
      loadSlideMeta();
    }
  }, [index, isOpen, carouselId]);

  const loadSlideMeta = async () => {
    const slideName = getSlideFilename(slides[index]);
    if (!slideName) return;
    try {
      const res = await fetch(`/api/carousels/${carouselId}/slide/${slideName}/meta`);
      const data = await res.json();
      setMeta({ title: data.title || '', body: data.body || '' });
    } catch (e) {
      showToast('Erro ao carregar metadados do slide.');
    }
  };

  if (!isOpen || !slides || slides.length === 0) return null;

  const currentSlide = getSlideFilename(slides[index]);

  const handleSaveElement = async () => {
    try {
      const res = await fetch(`/api/carousels/${carouselId}/slide/${currentSlide}/recompose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meta)
      });
      const data = await res.json();
      if (data.ok) {
        showToast('Elemento atualizado com sucesso!');
        setSelectedZone(null);
        setImageVersion(prev => prev + 1); // Atualiza cache apenas ao editar
      } else {
        alert('Erro ao salvar: ' + (data.error || 'desconhecido'));
      }
    } catch (e) {
      showToast('Erro de rede ao salvar elemento.');
    }
  };

  const handleDownload = async () => {
    try {
      const token = encodeURIComponent(localStorage.getItem('fo_token') || '');
      const res = await fetch(`/api/carousels/${carouselId}/image/${currentSlide}?token=${token}&v=${imageVersion}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = currentSlide;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      showToast('Erro ao baixar slide.');
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/carousels/${carouselId}/slide/${currentSlide}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.ok) {
        showToast('Slide excluído com sucesso!');
        setIsDeleteModalOpen(false);
        onClose();
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (e) {
      showToast('Erro ao excluir slide.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`modal-overlay ${editMode && !isMaximized ? 'lb-editing' : 'lb-editor-hidden'} open`}>
      <button className="modal-close" onClick={onClose}>✕</button>

      <div className="lb-container" style={isMaximized ? { maxHeight: '95vh', width: 'auto', display: 'block' } : {}}>
        <div className="lb-slide-wrap" style={{ position: 'relative', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {imageLoading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(9, 9, 11, 0.85)',
              borderRadius: '8px',
              zIndex: 10,
              backdropFilter: 'blur(4px)'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                border: '3px solid rgba(217, 119, 6, 0.2)',
                borderTopColor: 'var(--gold, #d97706)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginBottom: '12px'
              }} />
              <div style={{ fontSize: '12px', color: 'var(--gold, #d97706)', letterSpacing: '1px' }}>
                Carregando Imagem...
              </div>
            </div>
          )}

          <img
            className="modal-img"
            src={`/api/carousels/${carouselId}/image/${currentSlide}?token=${encodeURIComponent(localStorage.getItem('fo_token') || '')}&v=${imageVersion}`}
            alt="Slide"
            onLoad={() => setImageLoading(false)}
            onError={() => setImageLoading(false)}
            style={{
              ...(isMaximized ? {
                maxHeight: '85vh',
                maxWidth: '95vw',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.25)'
              } : {
                border: '1px solid rgba(255, 255, 255, 0.25)'
              }),
              opacity: imageLoading ? 0 : 1,
              transition: 'opacity 0.25s ease-in-out'
            }}
          />

          <div className="lb-zones">
            <div
              className={`lb-zone lb-zone-title ${selectedZone === 'title' ? 'selected' : ''}`}
              onClick={() => setSelectedZone('title')}
            >
              <span className="lb-zone-tag">✎ TÍTULO</span>
            </div>
            <div
              className={`lb-zone lb-zone-body ${selectedZone === 'body' ? 'selected' : ''}`}
              onClick={() => setSelectedZone('body')}
            >
              <span className="lb-zone-tag">✎ CORPO</span>
            </div>
          </div>
        </div>

        {editMode && !isMaximized && (
          <div className="lb-editor">
            <div className="lb-editor-header">
              <div className="lb-editor-subtitle">Editando elemento</div>
              <div className="lb-editor-fieldname">
                {selectedZone === 'title' ? 'TÍTULO' : selectedZone === 'body' ? 'CORPO' : 'SELECIONE'}
              </div>
            </div>
            <div className="lb-editor-body">
              {!selectedZone ? (
                <div className="lb-editor-prompt">
                  ← Clique em uma zona<br/>na imagem para editar
                </div>
              ) : (
                <>
                  <textarea
                    className="lb-editor-textarea"
                    value={selectedZone === 'title' ? meta.title : meta.body}
                    onChange={(e) => setMeta(prev => ({
                      ...prev,
                      [selectedZone === 'title' ? 'title' : 'body']: e.target.value
                    }))}
                  />
                  <div className="lb-editor-hint">Use \n para quebras de linha</div>
                  <div className="lb-editor-actions" style={{ display: 'flex' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setSelectedZone(null)}>Cancelar</button>
                    <button className="btn btn-gold btn-sm" onClick={handleSaveElement}>Salvar ↺</button>
                  </div>
                </>
              )}
            </div>
            <div className="lb-editor-footer">
              <button className="btn btn-outline btn-sm" onClick={() => onOpenEditModal(carouselId, currentSlide)}>
                ⚙ Editar completo
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="modal-nav">
        <button className="lb-nav-arrow" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          ‹
        </button>
        <div className="lb-nav-center">
          <span className="modal-caption">{index + 1} / {slides.length}</span>
          <div className="lb-nav-actions">
            <button className={`lb-action-btn ${isMaximized ? 'active' : ''}`} onClick={() => {
              setIsMaximized(!isMaximized);
              if (!isMaximized) setEditMode(false);
            }}>
              {isMaximized ? 'Minimizar' : '🔍 Maximizar'}
            </button>
            <button className="lb-action-btn" onClick={handleDownload}>Baixar</button>
            <button className="lb-action-btn" onClick={() => { onClose(); onOpenEditModal(carouselId, currentSlide); }}>Editar</button>
            <button className="lb-action-btn lb-action-del" onClick={() => setIsDeleteModalOpen(true)}>Excluir</button>
          </div>
        </div>
        <button className="lb-nav-arrow" disabled={index === slides.length - 1} onClick={() => setIndex(index + 1)}>
          ›
        </button>
      </div>

      {/* Popup de Confirmação de Exclusão Centralizado */}
      {isDeleteModalOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            style={{
              background: '#09090b',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              borderRadius: '12px',
              padding: '28px 32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 25px rgba(244, 63, 94, 0.15)',
              maxWidth: '400px',
              width: '100%',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(244, 63, 94, 0.12)',
              color: '#f43f5e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px'
            }}>
              ⚠️
            </div>
            <div>
              <div style={{ color: '#ffffff', fontSize: '17px', fontWeight: 'bold', marginBottom: '8px' }}>
                Excluir Slide
              </div>
              <div style={{ color: '#a1a1aa', fontSize: '13px', lineHeight: '1.5' }}>
                Tem certeza que deseja excluir permanentemente o <strong style={{ color: '#f43f5e' }}>Slide {index + 1}</strong> ({currentSlide})? Essa ação não pode ser desfeita.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
              <button 
                className="btn btn-outline" 
                style={{ flex: 1, padding: '10px 16px', borderColor: 'rgba(255,255,255,0.15)' }}
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, padding: '10px 16px', background: '#f43f5e', color: '#ffffff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

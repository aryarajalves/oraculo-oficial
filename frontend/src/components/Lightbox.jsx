import React, { useState, useEffect } from 'react';

export default function Lightbox({ isOpen, onClose, carouselId, slides = [], initialIndex = 0, onOpenEditModal, showToast }) {
  const [index, setIndex] = useState(initialIndex);
  const [editMode, setEditMode] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [meta, setMeta] = useState({ title: '', body: '' });
  const [isMaximized, setIsMaximized] = useState(false);
  const [imageVersion, setImageVersion] = useState(1);

  useEffect(() => {
    setIndex(initialIndex);
    setEditMode(false);
    setSelectedZone(null);
    setIsMaximized(false);
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

  // Pré-carregamento automático de todos os slides do carrossel na memória do navegador
  useEffect(() => {
    if (isOpen && carouselId && slides && slides.length > 0) {
      const token = encodeURIComponent(localStorage.getItem('fo_token') || '');
      slides.forEach((slideName) => {
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
      loadSlideMeta();
    }
  }, [index, isOpen, carouselId]);

  const loadSlideMeta = async () => {
    try {
      const res = await fetch(`/api/carousels/${carouselId}/slide/${slides[index]}/meta`);
      const data = await res.json();
      setMeta({ title: data.title || '', body: data.body || '' });
    } catch (e) {
      showToast('Erro ao carregar metadados do slide.');
    }
  };

  if (!isOpen || !slides || slides.length === 0) return null;

  const currentSlide = slides[index];

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

  const handleDelete = async () => {
    if (!confirm('Excluir este slide permanentemente?')) return;
    try {
      const res = await fetch(`/api/carousels/${carouselId}/slide/${currentSlide}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.ok) {
        showToast('Slide excluído com sucesso!');
        onClose();
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (e) {
      showToast('Erro ao excluir slide.');
    }
  };

  return (
    <div className={`modal-overlay ${editMode && !isMaximized ? 'lb-editing' : 'lb-editor-hidden'} open`}>
      <button className="modal-close" onClick={onClose}>✕</button>

      <div className="lb-container" style={isMaximized ? { maxHeight: '95vh', width: 'auto', display: 'block' } : {}}>
        <div className="lb-slide-wrap">
          <img
            className="modal-img"
            src={`/api/carousels/${carouselId}/image/${currentSlide}?token=${encodeURIComponent(localStorage.getItem('fo_token') || '')}&v=${imageVersion}`}
            alt="Slide"
            style={isMaximized ? {
              maxHeight: '85vh',
              maxWidth: '95vw',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.25)'
            } : {
              border: '1px solid rgba(255, 255, 255, 0.25)'
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
            <button className="lb-action-btn lb-action-del" onClick={handleDelete}>Excluir</button>
          </div>
        </div>
        <button className="lb-nav-arrow" disabled={index === slides.length - 1} onClick={() => setIndex(index + 1)}>
          ›
        </button>
      </div>
    </div>
  );
}

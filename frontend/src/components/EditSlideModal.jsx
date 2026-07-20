import React, { useState, useEffect, useRef } from 'react';
import { customFetch } from '../utils/customFetch';

const PRESET_DEFAULTS = {
  manuscrito_sagrado: { title: 76, body: 40 },
  sagrado: { title: 76, body: 40 },
  cinematografico: { title: 76, body: 40 },
  cinematografico_crimson: { title: 84, body: 38 },
  esoterico_minimalista: { title: 72, body: 38 },
  dramatico: { title: 84, body: 40 },
  etereo_luminoso: { title: 76, body: 40 }
};

export default function EditSlideModal({ isOpen, onClose, carouselId, filename, onChangeFilename, slides = [], showToast }) {
  const [activeTab, setActiveTab] = useState('text');
  const [slideMeta, setSlideMeta] = useState({ 
    title: '', 
    body: '', 
    prompt: '', 
    layout: 'fullbleed',
    title_y: '',
    body_y: '',
    watermark_pos: 'top_left',
    watermark_x: '',
    watermark_y: '',
    title_px: '',
    body_px: '',
    preset: 'sagrado'
  });
  const [saving, setSaving] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(Date.now());
  const previewRef = useRef(null);

  const handleDragStart = (e, element) => {
    e.preventDefault();
    if (!previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const scale = 1080 / 336; // scale from 336px preview to 1080px actual width

    const handleMouseMove = (moveEvent) => {
      const relativeY = moveEvent.clientY - rect.top;
      const relativeX = moveEvent.clientX - rect.left;
      
      const clampedY = Math.max(0, Math.min(420, relativeY));
      const clampedX = Math.max(0, Math.min(336, relativeX));
      
      const realY = Math.round(clampedY * scale);
      const realX = Math.round(clampedX * scale);

      setSlideMeta(prev => {
        const next = { ...prev };
        if (element === 'title') {
          next.title_y = realY;
        } else if (element === 'body') {
          next.body_y = realY;
        } else if (element === 'watermark') {
          next.watermark_pos = 'custom';
          next.watermark_x = realX;
          next.watermark_y = realY;
        }
        return next;
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (isOpen && carouselId && filename) {
      loadSlideMeta();
    }
  }, [isOpen, carouselId, filename]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const loadSlideMeta = async () => {
    try {
      const res = await customFetch(`/api/carousels/${carouselId}/slide/${filename}/meta`);
      if (res.ok) {
        const data = await res.json();
        setSlideMeta({
          title: data.title || '',
          body: data.body || '',
          prompt: data.prompt || '',
          layout: data.layout || 'fullbleed',
          title_y: data.title_y !== undefined && data.title_y !== null ? data.title_y : '',
          body_y: data.body_y !== undefined && data.body_y !== null ? data.body_y : '',
          watermark_pos: data.watermark_pos || 'top_left',
          watermark_x: data.watermark_x !== undefined && data.watermark_x !== null ? data.watermark_x : '',
          watermark_y: data.watermark_y !== undefined && data.watermark_y !== null ? data.watermark_y : '',
          title_px: data.title_px !== undefined && data.title_px !== null ? data.title_px : '',
          body_px: data.body_px !== undefined && data.body_px !== null ? data.body_px : '',
          preset: data.preset || 'sagrado'
        });
      }
    } catch (e) {
      showToast('Erro ao carregar metadados do slide.');
    }
  };

  const handleRecompose = async () => {
    setSaving(true);
    try {
      const res = await customFetch(`/api/carousels/${carouselId}/slide/${filename}/recompose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slideMeta)
      });
      const data = await res.json();
      if (data.ok) {
        showToast('Slide recomposto!');
        setCacheBuster(Date.now());
      } else {
        alert('Erro: ' + (data.error || 'desconhecido'));
      }
    } catch (e) {
      showToast('Erro ao recompor slide.');
    } finally {
      setSaving(false);
    }
  };

  const handleRegen = async () => {
    setSaving(true);
    try {
      const res = await customFetch(`/api/carousels/${carouselId}/slide/${filename}/regen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slideMeta)
      });
      const data = await res.json();
      if (data.ok) {
        showToast('Imagem gerada e slide recomposto!');
        setCacheBuster(Date.now());
      } else {
        alert('Erro: ' + (data.error || 'desconhecido'));
      }
    } catch (e) {
      showToast('Erro ao gerar nova imagem.');
    } finally {
      setSaving(false);
    }
  };

  const currentPreset = slideMeta.preset || 'sagrado';
  const defaultSizes = PRESET_DEFAULTS[currentPreset] || PRESET_DEFAULTS.sagrado;
  
  let defaultTitleY = 900;
  let defaultBodyY = 980;
  
  if (slideMeta.layout === 'dramatico') {
    defaultTitleY = 890;
    defaultBodyY = 970;
  } else if (slideMeta.layout === 'etereo') {
    defaultTitleY = 950;
    defaultBodyY = 1030;
  } else if (slideMeta.layout === 'text_only') {
    defaultTitleY = 460;
    defaultBodyY = 600;
  } else if (slideMeta.layout === 'card') {
    defaultTitleY = 720;
    defaultBodyY = 800;
  }

  if (!isOpen) return null;

  return (
    <div className="edit-modal open" id="edit-modal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.85)', zIndex: 1000 }}>
      <div className="edit-box" style={{ maxWidth: '1100px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface, #18181b)', border: '1px solid var(--border, #27272a)', borderRadius: '12px', overflow: 'hidden' }}>
        <div className="edit-header" style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div className="form-title" style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>EDITAR SLIDE</div>
            <div className="edit-filename" style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-3)' }}>{filename}</div>
          </div>
          {slides && slides.length > 0 && onChangeFilename && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.03)', padding: '6px 16px', borderRadius: '20px', border: '1px solid var(--border)' }}>
              {(() => {
                const currentIndex = slides.findIndex(s => (typeof s === 'string' ? s : s.filename) === filename);
                const prevSlide = currentIndex > 0 ? slides[currentIndex - 1] : null;
                const nextSlide = currentIndex < slides.length - 1 ? slides[currentIndex + 1] : null;
                const prevFilename = prevSlide ? (typeof prevSlide === 'string' ? prevSlide : prevSlide.filename) : null;
                const nextFilename = nextSlide ? (typeof nextSlide === 'string' ? nextSlide : nextSlide.filename) : null;
                return (
                  <>
                    <button 
                      className="btn btn-outline btn-sm" 
                      style={{ padding: '2px 10px', fontSize: '12px', minWidth: 'auto', cursor: prevFilename ? 'pointer' : 'not-allowed', opacity: prevFilename ? 1 : 0.4 }}
                      disabled={!prevFilename}
                      onClick={() => onChangeFilename(prevFilename)}
                    >
                      ← Voltar
                    </button>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--gold)', minWidth: '50px', textAlign: 'center' }}>
                      {currentIndex + 1} / {slides.length}
                    </span>
                    <button 
                      className="btn btn-outline btn-sm" 
                      style={{ padding: '2px 10px', fontSize: '12px', minWidth: 'auto', cursor: nextFilename ? 'pointer' : 'not-allowed', opacity: nextFilename ? 1 : 0.4 }}
                      disabled={!nextFilename}
                      onClick={() => onChangeFilename(nextFilename)}
                    >
                      Avançar →
                    </button>
                  </>
                );
              })()}
            </div>
          )}
          <button className="modal-close" onClick={onClose} style={{ position: 'static', background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', padding: '24px', overflow: 'hidden', flex: 1 }}>
          
          {/* Coluna Esquerda: Editor */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
            <div className="edit-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: 0, marginBottom: '20px' }}>
              <button className={`edit-tab ${activeTab === 'text' ? 'active' : ''}`} onClick={() => setActiveTab('text')}>Texto & Layout</button>
              <button className={`edit-tab ${activeTab === 'image' ? 'active' : ''}`} onClick={() => setActiveTab('image')}>Recriar Imagem</button>
            </div>

            {activeTab === 'text' ? (
              <div className="edit-panel-content">
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-2)' }}>Título</label>
                  <textarea className="form-textarea" style={{ minHeight: '80px', width: '100%', padding: '8px', background: '#09090b', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px' }} value={slideMeta.title} onChange={e => setSlideMeta(prev => ({ ...prev, title: e.target.value }))}></textarea>
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-2)' }}>Corpo</label>
                  <textarea className="form-textarea" style={{ minHeight: '120px', width: '100%', padding: '8px', background: '#09090b', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px' }} value={slideMeta.body} onChange={e => setSlideMeta(prev => ({ ...prev, body: e.target.value }))}></textarea>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-2)' }}>Tamanho do Título (px)</label>
                    <input 
                      type="number" 
                      placeholder={`${defaultSizes.title}px (Padrão)`} 
                      className="form-input" 
                      style={{ width: '100%', padding: '8px', background: '#09090b', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px' }} 
                      value={slideMeta.title_px} 
                      onChange={e => setSlideMeta(prev => ({ ...prev, title_px: e.target.value }))} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-2)' }}>Tamanho do Corpo (px)</label>
                    <input 
                      type="number" 
                      placeholder={`${defaultSizes.body}px (Padrão)`} 
                      className="form-input" 
                      style={{ width: '100%', padding: '8px', background: '#09090b', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px' }} 
                      value={slideMeta.body_px} 
                      onChange={e => setSlideMeta(prev => ({ ...prev, body_px: e.target.value }))} 
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox" 
                    id="hide-watermark" 
                    checked={slideMeta.watermark_pos === 'hidden'} 
                    onChange={e => setSlideMeta(prev => ({ ...prev, watermark_pos: e.target.checked ? 'hidden' : 'custom' }))}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="hide-watermark" style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-2)', cursor: 'pointer', margin: 0 }}>Ocultar Marca d'água</label>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-2)' }}>Layout do Slide</label>
                  <select className="form-select" style={{ width: '100%', padding: '8px', background: '#09090b', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px' }} value={slideMeta.layout} onChange={e => setSlideMeta(prev => ({ ...prev, layout: e.target.value }))}>
                    <option value="fullbleed">Inferior Centralizado (Fullbleed)</option>
                    <option value="dramatico">Esquerda Dramático (Dramático)</option>
                    <option value="etereo">Esquerda Luminoso (Etéreo)</option>
                    <option value="card">Texto Inferior com Card (Card)</option>
                    <option value="text_only">Apenas Texto (Text-Only)</option>
                  </select>
                  <p style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '8px', lineHeight: '1.4' }}>
                    * Arraste o Título, Corpo ou Marca d'água diretamente na visualização real-time à direita para alterar suas posições.
                  </p>
                </div>
                <div className="form-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button className="btn btn-outline" onClick={onClose}>Fechar</button>
                  <button className="btn btn-gold" onClick={handleRecompose} disabled={saving}>
                    {saving ? 'Salvando...' : 'Recompor Slide 🔄'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="edit-panel-content">
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-2)' }}>Prompt Visual</label>
                  <textarea className="form-textarea" style={{ minHeight: '180px', width: '100%', padding: '8px', background: '#09090b', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px' }} value={slideMeta.prompt} onChange={e => setSlideMeta(prev => ({ ...prev, prompt: e.target.value }))}></textarea>
                </div>
                <div className="form-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={onClose}>Fechar</button>
                  <button className="btn btn-gold" onClick={handleRegen} disabled={saving}>
                    {saving ? 'Gerando...' : 'Gerar Nova Imagem 🎨'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Coluna Direita: Renderização / Preview com Simulador */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#09090b', borderRadius: '8px', border: '1px solid var(--border)', padding: '16px', position: 'relative', minHeight: '450px' }}>
            <div style={{ position: 'absolute', top: '12px', left: '12px', fontSize: '11px', fontWeight: 'bold', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em', zIndex: 10 }}>👁️ RENDERIZAÇÃO REAL-TIME</div>
            
            {carouselId && filename ? (
              <div ref={previewRef} style={{ position: 'relative', width: '336px', height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '4px', border: '1px solid #27272a', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
                <img 
                  src={`/api/carousels/${carouselId}/image/${filename}?token=${encodeURIComponent(localStorage.getItem('fo_token') || '')}&t=${cacheBuster}`} 
                  alt="Preview" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                
                {/* Simulador de Posicionamento de Texto (Overlay) */}
                {activeTab === 'text' && (() => {
                  const scale = 336 / 1080;
                  
                  // Calcular valores estimados ou reais
                  let defaultTitleY = 900;
                  let defaultBodyY = 980;
                  
                  if (slideMeta.layout === 'dramatico') {
                    defaultTitleY = 890;
                    defaultBodyY = 970;
                  } else if (slideMeta.layout === 'etereo') {
                    defaultTitleY = 950;
                    defaultBodyY = 1030;
                  } else if (slideMeta.layout === 'text_only') {
                    defaultTitleY = 460;
                    defaultBodyY = 600;
                  } else if (slideMeta.layout === 'card') {
                    defaultTitleY = 720;
                    defaultBodyY = 800;
                  }
                  
                  const tY = slideMeta.title_y !== '' && slideMeta.title_y !== undefined && slideMeta.title_y !== null ? Number(slideMeta.title_y) : defaultTitleY;
                  const bY = slideMeta.body_y !== '' && slideMeta.body_y !== undefined && slideMeta.body_y !== null ? Number(slideMeta.body_y) : defaultBodyY;
                  
                  // Watermark Position Simulator
                  let wmX = 84;
                  let wmY = 48;
                  if (slideMeta.watermark_pos === 'top_right') {
                    wmX = 1080 - 84 - 180;
                    wmY = 48;
                  } else if (slideMeta.watermark_pos === 'bottom_left') {
                    wmX = 84;
                    wmY = 1350 - 80;
                  } else if (slideMeta.watermark_pos === 'bottom_right') {
                    wmX = 1080 - 84 - 180;
                    wmY = 1350 - 80;
                  }
                  
                  if (slideMeta.watermark_pos === 'custom') {
                    wmX = slideMeta.watermark_x !== '' && slideMeta.watermark_x !== null ? Number(slideMeta.watermark_x) : 84;
                    wmY = slideMeta.watermark_y !== '' && slideMeta.watermark_y !== null ? Number(slideMeta.watermark_y) : 48;
                  }
                  
                  const showWatermark = slideMeta.watermark_pos !== 'hidden';
                  
                  return (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                      {/* Guia do Título */}
                      <div 
                        onMouseDown={e => handleDragStart(e, 'title')}
                        style={{
                          position: 'absolute',
                          top: `${tY * scale}px`,
                          left: `${84 * scale}px`,
                          width: `${(1080 - 168) * scale}px`,
                          height: '24px',
                          border: '1.5px dashed #f97316',
                          backgroundColor: 'rgba(249, 115, 22, 0.25)',
                          color: '#ffedd5',
                          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          padding: '2px 4px',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '2px',
                          zIndex: 2,
                          pointerEvents: 'auto',
                          cursor: 'ns-resize',
                          userSelect: 'none'
                        }}
                      >
                        TÍTULO (Y: {tY})
                      </div>
                      
                      {/* Guia do Corpo */}
                      <div 
                        onMouseDown={e => handleDragStart(e, 'body')}
                        style={{
                          position: 'absolute',
                          top: `${bY * scale}px`,
                          left: `${84 * scale}px`,
                          width: `${(1080 - 168) * scale}px`,
                          height: '36px',
                          border: '1.5px dashed #06b6d4',
                          backgroundColor: 'rgba(6, 182, 212, 0.25)',
                          color: '#ecfeff',
                          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          padding: '2px 4px',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '2px',
                          zIndex: 2,
                          pointerEvents: 'auto',
                          cursor: 'ns-resize',
                          userSelect: 'none'
                        }}
                      >
                        CORPO (Y: {bY})
                      </div>
                      
                      {/* Guia do Watermark */}
                      {showWatermark && (
                        <div 
                          onMouseDown={e => handleDragStart(e, 'watermark')}
                          style={{
                            position: 'absolute',
                            top: `${wmY * scale}px`,
                            left: `${wmX * scale}px`,
                            width: `${180 * scale}px`,
                            height: `${38 * scale}px`,
                            border: '1.5px dashed #eab308',
                            backgroundColor: 'rgba(234, 179, 8, 0.25)',
                            color: '#fef9c3',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                            fontSize: '8px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '2px',
                            zIndex: 2,
                            pointerEvents: 'auto',
                            cursor: 'move',
                            userSelect: 'none'
                          }}
                        >
                          @afonteoculta
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div style={{ color: 'var(--text-3)' }}>Carregando imagem...</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

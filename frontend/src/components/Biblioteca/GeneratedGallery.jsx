// frontend/src/components/Biblioteca/GeneratedGallery.jsx — Galeria de imagens geradas pela IA
import React from 'react';

export default function GeneratedGallery({
  generatedImages = [],
  onPreviewImage,
  onSaveToLibrary,
  showToast
}) {
  const handleDownload = (url, filename) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `gerada_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (showToast) showToast('Download iniciado!');
    } catch {
      if (showToast) showToast('Erro ao baixar imagem.');
    }
  };

  if (generatedImages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3, #a1a1aa)' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎨</div>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '6px' }}>
          Nenhuma imagem gerada ainda
        </div>
        <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
          Converse com o Assistente de Criação na aba ao lado para gerar novas imagens com IA.
        </div>
      </div>
    );
  }

  return (
    <div className="generated-gallery-container">
      {generatedImages.map((item, idx) => (
        <div key={item.id || idx} className="gen-card">
          <div className="gen-card-thumb-wrap" onClick={() => onPreviewImage({ url: item.imageUrl, title: item.prompt })}>
            <img
              src={item.imageUrl}
              alt={item.prompt || 'Imagem Gerada'}
              className="gen-card-thumb"
              loading="lazy"
            />
          </div>

          <div className="gen-card-footer">
            <span className="gen-card-prompt" title={item.prompt || item.generatedPrompt}>
              {item.prompt || item.generatedPrompt || 'Geração IA'}
            </span>

            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <button
                className="chat-ai-action-btn btn-save-lib"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => onSaveToLibrary(item)}
                title="Salvar na Biblioteca"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Salvar
              </button>

              <button
                className="chat-ai-action-btn"
                onClick={() => handleDownload(item.imageUrl, item.filename)}
                title="Baixar imagem"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

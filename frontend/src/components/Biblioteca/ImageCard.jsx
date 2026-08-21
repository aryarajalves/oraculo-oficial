// frontend/src/components/Biblioteca/ImageCard.jsx — Card individual de imagem na galeria
import React from 'react';

function formatUploadDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function ImageCard({
  image,
  isReference,
  isBatchSelected,
  onToggleReference,
  onToggleBatchSelect,
  onPreview,
  onEdit,
  onDelete,
  showToast
}) {
  const handleCopyUrl = (e) => {
    e.stopPropagation();
    const fullUrl = `${window.location.origin}${image.url}`;
    navigator.clipboard.writeText(fullUrl);
    if (showToast) showToast('Link da imagem copiado!');
  };

  const uploadDate = formatUploadDate(image.created_at || image.createdAt);

  return (
    <div className={`lib-card ${isReference ? 'is-reference' : ''} ${isBatchSelected ? 'is-batch-selected' : ''}`}>
      <div className="lib-card-thumb-wrap" onClick={() => onPreview(image)}>
        {/* Checkbox de Seleção em Lote (Deleção/Gestão) */}
        <button
          type="button"
          className={`lib-batch-checkbox ${isBatchSelected ? 'active' : ''}`}
          title={isBatchSelected ? 'Desmarcar da seleção' : 'Selecionar para exclusão em lote'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleBatchSelect(image.id);
          }}
        >
          {isBatchSelected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {/* Botão de Referência IA (Entrada de Chat - Máx 5) */}
        <button
          type="button"
          className={`lib-reference-btn ${isReference ? 'active' : ''}`}
          title={isReference ? 'Remover das referências IA' : 'Usar como referência IA (Máx 5)'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleReference(image);
          }}
        >
          <span>✨</span>
        </button>

        {/* Botão Visualizar em Tamanho Real */}
        <button
          type="button"
          className="lib-card-action-icon"
          title="Visualizar em tamanho real"
          onClick={(e) => {
            e.stopPropagation();
            onPreview(image);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>

        <img
          src={image.url}
          alt={image.title}
          className="lib-card-thumb"
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='250' viewBox='0 0 200 250'%3E%3Crect width='200' height='250' fill='%2318181b'/%3E%3Ctext x='50%25' y='50%25' fill='%2371717a' font-size='12' text-anchor='middle' dy='.3em'%3EImagem Indispon%C3%ADvel%3C/text%3E%3C/svg%3E";
          }}
        />
      </div>

      <div className="lib-card-body">
        <div className="lib-card-header-row">
          <span className="lib-card-title" title={image.title}>
            {image.title}
          </span>
          <button
            className="lib-btn-icon-edit"
            title="Editar informações"
            onClick={() => onEdit(image)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
        </div>

        {uploadDate && (
          <div className="lib-card-date" title={`Upload realizado em: ${uploadDate}`}>
            <span className="lib-card-date-icon">🕒</span>
            <span>{uploadDate}</span>
          </div>
        )}

        <div className="lib-card-bottom-row">
          <button className="lib-btn-copy-url" onClick={handleCopyUrl}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            Copiar URL
          </button>

          <button
            className="lib-btn-icon-danger"
            title="Excluir imagem"
            onClick={() => onDelete(image)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

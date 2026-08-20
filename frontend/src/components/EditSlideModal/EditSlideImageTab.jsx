import React from 'react';

export default function EditSlideImageTab({
  slideMeta,
  setSlideMeta,
  saving,
  onClose,
  handleRegen
}) {
  return (
    <div className="edit-panel-content">
      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-2)' }}>Prompt Visual</label>
        <textarea 
          className="form-textarea" 
          style={{ minHeight: '180px', width: '100%', padding: '8px', background: '#09090b', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px' }} 
          value={slideMeta.prompt} 
          onChange={e => setSlideMeta(prev => ({ ...prev, prompt: e.target.value }))}
        />
      </div>
      <div className="form-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-outline" onClick={onClose}>Fechar</button>
        <button type="button" className="btn btn-gold" onClick={handleRegen} disabled={saving}>
          {saving ? 'Gerando...' : 'Gerar Nova Imagem 🎨'}
        </button>
      </div>
    </div>
  );
}

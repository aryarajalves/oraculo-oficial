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
      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-2)' }}>Prompt Visual</label>
        <textarea 
          className="form-textarea" 
          style={{ minHeight: '140px', width: '100%', padding: '8px', background: '#09090b', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px' }} 
          value={slideMeta.prompt} 
          onChange={e => setSlideMeta(prev => ({ ...prev, prompt: e.target.value }))}
          placeholder="Descreva a cena visual que deseja gerar..."
        />
      </div>

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-2)' }}>Formato de Exibição (Layout do Slide)</label>
        <select 
          className="form-select" 
          style={{ width: '100%', padding: '8px', background: '#09090b', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px' }} 
          value={slideMeta.layout} 
          onChange={e => setSlideMeta(prev => ({ ...prev, layout: e.target.value }))}
        >
          <option value="dramatico">Esquerda Dramático (Dramático — Imagem na tela cheia com texto alinhado à esquerda)</option>
          <option value="fullbleed">Inferior Centralizado (Fullbleed — Imagem na tela cheia com texto centralizado)</option>
          <option value="etereo">Esquerda Luminoso (Etéreo — Imagem suave na tela cheia)</option>
          <option value="card">Moldura Retangular (Card — Imagem dentro da caixa superior com texto embaixo)</option>
          <option value="text_only">Apenas Texto (Sem imagem)</option>
        </select>
        <p style={{ color: 'var(--gold)', fontSize: '11px', marginTop: '6px', lineHeight: '1.4' }}>
          {slideMeta.layout === 'card' 
            ? '📌 Modo Moldura (Card): a imagem é cortada e encaixada dentro de uma caixa com borda dourada.'
            : '✨ Modo Tela Cheia: a imagem preenche todo o fundo do slide com gradiente escuro profissional para destacar o título e o texto.'}
        </p>
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

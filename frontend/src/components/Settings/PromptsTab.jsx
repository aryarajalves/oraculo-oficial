import React, { useState } from 'react';

export default function PromptsTab({
  prompts,
  selectedPromptId,
  promptContent,
  setPromptContent,
  promptSaving,
  handleSelectPrompt,
  handleSavePrompt,
  isMaximized,
  setIsMaximized,
  isRenaming,
  setIsRenaming,
  tempName,
  setTempName,
  handleRenamePrompt,
  activePrompt,
  editorStyles
}) {
  const [editingListId, setEditingListId] = useState(null);
  const [listTempName, setListTempName] = useState('');

  const categorizePrompt = (id) => {
    const textCopyIds = ['oraculo-v2', 'oraculo-haucacau', 'gancho-viral', 'humanizer', 'cta-desbloqueio-neural'];
    const designVisualIds = ['canalizador-visual', 'diretor-de-arte', 'visual-dna', 'visual-dna-haucacau'];
    
    if (textCopyIds.includes(id)) return 'Texto & Copy';
    if (designVisualIds.includes(id)) return 'Design & Visual';
    return 'Revisão & Gestão';
  };

  const groupedPrompts = {
    'Texto & Copy': [],
    'Design & Visual': [],
    'Revisão & Gestão': []
  };

  prompts.forEach(p => {
    const category = categorizePrompt(p.id);
    if (!groupedPrompts[category]) groupedPrompts[category] = [];
    groupedPrompts[category].push(p);
  });

  const handleSaveListRename = async (id) => {
    if (!listTempName.trim()) return;
    await handleRenamePrompt(id, listTempName.trim());
    setEditingListId(null);
  };

  return (
    <div className="prompts-settings-container" style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 240px)', minHeight: '450px' }}>
      {/* Painel da Esquerda: Lista de Agentes com Opção de Editar Nome */}
      <div className="prompts-list-panel" style={{ width: '280px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
        {Object.entries(groupedPrompts).map(([categoryName, items]) => (
          <div key={categoryName} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.12em', padding: '4px 8px 6px' }}>{categoryName}</div>
            {items.map(p => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: selectedPromptId === p.id ? 'var(--crimson-d)' : 'transparent',
                  borderRadius: '6px',
                  padding: '2px 4px',
                  transition: 'background 0.15s'
                }}
              >
                {editingListId === p.id ? (
                  <div style={{ display: 'flex', gap: '4px', width: '100%', alignItems: 'center', padding: '4px' }}>
                    <input
                      type="text"
                      value={listTempName}
                      onChange={(e) => setListTempName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveListRename(p.id);
                        if (e.key === 'Escape') setEditingListId(null);
                      }}
                      autoFocus
                      style={{
                        flex: 1,
                        background: '#09090b',
                        color: '#fff',
                        border: '1px solid var(--gold)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                    />
                    <button
                      className="btn btn-gold"
                      style={{ padding: '3px 8px', fontSize: '10px' }}
                      onClick={() => handleSaveListRename(p.id)}
                      title="Salvar Nome"
                    >
                      ✓
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '3px 8px', fontSize: '10px' }}
                      onClick={() => setEditingListId(null)}
                      title="Cancelar"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleSelectPrompt(p.id)}
                      onDoubleClick={() => {
                        handleSelectPrompt(p.id);
                        setEditingListId(p.id);
                        setListTempName(p.name);
                      }}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        background: 'transparent',
                        color: selectedPromptId === p.id ? 'var(--crimson)' : 'var(--text-2)',
                        border: 'none',
                        padding: '8px 8px',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={`${p.name} (Dar duplo clique para editar)`}
                    >
                      {p.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPrompt(p.id);
                        setEditingListId(p.id);
                        setListTempName(p.name);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: selectedPromptId === p.id ? 'var(--gold)' : 'var(--text-3)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'opacity 0.2s, color 0.2s'
                      }}
                      title={`Editar nome do agente "${p.name}"`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Painel da Direita: Editor do Prompt */}
      <div className="prompt-editor-panel" style={editorStyles}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isRenaming ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenamePrompt();
                    if (e.key === 'Escape') setIsRenaming(false);
                  }}
                  autoFocus
                  style={{
                    background: '#09090b',
                    color: '#fff',
                    border: '1px solid var(--gold)',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                <button className="btn btn-gold" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleRenamePrompt()}>Salvar</button>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => setIsRenaming(false)}>Cancelar</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                  {activePrompt?.name || 'Editor de Prompt'}
                </div>
                <button
                  onClick={() => { setTempName(activePrompt?.name || ''); setIsRenaming(true); }}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-2)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    transition: 'all 0.2s'
                  }}
                  title="Renomear Agente"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  Renomear
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              Arquivo: agents/{selectedPromptId}.md
            </div>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-2)',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {isMaximized ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>
                  Minimizar
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                  Maximizar
                </>
              )}
            </button>
            {isMaximized && (
              <button className="btn btn-gold" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={handleSavePrompt} disabled={promptSaving}>
                {promptSaving ? 'Salvando...' : 'Salvar Prompt'}
              </button>
            )}
          </div>
        </div>
        <textarea
          value={promptContent}
          onChange={(e) => setPromptContent(e.target.value)}
          style={{
            flex: 1,
            background: '#09090b',
            color: '#e4e4e7',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '14px',
            fontSize: '13px',
            fontFamily: 'monospace',
            lineHeight: '1.6',
            resize: 'none',
            outline: 'none',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
          }}
          placeholder="Selecione um prompt ou aguarde o carregamento..."
        />
      </div>
    </div>
  );
}

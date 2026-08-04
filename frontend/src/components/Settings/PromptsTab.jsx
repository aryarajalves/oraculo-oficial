import React, { useState, useRef } from 'react';

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
  editorStyles,
  showToast
}) {
  const [editingListId, setEditingListId] = useState(null);
  const [listTempName, setListTempName] = useState('');

  const textareaRef = useRef(null);
  const gutterRef = useRef(null);

  const handleScroll = () => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

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

  const lineCount = promptContent ? promptContent.split('\n').length : 1;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  // ── Export / Import JSON ──────────────────────────────────────────────────
  const importInputRef = useRef(null);

  const handleExport = async () => {
    try {
      if (showToast) showToast('Gerando exportação de todos os prompts...');
      const res = await fetch('/api/settings/prompts', { credentials: 'include' });
      const data = await res.json();
      const allPrompts = data.prompts || prompts;

      const exportData = allPrompts.map(p => ({
        id: p.id,
        name: p.name,
        content: p.content || ''
      }));

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oraculo-prompts-todos-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      if (showToast) showToast(`✓ ${exportData.length} prompt(s) exportado(s) com sucesso!`);
    } catch (err) {
      if (showToast) showToast('Erro ao exportar prompts: ' + err.message);
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed)) throw new Error('Formato inválido: esperado um array de prompts.');
        let count = 0;
        if (showToast) showToast(`Importando ${parsed.length} prompt(s)...`);
        for (const entry of parsed) {
          if (!entry.id || entry.content === undefined) continue;
          await fetch('/api/settings/prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: entry.id, content: entry.content }),
            credentials: 'include'
          });
          if (entry.name) {
            await fetch('/api/settings/prompts/rename', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: entry.id, name: entry.name }),
              credentials: 'include'
            });
          }
          count++;
        }
        // Se a função de recarregar a lista existir no componente pai ou recarregar a página
        if (showToast) showToast(`✓ ${count} prompt(s) importado(s) e salvos com sucesso! Recarregando...`);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (err) {
        if (showToast) showToast('Erro ao importar: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="prompts-settings-container" style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 240px)', minHeight: '450px' }}>
      {/* Painel da Esquerda: Lista de Agentes */}
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

      {/* Painel da Direita: Editor do Prompt com Numeração de Linhas */}
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
              Arquivo: agents/{selectedPromptId}.md · {lineCount} linha(s)
            </div>
            <button
              onClick={handleExport}
              title="Exportar todos os prompts como JSON"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-2)',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Exportar
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
            <button
              onClick={() => importInputRef.current?.click()}
              title="Importar prompts de um arquivo JSON"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-2)',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Importar
            </button>
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

        {/* Editor de Texto com Numerador de Linhas */}
        <div
          className="code-editor-container"
          style={{
            flex: 1,
            display: 'flex',
            background: '#09090b',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            overflow: 'hidden',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
          }}
        >
          {/* Gutter / Coluna de Linhas */}
          <div
            ref={gutterRef}
            style={{
              padding: '14px 10px 14px 12px',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRight: '1px solid var(--border)',
              color: 'var(--text-3)',
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.6',
              textAlign: 'right',
              userSelect: 'none',
              overflowY: 'hidden',
              minWidth: '45px',
              boxSizing: 'border-box'
            }}
          >
            {lineNumbers.map(num => (
              <div key={num} style={{ opacity: 0.5 }}>{num}</div>
            ))}
          </div>

          {/* Área de Texto */}
          <textarea
            ref={textareaRef}
            value={promptContent}
            onChange={(e) => setPromptContent(e.target.value)}
            onScroll={handleScroll}
            style={{
              flex: 1,
              background: 'transparent',
              color: '#e4e4e7',
              border: 'none',
              padding: '14px',
              fontSize: '13px',
              fontFamily: 'monospace',
              lineHeight: '1.6',
              resize: 'none',
              outline: 'none',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              overflowX: 'hidden',
              wordBreak: 'break-word'
            }}
            placeholder="Selecione um prompt ou aguarde o carregamento..."
          />
        </div>
      </div>
    </div>
  );
}

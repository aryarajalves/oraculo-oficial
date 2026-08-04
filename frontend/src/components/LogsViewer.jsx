import React, { useState, useEffect } from 'react';
import { customFetch } from '../utils/customFetch';
import { useScrollLock } from '../hooks/useScrollLock';

// ── Modal de confirmação customizado ──────────────────────────────────────────
function ConfirmModal({ isOpen, title, description, confirmLabel = 'Confirmar', danger = true, onConfirm, onCancel }) {
  useScrollLock(isOpen);

  if (!isOpen) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          padding: '32px 36px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
          animation: 'modalPop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Ícone */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: danger ? 'rgba(244, 63, 94, 0.15)' : 'rgba(251, 191, 36, 0.15)',
            border: `1px solid ${danger ? 'rgba(244, 63, 94, 0.4)' : 'rgba(251, 191, 36, 0.4)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px'
          }}>
            {danger ? '🗑️' : '⚠️'}
          </div>
        </div>

        {/* Título */}
        <h3 style={{
          color: '#ffffff', fontSize: '18px', fontWeight: '700',
          textAlign: 'center', margin: '0 0 10px 0', letterSpacing: '-0.3px'
        }}>{title}</h3>

        {/* Descrição */}
        <p style={{
          color: 'rgba(255,255,255,0.55)', fontSize: '14px', lineHeight: '1.6',
          textAlign: 'center', margin: '0 0 28px 0'
        }}>{description}</p>

        {/* Botões */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#e4e4e7', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.06)'}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              background: danger ? 'rgba(244, 63, 94, 0.85)' : 'rgba(251, 191, 36, 0.85)',
              border: 'none',
              color: danger ? '#fff' : '#000', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: danger ? '0 4px 20px rgba(244, 63, 94, 0.35)' : '0 4px 20px rgba(251,191,36,0.35)'
            }}
            onMouseEnter={e => e.target.style.opacity = '0.85'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.88) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
// ──────────────────────────────────────────────────────────────────────────────

export default function LogsViewer({ showToast }) {
  const [logs, setLogs] = useState([]);
  const [rawLogs, setRawLogs] = useState([]);
  const [totalLines, setTotalLines] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [activeQuickFilters, setActiveQuickFilters] = useState([]);
  const [selectedLines, setSelectedLines] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal para colar manualmente
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [manualLogs, setManualLogs] = useState('');

  // Modal de confirmação customizado
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', description: '', confirmLabel: 'Confirmar', danger: true, onConfirm: null });

  const openConfirm = ({ title, description, confirmLabel = 'Confirmar', danger = true, onConfirm }) => {
    setConfirmModal({ isOpen: true, title, description, confirmLabel, danger, onConfirm });
  };
  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));


  const quickFilters = [
    { label: 'Requisições HTTP', tag: 'HTTP' },
    { label: 'Banco de Dados', tag: 'DB' },
    { label: 'Carrosséis', tag: 'Carousel' },
    { label: 'Backups', tag: 'Backup' },
    { label: 'Autenticação', tag: 'AUTH' },
    { label: 'MinIO / Storage', tag: 'B2' },
    { label: 'Servidor', tag: 'SERVER' }
  ];

  const levels = ['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'];

  const loadLogs = async () => {
    setLoading(true);
    try {
      let queryParams = [];
      if (selectedDate) {
        queryParams.push(`date=${selectedDate}`);
      }
      if (searchText) {
        queryParams.push(`search=${encodeURIComponent(searchText)}`);
      }
      const queryStr = queryParams.length > 0 ? '?' + queryParams.join('&') : '';
      const res = await customFetch(`/api/logs${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        const list = data.logs || [];
        setTotalLines(data.totalLines || 0);
        setAvailableDates(data.availableDates || []);
        setRawLogs(list);
        
        if (data.selectedDate) {
          setSelectedDate(data.selectedDate);
        }
      }
    } catch (e) {
      showToast('Erro ao carregar logs do servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [selectedDate]);

  useEffect(() => {
    let list = [...rawLogs];

    // 1. Filtro de Nível
    if (selectedLevel !== 'all') {
      list = list.filter(l => l.level === selectedLevel);
    }

    // 2. Filtros rápidos múltiplos (OR entre as tags selecionadas)
    if (activeQuickFilters.length > 0) {
      list = list.filter(l => l.tag && activeQuickFilters.some(tag => tag.toUpperCase() === l.tag.toUpperCase()));
    }

    // 3. Filtro de horário local (front-end)
    if (timeFrom || timeTo) {
      list = list.filter(l => {
        if (!l.datetime) return false;
        const timePart = l.datetime.split(' ')[1];
        if (!timePart) return false;
        if (timeFrom && timePart < timeFrom) return false;
        if (timeTo && timePart > timeTo) return false;
        return true;
      });
    }

    setLogs(list);
  }, [rawLogs, selectedLevel, activeQuickFilters, timeFrom, timeTo]);

  const handleDeleteLines = (ids) => {
    openConfirm({
      title: 'Excluir linha(s) de log',
      description: `Tem certeza que deseja excluir ${ids.length} linha(s) de log? Esta ação não pode ser desfeita.`,
      confirmLabel: `Excluir ${ids.length} linha(s)`,
      danger: true,
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await customFetch('/api/logs/delete-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
          });
          if (res.ok) {
            showToast('Linhas de log excluídas com sucesso.');
            setSelectedLines(prev => prev.filter(id => !ids.includes(id)));
            loadLogs();
          }
        } catch (err) {
          showToast('Erro ao excluir linhas de log.');
        }
      }
    });
  };

  const handleClearServerLogs = () => {
    openConfirm({
      title: 'Apagar todos os logs',
      description: 'Esta ação irá APAGAR permanentemente todos os logs no servidor. Esta ação não pode ser desfeita.',
      confirmLabel: 'Apagar tudo',
      danger: true,
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await customFetch('/api/logs', { method: 'DELETE' });
          if (res.ok) {
            showToast('Logs limpos com sucesso no servidor.');
            setLogs([]);
            setTotalLines(0);
          }
        } catch (err) {
          showToast('Erro ao limpar logs.');
        }
      }
    });
  };

  const handleCopyLogs = () => {
    const selectedList = logs.filter(l => selectedLines.includes(l.id));
    const listToCopy = selectedList.length > 0 ? selectedList : logs;
    const text = listToCopy.map(l => `${l.datetime} [${l.level}] [${l.tag}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    showToast(`✓ ${listToCopy.length} linhas copiadas para a área de transferência.`);
  };

  const handleDownloadLogs = () => {
    const selectedList = logs.filter(l => selectedLines.includes(l.id));
    const listToDownload = selectedList.length > 0 ? selectedList : logs;
    const text = listToDownload.map(l => `${l.datetime} [${l.level}] [${l.tag}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${selectedDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePasteManually = () => {
    if (!manualLogs.trim()) return;
    const rawLines = manualLogs.split('\n').filter(Boolean);
    const parsed = rawLines.map((line, idx) => {
      const parts = line.split(' - ');
      if (parts.length >= 4) {
        return { id: idx + 1, datetime: parts[0], tag: parts[1], level: parts[2], message: parts.slice(3).join(' - ') };
      }
      return { id: idx + 1, datetime: new Date().toLocaleTimeString(), tag: 'MANUAL', level: 'INFO', message: line };
    });
    setLogs(parsed);
    setTotalLines(parsed.length);
    setIsPasteModalOpen(false);
    showToast('Logs colados manualmente carregados!');
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLines(logs.map(l => l.id));
    } else {
      setSelectedLines([]);
    }
  };

  const handleSelectLine = (id) => {
    setSelectedLines(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="section-logs" style={{ padding: '24px', color: '#e4e4e7' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#ffffff', margin: 0 }}>Visualizador de Logs</h2>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: '#22c55e', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '4px' }}>
            ✓ {logs.length} linhas — pag. 1/1
          </div>
        </div>
      </div>

      {/* Main filters bar */}
      <div style={{ background: 'var(--surface, #18181b)', border: '1px solid var(--border, #27272a)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
          <select
            className="form-input"
            style={{ width: '150px', background: '#09090b', color: '#fff', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '6px', height: '36px' }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            {availableDates.length === 0 ? (
              <option value="">Nenhuma data</option>
            ) : (
              availableDates.map(d => (
                <option key={d} value={d}>{d}</option>
              ))
            )}
          </select>
          <button className="btn btn-gold" onClick={loadLogs}>
            🔄 Carregar {selectedDate}
          </button>
          
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }}></div>

          <button className="btn btn-outline" onClick={() => setIsPasteModalOpen(true)}>📋 Colar manualmente</button>
          <button className="btn btn-outline" onClick={() => {
            setSearchText('');
            setTimeFrom('');
            setTimeTo('');
            setSelectedLevel('all');
            setActiveQuickFilters([]);
            loadLogs();
            showToast('Filtros limpos.');
          }}>🧹 Limpar</button>

          <button className="btn btn-danger" style={{ marginLeft: 'auto', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid var(--red)', color: 'var(--red)' }} onClick={handleClearServerLogs}>
            🗑 Apagar log no servidor
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{totalLines} linhas totais</span>
        </div>

        {/* Quick filters tags */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: '8px', fontWeight: 'bold' }}>⚡ FILTROS RÁPIDOS</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {quickFilters.map(qf => {
              const isSelected = activeQuickFilters.includes(qf.tag);
              return (
                <button
                  key={qf.tag}
                  onClick={() => {
                    setActiveQuickFilters(prev =>
                      isSelected ? prev.filter(t => t !== qf.tag) : [...prev, qf.tag]
                    );
                  }}
                  style={{
                    background: isSelected ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.03)',
                    border: isSelected ? '1px solid var(--gold)' : '1px solid rgba(255,255,255,0.08)',
                    color: isSelected ? 'var(--gold)' : '#e4e4e7',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  📁 {qf.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Inputs row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Horário De</label>
            <input type="time" className="form-input" style={{ width: '100%', background: '#09090b', color: '#fff', border: '1px solid var(--border)' }} value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Horário Até</label>
            <input type="time" className="form-input" style={{ width: '100%', background: '#09090b', color: '#fff', border: '1px solid var(--border)' }} value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Busca no Texto</label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', background: '#09090b', color: '#fff', border: '1px solid var(--border)' }}
              placeholder="Buscar ou pressionar Enter..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
            />
          </div>
        </div>

        {/* Levels row */}
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: '8px', fontWeight: 'bold' }}>NÍVEL</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setSelectedLevel('all')}
              style={{
                background: selectedLevel === 'all' ? 'var(--gold)' : 'rgba(255,255,255,0.03)',
                color: selectedLevel === 'all' ? '#000' : '#e4e4e7',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              TODOS ({rawLogs.length})
            </button>
            {levels.map(lvl => {
              const count = rawLogs.filter(l => l.level === lvl).length;
              return (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  style={{
                    background: selectedLevel === lvl ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.03)',
                    color: '#e4e4e7',
                    border: selectedLevel === lvl ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                    padding: '6px 14px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {lvl} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Logs Table Box */}
      <div style={{ background: 'var(--surface, #18181b)', border: '1px solid var(--border, #27272a)', borderRadius: '12px', overflow: 'hidden' }}>
        
        {/* Table actions header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
            {logs.length} / {totalLines} LINHAS • {selectedDate}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {selectedLines.length > 0 && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDeleteLines(selectedLines)}
                style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid var(--red)', color: 'var(--red)', marginRight: '8px', padding: '4px 10px', fontSize: '11px' }}
              >
                🗑 Excluir Selecionados ({selectedLines.length})
              </button>
            )}
            <button className="btn btn-outline btn-sm" onClick={handleCopyLogs}>📋 Copiar</button>
            <button className="btn btn-outline btn-sm" onClick={handleDownloadLogs}>📥 Download</button>
          </div>
        </div>

        {/* Logs list */}
        <div style={{ maxHeight: '500px', overflowY: 'auto', background: '#09090b', padding: '12px 0', fontFamily: 'monospace', fontSize: '12px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>
              <div className="slide-thumb-spinner" style={{ display: 'inline-block', width: '20px', height: '20px', marginBottom: '10px' }}></div>
              <div>Carregando logs do servidor...</div>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>Nenhum log encontrado para os critérios selecionados.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Header Row */}
              <div style={{ display: 'flex', padding: '8px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: 'var(--text-3)', fontWeight: 'bold' }}>
                <input type="checkbox" style={{ marginRight: '16px' }} onChange={handleSelectAll} checked={selectedLines.length === logs.length && logs.length > 0} />
                <div style={{ width: '40px', textAlign: 'right', marginRight: '16px' }}>#</div>
                <div style={{ width: '80px', marginRight: '16px' }}>NÍVEL</div>
                <div style={{ width: '150px', marginRight: '16px' }}>DATA/HORA</div>
                <div style={{ flex: 1 }}>MENSAGEM</div>
                <div style={{ width: '60px', textAlign: 'center' }}>AÇÕES</div>
              </div>
              
              {/* Logs Data */}
              {logs.map((l, idx) => {
                let lvlColor = '#a1a1aa';
                if (l.level === 'ERROR' || l.level === 'CRITICAL') lvlColor = 'var(--red, #f43f5e)';
                if (l.level === 'WARNING') lvlColor = 'var(--gold, #e0a96d)';
                if (l.level === 'INFO') lvlColor = 'var(--cyan, #38bdf8)';
                if (l.level === 'DEBUG') lvlColor = '#818cf8';

                return (
                  <div
                    key={l.id}
                    style={{
                      display: 'flex',
                      padding: '6px 20px',
                      background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                      alignItems: 'flex-start',
                      borderBottom: '1px solid rgba(255,255,255,0.02)'
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ marginRight: '16px', marginTop: '2px' }}
                      checked={selectedLines.includes(l.id)}
                      onChange={() => handleSelectLine(l.id)}
                    />
                    <div style={{ width: '40px', textAlign: 'right', marginRight: '16px', color: 'var(--text-3)' }}>{l.id}</div>
                    <div style={{ width: '80px', marginRight: '16px' }}>
                      <span style={{
                        background: `${lvlColor}15`,
                        border: `1px solid ${lvlColor}30`,
                        color: lvlColor,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '9px',
                        fontWeight: 'bold'
                      }}>
                        {l.level}
                      </span>
                    </div>
                    <div style={{ width: '150px', marginRight: '16px', color: 'var(--text-3)' }}>{l.datetime}</div>
                    <div style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#e4e4e7' }}>
                      {l.tag ? <span style={{ color: 'var(--gold, #e0a96d)', marginRight: '6px' }}>[{l.tag}]</span> : null}
                      {l.message}
                    </div>
                    <div style={{ width: '60px', display: 'flex', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleDeleteLines([l.id])}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--red, #f43f5e)',
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '0 8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0.7,
                          transition: 'opacity 0.15s'
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = 1}
                        onMouseLeave={(e) => e.target.style.opacity = 0.7}
                        title="Excluir Linha"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal para colar logs manualmente */}
      {isPasteModalOpen && (
        <div className="form-modal open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.85)', zIndex: 1000 }}>
          <div className="form-box" style={{ maxWidth: '650px', width: '100%' }}>
            <h3 className="form-title">Colar Logs Manualmente</h3>
            <p style={{ color: 'var(--text-3)', fontSize: '12px', marginBottom: '14px' }}>
              Cole linhas de log abaixo. Se estiverem no formato do sistema (ex: <code style={{ color: 'var(--gold)' }}>DD/MM/YYYY HH:MM:SS - TAG - LEVEL - MSG</code>), eles serão filtrados adequadamente.
            </p>
            <textarea
              className="form-textarea"
              style={{ height: '300px', width: '100%', fontFamily: 'monospace', fontSize: '11px', background: '#09090b', color: '#fff', border: '1px solid var(--border)' }}
              placeholder="Cole os logs aqui..."
              value={manualLogs}
              onChange={(e) => setManualLogs(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button className="btn btn-outline" onClick={() => setIsPasteModalOpen(false)}>Cancelar</button>
              <button className="btn btn-gold" onClick={handlePasteManually}>Carregar Logs</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de confirmação customizado */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        danger={confirmModal.danger}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';

export default function PipelineModal({ carousel, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedPromptKey, setCopiedPromptKey] = useState(null);
  const [pipelineInfo, setPipelineInfo] = useState(carousel);
  const [loading, setLoading] = useState(true);
  const [collapsedAgents, setCollapsedAgents] = useState({});
  const [maximizedAgent, setMaximizedAgent] = useState(null);

  const toggleAgentCollapse = (id) => {
    setCollapsedAgents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllAgents = (agentList) => {
    const allCollapsed = agentList.every(a => collapsedAgents[a.id]);
    if (allCollapsed) {
      setCollapsedAgents({});
    } else {
      const newMap = {};
      agentList.forEach(a => { newMap[a.id] = true; });
      setCollapsedAgents(newMap);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!carousel?.id) return;

    fetch(`/api/carousels/${carousel.id}/pipeline`)
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao carregar pipeline');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setPipelineInfo(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPipelineInfo(carousel);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [carousel]);

  if (!carousel) return null;

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptKey(key);
    setTimeout(() => setCopiedPromptKey(null), 2000);
  };

  const agentPrompts = pipelineInfo?.agentPrompts || {};
  const chatHistory = pipelineInfo?.chatHistory || [];
  const logs = pipelineInfo?.generationLogs || [];
  const slides = pipelineInfo?.slides || [];

  return (
    <div
      className="pipeline-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{`
        .pipeline-modal-panel {
          overflow: hidden !important;
        }
        .custom-pipeline-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-pipeline-scroll::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        .custom-pipeline-scroll::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.4);
          border-radius: 4px;
        }
        .custom-pipeline-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.7);
        }
      `}</style>

      <div
        className="pipeline-modal-panel"
        style={{
          width: '100%',
          maxWidth: '920px',
          height: '85vh',
          maxHeight: '850px',
          backgroundColor: '#121319',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 35px rgba(139, 92, 246, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#e4e4e7'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal (Fixo no topo 1) */}
        <div style={{
          flexShrink: 0,
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.12) 0%, rgba(18, 19, 25, 0) 100%)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '20px' }}>⚡</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#ffffff' }}>
                Pipeline de Criação do Carrossel
              </h2>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                color: '#a78bfa',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                fontWeight: '600'
              }}>
                {pipelineInfo.id}
              </span>
              {(pipelineInfo.generationDuration || carousel?.generationDuration) && (
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  fontWeight: '600'
                }}>
                  ⏱️ {pipelineInfo.generationDuration || carousel?.generationDuration}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>
              {pipelineInfo.title || 'Sem título'}
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: '6px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.color = '#fff'}
            onMouseOut={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.6)'}
            title="Fechar Modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Tabs Navigation (Fixo no topo 2 — NUNCA ROLA) */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          gap: '6px',
          padding: '12px 24px 0 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#0c0d12',
          overflowX: 'auto',
          position: 'relative',
          zIndex: 10
        }}>
          {[
            { id: 'overview', label: '🎯 Visão Geral' },
            { id: 'agents', label: '🤖 Prompts dos Agentes' },
            { id: 'slides', label: '🎨 Prompts dos Slides' },
            { id: 'chat', label: '💬 Histórico de Chat' },
            { id: 'logs', label: '📜 Logs de Execução' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                backgroundColor: activeTab === tab.id ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid #8b5cf6' : '2px solid transparent',
                color: activeTab === tab.id ? '#a78bfa' : 'rgba(255, 255, 255, 0.6)',
                fontWeight: activeTab === tab.id ? '600' : '400',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body (ÚNICO ELEMENTO QUE ROLA INTERNAMENTE) */}
        <div
          className="custom-pipeline-scroll"
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#a78bfa' }}>
              ⚡ Carregando dados do pipeline...
            </div>
          ) : (
            <>
              {/* TAB 1: VISÃO GERAL */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px'
                  }}>
                    <div className="info-card" style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', display: 'block' }}>Formato & Preset</span>
                      <span style={{ fontWeight: '600', color: '#e4e4e7', fontSize: '14px' }}>
                        Formato {pipelineInfo.format || 'A'} · {pipelineInfo.preset || 'cinematografico'}
                      </span>
                    </div>

                    <div className="info-card" style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', display: 'block' }}>IA das Imagens</span>
                      <span style={{ fontWeight: '600', color: '#06b6d4', fontSize: '14px' }}>
                        {(pipelineInfo.imageProvider || 'gpt-image-2').toUpperCase()}
                      </span>
                    </div>

                    <div className="info-card" style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', display: 'block' }}>LLM de Copy</span>
                      <span style={{ fontWeight: '600', color: 'var(--gold, #e0a96d)', fontSize: '14px' }}>
                        {(pipelineInfo.copyModel || 'gpt-4o').toUpperCase()}
                      </span>
                    </div>

                    <div className="info-card" style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', display: 'block' }}>Custo Total</span>
                      <span style={{ fontWeight: '600', color: '#22c55e', fontSize: '14px' }}>
                        ${Number(pipelineInfo.cost || 0).toFixed(2)} (R$ {Number((pipelineInfo.cost || 0) * 5.60).toFixed(2)})
                      </span>
                    </div>
                  </div>

                  {pipelineInfo.caption && (
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                        ✍️ Legenda Gerada (Caption)
                      </span>
                      <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: '#d4d4d8' }}>
                        {pipelineInfo.caption}
                      </p>
                    </div>
                  )}

                  {pipelineInfo.notes && (
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <span style={{ fontSize: '12px', color: '#06b6d4', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                        📌 Notas & Diretrizes de Produção
                      </span>
                      <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', color: '#d4d4d8' }}>
                        {pipelineInfo.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PROMPTS DOS AGENTES */}
              {activeTab === 'agents' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(() => {
                    const agentList = pipelineInfo?.agentPromptsList || (
                      Object.entries(agentPrompts).map(([k, v]) => ({
                        id: k,
                        name: k.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        content: v
                      }))
                    );

                    const getAgentColor = (id, idx) => {
                      const colors = ['#e0a96d', '#8b5cf6', '#06b6d4', '#ec4899', '#22c55e', '#f43f5e', '#3b82f6', '#eab308'];
                      return colors[idx % colors.length];
                    };

                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#a78bfa' }}>
                            🤖 Todos os Agentes Registrados ({agentList.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleAllAgents(agentList)}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              color: '#a1a1aa',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              borderRadius: '6px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              fontWeight: '500',
                              transition: 'all 0.2s'
                            }}
                          >
                            {agentList.every(a => collapsedAgents[a.id]) ? '▲ Expandir Todos' : '▼ Recolher Todos'}
                          </button>
                        </div>

                        {agentList.map((agent, idx) => {
                          const promptText = agent.content || agentPrompts[agent.id] || 'Prompt não disponível.';
                          const agentColor = getAgentColor(agent.id, idx);
                          const isCollapsed = Boolean(collapsedAgents[agent.id]);

                          return (
                            <div
                              key={agent.id || idx}
                              style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div
                                onClick={() => toggleAgentCollapse(agent.id)}
                                style={{
                                  padding: '10px 14px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  borderBottom: isCollapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
                                  cursor: 'pointer',
                                  userSelect: 'none'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
                                    {isCollapsed ? '►' : '▼'}
                                  </span>
                                  <span style={{ fontWeight: '600', fontSize: '13px', color: agentColor }}>
                                    🎭 {agent.name || agent.id}
                                  </span>
                                  <span style={{
                                    fontSize: '10px',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                    color: 'rgba(255, 255, 255, 0.5)',
                                    fontFamily: 'monospace'
                                  }}>
                                    {agent.id}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMaximizedAgent({
                                        id: agent.id,
                                        name: agent.name || agent.id,
                                        content: promptText,
                                        color: agentColor
                                      });
                                    }}
                                    title="Maximizar prompt em tela cheia"
                                    style={{
                                      padding: '4px 10px',
                                      backgroundColor: 'rgba(139, 92, 246, 0.15)',
                                      color: '#a78bfa',
                                      border: '1px solid rgba(139, 92, 246, 0.3)',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                      fontWeight: '500',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    ⛶ Maximizar
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopy(promptText, agent.id);
                                    }}
                                    style={{
                                      padding: '4px 10px',
                                      backgroundColor: copiedPromptKey === agent.id ? '#22c55e' : 'rgba(255, 255, 255, 0.08)',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                      fontWeight: '500',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    {copiedPromptKey === agent.id ? '✓ Copiado!' : '📋 Copiar Prompt'}
                                  </button>
                                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
                                    {isCollapsed ? 'Mostrar' : 'Ocultar'}
                                  </span>
                                </div>
                              </div>
                              {!isCollapsed && (
                                <pre
                                  className="custom-pipeline-scroll"
                                  style={{
                                    margin: 0,
                                    padding: '14px',
                                    fontSize: '12px',
                                    lineHeight: '1.5',
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre-wrap',
                                    color: '#a1a1aa',
                                    maxHeight: '220px',
                                    overflowY: 'auto'
                                  }}
                                >
                                  {promptText}
                                </pre>
                              )}
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              )}



              {/* TAB 3: PROMPTS DOS SLIDES */}
              {activeTab === 'slides' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {slides && slides.length > 0 ? (
                    slides.map((s, idx) => {
                      const slideNum = typeof s === 'object' ? s.num || idx + 1 : idx + 1;
                      const slideName = typeof s === 'object' ? (s.filename || s.estado || `Slide ${slideNum}`) : s;
                      const isTextOnly = typeof s === 'object' && (s.layout === 'text_only' || s.prompt?.includes('Fundo Preto'));
                      const promptDesc = typeof s === 'object' 
                        ? (s.prompt || s.msg || (isTextOnly ? '[ Slide de Fundo Preto / Sem Imagem ]' : `Arte gerada para ${slideName}`))
                        : `Arte gerada para ${slideName}`;

                      return (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '10px',
                            padding: '14px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '600', color: '#a78bfa', fontSize: '13px' }}>
                              🖼️ Slide {slideNum}: {slideName}
                            </span>
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: isTextOnly ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                              color: isTextOnly ? '#ef4444' : '#06b6d4'
                            }}>
                              {isTextOnly ? 'FUNDO PRETO (TEXTO)' : (pipelineInfo.imageProvider || 'gpt-image-2').toUpperCase()}
                            </span>
                          </div>
                          <div style={{
                            backgroundColor: '#090a0f',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: isTextOnly ? '#9ca3af' : '#d4d4d8',
                            fontFamily: 'monospace',
                            lineHeight: '1.4',
                            fontStyle: isTextOnly ? 'italic' : 'normal'
                          }}>
                            {promptDesc}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)', padding: '20px' }}>
                      Nenhum prompt individual de slide registrado para este carrossel.
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'chat' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {chatHistory && chatHistory.length > 0 ? (
                    chatHistory.map((msg, idx) => (
                      <div
                        key={idx}
                        style={{
                          alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '90%',
                          backgroundColor: msg.role === 'user' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                          border: msg.role === 'user' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '10px',
                          padding: '12px 16px'
                        }}
                      >
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: msg.role === 'user' ? '#a78bfa' : '#06b6d4',
                          display: 'block',
                          marginBottom: '4px'
                        }}>
                          {msg.role === 'user' ? '👤 Usuário / Criador' : `🤖 Oráculo (${msg.model || 'IA'})`}
                        </span>
                        <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: '#e4e4e7' }}>
                          {msg.content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)', padding: '20px' }}>
                      Nenhum histórico de chat gravado para este carrossel.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: LOGS DE EXECUÇÃO */}
              {activeTab === 'logs' && (
                <div
                  className="custom-pipeline-scroll"
                  style={{
                    backgroundColor: '#090a0f',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '16px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    color: '#4ade80',
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}
                >
                  {logs && logs.length > 0 ? (
                    logs.map((log, i) => (
                      <div key={i} style={{ marginBottom: '4px' }}>
                        {log}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                      Sem logs detalhados gravados no job de execução.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer (Fixo no rodapé) */}
        <div style={{
          flexShrink: 0,
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#0c0d12'
        }}>
          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{
              padding: '8px 24px',
              borderRadius: '8px',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Modal Overlay para Maximizar Prompt do Agente em Tela Cheia */}
      {maximizedAgent && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(12px)',
            zIndex: 10005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              width: '95%',
              maxWidth: '1200px',
              height: '85vh',
              backgroundColor: '#0c0d12',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: '16px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header do Modal Maximizado */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(255, 255, 255, 0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '18px', fontWeight: '700', color: maximizedAgent.color || '#a78bfa' }}>
                  🎭 {maximizedAgent.name}
                </span>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontFamily: 'monospace'
                }}>
                  {maximizedAgent.id}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => handleCopy(maximizedAgent.content, maximizedAgent.id)}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: copiedPromptKey === maximizedAgent.id ? '#22c55e' : 'rgba(201, 168, 76, 0.2)',
                    color: copiedPromptKey === maximizedAgent.id ? '#fff' : 'var(--gold, #c9a84c)',
                    border: '1px solid rgba(201, 168, 76, 0.4)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {copiedPromptKey === maximizedAgent.id ? '✓ Copiado!' : '📋 Copiar Prompt'}
                </button>
                <button
                  onClick={() => setMaximizedAgent(null)}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ✕ Fechar
                </button>
              </div>
            </div>

            {/* Conteúdo do Prompt Maximizado */}
            <pre
              className="custom-pipeline-scroll"
              style={{
                margin: 0,
                padding: '24px',
                fontSize: '13px',
                lineHeight: '1.6',
                fontFamily: 'Consolas, Monaco, monospace',
                whiteSpace: 'pre-wrap',
                color: '#e4e4e7',
                backgroundColor: '#090a0f',
                overflowY: 'auto',
                flex: 1
              }}
            >
              {maximizedAgent.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

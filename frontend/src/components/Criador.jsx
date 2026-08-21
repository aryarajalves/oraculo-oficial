import React, { useState, useEffect, useRef } from 'react';
import { parseCarouselText } from '../utils/carouselParser';

const IDEAS_PROMPT = `Sugira 5 ideias de temas e títulos para carrosséis do @afonteoculta. O nicho é: espiritualidade, epigenética, frequência, traumas, dinheiro, consciência. Use o Método Jordânico — ganchos disruptivos, revelação oculta, arco emocional.

Para cada ideia, formate assim:
Tema: [slug-do-tema]
Título: [título do slide 1 — gancho disruptivo]

Seja direto. Sem introduções. Só as 5 ideias.`;

export default function Criador({ onStartGeneration, showToast, shouldAddFormMessage, clearAddFormMessage, initialMessages, clearInitialMessages, isReadOnly, isMockFlow }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => {
    if (initialMessages && initialMessages.length > 0) return initialMessages;
    try {
      const saved = sessionStorage.getItem('criador_chat_messages');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [generating, setGenerating] = useState(false);
  const [lastCarouselText, setLastCarouselText] = useState(() => sessionStorage.getItem('criadorLastCarousel') || null);
  const [currentCarouselId, setCurrentCarouselId] = useState(null);
  const [activeBriefing, setActiveBriefing] = useState(null);
  const msgsRef = useRef(null);
  const scrollAnchorRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollAnchorRef.current) {
      scrollAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const setLastCarousel = (text) => {
    setLastCarouselText(text);
    sessionStorage.setItem('criadorLastCarousel', text);
  };

  const isCriarIntent = (text) => {
    if (!lastCarouselText) return false;
    const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const verbo = /\b(criar|cria|crie|gerar|gera|gere|bora|faz|faca|fazer|produz|monta|execute|executa|dispara|ativa|roda|vai|cria)\b/;
    if (!verbo.test(t)) return false;
    const novoConteudo = /\b(sobre|com a|relacionado|baseado|partindo|a partir|novo|nova|diferente|outra|outro|tema|ideia|versao|variacao|gancho|hook|roteiro|legenda|caption|copy|texto)\b/;
    if (novoConteudo.test(t)) return false;
    return t.trim().split(/\s+/).length <= 6;
  };

  const handleSend = async (textToSend = null) => {
    const text = (textToSend || input).trim();
    if (!text || generating) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);



    setGenerating(true);
    const aiMessageId = 'ai-' + Date.now();
    setMessages(prev => [...prev, { role: 'ai', content: '', id: aiMessageId, streaming: true }]);

    let fullText = '';
    let responseModel = 'gpt-4o';
    let costUsd = 0;
    try {
      const chatHistory = messages.filter(m => m.role !== 'form');
      const res = await fetch('/api/criador/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...chatHistory, { role: 'user', content: text }],
          totalSlides: activeBriefing?.totalSlides || 10,
          noImageSlidesCount: activeBriefing?.noImageSlidesCount || 0
        }),
      });

      if (!res.ok) {
        setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, content: '⚠ Erro de conexão com a IA.', streaming: false } : m));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();

        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(t.slice(6));
            if (json.error) {
              setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, content: '⚠ Erro: ' + json.error, streaming: false } : m));
              return;
            }
            if (json.token) {
              fullText += json.token;
              setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, content: fullText } : m));
            }
            if (json.done) {
              if (json.model) responseModel = json.model;
              const totalWords = fullText.split(/\s+/).length + text.split(/\s+/).length;
              const approxTokens = totalWords * 1.33;
              costUsd = approxTokens * 0.00001; 

              setMessages(prev => prev.map(m => m.id === aiMessageId ? { 
                ...m, 
                streaming: false,
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' de ' + new Date().toLocaleDateString('pt-BR'),
                costUSD: costUsd,
                model: responseModel
              } : m));
            }
          } catch {}
        }
      }
      if (fullText.includes('[S1') || fullText.includes('DISRUPÇÃO')) {
        setLastCarousel(fullText);
        
        let targetId = currentCarouselId;
        if (!targetId) {
          try {
            const parsed = parseCarouselText(fullText);
            const res = await fetch('/api/carousels', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: parsed.title || 'Novo Carrossel',
                theme: parsed.theme || '',
                format: parsed.format || 'A',
                caption: parsed.caption || '',
                notes: parsed.notes || '',
                totalSlides: parsed.slides?.length || 10,
                status: 'rascunho',
                chatHistory: [
                  ...messages.map(m => ({ role: m.role, content: m.content })),
                  { role: 'user', content: text },
                  { role: 'ai', content: fullText }
                ]
              })
            });
            if (res.ok) {
              const data = await res.json();
              setCurrentCarouselId(data.id);
              targetId = data.id;
            }
          } catch (err) {
            console.error('Erro ao salvar rascunho inicial do carrossel:', err);
          }
        }
      }

      if (currentCarouselId) {
        const updatedMessages = [
          ...messages.map(m => ({
            role: m.role,
            content: m.content,
            model: m.model,
            costUSD: m.costUSD,
            timestamp: m.timestamp
          })),
          { role: 'user', content: text },
          { 
            role: 'ai', 
            content: fullText,
            model: responseModel,
            costUSD: costUsd,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' de ' + new Date().toLocaleDateString('pt-BR')
          }
        ];
        try {
          await fetch(`/api/carousels/${currentCarouselId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatHistory: updatedMessages })
          });
        } catch (err) {
          console.error('Erro ao atualizar histórico subsequente no Postgres:', err);
        }
      }
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, content: '⚠ Erro de rede.', streaming: false } : m));
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!isReadOnly && Array.isArray(messages)) {
      try {
        if (messages.length > 0) {
          sessionStorage.setItem('criador_chat_messages', JSON.stringify(messages));
        } else {
          sessionStorage.removeItem('criador_chat_messages');
        }
      } catch {}
    }
  }, [messages, isReadOnly]);

  useEffect(() => {
    if (shouldAddFormMessage) {
      setMessages([]);
      setInput('');
      setCurrentCarouselId(null);
      setLastCarouselText(null);
      try {
        sessionStorage.removeItem('criador_chat_messages');
        sessionStorage.removeItem('criadorLastCarousel');
      } catch {}
      clearAddFormMessage();
    }
  }, [shouldAddFormMessage]);

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
      clearInitialMessages();
    }
  }, [initialMessages]);




  const handleSaveDraft = async (text) => {
    const temaMatch = text.match(/TEMA:\s*(.+)/i);
    const bigIdeaMatch = text.match(/BIG IDEA:\s*(.+)/i);
    const title = temaMatch
      ? temaMatch[1].trim().slice(0, 80)
      : text.slice(0, 60).replace(/\n/g, ' ') + '...';

    try {
      const res = await fetch('/api/carousels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          theme: temaMatch?.[1]?.trim() || '',
          notes: text,
          status: 'rascunho',
          caption: bigIdeaMatch?.[1]?.trim() || '',
          chatHistory: messages
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentCarouselId(data.id);
        showToast('Rascunho salvo!');
      } else {
        showToast('Erro ao salvar rascunho.');
      }
    } catch (e) {
      showToast('Erro ao salvar rascunho.');
    }
  };

  return (
    <div className="main-view active" id="view-criador" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <div className="criador-wrap" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="criador-msgs" ref={msgsRef} style={{ flex: 1, overflowY: 'auto', padding: '32px 24px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {messages.length === 0 ? (
            <div className="criador-welcome">
              <div className="criador-welcome-icon">{isMockFlow ? '⚡' : '✦'}</div>
              <div className="criador-welcome-title">{isMockFlow ? 'TESTE DE ESCALA (MOCK)' : 'CRIADOR'}</div>
              <div className="criador-welcome-sub">
                {isMockFlow 
                  ? 'Gere o roteiro do carrossel usando IA e crie o design de teste instantaneamente e sem custos.'
                  : 'Traga um tema e receba o carrossel completo de 10 slides. Método Jordânico · Voz Oculta · Humanizador.'
                }
              </div>
              <div className="criador-chips">
                <button className="criador-chip" onClick={() => handleSend('O sistema nervoso calibrado para escassez antes dos 7 anos')}>Sistema nervoso + escassez</button>
                <button className="criador-chip" onClick={() => handleSend('Por que pessoas inteligentes continuam quebradas')}>Inteligentes e quebradas</button>
              </div>
            </div>
          ) : (
            messages.map((m, idx) => {
              if (m.role === 'form') {
                return (
                  <div key={idx} className="criador-msg criador-msg--ai" style={{ alignSelf: 'flex-start' }}>
                    <div className="criador-avatar">◈</div>
                    <div className="criador-bubble" style={{ width: '100%', maxWidth: '480px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '12px', padding: '18px 20px', display: 'block' }}>
                      <ChatFormMessage onSubmit={handleSendFormBriefing} showToast={showToast} generating={generating} onRequestIdeas={() => handleSend(IDEAS_PROMPT)} />
                    </div>
                  </div>
                );
              }
              return (
                <div key={idx} className={`criador-msg criador-msg--${m.role}`}>
                  <div className="criador-avatar">{m.role === 'user' ? '✦' : '◈'}</div>
                  <div className="criador-bubble">
                    {(() => {
                      if (typeof m.content !== 'string') return m.content;
                      if (m.role === 'user') {
                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        const parts = m.content.split(urlRegex);
                        return parts.map((part, i) => {
                          if (part.match(urlRegex)) {
                            return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'underline', wordBreak: 'break-all' }}>{part}</a>;
                          }
                          return part;
                        });
                      }

                      // Para a IA: renderiza linha por linha sem botões de ação
                      const lines = m.content.split('\n');
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {lines.map((line, lIdx) => (
                            <div key={lIdx} style={{ minHeight: '22px' }}>
                              <span>{line}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    {m.streaming && <span className="criador-cursor"></span>}
                    {m.role === 'ai' && !m.streaming && (
                      <div style={{ marginTop: '8px', fontSize: '10.5px', color: 'rgba(237, 232, 223, 0.45)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                          {m.timestamp || (new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' de ' + new Date().toLocaleDateString('pt-BR'))}
                        </span>
                        {m.costUSD !== undefined && (
                          <span style={{ color: 'var(--gold)', fontWeight: '500' }}>
                            Modelo: {(m.model || 'gpt-4o').toUpperCase()} | Custo: ${m.costUSD.toFixed(4)} USD (~R$ {(m.costUSD * 5).toFixed(3)} BRL)
                          </span>
                        )}
                      </div>
                    )}
                    {m.role === 'ai' && !m.streaming && m.content && (
                      <div className="criador-msg-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button className="criador-action-btn" onClick={() => { navigator.clipboard.writeText(m.content); showToast('✓ Copiado para a área de transferência!'); }}>Copiar tudo</button>
                        {(() => {
                          try {
                            const parsed = parseCarouselText(m.content, activeBriefing);
                            const hasSlidesInText = parsed && parsed.slides && parsed.slides.length > 0;
                            const hasSlidesInBriefing = activeBriefing && activeBriefing.slides && activeBriefing.slides.length > 0;
                            return hasSlidesInText || hasSlidesInBriefing;
                          } catch (e) {
                            return false;
                          }
                        })() && !isReadOnly && (
                          <button 
                            className="criador-action-btn criador-action-btn--create" 
                            style={isMockFlow ? { background: 'var(--gold)', color: '#000' } : {}}
                            onClick={() => onStartGeneration(m.content, currentCarouselId)}
                          >
                            {isMockFlow ? '⚡ Criar design rápido (Mock)' : '✦ Criar design'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollAnchorRef} style={{ height: '1px', flexShrink: 0 }} />
        </div>

        <div className="criador-input-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <button
              onClick={() => handleSend(IDEAS_PROMPT)}
              disabled={generating}
              style={{
                background: 'rgba(201, 168, 76, 0.12)',
                border: '1px solid rgba(201, 168, 76, 0.35)',
                borderRadius: '16px',
                color: 'var(--gold)',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: generating ? 'not-allowed' : 'pointer',
                opacity: generating ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
              }}
              onMouseEnter={e => { if (!generating) e.currentTarget.style.background = 'rgba(201, 168, 76, 0.22)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(201, 168, 76, 0.12)'; }}
            >
              💡 Dar ideias de Tema/Título
            </button>
          </div>

          <div className="criador-input-wrap">
            <textarea
              className="criador-textarea"
              placeholder={generating ? "Aguardando resposta do agente..." : "Digite o tema do carrossel ou faça uma pergunta..."}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && !generating && (e.preventDefault(), handleSend())}
              disabled={generating}
              style={{
                opacity: generating ? 0.6 : 1,
                cursor: generating ? 'not-allowed' : 'text'
              }}
            />
            <button 
              className="criador-send-btn" 
              onClick={() => !generating && handleSend()} 
              disabled={generating}
              style={{
                opacity: generating ? 0.5 : 1,
                cursor: generating ? 'not-allowed' : 'pointer'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <div className="criador-info">gpt-5.4 · Método Jordânico · {generating ? 'gerando...' : 'pronto'}</div>
        </div>
      </div>
    </div>
  );
}



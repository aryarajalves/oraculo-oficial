import React, { useState, useEffect, useRef } from 'react';
import { parseCarouselText } from '../utils/carouselParser';

const IDEAS_PROMPT = `Sugira 5 ideias de temas e títulos para carrosséis do @afonteoculta. O nicho é: espiritualidade, epigenética, frequência, traumas, dinheiro, consciência. Use o Método Jordânico — ganchos disruptivos, revelação oculta, arco emocional.

Para cada ideia, formate assim:
Tema: [slug-do-tema]
Título: [título do slide 1 — gancho disruptivo]

Seja direto. Sem introduções. Só as 5 ideias.`;

export default function Criador({ onStartGeneration, showToast, shouldAddFormMessage, clearAddFormMessage, initialMessages, clearInitialMessages, isReadOnly, isMockFlow }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [lastCarouselText, setLastCarouselText] = useState(sessionStorage.getItem('criadorLastCarousel') || null);
  const [currentCarouselId, setCurrentCarouselId] = useState(null);
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
    try {
      const chatHistory = messages.filter(m => m.role !== 'form');
      const res = await fetch('/api/criador/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...chatHistory, { role: 'user', content: text }] }),
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
              setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, streaming: false } : m));
            }
          } catch {}
        }
      }
      if (fullText.includes('[S1') || fullText.includes('DISRUPÇÃO')) {
        setLastCarousel(fullText);
      }

      if (currentCarouselId) {
        const updatedMessages = [
          ...messages.filter(m => m.role !== 'form'),
          { role: 'user', content: text },
          { role: 'ai', content: fullText }
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
    if (shouldAddFormMessage) {
      setMessages(prev => [...prev, { role: 'form', id: 'form-' + Date.now() }]);
      clearAddFormMessage();
    }
  }, [shouldAddFormMessage]);

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
      clearInitialMessages();
    }
  }, [initialMessages]);

  useEffect(() => {
    if (messages.length === 0 && !initialMessages) {
      setMessages([{ role: 'form', id: 'form-' + Date.now() }]);
    }
  }, []);


  const handleSendFormBriefing = async (briefing) => {
    if (generating) return;

    if (!briefing.title?.trim() || !briefing.theme?.trim()) {
      showToast("⚠ Por favor, preencha o Título e o Tema antes de enviar.");
      return;
    }

    const displayUserText = `Briefing enviado para avaliação da IA: "${briefing.title || 'Novo Carrossel'}" (Tema: ${briefing.theme || 'Não definido'}, Formato: ${briefing.format})`;

    const actualAIPrompt = `Avalie o seguinte briefing de carrossel de forma muito objetiva, curta e direta (em no máximo 2-3 parágrafos curtos). Seja prático e direto ao ponto, sem introduções longas ou textos prolixos:

- **Título/Gancho:** ${briefing.title || 'Não definido'}
- **Tema:** ${briefing.theme || 'Não definido'}
- **Formato:** ${briefing.format || 'Não definido'}
- **Total de Slides:** ${briefing.totalSlides || '10'}
- **Qualidade das Imagens:** ${briefing.imageQuality || 'high'}
- **Pasta:** ${briefing.dir || 'Não definido'}
- **Legenda (Caption):** ${briefing.caption || 'Não definido'}
- **Notas:** ${briefing.notes || 'Não definido'}`;

    setMessages(prev => [...prev, { role: 'user', content: displayUserText }]);
    // Scroll suave para o final do chat após enviar o briefing
    setTimeout(() => scrollToBottom(), 100);

    // Cria o rascunho do carrossel no banco de dados
    let createdId = null;
    try {
      const res = await fetch('/api/carousels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: briefing.title || 'Novo Carrossel',
          theme: briefing.theme || '',
          format: briefing.format || 'A',
          slidesDir: briefing.dir || '',
          caption: briefing.caption || '',
          notes: briefing.notes || '',
          totalSlides: briefing.totalSlides || 10,
          imageQuality: briefing.imageQuality || 'high',
          status: 'rascunho',
          chatHistory: [
            ...messages.filter(m => m.role !== 'form'),
            { role: 'user', content: displayUserText }
          ]
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentCarouselId(data.id);
        createdId = data.id;
      }
    } catch (err) {
      console.error('Erro ao salvar rascunho inicial no Postgres:', err);
    }

    setGenerating(true);
    const aiMessageId = 'ai-' + Date.now();
    setMessages(prev => [...prev, { role: 'ai', content: '', id: aiMessageId, streaming: true }]);

    let fullText = '';
    try {
      const chatHistory = messages.filter(m => m.role !== 'form');
      const history = [...chatHistory, { role: 'user', content: actualAIPrompt }];

      const res = await fetch('/api/criador/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
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
              let errorMsg = json.error;
              if (json.error.includes("quota") || json.error.includes("billing")) {
                errorMsg = "Você excedeu sua cota atual na OpenAI. Por favor, adicione créditos ou verifique sua forma de faturamento no painel da OpenAI: https://platform.openai.com/settings/organization/billing/overview";
              }
              setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, content: '⚠ Erro: ' + errorMsg, streaming: false } : m));
              return;
            }
            if (json.token) {
              fullText += json.token;
              setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, content: fullText } : m));
            }
            if (json.done) {
              setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, streaming: false } : m));
            }
          } catch {}
        }
      }
      if (fullText.includes('[S1') || fullText.includes('DISRUPÇÃO')) {
        setLastCarousel(fullText);
      }

      const targetId = createdId || currentCarouselId;
      if (targetId) {
        const updatedMessages = [
          ...messages.filter(m => m.role !== 'form'),
          { role: 'user', content: displayUserText },
          { role: 'ai', content: fullText }
        ];
        try {
          await fetch(`/api/carousels/${targetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatHistory: updatedMessages })
          });
        } catch (err) {
          console.error('Erro ao atualizar histórico do briefing no Postgres:', err);
        }
      }
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, content: '⚠ Erro de rede.', streaming: false } : m));
    } finally {
      setGenerating(false);
    }
  };

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
    <div className="main-view active" id="view-criador" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
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

                      // Para a IA: processa linha por linha para injetar botões
                      const lines = m.content.split('\n');
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {lines.map((line, lIdx) => {
                            const temaMatch = line.match(/(?:Tema|tema)\s*:\s*(.+)/i);
                            const tituloMatch = line.match(/(?:T[IÍ]tulo|t[ií]tulo)s*:\s*(.+)/i);
                            const listMatch = line.match(/^\s*[-\*•]\s+(.+)/);
                            
                            let button = null;
                            if (temaMatch) {
                              const value = temaMatch[1].trim().replace(/\*\*|_/g, '').trim();
                              if (value.length > 0) {
                                button = (
                                  <button
                                    onClick={() => {
                                      window.dispatchEvent(new CustomEvent('preencher-briefing', { detail: { type: 'theme', value } }));
                                      if (showToast) showToast("✓ Tema preenchido!");
                                    }}
                                    className="btn-escala-preencher"
                                    style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(201, 168, 76, 0.15)', border: '1px solid rgba(201, 168, 76, 0.3)', color: 'var(--gold)', fontSize: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', transition: 'all 0.2s' }}
                                  >
                                    ⚡ Usar Tema
                                  </button>
                                );
                              }
                            } else if (tituloMatch) {
                              const value = tituloMatch[1].trim().replace(/\*\*|_/g, '').replace(/^["'“”]/, '').replace(/["'“”]$/, '').trim();
                              if (value.length > 0) {
                                button = (
                                  <button
                                    onClick={() => {
                                      window.dispatchEvent(new CustomEvent('preencher-briefing', { detail: { type: 'title', value } }));
                                      if (showToast) showToast("✓ Título preenchido!");
                                    }}
                                    className="btn-escala-preencher"
                                    style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(201, 168, 76, 0.15)', border: '1px solid rgba(201, 168, 76, 0.3)', color: 'var(--gold)', fontSize: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', transition: 'all 0.2s' }}
                                  >
                                    ⚡ Usar Título
                                  </button>
                                );
                              }
                            } else if (listMatch) {
                              const value = listMatch[1].trim().replace(/\*\*|_/g, '').replace(/^["'“”]/, '').replace(/["'“”]$/, '').trim();
                              if (value.length > 5 && value.length < 90 && !value.toLowerCase().startsWith('slide') && !value.toLowerCase().startsWith('conteudo')) {
                                button = (
                                  <button
                                    onClick={() => {
                                      window.dispatchEvent(new CustomEvent('preencher-briefing', { detail: { type: 'title', value } }));
                                      if (showToast) showToast("✓ Título preenchido!");
                                    }}
                                    className="btn-escala-preencher"
                                    style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(201, 168, 76, 0.15)', border: '1px solid rgba(201, 168, 76, 0.3)', color: 'var(--gold)', fontSize: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', transition: 'all 0.2s' }}
                                  >
                                    ⚡ Usar Título
                                  </button>
                                );
                              }
                            }

                            return (
                              <div key={lIdx} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', minHeight: '22px' }}>
                                <span>{line}</span>
                                {button}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {m.streaming && <span className="criador-cursor"></span>}
                    {m.role === 'ai' && !m.streaming && m.content && (
                      <div className="criador-msg-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button className="criador-action-btn" onClick={() => navigator.clipboard.writeText(m.content)}>Copiar tudo</button>
                        {!isReadOnly && <button className="criador-action-btn" onClick={() => handleSaveDraft(m.content)}>+ Salvar rascunho</button>}
                        {(() => {
                          try {
                            const parsed = parseCarouselText(m.content);
                            return parsed && parsed.slides && parsed.slides.length > 0;
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

function ChatFormMessage({ onSubmit, showToast, generating, onRequestIdeas }) {
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [format, setFormat] = useState('A');
  const [totalSlides, setTotalSlides] = useState('10');
  const [imageQuality, setImageQuality] = useState('high');
  const [dir, setDir] = useState('');
  const [caption, setCaption] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const handleFill = (e) => {
      if (e.detail.type === 'title') setTitle(e.detail.value);
      if (e.detail.type === 'theme') setTheme(e.detail.value);
    };
    window.addEventListener('preencher-briefing', handleFill);
    return () => window.removeEventListener('preencher-briefing', handleFill);
  }, []);

  if (submitted) {
    return (
      <div style={{ color: 'var(--text-3)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
        ✓ Briefing enviado para avaliação da IA.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--gold)', marginBottom: '4px', textAlign: 'center', letterSpacing: '0.05em' }}>
        📝 NOVO BRIEFING DE CARROSSEL
      </div>
      
      <div className="form-group" style={{ marginBottom: '8px' }}>
        <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Título / Gancho</label>
        <input 
          className="form-input" 
          style={{ background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--text)' }} 
          placeholder="Ex: O que a física prova sobre dinheiro..." 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Tema</label>
          <input 
            className="form-input" 
            style={{ background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--text)' }} 
            placeholder="Ex: frequencia-dinheiro" 
            value={theme} 
            onChange={e => setTheme(e.target.value)} 
          />
        </div>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Formato</label>
          <select 
            className="form-select" 
            style={{ background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--text)' }} 
            value={format} 
            onChange={e => setFormat(e.target.value)}
          >
            <option value="A">A — Tese + Tradução</option>
            <option value="B">B — Demolição + Reconstrução</option>
            <option value="C">C — Lista Revelação</option>
            <option value="D">D — História + Verdade</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Total de Slides</label>
          <input 
            type="number"
            className="form-input" 
            style={{ background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--text)' }} 
            min="1"
            max="20"
            value={totalSlides} 
            onChange={e => setTotalSlides(e.target.value)} 
          />
        </div>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Qualidade</label>
          <select 
            className="form-select" 
            style={{ background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--text)' }} 
            value={imageQuality} 
            onChange={e => setImageQuality(e.target.value)}
          >
            <option value="auto">Auto</option>
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="standard">Padrão (DALL-E 3)</option>
            <option value="hd">HD (DALL-E 3)</option>
          </select>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '8px' }}>
        <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Pasta das artes (caminho completo)</label>
        <input 
          className="form-input" 
          style={{ background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--text)' }} 
          placeholder="C:/Users/julia/Desktop/nome-da-pasta" 
          value={dir} 
          onChange={e => setDir(e.target.value)} 
        />
      </div>

      <div className="form-group" style={{ marginBottom: '8px' }}>
        <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Caption (texto para o post)</label>
        <textarea 
          className="form-textarea" 
          rows="2" 
          style={{ minHeight: '40px', background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--text)' }} 
          placeholder="Legenda do post..." 
          value={caption} 
          onChange={e => setCaption(e.target.value)}
        ></textarea>
      </div>

      <div className="form-group" style={{ marginBottom: '12px' }}>
        <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Notas internas</label>
        <textarea 
          className="form-textarea" 
          rows="2" 
          style={{ minHeight: '40px', background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--text)' }} 
          placeholder="Observações..." 
          value={notes} 
          onChange={e => setNotes(e.target.value)}
        ></textarea>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => { if (!generating && onRequestIdeas) onRequestIdeas(); }}
          disabled={generating}
          style={{
            flex: '0 0 auto',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: 'transparent',
            border: '1px solid rgba(201, 168, 76, 0.4)',
            borderRadius: '6px',
            color: 'var(--gold)',
            cursor: generating ? 'not-allowed' : 'pointer',
            opacity: generating ? 0.5 : 1,
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { if (!generating) e.currentTarget.style.background = 'rgba(201,168,76,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          💡 Sugerir Temas
        </button>

        <button
          className="btn btn-gold"
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            opacity: generating ? 0.5 : 1,
            cursor: generating ? 'not-allowed' : 'pointer'
          }}
          disabled={generating}
          onClick={() => {
            if (generating) return;
            if (!title.trim() || !theme.trim()) {
              if (showToast) showToast("⚠ Por favor, preencha o Título e o Tema antes de enviar.");
              return;
            }
            onSubmit({ title, theme, format, dir, caption, notes, totalSlides: Number(totalSlides), imageQuality });
            setSubmitted(true);
          }}
        >
          {generating ? 'Aguardando resposta da IA...' : 'Avaliar Briefing com IA'}
        </button>
      </div>
    </div>
  );
}

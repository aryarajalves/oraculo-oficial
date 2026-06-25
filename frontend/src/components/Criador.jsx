import React, { useState, useEffect } from 'react';
import { parseCarouselText } from '../utils/carouselParser';

export default function Criador({ onStartGeneration, showToast, shouldAddFormMessage, clearAddFormMessage, initialMessages, clearInitialMessages }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [lastCarouselText, setLastCarouselText] = useState(sessionStorage.getItem('criadorLastCarousel') || null);
  const [currentCarouselId, setCurrentCarouselId] = useState(null);

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

  const handleSendFormBriefing = async (briefing) => {
    if (generating) return;

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

    // Cria o rascunho do carrossel no banco de dados
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
        <div className="criador-msgs" style={{ flex: 1, overflowY: 'auto', padding: '32px 24px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {messages.length === 0 ? (
            <div className="criador-welcome">
              <div className="criador-welcome-icon">✦</div>
              <div className="criador-welcome-title">CRIADOR</div>
              <div className="criador-welcome-sub">Traga um tema e receba o carrossel completo de 10 slides.<br/>Método Jordânico · Voz Oculta · Humanizador.</div>
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
                      <ChatFormMessage onSubmit={handleSendFormBriefing} />
                    </div>
                  </div>
                );
              }
              return (
                <div key={idx} className={`criador-msg criador-msg--${m.role}`}>
                  <div className="criador-avatar">{m.role === 'user' ? '✦' : '◈'}</div>
                  <div className="criador-bubble">
                    {m.content}
                    {m.streaming && <span className="criador-cursor"></span>}
                    {m.role === 'ai' && !m.streaming && m.content && (
                      <div className="criador-msg-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button className="criador-action-btn" onClick={() => navigator.clipboard.writeText(m.content)}>Copiar tudo</button>
                        <button className="criador-action-btn" onClick={() => handleSaveDraft(m.content)}>+ Salvar rascunho</button>
                        {(() => {
                          try {
                            const parsed = parseCarouselText(m.content);
                            return parsed && parsed.slides && parsed.slides.length > 0;
                          } catch (e) {
                            return false;
                          }
                        })() && (
                          <button className="criador-action-btn criador-action-btn--create" onClick={() => onStartGeneration(m.content, currentCarouselId)}>✦ Criar design</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="criador-input-row">
          <div className="criador-input-wrap">
            <textarea
              className="criador-textarea"
              placeholder="Digite o tema do carrossel ou faça uma pergunta..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            />
            <button className="criador-send-btn" onClick={() => handleSend()} disabled={generating}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <div className="criador-info">gpt-5.4 · Método Jordânico · {generating ? 'gerando...' : 'pronto'}</div>
        </div>
      </div>
    </div>
  );
}

function ChatFormMessage({ onSubmit }) {
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [format, setFormat] = useState('A');
  const [totalSlides, setTotalSlides] = useState('10');
  const [imageQuality, setImageQuality] = useState('high');
  const [dir, setDir] = useState('');
  const [caption, setCaption] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

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

      <button 
        className="btn btn-gold" 
        style={{ padding: '8px 12px', fontSize: '12px', fontWeight: '700', width: '100%', textTransform: 'uppercase', letterSpacing: '0.05em' }} 
        onClick={() => {
          onSubmit({ title, theme, format, dir, caption, notes, totalSlides: Number(totalSlides), imageQuality });
          setSubmitted(true);
        }}
      >
        Avaliar Briefing com IA
      </button>
    </div>
  );
}

import { useState, useEffect } from 'react';

export function useBibliotecaChat({ showToast, loadLibrary }) {
  const [messages, setMessages] = useState([]);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [itemToSave, setItemToSave] = useState(null);
  const [savingItem, setSavingItem] = useState(false);

  const loadChat = async () => {
    try {
      const token = localStorage.getItem('fo_token');
      const res = await fetch('/api/library/chat', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages || []);
        setGeneratedImages(data.generated_images || []);
      }
    } catch {}
  };

  useEffect(() => {
    loadChat();
  }, []);

  const handleSendMessage = async (prompt, selectedReferences, clearReferences) => {
    if (!prompt.trim() || generating) return;

    const currentRefs = [...selectedReferences];
    if (clearReferences) clearReferences();

    const userTempMsg = {
      id: 'temp_user_' + Date.now(),
      role: 'user',
      content: prompt,
      referenceIds: currentRefs.map(r => r.id),
      references: currentRefs.map(r => ({ id: r.id, url: r.url, title: r.title })),
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userTempMsg]);
    setGenerating(true);

    try {
      const token = localStorage.getItem('fo_token');
      const res = await fetch('/api/library/chat/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          prompt,
          referenceIds: currentRefs.map(r => r.id),
          messages
        })
      });

      const data = await res.json();
      if (res.ok && data.aiMessage) {
        setMessages(prev => [...prev.filter(m => m.id !== userTempMsg.id), data.userMessage, data.aiMessage]);
        if (data.generatedItem) {
          setGeneratedImages(prev => [data.generatedItem, ...prev]);
        }
        if (showToast) showToast('✨ Imagem gerada com sucesso!');
      } else {
        if (showToast) showToast(`Erro ao gerar imagem: ${data.error || 'Falha na IA'}`);
        setMessages(prev => prev.filter(m => m.id !== userTempMsg.id));
      }
    } catch {
      if (showToast) showToast('Erro de conexão ao gerar imagem.');
      setMessages(prev => prev.filter(m => m.id !== userTempMsg.id));
    } finally {
      setGenerating(false);
    }
  };

  const handleClearChat = async () => {
    try {
      const token = localStorage.getItem('fo_token');
      const res = await fetch('/api/library/chat/clear', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        setMessages([]);
        if (showToast) showToast('Histórico do chat limpo!');
      }
    } catch {
      if (showToast) showToast('Erro ao limpar histórico.');
    }
  };

  const handleConfirmSaveGenerated = async (saveData) => {
    setSavingItem(true);
    try {
      const token = localStorage.getItem('fo_token');
      const res = await fetch('/api/library/save-generated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(saveData)
      });

      const data = await res.json();
      if (res.ok) {
        if (showToast) showToast('🎉 Imagem e Prompt salvos na Biblioteca!');
        setItemToSave(null);
        loadLibrary();
      } else {
        if (showToast) showToast(`Erro: ${data.error || 'Falha ao salvar'}`);
      }
    } catch {
      if (showToast) showToast('Erro ao salvar imagem na biblioteca.');
    } finally {
      setSavingItem(false);
    }
  };

  return {
    messages,
    generatedImages,
    generating,
    itemToSave,
    setItemToSave,
    savingItem,
    handleSendMessage,
    handleClearChat,
    handleConfirmSaveGenerated
  };
}

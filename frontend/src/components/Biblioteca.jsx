// frontend/src/components/Biblioteca.jsx — Componente Principal da Biblioteca e Assistente IA
import React, { useState, useEffect } from 'react';
import ImageCard from './Biblioteca/ImageCard';
import AssistantDrawer from './Biblioteca/AssistantDrawer';
import UploadModal from './Biblioteca/UploadModal';
import DeleteImageModal from './Biblioteca/DeleteImageModal';
import ImageDetailsModal from './Biblioteca/ImageDetailsModal';
import '../css/biblioteca.css';

export default function Biblioteca({ showToast }) {
  const [images, setImages] = useState([]);
  const [categories, setCategories] = useState(['Todas', 'Geral', 'Pessoas', 'Cenários', 'Estilo', 'Produtos']);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Paginação (máximo 20 itens por página)
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // Assistente Lateral & Referências Selecionadas
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [selectedReferences, setSelectedReferences] = useState([]);
  const [messages, setMessages] = useState([]);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [generating, setGenerating] = useState(false);

  // Estados dos Modais
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedImageForDetails, setSelectedImageForDetails] = useState(null);

  useEffect(() => {
    loadLibrary();
    loadChat();
  }, []);

  const loadLibrary = async (category = selectedCategory, search = searchQuery) => {
    try {
      const token = localStorage.getItem('fo_token');
      const params = new URLSearchParams();
      if (category && category !== 'Todas') params.append('category', category);
      if (search && search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/library?${params.toString()}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      const data = await res.json();
      if (res.ok) {
        setImages(data.images || []);
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
        }
      }
    } catch {
      if (showToast) showToast('Erro ao carregar biblioteca.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleToggleSelect = (image) => {
    setSelectedReferences(prev => {
      const exists = prev.some(r => r.id === image.id);
      if (exists) {
        return prev.filter(r => r.id !== image.id);
      }
      return [...prev, image];
    });
    // Se o assistente estiver fechado, abre automaticamente
    if (!assistantOpen) setAssistantOpen(true);
  };

  const handleAddReference = (image) => {
    setSelectedReferences(prev => {
      if (prev.some(r => r.id === image.id)) return prev;
      return [...prev, image];
    });
    if (!assistantOpen) setAssistantOpen(true);
  };

  const handleRemoveReference = (id) => {
    setSelectedReferences(prev => prev.filter(r => r.id !== id));
  };

  const handleSendMessage = async (prompt) => {
    if (!prompt.trim() || generating) return;

    const userTempMsg = {
      id: 'temp_user_' + Date.now(),
      role: 'user',
      content: prompt,
      referenceIds: selectedReferences.map(r => r.id),
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
          referenceIds: selectedReferences.map(r => r.id),
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

  const handleSaveToLibrary = async (item) => {
    try {
      const token = localStorage.getItem('fo_token');
      const res = await fetch('/api/library/save-generated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          filename: item.filename,
          title: (item.prompt || item.generatedPrompt || 'Imagem Gerada por IA').substring(0, 40),
          category: 'IA Gerada',
          notes: item.generatedPrompt || item.prompt || ''
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (showToast) showToast('🎉 Imagem salva na Biblioteca principal!');
        loadLibrary();
      } else {
        if (showToast) showToast(`Erro: ${data.error || 'Falha ao salvar'}`);
      }
    } catch {
      if (showToast) showToast('Erro ao salvar imagem na biblioteca.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!imageToDelete) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('fo_token');
      const res = await fetch(`/api/library/${imageToDelete.id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (res.ok) {
        if (showToast) showToast('🗑️ Imagem excluída com sucesso!');
        setSelectedReferences(prev => prev.filter(r => r.id !== imageToDelete.id));
        loadLibrary();
        setDeleteModalOpen(false);
        setImageToDelete(null);
      } else {
        if (showToast) showToast('Erro ao excluir imagem.');
      }
    } catch {
      if (showToast) showToast('Erro de conexão ao excluir.');
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(images.length / ITEMS_PER_PAGE) || 1;
  const displayedImages = images.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="biblioteca-container">
      <div className="biblioteca-main-layout">
        {/* ── Galeria da Esquerda ── */}
        <section className="biblioteca-gallery-area">
          {/* Topbar */}
          <div className="biblioteca-topbar">
            <div className="biblioteca-title-wrap">
              <h1>
                <span>🖼️</span> Biblioteca de Referências
              </h1>
              <p>Gerencie imagens de referência para criação e aprimoramento de carrosséis e artes</p>
            </div>

            <div className="biblioteca-actions-bar">
              <input
                type="text"
                className="biblioteca-search-input"
                placeholder="Buscar imagens..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                  loadLibrary(selectedCategory, e.target.value);
                }}
              />

              <button
                className="btn btn-gold"
                onClick={() => setUploadModalOpen(true)}
              >
                + Fazer Upload
              </button>
            </div>
          </div>

          {/* Categorias */}
          <div className="biblioteca-categories-bar">
            {categories.map(cat => (
              <button
                key={cat}
                className={`lib-category-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                  loadLibrary(cat, searchQuery);
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid de Imagens */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gold, #c9a84c)' }}>
              Carregando biblioteca...
            </div>
          ) : images.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-3, #a1a1aa)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📂</div>
              <h3 style={{ color: '#fff', fontSize: '16px', marginBottom: '6px' }}>Nenhuma imagem encontrada</h3>
              <p style={{ fontSize: '13px', maxWidth: '380px', margin: '0 auto 20px auto' }}>
                Faça upload de fotos, personagens, fundos e referências de estilo para usar em suas criações.
              </p>
              <button className="btn btn-gold" onClick={() => setUploadModalOpen(true)}>
                + Fazer Primeiro Upload
              </button>
            </div>
          ) : (
            <>
              <div className="biblioteca-grid">
                {displayedImages.map(img => (
                  <ImageCard
                    key={img.id}
                    image={img}
                    isSelected={selectedReferences.some(r => r.id === img.id)}
                    onToggleSelect={handleToggleSelect}
                    onPreview={(img) => {
                      setSelectedImageForDetails(img);
                      setDetailsModalOpen(true);
                    }}
                    onEdit={(img) => {
                      setSelectedImageForDetails(img);
                      setDetailsModalOpen(true);
                    }}
                    onDelete={(img) => {
                      setImageToDelete(img);
                      setDeleteModalOpen(true);
                    }}
                    showToast={showToast}
                  />
                ))}
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="biblioteca-pagination">
                  <span className="pagination-info">
                    Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, images.length)} de {images.length} imagens
                  </span>
                  <div className="pagination-controls">
                    <button
                      className="pagination-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    >
                      « Anterior
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        className={`pagination-btn-number ${currentPage === page ? 'active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      className="pagination-btn"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    >
                      Próxima »
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Assistente de Criação IA (Lado Direito) ── */}
        <AssistantDrawer
          isOpen={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          selectedReferences={selectedReferences}
          onRemoveReference={handleRemoveReference}
          onAddReference={handleAddReference}
          allImages={images}
          messages={messages}
          generatedImages={generatedImages}
          onSendMessage={handleSendMessage}
          onClearChat={handleClearChat}
          generating={generating}
          onSaveToLibrary={handleSaveToLibrary}
          onPreviewImage={(img) => {
            setSelectedImageForDetails(img);
            setDetailsModalOpen(true);
          }}
          showToast={showToast}
        />
      </div>

      {/* ── Botão Flutuante Circular do Assistente IA (FAB) ── */}
      {!assistantOpen && (
        <button
          className="biblioteca-fab-assistant"
          onClick={() => setAssistantOpen(true)}
          title="Abrir Assistente de Criação IA"
          aria-label="Abrir Assistente de Criação IA"
        >
          <span className="fab-assistant-icon">✨</span>
        </button>
      )}

      {/* ── Modais Auxiliares ── */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={() => loadLibrary()}
        existingCategories={categories}
        showToast={showToast}
      />

      <DeleteImageModal
        isOpen={deleteModalOpen}
        image={imageToDelete}
        onClose={() => { setDeleteModalOpen(false); setImageToDelete(null); }}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
      />

      <ImageDetailsModal
        isOpen={detailsModalOpen}
        image={selectedImageForDetails}
        onClose={() => { setDetailsModalOpen(false); setSelectedImageForDetails(null); }}
        onSaveMetadata={() => loadLibrary()}
        showToast={showToast}
      />
    </div>
  );
}

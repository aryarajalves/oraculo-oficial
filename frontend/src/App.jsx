import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Oraculo from './components/Oraculo';
import Criador from './components/Criador';
import ReelsCloner from './components/ReelsCloner';
import Calendar from './components/Calendar';
import Settings from './components/Settings';
import VideoFactory from './components/VideoFactory';
import Radar from './components/Radar';
import Lightbox from './components/Lightbox';
import NewCarouselModal from './components/NewCarouselModal';
import EditSlideModal from './components/EditSlideModal';
import LiveGenPanel from './components/LiveGenPanel';
import UsersManagement from './components/UsersManagement';
import BackupManagement from './components/BackupManagement';
import GenerationHistoryModal from './components/GenerationHistoryModal';
import InProgressPage from './components/InProgressPage';
import LogoutModal from './components/LogoutModal';
import { parseCarouselText } from './utils/carouselParser';
import { customFetch } from './utils/customFetch';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    // Se o usuário veio da página de login, forçamos 'carrosseis' apenas no primeiro carregamento
    if (document.referrer && (document.referrer.includes('login.html') || document.referrer.includes('login')) && !sessionStorage.getItem('loginHandled')) {
      sessionStorage.setItem('loginHandled', 'true');
      localStorage.setItem('activeTab', 'carrosseis');
      return 'carrosseis';
    }
    return localStorage.getItem('activeTab') || 'carrosseis';
  });

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
    if (activeTab === 'carrosseis') {
      loadCarousels();
      loadStats();
    }
  }, [activeTab]);
  const [allCarousels, setAllCarousels] = useState([]);
  const [stats, setStats] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [shouldAddFormMessage, setShouldAddFormMessage] = useState(false);
  const [criadorInitialMessages, setCriadorInitialMessages] = useState(null);

  // Modais
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newModalDefaults, setNewModalDefaults] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editCarouselId, setEditCarouselId] = useState('');
  const [editFilename, setEditFilename] = useState('');

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxCarouselId, setLightboxCarouselId] = useState('');
  const [lightboxSlides, setLightboxSlides] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Live Session Panel
  const [liveSession, setLiveSession] = useState(null);

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  // Histórico de Geração
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyCarouselId, setHistoryCarouselId] = useState('');
  const [branding, setBranding] = useState({
    companyName: 'FONTE OCULTA',
    logoText: 'FONTE OCULTA',
    logoSub: 'PRODUÇÃO',
    logoSize: '13px',
    logoColor: '#ffffff',
    carouselTextSize: '15px',
    carouselTextColor: '#e4e4e7'
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const initApp = async () => {
      try {
        // Executa todas as chamadas iniciais simultaneamente para evitar piscar de tela
        await Promise.all([
          loadCurrentUser(),
          loadBranding(),
          loadCarousels(),
          loadStats()
        ]);
        setupSSE();
      } catch (err) {
        console.error("Erro na inicialização do painel:", err);
      } finally {
        // Timeout curto e elegante para dar suavidade na transição
        setTimeout(() => {
          setInitialLoading(false);
        }, 600);
      }
    };

    initApp();

    const handleShowLogout = () => setLogoutModalOpen(true);
    window.addEventListener('show-logout-modal', handleShowLogout);
    return () => {
      window.removeEventListener('show-logout-modal', handleShowLogout);
    };
  }, []);

  const loadCurrentUser = async () => {
    try {
      const res = await customFetch('/api/me');
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data);
      } else {
        localStorage.removeItem('fo_token');
        window.location.href = '/login';
      }
    } catch (e) {
      localStorage.removeItem('fo_token');
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    if (branding && branding.companyName) {
      document.title = `${branding.companyName} — Dashboard de Produção`;
    } else {
      document.title = "Fonte Oculta — Dashboard de Produção";
    }
  }, [branding]);

  const loadBranding = async () => {
    try {
      const res = await customFetch('/api/settings/branding');
      const data = await res.json();
      if (data) setBranding(data);
    } catch (e) {}
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), 2500);
  };

  const loadCarousels = async () => {
    try {
      const res = await customFetch('/api/carousels');
      const data = await res.json();
      if (res.ok) {
        setAllCarousels(data);
      }
    } catch (e) {
      showToast('Erro ao carregar carrosséis.');
    }
  };

  const loadStats = async () => {
    try {
      const res = await customFetch('/api/stats');
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      }
    } catch (e) {
      showToast('Erro ao carregar estatísticas.');
    }
  };

  const setupSSE = () => {
    const token = localStorage.getItem('fo_token');
    // Para SSE passamos o token via query param se necessário, ou deixamos a rota de SSE pública ou autenticada por token via query
    const url = token ? `/api/events?token=${encodeURIComponent(token)}` : '/api/events';
    const eventSource = new EventSource(url);
    eventSource.onmessage = function(event) {
      try {
        const obj = JSON.parse(event.data);
        if (obj.type === 'start') {
          setLiveSession({
            carouselId: obj.carouselId,
            total: obj.total,
            slides: [],
            visible: true,
            expanded: false
          });
          loadCarousels();
        } else if (obj.type === 'slide') {
          setLiveSession(prev => {
            if (!prev) return prev;
            // update or add slide
            const slides = [...prev.slides];
            const idx = slides.findIndex(s => s.num === obj.num);
            const slideData = {
              num: obj.num,
              estado: obj.estado,
              filename: obj.filename,
              title_text: obj.title_text,
              status: obj.status === 'ok' ? 'ok' : obj.status === 'erro' ? 'error' : 'loading',
              timestamp: Date.now()
            };
            if (idx >= 0) slides[idx] = slideData;
            else slides.push(slideData);
            return { ...prev, slides };
          });
        } else if (obj.type === 'done' || obj.type === 'registered') {
          // reload carousels on completion
          loadCarousels();
          loadStats();
        }
      } catch (e) {}
    };
    return () => eventSource.close();
  };

  const handleCreateCarousel = async (payload) => {
    try {
      const res = await customFetch('/api/carousels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Carrossel criado com sucesso!');
        loadCarousels();
        loadStats();
      }
    } catch (e) {
      showToast('Erro ao criar carrossel.');
    }
  };

  const handleStartGeneration = async (carouselText) => {
    const payload = parseCarouselText(carouselText);
    if (payload.slides.length === 0) {
      alert('Não consegui extrair slides do carrossel!');
      return;
    }

    try {
      const res = await customFetch('/api/criador/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('✦ Pipeline de geração iniciado!');
        setActiveTab('carrosseis');
      }
    } catch (e) {
      showToast('Erro ao iniciar pipeline.');
    }
  };

  const formatSize = (val) => {
    if (!val) return '';
    const clean = val.trim();
    if (/^\d+$/.test(clean)) return `${clean}px`;
    return clean;
  };

  return (
    <div className="app-shell">
      {initialLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#09090b',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'opacity 0.5s ease',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(201, 168, 76, 0.15)',
            borderTopColor: '#C9A84C',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '20px'
          }} />
          <div style={{
            fontSize: '11px',
            color: 'rgba(237, 232, 223, 0.4)',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            fontFamily: 'sans-serif'
          }}>
            Carregando Estúdio...
          </div>
        </div>
      )}
      <style>{`
        .brand-name {
          font-size: ${formatSize(branding.logoSize)} !important;
          color: ${branding.logoColor} !important;
        }
        .carousel-card-title, .carousel-title, .slide-text, .lb-editor-textarea, .meta-textarea, .slide-preview-text {
          font-size: ${formatSize(branding.carouselTextSize)} !important;
          color: ${branding.carouselTextColor} !important;
        }
      `}</style>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        branding={branding}
        currentUser={currentUser}
        onNewCarousel={() => {
          setShouldAddFormMessage(true);
          setActiveTab('criador');
        }}
      />

      <div className="main-area">
        {currentUser?.permissions?.[activeTab] === 'em_breve' ? (
          <InProgressPage activeTab={activeTab} currentUser={currentUser} />
        ) : (
          <>
            {activeTab === 'carrosseis' && (
              <Dashboard
                allCarousels={allCarousels}
                stats={stats}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                onOpenLightbox={(id, slides, idx) => {
                  setLightboxCarouselId(id);
                  setLightboxSlides(slides);
                  setLightboxIndex(idx);
                  setLightboxOpen(true);
                }}
                onOpenEditModal={(id, filename) => {
                  setEditCarouselId(id);
                  setEditFilename(filename);
                  setEditModalOpen(true);
                }}
                onLoadCarousels={loadCarousels}
                showToast={showToast}
                onOpenHistoryModal={(id) => {
                  setHistoryCarouselId(id);
                  setHistoryModalOpen(true);
                }}
                onLoadChatHistory={(chatHistory) => {
                  setCriadorInitialMessages(chatHistory);
                  setActiveTab('criador');
                }}
              />
            )}

            {activeTab === 'calendario' && (
              <Calendar
                allCarousels={allCarousels}
                onLoadCarousels={loadCarousels}
                showToast={showToast}
              />
            )}

            {activeTab === 'reels' && (
              <ReelsCloner
                onOpenNewModal={(defaults) => {
                  setNewModalDefaults(defaults);
                  setNewModalOpen(true);
                }}
                showToast={showToast}
              />
            )}

            {activeTab === 'oraculo' && <Oraculo showToast={showToast} />}
            {activeTab === 'radar' && <Radar showToast={showToast} />}
            {activeTab === 'fabrica' && <VideoFactory />}
            {activeTab === 'criador' && (
              <Criador
                onStartGeneration={handleStartGeneration}
                showToast={showToast}
                shouldAddFormMessage={shouldAddFormMessage}
                clearAddFormMessage={() => setShouldAddFormMessage(false)}
                initialMessages={criadorInitialMessages}
                clearInitialMessages={() => setCriadorInitialMessages(null)}
              />
            )}
            {activeTab === 'configuracoes' && <Settings showToast={showToast} onLoadBranding={loadBranding} />}
            {activeTab === 'users' && <UsersManagement showToast={showToast} />}
            {activeTab === 'backups' && <BackupManagement showToast={showToast} />}
          </>
        )}
      </div>

      <Lightbox
        isOpen={lightboxOpen}
        onClose={() => { setLightboxOpen(false); loadCarousels(); }}
        carouselId={lightboxCarouselId}
        slides={lightboxSlides}
        initialIndex={lightboxIndex}
        onOpenEditModal={(id, filename) => {
          setEditCarouselId(id);
          setEditFilename(filename);
          setEditModalOpen(true);
        }}
        showToast={showToast}
      />

      <NewCarouselModal
        isOpen={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreate={handleCreateCarousel}
        defaults={newModalDefaults}
        onSendToChat={(briefing) => {
          setShouldAddFormMessage(true);
          setActiveTab('criador');
        }}
      />

      <EditSlideModal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); loadCarousels(); }}
        carouselId={editCarouselId}
        filename={editFilename}
        showToast={showToast}
      />

      <LiveGenPanel
        liveSession={liveSession}
        setLiveSession={setLiveSession}
        onOpenLightbox={(id, slides, idx) => {
          setLightboxCarouselId(id);
          setLightboxSlides(slides);
          setLightboxIndex(idx);
          setLightboxOpen(true);
        }}
      />

      <GenerationHistoryModal
        isOpen={historyModalOpen}
        onClose={() => { setHistoryModalOpen(false); loadCarousels(); }}
        carouselId={historyCarouselId}
      />

      <LogoutModal
        logoutModalOpen={logoutModalOpen}
        setLogoutModalOpen={setLogoutModalOpen}
      />

      <div className={`toast ${toastShow ? 'show' : ''}`} id="toast">
        {toastMessage}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { customFetch } from '../utils/customFetch';
import { parseCarouselText } from '../utils/carouselParser';

export function useCarouselsData({ showToast, setActiveTab }) {
  const [allCarousels, setAllCarousels] = useState([]);
  const [stats, setStats] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [imageVersion, setImageVersion] = useState(Date.now());

  const loadCarousels = async () => {
    try {
      const res = await customFetch('/api/carousels');
      const data = await res.json();
      if (res.ok) {
        setAllCarousels(data);
        setImageVersion(Date.now());
        return data;
      }
    } catch (e) {
      showToast?.('Erro ao carregar carrosséis.');
    }
    return [];
  };

  const loadStats = async () => {
    try {
      const res = await customFetch('/api/stats');
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      }
    } catch (e) {
      showToast?.('Erro ao carregar estatísticas.');
    }
  };

  // Polling automático caso haja carrosséis gerando
  useEffect(() => {
    const hasGenerating = allCarousels.some(c => c.status === 'generating');
    if (!hasGenerating) return;
    const interval = setInterval(() => {
      loadCarousels();
    }, 5000);
    return () => clearInterval(interval);
  }, [allCarousels]);

  const handleCreateCarousel = async (payload) => {
    try {
      const res = await customFetch('/api/carousels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast?.('Carrossel criado com sucesso!');
        loadCarousels();
        loadStats();
      }
    } catch (e) {
      showToast?.('Erro ao criar carrossel.');
    }
  };

  const handleStartGeneration = async (carouselText, carouselId = null) => {
    const payload = parseCarouselText(carouselText);
    if (payload.slides.length === 0) {
      alert('Não consegui extrair slides do carrossel!');
      return;
    }

    if (carouselId) {
      payload.id = carouselId;
    }

    try {
      const res = await customFetch('/api/criador/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast?.('✦ Pipeline de geração iniciado!');
        loadCarousels();
        setActiveTab?.('carrosseis');
      }
    } catch (e) {
      showToast?.('Erro ao iniciar pipeline.');
    }
  };

  const handleStartMockGeneration = async (carouselText, carouselId = null) => {
    const payload = parseCarouselText(carouselText);
    if (payload.slides.length === 0) {
      alert('Não consegui extrair slides do carrossel!');
      return;
    }

    if (carouselId) {
      payload.id = carouselId;
    }

    try {
      const res = await customFetch('/api/escala/criar-mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast?.('⚡ Pipeline de geração rápida (mock) concluído!');
        setActiveTab?.('carrosseis');
      } else {
        const err = await res.json();
        showToast?.(`Erro ao criar design rápido: ${err.error || err.detail}`);
      }
    } catch (e) {
      showToast?.('Erro ao iniciar pipeline rápido.');
    }
  };

  return {
    allCarousels,
    setAllCarousels,
    stats,
    setStats,
    filterStatus,
    setFilterStatus,
    imageVersion,
    setImageVersion,
    loadCarousels,
    loadStats,
    handleCreateCarousel,
    handleStartGeneration,
    handleStartMockGeneration
  };
}

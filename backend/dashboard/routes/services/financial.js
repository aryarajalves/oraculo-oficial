import express from "express";
import { 
  readDataAsync, 
  getSlidesForCarousel, 
  getCarouselCostDetails 
} from "../../helpers.js";
import { logger } from "../../logger.js";

const router = express.Router();

const USD_TO_BRL_RATE = 5.00;

// ── API: Resumo e Métricas Financeiras de Carrosséis ─────────────────────────
router.get("/api/financial/summary", async (req, res) => {
  try {
    const all = await readDataAsync();
    
    let totalSlides = 0;
    let totalPaidSlides = 0;
    let totalFreeSlides = 0;
    let totalCostUsd = 0;
    let totalSavedUsd = 0;

    const providerMap = {};
    const statusMap = {};
    const themeMap = {};

    const enrichedCarousels = all.map(c => {
      const slides = getSlidesForCarousel(c);
      const costDetails = getCarouselCostDetails(c);

      const costUsd = Number(costDetails.cost) || 0;
      const costBrl = Math.round(costUsd * USD_TO_BRL_RATE * 100) / 100;
      const savedUsd = Number(costDetails.savedCost) || 0;
      const savedBrl = Math.round(savedUsd * USD_TO_BRL_RATE * 100) / 100;
      const costPerImageUsd = Number(costDetails.costPerImage) || 0;
      const costPerImageBrl = Math.round(costPerImageUsd * USD_TO_BRL_RATE * 100) / 100;

      const paidSlides = Number(costDetails.paidSlides) || 0;
      const freeSlides = Number(costDetails.freeSlides) || 0;
      const slideCount = slides.length || (paidSlides + freeSlides);

      totalSlides += slideCount;
      totalPaidSlides += paidSlides;
      totalFreeSlides += freeSlides;
      totalCostUsd += costUsd;
      totalSavedUsd += savedUsd;

      // Agrupamento por Provedor de Imagem
      const provider = c.imageProvider || 'gpt-image-2';
      if (!providerMap[provider]) {
        providerMap[provider] = {
          provider,
          carouselsCount: 0,
          totalSlides: 0,
          paidSlides: 0,
          freeSlides: 0,
          costUsd: 0,
          costBrl: 0,
          savedUsd: 0,
          savedBrl: 0,
        };
      }
      providerMap[provider].carouselsCount += 1;
      providerMap[provider].totalSlides += slideCount;
      providerMap[provider].paidSlides += paidSlides;
      providerMap[provider].freeSlides += freeSlides;
      providerMap[provider].costUsd += costUsd;
      providerMap[provider].costBrl += costBrl;
      providerMap[provider].savedUsd += savedUsd;
      providerMap[provider].savedBrl += savedBrl;

      // Agrupamento por Status
      const status = c.status || 'rascunho';
      if (!statusMap[status]) {
        statusMap[status] = { status, count: 0, costUsd: 0, costBrl: 0 };
      }
      statusMap[status].count += 1;
      statusMap[status].costUsd += costUsd;
      statusMap[status].costBrl += costBrl;

      // Agrupamento por Tema
      const theme = c.theme || 'Geral';
      if (!themeMap[theme]) {
        themeMap[theme] = { theme, count: 0, costUsd: 0, costBrl: 0 };
      }
      themeMap[theme].count += 1;
      themeMap[theme].costUsd += costUsd;
      themeMap[theme].costBrl += costBrl;

      const firstSlide = slides && slides.length > 0
        ? (typeof slides[0] === 'string' ? slides[0] : slides[0]?.filename)
        : null;

      return {
        id: c.id,
        title: c.title || 'Sem título',
        theme: c.theme || 'Não definido',
        praca: c.praca || '',
        format: c.format || 'quadrado',
        preset: c.preset || '',
        status: c.status || 'rascunho',
        createdAt: c.createdAt || c.created_at || '',
        imageQuality: c.imageQuality || 'high',
        imageProvider: provider,
        copyModel: c.copyModel || 'gpt-4o',
        totalSlides: slideCount,
        paidSlides,
        freeSlides,
        costPerImageUsd,
        costPerImageBrl,
        costUsd: Math.round(costUsd * 100) / 100,
        costBrl,
        savedUsd: Math.round(savedUsd * 100) / 100,
        savedBrl,
        cover: c.cover || firstSlide,
        slides,
        notes: c.notes,
        caption: c.caption
      };
    });

    const totalCostBrl = Math.round(totalCostUsd * USD_TO_BRL_RATE * 100) / 100;
    const totalSavedBrl = Math.round(totalSavedUsd * USD_TO_BRL_RATE * 100) / 100;
    const totalCarousels = all.length;

    const avgCostPerCarouselUsd = totalCarousels > 0 ? Math.round((totalCostUsd / totalCarousels) * 100) / 100 : 0;
    const avgCostPerCarouselBrl = totalCarousels > 0 ? Math.round((totalCostBrl / totalCarousels) * 100) / 100 : 0;
    const avgCostPerSlideUsd = totalPaidSlides > 0 ? Math.round((totalCostUsd / totalPaidSlides) * 1000) / 1000 : 0;
    const avgCostPerSlideBrl = totalPaidSlides > 0 ? Math.round((totalCostBrl / totalPaidSlides) * 1000) / 1000 : 0;

    // Calcular percentuais de participação por provedor
    const providersList = Object.values(providerMap).map(p => {
      p.costUsd = Math.round(p.costUsd * 100) / 100;
      p.costBrl = Math.round(p.costBrl * 100) / 100;
      p.savedUsd = Math.round(p.savedUsd * 100) / 100;
      p.savedBrl = Math.round(p.savedBrl * 100) / 100;
      p.sharePercent = totalCostUsd > 0 ? Math.round((p.costUsd / totalCostUsd) * 1000) / 10 : 0;
      return p;
    }).sort((a, b) => b.costBrl - a.costBrl);

    // Formatar top temas
    const topThemes = Object.values(themeMap)
      .map(t => ({
        ...t,
        costUsd: Math.round(t.costUsd * 100) / 100,
        costBrl: Math.round(t.costBrl * 100) / 100,
      }))
      .sort((a, b) => b.costBrl - a.costBrl)
      .slice(0, 5);

    res.json({
      summary: {
        totalCarousels,
        totalSlides,
        totalPaidSlides,
        totalFreeSlides,
        totalCostUsd: Math.round(totalCostUsd * 100) / 100,
        totalCostBrl,
        totalSavedUsd: Math.round(totalSavedUsd * 100) / 100,
        totalSavedBrl,
        avgCostPerCarouselUsd,
        avgCostPerCarouselBrl,
        avgCostPerSlideUsd,
        avgCostPerSlideBrl,
        usdRate: USD_TO_BRL_RATE,
        savingsRatePercent: totalSlides > 0 ? Math.round((totalFreeSlides / totalSlides) * 1000) / 10 : 0,
        lastUpdated: new Date().toISOString()
      },
      providers: providersList,
      byStatus: statusMap,
      topThemes,
      carousels: enrichedCarousels
    });
  } catch (err) {
    logger.error("[Financial]", "Erro ao gerar resumo financeiro:", err);
    res.status(500).json({ error: "Erro ao carregar dados financeiros: " + err.message });
  }
});

export default router;

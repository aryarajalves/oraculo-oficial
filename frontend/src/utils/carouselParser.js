/**
 * Parses the raw AI generated text for a carousel into a structured payload.
 * Used by the Criador component to send data to the backend generation pipeline.
 * 
 * @param {string} text Raw markdown/text from the AI
 * @returns {object} Parsed carousel payload
 */
export function parseCarouselText(text, fallbackData = null) {
  const t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const temaMatch = t.match(/TEMA:\s*(.+)/i);
  const pracaMatch = t.match(/PRA[ÇC]A:\s*(.+)/i);
  const bigIdea = t.match(/BIG IDEA:\s*(.+)/i);
  const revisorMatch = t.match(/TOTAL:\s*([\d]+\/15)/i);
  const captionMatch = t.match(/CAPTION[^:\n]*:\s*\n([\s\S]+?)(?=\nCTA TRIBAL|━)/i);
  const ctaMatch = t.match(/CTA TRIBAL:\s*"([^"\n]+)"/i);
  
  // Se houver fallbackData, usamos o título original do formulário. Caso contrário, tenta do Match, senão fallback final.
  const title = temaMatch 
    ? temaMatch[1].trim().slice(0, 80) 
    : (fallbackData?.title || 'Carrossel Fonte Oculta');
    
  const caption = (captionMatch?.[1] || bigIdea?.[1] || '').trim();

  const slides = [];
  const lines = t.split('\n');
  const slideHeader = /^(?:\[S(\d+)\s*[—–\-]?\s*([^\]|]*?)(?:\s*\|\s*layout:\s*([^\]\s|]+))?\s*\]|\*\*S(\d+)\s*[:—–\-]?\*\*|\bSLIDE\s*(\d+)\b|\bS(\d+)\s*[:—–\-]\s*)/i;
  let current = null;
  let field = null;

  const flush = () => {
    if (current && (current.title || current.body)) {
      slides.push({
        num: current.num,
        estado: current.estado,
        layout: current.layout,
        title: current.title.trim(),
        body: current.body.trim(),
        prompt: current.prompt.trim(),
      });
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    const hm = line.match(slideHeader);
    if (hm) {
      flush();
      const num = (hm[1] || hm[4] || hm[5] || hm[6] || '').padStart(2, '0');
      const estado = hm[2] ? hm[2].trim().replace(/[^\w\s]/g, '').trim().toUpperCase() : `SLIDE ${num}`;
      let layout = (hm[3] || 'fullbleed').trim().toLowerCase();
      // Remove acentos para compatibilidade com o backend (ex: "dramático" -> "dramatico")
      layout = layout.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      current = {
        num,
        estado,
        layout,
        title: '', body: '', prompt: '',
      };
      field = null;
      continue;
    }
    if (!current) continue;
    if (/^T[IÍ]TULO:\s*/i.test(line)) {
      field = 'title';
      current.title = line.replace(/^T[IÍ]TULO:\s*/i, '');
      continue;
    }
    if (/^CORPO:\s*/i.test(line)) {
      field = 'body';
      current.body = line.replace(/^CORPO:\s*/i, '');
      continue;
    }
    if (/^VISUAL:\s*/i.test(line)) {
      field = 'prompt';
      current.prompt = line.replace(/^VISUAL:\s*/i, '');
      continue;
    }
    if (line === '') {
      if (field === 'prompt') field = null;
      // Permitir quebras de linha dentro do título e corpo ao invés de resetar/pular
      if (field === 'title') current.title += '\n';
      if (field === 'body') current.body += '\n';
      continue;
    }
    if (field === 'title') current.title += (current.title ? '\n' : '') + line;
    if (field === 'body') current.body += (current.body ? '\n' : '') + line;
    if (field === 'prompt') current.prompt += (current.prompt ? ' ' : '') + line;
  }
  flush();

  const finalTitle = temaMatch 
    ? temaMatch[1].trim().slice(0, 80) 
    : (slides[0]?.title?.replace(/\n/g, ' ') || fallbackData?.title || 'Carrossel Fonte Oculta');

  return {
    title: finalTitle,
    theme: temaMatch 
      ? finalTitle.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-').slice(0, 48)
      : (fallbackData?.theme || finalTitle.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-').slice(0, 48)),
    format: pracaMatch?.[1]?.trim().slice(0, 20) || (fallbackData?.format || 'B'),
    caption: caption || (fallbackData?.caption || ''),
    notes: ctaMatch?.[1]?.trim() || (fallbackData?.notes || ''),
    revisor_score: revisorMatch?.[1] || '',
    slides,
    totalSlides: slides.length || fallbackData?.totalSlides || 10,
    imageQuality: fallbackData?.imageQuality || 'high',
    // Contagem de slides com fundo preto (text_only) extraída diretamente da estrutura gerada pela IA
    noImageSlidesCount: slides.filter(s => s.layout === 'text_only').length,
  };
}

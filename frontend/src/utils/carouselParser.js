/**
 * Parses the raw AI generated text for a carousel into a structured payload.
 * Used by the Criador component to send data to the backend generation pipeline.
 * 
 * @param {string} text Raw markdown/text from the AI
 * @returns {object} Parsed carousel payload
 */
export function parseCarouselText(text) {
  const t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const temaMatch = t.match(/TEMA:\s*(.+)/i);
  const pracaMatch = t.match(/PRA[ÇC]A:\s*(.+)/i);
  const bigIdea = t.match(/BIG IDEA:\s*(.+)/i);
  const revisorMatch = t.match(/TOTAL:\s*([\d]+\/15)/i);
  const captionMatch = t.match(/CAPTION[^:\n]*:\s*\n([\s\S]+?)(?=\nCTA TRIBAL|━)/i);
  const ctaMatch = t.match(/CTA TRIBAL:\s*"([^"\n]+)"/i);
  const title = temaMatch ? temaMatch[1].trim().slice(0, 80) : 'Carrossel Fonte Oculta';
  const caption = (captionMatch?.[1] || bigIdea?.[1] || '').trim().slice(0, 800);

  const slides = [];
  const lines = t.split('\n');
  const slideHeader = /^(?:\[S(\d+)\s*[—–\-]?\s*([^\]|]*?)(?:\s*\|\s*layout:\s*(\w+))?\s*\]|SLIDE\s*(\d+)\b)/i;
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
      const num = (hm[1] || hm[4] || '').padStart(2, '0');
      const estado = hm[2] ? hm[2].trim().replace(/[^\w\s]/g, '').trim().toUpperCase() : `SLIDE ${num}`;
      const layout = (hm[3] || 'fullbleed').trim();
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
      continue;
    }
    if (field === 'title') current.title += '\n' + line;
    if (field === 'body') current.body += '\n' + line;
    if (field === 'prompt') current.prompt += ' ' + line;
  }
  flush();

  return {
    title,
    theme: title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-').slice(0, 48),
    format: pracaMatch?.[1]?.trim().slice(0, 20) || 'B',
    caption,
    notes: ctaMatch?.[1]?.trim() || '',
    revisor_score: revisorMatch?.[1] || '',
    slides,
  };
}

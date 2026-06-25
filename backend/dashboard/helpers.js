import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { query } from "./db.js";
import { logger } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === "production";

let b2 = null;
if (IS_PROD) {
  try {
    b2 = await import("./b2.js");
  } catch (e) {
    logger.error('[B2]', 'Erro ao carregar módulo B2 em helpers:', e);
  }
}

export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function mapCarouselFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    theme: row.theme,
    praca: row.praca,
    format: row.format,
    preset: row.preset,
    status: row.status,
    createdAt: row.created_at,
    slidesDir: row.slides_dir,
    slidePrefix: row.slide_prefix,
    totalSlides: row.total_slides,
    caption: row.caption,
    notes: row.notes,
    slides: typeof row.slides === 'string' ? JSON.parse(row.slides) : (row.slides || []),
    chatHistory: typeof row.chat_history === 'string' ? JSON.parse(row.chat_history) : (row.chat_history || [])
  };
}

export async function readData() {
  try {
    const res = await query("SELECT * FROM carousels ORDER BY id ASC");
    return res.rows.map(mapCarouselFromDb);
  } catch (err) {
    logger.error('[Helpers]',"Erro ao ler carrosséis do banco:", err);
    return [];
  }
}

export async function writeData(data) {
  try {
    await query("BEGIN");
    const currentIds = data.map(c => c.id).filter(Boolean);
    if (currentIds.length > 0) {
      await query("DELETE FROM carousels WHERE id NOT IN (" + currentIds.map((_, i) => `$${i + 1}`).join(",") + ")", currentIds);
    } else {
      await query("DELETE FROM carousels");
    }

    for (const c of data) {
      const upsertQuery = `
        INSERT INTO carousels (
          id, title, theme, praca, format, preset, status, created_at,
          slides_dir, slide_prefix, total_slides, caption, notes, slides, chat_history
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          theme = EXCLUDED.theme,
          praca = EXCLUDED.praca,
          format = EXCLUDED.format,
          preset = EXCLUDED.preset,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at,
          slides_dir = EXCLUDED.slides_dir,
          slide_prefix = EXCLUDED.slide_prefix,
          total_slides = EXCLUDED.total_slides,
          caption = EXCLUDED.caption,
          notes = EXCLUDED.notes,
          slides = EXCLUDED.slides,
          chat_history = EXCLUDED.chat_history
      `;
      const params = [
        c.id,
        c.title || '',
        c.theme || '',
        c.praca || '',
        c.format || '',
        c.preset || '',
        c.status || '',
        c.createdAt || '',
        c.slidesDir || '',
        c.slidePrefix || '',
        c.totalSlides || 0,
        c.caption || '',
        c.notes || '',
        JSON.stringify(c.slides || []),
        JSON.stringify(c.chatHistory || [])
      ];
      await query(upsertQuery, params);
    }
    await query("COMMIT");
  } catch (err) {
    await query("ROLLBACK");
    logger.error('[Helpers]',"Erro ao salvar carrosséis no banco:", err);
    throw err;
  }
}

export async function readDataAsync() {
  if (IS_PROD && b2) return b2.readDataFromB2();
  return readData();
}

export async function writeDataAsync(data) {
  if (IS_PROD && b2) {
    await b2.writeDataToB2(data);
    return;
  }
  await writeData(data);
}

export function getLocalSlidesDir(c) {
  if (!c.slidesDir) return "";
  if (c.slidesDir.startsWith("b2://")) {
    return path.join("C:\\Users\\julia\\Desktop", `carrossel-${c.theme}`);
  }
  return c.slidesDir;
}

export function getSlidesFromDir(dir, prefix = "slide-") {
  try {
    const files = fs.readdirSync(dir);
    return files
      .filter(f => f.startsWith(prefix) && /\.(jpg|jpeg|png)$/i.test(f))
      .sort()
      .map(f => ({ filename: f, path: path.join(dir, f) }));
  } catch {
    return [];
  }
}

export function getSlidesForCarousel(c) {
  if (c.slides && c.slides.length > 0) {
    return c.slides.map(s => typeof s === 'string' ? s : (s.filename || s.name));
  }
  return getSlidesFromDir(getLocalSlidesDir(c), c.slidePrefix).map(s => s.filename);
}

export async function readReelsHistory() {
  try {
    const res = await query("SELECT * FROM reels_history ORDER BY id DESC");
    return res.rows;
  } catch (err) {
    logger.error('[Helpers]',"Erro ao ler reels do banco:", err);
    return [];
  }
}

export async function writeReelsHistory(data) {
  try {
    await query("BEGIN");
    await query("DELETE FROM reels_history");
    for (const r of data) {
      const insQuery = `
        INSERT INTO reels_history (
          gancho_original, padrao_psicologico, roteiro_fonte_oculta,
          transcricao_original, url, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;
      const params = [
        r.gancho_original || '',
        r.padrao_psicologico || '',
        r.roteiro_fonte_oculta || '',
        r.transcricao_original || '',
        r.url || '',
        r.timestamp || ''
      ];
      await query(insQuery, params);
    }
    await query("COMMIT");
  } catch (err) {
    await query("ROLLBACK");
    logger.error('[Helpers]',"Erro ao salvar reels no banco:", err);
    throw err;
  }
}

"""
compose_util.py — Motor de composição v2
Suporta: bold inline, alinhamento esquerdo, film grain, vignette,
         gradiente longo, layout texto-pesado, 6 presets visuais.

Marcação de texto:
  **texto**  → negrito (Franklin Gothic Heavy)
  *texto*    → itálico (Franklin Gothic HeavyItalic)
  texto      → regular (Inter Regular)

Layouts:
  fullbleed   — imagem de fundo + gradiente + texto embaixo (centralizado)
  dramatico   — imagem de fundo + grain + gradiente longo + texto ESQUERDA grande
  etereo      — imagem quente + gradiente suave + texto ESQUERDA itálico
  text_only   — fundo escuro cósmico + texto ESQUERDA pesado (sem imagem real)
  card        — imagem no card superior + texto embaixo

Design Presets:
  manuscrito_sagrado      — dourado antigo, warm
  cinematografico         — azul elétrico, sci
  cinematografico_crimson — vermelho confronto
  esoterico_minimalista   — roxo violeta
  dramatico               — preto intenso, grain, ouro
  etereo_luminoso         — âmbar luminoso, suave
"""

import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from io import BytesIO
from pathlib import Path

W, H        = 1080, 1350
MARGIN_C    = 92    # margem para texto centralizado
MARGIN_L    = 84    # margem esquerda para texto left-aligned
MARGIN_R    = 84    # margem direita
MAX_TW_C    = W - MARGIN_C * 2   # 920px centralizado
MAX_TW_L    = W - MARGIN_L - MARGIN_R  # 936px left

from core.util.fonts import get_fonts as _get_fonts
_FONTS   = _get_fonts()
F_HEAVY  = _FONTS["heavy"]
F_HEAVY_IT = _FONTS["heavy_it"]
F_BOLD   = _FONTS["bold"]
F_REGULAR = _FONTS["regular"]
F_MARK   = _FONTS["mark"]


# ── DESIGN PRESETS ────────────────────────────────────────────────────────────

PRESETS = {

    "manuscrito_sagrado": {
        "bg"              : (8,   6,   4,  255),
        "title_color"     : (255, 255, 255, 255),
        "body_color"      : (240, 232, 208, 255),
        "bold_color"      : (255, 255, 255, 255),
        "italic_color"    : (230, 215, 175, 255),
        "watermark_color" : (180, 150,  60, 200),
        "card_bg"         : (12,  10,   6,  255),
        "card_border"     : (201, 160,  53, 100),
        "gradient_tint"   : (30,  18,   2),
        "gradient_start"  : 0.36,
        "gradient_max"    : 238,
        "title_px"        : 76,
        "title_min_px"    : 36,
        "body_px"         : 40,
        "body_min_px"     : 30,
        "film_grain"      : False,
        "vignette"        : True,
    },

    "cinematografico": {
        "bg"              : (4,   4,   8,  255),
        "title_color"     : (255, 255, 255, 255),
        "body_color"      : (210, 225, 248, 255),
        "bold_color"      : (255, 255, 255, 255),
        "italic_color"    : (180, 210, 255, 255),
        "watermark_color" : (80, 130, 220, 160),
        "card_bg"         : (6,   6,  14,  255),
        "card_border"     : (26,  110, 255,  90),
        "gradient_tint"   : (2,   4,  22),
        "gradient_start"  : 0.38,
        "gradient_max"    : 240,
        "title_px"        : 76,
        "title_min_px"    : 36,
        "body_px"         : 40,
        "body_min_px"     : 30,
        "film_grain"      : False,
        "vignette"        : True,
    },

    "cinematografico_crimson": {
        "bg"              : (6,   2,   2,  255),
        "title_color"     : (255, 255, 255, 255),
        "body_color"      : (245, 220, 220, 255),
        "bold_color"      : (255, 255, 255, 255),
        "italic_color"    : (255, 190, 190, 255),
        "watermark_color" : (180,  60,  60, 180),
        "card_bg"         : (12,   4,   4,  255),
        "card_border"     : (139,   0,   0,  90),
        "gradient_tint"   : (28,   4,   4),
        "gradient_start"  : 0.62,  # preserva 62% da pintura intacta (era 0.42)
        "gradient_max"    : 220,   # menos opaco — arte respira (era 255)
        "title_px"        : 84,
        "title_min_px"    : 38,
        "body_px"         : 38,
        "body_min_px"     : 28,
        "film_grain"      : False,  # grain não combina com pintura (era True)
        "vignette"        : True,
    },

    "esoterico_minimalista": {
        "bg"              : (10,   8,  20,  255),
        "title_color"     : (255, 255, 255, 255),
        "body_color"      : (218, 200, 240, 255),
        "bold_color"      : (255, 255, 255, 255),
        "italic_color"    : (200, 170, 240, 255),
        "watermark_color" : (160, 110, 220, 180),
        "card_bg"         : (16,  10,  28,  255),
        "card_border"     : (140,  80, 220,  80),
        "gradient_tint"   : (8,    2,  18),   # tint mais escuro/frio
        "gradient_start"  : 0.30,             # começa mais cedo (era 0.38)
        "gradient_max"    : 252,              # mais opaco na base (era 238)
        "title_px"        : 72,
        "title_min_px"    : 34,
        "body_px"         : 38,
        "body_min_px"     : 29,
        "film_grain"      : False,
        "vignette"        : True,
    },

    # ── NOVA VARIAÇÃO 1 — DRAMÁTICO ───────────────────────────────────────────
    "dramatico": {
        "bg"              : (4,   2,   2,  255),
        "title_color"     : (255, 255, 255, 255),
        "body_color"      : (235, 228, 218, 255),
        "bold_color"      : (255, 248, 220, 255),
        "italic_color"    : (255, 235, 190, 255),
        "watermark_color" : (200, 170,  90, 170),
        "card_bg"         : (8,   4,   2,  255),
        "card_border"     : (180, 130,  40,  80),
        "gradient_tint"   : (18,   6,   2),
        "gradient_start"  : 0.38,
        "gradient_max"    : 248,
        "title_px"        : 84,
        "title_min_px"    : 42,
        "body_px"         : 40,
        "body_min_px"     : 28,
        "film_grain"      : True,
        "vignette"        : True,
    },

    # ── NOVA VARIAÇÃO 2 — ETÉREO LUMINOSO ────────────────────────────────────
    "etereo_luminoso": {
        "bg"              : (6,   4,   2,  255),
        "title_color"     : (255, 255, 255, 255),
        "body_color"      : (248, 240, 225, 255),
        "bold_color"      : (255, 255, 255, 255),
        "italic_color"    : (255, 245, 210, 255),
        "watermark_color" : (220, 190, 100, 160),
        "card_bg"         : (10,   6,   2,  255),
        "card_border"     : (200, 160,  60,  70),
        "gradient_tint"   : (24,  10,   2),
        "gradient_start"  : 0.40,
        "gradient_max"    : 235,
        "title_px"        : 76,
        "title_min_px"    : 38,
        "body_px"         : 40,
        "body_min_px"     : 28,
        "film_grain"      : False,
        "vignette"        : True,
    },
}

DEFAULT_PRESET = "manuscrito_sagrado"


def get_preset(name: str) -> dict:
    return PRESETS.get(name, PRESETS[DEFAULT_PRESET])


# ── FONT UTILITIES ────────────────────────────────────────────────────────────

def load_font(path, size):
    try:    return ImageFont.truetype(path, max(size, 10))
    except: return ImageFont.load_default()


# ── INLINE MARKUP PARSER ─────────────────────────────────────────────────────

def parse_markup(text: str):
    """
    Parseia **bold**, *italic* e texto normal.
    Retorna lista de (segment_text, style) onde style é 'bold'|'italic'|'normal'.
    """
    segments = []
    i = 0
    while i < len(text):
        if text[i:i+2] == "**":
            end = text.find("**", i + 2)
            if end != -1:
                segments.append((text[i+2:end], "bold"))
                i = end + 2
                continue
        if text[i] == "*" and (i == 0 or text[i-1] != "*"):
            end = text.find("*", i + 1)
            if end != -1 and text[end:end+2] != "**":
                segments.append((text[i+1:end], "italic"))
                i = end + 1
                continue
        # acumula texto normal
        j = i + 1
        while j < len(text):
            if text[j:j+2] == "**" or (text[j] == "*" and text[j:j+2] != "**"):
                break
            j += 1
        segments.append((text[i:j], "normal"))
        i = j
    return segments


def seg_font(style: str, size: int):
    if style == "bold":
        return load_font(F_HEAVY, size)
    if style == "italic":
        return load_font(F_HEAVY_IT, size)
    return load_font(F_REGULAR, size)


def measure_segment(draw, text, style, size):
    f  = seg_font(style, size)
    bb = draw.textbbox((0, 0), text, font=f)
    return bb[2] - bb[0], bb[3] - bb[1]


# ── WORD WRAP (com suporte a markup) ─────────────────────────────────────────

def wrap_markup_lines(draw, raw_line: str, size: int, max_w: int):
    """
    Recebe uma linha com markup (**bold**, *italic*), retorna lista de linhas
    onde cada linha é [(segment_text, style), ...] e cabe em max_w pixels.
    Evita orphans: se a última linha tiver só 1 palavra curta, puxa uma
    palavra da linha anterior para companhia.
    """
    segments = parse_markup(raw_line)

    # Expande em palavras preservando estilo
    words = []
    for seg_text, style in segments:
        for w in seg_text.split(" "):
            if w:
                words.append((w + " ", style))

    lines  = []
    cur_ln = []
    cur_w  = 0

    for word, style in words:
        ww, _ = measure_segment(draw, word, style, size)
        if cur_w + ww > max_w and cur_ln:
            lines.append(cur_ln)
            cur_ln = [(word, style)]
            cur_w  = ww
        else:
            cur_ln.append((word, style))
            cur_w += ww

    if cur_ln:
        lines.append(cur_ln)

    # Anti-orphan: se última linha tem só 1 segmento curto (<= 8 chars),
    # move a última palavra da linha anterior para ela
    if len(lines) >= 2:
        last = lines[-1]
        last_text = "".join(t for t, _ in last).strip()
        if len(last_text) <= 8 and len(lines[-2]) > 1:
            moved = lines[-2].pop()
            lines[-1] = [moved] + lines[-1]

    return lines


def line_px_height(draw, size: int) -> int:
    f  = load_font(F_REGULAR, size)
    bb = draw.textbbox((0, 0), "Ag", font=f)
    return bb[3] - bb[1]


# ── RENDER MARKUP BLOCK ───────────────────────────────────────────────────────

def render_markup_block(draw, raw_text: str, size: int, x0: int, y: float,
                        preset: dict, ls=1.55, align="left", max_w=None):
    """
    Renderiza bloco de texto com markup. Retorna y final.
    align: 'left' | 'center'
    """
    if max_w is None:
        max_w = MAX_TW_L if align == "left" else MAX_TW_C

    lh = line_px_height(draw, size) * ls

    for raw_line in raw_text.split("\n"):
        wrapped = wrap_markup_lines(draw, raw_line, size, max_w)
        if not wrapped:
            y += lh * 0.5
            continue
        for ln_segs in wrapped:
            # calcula largura total da linha para centralizar se necessário
            total_w = sum(measure_segment(draw, t, s, size)[0] for t, s in ln_segs)
            if align == "center":
                cx = (W - total_w) // 2
            else:
                cx = x0

            xc = cx
            for seg_text, style in ln_segs:
                col = (preset.get("bold_color")   if style == "bold"
                       else preset.get("italic_color") if style == "italic"
                       else preset.get("body_color"))
                f  = seg_font(style, size)
                # sombra leve
                draw.text((xc + 2, y + 2), seg_text, font=f, fill=(0, 0, 0, 120))
                draw.text((xc,     y),     seg_text, font=f, fill=col)
                sw, _ = measure_segment(draw, seg_text, style, size)
                xc += sw
            y += lh

    return y


# ── TÍTULO (sem markup, sempre pesado) ───────────────────────────────────────

def render_title(draw, title: str, size: int, x0: int, y: float,
                 color, ls=1.22, align="left", max_w=None):
    """Renderiza título em Franklin Gothic Heavy, auto-wrapping."""
    if max_w is None:
        max_w = MAX_TW_L if align == "left" else MAX_TW_C

    f  = load_font(F_HEAVY, size)
    lh = line_px_height(draw, size) * ls

    all_lines = []
    for raw_line in title.split("\n"):
        words = raw_line.split(" ")
        cur   = ""
        for w in words:
            test = (cur + " " + w).strip()
            bb   = draw.textbbox((0, 0), test, font=f)
            if (bb[2] - bb[0]) > max_w and cur:
                all_lines.append(cur)
                cur = w
            else:
                cur = test
        if cur:
            all_lines.append(cur)

    for ln in all_lines:
        bb = draw.textbbox((0, 0), ln, font=f)
        lw = bb[2] - bb[0]
        if align == "center":
            x = (W - lw) // 2
        else:
            x = x0
        draw.text((x + 2, y + 2), ln, font=f, fill=(0, 0, 0, 150))
        draw.text((x,     y),     ln, font=f, fill=color)
        y += lh

    return y


def fit_title_size(draw, title: str, start_px: int, min_px: int,
                   align="left", max_w=None):
    """Reduz fonte até o título caber sem ultrapassar MAX_TW."""
    if max_w is None:
        max_w = MAX_TW_L if align == "left" else MAX_TW_C
    f = load_font(F_HEAVY, start_px)
    for sz in range(start_px, min_px - 1, -2):
        f = load_font(F_HEAVY, sz)
        too_wide = False
        for ln in title.split("\n"):
            bb = draw.textbbox((0, 0), ln, font=f)
            if (bb[2] - bb[0]) > max_w:
                too_wide = True
                break
        if not too_wide:
            return sz
    return min_px


# ── GRADIENTE ─────────────────────────────────────────────────────────────────

def dark_gradient(img, preset: dict):
    ov     = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d      = ImageDraw.Draw(ov)
    _, h   = img.size
    start  = preset.get("gradient_start", 0.38)
    amax   = preset.get("gradient_max",   240)
    tint   = preset.get("gradient_tint",  (0, 0, 0))
    sy     = int(h * start)

    for y in range(sy, h):
        p = (y - sy) / (h - sy)
        a = int(amax * p ** 0.55)
        r = min(tint[0] + int((1 - p) * 8), 32)
        g = min(tint[1] + int((1 - p) * 8), 24)
        b = min(tint[2] + int((1 - p) * 8), 38)
        d.line([(0, y), (W, y)], fill=(r, g, b, a))

    return Image.alpha_composite(img.convert("RGBA"), ov)


# ── VIGNETTE ──────────────────────────────────────────────────────────────────

def add_vignette(img, strength=0.40):
    """
    Desativado. Retorna imagem intacta sem borrões escuros nas bordas.
    """
    return img


# ── EDGE BLACKOUT ─────────────────────────────────────────────────────────────

def fill_edges_black(img, side_width=320, top_width=104):
    """
    Desativado. Função legada usada para remover bordas brancas do Gemini.
    Retorna a imagem intacta (sem as grandes manchas pretas nas laterais).
    """
    return img


# ── FILM GRAIN ────────────────────────────────────────────────────────────────

def add_film_grain(img, intensity=18):
    """Adiciona ruído cinematográfico analógico."""
    arr    = np.array(img.convert("RGBA"), dtype=np.int16)
    noise  = np.random.randint(-intensity, intensity + 1,
                               arr.shape[:2], dtype=np.int16)
    for c in range(3):
        arr[:, :, c] = np.clip(arr[:, :, c] + noise, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


# ── WATERMARKS ────────────────────────────────────────────────────────────────

def _watermarks(draw, color):
    mark = "@afonteoculta"
    fm   = load_font(F_MARK, 28)
    draw.text((MARGIN_L, 48), mark, font=fm, fill=color)


# ── DARK COSMIC BG (para text_only) ──────────────────────────────────────────

def make_cosmic_bg(preset: dict, img_bytes=None):
    """
    Cria fundo escuro para layout text_only.
    Se img_bytes fornecido, usa como textura muito escurecida.
    """
    bg_color = preset.get("bg", (6, 4, 10, 255))
    base = Image.new("RGBA", (W, H), bg_color)

    if img_bytes:
        try:
            tex = Image.open(BytesIO(img_bytes)).convert("RGBA").resize((W, H), Image.LANCZOS)
            # blend muito escuro — imagem é só textura
            dark = Image.new("RGBA", (W, H), (0, 0, 0, 195))
            tex  = Image.alpha_composite(tex, dark)
            base = Image.alpha_composite(base, tex)
        except:
            pass

    # ruído sutil de textura
    arr   = np.array(base, dtype=np.int16)
    noise = np.random.randint(-6, 7, arr.shape[:2], dtype=np.int16)
    for c in range(3):
        arr[:, :, c] = np.clip(arr[:, :, c] + noise, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


# ── LAYOUTS ───────────────────────────────────────────────────────────────────

def compose_fullbleed(img_bytes, title, body, preset: dict):
    """Layout fullbleed: imagem full + gradiente + texto LEFT embaixo."""
    p   = preset
    bg  = Image.open(BytesIO(img_bytes)).convert("RGBA").resize((W, H), Image.LANCZOS)
    bg  = fill_edges_black(bg)
    bg  = dark_gradient(bg, p)
    if p.get("vignette"):
        bg = add_vignette(bg)
    if p.get("film_grain"):
        bg = add_film_grain(bg)

    draw = ImageDraw.Draw(bg)
    _watermarks(draw, p["watermark_color"])

    t_start = min(p["title_px"], 80)
    t_min   = p["title_min_px"]
    b_sz    = p["body_px"]
    gap     = 22

    t_sz = fit_title_size(draw, title, t_start, t_min, align="left")

    def calc_heights(ts, bs):
        lht = line_px_height(draw, ts) * 1.18
        lhb = line_px_height(draw, bs) * 1.55
        nt  = sum(len(wrap_markup_lines(draw, ln, ts, MAX_TW_L)) or 1
                  for ln in title.split("\n"))
        nb  = sum(len(wrap_markup_lines(draw, ln, bs, MAX_TW_L)) or 1
                  for ln in body.split("\n"))
        return int(nt * lht), int(nb * lhb)

    th, bh = calc_heights(t_sz, b_sz)

    BOTTOM_PAD  = 80
    Y_MIN       = int(H * 0.62)
    MAX_TEXT_H  = H - Y_MIN - BOTTOM_PAD

    while (th + bh + gap) > MAX_TEXT_H and b_sz > p["body_min_px"]:
        b_sz -= 1
        _, bh = calc_heights(t_sz, b_sz)
    while (th + bh + gap) > MAX_TEXT_H and t_sz > t_min:
        t_sz -= 2
        th, bh = calc_heights(t_sz, b_sz)

    y_raw = H - th - bh - gap - BOTTOM_PAD
    y     = max(y_raw, Y_MIN)

    y = render_title(draw, title, t_sz, MARGIN_L, y, p["title_color"],
                     ls=1.18, align="left")
    y += gap
    render_markup_block(draw, body, b_sz, MARGIN_L, y, p,
                        ls=1.55, align="left")
    return bg.convert("RGB")


def compose_dramatico(img_bytes, title, body, preset: dict):
    """
    Variação 1 — DRAMÁTICO
    Imagem full + grain + gradiente extra-longo + texto ESQUERDA + fontes grandes.
    Para SISTEMA, CORPO, ALAVANCA.
    """
    p   = preset
    bg  = Image.open(BytesIO(img_bytes)).convert("RGBA").resize((W, H), Image.LANCZOS)
    bg  = fill_edges_black(bg)           # elimina bordas brancas da API
    bg  = dark_gradient(bg, p)
    if p.get("vignette"):
        bg = add_vignette(bg, strength=0.30)
    if p.get("film_grain"):
        bg = add_film_grain(bg, intensity=16)

    draw = ImageDraw.Draw(bg)
    _watermarks(draw, p["watermark_color"])

    t_sz = fit_title_size(draw, title, p["title_px"], p["title_min_px"], align="left")
    b_sz = p["body_px"]
    gap  = 26

    def calc_heights_d(ts, bs):
        lht = line_px_height(draw, ts) * 1.18
        lhb = line_px_height(draw, bs) * 1.58
        nt  = sum(len(wrap_markup_lines(draw, ln, ts, MAX_TW_L)) or 1
                  for ln in title.split("\n"))
        nb  = sum(len(wrap_markup_lines(draw, ln, bs, MAX_TW_L)) or 1
                  for ln in body.split("\n"))
        return int(nt * lht), int(nb * lhb)

    th, bh = calc_heights_d(t_sz, b_sz)

    # ── Zona de texto: de Y_MIN (66%) até H − BOTTOM_PAD
    # MAX_TEXT_H derivado da geometria real — garante que texto NUNCA ultrapassa H − 96px
    BOTTOM_PAD  = 96
    Y_MIN       = int(H * 0.66)           # 891px
    MAX_TEXT_H  = H - Y_MIN - BOTTOM_PAD  # 363px — zona real disponível

    while (th + bh + gap) > MAX_TEXT_H and b_sz > p["body_min_px"]:
        b_sz -= 1
        _, bh = calc_heights_d(t_sz, b_sz)
    while (th + bh + gap) > MAX_TEXT_H and t_sz > p["title_min_px"]:
        t_sz -= 2
        th, bh = calc_heights_d(t_sz, b_sz)

    # ── Bloco nunca começa antes de 66% (zona escura do gradiente) ──────────
    y_raw = H - th - bh - gap - BOTTOM_PAD
    y     = max(y_raw, Y_MIN)

    y = render_title(draw, title, t_sz, MARGIN_L, y, p["title_color"],
                     ls=1.18, align="left")
    y += gap
    render_markup_block(draw, body, b_sz, MARGIN_L, y, p,
                        ls=1.58, align="left")
    return bg.convert("RGB")


def compose_etereo(img_bytes, title, body, preset: dict):
    """
    Variação 2 — ETÉREO LUMINOSO
    Imagem quente + gradiente muito suave + texto ESQUERDA + itálico no body.
    Para ESPÍRITO, MENTE.
    """
    p   = preset
    bg  = Image.open(BytesIO(img_bytes)).convert("RGBA").resize((W, H), Image.LANCZOS)
    bg  = fill_edges_black(bg)           # elimina bordas brancas da API
    bg  = dark_gradient(bg, p)
    if p.get("vignette"):
        bg = add_vignette(bg, strength=0.45)

    draw = ImageDraw.Draw(bg)
    _watermarks(draw, p["watermark_color"])

    t_sz = fit_title_size(draw, title, p["title_px"], p["title_min_px"], align="left")
    b_sz = p["body_px"]

    lh_t  = line_px_height(draw, t_sz) * 1.20
    lh_b  = line_px_height(draw, b_sz) * 1.60
    n_t   = sum(len(wrap_markup_lines(draw, ln, t_sz, MAX_TW_L)) or 1
                for ln in title.split("\n"))
    n_b   = sum(len(wrap_markup_lines(draw, ln, b_sz, MAX_TW_L)) or 1
                for ln in body.split("\n"))
    th    = int(n_t * lh_t)
    bh    = int(n_b * lh_b)
    gap   = 28
    y     = H - th - bh - gap - 90

    y = render_title(draw, title, t_sz, MARGIN_L, y, p["title_color"],
                     ls=1.20, align="left")
    y += gap
    render_markup_block(draw, body, b_sz, MARGIN_L, y, p,
                        ls=1.60, align="left")
    return bg.convert("RGB")


def compose_text_only(img_bytes, title, body, preset: dict):
    """
    Layout TEXTO PESADO — quando há muito texto, sem imagem real.
    Fundo escuro cósmico (img_bytes vira textura suave se fornecido).
    Texto ocupa TODA a altura com padding generoso. Left-aligned.
    Usa parágrafos com espaçamento entre blocos.
    """
    p    = preset
    bg   = make_cosmic_bg(p, img_bytes)
    if p.get("vignette"):
        bg = add_vignette(bg, strength=0.35)

    draw = ImageDraw.Draw(bg)
    _watermarks(draw, p["watermark_color"])

    # Barra vermelha vertical à esquerda (detalhe de design da referência)
    bar_x = MARGIN_L
    bar_y1 = int(H * 0.30)
    bar_y2 = bar_y1 + 56
    draw.rectangle([bar_x, bar_y1, bar_x + 4, bar_y2], fill=(180, 40, 40, 230))

    # No text_only o título é grande (herói visual)
    t_sz  = min(p["title_px"] + 6, 88)
    t_min = p["title_min_px"]
    b_sz  = p["body_px"]
    b_min = p["body_min_px"]

    t_sz = fit_title_size(draw, title, t_sz, t_min, align="left")

    PAD_TOP   = int(H * 0.34)   # título começa abaixo da barra vermelha
    PAD_BOT   = 80
    avail_h   = H - PAD_TOP - PAD_BOT
    x0        = MARGIN_L
    y         = float(PAD_TOP)

    # Título
    if title.strip():
        y = render_title(draw, title, t_sz, x0, y, p["title_color"],
                         ls=1.18, align="left")
        y += line_px_height(draw, t_sz) * 0.9   # espaço após título

    # Body: cada \n\n vira parágrafo com espaço extra
    paragraphs = body.split("\n\n")
    for i, para in enumerate(paragraphs):
        para = para.strip()
        if not para:
            continue
        y = render_markup_block(draw, para, b_sz, x0, y, p,
                                ls=1.60, align="left")
        # espaço entre parágrafos
        if i < len(paragraphs) - 1:
            y += line_px_height(draw, b_sz) * 0.85

    return bg.convert("RGB")


def compose_card(img_bytes, title, body, preset: dict):
    """Layout card: imagem arredondada no topo + texto embaixo."""
    p      = preset
    canvas = Image.new("RGBA", (W, H), p["card_bg"])
    if p.get("vignette"):
        canvas = add_vignette(canvas, strength=0.25)

    draw = ImageDraw.Draw(canvas)
    _watermarks(draw, p["watermark_color"])

    cw, ch, cx, cy = 940, 556, (W - 940) // 2, 126
    card = Image.open(BytesIO(img_bytes)).convert("RGBA").resize((cw, ch), Image.LANCZOS)
    mask = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, cw, ch], radius=16, fill=255)
    card.putalpha(mask)
    draw.rounded_rectangle([cx-2, cy-2, cx+cw+2, cy+ch+2],
                           radius=18, outline=p["card_border"], width=2)
    canvas.paste(card, (cx, cy), card)

    ty   = cy + ch + 36
    avail = H - ty - 52
    t_sz  = fit_title_size(draw, title, p["title_px"], p["title_min_px"], align="left")
    b_sz  = p["body_px"]

    lh_t  = line_px_height(draw, t_sz) * 1.18
    lh_b  = line_px_height(draw, b_sz) * 1.55
    n_t   = sum(len(wrap_markup_lines(draw, ln, t_sz, MAX_TW_L)) or 1
                for ln in title.split("\n"))
    n_b   = sum(len(wrap_markup_lines(draw, ln, b_sz, MAX_TW_L)) or 1
                for ln in body.split("\n"))
    th    = int(n_t * lh_t)
    bh    = int(n_b * lh_b)
    gap   = 20

    # auto-reduz se não cabe
    while th + gap + bh > avail and b_sz > p["body_min_px"]:
        b_sz -= 1
        lh_b  = line_px_height(draw, b_sz) * 1.55
        bh    = int(n_b * lh_b)

    y = float(ty)
    y = render_title(draw, title, t_sz, MARGIN_L, y, p["title_color"],
                     ls=1.18, align="left")
    y += gap
    render_markup_block(draw, body, b_sz, MARGIN_L, y, p,
                        ls=1.55, align="left")
    return canvas.convert("RGB")


# ── PUBLIC API ────────────────────────────────────────────────────────────────

def compose(img_bytes, title, body, layout="fullbleed", preset_name=DEFAULT_PRESET):
    """
    layout:
      'fullbleed'   — clássico centralizado (todos os presets)
      'dramatico'   — esquerda + grain + grande (preset dramatico)
      'etereo'      — esquerda + suave + itálico (preset etereo_luminoso)
      'text_only'   — texto pesado sem imagem real (qualquer preset)
      'card'        — card arredondado + texto

    preset_name:
      'manuscrito_sagrado' | 'cinematografico' | 'cinematografico_crimson'
      'esoterico_minimalista' | 'dramatico' | 'etereo_luminoso'
    """
    p = get_preset(preset_name)

    if layout == "dramatico":
        return compose_dramatico(img_bytes, title, body, p)
    if layout == "etereo":
        return compose_etereo(img_bytes, title, body, p)
    if layout == "text_only":
        return compose_text_only(img_bytes, title, body, p)
    if layout == "card":
        return compose_card(img_bytes, title, body, p)

    return compose_fullbleed(img_bytes, title, body, p)

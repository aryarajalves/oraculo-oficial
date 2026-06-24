"""
compose_util_v3.py — Motor de Composição
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Baseado na análise dos carrosseis de referência viral.

DOIS MODOS apenas:

  image_slide  → imagem artística full-bleed + texto no escuro inferior
  text_slide   → fundo preto puro (#000) + texto branco + acento de cor

TRÊS PRESETS (universos temáticos):

  cosmico    → violeta/índigo/teal elétrico
  sagrado    → dourado âmbar/celestial
  revelacao  → crimson/escuro (confronto)

MARKUP no texto:
  **texto**  → cor de acento do preset (destaque da frase-chave)
  *texto*    → itálico levemente mais suave
  texto      → regular

PROPORÇÃO CORRETA:
  GPT Image 2 gera 1024×1536 (2:3)
  smart_crop recorta para 1024×1280 (4:5) — centro, sem distorção
  resize para 1080×1350 (+5.5% uniforme em ambas dimensões)
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from pathlib import Path

# ── Canvas ─────────────────────────────────────────────────────────────────────
W, H       = 1080, 1350
MARGIN_L   = 72
MARGIN_R   = 72
MAX_TW     = W - MARGIN_L - MARGIN_R   # 936px

FD         = Path("C:/Windows/Fonts")
F_HEAVY    = str(FD / "Franklin Gothic Pro-Heavy.ttf")
F_HEAVY_IT = str(FD / "Franklin Gothic Pro-HeavyItalic.ttf")
F_REGULAR  = str(FD / "Inter-Regular-slnt=0.ttf")
F_BOLD     = str(FD / "Inter-Bold-slnt=0.ttf")


# ── PRESETS ────────────────────────────────────────────────────────────────────
PRESETS = {

    "cosmico": {
        # Universo: violeta profundo, índigo, teal elétrico
        # Para: física quântica, cosmos, meditação, expansão
        "accent"          : (0,   200, 255),   # teal elétrico
        "title_color"     : (255, 255, 255),
        "body_color"      : (215, 225, 245),   # branco-azulado
        "watermark_color" : (80,  160, 220, 120),
        "gradient_tint"   : (4,   6,   28),    # azul-violeta profundo
        "gradient_start"  : 0.58,
        "gradient_max"    : 190,
        "text_bg"         : (0,   0,   0),     # preto puro para text_slide
        "accent_bar"      : (0,   200, 255),
    },

    "sagrado": {
        # Universo: dourado, âmbar, luz celestial
        # Para: Jesus, Bíblia, sabedoria ancestral, alma
        "accent"          : (212, 160,  23),   # dourado
        "title_color"     : (255, 255, 255),
        "body_color"      : (248, 238, 210),   # marfim quente
        "watermark_color" : (200, 160,  60, 120),
        "gradient_tint"   : (22,  12,   4),    # âmbar escuro
        "gradient_start"  : 0.58,
        "gradient_max"    : 190,
        "text_bg"         : (0,   0,   0),
        "accent_bar"      : (212, 160,  23),
    },

    "revelacao": {
        # Universo: crimson, escuro, confronto, denuncia
        # Para: sistema, dinheiro, pastor, Matrix, raiva coletiva
        "accent"          : (220,  30,  30),   # crimson
        "title_color"     : (255, 255, 255),
        "body_color"      : (240, 225, 225),   # branco rosado
        "watermark_color" : (180,  60,  60, 120),
        "gradient_tint"   : (22,   4,   4),    # crimson profundo
        "gradient_start"  : 0.58,
        "gradient_max"    : 190,
        "text_bg"         : (0,   0,   0),
        "accent_bar"      : (220,  30,  30),
    },
}

DEFAULT_PRESET = "revelacao"


def get_preset(name: str) -> dict:
    return PRESETS.get(name, PRESETS[DEFAULT_PRESET])


# ── FONT LOADER ────────────────────────────────────────────────────────────────
def _font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, max(size, 10))
    except:
        return ImageFont.load_default()


# ── SMART CROP — 1024×1536 → 1024×1280 → 1080×1350 ───────────────────────────
def smart_crop(img_bytes: bytes) -> Image.Image:
    """
    Converte qualquer imagem gerada para 1080×1350 (4:5 Instagram)
    sem distorção via center-crop proporcional.

    Para 1024×1536 (GPT Image 2, 2:3):
      → crop: (0, 128, 1024, 1408) = 1024×1280 (4:5 exato)
      → resize: 1080×1350 (escala uniforme +5.5%)
    """
    img = Image.open(BytesIO(img_bytes)).convert("RGBA")
    iw, ih = img.size

    target_ratio = W / H   # 0.8 = 4:5

    src_ratio = iw / ih
    if src_ratio > target_ratio:
        # Imagem mais larga que 4:5 → corta laterais
        new_w = int(ih * target_ratio)
        left  = (iw - new_w) // 2
        img   = img.crop((left, 0, left + new_w, ih))
    elif src_ratio < target_ratio:
        # Imagem mais alta que 4:5 → corta topo e base
        new_h = int(iw / target_ratio)
        top   = (ih - new_h) // 2
        img   = img.crop((0, top, iw, top + new_h))

    return img.resize((W, H), Image.LANCZOS)


# ── GRADIENTE ─────────────────────────────────────────────────────────────────
def _gradient(img: Image.Image, preset: dict) -> Image.Image:
    """Escurece a parte inferior da imagem de forma rica e profunda para legibilidade do texto."""
    ov   = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d    = ImageDraw.Draw(ov)
    sy   = int(H * preset["gradient_start"])
    
    # Usamos opacidade alta na base para contraste máximo (estilo viral)
    amax = 250
    r, g, b = preset["gradient_tint"]

    for y in range(sy, H):
        p  = (y - sy) / (H - sy)
        # Curva de opacidade que atinge a opacidade máxima de forma suave na base
        a  = int(amax * (p ** 0.85))
        # Transição elegante de cor do preset para preto puro (#000) no rodapé
        cr = int(r * (1 - p))
        cg = int(g * (1 - p))
        cb = int(b * (1 - p))
        d.line([(0, y), (W, y)], fill=(cr, cg, cb, a))

    return Image.alpha_composite(img.convert("RGBA"), ov)


# ── VINHETA ───────────────────────────────────────────────────────────────────
def _vignette(img: Image.Image, strength: float = 0.30) -> Image.Image:
    """Escurecimento suave nas bordas para guiar o olhar ao centro."""
    ov  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d   = ImageDraw.Draw(ov)
    sw  = 90   # pixels de fade lateral
    th  = 60   # pixels de fade superior

    for i in range(sw):
        p = ((sw - i) / sw) ** 1.6
        a = int(p * 180 * strength)
        d.line([(i, 0),      (i, H)],      fill=(0, 0, 0, a))
        d.line([(W-i-1, 0),  (W-i-1, H)],  fill=(0, 0, 0, a))

    for i in range(th):
        p = ((th - i) / th) ** 1.6
        a = int(p * 140 * strength)
        d.line([(0, i), (W, i)], fill=(0, 0, 0, a))

    return Image.alpha_composite(img.convert("RGBA"), ov)


# ── WATERMARK ─────────────────────────────────────────────────────────────────
def _watermark(draw: ImageDraw.Draw, color: tuple):
    mark = "@afonteoculta"
    f    = _font(F_REGULAR, 26)
    draw.text((MARGIN_L, 44), mark, font=f, fill=color)


# ── MARKUP PARSER ─────────────────────────────────────────────────────────────
def _parse(text: str) -> list[tuple[str, str]]:
    """
    Retorna lista de (trecho, estilo).
    Estilos: 'accent' (**texto**) | 'italic' (*texto*) | 'normal'
    """
    segs, i = [], 0
    while i < len(text):
        if text[i:i+2] == "**":
            end = text.find("**", i + 2)
            if end != -1:
                segs.append((text[i+2:end], "accent"))
                i = end + 2
                continue
        if text[i] == "*" and text[i:i+2] != "**":
            end = text.find("*", i + 1)
            if end != -1 and text[end:end+2] != "**":
                segs.append((text[i+1:end], "italic"))
                i = end + 1
                continue
        j = i + 1
        while j < len(text):
            if text[j:j+2] == "**" or (text[j] == "*" and text[j:j+2] != "**"):
                break
            j += 1
        segs.append((text[i:j], "normal"))
        i = j
    return segs


def _seg_font(style: str, size: int) -> ImageFont.FreeTypeFont:
    if style == "italic":
        return _font(F_HEAVY_IT, size)
    return _font(F_REGULAR, size)


def _seg_w(draw, text: str, style: str, size: int) -> int:
    f  = _seg_font(style, size)
    bb = draw.textbbox((0, 0), text, font=f)
    return bb[2] - bb[0]


def _line_h(draw, size: int) -> int:
    """Altura de linha para corpo (Inter Regular)."""
    f  = _font(F_REGULAR, size)
    bb = draw.textbbox((0, 0), "Ágj", font=f)
    return bb[3] - bb[1]

def _heavy_lh(draw, size: int) -> int:
    """Altura de linha para título (Franklin Gothic Heavy)."""
    f  = _font(F_HEAVY, size)
    bb = draw.textbbox((0, 0), "Ágj", font=f)
    return bb[3] - bb[1]


# ── WORD-WRAP MARKUP ─────────────────────────────────────────────────────────
def _wrap(draw, raw: str, size: int, max_w: int) -> list[list[tuple[str, str]]]:
    """Quebra linha com markup em sub-linhas que cabem em max_w."""
    words = []
    for txt, sty in _parse(raw):
        for w in txt.split(" "):
            if w:
                words.append((w + " ", sty))

    lines, cur, cw = [], [], 0
    for word, sty in words:
        ww = _seg_w(draw, word, sty, size)
        if cw + ww > max_w and cur:
            lines.append(cur)
            cur, cw = [(word, sty)], ww
        else:
            cur.append((word, sty))
            cw += ww
    if cur:
        lines.append(cur)
    return lines


# ── RENDER TÍTULO ─────────────────────────────────────────────────────────────
def _render_title(draw, title: str, size: int, x: int, y: float,
                  color: tuple, ls: float = 1.20, align: str = "left") -> float:
    f  = _font(F_HEAVY, size)
    lh = _heavy_lh(draw, size) * ls

    for raw in title.split("\n"):
        # Auto-wrap linhas longas
        words, cur = raw.split(" "), ""
        all_lines  = []
        for w in words:
            test = (cur + " " + w).strip()
            if draw.textbbox((0, 0), test, font=f)[2] > MAX_TW and cur:
                all_lines.append(cur)
                cur = w
            else:
                cur = test
        if cur:
            all_lines.append(cur)

        for ln in all_lines:
            line_w = draw.textbbox((0, 0), ln, font=f)[2]
            draw_x = (W - line_w) // 2 if align == "center" else x
            # Sombra sutil
            draw.text((draw_x + 2, y + 2), ln, font=f, fill=(0, 0, 0, 140))
            draw.text((draw_x, y),         ln, font=f, fill=color)
            y += lh

    return y


def _fit_title(draw, title: str, start: int, minimum: int) -> int:
    f = _font(F_HEAVY, start)
    for sz in range(start, minimum - 1, -2):
        f = _font(F_HEAVY, sz)
        ok = True
        for ln in title.split("\n"):
            if draw.textbbox((0, 0), ln, font=f)[2] > MAX_TW:
                ok = False
                break
        if ok:
            return sz
    return minimum


# ── RENDER BODY (com markup) ─────────────────────────────────────────────────
def _render_body(draw, body: str, size: int, x: int, y: float,
                 preset: dict, ls: float = 1.65,
                 max_y: float = float("inf"), align: str = "left") -> float:
    lh       = _line_h(draw, size) * ls
    accent   = tuple(preset["accent"]) + (255,)
    body_c   = tuple(preset["body_color"]) + (255,)
    italic_c = tuple(int(c * 0.88) for c in preset["body_color"]) + (255,)

    for raw in body.split("\n"):
        wrapped = _wrap(draw, raw, size, MAX_TW)
        if not wrapped:
            next_y = y + lh * 0.45
            if next_y > max_y:
                return y
            y = next_y
            continue
        for ln_segs in wrapped:
            # Clip: se esta linha sair do frame, para aqui
            if y + lh > max_y:
                return y
            
            # Se centralizado, calcula largura total da linha
            if align == "center":
                line_w = 0
                for word, sty in ln_segs:
                    line_w += _seg_w(draw, word, sty, size)
                xc = float((W - line_w) // 2)
            else:
                xc = float(x)

            for word, sty in ln_segs:
                col = (accent   if sty == "accent"
                       else italic_c if sty == "italic"
                       else body_c)
                f   = _seg_font(sty, size)
                draw.text((xc + 2, y + 2), word, font=f, fill=(0, 0, 0, 180))
                draw.text((xc + 1, y + 1), word, font=f, fill=(0, 0, 0, 120))
                draw.text((xc, y),         word, font=f, fill=col)
                xc += _seg_w(draw, word, sty, size)
            y += lh

    return y


# ══════════════════════════════════════════════════════════════════════════════
# MODO 1 — IMAGE SLIDE
# Imagem artística full-bleed + texto no escuro inferior
# ══════════════════════════════════════════════════════════════════════════════

def _title_pixel_height(draw, title: str, t_sz: int, ls: float = 1.20) -> int:
    """Retorna altura real em px do título renderizado (usa F_HEAVY para medição correta)."""
    lh = _heavy_lh(draw, t_sz) * ls
    n  = 0
    f  = _font(F_HEAVY, t_sz)
    for raw in title.split("\n"):
        words, cur = raw.split(" "), ""
        for w in words:
            test = (cur + " " + w).strip()
            if draw.textbbox((0, 0), test, font=f)[2] > MAX_TW and cur:
                n += 1; cur = w
            else:
                cur = test
        if cur:
            n += 1
    return int(n * lh)


def _body_pixel_height(draw, body: str, b_sz: int, ls: float = 1.65) -> float:
    """Altura total do corpo em px."""
    lh = _line_h(draw, b_sz) * ls
    nb = 0.0
    for ln in body.split("\n"):
        wrapped = _wrap(draw, ln, b_sz, MAX_TW)
        nb += len(wrapped) if wrapped else 0.45
    return nb * lh


def compose_image_slide(img_bytes: bytes, title: str, body: str,
                        preset: dict, cover: bool = False) -> Image.Image:
    """
    cover=True → S1 (capa): título maior, menos corpo, imagem mais presente.
    cover=False → slides regulares de imagem.

    Lógica de layout:
      1. Crop + dummy draw para medir texto
      2. Determina zona de texto (Y_MIN) de forma adaptativa:
         tenta frações crescentes até o bloco caber
      3. Aplica gradiente com start alinhado à zona de texto
      4. Renderiza título + corpo com clip no fundo do frame
    """
    p  = preset
    bg = smart_crop(img_bytes)

    # Draw temporário para medições (sem gradiente ainda)
    tmp_draw = ImageDraw.Draw(bg.copy())

    # ── Parâmetros base ──────────────────────────────────────────────────────
    if cover:
        T_START, T_MIN  = 82, 52     # menor: título não domina a imagem
        B_MAX, B_MIN    = 38, 30     # aumentado para melhor legibilidade
        BOTTOM_PAD      = 72
        GAP             = 18
        Y_FRACS         = [0.67, 0.62, 0.57, 0.52, 0.47]   # permite subir um pouco mais se necessário
    else:
        T_START, T_MIN  = 70, 44     # menor: imagem respira mais
        B_MAX, B_MIN    = 42, 32     # aumentado para melhor legibilidade
        BOTTOM_PAD      = 80
        GAP             = 20
        Y_FRACS         = [0.72, 0.67, 0.62, 0.57, 0.52, 0.47, 0.42]   # permite subir até 42% se o texto for longo

    # ── Ajuste de fonte do título ─────────────────────────────────────────────
    t_sz = _fit_title(tmp_draw, title, T_START, T_MIN)

    # ── Busca zona de texto que acomoda título + corpo ────────────────────────
    chosen_frac = Y_FRACS[-1]  # fallback: zona mais alta
    chosen_t_sz = t_sz
    chosen_b_sz = B_MIN

    for frac in Y_FRACS:
        Y_MIN    = int(H * frac)
        MAX_ZONE = H - Y_MIN - BOTTOM_PAD

        # Ajusta título para não ocupar > 55% da zona
        ts = t_sz
        for _ in range(20):
            th = _title_pixel_height(tmp_draw, title, ts)
            if th <= MAX_ZONE * 0.55 or ts <= T_MIN:
                break
            ts -= 2

        th        = _title_pixel_height(tmp_draw, title, ts)
        remaining = MAX_ZONE - th - GAP

        if not body.strip():
            chosen_frac, chosen_t_sz, chosen_b_sz = frac, ts, B_MIN
            break

        # Maior tamanho de corpo que cabe no espaço restante
        # BUFFER de 1 line-height para compensar arredondamento float→int
        SAFE = int(_line_h(tmp_draw, B_MIN) * 1.65)
        bs = B_MIN
        # Se B_MIN ainda não couber, permitimos diminuir até 24px para evitar cortes
        for sz in range(B_MAX, 23, -1):
            if _body_pixel_height(tmp_draw, body, sz) <= remaining - SAFE:
                bs = sz
                break

        total = th + GAP + _body_pixel_height(tmp_draw, body, bs) + SAFE
        chosen_frac, chosen_t_sz, chosen_b_sz = frac, ts, bs

        if total <= MAX_ZONE:
            break  # cabe — usa esta fração

    # ── Aplica gradiente alinhado à zona de texto ────────────────────────────
    grad_start = max(chosen_frac - 0.12, 0.42)   # transição mais longa e suave
    p_dyn = {**p, "gradient_start": grad_start}
    bg = _gradient(bg, p_dyn)
    bg = _vignette(bg)

    draw = ImageDraw.Draw(bg)
    _watermark(draw, p["watermark_color"])

    # ── Posicionamento do bloco ───────────────────────────────────────────────
    Y_MIN    = int(H * chosen_frac)
    BOTTOM   = H - BOTTOM_PAD
    t_sz     = chosen_t_sz
    b_sz     = chosen_b_sz

    th = _title_pixel_height(draw, title, t_sz)
    bh = _body_pixel_height(draw, body, b_sz) if body.strip() else 0.0

    total_h = th + (GAP + bh if body.strip() else 0)
    y_raw   = H - int(total_h) - BOTTOM_PAD
    y       = float(max(y_raw, Y_MIN))

    # Ajuste final de segurança caso o bloco ainda exceda o limite vertical real
    MAX_ZONE = H - Y_MIN - BOTTOM_PAD
    while t_sz > 36 and (th + (GAP + bh if body.strip() else 0)) > MAX_ZONE:
        t_sz -= 2
        th = _title_pixel_height(draw, title, t_sz)
        if body.strip() and b_sz > 24:
            b_sz -= 1
            bh = _body_pixel_height(draw, body, b_sz)

    # Renderiza título e corpo alinhados à esquerda de forma inteligente no rodapé, deixando os personagens no centro/direita livres e visíveis
    y = _render_title(draw, title, t_sz, MARGIN_L, y, p["title_color"], ls=1.20, align="left")
    if body.strip():
        y += GAP
        _render_body(draw, body, b_sz, MARGIN_L, y, p, ls=1.65,
                     max_y=float(BOTTOM) + 8, align="left")

    return bg.convert("RGB")


# ══════════════════════════════════════════════════════════════════════════════
# MODO 2 — TEXT SLIDE
# Fundo preto puro + texto branco + acento de cor
# ══════════════════════════════════════════════════════════════════════════════

def _block_height(draw, title: str, body: str, t_sz: int, b_sz: int) -> int:
    """Calcula altura total do bloco título+corpo sem renderizar."""
    lht = _line_h(draw, t_sz) * 1.22
    lhb = _line_h(draw, b_sz) * 1.70

    nt = sum(
        max(len(_wrap(draw, ln, t_sz, MAX_TW)), 1)
        for ln in title.split("\n")
    )
    title_h = int(nt * lht)

    if not body.strip():
        return title_h

    nb = 0.0
    for ln in body.split("\n"):
        wrapped = _wrap(draw, ln, b_sz, MAX_TW)
        if not wrapped:
            nb += 0.45       # linha em branco
        else:
            nb += len(wrapped)
    body_h = int(nb * lhb)

    return title_h + 28 + body_h   # 28 = gap entre título e corpo


def compose_text_slide(title: str, body: str, preset: dict) -> Image.Image:
    """
    Fundo #000000 puro. Sem imagem. Sem gradiente. Sem textura.
    Barra de acento vertical antes do bloco de texto.
    Título em branco. Destaques (**texto**) em cor de acento.
    Auto-fit: reduz fontes até o texto caber na tela.
    """
    p  = preset
    bg = Image.new("RGB", (W, H), (0, 0, 0))
    bg   = bg.convert("RGBA")
    draw = ImageDraw.Draw(bg)

    # Watermark discreta
    _watermark(draw, p["watermark_color"])

    # ── Barra de acento vertical (3px × 52px) ───────────────────────────────
    accent_rgb   = p["accent_bar"]
    bar_x        = MARGIN_L
    bar_y_start  = int(H * 0.26)
    bar_height   = 52
    draw.rectangle([bar_x, bar_y_start, bar_x + 3, bar_y_start + bar_height],
                   fill=accent_rgb + (255,))

    # ── Tamanhos de fonte iniciais ───────────────────────────────────────────
    T_START, T_MIN = 88, 60
    B_START, B_MIN = 42, 32
    PAD_BOT        = 90
    GAP_TITLE_BODY = 32
    text_x         = MARGIN_L
    y_start        = float(bar_y_start + bar_height + 28)

    available_h = H - y_start - PAD_BOT   # pixels disponíveis para título+corpo

    # ── Auto-fit: ajusta título até caber em largura ─────────────────────────
    t_sz = _fit_title(draw, title, T_START, T_MIN)

    # ── Garante que o título não consuma mais de 55% do espaço disponível ────
    if body.strip():
        for _ in range(20):
            th = _title_pixel_height(draw, title, t_sz)
            if th <= available_h * 0.55 or t_sz <= T_MIN:
                break
            t_sz -= 2

    # ── Auto-fit: corpo começa no maior tamanho que caiba no espaço restante ─
    b_sz = B_START
    if body.strip():
        th = _title_pixel_height(draw, title, t_sz)
        remaining = available_h - th - GAP_TITLE_BODY
        for sz in range(B_START, B_MIN - 1, -1):
            lhb = _line_h(draw, sz) * 1.70
            nb  = 0.0
            for ln in body.split("\n"):
                wrapped = _wrap(draw, ln, sz, MAX_TW)
                nb += len(wrapped) if wrapped else 0.45
            if int(nb * lhb) <= remaining:
                b_sz = sz
                break
        b_sz = max(b_sz, B_MIN)
        # Última checagem: se ainda não coube, reduz título mais
        while t_sz > T_MIN and _block_height(draw, title, body, t_sz, b_sz) > available_h:
            t_sz -= 2

    # ── Renderização ─────────────────────────────────────────────────────────
    y = y_start
    y = _render_title(draw, title, t_sz, text_x, y,
                      color=(255, 255, 255), ls=1.22)

    if body.strip():
        y += GAP_TITLE_BODY
        _render_body(draw, body, b_sz, text_x, y, p, ls=1.70)

    return bg.convert("RGB")


# ══════════════════════════════════════════════════════════════════════════════
# MODO 3 — CARD SLIDE
# Imagem arredondada no topo + texto embaixo
# ══════════════════════════════════════════════════════════════════════════════

def compose_card_slide(img_bytes: bytes, title: str, body: str, preset: dict) -> Image.Image:
    """
    Layout Card para V3:
    - Fundo preto puro ou escuro do preset (preset["text_bg"] ou (0,0,0)).
    - Imagem artística com cantos arredondados no topo.
    - Moldura na cor de acento do preset.
    - Texto embaixo na margem esquerda (left-aligned) usando markup V3.
    """
    p = preset
    bg_color = p.get("text_bg", (0, 0, 0))
    bg = Image.new("RGBA", (W, H), bg_color)
    draw = ImageDraw.Draw(bg)

    # Watermark discreta
    _watermark(draw, p["watermark_color"])

    # Dimensões do card (mantendo proporções do card clássico)
    cw, ch = 940, 556
    cx = (W - cw) // 2  # 70px
    cy = 126

    # Carrega e processa a imagem do card (faz center-crop para a proporção do card, depois rounded corners)
    # Proporção do card: cw / ch = 940 / 556 ≈ 1.69 (widescreen)
    src_img = Image.open(BytesIO(img_bytes)).convert("RGBA")
    sw, sh = src_img.size
    target_ratio = cw / ch
    src_ratio = sw / sh

    if src_ratio > target_ratio:
        # Mais larga que 1.69 → corta laterais
        new_w = int(sh * target_ratio)
        left = (sw - new_w) // 2
        cropped_img = src_img.crop((left, 0, left + new_w, sh))
    else:
        # Mais alta que 1.69 → corta topo/base
        new_h = int(sw / target_ratio)
        top = (sh - new_h) // 2
        cropped_img = src_img.crop((0, top, sw, top + new_h))

    card_img = cropped_img.resize((cw, ch), Image.LANCZOS)

    # Cria máscara para cantos arredondados
    mask = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, cw, ch], radius=16, fill=255)
    card_img.putalpha(mask)

    # Cor da borda com opacidade elegante (~40%)
    accent_rgb = tuple(p["accent"])
    border_color = accent_rgb + (100,)

    # Desenha moldura sutil arredondada
    draw.rounded_rectangle([cx-2, cy-2, cx+cw+2, cy+ch+2], radius=18, outline=border_color, width=2)

    # Cola o card
    bg.paste(card_img, (cx, cy), card_img)

    # Posicionamento do texto
    ty = cy + ch + 36   # 718px
    avail = H - ty - 52 # 580px

    # Tamanhos base
    T_START, T_MIN = 64, 44
    B_START, B_MIN = 34, 26
    GAP = 20

    # Ajusta título para caber horizontalmente
    t_sz = _fit_title(draw, title, T_START, T_MIN)

    # Mede altura do título e ajusta corpo
    th = _title_pixel_height(draw, title, t_sz, ls=1.20)
    remaining = avail - th - GAP

    # Ajusta tamanho do corpo para caber no espaço restante
    b_sz = B_START
    if body.strip():
        for sz in range(B_START, B_MIN - 1, -1):
            if _body_pixel_height(draw, body, sz, ls=1.65) <= remaining:
                b_sz = sz
                break
        b_sz = max(b_sz, B_MIN)

        # Reduz título se a soma estourar o limite vertical
        while t_sz > T_MIN and (th + GAP + _body_pixel_height(draw, body, b_sz, ls=1.65)) > avail:
            t_sz -= 2
            th = _title_pixel_height(draw, title, t_sz, ls=1.20)

    # Renderiza título e corpo
    y = float(ty)
    y = _render_title(draw, title, t_sz, MARGIN_L, y, p["title_color"], ls=1.20)

    if body.strip():
        y += GAP
        _render_body(draw, body, b_sz, MARGIN_L, y, p, ls=1.65, max_y=float(H - 52))

    return bg.convert("RGB")


# ══════════════════════════════════════════════════════════════════════════════
# API PÚBLICA
# ══════════════════════════════════════════════════════════════════════════════

def compose(img_bytes: bytes | None,
            title: str,
            body: str,
            mode: str = "image",
            preset_name: str = DEFAULT_PRESET,
            cover: bool = False) -> Image.Image:
    """
    Compõe um slide do carrossel.

    Args:
        img_bytes:   Bytes da imagem gerada pelo GPT Image 2.
                     Pode ser None apenas para mode='text'.
        title:       Título do slide (suporta \\n para quebras manuais).
        body:        Corpo do texto (suporta **acento**, *itálico*, \\n).
        mode:        'image' | 'text' | 'card'
        preset_name: 'cosmico' | 'sagrado' | 'revelacao'
        cover:       True apenas para S1 (capa) — fontes maiores.

    Returns:
        PIL.Image em RGB, 1080×1350px.
    """
    p = get_preset(preset_name)

    if mode == "text":
        return compose_text_slide(title, body, p)

    if mode == "card":
        if img_bytes is None:
            raise ValueError("img_bytes é obrigatório para mode='card'")
        return compose_card_slide(img_bytes, title, body, p)

    if img_bytes is None:
        raise ValueError("img_bytes é obrigatório para mode='image'")

    return compose_image_slide(img_bytes, title, body, p, cover=cover)


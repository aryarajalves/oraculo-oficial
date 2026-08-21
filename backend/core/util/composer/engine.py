"""
Engine Principal de Composição: Executa Layouts (Fullbleed, Dramático, Etéreo, Text-Only, Card).
"""

from io import BytesIO
from PIL import Image, ImageDraw

from .presets import (
    W, H,
    MARGIN_L,
    MAX_TW_L,
    DEFAULT_PRESET,
    get_preset
)
from .effects import (
    dark_gradient,
    add_vignette,
    fill_edges_black,
    add_film_grain,
    _watermarks,
    make_cosmic_bg
)
from .text_renderer import (
    fit_title_size,
    line_px_height,
    wrap_markup_lines,
    render_title,
    render_markup_block
)

def compose_fullbleed(img_bytes, title, body, preset: dict, title_y=None, body_y=None, watermark_pos="top_left", watermark_x=None, watermark_y=None, watermark_text=None):
    """Layout fullbleed: imagem full + gradiente + texto centralizado embaixo."""
    p = preset
    bg = Image.open(BytesIO(img_bytes)).convert("RGBA").resize((W, H), Image.LANCZOS)
    bg = fill_edges_black(bg)
    bg = dark_gradient(bg, p)
    if p.get("vignette"):
        bg = add_vignette(bg)
    if p.get("film_grain"):
        bg = add_film_grain(bg)

    draw = ImageDraw.Draw(bg)
    _watermarks(draw, p["watermark_color"], pos=watermark_pos, x=watermark_x, y=watermark_y, text=watermark_text)

    t_start = min(p["title_px"], 80)
    t_min = p["title_min_px"]
    b_sz = p["body_px"]
    gap = 22

    t_sz = fit_title_size(draw, title, t_start, t_min, align="center")

    def calc_heights(ts, bs):
        lht = line_px_height(draw, ts) * 1.18
        lhb = line_px_height(draw, bs) * 1.55
        nt = sum(len(wrap_markup_lines(draw, ln, ts, MAX_TW_L)) or 1
                 for ln in title.split("\n"))
        nb = sum(len(wrap_markup_lines(draw, ln, bs, MAX_TW_L)) or 1
                 for ln in body.split("\n"))
        return int(nt * lht), int(nb * lhb)

    th, bh = calc_heights(t_sz, b_sz)

    BOTTOM_PAD = 80
    Y_MIN = int(H * 0.62)
    custom_y = int(title_y) if (title_y is not None and str(title_y).strip() != "") else None
    effective_y_min = custom_y if (custom_y is not None and custom_y < Y_MIN) else Y_MIN
    MAX_TEXT_H = H - effective_y_min - BOTTOM_PAD

    while (th + bh + gap) > MAX_TEXT_H and b_sz > p["body_min_px"]:
        b_sz -= 1
        _, bh = calc_heights(t_sz, b_sz)
    while (th + bh + gap) > MAX_TEXT_H and t_sz > t_min:
        t_sz -= 2
        th, bh = calc_heights(t_sz, b_sz)

    if title_y is not None and str(title_y).strip() != "":
        y = int(title_y)
    else:
        y_raw = H - th - bh - gap - BOTTOM_PAD
        y = max(y_raw, Y_MIN)

    rendered_title_y_end = render_title(draw, title, t_sz, MARGIN_L, y, p["title_color"],
                                        ls=1.18, align="center")
    final_body_y = int(body_y) if body_y is not None and str(body_y).strip() != "" else max(980, rendered_title_y_end + gap)
    render_markup_block(draw, body, b_sz, MARGIN_L, final_body_y, p,
                        ls=1.55, align="center")
    return bg.convert("RGB")

def compose_dramatico(img_bytes, title, body, preset: dict, title_y=None, body_y=None, watermark_pos="top_left", watermark_x=None, watermark_y=None, watermark_text=None):
    """
    Layout DRAMÁTICO:
    Imagem full + grain + gradiente extra-longo + texto ESQUERDA + fontes grandes.
    """
    p = preset
    bg = Image.open(BytesIO(img_bytes)).convert("RGBA").resize((W, H), Image.LANCZOS)
    bg = fill_edges_black(bg)
    bg = dark_gradient(bg, p)
    if p.get("vignette"):
        bg = add_vignette(bg, strength=0.30)
    if p.get("film_grain"):
        bg = add_film_grain(bg, intensity=16)

    draw = ImageDraw.Draw(bg)
    _watermarks(draw, p["watermark_color"], pos=watermark_pos, x=watermark_x, y=watermark_y, text=watermark_text)

    t_sz = fit_title_size(draw, title, p["title_px"], p["title_min_px"], align="left")
    b_sz = p["body_px"]
    gap = 26

    def calc_heights_d(ts, bs):
        lht = line_px_height(draw, ts) * 1.18
        lhb = line_px_height(draw, bs) * 1.58
        nt = sum(len(wrap_markup_lines(draw, ln, ts, MAX_TW_L)) or 1
                 for ln in title.split("\n"))
        nb = sum(len(wrap_markup_lines(draw, ln, bs, MAX_TW_L)) or 1
                 for ln in body.split("\n"))
        return int(nt * lht), int(nb * lhb)

    th, bh = calc_heights_d(t_sz, b_sz)

    BOTTOM_PAD = 96
    Y_MIN = int(H * 0.66)
    custom_y = int(title_y) if (title_y is not None and str(title_y).strip() != "") else None
    effective_y_min = custom_y if (custom_y is not None and custom_y < Y_MIN) else Y_MIN
    MAX_TEXT_H = H - effective_y_min - BOTTOM_PAD

    while (th + bh + gap) > MAX_TEXT_H and b_sz > p["body_min_px"]:
        b_sz -= 1
        _, bh = calc_heights_d(t_sz, b_sz)
    while (th + bh + gap) > MAX_TEXT_H and t_sz > p["title_min_px"]:
        t_sz -= 2
        th, bh = calc_heights_d(t_sz, b_sz)

    if title_y is not None and str(title_y).strip() != "":
        y = int(title_y)
    else:
        y_raw = H - th - bh - gap - BOTTOM_PAD
        y = max(y_raw, Y_MIN)

    rendered_title_y_end = render_title(draw, title, t_sz, MARGIN_L, y, p["title_color"],
                                        ls=1.18, align="left")
    final_body_y = int(body_y) if body_y is not None and str(body_y).strip() != "" else max(970, rendered_title_y_end + gap)
    render_markup_block(draw, body, b_sz, MARGIN_L, final_body_y, p,
                        ls=1.58, align="left")
    return bg.convert("RGB")

def compose_etereo(img_bytes, title, body, preset: dict, title_y=None, body_y=None, watermark_pos="top_left", watermark_x=None, watermark_y=None, watermark_text=None):
    """
    Layout ETÉREO LUMINOSO:
    Imagem quente + gradiente suave + texto ESQUERDA + itálico no body.
    """
    p = preset
    bg = Image.open(BytesIO(img_bytes)).convert("RGBA").resize((W, H), Image.LANCZOS)
    bg = fill_edges_black(bg)
    bg = dark_gradient(bg, p)
    if p.get("vignette"):
        bg = add_vignette(bg, strength=0.45)

    draw = ImageDraw.Draw(bg)
    _watermarks(draw, p["watermark_color"], pos=watermark_pos, x=watermark_x, y=watermark_y, text=watermark_text)

    t_sz = fit_title_size(draw, title, p["title_px"], p["title_min_px"], align="left")
    b_sz = p["body_px"]

    lh_t = line_px_height(draw, t_sz) * 1.20
    lh_b = line_px_height(draw, b_sz) * 1.60
    n_t = sum(len(wrap_markup_lines(draw, ln, t_sz, MAX_TW_L)) or 1
              for ln in title.split("\n"))
    n_b = sum(len(wrap_markup_lines(draw, ln, b_sz, MAX_TW_L)) or 1
              for ln in body.split("\n"))
    th = int(n_t * lh_t)
    bh = int(n_b * lh_b)
    gap = 28
    if title_y is not None and str(title_y).strip() != "":
        y = int(title_y)
    else:
        y = H - th - bh - gap - 90

    rendered_title_y_end = render_title(draw, title, t_sz, MARGIN_L, y, p["title_color"],
                                        ls=1.20, align="left")
    final_body_y = int(body_y) if body_y is not None and str(body_y).strip() != "" else max(1030, rendered_title_y_end + gap)
    render_markup_block(draw, body, b_sz, MARGIN_L, final_body_y, p,
                        ls=1.60, align="left")
    return bg.convert("RGB")

def compose_text_only(img_bytes, title, body, preset: dict, title_y=None, body_y=None, watermark_pos="top_left", watermark_x=None, watermark_y=None, watermark_text=None):
    """
    Layout TEXTO PESADO — quando há muito texto, sem imagem real.
    """
    p = preset
    bg = make_cosmic_bg(p, img_bytes)
    if p.get("vignette"):
        bg = add_vignette(bg, strength=0.35)

    draw = ImageDraw.Draw(bg)
    _watermarks(draw, p["watermark_color"], pos=watermark_pos, x=watermark_x, y=watermark_y, text=watermark_text)

    bar_x = MARGIN_L
    bar_y1 = int(H * 0.30)
    bar_y2 = bar_y1 + 56
    draw.rectangle([bar_x, bar_y1, bar_x + 4, bar_y2], fill=(180, 40, 40, 230))

    t_sz = min(p["title_px"] + 6, 88)
    t_min = p["title_min_px"]
    b_sz = p["body_px"]

    t_sz = fit_title_size(draw, title, t_sz, t_min, align="left")

    PAD_TOP = int(title_y) if title_y is not None and str(title_y).strip() != "" else int(H * 0.34)
    x0 = MARGIN_L
    y = float(PAD_TOP)

    if title.strip():
        y = render_title(draw, title, t_sz, x0, y, p["title_color"],
                         ls=1.18, align="left")
        y += line_px_height(draw, t_sz) * 0.9

    if body_y is not None and str(body_y).strip() != "":
        y = float(body_y)

    paragraphs = body.split("\n\n")
    for i, para in enumerate(paragraphs):
        para = para.strip()
        if not para:
            continue
        y = render_markup_block(draw, para, b_sz, x0, y, p,
                                ls=1.60, align="left")
        if i < len(paragraphs) - 1:
            y += line_px_height(draw, b_sz) * 0.85

    return bg.convert("RGB")

def compose_card(img_bytes, title, body, preset: dict, title_y=None, body_y=None, watermark_pos="top_left", watermark_x=None, watermark_y=None, watermark_text=None):
    """Layout card: imagem arredondada no topo + texto embaixo."""
    p = preset
    canvas = Image.new("RGBA", (W, H), p["card_bg"])
    if p.get("vignette"):
        canvas = add_vignette(canvas, strength=0.25)

    draw = ImageDraw.Draw(canvas)
    _watermarks(draw, p["watermark_color"], pos=watermark_pos, x=watermark_x, y=watermark_y, text=watermark_text)

    cw, ch, cx, cy = 940, 556, (W - 940) // 2, 126
    card = Image.open(BytesIO(img_bytes)).convert("RGBA").resize((cw, ch), Image.LANCZOS)
    mask = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, cw, ch], radius=16, fill=255)
    card.putalpha(mask)
    draw.rounded_rectangle([cx-2, cy-2, cx+cw+2, cy+ch+2],
                           radius=18, outline=p["card_border"], width=2)
    canvas.paste(card, (cx, cy), card)

    ty = cy + ch + 36
    custom_y = int(title_y) if (title_y is not None and str(title_y).strip() != "") else None
    avail = H - (custom_y if custom_y is not None else ty) - 52
    t_sz = fit_title_size(draw, title, p["title_px"], p["title_min_px"], align="center")
    b_sz = p["body_px"]

    lh_t = line_px_height(draw, t_sz) * 1.18
    lh_b = line_px_height(draw, b_sz) * 1.55
    n_t = sum(len(wrap_markup_lines(draw, ln, t_sz, MAX_TW_L)) or 1
              for ln in title.split("\n"))
    n_b = sum(len(wrap_markup_lines(draw, ln, b_sz, MAX_TW_L)) or 1
              for ln in body.split("\n"))
    th = int(n_t * lh_t)
    bh = int(n_b * lh_b)
    gap = 20

    while th + gap + bh > avail and b_sz > p["body_min_px"]:
        b_sz -= 1
        lh_b = line_px_height(draw, b_sz) * 1.55
        bh = int(n_b * lh_b)

    y = float(title_y) if title_y is not None and str(title_y).strip() != "" else float(ty)
    rendered_title_y_end = render_title(draw, title, t_sz, MARGIN_L, y, p["title_color"],
                                        ls=1.18, align="center")
    final_body_y = int(body_y) if body_y is not None and str(body_y).strip() != "" else (rendered_title_y_end + gap)
    render_markup_block(draw, body, b_sz, MARGIN_L, final_body_y, p,
                        ls=1.55, align="center")
    return canvas.convert("RGB")

def compose(img_bytes, title, body, layout="fullbleed", preset_name=DEFAULT_PRESET,
            title_y=None, body_y=None, watermark_pos="top_left", watermark_x=None, watermark_y=None,
            title_px=None, body_px=None, watermark_text=None):
    """
    Ponto de entrada público do composer.
    """
    p = get_preset(preset_name).copy()

    if title_px is not None and str(title_px).strip() != "":
        p["title_px"] = int(title_px)
    if body_px is not None and str(body_px).strip() != "":
        p["body_px"] = int(body_px)

    if layout == "dramatico":
        return compose_dramatico(img_bytes, title, body, p, title_y, body_y, watermark_pos, watermark_x, watermark_y, watermark_text)
    if layout == "etereo":
        return compose_etereo(img_bytes, title, body, p, title_y, body_y, watermark_pos, watermark_x, watermark_y, watermark_text)
    if layout == "text_only":
        return compose_text_only(img_bytes, title, body, p, title_y, body_y, watermark_pos, watermark_x, watermark_y, watermark_text)
    if layout == "card":
        return compose_card(img_bytes, title, body, p, title_y, body_y, watermark_pos, watermark_x, watermark_y, watermark_text)

    return compose_fullbleed(img_bytes, title, body, p, title_y, body_y, watermark_pos, watermark_x, watermark_y, watermark_text)

"""
Efeitos Visuais de Imagem: Gradientes, Vinhetas, Grain e Watermarks.
"""

from io import BytesIO
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .presets import W, H, MARGIN_L, MARGIN_R, F_MARK

def load_font(path, size):
    try:
        return ImageFont.truetype(str(path), size)
    except Exception:
        return ImageFont.load_default()

def dark_gradient(img, preset: dict):
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    _, h = img.size
    start = preset.get("gradient_start", 0.38)
    amax = preset.get("gradient_max", 240)
    tint = preset.get("gradient_tint", (0, 0, 0))
    sy = int(h * start)

    for y in range(sy, h):
        p = (y - sy) / (h - sy)
        a = int(amax * p ** 0.55)
        r = min(tint[0] + int((1 - p) * 8), 32)
        g = min(tint[1] + int((1 - p) * 8), 24)
        b = min(tint[2] + int((1 - p) * 8), 38)
        d.line([(0, y), (W, y)], fill=(r, g, b, a))

    return Image.alpha_composite(img.convert("RGBA"), ov)

def add_vignette(img, strength=0.40):
    """Retorna imagem intacta sem borrões escuros nas bordas."""
    return img

def fill_edges_black(img, side_width=320, top_width=104):
    """Função legada para compatibilidade. Retorna a imagem intacta."""
    return img

def add_film_grain(img, intensity=18):
    """Adiciona ruído cinematográfico analógico."""
    arr = np.array(img.convert("RGBA"), dtype=np.int16)
    noise = np.random.randint(-intensity, intensity + 1, arr.shape[:2], dtype=np.int16)
    for c in range(3):
        arr[:, :, c] = np.clip(arr[:, :, c] + noise, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")

def _watermarks(draw, color, pos="top_left", x=None, y=None, text=None):
    if pos == "hidden":
        return

    mark = text.strip() if text is not None and str(text).strip() != "" else None
    if not mark:
        try:
            branding_path = Path(__file__).parent.parent.parent.parent / "dashboard" / "data" / "branding.json"
            if branding_path.exists():
                with open(branding_path, encoding="utf-8") as f:
                    data = json.load(f)
                    mark = data.get("logoText")
        except Exception:
            pass

    if not mark or not str(mark).strip():
        return

    fm = load_font(F_MARK, 28)

    default_x = MARGIN_L
    default_y = 48

    if pos == "top_right":
        default_x = W - MARGIN_R - 180
        default_y = 48
    elif pos == "bottom_left":
        default_x = MARGIN_L
        default_y = H - 80
    elif pos == "bottom_right":
        default_x = W - MARGIN_R - 180
        default_y = H - 80

    final_x = int(x) if x is not None and str(x).strip() != "" else default_x
    final_y = int(y) if y is not None and str(y).strip() != "" else default_y
    draw.text((final_x, final_y), mark, font=fm, fill=color)

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
            dark = Image.new("RGBA", (W, H), (0, 0, 0, 195))
            tex = Image.alpha_composite(tex, dark)
            base = Image.alpha_composite(base, tex)
        except Exception:
            pass

    arr = np.array(base, dtype=np.int16)
    noise = np.random.randint(-6, 7, arr.shape[:2], dtype=np.int16)
    for c in range(3):
        arr[:, :, c] = np.clip(arr[:, :, c] + noise, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")

"""
Presets Visuais e Constantes de Dimensão para Composição de Slides.
"""

from core.util.fonts import get_fonts as _get_fonts

W, H = 1080, 1350
MARGIN_C = 92    # margem para texto centralizado
MARGIN_L = 84    # margem esquerda para texto left-aligned
MARGIN_R = 84    # margem direita
MAX_TW_C = W - MARGIN_C * 2   # 920px centralizado
MAX_TW_L = W - MARGIN_L - MARGIN_R  # 936px left

_FONTS = _get_fonts()
F_HEAVY = _FONTS["heavy"]
F_HEAVY_IT = _FONTS["heavy_it"]
F_BOLD = _FONTS["bold"]
F_REGULAR = _FONTS["regular"]
F_MARK = _FONTS["mark"]

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
        "card_bg"         : (14,   4,   4,  255),
        "card_border"     : (200,  30,  30,  90),
        "gradient_tint"   : (20,   2,   2),
        "gradient_start"  : 0.36,
        "gradient_max"    : 240,
        "title_px"        : 76,
        "title_min_px"    : 36,
        "body_px"         : 40,
        "body_min_px"     : 30,
        "film_grain"      : False,
        "vignette"        : True,
    },

    "esoterico_minimalista": {
        "bg"              : (4,   2,   8,  255),
        "title_color"     : (255, 255, 255, 255),
        "body_color"      : (230, 222, 248, 255),
        "bold_color"      : (255, 255, 255, 255),
        "italic_color"    : (210, 195, 245, 255),
        "watermark_color" : (140,  90, 200, 170),
        "card_bg"         : (8,   4,  16,  255),
        "card_border"     : (120,  60, 200,  90),
        "gradient_tint"   : (12,   4,  22),
        "gradient_start"  : 0.30,
        "gradient_max"    : 252,
        "title_px"        : 76,
        "title_min_px"    : 36,
        "body_px"         : 40,
        "body_min_px"     : 30,
        "film_grain"      : False,
        "vignette"        : True,
    },

    "dramatico": {
        "bg"              : (2,   2,   3,  255),
        "title_color"     : (255, 255, 255, 255),
        "body_color"      : (238, 234, 222, 255),
        "bold_color"      : (255, 255, 255, 255),
        "italic_color"    : (230, 210, 160, 255),
        "watermark_color" : (160, 130,  50, 180),
        "card_bg"         : (6,   6,   8,  255),
        "card_border"     : (180, 140,  40,  80),
        "gradient_tint"   : (0,   0,   0),
        "gradient_start"  : 0.30,
        "gradient_max"    : 252,
        "title_px"        : 84,
        "title_min_px"    : 38,
        "body_px"         : 44,
        "body_min_px"     : 32,
        "film_grain"      : True,
        "vignette"        : True,
    },

    "etereo_luminoso": {
        "bg"              : (8,   7,   5,  255),
        "title_color"     : (255, 255, 255, 255),
        "body_color"      : (245, 238, 220, 255),
        "bold_color"      : (255, 255, 255, 255),
        "italic_color"    : (240, 220, 170, 255),
        "watermark_color" : (190, 160,  80, 190),
        "card_bg"         : (14,  12,   8,  255),
        "card_border"     : (210, 175,  70,  90),
        "gradient_tint"   : (20,  14,   4),
        "gradient_start"  : 0.38,
        "gradient_max"    : 232,
        "title_px"        : 76,
        "title_min_px"    : 36,
        "body_px"         : 42,
        "body_min_px"     : 32,
        "film_grain"      : False,
        "vignette"        : False,
    },
}

PRESETS["sagrado"] = PRESETS["manuscrito_sagrado"]
DEFAULT_PRESET = "manuscrito_sagrado"

def get_preset(name: str) -> dict:
    return PRESETS.get(name, PRESETS[DEFAULT_PRESET])

"""
prompt_builder.py — Direção de Arte Fotográfica & Cinematográfica v5
Aplica composição vertical e hierarquia de zonas para texto sem travar em ilustrações ou arte digital 3D.
"""

# ── CÂMERA & FORMATO ──────────────────────────────────────────────────────────
_CAMERA = (
    "Vertical portrait orientation, 4:5 ratio, 1080x1350 pixels. "
    "Cinematic photography, hyper-realistic, 35mm lens, natural textures, dramatic lighting. "
)

# ── GRADE & HIERARQUIA DE ZONA ────────────────────────────────────────────────
_GRADE = (
    "Cinematic color grading with high emotional contrast and rich atmospheres. "
    "The subject is expressive and filling 40 to 65% of the frame. "
    "ZONE RULE: main subject and rich detail live in the TOP 60% of the frame. "
    "The BOTTOM 35-40% of the frame transitions naturally into deep shadow and darkness. "
    "This dark lower zone is essential — text will be placed there. "
)

# ── RESTRIÇÕES E TIPOGRAFIA ────────────────────────────────────────────────────
_RESTRICTIONS = (
    " Absolutely no text, letters, words, numbers or readable symbols anywhere in the image. "
    "No watermarks. No logos. No 3D render look, no cartoon aesthetics. "
)


def build_prompt(slide_prompt: str) -> str:
    """
    Envolve o prompt do slide garantindo formato vertical e zona inferior escura para o texto.

    Args:
        slide_prompt: Descrição específica do assunto, iluminação e emoção da imagem.

    Returns:
        Prompt limpo e cinematográfico para o gerador de imagem.
    """
    import re

    p = slide_prompt.strip()

    # Remove instruções redundantes
    redundant = [
        r"vertical composition,?\s*portrait orientation[.,]?",
        r"square format[.,]?",
        r"portrait orientation[.,]?",
        r"\bno text\b[.,]?",
        r"no watermarks?[.,]?",
        r"no logos?[.,]?",
    ]
    for pattern in redundant:
        p = re.sub(pattern, "", p, flags=re.IGNORECASE).strip()

    p = p.rstrip(". ")

    base = _CAMERA + p + ". " + _GRADE + _RESTRICTIONS

    return base

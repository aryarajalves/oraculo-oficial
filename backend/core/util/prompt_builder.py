"""
prompt_builder.py — Direção de Arte v4
Aplica o DNA Visual real da marca: visionary art + paleta viva + hierarquia de zona.

DNA Visual (estilo Ganhadores de Loteria / O Dia que Você Parou de Crescer):
  - Psychedelic visionary art — profundo, vivo, impactante
  - Rosto/figura expressivo(a) em close — preenchendo 40-65% do frame
  - Cores vivas e saturadas com luminescência — ouro, violeta, magenta, teal
  - A RIQUEZA VISUAL concentra-se nos 60% superiores do frame
  - Os 40% inferiores ESCURECEM NATURALMENTE para fundo de texto
"""

# ── CÂMERA & FORMATO ──────────────────────────────────────────────────────────
_CAMERA = (
    "Vertical portrait orientation, 4:5 ratio, 1080x1350 pixels. "
    "Hyper-detailed visionary esoteric digital art. "
    "The image is NOT a photo. It is a highly vivid, breathtaking, and emotionally powerful illustration. "
)

# ── GRADE & TEXTURA ────────────────────────────────────────────────────────────
_GRADE = (
    "Psychedelic, ethereal color palettes with striking, vibrant, high-contrast colors "
    "(deep cosmic purples, glowing gold, electric cyan, radiant iridescent tones). "
    "The image must feel alive, awe-inspiring, and majestic. "
    "Radiant lighting, glowing auras, divine luminescence. "
    "The subject is EXPRESSIVE and CLOSE — filling 40 to 65% of the frame. "
    "ZONE RULE: visual complexity and color richness live in the TOP 60% of the frame. "
    "The BOTTOM 35-40% of the frame transitions naturally into deep shadow and darkness — "
    "colors fade toward deep black in this lower zone. "
    "This dark lower zone is essential — white text will be placed there. "
)

# ── RESTRIÇÕES E TIPOGRAFIA ────────────────────────────────────────────────────
_RESTRICTIONS = (
    " Absolutely no text, letters, words, numbers or readable symbols anywhere in the image. "
    "No watermarks. No logos. "
    "No flat design, no cartoon aesthetics. "
)


def build_prompt(slide_prompt: str) -> str:
    """
    Envolve o prompt do slide com o DNA visual da marca.

    O slide_prompt deve especificar:
      - O sujeito principal (figura, rosto, elemento simbólico)
      - A cor de acento seletiva (1 cor específica contra base monocromática)
      - O elemento esotérico/simbólico de sobreposição (se houver)
      - A emoção e tensão visual do slide

    Args:
        slide_prompt: Descrição específica da composição, sujeito, luz e símbolo.

    Returns:
        Prompt completo pronto para enviar ao modelo de imagem.
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

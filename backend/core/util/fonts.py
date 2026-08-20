"""
fonts.py — Resolução de fontes cross-platform (Windows local / Linux Render)

Windows: usa C:/Windows/Fonts (Franklin Gothic + Inter já instalados)
Linux:   baixa Inter + Oswald Bold via Google Fonts na primeira execução,
         salva em .fonts/ na raiz do projeto (fora do git, no .gitignore)
"""

import re
import sys
import urllib.request
from pathlib import Path

IS_WIN   = sys.platform == "win32"
ROOT_DIR = Path(__file__).parent.parent.parent          # raiz do projeto
FONT_DIR = ROOT_DIR / ".fonts"                          # ignorado pelo git

# ── Fontes Windows ─────────────────────────────────────────────────────────────
_WIN_FD       = Path("C:/Windows/Fonts")
_WIN_HEAVY    = str(_WIN_FD / "Franklin Gothic Pro-Heavy.ttf")
_WIN_HEAVY_IT = str(_WIN_FD / "Franklin Gothic Pro-HeavyItalic.ttf")
_WIN_BOLD     = str(_WIN_FD / "Inter-Bold-slnt=0.ttf")
_WIN_REGULAR  = str(_WIN_FD / "Inter-Regular-slnt=0.ttf")

# ── Fontes Linux (baixadas) ────────────────────────────────────────────────────
_LNX_HEAVY    = str(FONT_DIR / "Oswald-Bold.ttf")
_LNX_HEAVY_IT = str(FONT_DIR / "Oswald-Bold.ttf")   # sem itálico — usa mesmo arquivo
_LNX_BOLD     = str(FONT_DIR / "Inter-Bold.ttf")
_LNX_REGULAR  = str(FONT_DIR / "Inter-Regular.ttf")


def _get_google_ttf_url(family: str, weight: int = 400) -> str | None:
    """
    Retorna URL de arquivo TTF do Google Fonts.
    Usa User-Agent antigo para forçar resposta TTF (não woff2).
    """
    slug = family.replace(" ", "+")
    url  = f"https://fonts.googleapis.com/css?family={slug}:wght@{weight}&display=swap"
    req  = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)"
    })
    try:
        css = urllib.request.urlopen(req, timeout=15).read().decode("utf-8")
        m   = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+\.ttf)\)", css)
        return m.group(1) if m else None
    except Exception as e:
        print(f"  [fonts] Erro ao buscar {family}: {e}")
        return None


def ensure_linux_fonts():
    """Baixa as fontes necessárias para Linux se ainda não existirem."""
    FONT_DIR.mkdir(exist_ok=True)

    downloads = [
        ("Oswald-Bold.ttf",  "Oswald",            700),
        ("Inter-Regular.ttf","Inter",              400),
        ("Inter-Bold.ttf",   "Inter",              700),
    ]

    for filename, family, weight in downloads:
        dest = FONT_DIR / filename
        if dest.exists():
            continue
        print(f"  [fonts] Baixando {filename}...", flush=True)
        url = _get_google_ttf_url(family, weight)
        if url:
            try:
                urllib.request.urlretrieve(url, dest)
                print(f"  [fonts] ✓ {filename}", flush=True)
            except Exception as e:
                print(f"  [fonts] ✗ Falha ao baixar {filename}: {e}", flush=True)
        else:
            print(f"  [fonts] ✗ URL não encontrada para {filename}", flush=True)


def get_fonts() -> dict:
    """
    Retorna dict com caminhos das fontes para o ambiente atual.
    Chama ensure_linux_fonts() automaticamente no Linux.
    """
    if IS_WIN:
        return {
            "heavy":    _WIN_HEAVY,
            "heavy_it": _WIN_HEAVY_IT,
            "bold":     _WIN_BOLD,
            "regular":  _WIN_REGULAR,
            "mark":     _WIN_REGULAR,
        }
    else:
        ensure_linux_fonts()
        return {
            "heavy":    _LNX_HEAVY,
            "heavy_it": _LNX_HEAVY_IT,
            "bold":     _LNX_BOLD,
            "regular":  _LNX_REGULAR,
            "mark":     _LNX_REGULAR,
        }

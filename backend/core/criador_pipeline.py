#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
criador_pipeline.py — Runner genérico de carrossel a partir do output do Criador.

USO:
    python core/criador_pipeline.py --data '{"title":...,"slides":[...]}'

Saída (JSON lines para stdout):
    {"type":"start",  "total":10, "title":"..."}
    {"type":"slide",  "num":1, "total":10, "estado":"DISRUPÇÃO", "status":"gerando"}
    {"type":"slide",  "num":1, "total":10, "estado":"DISRUPÇÃO", "status":"ok", "file":"..."}
    {"type":"slide",  "num":1, "total":10, "estado":"DISRUPÇÃO", "status":"erro", "msg":"..."}
    {"type":"done",   "id":"carrossel-46", "slides_dir":"...", "total_ok":9}
    {"type":"error",  "msg":"..."}

Em produção (Linux/Render):
    - Salva em /tmp/carrossel-{slug}/
    - NÃO chama register() — o Node.js faz o registro no B2
    - O Node.js lê os arquivos de /tmp/ e faz upload para B2
"""

import os, sys, json, argparse, re, subprocess, importlib
from pathlib import Path
from datetime import date

# ── Garante que a raiz do projeto está no sys.path ────────────────────────────
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

# ── python_packages/ (instalado via pip --target no Render) ──────────────────
VENDOR = ROOT / "python_packages"
if VENDOR.exists() and str(VENDOR) not in sys.path:
    sys.path.insert(0, str(VENDOR))

# ── Auto-instala dependências se ainda não estiverem disponíveis ──────────────
def _ensure(pkg: str, import_as: str | None = None) -> None:
    """Instala `pkg` se o módulo `import_as` não for importável."""
    mod = import_as or pkg.split("[")[0].replace("-", "_")
    try:
        importlib.import_module(mod)
    except ImportError:
        print(json.dumps({"type": "log", "msg": f"⚙ Instalando {pkg}..."}), flush=True)
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--quiet",
             "--target", str(VENDOR), pkg],
            check=True, capture_output=True
        )
        importlib.invalidate_caches()
        if str(VENDOR) not in sys.path:
            sys.path.insert(0, str(VENDOR))

_ensure("openai")
_ensure("Pillow", "PIL")
_ensure("numpy")
_ensure("python-dotenv", "dotenv")

# ── Carrega .env localmente; no Render as variáveis já estão no ambiente ──────
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass

IS_WIN = sys.platform == "win32"

# ── Imports do pipeline ───────────────────────────────────────────────────────
try:
    from core.util.gen_image_openai import gen_openai as gen
    from core.util.compose_util import compose
    from core.util.prompt_builder import build_prompt
except ImportError as e:
    print(json.dumps({"type": "error", "msg": f"Import error: {e}"}), flush=True)
    sys.exit(1)

# Registro só no Windows (local); no Linux o Node.js cuida via B2
if IS_WIN:
    try:
        from core.agentes.register_carousel import register
    except ImportError:
        register = None
else:
    register = None


def out(obj: dict):
    """Emite uma linha JSON para stdout (parseada pelo Node.js)."""
    print(json.dumps(obj, ensure_ascii=False), flush=True)


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    return text[:48].strip("-")


import threading
_out_lock = threading.Lock()

def out_safe(obj: dict):
    """out() thread-safe (múltiplas threads podem chamar ao mesmo tempo)."""
    with _out_lock:
        out(obj)


def fetch_image_for_slide(args_tuple):
    """
    FASE 1 — apenas a chamada de API (rede, sem Pillow).
    Roda em paralelo. Retorna (idx, img_bytes | None).
    """
    idx, s = args_tuple
    prompt = s.get("prompt", "")
    s_title = s.get("title", "")
    quality = s.get("imageQuality", None)
    prompt_final = build_prompt(prompt) if prompt else build_prompt(
        "Cinematic dark esoteric illustration, dramatic volumetric light, "
        f"deep emotional atmosphere. Abstract visual metaphor for: {s_title}"
    )
    return idx, gen(prompt_final, quality=quality)


def main():
    from concurrent.futures import ThreadPoolExecutor, as_completed

    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="JSON com o payload do carrossel")
    args = parser.parse_args()

    try:
        payload = json.loads(args.data)
    except json.JSONDecodeError as e:
        out({"type": "error", "msg": f"JSON inválido: {e}"})
        sys.exit(1)

    title     = payload.get("title", "Carrossel sem título")
    theme     = payload.get("theme", slugify(title))
    fmt       = payload.get("format", "B")
    caption   = payload.get("caption", "")
    notes     = payload.get("notes", "")
    rev_score = payload.get("revisor_score", "")
    slides    = payload.get("slides", [])

    if not slides:
        out({"type": "error", "msg": "Nenhum slide no payload"})
        sys.exit(1)

    slug = slugify(title)
    out_dir = Path(f"C:/Users/julia/Desktop/carrossel-{slug}") if IS_WIN \
              else Path(f"/tmp/carrossel-{slug}")
    out_dir.mkdir(parents=True, exist_ok=True)

    total = len(slides)
    out({"type": "start", "total": total, "title": title, "out_dir": str(out_dir)})

    quality = payload.get("imageQuality", None)

    # Anuncia todos como "gerando" imagem
    for idx, s in enumerate(slides, 1):
        s["imageQuality"] = quality
        out({"type": "slide", "num": idx, "total": total,
             "estado": s.get("estado", f"S{idx}"), "status": "gerando"})

    # ══════════════════════════════════════════════════════════════════════════
    # FASE 1: API calls em paralelo (rede — pouca memória, gargalo é latência)
    # MAX_WORKERS paralelos para as chamadas à OpenAI
    # ══════════════════════════════════════════════════════════════════════════
    MAX_API_WORKERS = min(5, total)
    raw_images: dict[int, bytes | None] = {}

    with ThreadPoolExecutor(max_workers=MAX_API_WORKERS) as pool:
        futures = {pool.submit(fetch_image_for_slide, (idx, s)): idx
                   for idx, s in enumerate(slides, 1)}
        for future in as_completed(futures):
            try:
                idx, img_bytes = future.result()
            except Exception as e:
                idx = futures[future]
                img_bytes = None
                out_safe({"type": "log", "msg": f"  S{idx:02d} API erro: {e}"})
            raw_images[idx] = img_bytes
            status_icon = "ok" if img_bytes else "erro"
            out_safe({"type": "log",
                      "msg": f"  S{idx:02d} imagem {status_icon}"})

    # ══════════════════════════════════════════════════════════════════════════
    # FASE 2: Composição sequencial com Pillow (CPU+memória — 1 por vez)
    # Evita OOM no free tier do Render (512 MB)
    # ══════════════════════════════════════════════════════════════════════════
    out({"type": "log", "msg": "Compondo slides..."})
    ok_count = 0

    for idx in range(1, total + 1):
        s       = slides[idx - 1]
        num     = s.get("num", str(idx).zfill(2))
        estado  = s.get("estado", f"S{idx}")
        layout  = s.get("layout", "fullbleed")
        s_title = s.get("title", "")
        body    = s.get("body", "")
        img_bytes = raw_images.get(idx)

        if not img_bytes:
            out({"type": "slide", "num": idx, "total": total, "estado": estado,
                 "status": "erro", "msg": "Falha na geração de imagem"})
            continue

        preset    = s.get("preset", "manuscrito_sagrado")
        try:
            final_img = compose(img_bytes, s_title, body, layout, preset)
        except Exception as e:
            out({"type": "slide", "num": idx, "total": total, "estado": estado,
                 "status": "erro", "msg": f"Composição falhou: {e}"})
            continue

        out_file = out_dir / f"slide-{num}.jpg"
        try:
            if isinstance(final_img, bytes):
                out_file.write_bytes(final_img)
            else:
                final_img.save(str(out_file), "JPEG", quality=95)
            ok_count += 1
            out({"type": "slide", "num": idx, "total": total, "estado": estado,
                 "status": "ok", "file": str(out_file)})
        except Exception as e:
            out({"type": "slide", "num": idx, "total": total, "estado": estado,
                 "status": "erro", "msg": f"Salvar falhou: {e}"})

        # Libera memória imediatamente após salvar
        del final_img, img_bytes
        raw_images[idx] = None

    # ── Registro no dashboard ─────────────────────────────────────────────────
    if IS_WIN and register:
        try:
            entry = register(
                title=title, theme=theme, slides_dir=str(out_dir),
                format=fmt, caption=caption, revisor_score=rev_score,
                notes=notes,
                status="pronto" if ok_count == total else "rascunho",
            )
            out({"type": "done", "id": entry["id"], "slides_dir": str(out_dir),
                 "total_ok": ok_count, "total": total})
        except Exception as e:
            out({"type": "error", "msg": f"Registro local falhou: {e}"})
            sys.exit(1)
    else:
        out({"type": "done", "slides_dir": str(out_dir),
             "total_ok": ok_count, "total": total,
             "title": title, "theme": theme, "format": fmt,
             "caption": caption, "notes": notes, "revisor_score": rev_score})


if __name__ == "__main__":
    main()

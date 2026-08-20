#!/usr/bin/env python3
"""
register_carousel.py — Registra automaticamente um carrossel no dashboard.
Chamado no final de todo script de geração de carrossel.

Uso:
    from core.agentes.register_carousel import register

    register(
        title       = "Titulo do carrossel",
        theme       = "slug-do-tema",
        format      = "B",
        slides_dir  = "C:/Users/julia/Desktop/carrossel-xxx",
        caption     = "Texto da caption...",
        revisor_score = "15/15",
        notes       = "Observacoes adicionais",
    )
"""
import json
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

DATA_FILE = Path("C:/Users/julia/nano-banana-mcp/dashboard/data/carousels.json")

def broadcast_event(event_type: str, data: dict):
    try:
        payload = json.dumps({"type": event_type, "data": data}).encode("utf-8")
        req = urllib.request.Request(
            "http://localhost:3131/api/events/broadcast",
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        urllib.request.urlopen(req, timeout=1.5)
    except Exception:
        pass



def _read():
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def _write(data):
    DATA_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _count_slides(slides_dir: str, prefix: str = "slide-") -> int:
    d = Path(slides_dir)
    if not d.exists():
        return 0
    return len([f for f in d.iterdir()
                if f.name.startswith(prefix) and f.suffix.lower() in (".jpg", ".jpeg", ".png")])


def register(
    title: str,
    theme: str,
    slides_dir: str,
    format: str = "B",
    caption: str = "",
    revisor_score: str = "",
    notes: str = "",
    status: str = "pronto",
    slide_prefix: str = "slide-",
) -> dict:
    """
    Insere ou atualiza o carrossel no dashboard/data/carousels.json.
    Retorna o registro criado/atualizado.
    """
    all_carousels = _read()

    # Verifica se ja existe pelo slidesDir (evita duplicatas em re-runs)
    existing = next((c for c in all_carousels if c.get("slidesDir") == slides_dir), None)

    total = _count_slides(slides_dir, slide_prefix)

    if existing:
        # Atualiza registro existente
        existing.update({
            "title":        title,
            "theme":        theme,
            "format":       format,
            "status":       status,
            "totalSlides":  total,
            "caption":      caption,
            "notes":        notes,
        })
        if revisor_score:
            existing["revisorScore"] = revisor_score
        _write(all_carousels)
        print(f"\n[Dashboard] Atualizado: {existing['id']} — {total} slides registrados.")
        return existing

    # Novo registro — proximo ID a partir do maior existente (evita colisão com gaps)
    nums = []
    for c in all_carousels:
        try:
            nums.append(int(c["id"].split("-")[-1]))
        except Exception:
            pass
    next_num = (max(nums) + 1) if nums else 1
    new_id   = f"carrossel-{str(next_num).zfill(2)}"

    entry = {
        "id":           new_id,
        "title":        title,
        "theme":        theme,
        "format":       format,
        "status":       status,
        "createdAt":    str(date.today()),
        "slidesDir":    slides_dir,
        "slidePrefix":  slide_prefix,
        "totalSlides":  total,
        "caption":      caption,
        "notes":        notes,
    }
    if revisor_score:
        entry["revisorScore"] = revisor_score

    all_carousels.append(entry)
    _write(all_carousels)

    print(f"\n[Dashboard] Registrado: {new_id} — {total} slides — {slides_dir}")
    return entry

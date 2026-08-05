#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
publish_instagram.py — Publica carrosseis no Instagram via Meta Graph API oficial.

USO:
    python -X utf8 publish_instagram.py --id carrossel-04
    python -X utf8 publish_instagram.py --id carrossel-04 --caption "Caption custom"
    python -X utf8 publish_instagram.py --list
"""

import sys, json, argparse
from pathlib import Path
from datetime import datetime

# ── Encoding fix Windows ──────────────────────────────────────────────────────
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Adiciona o próprio diretório infra/social ao sys.path para import de instagram_publisher
SOCIAL_DIR = Path(__file__).resolve().parent
if str(SOCIAL_DIR) not in sys.path:
    sys.path.insert(0, str(SOCIAL_DIR))

from dotenv import load_dotenv
load_dotenv()

DATA_FILE = BASE_DIR / "dashboard" / "data" / "carousels.json"


# ── Dashboard helpers ─────────────────────────────────────────────────────────

def read_dashboard():
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def update_status(carousel_id: str, status: str, media_id: str = ""):
    all_c = read_dashboard()
    for c in all_c:
        if c["id"] == carousel_id:
            c["status"] = status
            if media_id:
                c["instagramMediaId"] = str(media_id)
            c["publishedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    DATA_FILE.write_text(
        json.dumps(all_c, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def get_slides(carousel: dict) -> list[Path]:
    d      = Path(carousel["slidesDir"])
    prefix = carousel.get("slidePrefix", "slide-")
    if not d.exists():
        return []
    return sorted([
        f for f in d.iterdir()
        if f.name.startswith(prefix)
        and f.suffix.lower() in (".jpg", ".jpeg", ".png")
    ])


def list_carousels():
    all_c = read_dashboard()
    print(f"\n{'─'*62}")
    print(f"  {'ID':<20} {'STATUS':<12} {'SLIDES':<8} TITULO")
    print(f"{'─'*62}")
    for c in all_c:
        slides = get_slides(c)
        status = c.get("status", "?")
        icon   = "OK" if status == "publicado" else (">" if status in ("pronto", "aprovado") else "-")
        print(f"  {c['id']:<20} [{icon}] {status:<10} {len(slides):<8} {c['title'][:34]}")
    print(f"{'─'*62}\n")


# ── Publicação via Meta Graph API ─────────────────────────────────────────────

def publish(carousel_id: str, custom_caption: str = "", stories: bool = False) -> bool:
    from instagram_publisher import publicar_carrossel

    all_c    = read_dashboard()
    carousel = next((c for c in all_c if c["id"] == carousel_id), None)

    if not carousel:
        print(f"ERRO: Carrossel '{carousel_id}' nao encontrado no dashboard.")
        return False

    slides_dir = Path(carousel["slidesDir"])
    if not slides_dir.exists():
        print(f"ERRO: Pasta de slides nao encontrada: {slides_dir}")
        return False

    slides = get_slides(carousel)
    if not slides:
        print(f"ERRO: Nenhum slide encontrado em: {slides_dir}")
        return False

    caption = custom_caption or carousel.get("caption", "")
    if not caption and not stories:
        print("AVISO: Caption vazio — publicando sem caption.")

    print(f"\nCarrossel    : {carousel['title'][:55]}")
    print(f"Slides       : {len(slides)}")
    print(f"Pasta        : {slides_dir}")
    print(f"Tipo         : {'STORIES' if stories else 'FEED/CARROSSEL'}")

    try:
        if stories:
            from instagram_publisher import publicar_stories
            story_ids = publicar_stories(
                slides_dir = slides_dir,
            )
            update_status(carousel_id, "publicado", ",".join(story_ids))
            print(f"\nDashboard atualizado -> publicado (Stories)")
        else:
            post_id = publicar_carrossel(
                slides_dir = slides_dir,
                caption    = caption,
            )
            update_status(carousel_id, "publicado", str(post_id))
            print(f"\nDashboard atualizado -> publicado (Feed)")
        return True

    except Exception as e:
        print(f"\nERRO ao publicar: {e}")
        import traceback; traceback.print_exc()
        update_status(carousel_id, "erro-publicacao")
        return False


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Publica carrossel/stories no Instagram via Meta API")
    parser.add_argument("--id",      help="ID do carrossel (ex: carrossel-04)")
    parser.add_argument("--caption", help="Caption customizado", default="")
    parser.add_argument("--stories", action="store_true", help="Publicar como Stories em vez de Feed")
    parser.add_argument("--list",    action="store_true", help="Listar carrosseis")
    args = parser.parse_args()

    if args.list:
        list_carousels()
    elif args.id:
        ok = publish(args.id, args.caption, args.stories)
        sys.exit(0 if ok else 1)
    else:
        parser.print_help()

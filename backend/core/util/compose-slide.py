#!/usr/bin/env python3
"""compose-slide.py — CLI para recompor um slide com novo texto.
Uso: python compose-slide.py --image <path> --title <txt> --body <txt> --layout fullbleed --output <path>
"""
import sys, argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from core.util.compose_util_v3 import compose

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--image",  required=True, help="Caminho para a imagem base (jpg/png)")
    p.add_argument("--title",  required=True, help="Titulo do slide (use \\n para quebra de linha)")
    p.add_argument("--body",   required=True, help="Corpo do slide")
    p.add_argument("--layout", default="fullbleed", choices=["fullbleed", "card", "dramatico", "etereo", "text_only"])
    p.add_argument("--preset", default="revelacao", help="Nome do preset visual (cosmico, sagrado, revelacao)")
    p.add_argument("--output", required=True, help="Caminho de saida (.jpg)")
    args = p.parse_args()

    # Mapear layouts do frontend para os modos suportados pelo motor v3
    mode = "image"
    if args.layout == "card":
        mode = "card"
    elif args.layout == "text_only":
        mode = "text"

    # Detectar se é slide de capa (S1) a partir do nome do arquivo
    cover = False
    filename = Path(args.output).name.lower()
    if "slide-01" in filename or "slide-1." in filename:
        cover = True

    img_bytes = Path(args.image).read_bytes() if mode in ("image", "card") else None
    result = compose(
        img_bytes=img_bytes,
        title=args.title,
        body=args.body,
        mode=mode,
        preset_name=args.preset,
        cover=cover
    )
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    result.save(str(out), "JPEG", quality=95)
    print(f"OK: {out}")

if __name__ == "__main__":
    main()

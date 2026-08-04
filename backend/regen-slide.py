#!/usr/bin/env python3
"""regen-slide.py — Regenera a imagem via Gemini e recompõe o slide.
Uso: python regen-slide.py --prompt <txt> --title <txt> --body <txt> --layout fullbleed --output <path>
"""

import os
from dotenv import load_dotenv
load_dotenv()
import sys, argparse, json, base64, time, urllib.request, urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from core.util.compose_util import compose
from core.util.prompt_builder import build_prompt

API_KEY  = os.getenv("GEMINI_API_KEY")
MODEL    = "imagen-3.0-generate-002"
ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:predict"

def gen(prompt, retries=3):
    headers = {
        "x-goog-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": "3:4"
        }
    }
    data = json.dumps(payload).encode("utf-8")
    
    for attempt in range(retries):
        if attempt: time.sleep(4 * attempt)
        req = urllib.request.Request(ENDPOINT, data=data, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                body = json.loads(r.read())
            predictions = body.get("predictions", [])
            if predictions and "bytesBase64Encoded" in predictions[0]:
                return base64.b64decode(predictions[0]["bytesBase64Encoded"])
            print(f"  Sem imagem no Imagen 3: {json.dumps(body)[:150]}", file=sys.stderr)
        except urllib.error.HTTPError as e:
            print(f"  HTTP {e.code}: {e.read().decode()[:150]}", file=sys.stderr)
        except Exception as e:
            print(f"  Erro Imagen 3: {e}", file=sys.stderr)
    return None

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--prompt", required=True, help="Prompt de imagem para o Gemini")
    p.add_argument("--title",  required=True, help="Titulo do slide")
    p.add_argument("--body",   required=True, help="Corpo do slide")
    p.add_argument("--layout", default="fullbleed", choices=["fullbleed", "card"])
    p.add_argument("--output", required=True, help="Caminho de saida (.jpg)")
    args = p.parse_args()

    final_prompt = build_prompt(args.prompt)
    print("Gerando imagem...", file=sys.stderr)
    img_bytes = gen(final_prompt)
    if not img_bytes:
        print("FALHOU: nao foi possivel gerar a imagem", file=sys.stderr)
        sys.exit(1)

    result = compose(img_bytes, args.title, args.body, args.layout)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    result.save(str(out), "JPEG", quality=95)
    print(f"OK: {out}")

if __name__ == "__main__":
    main()

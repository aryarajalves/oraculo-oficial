#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_image_openai.py — Gerador de imagens via OpenAI (gpt-image-1 / dall-e-3)
Drop-in replacement para o gen() do Gemini nos scripts de carrossel.

USO NOS SCRIPTS DE CARROSSEL:
    # Substituir:
    from core.util.gen_image_openai import gen_openai as gen

MODELOS:
    "gpt-image-1"  → GPT Image 2 (mais recente, melhor qualidade)
    "dall-e-3"     → DALL-E 3 (mais rápido, amplamente disponível)
"""

import os, base64, time, sys
from pathlib import Path

# Carrega .env localmente; no Render as variáveis já estão no ambiente
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent.parent / ".env")
except ImportError:
    pass

try:
    from openai import OpenAI
except ImportError:
    print("❌ openai não instalado. Execute: pip install openai")
    sys.exit(1)

# ── Configuração ───────────────────────────────────────────────────────────────
OPENAI_KEY = os.getenv("OPENAI_API_KEY")
MODEL      = "gpt-image-2"

# Tamanhos disponíveis
# gpt-image-1:  "1024x1024", "1024x1536" (portrait), "1536x1024" (landscape), "auto"
# dall-e-3:     "1024x1024", "1792x1024", "1024x1792"
SIZE = "1024x1536"   # retrato — mais próximo do 1080×1350 do Instagram

# Qualidade (gpt-image-1: "low" | "medium" | "high" | "auto")
QUALITY = "high"

MAX_RETRIES = 3

# ── Cliente ────────────────────────────────────────────────────────────────────
def _get_client() -> OpenAI:
    if not OPENAI_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY não encontrada no .env\n"
            "Adicione: OPENAI_API_KEY=sk-proj-..."
        )
    return OpenAI(api_key=OPENAI_KEY)


# ── Função principal ───────────────────────────────────────────────────────────
def gen_openai(prompt: str, retries: int = MAX_RETRIES, size: str = SIZE, quality: str = None) -> bytes | None:
    """
    Gera uma imagem via OpenAI e retorna os bytes PNG/JPEG.
    Mesma interface do gen() do Gemini — retorna None em caso de falha.

    Args:
        prompt:  Prompt descritivo da imagem
        retries: Número máximo de tentativas
        size:    Tamanho da imagem ("1024x1536", "1024x1024", etc)
        quality: Qualidade da imagem ("low", "medium", "high", "standard", "hd", etc)

    Returns:
        bytes da imagem, ou None se falhou
    """
    client = _get_client()

    for attempt in range(1, retries + 1):
        try:
            print(f"    [OpenAI {MODEL}] tentativa {attempt}/{retries} ({size})...")

            kwargs = {
                "model":  MODEL,
                "prompt": prompt,
                "n":      1,
            }

            if MODEL in ["gpt-image-1", "gpt-image-2"]:
                kwargs["size"]    = size
                kwargs["quality"] = quality or QUALITY

            elif MODEL == "dall-e-3":
                # DALL-E 3 usa tamanhos diferentes e não aceita "high"
                kwargs["size"]             = "1024x1792"
                kwargs["quality"]          = quality or "hd"
                kwargs["response_format"]  = "b64_json"

            response = client.images.generate(**kwargs)
            item     = response.data[0]

            # gpt-image-1 retorna b64_json diretamente
            # dall-e-3 retorna b64_json ou url (dependendo de response_format)
            if hasattr(item, "b64_json") and item.b64_json:
                return base64.b64decode(item.b64_json)

            # Se veio URL (dall-e-3 sem response_format especificado)
            if hasattr(item, "url") and item.url:
                import urllib.request
                with urllib.request.urlopen(item.url, timeout=60) as r:
                    return r.read()

            print(f"    ⚠️  Resposta inesperada: {item}")

        except Exception as e:
            err = str(e)
            print(f"    ❌ Tentativa {attempt} falhou: {err[:120]}")

            # Content policy block — não faz sentido repetir
            if "content_policy" in err.lower() or "safety" in err.lower():
                print("    ⛔ Bloqueio de conteúdo — pulando este slide")
                return None

            if attempt < retries:
                wait = 4 * attempt
                print(f"    ⏳ Aguardando {wait}s antes de tentar novamente...")
                time.sleep(wait)

    return None


# ── Verificação rápida ─────────────────────────────────────────────────────────
def verificar_key() -> bool:
    """Testa se a OPENAI_API_KEY é válida (chamada leve ao endpoint de modelos)."""
    try:
        client = _get_client()
        models = client.models.list()
        return any("image" in m.id or "dall" in m.id for m in models.data)
    except Exception as e:
        print(f"  [Erro] API Key invalida ou sem permissao: {e}")
        return False


# ── CLI de teste ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Teste do gerador OpenAI")
    parser.add_argument("--check",  action="store_true", help="Verifica a API key")
    parser.add_argument("--modelo", default=MODEL, choices=["gpt-image-1", "dall-e-3"],
                        help="Modelo a usar")
    parser.add_argument("--prompt", default="", help="Prompt de teste")
    parser.add_argument("--out",    default="test_output.png", help="Arquivo de saída")
    args = parser.parse_args()

    MODEL = args.modelo  # override global

    print(f"\n{'='*55}")
    print(f"  OpenAI Image Generator — {MODEL}")
    print(f"{'='*55}\n")

    if args.check:
        ok = verificar_key()
        print(f"  API Key: {'[OK] Valida' if ok else '[ERRO] Invalida'}")
        sys.exit(0 if ok else 1)

    prompt = args.prompt or (
        "Painterly digital oil painting, mystical cinematic atmosphere. "
        "A single ancient golden key floating in deep cosmic space, "
        "surrounded by soft luminous particles of amber and teal light. "
        "Rich painterly texture, dramatic lighting, atmospheric depth. "
        "No text, no letters."
    )

    print(f"  Modelo:  {MODEL}")
    print(f"  Tamanho: {SIZE}")
    print(f"  Quality: {QUALITY}")
    print(f"  Prompt:  {prompt[:80]}...\n")

    img_bytes = gen_openai(prompt)

    if img_bytes:
        out = Path(args.out)
        out.write_bytes(img_bytes)
        print(f"\n  ✅ Imagem gerada! Salva em: {out.resolve()}")
        print(f"  Tamanho: {len(img_bytes) / 1024:.0f} KB\n")
    else:
        print("\n  ❌ Falha na geração.\n")
        sys.exit(1)

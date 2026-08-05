#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
minio_uploader.py — Upload de imagens para MinIO (URL pública)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Faz upload de slides JPEG para o bucket público do MinIO
e retorna URLs públicas — necessárias para publicação via Meta API.

Uso:
    from minio_uploader import upload_image, upload_slides

    url  = upload_image(Path("slide-01.jpg"))
    urls = upload_slides(Path("C:/Users/julia/Desktop/carrossel-x"))
"""

import os
import sys
import uuid
import boto3
from pathlib import Path
from dotenv import load_dotenv
from botocore.client import Config

# Fix Windows terminal encoding
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()

B2_KEY_ID          = os.getenv("B2_KEY_ID")
B2_APPLICATION_KEY  = os.getenv("B2_APPLICATION_KEY")
B2_BUCKET_NAME      = os.getenv("B2_BUCKET_NAME")
B2_ENDPOINT         = os.getenv("B2_ENDPOINT")

MINIO_ENDPOINT      = os.getenv("MINIO_ENDPOINT")
MINIO_ROOT_USER     = os.getenv("MINIO_ROOT_USER")
MINIO_ROOT_PASSWORD = os.getenv("MINIO_ROOT_PASSWORD")
MINIO_BUCKET        = os.getenv("MINIO_BUCKET", "oraculo-bucket")
MINIO_PUBLIC_URL    = os.getenv("MINIO_PUBLIC_URL") or MINIO_ENDPOINT


def _client():
    """Cria cliente boto3 apontando para B2 ou MinIO."""
    if B2_KEY_ID and B2_APPLICATION_KEY:
        endpoint = B2_ENDPOINT or "https://s3.us-west-004.backblazeb2.com"
        return boto3.client(
            "s3",
            endpoint_url        = endpoint,
            aws_access_key_id   = B2_KEY_ID,
            aws_secret_access_key = B2_APPLICATION_KEY,
            config              = Config(signature_version="s3v4"),
        )
    return boto3.client(
        "s3",
        endpoint_url        = MINIO_ENDPOINT,
        aws_access_key_id   = MINIO_ROOT_USER,
        aws_secret_access_key = MINIO_ROOT_PASSWORD,
        config              = Config(signature_version="s3v4"),
    )


def upload_image(path: Path | str, key: str = None) -> str:
    """
    Faz upload de uma imagem para o Backblaze B2 ou MinIO.
    Returns:
        URL pública da imagem
    """
    use_b2 = bool(B2_KEY_ID and B2_APPLICATION_KEY and B2_BUCKET_NAME)
    bucket = B2_BUCKET_NAME if use_b2 else MINIO_BUCKET

    if not use_b2 and not all([MINIO_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, MINIO_BUCKET]):
        raise ValueError(
            "Credenciais MinIO ou B2 não encontradas no .env. "
            "Verifique: B2_KEY_ID / B2_APPLICATION_KEY ou MINIO_ENDPOINT"
        )

    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")

    if key is None:
        prefix = uuid.uuid4().hex[:8]
        key    = f"{prefix}-{path.name}"

    client = _client()
    with open(path, "rb") as f:
        client.put_object(
            Bucket      = bucket,
            Key         = key,
            Body        = f,
            ContentType = "image/jpeg",
        )

    import urllib.parse
    safe_key = urllib.parse.quote(key)
    if use_b2:
        endpoint = (B2_ENDPOINT or "https://s3.us-west-004.backblazeb2.com").rstrip("/")
        url = f"{endpoint}/{bucket}/{safe_key}"
    else:
        base_url = MINIO_PUBLIC_URL.rstrip("/")
        url = f"{base_url}/{bucket}/{safe_key}"
    return url


def upload_slides(slides_dir: Path | str, prefix: str = None) -> list[str]:
    """
    Faz upload de todos os slides de um diretório em ordem.

    Args:
        slides_dir: Diretório contendo slide-01.jpg, slide-02.jpg, etc.
        prefix:     Prefixo único para agrupar os slides no bucket.
                    Se None, gera automaticamente.

    Returns:
        Lista de URLs públicas na ordem correta (slide-01 a slide-10).
    """
    slides_dir = Path(slides_dir)
    slides     = sorted(slides_dir.glob("slide-*.jpg"))

    if not slides:
        raise FileNotFoundError(f"Nenhum slide encontrado em: {slides_dir}")

    if prefix is None:
        prefix = uuid.uuid4().hex[:8]

    urls = []
    print(f"\n  📤 Enviando {len(slides)} slides para o MinIO...")
    for slide in slides:
        key = f"{prefix}/{slide.name}"
        print(f"     {slide.name}...", end=" ", flush=True)
        url = upload_image(slide, key=key)
        print(f"✅")
        urls.append(url)

    print(f"  ✅ Upload completo — prefixo: {prefix}\n")
    return urls


# ── TESTE RÁPIDO ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Uso: python minio_uploader.py <imagem_ou_pasta>")
        sys.exit(1)

    target = Path(sys.argv[1])

    if target.is_dir():
        urls = upload_slides(target)
        print("URLs geradas:")
        for i, u in enumerate(urls, 1):
            print(f"  S{i:02d}: {u}")
    else:
        url = upload_image(target)
        print(f"✅ URL pública: {url}")

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

MINIO_ENDPOINT      = os.getenv("MINIO_ENDPOINT")
MINIO_ROOT_USER     = os.getenv("MINIO_ROOT_USER")
MINIO_ROOT_PASSWORD = os.getenv("MINIO_ROOT_PASSWORD")
MINIO_BUCKET        = os.getenv("MINIO_BUCKET", "oraculo-bucket")
# URL pública para o Meta/Instagram acessar as imagens do MinIO se for diferente do endpoint interno
MINIO_PUBLIC_URL    = os.getenv("MINIO_PUBLIC_URL") or MINIO_ENDPOINT


def _client():
    """Cria cliente boto3 apontando para o MinIO."""
    return boto3.client(
        "s3",
        endpoint_url        = MINIO_ENDPOINT,
        aws_access_key_id   = MINIO_ROOT_USER,
        aws_secret_access_key = MINIO_ROOT_PASSWORD,
        config              = Config(signature_version="s3v4"),
    )


def upload_image(path: Path | str, key: str = None) -> str:
    """
    Faz upload de uma imagem para o MinIO.

    Args:
        path: Caminho local do arquivo (JPEG).
        key:  Nome do arquivo no bucket. Se None, usa o nome original
              prefixado com um UUID curto para evitar colisões.

    Returns:
        URL pública da imagem
    """
    if not all([MINIO_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, MINIO_BUCKET]):
        raise ValueError(
            "Credenciais MinIO não encontradas no .env. "
            "Verifique: MINIO_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, MINIO_BUCKET"
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
            Bucket      = MINIO_BUCKET,
            Key         = key,
            Body        = f,
            ContentType = "image/jpeg",
        )

    import urllib.parse
    safe_key = urllib.parse.quote(key)
    base_url = MINIO_PUBLIC_URL.rstrip("/")
    url = f"{base_url}/{MINIO_BUCKET}/{safe_key}"
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

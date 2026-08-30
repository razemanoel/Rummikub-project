"""
Thin wrapper around the AWS S3 client used to store vision-feedback
artifacts (the rack/board photos users correct during review, plus the
JSON describing what was corrected) in the cloud instead of on local
disk.

Design notes:
  - S3 storage is OPT-IN via the S3_BUCKET_NAME env var. If it isn't
    set, `is_enabled()` returns False and callers fall back to saving
    the same files on local disk (see feedback_service.py). This keeps
    the app fully runnable with `docker compose up` and no AWS account
    at all, which matters for teammates / graders who don't have one.
  - Credentials are never hardcoded. boto3 picks up
    AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_DEFAULT_REGION from
    the environment automatically (see backend/.env.example).
  - The bucket has "Block all public access" ON (see README) — objects
    are private. We only ever store the S3 key, never a public URL.
"""

import logging
import os
from functools import lru_cache
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)

S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
S3_KEY_PREFIX = os.getenv("S3_FEEDBACK_PREFIX", "vision-feedback/raw")


def is_enabled() -> bool:
    """Whether S3 storage is configured for this environment."""
    return bool(S3_BUCKET_NAME)


@lru_cache(maxsize=1)
def _get_client():
    return boto3.client("s3")


def build_key(filename: str) -> str:
    return f"{S3_KEY_PREFIX}/{filename}"


def upload_bytes(filename: str, data: bytes, content_type: str) -> Optional[str]:
    """
    Upload `data` to S3 under `build_key(filename)`.

    Returns the object's `s3://bucket/key` URI on success, or None if
    S3 isn't configured or the upload failed (the caller should fall
    back to local disk storage in that case rather than losing the
    feedback entirely).
    """
    if not is_enabled():
        return None

    key = build_key(filename)

    try:
        _get_client().put_object(
            Bucket=S3_BUCKET_NAME,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
    except (BotoCoreError, ClientError):
        logger.exception("Failed to upload %s to s3://%s/%s", filename, S3_BUCKET_NAME, key)
        return None

    return f"s3://{S3_BUCKET_NAME}/{key}"


def download_bytes(key: str) -> Optional[bytes]:
    """Fetch an object's bytes back out of the configured bucket, by key."""
    if not is_enabled():
        return None

    try:
        response = _get_client().get_object(Bucket=S3_BUCKET_NAME, Key=key)
        return response["Body"].read()
    except (BotoCoreError, ClientError):
        logger.exception("Failed to download s3://%s/%s", S3_BUCKET_NAME, key)
        return None

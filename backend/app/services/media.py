"""
AWS S3 media service.

Generates pre-signed PUT URLs so clients upload directly to S3.
Files are served via CloudFront CDN (dzdr0nfpn0f2c.cloudfront.net).
Falls back gracefully when credentials are not configured (local dev).
"""
import uuid
from typing import Optional

import boto3
from botocore.exceptions import NoCredentialsError

from app.core.config import get_settings

# Allowed MIME types
_ALLOWED_IMAGE = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_ALLOWED_VIDEO = {"video/mp4", "video/quicktime", "video/webm"}
ALLOWED_CONTENT_TYPES = _ALLOWED_IMAGE | _ALLOWED_VIDEO

PRESIGN_TTL_SECONDS = 300  # 5 minutes


def _get_client():
    """Return a boto3 S3 client.
    
    Priority:
    1. Explicit credentials from .env (AWS_ACCESS_KEY_ID set)
    2. IAM Instance Role (EC2) — boto3 auto-discovers via instance metadata
    """
    settings = get_settings()
    if not settings.aws_s3_bucket:
        return None

    kwargs = {"region_name": settings.aws_region}
    # Only pass explicit credentials if set — otherwise use IAM role
    if settings.aws_access_key_id:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key

    return boto3.client("s3", **kwargs)


def build_key(purpose: str, user_id: uuid.UUID, filename: str) -> str:
    """Generate a unique S3 object key.

    Examples:
        avatars/{user_id}/{uuid}.jpg
        posts/{user_id}/{uuid}.mp4
        reels/{user_id}/{uuid}.mp4
    """
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    return f"{purpose}/{user_id}/{uuid.uuid4()}{ext}"


def cdn_url(key: str) -> str:
    """Return the public CloudFront URL for an S3 object key."""
    settings = get_settings()
    base = settings.cloudfront_url.rstrip("/")
    if base:
        return f"{base}/{key}"
    # Fallback: direct S3 URL (no CDN)
    return f"https://{settings.aws_s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{key}"


def get_presigned_upload_url(
    key: str,
    content_type: str,
    ttl: int = PRESIGN_TTL_SECONDS,
) -> Optional[str]:
    """
    Return a pre-signed PUT URL for the given S3 key.
    Client uploads directly to S3 using this URL (no backend proxy needed).
    Returns None if S3 is not configured.
    """
    client = _get_client()
    if client is None:
        return None
    try:
        return client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": get_settings().aws_s3_bucket,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=ttl,
            HttpMethod="PUT",
        )
    except NoCredentialsError:
        return None


def delete_object(key: str) -> None:
    """Delete an object from S3. Silent no-op if S3 is not configured."""
    client = _get_client()
    if client is None:
        return
    try:
        client.delete_object(Bucket=get_settings().aws_s3_bucket, Key=key)
    except Exception:
        pass

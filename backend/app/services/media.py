"""
AWS S3 media service.

Generates pre-signed PUT URLs so clients upload directly to S3.
Files are served via CloudFront CDN.
Falls back gracefully when S3 credentials are not configured (local dev).
"""
import mimetypes
import uuid
from typing import Optional

from app.core.config import get_settings

settings = get_settings()

# Allowed MIME types for direct upload
_ALLOWED_IMAGE = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_ALLOWED_VIDEO = {"video/mp4", "video/quicktime", "video/webm"}
ALLOWED_CONTENT_TYPES = _ALLOWED_IMAGE | _ALLOWED_VIDEO

PRESIGN_TTL_SECONDS = 300  # 5 minutes


def _get_client():
    """Return a boto3 S3 client, or None if not configured."""
    bucket = getattr(settings, 'aws_s3_bucket', '') or getattr(settings, 'r2_bucket_name', '')
    if not bucket:
        return None
    try:
        import boto3
        region = getattr(settings, 'aws_region', 'ap-south-1')
        return boto3.client("s3", region_name=region)
    except ImportError:
        return None


def _get_bucket() -> str:
    return getattr(settings, 'aws_s3_bucket', '') or getattr(settings, 'r2_bucket_name', '')


def _get_cloudfront_url() -> str:
    return getattr(settings, 'cloudfront_url', '') or getattr(settings, 'r2_public_url', '')


def build_key(purpose: str, user_id: uuid.UUID, filename: str) -> str:
    """Generate a unique S3 object key."""
    ext = ""
    if "." in filename:
        ext = "." + filename.rsplit(".", 1)[-1].lower()
    return f"{purpose}/{user_id}/{uuid.uuid4()}{ext}"


def cdn_url(key: str) -> str:
    """Construct the public CDN URL for an S3 key."""
    base = _get_cloudfront_url().rstrip("/")
    if base:
        return f"{base}/{key}"
    # Fallback: direct S3 URL
    bucket = _get_bucket()
    region = getattr(settings, 'aws_region', 'ap-south-1')
    if bucket:
        return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    return f"/media/{key}"


def get_presigned_upload_url(
    key: str,
    content_type: str,
    ttl: int = PRESIGN_TTL_SECONDS,
) -> Optional[str]:
    """
    Return a pre-signed PUT URL for the given key, or None if S3 is not configured.
    """
    client = _get_client()
    if client is None:
        return None
    bucket = _get_bucket()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=ttl,
        HttpMethod="PUT",
    )


def delete_object(key: str) -> None:
    """Delete an object from S3. Silent no-op if S3 is not configured."""
    client = _get_client()
    if client is None:
        return
    client.delete_object(Bucket=_get_bucket(), Key=key)

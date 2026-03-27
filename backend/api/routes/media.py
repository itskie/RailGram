from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from api.models.user import User
from app.core.deps import get_current_user
from app.schemas.social import PresignRequest, PresignResponse
from app.services.media import (
    ALLOWED_CONTENT_TYPES,
    PRESIGN_TTL_SECONDS,
    build_key,
    cdn_url,
    get_presigned_upload_url,
)

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/presign", response_model=PresignResponse)
async def presign_upload(
    body: PresignRequest,
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Request a pre-signed upload URL for Cloudflare R2.
    Client PUTs the file directly to `upload_url` using the specified content-type.
    Use the returned `key` when creating a post/story.
    """
    if body.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported content type. Allowed: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}",
        )

    key = build_key(body.purpose, current_user.id, body.filename)
    upload_url = get_presigned_upload_url(key, body.content_type)

    if upload_url is None:
        # R2 not configured — return a dev placeholder so clients can test the flow
        upload_url = f"http://localhost:8000/dev-upload/{key}"

    return PresignResponse(
        key=key,
        upload_url=upload_url,
        cdn_url=cdn_url(key),
        expires_in=PRESIGN_TTL_SECONDS,
    )

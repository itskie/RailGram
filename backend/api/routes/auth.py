from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.user import User, EmailToken, EMAIL_TOKEN_VERIFICATION, EMAIL_TOKEN_PASSWORD_RESET
from app.core.csrf import generate_csrf_token, validate_csrf_token
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_email_token,
    hash_password,
    verify_password,
)
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserMe,
    VerifyEmailRequest,
)
from app.services.email import (
    send_password_reset_email,
    send_verification_email,
    send_welcome_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _create_email_token(
    db: AsyncSession,
    user_id,
    token_type: str,
    expires_hours: int,
) -> str:
    """Delete any existing token of the same type for user, then create new one."""
    await db.execute(
        delete(EmailToken).where(
            EmailToken.user_id == user_id,
            EmailToken.type == token_type,
        )
    )
    raw_token = generate_email_token()
    email_token = EmailToken(
        user_id=user_id,
        token=raw_token,
        type=token_type,
        expires_at=_utcnow() + timedelta(hours=expires_hours),
    )
    db.add(email_token)
    await db.flush()
    return raw_token


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/csrf")
async def get_csrf_token(response: Response):
    """Fetch a CSRF token. Call this before any state-changing request."""
    token = generate_csrf_token()
    response.set_cookie(
        "csrf_token",
        token,
        httponly=False,   # JS needs to read it for double-submit
        samesite="strict",
        secure=False,     # Set True in production over HTTPS
    )
    return {"csrf_token": token}


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check uniqueness
    existing = await db.execute(
        select(User).where(
            (User.email == body.email) | (User.username == body.username)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username already registered",
        )

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    await db.flush()  # get user.id without committing

    # Create email verification token and send email in background
    token = await _create_email_token(db, user.id, EMAIL_TOKEN_VERIFICATION, expires_hours=24)
    background_tasks.add_task(send_verification_email, body.email, body.username, token)

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/verify-email", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    body: VerifyEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Mark user email as verified using a one-time token."""
    result = await db.execute(
        select(EmailToken).where(
            EmailToken.token == body.token,
            EmailToken.type == EMAIL_TOKEN_VERIFICATION,
        )
    )
    email_token = result.scalar_one_or_none()

    if not email_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    if email_token.used_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token already used")

    if email_token.expires_at.replace(tzinfo=timezone.utc) < _utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token has expired")

    # Mark user verified
    user_result = await db.execute(select(User).where(User.id == email_token.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_verified = True
    email_token.used_at = _utcnow()

    return {"message": "Email verified successfully"}


@router.post("/resend-verification", status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
async def resend_verification(
    request: Request,
    body: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Resend email verification link. Always returns 200 to avoid email enumeration."""
    result = await db.execute(
        select(User).where(User.email == body.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if user and not user.is_verified:
        token = await _create_email_token(db, user.id, EMAIL_TOKEN_VERIFICATION, expires_hours=24)
        background_tasks.add_task(send_verification_email, user.email, user.username, token)

    # Always return same message to prevent email enumeration
    return {"message": "If your account exists and is unverified, a verification email has been sent"}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send a password reset email. Always returns 200 to avoid email enumeration."""
    result = await db.execute(
        select(User).where(User.email == body.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if user:
        token = await _create_email_token(db, user.id, EMAIL_TOKEN_PASSWORD_RESET, expires_hours=1)
        background_tasks.add_task(send_password_reset_email, user.email, user.username, token)

    # Always return same message to prevent email enumeration
    return {"message": "If an account with that email exists, a password reset link has been sent"}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Reset user password using a one-time token."""
    result = await db.execute(
        select(EmailToken).where(
            EmailToken.token == body.token,
            EmailToken.type == EMAIL_TOKEN_PASSWORD_RESET,
        )
    )
    email_token = result.scalar_one_or_none()

    if not email_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    if email_token.used_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token already used")

    if email_token.expires_at.replace(tzinfo=timezone.utc) < _utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token has expired")

    user_result = await db.execute(select(User).where(User.id == email_token.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.hashed_password = hash_password(body.new_password)
    email_token.used_at = _utcnow()

    return {"message": "Password reset successfully"}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.email == body.email, User.is_active == True))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    payload = decode_token(body.refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    import uuid
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: Annotated[User, Depends(get_current_user)]):
    """
    Stateless JWT: client must discard tokens.
    Future: add token to Redis blocklist here.
    """
    return None


@router.get("/me", response_model=UserMe)
async def me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user

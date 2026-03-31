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
    UserMe,
    VerifyEmailRequest,
)
from app.services.email import (
    send_password_reset_email,
    send_verification_email,
    send_welcome_email,
)
from app.core.cache import get_redis

router = APIRouter(prefix="/auth", tags=["auth"])

# Account lockout settings
LOCKOUT_MAX_ATTEMPTS = 5  # Lock after 5 failed attempts
LOCKOUT_DURATION_MINUTES = 15  # Lock duration

# Cookie settings for httpOnly JWT storage
COOKIE_SECURE = True  # Always use HTTPS for cookies
COOKIE_SAMESITE = "lax"
ACCESS_TOKEN_MAX_AGE = 60 * 60  # 1 hour in seconds
REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60  # 30 days in seconds


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set httpOnly cookies for JWT tokens."""
    # Access token cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_MAX_AGE,
        path="/",
    )
    # Refresh token cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=REFRESH_TOKEN_MAX_AGE,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    """Clear httpOnly cookies for JWT tokens."""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")


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
        samesite="lax",
        secure=True,     # HTTPS only in production
        max_age=3600,    # 1 hour
    )
    return {"csrf_token": token}


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    response: Response,
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

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    set_auth_cookies(response, access_token, refresh_token)

    return {"message": "Registration successful"}


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
        token = await _create_email_token(db, user.id, EMAIL_TOKEN_PASSWORD_RESET, expires_hours=0.5)  # 30 minutes
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


@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    response: Response,
):
    redis = await get_redis()
    email_lower = body.email.lower()
    lockout_key = f"login_lockout:{email_lower}"
    
    # Check if account is locked
    lockout_data = await redis.get(lockout_key)
    if lockout_data:
        attempts = int(lockout_data)
        if attempts >= LOCKOUT_MAX_ATTEMPTS:
            # Get lockout expiry to tell user when to try again
            ttl = await redis.ttl(lockout_key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account locked due to too many failed attempts. Try again in {ttl // 60} minutes.",
            )
    
    result = await db.execute(select(User).where(User.email == body.email, User.is_active == True))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        # Increment failed attempt counter
        attempts = await redis.incr(lockout_key)
        if attempts == 1:
            # Set expiry on first failed attempt
            await redis.expire(lockout_key, LOCKOUT_DURATION_MINUTES * 60)
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Block login if email is not verified
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox and verify your email.",
        )

    # Reset lockout counter on successful login
    await redis.delete(lockout_key)
    
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    set_auth_cookies(response, access_token, refresh_token)

    return {"message": "Login successful"}


@router.post("/refresh")
async def refresh(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    response: Response,
):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")
    
    payload = decode_token(refresh_token)

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

    access_token = create_access_token(user.id)
    refresh_token_new = create_refresh_token(user.id)
    set_auth_cookies(response, access_token, refresh_token_new)

    return {"message": "Token refreshed successfully"}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def logout(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    response: Response,
):
    """
    Stateless JWT: client must discard tokens.
    Clear httpOnly cookies here.
    """
    clear_auth_cookies(response)
    return None


@router.delete("/delete-account", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def delete_account(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Permanently delete user account and all associated data.
    This action cannot be undone.
    """
    # Delete the user (cascade will delete posts, comments, etc.)
    await db.delete(current_user)
    await db.commit()
    return None


@router.get("/me", response_model=UserMe)
async def me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user

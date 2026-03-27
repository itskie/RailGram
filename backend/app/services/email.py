"""Email service using Resend."""
import logging
import resend
from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _init_resend() -> None:
    settings = get_settings()
    resend.api_key = settings.resend_api_key


def send_email(to: str, subject: str, html: str) -> bool:
    """Send a transactional email. Returns True on success."""
    _init_resend()
    settings = get_settings()
    try:
        resend.Emails.send({
            "from": settings.email_from,
            "to": to,
            "subject": subject,
            "html": html,
        })
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)
        return False


# ── Pre-built templates ──────────────────────────────────────────────────────

def send_verification_email(to: str, username: str, token: str) -> bool:
    settings = get_settings()
    base_url = "https://railgram.in"
    link = f"{base_url}/verify-email?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#3b82f6">Welcome to RailGram, {username}!</h2>
      <p>Verify your email address to get started.</p>
      <a href="{link}"
         style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
        Verify Email
      </a>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">
        Link expires in 24 hours. If you didn't sign up, ignore this email.
      </p>
    </div>
    """
    return send_email(to, "Verify your RailGram email", html)


def send_password_reset_email(to: str, username: str, token: str) -> bool:
    settings = get_settings()
    base_url = "https://railgram.in"
    link = f"{base_url}/reset-password?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#3b82f6">Reset your RailGram password</h2>
      <p>Hi {username}, click below to set a new password.</p>
      <a href="{link}"
         style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
        Reset Password
      </a>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">
        Link expires in 1 hour. If you didn't request this, ignore this email.
      </p>
    </div>
    """
    return send_email(to, "Reset your RailGram password", html)


def send_welcome_email(to: str, username: str) -> bool:
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#3b82f6">You're on RailGram!</h2>
      <p>Hey {username}, your account is now active. Start following trains, sharing spotting posts, and climbing the leaderboard.</p>
      <a href="https://railgram.in"
         style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
        Open RailGram
      </a>
    </div>
    """
    return send_email(to, "Welcome to RailGram!", html)

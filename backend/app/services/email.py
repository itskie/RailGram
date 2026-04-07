"""Email service using Resend — dark-themed premium templates."""
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


# ── Shared layout ────────────────────────────────────────────────────────────

def _wrap(body_html: str) -> str:
    """Wraps email body in a consistent dark-themed container."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>RailGram</title>
</head>
<body style="margin:0;padding:0;background-color:#0d0d0d;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;">
                    <div style="width:36px;height:36px;background:linear-gradient(135deg,#f97316,#ea580c);border-radius:8px;display:inline-block;text-align:center;line-height:36px;font-size:20px;">🚂</div>
                  </td>
                  <td style="font-size:22px;font-weight:700;color:#f97316;letter-spacing:-0.5px;">RailGram</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:40px 36px;">
              {body_html}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="color:#555;font-size:12px;margin:0;line-height:1.6;">
                You're receiving this email because you have an account on
                <a href="https://railgram.in" style="color:#f97316;text-decoration:none;">railgram.in</a>.<br/>
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# ── Templates ─────────────────────────────────────────────────────────────────

def send_verification_email(to: str, username: str, token: str) -> bool:
    base_url = get_settings().site_url
    link = f"{base_url}/verify-email?token={token}"
    body = f"""
      <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 8px;">Verify your email ✅</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 28px;">
        Hey <strong style="color:#fff;">{username}</strong>, welcome to RailGram!<br/>
        Click the button below to activate your account and start tracking trains.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td align="center">
            <a href="{link}"
               style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f97316,#ea580c);
                      color:#fff;border-radius:10px;text-decoration:none;font-weight:700;
                      font-size:15px;letter-spacing:0.3px;">
              Verify Email Address
            </a>
          </td>
        </tr>
      </table>

      <div style="background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
        <p style="color:#555;font-size:12px;margin:0 0 4px;">Or copy this link into your browser:</p>
        <p style="color:#f97316;font-size:12px;margin:0;word-break:break-all;">{link}</p>
      </div>

      <p style="color:#555;font-size:12px;margin:0;text-align:center;">
        ⏱ This link expires in <strong style="color:#9ca3af;">24 hours</strong>.
      </p>
    """
    return send_email(to, "Verify your RailGram email address", _wrap(body))


def send_password_reset_email(to: str, username: str, token: str) -> bool:
    base_url = get_settings().site_url
    link = f"{base_url}/reset-password?token={token}"
    body = f"""
      <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 8px;">Reset your password 🔑</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 28px;">
        Hi <strong style="color:#fff;">{username}</strong>,<br/>
        We received a request to reset your RailGram password.
        Click the button below to set a new one.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td align="center">
            <a href="{link}"
               style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f97316,#ea580c);
                      color:#fff;border-radius:10px;text-decoration:none;font-weight:700;
                      font-size:15px;letter-spacing:0.3px;">
              Reset Password
            </a>
          </td>
        </tr>
      </table>

      <div style="background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
        <p style="color:#555;font-size:12px;margin:0 0 4px;">Or copy this link into your browser:</p>
        <p style="color:#f97316;font-size:12px;margin:0;word-break:break-all;">{link}</p>
      </div>

      <div style="background:#1f1107;border:1px solid #7c2d12;border-radius:8px;padding:12px 16px;">
        <p style="color:#fb923c;font-size:12px;margin:0;">
          ⚠️ This link expires in <strong>1 hour</strong>. If you didn't request a reset, 
          your account is safe — just ignore this email.
        </p>
      </div>
    """
    return send_email(to, "Reset your RailGram password", _wrap(body))


def send_welcome_email(to: str, username: str) -> bool:
    body = f"""
      <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 8px;">You're on RailGram! 🚂</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 28px;">
        Hey <strong style="color:#fff;">{username}</strong>, your email is verified and your account is fully active.<br/>
        Start spotting trains, sharing photos, and climbing the leaderboard!
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td align="center">
            <a href="https://railgram.in"
               style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f97316,#ea580c);
                      color:#fff;border-radius:10px;text-decoration:none;font-weight:700;
                      font-size:15px;letter-spacing:0.3px;">
              Open RailGram
            </a>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="33%" align="center" style="padding:16px;background:#111;border:1px solid #2a2a2a;border-radius:10px;">
            <div style="font-size:24px;margin-bottom:6px;">🗺️</div>
            <div style="color:#fff;font-size:13px;font-weight:600;">Live Map</div>
            <div style="color:#555;font-size:11px;">Track trains in real time</div>
          </td>
          <td width="4%"></td>
          <td width="33%" align="center" style="padding:16px;background:#111;border:1px solid #2a2a2a;border-radius:10px;">
            <div style="font-size:24px;margin-bottom:6px;">📸</div>
            <div style="color:#fff;font-size:13px;font-weight:600;">Spot & Share</div>
            <div style="color:#555;font-size:11px;">Post your train sightings</div>
          </td>
          <td width="4%"></td>
          <td width="33%" align="center" style="padding:16px;background:#111;border:1px solid #2a2a2a;border-radius:10px;">
            <div style="font-size:24px;margin-bottom:6px;">🏆</div>
            <div style="color:#fff;font-size:13px;font-weight:600;">Leaderboard</div>
            <div style="color:#555;font-size:11px;">Earn karma & badges</div>
          </td>
        </tr>
      </table>
    """
    return send_email(to, "Welcome to RailGram! 🚂", _wrap(body))

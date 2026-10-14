"""SMTP transport for CareTrack emergency notification emails.

Deliberately small: stdlib ``smtplib`` only, no external mail SDK. All
connection details come from ``Settings`` (environment variables), so the
transport is a safe no-op until ``SMTP_HOST`` is configured.

Every function returns ``(ok, detail)`` instead of raising, so callers can
record the outcome directly on a ``Notification`` row without try/except
plumbing.
"""
import smtplib
from email.message import EmailMessage

from settings import get_settings


def send_smtp_mail(
    *,
    recipients: list[str],
    subject: str,
    body: str,
    host: str,
    port: int,
    username: str = "",
    password: str = "",
    use_tls: bool = True,
    from_addr: str = "",
    timeout: int = 10,
) -> tuple[bool, str]:
    """Open one SMTP session and deliver one message to all recipients."""
    if not recipients:
        return False, "No recipients"
    if not host:
        return False, "SMTP not configured (SMTP_HOST is empty)"

    msg = EmailMessage()
    msg["From"] = from_addr
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(host, port, timeout=timeout) as server:
            if use_tls:
                server.starttls()
            if username:
                server.login(username, password)
            server.send_message(msg)
    except Exception as exc:  # noqa: BLE001 - surface any transport failure to the caller
        return False, f"{type(exc).__name__}: {exc}"
    return True, "sent"


def send_alert_email(recipients: list[str], subject: str, body: str) -> tuple[bool, str]:
    """Send an emergency alert email using the configured SMTP settings."""
    settings = get_settings()
    if not settings.email_alerts_enabled:
        return False, "Email alerts disabled (EMAIL_ALERTS_ENABLED=false)"
    return send_smtp_mail(
        recipients=recipients,
        subject=subject,
        body=body,
        host=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_username,
        password=settings.smtp_password,
        use_tls=settings.smtp_use_tls,
        from_addr=settings.smtp_from,
        timeout=settings.smtp_timeout_seconds,
    )

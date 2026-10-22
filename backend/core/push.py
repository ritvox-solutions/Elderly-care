"""Expo Push Service adapter used by the emergency worker."""
from typing import Any

import httpx

from settings import get_settings

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_expo_push(
    tokens: list[str],
    *,
    title: str,
    body: str,
    data: dict[str, Any],
) -> dict[str, tuple[bool, str]]:
    """Send one high-priority alert to each token and return ticket outcomes."""
    if not tokens:
        return {}

    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    access_token = get_settings().expo_push_access_token
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "data": data,
            "sound": "default",
            "priority": "high",
            "channelId": "fall-alerts-v2",
        }
        for token in tokens
    ]
    try:
        response = httpx.post(EXPO_PUSH_URL, headers=headers, json=messages, timeout=10)
        response.raise_for_status()
        tickets = response.json().get("data", [])
    except Exception as exc:  # noqa: BLE001 - persist transport failure for operators
        detail = f"{type(exc).__name__}: {exc}"
        return {token: (False, detail) for token in tokens}

    results: dict[str, tuple[bool, str]] = {}
    for index, token in enumerate(tokens):
        ticket = tickets[index] if index < len(tickets) else {}
        ok = ticket.get("status") == "ok"
        results[token] = (ok, ticket.get("id") or ticket.get("message") or "Missing push ticket")
    return results

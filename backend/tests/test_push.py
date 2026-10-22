from core import push


class FakeResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return {
            "data": [
                {"status": "ok", "id": "ticket-1"},
                {"status": "error", "message": "DeviceNotRegistered"},
            ]
        }


def test_send_expo_push_maps_each_ticket(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        push.httpx,
        "post",
        lambda *args, **kwargs: captured.update(kwargs) or FakeResponse(),
    )

    results = push.send_expo_push(
        ["ExponentPushToken[first]", "ExponentPushToken[second]"],
        title="Fall",
        body="Help required",
        data={"type": "fall_alert"},
    )

    assert results["ExponentPushToken[first]"] == (True, "ticket-1")
    assert results["ExponentPushToken[second]"] == (False, "DeviceNotRegistered")
    assert captured["json"][0]["priority"] == "high"
    assert captured["json"][0]["channelId"] == "fall-alerts-v2"

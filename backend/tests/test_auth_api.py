def test_register_and_login_flow(client, db_session):
    # 1. Register new caregiver
    reg_payload = {
        "email": "dr.smith@caretrack.org",
        "password": "Password1234!",
        "full_name": "Dr. John Smith",
        "role": "CAREGIVER",
        "phone_number": "+1-800-555-0199",
    }
    r = client.post("/api/v1/auth/register", json=reg_payload)
    assert r.status_code == 201
    user_data = r.json()
    assert user_data["email"] == "dr.smith@caretrack.org"
    assert user_data["full_name"] == "Dr. John Smith"
    assert "hashed_password" not in user_data

    # 2. Duplicate registration should fail
    r_dup = client.post("/api/v1/auth/register", json=reg_payload)
    assert r_dup.status_code == 400

    # 3. Login with credentials
    login_payload = {
        "email": "dr.smith@caretrack.org",
        "password": "Password1234!",
    }
    r_login = client.post("/api/v1/auth/login", json=login_payload)
    assert r_login.status_code == 200
    token_data = r_login.json()
    assert "access_token" in token_data
    token = token_data["access_token"]
    assert "access_token" in r_login.cookies

    # 4. Access /api/v1/auth/me via Bearer header
    r_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r_me.status_code == 200
    assert r_me.json()["email"] == "dr.smith@caretrack.org"

    # 5. Access /api/v1/auth/me via Cookie
    client.cookies.set("access_token", f"Bearer {token}")
    r_me_cookie = client.get("/api/v1/auth/me")
    assert r_me_cookie.status_code == 200
    assert r_me_cookie.json()["email"] == "dr.smith@caretrack.org"

    # 6. Register this authenticated caregiver's phone for fall pushes
    push_token = "ExponentPushToken[demo_device_123456]"
    r_push = client.put("/api/v1/auth/push-token", json={"token": push_token})
    assert r_push.status_code == 200
    from models import User
    assert db_session.query(User).filter(User.email == reg_payload["email"]).one().expo_push_token == push_token

    # 7. Logout
    r_logout = client.post("/api/v1/auth/logout")
    assert r_logout.status_code == 200

def test_login_invalid_credentials(client):
    r = client.post("/api/v1/auth/login", json={"email": "nonexistent@caretrack.org", "password": "WrongPassword123"})
    assert r.status_code == 401


def test_demo_login_returns_database_caregiver_and_patients(client, db_session):
    response = client.post("/api/v1/auth/demo-login")

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "caregiver@caretrack.health"
    assert response.json()["user"]["role"] == "CAREGIVER"
    assert client.get("/api/v1/patients").status_code == 200
    client.cookies.clear()
    assert client.get("/api/v1/patients").status_code == 401

def test_unauthorized_access(client):
    client.cookies.clear()
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401

    r_push = client.put(
        "/api/v1/auth/push-token",
        json={"token": "ExponentPushToken[demo_device_123456]"},
    )
    assert r_push.status_code == 401

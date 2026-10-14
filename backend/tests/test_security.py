from core.security import hash_password, verify_password, create_access_token, decode_access_token
from datetime import timedelta
import time

def test_password_hashing():
    raw_pwd = "SuperSecurePassword123!"
    hashed = hash_password(raw_pwd)
    
    assert hashed != raw_pwd
    assert verify_password(raw_pwd, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False

def test_jwt_token_lifecycle():
    user_id = "11111111-2222-3333-4444-555555555555"
    role = "CAREGIVER"
    token = create_access_token(subject=user_id, role=role, expires_delta=timedelta(minutes=5))
    
    assert isinstance(token, str)
    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("sub") == user_id
    assert payload.get("role") == role

def test_jwt_token_expired():
    user_id = "test-user"
    role = "ADMIN"
    # Token that expired 1 second ago
    token = create_access_token(subject=user_id, role=role, expires_delta=timedelta(seconds=-1))
    
    payload = decode_access_token(token)
    assert payload is None

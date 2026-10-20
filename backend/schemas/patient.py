from datetime import date
import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator


class PatientCreateRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    date_of_birth: date
    gender: str | None = Field(default=None, max_length=50)
    room_number: str = Field(min_length=1, max_length=50)
    medical_notes: str | None = Field(default=None, max_length=2000)
    emergency_contact_name: str = Field(min_length=2, max_length=150)
    emergency_contact_phone: str = Field(min_length=5, max_length=50)
    emergency_contact_email: EmailStr
    room_device_id: str = Field(min_length=1, max_length=100)
    wearable_device_id: str = Field(min_length=1, max_length=100)

    @field_validator("date_of_birth")
    @classmethod
    def birth_date_cannot_be_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return value

    @field_validator(
        "first_name",
        "last_name",
        "gender",
        "room_number",
        "medical_notes",
        "emergency_contact_name",
        "emergency_contact_phone",
        "room_device_id",
        "wearable_device_id",
    )
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        return value.strip() if value else value


class PatientDirectoryResponse(BaseModel):
    id: uuid.UUID | str
    first_name: str
    last_name: str
    age: int
    gender: str
    room_number: str
    condition: str
    status: str
    room_device_id: str
    wearable_device_id: str
    vitals: dict[str, float]
    room_env: dict[str, float]

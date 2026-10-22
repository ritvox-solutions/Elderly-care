import enum

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    CAREGIVER = "CAREGIVER"
    PATIENT = "PATIENT"

class DeviceType(str, enum.Enum):
    WEARABLE = "WEARABLE"
    ROOM_KIT = "ROOM_KIT"

class DeviceStatus(str, enum.Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    UNPAIRED = "UNPAIRED"

class AlertSeverity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"

class AlertCategory(str, enum.Enum):
    FALL = "FALL"
    CARDIAC = "CARDIAC"
    ENVIRONMENT = "ENVIRONMENT"
    DEVICE_OFFLINE = "DEVICE_OFFLINE"

class AlertStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"

class NotificationChannel(str, enum.Enum):
    IN_APP = "IN_APP"
    EMAIL = "EMAIL"
    PUSH = "PUSH"
    BROWSER = "BROWSER"

class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"

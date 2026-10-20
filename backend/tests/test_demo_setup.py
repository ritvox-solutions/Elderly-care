from models import Device, DevicePairing
from setup_demo_devices import DEMO_DEVICES, setup_demo_devices


def test_setup_demo_devices_is_idempotent(db_session):
    first = setup_demo_devices(db_session)
    second = setup_demo_devices(db_session)

    assert second.id == first.id
    assert {device.device_identifier for device in db_session.query(Device).all()} == {
        identifier for identifier, _ in DEMO_DEVICES
    }
    assert db_session.query(DevicePairing).count() == 2

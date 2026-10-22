from models import CaregiverAssignment, Device, DevicePairing, Patient, User
from setup_demo_devices import DEMO_DEVICES, setup_demo_data, setup_demo_devices


def test_setup_demo_devices_is_idempotent(db_session):
    first = setup_demo_devices(db_session)
    second = setup_demo_devices(db_session)

    assert second.id == first.id
    assert {device.device_identifier for device in db_session.query(Device).all()} == {
        identifier for identifier, _ in DEMO_DEVICES
    }
    assert db_session.query(DevicePairing).count() == len(DEMO_DEVICES)


def test_setup_demo_data_creates_real_directory_and_caregiver(db_session):
    caregiver, patients = setup_demo_data(db_session)
    again, repeated = setup_demo_data(db_session)

    assert again.id == caregiver.id
    assert len(patients) == len(repeated) == 3
    assert db_session.query(User).filter_by(email="caregiver@caretrack.health").count() == 1
    assert db_session.query(Patient).count() == 3
    assert db_session.query(CaregiverAssignment).count() == 3


def test_demo_login_setup_does_not_repair_deleted_patients(db_session):
    _, patients = setup_demo_data(db_session)
    deleted = patients[0]
    deleted.is_active = False
    for pairing in deleted.device_pairings:
        pairing.is_active = False
    db_session.commit()

    setup_demo_data(db_session)

    assert deleted.is_active is False
    assert db_session.query(DevicePairing).filter_by(patient_id=deleted.id, is_active=True).count() == 0

"""add patient emergency contact email

Revision ID: 6b770ecf365a
Revises: e0b95b00f838
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6b770ecf365a"
down_revision: Union[str, Sequence[str], None] = "e0b95b00f838"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("patients", sa.Column("emergency_contact_email", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("patients", "emergency_contact_email")

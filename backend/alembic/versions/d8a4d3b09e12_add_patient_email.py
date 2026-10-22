"""add patient email

Revision ID: d8a4d3b09e12
Revises: c4f10f8a7201
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d8a4d3b09e12"
down_revision: Union[str, Sequence[str], None] = "c4f10f8a7201"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("patients", sa.Column("email", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("patients", "email")

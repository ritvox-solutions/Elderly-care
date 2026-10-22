"""add user expo push token

Revision ID: c4f10f8a7201
Revises: 6b770ecf365a
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4f10f8a7201"
down_revision: Union[str, Sequence[str], None] = "6b770ecf365a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("expo_push_token", sa.String(length=255), nullable=True))
    op.create_unique_constraint("uq_users_expo_push_token", "users", ["expo_push_token"])


def downgrade() -> None:
    op.drop_constraint("uq_users_expo_push_token", "users", type_="unique")
    op.drop_column("users", "expo_push_token")

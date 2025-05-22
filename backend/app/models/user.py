from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from backend.app.models.tracked_product import TrackedProduct


class User(SQLModel, table=True):
    __tablename__ = "users"  # type: ignore

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password: str
    name: str = Field(index=True)

    tracked_products: list["TrackedProduct"] = Relationship(
        back_populates="issued_by",
        sa_relationship_kwargs={"cascade": "all, delete"},
    )

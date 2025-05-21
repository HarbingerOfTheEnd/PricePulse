from sqlmodel import Field, Relationship, SQLModel

from backend.app.models.user import User


class TrackedProduct(SQLModel, table=True):
    __tablename__ = "tracked_products"  # type: ignore

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    amazon_url: str = Field(index=True)

    issued_by_id: int | None = Field(default=None, foreign_key="users.id")
    issued_by: User | None = Relationship(back_populates="tracked_products")

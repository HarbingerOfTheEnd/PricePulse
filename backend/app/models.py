from datetime import datetime
from sqlmodel import Field, Relationship, SQLModel


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


class TrackedProduct(SQLModel, table=True):
    __tablename__ = "tracked_products"  # type: ignore

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    amazon_url: str = Field(index=True)

    issued_by_id: int | None = Field(default=None, foreign_key="users.id")
    issued_by: User | None = Relationship(back_populates="tracked_products")

    product_prices: list["ProductPrice"] = Relationship(back_populates="product")


class ProductPrice(SQLModel, table=True):
    __tablename__ = "product_prices"  # type: ignore

    id: int | None = Field(default=None, primary_key=True)
    price: float
    price_at: datetime

    product_id: int = Field(foreign_key="tracked_products.id")
    product: TrackedProduct | None = Relationship(back_populates="product_prices")

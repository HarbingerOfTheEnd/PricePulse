from sqlmodel import Field, Relationship, SQLModel

from backend.app.models.tracked_product import TrackedProduct


class ProductPrice(SQLModel, table=True):
    __tablename__ = "product_prices"  # type: ignore

    id: int | None = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="tracked_products.id")
    price: float
    currency: str
    product: TrackedProduct | None = Relationship(back_populates="prices")

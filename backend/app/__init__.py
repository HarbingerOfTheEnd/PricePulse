import os
from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager
from datetime import datetime
from json import dumps
from typing import Annotated, Any
from urllib.parse import quote_plus

from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore  # type: ignore
from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore
from apscheduler.triggers.interval import IntervalTrigger  # type: ignore
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request, Response
from fastapi.responses import StreamingResponse
from httpx import AsyncClient
from pydantic import BaseModel, HttpUrl
from sqlmodel import Session, SQLModel, create_engine, select

from backend.app.models.tracked_product import TrackedProduct
from backend.app.models.user import User

load_dotenv()


@asynccontextmanager
async def lifespan(_: FastAPI):
    scheduler.start()
    SQLModel.metadata.create_all(engine)
    yield
    scheduler.shutdown()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


class _Product(BaseModel):
    name: str
    product_url: HttpUrl
    issued_by_id: int


host = os.environ.get("PG_HOST", "localhost")
port = os.environ.get("PG_PORT", "5432")
user = os.environ.get("PG_USER", "postgres")
password = os.environ.get("PG_PASSWORD", "postgres")
database = os.environ.get("PG_DATABASE", "postgres")
url = f"postgresql+psycopg2://{user}:{quote_plus(password)}@{host}:{port}/{database}"

jobstores = {"default": SQLAlchemyJobStore(url=url)}
app = FastAPI(lifespan=lifespan)
scheduler = AsyncIOScheduler(jobstores=jobstores)

engine = create_engine(
    url,
    echo=os.environ.get("DEBUG", "false").lower() == "true",
    future=True,
)


SessionDependency = Annotated[Session, Depends(get_session)]


async def fetch_price(url: str, product_id: int, api_response: dict[str, Any]) -> None:
    async with AsyncClient() as client:
        try:
            response = await client.get(url)
            soup = BeautifulSoup(response.text, "html.parser")
            price_span = soup.select_one("span.a-price-whole")
            if price_span:
                price = float(price_span.text.strip())
                api_response["price"] = price
        except Exception as e:
            api_response["error"] = str(e)


@app.post("/signup")
async def signup(
    user: User,
    session: SessionDependency,
    response: Response,
) -> dict[str, Any]:
    session.add(user)
    session.commit()
    session.refresh(user)

    response.status_code = 201

    return {"message": "User created successfully", "user_id": user.id}


@app.get("/signin")
async def signin(
    user: User,
    session: SessionDependency,
    response: Response,
) -> dict[str, str]:
    db_user = session.exec(select(User).where(User.email == user.email)).first()

    if db_user and db_user.password == user.password:
        response.status_code = 200
        return {"message": "Login successful"}

    response.status_code = 401
    return {"message": "Invalid credentials"}


@app.post("/track-product")
async def track_product(
    request: _Product,
    session: SessionDependency,
    response: Response,
) -> dict[str, Any]:
    url = request.product_url
    name = request.name
    issued_by_id = request.issued_by_id

    product = TrackedProduct(amazon_url=str(url), issued_by_id=issued_by_id, name=name)
    session.add(product)
    session.commit()
    session.refresh(product)

    response.status_code = 201
    return {"message": "Product tracked successfully", "id": product.id}


@app.get("/track-price")
async def track_price(
    product_id: int,
    user_id: int,
    session: SessionDependency,
    request: Request,
) -> StreamingResponse:
    product = session.exec(
        select(TrackedProduct).where(
            TrackedProduct.id == product_id and TrackedProduct.issued_by_id == user_id
        )
    ).first()

    if not product:

        def invalid_product() -> Generator[str, None, None]:
            yield "Product not found"

        return StreamingResponse(invalid_product(), media_type="text/plain")

    api_response: dict[str, Any] = {
        "product_id": product.id,
        "name": product.name,
        "amazon_url": product.amazon_url,
    }

    scheduler.add_job(  # type: ignore
        func=fetch_price,  # type: ignore
        args=(product.amazon_url, product.id, api_response),
        trigger=IntervalTrigger(seconds=10),
        next_run_time=datetime.now(),
        replace_existing=True,
        id=f"fetch_{product.id}_{user_id}",
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        while True:
            if await request.is_disconnected():
                scheduler.remove_job(f"fetch_{product.id}_{user_id}", "default")  # type: ignore
                break

            yield dumps(api_response) + "\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

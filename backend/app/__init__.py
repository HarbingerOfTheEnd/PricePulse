import os
from asyncio import Lock, Queue, sleep, wait_for
from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager
from datetime import datetime
from json import JSONDecodeError, dumps, loads
from typing import Annotated, Any, Sequence
from urllib.parse import quote_plus
from uuid import uuid4

from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore  # type: ignore
from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore
from apscheduler.triggers.interval import IntervalTrigger  # type: ignore
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from httpx import AsyncClient
from pydantic import BaseModel
from sqlmodel import Session, SQLModel, create_engine, select

from backend.app.models import ProductPrice, TrackedProduct, User

load_dotenv()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    scheduler.start()
    SQLModel.metadata.create_all(engine)
    yield
    scheduler.shutdown()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


class _Product(BaseModel):
    product_url: str
    issued_by_id: int


host = os.environ.get("PG_HOST", "localhost")
port = os.environ.get("PG_PORT", "5432")
user = os.environ.get("PG_USER", "postgres")
password = os.environ.get("PG_PASSWORD", "postgres")
database = os.environ.get("PG_DATABASE", "postgres")
url = f"postgresql+psycopg2://{user}:{quote_plus(password)}@{host}:{port}/{database}"

jobstores = {"default": SQLAlchemyJobStore(url=url)}
app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
scheduler = AsyncIOScheduler(jobstores=jobstores)
active_connections: dict[str, Queue[dict[str, Any]]] = {}
latest_price_data: dict[tuple[int, int], dict[str, Any]] = {}
connection_lock = Lock()

engine = create_engine(
    url,
    echo=False,
    future=True,
)
SessionDependency = Annotated[Session, Depends(get_session)]


def schedule_price_fetch(product_id: int, user_id: int, product_url: str) -> None:
    job_id = f"price_fetch_{product_id}_{user_id}"

    if not scheduler.get_job(job_id):  # type: ignore
        scheduler.add_job(  # type: ignore
            broadcast_price_update,
            trigger=IntervalTrigger(minutes=30),
            args=[product_id, user_id, product_url],
            id=job_id,
            replace_existing=True,
            next_run_time=datetime.now(),
        )
        print(f"Scheduled job {job_id} to run every 30 minutes")


async def broadcast_price_update(
    product_id: int,
    user_id: int,
    product_url: str,
) -> None:
    print(
        f"Fetching price for product {product_id}, user {user_id} at {datetime.now()}"
    )

    price_data = await fetch_price_data(product_id, user_id, product_url)

    latest_price_data[(product_id, user_id)] = price_data

    async with connection_lock:
        connections_to_remove: list[str] = []
        for connection_id, queue in active_connections.items():
            try:
                await queue.put(price_data)
                print(f"Sent data to connection {connection_id}")
            except Exception as e:
                print(f"Failed to send to connection {connection_id}: {e}")
                connections_to_remove.append(connection_id)

        for conn_id in connections_to_remove:
            active_connections.pop(conn_id, None)


async def event_generator(
    request: Request,
    session: Session,
    connection_id: str,
    product_id: int,
    user_id: int,
) -> AsyncGenerator[str, None]:
    try:
        yield f"data: {dumps({'type': 'connected', 'connection_id': connection_id, 'timestamp': datetime.now().isoformat()})}\n\n"

        if (product_id, user_id) in latest_price_data:
            initial_data = latest_price_data[(product_id, user_id)]
            initial_data["type"] = "price_data"
            yield f"data: {dumps(initial_data)}\n\n"

        last_keepalive = datetime.now()

        while True:
            if await request.is_disconnected():
                print(f"Client disconnected: {connection_id}")
                break

            try:
                message_queue = active_connections.get(connection_id)
                if not message_queue:
                    break

                try:
                    data = await wait_for(message_queue.get(), timeout=30.0)
                    data["type"] = "price_data"
                    price = ProductPrice(
                        product_id=product_id,
                        price=data["price"],
                        price_at=datetime.now(),
                    )
                    session.add(price)
                    session.commit()
                    data["name"] = price.product.name
                    yield f"data: {dumps(data)}\n\n"
                    last_keepalive = datetime.now()

                except TimeoutError:
                    now = datetime.now()
                    if (now - last_keepalive).total_seconds() >= 30:
                        keepalive_data = {
                            "type": "keepalive",
                            "timestamp": now.isoformat(),
                            "next_update_in": "30 minutes from last price update",
                        }
                        yield f"data: {dumps(keepalive_data)}\n\n"
                        last_keepalive = now

                    await sleep(1)

            except Exception as e:
                print(f"Error in event stream: {e}")
                error_data = {
                    "type": "error",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat(),
                }
                yield f"data: {dumps(error_data)}\n\n"
                break

    finally:
        async with connection_lock:
            active_connections.pop(connection_id, None)


async def fetch_price_data(
    product_id: int,
    user_id: int,
    product_url: str,
) -> dict[str, Any]:
    try:
        async with AsyncClient(timeout=30.0) as client:
            user_agents = [
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
            ]

            headers = {
                "User-Agent": user_agents[product_id % len(user_agents)],
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Cache-Control": "max-age=0",
            }

            response = await client.get(
                product_url,
                headers=headers,
                follow_redirects=True,
            )
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            price_selectors = [
                "span.a-price-whole",
                "span#priceblock_dealprice",
                "span#priceblock_ourprice",
                "span.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen",
                "span.a-price .a-offscreen",
                "span.a-price-range .a-price .a-offscreen",
                ".a-price .a-offscreen",
                "span.a-price-whole.a-color-price",
                "td.a-color-price.a-size-medium",
                ".a-price-whole",
                "span[data-a-size='xl'] .a-price-whole",
                "#price_inside_buybox",
                ".sx-price-whole",
                ".a-size-medium.a-color-price",
                "span.a-size-base.a-color-price",
                ".a-color-price.header-price",
                ".a-price-lg .a-price-whole",
                "span.a-size-large.a-color-price",
                'script[type="application/ld+json"]',
            ]

            price = None
            used_selector = None

            for selector in price_selectors:
                try:
                    if selector == 'script[type="application/ld+json"]':
                        price = extract_price_from_json_ld(soup)
                        if price:
                            used_selector = "JSON-LD"
                            break
                    else:
                        elements = soup.select(selector)
                        for element in elements:
                            price_text = element.get_text(strip=True).replace(",", "")
                            extracted_price = float(price_text)
                            if extracted_price:
                                price = extracted_price
                                used_selector = selector
                                break
                        if price:
                            break
                except Exception as e:
                    print(f"Error with selector {selector}: {e}")
                    continue

            if price:
                return {
                    "product_id": product_id,
                    "user_id": user_id,
                    "price": price,
                    "selector_used": used_selector,
                    "timestamp": datetime.now().isoformat(),
                    "status": "success",
                }
            else:
                # Log the HTML for debugging (first 1000 chars)
                html_snippet = (
                    response.text[:1000] if len(response.text) > 1000 else response.text
                )
                return {
                    "product_id": product_id,
                    "user_id": user_id,
                    "error": "Price not found with any selector",
                    "html_snippet": html_snippet,
                    "timestamp": datetime.now().isoformat(),
                    "status": "error",
                }

    except Exception as e:
        return {
            "product_id": product_id,
            "user_id": user_id,
            "error": f"Request failed: {str(e)}",
            "timestamp": datetime.now().isoformat(),
            "status": "error",
        }


def extract_price_from_json_ld(soup: BeautifulSoup) -> float | None:
    try:
        scripts = soup.find_all("script", {"type": "application/ld+json"})

        for script in scripts:
            try:
                data = loads(script.string)  # type: ignore

                if isinstance(data, list):
                    for item in data:  # type: ignore
                        price = extract_price_from_json_object(item)
                        if price:
                            return price
                else:
                    price = extract_price_from_json_object(data)
                    if price:
                        return price
            except JSONDecodeError:
                continue

    except Exception as e:
        print(f"Error extracting JSON-LD price: {e}")

    return None


def extract_price_from_json_object(obj: Any) -> float | None:
    if isinstance(obj, dict):
        price_fields = ["price", "lowPrice", "highPrice", "value"]
        for field in price_fields:
            if field in obj:
                price_value = obj[field]  # type: ignore
                if isinstance(price_value, (int, float)):
                    return float(price_value)
                elif isinstance(price_value, str):
                    extracted = float(price_value)
                    if extracted:
                        return extracted

        if "offers" in obj:
            offers = obj["offers"]  # type: ignore
            if isinstance(offers, list):
                for offer in offers:  # type: ignore
                    price = extract_price_from_json_object(offer)
                    if price:
                        return price
            elif isinstance(offers, dict):
                price = extract_price_from_json_object(offers)
                if price:
                    return price

        for value in obj.values():  # type: ignore
            if isinstance(value, (dict, list)):
                price = extract_price_from_json_object(value)
                if price:
                    return price

    elif isinstance(obj, list):
        for item in obj:  # type: ignore
            price = extract_price_from_json_object(item)
            if price:
                return price

    return None


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


@app.post("/signin")
async def signin(
    user: User,
    session: SessionDependency,
    response: Response,
) -> dict[str, Any]:
    db_user = session.exec(select(User).where(User.email == user.email)).first()

    if db_user and db_user.password == user.password:
        response.status_code = 200
        return {"message": "Login successful", "user_id": db_user.id}

    response.status_code = 401
    return {"message": "Invalid credentials"}


async def get_product_name(amazon_url: str) -> str:
    async with AsyncClient() as client:
        response = await client.get(amazon_url)
        soup = BeautifulSoup(response.text, "html.parser")
        title_tag = soup.select_one("span#productTitle")
        if title_tag:
            return title_tag.get_text(strip=True)
    return "Unknown Product"


@app.post("/track-product")
async def track_product(
    request: _Product,
    session: SessionDependency,
    response: Response,
) -> dict[str, Any]:
    url = request.product_url
    issued_by_id = request.issued_by_id

    name = await get_product_name(url)

    product = TrackedProduct(amazon_url=str(url), issued_by_id=issued_by_id, name=name)
    session.add(product)
    session.commit()
    session.refresh(product)

    response.status_code = 201
    return {"message": "Product tracked successfully", "id": product.id}


@app.delete("/products/{product_id}")
async def delete_product(
    product_id: int,
    user_id: int,
    session: SessionDependency,
) -> dict[str, str]:
    product = session.exec(
        select(TrackedProduct).where(
            TrackedProduct.id == product_id and TrackedProduct.issued_by_id == user_id
        )
    ).first()

    if not product:
        return {"message": "Product not found"}

    session.delete(product)
    session.commit()

    return {"message": "Product deleted successfully"}


@app.get("/products")
async def get_products(
    user_id: int,
    session: SessionDependency,
) -> Sequence[TrackedProduct]:
    products = session.exec(
        select(TrackedProduct).where(TrackedProduct.issued_by_id == user_id)
    ).all()
    return products


@app.get("/products/{product_id}")
async def get_product(
    product_id: int,
    user_id: int,
    session: SessionDependency,
) -> TrackedProduct | dict[str, str]:
    product = session.exec(
        select(TrackedProduct).where(
            TrackedProduct.id == product_id and TrackedProduct.issued_by_id == user_id
        )
    ).first()

    if not product:
        return {"message": "Product not found"}

    return product


@app.get("/prices")
async def get_prices(
    product_id: int,
    user_id: int,
    session: SessionDependency,
) -> Sequence[ProductPrice] | dict[str, str]:
    prices = session.exec(
        select(ProductPrice).where(
            ProductPrice.product_id == product_id
            and ProductPrice.product.issued_by_id == user_id
        )
    ).all()

    if not prices:
        return {"message": "No prices found for this product"}

    return prices


@app.get("/track-price", response_model=None)
async def track_price(
    product_id: int,
    user_id: int,
    session: SessionDependency,
    request: Request,
) -> StreamingResponse | dict[str, str]:
    product = session.exec(
        select(TrackedProduct).where(
            TrackedProduct.id == product_id and TrackedProduct.issued_by_id == user_id
        )
    ).first()

    if not product:
        return {"message": "Product not found"}

    connection_id = str(uuid4())

    message_queue = Queue[dict[str, Any]]()

    async with connection_lock:
        active_connections[connection_id] = message_queue

    schedule_price_fetch(product_id, user_id, product.amazon_url)

    return StreamingResponse(
        event_generator(
            request,
            session,
            connection_id,
            product_id,
            user_id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )

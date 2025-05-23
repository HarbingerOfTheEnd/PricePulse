import os

if os.name != "nt":
    import uvloop

    uvloop.install()

from uvicorn import run


def main() -> None:
    env = os.getenv("ENV", "production")
    if env == "development":
        app = "backend.app:app"
    else:
        from backend.app import app

    run(app, host="0.0.0.0", port=8000, reload=env == "development")


if __name__ == "__main__":
    main()

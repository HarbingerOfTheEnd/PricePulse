import os

if os.name != "nt":
    import uvloop

    uvloop.install()

from uvicorn import run


def main() -> None:
    env = os.getenv("ENV", "production")
    if env == "development":
        from backend.app import app
    else:
        app = "backend.app:app"
    run(app, host="0.0.0.0", port=8000, reload=env == "development")


if __name__ == "__main__":
    main()

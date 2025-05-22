import os

if os.name != "nt":
    import uvloop

    uvloop.install()

from uvicorn import run


def main() -> None:
    run("backend.app:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()

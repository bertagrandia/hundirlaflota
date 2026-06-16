import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    CORS_ORIGINS: list = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:4200").split(",")]
    ROOM_WAITING_TIMEOUT_SECONDS: int = int(os.getenv("ROOM_WAITING_TIMEOUT_SECONDS", "60"))


settings = Settings()

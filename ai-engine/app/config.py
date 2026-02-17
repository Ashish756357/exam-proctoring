from pydantic import BaseModel, Field


class Settings(BaseModel):
    log_level: str = Field(default="INFO")


def get_settings() -> Settings:
    return Settings()

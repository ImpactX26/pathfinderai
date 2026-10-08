from pydantic import BaseModel, Field


class AgentQuery(BaseModel):
    query: str = Field(min_length=2, max_length=2000)
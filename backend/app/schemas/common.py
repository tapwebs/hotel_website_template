from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationMetadata(BaseModel):
    total_items: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_prev: bool


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    pagination: PaginationMetadata


class SuccessResponse(BaseModel):
    success: bool = True
    message: str = "Operation completed successfully"

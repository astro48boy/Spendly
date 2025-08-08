"""Chat-related Pydantic schemas."""

from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from .expense import Expense


class ChatMessage(BaseModel):
    """Schema for chat message input."""
    message: str
    group_id: int


class ChatMessageCreate(BaseModel):
    """Schema for creating a new chat message."""
    message: str


class ChatMessageDb(BaseModel):
    """Schema for chat message database storage."""
    message: str
    group_id: int
    user_id: int


class ChatMessageResponse(BaseModel):
    """Schema for chat message response."""
    id: int
    group_id: int
    user_id: int
    user_name: str
    message: str
    message_type: str
    expense_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    """Schema for chat history response."""
    messages: List[ChatMessageResponse]


class ChatResponse(BaseModel):
    """Schema for chat operation response."""
    success: bool
    message: str
    expense: Optional[Expense] = None

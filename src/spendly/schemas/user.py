"""User-related Pydantic schemas."""

from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime


class UserBase(BaseModel):
    """Base user schema with common fields."""
    name: str
    email: str


class UserCreate(UserBase):
    """Schema for user creation."""
    password: str


class UserLogin(BaseModel):
    """Schema for user login."""
    email: str
    password: str


class User(UserBase):
    """Schema for user response."""
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserAuth(BaseModel):
    """Schema for authentication response."""
    access_token: str
    token_type: str
    user: User

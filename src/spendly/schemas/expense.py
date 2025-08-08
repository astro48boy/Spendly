"""Expense-related Pydantic schemas."""

from __future__ import annotations
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ExpenseBase(BaseModel):
    """Base expense schema with common fields."""
    description: str
    amount: float
    paid_by: int
    group_id: int


class ExpenseCreate(BaseModel):
    """Schema for expense creation via natural language."""
    message: str  # Natural language message
    group_id: int
    user_id: int  # User who sent the message


class ExpenseRequest(BaseModel):
    """Schema for expense processing request."""
    message: str
    group_id: int


class Expense(ExpenseBase):
    """Schema for expense response."""
    id: int
    original_message: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class ExpenseBreakdown(BaseModel):
    """Schema for user expense breakdown."""
    user_id: int
    user_name: str
    total_paid: float
    total_owed: float
    balance: float  # Positive means they should receive money, negative means they owe money

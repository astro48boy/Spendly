"""Group-related Pydantic schemas."""

from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional, TYPE_CHECKING
from datetime import datetime

# Import ExpenseBreakdown directly to avoid forward reference issues
from .expense import ExpenseBreakdown


class GroupBase(BaseModel):
    """Base group schema with common fields."""
    name: str
    description: Optional[str] = None


class GroupCreate(GroupBase):
    """Schema for group creation."""
    member_emails: List[str] = []


class GroupMember(BaseModel):
    """Schema for group member."""
    id: int
    name: str
    email: str
    
    class Config:
        from_attributes = True


class Group(GroupBase):
    """Schema for group response."""
    id: int
    created_at: datetime
    members: Optional[List[GroupMember]] = []
    
    class Config:
        from_attributes = True


class GroupMemberAdd(BaseModel):
    """Schema for adding a member to a group."""
    user_email: str


class GroupBreakdown(BaseModel):
    """Schema for group expense breakdown."""
    group_id: int
    group_name: str
    total_expenses: float
    user_breakdowns: List[ExpenseBreakdown]


class SettleDebt(BaseModel):
    """Schema for settling debt between group members."""
    group_id: int
    payer_id: int
    payee_id: int
    payer_name: str
    payee_name: str
    amount: float

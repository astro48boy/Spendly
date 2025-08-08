"""User model definition."""

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from .base import Base


class User(Base):
    """User model for authentication and identification."""
    
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    expenses_paid = relationship("Expense", foreign_keys="Expense.paid_by", back_populates="payer")
    group_memberships = relationship("GroupMember", back_populates="user")
    expense_splits = relationship("ExpenseSplit", back_populates="user")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', name='{self.name}')>"

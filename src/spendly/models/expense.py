"""Expense and ExpenseSplit model definitions."""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from .base import Base


class Expense(Base):
    """Expense model for tracking shared expenses."""
    
    __tablename__ = "expenses"
    
    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, index=True)
    amount = Column(Float)
    paid_by = Column(Integer, ForeignKey("users.id"))
    group_id = Column(Integer, ForeignKey("groups.id"))
    original_message = Column(Text)  # Store the original chat message
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    payer = relationship("User", foreign_keys=[paid_by], back_populates="expenses_paid")
    group = relationship("Group", back_populates="expenses")
    splits = relationship("ExpenseSplit", back_populates="expense")

    def __repr__(self) -> str:
        return f"<Expense(id={self.id}, description='{self.description}', amount={self.amount})>"


class ExpenseSplit(Base):
    """Model for tracking how expenses are split among users."""
    
    __tablename__ = "expense_splits"
    
    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float)  # Amount this user owes
    
    # Relationships
    expense = relationship("Expense", back_populates="splits")
    user = relationship("User", back_populates="expense_splits")

    def __repr__(self) -> str:
        return f"<ExpenseSplit(expense_id={self.expense_id}, user_id={self.user_id}, amount={self.amount})>"

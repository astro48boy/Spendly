"""Chat message model definition."""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from .base import Base


class ChatMessage(Base):
    """Chat message model for storing conversation history."""
    
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text)
    message_type = Column(String, default="text")  # "text", "expense", "system"
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    group = relationship("Group")
    user = relationship("User")
    expense = relationship("Expense")

    def __repr__(self) -> str:
        return f"<ChatMessage(id={self.id}, group_id={self.group_id}, message_type='{self.message_type}')>"

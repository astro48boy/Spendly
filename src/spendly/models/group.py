"""Group and GroupMember model definitions."""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from .base import Base


class Group(Base):
    """Group model for organizing users and expenses."""
    
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    members = relationship("GroupMember", back_populates="group")
    expenses = relationship("Expense", back_populates="group")

    def __repr__(self) -> str:
        return f"<Group(id={self.id}, name='{self.name}')>"


class GroupMember(Base):
    """Association table for group membership."""
    
    __tablename__ = "group_members"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    joined_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    group = relationship("Group", back_populates="members")
    user = relationship("User", back_populates="group_memberships")

    def __repr__(self) -> str:
        return f"<GroupMember(group_id={self.group_id}, user_id={self.user_id})>"

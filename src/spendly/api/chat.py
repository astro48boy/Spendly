"""Chat endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from ..core.database import get_db
from ..schemas.chat import ChatMessageCreate, ChatMessageResponse, ChatHistoryResponse
from ..schemas.user import User
from ..services.crud import CRUDService
from .auth import get_current_active_user

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/groups/{group_id}/send-message")
async def send_chat_message(
    group_id: int, 
    message: ChatMessageCreate, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Send a regular chat message (not an expense)."""
    
    # Save the chat message
    CRUDService.create_chat_message(
        db=db,
        group_id=group_id,
        user_id=current_user.id,
        message=message.message,
        message_type="text"
    )
    
    return {"message": "Message sent successfully"}


@router.get("/groups/{group_id}/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    group_id: int, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Get chat history for a group."""
    
    messages = CRUDService.get_chat_messages(db, group_id)
    
    message_responses = []
    for message in reversed(messages):  # Reverse to get chronological order
        user_obj = CRUDService.get_user_by_id(db, message.user_id)  # Fixed: use get_user_by_id
        user_name = user_obj.name if user_obj else "Unknown User"
        
        message_responses.append(ChatMessageResponse(
            id=message.id,
            group_id=message.group_id,
            user_id=message.user_id,
            user_name=user_name,
            message=message.message,
            message_type=message.message_type,
            expense_id=message.expense_id,
            created_at=message.created_at
        ))
    
    return ChatHistoryResponse(messages=message_responses)

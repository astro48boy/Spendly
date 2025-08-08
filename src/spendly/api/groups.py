"""Group management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..core.database import get_db
from ..schemas.group import GroupCreate, Group, GroupMemberAdd, GroupBreakdown, SettleDebt
from ..schemas.user import User
from ..services.crud import CRUDService
from .auth import get_current_active_user

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("/", response_model=Group)
async def create_group(
    group: GroupCreate, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Create a new group."""
    db_group = CRUDService.create_group(db, group, current_user.id)
    
    # Format group with member data (same as get_group endpoint)
    group_dict = {
        "id": db_group.id,
        "name": db_group.name,
        "description": db_group.description,
        "created_at": db_group.created_at,
        "members": [
            {
                "id": member.user.id,
                "name": member.user.name,
                "email": member.user.email
            }
            for member in db_group.members if member.user
        ]
    }
    
    return Group(**group_dict)


@router.get("/", response_model=List[Group])
async def get_groups(
    skip: int = 0, 
    limit: int = 100, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Get all groups."""
    groups = CRUDService.get_groups(db, skip=skip, limit=limit)
    
    # Format groups with member data
    formatted_groups = []
    for group in groups:
        group_dict = {
            "id": group.id,
            "name": group.name,
            "description": group.description,
            "created_at": group.created_at,
            "members": [
                {
                    "id": member.user.id,
                    "name": member.user.name,
                    "email": member.user.email
                }
                for member in group.members if member.user
            ]
        }
        formatted_groups.append(Group(**group_dict))
    
    return formatted_groups


@router.get("/{group_id}", response_model=Group)
async def get_group(
    group_id: int, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Get a specific group by ID."""
    group = CRUDService.get_group(db, group_id)
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    
    # Format group with member data
    group_dict = {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "created_at": group.created_at,
        "members": [
            {
                "id": member.user.id,
                "name": member.user.name,
                "email": member.user.email
            }
            for member in group.members if member.user
        ]
    }
    
    return Group(**group_dict)


@router.get("/{group_id}/breakdown", response_model=GroupBreakdown)
async def get_group_breakdown(
    group_id: int, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Get expense breakdown for a group."""
    try:
        breakdown = CRUDService.get_group_breakdown(db, group_id)
        return breakdown
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{group_id}/expenses")
async def get_group_expenses(
    group_id: int, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Get all expenses for a specific group."""
    from ..schemas.expense import Expense
    
    expenses = CRUDService.get_group_expenses(db, group_id)
    return [Expense.from_orm(expense) for expense in expenses]


@router.post("/{group_id}/members")
async def add_group_member(
    group_id: int,
    member: GroupMemberAdd,
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Add a member to a group."""
    success = CRUDService.add_user_to_group(db, group_id, member.user_email)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not add user to group"
        )
    return {"message": "User added to group successfully"}


# Add alias endpoint that frontend expects
@router.post("/{group_id}/add-member")
async def add_group_member_alias(
    group_id: int,
    member: GroupMemberAdd,
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Add a member to a group (frontend alias)."""
    return await add_group_member(group_id, member, current_user, db)


# Add chat endpoints that frontend expects
@router.get("/{group_id}/messages")
async def get_group_messages(
    group_id: int, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Get chat messages for a group (frontend alias)."""
    from ..services.crud import CRUDService
    from ..schemas.chat import ChatHistoryResponse, ChatMessageResponse
    
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
            created_at=message.created_at  # Fixed: use created_at instead of timestamp
        ))
    
    return ChatHistoryResponse(
        messages=message_responses
    )


@router.post("/{group_id}/send-message")
async def send_group_message(
    group_id: int, 
    message_data: dict,
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Send a message to a group (frontend alias)."""
    from ..schemas.chat import ChatMessageCreate
    from ..services.crud import CRUDService
    
    message = ChatMessageCreate(message=message_data.get("message", ""))
    
    # Create chat message  
    chat_message = CRUDService.create_chat_message(
        db=db,
        group_id=group_id,
        user_id=current_user.id,
        message=message.message,
        message_type="user"
    )
    
    return {
        "success": True,
        "message": "Message sent successfully",
        "chat_message": {
            "id": chat_message.id,
            "message": chat_message.message,
            "user_name": current_user.name,
            "created_at": chat_message.created_at.isoformat() if chat_message.created_at else None
        }
    }


@router.post("/settle-debt")
async def settle_debt(
    settle_data: SettleDebt, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Settle debt between two members."""
    try:
        # Create a settlement expense
        settlement_expense = CRUDService.create_expense(
            db=db,
            description=f"Settlement: {settle_data.payer_name} → {settle_data.payee_name}",
            amount=settle_data.amount,
            category="Settlement",
            group_id=settle_data.group_id,
            payer_id=settle_data.payer_id,
            split_among=[settle_data.payee_id],
            split_type="equal"
        )
        
        return {
            "success": True,
            "message": f"Settlement of ${settle_data.amount:.2f} recorded successfully",
            "settlement_id": settlement_expense.id
        }
    except Exception as e:
        print(f"Error settling debt: {e}")
        raise HTTPException(status_code=500, detail="Failed to settle debt")

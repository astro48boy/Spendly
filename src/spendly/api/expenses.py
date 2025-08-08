"""Expense management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..core.database import get_db
from ..schemas.expense import Expense, ExpenseRequest
from ..schemas.chat import ChatResponse
from ..schemas.user import User
from ..services.crud import CRUDService
from ..services.gemini import GeminiService
from ..models.expense import Expense as ExpenseModel
from .auth import get_current_active_user

router = APIRouter(prefix="/expenses", tags=["expenses"])

# Initialize Gemini service
gemini_service = GeminiService()


@router.post("/", response_model=ChatResponse)
async def process_chat_message(
    message: ExpenseRequest, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Process a chat message and create an expense if applicable."""
    
    print(f"🔍 DEBUG: Received expense request from user {current_user.email}")
    print(f"🔍 DEBUG: Message data: {message}")
    print(f"🔍 DEBUG: Message content: '{message.message}'")
    print(f"🔍 DEBUG: Group ID: {message.group_id}")
    
    if not gemini_service.model:
        print("⚠️ DEBUG: Gemini service not available")
        return ChatResponse(
            success=False,
            message="💡 AI parsing is currently unavailable. Please use manual expense entry format like: 'EXPENSE: Pizza $25 PAID_BY: me SPLIT: everyone'"
        )
    
    try:
        # Get group members for context
        group_members = CRUDService.get_group_members(db, message.group_id)
        print(f"✅ DEBUG: Found {len(group_members)} group members")
        user_names = [member.name for member in group_members]
        print(f"🔍 DEBUG: Group member names: {user_names}")
        
        # Parse the message using Gemini
        print(f"🔍 DEBUG: Calling Gemini service to parse: '{message.message}'")
        parsed_expense = await gemini_service.parse_expense_message(message.message, user_names)
        print(f"🔍 DEBUG: Gemini parsing result: {parsed_expense}")
        
        if not parsed_expense:
            print(f"❌ DEBUG: Gemini could not parse the expense")
            return ChatResponse(
                success=False,
                message="I couldn't understand that as an expense. Try something like 'I paid $25 for pizza for everyone' or 'I paid $150 for food, split 2/3 to Fury, rest to me'"
            )
        
        # Find the user who paid
        paid_by_user = None
        if parsed_expense["paid_by"].lower() in ["i", "me"]:
            paid_by_user = current_user
        else:
            paid_by_user_obj = CRUDService.get_user_by_name(db, parsed_expense["paid_by"])
            if paid_by_user_obj:
                paid_by_user = User.from_orm(paid_by_user_obj)
        
        if not paid_by_user:
            return ChatResponse(
                success=False,
                message=f"I couldn't find the user '{parsed_expense['paid_by']}' in this group."
            )
        
        # Handle the new advanced splitting format
        expense_type = parsed_expense.get("expense_type", "split")
        splits_data = parsed_expense.get("splits", [])
        
        # Convert split data to the format expected by CRUD service
        split_among_ids = []
        split_details = {}  # Map user_id to amount
        
        for split in splits_data:
            user_name = split["user"]
            amount = split["amount"]
            
            # Find user ID
            if user_name.lower() in ["i", "me"]:
                user_id = current_user.id
            else:
                user_obj = CRUDService.get_user_by_name(db, user_name)
                if user_obj:
                    user_id = user_obj.id
                else:
                    return ChatResponse(
                        success=False,
                        message=f"I couldn't find the user '{user_name}' in this group."
                    )
            
            split_among_ids.append(user_id)
            split_details[user_id] = amount
        
        # Validate that splits sum to total amount (with small tolerance for rounding)
        total_splits = sum(split_details.values())
        expected_total = parsed_expense["amount"]
        if abs(total_splits - expected_total) > 0.01:
            return ChatResponse(
                success=False,
                message=f"Split amounts (${total_splits:.2f}) don't match the total expense (${expected_total:.2f}). Please check your calculation."
            )
        
        # Create expense data with advanced splitting
        expense_data = {
            "description": parsed_expense["description"],
            "amount": parsed_expense["amount"],
            "paid_by": paid_by_user.id,
            "group_id": message.group_id,
            "expense_type": expense_type,
            "split_among": split_among_ids,
            "split_details": split_details  # Custom amounts per user
        }
        
        # Create the expense
        print(f"🔍 DEBUG: About to create expense with data: {expense_data}")
        try:
            expense_obj = CRUDService.create_expense(db, expense_data, message.message)
            expense = Expense.from_orm(expense_obj)
            print(f"✅ DEBUG: Successfully created expense with ID: {expense.id}")
        except Exception as e:
            print(f"❌ DEBUG: Failed to create expense: {str(e)}")
            import traceback
            traceback.print_exc()
            return ChatResponse(
                success=False,
                message=f"Failed to create expense: {str(e)}"
            )

        # Save the chat message
        try:
            CRUDService.create_chat_message(
                db=db,
                group_id=message.group_id,
                user_id=current_user.id,
                message=message.message,
                message_type="expense",
                expense_id=expense.id
            )
            print(f"✅ DEBUG: Successfully created chat message for expense")
        except Exception as e:
            print(f"❌ DEBUG: Failed to create chat message: {str(e)}")
            import traceback
            traceback.print_exc()
        
        # Create system message about the expense with advanced splitting info
        expense_type = expense_data.get("expense_type", "split")
        split_details = expense_data.get("split_details", {})
        
        if expense_type == "lend":
            # For lending scenarios
            if split_details:
                amounts_info = []
                for user_id, amount in split_details.items():
                    if user_id == current_user.id:
                        amounts_info.append(f"you owe ${amount:.2f}")
                    else:
                        user_obj = CRUDService.get_user_by_id(db, user_id)
                        user_name = user_obj.name if user_obj else "Unknown"
                        amounts_info.append(f"{user_name} owes ${amount:.2f}")
                split_info = f"lending - {', '.join(amounts_info)}"
            else:
                split_info = "lending transaction"
                
        elif split_details:
            # Custom split amounts
            amounts_info = []
            for user_id, amount in split_details.items():
                if user_id == current_user.id:
                    amounts_info.append(f"you: ${amount:.2f}")
                else:
                    user_obj = CRUDService.get_user_by_id(db, user_id)
                    user_name = user_obj.name if user_obj else "Unknown"
                    amounts_info.append(f"{user_name}: ${amount:.2f}")
            split_info = f"split as {', '.join(amounts_info)}"
            
        elif expense_data["split_among"] == "all":
            split_info = "split equally among all group members"
        else:
            # Equal split among specified users
            member_names = []
            for user_id in expense_data["split_among"]:
                if user_id == current_user.id:
                    member_names.append("you")
                else:
                    user_obj = CRUDService.get_user_by_id(db, user_id)
                    if user_obj:
                        member_names.append(user_obj.name)
            split_info = f"split equally among {', '.join(member_names)}"
        
        system_message = f"💰 Expense added: {expense.description} - ${expense.amount:.2f} paid by {paid_by_user.name}, {split_info}"
        CRUDService.create_chat_message(
            db=db,
            group_id=message.group_id,
            user_id=current_user.id,
            message=system_message,
            message_type="system",
            expense_id=expense.id
        )
        
        return ChatResponse(
            success=True,
            message=f"✅ Added expense: {expense.description} - ${expense.amount:.2f} paid by {paid_by_user.name}",
            expense=expense
        )
        
    except Exception as e:
        print(f"Error processing chat message: {e}")
        return ChatResponse(
            success=False,
            message=f"Error processing message: {str(e)}"
        )


@router.get("/")
async def get_expenses(
    group_id: Optional[int] = None, 
    limit: int = 10, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Get expenses with relationships."""
    print(f"🔍 DEBUG: Getting expenses for group_id={group_id}, limit={limit}, user={current_user.email}")
    
    try:
        expenses = CRUDService.get_expenses(db, group_id=group_id, limit=limit)
        print(f"✅ DEBUG: Found {len(expenses)} expenses in database")
        
        # Format expenses with additional data for frontend
        formatted_expenses = []
        for exp in expenses:
            print(f"   - Expense {exp.id}: {exp.description} - ${exp.amount} (paid by {exp.paid_by})")
            
            # Create expense dict with additional fields
            expense_dict = {
                "id": exp.id,
                "description": exp.description,
                "amount": exp.amount,
                "paid_by": exp.paid_by,
                "group_id": exp.group_id,
                "original_message": exp.original_message,
                "created_at": exp.created_at,
                "payer_name": exp.payer.name if exp.payer else "Unknown",
                "category": "Other",  # Default category for now
                "date": exp.created_at,  # Use created_at as date
                "splits": [
                    {
                        "id": split.id,
                        "amount": split.amount,
                        "user_id": split.user_id,
                        "member_name": split.user.name if split.user else "Unknown"
                    }
                    for split in exp.splits
                ] if exp.splits else []
            }
            formatted_expenses.append(expense_dict)
        
        print(f"📤 DEBUG: Returning {len(formatted_expenses)} formatted expenses")
        return formatted_expenses
        
    except Exception as e:
        print(f"❌ DEBUG: Error getting expenses: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error getting expenses: {str(e)}")


@router.get("/{expense_id}")
async def get_expense(
    expense_id: int, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Get a specific expense with full details."""
    try:
        # Get the expense
        expense = db.query(ExpenseModel).filter(ExpenseModel.id == expense_id).first()
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        # Format with additional data
        expense_dict = {
            "id": expense.id,
            "description": expense.description,
            "amount": expense.amount,
            "paid_by": expense.paid_by,
            "group_id": expense.group_id,
            "original_message": expense.original_message,
            "created_at": expense.created_at,
            "payer_name": expense.payer.name if expense.payer else "Unknown",
            "category": "Other",
            "date": expense.created_at,
            "splits": [
                {
                    "id": split.id,
                    "amount": split.amount,
                    "user_id": split.user_id,
                    "member_name": split.user.name if split.user else "Unknown"
                }
                for split in expense.splits
            ] if expense.splits else []
        }
        
        return expense_dict
        
    except Exception as e:
        print(f"❌ Error getting expense {expense_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting expense: {str(e)}")

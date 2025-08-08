"""CRUD operations service."""

from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from ..models import User, Group, GroupMember, Expense, ExpenseSplit, ChatMessage
from ..schemas import UserCreate, GroupCreate, ExpenseBreakdown, GroupBreakdown, ChatMessageResponse
from .auth import AuthService


class CRUDService:
    """Service for database CRUD operations."""

    # User operations
    @staticmethod
    def create_user(db: Session, user: UserCreate) -> User:
        """Create a new user with hashed password."""
        hashed_password = AuthService.get_password_hash(user.password)
        db_user = User(
            name=user.name, 
            email=user.email,
            hashed_password=hashed_password
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        """Get user by email."""
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
        """Get user by ID."""
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_user_by_name(db: Session, name: str) -> Optional[User]:
        """Get user by name (case-insensitive)."""
        return db.query(User).filter(User.name.ilike(f"%{name}%")).first()

    @staticmethod
    def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
        """Get all users."""
        return db.query(User).offset(skip).limit(limit).all()

    # Group operations
    @staticmethod
    def create_group(db: Session, group: GroupCreate, creator_id: int) -> Group:
        """Create a new group with members."""
        db_group = Group(name=group.name, description=group.description)
        db.add(db_group)
        db.commit()
        db.refresh(db_group)
        
        # Add the creator as a member first
        creator_membership = GroupMember(group_id=db_group.id, user_id=creator_id)
        db.add(creator_membership)
        
        # Add other members to the group
        for email in group.member_emails:
            user = CRUDService.get_user_by_email(db, email)
            if user and user.id != creator_id:  # Don't add creator twice
                membership = GroupMember(group_id=db_group.id, user_id=user.id)
                db.add(membership)
        
        db.commit()
        return db_group

    @staticmethod
    def get_groups(db: Session, skip: int = 0, limit: int = 100) -> List[Group]:
        """Get all groups."""
        from sqlalchemy.orm import joinedload
        from ..models.group import GroupMember
        return db.query(Group).options(joinedload(Group.members).joinedload(GroupMember.user)).offset(skip).limit(limit).all()

    @staticmethod
    def get_group(db: Session, group_id: int) -> Group:
        """Get a specific group by ID."""
        from sqlalchemy.orm import joinedload
        from ..models.group import GroupMember
        return db.query(Group).options(joinedload(Group.members).joinedload(GroupMember.user)).filter(Group.id == group_id).first()

    @staticmethod
    def get_group_members(db: Session, group_id: int) -> List[User]:
        """Get all members of a group."""
        return db.query(User).join(GroupMember).filter(GroupMember.group_id == group_id).all()

    @staticmethod
    def get_user_groups(db: Session, user_id: int) -> List[Group]:
        """Get all groups that a user is a member of."""
        return db.query(Group).join(GroupMember).filter(GroupMember.user_id == user_id).all()

    @staticmethod
    def add_user_to_group(db: Session, group_id: int, user_email: str) -> bool:
        """Add a user to a group by email."""
        user = CRUDService.get_user_by_email(db, user_email)
        if not user:
            return False
        
        # Check if user is already a member
        existing_membership = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user.id
        ).first()
        
        if existing_membership:
            return False
        
        membership = GroupMember(group_id=group_id, user_id=user.id)
        db.add(membership)
        db.commit()
        return True

    # Expense operations
    @staticmethod
    def create_expense(db: Session, expense_data: dict, original_message: str = None) -> Expense:
        """Create a new expense from parsed data with advanced splitting support."""
        print(f"🔍 DEBUG: Creating expense with data: {expense_data}")
        
        try:
            db_expense = Expense(
                description=expense_data["description"],
                amount=expense_data["amount"],
                paid_by=expense_data["paid_by"],
                group_id=expense_data["group_id"],
                original_message=original_message
            )
            print(f"✅ DEBUG: Created expense object: {db_expense}")
            
            db.add(db_expense)
            print(f"✅ DEBUG: Added expense to session")
            
            db.commit()
            print(f"✅ DEBUG: Committed expense to database")
            
            db.refresh(db_expense)
            print(f"✅ DEBUG: Refreshed expense, ID: {db_expense.id}")
            
            # Create expense splits based on split_among data
            split_users = expense_data.get("split_among", "all")
            split_details = expense_data.get("split_details", {})  # Custom amounts per user
            expense_type = expense_data.get("expense_type", "split")
            
            print(f"🔍 DEBUG: Creating splits for: {split_users}")
            print(f"🔍 DEBUG: Expense type: {expense_type}")
            print(f"🔍 DEBUG: Split details: {split_details}")
            
            if split_details:
                # Use custom split amounts
                print(f"🔍 DEBUG: Using custom split amounts")
                for user_id, amount in split_details.items():
                    split = ExpenseSplit(
                        expense_id=db_expense.id,
                        user_id=user_id,
                        amount=amount
                    )
                    db.add(split)
                    print(f"✅ DEBUG: Added custom split for user {user_id}: ${amount}")
                    
            elif split_users == "all":
                # Split equally among all group members
                members = CRUDService.get_group_members(db, expense_data["group_id"])
                print(f"🔍 DEBUG: Found {len(members)} group members for equal split")
                split_amount = expense_data["amount"] / len(members)
                for member in members:
                    split = ExpenseSplit(
                        expense_id=db_expense.id,
                        user_id=member.id,
                        amount=split_amount
                    )
                    db.add(split)
                    print(f"✅ DEBUG: Added equal split for user {member.id}: ${split_amount}")
                    
            elif isinstance(split_users, list):
                # Split equally among specified user IDs
                print(f"🔍 DEBUG: Splitting equally among specific users: {split_users}")
                split_amount = expense_data["amount"] / len(split_users)
                for user_id in split_users:
                    split = ExpenseSplit(
                        expense_id=db_expense.id,
                        user_id=user_id,
                        amount=split_amount
                    )
                    db.add(split)
                    print(f"✅ DEBUG: Added equal split for user {user_id}: ${split_amount}")
            else:
                # Fallback: split equally among all group members
                print(f"🔍 DEBUG: Fallback - splitting equally among all group members")
                members = CRUDService.get_group_members(db, expense_data["group_id"])
                split_amount = expense_data["amount"] / len(members)
                for member in members:
                    split = ExpenseSplit(
                        expense_id=db_expense.id,
                        user_id=member.id,
                        amount=split_amount
                    )
                    db.add(split)
                    print(f"✅ DEBUG: Added fallback split for user {member.id}: ${split_amount}")
            
            db.commit()
            print(f"✅ DEBUG: Committed splits to database")
            return db_expense
            
        except Exception as e:
            print(f"❌ DEBUG: Error in create_expense: {str(e)}")
            import traceback
            traceback.print_exc()
            db.rollback()
            raise

    @staticmethod
    def get_expenses(db: Session, group_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> List[Expense]:
        """Get expenses, optionally filtered by group."""
        query = db.query(Expense)
        if group_id:
            query = query.filter(Expense.group_id == group_id)
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def get_group_expenses(db: Session, group_id: int) -> List[Expense]:
        """Get all expenses for a specific group."""
        return db.query(Expense).filter(Expense.group_id == group_id).all()

    # Chat operations
    @staticmethod
    def create_chat_message(db: Session, group_id: int, user_id: int, message: str, 
                          message_type: str = "text", expense_id: Optional[int] = None) -> ChatMessage:
        """Create a new chat message."""
        db_message = ChatMessage(
            group_id=group_id,
            user_id=user_id,
            message=message,
            message_type=message_type,
            expense_id=expense_id
        )
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        return db_message

    @staticmethod
    def get_chat_messages(db: Session, group_id: int, limit: int = 50) -> List[ChatMessage]:
        """Get chat messages for a group."""
        return db.query(ChatMessage).filter(
            ChatMessage.group_id == group_id
        ).order_by(ChatMessage.created_at.desc()).limit(limit).all()

    # Breakdown calculations
    @staticmethod
    def get_group_breakdown(db: Session, group_id: int) -> GroupBreakdown:
        """Calculate expense breakdown for a group."""
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise ValueError(f"Group {group_id} not found")
        
        # Get all group members
        members = CRUDService.get_group_members(db, group_id)
        
        # Calculate totals for each member
        user_breakdowns = []
        total_expenses = 0
        
        for member in members:
            # Total paid by this user
            total_paid = db.query(func.sum(Expense.amount)).filter(
                Expense.paid_by == member.id,
                Expense.group_id == group_id
            ).scalar() or 0
            
            # Total owed by this user
            total_owed = db.query(func.sum(ExpenseSplit.amount)).filter(
                ExpenseSplit.user_id == member.id
            ).join(Expense).filter(
                Expense.group_id == group_id
            ).scalar() or 0
            
            balance = total_paid - total_owed
            total_expenses += total_paid
            
            user_breakdowns.append(ExpenseBreakdown(
                user_id=member.id,
                user_name=member.name,
                total_paid=float(total_paid),
                total_owed=float(total_owed),
                balance=float(balance)
            ))
        
        return GroupBreakdown(
            group_id=group_id,
            group_name=group.name,
            total_expenses=float(total_expenses),
            user_breakdowns=user_breakdowns
        )

    @staticmethod
    def get_user_overall_breakdown(db: Session, user_id: int) -> List[GroupBreakdown]:
        """Get overall expense breakdown for a user across all groups."""
        # Get all groups the user is a member of
        user_groups = db.query(Group).join(GroupMember).filter(
            GroupMember.user_id == user_id
        ).all()
        
        breakdowns = []
        for group in user_groups:
            breakdown = CRUDService.get_group_breakdown(db, group.id)
            breakdowns.append(breakdown)
        
        return breakdowns

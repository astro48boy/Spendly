"""Authentication endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List

from ..core.database import get_db
from ..core.config import settings
from ..schemas.user import UserCreate, UserLogin, UserAuth, User
from ..services.auth import AuthService
from ..services.crud import CRUDService

router = APIRouter(tags=["authentication"])  # Removed /auth prefix
security = HTTPBearer()


@router.post("/signup", response_model=UserAuth)
async def signup(user: UserCreate, db: Session = Depends(get_db)):
    """Create a new user account."""
    # Check if user already exists
    existing_user = CRUDService.get_user_by_email(db, user.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    db_user = CRUDService.create_user(db, user)
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = AuthService.create_access_token(
        data={"sub": db_user.email}, expires_delta=access_token_expires
    )
    
    return UserAuth(
        access_token=access_token,
        token_type="bearer",
        user=User.from_orm(db_user)
    )


@router.post("/login", response_model=UserAuth)
async def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return access token."""
    user = AuthService.authenticate_user(db, user_credentials.email, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = AuthService.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return UserAuth(
        access_token=access_token,
        token_type="bearer",
        user=User.from_orm(user)
    )


def get_current_active_user(
    credentials: HTTPAuthorizationCredentials = Depends(security), 
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user."""
    try:
        print(f"🔐 Checking auth token: {credentials.credentials[:20]}...")
        user = AuthService.get_current_user(credentials.credentials, db)
        if user is None:
            print("❌ No user found for token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        print(f"✅ User authenticated: {user.email}")
        return User.from_orm(user)
    except Exception as e:
        print(f"❌ Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return current_user


# Add user breakdown endpoint here since it's user-specific
@router.get("/my-breakdown")
async def get_my_breakdown(
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Get expense breakdown for the current user across all groups."""
    try:
        # Get all groups the user is a member of
        user_groups = CRUDService.get_user_groups(db, current_user.id)
        
        group_breakdowns = []
        
        for group in user_groups:
            try:
                breakdown = CRUDService.get_group_breakdown(db, group.id)
                # Find current user's breakdown in this group
                user_breakdown = None
                for ub in breakdown.user_breakdowns:
                    if ub.user_id == current_user.id:
                        user_breakdown = ub
                        break
                
                if user_breakdown:
                    # Return format that matches frontend expectations
                    group_breakdowns.append({
                        "group_id": group.id,
                        "group_name": group.name,
                        "total_expenses": breakdown.total_expenses,
                        "user_breakdowns": breakdown.user_breakdowns,  # Include all users for member count
                        "my_balance": user_breakdown.balance,
                        "my_paid": user_breakdown.total_paid,
                        "my_owed": user_breakdown.total_owed
                    })
            except Exception as e:
                print(f"⚠️ Could not get breakdown for group {group.id}: {e}")
                continue
        
        # Return as array for frontend compatibility
        return group_breakdowns
        
    except Exception as e:
        print(f"❌ Error getting user breakdown: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not calculate breakdown"
        )


@router.post("/users", response_model=User)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """Create a new user (for testing)."""
    return CRUDService.create_user(db=db, user=user)


@router.get("/users")
async def get_users(
    skip: int = 0, 
    limit: int = 100, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Get all users."""
    return CRUDService.get_users(db, skip=skip, limit=limit)

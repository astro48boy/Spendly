"""Main FastAPI application."""

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Import the API routers
from src.spendly.api.auth import router as auth_router
from src.spendly.api.expenses import router as expenses_router
from src.spendly.api.groups import router as groups_router
from src.spendly.api.chat import router as chat_router
from src.spendly.core.database import create_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print("🚀 Starting Spendly application...")
    create_tables()
    print("✅ Database tables created/verified")
    yield
    # Shutdown
    print("👋 Shutting down Spendly application...")


# Create FastAPI application
app = FastAPI(
    title="Spendly",
    description="A chat-based expense tracking application",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Include API routers
app.include_router(auth_router, prefix="/api")
app.include_router(expenses_router, prefix="/api")
app.include_router(groups_router, prefix="/api")
app.include_router(chat_router, prefix="/api")

# HTML Page Routes
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Home page - redirects to login"""
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """Login page"""
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/signup", response_class=HTMLResponse)
async def signup_page(request: Request):
    """Signup page"""
    return templates.TemplateResponse("signup.html", {"request": request})


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Dashboard page"""
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/chat", response_class=HTMLResponse)
async def chat_page(request: Request):
    """Chat page"""
    return templates.TemplateResponse("chat.html", {"request": request})


@app.get("/transactions", response_class=HTMLResponse)
async def transactions_page(request: Request):
    """Transactions page"""
    return templates.TemplateResponse("transactions.html", {"request": request})


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "app": "Spendly"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

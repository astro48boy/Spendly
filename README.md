# Spendly-like Chat Expense Tracker

A minimal chat-based expense tracking application inspired by Spendly. Users can add expenses through natural language messages, and the app uses Google Gemini LLM to understand and process the expenses.

## Features

- **User Authentication**: Sign up and sign in functionality
- **Chat Interface**: Add expenses through natural language messages
- **Dashboard**: View and manage expenses, users, and groups
- **User Management**: Create and manage users
- **Group Management**: Create and manage expense groups with member management
- **Expense Breakdown**: See who owes what and overall balance for each group
- **AI-Powered**: Uses Google Gemini LLM to parse expense messages

## Tech Stack

- **Backend**: Python FastAPI
- **Database**: SQLite with SQLAlchemy ORM
- **Authentication**: JWT tokens with bcrypt password hashing
- **Frontend**: HTML/CSS/JavaScript (served by FastAPI)
- **AI**: Google Gemini LLM

## Development Setup

1. **Install dependencies** (already done):
   ```
   pip install -r requirements.txt
   ```

2. **Set up environment variables**:
   ```
   copy .env.example .env
   ```
   Edit the `.env` file and add:
   - Your Google Gemini API key (get one free from https://ai.google.dev/)
   - A secure secret key for JWT authentication

3. **Run the development server**:
   
   Option A - Using the batch file:
   ```
   start_server.bat
   ```
   
   Option B - Using Python directly:
   ```
   D:\personal_project\Blind_projects_\Spendly_like\.venv\Scripts\python.exe main.py
   ```
   
   Option C - Using uvicorn:
   ```
   D:\personal_project\Blind_projects_\Spendly_like\.venv\Scripts\uvicorn.exe main:app --reload
   ```

4. **Open your browser** and navigate to `http://localhost:8000`

## Quick Start

1. **First Run**: Go to `/signup` to create your account
2. **Create a Group**: Add friends by their email addresses
3. **Start Chatting**: Use natural language like:
   - "I paid $25 for pizza for everyone"
   - "John bought coffee for $12, split between him and Mary"
   - "Sarah spent $45 on groceries, everyone should split it"
4. **Check Dashboard**: See who owes what and overall balances

## Project Structure

```
├── main.py              # FastAPI application entry point
├── models.py            # SQLAlchemy database models
├── database.py          # Database configuration
├── schemas.py           # Pydantic schemas
├── crud.py              # Database operations
├── auth.py              # Authentication service
├── gemini_service.py    # Gemini LLM integration
├── static/              # Static files (CSS, JS)
├── templates/           # HTML templates
└── requirements.txt     # Python dependencies
```

## API Endpoints

### Authentication
- `POST /api/signup` - Create user account
- `POST /api/login` - Sign in user

### Core Features
- `GET /` - Chat interface
- `GET /dashboard` - Dashboard interface
- `POST /api/users` - Create user (admin)
- `POST /api/groups` - Create group
- `POST /api/expenses` - Add expense via chat
- `GET /api/expenses` - Get expenses
- `GET /api/users` - Get users
- `GET /api/groups` - Get groups

### Expense Breakdown
- `GET /api/breakdown/{group_id}` - Get expense breakdown for a group
- `GET /api/my-breakdown` - Get expense breakdown for current user's groups

## Environment Variables

- `GEMINI_API_KEY` - Your Google Gemini API key
- `DATABASE_URL` - SQLite database URL (default: sqlite:///./expenses.db)
- `SECRET_KEY` - JWT secret key for authentication

# Spendly Chat - Professional Project Structure

This project has been restructured following Python best practices and professional software engineering standards.

## Project Structure

```
spendly/
├── src/spendly/                    # Main application package
│   ├── __init__.py
│   ├── main.py                     # FastAPI application entry point
│   ├── api/                        # API endpoints
│   │   ├── __init__.py
│   │   ├── auth.py                 # Authentication endpoints
│   │   ├── groups.py               # Group management endpoints
│   │   ├── expenses.py             # Expense management endpoints
│   │   └── chat.py                 # Chat endpoints
│   ├── core/                       # Core application configuration
│   │   ├── __init__.py
│   │   ├── config.py               # Application settings
│   │   └── database.py             # Database configuration
│   ├── models/                     # Database models
│   │   ├── __init__.py
│   │   ├── base.py                 # SQLAlchemy base
│   │   ├── user.py                 # User model
│   │   ├── group.py                # Group and GroupMember models
│   │   ├── expense.py              # Expense and ExpenseSplit models
│   │   └── chat.py                 # ChatMessage model
│   ├── schemas/                    # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── user.py                 # User schemas
│   │   ├── group.py                # Group schemas
│   │   ├── expense.py              # Expense schemas
│   │   └── chat.py                 # Chat schemas
│   └── services/                   # Business logic
│       ├── __init__.py
│       ├── auth.py                 # Authentication service
│       ├── crud.py                 # Database operations
│       └── gemini.py               # Gemini AI service
├── tests/                          # Test files
│   ├── __init__.py
│   ├── conftest.py                 # Test configuration
│   ├── fixtures/                   # Test utilities and fixtures
│   │   ├── __init__.py
│   │   ├── create_test_user.py     # Test user creation utility
│   │   └── reset_test_db.py        # Test database reset utility
│   ├── test_auth.py                # Authentication tests
│   ├── test_comprehensive.py       # Comprehensive integration tests
│   ├── test_db.py                  # Database tests
│   ├── test_gemini.py              # Gemini AI tests
│   └── test_imports.py             # Import tests
├── scripts/                        # Utility scripts
│   ├── create_test_user.py         # Create test user
│   ├── reset_database.py           # Reset database
│   ├── start_server.py             # Development server launcher
│   ├── start_server.bat            # Windows batch script for server
│   └── run.bat                     # Windows run script
├── docs/                           # Documentation
│   └── STRUCTURE.md                # Project structure documentation
├── static/                         # Frontend assets
├── templates/                      # HTML templates
├── legacy/                         # Legacy files (old structure)
├── debug/                          # Debug files and utilities
├── app.py                          # Application entry point
├── requirements.txt                # Python dependencies
├── pyproject.toml                  # Project configuration
├── .env                            # Environment variables
├── .env.example                    # Environment variables template
└── README.md                       # Project documentation
```

## Key Improvements

### 1. **Separation of Concerns**
- **API Layer** (`api/`): FastAPI endpoints grouped by functionality
- **Business Logic** (`services/`): Core business operations and external integrations
- **Data Layer** (`models/`): Database models with clear relationships
- **Validation Layer** (`schemas/`): Pydantic schemas for request/response validation
- **Configuration** (`core/`): Centralized settings and database configuration

### 2. **Professional Standards**
- **Type Hints**: All functions have proper type annotations
- **Docstrings**: Comprehensive documentation for all classes and methods
- **Error Handling**: Proper exception handling with meaningful messages
- **Logging**: Structured logging for debugging and monitoring
- **Configuration Management**: Environment-based configuration with defaults

### 3. **Maintainability**
- **Single Responsibility**: Each module has a clear, focused purpose
- **Dependency Injection**: Clean dependency management with FastAPI's DI system
- **Service Layer**: Business logic separated from API endpoints
- **Model Separation**: Database models split into logical files

### 4. **Scalability**
- **Modular Design**: Easy to add new features without affecting existing code
- **Clean Architecture**: Clear boundaries between layers
- **Plugin Architecture**: Services can be easily swapped or extended
- **Test Structure**: Organized test suite for different components

## Getting Started

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Set Up Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Run the Application
```bash
python app.py
```

### 4. Create Test Data
```bash
python scripts/create_test_user.py
```

## Development Workflow

### Adding New Features
1. **Models**: Add/modify database models in `src/spendly/models/`
2. **Schemas**: Create Pydantic schemas in `src/spendly/schemas/`
3. **Services**: Implement business logic in `src/spendly/services/`
4. **API**: Add endpoints in `src/spendly/api/`
5. **Tests**: Write tests in `tests/`

### Database Changes
1. Modify models in `src/spendly/models/`
2. Update schemas in `src/spendly/schemas/`
3. Update services in `src/spendly/services/`
4. Test changes

### Code Quality
- Use type hints for all functions
- Add docstrings to all classes and methods
- Follow PEP 8 style guidelines
- Write unit tests for new functionality
- Use meaningful variable and function names

## Architecture Benefits

### For Development
- **Clear Structure**: Easy to understand where code belongs
- **Fast Development**: Well-defined patterns speed up feature development
- **Easy Debugging**: Clear separation makes issues easier to track
- **Team Collaboration**: Multiple developers can work on different layers

### For Maintenance
- **Easy Refactoring**: Clear boundaries make changes safer
- **Bug Isolation**: Issues are contained within specific layers
- **Feature Toggles**: Easy to enable/disable functionality
- **Performance Optimization**: Clear data flow makes optimization easier

### For Testing
- **Unit Testing**: Each service can be tested in isolation
- **Integration Testing**: Clear API boundaries for endpoint testing
- **Mocking**: Service layer can be easily mocked for testing
- **Test Data**: Consistent test setup with proper fixtures

This structure provides a solid foundation for scaling the application and maintaining code quality as the project grows.

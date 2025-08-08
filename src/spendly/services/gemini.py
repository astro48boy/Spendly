"""Gemini AI service for expense parsing."""

import google.generativeai as genai
import json
import re
from typing import Dict, Optional

from ..core.config import settings


class GeminiService:
    """Service for integrating with Google Gemini LLM."""
    
    def __init__(self):
        """Initialize the Gemini service."""
        if not settings.GEMINI_API_KEY:
            print("Warning: GEMINI_API_KEY not found. Gemini service disabled.")
            self.model = None
            return
        
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            
            # Try different model names in order of preference
            model_names = [
                'gemini-2.0-flash',
                'gemini-1.5-flash-latest',
                'gemini-1.5-pro-latest',
                'gemini-1.5-flash',
                'gemini-1.5-pro'
            ]
            
            self.model = None
            for model_name in model_names:
                try:
                    print(f"Trying to initialize Gemini model: {model_name}")
                    self.model = genai.GenerativeModel(model_name)
                    print(f"✅ Successfully initialized Gemini model: {model_name}")
                    break
                except Exception as e:
                    print(f"❌ Failed to initialize {model_name}: {e}")
                    continue
            
            if not self.model:
                print("❌ Error: Could not initialize any Gemini model")
                
        except Exception as e:
            print(f"❌ Error initializing Gemini service: {e}")
            self.model = None
    
    def list_available_models(self):
        """List all available Gemini models for debugging."""
        try:
            models = genai.list_models()
            print("Available Gemini models:")
            for model in models:
                print(f"  - {model.name}")
                if hasattr(model, 'supported_generation_methods'):
                    print(f"    Supports: {model.supported_generation_methods}")
        except Exception as e:
            print(f"Error listing models: {e}")
    
    async def parse_expense_message(self, message: str, user_names: list = None) -> Optional[Dict]:
        """
        Parse a natural language message to extract expense information with advanced splitting.
        
        Args:
            message: Natural language message about an expense
            user_names: List of available user names in the group
            
        Returns:
            Dictionary with expense details or None if parsing fails
        """
        
        if not self.model:
            print("❌ Gemini model not available")
            return None
        
        user_names_str = ", ".join(user_names) if user_names else "any user names mentioned"
        
        prompt = f"""
        Parse this expense message and extract detailed expense information with advanced splitting capabilities.
        
        Message: "{message}"
        Available users: {user_names_str}
        
        You need to understand various expense scenarios:
        
        1. **Equal Splitting**: "I paid $60 for dinner, split equally among John, Mary, and me"
        2. **Ratio-based Splitting**: "I paid $150 for food, split 2/3 to Fury, rest to me"
        3. **Percentage Splitting**: "I paid $100 for groceries, 70% to Alice, 30% to me"
        4. **Custom Amount Splitting**: "I paid $80 for taxi, John owes $30, Mary owes $20, I keep $30"
        5. **Lending (No Split)**: "I lent $50 to Alice" or "John borrowed $25 from me"
        6. **Partial Coverage**: "I paid $40 for lunch, cover $15 for Bob, rest is mine"
        7. **Unequal Custom**: "I paid $90 for supplies, divide $40 to team, $50 for myself"
        
        Return a JSON object in this exact format:
        {{
            "description": "description of expense",
            "amount": 150.0,
            "paid_by": "name of person who paid",
            "expense_type": "split" | "lend" | "borrow" | "personal",
            "splits": [
                {{
                    "user": "Fury",
                    "amount": 100.0,
                    "method": "ratio" | "amount" | "percentage" | "equal",
                    "ratio": "2/3" // optional, for ratio-based
                }},
                {{
                    "user": "me",
                    "amount": 50.0,
                    "method": "ratio",
                    "ratio": "1/3"
                }}
            ]
        }}
        
        **Key Rules:**
        - For lending/borrowing: expense_type = "lend", splits show who owes what
        - For personal expenses: expense_type = "personal", splits = []
        - For ratio splits: calculate exact amounts from ratios
        - Splits array should sum to the total amount
        - Use "me", "I" for the current user as mentioned
        - Map names exactly as provided or use available user names
        
        **Examples:**
        
        Input: "I paid $150 for food. Split 2/3 to Fury, rest to me"
        Output: {{
            "description": "food",
            "amount": 150.0,
            "paid_by": "me",
            "expense_type": "split",
            "splits": [
                {{"user": "Fury", "amount": 100.0, "method": "ratio", "ratio": "2/3"}},
                {{"user": "me", "amount": 50.0, "method": "ratio", "ratio": "1/3"}}
            ]
        }}
        
        Input: "I lent $50 to Alice for groceries"
        Output: {{
            "description": "groceries",
            "amount": 50.0,
            "paid_by": "me",
            "expense_type": "lend",
            "splits": [
                {{"user": "Alice", "amount": 50.0, "method": "amount"}}
            ]
        }}
        
        Input: "John paid $90 for dinner, split equally among John, Mary, and me"
        Output: {{
            "description": "dinner",
            "amount": 90.0,
            "paid_by": "John",
            "expense_type": "split",
            "splits": [
                {{"user": "John", "amount": 30.0, "method": "equal"}},
                {{"user": "Mary", "amount": 30.0, "method": "equal"}},
                {{"user": "me", "amount": 30.0, "method": "equal"}}
            ]
        }}
        
        Input: "I paid $100 for utilities, 60% for Bob, 40% for me"
        Output: {{
            "description": "utilities",
            "amount": 100.0,
            "paid_by": "me",
            "expense_type": "split",
            "splits": [
                {{"user": "Bob", "amount": 60.0, "method": "percentage"}},
                {{"user": "me", "amount": 40.0, "method": "percentage"}}
            ]
        }}
        
        If you cannot parse the message or it's not about an expense, return:
        {{"error": "Could not parse expense from message"}}
        """
        
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            print(result_text)
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                parsed_data = json.loads(json_str)
                
                if "error" in parsed_data:
                    return None
                print(parsed_data)
                return parsed_data
            
            return None
            
        except Exception as e:
            print(f"Error parsing expense message: {e}")
            return None

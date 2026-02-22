import os
import json
import logging

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM_PROMPT = """# Email Order Extraction Agent

You are an intelligent email parsing assistant specialized in extracting order information from e-commerce confirmation and shipping notification emails.

## Supported Vendors
Amazon, Noon, Namshi, Sharaf DG, Carrefour, Other online retailers

## CRITICAL: Order Number Patterns
Look for these patterns to find order numbers:
- "#408-3351522-8481145" (Amazon format)
- "Order number 408-3351522-8481145"
- "Order #408-3351522-8481145"
- "Order ID: 408-3351522-8481145"
- Any 10-20 digit alphanumeric code after "order", "#", or "order number"

## Important: Work with Gmail Snippets
Gmail snippets are truncated previews. Extract ANY available information:
- Order numbers anywhere in text (patterns above)
- Vendor name from email sender (e.g., "amazon.ae", "noon.com") or subject line
- Status keywords: "Order Confirmation" = Ordered, "Shipped" = Shipped, "Out for Delivery", "Delivered"
- Prices with currency symbols (AED, USD, SAR, etc.)
- Any dates mentioned for delivery
- Customer name from "Hello [Name]" or "Dear [Name]"

## Information to Extract
1. Order Number - MUST extract this! Look for patterns like "Order number 123-456789" or "#123-456789"
2. Item Name(s) - full product name if visible
3. Price - include currency (AED, USD, SAR, etc.)
4. Order Status - "Ordered" | "Shipped" | "Out for Delivery" | "Delivered"
5. Delivery Information - Location (City), Expected Date
6. Customer Name - from email if available

## Output Format
Return ONLY valid JSON (no markdown):
{
  "extraction_success": true,
  "vendor": "Amazon",
  "customer_name": "John Doe",
  "order_number": "408-3351522-8481145",
  "order_status": "Ordered",
  "delivery_info": {"location": "Dubai", "expected_date": "2025-01-25"},
  "items": [{"item_name": "Product Name", "quantity": 1, "price": "100.00", "currency": "AED"}],
  "order_total": {"amount": "100.00", "currency": "AED"},
  "confidence": "High"
}

If NO order number can be found:
{"extraction_success": false, "error": "No order number found", "confidence": "Low"}"""

CLASSIFICATION_SYSTEM_PROMPT = """# Email Classification Agent

Classify as ORDER email if contains:
- Order numbers, tracking numbers, order IDs
- Order confirmation, shipped, delivery keywords
- Package, tracking, dispatched

Return ONLY valid JSON:
{"isOrderEmail": true, "confidence": "High", "indicators": ["order number"], "reason": "Contains order number"}


If not order-related:
{"isOrderEmail": false, "confidence": "High", "indicators": [], "reason": "Not an order email"}
"""


async def call_ai_api(prompt: str, user_content: str) -> dict:
    """Call GitHub AI API using azure-ai-inference"""
    try:
        from azure.ai.inference import ChatCompletionsClient
        from azure.core.credentials import AzureKeyCredential
    except ImportError:
        logger.error("azure-ai-inference not installed")
        return {"error": "AI library not installed"}
    
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        logger.error("GITHUB_TOKEN not set!")
        return {"error": "GITHUB_TOKEN not configured"}
    
    endpoint = os.getenv("GITHUB_ENDPOINT", "https://models.github.ai/inference")
    model = os.getenv("GITHUB_MODEL", "openai/gpt-4o")
    
    logger.info(f"Calling AI API with model: {model}")
    
    try:
        client = ChatCompletionsClient(
            endpoint=endpoint,
            credential=AzureKeyCredential(token),
        )
        
        response = client.complete(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": user_content}
            ],
            model=model,
            temperature=0.1,
            max_tokens=2048
        )
        
        message = response.choices[0].message
        content = message.content
        logger.info(f"AI response type: {type(content)}, content: {str(content)[:200]}...")
        
        if isinstance(content, dict):
            return content
        
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            import re
            json_match = re.search(r'\{[^{}]*\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            raise
        
    except Exception as e:
        logger.error(f"AI API error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"error": str(e)}


async def classify_email(subject: str, body: str) -> dict:
    """Classify if email is order-related."""
    content = f"Subject: {subject}\n\n{body[:2000]}"
    
    try:
        result = await call_ai_api(CLASSIFICATION_SYSTEM_PROMPT, content)
        logger.info(f"Classification result: {result}")
        return result
    except Exception as e:
        logger.error(f"Classification error: {e}")
        return {"isOrderEmail": False, "confidence": "Low", "error": str(e)}


async def extract_order_data(subject: str, body: str) -> dict:
    """Extract order data from email."""
    content = f"Subject: {subject}\n\n{body[:3000]}"
    
    try:
        result = await call_ai_api(EXTRACTION_SYSTEM_PROMPT, content)
        logger.info(f"Extraction result: {result}")
        return result
    except Exception as e:
        logger.error(f"Extraction error: {e}")
        return {"extraction_success": False, "error": str(e), "confidence": "Low"}

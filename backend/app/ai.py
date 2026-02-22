import os
import json
import logging

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM_PROMPT = """# Email Order Extraction Agent

You are an intelligent email parsing assistant specialized in extracting order information from e-commerce confirmation and shipping notification emails.

## Your Task
Extract order details from email text and return ONLY valid JSON.

---

## Supported Vendors
- **Amazon** (amazon.ae, amazon.com, amazon.in, etc.)
- **Noon** (noon.com, noon.ae)
- **Namshi** (namshi.com)
- **Sharaf DG** (sharafdg.com)
- **Carrefour** (carrefouruae.com, carrefourkw.com)
- **Other** online retailers

---

## CRITICAL: Order Number Extraction Patterns

You MUST find and extract order numbers. Look for these patterns:

### Amazon Format
```
Order number 408-3351522-8481145
Order #408-3351522-8481145
#408-3351522-8481145
Order ID: D-12345-67890
```

### Noon Format
```
Order No.: NOON-123456789
Order #NOON-123456
Order number 12345678
```

### General Patterns
```
Order number: 12345
Order #: 12345
Order ID: ABC123
Order # : 12345
Order No: 12345
Order Id: 12345
```

**IMPORTANT**: Extract ANY alphanumeric code that appears after keywords: "order", "order number", "order #", "order id", "order no"

---

## Email Subject Keywords for Status Detection

| Keyword in Subject | Status to Assign |
|-------------------|------------------|
| "Order Confirmation", "Order Placed", "Order Received" | Ordered |
| "Shipped", "Dispatched", "On the way", "In transit" | Shipped |
| "Out for delivery", "Out for Delivery" | Out for Delivery |
| "Delivered", "Arrived", "Package delivered" | Delivered |

---

## How to Extract Vendor

1. **From email sender**: "auto-confirm@amazon.ae", "orders@noon.com"
2. **From subject line**: "Your Amazon order", "Noon Order Confirmation"
3. **Look for**: "amazon.ae", "noon.com", "namshi.com", "carrefour", "sharaf"

---

## How to Extract Customer Name

Look for patterns like:
```
Hello John
Dear John
Hi John
Hello John Doe
Dear Customer
```

---

## How to Extract Delivery Information

- **Location**: Look for city names (Dubai, Abu Dhabi, Sharjah, Kuwait, Riyadh, etc.)
- **Expected Date**: Look for date patterns:
  - "Jan 23, 2025"
  - "January 23, 2025"
  - "Thursday, Jan 23"
  - "Arriving by Jan 25"
  - "Expected delivery: 23/01/2025"

---

## Examples

### Example 1: Amazon Order Confirmation
**Input Email:**
```
Subject: Your amazon.ae order #408-3351522-8481145 of 2 items
From: Amazon.ae <auto-confirm@amazon.ae>
Hello John, Thanks for your order. Order #408-3351522-8481145
Delivery to: Dubai Expected arrival: Jan 25, 2025
Total: AED 150.00
```

**Output:**
```json
{
  "extraction_success": true,
  "vendor": "Amazon",
  "customer_name": "John",
  "order_number": "408-3351522-8481145",
  "order_status": "Ordered",
  "delivery_info": {"location": "Dubai", "expected_date": "2025-01-25"},
  "items": [],
  "order_total": {"amount": "150.00", "currency": "AED"},
  "confidence": "High"
}
```

### Example 2: Noon Shipped Email
**Input Email:**
```
Subject: Your noon order is on the way! Order No.: 123456789
From: Noon <orders@noon.com>
Your order has been shipped! Order No.: 123456789
Shipping to: Abu Dhabi
Expected delivery: Jan 28, 2025
```

**Output:**
```json
{
  "extraction_success": true,
  "vendor": "Noon",
  "customer_name": null,
  "order_number": "123456789",
  "order_status": "Shipped",
  "delivery_info": {"location": "Abu Dhabi", "expected_date": "2025-01-28"},
  "items": [],
  "order_total": null,
  "confidence": "High"
}
```

### Example 3: Amazon Shipped with Items
**Input Email:**
```
Subject: Shipped: "Popsicle Molds, 40Pcs" and 1 more item(s)
From: Amazon.ae <ship-confirm@amazon.ae>
Order number 408-3351522-8481145
Your package is on the way to Dubai
Arriving: Jan 23
Item: Popsicle Molds, 40Pcs - AED 45.00
```

**Output:**
```json
{
  "extraction_success": true,
  "vendor": "Amazon",
  "customer_name": null,
  "order_number": "408-3351522-8481145",
  "order_status": "Shipped",
  "delivery_info": {"location": "Dubai", "expected_date": "Jan 23"},
  "items": [{"item_name": "Popsicle Molds, 40Pcs", "quantity": 1, "price": "45.00", "currency": "AED"}],
  "order_total": {"amount": "45.00", "currency": "AED"},
  "confidence": "High"
}
```

### Example 4: Carrefour Delivery
**Input Email:**
```
Subject: Your Carrefour order has been delivered!
From: Carrefour <noreply@carrefouruae.com>
Order #CAR-9876543
Delivered to: Al Quoz, Dubai
```

**Output:**
```json
{
  "extraction_success": true,
  "vendor": "Carrefour",
  "customer_name": null,
  "order_number": "CAR-9876543",
  "order_status": "Delivered",
  "delivery_info": {"location": "Dubai", "expected_date": null},
  "items": [],
  "order_total": null,
  "confidence": "High"
}
```

---

## Output Format - Return ONLY JSON

```json
{
  "extraction_success": true,
  "vendor": "Amazon",
  "customer_name": "John",
  "order_number": "408-3351522-8481145",
  "order_status": "Ordered",
  "delivery_info": {"location": "Dubai", "expected_date": "2025-01-25"},
  "items": [{"item_name": "Product Name", "quantity": 1, "price": "100.00", "currency": "AED"}],
  "order_total": {"amount": "100.00", "currency": "AED"},
  "confidence": "High"
}
```

If NO order number can be found:
```json
{"extraction_success": false, "error": "No order number found", "confidence": "Low"}
```

---

## Notes
- If confidence is Medium or Low, explain why in the error field
- Always try to extract at least the order number and vendor
- If vendor is unclear, use "Unknown" but still extract order number if found
- For dates, preserve the format shown in email or convert to YYYY-MM-DD if clear"""

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

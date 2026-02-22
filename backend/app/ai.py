import os
import json
import httpx
import logging

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM_PROMPT = """# Email Order Extraction Agent

## Role
You are an intelligent email parsing assistant specialized in extracting order information from e-commerce confirmation and shipping notification emails.

## Current Context
**Current Date & Time**: {now}
**Timezone**: UAE (GMT+4)

## Supported Vendors
- Amazon, Noon, Namshi, Sharaf DG, Carrefour, Other online retailers

## Information to Extract

### 1. **Order Number** (Required)
- Extract complete alphanumeric identifier

### 2. **Item Name(s)** (Required)
- Full product name/title, include brand, model, size, color if visible

### 3. **Price** (Required)
- Include currency (AED, USD, SAR, etc.)

### 4. **Order Status** (Required)
- "Ordered" | "Shipped" | "Out for Delivery" | "Delivered"

### 5. **Delivery Information**
- Location: City (usually Dubai or UAE)
- Expected Date: Date or day

### 6. **Customer Name**
- Extract from email if available

## Output Format
Return ONLY valid JSON (no markdown):
{{
  "extraction_success": true,
  "vendor": "Vendor Name",
  "customer_name": "Customer Name or null",
  "order_number": "408-3351522-8481145",
  "order_status": "Ordered",
  "delivery_info": {{"location": "Dubai", "expected_date": "2025-01-25"}},
  "items": [{{"item_name": "Product Name", "quantity": 1, "price": "100.00", "currency": "AED"}}],
  "order_total": {{"amount": "100.00", "currency": "AED"}},
  "confidence": "High"
}}

If extraction fails:
{{"extraction_success": false, "error": "reason", "confidence": "Low"}}"""

CLASSIFICATION_SYSTEM_PROMPT = """# Email Classification Agent

Classify as ORDER email if contains:
- Order numbers, tracking numbers, order IDs
- Order confirmation, shipped, delivery keywords
- Package, tracking, dispatched

Return ONLY valid JSON:
{{"isOrderEmail": true, "confidence": "High", "indicators": ["order number"], "reason": "Contains order number"}}"""


async def call_ai_api(prompt: str, user_content: str) -> dict:
    """Call GitHub AI API with better error handling"""
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        logger.error("GITHUB_TOKEN not set!")
        return {"error": "GITHUB_TOKEN not configured"}
    
    model = os.getenv("AI_MODEL", "openai/gpt-5")
    endpoint = os.getenv("AI_ENDPOINT", "https://models.github.ai/inference")
    
    logger.info(f"Calling AI API with model: {model}")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{endpoint}/chat/completions",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": user_content}
                    ],
                    "temperature": 0.1
                },
                timeout=30.0
            )
            
            logger.info(f"AI API response status: {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"AI API error: {error_text}")
                return {"error": f"API error: {response.status_code}", "details": error_text}
            
            result = response.json()
            logger.info(f"AI API result keys: {result.keys()}")
            
            if "choices" not in result:
                logger.error(f"No choices in result: {result}")
                return {"error": "No choices in API response", "details": str(result)}
            
            content = result["choices"][0]["message"]["content"]
            logger.info(f"AI content: {content[:200]}...")
            
            # Try to parse JSON from content
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                # Try to extract JSON from markdown
                import re
                json_match = re.search(r'\{[^{}]*\}', content, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group())
                raise
            
    except Exception as e:
        logger.error(f"AI API exception: {e}")
        return {"error": str(e)}


async def classify_email(subject: str, body: str) -> dict:
    """Classify if email is order-related."""
    content = f"Subject: {subject}\n\n{body[:2000]}"  # Limit body size
    
    try:
        result = await call_ai_api(CLASSIFICATION_SYSTEM_PROMPT, content)
        logger.info(f"Classification result: {result}")
        return result
    except Exception as e:
        logger.error(f"Classification error: {e}")
        return {"isOrderEmail": False, "confidence": "Low", "error": str(e)}


async def extract_order_data(subject: str, body: str) -> dict:
    """Extract order data from email."""
    content = f"Subject: {subject}\n\n{body[:3000]}"  # Limit body size
    now = "2026-02-22"
    
    try:
        result = await call_ai_api(EXTRACTION_SYSTEM_PROMPT.format(now=now), content)
        logger.info(f"Extraction result: {result}")
        return result
    except Exception as e:
        logger.error(f"Extraction error: {e}")
        return {"extraction_success": False, "error": str(e), "confidence": "Low"}

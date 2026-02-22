import os
import json
import httpx

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
Return JSON:
{{
  "extraction_success": true/false,
  "vendor": "Vendor Name",
  "customer_name": "Customer Name or null",
  "order_number": "Order Number",
  "order_status": "Ordered|Shipped|Out for Delivery|Delivered",
  "delivery_info": {{"location": "City", "expected_date": "Date"}},
  "items": [{{"item_name": "Product", "quantity": 1, "price": "100.00", "currency": "AED"}}],
  "order_total": {{"amount": "100.00", "currency": "AED"}},
  "confidence": "High|Medium|Low"
}}

If extraction fails: {{"extraction_success": false, "error": "reason", "confidence": "Low"}}"""

CLASSIFICATION_SYSTEM_PROMPT = """# Email Classification Agent

Classify as ORDER email if contains:
- Order numbers, tracking numbers, order IDs
- Order confirmation, shipped, delivery keywords
- Package, tracking, dispatched

Return JSON:
{{"isOrderEmail": true/false, "confidence": "High|Medium|Low", "indicators": ["list"], "reason": "text"}}"""


async def classify_email(subject: str, body: str) -> dict:
    """Classify if email is order-related."""
    content = f"Subject: {subject}\n\n{body}"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://models.github.ai/inference/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.getenv('GITHUB_TOKEN')}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "openai/gpt-5",
                    "messages": [
                        {"role": "system", "content": CLASSIFICATION_SYSTEM_PROMPT},
                        {"role": "user", "content": content}
                    ],
                    "temperature": 0.1
                },
                timeout=30.0
            )
            result = response.json()
            return json.loads(result["choices"][0]["message"]["content"])
    except Exception as e:
        print(f"Classification error: {e}")
        return {"isOrderEmail": False, "confidence": "Low", "error": str(e)}


async def extract_order_data(subject: str, body: str) -> dict:
    """Extract order data from email."""
    content = f"Subject: {subject}\n\n{body}"
    now = "2026-02-22"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://models.github.ai/inference/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.getenv('GITHUB_TOKEN')}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "openai/gpt-5",
                    "messages": [
                        {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT.format(now=now)},
                        {"role": "user", "content": content}
                    ],
                    "temperature": 0.1
                },
                timeout=30.0
            )
            result = response.json()
            return json.loads(result["choices"][0]["message"]["content"])
    except Exception as e:
        print(f"Extraction error: {e}")
        return {"extraction_success": False, "error": str(e), "confidence": "Low"}

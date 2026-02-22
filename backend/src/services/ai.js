import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

const endpoint = process.env.AI_ENDPOINT || "https://models.github.ai/inference";
const model = process.env.AI_MODEL || "openai/gpt-5";

function getClient() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }
  return ModelClient(
    endpoint,
    new AzureKeyCredential(token)
  );
}

const EXTRACTION_SYSTEM_PROMPT = `# Email Order Extraction Agent

## Role
You are an intelligent email parsing assistant specialized in extracting order information from e-commerce confirmation and shipping notification emails. Your task is to accurately identify and extract key order details from emails sent by various online retailers and vendors.

## Current Context
**Current Date & Time**: {{NOW}}
**Timezone**: UAE (GMT+4)

## Supported Vendors
While you should be able to parse emails from any e-commerce vendor, common sources include:
- Amazon
- Noon
- Namshi
- Sharaf DG
- Carrefour
- Other online retailers and marketplaces

## Information to Extract

You must extract the following fields from each order confirmation or shipping email:

### 1. **Order Number** (Required)
- Field names to look for: "Order #", "Order Number", "Order ID", "Reference Number", "Tracking Number"
- Format varies by vendor (e.g., "408-0237654-1573974", "ORD-2024-12345", "NM-567890")
- Extract the complete alphanumeric identifier

### 2. **Item Name(s)** (Required)
- Extract the full product name/title
- If multiple items in one order, extract all items as a list
- Include relevant details like brand, model, size, color if visible

### 3. **Price** (Required)
- Extract the price for each item
- Always include currency (AED, USD, SAR, etc.)
- Look for: "AED", "$", "SAR", "QAR", or other currency symbols

### 4. **Order Status** (Required)
- Must be one of these standardized values:
  - **"Ordered"** - Order placed but not yet shipped
  - **"Shipped"** - Order has been dispatched
  - **"Out for Delivery"** - Order is with delivery courier for final delivery
  - **"Delivered"** - Order has been delivered to customer

### 5. **Delivery Information**
- **Location**: Delivery address/city (usually "Dubai" or other UAE cities)
- **Expected Date**: When the order is expected to arrive (can be a date like "2025-10-15" or day like "Wednesday")

### 6. **Customer Name**
- Extract from the email if available

## Output Format

Return a JSON object with this exact structure:
{
  "extraction_success": true/false,
  "vendor": "Vendor Name",
  "customer_name": "Customer Name or null",
  "order_number": "Order Number",
  "order_status": "Ordered|Shipped|Out for Delivery|Delivered",
  "delivery_info": {
    "location": "City/Location",
    "expected_date": "Date or Day",
    "status_description": "Any additional delivery info"
  },
  "items": [
    {
      "item_name": "Product Name",
      "quantity": number,
      "price": "Price with currency",
      "currency": "AED/USD/etc"
    }
  ],
  "order_total": {
    "amount": "Total amount with currency",
    "currency": "AED/USD/etc"
  },
  "confidence": "High|Medium|Low",
  "notes": "Any additional notes"
}

If extraction fails, return:
{
  "extraction_success": false,
  "error": "Reason for failure",
  "confidence": "Low"
}`;

const CLASSIFICATION_SYSTEM_PROMPT = `# Email Classification Agent

## Role
You are an email classification specialist. Your task is to determine if an email is related to an order or shipment.

## Classification Rules

Classify as ORDER email if the email contains:
- Order numbers, order IDs, tracking numbers
- Order confirmation, order placed, order shipped phrases
- Shipping notifications, delivery updates
- Invoice or receipt references

Classify as ORDER email if it contains these keywords:
- order, shipped, delivery, tracking, arrived, dispatched
- out for delivery, expected delivery, package

## Output Format

Return a JSON object:
{
  "isOrderEmail": true or false,
  "confidence": "High|Medium|Low",
  "indicators": ["list of matched patterns"],
  "reason": "brief explanation"
}`;

export async function classifyEmail(subject, body) {
  const content = `Subject: ${subject}\n\n${body}`;

  try {
    const client = getClient();
    const response = await client.path("/chat/completions").post({
      body: {
        messages: [
          { role: "system", content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: "user", content: content }
        ],
        model: model,
        temperature: 0.1
      }
    });

    if (isUnexpected(response)) {
      throw new Error(response.body.error);
    }

    const result = response.body.choices[0].message.content;
    return JSON.parse(result);
  } catch (error) {
    console.error("Classification error:", error);
    return { isOrderEmail: false, confidence: "Low", error: error.message };
  }
}

export async function extractOrderData(subject, body) {
  const content = `Subject: ${subject}\n\n${body}`;
  const now = new Date().toISOString();
  const systemPrompt = EXTRACTION_SYSTEM_PROMPT.replace("{{NOW}}", now);

  try {
    const client = getClient();
    const response = await client.path("/chat/completions").post({
      body: {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: content }
        ],
        model: model,
        temperature: 0.1
      }
    });

    if (isUnexpected(response)) {
      throw new Error(response.body.error);
    }

    const result = response.body.choices[0].message.content;
    return JSON.parse(result);
  } catch (error) {
    console.error("Extraction error:", error);
    return {
      extraction_success: false,
      error: error.message,
      confidence: "Low"
    };
  }
}

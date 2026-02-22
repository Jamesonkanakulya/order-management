from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from ..database import get_db
from ..models import Order, OrderItem
from ..schemas import WebhookRequest, WebhookResponse
from ..ai import classify_email, extract_order_data
import uuid

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


def order_to_response(order):
    return {
        "id": order.id,
        "order_number": order.order_number,
        "vendor": order.vendor,
        "customer_name": order.customer_name,
        "status": order.status,
        "location": order.location,
        "expected_date": order.expected_date,
        "notes": order.notes,
        "created_at": order.created_at.isoformat() if order.created_at else "",
        "updated_at": order.updated_at.isoformat() if order.updated_at else "",
        "items": []
    }


@router.post("/order", response_model=WebhookResponse)
async def handle_webhook(body: WebhookRequest, db: AsyncSession = Depends(get_db)):
    if not body.body and not body.snippet:
        raise HTTPException(status_code=400, detail="Missing email content (body or snippet)")
    
    email_content = body.body or body.snippet
    
    classification = await classify_email(body.subject or "", email_content)
    
    if not classification.get("isOrderEmail", False):
        return {
            "message": "Email is not order-related",
            "action": "skipped"
        }
    
    extraction = await extract_order_data(body.subject or "", email_content)
    
    if not extraction.get("extraction_success", False):
        return {
            "message": "Failed to extract order data",
            "action": "failed",
            "classification": classification,
            "extraction": extraction
        }
    
    order_number = extraction.get("order_number")
    if not order_number:
        raise HTTPException(status_code=400, detail="Could not extract order number")
    
    vendor = extraction.get("vendor")
    customer_name = extraction.get("customer_name")
    order_status = extraction.get("order_status", "Ordered")
    delivery_info = extraction.get("delivery_info", {})
    items = extraction.get("items", [])
    
    result = await db.execute(select(Order).where(Order.order_number == order_number))
    existing_order = result.scalar_one_or_none()
    
    if existing_order:
        existing_order.vendor = vendor or existing_order.vendor
        existing_order.customer_name = customer_name or existing_order.customer_name
        existing_order.status = order_status or existing_order.status
        existing_order.location = delivery_info.get("location") or existing_order.location
        existing_order.expected_date = delivery_info.get("expected_date") or existing_order.expected_date
        existing_order.updated_at = datetime.utcnow()
        
        if items:
            await db.execute(OrderItem.__table__.delete().where(OrderItem.order_id == existing_order.id))
            for item in items:
                price = item.get("price")
                if isinstance(price, str):
                    price = float(price.replace("AED", "").replace("AED", "").replace("$", "").strip()) if price else None
                
                order_item = OrderItem(
                    id=str(uuid.uuid4()),
                    order_id=existing_order.id,
                    item_name=item.get("item_name"),
                    quantity=item.get("quantity", 1),
                    price=price,
                    currency=item.get("currency", "AED")
                )
                db.add(order_item)
        
        await db.commit()
        await db.refresh(existing_order)
        
        return {
            "message": "Order updated successfully",
            "action": "updated",
            "order": order_to_response(existing_order),
            "classification": classification,
            "extraction": extraction
        }
    else:
        new_order = Order(
            id=str(uuid.uuid4()),
            order_number=order_number,
            vendor=vendor or "Unknown",
            customer_name=customer_name or "Unknown",
            status=order_status or "Ordered",
            location=delivery_info.get("location", ""),
            expected_date=delivery_info.get("expected_date", "")
        )
        db.add(new_order)
        
        if items:
            for item in items:
                price = item.get("price")
                if isinstance(price, str):
                    price = float(price.replace("AED", "").replace("$", "").strip()) if price else None
                
                order_item = OrderItem(
                    id=str(uuid.uuid4()),
                    order_id=new_order.id,
                    item_name=item.get("item_name"),
                    quantity=item.get("quantity", 1),
                    price=price,
                    currency=item.get("currency", "AED")
                )
                db.add(order_item)
        
        await db.commit()
        await db.refresh(new_order)
        
        return {
            "message": "Order created successfully",
            "action": "created",
            "order": order_to_response(new_order),
            "classification": classification,
            "extraction": extraction
        }

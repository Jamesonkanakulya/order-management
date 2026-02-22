from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime
from .database import get_db
from .models import Order, OrderItem, Setting
from .schemas import (
    OrderCreate, OrderUpdate, OrderResponse, OrderListResponse,
    SettingResponse, VendorsResponse, StatusesResponse
)
import uuid

router = APIRouter(prefix="/api/orders", tags=["orders"])


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
        "items": [
            {
                "id": item.id,
                "order_id": item.order_id,
                "item_name": item.item_name,
                "quantity": item.quantity,
                "price": item.price,
                "currency": item.currency
            }
            for item in order.items
        ]
    }


@router.get("", response_model=OrderListResponse)
async def list_orders(
    status: str = None,
    vendor: str = None,
    search: str = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    query = select(Order)
    count_query = select(func.count(Order.id))
    
    if status:
        query = query.where(Order.status == status)
        count_query = count_query.where(Order.status == status)
    if vendor:
        query = query.where(Order.vendor == vendor)
        count_query = count_query.where(Order.vendor == vendor)
    if search:
        query = query.where(
            (Order.order_number.ilike(f"%{search}%")) | 
            (Order.customer_name.ilike(f"%{search}%"))
        )
        count_query = count_query.where(
            (Order.order_number.ilike(f"%{search}%")) | 
            (Order.customer_name.ilike(f"%{search}%"))
        )
    
    query = query.options(selectinload(Order.items)).order_by(Order.created_at.desc()).limit(limit).offset(offset)
    
    result = await db.execute(query)
    orders = result.scalars().all()
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    return {"orders": [order_to_response(o) for o in orders], "total": total}


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order_to_response(order)


@router.post("", response_model=OrderResponse, status_code=201)
async def create_order(body: OrderCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Order).where(Order.order_number == body.order_number))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Order number already exists")
    
    order = Order(
        id=str(uuid.uuid4()),
        order_number=body.order_number,
        vendor=body.vendor,
        customer_name=body.customer_name,
        status=body.status,
        location=body.location,
        expected_date=body.expected_date,
        notes=body.notes
    )
    db.add(order)
    
    if body.items:
        for item in body.items:
            order_item = OrderItem(
                id=str(uuid.uuid4()),
                order_id=order.id,
                item_name=item.item_name,
                quantity=item.quantity,
                price=item.price,
                currency=item.currency
            )
            db.add(order_item)
    
    await db.commit()
    await db.refresh(order)
    
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order.id)
    )
    order = result.scalar_one()
    return order_to_response(order)


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(order_id: str, body: OrderUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if body.order_number is not None:
        order.order_number = body.order_number
    if body.vendor is not None:
        order.vendor = body.vendor
    if body.customer_name is not None:
        order.customer_name = body.customer_name
    if body.status is not None:
        order.status = body.status
    if body.location is not None:
        order.location = body.location
    if body.expected_date is not None:
        order.expected_date = body.expected_date
    if body.notes is not None:
        order.notes = body.notes
    
    order.updated_at = datetime.utcnow()
    
    if body.items is not None:
        await db.execute(OrderItem.__table__.delete().where(OrderItem.order_id == order_id))
        for item in body.items:
            order_item = OrderItem(
                id=str(uuid.uuid4()),
                order_id=order.id,
                item_name=item.item_name,
                quantity=item.quantity,
                price=item.price,
                currency=item.currency
            )
            db.add(order_item)
    
    await db.commit()
    await db.refresh(order)
    
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order.id)
    )
    order = result.scalar_one()
    return order_to_response(order)


@router.delete("/{order_id}")
async def delete_order(order_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await db.delete(order)
    await db.commit()
    return {"message": "Order deleted successfully"}


@router.get("/search/{order_number}", response_model=OrderResponse)
async def search_order(order_number: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.order_number == order_number)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order_to_response(order)

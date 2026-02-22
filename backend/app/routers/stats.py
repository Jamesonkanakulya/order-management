from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from ..database import get_db
from ..models import Order
from ..schemas import StatsResponse

router = APIRouter(prefix="/api/stats", tags=["stats"])


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


@router.get("", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_result = await db.execute(select(func.count(Order.id)))
    total_orders = total_result.scalar() or 0
    
    status_result = await db.execute(
        select(Order.status, func.count(Order.id)).group_by(Order.status)
    )
    orders_by_status = [{"status": r[0], "count": r[1]} for r in status_result.all()]
    
    vendor_result = await db.execute(
        select(Order.vendor, func.count(Order.id)).group_by(Order.vendor).order_by(func.count(Order.id).desc())
    )
    orders_by_vendor = [{"vendor": r[0], "count": r[1]} for r in vendor_result.all()]
    
    recent_result = await db.execute(
        select(Order).order_by(Order.created_at.desc()).limit(5)
    )
    recent_orders = [order_to_response(o) for o in recent_result.scalars().all()]
    
    pending_result = await db.execute(
        select(func.count(Order.id)).where(Order.status != "Delivered")
    )
    pending_delivery = pending_result.scalar() or 0
    
    month_delivery_result = await db.execute(
        select(func.count(Order.id)).where(
            Order.status == "Delivered",
            func.strftime("%Y-%m", Order.created_at) == func.strftime("%Y-%m", "now")
        )
    )
    delivered_this_month = month_delivery_result.scalar() or 0
    
    return {
        "total_orders": total_orders,
        "orders_by_status": orders_by_status,
        "orders_by_vendor": orders_by_vendor,
        "recent_orders": recent_orders,
        "pending_delivery": pending_delivery,
        "delivered_this_month": delivered_this_month
    }

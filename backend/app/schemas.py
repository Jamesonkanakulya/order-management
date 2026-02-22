from pydantic import BaseModel
from typing import Optional


class OrderItemBase(BaseModel):
    item_name: Optional[str] = None
    quantity: int = 1
    price: Optional[float] = None
    currency: str = "AED"


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemResponse(OrderItemBase):
    id: str
    order_id: str

    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    order_number: str
    vendor: Optional[str] = None
    customer_name: Optional[str] = None
    status: str = "Ordered"
    location: Optional[str] = None
    expected_date: Optional[str] = None
    notes: Optional[str] = None


class OrderCreate(OrderBase):
    items: list[OrderItemCreate] = []


class OrderUpdate(BaseModel):
    order_number: Optional[str] = None
    vendor: Optional[str] = None
    customer_name: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    expected_date: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[list[OrderItemCreate]] = None


class OrderResponse(OrderBase):
    id: str
    created_at: str
    updated_at: str
    items: list[OrderItemResponse] = []

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    orders: list[OrderResponse]
    total: int


class SettingResponse(BaseModel):
    key: str
    value: Optional[str] = None


class VendorsResponse(BaseModel):
    vendors: list[str]


class StatusesResponse(BaseModel):
    statuses: list[str]


class WebhookRequest(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    snippet: Optional[str] = None
    from_email: Optional[str] = None


class WebhookResponse(BaseModel):
    message: str
    action: Optional[str] = None
    order: Optional[OrderResponse] = None
    classification: Optional[dict] = None
    extraction: Optional[dict] = None


class StatsResponse(BaseModel):
    total_orders: int
    orders_by_status: list[dict]
    orders_by_vendor: list[dict]
    recent_orders: list[OrderResponse]
    pending_delivery: int
    delivered_this_month: int

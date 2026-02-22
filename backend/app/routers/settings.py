from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import Setting
from ..schemas import SettingResponse, VendorsResponse, StatusesResponse

router = APIRouter(prefix="/api/settings", tags=["settings"])

DEFAULT_VENDORS = ["Amazon", "Noon", "Namshi", "Sharaf DG", "Carrefour", "Other"]
DEFAULT_STATUSES = ["Ordered", "Shipped", "Out for Delivery", "Delivered"]


@router.get("")
async def get_all_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting))
    settings = result.scalars().all()
    settings_obj = {}
    for s in settings:
        try:
            settings_obj[s.key] = eval(s.value) if s.value.startswith("[") else s.value
        except:
            settings_obj[s.key] = s.value
    
    if "vendors" not in settings_obj:
        settings_obj["vendors"] = DEFAULT_VENDORS
    if "statuses" not in settings_obj:
        settings_obj["statuses"] = DEFAULT_STATUSES
    
    return settings_obj


@router.get("/vendors", response_model=VendorsResponse)
async def get_vendors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).where(Setting.key == "vendors"))
    setting = result.scalar_one_or_none()
    if not setting:
        return {"vendors": DEFAULT_VENDORS}
    try:
        return {"vendors": eval(setting.value)}
    except:
        return {"vendors": [setting.value]}


@router.put("/vendors")
async def update_vendors(body: VendorsResponse, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).where(Setting.key == "vendors"))
    setting = result.scalar_one_or_none()
    
    value = str(body.vendors)
    
    if setting:
        setting.value = value
    else:
        setting = Setting(key="vendors", value=value)
        db.add(setting)
    
    await db.commit()
    return {"vendors": body.vendors}


@router.get("/statuses", response_model=StatusesResponse)
async def get_statuses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).where(Setting.key == "statuses"))
    setting = result.scalar_one_or_none()
    if not setting:
        return {"statuses": DEFAULT_STATUSES}
    try:
        return {"statuses": eval(setting.value)}
    except:
        return {"statuses": [setting.value]}


@router.put("/statuses")
async def update_statuses(body: StatusesResponse, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).where(Setting.key == "statuses"))
    setting = result.scalar_one_or_none()
    
    value = str(body.statuses)
    
    if setting:
        setting.value = value
    else:
        setting = Setting(key="statuses", value=value)
        db.add(setting)
    
    await db.commit()
    return {"statuses": body.statuses}


@router.get("/{key}", response_model=SettingResponse)
async def get_setting(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return {"key": setting.key, "value": setting.value}


@router.put("/{key}")
async def update_setting(key: str, body: dict, db: AsyncSession = Depends(get_db)):
    value = body.get("value")
    if isinstance(value, list):
        value = str(value)
    
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.value = value
    else:
        setting = Setting(key=key, value=value)
        db.add(setting)
    
    await db.commit()
    return {"key": key, "value": value}

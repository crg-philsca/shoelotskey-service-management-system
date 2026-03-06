from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime
from decimal import Decimal

# ==========================================
# 1. LOOKUP SCHEMAS
# ==========================================

class RoleSchema(BaseModel):
    role_id: Optional[int] = None
    role_name: str
    class Config:
        from_attributes = True

class StatusSchema(BaseModel):
    status_id: Optional[int] = None
    status_name: str
    class Config:
        from_attributes = True

class ConditionSchema(BaseModel):
    condition_id: Optional[int] = None
    condition_name: str
    class Config:
        from_attributes = True

# ==========================================
# 2. USERS & CUSTOMERS
# ==========================================

class UserSchema(BaseModel):
    user_id: Optional[int] = None
    username: str
    email: str
    role_id: int
    is_active: bool = True
    created_at: Optional[datetime] = None
    role: Optional[RoleSchema] = None
    class Config:
        from_attributes = True

class CustomerSchema(BaseModel):
    customer_id: Optional[int] = None
    customer_name: str
    contact_number: str
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# ==========================================
# 3. SERVICES & EXPENSES
# ==========================================

class ServiceSchema(BaseModel):
    service_id: Optional[int] = None
    service_name: str
    base_price: Decimal
    is_active: bool = True
    class Config:
        from_attributes = True

class ExpenseSchema(BaseModel):
    expense_id: Optional[int] = None
    amount: Decimal
    description: Optional[str] = None
    expense_date: datetime
    user_id: int
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# ==========================================
# 4. ORDERS & ITEMS
# ==========================================

class ItemSchema(BaseModel):
    item_id: Optional[int] = None
    order_id: Optional[int] = None
    brand: Optional[str] = None
    material: Optional[str] = None
    conditions: List[ConditionSchema] = []
    services: List[ServiceSchema] = []
    class Config:
        from_attributes = True

class OrderSchema(BaseModel):
    order_id: Optional[int] = None
    order_number: str
    customer_id: int
    status_id: int
    priority: str = 'Regular'
    grand_total: Decimal
    expected_at: datetime
    released_at: Optional[datetime] = None
    claimed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    user_id: int
    
    customer: Optional[CustomerSchema] = None
    status: Optional[StatusSchema] = None
    items: List[ItemSchema] = []
    class Config:
        from_attributes = True

# ==========================================
# 5. LOGGING
# ==========================================

class StatusLogSchema(BaseModel):
    status_log_id: Optional[int] = None
    order_id: int
    status_id: int
    user_id: int
    changed_at: datetime
    class Config:
        from_attributes = True

class AuditLogSchema(BaseModel):
    audit_log_id: Optional[int] = None
    user_id: int
    action_type: str
    table_name: str
    record_id: int
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    created_at: datetime
    class Config:
        from_attributes = True

# ==========================================
# 6. REQUEST SCHEMAS
# ==========================================

class LoginRequest(BaseModel):
    username: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

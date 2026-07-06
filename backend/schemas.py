from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
import re

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

class ServiceCategorySchema(BaseModel):
    category_id: Optional[int] = None
    category_name: str
    class Config:
        from_attributes = True

class ConditionSchema(BaseModel):
    condition_id: Optional[int] = None
    condition_name: str
    class Config:
        from_attributes = True

class PaymentMethodSchema(BaseModel):
    method_id: Optional[int] = None
    method_name: str
    class Config:
        from_attributes = True

class PaymentStatusSchema(BaseModel):
    p_status_id: Optional[int] = None
    status_name: str
    class Config:
        from_attributes = True

class ShippingPreferenceSchema(BaseModel):
    pref_id: Optional[int] = None
    pref_name: str
    class Config:
        from_attributes = True

class PriorityLevelSchema(BaseModel):
    priority_id: Optional[int] = None
    priority_name: str
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

class UserCreateSchema(BaseModel):
    username: str
    email: str
    password: str
    role_name: str = 'staff'
    is_active: bool = True

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long.')
        if not re.search(r"[a-z]", v):
            raise ValueError('Password must contain at least one lowercase letter.')
        if not re.search(r"[A-Z]", v):
            raise ValueError('Password must contain at least one uppercase letter.')
        if not re.search(r"\d", v):
            raise ValueError('Password must contain at least one digit.')
        return v

class UserUpdateSchema(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role_name: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long.')
        if not re.search(r"[a-z]", v):
            raise ValueError('Password must contain at least one lowercase letter.')
        if not re.search(r"[A-Z]", v):
            raise ValueError('Password must contain at least one uppercase letter.')
        if not re.search(r"\d", v):
            raise ValueError('Password must contain at least one digit.')
        return v

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
    category_id: int
    description: Optional[str] = None
    duration_days: int = 0
    service_code: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0
    
    category: Optional[ServiceCategorySchema] = None
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
# 4. ORDERS & ITEMS (3NF Nesting)
# ==========================================

class ItemSchema(BaseModel):
    item_id: Optional[int] = None
    order_id: Optional[int] = None
    brand: Optional[str] = None
    shoe_model: Optional[str] = None
    material: Optional[str] = None
    quantity: int = 1
    item_notes: Optional[str] = None
    inventory_used: Optional[Any] = None
    
    services: List[ServiceSchema] = []
    conditions: List[ConditionSchema] = []
    class Config:
        from_attributes = True

class PaymentSchema(BaseModel):
    payment_id: Optional[int] = None
    method_id: int
    status_id: int
    amount_received: Decimal = 0.0
    balance: Decimal = 0.0
    reference_no: Optional[str] = None
    deposit_amount: Decimal = 0.0
    created_at: Optional[datetime] = None
    
    method: Optional[PaymentMethodSchema] = None
    p_status: Optional[PaymentStatusSchema] = None
    class Config:
        from_attributes = True

class DeliverySchema(BaseModel):
    delivery_id: Optional[int] = None
    pref_id: int
    delivery_address: Optional[str] = None
    delivery_courier: Optional[str] = None
    release_time: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    barangay: Optional[str] = None
    zip_code: Optional[str] = None
    
    preference: Optional[ShippingPreferenceSchema] = None
    class Config:
        from_attributes = True

class OrderSchema(BaseModel):
    order_id: Optional[int] = None
    order_number: str
    customer_id: int
    status_id: int
    priority_id: int
    grand_total: Decimal
    
    expected_at: datetime
    released_at: Optional[datetime] = None
    claimed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    user_id: int
    inventory_applied: bool = False
    inventory_used: Optional[Any] = None
    
    customer: Optional[CustomerSchema] = None
    status: Optional[StatusSchema] = None
    priority: Optional[PriorityLevelSchema] = None
    processor: Optional[UserSchema] = None
    payments: List[PaymentSchema] = []
    delivery: Optional[DeliverySchema] = None
    items: List[ItemSchema] = []
    status_logs: List['StatusLogSchema'] = []

    class Config:
        from_attributes = True

# ==========================================
# 5. LOGGING SCHEMAS
# ==========================================

class StatusLogSchema(BaseModel):
    status_log_id: Optional[int] = None
    order_id: int
    status_id: int
    user_id: int
    changed_at: datetime
    
    status: Optional[StatusSchema] = None
    user: Optional[UserSchema] = None

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
# 6. REQUEST SCHEMAS (Client Input)
# ==========================================

class LoginRequest(BaseModel):
    username: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long.')
        if not re.search(r"[a-z]", v):
            raise ValueError('Password must contain at least one lowercase letter.')
        if not re.search(r"[A-Z]", v):
            raise ValueError('Password must contain at least one uppercase letter.')
        if not re.search(r"\d", v):
            raise ValueError('Password must contain at least one digit.')
        return v

# ==========================================
# 7. INVENTORY SCHEMAS
# ==========================================

class InventorySchema(BaseModel):
    item_id: Optional[int] = None
    item_name: str
    category: Optional[str] = None
    stock_quantity: float = 0.0
    unit: Optional[str] = None
    unit_price: Decimal = 0.0
    status: Optional[str] = None
    is_active: bool = True
    
    # Automated consumption fields
    auto_deduct: bool = False
    auto_deduct_trigger: str = "Job Started"
    trigger_service: str = "All"
    consumption_qty: float = 0.0
    consumption_unit: str = ""
    package_size: float = 0.0
    package_unit: str = ""

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class InventoryUpdateSchema(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    stock_quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    
    # Automated consumption fields
    auto_deduct: Optional[bool] = None
    auto_deduct_trigger: Optional[str] = None
    trigger_service: Optional[str] = None
    consumption_qty: Optional[float] = None
    consumption_unit: Optional[str] = None
    package_size: Optional[float] = None
    package_unit: Optional[str] = None

class InventoryLogSchema(BaseModel):
    log_id: Optional[int] = None
    item_id: int
    change_amount: float
    action_type: str
    order_id: Optional[int] = None
    user_id: int
    created_at: datetime
    class Config:
        from_attributes = True

"""
DATA SCHEMAS - PYDANTIC MODELS
==============================
This module handles data validation, serialization, and type-hinting.
It defines the contracts between the React Frontend and Python Backend.
"""

from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime
from decimal import Decimal

# ==========================================
# 1. LOOKUP SCHEMAS
# ==========================================

class RoleSchema(BaseModel):
    """Schema for user roles."""
    role_id: Optional[int] = None
    role_name: str
    class Config:
        from_attributes = True

class StatusSchema(BaseModel):
    """Schema for order status (e.g., Pending)."""
    status_id: Optional[int] = None
    status_name: str
    class Config:
        from_attributes = True



# ==========================================
# 2. USERS & CUSTOMERS
# ==========================================

class UserSchema(BaseModel):
    """Detailed User information for session management."""
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
    """Customer profile information."""
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
    """Available cleaning/repair services."""
    service_id: Optional[int] = None
    service_name: str
    base_price: Decimal
    category: str = 'base'
    description: Optional[str] = None
    duration_days: int = 0
    service_code: Optional[str] = None
    is_active: bool = True
    class Config:
        from_attributes = True

class ExpenseSchema(BaseModel):
    """Business overhead logging."""
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
    """Individual shoe details within an order."""
    item_id: Optional[int] = None
    order_id: Optional[int] = None
    brand: Optional[str] = None
    shoe_model: Optional[str] = None
    material: Optional[str] = None
    quantity: int = 1
    item_notes: Optional[str] = None
    # Denormalized Conditions
    cond_scratches: bool = False
    cond_yellowing: bool = False
    cond_ripsholes: bool = False
    cond_deepstains: bool = False
    cond_soleseparation: bool = False
    cond_wornout: bool = False
    
    services: List[ServiceSchema] = []
    class Config:
        from_attributes = True

class PaymentSchema(BaseModel):
    payment_id: Optional[int] = None
    payment_method: str = 'cash'
    payment_status: str = 'fully-paid'
    amount_received: Decimal = 0.0
    balance: Decimal = 0.0
    reference_no: Optional[str] = None
    deposit_amount: Decimal = 0.0
    class Config:
        from_attributes = True

class DeliverySchema(BaseModel):
    delivery_id: Optional[int] = None
    shipping_preference: str = 'pickup'
    delivery_address: Optional[str] = None
    delivery_courier: Optional[str] = None
    release_time: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    barangay: Optional[str] = None
    zip_code: Optional[str] = None
    class Config:
        from_attributes = True

class OrderSchema(BaseModel):
    """Comprehensive Order Header with nested Items and Customer data."""
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
    
    # 3NF Relationship hydration
    customer: Optional[CustomerSchema] = None
    status: Optional[StatusSchema] = None
    processor: Optional[UserSchema] = None
    payment: Optional[PaymentSchema] = None
    delivery: Optional[DeliverySchema] = None
    items: List[ItemSchema] = []
    status_logs: List['StatusLogSchema'] = []



    class Config:
        from_attributes = True

# ==========================================
# 5. LOGGING SCHEMAS
# ==========================================

class StatusLogSchema(BaseModel):
    """Historical trace of order status changes."""
    status_log_id: Optional[int] = None
    order_id: int
    status_id: int
    user_id: int
    changed_at: datetime
    
    # Relationships
    status: Optional[StatusSchema] = None
    user: Optional[UserSchema] = None

    class Config:
        from_attributes = True

class AuditLogSchema(BaseModel):
    """Generic audit trail entry."""
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
    """Payload for user authentication."""
    username: str
    password: str

class ForgotPasswordRequest(BaseModel):
    """Payload for password recovery."""
    email: str

class ResetPasswordRequest(BaseModel):
    """Payload for password update."""
    token: str
    new_password: str

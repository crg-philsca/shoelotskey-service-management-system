from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict

class UserSchema(BaseModel):
    id: str
    username: str
    role: str
    email: Optional[str] = None
    active: bool
    failed_login_attempts: Optional[int] = 0
    locked_until: Optional[str] = None
    
    class Config:
        from_attributes = True

class CustomerSchema(BaseModel):
    id: Optional[int] = None
    fullName: str
    contactNumber: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None

    class Config:
        from_attributes = True

class OrderItemSchema(BaseModel):
    id: Optional[int] = None
    brand: Optional[str] = None
    shoeType: Optional[str] = None
    material: Optional[str] = None
    quantity: int = 1
    conditionData: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class JobOrderSchema(BaseModel):
    id: str
    orderNumber: str
    status: str
    priorityLevel: str
    totalAmount: float
    amountReceived: float
    paymentMethod: Optional[str] = None
    paymentStatus: str
    transactionDate: str
    predictedCompletion: Optional[str] = None
    actualCompletion: Optional[str] = None
    shippingPreference: Optional[str] = None
    
    customerId: int
    processedBy: str
    
    # 3NF Relation Mapping
    customer: Optional[CustomerSchema] = None
    items: List[OrderItemSchema] = []

    class Config:
        from_attributes = True

class ServiceSchema(BaseModel):
    id: str
    name: str
    basePrice: float
    category: str
    active: bool
    description: Optional[str] = None
    durationDays: Optional[int] = None
    code: Optional[str] = None

    class Config:
        from_attributes = True

class ExpenseSchema(BaseModel):
    id: str
    category: str
    amount: float
    date: str
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class ActivityLogSchema(BaseModel):
    id: int
    timestamp: str
    userId: str
    action: str
    details: str
    logType: str

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    username: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

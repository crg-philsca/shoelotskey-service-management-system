from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict

class JobOrderSchema(BaseModel):
    id: str
    orderNumber: str
    customerName: str
    contactNumber: str
    brand: str
    shoeType: str
    shoeMaterial: str
    quantity: int
    condition: Dict[str, Any]
    baseService: List[str]
    addOns: List[Dict[str, Any]]
    priorityLevel: str
    baseServiceFee: float
    addOnsTotal: float
    grandTotal: float
    shippingPreference: str
    deliveryAddress: Optional[str] = None
    deliveryCourier: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    barangay: Optional[str] = None
    zipCode: Optional[str] = None
    paymentMethod: str
    paymentStatus: str
    amountReceived: Optional[float] = 0.0
    change: Optional[float] = 0.0
    transactionDate: str
    processedBy: str
    status: str
    predictedCompletionDate: Optional[str] = None
    actualCompletionDate: Optional[str] = None
    createdAt: str
    updatedAt: str
    items: Optional[List[Dict[str, Any]]] = None
    releaseTime: Optional[str] = None
    claimedBy: Optional[str] = None
    assignedTo: Optional[str] = None
    statusHistory: List[Dict[str, Any]]

class ServiceSchema(BaseModel):
    id: str
    name: str
    price: float
    category: str
    active: bool
    description: Optional[str] = None
    durationDays: Optional[Any] = None
    code: Optional[str] = None

class ExpenseSchema(BaseModel):
    id: str
    category: str
    amount: float
    date: str
    notes: Optional[str] = None

class ActivityLogSchema(BaseModel):
    id: str
    timestamp: str
    user: str
    action: str
    details: str
    type: str

class UserSchema(BaseModel):
    id: str
    username: str
    role: str
    email: Optional[str] = None
    password: Optional[str] = None
    active: bool

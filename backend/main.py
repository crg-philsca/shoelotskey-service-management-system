from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Any
from datetime import datetime, timedelta
import uuid

from models import Base, JobOrder, Service, Expense, ActivityLog, User, Customer, OrderItem
from schemas import (
    JobOrderSchema, ServiceSchema, ExpenseSchema, ActivityLogSchema, 
    UserSchema, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest
)
from database import engine, get_db, SessionLocal

# Force table creation (Ensures MySQL is up to date with 3NF model)
Base.metadata.create_all(bind=engine)

def seed_services(db: Session):
    if db.query(Service).count() == 0:
        from lib.initial_data import mock_services
        for s_data in mock_services:
            db_service = Service(
                id=s_data.get("id"),
                name=s_data.get("name"),
                basePrice=s_data.get("price"),
                category=s_data.get("category"),
                active=s_data.get("active", True),
                description=s_data.get("description"),
                durationDays=int(s_data.get("durationDays", 0)) if s_data.get("durationDays") else 0,
                code=s_data.get("code")
            )
            db.add(db_service)
        db.commit()

app = FastAPI(title="Shoelotskey 3NF & ML API")

@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        seed_services(db)
        # Seed users if missing
        if db.query(User).count() == 0:
            owner = User(id="u1", username="owner", password="owner123", role="owner", email="owner@shoelotskey.com")
            staff = User(id="u2", username="staff", password="staff123", role="staff", email="staff@shoelotskey.com")
            db.add_all([owner, staff])
            db.commit()
    finally:
        db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------
# JOB ORDERS (3NF & ML Logic)
# -----------------
@app.get("/api/orders", response_model=List[JobOrderSchema])
def read_orders(db: Session = Depends(get_db)):
    # joinedload ensures we get customer and items for ML/UI context
    orders = db.query(JobOrder).options(joinedload(JobOrder.customer), joinedload(JobOrder.items)).all()
    return orders

@app.post("/api/orders", response_model=JobOrderSchema)
def create_order(order_data: Dict[str, Any], db: Session = Depends(get_db)):
    try:
        # 1. 3NF NORMALIZATION: Handle/Create Customer
        fullname = order_data.get("customerName", "Unknown")
        contact = order_data.get("contactNumber", "")
        
        db_customer = db.query(Customer).filter(Customer.fullName == fullname, Customer.contactNumber == contact).first()
        if not db_customer:
            db_customer = Customer(
                fullName=fullname,
                contactNumber=contact,
                email=order_data.get("email"),
                city=order_data.get("city"),
                province=order_data.get("province"),
                address=order_data.get("deliveryAddress")
            )
            db.add(db_customer)
            db.flush()

        # 2. 3NF/ML Header: Job Order Creation
        new_id = order_data.get("id") or str(uuid.uuid4())
        db_order = JobOrder(
            id=new_id,
            orderNumber=order_data.get("orderNumber"),
            status=order_data.get("status", "Pending"),
            priorityLevel=order_data.get("priorityLevel", "Standard"),
            totalAmount=order_data.get("grandTotal", 0.0),
            amountReceived=order_data.get("amountReceived", 0.0),
            paymentMethod=order_data.get("paymentMethod"),
            paymentStatus=order_data.get("paymentStatus", "Unpaid"),
            transactionDate=order_data.get("transactionDate", datetime.now().isoformat()),
            predictedCompletion=order_data.get("predictedCompletionDate"), # ML Output
            actualCompletion=order_data.get("actualCompletionDate"), # ML Target
            shippingPreference=order_data.get("shippingPreference"),
            customerId=db_customer.id,
            processedBy=order_data.get("processedBy", "u1")
        )
        db.add(db_order)

        # 3. 3NF/ML Items: Order Items for categorical prediction
        items_payload = order_data.get("items", [])
        if not items_payload:
            items_payload = [{
                "brand": order_data.get("brand"),
                "shoeType": order_data.get("shoeType"),
                "material": order_data.get("shoeMaterial"),
                "quantity": order_data.get("quantity", 1),
                "condition": order_data.get("condition")
            }]

        for item in items_payload:
            db_item = OrderItem(
                orderId=new_id,
                brand=item.get("brand"),
                shoeType=item.get("shoeType"),
                material=item.get("material") or item.get("shoeMaterial"),
                quantity=item.get("quantity", 1),
                conditionData=item.get("condition") # ML Features
            )
            db.add(db_item)

        db.commit()
        db.refresh(db_order)
        return db_order
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Creation Error: {str(e)}")

@app.delete("/api/orders/{order_id}")
def delete_order(order_id: str, db: Session = Depends(get_db)):
    db_order = db.query(JobOrder).filter(JobOrder.id == order_id).first()
    if db_order:
        db.delete(db_order)
        db.commit()
    return {"ok": True}

# -----------------
# SERVICES
# -----------------
@app.get("/api/services", response_model=List[ServiceSchema])
def read_services(db: Session = Depends(get_db)):
    return db.query(Service).all()

# -----------------
# AUTHENTICATION
# -----------------
@app.post("/api/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == request.username).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if db_user.locked_until:
        locked_time = datetime.fromisoformat(db_user.locked_until)
        if datetime.utcnow() < locked_time:
            raise HTTPException(status_code=403, detail="Account locked.")
        else:
            db_user.locked_until = None
            db_user.failed_login_attempts = 0
            db.commit()

    if db_user.password == request.password:
        db_user.failed_login_attempts = 0
        db.commit()
        return {"username": db_user.username, "role": db_user.role, "id": db_user.id}
    else:
        db_user.failed_login_attempts += 1
        if db_user.failed_login_attempts >= 3:
            db_user.locked_until = (datetime.utcnow() + timedelta(minutes=15)).isoformat()
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")

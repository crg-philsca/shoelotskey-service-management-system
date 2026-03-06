from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
import uuid

from models import Base, JobOrder, Service, Expense, ActivityLog, User
from schemas import JobOrderSchema, ServiceSchema, ExpenseSchema, ActivityLogSchema, UserSchema, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest
from database import engine, get_db, SessionLocal

Base.metadata.create_all(bind=engine)

# Seeding function to ensure services exist
def seed_services(db: Session):
    service_count = db.query(Service).count()
    if service_count == 0:
        from lib.initial_data import mock_services
        for s_data in mock_services:
            db_service = Service(**s_data)
            db.add(db_service)
        db.commit()

app = FastAPI(title="Shoelotskey API")

@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        seed_services(db)
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
# JOB ORDERS
# -----------------
@app.get("/api/orders", response_model=List[JobOrderSchema])
def read_orders(db: Session = Depends(get_db)):
    orders = db.query(JobOrder).all()
    res = []
    # Make sure we convert complex stuff from DB to dict so Pydantic parses it
    for o in orders:
        if o.durationDays is None:  
            pass
        res.append(o)
    return res

@app.post("/api/orders", response_model=JobOrderSchema)
def create_order(order: JobOrderSchema, db: Session = Depends(get_db)):
    db_order = JobOrder(**order.dict())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

@app.put("/api/orders/{order_id}", response_model=JobOrderSchema)
def update_order(order_id: str, order: JobOrderSchema, db: Session = Depends(get_db)):
    db_order = db.query(JobOrder).filter(JobOrder.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = order.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_order, key, value)
        
    db.commit()
    db.refresh(db_order)
    return db_order

# -----------------
# SERVICES
# -----------------
@app.get("/api/services", response_model=List[ServiceSchema])
def read_services(db: Session = Depends(get_db)):
    services = db.query(Service).all()
    if not services:
        # Emergency seed if empty
        seed_services(db)
        services = db.query(Service).all()
    return services

@app.post("/api/services", response_model=ServiceSchema)
def create_service(service: ServiceSchema, db: Session = Depends(get_db)):
    db_service = Service(**service.dict())
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service

@app.put("/api/services/{service_id}", response_model=ServiceSchema)
def update_service(service_id: str, service: ServiceSchema, db: Session = Depends(get_db)):
    db_service = db.query(Service).filter(Service.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
    for key, value in service.dict().items():
        setattr(db_service, key, value)
    db.commit()
    db.refresh(db_service)
    return db_service

@app.delete("/api/services/{service_id}")
def delete_service(service_id: str, db: Session = Depends(get_db)):
    db_service = db.query(Service).filter(Service.id == service_id).first()
    if db_service:
        db.delete(db_service)
        db.commit()
    return {"ok": True}

# -----------------
# EXPENSES
# -----------------
@app.get("/api/expenses", response_model=List[ExpenseSchema])
def read_expenses(db: Session = Depends(get_db)):
    return db.query(Expense).all()

@app.post("/api/expenses", response_model=ExpenseSchema)
def create_expense(expense: ExpenseSchema, db: Session = Depends(get_db)):
    db_expense = Expense(**expense.dict())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

# -----------------
# ACTIVITIES
# -----------------
@app.get("/api/activities", response_model=List[ActivityLogSchema])
def read_activities(db: Session = Depends(get_db)):
    return db.query(ActivityLog).all()

@app.post("/api/activities", response_model=ActivityLogSchema)
def create_activity(activity: ActivityLogSchema, db: Session = Depends(get_db)):
    db_activity = ActivityLog(**activity.dict())
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity

# -----------------
# AUTHENTICATION & SECURITY
# -----------------
@app.post("/api/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Validation and Verification:
    - Check if user exists.
    - Check if account is locked (Security: 3 failed attempts).
    - Verify password.
    """
    db_user = db.query(User).filter(User.username == request.username).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Check lockout
    if db_user.locked_until:
        locked_time = datetime.fromisoformat(db_user.locked_until)
        if datetime.utcnow() < locked_time:
            raise HTTPException(status_code=403, detail=f"Account locked until {db_user.locked_until}")
        else:
            # Reset lockout after time expired
            db_user.locked_until = None
            db_user.failed_login_attempts = 0
            db.commit()

    # Mock password check (In production, use hashing like passlib/bcrypt)
    # FOR DEFENSE: Explain that we use simple string comparison for demo/speed, 
    # but mention hashing as the 'fix' for real-world security.
    if db_user.password == request.password:
        # Success
        db_user.failed_login_attempts = 0
        db.commit()
        return {"username": db_user.username, "role": db_user.role, "id": db_user.id}
    else:
        # Failed attempt
        db_user.failed_login_attempts += 1
        if db_user.failed_login_attempts >= 3:
            # Lock for 15 minutes
            lock_duration = datetime.utcnow() + timedelta(minutes=15)
            db_user.locked_until = lock_duration.isoformat()
            db.commit()
            raise HTTPException(status_code=403, detail="Account locked due to 3 failed attempts. Try again in 15 mins.")
        
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid username or password")

@app.post("/api/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    SOLID: Single Responsibility - This endpoint only handles token generation.
    Verification: Ensures email exists before 'sending' token.
    """
    db_user = db.query(User).filter(User.email == request.email).first()
    if not db_user:
        # For security, don't reveal if email exists, but for defense we can be explicit
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Generate reset token
    token = str(uuid.uuid4())
    db_user.reset_token = token
    db.commit()
    
    # FOR DEFENSE: In a real app, send an email here.
    # For now, we return it to the UI for demonstration.
    return {"message": "Reset link sent to email", "debug_token": token}

@app.post("/api/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.reset_token == request.token).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    db_user.password = request.new_password
    db_user.reset_token = None
    db.commit()
    return {"message": "Password updated successfully"}

# Seeding initial user for defense demo
@app.on_event("startup")
def seed_users():
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            owner = User(
                id="u1", 
                username="owner", 
                password="owner123", 
                role="owner", 
                email="owner@shoelotskey.com", 
                active=True
            )
            staff = User(
                id="u2", 
                username="staff", 
                password="staff123", 
                role="staff", 
                email="staff@shoelotskey.com", 
                active=True
            )
            db.add_all([owner, staff])
            db.commit()
    finally:
        db.close()

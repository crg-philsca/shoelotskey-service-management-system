from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from models import Base, JobOrder, Service, Expense, ActivityLog, User
from schemas import JobOrderSchema, ServiceSchema, ExpenseSchema, ActivityLogSchema, UserSchema
from database import engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Shoelotskey API")

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
    return db.query(Service).all()

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
# USERS
# -----------------
@app.get("/api/users", response_model=List[UserSchema])
def read_users(db: Session = Depends(get_db)):
    return db.query(User).all()

@app.post("/api/users", response_model=UserSchema)
def create_user(user: UserSchema, db: Session = Depends(get_db)):
    db_user = User(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

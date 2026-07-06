import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add backend to path so we can import models
backend_path = r"c:\Users\charm\Desktop\Shoelotskey Service Management System\backend"
sys.path.append(backend_path)

from models import Base, Order, Customer, Item, Payment, Delivery, Status, PriorityLevel, Service, Condition, PaymentMethod, PaymentStatus

# Create engines
sqlite_engine = create_engine(f"sqlite:///{backend_path}/../shoelotskey.db")
pg_url = "postgresql://u24tnl88dcgknd:p7d629ec3f3af1f2cf30757ec8efce446d3283727fcf9b50047204dcda6eae73f@cduf3or326qj7m.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d6281rp0p4pg8c"
pg_engine = create_engine(pg_url)

SQLiteSession = sessionmaker(bind=sqlite_engine)
PGSession = sessionmaker(bind=pg_engine)

sqlite_session = SQLiteSession()
pg_session = PGSession()

# 1. Clean up HEALTH- check orders from PG
print("Cleaning up HEALTH- orders from PostgreSQL...")
pg_health_orders = pg_session.query(Order).filter(Order.order_number.like('HEALTH-%')).all()
for ho in pg_health_orders:
    # Delete associated payments, items, delivery, etc first
    pg_session.execute(text("DELETE FROM payments WHERE order_id = :oid"), {"oid": ho.order_id})
    pg_session.execute(text("DELETE FROM deliveries WHERE order_id = :oid"), {"oid": ho.order_id})
    items = pg_session.query(Item).filter(Item.order_id == ho.order_id).all()
    for item in items:
        pg_session.execute(text("DELETE FROM item_service_mapping WHERE item_id = :itid"), {"itid": item.item_id})
        pg_session.execute(text("DELETE FROM item_condition_mapping WHERE item_id = :itid"), {"itid": item.item_id})
        pg_session.delete(item)
    pg_session.delete(ho)
pg_session.commit()
print(f"Purged {len(pg_health_orders)} HEALTH- orders from PostgreSQL.")

# 2. Reconcile SQLite orders to PostgreSQL
print("Scanning SQLite orders to sync...")
sqlite_orders = sqlite_session.query(Order).all()

for sq_order in sqlite_orders:
    if sq_order.order_number.startswith("HEALTH-"):
        continue
    # Check if order exists in PostgreSQL
    exists = pg_session.query(Order).filter(Order.order_number == sq_order.order_number).first()
    if not exists:
        print(f"Syncing order {sq_order.order_number} to cloud...")
        # A. Resolve Customer
        sq_cust = sqlite_session.query(Customer).filter(Customer.customer_id == sq_order.customer_id).first()
        pg_cust = pg_session.query(Customer).filter(Customer.customer_name == sq_cust.customer_name, Customer.contact_number == sq_cust.contact_number).first()
        if not pg_cust:
            pg_cust = Customer(
                customer_name=sq_cust.customer_name,
                contact_number=sq_cust.contact_number,
                created_at=sq_cust.created_at
            )
            pg_session.add(pg_cust)
            pg_session.flush() # Populate pg_cust.customer_id
        
        # Resolve status name
        sq_status_name = sqlite_session.execute(
            text("SELECT status_name FROM status WHERE status_id = :status_id"),
            {"status_id": sq_order.status_id}
        ).scalar()
        pg_status = pg_session.query(Status).filter(Status.status_name == sq_status_name).first()
        
        # Resolve priority name
        sq_prio_name = sqlite_session.execute(
            text("SELECT priority_name FROM priority_levels WHERE priority_id = :priority_id"),
            {"priority_id": sq_order.priority_id}
        ).scalar()
        pg_prio = pg_session.query(PriorityLevel).filter(PriorityLevel.priority_name == sq_prio_name).first()
        
        if not pg_status or not pg_prio:
            print(f"Skipping order {sq_order.order_number} due to missing status/priority lookup mapping.")
            continue

        # B. Create Order
        pg_order = Order(
            order_number=sq_order.order_number,
            customer_id=pg_cust.customer_id,
            status_id=pg_status.status_id,
            priority_id=pg_prio.priority_id,
            grand_total=sq_order.grand_total,
            expected_at=sq_order.expected_at,
            released_at=sq_order.released_at,
            claimed_at=sq_order.claimed_at,
            user_id=sq_order.user_id,
            inventory_applied=sq_order.inventory_applied,
            inventory_used=sq_order.inventory_used,
            created_at=sq_order.created_at,
            updated_at=sq_order.updated_at
        )
        pg_session.add(pg_order)
        pg_session.flush() # Populate pg_order.order_id
        
        # C. Items
        for sq_item in sq_order.items:
            pg_item = Item(
                order_id=pg_order.order_id,
                brand=sq_item.brand,
                shoe_model=sq_item.shoe_model,
                material=sq_item.material,
                quantity=sq_item.quantity,
                item_notes=sq_item.item_notes,
                inventory_used=sq_item.inventory_used
            )
            pg_session.add(pg_item)
            pg_session.flush() # Populate pg_item.item_id
            
            # Map Services (ItemServiceMapping)
            sq_mappings = sqlite_session.execute(
                text("SELECT service_id, actual_price FROM item_service_mapping WHERE item_id = :item_id"),
                {"item_id": sq_item.item_id}
            ).fetchall()
            
            for sq_svc_id, actual_price in sq_mappings:
                sq_svc_name = sqlite_session.execute(
                    text("SELECT service_name FROM services WHERE service_id = :svc_id"),
                    {"svc_id": sq_svc_id}
                ).scalar()
                
                pg_svc = pg_session.query(Service).filter(Service.service_name == sq_svc_name).first()
                if pg_svc:
                    pg_session.execute(
                        text("INSERT INTO item_service_mapping (item_id, service_id, actual_price) VALUES (:item_id, :service_id, :actual_price)"),
                        {"item_id": pg_item.item_id, "service_id": pg_svc.service_id, "actual_price": actual_price}
                    )
            
            # Map Conditions (ItemConditionMapping)
            sq_cond_mappings = sqlite_session.execute(
                text("SELECT condition_id FROM item_condition_mapping WHERE item_id = :item_id"),
                {"item_id": sq_item.item_id}
            ).fetchall()
            
            for (sq_cond_id,) in sq_cond_mappings:
                sq_cond_name = sqlite_session.execute(
                    text("SELECT condition_name FROM conditions WHERE condition_id = :cond_id"),
                    {"cond_id": sq_cond_id}
                ).scalar()
                
                pg_cond = pg_session.query(Condition).filter(Condition.condition_name == sq_cond_name).first()
                if pg_cond:
                    pg_session.execute(
                        text("INSERT INTO item_condition_mapping (item_id, condition_id) VALUES (:item_id, :condition_id)"),
                        {"item_id": pg_item.item_id, "condition_id": pg_cond.condition_id}
                    )
        
        # D. Payments
        for sq_pay in sq_order.payments:
            sq_method_name = sqlite_session.execute(
                text("SELECT method_name FROM payment_methods WHERE method_id = :method_id"),
                {"method_id": sq_pay.method_id}
            ).scalar()
            pg_method = pg_session.query(PaymentMethod).filter(PaymentMethod.method_name == sq_method_name).first()
            
            sq_p_status_name = sqlite_session.execute(
                text("SELECT status_name FROM payment_statuses WHERE p_status_id = :status_id"),
                {"status_id": sq_pay.status_id}
            ).scalar()
            pg_p_status = pg_session.query(PaymentStatus).filter(PaymentStatus.status_name == sq_p_status_name).first()
            
            if pg_method and pg_p_status:
                pg_pay = Payment(
                    order_id=pg_order.order_id,
                    method_id=pg_method.method_id,
                    status_id=pg_p_status.p_status_id,
                    amount_received=sq_pay.amount_received,
                    balance=sq_pay.balance,
                    reference_no=sq_pay.reference_no,
                    deposit_amount=sq_pay.deposit_amount,
                    created_at=sq_pay.created_at
                )
                pg_session.add(pg_pay)
        
        # E. Delivery
        if sq_order.delivery:
            sq_del = sq_order.delivery
            pg_del = Delivery(
                order_id=pg_order.order_id,
                pref_id=sq_del.pref_id,
                delivery_address=sq_del.delivery_address,
                delivery_courier=sq_del.delivery_courier,
                release_time=sq_del.release_time,
                province=sq_del.province,
                city=sq_del.city,
                barangay=sq_del.barangay,
                zip_code=sq_del.zip_code
            )
            pg_session.add(pg_del)
            
        pg_session.commit()
        print(f"Order {sq_order.order_number} successfully synced with all details.")

pg_session.close()
sqlite_session.close()
print("Reconciliation complete!")

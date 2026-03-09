import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import SessionLocal
from models import Service

db = SessionLocal()
try:
    premium = db.query(Service).filter(Service.service_name == 'Premium Fee (Color Renewal)').first()
    if premium:
        db.delete(premium)
    
    addons = db.query(Service).filter(Service.category == 'addon').all()
    for s in addons:
        if 'Unyellowing' in s.service_name:
            s.duration_days = 5
        else:
            s.duration_days = 0

    db.commit()
    print('Database updated successfully - Premium Fee removed, add-ons synchronized.')
except Exception as e:
    db.rollback()
    print('Error:', e)
finally:
    db.close()

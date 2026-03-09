from database import SessionLocal
from models import Service

db = SessionLocal()
try:
    addons = db.query(Service).filter(Service.category == 'addon').all()
    for s in addons:
        if 'Unyellowing' in s.service_name:
            s.duration_days = 5
        else:
            s.duration_days = 0
            
    priorities = db.query(Service).filter(Service.category == 'priority').all()
    for p in priorities:
        if 'Basic Cleaning' in p.service_name:
            # Basic Cleaning rush fee can be set here; UI will allow changing it
            p.duration_days = -5
        else:
            p.duration_days = 0
            
    db.commit()
    print('Database updated successfully!')
except Exception as e:
    db.rollback()
    print('Error:', e)
finally:
    db.close()

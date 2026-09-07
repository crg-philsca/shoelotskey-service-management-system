import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import HistoricalItemService

engine = create_engine('sqlite:///shoelotskey.db')
Session = sessionmaker(bind=engine)
session = Session()

KNOWN_ADDONS = {'mret', 'mr', 'mres', 'minor retouch', 'minor reglue', 'minor restoration', 'retouch', 'reglue'}

services = session.query(HistoricalItemService).all()
updated = 0
for s in services:
    if s.service_name.lower().strip() in KNOWN_ADDONS and s.service_type != 'addon':
        print(f'Fixing {s.service_name} from {s.service_type} to addon')
        s.service_type = 'addon'
        updated += 1

if updated > 0:
    session.commit()
    print(f'Fixed {updated} services.')
else:
    print('No services needed fixing.')

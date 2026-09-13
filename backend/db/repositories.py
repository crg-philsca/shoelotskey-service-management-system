import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from models import Inventory

class InventoryRepository:
    """
    S.O.L.I.D: Dependency Inversion Principle & Repository Pattern.
    Abstracts database access operations for the Inventory model, 
    decoupling controller routes from SQLAlchemy details.
    """
    def __init__(self, db: Session):
        self.db = db

    def get_all(self, include_inactive: bool = False) -> list[Inventory]:
        if include_inactive:
            return self.db.query(Inventory).order_by(Inventory.item_id).all()
        return self.db.query(Inventory).filter(Inventory.is_active == True).order_by(Inventory.item_id).all()

    def get_by_id(self, item_id: int) -> Inventory | None:
        return self.db.query(Inventory).filter(Inventory.item_id == item_id).first()

    def add(self, item: Inventory) -> Inventory:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def commit(self):
        self.db.commit()

    def refresh(self, item: Inventory) -> Inventory:
        self.db.refresh(item)
        return item

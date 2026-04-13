from database import SessionLocal
from models import User
import bcrypt as _bcrypt

class _BcryptWrapper:
    @staticmethod
    def hash(password: str) -> str:
        return _bcrypt.hashpw(password.encode('utf-8'), _bcrypt.gensalt()).decode('utf-8')
        
    @staticmethod
    def verify(password: str, hashed: str) -> bool:
        if not hashed: return False
        if not hashed.startswith('$2'):
            raise ValueError('not a valid bcrypt hash')
        return _bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

bcrypt = _BcryptWrapper()

db = SessionLocal()
owner = db.query(User).filter_by(username='staff').first()
if getattr(owner, 'password_hash', None):
    print("Owner hash:", repr(owner.password_hash))
    try:
        match = bcrypt.verify('staff123', owner.password_hash)
        print("Match:", match)
    except Exception as e:
        print("Exception:", repr(e))
        if owner.password_hash == 'staff123':
            print("Matched plaintext")
            new_hash = bcrypt.hash('staff123')
            print("New Hash:", new_hash)
            owner.password_hash = new_hash
            db.commit()
else:
    print("No owner found or no hash")

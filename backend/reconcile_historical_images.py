import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv('backend/.env')
pg_url = os.getenv('DATABASE_URL')
if not pg_url:
    print("ERROR: DATABASE_URL is missing")
    sys.exit(1)
if pg_url.startswith('postgres://'):
    pg_url = pg_url.replace('postgres://', 'postgresql://', 1)

sq = create_engine('sqlite:///backend/db/shoelotskey.db')
pg = create_engine(pg_url)

repo_root = Path(__file__).resolve().parent.parent

def run_reconciliation(dry_run=False):
    with sq.connect() as sq_conn, pg.connect() as pg_conn:
        # 1. Map local orders: local historical_order_id -> order_id
        sq_orders = dict(sq_conn.execute(text('SELECT historical_order_id, order_id FROM historical_orders')).fetchall())
        
        # 2. Map remote orders: order_id -> pg historical_order_id
        pg_orders = dict(pg_conn.execute(text('SELECT order_id, historical_order_id FROM historical_orders')).fetchall())
        
        # 3. Get remote existing images: set of (historical_order_id, image_filename)
        pg_existing_images = pg_conn.execute(text('SELECT historical_order_id, image_filename FROM historical_images')).fetchall()
        pg_existing_order_ids = {r[0] for r in pg_existing_images if r[0] is not None}
        pg_existing_filenames = {r[1].lower() for r in pg_existing_images if r[1] is not None}
        
        # 4. Get all local images
        sq_images = sq_conn.execute(text('''
            SELECT historical_image_id, historical_order_id, image_filename, image_path, 
                   image_hash, ocr_confidence, ocr_status, ocr_version, uploaded_at, processed_at 
            FROM historical_images
        ''')).fetchall()
        
        local_images_count = len(sq_images)
        remote_images_before = len(pg_existing_images)
        
        replicated = 0
        already_matched = 0
        duplicates = 0
        unresolved = 0
        failed = 0
        
        to_insert = []
        
        for img in sq_images:
            local_img_id, local_order_id, filename, img_path, img_hash, conf, status, version, uploaded, processed = img
            order_id = sq_orders.get(local_order_id)
            if not order_id:
                unresolved += 1
                continue
                
            pg_order_id = pg_orders.get(order_id)
            if not pg_order_id:
                unresolved += 1
                continue
                
            # Check if already exists in PG
            if pg_order_id in pg_existing_order_ids or (filename and filename.lower() in pg_existing_filenames):
                already_matched += 1
                continue
                
            # Compute a portable relative path
            portable_path = img_path
            if img_path:
                try:
                    # If it contains historical_data, make it relative to repo root
                    idx = img_path.replace('\\', '/').find('historical_data')
                    if idx != -1:
                        portable_path = 'backend/' + img_path.replace('\\', '/')[idx:]
                except Exception:
                    pass
                    
            to_insert.append({
                'historical_order_id': pg_order_id,
                'image_filename': filename,
                'image_path': portable_path,
                'image_hash': img_hash,
                'ocr_confidence': conf,
                'ocr_status': status,
                'ocr_version': version,
                'uploaded_at': uploaded,
                'processed_at': processed
            })
            
        print(f"Planning to replicate {len(to_insert)} historical image records to PostgreSQL.", flush=True)
        
        if not dry_run and to_insert:
            with pg.begin() as trans:
                insert_stmt = text('''
                    INSERT INTO historical_images 
                    (historical_order_id, image_filename, image_path, image_hash, 
                     ocr_confidence, ocr_status, ocr_version, uploaded_at, processed_at)
                    VALUES 
                    (:historical_order_id, :image_filename, :image_path, :image_hash, 
                     :ocr_confidence, :ocr_status, :ocr_version, :uploaded_at, :processed_at)
                ''')
                batch_size = 100
                for i in range(0, len(to_insert), batch_size):
                    chunk = to_insert[i:i + batch_size]
                    trans.execute(insert_stmt, chunk)
                    replicated += len(chunk)
                    print(f"Replicated {replicated}/{len(to_insert)} images...", flush=True)
                        
        with pg.connect() as check_conn:
            remote_images_after = check_conn.execute(text('SELECT count(*) FROM historical_images')).scalar()
            
        print("\n=== HISTORICAL IMAGE RECONCILIATION REPORT ===")
        print(f"LOCAL_IMAGES:          {local_images_count}")
        print(f"REMOTE_IMAGES_BEFORE:  {remote_images_before}")
        print(f"REMOTE_IMAGES_AFTER:   {remote_images_after}")
        print(f"REPLICATED:            {replicated}")
        print(f"ALREADY_MATCHED:       {already_matched}")
        print(f"DUPLICATES:            {duplicates}")
        print(f"UNRESOLVED:            {unresolved}")
        print(f"FAILED:                {failed}")
        print("==============================================\n")
        
        return {
            "LOCAL_IMAGES": local_images_count,
            "REMOTE_IMAGES_BEFORE": remote_images_before,
            "REMOTE_IMAGES_AFTER": remote_images_after,
            "REPLICATED": replicated,
            "ALREADY_MATCHED": already_matched,
            "DUPLICATES": duplicates,
            "UNRESOLVED": unresolved,
            "FAILED": failed
        }

if __name__ == '__main__':
    dry = '--dry-run' in sys.argv
    run_reconciliation(dry_run=dry)

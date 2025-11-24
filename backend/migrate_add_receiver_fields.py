"""
Migration script to add receiver_number and receiver_name columns to users table
Usage: python migrate_add_receiver_fields.py
"""
from sqlalchemy import text
from database import engine, SessionLocal

def migrate():
    """Add receiver_number and receiver_name columns to users table"""
    db = SessionLocal()
    try:
        print("Starting migration...")
        
        # Check if columns already exist
        with engine.connect() as conn:
            # Get existing columns
            result = conn.execute(text("SHOW COLUMNS FROM users LIKE 'receiver_number'"))
            receiver_number_exists = result.fetchone() is not None
            
            result = conn.execute(text("SHOW COLUMNS FROM users LIKE 'receiver_name'"))
            receiver_name_exists = result.fetchone() is not None
            
            if receiver_number_exists and receiver_name_exists:
                print("Columns already exist. Migration not needed.")
                return
            
            # Add receiver_number column if it doesn't exist
            if not receiver_number_exists:
                print("Adding receiver_number column...")
                conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN receiver_number VARCHAR(50) NULL,
                    ADD INDEX idx_users_receiver_number (receiver_number)
                """))
                conn.commit()
                print("[OK] receiver_number column added")
            else:
                print("[OK] receiver_number column already exists")
            
            # Add receiver_name column if it doesn't exist
            if not receiver_name_exists:
                print("Adding receiver_name column...")
                conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN receiver_name VARCHAR(255) NULL
                """))
                conn.commit()
                print("[OK] receiver_name column added")
            else:
                print("[OK] receiver_name column already exists")
        
        print("\nMigration completed successfully!")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate()


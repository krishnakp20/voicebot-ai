"""
Script to create users in the database
Usage: 
  python create_user.py  # Creates default admin user
  python create_user.py --email user@example.com --name "User Name" --password pass123 --receiver-number "+1234567890" --receiver-name "Client Name"
"""
import argparse
from sqlalchemy import text, inspect
from database import SessionLocal, engine, Base
from models import User
from auth import get_password_hash

def ensure_columns_exist():
    """Ensure receiver_number and receiver_name columns exist in users table"""
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('users')]
    
    with engine.connect() as conn:
        if 'receiver_number' not in columns:
            print("Adding receiver_number column...")
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN receiver_number VARCHAR(50) NULL,
                ADD INDEX idx_users_receiver_number (receiver_number)
            """))
            conn.commit()
            print("[OK] receiver_number column added")
        
        if 'receiver_name' not in columns:
            print("Adding receiver_name column...")
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN receiver_name VARCHAR(255) NULL
            """))
            conn.commit()
            print("[OK] receiver_name column added")

def create_user(email=None, name=None, password=None, receiver_number=None, receiver_name=None):
    # Create all tables first
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")
    
    # Ensure receiver columns exist (for existing databases)
    ensure_columns_exist()
    
    db = SessionLocal()
    try:
        # Use provided values or defaults
        user_email = email or "admin@example.com"
        user_name = name or "Admin User"
        user_password = password or "password123"
        
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user_email).first()
        if existing_user:
            print(f"User already exists!")
            print(f"Email: {user_email}")
            if receiver_number:
                # Update receiver mapping if provided
                existing_user.receiver_number = receiver_number
                existing_user.receiver_name = receiver_name
                db.commit()
                print(f"Updated receiver mapping: {receiver_number} ({receiver_name})")
            return
        
        user = User(
            email=user_email,
            name=user_name,
            password_hash=get_password_hash(user_password),
            receiver_number=receiver_number,
            receiver_name=receiver_name
        )
        db.add(user)
        db.commit()
        print("User created successfully!")
        print(f"Email: {user_email}")
        print(f"Password: {user_password}")
        if receiver_number:
            print(f"Receiver Number: {receiver_number}")
            print(f"Receiver Name: {receiver_name}")
    except Exception as e:
        print(f"Error creating user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Create a user in the database')
    parser.add_argument('--email', type=str, help='User email')
    parser.add_argument('--name', type=str, help='User name')
    parser.add_argument('--password', type=str, help='User password')
    parser.add_argument('--receiver-number', type=str, help='Receiver phone number to map')
    parser.add_argument('--receiver-name', type=str, help='Receiver name/label')
    
    args = parser.parse_args()
    create_user(
        email=args.email,
        name=args.name,
        password=args.password,
        receiver_number=args.receiver_number,
        receiver_name=args.receiver_name
    )


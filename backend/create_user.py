"""
Script to create a test user in the database
Usage: python create_user.py
"""
from database import SessionLocal, engine, Base
from models import User
from auth import get_password_hash

def create_user():
    # Create all tables first
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")
    
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == "admin@example.com").first()
        if existing_user:
            print("User already exists!")
            print("Email: admin@example.com")
            print("Password: password123")
            return
        
        user = User(
            email="admin@example.com",
            name="Admin User",
            password_hash=get_password_hash("password123")
        )
        db.add(user)
        db.commit()
        print("User created successfully!")
        print("Email: admin@example.com")
        print("Password: password123")
    except Exception as e:
        print(f"Error creating user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_user()


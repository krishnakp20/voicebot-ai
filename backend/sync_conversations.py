"""
Script to sync conversations from ElevenLabs to MySQL
Usage: python sync_conversations.py
"""
import sys
import os

# Add parent directory to path to import modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from main import sync_conversations

def main():
    print("Starting conversation sync from ElevenLabs...")
    db = SessionLocal()
    try:
        count = sync_conversations(db)
        print(f"[SUCCESS] Successfully synced {count} conversations from ElevenLabs")
    except Exception as e:
        print(f"[ERROR] Error syncing conversations: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())


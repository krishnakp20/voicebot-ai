"""
Debug script to see what data structure ElevenLabs API returns
Usage: python debug_conversations.py
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from elevenlabs_client import ElevenLabsClient

def debug_conversations():
    """Print the structure of conversations from ElevenLabs"""
    client = ElevenLabsClient()
    
    print("=" * 80)
    print("Fetching conversations from ElevenLabs...")
    print("=" * 80)
    
    conversations = client.get_conversations()
    
    if not conversations:
        print("No conversations found!")
        return
    
    print(f"\nFound {len(conversations)} conversations\n")
    
    # Print first conversation structure
    if conversations:
        print("=" * 80)
        print("FIRST CONVERSATION STRUCTURE:")
        print("=" * 80)
        first_conv = conversations[0]
        print(json.dumps(first_conv, indent=2, default=str))
        
        print("\n" + "=" * 80)
        print("EXTRACTING PHONE NUMBERS:")
        print("=" * 80)
        
        # Try to extract phone numbers
        metadata = first_conv.get("metadata", {}) or {}
        phone_call = metadata.get("phone_call") or {}
        
        print(f"metadata: {metadata}")
        print(f"phone_call: {phone_call}")
        print(f"external_number: {phone_call.get('external_number')}")
        print(f"agent_number: {phone_call.get('agent_number')}")
        print(f"caller_number: {phone_call.get('caller_number')}")
        print(f"receiver_number: {phone_call.get('receiver_number')}")
        
        # Try fetching full conversation
        conv_id = first_conv.get("conversation_id")
        if conv_id:
            print("\n" + "=" * 80)
            print(f"FETCHING FULL CONVERSATION DETAILS FOR: {conv_id}")
            print("=" * 80)
            full_conv = client.get_conversation(conv_id)
            if full_conv:
                full_metadata = full_conv.get("metadata", {}) or {}
                full_phone_call = full_metadata.get("phone_call") or {}
                print(f"Full metadata: {full_metadata}")
                print(f"Full phone_call: {full_phone_call}")
                print(f"Full external_number: {full_phone_call.get('external_number')}")
                print(f"Full agent_number: {full_phone_call.get('agent_number')}")

if __name__ == "__main__":
    debug_conversations()







# User-Receiver Number Mapping Guide

This feature allows you to map users to specific receiver numbers, so each user only sees conversations for their assigned receiver number.

## How It Works

- Each user can be mapped to a `receiver_number` and `receiver_name`
- When a user logs in, they will only see conversations where `receiver_number` matches their assigned receiver number
- Users without a receiver mapping (admin users) will see all conversations
- The receiver name is displayed in the sidebar and conversations list

## Creating Users with Receiver Mapping

### Option 1: Using the Python Script

```bash
cd backend
python create_user.py --email client@example.com --name "Client Name" --password "securepass123" --receiver-number "+1234567890" --receiver-name "Client Business Name"
```

### Option 2: Using the API Endpoint

```bash
curl -X POST "http://localhost:8000/users" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Client Name",
    "email": "client@example.com",
    "password": "securepass123",
    "receiver_number": "+1234567890",
    "receiver_name": "Client Business Name"
  }'
```

### Option 3: Create Admin User (No Receiver Mapping)

```bash
cd backend
python create_user.py
# Or with custom credentials:
python create_user.py --email admin@example.com --name "Admin User" --password "admin123"
```

## Updating Existing Users

You can update an existing user's receiver mapping by running the create_user script again with the same email:

```bash
python create_user.py --email existing@example.com --receiver-number "+1234567890" --receiver-name "New Receiver Name"
```

## Frontend Display

- **Sidebar**: Shows receiver name and number (if mapped) below the app title
- **Conversations Page**: Displays receiver number in a dedicated column
- **Conversation Detail**: Shows receiver number in the metadata section

## Database Migration

The new fields (`receiver_number` and `receiver_name`) are automatically added to the users table when you run the application. No manual migration is needed.

## Example Use Cases

1. **Client Portal**: Each client gets their own user account mapped to their receiver number
2. **Department Separation**: Different departments see only their conversations
3. **Multi-tenant**: Separate data views for different tenants/organizations












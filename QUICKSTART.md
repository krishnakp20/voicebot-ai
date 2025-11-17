# Quick Start Guide

## Prerequisites Check

- [ ] Python 3.8+ installed
- [ ] Node.js 16+ installed
- [ ] MySQL server running
- [ ] ElevenLabs API key ready

## Step-by-Step Setup

### 1. Database Setup

Create MySQL database:
```sql
CREATE DATABASE voicebot_db;
```

### 2. Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Configuration

Create a `.env` file in the project root with:

```env
DATABASE_URL=mysql+pymysql://root:yourpassword@localhost:3306/voicebot_db
ELEVENLABS_API_KEY=your-elevenlabs-api-key-here
SECRET_KEY=your-secret-key-minimum-32-characters-long
```

### 4. Create Test User

```bash
cd backend
python create_user.py
```

Default credentials:
- Email: `admin@example.com`
- Password: `password123`

### 5. Start Backend Server

```bash
cd backend
python main.py
```

Backend will run on `http://localhost:8000`

### 6. Frontend Setup

Open a new terminal:

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will run on `http://localhost:3000`

### 7. Access the Application

1. Open browser: `http://localhost:3000`
2. Login with: `admin@example.com` / `password123`
3. Start exploring!

## Troubleshooting

### Database Connection Issues
- Verify MySQL is running
- Check DATABASE_URL in .env matches your MySQL credentials
- Ensure database `voicebot_db` exists

### ElevenLabs API Issues
- Verify ELEVENLABS_API_KEY is correct
- Check API key has proper permissions
- Test API key with curl:
  ```bash
  curl -H "xi-api-key: YOUR_KEY" https://api.elevenlabs.io/v1/convai/conversations
  ```

### Port Already in Use
- Backend: Change port in `backend/main.py` (line 236)
- Frontend: Change port in `frontend/vite.config.js`

## Next Steps

1. Sync conversations: Use `/sync-elevenlabs` endpoint or it will auto-sync
2. Explore dashboard metrics
3. View conversation details
4. Listen to audio recordings



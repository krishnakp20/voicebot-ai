# VoiceBot AI Dashboard

A complete full-stack web application for analyzing and managing voice conversations integrated with ElevenLabs Voice API.

## Features

- 🔐 JWT-based authentication
- 📊 Dashboard with conversation metrics
- 📋 Conversation list with filtering
- 🎧 Audio playback for conversations
- 📝 Transcript viewing
- 📈 Sentiment analysis
- 🔄 Automatic sync with ElevenLabs API

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM for database operations
- **MySQL** - Database
- **JWT** - Authentication
- **Pydantic** - Data validation

### Frontend
- **React** - UI library
- **TailwindCSS** - Styling
- **Axios** - HTTP client
- **React Router** - Routing
- **HeroIcons** - Icons

## Project Structure

```
.
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── database.py             # Database configuration
│   ├── models.py               # SQLAlchemy models
│   ├── schemas.py              # Pydantic schemas
│   ├── auth.py                 # Authentication utilities
│   ├── elevenlabs_client.py    # ElevenLabs API client
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page components
│   │   ├── services/           # API service
│   │   ├── App.jsx             # Main app component
│   │   └── main.jsx            # Entry point
│   ├── package.json
│   └── vite.config.js
├── .env.example                # Environment variables template
└── README.md
```

## Setup Instructions

### Prerequisites

- Python 3.8+
- Node.js 16+
- MySQL 5.7+ or 8.0+
- ElevenLabs API key

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
```bash
# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Create a MySQL database:
```sql
CREATE DATABASE voicebot_db;
```

6. Copy `.env.example` to `.env` in the project root and update the values:
```bash
cp ../.env.example ../.env
```

7. Update `.env` with your database credentials and ElevenLabs API key:
```
DATABASE_URL=mysql+pymysql://root:yourpassword@localhost:3306/voicebot_db
ELEVENLABS_API_KEY=your-elevenlabs-api-key
SECRET_KEY=your-secret-key-min-32-chars
```

8. Run the FastAPI server:
```bash
python main.py
```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (optional, defaults to http://localhost:8000):
```
VITE_API_URL=http://localhost:8000
```

4. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Database Setup

The application will automatically create the database tables on first run. To create a test user, you can use the following Python script:

```python
from database import SessionLocal
from models import User
from auth import get_password_hash

db = SessionLocal()
user = User(
    email="admin@example.com",
    name="Admin User",
    password_hash=get_password_hash("password123")
)
db.add(user)
db.commit()
db.close()
```

## API Endpoints

### Authentication
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user info

### Conversations
- `GET /conversations` - Get list of conversations
- `GET /conversations/metrics` - Get dashboard metrics
- `GET /conversations/{id}` - Get conversation details
- `GET /conversations/{id}/transcript` - Get conversation transcript
- `GET /conversations/{id}/audio` - Get audio URL
- `POST /sync-elevenlabs` - Manually sync conversations from ElevenLabs

## Usage

1. **Login**: Navigate to `/login` and use your credentials
2. **Dashboard**: View overall metrics and statistics
3. **Conversations**: Browse all conversations in a table
4. **Conversation Detail**: Click on any conversation to view:
   - Full metadata
   - Audio playback
   - Transcript
   - Download audio option

## ElevenLabs Integration

The application integrates with ElevenLabs Voice API to:
- Fetch conversations automatically
- Retrieve transcripts
- Get audio URLs
- Sync data periodically

Make sure your `ELEVENLABS_API_KEY` is set in the `.env` file.

## Development

### Backend Development
```bash
cd backend
uvicorn main:app --reload
```

### Frontend Development
```bash
cd frontend
npm run dev
```

## Production Build

### Frontend
```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`

## Environment Variables

### Backend (.env)
- `DATABASE_URL` - MySQL connection string
- `SECRET_KEY` - JWT secret key (min 32 characters)
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key

### Frontend (.env)
- `VITE_API_URL` - Backend API URL (default: http://localhost:8000)

## License

MIT



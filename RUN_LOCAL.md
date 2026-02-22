# Local setup script for Order Management

# 1. Install Python dependencies
cd backend
pip install -r requirements.txt

# 2. Set environment variables (copy .env.example to .env and fill in)
cp .env.example .env

# 3. Build frontend
cd ../frontend
npm install
npm run build

# 4. Run the backend
cd ../backend
uvicorn app.main:app --reload --port 8000

import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import certifi

# Load environment variables from .env file
ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / '.env')

# Retrieve environment variables with fallbacks
mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "repair_db")

# Base connection configurations
connection_kwargs = {
    "serverSelectionTimeoutMS": 5000,
}

# Apply SSL/TLS configurations for MongoDB Atlas / Cloud connections
if mongo_url.startswith("mongodb+srv://") or "tls=true" in mongo_url.lower():
    connection_kwargs.update({
        "tls": True,
        "tlsCAFile": certifi.where(),
        "tlsAllowInvalidCertificates": True  # Resolves local SSL handshake issues
    })

# Initialize Async Motor Client and Database instance
client = AsyncIOMotorClient(mongo_url, **connection_kwargs)
db = client[db_name]


async def close_db_connection():
    """Closes the MongoDB connection gracefully."""
    client.close()
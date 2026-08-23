import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from app.routes.user_routes import router as user_router
from app.routes.invoice_routes import router as invoice_router
from app.routes.admin_routers import router as admin_router
from app.routes.policy_routes import router as policy_router
from app.routes.dashboard_routes import router as dashboard_router
from app.routes.spend_analysis_routes import router as spend_analysis_router
from app.database import engine, run_column_migrations
from app.models import Base
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings

settings = get_settings()

# Initialize all database tables on application launch and execute column migrations
Base.metadata.create_all(bind=engine)
try:
    run_column_migrations()
except Exception as mig_err:
    print(f"⚠️ [Startup Migration Notice]: {mig_err}")

app = FastAPI(title="Invoice Validate AI & Compliance Engine")

# Mount uploaded invoice files (PDFs and Images) directory for static viewing/downloading
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

origins = [
    "http://localhost:3000",      # React/Next.js local dev server
    "http://127.0.0.1:3000",
] if settings.ENVIRONMENT.lower() == "development" else settings.ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,           # Allowed domains
    allow_credentials=True,          # Allow cookies/auth headers
    allow_methods=["*"],             # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],             # Allow all request headers
)



@app.get("/")
async def read_root():
    return {"message": "Welcome to the Invoice Validate AI & Compliance API!"}



app.include_router(user_router)
app.include_router(invoice_router)    # Include the invoice router
app.include_router(admin_router)      # Include the admin router
app.include_router(policy_router)     # Include the compliance policy router
app.include_router(dashboard_router)  # Include the dashboard analytics router
app.include_router(spend_analysis_router)  # Include the spend analysis router

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
from fastapi import FastAPI, Depends, HTTPException
from app.routes.user_routes import router as user_router
from app.routes.invoice_routes import router as invoice_router
from app.routes.admin_routers import router as admin_router
from app.routes.policy_routes import router as policy_router
from app.routes.dashboard_routes import router as dashboard_router
from app.database import engine
from app.models import Base
from fastapi.middleware.cors import CORSMiddleware

# Initialize all database tables on application launch
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Invoice Validate AI & Compliance Engine")

origins = [
    "http://localhost:3000",      # React/Next.js local dev server
    "http://127.0.0.1:3000",
]

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
from fastapi import FastAPI, Depends, HTTPException
from app.routes.user_routes import router as user_router
from app.routes.invoice_routes import router as invoice_router
from app.routes.admin_routers import router as admin_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "http://localhost:3000",      # React/Vue local dev server
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
    return {"message": "Welcome to the FastAPI application!"}



app.include_router(user_router)
app.include_router(invoice_router)  # Include the invoice router
app.include_router(admin_router)    # Include the admin router

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
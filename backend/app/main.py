from fastapi import FastAPI, Depends, HTTPException
from app.routes.user_routes import router as user_router
from app.routes.invoce_routes import router as invoice_router


app = FastAPI()



@app.get("/")
async def read_root():
    return {"message": "Welcome to the FastAPI application!"}



app.include_router(user_router)
app.include_router(invoice_router)  # Include the invoice router

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
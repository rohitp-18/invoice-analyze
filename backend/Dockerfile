FROM python:3.11-slim

# Copy Astral uv package manager binary (ultra-fast package installer)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

ARG APP_ENV=production
ENV APP_ENV=$APP_ENV \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Copy requirements file
COPY requirements.txt ./

# Install all dependencies with uv (10x-100x faster than standard pip)
RUN uv pip install --system --no-cache -r requirements.txt

# Copy backend application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
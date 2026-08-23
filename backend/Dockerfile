# ==============================================================================
# Multi-stage lightweight Dockerfile for Invoice Validate AI Backend
# Optimized for low-memory & low-spec systems (< 250MB final image size)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Dependencies in a Virtual Environment
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /build

# Install minimal build tools if required
RUN apt-get update && apt-get install --no-install-recommends -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment to isolate dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python requirements with zero cache to keep layer small
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    # Strip unnecessary test files, cache, and bytecode from installed packages
    find /opt/venv -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
    find /opt/venv -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true && \
    find /opt/venv -name "*.pyc" -delete 2>/dev/null || true

# ------------------------------------------------------------------------------
# Stage 2: Final Minimal Runtime Image
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS runner

# Prevent Python from writing .pyc files & enable immediate stdout/stderr flush
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Install only essential lightweight runtime libraries (libpq for Postgres, curl for healthcheck)
RUN apt-get update && apt-get install --no-install-recommends -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Copy the pre-built virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv

# Create a non-root system user for security
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/sh -m appuser

# Create necessary persistent runtime directories and set proper ownership
RUN mkdir -p /app/uploads /app/data/faiss_index && \
    chown -R appuser:appgroup /app

# Copy application source code
COPY --chown=appuser:appgroup app /app/app
COPY --chown=appuser:appgroup alembic /app/alembic
COPY --chown=appuser:appgroup alembic.ini /app/alembic.ini

# Switch to non-root user
USER appuser

# Expose backend port
EXPOSE 8000

# Health check to ensure the FastAPI application is alive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# Start Uvicorn with single worker optimized for low-spec machines
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

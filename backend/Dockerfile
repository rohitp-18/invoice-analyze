FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

ARG APP_ENV=production
ENV APP_ENV=$APP_ENV

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY requirements.txt ./

RUN pip install -r requirements.txt

ENV PATH="/app/.venv/bin:$PATH"
ENV PORT=8000

COPY . .

EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port 8000
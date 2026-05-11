FROM python:3.12-slim

# System libs for shapely (libgeos) and the healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgeos-c1v5 curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd --create-home --shell /bin/bash app
WORKDIR /app

# Install Python deps first for layer caching
COPY Backend/requirements.txt ./Backend/requirements.txt
RUN pip install --no-cache-dir -r Backend/requirements.txt

# Copy application code
COPY Backend/ ./Backend/
COPY Frontend/ ./Frontend/

# Create empty data directory and chown everything to app user
RUN mkdir -p /app/data && chown -R app:app /app

USER app

ENV GEONOVUM_DATA_DIR=/app/data
ENV GEONOVUM_FRONTEND_DIR=/app/Frontend
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:${PORT}/health || exit 1

CMD uvicorn Backend.main:app --host 0.0.0.0 --port ${PORT} --workers 1

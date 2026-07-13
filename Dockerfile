FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 8000

ENV DATABASE_URL=sqlite:///./data/options.db
ENV ROOT_PATH=""
ENV PYTHONUNBUFFERED=1

# CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
CMD ["python", "-m", "backend.main"]
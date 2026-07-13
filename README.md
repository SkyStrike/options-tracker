# Options Tracker

A lightweight, local-first stock option tracker designed for manual entry of complex multi-leg trades. Optimized for IBKR-style data entry with automatic P&L tracking and spread grouping.

> [!WARNING]
> **Financial & Valuation Disclaimer**: This repository is provided **AS-IS** without any warranties of any kind. The author(s) and contributor(s) are not responsible or liable for any financial loss, transaction accounting discrepancies, incorrect portfolio valuations, trading errors, or damages resulting from bugs or errors in this project. Use at your own risk.

## Features

- **Multi-Leg Spread Support**: Group multiple option legs (Verticals, Iron Condors, etc.) under a single trade.
- **Smart Entry Logic**: 
    - Auto-generates contract names based on Expiration, Strike, and Call/Put.
    - Default expiration set to the nearest Friday.
    - Intelligently pre-fills second legs with the reverse transaction type (e.g., STO -> BTO) to speed up spread entry.
- **Real-time P&L**: Automatically calculates Total USD impact based on `(Quantity * Price * 100) +/- Commission`.
- **Pre-calculated Reporting**: Fast loading "Open" and "Closed" views with bottom-row totals.
- **Local SQLite Storage**: Data is persisted in a simple SQLite database.
- **Docker Ready**: Fully containerized and optimized for hosting behind a reverse proxy (e.g., Nginx).

## Tech Stack

- **Backend**: FastAPI (Python 3.11)
- **Database**: SQLite with SQLAlchemy ORM
- **Frontend**: Vanilla HTML5, CSS3, and ES6+ JavaScript
- **Containerization**: Docker & Docker Compose

## Quick Start

### Prerequisites
- Docker and Docker Compose installed.

### Run with Docker
1. Navigate to the project directory:
   ```bash
   cd services/options-tracker
   ```
2. Build and start the container:
   ```bash
   docker-compose up --build
   ```
3. Access the UI at `http://localhost:8000`.

## Configuration

The application can be configured via environment variables in `docker-compose.yml`:

- `ROOT_PATH`: Set this if hosting behind a reverse proxy on a non-root path (e.g., `/options`).
- `DATABASE_URL`: Path to the SQLite database file (default: `sqlite:///./data/options.db`).

## Data Entry Guide

### 1. Adding a New Spread
- Click **Add New Position**.
- Fill in the global fields: **Symbol**, **Date Opened**, and **Expiration Date**.
- The first leg defaults to **STO Put**.
- Click **Add Leg** for additional legs. The second leg will automatically default to **BTO Put** (assuming the first was STO).
- Adjust the **Option Price** and **Commission**; the **Total USD** will calculate automatically but remains manually editable to match your broker's exact fill price.

### 2. Closing a Position
- Locate the position in the **Open Positions** table.
- Click **Close**.
- The system will pre-select the closing type (e.g., STC for a BTO position) and pre-fill the quantity.
- Enter the closing price to see the realized P&L calculation.

### 3. Editing Records
- Click the yellow **Edit** button on any row in the "Open" or "Closed" tables to correct entry errors or adjust dates/amounts.

## Project Structure

```text
services/options-tracker/
├── backend/            # FastAPI source code
│   ├── main.py         # Entry point & API routes
│   ├── models.py       # SQLAlchemy database models
│   ├── schemas.py      # Pydantic validation models
│   ├── migrations/     # Alembic database migrations
│   └── crud.py         # Database operations
├── frontend/           # Static assets
│   ├── index.html      # Main UI
│   ├── style.css       # Custom styling & layout
│   └── app.js          # UI logic & API integration
├── data/               # Persistent SQLite database
├── Dockerfile          # Container definition
└── docker-compose.yml  # Deployment configuration
```

## Database Migrations

This project uses **Alembic** to manage database schema updates.

### Running Migrations
To upgrade the database to the latest schema:
```bash
alembic upgrade head
```

### Creating a New Migration
To generate a new database migration script after making changes to database models in `models.py`:
```bash
alembic revision --autogenerate -m "migration_description" --rev-id "00X"
```
*(Always specify `--rev-id` using sequential running numbers like `002`, `003`, etc., for readable versioning)*

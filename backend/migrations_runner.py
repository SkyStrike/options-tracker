import logging
import os
import sqlite3
from alembic.config import Config
from alembic import command

logger = logging.getLogger("options_tracker")

BASELINE_REVISION = '001'

def _get_alembic_config() -> Config:
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ini_path = os.path.join(project_root, 'alembic.ini')
    cfg = Config(ini_path)
    
    # Use environment DATABASE_URL or fallback
    db_url = os.getenv("DATABASE_URL", "sqlite:///./data/options.db")
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg

def _is_alembic_tracked(db_file: str) -> bool:
    if not os.path.exists(db_file):
        return False
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version'"
        )
        result = cursor.fetchone()
        conn.close()
        return result is not None
    except Exception:
        return False

def run_migrations() -> None:
    db_url = os.getenv("DATABASE_URL", "sqlite:///./data/options.db")
    db_file = db_url.replace("sqlite:///", "")
    cfg = _get_alembic_config()

    try:
        if not _is_alembic_tracked(db_file):
            if os.path.exists(db_file):
                logger.info("Untracked database detected at %s.", db_file)
                logger.info("Stamping at Alembic baseline revision '%s'...", BASELINE_REVISION)
                command.stamp(cfg, BASELINE_REVISION)
                logger.info("Database stamped successfully.")
                
        logger.info("Running Alembic migrations...")
        command.upgrade(cfg, "head")
        logger.info("Database migrations are up to date.")
    except Exception as e:
        logger.error("Error running database migrations: %s", e)
        raise

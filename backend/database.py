import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./watchlater.db")

# Railway は "postgres://" を返すが SQLAlchemy は "postgresql://" が必要
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations(engine):
    """既存DBへのカラム追加（冪等）"""
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE items ADD COLUMN thumbnail_url VARCHAR",
        "ALTER TABLE items ADD COLUMN source_type VARCHAR",
        "ALTER TABLE items ADD COLUMN user_id VARCHAR",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                conn.rollback()  # カラムが既に存在する場合はスキップ

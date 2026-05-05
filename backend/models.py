from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from database import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, nullable=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    user_id = Column(String, nullable=True, index=True)  # ログインユーザーのメールアドレス
    thumbnail_url = Column(String, nullable=True)        # YouTube等のサムネイル
    source_type = Column(String, nullable=True)          # youtube / url / image / pdf / text
    tags = Column(JSON, default=list)
    category = Column(String, default="その他")
    priority = Column(String, default="medium")
    status = Column(String, default="unread")
    read_time_minutes = Column(Integer, nullable=True)
    reminder_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

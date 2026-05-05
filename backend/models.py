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
    tags = Column(JSON, default=list)
    category = Column(String, default="その他")
    priority = Column(String, default="medium")  # high / medium / low
    status = Column(String, default="unread")    # unread / reading / done
    read_time_minutes = Column(Integer, nullable=True)
    reminder_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

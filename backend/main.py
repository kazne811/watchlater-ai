import os
from datetime import datetime, timedelta
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import cast, String, or_
from sqlalchemy.orm import Session

load_dotenv()

from database import Base, engine, get_db
from models import Item
from scraper import scrape_url
from ai_service import analyze_content, analyze_image, analyze_pdf

Base.metadata.create_all(bind=engine)

app = FastAPI(title="WatchLater AI", version="1.0.0")

# 許可オリジン: 環境変数で本番URLを追加できる
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Pydantic schemas ----------

class ItemCreate(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None


class ItemUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None


class ItemOut(BaseModel):
    id: int
    url: Optional[str]
    title: str
    summary: Optional[str]
    tags: List[str]
    category: str
    priority: str
    status: str
    read_time_minutes: Optional[int]
    created_at: datetime
    reminder_at: Optional[datetime]

    class Config:
        from_attributes = True


# ---------- Routes ----------

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/items", response_model=ItemOut)
async def create_item(payload: ItemCreate, db: Session = Depends(get_db)):
    if not payload.url and not payload.text:
        raise HTTPException(status_code=400, detail="url または text のどちらかが必要です")

    title = ""
    content = ""

    if payload.url:
        try:
            scraped = await scrape_url(payload.url)
            title = scraped["title"]
            content = scraped["content"]
        except Exception:
            title = payload.url
            content = ""

    if payload.text:
        if not content:
            content = payload.text
        if not title:
            first_line = payload.text.split("\n")[0]
            title = first_line[:60] + ("…" if len(first_line) > 60 else "")

    # AI analysis
    try:
        analysis = await analyze_content(title=title, content=content, url=payload.url)
    except Exception as e:
        import traceback
        print(f"[AI ERROR] {type(e).__name__}: {e}")
        traceback.print_exc()
        analysis = {
            "title": title or "無題",
            "summary": [content[:100] if content else ""],
            "tags": [],
            "category": "その他",
            "priority": "medium",
            "read_time_minutes": 5,
            "reminder_days": 7,
        }

    summary_lines = analysis.get("summary", [])
    summary = (
        "\n".join(summary_lines)
        if isinstance(summary_lines, list)
        else str(summary_lines)
    )
    reminder_days = max(1, min(int(analysis.get("reminder_days", 7)), 90))
    reminder_at = datetime.utcnow() + timedelta(days=reminder_days)

    item = Item(
        url=payload.url,
        title=analysis.get("title") or title or "無題",
        content=content[:5000] if content else None,
        summary=summary,
        tags=analysis.get("tags", []),
        category=analysis.get("category", "その他"),
        priority=analysis.get("priority", "medium"),
        read_time_minutes=analysis.get("read_time_minutes"),
        reminder_at=reminder_at,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/items", response_model=List[ItemOut])
async def list_items(
    status: Optional[str] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Item)

    if status:
        query = query.filter(Item.status == status)
    if category:
        query = query.filter(Item.category == category)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Item.title.ilike(like),
                Item.summary.ilike(like),
                cast(Item.tags, String).ilike(like),
            )
        )

    items = query.order_by(Item.created_at.desc()).all()

    if tag:
        items = [i for i in items if i.tags and tag in i.tags]

    return items


@app.get("/items/{item_id}", response_model=ItemOut)
async def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="アイテムが見つかりません")
    return item


@app.put("/items/{item_id}", response_model=ItemOut)
async def update_item(item_id: int, payload: ItemUpdate, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="アイテムが見つかりません")
    if payload.status is not None:
        item.status = payload.status
    if payload.title is not None:
        item.title = payload.title
    db.commit()
    db.refresh(item)
    return item


@app.delete("/items/{item_id}")
async def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="アイテムが見つかりません")
    db.delete(item)
    db.commit()
    return {"ok": True}


ALLOWED_IMAGE_TYPES = {
    "image/png": "image/png",
    "image/jpeg": "image/jpeg",
    "image/gif": "image/gif",
    "image/webp": "image/webp",
}


@app.post("/items/image", response_model=ItemOut)
async def create_item_from_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    media_type = file.content_type or "image/png"
    if media_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="PNG / JPEG / GIF / WebP のみ対応しています")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="ファイルサイズは10MB以下にしてください")

    try:
        analysis = await analyze_image(image_bytes, ALLOWED_IMAGE_TYPES[media_type])
    except Exception as e:
        import traceback
        print(f"[IMAGE AI ERROR] {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI解析に失敗しました: {e}")

    summary_lines = analysis.get("summary", [])
    summary = "\n".join(summary_lines) if isinstance(summary_lines, list) else str(summary_lines)
    reminder_days = max(1, min(int(analysis.get("reminder_days", 7)), 90))

    item = Item(
        url=None,
        title=analysis.get("title") or "スクリーンショット",
        content=None,
        summary=summary,
        tags=analysis.get("tags", []),
        category=analysis.get("category", "その他"),
        priority=analysis.get("priority", "medium"),
        read_time_minutes=analysis.get("read_time_minutes"),
        reminder_at=datetime.utcnow() + timedelta(days=reminder_days),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.post("/items/pdf", response_model=ItemOut)
async def create_item_from_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if file.content_type not in ("application/pdf", "application/octet-stream") and \
       not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDFファイルのみ対応しています")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 32 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="ファイルサイズは32MB以下にしてください")
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="空のファイルです")

    original_filename = (file.filename or "document.pdf").rsplit(".", 1)[0]

    try:
        analysis = await analyze_pdf(pdf_bytes)
    except Exception as e:
        import traceback
        print(f"[PDF AI ERROR] {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF解析に失敗しました: {e}")

    summary_lines = analysis.get("summary", [])
    summary = "\n".join(summary_lines) if isinstance(summary_lines, list) else str(summary_lines)
    reminder_days = max(1, min(int(analysis.get("reminder_days", 14)), 90))

    item = Item(
        url=None,
        title=analysis.get("title") or original_filename,
        content=None,
        summary=summary,
        tags=analysis.get("tags", []),
        category=analysis.get("category", "その他"),
        priority=analysis.get("priority", "medium"),
        read_time_minutes=analysis.get("read_time_minutes"),
        reminder_at=datetime.utcnow() + timedelta(days=reminder_days),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/tags")
async def list_tags(db: Session = Depends(get_db)):
    items = db.query(Item.tags).all()
    tag_set: set[str] = set()
    for (tags,) in items:
        if tags:
            tag_set.update(tags)
    return sorted(tag_set)


@app.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    total = db.query(Item).count()
    unread = db.query(Item).filter(Item.status == "unread").count()
    reading = db.query(Item).filter(Item.status == "reading").count()
    done = db.query(Item).filter(Item.status == "done").count()

    from sqlalchemy import func as sqlfunc
    cats = (
        db.query(Item.category, sqlfunc.count(Item.id))
        .group_by(Item.category)
        .all()
    )

    return {
        "total": total,
        "unread": unread,
        "reading": reading,
        "done": done,
        "by_category": {cat: cnt for cat, cnt in cats},
    }

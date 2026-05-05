import re
import httpx
from bs4 import BeautifulSoup

# YouTube URL パターン
_YT_PATTERNS = [
    r'(?:youtube\.com/watch\?(?:.*&)?v=|youtu\.be/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})',
]


def extract_youtube_id(url: str) -> str | None:
    for pattern in _YT_PATTERNS:
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return None


async def scrape_youtube(url: str) -> dict:
    """YouTube oEmbed API で動画情報を取得（APIキー不要）"""
    video_id = extract_youtube_id(url)
    oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(oembed_url)
        resp.raise_for_status()
        data = resp.json()

    title = data.get("title", "")
    channel = data.get("author_name", "")
    thumbnail_url = (
        f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
        if video_id
        else data.get("thumbnail_url", "")
    )

    content = (
        f"YouTube動画タイトル: {title}\n"
        f"チャンネル: {channel}\n"
        f"URL: {url}\n"
        f"この動画はYouTubeで公開されている映像コンテンツです。"
    )

    return {
        "title": title,
        "content": content,
        "thumbnail_url": thumbnail_url,
        "is_youtube": True,
    }


async def scrape_url(url: str) -> dict:
    # YouTube は専用の取得処理
    if extract_youtube_id(url):
        return await scrape_youtube(url)

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "ja,en;q=0.9",
    }

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "lxml")

    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
        tag.decompose()

    # Title
    title = ""
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        title = og_title["content"]
    elif soup.title and soup.title.string:
        title = soup.title.string.strip()
    else:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)

    description = ""
    og_desc = soup.find("meta", property="og:description") or soup.find(
        "meta", attrs={"name": "description"}
    )
    if og_desc and og_desc.get("content"):
        description = og_desc["content"]

    main = (
        soup.find("article")
        or soup.find("main")
        or soup.find(id="content")
        or soup.find(class_="content")
        or soup.find("body")
    )
    body_text = main.get_text(separator="\n", strip=True) if main else ""
    content = (description + "\n\n" + body_text).strip()[:4000]

    return {"title": title.strip(), "content": content, "thumbnail_url": None, "is_youtube": False}

import base64
import json
import os
import pathlib
import anthropic
from dotenv import load_dotenv

# .env を絶対パスで確実に読み込む
_env_path = pathlib.Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)

def _get_client() -> anthropic.Anthropic:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key or key.startswith("sk-ant-xxx"):
        raise RuntimeError("ANTHROPIC_API_KEY が設定されていません")
    return anthropic.Anthropic(api_key=key)

SYSTEM_PROMPT = """あなたは「後で見るリスト」を管理するAIアシスタントです。
ユーザーが保存したWebコンテンツやテキストを分析し、読書管理に役立つ情報をJSON形式で提供します。
必ずJSONのみ返答し、コードブロックや説明文は不要です。"""

USER_TEMPLATE = """以下のコンテンツを分析してください。

タイトル: {title}
URL: {url}
内容:
{content}

以下のJSON形式で返答してください（すべて日本語）:
{{
  "title": "適切なタイトル（元タイトルが良ければそのまま、改善できれば修正、50文字以内）",
  "summary": [
    "1行目: 何についてのコンテンツか（核心を1文で）",
    "2行目: 重要なポイントや背景",
    "3行目: 読む価値・活用方法・結論"
  ],
  "tags": ["タグ1", "タグ2", "タグ3", "タグ4", "タグ5"],
  "category": "技術 または ビジネス または デザイン または サイエンス または エンタメ または ライフスタイル または ニュース または その他",
  "priority": "high または medium または low",
  "read_time_minutes": 読了時間の目安（整数）,
  "reminder_days": リマインダーまでの日数（整数、重要度に応じて3〜30）
}}"""


async def analyze_content(title: str, content: str, url: str = None) -> dict:
    prompt = USER_TEMPLATE.format(
        title=title or "（タイトルなし）",
        url=url or "なし",
        content=content[:3000] if content else "（本文なし）",
    )

    message = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    return json.loads(raw)


IMAGE_PROMPT = """このスクリーンショットを分析してください。

画像に含まれるテキスト、情報、コンテンツをすべて読み取り、
以下のJSON形式で返答してください（すべて日本語）:
{
  "title": "画像の内容を表すタイトル（50文字以内）",
  "summary": [
    "1行目: 何が写っているか・何についての情報か",
    "2行目: 重要なポイントや詳細",
    "3行目: 活用方法や覚えておくべき点"
  ],
  "tags": ["タグ1", "タグ2", "タグ3", "タグ4", "タグ5"],
  "category": "技術 または ビジネス または デザイン または サイエンス または エンタメ または ライフスタイル または ニュース または その他",
  "priority": "high または medium または low",
  "read_time_minutes": 確認時間の目安（整数）,
  "reminder_days": リマインダーまでの日数（整数、3〜30）
}

JSONのみ返答し、説明文は不要です。"""


async def analyze_image(image_bytes: bytes, media_type: str = "image/png") -> dict:
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    message = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": b64,
                    },
                },
                {"type": "text", "text": IMAGE_PROMPT},
            ],
        }],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    return json.loads(raw)


PDF_PROMPT = """このPDFドキュメントを分析してください。

内容全体を把握し、以下のJSON形式で返答してください（すべて日本語）:
{
  "title": "ドキュメントのタイトル（元のタイトルがあればそれを使用、50文字以内）",
  "summary": [
    "1行目: このドキュメントが何について書かれているか（核心を1文で）",
    "2行目: 主要な内容・構成・重要なポイント",
    "3行目: 読む価値・活用方法・対象読者"
  ],
  "tags": ["タグ1", "タグ2", "タグ3", "タグ4", "タグ5"],
  "category": "技術 または ビジネス または デザイン または サイエンス または エンタメ または ライフスタイル または ニュース または その他",
  "priority": "high または medium または low",
  "read_time_minutes": 読了時間の目安（整数、ページ数・文量から推定）,
  "reminder_days": リマインダーまでの日数（整数、3〜30）
}

JSONのみ返答し、説明文は不要です。"""


async def analyze_pdf(pdf_bytes: bytes) -> dict:
    b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    message = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": b64,
                    },
                },
                {"type": "text", "text": PDF_PROMPT},
            ],
        }],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    return json.loads(raw)

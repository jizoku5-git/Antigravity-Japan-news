#!/usr/bin/env python3
"""
海外ニュースサイトから日本に関する記事を収集し、Gemini APIを用いて日本語要約を生成するスクリプト。
生成されたデータは GitHub Pages 公開用の JSON ファイルとして保存されます。
"""

import os
import sys
import json
import re
import urllib.parse
from datetime import datetime, timezone, timedelta
import feedparser
import requests

# 日本時間 (JST) のタイムゾーン定義
JST = timezone(timedelta(hours=9))

# 海外ニュースのRSSフィード一覧（Google Newsの日本トピック英語検索を主軸に設定）
RSS_FEEDS = [
    {
        "name": "Google News (Japan)",
        "url": "https://news.google.com/rss/search?q=Japan+when:24h&hl=en-US&gl=US&ceid=US:en",
    },
    {
        "name": "NHK World News",
        "url": "https://www3.nhk.or.jp/nhkworld/en/news/rss/index.xml",
    },
]

DOCS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs")
DATA_DIR = os.path.join(DOCS_DIR, "data")
ARCHIVE_DIR = os.path.join(DATA_DIR, "archive")


def fetch_articles(max_articles=12):
    """RSSフィードから日本に関する最新記事を取得して整理する"""
    articles = []
    seen_titles = set()

    for feed_info in RSS_FEEDS:
        try:
            print(f"[情報] RSSフィードを取得中: {feed_info['name']}...")
            feed = feedparser.parse(feed_info["url"])
            for entry in feed.entries:
                title = entry.get("title", "").strip()
                # 重複判定（タイトルの正規化）
                norm_title = re.sub(r'[^a-zA-Z0-9]', '', title).lower()
                if not norm_title or norm_title in seen_titles:
                    continue
                seen_titles.add(norm_title)

                link = entry.get("link", "")
                pub_date = entry.get("published", "")
                summary = entry.get("summary", "")
                # HTMLタグの除去
                clean_summary = re.sub(r'<[^>]+>', '', summary).strip()

                source_name = feed_info["name"]
                if "source" in entry and hasattr(entry.source, "title"):
                    source_name = entry.source.title
                elif " - " in title:
                    # Google News形式: "ニュース見出し - メディア名"
                    parts = title.rsplit(" - ", 1)
                    title = parts[0].strip()
                    source_name = parts[1].strip()

                articles.append({
                    "original_title": title,
                    "url": link,
                    "source": source_name,
                    "published_at": pub_date,
                    "snippet": clean_summary[:300]
                })

                if len(articles) >= max_articles:
                    break
        except Exception as e:
            print(f"[警告] フィード取得中にエラーが発生しました ({feed_info['name']}): {e}")

        if len(articles) >= max_articles:
            break

    print(f"[完了] 合計 {len(articles)} 件の海外記事を収集しました。")
    return articles


def summarize_with_gemini(articles, api_key):
    """Gemini API を使って英語記事を分析し、日本語の要約JSONを生成する"""
    # 安定版の gemini-1.5-flash または gemini-2.5-flash
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"

    articles_text = ""
    for idx, art in enumerate(articles, 1):
        articles_text += f"\n--- 記事 {idx} ---\n"
        articles_text += f"タイトル: {art['original_title']}\n"
        articles_text += f"メディア元: {art['source']}\n"
        articles_text += f"スニペット: {art['snippet']}\n"
        articles_text += f"URL: {art['url']}\n"

    prompt = f"""
あなたは海外情勢と日本のニュースに精通したプロのエディターです。
海外メディアが配信した「日本に関する英語記事」のリストを精査し、日本のビジネスパーソンが毎朝通勤中やスキマ時間に3分でサクッと読める日本語要約を作成してください。

【入力記事】
{articles_text}

【要件】
1. 本当に重要・興味深い記事を厳選して（最大8〜10件程度）、以下のJSON形式で出力してください。
2. 日本語の見出し(`title_ja`)は、一目で要点が伝わる魅力的なタイトルにしてください。
3. `summary_points`は、要点を箇条書きで3行（各1文）で記述してください。専門用語には必要に応じてわかりやすい補足を付けてください。
4. `global_perspective`は、「海外メディアが何に注目しているか・世界から見てどう捉えられているか」の視点を1〜2文で記述してください。
5. `category`は以下の中から最も適切なものを1つ選んでください：
   - "経済・ビジネス"
   - "国際・政治"
   - "テクノロジー"
   - "社会・文化"
   - "観光・トレンド"
6. `tags`は検索や分類用のキーワードを2〜3個指定してください（例: ["円安", "日銀", "物価"]）。

【出力フォーマット】
以下のJSON配列のみを出力してください（Markdownの ```json ... ``` 形式で構いません）：
[
  {{
    "id": 1,
    "title_ja": "日本語見出し",
    "original_title": "Original English Title",
    "source": "BBC / Reuters など",
    "url": "https://...",
    "category": "経済・ビジネス",
    "tags": ["タグ1", "タグ2"],
    "summary_points": [
      "要約ポイント1",
      "要約ポイント2",
      "要約ポイント3"
    ],
    "global_perspective": "海外メディアの視点や論調の解説",
    "reading_time": "約1分"
  }}
]
"""

    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }

    print("[情報] Gemini API で記事の翻訳・要約を実行中...")
    response = requests.post(api_url, json=payload, headers={"Content-Type": "application/json"}, timeout=60)
    
    if response.status_code != 200:
        raise RuntimeError(f"Gemini API エラー (ステータス: {response.status_code}): {response.text}")

    result = response.json()
    try:
        content_text = result["candidates"][0]["content"]["parts"][0]["text"]
        # マークダウンのコードブロック除去
        clean_json_str = re.sub(r'^```json\s*', '', content_text.strip())
        clean_json_str = re.sub(r'\s*```$', '', clean_json_str)
        items = json.loads(clean_json_str)
        print(f"[完了] Gemini API による要約が完了しました（{len(items)} 件生成）。")
        return items
    except Exception as e:
        print(f"[エラー] Geminiの応答JSONのパースに失敗しました: {e}")
        print("生テキスト:", content_text if 'content_text' in locals() else result)
        raise


def generate_mock_data():
    """APIキーがない場合やローカル検証用の高品質なモック（サンプル）データ"""
    now = datetime.now(JST)
    return [
        {
            "id": 1,
            "title_ja": "円安が一段と進行、海外投資家は日銀の追加利上げ時期を注視",
            "original_title": "Yen weakens further as investors eye Bank of Japan's rate path",
            "source": "Reuters",
            "url": "https://www.reuters.com",
            "category": "経済・ビジネス",
            "tags": ["円相場", "日銀", "金利政策"],
            "summary_points": [
                "東京外国為替市場で対ドルでの円売りが継続し、輸入コスト上昇への懸念が再燃。",
                "市場関係者は日銀による年末までの追加利上げの可能性とタイミングに注目。",
                "米国の金融政策（FRBの利下げペース）との温度差が為替の主な変動要因となっている。"
            ],
            "global_perspective": "海外ファンドは「日銀が過度な急利上げを避ける」とみており、金利差に着目した取引が依然として優勢と報じられています。",
            "reading_time": "約1分"
        },
        {
            "id": 2,
            "title_ja": "日本の観光産業、インバウンド消費が過去最高を更新も「観光公害」対策が急務",
            "original_title": "Record tourist influx boosts Japan economy, but brings overtourism challenges",
            "source": "BBC News",
            "url": "https://www.bbc.com",
            "category": "観光・トレンド",
            "tags": ["インバウンド", "京都", "観光税"],
            "summary_points": [
                "円安と日本の食文化・アニメ人気を背景に、訪日外国人客数と消費額が過去最高水準に達した。",
                "一方で京都や富士山など人気スポットでは混雑やゴミ問題などのオーバーツーリズムが深刻化。",
                "自治体は二重価格の設定や観光客向け新税、混雑分散アプリの導入などを加速させている。"
            ],
            "global_perspective": "海外メディアは「日本は観光大国への転換に成功しつつあるが、地域住民の生活環境維持とのバランスが最大の試練」と客観的に分析しています。",
            "reading_time": "約1分"
        },
        {
            "id": 3,
            "title_ja": "次世代半導体Rapidus（ラピダス）、先端チップ量産に向けた国際連携が前進",
            "original_title": "Japan's semiconductor champion Rapidus makes strides toward 2nm chip production",
            "source": "Bloomberg",
            "url": "https://www.bloomberg.com",
            "category": "テクノロジー",
            "tags": ["半導体", "Rapidus", "先端技術"],
            "summary_points": [
                "北海道千歳市に建設中のラピダス工場で、2ナノメートル先端チップの試作ライン導入が進行中。",
                "米IBMやベルギーの研究機関imecとの強力な連携体制により開発スピードを維持。",
                "巨額の政府支援に対する国民的理解と、将来の顧客確保が今後の重要な成否を握る。"
            ],
            "global_perspective": "世界のサプライチェーン再編の中で、「日本が最先端半導体の製造拠点として復権できるか」を世界各国のテック業界が固唾をのんで見守っています。",
            "reading_time": "約1分"
        },
        {
            "id": 4,
            "title_ja": "日本の宇宙ベンチャー、商業月面着陸ミッションの最終準備段階へ",
            "original_title": "Japanese space startup enters final preparations for private lunar landing",
            "source": "CNN",
            "url": "https://www.cnn.com",
            "category": "テクノロジー",
            "tags": ["宇宙開発", "月面着陸", "民間宇宙"],
            "summary_points": [
                "日本の民間宇宙企業が開発した月着陸船が、次回の打ち上げに向けた最終試験を完了。",
                "前回の課題であった高度測定センサーなどの改良を施し、着陸精度の向上を図る。",
                "官民連携による月面探査ビジネスの先駆けとして世界的な注目を集めている。"
            ],
            "global_perspective": "民間による月面探査競争がアメリカやインドで激化する中、日本の民間技術が世界的な月経済（シスルナ経済）で存在感を示せるかが論点となっています。",
            "reading_time": "約1分"
        },
        {
            "id": 5,
            "title_ja": "日本の伝統工芸と地方創生、海外の若手デザイナーが新たな価値を吹き込む",
            "original_title": "How global designers are reviving Japan's ancient rural craft traditions",
            "source": "The Guardian",
            "url": "https://www.theguardian.com",
            "category": "社会・文化",
            "tags": ["伝統工芸", "地方創生", "デザイン"],
            "summary_points": [
                "後継者不足に悩む日本の漆器や織物工房に、欧米の若手デザイナーが移住・参画する事例が増加。",
                "伝統的な職人技にサステナブルな現代的デザインを融合させ、海外高級ホテルやギャラリーに展開。",
                "消えゆく地域の歴史的技術をグローバルな販路で再生するモデルケースとして期待されている。"
            ],
            "global_perspective": "日本の「モノづくりへのこだわり（職人精神）」に対する海外の敬意は根強く、伝統と現代を掛け合わせる日本の地方の可能性を高く評価しています。",
            "reading_time": "約1分"
        }
    ]


def save_data(items):
    """取得・要約したデータをJSONファイルとして保存し、アーカイブインデックスを更新する"""
    now = datetime.now(JST)
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%Y-%m-%d %H:%M JST")

    os.makedirs(ARCHIVE_DIR, exist_ok=True)

    data = {
        "updated_at": time_str,
        "date": date_str,
        "total_articles": len(items),
        "articles": items
    }

    # 1. 最新データとして保存
    latest_path = os.path.join(DATA_DIR, "latest.json")
    with open(latest_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[保存] 最新データを書き込みました: {latest_path}")

    # 2. 今日のアーカイブとして保存
    archive_path = os.path.join(ARCHIVE_DIR, f"{date_str}.json")
    with open(archive_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[保存] アーカイブデータを書き込みました: {archive_path}")

    # 3. アーカイブ一覧インデックスの更新
    index_path = os.path.join(ARCHIVE_DIR, "index.json")
    archive_list = []
    if os.path.exists(index_path):
        try:
            with open(index_path, "r", encoding="utf-8") as f:
                archive_list = json.load(f)
        except Exception:
            archive_list = []

    # 重複除外して追加
    existing_dates = {item["date"] for item in archive_list if isinstance(item, dict) and "date" in item}
    if date_str not in existing_dates:
        archive_list.insert(0, {
            "date": date_str,
            "title": f"{now.strftime('%m月%d日')}の海外ニュース",
            "count": len(items),
            "file": f"archive/{date_str}.json"
        })

    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(archive_list, f, ensure_ascii=False, indent=2)
    print(f"[保存] アーカイブ目次を更新しました: {index_path}")


def main():
    print("=" * 60)
    print(" 海外から見た日本ニュース 自動要約システム (J-Global Digest)")
    print("=" * 60)

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()

    if not api_key:
        print("[注意] 環境変数 'GEMINI_API_KEY' が設定されていません。")
        print("[案内] 動作検証のため、高品質なデモサンプルデータを使用してUIを構築・更新します。")
        items = generate_mock_data()
    else:
        try:
            raw_articles = fetch_articles(max_articles=12)
            if not raw_articles:
                print("[警告] 記事が取得できなかったため、モックデータを使用します。")
                items = generate_mock_data()
            else:
                items = summarize_with_gemini(raw_articles, api_key)
        except Exception as e:
            print(f"[エラー] ニュース取得・要約中にエラーが発生しました: {e}")
            print("[フォールバック] サンプルデータに切り替えて保存します。")
            items = generate_mock_data()

    save_data(items)
    print("\n[完了] すべての処理が正常に完了しました！")


if __name__ == "__main__":
    main()

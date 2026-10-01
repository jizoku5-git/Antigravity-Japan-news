# J-Global Digest (海外が見た日本ニュース要約)

毎朝海外主要メディア（Google News、BBC、Reuters、CNN等）が配信した「日本に関する英語記事」を自動収集し、Google Gemini API（無料枠）で要約・翻訳して、スマホでサクッと読めるWebページ（GitHub Pages）に毎日自動更新する完全無料の仕組みです。

---

## 🌟 主な特徴

- **完全無料・サーバー代ゼロ**: GitHub Actions（自動実行）＋ GitHub Pages（Web公開）＋ Gemini API（無料枠）で運用費は0円です。
- **毎朝自動更新**: 毎朝 6:30（JST）に自動で最新の海外ニュースを取得・日本語要約。
- **スマホ特化デザイン**:
  - 通勤電車の中でも片手（親指）でサクッと読めるレイアウト
  - 忙しい朝に嬉しい「箇条書き3行要約」
  - 「海外メディアの着眼点・論調（世界から日本はどう見えているか）」の独自ハイライト
  - 読んだ記事を記録できる「既読チェック」機能
  - ダークモード / ライトモード対応
  - カテゴリ別（経済、政治、テクノロジー、文化、観光）フィルター ＆ キーワード検索
  - 過去のバックナンバーが読める「アーカイブ機能」
- **プライベート保護（パスコードロック機能）**:
  - 初回アクセス時に自分だけの4桁の暗証番号（PIN）を設定可能。
  - スマホに一度認証すると次回から自動でスキップされるため、毎朝サクッと開けます。
  - 第三者がURLを開いても、暗証番号が合わない限り記事は一切表示されません。
- **アプリアイコン化（PWA対応）**: スマホの「ホーム画面に追加」するだけで、本物のアプリのようにワンタップで全画面表示できます。

---

## 🚀 はじめ方（設定手順）

### ステップ1: Gemini APIキーを無料で取得する
1. [Google AI Studio](https://aistudio.google.com/) にアクセスし、Googleアカウントでログインします。
2. 「**Get API key**」をクリックし、「**Create API key**」を選択してキーを発行します。
3. 発行された文字列（APIキー）をコピーしておきます。

### ステップ2: このプロジェクトをGitHubにアップロードする
まだGitHubにリポジトリを作成していない場合は、GitHub上で新規リポジトリ（例: `Antigravity-Japan-news`）を作成し、プッシュします。

```bash
git init
git add .
git commit -m "Initial commit: J-Global Digest"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/Antigravity-Japan-news.git
git push -u origin main
```

### ステップ3: GitHubにAPIキーを登録する
1. GitHubの該当リポジトリのページを開きます。
2. 上部メニューの **「Settings」** をクリックします。
3. 左サイドバーの **「Secrets and variables」** > **「Actions」** を選択します。
4. **「New repository secret」** ボタンを押します。
   - **Name**: `GEMINI_API_KEY`
   - **Secret**: ステップ1で取得したAPIキー
5. **「Add secret」** をクリックして保存します。

### ステップ4: GitHub Pages を有効化する
1. リポジトリの **「Settings」** を開きます。
2. 左サイドバーの **「Pages」** を選択します。
3. **「Build and deployment」** の設定を行います：
   - **Source**: `Deploy from a branch` を選択
   - **Branch**: `main` を選択し、フォルダは `/docs` を選択して **「Save」** をクリックします。
4. 数分待つと、画面上部に公開URL（`https://<ユーザー名>.github.io/Antigravity-Japan-news/`）が表示されます！

### ステップ5: 自動更新を手動でテスト実行してみる
毎朝6:30の自動実行を待たずに、今すぐテストすることも可能です：
1. GitHubリポジトリの **「Actions」** タブを開きます。
2. 左側のワークフロー一覧から **「Daily Japan News Summarizer」** を選択します。
3. 右側の **「Run workflow」** ドロップダウンから **「Run workflow」** ボタンをクリックします。
4. 約1〜2分で処理が完了し、最新の要約ニュースがGitHub Pagesに反映されます！

---

## 📱 スマホでの閲覧方法（ホーム画面に追加）

### iPhone (Safari) の場合:
1. Safariで発行されたGitHub PagesのURLを開きます。
2. 画面下部の中央にある **共有アイコン（四角から矢印が出ているアイコン）** をタップします。
3. メニューをスクロールして **「ホーム画面に追加」** をタップします。
4. ホーム画面に専用アイコンが配置され、ワンタップで起動できるようになります。

### Android (Chrome) の場合:
1. Chromeで発行されたGitHub PagesのURLを開きます。
2. 画面右上の **メニューボタン（縦の3点リーダー）** をタップします。
3. **「アプリをインストール」** または **「ホーム画面に追加」** をタップします。

---

## ⚙️ カスタマイズ

- **配信時間を変更したい場合**:
  - [`.github/workflows/daily_news.yml`](.github/workflows/daily_news.yml) 内の `cron: '30 21 * * *'`（UTC時間）を変更してください（例: JST 朝7:00にする場合は `cron: '0 22 * * *'`）。
- **ニュースの取得ソースを増やしたい場合**:
  - [`fetch_and_summarize.py`](fetch_and_summarize.py) 内の `RSS_FEEDS` リストにお好みのRSSフィードURLを追加できます。

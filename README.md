# 広告重複チェッカー

公明新聞の広告PDFを紙面日付ごとに取り込み、同日内の広告内容かぶりを確認するための試作サイトです。

## 公開先

- GitHub: https://github.com/07-hajime-tokyo/ad-duplicate-checker
- Vercel: https://ad-duplicate-checker.vercel.app

## 起動方法

```powershell
python -m http.server 4173
```

起動後、ブラウザで `http://localhost:4173/` を開きます。

## できること

- PDFアップロード
- このフォルダ内PDFのデモ読込
- 紙面上の日付の確認
- 月別、日別のPDF一覧
- 面ごとのサムネイル表示
- 広告主、業種、訴求内容の入力
- 画像類似と入力内容による `○△✕` 判定
- フィードバック保存
- アラート用メールアドレス登録
- アラート文面作成

詳しい制作ルールは [docs/site-rules.md](docs/site-rules.md) を参照してください。

レビュー用エージェントへの引き継ぎは [AGENTS.md](AGENTS.md) と [docs/review-agent-handoff.md](docs/review-agent-handoff.md) にまとめています。

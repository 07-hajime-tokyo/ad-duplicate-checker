# 広告割付チェッカー 運用・データ設計ルール

## 目的

公明新聞の広告割付、PDF確認、重複判定、目視フィードバック、印刷確認、AIによる割付案作成を、毎月使い回せる形で運用する。

人間はサイトで確認・入力する。AIは構造化データと運用ルールを読む。プログラムはDB/CSV/JSONを読む。印刷現場ではPDF化した確認表を使う。

## 基本方針

- 正本データはブラウザやExcelではなく、サーバー側DBに保存する。
- PDF、紙面画像、印刷用PDFはファイルストレージに保存する。
- Excel/Google Sheets/PDF/Notionは正本ではなく、同期・出力・レビュー用のビューとして扱う。
- 広告主と代理店は必ず別フィールドに分ける。色分けは表示ルールとして維持する。
- 毎月の割付表はテンプレートから生成し、月をまたいでも同じ列構造を使う。
- 人間がサイトで修正した内容はDBへ保存し、必要に応じてSheets/Excel/PDFへ再出力する。
- AI割付案は自動確定しない。必ず目視確認と承認ステータスを持たせる。

## 推奨アーキテクチャ

### 保存先

| 種別 | 正本/出力 | 推奨保存先 | 理由 |
|---|---:|---|---|
| 広告枠、広告主、業種、訴求、判定 | 正本 | Postgres系DB | 月次・日次・履歴・検索・権限管理に向く |
| PDF原本、紙面画像、印刷用PDF | 正本ファイル | Vercel Blob等のBlobストレージ | PDF/画像など大きいファイル向き |
| Google Sheets | 出力/同期 | Google Sheets API | 人間の一覧確認、社内共有、簡易編集に向く |
| Excel | 出力 | サーバー生成または手元生成 | 印刷前確認、バックアップ、配布向き |
| Notion | 任意の台帳 | Notion API | レビュー結果、決定事項、AIダブルチェックの記録向き |

Vercel Blobはユーザー投稿ファイル等を実行時に保存できるオブジェクトストレージ。PostgresはVercel Marketplace経由のNeon/Supabase等を使う前提。Google Sheets APIは値の読み書き・追記に使える。Notion APIはデータベース/データソースを読書きできるが、アプリの正本DBにはしない。

## データモデル

### months

- `month_id`: `2026-06`
- `status`: `draft`, `in_progress`, `confirmed`, `closed`
- `created_at`
- `updated_at`

### issues

新聞発行日単位。

- `issue_id`
- `publication_date`
- `month_id`
- `status`: `draft`, `pdf_uploaded`, `reviewed`, `approved`, `printed`
- `print_pdf_url`
- `notes`

### pages

- `page_id`
- `issue_id`
- `pdf_file_id`
- `page_number`
- `face_name`: `1面`, `2面`, `3面`, `ラテ面`
- `spread_group`: `1`, `2&3`, `4&5`, `6&7`, `ラテ`
- `thumbnail_url`
- `rotation`
- `ocr_status`

### ads

広告枠1件=1行。

- `ad_id`
- `issue_id`
- `page_id`
- `slot`: `記事下メイン`, `題字横`, `題字中`, `ラテ中`, `その他`
- `client_confirmed`
- `client_candidate`
- `agency_candidate`
- `agency_possible`
- `client_agency_color_type`: `client`, `agency`, `unknown`
- `industry`
- `business_type`
- `product_category`
- `appeal_summary_20`
- `appeal_detail`
- `source_text`
- `source_type`: `pdf_ocr`, `pdf_visual`, `allocation_sheet`, `manual`, `ai`
- `confidence`: `high`, `medium`, `low`
- `verdict`: `○`, `△`, `✕`, `未判定`
- `duplicate_reason`
- `status`: `draft`, `needs_check`, `confirmed`, `rejected`
- `updated_by`
- `updated_at`

### allocation_rules

サイト上に入力欄を設置し、随時追加・改訂する。

- `rule_id`
- `title`
- `rule_text`
- `scope`: `global`, `industry`, `client`, `slot`, `issue`, `month`
- `severity`: `info`, `warning`, `block`
- `active`
- `created_by`
- `created_at`
- `updated_at`

例:

- 同一広告主は同日重複不可。
- 同じ健康食品カテゴリは同日2件以上なら△。
- 通販同士でも商品カテゴリが異なれば○候補。
- 子育て領域でも、支援制度情報と教育支援啓発は競合扱いしない。
- 代理店名のみの割付名は広告主確定まで△。

### allocation_proposals

AIやプログラムが作る割付案。

- `proposal_id`
- `month_id`
- `issue_id`
- `generated_by`: `ai`, `program`, `human`
- `input_snapshot_id`
- `proposal_json`
- `score`
- `warnings`
- `status`: `draft`, `reviewing`, `accepted`, `rejected`
- `reviewed_by`
- `reviewed_at`

### audit_logs

誰が何を変えたかを残す。

- `log_id`
- `entity_type`
- `entity_id`
- `action`
- `before_json`
- `after_json`
- `actor`
- `created_at`

## 月次運用

1. 翌月または数ヶ月先の `months` と `issues` を自動生成する。
2. 予定広告、申請状況、過去実績、割付ルールを取り込む。
3. AI/プログラムが初期割付案を作る。
4. 人間がサイトで確認し、広告主・代理店・業種・訴求・判定を修正する。
5. 修正内容はDBに即保存する。
6. 必要に応じてGoogle Sheets/Excelへ同期する。
7. 確認用PDFを生成し、紙で印刷する。
8. 作業場では印刷PDFを見ながら確認し、修正はサイトへ戻す。
9. 複数AIでルール・判定・割付案をダブルチェックする。
10. 最終承認後、月次を `closed` にする。

## テンプレート戦略

### 推奨

毎月テンプレートから自動生成する。

理由:

- 数ヶ月先まで空枠を作ると変更時のメンテナンスが増える。
- ただし仮予約や長期申請があるため、3か月先まで `draft` として自動生成するのは有効。
- 生成済みの月も、テンプレート変更時に安全に再同期できるよう `template_version` を持たせる。

### 生成範囲

- 常時: 当月、翌月、翌々月を生成。
- 申請がある場合: 申請対象月だけ追加生成。
- 月末: 翌々月を自動追加。

## 広告主と代理店の判別

- 割付表の色分けは維持する。
- DBには色そのものではなく意味を保存する。
- `client_agency_color_type = client` は広告主候補。
- `client_agency_color_type = agency` は代理店候補。
- `agency_possible = true` の場合、AI判定は確定広告主として扱わない。
- サイト表示では広告主と代理店を色・ラベルで分ける。
- Sheets/Excel/PDFでも同じ色ルールを適用する。

## 印刷用PDFルール

印刷用PDFはDBから生成する。

構成:

- 表紙: 月、発行日、生成時刻、未確認件数、△/✕件数。
- 日別一覧: 日付、面、広告主、代理店、業種、訴求20字、判定、確認メモ。
- 見開き確認: `1`, `2&3`, `4&5`, `6&7`, `ラテ` の順。
- 重複チェック表: 判定、広告A、広告B、理由、対応欄。
- ルール一覧: 適用中の割付ルール。

印刷物は確認用であり、修正はサイトからDBへ戻す。紙に書き込んだ内容は、後で目視フィードバックまたは広告行のメモとして入力する。

## Google Sheets/Excel同期ルール

- DBからSheets/Excelを生成する。
- Sheets/ExcelからDBへ戻す場合は、行ID `ad_id` を必須にする。
- 人間がSheetsを編集する運用を認める場合、同期ボタンを押した時だけDBへ反映する。
- 同期時は差分プレビューを表示し、上書き事故を避ける。
- Excelは月次スナップショットとして保存し、最新正本はDBとする。

出力ファイル:

- `ads_normalized.csv`
- `ads_normalized.json`
- `ads_by_date.jsonl`
- `advertiser_profiles.json`
- `allocation_YYYY-MM_unmerged_normalized.xlsx`
- `print_check_YYYY-MM.pdf`

## AI割付案ルール

AIに渡す入力:

- 申請広告一覧
- 過去掲載履歴
- 広告主プロフィール
- 業種・商品カテゴリ
- 面別枠ルール
- 同日重複ルール
- 人間の目視フィードバック
- 現在有効な `allocation_rules`

AIの出力:

- 割付案
- 競合懸念
- 代替案
- 判断理由
- 適用したルールID
- 自信度

AI出力は `allocation_proposals` に保存し、人間が承認するまで本割付にはしない。

## 複数AIによるダブルチェック

1つのAIだけで確定しない。

最低2種類のチェックを行う。

- AI-A: 広告内容・競合・訴求の意味を見る。
- AI-B: 運用ルール違反、DB項目欠落、代理店/広告主混同を見る。
- プログラム: 同一広告主、同一商品カテゴリ、同日重複、未入力を機械的に検出する。

チェック結果は `review_runs` として保存する。

### review_runs

- `review_run_id`
- `issue_id` または `month_id`
- `reviewer_type`: `ai`, `program`, `human`
- `reviewer_name`
- `input_snapshot_id`
- `result_json`
- `created_at`

## サイト入力欄

必要な入力欄:

- 目視フィードバック
- 割付ルール
- 広告主プロフィール修正
- 代理店/広告主の判別修正
- 判定理由の修正
- 印刷用メモ

割付ルール入力欄は、登録後に即 `allocation_rules` に保存する。保存後、AI割付案と重複判定の次回実行時に反映する。

## 実装段階

### Phase 1: 保存基盤

- Postgres系DBを追加。
- Vercel Blob等を追加。
- 現在の `seed-data.json` をDBへ移行。
- サイト入力をDB保存に変更。

### Phase 2: 出力基盤

- DBからCSV/JSON/JSONL/XLSXを生成。
- DBから印刷用PDFを生成。
- Sheets同期を追加。

### Phase 3: 割付案

- 申請状況テーブルを追加。
- 割付ルール入力欄を追加。
- AI/プログラムによる割付案生成。
- 複数AIレビュー結果を保存。

### Phase 4: 運用安定化

- ログイン/権限。
- 承認ワークフロー。
- 月次クローズ。
- バックアップ。

## 注意点

- Notionは便利だが、PDFや大量の判定履歴の正本DBにはしない。
- Sheetsは共有に便利だが、同時編集・同期衝突に注意する。
- 紙で確認する現場があるため、印刷PDFは毎日/毎版のスナップショットとして残す。
- 広告主と代理店の混同は最重要リスクとして扱う。
- AIが作った割付案は必ず人間が承認する。

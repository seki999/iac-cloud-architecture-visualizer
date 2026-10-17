# IaC Cloud Architecture Visualizer 利用ガイド

Terraform/OpenTofu の **`show -json` 出力**から、編集可能な diagrams.net 構成図を生成します。処理はローカルで実行され、CLI は Terraform の実行、AWS API 呼び出し、入力データのアップロードを行いません。

## セットアップ

Node.js 22 または 24、pnpm 9.15.9 を使用してください。既存の JSON を処理する場合、Python、Terraform、AWS CLI、AWS 認証情報は不要です。

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
pnpm iacviz generate --input fixtures/dataset-01-network/plan.json --view all --output out/architecture.drawio
pnpm iacviz inspect --input fixtures/dataset-01-network/plan.json
pnpm iacviz validate --input fixtures/dataset-01-network/plan.json
```

diagrams.net の「ファイル → デバイスから開く」で生成ファイルを開きます。`--view all` は Overview と Network の2ページを生成します。ノード、コンテナ、ラベル、接続線はネイティブの編集可能なオブジェクトです。リソースアドレスと安全なメタデータはノードのデータとして保持します。AWS サービスは diagrams.net の aws4 アイコン付きカードで描画し、VPC/サブネットは AWS グループ形式の枠で表示します。Network ページでは、サブネットの AZ が記録されている場合 AZ ごとの列にまとめます。9 つのサンプルはすべて app.diagrams.net で開いて確認済みです（ページ、接続線の端点、移動・編集可否、保存後のメタデータ）。詳細は [draw.io 出力と受入確認](docs/drawio-export.md) を参照してください。A4/A3 印刷時の可読性は手動確認が必要です。

```powershell
pnpm dev generate --input fixtures/dataset-02-three-tier/plan.json --view overview --output out/overview.drawio
pnpm iacviz generate --input fixtures/dataset-07-multi-subnet/plan.json --view network --direction TOP_TO_BOTTOM --output out/network.drawio
pnpm examples
pnpm verify:drawio
pnpm bench
```

空白を含むパスは引用符で囲んでください。Linux/macOS でも同じ1行のコマンドを使用できます。

## 入力と解釈

既存の状態または保存済みのプランを、利用者が明示的に JSON に変換します。

```powershell
terraform show -json saved.tfstate > state.json
terraform show -json saved.tfplan > plan.json
# OpenTofu: tofu show -json saved.tfplan > plan.json
```

PowerShell 7 の既定は UTF-8 です。Windows PowerShell 5.1 では `terraform show -json saved.tfplan | Set-Content -Encoding UTF8 plan.json` を使用してください。UTF-8 BOM に対応しています。生の `.tfstate` JSON は別形式のため対象外です。`format_version` 1.x に対応し、未知のメジャーバージョンを拒否します。ファイル名では判定しません。共通 JSON 形式だけではエンジンを区別できないため、通常は `unknown` と記録します。

State は記録された状態であり、現在の実環境と異なる可能性があります。Plan は予定された状態で、ID が未確定の場合があります。明確な参照は推論関係として保持しますが、複数インスタンスを一意に解決できない場合は警告を表示し、確定した関連を作りません。`depends_on` は IaC の依存関係であり、通信やバインドの証明ではありません。置換アクションの順序は維持します。デプロイは実行しません。

## 表示設定

Overview は一部の詳細リソースを非表示にしますが、Graph Core から削除しません。Network はネットワーク、ルーティング、セキュリティの詳細を表示します。複数サブネットにまたがるリソースは、証拠が揃えば共通 VPC に配置し、不明な場合はルートに置きます。S3/IAM をサブネットに強制配置せず、ECS から RDS への業務通信も推測しません。

`--config diagram.json` の例：

```json
{
  "schemaVersion": "1.0",
  "view": "network",
  "layout": { "direction": "LEFT_TO_RIGHT", "spacing": 40, "nodeSpacing": 40 },
  "hiddenResourceAddresses": [],
  "collapsedGroups": [],
  "manualPositions": {},
  "annotations": []
}
```

CLI で明示した view/direction が設定ファイルより優先されます。非表示アドレスと間隔は反映されます。折りたたみ、手動位置、注釈は将来用スキーマであり、空でない場合は未対応の警告を表示します。

## 安全性と制限

許可された構成属性のみをモデルに取り込み、機密マスクと追加のテスト秘密パターン検出を適用します。ネストした機密フィールドは保守的に除外します。outputs、設定定数、元の values 全体は複製しません。XML はライブラリで生成し、ラベルはプレーンテキストです。未指定の秘密をすべて検出することはできないため、共有前に入力と出力を確認してください。Terraform の JSON 自体にも平文の秘密が含まれる可能性があります。

現在は実行可能な MVP 基盤です。集約戦略の拡充、高度な経路推論、履歴/deposed オブジェクト、手動配置などに未完了項目があります。AWS アイコンは 2026-10-17 に app.diagrams.net で存在を確認したステンシル名のみを使用します。旧版・オフライン版 diagrams.net は未検証です（アイコンが表示されなくてもカードのラベルは読めます）。大規模図の印刷は複数ページになる場合があります。未知のリソースは汎用ノードとして残します。

[開発結果](docs/development-report.md)、[制限](docs/limitations.md)、[安全性](docs/security.md)、[性能測定](docs/performance-results.json) を参照してください。9データセットを回帰検証し、08 は200リソースの決定的な合成サンプルです。既存サンプルの出所は PROVENANCE.json に記載されていますが、今回の継続作業では元の CLI 出力を再生成していません。GitHub Actions（Windows/Linux/macOS × Node 22/24）の全6ジョブが成功しています（2026-10-17）。

AWS の意味規則は providers-aws 層で拡張し、XML レンダラーには組み込まないでください。設計、テスト、ロードマップは docs を参照してください。Apache-2.0 での配布を想定し、LICENSE にライセンスを記載しています。

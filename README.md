# 共有キャンバス

128×128ピクセルのリアルタイム共有キャンバスです。Cloudflare版では、Reactの
フロントエンドをWorkers Static Assetsから配信し、1つのDurable Objectで
キャンバスの永続化とWebSocketクライアントの同期を行います。

## 必要な環境

- Node.js 22 LTS（現在の`pywrangler`はNode.js 26では起動できません）
- npm
- Python 3.12以降（`uv`が自動で用意するPythonでも可）
- [uv](https://docs.astral.sh/uv/)
- プレビューまたは本番デプロイに使用するCloudflareアカウント

Worker部分はPython Workersで実装しています。2026年8月時点でCloudflareの
Python Workersはベータ機能です。本番採用時はCloudflareの更新情報と既知の制約を
継続的に確認してください。

Node.jsのバージョン管理ツールを使う場合は、リポジトリ直下の`.node-version`を
参照してください。

## ローカル開発

初回のみ、それぞれの依存関係をインストールします。

```sh
npm --prefix frontend install
npm --prefix worker install
cd worker
uv sync
cd ..
```

フロントエンドをビルドし、ローカルWorkerを起動します。

```sh
npm --prefix worker run dev
```

Wranglerが表示したURLを複数のブラウザウィンドウで開き、リアルタイム同期を
確認してください。

## 検証

```sh
npm --prefix worker run check
```

Pythonのlintと単体テスト、フロントエンドのlintとビルド、Python Workerデプロイの
dry-runをまとめて実行します。

## デプロイ

WranglerでCloudflareへログインした後、次を実行します。内部ではPython Workers用の
`pywrangler deploy`を呼び出します。

```sh
npm --prefix worker run deploy
```

初回デプロイでは、`worker/wrangler.jsonc`の`v1` migrationに定義した
SQLiteベースのDurable Objectクラスが作成されます。

既にTypeScript版をデプロイ済みの場合は、同じWorker名、binding、DOクラス名、
`v1` migrationを維持しているため、既存のDurable Object名前空間とセル保存キーを
引き継ぎます。新しいmigrationタグは追加しません。

## ドキュメント

- [Cloudflare Workers導入レポート（HTML）](docs/cloudflare-workers-report.html)
- [アーキテクチャ](docs/architecture.md)
- [Cloudflare移行計画](docs/cloudflare-migration.md)
- [Durable Objectsの設計判断記録](docs/adr/0001-use-durable-objects.md)
- [共有キャンバスのResetに関する設計判断記録](docs/adr/0002-reset-shared-canvas.md)

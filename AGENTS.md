# リポジトリ作業規約

## プロジェクトの目的

このリポジトリは、128×128ピクセルのリアルタイム共有キャンバスを実装する。
移行後はCloudflare Workers上で動作し、Durable ObjectがWebSocketクライアントの
調整とキャンバス状態の永続化を担当する。

## 維持する挙動

- WebSocketエンドポイントはフロントエンドと同一オリジンの`/ws`とする。
- クライアントには接続直後に`snapshot`メッセージを送る。
- 有効な`draw`メッセージを、接続中の全クライアントへ配信する。
- `updatedAt`はサーバーが設定し、クライアントから送られた値は無視する。
- グリッド座標には0以上127以下の整数を使用する。
- Cloudflare移行の初期版では、全利用者で1枚の共有キャンバスを使用する。

## 移行後の構成

- `frontend/`にReactとViteのアプリケーションを置く。
- `worker/`にPythonで記述したCloudflare WorkerとDurable Objectを置く。
- Workers Static Assetsから`frontend/dist`を配信する。
- Workerは`/ws`を固定名のDurable Objectへ転送する。
- Durable ObjectがWebSocket接続と永続化されたセル状態を所有する。
- Durable Objects WebSocket Hibernation APIを使用する。
- Python Workerの実行とデプロイには`uv`と`pywrangler`を使用する。

## 作業ルール

- 変更は小さく、レビュー可能な単位に分ける。
- 旧Go/Docker/Caddy構成はCloudflare移行完了に伴い削除済み。再追加しない。
- 意図的な移行として文書化する場合を除き、WebSocketプロトコルを維持する。
- 構成、コマンド、設定、プロトコルの挙動を変更した場合はドキュメントも更新する。
- CloudflareのアカウントID、APIトークン、`.dev.vars`、生成されたデプロイ状態を
  コミットしない。
- 関係のない整形や依存関係の更新を行わない。

## 検証方法

Workerを変更した場合は`worker/`で次を実行する。

```sh
npm run check
```

フロントエンドだけを変更した場合は`frontend/`で次を実行する。

```sh
npm run lint
npm run build
```

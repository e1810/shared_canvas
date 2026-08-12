# Cloudflare移行計画

## 目的

利用者から見える既存キャンバスの挙動を変えずに、インメモリのGo WebSocket
バックエンドとコンテナベースのデプロイを、Cloudflare Workers、Durable Objects、
Workers Static Assetsへ置き換えます。

## 互換性要件

- 同一オリジンの`/ws`エンドポイントを維持する。
- `draw`と`snapshot`のJSONメッセージ形式を維持する。
- 128×128グリッドを維持する。
- 初回移行では全利用者で1枚の共有キャンバスを維持する。
- 受理した描画を送信元とその他すべての接続中クライアントへ配信する。

## 設計判断

- WorkerとDurable ObjectはPython Workersで実装し、標準ライブラリでJSON検証を行う。
- Python Workersは2026年8月時点でベータのため、`python_workers`互換フラグを明示し、
  Cloudflareの更新と制約を継続的に確認する。
- 新規Durable Objectクラスに必要なSQLiteベースのクラスを使用し、セルの保存には
  トランザクション対応のkey-value storage APIを利用する。
- アイドル接続のためにDurable Objectをメモリへ残し続ける必要がないよう、
  Hibernation WebSocket APIを使用する。
- 描画データを永続化してから配信する。
- 移行完了後は旧Go、Caddy、Docker構成を削除し、Cloudflare構成を唯一の実行基盤とする。

## 移行チェックリスト

- [x] 移行後のアーキテクチャと互換性要件を文書化する。
- [x] WorkerとDurable Objectの土台を追加する。
- [x] メッセージ検証とプロトコルテストを実装する。
- [x] セルを永続化し、接続時にsnapshotを送る。
- [x] Hibernation対応WebSocketで描画を配信する。
- [x] Viteの出力をWorkers Static Assetsとして設定する。
- [x] ローカル環境で2クライアントのWebSocketスモークテストを行う。
- [x] WorkerとDurable ObjectをPythonへ移植し、既存の保存キーを維持する。
- [x] Cloudflareへデプロイし、Python Worker版が100%配信されていることを確認する。
- [ ] 再接続後およびDurable Objectの退避後も状態が維持されることを確認する。
- [ ] 本番公開前にroom IDを追加するか判断する。
- [x] 従来のGo、Caddy、Docker、旧デプロイworkflowを削除する。

## 今回は行わない改善

- 複数キャンバスまたはroom IDへの対応。
- 認証とモデレーション。
- レート制限と描画メッセージのバッチ化。
- `snapshot`のページ分割またはコンパクトなバイナリ表現。
- メトリクス、構造化ログ、アラート。

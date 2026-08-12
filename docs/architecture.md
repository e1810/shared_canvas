# アーキテクチャ

## リクエストの流れ

```text
ブラウザ
  |-- HTTPアセット --> Workers Static Assets --> Reactアプリケーション
  `-- /ws Upgrade --> Worker --> global CanvasDurableObject
                               |-- Durable Objectストレージ
                               `-- 接続中のWebSocketクライアント
```

フロントエンドとWebSocketエンドポイントは同一オリジンです。ブラウザは
`window.location`からWebSocket URLを組み立てるため、環境ごとのホスト設定は
不要です。

## Worker

Workerは`worker/src/entry.py`の`Default`クラスとしてPythonで実装しています。
PythonコードはCloudflare上でPyodideを介してWebAssemblyとして実行され、Workersの
JavaScript APIはFFI（異なる言語間の橋渡し）経由で利用します。

Workerには2つのバインディングがあります。

- `CANVAS`: `CanvasDurableObject`の名前空間。
- `ASSETS`: `frontend/dist`に生成されたViteの本番ビルド。

アプリケーションのルートとして処理するのは`/ws`だけです。それ以外のリクエストは
アセットバインディングへ渡します。Wrangler設定ではSPAフォールバックを有効にしています。

Python Workerを有効にするため、`wrangler.jsonc`には
`"compatibility_flags": ["python_workers"]`を設定しています。ローカル実行と
デプロイにはWranglerをPython向けに包んだ`pywrangler`を使用します。

## Durable Object

Workerは固定名`global`から1つのDurable Object IDを取得します。これは、1枚の
インメモリ共有キャンバスを公開していた従来のGoプロセスと同じ構成です。

Durable Objectは次の処理を担当します。

- Hibernation WebSocket APIでサーバー側ソケットを受け入れる。
- ソケット接続時に永続化済みの`snapshot`を送信する。
- 受信した`draw`メッセージを検証する。
- サーバー側で時刻を設定する。
- 更新を配信する前にセルを永続化する。
- インメモリのクライアント一覧を持たず、Durable Objectランタイムから接続中の
  ソケットを取得する。

`CanvasDurableObject(DurableObject)`というPythonクラス名は、`wrangler.jsonc`の
`class_name`と一致させる必要があります。`CANVAS` bindingはWorkerからそのクラスの
名前空間へアクセスするためのハンドルです。固定名`global`を`getByName()`へ渡すと、
すべての利用者が同じObjectへ到達します。

Pythonのメソッド名`webSocketMessage`、`webSocketClose`、`webSocketError`はCloudflare runtimeが
イベント時に呼び出す予約名なので、snake_caseへ変更しません。
現在の互換日付ではClose handshakeをruntimeが自動処理するため、`webSocketClose`は
受け口だけを定義し、予約済みのClose codeを再送しないよう何も行いません。

セルのキーには`cell:YYY:XXX`形式を使用します。座標をゼロ埋めすることで、
ストレージキーが辞書順で返されたときの`snapshot`順序を一定にします。
Python SDKはStorage APIが返すJavaScriptの`Map`をPythonの`dict`へ自動変換します。
このため、既存のTypeScript版が保存した同じキーを`storage.list()`で読み出せます。

## WebSocketプロトコル

クライアントからサーバーへの描画要求：

```json
{"type":"draw","x":12,"y":34,"color":"#ff0000"}
```

サーバーから配信される更新：

```json
{"type":"draw","x":12,"y":34,"color":"#ff0000","updatedAt":1710000000000}
```

接続直後の`snapshot`：

```json
{"type":"snapshot","cells":[{"x":12,"y":34,"color":"#ff0000","updatedAt":1710000000000}]}
```

不正なメッセージと範囲外の座標は無視します。これは従来のGoサーバーから観測できる
挙動と同じです。

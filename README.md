# 社会復帰note 0.1.0

**公式ホームは使う。タグの行き先は自分で決める。**

note.comの公式タグリンク（`/tag/…`、`/hashtag/…`）を、`#タグ名` の新着順の記事検索へ切り替える非公式ブラウザ拡張です。note株式会社とは無関係です。無料・MIT License。

## できること

- タグリンクの通常クリック、新規タブ表示、リンクコピーを新着検索に切り替えます。
- 公式検索欄の右隣に、単色のパラボラアンテナSVGボタンを追加します。ツールチップ・読み上げ名は「タグを新着検索」です。`AI`・`#AI`・`＃AI` はいずれも `#AI` の新着記事検索になります。
- 拡張アクションでON/OFFを切り替え、同じブラウザ・プロファイル内のnoteタブへ反映します。初回はONです。
- OFFにすると、自分が変更したリンクを復元して追加ボタンを撤去します。サイトや他の拡張が変更したリンクは上書きしません。

通常のEnter・公式検索ボタン、URL直接入力には介入しません。独自ホーム・設定画面・ポップアップはありません。noteの検索結果がタグ設定済み記事だけに限定されることは保証しません。

## 対象ブラウザと操作

| ブラウザ | パッケージ | ON/OFF操作 |
|---|---|---|
| Chrome Desktop | chromium | ツールバーまたは拡張メニューの社会復帰noteアイコンをクリック |
| Edge Desktop | chromium | ツールバーまたは拡張メニューの社会復帰noteアイコンをクリック |
| Firefox Desktop 140以降 | firefox | ツールバーまたは拡張機能パネルの社会復帰noteアクションをクリック |
| Firefox Android 142以降 | firefox | 通常のWebページで拡張メニューを開き、社会復帰noteのアクション項目をタップ |

`ON` / `OFF` のバッジと「社会復帰note：ON／OFF」のタイトルで状態を示します。Androidではメニューを開き直して表示を確認します。メニューの入口・名称はFirefoxの版やレイアウトにより異なります。ホーム・新規タブ・内部ページでアクションが利用できない場合は、noteなどの通常のWebページを開いてください。

ブラウザの拡張管理画面で「拡張自体を無効化」する操作は、アプリ内のOFFと異なります。無効化・更新時は即時復元できないため、必要に応じてnoteを再読込してください。既に開いているnoteページも、拡張を初めて読み込んだ直後には再読込が必要です。

対応版の宣言は実機検証の完了を意味しません。[検証状況と手順](tests/manual-browser-checks.md)を参照してください（配布ZIPには開発用テスト資料を含めません）。

## 開発用読み込み

まずNode.js 22.22.2以降の22系、24.15以降の24系、または26以降と、PowerShell 7を用意し、リポジトリのルートで実行します。

```powershell
npm ci --ignore-scripts
npm test
npm run package
npm run lint:firefox
```

生成物：

- `dist/chromium/`：Chrome / Edgeの拡張管理画面から開発用に読み込むフォルダー
- `dist/firefox/`：Firefoxの `about:debugging` → このFirefox → 一時的なアドオンを読み込む、で `manifest.json` を指定するフォルダー
- `dist/ShakaiFukkiNote-0.1.0-chromium.zip`
- `dist/ShakaiFukkiNote-0.1.0-firefox.zip`
- `dist/verification.json`：生成元・作業状態・ツール版・ZIPのSHA-256

Firefoxの一時読み込みはブラウザ再起動で解除されます。Firefox ZIPは未署名で、一般利用者向けの署名済みXPIとは異なります。署名・ストア申請・GitHub Release・タグ作成をビルド処理は実行しません。Firefoxの拡張IDは設計上の候補を設定しており、初回署名前の一意性確認が残っています。

Androidで開発テストする場合は、ADB接続とFirefoxの開発用リモートデバッグを準備し、端末ID・Firefoxのパッケージ名を実機に合わせて指定します。

```powershell
npx --no-install web-ext run --source-dir dist/firefox --target firefox-android --android-device <端末ID> --firefox-apk <Firefoxのパッケージ名>
```

具体的なオプションは `npx --no-install web-ext run --help` と[MozillaのAndroid開発手順](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/)を確認してください。

## データと権限

必要なAPI権限は `storage` のみで、静的コンテンツスクリプトの対象を `https://note.com/*` に限定しています。サイトアクセスが拒否されているとページを書き換えられません。拡張のON/OFFではサイト権限の拒否を解除できません。

保存するのはON/OFFのみです。Cookie・認証情報・検索履歴・記事本文・クリック履歴を保存・収集せず、拡張専用サーバー・外部API・解析サービスへ送信しません。タグと入力語は、その場で検索URLを作るためだけに使用します。ユーザーがリンクや追加ボタンを操作すると、検索語を含む通常のnote.comへのアクセスが発生します。Firefoxのデータ収集宣言は `none` です。

ON/OFFは端末・ブラウザ間で同期しません。「ひきこもりnote」との自動協調は0.1.0の対象外です。

## 設計

[0.1.0技術設計書](spec/ShakaiFukkiNote_SPEC_v0.1.0.md)を参照してください。JavaScript・CSSは共通、Manifestと最小API互換層でブラウザ差分を扱います。アイコンの元図は `icons/source.svg`、配布用PNGは16・48・128pxです。

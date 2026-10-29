# 社会復帰note 技術設計書

- **プロジェクト名**：社会復帰note（ShakaiFukkiNote）
- **対象バージョン**：0.1.0（初期実装）
- **作成日**：2026-10-30
- **対象環境**：Chrome / Edge（デスクトップ）、Firefox Desktop、Firefox Android。全てManifest V3。
- **互換性方針**：JavaScript / CSSは共通化し、ブラウザ固有差分は生成するManifestと小さなAPI互換層・起動用スクリプトで吸収する。
- **位置付け**：実装着手前の設計。note.com の実DOMに関する未確認事項は実装時の調査項目とする。
- **公開形態**：非公式・無料・MIT License を想定。note株式会社とは無関係。

## 1. 目的と思想

note.com の公式ホームや既存の閲覧画面はそのまま利用しつつ、**タグリンクの遷移先を新着順の記事検索に置き換える**ブラウザ拡張を作成する。

2026年9月以降、noteの一部ハッシュタグ検索では、従来のハッシュタグページに代わり、AIが関連性を判断するキーワードページ（`/tag/`）が表示される。閲覧者がタグを手掛かりに記事を探したい場合に、公式画面の導線から直接、新着順の検索結果へ移動できるようにする。

**「公式ホームは使う。タグの行き先は自分で決める。」**

「ひきこもりnote」は公式ホームを独自の閲覧拠点に置き換える。一方、本拡張は**公式ホームを残したまま、リンクの行き先だけを改善する**。両者は独立製品として扱う。

## 2. スコープ

### 2.1 初期版で実装する

1. `note.com` 内の**公式タグリンク**を発見し、新着順の記事検索URLへ書き換える。
2. `href` 属性そのものを書き換えることで、通常クリック、右クリックからの新規タブ表示、リンクコピーに反映する。
3. 初期表示だけでなく、SPA遷移・遅延描画・追加読み込みで新たに現れたタグリンクにも対応する。
4. note公式の検索フォームはそのまま維持し、隣に独立した **「新着検索」** ボタンを追加する。
5. ブラウザの拡張アクション（デスクトップのアイコン、Firefox Androidの拡張メニュー項目）で機能全体のON/OFFを切り替える。設定はブラウザ内に保持する。
6. OFF時は、拡張自身が変更した既存リンクを安全に復元し、追加ボタンを撤去する。

### 2.2 初期版で実装しない

- 公式ホームの差し替え、リダイレクト、画面の再構成
- おすすめ・課金誘導・有料記事・メンバーシップ・ダッシュボード等の非表示
- ポップアップ、設定ページ、独自ホーム、お気に入りタグ管理
- 記事データの収集、独自検索API、記事一覧の生成、AI処理
- 記事投稿・スキ・フォロー・コメントなどの操作自動化
- ひきこもりnoteの有効判定・自動休眠などの共存処理（後続フェーズ）
- 他サイトへの対応、ブラウザ間の設定同期

### 2.3 「全部差し替える」の定義

**確認できた公式タグリンクの全出現箇所を対象**とする。対象画面は公式ホーム、記事内および記事末尾のタグ、タグ一覧、検索画面、関連タグ、おすすめ枠、サイドバー、モバイル表示など。ただし、*そのDOMがタグリンクであることをURLなどから確認できたもの*に限る。

全ての `#` 文字列、キーワードリンク、記事タイトル、クリエイターリンク、任意のJavaScriptクリック処理を無条件に書き換えるという意味ではない。note側のDOMやURL仕様が未知の箇所は、誤変換せず調査対象として残す。

## 3. URL変換仕様

### 3.1 変換対象

初期候補は以下のnote公式リンク。

```text
https://note.com/tag/<タグ名>
https://note.com/hashtag/<タグ名>
```

- `https://note.com` をオリジンとする `http(s)` リンクのうち、**実際の遷移先がHTTPSのnote.com**であるものだけを処理する。
- パスは `/tag/` または `/hashtag/` に続いてタグ名を示す1セグメントがあるものに限定する。末尾スラッシュは許容。
- それ以外（`/search`、記事・プロフィール・商品ページ、外部ドメイン、空のタグ名、壊れたURL等）は変更しない。
- 現行DOMで別形式の公式タグリンクが判明した場合は、テストを追加して対象を拡張する。推測だけで広い判定を導入しない。

### 3.2 変換先

```text
https://note.com/search?q=%23<URLエンコード済みタグ名>&context=note&mode=search&sort=new
```

例：

```text
変更前：https://note.com/tag/ComfyUI
変更後：https://note.com/search?q=%23ComfyUI&context=note&mode=search&sort=new
```

- URL構築には `URL`・`URLSearchParams`・`encodeURIComponent` 等の標準APIを使う。文字列の手作業連結や二重エンコードを避ける。
- タグ名はURLパスのエンコードを適切に解き、先頭の `#` / `＃` の重複を除いたうえで検索語に半角 `#` を1つ付ける。
- 変換後の `q` は `#タグ名`、検索対象は記事、並び順は新着とする。
- 変換元URLの付加パラメータは、用途が確認できない限り変換先へ継承しない。
- このURLは**noteが現在提供している検索画面への導線**であり、独自の検索エンジンではない。検索結果が厳密にタグ設定済み記事だけに限定されることや、将来も同じ結果になることは保証しない。

### 3.3 変換しない操作

- 検索欄の通常のEnter・公式虫眼鏡ボタン
- URL欄へ直接入力した `/tag/...` や `/hashtag/...` のアクセス
- `/tag` 画面自体のURLを強制転送すること
- 公式リンク以外の任意のクリックハンドラ

これによりnote本来のページへ直接アクセスする余地を残す。

## 4. タグリンク差し替え処理

### 4.1 発見・書き換え

`content_scripts`（隔離ワールド）から共有DOMを参照し、`a[href]` を調査する。jQuery等のライブラリは導入しない。

基本手順：

1. 初回の設定読込が完了しONと判定できたら、現在のDOMにあるリンクを走査する。
2. URLを構造的に解析し、タグリンクと確認できた場合に限り `href` を変換する。
3. `MutationObserver` で子要素の増減と `href` 属性変更を監視する。
4. 追加・変更された範囲をまとめて再走査する。全文書の無条件ポーリングはしない。
5. 自身の書き換えによるMutationでは再書き換えしない。

**右クリック対応**：`href` を実際に変更するため、ブラウザの標準「新しいタブで開く」「リンクのアドレスをコピーする」も変更先を使用する。Firefox Androidではリンク長押しの標準メニューで新規タブ表示・リンクコピーを確認する。独自コンテキストメニューは実装しない。

### 4.2 原状復帰と競合防止

変更したリンクごとに、元の `href` 属性値と変換後の値をメモリ内で記録する。保存領域へ大量のリンクを永続化しない。

- OFF時、**現在の `href` が自分の書き込んだ値と一致する場合に限り**元の値を復元する。
- すでにnote本体や別の拡張が別URLへ変更している場合は、古いURLで上書きしない。
- SPAが同じDOM要素を再利用して新しい公式URLを設定した場合は、旧記録を更新してから新たな変換可否を判断する。
- DOMから切り離されたリンクは管理対象から外す。
- 重複書き換えや、同じ要素に対する無限のDOM変更連鎖を防ぐ。
- 拡張の停止・更新・タブ閉鎖など、content script が実行できない局面では完全な即時復元を保証できない。**通常のON→OFF操作ではページ再読込なしで復元**することを受け入れ条件とする。

### 4.3 React / SPAへの対処

まず `href` の変更のみで動作を検証する。公式サイトのイベントハンドラが `href` を使わず内部ルートへ遷移し、通常クリックで変換先を開けないことが判明した場合のみ、*対象タグリンクに限定した*キャプチャ段階のクリック補助を検討する。

補助を入れる場合も、通常の左クリックだけを必要最小限で捕捉し、Ctrl / Meta / Shift / Altキー付き、ミドルクリック、ダウンロード、外部リンク、非対象リンクを妨げない。`href` 変換を基本方式とする。

## 5. 検索欄の「新着検索」ボタン

### 5.1 画面仕様

noteの公式検索欄の近くに、拡張専用の `button[type="button"]` を1つ追加する。

```text
[ キーワードやクリエイターで検索        ] [公式検索] [新着検索]
```

- 既存フォームと通常検索はそのまま動かす。
- 追加ボタンを押すと、その時点の入力内容から **`#入力語` の新着記事検索**を開く。
- 入力が `AI`、`#AI`、`＃AI` のいずれでも、検索語は `#AI` とする。
- 空欄、空白のみ、`#` のみの場合は遷移しない。必要に応じてボタンを無効表示する。
- 日本語入力中の変換確定Enterと、公式フォームの送信動作には介入しない。
- 公式フォームが複数ある場合（ヘッダー・検索結果ページ・狭幅レイアウト）は、**実DOMで確認できた対象ごと**に追加する。表示されないフォームへ無理に挿入しない。
- モバイル幅ではラベルの省略や小型ボタンを許容するが、`aria-label` で機能を識別できるようにする。
- note側でフォームが再描画されたら追加し直し、重複ボタンを作らない。

※ 検索欄に入力された一般キーワードを新着順で検索する機能ではなく、**タグ検索へ明示的に変換するボタン**として定義する。UI表記は実装時に「タグを新着検索」等へ調整可能。

### 5.2 既知のDOM手掛かり

「ひきこもりnote」側の2026-10-25のDOM確認記録では、ヘッダーに次の構造が見つかっている。

```text
header[data-header-state="navbar"]
  form[role="search"][action="/search"]
    input[type="search"][name="q"]
```

検索結果本文側には別形式の入力欄も存在した。したがって、単一の汎用セレクタで全検索欄を決め打ちせず、実画面を確認して対象条件を定める。既存の検索欄を移動・複製せず、ボタンだけを独立挿入する。

## 6. ON/OFF操作と保存

### 6.1 操作

- 拡張アクションを実行すると、**同じブラウザの同じプロファイル内で共通のON/OFF状態**を反転する。タブごとの独立設定やブラウザ間・端末間同期は設けない。
- ポップアップ・設定画面は作らない。Manifestの `action.default_popup` は設定しない。
- API互換層経由の `action.onClicked` で状態変更し、`storage.local` に `enabled: boolean` を保存する（7.3参照）。ブラウザの拡張管理画面で拡張自体を無効化する操作とは区別する。
- 初回インストールの既定値は **ON** とする。
- 状態をバッジ（`ON` / `OFF`）と `action.setTitle` の短いタイトル（例：`社会復帰note：OFF`）で示す。Androidのタッチ操作ではツールチップやバッジだけに頼らず、拡張メニュー項目のタイトルで状態を識別できることを確認する。
- 通常のWebページではnote以外のタブでも同じトグルを実行できる。ホーム・新規タブ・ブラウザ内部ページではブラウザ側がアクションを表示・許可しない場合があるため、通常のWebページを開いて操作する案内をREADMEに記載する。
- 複数回のクリックが連続しても状態更新を直列化し、取りこぼしを防ぐ。

| ブラウザ | ON/OFFの操作導線 | 実装時の確認条件 |
|---|---|---|
| Chrome Desktop | ツールバーの拡張アイコン、または拡張メニュー内のアクション | ピン留め有無の両方でクリックが1回だけ反転を起こす |
| Edge Desktop | ツールバーの拡張アイコン、または拡張メニュー内のアクション | ツールバー表示有無の両方で同じ動作を確認 |
| Firefox Desktop | ツールバーの拡張アイコン、または拡張機能パネル内のアクション | パネル内操作とピン留めしたアイコンの両方で確認 |
| Firefox Android | 通常のWebページで拡張メニューを開き、社会復帰noteのアクション項目をタップ | `action.onClicked` が発火し、メニューを開き直すと状態表示が更新される |

これは各ブラウザの標準UIを使う設計であり、実機確認済みの記録ではない。Androidのメニュー入口・名称はバージョンやレイアウトにより異なるため、対象実機での具体的な経路を検証記録とREADMEに残す。拡張管理画面の有効スイッチを代替トグルにはしない。

### 6.2 反映

- 開いている各noteタブのコンテンツスクリプトがAPI互換層経由で `storage.onChanged` を購読し、変更時に適用または原状復帰する。タブ列挙・メッセージ一斉送信を必要としない構成にする。
- トグル直後に手動リロードを要求しない。
- ページ読込時は保存状態を確定してからDOM変更する。設定読込の前後で状態が変わる競合にも対処する。
- ON/OFFの状態はブラウザ再起動後も維持する。
- ストレージ更新に失敗した場合は、成功したかのようにバッジや画面表示を変えない。安全側に止め、再操作可能にする。
- Androidで休止・破棄されたタブは、復帰時の `pageshow` / 可視化時にも保存状態を再確認して反映する。設定変更購読はOFF中も維持し、DOM監視だけを停止・無害化する。
- 初期化・更新時に既存のboolean値を上書きしない。保存値がない初回だけONを採用し、起動時の初期化とトグルは同じ直列化経路で処理する。

## 7. 実装構成と権限

### 7.1 最小ファイル構成（案）

```text
ShakaiFukkiNote/
  manifests/
    common.json         # 権限、action、content_scripts等の共通定義
    chromium.json       # Chrome / Edge用のbackground差分
    firefox.json        # Firefox用background・ID・互換性宣言
  LICENSE
  README.md
  src/
    api.js              # WebExtensions APIのPromise・エラー処理の互換層
    background-chromium.js # importScriptsで共通コードを読み込むだけの入口
    background.js       # 共通のアクション処理、ON/OFF保存、状態表示
    tag-url.js          # タグ判定、URL生成（純粋関数）
    content.js          # リンク差し替え、DOM監視、復元、検索ボタン
    content.css         # 追加ボタンの最小限のスタイル
  icons/
    icon16.png
    icon48.png
    icon128.png
  scripts/
    package.ps1         # 2種類のManifest生成・検査・ZIP化（公開処理なし）
  tests/
    fixtures/           # SPA再描画、href再設定、検索欄の共通DOM試料
    manual-browser-checks.md # 4環境の同一手順と結果・未実施の記録
    ...                 # URL変換・状態遷移・DOM・Manifest生成テスト
  dist/                 # 生成物。ソース管理対象外
    chromium/manifest.json
    firefox/manifest.json
    ShakaiFukkiNote-0.1.0-chromium.zip
    ShakaiFukkiNote-0.1.0-firefox.zip
```

実装が少量ならファイルは統合してよい。Manifest生成・ZIP化に必要な小さなスクリプトにとどめ、大規模なバンドル環境は導入しない。配布物中の `src/`・CSS・アイコンは両系統で同一内容とする。

### 7.2 Manifest V3とFirefox向け宣言

- `manifest_version: 3`
- `name: 社会復帰note`
- `version: 0.1.0`
- `permissions: ["storage"]`
- `content_scripts.matches: ["https://note.com/*"]`
- `action`: アイコンとタイトルのみ、ポップアップなし
- `content_scripts.js`: `src/api.js`、`src/tag-url.js`、`src/content.js` の順に静的注入。CSSも共通。

共通定義と対象別差分から、ZIP直下の `manifest.json` を生成する。単一Manifestへ両方のbackground形式を混在させず、次の差分だけを持つ。

**Chrome / Edge用差分**：

```json
{
  "background": {
    "service_worker": "src/background-chromium.js"
  }
}
```

**Firefox Desktop / Android共通差分**：

```json
{
  "background": {
    "scripts": ["src/api.js", "src/background.js"],
    "persistent": false
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "shakaifukkinote@ruminar",
      "strict_min_version": "140.0",
      "data_collection_permissions": {
        "required": ["none"]
      }
    },
    "gecko_android": {
      "strict_min_version": "142.0"
    }
  }
}
```

- FirefoxはMV3の非永続イベントページを使用する。Chrome / EdgeはService Workerを使用し、入口で `importScripts("api.js", "background.js")` を同期実行する。共通処理は `window`・DOM・常駐タイマーを前提としない。[backgroundの公式仕様](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- 拡張IDは上記を本プロジェクトの固定候補とし、初回署名前にAMO上の一意性を確認して確定する。メールの受信先を意味しない。確定後は更新やDesktop / Androidで変更しない。MV3の署名には明示したIDが必要。[拡張IDの公式説明](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/)
- `gecko_android` を明示しAndroid対応を申告する。上記の最低バージョンは内蔵データ収集宣言に対応する下限として採用し、実装時に最低版と現行安定版で検証する。API等で引き上げが必要なら両環境を独立に見直す。申告だけで実機互換性を証明したことにはしない。[宣言形式](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)、[内蔵同意機能と対応版](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)

コンテンツスクリプトの静的注入で完結させ、`scripting`・`tabs`・`activeTab`・広範なホスト権限・`webRequest`・`declarativeNetRequest` は初期版では要求しない。必要な権限が発生した場合は、用途を確認して追加する。

### 7.3 共通API層とバックグラウンドの寿命

- `api.js` だけでブラウザAPIの名前空間を選択する。必要なAPIがPromise形式で利用できる `browser` を優先し、`chrome` を使う経路はコールバックと `runtime.lastError` をPromiseの成功・失敗へ変換する。同じ操作をPromiseとコールバックの両方で二重実行しない。
- 公開範囲は使用する `storage.local.get/set`、`storage.onChanged`、`action.onClicked`、`action.setBadgeText/setTitle`、`runtime.onInstalled/onStartup` 等に限定する。機能側へブラウザ名やUA判定を散在させない。
- イベントリスナーは共通backgroundのトップレベルで同期登録する。設定読込完了後にリスナーを登録する構成にはしない。
- 永続状態の正本は `storage.local.enabled` とする。Service Worker / イベントページが停止・再生成されても、次のイベントで保存値を読み直す。メモリ変数は処理中の直列化にだけ使う。
- バックグラウンド再生成・ブラウザ起動時に保存状態からタイトルとバッジを再構成する。初期化とクリックの競合、連打、保存失敗後のキュー継続を両API経路で検証する。状態保存に成功して表示更新だけが失敗した場合、保存状態を巻き戻さず、次の起動・操作で表示を修復する。

### 7.4 プライバシー

- 記録する設定は基本的にON/OFFだけ。Cookie、認証情報、検索履歴、記事本文、クリック履歴は保存しない。
- 拡張専用サーバーや外部APIへの送信を行わない。
- URLを開いた際の通常のnote.comへのアクセスは発生する。
- 独自の外部スクリプト・トラッキングコードを導入しない。
- Firefoxのデータ収集宣言は `required: ["none"]` とする。ページ内のタグや入力語はその場のリンク生成だけに使い、拡張が収集・外部送信する処理を持たない。通常のユーザー操作によるnote検索への遷移と区別してREADMEに説明する。後で収集・送信を追加する場合は宣言と設計を先に見直す。

### 7.5 配布ZIPの生成と公開境界

- `scripts/package.ps1` でChrome / Edge共通の `ShakaiFukkiNote-0.1.0-chromium.zip` とFirefox Desktop / Android共通の `ShakaiFukkiNote-0.1.0-firefox.zip` を生成できる構成にする。
- 共通定義へ対象別差分を適用し、バージョン・権限・参照ファイル・Firefox宣言の欠落を検査してから圧縮する。ZIP直下に `manifest.json` を配置し、実行に必要な `src/`・アイコン・LICENSE・READMEだけを許可リストで含める。テスト・仕様・開発依存・秘密情報・別ブラウザのManifestを混入させない。
- 展開後にも参照パスの存在、両配布物の共通JS / CSSの一致、Chrome用に `background.scripts` がないこと、Firefox用に `background.service_worker` がないことを検査する。生成元コミットまたは作業状態、使用ツール版とSHA-256をローカルの検証記録へ残す。
- Firefox ZIPはAMO提出・署名の入力となる未署名パッケージであり、一般利用者が通常インストールする署名済みXPIとは区別する。一時読み込み・開発テストは可能だが、未署名ZIPの作成を署名完了・公開完了と扱わない。
- この作業の対象は設計と、実装時のローカル検証・ZIP生成まで。**ストア申請、AMOへの署名要求（`web-ext sign` を含む）、GitHub Release、Gitタグ作成は実行しない。** 将来の公開には別途指示を必要とする。

## 8. 異常系・安全境界

- **誤認を避ける**：URLパターンやDOMが確認できない場合は処理しない。
- **サイト変更に耐える**：対象が見つからない場合、公式の表示・操作をそのまま維持する。
- **過剰監視を避ける**：Mutationをまとめて処理し、変更された部分を優先。無条件の全DOM走査ループを回さない。
- **OFFを信用できる**：通常操作では既存のリンクと追加UIを復元し、監視を停止・無害化する。
- **ユーザーの意思を尊重する**：直接URL入力や通常検索を横取りしない。
- **既存の操作を壊さない**：本文、投稿、フォロー、購入等のDOMを削除・非表示にしない。

## 9. 実装順序

### Phase A：独立拡張の完成（0.1.0）

1. GitHubリポジトリ `ShakaiFukkiNote` を用意し、MITライセンスと最小READMEを置く。
2. noteの実DOMからタグリンクの出現形式・画面別パターンを収集し、変換対象を確定する。
3. URL判定・変換の純粋関数を作成し、単体テストを整備する。
4. `href` 書き換え、MutationObserver、重複防止、OFF時の原状復帰を実装する。
5. 公式検索欄の横に新着検索ボタンを追加する。
6. 共通API層、対象別Manifest、拡張アクションのON/OFFと全タブ反映を実装する。
7. Chrome / Edge / Firefox Desktop / Firefox Androidで10章の同一項目を確認する。
8. 2系統の配布ZIPを生成・展開検査し、実施済み・未実施の検証記録を整える。公開操作は7.5の境界に従う。

### Phase B：ひきこもりnoteとの共存（別バージョン）

1. 両方を有効にして、DOM改造の衝突箇所を観察する。
2. `data-hikikomori-note-owned` など既存の目印を調査する。
3. **ひきこもりnoteが現在有効に動作しているか**を安定的に判断する必要がある場合に限り、協調用の目印または別方式を検討する。
4. 判定が成立した画面では社会復帰noteが処理を譲り、OFF・離脱時の復帰を検証する。

初期版で不確実な自動判定を導入しない。両方の同時利用は、共存検証を終えるまで正式な対応対象としない。

## 10. テスト計画・受け入れ条件

### 10.1 共通の機能確認

以下はChrome、Edge、Firefox Desktop、Firefox Androidの**4環境それぞれ**で確認する。Desktopの右クリックはAndroidでは長押しに読み替える。狭幅のDesktop検証をAndroid実機検証の代わりにはしない。

| 分野 | 確認内容 | 必須 |
|---|---|---|
| URL変換 | `/tag/AI`、`/hashtag/AI` を新着検索へ変換 | ○ |
| URL変換 | 日本語・記号・URLエンコード済みタグを二重エンコードしない | ○ |
| 除外 | 記事・プロフィール・外部サイト・既存`/search`を変更しない | ○ |
| 初期表示 | ホーム・記事等の確認済みタグリンクが変わる | ○ |
| 遅延描画 | SPA遷移・追加読み込み後のタグリンクも変わる | ○ |
| 通常クリック | 変更先の新着検索へ遷移する | ○ |
| 右クリック・長押し | 標準の「新しいタブで開く」と「リンクをコピー」で変更先を使い、OFF後は元のURLを使う | ○ |
| 通常検索 | Enter・公式虫眼鏡・サジェストの動作を壊さない | ○ |
| 追加ボタン | 入力語を`#`付きで新着検索し、空欄では動作しない | ○ |
| UI | 検索欄再描画時にボタンが重複しない | ○ |
| ON/OFF | OFFで変更済みリンクを復元し、ボタンを撤去 | ○ |
| 多重タブ | どのタブで切り替えても開いているnoteタブに反映 | ○ |
| 永続化 | ON・OFFそれぞれでブラウザ再起動後に状態が保持され、再開したnoteページとアクション表示に反映される | ○ |
| 競合 | サイト側が再設定したhrefをOFFで誤上書きしない | ○ |
| 安全 | 通常の本文・購入・コメントなどに副作用がない | ○ |
| 共存 | ひきこもりnoteとの自動協調 | **0.1.0対象外** |

### 10.2 ブラウザ別の検証構成

- **自動テスト**：共通URL変換、書き換え・復元、SPAでの要素再利用・href再設定、検索欄再描画のDOM試料を使用する。`browser` のPromise経路と `chrome` のコールバック経路の両方で、初期設定読込と変更通知の競合・連打・保存失敗・バックグラウンド再生成を検証する。Manifest生成とZIP内容も検査する。モックによる成功を実ブラウザでの成功と混同しない。
- **Chrome / Edge**：生成した `dist/chromium/` を各ブラウザの開発者向け拡張読み込みで個別にテストする。Service Workerを自然に休止させた後、アクション実行で再起動し保存値から反転できることを確認する。常時DevToolsを開いた状態だけで済ませない。
- **Firefox Desktop**：`dist/firefox/` を `web-ext lint` で検査し、`web-ext run` または `about:debugging` の一時読み込みで動作確認する。非永続backgroundの休止・再生成も検証する。一時拡張は再起動で外れるため、再読み込みを通常インストールの再起動試験と扱わない。署名を伴わない永続的な開発用読み込みが可能な専用プロファイルでの試験結果は、その条件を明記する。通常の署名済み配布での再起動試験は将来の署名後に行い、今回は未実施として残す。
- **Firefox Android**：ADBで接続した実機を使い、`web-ext run --target=firefox-android` で生成済みFirefoxディレクトリを読み込む。端末・Firefoxの指定方法は使用する `web-ext` 版のヘルプに従い、Desktopの `about:debugging` からログとDOMを確認する。実機がない場合はエミュレーターによる結果を区別し、実機欄を未実施にする。メニューのアクション実行、タイトル表示、長押しメニュー、アプリのバックグラウンド移行・復帰、タブの休止後の状態再読込を確認する。一時拡張の寿命による再起動試験の制約はDesktopと同じく記録する。[Android開発・検証手順](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/)
- **サイトアクセス**：各ブラウザでnote.comへの拡張アクセスが許可された状態を確認する。ユーザーがアクセスを拒否した場合はDOMが変化しないことを確認し、トグル操作だけではサイト権限の拒否を解除できない旨をREADMEへ記す。
- **記録**：`tests/manual-browser-checks.md` にブラウザ版、OS / Android端末、読込方法、対象ビルド、画面・URL、手順、期待値、結果（合格・不合格・未実施）を環境別に残す。Firefoxは宣言した最低版と現行安定版を分け、未検証の対応版を確認済みと表記しない。

**0.1.0の完成条件**：4環境で、確認済みの公式タグリンクが主要画面で書き換わり、通常クリック・右クリック／長押し・SPA遷移・ON/OFF原状復帰が成立し、公式検索や記事閲覧を妨げないこと。APIとbackgroundの差分、Androidの操作導線、2系統のZIP内容を検証する。確認できなかった画面・DOM形式・環境・通常インストールでの再起動は検証記録に明記し、未実施項目を合格扱いせず、公開前の残条件として残す。今回の設計書更新自体は実装完了・4環境検証完了を意味しない。

## 11. 未確認事項（実装前・実装中に検証）

1. 公式ホーム／記事／検索画面／モバイル表示に現れるタグリンクの**全URL形式**。`/tag/`・`/hashtag/` 以外の形式があるか。
2. 新着検索URLに遷移した場合の実際の検索結果と、厳密なハッシュタグ一覧との相違。
3. 公式検索フォームのDOM構造と狭幅レイアウト。追加ボタンの適切な挿入位置。
4. note本体のSPAクリック処理が、変更済み `href` を尊重するか。
5. リンク復元時のReact側再描画やイベント競合の有無。
6. 4環境の実ブラウザで複数タブへ設定変更が反映され、Androidのタブ復帰時にも最新状態になること。
7. Firefox Androidの対象版で拡張アクションを実行する具体的なメニュー経路と、状態タイトル・バッジの実際の表示。
8. Service Worker / イベントページ休止後のトグル、起動時表示復元、連打時の保存競合。
9. 固定候補のFirefox拡張IDの一意性、最低対応版のAPI互換性、Firefox ZIPのローカルlint結果。IDのAMO確認・署名済みXPIの通常インストール確認は、将来の公開指示があるまで実行しない。

これらは設計段階で確定した事実として扱わず、実DOMとブラウザで確認する。

## 12. 参考資料

- note公式：「検索したときに表示されるページについて」  
  https://www.help-note.com/hc/ja/articles/62344323192857
- note公式：「キーワード、ハッシュタグ、クリエイター、クリエイターの過去の記事を検索する」  
  https://www.help-note.com/hc/ja/articles/360010417153
- Chrome Extensions：`chrome.action`  
  https://developer.chrome.com/docs/extensions/reference/api/action
- Chrome Extensions：`chrome.storage`  
  https://developer.chrome.com/docs/extensions/reference/api/storage
- Chrome Extensions：Content scripts  
  https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- MDN：[Manifestのbackground（Service Worker / イベントページの差分）](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- MDN：[`browser_specific_settings`（ID・データ収集宣言・Android互換性）](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)
- MDN：[`action` API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/action)、[ツールバーボタン](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Toolbar_button)
- Firefox Extension Workshop：[拡張ID](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/)、[内蔵データ収集同意](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
- Firefox Extension Workshop：[Androidでの開発・実機デバッグ](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/)
- 既存実装・DOM確認の参照：`ruminar/HikikomoriNote` の `src/common.js`、`src/note-ui.js`、`src/content.js`、`docs/note-dom.md`。**参照のみとし、ひきこもりnoteのコードや設定形式への依存は作らない。**

Firefox関連の公式資料は2026-10-30に確認。API対応表と実機UIは実装時にも再確認し、資料上の対応と実測結果を区別する。

---

**設計の原則：公式画面を壊さず、行き先だけを変える。複雑になったら、まず機能を増やさずに済む方法を探す。**

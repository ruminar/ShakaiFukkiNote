# 社会復帰note 0.1.1 差分設計書

- 対象バージョン：0.1.1
- 作成日：2026-11-05
- 基本仕様：[0.1.0技術設計書](ShakaiFukkiNote_SPEC_v0.1.0.md)を継承する。

## 変更内容

FirefoxでManifest V3の `background.persistent` が未対応と警告されるため、このプロパティを省略する。`background.scripts` は維持し、非永続のイベントページとして動作させる。

生成スクリプトではFirefox用Manifestに `persistent` が混入した場合に停止し、Manifestのテストでもプロパティがないことを確認する。

`package.json`、`package-lock.json` のプロジェクト情報、共通Manifestのバージョンを0.1.1にそろえる。依存パッケージのバージョンは変更しない。

## 配布物

- `ShakaiFukkiNote-0.1.1-chromium.zip`：Chrome / Edge用
- `ShakaiFukkiNote-0.1.1-firefox.zip`：Firefox Desktop / Android用の未署名パッケージ
- `ShakaiFukkiNote-0.1.1-source.zip`：Firefox審査用のソースと再生成手順

ソースZIPと配布ZIPは同じ作業状態から生成し、Manifestを含めた配布物の内容一致を確認する。ストアへのアップロード・署名要求・GitHub Releaseやタグの作成は、このバージョン生成処理では行わない。

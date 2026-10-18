# Marp プラグイン 実機テスト用 Vault

この Vault には Marp プラグインがインストール済みです。初回に開いたとき「信頼して有効にする」を選ぶとプラグインが有効になります。

各ノートを開き、コマンドパレットから次のコマンドを実行して確認します。

- **Open slide preview** — ライブプレビュー
- **Start presentation** — 全画面プレゼン（矢印キー、Space、画面左右のタップ）
- **Export as HTML** — ノートと同じ場所に `.html` を保存
- **Print slides** — 印刷ダイアログ（デスクトップのみ）

設定の **Theme folder** には `themes` が設定済みです。

## チェックリスト

- [ ] [[01 Basics]]: ディレクティブ、ページ番号、ヘッダー・フッター、背景画像、絵文字
- [ ] [[02 Math MathJax]] / [[03 Math KaTeX]]: 数式が描画される
- [ ] [[04 Code and diagrams]]: シンタックスハイライト、Mermaid、未対応図のフォールバック
- [ ] [[05 Images]]: Markdown 画像、Obsidian 埋め込み、サイズ指定、背景、SVG
- [ ] [[sub/Relative image]]: サブフォルダからの相対パスと Vault ルート基準のパス
- [ ] [[06 HTML]]: 設定 **HTML in Markdown** を切り替えて表示が変わる。スクリプトは常に動かない
- [ ] [[07 Custom theme]]: `themes/sample.css` が適用される。CSS を編集するとプレビューに反映される
- [ ] [[08 External resources]]: **Block external resources** のオン・オフで外部画像の表示が切り替わる
- [ ] [[09 Links]]: Vault 内リンク・外部リンク・ページ内リンク
- [ ] [[10 Long deck]]: ページ送り、現在ページの維持、編集時のライブ更新
- [ ] [[Not Marp]]: プレビューに「Marp ではない」旨が表示される
- [ ] プレビューを開いたままノートを切り替えると追従する
- [ ] 未保存の編集がプレビューに反映される
- [ ] 画面の回転・分割表示（タブレット）でスライドが縮尺に合わせて表示される
- [ ] Obsidian のテーマ（ライト / ダーク）を切り替えても Obsidian の UI にスライドの CSS が漏れない

---
marp: true
theme: default
paginate: true
header: 'Marp 実機テスト'
footer: 'obsidian-marp-plugin'
---

<!-- _class: lead -->
<!-- _paginate: false -->

# 基本機能

ディレクティブとレイアウトの確認 :rocket:

---

## 箇条書きと強調

- **太字**、_斜体_、~~取り消し線~~、`inline code`
- 入れ子
    - 二段目
        - 三段目

1. 番号付き
2. リスト

> 引用ブロック

---

## 表

| 機能       | デスクトップ | モバイル |
| ---------- | :----------: | :------: |
| プレビュー |      ✅      |    ✅    |
| プレゼン   |      ✅      |    ✅    |
| 印刷       |      ✅      |    —     |

---

<!-- _class: invert -->

## invert クラス

このページだけ配色が反転すること。

---

<!-- backgroundColor: #fef9c3 -->
<!-- color: #713f12 -->

## ローカルディレクティブ

ここから背景色と文字色が変わること（以降のページにも引き継がれる）。

---

# <!-- fit --> fit ヘッダーは幅いっぱいに拡大される

---

![bg](images/background.svg)

<!-- _color: white -->

## 背景画像

Vault 内の SVG が全面背景として表示されること。

---

![bg left:40%](images/shapes.svg)

## 分割背景

左 40% に画像、右に本文。

---

## 絵文字

:smile: :tada: :+1: 🍣 🇯🇵

Unicode の絵文字として表示される（Twemoji 画像は読み込まない）。

---

<!-- _paginate: false -->
<!-- _header: '' -->
<!-- _footer: '' -->

## ページ番号・ヘッダー・フッターなし

このページだけ消えていること。

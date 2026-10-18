---
marp: true
paginate: true
---

# HTML の扱い

設定 **HTML in Markdown** を Off / Safe elements only / All elements に切り替えて確認します。

---

## 安全な要素

<b>太字</b>、<i>斜体</i>、<br>改行、<img src="images/red.png" width="60" alt="html image">

- Off: タグがそのまま文字として表示される
- Safe elements only / All elements: 要素として描画される

---

## 許可リスト外の要素

<div style="padding: 16px; background: #dbeafe; border-radius: 8px">div + style 属性</div>

<span style="color: red">赤い span</span>

- Safe elements only: 文字として表示される
- All elements: 装飾付きで描画される

---

## スクリプトは常に動かない

<script>document.body.style.background = 'red'</script>

<img src="images/missing.png" onerror="document.body.style.background = 'red'" alt="onerror">

<a href="javascript:alert(1)">javascript: リンク</a>

<iframe src="https://example.com" width="200" height="100"></iframe>

どの設定でも背景が赤くならず、アラートも出ず、iframe も表示されないこと。

---
marp: true
paginate: true
---

# 画像

Markdown 画像（ノートからの相対パス）とサイズ指定

![w:160](images/red.png) ![h:120](images/shapes.svg)

---

## Obsidian 埋め込み

`![[red.png]]`、`![[red.png|80]]`、`![[shapes.svg|200x100]]`

![[red.png]] ![[red.png|80]] ![[shapes.svg|200x100]]

---

![[background.svg|bg]]

<!-- _color: white -->

## 埋め込みを背景に

`![[background.svg|bg]]`

---

![[shapes.svg|bg right]]

## 埋め込みを右側の分割背景に

`![[shapes.svg|bg right]]`

---

## 複数の背景

![bg](images/red.png)
![bg](images/shapes.svg)

---

## 存在しない画像

![](images/missing.png)

表示されないだけで、プレビュー全体は壊れないこと。

---

## コード内は変換されない

```md
![[red.png|80]]
```

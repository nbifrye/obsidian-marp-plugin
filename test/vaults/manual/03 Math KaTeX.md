---
marp: true
math: katex
paginate: true
---

# 数式（KaTeX）

`math: katex` ディレクティブが設定より優先されること。

インライン: $e^{i\pi} + 1 = 0$、$\sum_{k=1}^{n} k = \frac{n(n+1)}{2}$

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

---

## 行列

$$
\begin{bmatrix} a & b \\ c & d \end{bmatrix}
\begin{bmatrix} x \\ y \end{bmatrix}
=
\begin{bmatrix} ax + by \\ cx + dy \end{bmatrix}
$$

KaTeX のフォント（同梱）で表示され、ネットワーク接続なしでも崩れないこと。

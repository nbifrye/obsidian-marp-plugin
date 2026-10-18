# Marp plugin for Obsidian

Preview, present and export [Marp](https://marp.app/) slide decks in [Obsidian](https://obsidian.md), powered by **Marp Core v5**.

All of Marp Core's plugins are built in and always enabled:

- **Math** with MathJax (default) or KaTeX. A note's `math` directive overrides the setting.
- **Syntax highlighting** with Shiki.
- **Mermaid diagrams** (rendered by beautiful-mermaid; unsupported diagrams fall back to a code block).

Works on desktop (Windows, macOS, Linux) and mobile. It uses no Node.js or Electron APIs.

## Install

The plugin is not in the community catalog yet. To try a beta release, use [BRAT](https://tfthacker.com/BRAT):

1. Install and enable **BRAT** from **Settings → Community plugins**.
2. Run the command **BRAT: Add a beta plugin for testing**.
3. Enter `nbifrye/obsidian-marp-plugin` and select **Add plugin**.

BRAT installs the newest release or pre-release and updates it when a newer one is published.

## Usage

Add `marp: true` to a note's properties:

```markdown
---
marp: true
theme: default
paginate: true
---

# First slide

$e^{i\pi} + 1 = 0$

---

## Second slide

![[diagram.png|400]]
```

| Command                | What it does                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Open slide preview** | Opens a live preview that follows the active note, including unsaved changes.                                |
| **Start presentation** | Shows the slides full window. Use the arrow keys, Page Up/Down, Space, Home/End, or tap the left/right half. |
| **Export as HTML**     | Saves `<note>.html` next to the note: a single file with images, themes and fonts embedded.                  |
| **Print slides**       | Opens the system print dialog, e.g. to save a PDF (desktop only).                                            |

Images can be written as Markdown images (relative to the note, or to the vault root with a leading `/`), as Obsidian embeds (`![[image.png]]`, `![[image.png|300]]`, `![[image.png|300x200]]`, `![[image.png|bg left]]`), or as Marp backgrounds (`![bg](image.png)`).

PDF and PowerPoint export are not built in: Marp CLI needs Node.js and a browser, which are not available on mobile. Use **Print slides** on desktop to get a PDF.

## Settings

| Setting                      | Default            | Description                                                                                          |
| ---------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Math engine**              | MathJax            | Used when a note does not set the `math` directive.                                                  |
| **HTML in Markdown**         | Safe elements only | Off, safe elements only (Marp Core's allowlist), or all elements. JavaScript never runs in any mode. |
| **Theme folder**             | (none)             | Vault folder whose CSS files are registered as custom themes (`/* @theme name */`).                  |
| **Block external resources** | Off                | Blocks images, fonts and styles from the internet.                                                   |

Custom themes may refer to images and fonts in the vault with relative `url()`s. `@import` of other CSS files in the vault is not supported; `@import` of built-in themes (`@import "default";`) and of web URLs is.

## Privacy and network use

The plugin itself makes no network requests and sends no data anywhere. KaTeX fonts are bundled, emoji are shown as Unicode characters (not Twemoji images from a CDN), and MathJax renders to SVG.

Slides do load the **external resources a note or theme refers to**, such as `https://` images or web fonts imported by a theme (the built-in `gaia` and `uncover` themes import Google Fonts). Loading them sends your IP address to those servers. Turn on **Block external resources** to prevent this. Exported HTML files keep such URLs as they are, so they need a network connection to show them.

Slides are shown in a sandboxed frame with a strict Content Security Policy: scripts, forms, frames and plugins in notes never run, and links open outside the slides.

## Platform support

| Platform              | Status                                                     |
| --------------------- | ---------------------------------------------------------- |
| Windows, macOS, Linux | Tested automatically (latest Obsidian and 1.0.3).          |
| Android               | Tested automatically in an emulator.                       |
| iOS / iPadOS          | Intended to work, but not tested on a device or in WebKit. |

The plugin bundles Marp Core with all of its optional dependencies, so `main.js` is about 13 MB. The renderer is loaded the first time slides are shown, not at startup.

## Development

See [AGENTS.md](AGENTS.md) for the build and test setup.

```bash
npm install
npm run dev        # watch build
npm test           # unit tests
npm run test:e2e   # end-to-end tests in a sandboxed Obsidian
```

To try the plugin by hand, for example on a phone or tablet, run `npm run sample-vault`. It creates `sample-vault/`: a vault with notes covering each feature (see `00 Start here.md` for a checklist) and the built plugin installed and enabled. Copy the folder to the device, or create it directly in a synced folder with `npm run sample-vault -- <path>`, e.g. `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Marp sample` for Obsidian on iOS through iCloud. Running it again updates only the plugin files; `--reset` recreates the vault.

The sample vault also has [Hot Reload](https://github.com/pjeby/hot-reload) installed and enabled (downloaded once from its GitHub release, pinned and checked by hash). While `npm run dev` is running, each build is copied into `sample-vault/`, and Obsidian reloads the plugin without a restart. Pass another vault to copy there instead, e.g. `npm run dev -- <path>`; create it with `npm run sample-vault -- <path>` to have Hot Reload installed too.

### Releasing

Releases are built by `.github/workflows/release.yml` when a tag is pushed. Tags have no leading `v`.

- **Beta** (for BRAT): tag any commit with a pre-release version, e.g. `git tag 0.2.0-beta.1 && git push origin 0.2.0-beta.1`. A pre-release is published right away; the `manifest.json` attached to it has the tag's version, so the committed one stays unchanged.
- **Stable**: run `npm version <x.y.z>` (updates `manifest.json` and `versions.json`), push the commit and tag, then publish the draft release the workflow creates.

## License

The plugin is licensed under 0-BSD. It bundles Marp Core (MIT), Shiki (MIT), beautiful-mermaid (MIT), KaTeX and its fonts (MIT), and MathJax (Apache-2.0).

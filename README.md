# Electron Starter — React + Vite + Tailwind 4 + shadcn/ui

![Logo](./public/assets/github.png)

A modern, production-ready Electron starter template combining React 19, Vite 8,
Tailwind CSS 4, and shadcn/ui — with a frameless custom titlebar, a hardened main
process, and a **customizable Windows installer** you can ship in one command.

## ✨ Features

- **⚡ Vite 8** — instant HMR and lightning builds (Rolldown-powered)
- **⚛️ React 19** — latest React with the modern runtime
- **🎨 Tailwind CSS 4** — CSS-first config via `@tailwindcss/vite`, no `tailwind.config.js`
- **🧩 shadcn/ui** — accessible, themeable component primitives
- **🖥️ Electron 43** — frameless window, custom titlebar, single-instance lock
- **🔒 Hardened** — context isolation, sandboxed renderer, safe external-link handling
- **📦 One-command releases** — signed NSIS installer **and** portable `.exe`
- **🎛️ Custom installer UI** — branded welcome page, license, install-dir choice, and an
  "Additional Tasks" page (desktop shortcut + launch-at-startup)
- **🖼️ Auto-generated icons** — multi-resolution `.ico` and installer artwork from one PNG
- **✅ Vitest** — unit tests wired up out of the box

## 🚀 Quick Start

```bash
npm install
npm run dev
```

> First install downloads the Electron binary. If your environment blocks npm
> install scripts, run `node node_modules/electron/install.js` once.

## 🛠️ Scripts

| Command                    | Purpose                                             |
| -------------------------- | --------------------------------------------------- |
| `npm run dev`              | Vite dev server + Electron with HMR                 |
| `npm run build`            | Build the renderer to `dist/`                       |
| `npm start`                | Run Electron against the current build              |
| `npm test`                 | Run the Vitest suite                                |
| `npm run icons`            | Generate `build/icon.ico` + installer BMP artwork   |
| `npm run pack`             | Build an unpacked app in `release/win-unpacked`     |
| `npm run release`          | **Installer + portable** `.exe` (runs icons + build)|
| `npm run release:installer`| NSIS installer only                                 |
| `npm run release:portable` | Portable `.exe` only                                |

Artifacts land in `release/`:

- `Electron Starter-Setup-<version>.exe` — the customizable installer
- `Electron Starter-<version>-portable.exe` — the no-install portable build

## 🎨 Icons & Branding

All Windows packaging art is generated from a single source: `public/assets/logo.png`.

```bash
npm run icons
```

This produces (via `scripts/generate-icons.mjs`, using `sharp` + `png-to-ico`):

| File                          | Purpose                                  |
| ----------------------------- | ---------------------------------------- |
| `build/icon.ico`              | App + installer icon (16→256px, 7 sizes) |
| `build/installerSidebar.bmp`  | Welcome/Finish page sidebar (164×314)    |
| `build/installerHeader.bmp`   | Inner-page header strip (150×57)          |

Swap `public/assets/logo.png` for your own logo and re-run — everything downstream
updates. The generated `.ico`/`.bmp` files are git-ignored and rebuilt on release.

## 🧩 Customizing the Installer

The installer is an **assisted** NSIS build (`oneClick: false`) configured in
`package.json` → `build.nsis`, with custom UI in [`build/installer.nsh`](./build/installer.nsh):

- **Welcome page** — branded via `customWelcomePage`
- **License page** — text in [`build/license.txt`](./build/license.txt)
- **Choose install directory**
- **Additional Tasks page** — a real `nsDialogs` page with two checkboxes:
  - Create a Desktop shortcut (default on)
  - Launch at Windows sign-in (writes an `HKCU\...\Run` value)
- **Finish page** — optional "launch now"

Edit `build/installer.nsh` to add your own checkboxes or install steps. Installer-only
pages are guarded with `!ifndef BUILD_UNINSTALLER` (the script is parsed in both the
installer and uninstaller compile passes).

## 📁 Project Structure

```
build/                 # Installer resources
├── installer.nsh      # Custom NSIS script (welcome + tasks page)
├── license.txt        # License shown in the installer
└── icon.ico / *.bmp   # Generated (git-ignored)
scripts/
└── generate-icons.mjs # Icon + installer-art generator
src/
├── main/              # Electron main process
│   ├── main.cjs       # Window, security, IPC, single-instance lock
│   └── preload.cjs    # Context-isolated bridge (electronAPI)
└── renderer/          # React application
    ├── components/    # UI (shadcn) & layout (Titlebar)
    ├── styles/        # globals.css (Tailwind 4 tokens via @theme)
    ├── lib/           # utils + tests
    └── App.jsx
```

## 📝 IPC / Preload API

Exposed on `window.electronAPI` (see `src/main/preload.cjs`):

```javascript
electronAPI.minimize();
electronAPI.maximize();
electronAPI.close();
const info = await electronAPI.getAppInfo();  // { appVersion, platform, versions… }
electronAPI.openExternal("https://example.com"); // opens in default browser
```

## 📦 Tech Stack

- [Electron 43](https://www.electronjs.org/)
- [React 19](https://react.dev/)
- [Vite 8](https://vite.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [electron-builder 26](https://www.electron.build/)

## 📄 License

Licensed under **CC0-1.0** — public domain, unrestricted use for any purpose.

## 👨‍💻 Author

[Tanvir Ahmed](https://github.com/nettanvirdev)

# RepairPro Desktop

Offline-first electronics repair shop management application. A standalone desktop .exe that works fully without internet.

![RepairPro Icon](public/icon.png)

## Features

- **Dashboard** - Stats cards, revenue charts, repair overview, status distribution pie chart, recent repairs
- **Repairs** - Full CRUD, search, filter by status, add parts, track diagnosis & solution
- **Customers** - Full CRUD, search, view repair history and invoices per customer
- **Invoices** - Auto-generate from repairs, print support, mark paid/sent, PDF-style layout
- **Settings** - Dark/light theme, export/import data (JSON backup), reset all data
- **Fully Offline** - All data stored locally via localStorage, no server needed
- **Demo Data** - Pre-loaded with 8 customers, 10 repairs, and 3 invoices

## Download Pre-built .exe

Go to **GitHub Actions** tab in this repo -> Select the latest workflow run -> Download the artifact for your platform.

## Build from Source

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)

### Windows-specific Prerequisites

Install the Microsoft C++ Build Tools:
```powershell
# Download and install from:
# https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Select: Desktop development with C++
```

### Build Steps

1. Clone the repo:
```bash
git clone https://github.com/dhiksjf/repairpro-desktop.git
cd repairpro-desktop
```

2. Install dependencies:
```bash
npm install
```

3. Build the frontend:
```bash
npm run build
```

4. Build the desktop app:
```bash
# Windows .exe + .msi installer
npm run tauri:build

# Output will be in:
# src-tauri/target/release/bundle/nsis/*.exe     (portable installer)
# src-tauri/target/release/bundle/msi/*.msi      (Windows installer)
```

5. Run in development mode:
```bash
npm run tauri:dev
```

## Project Structure

```
repairpro-desktop/
├── src/                      # React source code
│   ├── components/
│   │   └── layout/          # Sidebar, Header, Layout
│   ├── context/
│   │   ├── DataContext.tsx   # All data CRUD + localStorage
│   │   └── ThemeContext.tsx  # Dark/light theme
│   ├── hooks/
│   │   └── useLocalStorage.ts
│   ├── pages/               # Dashboard, Repairs, Customers, Invoices, Settings
│   ├── types/               # TypeScript interfaces
│   ├── App.tsx              # Routes
│   └── main.tsx             # Entry point
├── src-tauri/               # Tauri Rust backend
│   ├── src/
│   │   └── main.rs          # Rust entry point
│   ├── Cargo.toml           # Rust dependencies
│   ├── tauri.conf.json      # Tauri config (window, icon, etc.)
│   └── icons/               # App icons
├── dist/                    # Built frontend
├── public/
│   └── icon.png             # Source icon
└── package.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS 3 + shadcn/ui |
| Charts | Recharts |
| Routing | React Router v7 |
| Desktop | Tauri v2 (Rust) |
| Storage | localStorage (fully offline) |

## Data Backup & Restore

All data is stored in your browser's localStorage. You can:
- **Export**: Settings > Export Data - saves a JSON backup file
- **Import**: Settings > Import Data - restores from a JSON backup file
- **Reset**: Settings > Reset All Data - clears everything and restores demo data

## License

MIT

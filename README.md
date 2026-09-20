# PacificBoard 🚀

> High-performance collaborative team workspace (Notion + Trello + Slack) powered natively by **PacificDB Community Edition** (TCP Port 9000).

![PacificBoard Architecture](https://img.shields.io/badge/Database-PacificDB%20Community%20Edition-00d8ff?style=flat-square)
![Node](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-339933?style=flat-square)
![React](https://img.shields.io/badge/Frontend-React%2019%20%7C%20TypeScript%20%7C%20Vite-61dafb?style=flat-square)
![Vector Search](https://img.shields.io/badge/AI-384--dim%20Vector%20Cosine%20Search-8a2be2?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## 🌟 Highlights & Key Features

- **📋 Glassmorphism Kanban Board**: Drag-and-drop tasks across `Backlog`, `Todo`, `In Progress`, `Review`, and `Done` with optimistic UI updates and instant PacificDB persistence.
- **💬 Real-Time Team Chat**: Multi-channel discussions (`#general`, `#dev`, `#design`, `#random`), live polling, author avatars, and timestamps.
- **⟡ AI Semantic Vector Search**: Natural language query search (e.g. `"payment bugs"`, `"consensus latency"`, `"login issues"`) using a 384-dimensional character-trigram embedding model and Cosine Similarity over PacificDB's `vectors` collection.
- **⚡ Admin & Chaos Engineering Dashboard**: Live ops/sec throughput, p50/p95/p99 latency tracking, Raft 3-node cluster health, Chaos Engineering controls (kill leader, kill follower, backup snapshots, restore), and a multi-bot continuous traffic simulator.
- **🔌 Native PacificDB TCP Client**: High-efficiency NDJSON TCP stream client with automatic connection pooling, eager socket recycling (<5ms teardown), and memory backpressure resistance.

---

## 📦 What to Install (Prerequisites)

Before running the application, make sure you have the following installed on your machine:

1. **[Node.js](https://nodejs.org/)** (v18.0.0 or higher, v20+ / v22+ recommended)
   - Verify: `node -v` and `npm -v`
2. **[Git](https://git-scm.com/)**
   - Verify: `git --version`
3. **PacificDB Community Edition**
   - Installed at: `C:\Program Files\PacificDB Community\bin\` (or your custom directory)
   - Verify: Run `pacificdb.exe --version` or check if service is listening on port `9000`.

---

## 🚀 Quick Start Guide

### 1. Clone the Repository

```bash
git clone https://github.com/hitesh-reddy-k/bording.git
cd bording
```

---

### 2. Configure Environment Variables

Create your backend configuration from the template:

```bash
cp backend/.env.example backend/.env
```

Default configuration in `backend/.env`:
```env
PACIFICDB_HOST=127.0.0.1
PACIFICDB_PORT=9000
PACIFICDB_DBNAME=pacificboard
PORT=4001
FRONTEND_URL=http://localhost:5173
JWT_SECRET=pacificboard-super-secret-key-change-in-production
```

---

### 3. Install Dependencies

#### Backend:
```bash
cd backend
npm install
```

#### Frontend:
```bash
cd ../frontend
npm install
```

---

### 4. Start PacificDB Engine

Ensure the PacificDB daemon is running and listening on `127.0.0.1:9000`.

On Windows (PowerShell):
```powershell
& "C:\Program Files\PacificDB Community\bin\pacificdb.exe" shell
```
*(Or start the PacificDB Windows Service if installed as a service).*

> **Tip**: If running on a system with high RAM usage, ensure your PacificDB `.env` (located at `%LOCALAPPDATA%\PacificDB\.env`) has:
> ```ini
> MEM_PRESSURE_PERCENT=99
> MEMORY_PRESSURE_THRESHOLD_PCT=99
> MEMORY_BACKPRESSURE_ENABLED=false
> ```

---

### 5. Initialize & Seed Database

From the `backend/` folder, run the automated full database seeder:

```bash
cd backend
npm run seed
```

This will automatically create in PacificDB:
- The default **Demo User** (`demo@pacific.io`)
- Default **Workspace** and **Projects**
- Real Kanban tasks across all 5 status columns
- **384-dimensional vector embeddings** for semantic search
- Multi-channel team chat messages across `#general`, `#dev`, `#design`, and `#random`

#### Additional Dedicated Seeding Scripts:
- **Seed chat messages only**: `npm run seed:chat`
- **Seed tasks only**: `npm run seed:tasks`
- **Re-index vector embeddings**: `npm run reindex:vectors`

---

### 6. Start the Servers

#### Terminal 1 — Backend API:
```bash
cd backend
npm run dev
```
*API will start at **http://localhost:4001** (Health check: `http://localhost:4001/health`).*

#### Terminal 2 — Frontend App:
```bash
cd frontend
npm run dev
```
*Web application will start at **http://localhost:5173**.*

---

## 🔑 Default Login Credentials

Navigate to **http://localhost:5173** in your browser:

| Field | Value |
| :--- | :--- |
| **Email** | `demo@pacific.io` |
| **Password** | `password123` |

*(You can also register a new account anytime from the signup screen).*

---

## 🧭 How to Use PacificBoard

### 1. Kanban Board (`/kanban`)
- Click and drag cards between **Backlog**, **Todo**, **In Progress**, **Review**, and **Done**.
- Filter by project using the top dropdown selector (e.g. `PacificBoard Dev` vs `Bot Test Project`).
- Use the search bar to filter tasks by title, label, or priority.
- Click **"+ Add Task"** to create a new task with assignees, priority, and due date.

### 2. Team Chat (`/chat`)
- Select channels on the left: `#general`, `#dev`, `#design`, or `#random`.
- Send messages in real-time. Messages are persisted strictly in PacificDB's `messages` collection.

### 3. AI Semantic Vector Search (`/semantic`)
- Type natural language queries, such as:
  - `"find tasks related to payment bugs"`
  - `"database performance optimization"`
  - `"drag and drop Kanban board"`
  - `"authentication and login issues"`
- PacificDB calculates cosine similarity over the 384-dimensional vector embeddings and returns ranked matches with percentage scores in milliseconds.

### 4. Admin Dashboard & Load Simulator (`/admin`)
- **Live Ops/Sec**: Real-time throughput graph and p50/p95/p99 latency percentiles.
- **One-Click Dataset Generator**: Generate 50+ tasks, 100+ messages, and vector embeddings into your active workspace.
- **Chaos Engineering**: Inject leader failovers, terminate replica nodes, test automated SST recovery, and verify data integrity checksums.
- **Load Simulator**: Set concurrent bots (10 to 5,000) and click **"Start Simulator"** to simulate continuous background traffic directly in PacificDB.

---

## 📂 Project Structure

```
newprojectusingpacificdb/
├── backend/
│   ├── scripts/
│   │   ├── seed.mjs              # Master database seeder
│   │   ├── seed-demo-chat.mjs    # Multi-channel chat seeder
│   │   ├── seed-demo-tasks.mjs   # Kanban tasks seeder
│   │   ├── reindex-vectors.mjs   # Vector embeddings reindexer
│   │   └── setup-db.mjs          # PacificDB collections initializer
│   ├── src/
│   │   ├── lib/
│   │   │   └── embeddings.js     # 384-dim trigram vector embedding engine
│   │   ├── middleware/
│   │   │   └── auth.js           # JWT authentication middleware
│   │   ├── routes/
│   │   │   ├── admin.js          # Admin stats, chaos tests & simulator
│   │   │   ├── auth.js           # Login & register
│   │   │   ├── chat.js           # Channels & messages
│   │   │   ├── projects.js       # Projects CRUD
│   │   │   ├── search.js         # Text & semantic vector search
│   │   │   ├── tasks.js          # Kanban tasks CRUD & vector sync
│   │   │   └── workspaces.js     # Workspace management
│   │   ├── db.js                 # PacificDB native NDJSON TCP client
│   │   └── server.js             # Express application entry point
│   ├── .env.example              # Environment variables template
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/           # Sidebar, Navbar, Toast notification system
│   │   ├── lib/
│   │   │   ├── api.ts            # Typed API client
│   │   │   ├── context.tsx       # Global user & workspace state
│   │   │   └── toast.ts          # Toast dispatchers
│   │   ├── pages/
│   │   │   ├── AdminDashboard.tsx# Live metrics & chaos testing
│   │   │   ├── Chat.tsx          # Real-time multi-channel chat
│   │   │   ├── Dashboard.tsx     # Workspace overview & statistics
│   │   │   ├── KanbanBoard.tsx   # Interactive drag-and-drop board
│   │   │   ├── Login.tsx         # Auth login / signup
│   │   │   ├── Projects.tsx      # Project management
│   │   │   ├── Search.tsx        # Keyword text search
│   │   │   └── SemanticSearch.tsx# AI vector similarity search
│   │   ├── App.tsx               # Client routes & layout
│   │   └── index.css             # Dark glassmorphic design system
│   ├── package.json
│   └── vite.config.ts
│
├── .gitignore                    # Git ignore configuration
└── README.md                     # Documentation
```

---

## 🛠️ Troubleshooting & FAQ

#### 1. `Error: PacificDB connection failed: connect ECONNREFUSED 127.0.0.1:9000`
- **Cause**: The PacificDB database daemon is not running on port 9000.
- **Solution**: Start PacificDB using `& "C:\Program Files\PacificDB Community\bin\pacificdb.exe" shell` or ensure the service is running.

#### 2. `server_busy: connection_limit`
- **Cause**: Too many raw TCP sockets were left open or memory pressure reached the threshold.
- **Solution**: The included `backend/src/db.js` client automatically queues requests, tears down completed sockets eagerly, and retries with backoff. Also verify `%LOCALAPPDATA%\PacificDB\.env` has `MEM_PRESSURE_PERCENT=99`.

#### 3. Kanban shows 0 tasks or wrong project?
- Switch the project dropdown in the top bar of the Kanban board between `PacificBoard Dev` and `Bot Test Project`.
- Run `npm run seed` in the `backend/` directory to re-populate the default workspace.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
Built with ❤️ using **PacificDB Community Edition**.

---

## 📚 Community and project links

- [Documentation](docs/MEDIA_STORAGE.md)
- [Contributing guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [License](LICENSE)
- [Pull request template](.github/pull_request_template.md)
- [Issue templates](.github/ISSUE_TEMPLATE/)

### Discord

A Discord invite was not configured in the repository. Replace the placeholder below with the project server invite when one is available:

[Join the PacificBoard Discord](https://discord.gg/REPLACE_WITH_DISCORD_INVITE)

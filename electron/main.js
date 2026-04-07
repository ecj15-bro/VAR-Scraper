// electron/main.js — Electron main process

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");
const http = require("http");
const fs = require("fs");
const { DEMO_ACCOUNTS } = require("./demo-seeds");

let mainWindow = null;
let nextServer = null;
let serverPort = null;

// ─── STORE (ESM-only package — use dynamic import) ───────────────────────────

let _store = null;

async function getStore() {
  if (isDev) return null;
  if (!_store) {
    const { default: Store } = await import("electron-store");
    _store = new Store({
      name: "var-hunter-config",
      encryptionKey: "cloudbox-var-hunter-v1",
    });
  }
  return _store;
}

// ─── FIND AVAILABLE PORT ─────────────────────────────────────────────────────

async function findPort() {
  const { default: getPort } = await import("get-port");
  return getPort({ port: [3000, 3001, 3002, 3003, 3004, 3005] });
}

// ─── INJECT STORE VALUES INTO PROCESS.ENV ────────────────────────────────────

async function injectStoreToEnv() {
  if (isDev) return;
  const store = await getStore();
  if (!store) return;
  const keys = [
    "ANTHROPIC_API_KEY",
    "SERPER_API_KEY",
    "RESEND_API_KEY",
    "REPORT_TO_EMAIL",
    "RESEND_FROM",
    "ENABLE_EMAIL_DELIVERY",
  ];
  for (const key of keys) {
    const val = store.get(key, "");
    if (val) process.env[key] = val;
  }
}

// ─── START NEXT.JS SERVER ────────────────────────────────────────────────────

async function startNextServer(port) {
  const nextApp = require("next/dist/server/next");
  const handler = nextApp.default({
    dev: false,
    dir: path.join(__dirname, ".."),
    port,
  });
  await handler.prepare();
  const requestHandler = handler.getRequestHandler();

  const server = http.createServer((req, res) => {
    requestHandler(req, res);
  });

  await new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  nextServer = server;
  return server;
}

// ─── CREATE WINDOW ───────────────────────────────────────────────────────────

function createWindow(port) {
  const iconPath = path.join(__dirname, "icon.png");
  const iconExists = fs.existsSync(iconPath);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: isDev ? "Cloudbox VAR Hunter [DEV]" : "Cloudbox VAR Hunter",
    icon: iconExists ? iconPath : undefined,
    backgroundColor: "#0a0a0f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    mainWindow.loadURL(`http://127.0.0.1:${port}`);
    mainWindow.webContents.openDevTools();
  } else {
    // Show loading screen immediately while Next.js is already running
    mainWindow.loadFile(path.join(__dirname, "loading.html"));

    // Poll until the Next.js server responds, then navigate
    const appUrl = `http://127.0.0.1:${port}`;
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      fetch(appUrl)
        .then(() => {
          clearInterval(poll);
          mainWindow.loadURL(appUrl);
        })
        .catch(() => {
          if (attempts > 60) {
            clearInterval(poll);
            mainWindow.loadURL(appUrl); // try anyway after 30s
          }
        });
    }, 500);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── IPC HANDLERS ────────────────────────────────────────────────────────────

ipcMain.handle("get-settings", async () => {
  if (isDev) {
    return {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
      SERPER_API_KEY: process.env.SERPER_API_KEY ?? "",
      RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
      REPORT_TO_EMAIL: process.env.REPORT_TO_EMAIL ?? "",
      RESEND_FROM: process.env.RESEND_FROM ?? "",
      ENABLE_EMAIL_DELIVERY: process.env.ENABLE_EMAIL_DELIVERY ?? "false",
    };
  }
  const store = await getStore();
  return {
    ANTHROPIC_API_KEY: store.get("ANTHROPIC_API_KEY", ""),
    SERPER_API_KEY: store.get("SERPER_API_KEY", ""),
    RESEND_API_KEY: store.get("RESEND_API_KEY", ""),
    REPORT_TO_EMAIL: store.get("REPORT_TO_EMAIL", ""),
    RESEND_FROM: store.get("RESEND_FROM", ""),
    ENABLE_EMAIL_DELIVERY: store.get("ENABLE_EMAIL_DELIVERY", "false"),
  };
});

ipcMain.handle("save-settings", async (_event, settings) => {
  if (isDev) {
    Object.entries(settings).forEach(([k, v]) => {
      process.env[k] = String(v);
    });
    return { ok: true };
  }
  const store = await getStore();
  Object.entries(settings).forEach(([k, v]) => {
    store.set(k, v);
    // Also update process.env so the running Next.js server picks it up
    process.env[k] = String(v);
  });
  return { ok: true };
});

ipcMain.handle("test-connection", async (_event, { service, key }) => {
  try {
    if (service === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      return { ok: res.status !== 401 && res.status !== 403 };
    }

    if (service === "serper") {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q: "test", num: 1 }),
      });
      return { ok: res.ok };
    }

    if (service === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "test@resend.dev",
          to: "test@resend.dev",
          subject: "ping",
          html: "<p>ping</p>",
        }),
      });
      // 422 = valid key but unverified sender — still authenticated
      return { ok: res.status !== 401 && res.status !== 403 };
    }

    return { ok: false, error: "Unknown service" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle("get-port", () => serverPort);

ipcMain.handle("list-demo-accounts", () => {
  return Object.values(DEMO_ACCOUNTS).map(({ id, label, emoji, color, description }) => ({
    id, label, emoji, color, description,
  }));
});

ipcMain.handle("load-demo-account", async (_event, id) => {
  const demo = DEMO_ACCOUNTS[id];
  if (!demo) return { ok: false, error: `Unknown demo account: ${id}` };

  try {
    // In dev mode: write directly to the file store path
    const storePath = isDev
      ? path.join(app.getPath("userData"), "..", "cloudbox-var-hunter", "var-hunter-store.json")
      : null;

    // Read current store
    const storeFile = storePath ?? path.join(app.getPath("userData"), "var-hunter-store.json");
    let store = {};
    try {
      store = JSON.parse(fs.readFileSync(storeFile, "utf8"));
    } catch {
      // Store doesn't exist yet — start fresh
    }

    // Merge demo profile into store (preserve API keys)
    store.brandConfig = demo.brand;
    store.businessProfile = demo.businessProfile;
    // Clear any existing generated watchtower config so it regenerates for the new profile
    delete store.watchtowerConfig;

    fs.writeFileSync(storeFile, JSON.stringify(store, null, 2), "utf8");

    // Also update process.env fields so running Next.js server picks up brand name
    process.env.DEMO_BRAND_NAME = demo.brand.companyName;

    return { ok: true, label: demo.label };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// ─── APP LIFECYCLE ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    if (isDev) {
      // In dev mode `npm run dev` is already running on 3000 — just open the window.
      serverPort = 3000;
      createWindow(serverPort);
    } else {
      await injectStoreToEnv();
      serverPort = await findPort();
      console.log(`[main] Starting Next.js on port ${serverPort}...`);
      // Show window with loading screen immediately, then start server in background
      createWindow(serverPort);
      await startNextServer(serverPort);
      console.log(`[main] Next.js ready on port ${serverPort}`);
    }
  } catch (err) {
    console.error("[main] Failed to start:", err);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (nextServer) {
    nextServer.close();
  }
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null && serverPort) {
    createWindow(serverPort);
  }
});

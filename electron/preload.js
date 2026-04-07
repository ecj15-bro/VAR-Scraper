// electron/preload.js — IPC bridge exposed to renderer

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  testConnection: (payload) => ipcRenderer.invoke("test-connection", payload),
  getPort: () => ipcRenderer.invoke("get-port"),
  listDemoAccounts: () => ipcRenderer.invoke("list-demo-accounts"),
  loadDemoAccount: (id) => ipcRenderer.invoke("load-demo-account", id),
  isElectron: true,
});

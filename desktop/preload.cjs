const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, handler) {
  const wrapped = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

contextBridge.exposeInMainWorld("desktopApi", {
  getState: () => ipcRenderer.invoke("chat:getState"),
  newSession: () => ipcRenderer.invoke("chat:newSession"),
  sendMessage: (payload) => ipcRenderer.invoke("chat:send", payload),
  stopMessage: () => ipcRenderer.invoke("chat:stop"),
  getWorkspace: () => ipcRenderer.invoke("workspace:get"),
  chooseWorkspace: () => ipcRenderer.invoke("workspace:choose"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (payload) => ipcRenderer.invoke("settings:save", payload),
  clearModelSettings: () => ipcRenderer.invoke("settings:clearModel"),
  listModels: (payload) => ipcRenderer.invoke("models:list", payload),
  onDelta: (handler) => subscribe("chat:delta", handler),
  onStatus: (handler) => subscribe("chat:status", handler),
});

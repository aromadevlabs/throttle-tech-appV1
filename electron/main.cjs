const { app, BrowserWindow } = require("electron");
const path = require("path");

// Starts the same Express server used for the web app (serves the built
// frontend + the Claude API proxy + storage) on localhost, then opens it in
// a native window.
process.env.PORT = process.env.PORT || "3001";

function startServer() {
  // server/index.js is an ES module; Electron's main process runs CommonJS,
  // so we load it via dynamic import.
  return import(path.join(__dirname, "..", "server", "index.js"));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: "#141110",
    title: "Throttle Tech",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const port = process.env.PORT;
  // small delay to let the Express server finish binding
  setTimeout(() => {
    win.loadURL(`http://localhost:${port}`);
  }, 400);
}

app.whenReady().then(async () => {
  await startServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

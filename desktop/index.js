const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, shell, screen } = require("electron");
const projectConfig = require("forestconfig");
const MenuBuilder = require("./menu");

let serverStared = false;

function startServer() {
  if (serverStared) {
    return;
  }
  const forestserver = require("forestserver").default;

  forestserver.start();

  app.on("will-quit", async () => {
    await forestserver.stop();
  });

  serverStared = true;
}

const windowStateFile = path.join(app.getPath("userData"), "window-state.json");

function getWindowState() {
  const defaults = { width: 1000, height: 680 };
  try {
    if (fs.existsSync(windowStateFile)) {
      const state = JSON.parse(fs.readFileSync(windowStateFile, "utf-8"));

      // Basic validation and sanitization
      const sanitized = {
        x: typeof state.x === "number" ? state.x : undefined,
        y: typeof state.y === "number" ? state.y : undefined,
        width:
          typeof state.width === "number"
            ? Math.max(400, state.width)
            : defaults.width,
        height:
          typeof state.height === "number"
            ? Math.max(300, state.height)
            : defaults.height,
        isMaximized: !!state.isMaximized,
      };

      // Ensure window is within at least one visible display
      if (sanitized.x !== undefined && sanitized.y !== undefined) {
        const bounds = {
          x: sanitized.x,
          y: sanitized.y,
          width: sanitized.width,
          height: sanitized.height,
        };
        const display = screen.getDisplayMatching(bounds);
        const visible =
          sanitized.x >= display.bounds.x &&
          sanitized.y >= display.bounds.y &&
          sanitized.x < display.bounds.x + display.bounds.width &&
          sanitized.y < display.bounds.y + display.bounds.height;

        if (!visible) {
          sanitized.x = undefined;
          sanitized.y = undefined;
        }
      }

      return sanitized;
    }
  } catch (err) {
    // Ignore error and return defaults
  }
  return defaults;
}

let saveTimer = null;
function saveWindowState(win, sync = false) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  const performSave = () => {
    try {
      const isMaximized = win.isMaximized();
      const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
      const state = {
        ...bounds,
        isMaximized,
      };
      fs.writeFileSync(windowStateFile, JSON.stringify(state));
    } catch (err) {
      // Ignore error
    }
  };

  if (sync) {
    performSave();
  } else {
    saveTimer = setTimeout(() => {
      performSave();
      saveTimer = null;
    }, 500); // 500ms debounce
  }
}

function createWindow() {
  if (process.env.NODE_ENV !== projectConfig.env.DEVELOPMENT) {
    startServer();
  }

  const state = getWindowState();

  const win = new BrowserWindow({
    show: false,
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    titleBarStyle: "hidden",
  });

  if (state.isMaximized) {
    win.maximize();
  }

  win.webContents.on("ready-to-show", () => {
    if (!win) {
      throw new Error('"win" is not defined');
    }

    win.show();
    win.focus();
  });

  win.on("resize", () => saveWindowState(win));
  win.on("move", () => saveWindowState(win));
  win.on("close", () => saveWindowState(win, true));

  if (process.env.NODE_ENV === projectConfig.env.DEVELOPMENT) {
    win.loadURL(`http://localhost:${projectConfig.devServerPort}`);
  } else {
    win.loadFile(
      path.join(
        app.getAppPath(),
        "node_modules",
        "forestwebapp",
        "dist",
        "index.html"
      )
    );
  }

  // Open urls in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const menuBuilder = new MenuBuilder(win);
  menuBuilder.buildMenu();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

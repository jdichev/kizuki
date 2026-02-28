const path = require("path");
const { app, BrowserWindow, shell } = require("electron");
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

function createWindow() {
  if (process.env.NODE_ENV !== projectConfig.env.DEVELOPMENT) {
    startServer();
  }

  const win = new BrowserWindow({
    show: false,
    width: 1000,
    height: 680,
    titleBarStyle: "hidden",
  });

  win.webContents.on("ready-to-show", () => {
    if (!win) {
      throw new Error('"win" is not defined');
    }

    win.show();
    win.focus();
  });

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

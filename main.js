const { app, BrowserWindow, ipcMain } = require('electron');
const express = require('express');
const fetch = require('node-fetch');

const CLIENT_ID = 'dbf81a5541234a339810a3bf8db11ff8';
const CLIENT_SECRET = 'd61c947a005c421f91ac5f99006ce67e';
const REDIRECT_URI = 'http://127.0.0.1:8888/callback';

let mainWindow;
let accessToken = null;

function forceOnTop() {
  if (!mainWindow) return;
  mainWindow.setAlwaysOnTop(true, "screen-saver");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,

    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.openDevTools({ mode: 'detach' });

  const { screen } = require('electron');

  mainWindow.on('move', () => {
    const bounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const workArea = display.workArea;

    let x = bounds.x;
    let y = bounds.y;

    if (x < workArea.x) x = workArea.x;
    if (x + bounds.width > workArea.x + workArea.width) {
      x = workArea.x + workArea.width - bounds.width;
    }

    if (y < workArea.y) y = workArea.y;
    if (y + bounds.height > workArea.y + workArea.height) {
      y = workArea.y + workArea.height - bounds.height;
    }

    mainWindow.setPosition(x, y);
  });

  mainWindow.on('blur', forceOnTop);
  mainWindow.on('focus', forceOnTop);
  mainWindow.on('show', forceOnTop);
  mainWindow.on('restore', forceOnTop);
}

ipcMain.on('keep-on-top', () => {
  forceOnTop();
});

/* ---------------- AUTH SERVER ---------------- */

function startAuthServer() {
  const server = express();

  // ✅ LOGIN CALLBACK
  server.get('/callback', async (req, res) => {
    const code = req.query.code;

    try {
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(
            CLIENT_ID + ':' + CLIENT_SECRET
          ).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI
        })
      });

      const data = await tokenRes.json();

      accessToken = data.access_token;
      const refreshToken = data.refresh_token;

      console.log("ACCESS:", accessToken);
      console.log("REFRESH:", refreshToken);

      // ✅ SEND BOTH TOKENS
      mainWindow.webContents.send('token', {
        accessToken,
        refreshToken
      });

      mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('token', {
          accessToken,
          refreshToken
        });
      });

      res.send("Login successful! You can close this tab.");

    } catch (err) {
      console.error(err);
      res.send("Auth failed");
    }
  });

  // ✅ REFRESH ENDPOINT (NEW)
  server.post('/refresh', express.json(), async (req, res) => {
    const { refreshToken } = req.body;

    try {
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(
            CLIENT_ID + ':' + CLIENT_SECRET
          ).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      const data = await tokenRes.json();

      console.log("REFRESHED:", data.access_token);

      res.json(data);

    } catch (err) {
      console.error(err);
      res.status(500).send("Refresh failed");
    }
  });

  server.listen(8888, () => {
    console.log("Auth server running on 8888");
  });
}

/* ---------------- START ---------------- */

app.whenReady().then(() => {
  createWindow();
  startAuthServer();
});
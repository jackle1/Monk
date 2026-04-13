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

  // keep inside screen bounds
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

  // 🔥 IMPORTANT FIXES
  mainWindow.on('blur', forceOnTop);
  mainWindow.on('focus', forceOnTop);
  mainWindow.on('show', forceOnTop);
  mainWindow.on('restore', forceOnTop);
}

// IPC from renderer (button clicks)
ipcMain.on('keep-on-top', () => {
  forceOnTop();
});

// Spotify auth server
function startAuthServer() {
  const server = express();

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

      mainWindow.webContents.send('token', accessToken);

      mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('token', accessToken);
      });

      res.send("Login successful!");
    } catch (err) {
      console.error(err);
      res.send("Auth failed");
    }
  });

  server.listen(8888);
}

app.whenReady().then(() => {
  createWindow();
  startAuthServer();
});
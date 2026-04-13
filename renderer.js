const { ipcRenderer, shell } = require('electron');

const CLIENT_ID = 'dbf81a5541234a339810a3bf8db11ff8';
const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
const SCOPES = 'user-read-playback-state user-modify-playback-state';

let accessToken = localStorage.getItem("spotify_token");
let pollInterval = null;

ipcRenderer.on('token', (event, token) => {
  accessToken = token;
  localStorage.setItem("spotify_token", token);

  document.getElementById('songTitle').innerText = "Connected 🎧";
  document.getElementById('songArtist').innerText = "";

  startPolling();
});

function login() {
  const authUrl =
    `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}`;

  shell.openExternal(authUrl);
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(getCurrentTrack, 1000);
}

async function getCurrentTrack() {
  if (!accessToken) return;

  const res = await fetch('https://api.spotify.com/v1/me/player', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (res.status === 204 || res.status >= 400) return;

  const data = await res.json();
  if (!data?.item) return;

  document.getElementById('songTitle').innerText = data.item.name;
  document.getElementById('songArtist').innerText = data.item.artists[0].name;
  document.getElementById('albumArt').src = data.item.album.images[0].url;

  document.getElementById('toggleBtn').innerText =
    data.is_playing ? "⏸" : "▶";
}

async function toggle() {
  if (!accessToken) return;

  const stateRes = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (stateRes.status === 204) return;

  const state = await stateRes.json();
  const endpoint = state.is_playing ? 'pause' : 'play';

  await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

async function next() {
  await fetch('https://api.spotify.com/v1/me/player/next', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

async function prev() {
  await fetch('https://api.spotify.com/v1/me/player/previous', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

function keepOnTop() {
  ipcRenderer.send('keep-on-top');
}

if (!accessToken) {
  login();
} else {
  document.getElementById('songTitle').innerText = "Connected 🎧";
  startPolling();
}
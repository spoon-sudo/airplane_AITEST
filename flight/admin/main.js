const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const io = require('socket.io-client');

let mainWindow;
let serverProcess = null;
let socket = null;
const serverPath = path.join(__dirname, '../server/server.js');
const serverUrl = 'http://localhost:3000';

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => mainWindow = null);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle server start request
ipcMain.on('start-server', (event) => {
  if (serverProcess) {
    event.reply('server-status', { status: 'running', message: 'Server is already running' });
    return;
  }

  // Start the server as a child process
  serverProcess = spawn('node', [serverPath]);
  
  serverProcess.stdout.on('data', (data) => {
    const message = data.toString();
    event.reply('server-log', { type: 'info', message });
  });
  
  serverProcess.stderr.on('data', (data) => {
    const message = data.toString();
    event.reply('server-log', { type: 'error', message });
  });
  
  serverProcess.on('close', (code) => {
    event.reply('server-log', { 
      type: 'info', 
      message: `Server process exited with code ${code}` 
    });
    event.reply('server-status', { status: 'stopped' });
    serverProcess = null;
    
    // Disconnect socket if it exists
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  });
  
  // Wait a moment for the server to start
  setTimeout(() => {
    connectToServer(event);
  }, 2000);
  
  event.reply('server-status', { status: 'running', message: 'Server started' });
});

// Handle server stop request
ipcMain.on('stop-server', (event) => {
  if (!serverProcess) {
    event.reply('server-status', { status: 'stopped', message: 'Server is not running' });
    return;
  }
  
  // Disconnect socket
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  
  // Kill the server process
  serverProcess.kill();
  serverProcess = null;
  event.reply('server-status', { status: 'stopped', message: 'Server stopped' });
});

// Connect to server via Socket.io to get real-time data
function connectToServer(event) {
  if (socket) {
    socket.disconnect();
  }
  
  socket = io(serverUrl, {
    reconnectionAttempts: 5,
    timeout: 5000
  });
  
  socket.on('connect', () => {
    event.reply('server-log', { type: 'info', message: 'Admin panel connected to server' });
    
    // Request admin data from server
    socket.emit('admin-auth', { key: 'admin-secret-key' });
    
    // Request room data every 5 seconds
    const intervalId = setInterval(() => {
      if (socket && socket.connected) {
        socket.emit('get-admin-data');
      } else {
        clearInterval(intervalId);
      }
    }, 5000);
  });
  
  socket.on('admin-data', (data) => {
    event.reply('admin-data-update', data);
  });
  
  socket.on('connect_error', (err) => {
    event.reply('server-log', { 
      type: 'error', 
      message: `Failed to connect to server: ${err.message}` 
    });
  });
  
  socket.on('disconnect', () => {
    event.reply('server-log', { type: 'info', message: 'Disconnected from server' });
  });
}

// Handle refresh request
ipcMain.on('refresh-data', (event) => {
  if (socket && socket.connected) {
    socket.emit('get-admin-data');
  } else {
    connectToServer(event);
  }
});
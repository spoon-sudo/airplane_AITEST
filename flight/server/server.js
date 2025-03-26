const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Game state
const players = {};
const gameRooms = {};
const adminSockets = new Set();
const ADMIN_SECRET_KEY = 'admin-secret-key'; // Change this to something more secure

// Set up server
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const IP = '0.0.0.0';

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Add player to game state
  players[socket.id] = {
    id: socket.id,
    name: 'Unknown',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    room: null
  };
  
  // Handle getting rooms list
  socket.on('getRooms', () => {
    socket.emit('roomsList', gameRooms);
  });
  
  // Handle creating a room
  socket.on('createRoom', (data) => {
    const roomId = generateRoomId();
    
    // Create the room
    gameRooms[roomId] = {
      id: roomId,
      name: data.name || `Room ${roomId}`,
      players: [],
      creator: data.creator || 'Unknown'
    };
    
    // Tell the client the room was created
    socket.emit('roomCreated', {
      id: roomId,
      name: gameRooms[roomId].name
    });
  });
  
  // Update joinRoom handler to accept player name
  socket.on('joinRoom', (data) => {
    const roomId = data.roomId;
    
    // Update player name
    if (data.playerName) {
      players[socket.id].name = data.playerName;
    }
    
    // Create room if it doesn't exist
    if (!gameRooms[roomId]) {
      gameRooms[roomId] = {
        id: roomId,
        name: `Room ${roomId}`,
        players: []
      };
    }
    
    // Add player to room
    socket.join(roomId);
    players[socket.id].room = roomId;
    gameRooms[roomId].players.push(socket.id);
    
    // Send current players in room to the new player
    const playersInRoom = gameRooms[roomId].players.map(id => players[id]);
    socket.emit('currentPlayers', playersInRoom);
    
    // Notify other players about new player
    socket.to(roomId).emit('playerJoined', players[socket.id]);
    
    console.log(`Player ${players[socket.id].name} (${socket.id}) joined room ${roomId}`);
  });
  
  // Handle player movement
  socket.on('playerMovement', (movementData) => {
    // Update player position and rotation
    players[socket.id].position = movementData.position;
    players[socket.id].rotation = movementData.rotation;
    
    // Broadcast player's movement to others in the same room
    if (players[socket.id].room) {
      socket.to(players[socket.id].room).emit('playerMoved', {
        id: socket.id,
        position: players[socket.id].position,
        rotation: players[socket.id].rotation
      });
    }
  });
  
  // Admin authentication
  socket.on('admin-auth', (data) => {
    if (data.key === ADMIN_SECRET_KEY) {
      console.log(`Admin connected: ${socket.id}`);
      adminSockets.add(socket.id);
      
      // Send initial data
      sendAdminData(socket);
    }
  });

  // Admin data request
  socket.on('get-admin-data', () => {
    if (adminSockets.has(socket.id)) {
      sendAdminData(socket);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    // Remove player from room
    const roomId = players[socket.id].room;
    if (roomId && gameRooms[roomId]) {
      gameRooms[roomId].players = gameRooms[roomId].players.filter(id => id !== socket.id);
      
      // Delete room if empty
      if (gameRooms[roomId].players.length === 0) {
        delete gameRooms[roomId];
        console.log(`Room ${roomId} was deleted (empty)`);
      } else {
        // Notify others in room about player leaving
        socket.to(roomId).emit('playerLeft', socket.id);
      }
    }
    
    // Also remove from admin sockets if it was an admin
    if (adminSockets.has(socket.id)) {
      adminSockets.delete(socket.id);
      console.log(`Admin disconnected: ${socket.id}`);
    }
    
    // Delete player from state
    delete players[socket.id];
  });
});

// Function to send admin data
function sendAdminData(socket) {
  if (!adminSockets.has(socket.id)) return;
  
  const adminData = {
    totalPlayers: Object.keys(players).length,
    rooms: {},
    memoryUsage: process.memoryUsage().heapUsed
  };
  
  // Collect room data
  Object.keys(gameRooms).forEach(roomId => {
    adminData.rooms[roomId] = {
      id: roomId,
      players: gameRooms[roomId].players
    };
  });
  
  socket.emit('admin-data', adminData);
}
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}
// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, IP, () => {
  console.log(`Server running on ${IP}:${PORT}`);
});
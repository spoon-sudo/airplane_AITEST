class NetworkManager {
  constructor() {
    this.socket = null;
    this.players = {};
    this.localPlayer = null;
    this.playerName = 'Unknown';
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onPlayerMoved = null;
    this.onConnectionStateChanged = null; // New callback for connection state changes
  }

  setPlayerName(name) {
    this.playerName = name;
  }

  connect() {
    // Connect to the Node.js server explicitly
    this.socket = io('http://92.33.230.22:3000');
    
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server!');
      document.getElementById('connection-status').textContent = 'Status: Connected';
      if (this.onConnectionStateChanged) this.onConnectionStateChanged();
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      document.getElementById('connection-status').textContent = 'Status: Connection Error';
      if (this.onConnectionStateChanged) this.onConnectionStateChanged();
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      document.getElementById('connection-status').textContent = 'Status: Disconnected';
      if (this.onConnectionStateChanged) this.onConnectionStateChanged();
    });
    
    // Handle receiving current players in room
    this.socket.on('currentPlayers', (players) => {
      players.forEach(player => {
        if (player.id === this.socket.id) {
          this.localPlayer = player;
        } else {
          this.players[player.id] = player;
          if (this.onPlayerJoined) this.onPlayerJoined(player);
        }
      });
    });
    
    // Handle new player joining
    this.socket.on('playerJoined', (player) => {
      this.players[player.id] = player;
      if (this.onPlayerJoined) this.onPlayerJoined(player);
    });
    
    // Handle player movement
    this.socket.on('playerMoved', (playerData) => {
      if (this.players[playerData.id]) {
        this.players[playerData.id].position = playerData.position;
        this.players[playerData.id].rotation = playerData.rotation;
        
        if (this.onPlayerMoved) this.onPlayerMoved(playerData);
      }
    });
    
    // Handle player leaving
    this.socket.on('playerLeft', (playerId) => {
      if (this.players[playerId]) {
        if (this.onPlayerLeft) this.onPlayerLeft(this.players[playerId]);
        delete this.players[playerId];
      }
    });
  }

  joinRoom(roomId) {
    this.socket.emit('joinRoom', {
      roomId: roomId,
      playerName: this.playerName
    });
  }

  updatePlayerMovement(position, rotation) {
    this.socket.emit('playerMovement', {
      position: position,
      rotation: rotation
    });
  }

  getPlayerId() {
    return this.socket ? this.socket.id : null;
  }
}
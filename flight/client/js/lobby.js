document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const playerNameInput = document.getElementById('player-name');
    const createRoomBtn = document.getElementById('create-room-btn');
    const refreshRoomsBtn = document.getElementById('refresh-rooms-btn');
    const roomsContainer = document.getElementById('rooms-container');
    const noRoomsMessage = document.getElementById('no-rooms-message');
    const createRoomModal = document.getElementById('create-room-modal');
    const roomNameInput = document.getElementById('room-name-input');
    const cancelCreateBtn = document.getElementById('cancel-create-btn');
    const confirmCreateBtn = document.getElementById('confirm-create-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // Socket connection
    let socket;
    let playerName = '';
    
    // Check for saved player name
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      playerNameInput.value = savedName;
    }
    
    // Connect to server
    function connectToServer() {
      socket = io('http://92.33.230.22:3000');
      
      socket.on('connect', () => {
        console.log('Connected to server');
        fetchRooms();
      });
      
      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        alert('Failed to connect to server. Please try again later.');
      });
      
      socket.on('roomsList', (rooms) => {
        updateRoomsList(rooms);
      });
      
      socket.on('roomCreated', (roomInfo) => {
        hideLoading();
        joinRoom(roomInfo.id);
      });
    }
    
    // Initialize connection
    connectToServer();
    
    // Fetch available rooms
    function fetchRooms() {
      if (socket && socket.connected) {
        socket.emit('getRooms');
      }
    }
    
    // Update rooms list in UI
    function updateRoomsList(rooms) {
      const roomsList = Object.values(rooms);
      
      // Clear previous rooms
      while (roomsContainer.firstChild) {
        if (roomsContainer.firstChild.id === 'no-rooms-message') {
          break;
        }
        roomsContainer.removeChild(roomsContainer.firstChild);
      }
      
      // Show or hide "no rooms" message
      if (roomsList.length === 0) {
        noRoomsMessage.style.display = 'block';
      } else {
        noRoomsMessage.style.display = 'none';
        
        // Add room cards
        roomsList.forEach(room => {
          const roomCard = createRoomCard(room);
          roomsContainer.prepend(roomCard);
        });
      }
    }
    
    // Create a room card element
    function createRoomCard(room) {
      const card = document.createElement('div');
      card.className = 'room-card';
      
      const header = document.createElement('div');
      header.className = 'room-header';
      
      const roomName = document.createElement('div');
      roomName.className = 'room-name';
      roomName.textContent = room.name || `Room ${room.id}`;
      
      const playerCount = document.createElement('div');
      playerCount.className = 'player-count';
      playerCount.textContent = `${room.players.length} players`;
      
      const joinButton = document.createElement('button');
      joinButton.className = 'room-join';
      joinButton.textContent = 'Join Room';
      joinButton.addEventListener('click', () => {
        validateAndJoin(room.id);
      });
      
      header.appendChild(roomName);
      header.appendChild(playerCount);
      card.appendChild(header);
      card.appendChild(joinButton);
      
      return card;
    }
    
    // Create room button click handler
    createRoomBtn.addEventListener('click', () => {
      if (!validatePlayerName()) return;
      
      createRoomModal.style.display = 'flex';
      roomNameInput.focus();
    });
    
    // Cancel create room
    cancelCreateBtn.addEventListener('click', () => {
      createRoomModal.style.display = 'none';
      roomNameInput.value = '';
    });
    
    // Confirm create room
    confirmCreateBtn.addEventListener('click', () => {
      const roomName = roomNameInput.value.trim();
      
      if (!roomName) {
        alert('Please enter a room name');
        return;
      }
      
      createRoomModal.style.display = 'none';
      showLoading();
      
      socket.emit('createRoom', {
        name: roomName,
        creator: playerName
      });
    });
    
    // Refresh rooms button click handler
    refreshRoomsBtn.addEventListener('click', fetchRooms);
    
    // Validate player name and join room
    function validateAndJoin(roomId) {
      if (!validatePlayerName()) return;
      
      joinRoom(roomId);
    }
    
    // Validate player name
    function validatePlayerName() {
      const name = playerNameInput.value.trim();
      
      if (!name) {
        alert('Please enter your name');
        playerNameInput.focus();
        return false;
      }
      
      playerName = name;
      localStorage.setItem('playerName', name);
      return true;
    }
    
    // Join a room and transition to game
    function joinRoom(roomId) {
      showLoading();
      
      // Store player info in session storage for the game page
      sessionStorage.setItem('playerName', playerName);
      sessionStorage.setItem('roomId', roomId);
      
      // Navigate to game page
      window.location.href = '/game.html';
    }
    
    // Show loading overlay
    function showLoading() {
      loadingOverlay.style.display = 'flex';
    }
    
    // Hide loading overlay
    function hideLoading() {
      loadingOverlay.style.display = 'none';
    }
  });
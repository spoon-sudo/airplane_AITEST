document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const playerNameDisplay = document.getElementById('player-name-display');
    const roomIdDisplay = document.getElementById('room-id-display');
    const playerCountElement = document.getElementById('player-count');
    const backToLobbyButton = document.getElementById('back-to-lobby');
    const altitudeDisplay = document.getElementById('altitude');
    const speedDisplay = document.getElementById('speed');
    
    // Get player info from session storage
    const playerName = sessionStorage.getItem('playerName') || 'Unknown';
    const roomId = sessionStorage.getItem('roomId');
    
    // Display player info
    playerNameDisplay.textContent = playerName;
    roomIdDisplay.textContent = roomId || 'Unknown';
    
    // Initialize variable for position updates
    let lastUpdateTime = 0;
    
    // Bullet management
    const bullets = [];
    
    // Create a clock for delta time calculation
    const clock = new THREE.Clock();
    
    // Camera controls with balanced sensitivity
    let lastMouseX = window.innerWidth / 2;
    let lastMouseY = window.innerHeight / 2;
    let cameraPitch = 0;
    let cameraYaw = 0;
    const cameraRotationSpeed = 0.003; // Significantly increased camera sensitivity
    let pointerLocked = false;
    
    // Hide the mouse cursor for better flight controls
    document.body.style.cursor = 'none';
    
    // Pointer Lock API for unlimited mouse movement
    document.addEventListener('click', () => {
      if (!pointerLocked) {
        document.body.requestPointerLock();
      }
    });
    
    document.addEventListener('pointerlockchange', () => {
      pointerLocked = document.pointerLockElement === document.body;
    });
    
    // Initialize Three.js
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x87ceeb); // Sky blue
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(100, 200, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);
    
    // Create terrain
    createTerrain();
    
    // Create the sky
    createSky();
    
    // Create aircraft meshes
    const playerAircraft = new Aircraft(scene, true);
    const otherAircrafts = {};
    
    // Update player's aircraft with their own name
    playerAircraft.updateName(playerName);
    
    // Third-person camera setup
    const cameraOffset = new THREE.Vector3(0, 10, -30);
    const cameraLookOffset = new THREE.Vector3(0, 0, 20);
    
    // Game controls
    const controls = {
      pitch: 0,      // W/S keys
      yaw: 0,        // A/D keys
      roll: 0,       // Q/E keys
      speed: 20      // Mouse wheel control
    };
    
    document.addEventListener('mousemove', (event) => {
      if (!pointerLocked) return;
      
      // Use movementX/Y from pointer lock API for better tracking
      // Reverse the direction by negating the values
      const deltaX = -event.movementX;
      const deltaY = -event.movementY;
      
      // Update camera orientation
      cameraYaw += deltaX * cameraRotationSpeed;
      cameraPitch += deltaY * cameraRotationSpeed;
      
      // Clamp cameraPitch to avoid flipping
      cameraPitch = Math.max(-Math.PI/3, Math.min(Math.PI/3, cameraPitch));
    });
    
    // Set up mouse wheel control for speed
    document.addEventListener('wheel', (event) => {
      // Adjust speed with scroll wheel
      if (event.deltaY < 0) {
        // Scroll up - increase speed
        controls.speed = Math.min(playerAircraft.maxSpeed, controls.speed + 2);
      } else {
        // Scroll down - decrease speed
        controls.speed = Math.max(playerAircraft.minSpeed, controls.speed - 2);
      }
    });
    
    // Set up key controls
    document.addEventListener('keydown', (event) => {
      handleKeyDown(event.code, true);
    });
    
    document.addEventListener('keyup', (event) => {
      handleKeyDown(event.code, false);
    });
    
    function handleKeyDown(keyCode, isPressed) {
      const value = isPressed ? 1 : 0;
      
      switch (keyCode) {
        // W/S for pitch (reversed)
        case 'KeyW':
          controls.pitch = isPressed ? 1 : (controls.pitch > 0 ? 0 : controls.pitch);
          break;
        case 'KeyS':
          controls.pitch = isPressed ? -1 : (controls.pitch < 0 ? 0 : controls.pitch);
          break;
        
        // A/D for yaw (reversed)
        case 'KeyA':
          controls.yaw = isPressed ? 1 : (controls.yaw > 0 ? 0 : controls.yaw);
          break;
        case 'KeyD':
          controls.yaw = isPressed ? -1 : (controls.yaw < 0 ? 0 : controls.yaw);
          break;
        
        // Q/E for roll (reversed)
        case 'KeyQ':
          controls.roll = isPressed ? 1 : (controls.roll > 0 ? 0 : controls.roll);
          break;
        case 'KeyE':
          controls.roll = isPressed ? -1 : (controls.roll < 0 ? 0 : controls.roll);
          break;
          
        // Space for shooting
        case 'Space':
          if (isPressed) {
            const bullet = playerAircraft.shoot();
            if (bullet) {
              bullets.push(bullet);
            }
          }
          break;
      }
    }
    
    // Initialize network
    const network = new NetworkManager();
    
    // Set player name
    network.setPlayerName(playerName);
    
    // Handle new players joining
    network.onPlayerJoined = (player) => {
      console.log('Player joined:', player);
      
      // Create aircraft for new player
      if (!otherAircrafts[player.id]) {
        const randomColor = Math.random() * 0xffffff;
        otherAircrafts[player.id] = new Aircraft(scene, false, randomColor);
        
        // Set initial position and rotation if available
        if (player.position) {
          otherAircrafts[player.id].setPosition(player.position);
        }
        if (player.rotation) {
          otherAircrafts[player.id].setRotation(player.rotation);
        }
        
        // Set player name
        otherAircrafts[player.id].updateName(player.name || 'Unknown Player');
      }
      
      updatePlayerCount();
    };
    
    // Handle players leaving
    network.onPlayerLeft = (player) => {
      console.log('Player left:', player);
      
      // Remove aircraft for player who left
      if (otherAircrafts[player.id]) {
        otherAircrafts[player.id].remove();
        delete otherAircrafts[player.id];
      }
      
      updatePlayerCount();
    };
    
    // Handle player movement
    network.onPlayerMoved = (playerData) => {
      if (otherAircrafts[playerData.id]) {
        otherAircrafts[playerData.id].setPosition(playerData.position);
        otherAircrafts[playerData.id].setRotation(playerData.rotation);
      }
    };
    
    function updatePlayerCount() {
      // Get accurate count from network players object
      const count = Object.keys(network.players).length + 1; // +1 for local player
      playerCountElement.textContent = `Players: ${count}`;
    }
    
    // Make sure we update player count whenever network state changes
    network.onConnectionStateChanged = () => {
      updatePlayerCount();
    };
    
    // Connect and join room
    network.connect();
    
    if (roomId) {
      setTimeout(() => {
        network.joinRoom(roomId);
      }, 1000);
    } else {
      console.error('No room ID provided');
      alert('No room specified. Returning to lobby.');
      window.location.href = '/lobby.html';
    }
    
    // Game loop
    function animate() {
      requestAnimationFrame(animate);
      
      // Get delta time for frame-rate independent movement
      const delta = clock ? clock.getDelta() : 0.016;
      
      // Update player aircraft based on keyboard controls
      playerAircraft.applyControls(controls);
      playerAircraft.update();
      
      // Update other aircraft
      Object.values(otherAircrafts).forEach(aircraft => {
        aircraft.update();
      });
      
      // Update bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        // Update bullet position
        const bulletActive = bullets[i].update(delta);
        
        if (!bulletActive) {
          // Bullet reached maximum range, remove it
          bullets.splice(i, 1);
          continue;
        }
        
        // Check for collisions with other aircraft
        let collided = false;
        Object.values(otherAircrafts).forEach(aircraft => {
          if (!collided && bullets[i].checkCollision(aircraft)) {
            collided = true;
          }
        });
        
        // If bullet collided, it's already removed in the checkCollision method
        if (collided) {
          bullets.splice(i, 1);
        }
      }
      
      // Reset camera view gradually when aircraft is moving
      // Calculate the speed of rotation/movement of the aircraft
      const rotationSpeed = Math.abs(playerAircraft.angularVelocity.pitch) + 
                           Math.abs(playerAircraft.angularVelocity.yaw) + 
                           Math.abs(playerAircraft.angularVelocity.roll);
      
      // If the aircraft is turning or moving significantly, gradually reset camera
      if (rotationSpeed > 0.01 || playerAircraft.speed > 30) {
        // Reset camera orientation gradually
        cameraPitch *= 0.98; // Gradually move toward 0
        cameraYaw *= 0.98;   // Gradually move toward 0
      }
      
      // Camera positioning with mouse orbit
      // Calculate base offset distance (further away at higher speeds)
      const distance = 25 + (playerAircraft.speed * 0.1);
      
      // Start with a base position behind and above the aircraft
      const cameraPosition = new THREE.Vector3(0, 8, -distance);
      
      // Apply the mouse orbit rotation
      // First rotate around Y axis (yaw)
      cameraPosition.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
      
      // Then rotate around X axis (pitch)
      const rightAxis = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
      cameraPosition.applyAxisAngle(rightAxis, cameraPitch);
      
      // Apply the aircraft's rotation
      cameraPosition.applyQuaternion(playerAircraft.mesh.quaternion);
      
      // Add to aircraft position
      cameraPosition.add(playerAircraft.position);
      
      // Set camera position
      camera.position.copy(cameraPosition);
      
      // Look at aircraft
      camera.lookAt(playerAircraft.position);
      
      // Update UI
      updateUI();
      
      // Send position update to server
      sendPositionUpdate();
      
      renderer.render(scene, camera);
    }
    
    // Start game loop
    animate();
    
    // Update UI elements
    function updateUI() {
      altitudeDisplay.textContent = `Altitude: ${Math.floor(playerAircraft.position.y)}m`;
      speedDisplay.textContent = `Speed: ${Math.floor(playerAircraft.speed)} km/h`;
    }
    
    // Send position updates to server
    function sendPositionUpdate() {
      const now = Date.now();
      
      // Limit updates to 10 per second
      if (now - lastUpdateTime > 100) {
        network.updatePlayerMovement(
          playerAircraft.getPosition(),
          playerAircraft.getRotation()
        );
        
        lastUpdateTime = now;
      }
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Back to lobby button
    backToLobbyButton.addEventListener('click', () => {
      window.location.href = '/lobby.html';
    });
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
      // Disconnect from server when leaving
      if (network.socket) {
        network.socket.disconnect();
      }
    });
    
    // Create terrain with a ground plane
    function createTerrain() {
      // Ground plane
      const groundGeometry = new THREE.PlaneGeometry(10000, 10000);
      const groundMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x228B22, // Forest green
        side: THREE.DoubleSide 
      });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
      
      // Add some mountains
      for (let i = 0; i < 50; i++) {
        const size = 20 + Math.random() * 100;
        const height = 50 + Math.random() * 200;
        
        const mountainGeometry = new THREE.ConeGeometry(size, height, 5 + Math.floor(Math.random() * 5));
        const mountainMaterial = new THREE.MeshPhongMaterial({ 
          color: 0x8B4513, // Saddle brown
        });
        
        const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
        mountain.position.set(
          (Math.random() - 0.5) * 5000,
          height / 2,
          (Math.random() - 0.5) * 5000
        );
        mountain.castShadow = true;
        mountain.receiveShadow = true;
        scene.add(mountain);
      }
      
      // Add some clouds
      for (let i = 0; i < 100; i++) {
        const cloudSize = 20 + Math.random() * 30;
        const cloudGeometry = new THREE.SphereGeometry(cloudSize, 7, 7);
        const cloudMaterial = new THREE.MeshPhongMaterial({ 
          color: 0xffffff,
          transparent: true,
          opacity: 0.8
        });
        
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
        
        // Random position in the sky
        cloud.position.set(
          (Math.random() - 0.5) * 5000,
          100 + Math.random() * 500,
          (Math.random() - 0.5) * 5000
        );
        
        scene.add(cloud);
      }
    }
    
    // Create a sky dome
    function createSky() {
      const skyGeometry = new THREE.SphereGeometry(5000, 32, 32);
      const skyMaterial = new THREE.MeshBasicMaterial({
        color: 0x87CEEB,
        side: THREE.BackSide
      });
      const sky = new THREE.Mesh(skyGeometry, skyMaterial);
      scene.add(sky);
    }
  });
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
      // Create a more realistic terrain with heightmap
      const terrainSize = 10000;
      const terrainSegments = 100;
      const heightMultiplier = 300;
      
      // Create ground geometry with more segments for better detail
      const groundGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
      
      // Apply heightmap to the terrain
      const vertices = groundGeometry.attributes.position.array;
      for (let i = 0; i < vertices.length; i += 3) {
        // Skip the Y value (which is the height)
        const x = vertices[i];
        const z = vertices[i + 2];
        
        // Create realistic heightmap using Perlin-like noise simulation
        // Combine multiple frequencies for more natural-looking terrain
        const height = 
          Math.sin(x * 0.01) * Math.cos(z * 0.01) * 20 +   // Large features
          Math.sin(x * 0.05) * Math.cos(z * 0.05) * 10 +   // Medium features
          Math.sin(x * 0.1) * Math.cos(z * 0.1) * 5;       // Small features
          
        vertices[i + 1] = height;
      }
      
      // Need to update normals after changing the vertices
      groundGeometry.computeVertexNormals();
      
      // Create gradient texture for the terrain
      const terrainCanvas = document.createElement('canvas');
      const terrainContext = terrainCanvas.getContext('2d');
      terrainCanvas.width = 256;
      terrainCanvas.height = 256;
      
      // Create a gradient for terrain coloring
      const gradient = terrainContext.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, '#8B4513');   // Mountains (brown)
      gradient.addColorStop(0.3, '#556B2F');  // Hills (dark green)
      gradient.addColorStop(0.6, '#228B22');  // Grasslands (forest green)
      gradient.addColorStop(0.8, '#D2B48C');  // Sandy areas
      gradient.addColorStop(1, '#F5DEB3');    // Beaches
      
      terrainContext.fillStyle = gradient;
      terrainContext.fillRect(0, 0, 256, 256);
      
      const terrainTexture = new THREE.CanvasTexture(terrainCanvas);
      terrainTexture.wrapS = THREE.RepeatWrapping;
      terrainTexture.wrapT = THREE.RepeatWrapping;
      terrainTexture.repeat.set(10, 10);
      
      // Create material with the texture
      const groundMaterial = new THREE.MeshPhongMaterial({ 
        map: terrainTexture,
        side: THREE.DoubleSide,
        shininess: 0  // Matte finish for terrain
      });
      
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
      
      // Add mountains as separate meshes for better visuals
      addMountains();
      
      // Add forests as clusters of trees
      addForests();
      
      // Add water bodies (lakes)
      addWater();
      
      // Add some clouds
      addClouds();
    }
    
    function addMountains() {
      // Create more realistic mountains with varied shapes
      for (let i = 0; i < 30; i++) {
        // More varied sizes for natural look
        const size = 50 + Math.random() * 150;
        const height = 100 + Math.random() * 300;
        
        // Use noise for more randomized mountain shapes
        const jaggedness = 0.2 + Math.random() * 0.3;
        const segments = 12 + Math.floor(Math.random() * 8);
        
        // Use custom geometry for more interesting mountain shapes
        let mountainGeometry;
        
        // Create different types of mountains
        if (Math.random() > 0.5) {
          // Cone-shaped mountains
          mountainGeometry = new THREE.ConeGeometry(
            size, 
            height, 
            segments, 
            4 + Math.floor(Math.random() * 3),
            false,
            Math.random() * Math.PI * 2
          );
        } else {
          // Pyramid-like mountains
          mountainGeometry = new THREE.CylinderGeometry(
            0, 
            size, 
            height, 
            4 + Math.floor(Math.random() * 3),
            5 + Math.floor(Math.random() * 3),
            false
          );
        }
        
        // Distort vertices for more natural look
        const vertices = mountainGeometry.attributes.position.array;
        for (let j = 0; j < vertices.length; j += 3) {
          if (vertices[j + 1] < height * 0.9) { // Don't affect the peak too much
            vertices[j] += (Math.random() - 0.5) * size * jaggedness;
            vertices[j + 2] += (Math.random() - 0.5) * size * jaggedness;
          }
        }
        
        mountainGeometry.computeVertexNormals();
        
        // Create gradient texture for mountains
        const mountainCanvas = document.createElement('canvas');
        const mountainContext = mountainCanvas.getContext('2d');
        mountainCanvas.width = 512;
        mountainCanvas.height = 512;
        
        // Create gradient based on height
        const gradient = mountainContext.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#FFFFFF'); // Snow cap
        gradient.addColorStop(0.3, '#A0A0A0'); // Rock
        gradient.addColorStop(0.6, '#8B4513'); // Dirt/rock
        gradient.addColorStop(1, '#556B2F'); // Base vegetation
        
        mountainContext.fillStyle = gradient;
        mountainContext.fillRect(0, 0, 512, 512);
        
        const mountainTexture = new THREE.CanvasTexture(mountainCanvas);
        
        // Create material with the texture
        const mountainMaterial = new THREE.MeshPhongMaterial({ 
          map: mountainTexture,
          shininess: 2,
          bumpScale: 1
        });
        
        const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
        
        // Position mountains away from the center
        const angle = Math.random() * Math.PI * 2;
        const distance = 1000 + Math.random() * 4000;
        mountain.position.set(
          Math.cos(angle) * distance,
          height / 2 - 20, // Slightly embed in terrain
          Math.sin(angle) * distance
        );
        
        // Random rotation for variety
        mountain.rotation.y = Math.random() * Math.PI * 2;
        
        mountain.castShadow = true;
        mountain.receiveShadow = true;
        scene.add(mountain);
      }
    }
    
    function addForests() {
      // Add clusters of trees to create forest areas
      const forestCount = 15;
      const treesPerForest = 30;
      
      for (let i = 0; i < forestCount; i++) {
        // Forest location
        const forestAngle = Math.random() * Math.PI * 2;
        const forestDistance = 1000 + Math.random() * 3500;
        const forestX = Math.cos(forestAngle) * forestDistance;
        const forestZ = Math.sin(forestAngle) * forestDistance;
        
        for (let j = 0; j < treesPerForest; j++) {
          // Tree properties
          const treeHeight = 30 + Math.random() * 50;
          const trunkRadius = 2 + Math.random() * 3;
          
          // Position trees in a cluster
          const treeAngle = Math.random() * Math.PI * 2;
          const treeDistance = Math.random() * 200;
          const treeX = forestX + Math.cos(treeAngle) * treeDistance;
          const treeZ = forestZ + Math.sin(treeAngle) * treeDistance;
          
          // Create trunk
          const trunkGeometry = new THREE.CylinderGeometry(
            trunkRadius * 0.7, // Top radius slightly smaller
            trunkRadius,       // Bottom radius
            treeHeight * 0.4,  // Trunk height
            8,                 // Segments
            1
          );
          
          const trunkMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x8B4513, // Brown
            shininess: 3
          });
          
          const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
          
          // Create foliage (tree top)
          let foliageGeometry;
          const foliageSize = trunkRadius * 5;
          
          if (Math.random() > 0.5) {
            // Conical trees (like pine)
            foliageGeometry = new THREE.ConeGeometry(
              foliageSize,
              treeHeight * 0.8,
              8
            );
          } else {
            // Round top trees (like oak)
            foliageGeometry = new THREE.SphereGeometry(
              foliageSize,
              8,
              6
            );
          }
          
          // Green with slight variations
          const greenShade = 0.2 + Math.random() * 0.2;
          const foliageMaterial = new THREE.MeshPhongMaterial({ 
            color: new THREE.Color(0, greenShade, 0),
            shininess: 1
          });
          
          const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
          
          // Position foliage on top of trunk
          foliage.position.y = treeHeight * 0.2; // Half of trunk height + half of foliage height
          
          // Create tree group
          const tree = new THREE.Group();
          tree.add(trunk);
          tree.add(foliage);
          
          // Position tree
          tree.position.set(treeX, 0, treeZ);
          
          tree.castShadow = true;
          tree.receiveShadow = true;
          scene.add(tree);
        }
      }
    }
    
    function addWater() {
      // Add lakes and rivers
      const waterCount = 10;
      
      for (let i = 0; i < waterCount; i++) {
        // Lake properties
        const lakeRadius = 100 + Math.random() * 300;
        
        // Water geometry (slightly below ground level)
        const waterGeometry = new THREE.CircleGeometry(lakeRadius, 32);
        
        // Water material with slight transparency and blue color
        const waterMaterial = new THREE.MeshPhongMaterial({ 
          color: 0x3399ff,
          transparent: true,
          opacity: 0.8,
          shininess: 100,
          specular: 0xffffff
        });
        
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        
        // Position lakes away from center
        const lakeAngle = Math.random() * Math.PI * 2;
        const lakeDistance = 1000 + Math.random() * 3000;
        
        water.position.set(
          Math.cos(lakeAngle) * lakeDistance,
          1, // Slightly above ground to avoid z-fighting
          Math.sin(lakeAngle) * lakeDistance
        );
        
        // Rotate to be flat on the ground
        water.rotation.x = -Math.PI / 2;
        
        scene.add(water);
      }
    }
    
    function addClouds() {
      // Create more realistic cloud formations
      const cloudGroupCount = 30;
      
      for (let i = 0; i < cloudGroupCount; i++) {
        // Create a cloud group (multiple cloud puffs together)
        const cloudGroup = new THREE.Group();
        
        // Number of cloud puffs in this formation
        const puffCount = 3 + Math.floor(Math.random() * 8);
        
        // Base size for this cloud formation
        const baseSize = 30 + Math.random() * 60;
        
        for (let j = 0; j < puffCount; j++) {
          // Vary the size of each puff
          const puffSize = baseSize * (0.6 + Math.random() * 0.8);
          
          // Create a cloud puff
          const cloudGeometry = new THREE.SphereGeometry(puffSize, 7, 7);
          const cloudMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.8 + Math.random() * 0.2
          });
          
          const cloudPuff = new THREE.Mesh(cloudGeometry, cloudMaterial);
          
          // Position this puff relative to the cloud group
          const puffOffset = baseSize * 0.8;
          cloudPuff.position.set(
            (Math.random() - 0.5) * puffOffset,
            (Math.random() - 0.5) * puffOffset * 0.5,
            (Math.random() - 0.5) * puffOffset
          );
          
          // Squish the clouds a bit to make them more cloud-like
          cloudPuff.scale.y = 0.5 + Math.random() * 0.3;
          
          cloudGroup.add(cloudPuff);
        }
        
        // Position the entire cloud formation
        const cloudHeight = 300 + Math.random() * 700;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 5000;
        
        cloudGroup.position.set(
          Math.cos(angle) * distance,
          cloudHeight,
          Math.sin(angle) * distance
        );
        
        scene.add(cloudGroup);
      }
    }
    
    // Create a sky dome with gradient for better visual effect
    function createSky() {
      // Create a larger sky dome
      const skyGeometry = new THREE.SphereGeometry(8000, 32, 32);
      
      // Create a sky gradient texture
      const skyCanvas = document.createElement('canvas');
      const skyContext = skyCanvas.getContext('2d');
      skyCanvas.width = 512;
      skyCanvas.height = 512;
      
      // Create a vertical gradient
      const gradient = skyContext.createLinearGradient(0, 0, 0, 512);
      gradient.addColorStop(0, '#0077FF'); // Deep blue at the top
      gradient.addColorStop(0.4, '#87CEEB'); // Sky blue
      gradient.addColorStop(0.8, '#E0F6FF'); // Light blue/white at the horizon
      gradient.addColorStop(1, '#FFF8E0'); // Subtle yellow/white at the bottom for sunset effect
      
      skyContext.fillStyle = gradient;
      skyContext.fillRect(0, 0, 512, 512);
      
      const skyTexture = new THREE.CanvasTexture(skyCanvas);
      
      const skyMaterial = new THREE.MeshBasicMaterial({
        map: skyTexture,
        side: THREE.BackSide,
        fog: false
      });
      
      const sky = new THREE.Mesh(skyGeometry, skyMaterial);
      scene.add(sky);
      
      // Add a sun
      addSun();
    }
    
    function addSun() {
      // Create a glowing sun
      const sunGeometry = new THREE.SphereGeometry(100, 32, 32);
      const sunMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffdd66,
        transparent: true,
        fog: false
      });
      
      const sun = new THREE.Mesh(sunGeometry, sunMaterial);
      
      // Position the sun high in the sky
      sun.position.set(5000, 3000, -3000);
      scene.add(sun);
      
      // Add a lens flare or glow effect
      const sunLight = new THREE.PointLight(0xffffdd, 2, 8000);
      sunLight.position.copy(sun.position);
      scene.add(sunLight);
    }
  });
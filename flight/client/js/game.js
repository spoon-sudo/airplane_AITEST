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
      // Create scene fog for depth effect
      scene.fog = new THREE.FogExp2(0xCFE2F3, 0.00025);
      
      // Create a beautiful ground plane with advanced features
      const terrainSize = 20000;
      const terrainDetail = 250; // Higher detail for better looking terrain
      
      // Base ground with detailed texturing
      const groundGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainDetail, terrainDetail);
      
      // Generate realistic heightmap
      applyHeightmap(groundGeometry);
      
      // Create beautiful ground texture with multi-layering
      const groundMaterial = createTerrainMaterial();
      
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
      
      // Add environmental elements
      addMountainRanges();
      addForests();
      addLakes();
      addClouds();
    }
    
    function applyHeightmap(geometry) {
      const vertices = geometry.attributes.position.array;
      
      // Use multiple noise frequencies for natural-looking terrain
      for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        
        // Use simplified Perlin-like noise algorithm for realistic terrain
        let height = 0;
        
        // Large-scale terrain features (mountains and valleys)
        height += Math.sin(x * 0.002) * Math.cos(z * 0.002) * 120;
        
        // Medium-scale features (hills)
        height += Math.sin(x * 0.01) * Math.cos(z * 0.01) * 30;
        
        // Small-scale features (bumps and texture)
        height += Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5;
        
        // Add some randomness for natural variation
        height += (Math.random() * 2 - 1) * 5;
        
        // Make the terrain more flat near the center (for runway/starting area)
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        const centerFlatteningFactor = 1 - Math.max(0, 1 - distanceFromCenter / 500);
        height *= centerFlatteningFactor;
        
        // Apply the height
        vertices[i + 1] = height;
      }
      
      // Update normals for proper lighting
      geometry.computeVertexNormals();
    }
    
    function createTerrainMaterial() {
      // Create a canvas for ground texture
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 1024;
      canvas.height = 1024;
      
      // Create a complex gradient for terrain coloring
      const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
      
      // Snow peaks
      gradient.addColorStop(0, '#FFFFFF');
      
      // Rocky mountains
      gradient.addColorStop(0.1, '#8D6E63');
      gradient.addColorStop(0.25, '#6D4C41');
      
      // Forest green
      gradient.addColorStop(0.4, '#2E7D32');
      gradient.addColorStop(0.5, '#388E3C');
      
      // Grassy plains
      gradient.addColorStop(0.7, '#7CB342');
      
      // Sandy shores
      gradient.addColorStop(0.85, '#D7CCC8');
      
      // Beach
      gradient.addColorStop(1, '#FAFAFA');
      
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add noise pattern for texture detail
      addNoiseToCanvas(context, canvas.width, canvas.height);
      
      // Create the terrain material with texture
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(20, 20);
      
      // Create bump map for extra detail
      const bumpCanvas = createBumpMap(canvas.width, canvas.height);
      const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
      bumpTexture.wrapS = THREE.RepeatWrapping;
      bumpTexture.wrapT = THREE.RepeatWrapping;
      bumpTexture.repeat.set(20, 20);
      
      return new THREE.MeshPhongMaterial({
        map: texture,
        bumpMap: bumpTexture,
        bumpScale: 20,
        shininess: 0,
        side: THREE.DoubleSide
      });
    }
    
    function addNoiseToCanvas(context, width, height) {
      const imageData = context.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        // Add subtle noise to each pixel
        const noise = (Math.random() * 2 - 1) * 10;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
      }
      
      context.putImageData(imageData, 0, 0);
    }
    
    function createBumpMap(width, height) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;
      
      // Create noise-based bump map
      const imageData = context.createImageData(width, height);
      const data = imageData.data;
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          
          // Generate Perlin-like noise
          const value = (Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5 + 0.5) * 255;
          
          // Add some random noise
          const noise = Math.random() * 30;
          data[i] = data[i + 1] = data[i + 2] = value + noise;
          data[i + 3] = 255; // Alpha
        }
      }
      
      context.putImageData(imageData, 0, 0);
      return canvas;
    }
    
    function addMountainRanges() {
      // Add several mountain ranges for visual interest
      const mountainRanges = 5;
      
      for (let r = 0; r < mountainRanges; r++) {
        // Determine range properties
        const rangeCenterAngle = r * (Math.PI * 2 / mountainRanges);
        const rangeDistance = 3000 + Math.random() * 2000;
        const rangeCenterX = Math.cos(rangeCenterAngle) * rangeDistance;
        const rangeCenterZ = Math.sin(rangeCenterAngle) * rangeDistance;
        const rangeLength = 2000 + Math.random() * 3000;
        const rangeWidth = 800 + Math.random() * 1000;
        const rangeDirection = Math.random() * Math.PI * 2;
        
        // Create mountains along the range
        const mountainCount = 15 + Math.floor(Math.random() * 10);
        
        for (let i = 0; i < mountainCount; i++) {
          // Position along the range
          const positionAlongRange = (i / (mountainCount - 1) - 0.5) * rangeLength;
          const offsetFromRange = (Math.random() - 0.5) * rangeWidth;
          
          // Calculate mountain position
          const dirX = Math.cos(rangeDirection);
          const dirZ = Math.sin(rangeDirection);
          const perpX = -dirZ;
          const perpZ = dirX;
          
          const mountainX = rangeCenterX + dirX * positionAlongRange + perpX * offsetFromRange;
          const mountainZ = rangeCenterZ + dirZ * positionAlongRange + perpZ * offsetFromRange;
          
          // Mountain properties based on position in range
          const centralPosition = 1 - Math.abs(positionAlongRange) / (rangeLength * 0.5);
          const mountainSize = (100 + Math.random() * 150) * (0.7 + centralPosition * 0.5);
          const mountainHeight = (200 + Math.random() * 500) * (0.7 + centralPosition * 0.5);
          
          // Create custom mountain geometry
          let mountainGeometry;
          
          if (Math.random() > 0.3) {
            // Cone mountains (more common)
            mountainGeometry = new THREE.ConeGeometry(
              mountainSize,
              mountainHeight,
              8 + Math.floor(Math.random() * 5)
            );
          } else {
            // Pyramid mountains
            mountainGeometry = new THREE.CylinderGeometry(
              0,
              mountainSize,
              mountainHeight,
              4 + Math.floor(Math.random() * 3)
            );
          }
          
          // Distort vertices for more natural look
          const vertices = mountainGeometry.attributes.position.array;
          for (let j = 0; j < vertices.length; j += 3) {
            if (vertices[j + 1] < mountainHeight * 0.8) {
              vertices[j] += (Math.random() - 0.5) * mountainSize * 0.3;
              vertices[j + 2] += (Math.random() - 0.5) * mountainSize * 0.3;
            }
          }
          
          mountainGeometry.computeVertexNormals();
          
          // Create mountain material with gradient texture
          const material = createMountainMaterial(mountainHeight);
          
          const mountain = new THREE.Mesh(mountainGeometry, material);
          
          // Position and add to scene
          mountain.position.set(
            mountainX,
            mountainHeight / 2 - 10, // Embed slightly in terrain
            mountainZ
          );
          
          mountain.castShadow = true;
          mountain.receiveShadow = true;
          scene.add(mountain);
        }
      }
    }
    
    function createMountainMaterial(height) {
      // Create canvas for the gradient texture
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 512;
      canvas.height = 512;
      
      // Create height-based gradient
      const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
      
      if (height > 400) {
        // Tall mountains with snow caps
        gradient.addColorStop(0, '#FFFFFF'); // Snow cap
        gradient.addColorStop(0.3, '#E0E0E0'); // Snow with some rock showing
        gradient.addColorStop(0.5, '#9E9E9E'); // Rocky area
        gradient.addColorStop(0.7, '#6D4C41'); // Brown rock
        gradient.addColorStop(1, '#5D4037'); // Dark brown base
      } else {
        // Smaller hills/mountains without snow
        gradient.addColorStop(0, '#9E9E9E'); // Light rock
        gradient.addColorStop(0.4, '#795548'); // Brown rock
        gradient.addColorStop(0.8, '#5D4037'); // Darker brown
        gradient.addColorStop(1, '#4E342E'); // Very dark brown base
      }
      
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add some noise for texture
      addNoiseToCanvas(context, canvas.width, canvas.height);
      
      const texture = new THREE.CanvasTexture(canvas);
      
      return new THREE.MeshPhongMaterial({
        map: texture,
        shininess: 0,
        flatShading: true
      });
    }
    
    function addForests() {
      // Create multiple forest clusters
      const forestClusters = 15;
      
      for (let i = 0; i < forestClusters; i++) {
        // Forest cluster properties
        const clusterAngle = Math.random() * Math.PI * 2;
        const clusterDistance = 1000 + Math.random() * 3000;
        const clusterX = Math.cos(clusterAngle) * clusterDistance;
        const clusterZ = Math.sin(clusterAngle) * clusterDistance;
        const clusterRadius = 400 + Math.random() * 600;
        
        // Determine tree density based on distance (sparser forests further away)
        const treeDensity = Math.max(0.3, 1 - clusterDistance / 6000);
        const treeCount = Math.floor(treeDensity * (100 + Math.random() * 100));
        
        // Create trees in cluster
        for (let j = 0; j < treeCount; j++) {
          // Tree position within cluster (more dense in center)
          const treeAngle = Math.random() * Math.PI * 2;
          const treeDistanceFromCenter = Math.pow(Math.random(), 0.8) * clusterRadius; // Concentrate trees toward center
          const treeX = clusterX + Math.cos(treeAngle) * treeDistanceFromCenter;
          const treeZ = clusterZ + Math.sin(treeAngle) * treeDistanceFromCenter;
          
          // Tree properties
          const treeType = Math.random();
          let tree;
          
          if (treeType < 0.6) {
            // Pine tree (more common)
            tree = createPineTree();
          } else if (treeType < 0.9) {
            // Oak tree
            tree = createOakTree();
          } else {
            // Dead tree (rare)
            tree = createDeadTree();
          }
          
          // Position tree
          tree.position.set(treeX, 0, treeZ);
          
          // Random rotation
          tree.rotation.y = Math.random() * Math.PI * 2;
          
          // Random scale variation
          const scale = 0.8 + Math.random() * 0.4;
          tree.scale.set(scale, scale, scale);
          
          scene.add(tree);
        }
      }
    }
    
    function createPineTree() {
      const tree = new THREE.Group();
      
      // Tree height
      const height = 30 + Math.random() * 40;
      const trunkHeight = height * 0.5;
      const trunkRadius = height * 0.03;
      
      // Create trunk
      const trunkGeometry = new THREE.CylinderGeometry(
        trunkRadius * 0.7, // Top slightly narrower
        trunkRadius,
        trunkHeight,
        8
      );
      
      const trunkMaterial = new THREE.MeshPhongMaterial({
        color: 0x8B4513,
        shininess: 3
      });
      
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = trunkHeight / 2;
      trunk.castShadow = true;
      
      tree.add(trunk);
      
      // Create multiple layers of foliage
      const foliageLayers = 3 + Math.floor(Math.random() * 3);
      const foliageHeight = height * 0.5;
      const layerHeight = foliageHeight / foliageLayers;
      
      for (let i = 0; i < foliageLayers; i++) {
        const ratio = 1 - i / foliageLayers;
        const layerRadius = height * 0.15 * (0.6 + ratio * 0.4);
        
        const foliageGeometry = new THREE.ConeGeometry(
          layerRadius,
          layerHeight * 1.2, // Overlap layers slightly
          8
        );
        
        // Vary the green shade
        const greenHue = 0.25 + Math.random() * 0.1;
        const greenSaturation = 0.5 + Math.random() * 0.3;
        const greenLightness = 0.25 + Math.random() * 0.1;
        
        const foliageMaterial = new THREE.MeshPhongMaterial({
          color: new THREE.Color().setHSL(greenHue, greenSaturation, greenLightness),
          shininess: 5
        });
        
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = trunkHeight + i * layerHeight * 0.8;
        foliage.castShadow = true;
        
        tree.add(foliage);
      }
      
      return tree;
    }
    
    function createOakTree() {
      const tree = new THREE.Group();
      
      // Tree dimensions
      const height = 25 + Math.random() * 30;
      const trunkHeight = height * 0.6;
      const trunkRadius = height * 0.04;
      
      // Create trunk
      const trunkGeometry = new THREE.CylinderGeometry(
        trunkRadius * 0.8,
        trunkRadius,
        trunkHeight,
        10
      );
      
      const trunkMaterial = new THREE.MeshPhongMaterial({
        color: 0x8B4513,
        shininess: 3
      });
      
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = trunkHeight / 2;
      trunk.castShadow = true;
      
      tree.add(trunk);
      
      // Create foliage (round shape)
      const foliageGeometry = new THREE.SphereGeometry(
        height * 0.25,
        10,
        10
      );
      
      const foliageMaterial = new THREE.MeshPhongMaterial({
        color: new THREE.Color(0.2 + Math.random() * 0.1, 0.5 + Math.random() * 0.2, 0.1),
        shininess: 5
      });
      
      const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage.position.y = trunkHeight + height * 0.15;
      foliage.scale.y = 1.2; // Slightly elongated vertically
      foliage.castShadow = true;
      
      tree.add(foliage);
      
      return tree;
    }
    
    function createDeadTree() {
      const tree = new THREE.Group();
      
      // Tree dimensions
      const height = 20 + Math.random() * 25;
      const trunkRadius = height * 0.03;
      
      // Create twisted trunk
      const trunkGeometry = new THREE.CylinderGeometry(
        trunkRadius * 0.5,
        trunkRadius,
        height,
        8
      );
      
      // Add twist and bend to vertices
      const vertices = trunkGeometry.attributes.position.array;
      for (let i = 0; i < vertices.length; i += 3) {
        const y = vertices[i + 1];
        const normalizedHeight = y / height;
        
        // Add progressive twist and bend
        const twistAmount = normalizedHeight * Math.PI * 0.2;
        const bendAmount = Math.pow(normalizedHeight, 2) * 5;
        
        // Apply twist (rotate around Y axis)
        const x = vertices[i];
        const z = vertices[i + 2];
        const distance = Math.sqrt(x*x + z*z);
        if (distance > 0) {
          const angle = Math.atan2(z, x) + twistAmount;
          vertices[i] = Math.cos(angle) * distance;
          vertices[i + 2] = Math.sin(angle) * distance;
        }
        
        // Apply bend (in random direction)
        const bendDirection = Math.PI * 1.5; // Bend direction
        vertices[i] += Math.cos(bendDirection) * bendAmount;
        vertices[i + 2] += Math.sin(bendDirection) * bendAmount;
      }
      
      trunkGeometry.computeVertexNormals();
      
      const trunkMaterial = new THREE.MeshPhongMaterial({
        color: 0x5D4037, // Dark brown
        shininess: 0
      });
      
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = height / 2;
      trunk.castShadow = true;
      
      tree.add(trunk);
      
      // Add a few branches
      const branchCount = 3 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < branchCount; i++) {
        const branchHeight = height * (0.5 + Math.random() * 0.4);
        const branchAngle = Math.random() * Math.PI * 2;
        const branchTilt = Math.PI / 4 + Math.random() * Math.PI / 4;
        
        const branchLength = height * (0.2 + Math.random() * 0.3);
        const branchRadius = trunkRadius * (0.3 + Math.random() * 0.3);
        
        const branchGeometry = new THREE.CylinderGeometry(
          branchRadius * 0.5,
          branchRadius,
          branchLength,
          6
        );
        
        const branch = new THREE.Mesh(branchGeometry, trunkMaterial);
        
        // Position at side of trunk
        branch.position.y = branchHeight;
        
        // Rotate to point outward
        branch.rotation.z = branchTilt;
        branch.rotation.y = branchAngle;
        
        // Move to be connected to trunk
        branch.position.x = Math.cos(branchAngle) * trunkRadius;
        branch.position.z = Math.sin(branchAngle) * trunkRadius;
        
        // Move pivot to base of branch
        branch.geometry.translate(0, branchLength/2, 0);
        
        branch.castShadow = true;
        tree.add(branch);
      }
      
      return tree;
    }
    
    function addLakes() {
      // Add several lakes of different sizes
      const lakeCount = 10;
      
      for (let i = 0; i < lakeCount; i++) {
        // Lake position
        const angle = Math.random() * Math.PI * 2;
        const distance = 1000 + Math.random() * 4000;
        const lakeX = Math.cos(angle) * distance;
        const lakeZ = Math.sin(angle) * distance;
        
        // Lake dimensions
        const lakeSize = 200 + Math.random() * 500;
        
        // Create lake with irregular shape
        const lakeShape = new THREE.Shape();
        
        // Create irregular polygon
        const segments = 12 + Math.floor(Math.random() * 8);
        for (let j = 0; j < segments; j++) {
          const segmentAngle = j * Math.PI * 2 / segments;
          const segmentRadius = lakeSize * (0.8 + Math.random() * 0.4);
          const x = Math.cos(segmentAngle) * segmentRadius;
          const y = Math.sin(segmentAngle) * segmentRadius;
          
          if (j === 0) {
            lakeShape.moveTo(x, y);
          } else {
            lakeShape.lineTo(x, y);
          }
        }
        
        lakeShape.closePath();
        
        const lakeGeometry = new THREE.ShapeGeometry(lakeShape);
        
        // Create water material with nice blue color and high specular
        const lakeMaterial = new THREE.MeshPhongMaterial({
          color: 0x0288D1, // Nice blue
          specular: 0xFFFFFF,
          shininess: 100,
          transparent: true,
          opacity: 0.8
        });
        
        const lake = new THREE.Mesh(lakeGeometry, lakeMaterial);
        
        // Rotate to be flat on ground and position
        lake.rotation.x = -Math.PI / 2;
        lake.position.set(lakeX, 2, lakeZ); // Slightly above ground to avoid z-fighting
        
        scene.add(lake);
        
        // Add beach/shore around lake
        addLakeShore(lakeX, lakeZ, lakeShape, lakeSize);
      }
    }
    
    function addLakeShore(lakeX, lakeZ, lakeShape, lakeSize) {
      // Create a slightly larger shape for the shore
      const shoreShape = new THREE.Shape();
      const lakePoints = lakeShape.getPoints();
      
      // Create a shore that's slightly larger than the lake
      for (let i = 0; i < lakePoints.length; i++) {
        const point = lakePoints[i];
        const angle = Math.atan2(point.y, point.x);
        const distance = Math.sqrt(point.x * point.x + point.y * point.y);
        
        // Make shore 10-20% larger than lake
        const shoreDistance = distance * (1.1 + Math.random() * 0.1);
        const x = Math.cos(angle) * shoreDistance;
        const y = Math.sin(angle) * shoreDistance;
        
        if (i === 0) {
          shoreShape.moveTo(x, y);
        } else {
          shoreShape.lineTo(x, y);
        }
      }
      
      shoreShape.closePath();
      
      // Create a donut-like shape (shore minus lake)
      const holeShape = new THREE.Path();
      for (let i = 0; i < lakePoints.length; i++) {
        if (i === 0) {
          holeShape.moveTo(lakePoints[i].x, lakePoints[i].y);
        } else {
          holeShape.lineTo(lakePoints[i].x, lakePoints[i].y);
        }
      }
      
      shoreShape.holes.push(holeShape);
      
      const shoreGeometry = new THREE.ShapeGeometry(shoreShape);
      
      // Create sandy material for shore
      const shoreMaterial = new THREE.MeshPhongMaterial({
        color: 0xF5DEB3, // Sandy color
        shininess: 0
      });
      
      const shore = new THREE.Mesh(shoreGeometry, shoreMaterial);
      
      // Position shore
      shore.rotation.x = -Math.PI / 2;
      shore.position.set(lakeX, 1, lakeZ); // Slightly above ground but below water
      
      scene.add(shore);
    }
    
    function addClouds() {
      // Create multiple cloud layers and types
      
      // High fluffy clouds
      createCloudLayer(50, 2000, 800, 0.5, 0.7);
      
      // Mid-level clouds
      createCloudLayer(30, 1200, 500, 0.6, 0.8);
      
      // Low scattered clouds
      createCloudLayer(20, 800, 400, 0.7, 0.9);
    }
    
    function createCloudLayer(count, baseHeight, heightVariation, minOpacity, maxOpacity) {
      for (let i = 0; i < count; i++) {
        // Cloud position covering the whole sky
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 8000;
        const cloudX = Math.cos(angle) * distance;
        const cloudZ = Math.sin(angle) * distance;
        const cloudY = baseHeight + Math.random() * heightVariation;
        
        // Create cloud formation
        const cloudGroup = new THREE.Group();
        
        // Number of puffs in this cloud
        const puffCount = 5 + Math.floor(Math.random() * 15);
        
        // Overall cloud size
        const cloudSize = 200 + Math.random() * 300;
        
        // Cloud shape (elongation factor)
        const elongation = 1 + Math.random() * 2;
        
        for (let j = 0; j < puffCount; j++) {
          // Position within cloud
          const puffAngle = Math.random() * Math.PI * 2;
          const puffDistanceFromCenter = Math.random() * cloudSize/2 * 
                                        (1 - 0.5 * Math.pow(Math.random(), 2)); // More dense in center
          
          const puffX = Math.cos(puffAngle) * puffDistanceFromCenter * elongation;
          const puffZ = Math.sin(puffAngle) * puffDistanceFromCenter;
          const puffY = (Math.random() - 0.5) * cloudSize * 0.2;
          
          // Puff size based on distance from center
          const distanceRatio = puffDistanceFromCenter / (cloudSize/2);
          const puffSize = (cloudSize * 0.2) * (1 - 0.5 * distanceRatio);
          
          // Create cloud puff
          const puffGeometry = new THREE.SphereGeometry(puffSize, 7, 7);
          
          // Cloud opacity decreases toward edges
          const opacity = minOpacity + (maxOpacity - minOpacity) * (1 - distanceRatio);
          
          const puffMaterial = new THREE.MeshPhongMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: opacity,
            specular: 0xFFFFFF,
            shininess: 100
          });
          
          const puff = new THREE.Mesh(puffGeometry, puffMaterial);
          puff.position.set(puffX, puffY, puffZ);
          
          // Slightly squish the puff vertically
          puff.scale.y = 0.7;
          
          cloudGroup.add(puff);
        }
        
        // Position the entire cloud
        cloudGroup.position.set(cloudX, cloudY, cloudZ);
        
        // Random cloud rotation
        cloudGroup.rotation.y = Math.random() * Math.PI * 2;
        
        scene.add(cloudGroup);
      }
    }
    
    // Create a beautiful sky with gradient and sun
    function createSky() {
      // Create a larger sky dome for better visuals
      const skyGeometry = new THREE.SphereGeometry(9000, 32, 32);
      
      // Create a richer sky texture with more detailed gradient
      const skyCanvas = document.createElement('canvas');
      const skyContext = skyCanvas.getContext('2d');
      skyCanvas.width = 1024;
      skyCanvas.height = 1024;
      
      // Create a more detailed vertical gradient
      const gradient = skyContext.createLinearGradient(0, 0, 0, skyCanvas.height);
      
      // More detailed sky colors
      gradient.addColorStop(0, '#0A2463'); // Deep blue at the top
      gradient.addColorStop(0.2, '#1E5AC8'); // Rich blue
      gradient.addColorStop(0.4, '#4A99E9'); // Medium blue
      gradient.addColorStop(0.6, '#7EC8F2'); // Light blue
      gradient.addColorStop(0.8, '#C4E4F2'); // Very light blue
      gradient.addColorStop(0.95, '#FFE3D0'); // Subtle orange/pink at horizon
      gradient.addColorStop(1, '#FFFFFF'); // White at bottom
      
      skyContext.fillStyle = gradient;
      skyContext.fillRect(0, 0, skyCanvas.width, skyCanvas.height);
      
      // Add some subtle noise for a more natural look
      addNoiseToCanvas(skyContext, skyCanvas.width, skyCanvas.height);
      
      const skyTexture = new THREE.CanvasTexture(skyCanvas);
      
      const skyMaterial = new THREE.MeshBasicMaterial({
        map: skyTexture,
        side: THREE.BackSide,
        fog: false
      });
      
      const sky = new THREE.Mesh(skyGeometry, skyMaterial);
      scene.add(sky);
      
      // Add a beautiful sun with glow effect
      addImpressiveSun();
    }
    
    function addImpressiveSun() {
      // Create sun at an appealing angle in the sky
      const sunAngle = Math.PI * 0.4; // Angle from horizon
      const sunAzimuth = Math.PI * 0.2; // Direction (0 = east, PI/2 = south)
      
      const sunDistance = 8000;
      const sunX = Math.cos(sunAzimuth) * Math.cos(sunAngle) * sunDistance;
      const sunY = Math.sin(sunAngle) * sunDistance;
      const sunZ = Math.sin(sunAzimuth) * Math.cos(sunAngle) * sunDistance;
      
      // Create the sun sphere with intense emissive material
      const sunGeometry = new THREE.SphereGeometry(300, 32, 32);
      const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFFFF,
        fog: false
      });
      
      const sun = new THREE.Mesh(sunGeometry, sunMaterial);
      sun.position.set(sunX, sunY, sunZ);
      scene.add(sun);
      
      // Create a strong directional light from the sun
      const sunLight = new THREE.DirectionalLight(0xFFFFEE, 1);
      sunLight.position.set(sunX, sunY, sunZ);
      
      // Set up shadows
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 500;
      sunLight.shadow.camera.far = 10000;
      sunLight.shadow.camera.left = -3000;
      sunLight.shadow.camera.right = 3000;
      sunLight.shadow.camera.top = 3000;
      sunLight.shadow.camera.bottom = -3000;
      
      scene.add(sunLight);
      
      // Add lens flare effect
      addSunGlow(new THREE.Vector3(sunX, sunY, sunZ));
    }
    
    function addSunGlow(sunPosition) {
      // Create several glowing halos around the sun
      const glowCount = 3;
      
      for (let i = 0; i < glowCount; i++) {
        const size = 350 * (i + 1) * 1.2;
        const opacity = 0.2 * (1 - i / glowCount);
        
        const glowGeometry = new THREE.PlaneGeometry(size, size);
        
        // Create a radial gradient for the glow
        const glowCanvas = document.createElement('canvas');
        const glowContext = glowCanvas.getContext('2d');
        glowCanvas.width = 256;
        glowCanvas.height = 256;
        
        const gradient = glowContext.createRadialGradient(
          128, 128, 0,
          128, 128, 128
        );
        
        // Create color based on which glow layer
        let r = 1, g = 1, b = 0.8;
        if (i === 1) {
          // Middle glow more yellow
          r = 1; g = 0.9; b = 0.5;
        } else if (i === 2) {
          // Outer glow more orange
          r = 1; g = 0.7; b = 0.4;
        }
        
        gradient.addColorStop(0, `rgba(${Math.floor(r*255)}, ${Math.floor(g*255)}, ${Math.floor(b*255)}, 1)`);
        gradient.addColorStop(1, `rgba(${Math.floor(r*255)}, ${Math.floor(g*255)}, ${Math.floor(b*255)}, 0)`);
        
        glowContext.fillStyle = gradient;
        glowContext.fillRect(0, 0, 256, 256);
        
        const glowTexture = new THREE.CanvasTexture(glowCanvas);
        
        const glowMaterial = new THREE.SpriteMaterial({
          map: glowTexture,
          transparent: true,
          opacity: opacity,
          blending: THREE.AdditiveBlending,
          fog: false
        });
        
        const glow = new THREE.Sprite(glowMaterial);
        glow.position.copy(sunPosition);
        glow.scale.set(size, size, 1);
        
        scene.add(glow);
      }
    }
  });
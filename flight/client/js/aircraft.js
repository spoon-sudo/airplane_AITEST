class Aircraft {
    constructor(scene, isPlayer = false, color = 0x3498db) {
      this.scene = scene;
      this.isPlayer = isPlayer;
      this.mesh = null;
      this.speed = 20; // Start with some initial speed
      this.maxSpeed = 150; // Increased max speed
      this.minSpeed = 0;
      this.acceleration = 0.8; // Increased acceleration
      this.deceleration = 0.4; // Separate deceleration rate
      this.direction = new THREE.Vector3(0, 0, 1);
      
      // Health system
      this.maxHealth = 100;
      this.health = this.maxHealth;
      this.healthBar = null;
      this.isDestroyed = false;
      
      // Weapon system
      this.weapons = {
        cooldown: 0,
        maxCooldown: 10, // Frames between shots
        bulletSpeed: 200,
        damage: 10,
        range: 1000
      };
      
      // Adjusted rotation parameters for better control
      this.rotationSpeed = {
        pitch: 0.002, // Reduced from 0.025
        roll: 0.005,  // Reduced from 0.03
        yaw: 0.003    // Reduced from 0.015
      };
      
      // Add damping to make controls smoother
      this.damping = {
        pitch: 0.92,
        roll: 0.92,
        yaw: 0.85
      };
      
      this.angularVelocity = {
        pitch: 0,
        roll: 0,
        yaw: 0
      };
      
      this.position = new THREE.Vector3(0, 100, 0);
      this.rotation = new THREE.Euler(0, 0, 0);
      this.color = color;
      
      // Clock for delta time calculation
      this.clock = new THREE.Clock();
      this.lastTime = 0;
      
      this.createAircraft();
    }
    
    createAircraft() {
      // Create a simple aircraft model
      const fuselage = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 4, 8),
        new THREE.MeshPhongMaterial({ color: this.color })
      );
      fuselage.rotation.x = Math.PI / 2;
      
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.2, 1),
        new THREE.MeshPhongMaterial({ color: this.color })
      );
      wing.position.set(0, 0, 0);
      
      const tailWing = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.2, 0.6),
        new THREE.MeshPhongMaterial({ color: this.color })
      );
      tailWing.position.set(0, 0, -1.8);
      
      const tailFin = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 1, 0.8),
        new THREE.MeshPhongMaterial({ color: this.color })
      );
      tailFin.position.set(0, 0.5, -1.8);
      
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 1, 8),
        new THREE.MeshPhongMaterial({ color: this.color })
      );
      nose.rotation.x = -Math.PI / 2;
      nose.position.set(0, 0, 2.5);
      
      // Create a group to hold all parts
      this.mesh = new THREE.Group();
      this.mesh.add(fuselage);
      this.mesh.add(wing);
      this.mesh.add(tailWing);
      this.mesh.add(tailFin);
      this.mesh.add(nose);
      
      // Add a spotlight in front of the player's aircraft
      if (this.isPlayer) {
        const spotlight = new THREE.SpotLight(0xffffff, 1);
        spotlight.position.set(0, 0, 5);
        spotlight.target.position.set(0, 0, 10);
        spotlight.angle = Math.PI / 6;
        spotlight.penumbra = 0.2;
        spotlight.distance = 200;
        spotlight.castShadow = true;
        
        this.mesh.add(spotlight);
        this.mesh.add(spotlight.target);
      }
      
      // Add player name for all aircraft (both player and other players)
      const nameCanvas = document.createElement('canvas');
      const context = nameCanvas.getContext('2d');
      nameCanvas.width = 256;
      nameCanvas.height = 64;
      
      // Draw background for better visibility
      context.fillStyle = 'rgba(0, 0, 0, 0.5)';
      context.fillRect(0, 0, 256, 34);
      
      // Draw initial text
      context.font = 'bold 28px Arial';
      context.fillStyle = 'white';
      context.textAlign = 'center';
      context.fillText(this.isPlayer ? 'You' : 'Player', 128, 28);
      
      const nameTexture = new THREE.CanvasTexture(nameCanvas);
      const nameMaterial = new THREE.SpriteMaterial({ map: nameTexture });
      const nameSprite = new THREE.Sprite(nameMaterial);
      nameSprite.position.set(0, 3, 0); // Position above aircraft
      nameSprite.scale.set(10, 2.5, 1);
      
      this.nameSprite = nameSprite;
      this.mesh.add(nameSprite);
      
      // Set initial position
      this.mesh.position.copy(this.position);
      
      // Add to scene
      this.scene.add(this.mesh);
      
      // Create health bar
      this.createHealthBar();
    }
    
    createHealthBar() {
      // Create a canvas for the health bar
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 64;
      canvas.height = 8;
      
      // Create a sprite material with the canvas
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture });
      this.healthBar = new THREE.Sprite(material);
      
      // Position above aircraft
      this.healthBar.position.set(0, 3, 0);
      this.healthBar.scale.set(5, 0.5, 1);
      
      this.mesh.add(this.healthBar);
      
      // Initial render of health bar
      this.updateHealthBar();
    }
    
    updateHealthBar() {
      if (!this.healthBar) return;
      
      const canvas = this.healthBar.material.map.image;
      const context = canvas.getContext('2d');
      const healthPercent = this.health / this.maxHealth;
      
      // Clear the canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw the health background
      context.fillStyle = 'rgba(0, 0, 0, 0.5)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Choose color based on health percentage
      if (healthPercent > 0.6) {
        context.fillStyle = 'green';
      } else if (healthPercent > 0.3) {
        context.fillStyle = 'yellow';
      } else {
        context.fillStyle = 'red';
      }
      
      // Draw the health bar
      const barWidth = Math.max(0, healthPercent * canvas.width);
      context.fillRect(0, 0, barWidth, canvas.height);
      
      // Update the texture
      this.healthBar.material.map.needsUpdate = true;
    }
    
    takeDamage(amount) {
      if (this.isDestroyed) return;
      
      this.health -= amount;
      
      // Update health bar
      this.updateHealthBar();
      
      // Check if destroyed
      if (this.health <= 0) {
        this.health = 0;
        this.destroy();
      }
    }
    
    destroy() {
      if (this.isDestroyed) return;
      
      this.isDestroyed = true;
      
      // Create explosion effect
      this.createExplosion();
      
      // Hide aircraft but keep explosion visible for a moment
      this.mesh.visible = false;
      
      // Remove after explosion animation completes
      setTimeout(() => {
        this.remove();
      }, 2000);
    }
    
    createExplosion() {
      // Create particle system for explosion
      const particleCount = 100;
      const particles = new THREE.BufferGeometry();
      
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      const sizes = new Float32Array(particleCount);
      
      const color = new THREE.Color();
      
      for (let i = 0; i < particleCount; i++) {
        // Random position in sphere
        const x = (Math.random() - 0.5) * 5;
        const y = (Math.random() - 0.5) * 5;
        const z = (Math.random() - 0.5) * 5;
        
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        
        // Color based on position (red/orange/yellow)
        const colorValue = Math.random();
        if (colorValue < 0.4) {
          color.setRGB(1, 0.3, 0); // Orange
        } else if (colorValue < 0.7) {
          color.setRGB(1, 0.1, 0); // Red
        } else {
          color.setRGB(1, 0.8, 0); // Yellow
        }
        
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        
        // Random size
        sizes[i] = Math.random() * 2 + 1;
      }
      
      particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      
      const material = new THREE.PointsMaterial({
        size: 1,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      });
      
      const explosion = new THREE.Points(particles, material);
      explosion.position.copy(this.position);
      this.scene.add(explosion);
      
      // Animate explosion
      const animateExplosion = () => {
        if (!explosion) return;
        
        // Expand particles
        const positions = explosion.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i] *= 1.05;
          positions[i + 1] *= 1.05;
          positions[i + 2] *= 1.05;
        }
        explosion.geometry.attributes.position.needsUpdate = true;
        
        // Fade out
        material.opacity -= 0.02;
        
        if (material.opacity > 0) {
          requestAnimationFrame(animateExplosion);
        } else {
          this.scene.remove(explosion);
        }
      };
      
      animateExplosion();
    }
    
    shoot() {
      if (this.isDestroyed || this.weapons.cooldown > 0) return null;
      
      // Set cooldown
      this.weapons.cooldown = this.weapons.maxCooldown;
      
      // Calculate bullet spawn position (in front of aircraft)
      const bulletOffset = new THREE.Vector3(0, 0, 3).applyQuaternion(this.mesh.quaternion);
      const bulletPosition = this.position.clone().add(bulletOffset);
      
      // Create bullet
      const bullet = new Bullet(
        this.scene,
        bulletPosition,
        this.direction.clone(),
        this.weapons.bulletSpeed,
        this.weapons.damage,
        this.weapons.range,
        this
      );
      
      // Play sound effect
      this.playShootSound();
      
      return bullet;
    }
    
    playShootSound() {
      // Simple audio feedback for shooting
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRjQGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQwGAACAgICAgICAgICAgICAgICAgICAgIC9hzd/X1xLS0ZFRkeEgYmYIBkHAQEBAQEDCQ0XExEWGScyNkM6NDtKU1Z4cG1mZ2tyeXp+goOFioiAgICAgIB/gIB/gIB/gIB/gH+AgH+AgH+Af4CAf4B/gICAgH+AgICAgIB/gH+AgH+Af3+AgH9/f4CAf39/gIB/f39/gH9/f3+Af39/f4B/f39/gH9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gICAgIB/f39/f39/gICAgICAgACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgH+Af4B/gH+AgIB/gH+AgICAgIB/gICAgH+AgICAgH+AgICAgH+AgICAgH+AgICAgICAgH+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
      audio.volume = 0.3;
      audio.play();
    }
    
    update() {
      // Calculate delta time for frame-rate independent movement
      const delta = this.clock.getDelta();
      
      // Weapon cooldown update
      if (this.weapons.cooldown > 0) {
        this.weapons.cooldown--;
      }
      
      // Safety check for NaN values
      if (isNaN(this.position.x) || isNaN(this.position.y) || isNaN(this.position.z)) {
        console.warn("Found NaN in position, resetting to safe values");
        this.position.set(0, 100, 0);
      }
      
      if (isNaN(this.rotation.x) || isNaN(this.rotation.y) || isNaN(this.rotation.z)) {
        console.warn("Found NaN in rotation, resetting to safe values");
        this.rotation.set(0, 0, 0);
      }
      
      if (isNaN(this.speed)) {
        console.warn("Found NaN in speed, resetting to safe value");
        this.speed = 20;
      }
      
      // Apply damping to angular velocity
      this.angularVelocity.pitch *= this.damping.pitch;
      this.angularVelocity.roll *= this.damping.roll;
      this.angularVelocity.yaw *= this.damping.yaw;
      
      // Apply angular velocity to rotation
      this.rotation.x += this.angularVelocity.pitch;
      this.rotation.z += this.angularVelocity.roll;
      this.rotation.y += this.angularVelocity.yaw;
      
      // Auto-level when at high speed (subtle effect)
      if (this.speed > 40) {
        const levelStrength = Math.min(0.005, (this.speed - 40) * 0.0001);
        this.rotation.z *= (1 - levelStrength);
      }
      
      // Move forward based on current speed and delta time
      const movement = this.direction.clone().multiplyScalar(this.speed * delta * 1.5);
      this.position.add(movement);
      
      // Apply gravity if too slow (improved physics)
      if (this.speed < 30 && this.position.y > 0) {
        const gravityForce = Math.max(0, (30 - this.speed) * 0.02);
        this.position.y -= gravityForce * delta * 60;
      }
      
      // Natural speed decay
      if (this.speed > 0) {
        this.speed *= 0.995;
      }
      
      // Prevent going below ground
      if (this.position.y < 0) {
        this.position.y = 0;
        this.speed = Math.max(0, this.speed * 0.8); // More aggressive slowdown on ground contact
      }
      
      // Update mesh position and rotation
      this.mesh.position.copy(this.position);
      this.mesh.rotation.copy(this.rotation);
      
      // Update the direction vector based on rotation
      this.direction.set(0, 0, 1).applyEuler(this.rotation);
    }
    
    applyControls(controls) {
      // Simplified flight model with direct controls
      const speedFactor = 0.5 + (this.speed / this.maxSpeed) * 0.5;
      
      // Direct speed control from mouse wheel
      if (typeof controls.speed === 'number' && !isNaN(controls.speed)) {
        this.speed = controls.speed;
      } else {
        this.speed = 20; // Default speed if invalid
      }
      
      // Check if aircraft is inverted (upside down)
      const isInverted = Math.abs(this.rotation.z) > Math.PI/2;
      
      // Apply direct keyboard controls with inversion correction
      // When upside down, adjust control responses to maintain intuitive control
      
      // Apply pitch control (W/S keys)
      if (controls.pitch !== undefined) {
        // When inverted, reverse pitch control for more intuitive handling
        const pitchMultiplier = isInverted ? -0.8 : 1.0;
        this.angularVelocity.pitch += controls.pitch * this.rotationSpeed.pitch * speedFactor * pitchMultiplier;
      }
      
      // Apply yaw control (A/D keys)
      if (controls.yaw !== undefined) {
        // When inverted, yaw still works normally but reduce effectiveness
        const yawMultiplier = isInverted ? 0.7 : 1.0;
        this.angularVelocity.yaw += controls.yaw * this.rotationSpeed.yaw * speedFactor * yawMultiplier;
      }
      
      // Apply roll control (Q/E keys)
      if (controls.roll !== undefined) {
        // Roll control works the same whether inverted or not, but increase power when inverted
        // to help recover from inverted flight
        const rollMultiplier = isInverted ? 1.2 : 1.0;
        this.angularVelocity.roll += controls.roll * this.rotationSpeed.roll * speedFactor * rollMultiplier;
      }
      
      // Flight physics with improved behavior during inverted flight
      
      // 1. Prevent extreme pitch angles, but allow more freedom when deliberately rolling
      const maxPitchAngle = Math.PI * 0.45; // Slightly increased for more aerobatic capability
      if (Math.abs(this.rotation.x) > maxPitchAngle && Math.abs(controls.roll) < 0.1) {
        // Only apply corrective force if not actively rolling
        this.angularVelocity.pitch -= Math.sign(this.rotation.x) * 0.01 * speedFactor;
      }
      
      // 2. IMPROVED Ground avoidance (prevent crashing & prevent going upside down near ground)
      if (this.position.y < 100) {
        // Calculate how close we are to the ground (0-1 range, 1 is on the ground)
        const groundProximity = Math.max(0, 1 - (this.position.y / 100));
        
        // Only apply pull-up force if we're diving toward the ground
        if (this.direction.y < 0) {
          // Stronger pull-up force the closer we are to ground
          const pullUpForce = groundProximity * 0.002 * Math.abs(this.direction.y) * 20;
          this.angularVelocity.pitch -= pullUpForce * speedFactor;
        }
        
        // Apply stronger auto-level near ground to prevent upside-down flight
        if (Math.abs(this.rotation.z) > 0.3) {
          // The closer to the ground, the stronger the correction
          const levelForce = groundProximity * 0.02;
          this.angularVelocity.roll -= this.rotation.z * levelForce * speedFactor;
        }
      }
      
      // 3. Very gentle auto-level roll when not actively controlling
      if (Math.abs(controls.roll) < 0.1) {
        // Less auto-leveling at higher altitudes to allow aerobatics
        const heightFactor = Math.min(1, 100 / Math.max(10, this.position.y));
        const levelStrength = 0.003 + (heightFactor * 0.004); // Stronger near ground
        
        // Apply level correction (stronger near ground, gentler at altitude)
        this.angularVelocity.roll -= this.rotation.z * levelStrength * speedFactor;
      }
    }
    
    getPosition() {
      return {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      };
    }
    
    getRotation() {
      return {
        x: this.rotation.x,
        y: this.rotation.y,
        z: this.rotation.z
      };
    }
    
    setPosition(position) {
      this.position.set(position.x, position.y, position.z);
    }
    
    setRotation(rotation) {
      this.rotation.set(rotation.x, rotation.y, rotation.z);
    }
    
    remove() {
      if (this.mesh) {
        this.scene.remove(this.mesh);
      }
    }
    
    updateName(name) {
      if (this.nameSprite) {
        const canvas = this.nameSprite.material.map.image;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, 256, 64);
        
        // Draw background for better visibility
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, 256, 34);
        
        // Draw text with larger font and better visibility
        context.font = 'bold 28px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        
        // For player's own aircraft, show "You (name)"
        if (this.isPlayer) {
          context.fillText(`You (${name || 'Unknown'})`, 128, 28);
        } else {
          context.fillText(name || 'Unknown', 128, 28);
        }
        
        // Update the texture
        this.nameSprite.material.map.needsUpdate = true;
        
        // Store the player name
        this.playerName = name;
      }
    }
  }
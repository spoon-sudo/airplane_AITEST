class Bullet {
  constructor(scene, position, direction, speed, damage, range, owner) {
    this.scene = scene;
    this.position = position;
    this.direction = direction;
    this.speed = speed;
    this.damage = damage;
    this.range = range;
    this.owner = owner; // Which aircraft fired this bullet
    this.distanceTraveled = 0;
    
    // Create bullet mesh
    this.createBullet();
    
    // Add to scene
    this.scene.add(this.mesh);
  }
  
  createBullet() {
    // Create a simple bullet (small, bright, elongated sphere)
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 1
    });
    this.mesh = new THREE.Mesh(geometry, material);
    
    // Position at starting point
    this.mesh.position.copy(this.position);
    
    // Add a trail effect
    this.createTrail();
  }
  
  createTrail() {
    // Create a trail behind the bullet
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.7
    });
    
    // Trail points
    const positions = new Float32Array(6); // 2 points * 3 coordinates
    positions[0] = this.position.x;
    positions[1] = this.position.y;
    positions[2] = this.position.z;
    positions[3] = this.position.x - this.direction.x;
    positions[4] = this.position.y - this.direction.y;
    positions[5] = this.position.z - this.direction.z;
    
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.trail = new THREE.Line(trailGeometry, trailMaterial);
    this.scene.add(this.trail);
  }
  
  update(delta) {
    // Move forward
    const moveAmount = this.speed * delta;
    this.distanceTraveled += moveAmount;
    
    const movement = this.direction.clone().multiplyScalar(moveAmount);
    this.position.add(movement);
    this.mesh.position.copy(this.position);
    
    // Update trail
    const positions = this.trail.geometry.attributes.position.array;
    positions[0] = this.position.x;
    positions[1] = this.position.y;
    positions[2] = this.position.z;
    positions[3] = this.position.x - this.direction.x * 2;
    positions[4] = this.position.y - this.direction.y * 2;
    positions[5] = this.position.z - this.direction.z * 2;
    this.trail.geometry.attributes.position.needsUpdate = true;
    
    // Check if bullet has reached its range
    if (this.distanceTraveled >= this.range) {
      this.remove();
      return false;
    }
    
    return true; // Bullet is still active
  }
  
  checkCollision(aircraft) {
    // Skip collision with the owner of the bullet
    if (aircraft === this.owner || aircraft.isDestroyed) return false;
    
    // Simple distance-based collision detection
    const distance = this.position.distanceTo(aircraft.position);
    
    if (distance < 3) { // Collision radius
      // Apply damage
      aircraft.takeDamage(this.damage);
      
      // Remove bullet
      this.remove();
      return true;
    }
    
    return false;
  }
  
  
  remove() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
    
    if (this.trail) {
      this.scene.remove(this.trail);
      this.trail = null;
    }
  }
}
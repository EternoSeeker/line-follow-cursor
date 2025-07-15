const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const cursor = document.getElementById("cursor");
const instruction = document.getElementById("instruction");

// Color palette
const COLORS = ["#25CED1", "#9C95DC", "#ABDF75", "#FF8A5B", "#EA526F"];

// Game state
let points = [];
let pendingPoints = [];
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let lastMouseX = mouseX;
let lastMouseY = mouseY;
let mouseStillTime = 0;
let hasStarted = false;

// Settings
const MAX_POINTS = 6;
const SPEED = 2;
const LIFETIME_SECONDS = 2;
const POINT_RADIUS = 2;
const GLOW_RADIUS = 100;

// Constants
const MOUSE_STILL_THRESHOLD = 700; // ms before considering mouse still
const SPAWN_DELAY_MIN = 100; // ms
const SPAWN_DELAY_MAX = 2000; // ms
const MOUSE_MOVE_THRESHOLD = 5; // pixels
const MAX_TRAIL_LENGTH = 100;
const TRAIL_ALPHA = 0.8;

// Canvas setup
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Cached gradients for performance
const gradientCache = new Map();

function getGradient(color, x, y) {
  const key = `${color}-${x}-${y}`;
  if (!gradientCache.has(key)) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, GLOW_RADIUS);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color + "00");
    gradientCache.set(key, gradient);
  }
  return gradientCache.get(key);
}

// Pending point class for delayed spawning
class PendingPoint {
  constructor(delay) {
    this.delay = delay;
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
  }

  update(deltaTime) {
    this.delay -= deltaTime;
    return this.delay <= 0;
  }

  createPoint() {
    return new Point(this.x, this.y);
  }
}

// Point class
class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = mouseX;
    this.targetY = mouseY;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.lifetime = LIFETIME_SECONDS * 1000; // Convert to milliseconds
    this.maxLifetime = this.lifetime;
    this.trail = [];
    this.directionChangeTimer = 500;
    this.where = Math.random() > 0.5;
  }

  update(deltaTime) {
    // Check if mouse is still
    const mouseDistance = Math.sqrt(
      (mouseX - lastMouseX) ** 2 + (mouseY - lastMouseY) ** 2
    );
    const isMouseStill =
      mouseDistance < MOUSE_MOVE_THRESHOLD &&
      mouseStillTime > MOUSE_STILL_THRESHOLD;

    // Update target only if mouse moved significantly or after still time
    if (!isMouseStill || this.directionChangeTimer > MOUSE_STILL_THRESHOLD) {
      this.targetX = mouseX;
      this.targetY = mouseY;
      this.directionChangeTimer = 0;
    } else {
      this.directionChangeTimer += deltaTime;
    }

    // Calculate distance to target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 1) {
      // Calculate optimal movement (straight lines or 45-degree angles)
      let moveX = 0;
      let moveY = 0;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx > absDy) {
        // Primarily horizontal movement
        moveX = Math.sign(dx) * SPEED;
        if (this.where) {
          if (absDx == absDy) {
            moveY = Math.sign(dy) * SPEED;
          }
        } else {
          moveY = Math.sign(dy) * SPEED;
        }
      } else {
        // Primarily vertical movement
        moveY = Math.sign(dy) * SPEED;
        if (this.where) {
          if (absDx == absDy) {
            moveX = Math.sign(dx) * SPEED;
          }
        } else {
          moveX = Math.sign(dx) * SPEED;
        }
      }

      // Apply movement
      this.x += moveX;
      this.y += moveY;

      // Add to trail
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > MAX_TRAIL_LENGTH) {
        this.trail.shift();
      }
    }

    // Update lifetime
    this.lifetime -= deltaTime;

    return this.lifetime > 0;
  }

  draw() {
    const alpha = Math.max(0.1, this.lifetime / this.maxLifetime);

    // Draw trail
    if (this.trail.length > 1) {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;

      for (let i = 1; i < this.trail.length; i++) {
        const trailAlpha = (i / this.trail.length) * alpha * TRAIL_ALPHA;
        ctx.globalAlpha = trailAlpha;
        ctx.beginPath();
        ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
        ctx.stroke();
      }
    }

    // Draw point
    ctx.globalAlpha = alpha;
    ctx.fillStyle = getGradient(this.color, this.x, this.y);
    ctx.beginPath();
    ctx.arc(this.x, this.y, POINT_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Reset alpha
    ctx.globalAlpha = 1;
  }
}

// Create pending point with random delay
function createPendingPoint() {
  const delay =
    SPAWN_DELAY_MIN + Math.random() * (SPAWN_DELAY_MAX - SPAWN_DELAY_MIN);
  return new PendingPoint(delay);
}

// Initialize points
function initializePoints() {
  pendingPoints = [];
  for (let i = 0; i < MAX_POINTS; i++) {
    pendingPoints.push(createPendingPoint());
  }
}

// Mouse events
document.addEventListener("mousemove", (e) => {
  lastMouseX = mouseX;
  lastMouseY = mouseY;
  mouseX = e.clientX;
  mouseY = e.clientY;

  // Reset mouse still timer if mouse moved
  const mouseDistance = Math.sqrt(
    (mouseX - lastMouseX) ** 2 + (mouseY - lastMouseY) ** 2
  );
  if (mouseDistance > MOUSE_MOVE_THRESHOLD) {
    mouseStillTime = 0;
  }

  // Update cursor position
  cursor.style.left = mouseX + "px";
  cursor.style.top = mouseY + "px";

  // Start the animation on first mouse move
  if (!hasStarted) {
    hasStarted = true;
    instruction.classList.add("hide");
    initializePoints();
  }
});

// Animation loop
let lastTime = 0;
function animate(currentTime) {
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;

  // Update mouse still timer
  mouseStillTime += deltaTime;

  // Clear canvas efficiently
  ctx.fillStyle = "#03001a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (hasStarted) {
    // Update pending points and spawn new ones
    pendingPoints = pendingPoints.filter((pendingPoint) => {
      if (pendingPoint.update(deltaTime)) {
        points.push(pendingPoint.createPoint());
        return false; // Remove from pending
      }
      return true; // Keep in pending
    });

    // Update active points
    points = points.filter((point) => point.update(deltaTime));

    // Maintain correct number of points
    const totalPoints = points.length + pendingPoints.length;
    if (totalPoints < MAX_POINTS) {
      pendingPoints.push(createPendingPoint());
    }

    // Draw points
    points.forEach((point) => point.draw());

    // Clear gradient cache occasionally to prevent memory leaks
    if (gradientCache.size > 1000) {
      gradientCache.clear();
    }
  }

  requestAnimationFrame(animate);
}

// Initialize cursor position
cursor.style.left = mouseX + "px";
cursor.style.top = mouseY + "px";

// Start animation
requestAnimationFrame(animate);

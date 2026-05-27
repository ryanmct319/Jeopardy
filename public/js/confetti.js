// Confetti particle system
const Confetti = (() => {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animFrame = null;
  let running = false;

  const COLORS = [
    '#FF2D9B', '#FFD700', '#00FF88', '#00EEFF',
    '#FF6B00', '#C77DFF', '#FF6B6B', '#4ECDC4'
  ];
  const SHAPES = ['circle', 'square', 'star', 'heart'];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resize);
  resize();

  function createParticle(x, y, spread) {
    const angle = Math.random() * Math.PI * 2;
    const speed = spread * (0.3 + Math.random() * 0.7);
    return {
      x: x || canvas.width / 2,
      y: y || canvas.height / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (spread * 0.5),
      gravity: 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      size: 8 + Math.random() * 12,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
      alpha: 1,
      decay: 0.015 + Math.random() * 0.01
    };
  }

  function drawStar(ctx, x, y, size) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? size : size * 0.4;
      ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawHeart(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.25);
    ctx.bezierCurveTo(x, y - size * 0.25, x - size, y - size * 0.25, x - size, y + size * 0.25);
    ctx.bezierCurveTo(x - size, y + size * 0.75, x, y + size * 1.25, x, y + size * 1.5);
    ctx.bezierCurveTo(x, y + size * 1.25, x + size, y + size * 0.75, x + size, y + size * 0.25);
    ctx.bezierCurveTo(x + size, y - size * 0.25, x, y - size * 0.25, x, y + size * 0.25);
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.alpha > 0);

    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'square') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else if (p.shape === 'star') {
        drawStar(ctx, 0, 0, p.size / 2);
      } else if (p.shape === 'heart') {
        ctx.scale(0.5, 0.5);
        drawHeart(ctx, 0, -p.size / 2, p.size / 4);
      }

      ctx.restore();

      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
      p.alpha -= p.decay;
    }
  }

  function loop() {
    draw();
    if (particles.length > 0) {
      animFrame = requestAnimationFrame(loop);
    } else {
      running = false;
    }
  }

  function burst(x, y, count = 80, spread = 18) {
    for (let i = 0; i < count; i++) {
      particles.push(createParticle(x, y, spread));
    }
    if (!running) {
      running = true;
      loop();
    }
  }

  function rain(duration = 3000) {
    const interval = setInterval(() => {
      for (let i = 0; i < 5; i++) {
        particles.push(createParticle(
          Math.random() * canvas.width,
          -20,
          8
        ));
      }
    }, 100);
    setTimeout(() => clearInterval(interval), duration);
    if (!running) {
      running = true;
      loop();
    }
  }

  function megaBurst() {
    // Burst from multiple points
    burst(canvas.width / 2, canvas.height / 3, 150, 25);
    setTimeout(() => burst(canvas.width * 0.25, canvas.height / 2, 80, 20), 200);
    setTimeout(() => burst(canvas.width * 0.75, canvas.height / 2, 80, 20), 400);
    setTimeout(() => burst(canvas.width / 2, canvas.height * 0.6, 100, 22), 600);
  }

  return { burst, rain, megaBurst };
})();

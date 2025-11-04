// game.js
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const hudTime = document.getElementById("hudTime");
const hudScore = document.getElementById("hudScore");
const updateMsg = document.getElementById("updateMsg");
const btnStart = document.getElementById("btnStart");

let game = null;

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
fitCanvas();
addEventListener("resize", fitCanvas);

btnStart.addEventListener("click", startGame);

function startGame() {
  fitCanvas();
  game = { playerX: canvas.width / 2, score: 0, balls: [], time: 15, running: true, start: performance.now() };
  updateMsg.textContent = "¡Atrapa los círculos!";
  requestAnimationFrame(loop);
}

function loop() {
  if (!game?.running) return;
  const now = performance.now();
  const elapsed = (now - game.start) / 1000;
  game.time = Math.max(0, 15 - elapsed);
  if (game.time <= 0) return endGame();
  if (Math.random() < 0.04) spawnBall();

  update(); draw();
  requestAnimationFrame(loop);
}

function spawnBall() {
  const x = Math.random() * canvas.width;
  game.balls.push({ x, y: 0, r: 10, vy: 3 + Math.random() * 2 });
}

function update() {
  game.balls.forEach(b => b.y += b.vy);
  const playerY = canvas.height - 30;
  game.balls = game.balls.filter(b => {
    const hit = Math.abs(b.x - game.playerX) < 25 && Math.abs(b.y - playerY) < 20;
    if (hit) game.score += 10;
    return b.y < canvas.height && !hit;
  });
  hudTime.textContent = game.time.toFixed(1);
  hudScore.textContent = game.score;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#eef3f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0077cc";
  game.balls.forEach(b => {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = "#444";
  ctx.fillRect(game.playerX - 25, canvas.height - 30, 50, 12);
}

document.addEventListener("keydown", (e) => {
  if (!game?.running) return;
  if (e.key === "ArrowLeft") game.playerX -= 30;
  if (e.key === "ArrowRight") game.playerX += 30;
});

async function endGame() {
  game.running = false;
  updateMsg.textContent = `Juego terminado. Puntaje: ${game.score}`;
  if (window.sendScoreToFirebase) {
    await window.sendScoreToFirebase(game.score);
  }
}
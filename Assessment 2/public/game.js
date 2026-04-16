//---- Tower Defense Main Code ----

(() => {
  // ---- Layout & global offsets (top-left of grid) ----
  let mapOffsetX = 0;
  let mapOffsetY = 0;

  // ---- Canvas setup ----
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // ---- UI elements ----
  const ui = {
    gold: document.getElementById("gold"),
    lives: document.getElementById("lives"),
    wave: document.getElementById("wave"),
    score: document.getElementById("score"),
    startBtn: document.getElementById("startBtn"),
    selArrow: document.getElementById("selArrow"),
    selFrost: document.getElementById("selFrost"),
    selBomb: document.getElementById("selBomb"),
    upgradeBtn: document.getElementById("upgradeBtn"),
    sellBtn: document.getElementById("sellBtn"),
    leaderboard: document.getElementById("leaderboard"),
    playerName: document.getElementById("playerName"),
    submitBtn: document.getElementById("submitBtn")
  };

  // Basic level grid
  // 1 = walkable (road), 0 = blocked (tower), S = starting point, E = End Point
  const MAP = [
    "0000S0000000",
    "000010000000",
    "000011111100",
    "000000000100",
    "000011111100",
    "000010000000",
    "000011111000",
    "000000001000",
    "011111111000",
    "010000000000",
    "010000000000",
    "010000000000",
    "010000000000",
    "011110000000",
    "000011000000",
    "00000E000000",
  ];

  // Game config and state
  const tileSize = 36;
  const gridRows = MAP.length;
  const gridCols = MAP[0].length;
  const mapW = gridCols * tileSize;
  const mapH = gridRows * tileSize;

  // First state the game starts
  const state = {
    gold: 120,
    lives: 10,
    wave: 0,
    maxWaves: 20,
    enemiesPerWave: 8,
    enemiesSpawnedThisWave: 0,
    score: 0,
    selectedTowerType: "A", // A or F
    selectedPlacedTower: null,
    gameRunning: true,
    lastTime: performance.now(),
    elapsed: 0,
    enemySpawnCooldown: 0
  };

  const RAW_MAP = [
  "0000S0000000",
  "000010000000",
  "000011111100",
  "000000000100",
  "000011111100",
  "000010000000",
  "000011111000",
  "000000001000",
  "011111111000",
  "010000000000",
  "010000000000",
  "010000000000",
  "010000000000",
  "011110000000",
  "000011000000",
  "00000E000000",
  ];
  
  const grid = [];
  let pathStart = null;
  let pathEnd = null;

  // Let pathfinding logic apply to the raw map
  for (let y = 0; y < RAW_MAP.length; y++) {
    grid[y] = [];
    for (let x = 0; x < RAW_MAP[y].length; x++) {
      const ch = RAW_MAP[y][x];

      if (ch === "S") {
        pathStart = { x, y };
        grid[y][x] = 1; // walkable
      } else if (ch === "E") {
        pathEnd = { x, y };
        grid[y][x] = 1; // walkable
      } else if (ch === "1") {
        grid[y][x] = 1; // walkable
      } else {
        grid[y][x] = 0; // blocked
      }
    }
  }
  //Checks if there are no Start or End path
  if (!pathStart || !pathEnd) {
    throw new Error("MAP must contain S and E");
  }

  const TILE_PATH = findPath(
  pathStart.x,
  pathStart.y,
  pathEnd.x,
  pathEnd.y
  );

  // Error checking for path
  console.assert(
  TILE_PATH.length > 0,
  "MAP HAS NO VALID PATH",
  TILE_PATH
  );

  // Data Containers
  const towers = []; // {tx,ty,x,y,type,level,lastShot,damage,rate,range,slow,radius}
  const enemies = []; // {x,y,hp,maxHp,speed,path,pathIndex,slowUntil}
  const projectiles = []; // {x,y,dx,dy,type,born,life,damage,owner}
  const explosions = [];  // { x, y, radius, born }

  // Tower & Enemy Configs, Stats, & Upgrades
  const towerConfig = {
    A: { cost: 50, baseDamage: 2.25, baseRate: 700, baseRange: 4.75 }, // Arrow
    F: { cost: 30, baseDamage: 2.0, baseRate: 1000, baseRange: 3.75, slow: 0.5 }, // Frost
    B: { cost: 60, baseDamage: 1.5, baseRate: 1200, baseRange: 3.5, radius: 2.0 } // Bomb
  };
  const upgrades = {
    A: [
      { cost: 60, damageMult: 2, rateMult: 0.85, rangeAdd: 0.5 },
      { cost: 70, damageMult: 3, rateMult: 0.7, rangeAdd: 1.0 }
    ],
    F: [
      { cost: 50, slowMult: 1.15, rangeAdd: 0.6 },
      { cost: 100, slowMult: 1.3, rangeAdd: 1.0 }
    ],
    B: [
      { cost: 80, damageMult: 0.75, radiusMult: 0.25, rangeAdd: 0.5 },
      { cost: 120, damageMult: 1.5, radiusMult: 0.5, rangeAdd: 1.0 }
    ]
  };
  const ENEMY_TYPES = {
    basic: { hp: 1.0, speed: 1.0, reward: 10 },
    fast: { hp: 0.6, speed: 1.6, reward: 12 },
    tank: { hp: 3.0, speed: 0.6, reward: 25 },
    immune: { hp: 1.5, speed: 1.0, slowImmune: true }
  };


  // ---------------- PATHFINDING (A*) ----------------
  function findPath(sx, sy, tx, ty) {
    const start = [sx, sy];
    const goal = [tx, ty];

    const open = [start];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const key = (n) => `${n[0]},${n[1]}`;

    gScore.set(key(start), 0);
    fScore.set(key(start), heuristic(start, goal));

    function heuristic(a, b) {
      return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    }

    function neighborsOf([x, y]) {
      const res = [];
      if (x > 0 && grid[y][x - 1] === 1) res.push([x - 1, y]);
      if (x < gridCols - 1 && grid[y][x + 1] === 1) res.push([x + 1, y]);
      if (y > 0 && grid[y - 1][x] === 1) res.push([x, y - 1]);
      if (y < gridRows - 1 && grid[y + 1][x] === 1) res.push([x, y + 1]);
      return res;
    }

    while (open.length > 0) {
      open.sort((a, b) => fScore.get(key(a)) - fScore.get(key(b)));
      const current = open.shift();

      if (current[0] === goal[0] && current[1] === goal[1]) {
        const path = [current];
        let curKey = key(current);

        while (cameFrom.has(curKey)) {
          const prev = cameFrom.get(curKey);
          path.unshift(prev);
          curKey = key(prev);
        }
        return path;
      }

      for (const neighbor of neighborsOf(current)) {
        const tentativeG =
          gScore.get(key(current)) + 1;

        const nKey = key(neighbor);
        if (!gScore.has(nKey) || tentativeG < gScore.get(nKey)) {
          cameFrom.set(nKey, current);
          gScore.set(nKey, tentativeG);
          fScore.set(nKey, tentativeG + heuristic(neighbor, goal));

          if (!open.some(n => n[0] === neighbor[0] && n[1] === neighbor[1])) {
            open.push(neighbor);
          }
        }
      }
    }

    return [];
  }

  function drawPathDebug() {
  if (!TILE_PATH || TILE_PATH.length === 0) return;

  ctx.save();
  ctx.strokeStyle = "rgba(0,255,0,0.6)";
  ctx.lineWidth = 4;
  ctx.beginPath();

  TILE_PATH.forEach(([x, y], i) => {
    const px = mapOffsetX + x * tileSize + tileSize / 2;
    const py = mapOffsetY + y * tileSize + tileSize / 2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });

  ctx.stroke();
  ctx.restore();
  }

  // Convert grid path into absolute pixel path (center of tiles)
  function computePixelPath(tilePath) {
    if (!tilePath) return [];
    return tilePath.map(([cx, cy]) => {
      return {
        x: mapOffsetX + cx * tileSize + tileSize / 2,
        y: mapOffsetY + cy * tileSize + tileSize / 2
      };
    });
  }

  // ---------------- UI & leaderboard ----------------
  function refreshUI() {
    ui.gold.textContent = Math.floor(state.gold);
    ui.lives.textContent = Math.max(0, Math.floor(state.lives));
    ui.wave.textContent = state.wave + "/" + state.maxWaves;
    ui.score.textContent = Math.floor(state.score);
  }

  async function loadLeaderboard() {
    try {
      const res = await fetch("/api/scores");
      const data = await res.json();
      
      ui.leaderboard.innerHTML = ""; 

      data.forEach((it) => {
        const li = document.createElement("li");
        li.textContent = `${it.name} — ${it.score}`;
        ui.leaderboard.appendChild(li);
      });
    } catch (err) {
      console.warn("Failed fetch leaderboard", err);
    }
  }
  loadLeaderboard();

  // ---------------- SPAWN ----------------
  function spawnEnemy() {
    if (!TILE_PATH || TILE_PATH.length < 2) return;

    let type = "basic";

    // --- Early Game: Single Type Waves ---
    if (state.wave <= 3) {
        type = "basic"; // Waves 1-3: Just basics
    } else if (state.wave <= 6) {
        type = "fast";  // Waves 4-6: Fast enemies only (Test Frost Towers)
    } else if (state.wave <= 9) {
        type = "tank";  // Waves 7-9: Tanks only (Test Bomb Towers)
    } else {
        // --- Mid to Late Game: Mixed Waves ---
        const types = ["basic", "fast", "tank"];
        type = types[Math.floor(Math.random() * types.length)];
        
        // Every 5th wave after 10 is a "Tank Rush"
        if (state.wave % 5 === 0) type = "tank";
    }

    const def = ENEMY_TYPES[type];
    const scalingFactor = Math.pow(1.15, state.wave);
    const maxHp = Math.round(10 * def.hp * scalingFactor);

    const enemy = {
        tilePath: TILE_PATH,
        pathIndex: 0,
        progress: 0,
        speed: def.speed * (0.9 + (state.wave * 0.02)), // Slowly get faster
        hp: maxHp,
        maxHp: maxHp,
        slowUntil: 0,
        type: type,
        reward: def.reward,
        slowImmune: def.slowImmune || false,
        x: 0, y: 0
    };

    enemies.push(enemy);
    state.enemiesSpawnedThisWave++;
  }

  function spawnBoss() {
    const maxHp = 120 + state.wave * 40;

    enemies.push({
      tilePath: TILE_PATH,
      pathIndex: 0,
      progress: 0,
      speed: 0.4,
      hp: maxHp,
      maxHp,
      slowUntil: 0,
      boss: true,
      reward: 200,
      x: 0,
      y: 0
    });
  }

  function killEnemy(index) {
    const e = enemies[index];
    if (!e) return;

    state.gold += e.reward || 10;
    state.score += Math.floor(e.maxHp);

    // Clear any tower targeting this enemy
    for (const t of towers) {
      if (t.target === e) {
        t.target = null;
      }
    }

    enemies.splice(index, 1);
  }

  // ---------------- TOWERS ----------------
  function nearestEnemy(tx, ty, rangeTiles) {
    let best = null;
    let bestD = Infinity;
    const rangePx = rangeTiles * tileSize;

    for (const e of enemies) {
      // Ignore enemies not yet placed on path
      if (e.pathIndex === 0 && e.progress === 0 && e.x === 0 && e.y === 0) {
        continue;
      }

      const dx = e.x - tx;
      const dy = e.y - ty;
      const d = Math.hypot(dx, dy);

      if (d <= rangePx && d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  function bestEnemyTowardExit(tower) {
    let best = null;
    let bestScore = -Infinity;
    const rangePx = tower.range * tileSize;

    for (const e of enemies) {
      if (e.hp <= 0) continue;

      const dx = e.x - tower.x;
      const dy = e.y - tower.y;
      if (dx*dx + dy*dy > rangePx * rangePx) continue;

      const score = e.pathIndex + e.progress;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  function enemyInRange(t, e) {
    const dx = e.x - t.x;
    const dy = e.y - t.y;
    return dx*dx + dy*dy <= (t.range * tileSize) ** 2;
  }


  function placeTowerAt(tileX, tileY) {
    if (grid[tileY] && grid[tileY][tileX] === 1) return false;
    for (const t of towers) if (t.tx === tileX && t.ty === tileY) return false;

    const cfg = towerConfig[state.selectedTowerType];
    if (state.gold < cfg.cost) return false;

    const tower = {
      tx: tileX,
      ty: tileY,
      x: mapOffsetX + tileX * tileSize + tileSize / 2,
      y: mapOffsetY + tileY * tileSize + tileSize / 2,
      type: state.selectedTowerType,
      level: 1,
      lastShot: 0,
      damage: cfg.baseDamage || 1,
      rate: cfg.baseRate,
      range: cfg.baseRange || 4,
      radius: cfg.radius || 0,
      slow: cfg.slow || 0.5,
      target: null,
      rotation: 0
    };
    state.gold -= cfg.cost;
    towers.push(tower);
    return true;
  }

  function explode(x, y, radius, damage) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const dx = e.x - x;
      const dy = e.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        const falloff = 1 - dist / radius;
        e.hp -= damage * Math.max(0.3, falloff);

        if (e.hp <= 0) {
          killEnemy(i);
        }
      }
    }

    explosions.push({
      x,
      y,
      damageRadius: radius,                   
      visualRadius: Math.min(radius * 0.6, 90), 
      born: performance.now()
    });
  }

  function sellTower(tower) {
    const baseCost = towerConfig[tower.type].cost;
    const upgradeCost = (tower.level > 1 && upgrades[tower.type] && upgrades[tower.type][tower.level-2]) ? upgrades[tower.type][tower.level-2].cost : 0;
    const refund = Math.round((baseCost + upgradeCost) * 0.6);
    state.gold += refund;
    const idx = towers.indexOf(tower);
    if (idx >= 0) towers.splice(idx,1);
    state.selectedPlacedTower = null;
    ui.upgradeBtn.style.display = "none";
    ui.sellBtn.style.display = "none";
  }

  function upgradeTower(tower) {
    const arr = upgrades[tower.type];
    if (!arr) return;
    const lvl = tower.level;
    if (lvl >= 3) return;
    const cost = arr[lvl-1].cost;
    if (state.gold < cost) return;
    state.gold -= cost;
    tower.level++;
    if (tower.type === "A") {
      tower.damage *= arr[lvl-1].damageMult || 1;
      tower.rate = Math.max(80, Math.round(tower.rate * (arr[lvl-1].rateMult || 1)));
      tower.range += arr[lvl-1].rangeAdd || 0;
    }if (tower.type === "B") {
      tower.damage *= arr[lvl-1].damageMult || 1;
      tower.radius = Math.max(80, Math.round(tower.radius * (arr[lvl-1].radiusMult || 1)));
      tower.range += arr[lvl-1].rangeAdd || 0;
    } else {
      tower.slow *= arr[lvl-1].slowMult || 1;
      tower.range += arr[lvl-1].rangeAdd || 0;
    }
  }

  // ---------------- UPDATES ----------------
  function updateTowers(dt, now) {
    for (const t of towers) {

      // Validate or acquire target (FIRST / closest-to-exit)
      if (!t.target || 
          t.target.hp <= 0 || 
          !enemies.includes(t.target) || 
          !enemyInRange(t, t.target)
        ) {
        t.target = bestEnemyTowardExit(t);
      }

      if (!t.target) continue;

      // Rotate tower toward target
      const dx = t.target.x - t.x;
      const dy = t.target.y - t.y;
      t.rotation = Math.atan2(dy, dx);

      // Fire rate
      if (now - t.lastShot < t.rate) continue;
      t.lastShot = now;

      let speed = 5;
      if (t.type === "A") speed = 10;
      if (t.type === "F") speed = 6;
      if (t.type === "B") speed = 5;

      projectiles.push({
        x: t.x,
        y: t.y,
        dx: Math.cos(t.rotation) * speed,
        dy: Math.sin(t.rotation) * speed,
        life: 1800,
        born: now,
        type: t.type,
        damage: t.damage,
        radius: (t.radius || 1.5) * tileSize,
        owner: t
      });
    }
  }

  function updateProjectiles(dt, now) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];

      p.x += p.dx;
      p.y += p.dy;

      if (!p.owner || !p.owner.x) {
        projectiles.splice(i, 1);
        continue;
      }

      if (now - p.born > p.life) {
        projectiles.splice(i, 1);
        continue;
      }

      let hit = false;

      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d2 = dx * dx + dy * dy;

        // ---------- ARROW ----------
        if (p.type === "A" && d2 < 18 * 18) {
          e.hp -= p.damage;
          hit = true;
        }

        // ---------- FROST ----------
        else if (p.type === "F" && d2 < 20 * 20) {
          e.hp -= p.damage;
          if (!e.slowImmune) e.slowUntil = now + 1200;
          hit = true;
        }

        // ---------- BOMB ----------
        else if (p.type === "B" && d2 < 22 * 22) {
          explode(p.x, p.y, p.radius, p.damage);
          hit = true;
        }

        if (hit) break;
      }

      if (hit) {
        projectiles.splice(i, 1);
      }
    }
  }

  function leadTarget(tower, enemy, projectileSpeed) {
    const dx = enemy.x - tower.x;
    const dy = enemy.y - tower.y;

    // approximate enemy velocity
    const next = enemy.tilePath[enemy.pathIndex + 1];
    if (!next) return { x: enemy.x, y: enemy.y };

    const nx = mapOffsetX + next[0] * tileSize + tileSize / 2;
    const ny = mapOffsetY + next[1] * tileSize + tileSize / 2;

    const evx = nx - enemy.x;
    const evy = ny - enemy.y;

    const t = Math.hypot(dx, dy) / projectileSpeed;

    return {
      x: enemy.x + evx * t,
      y: enemy.y + evy * t
    };
  }


  function drawExplosions(now) {
    for (let i = explosions.length - 1; i >= 0; i--) {
      const ex = explosions[i];
      const age = now - ex.born;

      if (age > 280) {
        explosions.splice(i, 1);
        continue;
      }

      const t = age / 280;
      const ease = t * (2 - t); // easeOutQuad

      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,140,0,${1 - t})`;
      ctx.lineWidth = 3;
      ctx.arc(
        ex.x,
        ex.y,
        ex.visualRadius * ease,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  }

  function updateEnemies(dt, now) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      if (e.hp <= 0) {
        killEnemy(i);
        continue;
      }

      let speedMult = e.slowUntil > now ? 0.45 : 1;
      const step = e.speed * speedMult * (dt / 16);

      e.progress += step / tileSize;

      while (e.progress >= 1) {
        e.progress -= 1;
        e.pathIndex++;
        pathScore = e.pathIndex + e.progress


        if (e.pathIndex >= e.tilePath.length - 1) {
          state.lives--;
          if (state.lives <= 0) {
              state.lives = 0;
              state.gameRunning = false;
          }
          killEnemy(i);
          continue;
        }
      }

      const a = e.tilePath[e.pathIndex];
      const b = e.tilePath[e.pathIndex + 1];

      const ax = mapOffsetX + a[0] * tileSize + tileSize / 2;
      const ay = mapOffsetY + a[1] * tileSize + tileSize / 2;
      const bx = mapOffsetX + b[0] * tileSize + tileSize / 2;
      const by = mapOffsetY + b[1] * tileSize + tileSize / 2;

      e.x = ax + (bx - ax) * e.progress;
      e.y = ay + (by - ay) * e.progress;
    }
  }

  // ---------------- DRAW HELPERS ----------------
  function drawGrid() {
    ctx.save();
    ctx.translate(mapOffsetX, mapOffsetY);
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const x = c * tileSize;
        const y = r * tileSize;
        ctx.fillStyle = grid[r][c] === 1 ? "#22343f" : "#12202a";
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.strokeStyle = "rgba(255,255,255,0.03)";
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }
    console.log(
      "Start tile value:",
      grid[pathStart.y][pathStart.x],
      "End tile value:",
      grid[pathEnd.y][pathEnd.x]
    );
    if (
      grid[pathStart.y][pathStart.x] !== 1 ||
      grid[pathEnd.y][pathEnd.x] !== 1
    ) {
      console.error("🚨 Path start or end is NOT walkable", pathStart, pathEnd);
    }
    ctx.restore();
  }

  function drawTowers() {
    for (const t of towers) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation);

      // Base
      ctx.beginPath();
      ctx.fillStyle = t.type === "A" ? "#ff6b6b" :
                      t.type === "F" ? "#6ec6ff" : "#ffd166";
      ctx.arc(0, 0, tileSize * 0.38, 0, Math.PI * 2);
      ctx.fill();

      // Barrel
      ctx.fillStyle = "#222";
      ctx.fillRect(0, -4, tileSize * 0.45, 8);

      ctx.restore();

      // Level label
      ctx.fillStyle = "#000";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("L" + t.level, t.x, t.y + 4);
    }
  }

  function drawGhostTower() {
    const tx = state.mouseTileX;
    const ty = state.mouseTileY;

    // Only draw if within grid bounds
    if (tx < 0 || tx >= gridCols || ty < 0 || ty >= gridRows) return;

    const x = mapOffsetX + tx * tileSize + tileSize / 2;
    const y = mapOffsetY + ty * tileSize + tileSize / 2;

    // Check validity: 0 = buildable, 1 = road/path
    const isPath = grid[ty][tx] === 1;
    const isOccupied = towers.some(t => t.tx === tx && t.ty === ty);
    const canAfford = state.gold >= towerConfig[state.selectedTowerType].cost;

    ctx.save();
    ctx.translate(x, y);

    // Draw range circle for the ghost
    const range = towerConfig[state.selectedTowerType].baseRange;
    ctx.beginPath();
    ctx.fillStyle = (isPath || isOccupied) ? "rgba(255, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.1)";
    ctx.arc(0, 0, range * tileSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw the ghost tower body
    ctx.globalAlpha = 0.4; // Make it transparent
    ctx.beginPath();
    // Red if blocked, Greenish-blue if valid
    ctx.fillStyle = (isPath || isOccupied || !canAfford) ? "#ff0000" : "#00f2ff";
    ctx.arc(0, 0, tileSize * 0.38, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function isTileValidForTower(tx, ty) {
    // 1. Inside bounds?
    if (tx < 0 || tx >= gridCols || ty < 0 || ty >= gridRows) return false;
    // 2. Is it a road? (In your code grid[y][x] === 1 is walkable/road)
    if (grid[ty][tx] === 1) return false;
    // 3. Already a tower there?
    const occupied = towers.some(t => t.tx === tx && t.ty === ty);
    if (occupied) return false;

    return true;
  }

  function drawEnemies() {
    for (const e of enemies) {
          // DEBUG PLACEHOLDER DRAW
      if (e.debug) {
        ctx.fillStyle = "#ff0033";
        ctx.fillRect(e.x - 16, e.y - 16, 32, 32);
        ctx.fillStyle = "#fff";
        ctx.font = "10px sans-serif";
        ctx.fillText("DEBUG", e.x - 14, e.y + 4);
        continue;
      }
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(e.x+4, e.y+4, 12, 6, 0, 0, Math.PI*2);
      ctx.fill();
      const ratio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = "#ffb703";
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 12, 10, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = "#222";
      ctx.fillRect(e.x - 16, e.y - 18, 32, 6);
      ctx.fillStyle = ratio > 0.6 ? "#4caf50" : ratio > 0.25 ? "#ff9800" : "#f44336";
      ctx.fillRect(e.x - 16, e.y - 18, 32 * ratio, 6);
      if (e.boss) {
        ctx.strokeStyle = "#ff0033";
        ctx.lineWidth = 4;
        ctx.strokeRect(e.x - 20, e.y - 20, 40, 40);
      }
    }
  }

  function drawProjectiles() {
    for (const p of projectiles) {
      ctx.beginPath();
      ctx.fillStyle = p.type === "A" ? "#fff" : "#bfefff";
      ctx.arc(p.x, p.y, p.type === "A" ? 4 : 6, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function drawRanges() {
    if (!state.selectedPlacedTower) return;
    const t = state.selectedPlacedTower;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([6,6]);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.arc(t.x, t.y, t.range * tileSize, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------- MAIN DRAW ----------------
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "#0f1720";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "lime";
    ctx.fillRect(
      mapOffsetX + pathStart.x * tileSize,
      mapOffsetY + pathStart.y * tileSize,
      tileSize,
      tileSize
    );

    ctx.fillStyle = "red";
    ctx.fillRect(
      mapOffsetX + pathEnd.x * tileSize,
      mapOffsetY + pathEnd.y * tileSize,
      tileSize,
      tileSize
    );


    // Draw grid (translated)
    drawGrid();
    drawPathDebug();
    drawGhostTower();

    // Draw enemies, towers, projectiles, ranges (all absolute coords)
    drawEnemies();
    drawTowers();
    drawProjectiles();
    drawRanges();
    drawExplosions(performance.now());
  }

  function drawGameOver() {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "#ff6666";
    ctx.font = "48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("💀 GAME OVER 💀", canvas.width/2, canvas.height/2 - 20);
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(`Score: ${state.score}`, canvas.width/2, canvas.height/2 + 20);
    ctx.restore();
  }

  // ---------------- INPUT ----------------
  let mouse = { x:0, y:0, down:false };
  state.mouseTileX = -1;
  state.mouseTileY = -1;
  canvas.addEventListener("mousemove", (ev) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ev.clientX - rect.left;
      mouse.y = ev.clientY - rect.top;

      // Calculate which tile the mouse is over
      state.mouseTileX = Math.floor((mouse.x - mapOffsetX) / tileSize);
      state.mouseTileY = Math.floor((mouse.y - mapOffsetY) / tileSize);
  });
  canvas.addEventListener("mousedown", (ev) => {
    mouse.down = true;
    const tx = Math.floor((mouse.x - mapOffsetX) / tileSize);
    const ty = Math.floor((mouse.y - mapOffsetY) / tileSize);
    if (tx >= 0 && tx < gridCols && ty >= 0 && ty < gridRows) {
      for (const t of towers) {
        if (t.tx === tx && t.ty === ty) {
          state.selectedPlacedTower = t;
          ui.upgradeBtn.style.display = "inline-block";
          ui.sellBtn.style.display = "inline-block";
          return;
        }
      }
      if (placeTowerAt(tx, ty)) {
        state.selectedPlacedTower = null;
        ui.upgradeBtn.style.display = "none";
        ui.sellBtn.style.display = "none";
      }
    }
  });
  canvas.addEventListener("mouseup", () => { mouse.down = false; });

  // ---------------- UI wiring ----------------
  ui.selArrow.addEventListener("click", () => {
    state.selectedTowerType = "A";
    ui.selArrow.classList.add("sel");
    ui.selFrost.classList.remove("sel");
    ui.selBomb.classList.remove("sel");
  });
  ui.selFrost.addEventListener("click", () => {
    state.selectedTowerType = "F";
    ui.selFrost.classList.add("sel");
    ui.selArrow.classList.remove("sel");
    ui.selBomb.classList.remove("sel");
  });
  ui.selBomb.addEventListener("click", () => {
    state.selectedTowerType = "B";
    ui.selBomb.classList.add("sel");
    ui.selFrost.classList.remove("sel");
    ui.selArrow.classList.remove("sel");
  });
  ui.startBtn.addEventListener("click", () => {
    if (state.wave >= state.maxWaves) return;
    if (enemies.length === 0) {
      state.wave++;
      state.enemiesSpawnedThisWave = 0;
      state.enemiesPerWave = 8 + Math.floor(state.wave * 1.5);
      state.enemySpawnCooldown = 200;
    }
  });

  ui.upgradeBtn.addEventListener("click", () => {
    if (!state.selectedPlacedTower) return;
    upgradeTower(state.selectedPlacedTower);
    refreshUI();
  });
  ui.sellBtn.addEventListener("click", () => {
    if (!state.selectedPlacedTower) return;
    sellTower(state.selectedPlacedTower);
    refreshUI();
  });

  ui.submitBtn.addEventListener("click", async () => {
    const name = (ui.playerName.value || "Anon").trim().slice(0,30);
    const payload = { name, score: Math.round(state.score) };
    try {
      const r = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (data.ok) {
        await loadLeaderboard();
        alert("Score submitted!");
      } else {
        alert("Failed to submit score");
      }
    } catch (e) {
      alert("Submit failed");
    }
  });

  // ---------------- RESIZE & START ----------------
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    mapOffsetX = Math.floor((canvas.width - mapW) / 2);
    mapOffsetY = Math.floor((canvas.height - mapH) / 2);

    // Update Towers
    for (const t of towers) {
        t.x = mapOffsetX + t.tx * tileSize + tileSize / 2;
        t.y = mapOffsetY + t.ty * tileSize + tileSize / 2;
    }
  }

  window.addEventListener("resize", resize);
  // Call initially
  resize();

  ui.restartBtn = document.getElementById("restartBtn");

  function resetGame() {
    // Clear Arrays
    towers.length = 0;
    enemies.length = 0;
    projectiles.length = 0;
    explosions.length = 0;

    // Reset State
    state.score = 0;
    state.gold = 120;
    state.lives = 10;
    state.wave = 0;
    state.enemiesSpawnedThisWave = 0;
    state.enemySpawnCooldown = 0;
    state.selectedPlacedTower = null;
    
    // Ensure loop runs
    if (!state.gameRunning) {
        state.gameRunning = true;
        requestAnimationFrame(frame);
    }

    refreshUI();
    ui.upgradeBtn.style.display = "none";
    ui.sellBtn.style.display = "none";
  }

  ui.restartBtn.addEventListener("click", resetGame);

  // ---------------- MAIN LOOP ----------------
  let last = performance.now();
  function frame(now) {
    const dt = now - last;
    last = now;
    state.elapsed += dt;

    if (state.wave > 0 && state.enemiesSpawnedThisWave < state.enemiesPerWave) {
      state.enemySpawnCooldown -= dt;
      if (state.enemySpawnCooldown <= 0) {
        spawnEnemy();
        state.enemySpawnCooldown = 700 + Math.random() * 500 - Math.min(300, state.wave * 20);
      }
    }

    updateTowers(dt, now);
    updateProjectiles(dt, now);
    updateEnemies(dt, now);

    draw();
    refreshUI();

    if (state.gameRunning) requestAnimationFrame(frame);
    else drawGameOver();
  }

  refreshUI();
  requestAnimationFrame(frame);

  // Refresh leaderboard periodically
  setInterval(loadLeaderboard, 15000);

  // Double-click to restart
  canvas.addEventListener("dblclick", () => {
    towers.length = 0;
    enemies.length = 0;
    projectiles.length = 0;
    state.score = 0;
    state.gold = 120;
    state.lives = 10;
    state.wave = 0;
    state.gameRunning = true;
    state.enemiesSpawnedThisWave = 0;
    state.enemySpawnCooldown = 0;
    refreshUI();
    requestAnimationFrame(frame);
  });

})();

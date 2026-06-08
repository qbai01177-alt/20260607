// --- 全域變數設定 ---
let capture;
let handPose;
let hands = [];

// --- 角色精靈圖片 ---
let runSpriteSheet;   
let jumpSpriteSheet;  
let slideSpriteSheet; 

// --- 特效管理陣列 ---
let effects = []; // 🌟 新增：用來儲存畫面上所有光圈與粒子特效

// --- 🎮 針對體感延遲優化後的遊戲設定常數 ---
const HAND_RAISE_THRESHOLD = 0.45; 
const OBSTACLE_MIN_INTERVAL = 140; 
const OBSTACLE_MAX_INTERVAL = 220; 
const GROUND_Y_OFFSET = 100;       
const PLAYER_START_X = 150;        
const PLAYER_START_Y_OFFSET = 150; 

// 遊戲物件變數
let player;
let obstacles = [];
let score = 0;
let modelLoaded = false; 
let nextObstacleFrame = 0;

// 遊戲狀態機設定
let gameState = 'START'; 
let gameStartTime = 0; 

// 按鈕常數
const BTN_W = 200;
const BTN_H = 60;

// 影像映射全域座標
let videoX = 0;
let videoY = 0;
let videoWidth = 0;
let videoHeight = 0;

// 控制狀態文字
let debugMessage = "正在載入資源...";

function preload() {
  console.log("Preload: 正在載入圖片...");
  const runPath = '1/dash.png';
  const jumpPath = '1/jump.png';
  const slidePath = '1/stand.png';

  runSpriteSheet = loadImage(runPath, () => console.log(`✅ ${runPath} 載入成功`));
  jumpSpriteSheet = loadImage(jumpPath, () => console.log(`✅ ${jumpPath} 載入成功`));
  slideSpriteSheet = loadImage(slidePath, () => console.log(`✅ ${slidePath} 載入成功`));
}

function modelReady() {
  console.log("HandPose Model Ready!");
  modelLoaded = true; 
  debugMessage = "模型載入成功！請將手掌放入鏡頭。";
  handPose.detectStart(capture, gotHands);
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  capture = createCapture(VIDEO, { flipped: true });
  capture.size(640, 480);
  capture.hide();
 
  debugMessage = "正在載入 AI 模型，請稍候...";
  handPose = ml5.handPose({ flipped: true }, modelReady);

  player = new Player(PLAYER_START_X, height - PLAYER_START_Y_OFFSET);
}

function draw() {
  background('#C9ADA1'); 

  // 繪製地板線
  stroke(255);
  strokeWeight(4);
  line(0, height - GROUND_Y_OFFSET, width, height - GROUND_Y_OFFSET); 

  // 更新視訊尺寸位置
  videoWidth = width * 0.4;
  videoHeight = height * 0.4;
  videoX = width * 0.55; 
  videoY = (height - videoHeight) / 2;

  if (gameState === 'START') {
    drawStartMenu();
  } else if (gameState === 'PLAYING') {
    if (modelLoaded) {
      image(capture, videoX, videoY, videoWidth, videoHeight);
    }

    let leftHandUp = false;
    let rightHandUp = false;

    for (let i = 0; i < hands.length; i++) {
      let hand = hands[i];
      let wrist = hand.keypoints[0]; 
      
      let mappedY = map(wrist.y, 0, capture.height, videoY, videoY + videoHeight);
      let mappedX = map(wrist.x, 0, capture.width, videoX, videoX + videoWidth);

      fill(0, 255, 0);
      ellipse(mappedX, mappedY, 15, 15);

      if (wrist.y < capture.height * HAND_RAISE_THRESHOLD) { 
        if (hand.handedness === 'Left') leftHandUp = true;
        else if (hand.handedness === 'Right') rightHandUp = true;
      }
    }

    // 狀態控制流
    if (leftHandUp && rightHandUp) { 
      debugMessage = "雙手舉起：發動二連跳（空中光芒爆發）！";
      player.slide(false);
      player.doubleJump(); 
    } else if (leftHandUp) {
      debugMessage = "舉左手：發動向前飛躍跳躍！";
      player.slide(false);
      player.jump();
    } else if (rightHandUp) {
      debugMessage = "舉右手：進入鎖定平地滑行！";
      player.slide(true);  
    } else {
      if (hands.length > 0) debugMessage = "雙手放低：正常奔跑中";
      player.slide(false); 
    }

    player.update();

    // 5 秒安全期
    let timeElapsed = (millis() - gameStartTime) / 1000; 
    let remainingTime = 5 - floor(timeElapsed); 

    if (timeElapsed >= 5) {
      if (frameCount > nextObstacleFrame) {
        let type;
        let rand = random(0, 100);
        if (rand < 40) type = 'low';      
        else if (rand < 70) type = 'double';   
        else type = 'high';     
        obstacles.push(new Obstacle(type));
        nextObstacleFrame = frameCount + random(OBSTACLE_MIN_INTERVAL, OBSTACLE_MAX_INTERVAL); 
      }
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].update();
      obstacles[i].display(); 

      if (obstacles[i].hits(player)) {
        gameState = 'GAMEOVER'; 
      }

      if (obstacles[i].x + obstacles[i].w < player.x && !obstacles[i].passed) {
        score += 10;
        obstacles[i].passed = true;
      }

      if (obstacles[i].x < -50) obstacles.splice(i, 1);
    }

    // 🌟 核心更新：繪製、更新並自動清理所有粒子與光圈特效
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].update();
      effects[i].display();
      if (effects[i].isDead()) {
        effects.splice(i, 1);
      }
    }

    player.display();
    drawUI();

    if (remainingTime > 0) {
      fill(0, 0, 0, 100); 
      rect(0, 0, width, height);
      fill(255, 230, 0); 
      textAlign(CENTER, CENTER);
      textSize(100);
      text(remainingTime, width / 2, height / 2 - 50);
      textSize(24);
      fill(255);
      text("請預備！遊戲即將開始...", width / 2, height / 2 + 50);
    }

  } else if (gameState === 'GAMEOVER') {
    drawGameOverMenu();
  }
}

function drawStartMenu() {
  fill(0, 0, 0, 100);
  noStroke();
  rect(0, 0, width, height);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(50);
  text("AI 體感跑酷冒險", width / 2, height / 2 - 120);
  textSize(20);
  fill('#E0AFA0');
  text("動態提示: " + debugMessage, width / 2, height / 2 - 50);

  let btnX = width / 2 - BTN_W / 2;
  let btnY = height / 2 + 20;
  if (mouseX > btnX && mouseX < btnX + BTN_W && mouseY > btnY && mouseY < btnY + BTN_H) fill('#E85D04'); 
  else fill('#F48C06'); 
  rect(btnX, btnY, BTN_W, BTN_H, 15); 

  fill(255);
  textSize(24);
  text("開始遊戲", width / 2, height / 2 + 50);
}

function drawGameOverMenu() {
  fill(0, 0, 0, 160); 
  noStroke();
  rect(0, 0, width, height);
  fill('#D00000');
  textAlign(CENTER, CENTER);
  textSize(70);
  text("GAME OVER", width / 2, height / 2 - 120);
  fill(255);
  textSize(32);
  text("最終得分: " + score, width / 2, height / 2 - 40);

  let btnX = width / 2 - BTN_W / 2;
  let btnY = height / 2 + 30;
  if (mouseX > btnX && mouseX < btnX + BTN_W && mouseY > btnY && mouseY < btnY + BTN_H) fill('#3A86C8'); 
  else fill('#4EA8DE'); 
  rect(btnX, btnY, BTN_W, BTN_H, 15);

  fill(255);
  textSize(24);
  text("再來一次", width / 2, height / 2 + 60);
}

function drawUI() {
  fill(255);
  noStroke();
  textSize(24);
  textAlign(LEFT, TOP);
  text("得分: " + score, 30, 30);
  text("動態偵測: " + debugMessage, 30, 70);
}

function gotHands(results) {
  hands = results;
}

function checkButtonAction() {
  let btnX = width / 2 - BTN_W / 2;
  if (gameState === 'START' || gameState === 'GAMEOVER') {
    let btnY = (gameState === 'START') ? height / 2 + 20 : height / 2 + 30;
    if (mouseX > btnX && mouseX < btnX + BTN_W && mouseY > btnY && mouseY < btnY + BTN_H) {
      obstacles = [];
      effects = []; // 清空特效
      score = 0;
      player = new Player(PLAYER_START_X, height - PLAYER_START_Y_OFFSET);
      gameState = 'PLAYING';
      gameStartTime = millis(); 
      return true; 
    }
  }
  return false;
}

function mousePressed() { checkButtonAction(); }
function touchStarted() { checkButtonAction(); }

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (player) player.baseY = height - PLAYER_START_Y_OFFSET;
}

// ==========================================
// 🧱 類別一：遊戲主角 (Player Class)
// ==========================================
class Player {
  constructor(x, y) {
    this.startX = x;         
    this.x = x;              
    this.y = y;
    this.baseY = y;          
    this.w = 64;             
    this.h = 56;             
    this.baseH = 56;         
    
    this.gravity = 0.5;      
    this.velocity = 0;       
    this.jumpForce = -11.5;  
    this.isSliding = false;  
    
    this.jumpCount = 0;      
    this.canDoubleJumpTrigger = true; 

    this.runAnim = { frame: 0, speed: 0.25, count: 8, w: 32, h: 24 };
    this.jumpAnim = { frame: 0, speed: 0.11, count: 8, w: 37, h: 28 }; 
    this.slideAnim = { frame: 0, speed: 0.15, count: 2, w: 30, h: 22 };
  }

  jump() {
    if (this.y === this.baseY && !this.isSliding && this.jumpCount === 0) {
      this.velocity = this.jumpForce;
      this.jumpCount = 1;
      this.canDoubleJumpTrigger = false; 
      
      // 🌟 特效觸發：起跳瞬間在地面產生一個「白色擴散光圈」
      effects.push(new RingEffect(this.x + this.w / 2, this.baseY + this.h));
    }
  }

  doubleJump() {
    if (this.y < this.baseY && this.jumpCount === 1 && this.canDoubleJumpTrigger) {
      this.velocity = this.jumpForce * 1.25; 
      this.jumpCount = 2; 
      
      // 🌟 特效觸發：空中發動二連跳時，向四周噴射 15 顆黃金粒子星星！
      for (let i = 0; i < 15; i++) {
        effects.push(new ParticleEffect(this.x + this.w / 2, this.y + this.h / 2));
      }
    }
    if (this.y === this.baseY && !this.isSliding && this.jumpCount === 0) {
      this.jump(); // 觸發第一跳
    }
  }

  slide(isSlidingNow) {
    if (isSlidingNow) {
      this.isSliding = true;
      this.h = this.baseH * 0.45; 
      this.y = this.baseY;        
    } else {
      this.isSliding = false;
      this.h = this.baseH;       
      this.y = this.baseY;
    }
  }

  update() {
    this.velocity += this.gravity;
    this.y += this.velocity;

    if (this.y >= this.baseY && !this.isSliding) {
      this.y = this.baseY;
      this.velocity = 0;
      this.jumpCount = 0; 
      this.canDoubleJumpTrigger = true;
      this.x = this.startX; 
    } else if (this.isSliding) {
      this.velocity = 0; 
      this.y = this.baseY; 
      this.x = this.startX;
    }

    if (this.y < this.baseY) {
      let forwardDistance = (this.jumpCount === 2) ? 160 : 80;
      let heightRatio = (this.baseY - this.y) / 150; 
      this.x = this.startX + heightRatio * forwardDistance;
    }

    if (this.y < this.baseY && this.velocity > -2) {
      this.canDoubleJumpTrigger = true;
    }

    if (this.y === this.baseY && !this.isSliding) {
      this.runAnim.frame = (this.runAnim.frame + this.runAnim.speed) % this.runAnim.count;
    } else if (this.y < this.baseY) {
      this.jumpAnim.frame = (this.jumpAnim.frame + this.jumpAnim.speed) % this.jumpAnim.count;
    } else if (this.isSliding) {
      this.slideAnim.frame = (this.slideAnim.frame + this.slideAnim.speed) % this.slideAnim.count;
    }
  }

  display() {
    const drawAnimation = (anim, sheet) => {
      if (!sheet || !sheet.width) {
        if (anim === this.runAnim) fill('green'); 
        else if (anim === this.jumpAnim) fill('blue'); 
        else if (anim === this.slideAnim) fill('yellow'); 
        noStroke();
        rect(this.x, this.y, this.w, this.h);
        return; 
      }
      let currentFrameIndex = floor(anim.frame);
      let sx = currentFrameIndex * anim.w; 
      let displayHeight = (this.isSliding) ? this.baseH : this.h;
      let drawY = (this.isSliding) ? this.baseY : this.y;

      image(sheet, this.x, drawY, this.w, displayHeight, sx, 0, anim.w, anim.h);
    };

    if (this.isSliding) drawAnimation(this.slideAnim, slideSpriteSheet);
    else if (this.y < this.baseY) drawAnimation(this.jumpAnim, jumpSpriteSheet); 
    else drawAnimation(this.runAnim, runSpriteSheet);
  }
}

// ==========================================
// 🌟 特效類別一：起跳地面擴散光圈 (RingEffect)
// ==========================================
class RingEffect {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 10;       // 起始圓圈大小
    this.maxSize = 90;    // 最大擴散半徑
    this.alpha = 255;     // 初始不透明度
    this.speed = 4;       // 擴散速度
  }

  update() {
    this.size += this.speed;
    this.alpha -= 10;     // 隨著變大慢慢變透明
  }

  display() {
    noFill();
    stroke(255, 255, 255, this.alpha); // 白色光圈
    strokeWeight(3);
    ellipse(this.x, this.y, this.size, this.size / 2); // 扁平橢圓，貼合地面感
  }

  isDead() {
    return this.alpha <= 0 || this.size >= this.maxSize;
  }
}

// ==========================================
// 🌟 特效類別二：空中二連跳爆發粒子 (ParticleEffect)
// ==========================================
class ParticleEffect {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    // 隨機向四周炸開的速度向量
    this.vx = random(-4, 4);
    this.vy = random(-6, 2);
    this.alpha = 255;
    this.size = random(6, 12);
    // 隨機挑選亮眼的黃色/橘色粒子
    this.color = random(['#FFD700', '#FF8C00', '#FFF3B0']); 
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.15; // 粒子微弱下墜重力
    this.alpha -= 8; // 漸漸淡出
  }

  display() {
    noStroke();
    let c = color(this.color);
    c.setAlpha(this.alpha); // 套用淡出透明度
    fill(c);
    ellipse(this.x, this.y, this.size, this.size);
  }

  isDead() {
    return this.alpha <= 0;
  }
}

// ==========================================
// 🚧 類別二：障礙物 (Obstacle Class)
// ==========================================
class Obstacle {
  constructor(type) {
    this.type = type; 
    this.x = width;
    this.speed = 4.5;   
    this.passed = false;

    if (this.type === 'low') {
      this.w = 30;
      this.h = 45;      
      this.y = height - GROUND_Y_OFFSET - this.h; 
    } else if (this.type === 'double') {
      this.w = 30;
      this.h = 90;      
      this.y = height - GROUND_Y_OFFSET - this.h; 
    } else if (this.type === 'high') {
      this.w = 40;
      this.h = 25;      
      this.y = height - GROUND_Y_OFFSET - 52; 
    }
  }

  update() { this.x -= this.speed; }

  display() {
    if (this.type === 'low') {
      fill('#38B000'); 
      rect(this.x, this.y, this.w, this.h, 5);
    } else if (this.type === 'double') {
      fill('#0077B6'); 
      rect(this.x, this.y, this.w, this.h, 5);
      stroke(255, 100);
      strokeWeight(2);
      line(this.x, this.y + 45, this.x + this.w, this.y + 45);
    } else {
      fill('#D00000'); 
      rect(this.x, this.y, this.w, this.h, 5);
    }
  }

  hits(player) {
    return (
      player.x < this.x + this.w &&
      player.x + player.w > this.x &&
      player.y < this.y + this.h &&
      player.y + player.h > this.y
    );
  }
}
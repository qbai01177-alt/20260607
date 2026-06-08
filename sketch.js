// --- 全域變數設定 ---
let capture;
let handPose;
let hands = [];

// --- 角色精靈圖片 ---
let runSpriteSheet;   // 跑步動畫
let jumpSpriteSheet;  // 跳躍動畫
let slideSpriteSheet; // 滑行動畫

// --- 🎮 針對體感延遲優化後的遊戲設定常數 ---
const HAND_RAISE_THRESHOLD = 0.45; // 舉手判定的閾值 (y軸百分比)
const OBSTACLE_MIN_INTERVAL = 140; // 提高間隔
const OBSTACLE_MAX_INTERVAL = 220; 
const GROUND_Y_OFFSET = 100;       // 地板線距離底部的高度
const PLAYER_START_X = 150;        // 往右移一點增加反應時間
const PLAYER_START_Y_OFFSET = 150; // 玩家初始 Y 座標

// 遊戲物件變數
let player;
let obstacles = [];
let score = 0;
let gameOver = false;
let modelLoaded = false; 
let nextObstacleFrame = 0;

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

  videoWidth = width * 0.4;
  videoHeight = height * 0.4;
  videoX = width * 0.55; 
  videoY = (height - videoHeight) / 2;

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
      if (hand.handedness === 'Left') {
        leftHandUp = true;
      } else if (hand.handedness === 'Right') {
        rightHandUp = true;
      }
    }
  }

  if (modelLoaded && !gameOver) {
    if (leftHandUp && rightHandUp) { 
      debugMessage = "雙手舉起：二連跳！";
      player.doubleJump();
      player.slide(false);
    } else if (leftHandUp) {
      debugMessage = "舉左手：高高跳躍！";
      player.jump();
      player.slide(false);
    } else if (rightHandUp) {
      debugMessage = "舉右手：平地縮體滑行！";
      player.slide(true);
    } else {
      if (hands.length > 0) debugMessage = "雙手放低：原地奔跑中";
      player.slide(false);
    }

    player.update();

    // 障礙物管理系統（綠 7 : 紅 3）
    if (frameCount > nextObstacleFrame) {
      let type;
      let rand = random(0, 100);
      if (rand < 70) {
        type = 'low';   
      } else {
        type = 'high';  
      }
      obstacles.push(new Obstacle(type));
      nextObstacleFrame = frameCount + random(OBSTACLE_MIN_INTERVAL, OBSTACLE_MAX_INTERVAL); 
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].update();
      obstacles[i].display(); 

      if (obstacles[i].hits(player)) {
        gameOver = true;
      }

      if (obstacles[i].x + obstacles[i].w < player.x && !obstacles[i].passed) {
        score += 10;
        obstacles[i].passed = true;
      }

      if (obstacles[i].x < -50) {
        obstacles.splice(i, 1);
      }
    }

    player.display();

  } else if (gameOver) { 
    fill(0, 0, 0, 150); 
    rect(0, 0, width, height);

    fill(255, 0, 0);
    textSize(64);
    textAlign(CENTER, CENTER);
    text("GAME OVER", width / 2, height / 2);
    textSize(24);
    fill(255);
    text("點擊滑鼠重新開始遊戲", width / 2, height / 2 + 80);
  }

  fill(255);
  noStroke();
  textSize(24);
  textAlign(LEFT, TOP);
  text("得分: " + score, 30, 30);
  text("動態偵測: " + debugMessage, 30, 70);
  textSize(14);
  text("【玩法提示】舉左手 = 大幅度騰空 2 秒跳躍 | 舉右手 = 平地縮身滑行避開紅色方塊", 30, 110);
}

function gotHands(results) {
  hands = results;
}

function mousePressed() {
  if (gameOver) {
    obstacles = [];
    score = 0;
    gameOver = false;
    player = new Player(PLAYER_START_X, height - PLAYER_START_Y_OFFSET);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (player) {
    player.baseY = height - PLAYER_START_Y_OFFSET;
    if (!player.isSliding && player.y >= player.baseY) {
      player.y = player.baseY;
    }
  }
}

// ==========================================
// 🧱 類別一：遊戲主角 (Player Class)
// ==========================================
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.baseY = y;          
    this.w = 64;             
    this.h = 56;             
    this.baseH = 56;         
    
    this.gravity = 0.16;     
    this.velocity = 0;       
    this.jumpForce = -9.6;   
    this.isSliding = false;  
    this.jumpCount = 0;      

    // 精靈圖切圖規格
    this.runAnim = { frame: 0, speed: 0.25, count: 8, w: 32, h: 24 };
    this.jumpAnim = { frame: 0, speed: 0.065, count: 8, w: 37, h: 28 }; 
    this.slideAnim = { frame: 0, speed: 0.15, count: 2, w: 30, h: 22 };
  }

  jump() {
    if (this.y === this.baseY && !this.isSliding) {
      this.velocity = this.jumpForce;
    }
  }

  doubleJump() {
    if (this.y < this.baseY && this.velocity > -2) {
      this.velocity = this.jumpForce * 0.8;
    }
  }

  slide(isSlidingNow) {
    if (isSlidingNow && this.y === this.baseY) {
      this.isSliding = true;
      // 🌟 核心配平：滑行時碰撞箱精確壓低到原本的 45%，騰出上方空間供紅色方塊穿過
      this.h = this.baseH * 0.45; 
      this.y = this.baseY; 
    } else if (!isSlidingNow) {
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
    } else if (this.isSliding) {
      this.velocity = 0; 
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

      image(
        sheet,
        this.x, drawY, this.w, displayHeight, 
        sx, 0, anim.w, anim.h          
      );
    };

    if (this.isSliding) {
      drawAnimation(this.slideAnim, slideSpriteSheet);
    } else if (this.y < this.baseY) {
      drawAnimation(this.jumpAnim, jumpSpriteSheet);
    } else {
      drawAnimation(this.runAnim, runSpriteSheet);
    }
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
      this.y = height - GROUND_Y_OFFSET - this.h; // 地面障礙物
    } else if (this.type === 'high') {
      this.w = 40;
      this.h = 25;      // 🌟 核心修正：將懸空紅色方塊高度縮扁變精緻
      // 🌟 核心修正：高度從原本的「底部往上減95」改為「減 52」。
      // 這會讓紅色方塊的高度精準卡在正常角色的「脖子與頭部」高度！如果不蹲下絕對會直接被敲頭！
      this.y = height - GROUND_Y_OFFSET - 52; 
    }
  }

  update() {
    this.x -= this.speed; 
  }

  display() {
    if (this.type === 'low') {
      fill('#38B000'); 
    } else {
      fill('#D00000'); // 懸空紅色方塊
    }
    rect(this.x, this.y, this.w, this.h, 5);
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
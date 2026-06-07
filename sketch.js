// --- 全域變數設定 ---
let capture;
let handPose;
let hands = [];

// --- 遊戲設定常數 (Game Settings Constants) ---
const HAND_RAISE_THRESHOLD = 0.45; // 舉手判定的閾值 (y軸百分比)
const OBSTACLE_MIN_INTERVAL = 80;  // 障礙物產生最小間隔 (影格)
const OBSTACLE_MAX_INTERVAL = 150; // 障礙物產生最大間隔 (影格)
const GROUND_Y_OFFSET = 100;       // 地板線距離底部的高度
const PLAYER_START_X = 100;        // 玩家初始 X 座標
const PLAYER_START_Y_OFFSET = 150; // 玩家初始 Y 座標 (相對地板)

// 遊戲物件變數
let player;
let obstacles = [];
let score = 0;
let gameOver = false;
let nextObstacleFrame = 0;

// 控制狀態文字
let debugMessage = "等待手部偵測...";

function preload() {
  // 載入 ml5.js 的 handPose 模型，設定 flipped 為 true 配合你的鏡像視訊
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // 啟動攝影機並設定鏡像
  capture = createCapture(VIDEO, { flipped: true });
  capture.size(640, 480);
  capture.hide();

  // 啟動手勢連續偵測
  handPose.detectStart(capture, gotHands);

  // 初始化遊戲主角 (給予初始 X, Y 座標)
  player = new Player(PLAYER_START_X, height - PLAYER_START_Y_OFFSET);
}

function draw() {
  background('#C9ADA1'); // 溫暖的背景底色

  // --- 1. 繪製攝影機畫面 (佔畫面的右半邊置中) ---
  const videoWidth = width * 0.4;
  const videoHeight = height * 0.4;
  const videoX = width * 0.55; // 移到右側
  const videoY = (height - videoHeight) / 2;

  // 因為 createCapture 已經設定了 flipped: true，這裡直接畫出來就是鏡像的（跟你照鏡子一樣）
  image(capture, videoX, videoY, videoWidth, videoHeight);

  // --- 2. 核心邏輯：偵測雙手舉起高度 ---
  let leftHandUp = false;
  let rightHandUp = false;

  // 遍歷所有偵測到的手
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    
    // 取得手掌中心點（Keypoint 0 是手腕/手掌底部）
    let wrist = hand.keypoints[0]; 
    
    // 將手掌在攝影機中的 y 座標，映射到網頁畫面上
    let mappedY = map(wrist.y, 0, capture.height, videoY, videoY + videoHeight);
    let mappedX = map(wrist.x, 0, capture.width, videoX, videoX + videoWidth);

    // 在攝影機畫面上畫出偵測點，方便除錯
    fill(0, 255, 0);
    ellipse(mappedX, mappedY, 15, 15);

    // 🌟 核心判斷：當手掌高度高於攝影機畫面的「中線」以上，就算「舉手」
    // (注意：螢幕座標越往上 Y 越小，所以是小於)
    let thresholdY = videoY + videoHeight * HAND_RAISE_THRESHOLD; 

    if (wrist.y < capture.height * HAND_RAISE_THRESHOLD) { 
      // 根據 ml5.js 偵測這隻手是左手還是右手
      // 註：因為畫面鏡像了，這裡直接採用模型判定的 handedness (Left/Right)
      if (hand.handedness === 'Left') {
        leftHandUp = true;
      } else if (hand.handedness === 'Right') {
        rightHandUp = true;
      }
    }
  }

  // --- 3. 根據雙手狀態觸發遊戲動作 ---
  if (!gameOver) {
    if (leftHandUp && rightHandUp) {
      debugMessage = "雙手舉起：二連跳！";
      player.doubleJump();
      player.slide(false);
    } else if (leftHandUp) {
      debugMessage = "舉左手：跳躍！";
      player.jump();
      player.slide(false);
    } else if (rightHandUp) {
      debugMessage = "舉右手：滑地！";
      player.slide(true);
    } else {
      debugMessage = "雙手放低：正常奔跑";
      player.slide(false);
    }

    // 更新與繪製主角
    player.update();
    player.display();

    // --- 4. 障礙物管理系統 ---
    if (frameCount > nextObstacleFrame) {
      let type = random(['high', 'low']); 
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
  } else {
    // Game Over 畫面
    fill(255, 0, 0);
    textSize(64);
    textAlign(CENTER, CENTER);
    text("GAME OVER", width / 2, height / 2);
    textSize(24);
    fill(255);
    text("點擊滑鼠重新開始遊戲", width / 2, height / 2 + 80);
  }

  // --- 5. UI 資訊繪製 ---
  stroke(255);
  strokeWeight(4);
  line(0, height - GROUND_Y_OFFSET, width, height - GROUND_Y_OFFSET); // 地板線

  fill(255);
  noStroke();
  textSize(24);
  textAlign(LEFT, TOP);
  text("得分: " + score, 30, 30);
  text("動態偵測: " + debugMessage, 30, 70);
  textSize(14);
  text("【玩法提示】舉左手 = 跳躍 | 舉右手 = 滑行 | 雙手舉起 = 二連跳", 30, 110);
}

// 接收 handPose 偵測結果
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
}

// ==========================================
// 🧱 類別一：遊戲主角 (Player Class) - 支援二連跳
// ==========================================
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.baseY = y;          
    this.w = 50;             
    this.h = 60;             
    this.baseH = 60;         
    
    this.gravity = 1.2;      
    this.velocity = 0;       
    this.jumpForce = -18;    
    this.isSliding = false;  
    
    // 🌟 二連跳控制變數
    this.jumpCount = 0;      
    this.maxJumps = 2;       
    this.canDoubleJumpTrigger = true; 
  }

  jump() {
    // 普通單跳：必須在地板上
    if (this.y === this.baseY && !this.isSliding && this.jumpCount === 0) {
      this.velocity = this.jumpForce;
      this.jumpCount = 1;
      this.canDoubleJumpTrigger = false; // 先鎖定，避免跟雙手舉起衝突
    }
  }

  doubleJump() {
    // 二連跳：當雙手舉起，且角色還在空中，且只跳過一次時，觸發第二次跳躍
    if (this.y < this.baseY && this.jumpCount === 1 && this.canDoubleJumpTrigger) {
      this.velocity = this.jumpForce * 0.85; // 第二跳稍微弱一點點，比較有層次感
      this.jumpCount = 2;
    }
    // 如果本來在地板上直接舉雙手，就直接觸發第一跳
    if (this.y === this.baseY && !this.isSliding && this.jumpCount === 0) {
      this.velocity = this.jumpForce;
      this.jumpCount = 1;
    }
  }

  slide(isSlidingNow) {
    if (isSlidingNow && this.y === this.baseY) {
      this.isSliding = true;
      this.h = this.baseH * 0.5; 
      this.y = this.baseY + (this.baseH - this.h); 
    } else if (!isSlidingNow) {
      this.isSliding = false;
      this.h = this.baseH;       
      if (this.y > this.baseY) this.y = this.baseY;
    }
  }

  update() {
    this.velocity += this.gravity;
    this.y += this.velocity;

    // 落地重置跳躍次數
    if (this.y >= this.baseY && !this.isSliding) {
      this.y = this.baseY;
      this.velocity = 0;
      this.jumpCount = 0; // 重置跳躍
      this.canDoubleJumpTrigger = true; // 落地後重新允許二連跳觸發
    } else if (this.isSliding) {
      this.velocity = 0; 
    }

    // 當角色從第一跳的上升階段轉為下降階段時，開啟二連跳的觸發開關
    if (this.y < this.baseY && this.velocity > -2) {
      this.canDoubleJumpTrigger = true;
    }
  }

  display() {
    if (this.isSliding) {
      fill('#4EA8DE'); // 滑地：藍色扁方塊
    } else if (this.jumpCount === 2) {
      fill('#9D4EDD'); // 二連跳：紫色方塊
    } else {
      fill('#FF7096'); // 正常/單跳：粉紅色方塊
    }
    noStroke();
    rect(this.x, this.y, this.w, this.h, 10); 
  }
}

// ==========================================
// 🚧 類別二：障礙物 (Obstacle Class)
// ==========================================
class Obstacle {
  constructor(type) {
    this.type = type; 
    this.x = width;
    this.speed = 8;   
    this.passed = false;

    if (this.type === 'low') {
      this.w = 30;
      this.h = 50;
      this.y = height - GROUND_Y_OFFSET - this.h; 
    } else if (this.type === 'high') {
      this.w = 40;
      this.h = 40;
      this.y = height - GROUND_Y_OFFSET - 95; // 95 是為了讓它在空中，讓玩家可以滑行通過
    }
  }

  update() {
    this.x -= this.speed; 
  }

  display() {
    if (this.type === 'low') {
      fill('#38B000'); // 地面障礙物
    } else {
      fill('#D00000'); // 懸空障礙物
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
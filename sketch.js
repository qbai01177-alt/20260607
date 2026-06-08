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
let modelLoaded = false; 
let nextObstacleFrame = 0;

// 🌟 核心更新：遊戲狀態機設定 ('START' = 開始選單, 'PLAYING' = 遊戲中, 'GAMEOVER' = 結算)
let gameState = 'START'; 

// 🌟 核心更新：按鈕的尺寸與位置常數
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

  // 🌟 根據不同遊戲狀態渲染畫面
  if (gameState === 'START') {
    // ==========================================
    // 🏠 畫面一：【開始遊戲選單】
    // ==========================================
    drawStartMenu();

  } else if (gameState === 'PLAYING') {
    // ==========================================
    // 🏃 畫面二：【遊戲核心跑酷中】
    // ==========================================
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

    // 狀態鎖定控制流
    if (leftHandUp && rightHandUp) { 
      debugMessage = "雙手舉起：發動二連跳！";
      player.slide(false);
      player.doubleJump();
    } else if (leftHandUp) {
      debugMessage = "舉左手：發動爆發跳躍！";
      player.slide(false);
      player.jump();
    } else if (rightHandUp) {
      debugMessage = "舉右手：進入鎖定滑行！";
      player.slide(true);  
    } else {
      if (hands.length > 0) debugMessage = "雙手放低：正常奔跑中";
      player.slide(false); 
    }

    player.update();

    // 障礙物系統（綠 7 : 紅 3）
    if (frameCount > nextObstacleFrame) {
      let type = (random(0, 100) < 70) ? 'low' : 'high';   
      obstacles.push(new Obstacle(type));
      nextObstacleFrame = frameCount + random(OBSTACLE_MIN_INTERVAL, OBSTACLE_MAX_INTERVAL); 
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].update();
      obstacles[i].display(); 

      if (obstacles[i].hits(player)) {
        gameState = 'GAMEOVER'; // 🌟 撞到障礙物切換到結算畫面
      }

      if (obstacles[i].x + obstacles[i].w < player.x && !obstacles[i].passed) {
        score += 10;
        obstacles[i].passed = true;
      }

      if (obstacles[i].x < -50) obstacles.splice(i, 1);
    }

    player.display();
    drawUI();

  } else if (gameState === 'GAMEOVER') {
    // ==========================================
    // 💀 畫面三：【遊戲結束結算畫面】
    // ==========================================
    drawGameOverMenu();
  }
}

// 繪製開始選單的輔助函式
function drawStartMenu() {
  // 半透明美化背景遮罩
  fill(0, 0, 0, 100);
  noStroke();
  rect(0, 0, width, height);

  // 標題
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(50);
  text("AI 體感跑酷冒險", width / 2, height / 2 - 120);
  
  textSize(20);
  fill('#E0AFA0');
  text("動態提示: " + debugMessage, width / 2, height / 2 - 50);

  // 繪製「開始遊戲」互動按鈕
  let btnX = width / 2 - BTN_W / 2;
  let btnY = height / 2 + 20;

  // 滑鼠或手指懸停變色特效
  if (mouseX > btnX && mouseX < btnX + BTN_W && mouseY > btnY && mouseY < btnY + BTN_H) {
    fill('#E85D04'); // 亮橘色
  } else {
    fill('#F48C06'); // 橘黃色
  }
  rect(btnX, btnY, BTN_W, BTN_H, 15); // 圓角按鈕

  // 按鈕文字
  fill(255);
  textSize(24);
  text("開始遊戲", width / 2, height / 2 + 50);

  // 玩法提示
  textSize(16);
  fill(255, 200);
  text("【玩法說明】舉左手 = 跳躍 (置空1.2秒) | 舉右手 = 平地縮身滑行避開紅色方塊", width / 2, height / 2 + 150);
}

// 繪製遊戲結束選單的輔助函式
function drawGameOverMenu() {
  fill(0, 0, 0, 160); 
  noStroke();
  rect(0, 0, width, height);

  // Game Over 字樣
  fill('#D00000');
  textAlign(CENTER, CENTER);
  textSize(70);
  text("GAME OVER", width / 2, height / 2 - 120);

  // 分數結算
  fill(255);
  textSize(32);
  text("最終得分: " + score, width / 2, height / 2 - 40);

  // 繪製「再來一次」互動按鈕
  let btnX = width / 2 - BTN_W / 2;
  let btnY = height / 2 + 30;

  if (mouseX > btnX && mouseX < btnX + BTN_W && mouseY > btnY && mouseY < btnY + BTN_H) {
    fill('#3A86C8'); // 懸停藍色
  } else {
    fill('#4EA8DE'); // 預設天空藍
  }
  rect(btnX, btnY, BTN_W, BTN_H, 15);

  // 按鈕文字
  fill(255);
  textSize(24);
  text("再來一次", width / 2, height / 2 + 60);
}

// 原本的頂部得分 UI 繪製
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

// 🌟 核心更新：同時完美相容電腦滑鼠點擊與手機觸控點擊
function mousePressed() {
  let btnX = width / 2 - BTN_W / 2;

  if (gameState === 'START') {
    let btnY = height / 2 + 20;
    // 檢查點擊是否在「開始遊戲」按鈕範圍內
    if (mouseX > btnX && mouseX < btnX + BTN_W && mouseY > btnY && mouseY < btnY + BTN_H) {
      // 重置遊戲資料並進入遊戲
      obstacles = [];
      score = 0;
      player = new Player(PLAYER_START_X, height - PLAYER_START_Y_OFFSET);
      gameState = 'PLAYING';
    }
  } else if (gameState === 'GAMEOVER') {
    let btnY = height / 2 + 30;
    // 檢查點擊是否在「再來一次」按鈕範圍內
    if (mouseX > btnX && mouseX < btnX + BTN_W && mouseY > btnY && mouseY < btnY + BTN_H) {
      // 重置遊戲資料並重新跑酷
      obstacles = [];
      score = 0;
      player = new Player(PLAYER_START_X, height - PLAYER_START_Y_OFFSET);
      gameState = 'PLAYING';
    }
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
    
    this.gravity = 0.5;      
    this.velocity = 0;       
    this.jumpForce = -11.5;  
    this.isSliding = false;  
    this.jumpCount = 0;      

    // 精靈圖切圖規格
    this.runAnim = { frame: 0, speed: 0.25, count: 8, w: 32, h: 24 };
    this.jumpAnim = { frame: 0, speed: 0.11, count: 8, w: 37, h: 28 }; 
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
    } else if (this.isSliding) {
      this.velocity = 0; 
      this.y = this.baseY; 
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
      this.y = height - GROUND_Y_OFFSET - this.h; 
    } else if (this.type === 'high') {
      this.w = 40;
      this.h = 25;      
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
      fill('#D00000'); 
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
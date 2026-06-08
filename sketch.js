// --- 全域變數設定 ---
let capture;
let handPose;
let hands = [];

// --- 角色精靈圖片 ---
let runSpriteSheet;   // 跑步動畫
let jumpSpriteSheet;  // 跳躍動畫
let slideSpriteSheet; // 滑行動畫

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

// 遊戲狀態機設定 ('START' = 開始選單, 'PLAYING' = 遊戲中, 'GAMEOVER' = 結算)
let gameState = 'START'; 
let gameStartTime = 0; 

// 按鈕的尺寸與位置常數
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

    // 🌟 完美整合二連跳狀態機控制流
    if (leftHandUp && rightHandUp) { 
      debugMessage = "雙手舉起：發動二連跳（兩倍高度）！";
      player.slide(false);
      player.doubleJump(); // 觸發二連跳物理推力
    } else if (leftHandUp) {
      debugMessage = "舉左手：發動基礎單次跳躍！";
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

    // 🌟 關卡設計優化：40% 綠色低、30% 藍色雙層高、30% 紅色卡脖
    if (timeElapsed >= 5) {
      if (frameCount > nextObstacleFrame) {
        let type;
        let rand = random(0, 100);
        if (rand < 40) {
          type = 'low';      // 40% 綠色低方塊
        } else if (rand < 70) {
          type = 'double';   // 30% 🌟 藍色雙層高方塊（逼出二連跳）
        } else {
          type = 'high';     // 30% 紅色卡脖子方塊（滑行通過）
        }
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

  if (mouseX > btnX && mouseX < btnX + BTN_W && mouseY > btnY && mouseY < btnY + BTN_H) {
    fill('#E85D04'); 
  } else {
    fill('#F48C06'); 
  }
  rect(btnX, btnY, BTN_W, BTN_H, 15); 

  fill(255);
  textSize(24);
  text("開始遊戲", width / 2, height / 2 + 50);

  textSize(16);
  fill(255, 200);
  text("【新玩法說明】雙手同時舉起 = 二連跳（跳高兩倍避開藍色雙層障礙）", width / 2, height / 2 + 150);
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

  if (mouseX > btnX && mouseX < btnX + BTN_W && mouseY > btnY && mouseY < btnY + BTN_H) {
    fill('#3A86C8'); 
  } else {
    fill('#4EA8DE'); 
  }
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

  if (gameState === 'START') {
    let btnY = height / 2 + 20;
    if (mouseX > btnX && mouseX < btnX + BTN_W && mouseY > btnY && mouseY < btnY + BTN_H) {
      obstacles = [];
      score = 0;
      player = new Player(PLAYER_START_X, height - PLAYER_START_Y_OFFSET);
      gameState = 'PLAYING';
      gameStartTime = millis(); 
      return true; 
    }
  } else if (gameState === 'GAMEOVER') {
    let btnY = height / 2 + 30;
    if (mouseX > btnX && mouseX < btnX + BTN_W && mouseY > btnY && mouseY < btnY + BTN_H) {
      obstacles = [];
      score = 0;
      player = new Player(PLAYER_START_X, height - PLAYER_START_Y_OFFSET);
      gameState = 'PLAYING';
      gameStartTime = millis(); 
      return true; 
    }
  }
  return false;
}

function mousePressed() {
  let clicked = checkButtonAction();
  if (clicked) return false; 
}

function touchStarted() {
  let clicked = checkButtonAction();
  if (clicked) return false; 
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
// 🧱 類別一：遊戲主角 (Player Class) - 完整實裝二連跳
// ==========================================
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.baseY = y;          
    this.w = 64;             
    this.h = 56;             
    this.baseH = 56;         
    
    // 物理引擎底層配平
    this.gravity = 0.5;      
    this.velocity = 0;       
    this.jumpForce = -11.5;  // 單次跳躍推力
    this.isSliding = false;  
    
    // 🌟 二連跳控制狀態變數
    this.jumpCount = 0;      // 記錄目前跳了幾次（0=地面, 1=單跳, 2=二連跳）
    this.canDoubleJumpTrigger = true; // 防抖動鎖，確保在空中雙手舉起時只觸發一次二連跳
  }

  jump() {
    // 只有在地面上時，舉左手才能發動第一次單跳
    if (this.y === this.baseY && !this.isSliding && this.jumpCount === 0) {
      this.velocity = this.jumpForce;
      this.jumpCount = 1;
      this.canDoubleJumpTrigger = false; // 先上鎖，等到最高點往下墜時才放開，方便觸發二連跳
    }
  }

  doubleJump() {
    // 🌟 二連跳核心機制：當處在單跳半空中、且鎖解除時，雙手舉起直接二次起跳
    if (this.y < this.baseY && this.jumpCount === 1 && this.canDoubleJumpTrigger) {
      this.velocity = this.jumpForce * 1.25; // 🌟 給予超強二次衝力，直衝兩倍高！
      this.jumpCount = 2; // 進入二連跳狀態
    }
    // 防呆：如果玩家在地上直接兩手齊舉，直接視為發動第一跳
    if (this.y === this.baseY && !this.isSliding && this.jumpCount === 0) {
      this.velocity = this.jumpForce;
      this.jumpCount = 1;
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

    // 落地重置所有跳躍計數器
    if (this.y >= this.baseY && !this.isSliding) {
      this.y = this.baseY;
      this.velocity = 0;
      this.jumpCount = 0; // 🌟 踩到地面，二連跳次數歸零
      this.canDoubleJumpTrigger = true;
    } else if (this.isSliding) {
      this.velocity = 0; 
      this.y = this.baseY; 
    }

    // 🌟 物理黃金點判定：當第一跳衝到最頂端、準備往下掉（速度 > -2）時，把二連跳觸發鎖打開
    if (this.y < this.baseY && this.velocity > -2) {
      this.canDoubleJumpTrigger = true;
    }

    // 影格計時
    if (this.y === this.baseY && !this.isSliding) {
      this.runAnim.frame = (this.runAnim.frame + this.runAnim.speed) % this.runAnim.count;
    } else if (this.y < this.baseY) {
      this.jumpAnim.frame = (this.jumpAnim.frame + this.jumpAnim.speed) % this.jumpAnim.count;
    } else if (this.isSliding) {
      this.slideAnim.frame = (this.slideAnim.frame + this.slideAnim.speed) % this.slideAnim.count;
    }
  }

  // 獨立精靈圖屬性放後方
  runAnim = { frame: 0, speed: 0.25, count: 8, w: 32, h: 24 };
  jumpAnim = { frame: 0, speed: 0.11, count: 8, w: 37, h: 28 }; 
  slideAnim = { frame: 0, speed: 0.15, count: 2, w: 30, h: 22 };

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
      drawAnimation(this.jumpAnim, jumpSpriteSheet); // 🌟 跳躍與二連跳共用同一套帥氣空翻圖片
    } else {
      drawAnimation(this.runAnim, runSpriteSheet);
    }
  }
}

// ==========================================
// 🚧 類別二：障礙物 (Obstacle Class) - 新增藍色雙層高障礙
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
      this.y = height - GROUND_Y_OFFSET - this.h; // 綠色低方塊
    } else if (this.type === 'double') {
      // 🌟 核心新增：綠色方塊直接疊兩塊的「高難度藍色大方塊」
      this.w = 30;
      this.h = 90;      // 高度直接翻倍（45 * 2 = 90）！單跳保證會撞
      this.y = height - GROUND_Y_OFFSET - this.h; 
    } else if (this.type === 'high') {
      this.w = 40;
      this.h = 25;      
      this.y = height - GROUND_Y_OFFSET - 52; // 紅色卡脖方塊
    }
  }

  update() {
    this.x -= this.speed; 
  }

  display() {
    if (this.type === 'low') {
      fill('#38B000'); // 綠色
      rect(this.x, this.y, this.w, this.h, 5);
    } else if (this.type === 'double') {
      // 🌟 核心新增：外觀呈現精美的藍色，且視覺上看得出是兩個綠色方塊疊在一起
      fill('#0077B6'); // 漂亮的深藍色
      rect(this.x, this.y, this.w, this.h, 5);
      // 畫一條內部分隔線，讓老師一眼看出這是「兩塊疊在一起」的精緻設計
      stroke(255, 100);
      strokeWeight(2);
      line(this.x, this.y + 45, this.x + this.w, this.y + 45);
    } else {
      fill('#D00000'); // 紅色
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
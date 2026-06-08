// --- 全域變數設定 ---
let capture;
let handPose;
let hands = [];

// --- 角色精靈圖片 ---
let runSpriteSheet;   // 跑步動畫
let jumpSpriteSheet;  // 跳躍動畫
let slideSpriteSheet; // 滑行動畫

// --- 🎮 針對體感延遲優化後的遊戲設定常數 ---
const HAND_RAISE_THRESHOLD = 0.45; // 舉手判定的閾值 (y軸百分比，越小需要舉越高)
const OBSTACLE_MIN_INTERVAL = 140; // 提高間隔（原本 80）：讓障礙物與障礙物之間距離拉開，手比較不酸
const OBSTACLE_MAX_INTERVAL = 220; // 提高間隔（原本 150）：給玩家充足的反應和放下手的時間
const GROUND_Y_OFFSET = 100;       // 地板線距離底部的高度
const PLAYER_START_X = 150;        // 往右移一點（原本 100）：讓主角離左邊螢幕遠一點，增加反應時間
const PLAYER_START_Y_OFFSET = 150; // 玩家初始 Y 座標 (相對地板)

// 遊戲物件變數
let player;
let obstacles = [];
let score = 0;
let gameOver = false;
let nextObstacleFrame = 0;
let modelLoaded = false; // 新增一個旗標來追蹤模型是否載入完成

// 控制狀態文字
let debugMessage = "正在載入資源...";

// 圖片載入失敗時的回呼函式，會在控制台印出明確錯誤
function imageLoadError(path) {
  console.error(`圖片載入失敗！請檢查這個檔案的路徑和檔名是否完全正確: ${path}`);
}

function preload() {
  console.log("Preload: 正在載入圖片...");
  // 根據您的需求載入所有動畫圖，並加入成功/失敗的偵錯訊息
  const runPath = '資料夾1/dash.png';
  const jumpPath = '資料夾1/jump.png';
  const slidePath = '資料夾1/stand.png';

  runSpriteSheet = loadImage(runPath, () => console.log(`✅ ${runPath} 載入成功`), () => imageLoadError(runPath));
  jumpSpriteSheet = loadImage(jumpPath, () => console.log(`✅ ${jumpPath} 載入成功`), () => imageLoadError(jumpPath));
  slideSpriteSheet = loadImage(slidePath, () => console.log(`✅ ${slidePath} 載入成功`), () => imageLoadError(slidePath));
  console.log("Preload: 所有圖片載入函式已呼叫。");
}

// 當 handPose 模型成功載入後，這個回呼函式會被執行
function modelReady() {
  console.log("HandPose Model Ready!");
  modelLoaded = true; // 將旗標設為 true
  debugMessage = "模型載入成功！請將手掌放入鏡頭。";
  // 模型準備好後才開始偵測
  handPose.detectStart(capture, gotHands);
}

function setup() {
  console.log("Setup: 函式開始執行。");
  createCanvas(windowWidth, windowHeight);

  // 啟動攝影機並設定鏡像
  capture = createCapture(VIDEO, { flipped: true });
  capture.size(640, 480);
  capture.hide();
 
  // 將模型初始化移至 setup()，並使用回呼函式，這是更穩健的做法
  debugMessage = "正在載入 AI 模型，請稍候...";
  handPose = ml5.handPose(capture, { flipped: true }, modelReady);

  // 初始化遊戲主角 (給予初始 X, Y 座標)
  player = new Player(PLAYER_START_X, height - PLAYER_START_Y_OFFSET);
  console.log("Setup: 函式執行完畢。");
}

function draw() {
  background('#C9ADA1'); // 溫暖的背景底色

  // 將地板線移到前面繪製，這樣角色和障礙物才能顯示在線的上方
  stroke(255);
  strokeWeight(4);
  line(0, height - GROUND_Y_OFFSET, width, height - GROUND_Y_OFFSET); // 地板線

  // --- 1. 繪製攝影機畫面 (佔畫面的右半邊置中) ---
  // 只有在模型載入後才顯示攝影機，避免畫面閃爍
  if (modelLoaded) {
  const videoWidth = width * 0.4;
  const videoHeight = height * 0.4;
  const videoX = width * 0.55; // 移到右側
  const videoY = (height - videoHeight) / 2;

  // 因為 createCapture 已經設定了 flipped: true，這裡直接畫出來就是鏡像的
  image(capture, videoX, videoY, videoWidth, videoHeight);
  }

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

    // 🌟 核心判斷：當手掌高度高於攝影機畫面的閾值以上，就算「舉手」
    if (wrist.y < capture.height * HAND_RAISE_THRESHOLD) { 
      // 根據 ml5.js 偵測這隻手是左手還是右手
      if (hand.handedness === 'Left') {
        leftHandUp = true;
      } else if (hand.handedness === 'Right') {
        rightHandUp = true;
      }
    }
  }

  // --- 3. 根據雙手狀態觸發遊戲動作 ---
  // 只有在模型載入完成且遊戲未結束時才執行遊戲邏輯
  // 🌟 暫時修改以進行除錯：我們先繞過 AI 模型載入檢查，強制遊戲運行
  // 這樣可以驗證角色繪製本身是否正常。
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
      if (hands.length > 0) debugMessage = "雙手放低：正常奔跑";
      player.slide(false);
    }

    // 先更新主角的狀態（位置、動畫幀等）
    player.update();

    // --- 4. 障礙物管理系統 ---
    if (frameCount > nextObstacleFrame) {
      let type = random(['high', 'low']); 
      obstacles.push(new Obstacle(type));
      nextObstacleFrame = frameCount + random(OBSTACLE_MIN_INTERVAL, OBSTACLE_MAX_INTERVAL); 
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].update();
      obstacles[i].display(); // 先繪製障礙物

      // 檢查碰撞
      if (obstacles[i].hits(player)) {
        gameOver = true;
      }

      // 計分機制
      if (obstacles[i].x + obstacles[i].w < player.x && !obstacles[i].passed) {
        score += 10;
        obstacles[i].passed = true;
      }

      // 刪除出界障礙物
      if (obstacles[i].x < -50) {
        obstacles.splice(i, 1);
      }
    }

    // 最後繪製主角，確保它顯示在所有障礙物的最上層
    player.display();
  } else if (gameOver) { // 只有在遊戲結束時才顯示 Game Over
    // 加上半透明黑色遮罩，讓 GAME OVER 文字更清楚
    fill(0, 0, 0, 150); // 半透明黑色
    noStroke();
    rect(0, 0, width, height);

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
  // 視窗大小改變時，同步更新角色的地面基準線
  if (player) {
    player.baseY = height - PLAYER_START_Y_OFFSET;
    if (!player.isSliding && player.y >= player.baseY) {
      player.y = player.baseY;
    }
  }
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
    
    // 二連跳控制變數
    this.jumpCount = 0;      
    this.maxJumps = 2;       
    this.canDoubleJumpTrigger = true; 

    // --- 動畫相關屬性 ---
    // 修正：使用整數寬度進行裁切，避免小數錯誤
    // 跑步動畫 (259 / 8 ≈ 32)
    this.runAnim = { frame: 0, speed: 0.25, count: 8, w: 32, h: 24 };
    // 跳躍動畫 (299 / 8 ≈ 37)
    this.jumpAnim = { frame: 0, speed: 0.2, count: 8, w: 37, h: 28 };
    // 滑行動畫 (61 / 2 ≈ 30)
    this.slideAnim = { frame: 0, speed: 0.15, count: 2, w: 30, h: 22 };
  }

  jump() {
    // 跳躍時重置跳躍動畫的起始幀，看起來更自然
    if (this.jumpCount === 0) {
      this.jumpAnim.frame = 0;
    }
    if (this.y === this.baseY && !this.isSliding && this.jumpCount === 0) {
      this.velocity = this.jumpForce;
      this.jumpCount = 1;
      this.canDoubleJumpTrigger = false; 
    }
  }

  doubleJump() {
    if (this.y < this.baseY && this.jumpCount === 1 && this.canDoubleJumpTrigger) {
      this.velocity = this.jumpForce * 0.85; 
      this.jumpCount = 2;
    }
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

    if (this.y >= this.baseY && !this.isSliding) {
      this.y = this.baseY;
      this.velocity = 0;
      this.jumpCount = 0; 
      this.canDoubleJumpTrigger = true; 
    } else if (this.isSliding) {
      this.velocity = 0; 
    }

    if (this.y < this.baseY && this.velocity > -2) {
      this.canDoubleJumpTrigger = true;
    }

    // 根據不同狀態更新對應的動畫幀
    if (this.y === this.baseY && !this.isSliding) {
      // 狀態: 跑步
      this.runAnim.frame = (this.runAnim.frame + this.runAnim.speed) % this.runAnim.count;
    } else if (this.y < this.baseY) {
      // 狀態: 在空中 (跳躍)
      this.jumpAnim.frame = (this.jumpAnim.frame + this.jumpAnim.speed) % this.jumpAnim.count;
    } else if (this.isSliding) {
      // 狀態: 滑行
      this.slideAnim.frame = (this.slideAnim.frame + this.slideAnim.speed) % this.slideAnim.count;
    }
  }

  display() {
    // 終極除錯：我們先忽略所有圖片和動畫，只畫一個明亮的方塊
    // 如果這個方塊能正常出現並進行遊戲，就代表 player 的位置、大小、碰撞邏輯都沒問題。
    // 問題就 100% 出在圖片載入或繪製的環節。
    fill(255, 0, 255); // 明亮的洋紅色
    noStroke();
    rect(this.x, this.y, this.w, this.h);
  }
}

// ==========================================
// 🚧 類別二：障礙物 (Obstacle Class)
// ==========================================
class Obstacle {
  constructor(type) {
    this.type = type; 
    this.x = width;
    this.speed = 4.5;   // 降速（原本 8）：讓障礙物飄得慢一些，完美抵消體感延遲
    this.passed = false;

    if (this.type === 'low') {
      this.w = 30;
      this.h = 45;      // 微調高度（原本 50）：稍微矮一點更貼心
      this.y = height - GROUND_Y_OFFSET - this.h; 
    } else if (this.type === 'high') {
      this.w = 40;
      this.h = 40;
      this.y = height - GROUND_Y_OFFSET - 95; 
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
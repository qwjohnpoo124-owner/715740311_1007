// ===================== 參數設定 =====================

// 氣球數量：畫面上固定維持 25 個
const BALLOON_COUNT = 25;

// 畫布背景色 caf0f8，透明度 80%
// 背景每幀以半透明方式覆蓋，會產生淡淡的殘影拖尾效果
// 如果不想要殘影，把 BG_ALPHA_PERCENT 改成 100 即可
const BG_COLOR = '#caf0f8';
const BG_ALPHA_PERCENT = 80;
// 換算成 p5.js 使用的 0~255 alpha 值
// （這裡用一般數學運算，因為 p5 的 map() 在 setup 之前還不能使用）
const BG_ALPHA = BG_ALPHA_PERCENT / 100 * 255;

// 氣球顏色色票
const PALETTE = [
  '#01befe', '#ffdd00', '#ff7d00', '#ff006d', '#adff02', '#8f00ff'
];

// 氣球寬度範圍（沿用先前 150~250），高度依寬高比 4:6 計算
const WIDTH_MIN = 150;
const WIDTH_MAX = 250;
// 氣球寬高比：寬:高 在 4:6 ~ 5:6 之間隨機（高固定為 6，寬在 4~5 之間隨機）
const RATIO_W_MIN = 4;
const RATIO_W_MAX = 5;
const RATIO_H = 6;

// 氣球透明度範圍（百分比 85%~100%）
const ALPHA_MIN = 85;
const ALPHA_MAX = 100;

// 上升速度範圍 10~30，SPEED_SCALE 為換算成「每幀移動像素」的係數
const SPEED_MIN = 10;
const SPEED_MAX = 30;
const SPEED_SCALE = 0.1;

// 左右輕微飄動：擺動幅度（像素）與擺動速度範圍
const SWAY_AMP_MIN = 10;
const SWAY_AMP_MAX = 25;
const SWAY_SPEED_MIN = 0.01;
const SWAY_SPEED_MAX = 0.03;

// 綁結與線條設定
const KNOT_SIZE = 14;      // 綁結（小三角形）大小
const STRING_LENGTH = 110; // 線條長度
const STRING_SEGMENTS = 12; // 線條分成幾段來畫（段數越多越平滑）

// 星星設定
const STAR_OFFSET = 0.45;     // 星星中心相對氣球半寬／半高的偏移比例（越大越靠近邊緣）
const STAR_SIZE_RATIO = 0.10; // 星星外半徑 = 氣球寬度 × 此比例（0.10 時不會超出氣球）

// 存放所有氣球的陣列
let balloons = [];

// 音效設定（需要 p5.sound 函式庫，音檔放在專案根目錄）
const BGM_FILE = 'mixkit-game-level-music-689.mp3'; // 背景音樂
const POP_SFX_FILE = 'balloon-pop-36589.mp3';       // 氣球爆破音效
const BGM_VOLUME = 0.4; // 背景音樂音量（0~1）
const SFX_VOLUME = 0.8; // 爆破音效音量（0~1）

let bgm;            // 背景音樂物件
let popSfx;         // 爆破音效物件
let audioStarted = false; // 瀏覽器規定要使用者互動後才能播放聲音，用來記錄是否已開始播放
let soundOn = true;       // 音效開關狀態：true = 開啟，false = 靜音（背景音樂與爆破音效一起控制）

// 音效開關按鈕設定（位於畫面右上角）
const BTN_W = 120;      // 按鈕寬度
const BTN_H = 44;       // 按鈕高度
const BTN_MARGIN = 20;  // 與畫面邊緣的距離

// 爆破設定（單位：毫秒）
const POP_PERIOD = 1000;  // 每 1 秒為一個週期
const POPS_PER_PERIOD = 2; // 每個週期爆破 2 顆氣球
// 兩顆平均分散在這 1 秒內（每隔 0.5 秒爆一顆），所以不會同時爆破
const POP_INTERVAL = POP_PERIOD / POPS_PER_PERIOD;
const PARTICLE_COUNT = 24; // 每次爆破產生的碎片數量

// 爆破特效與計時用的變數
let particles = [];   // 所有碎片
let shockwaves = [];  // 所有擴散的衝擊圈
let nextPopTime = 0;  // 下一次爆破的時間點

// ===================== 氣球類別 =====================
class Balloon {
  constructor(initial) {
    this.reset(initial);
  }

  // 重設（或初始化）氣球的各項屬性
  // initial 為 true 時，氣球隨機分佈在整個畫面；否則從畫面下方進入
  reset(initial = false) {
    // 氣球寬度隨機；寬高比在 4:6 ~ 5:6 之間隨機，再換算出高度
    this.w = random(WIDTH_MIN, WIDTH_MAX);
    const ratioW = random(RATIO_W_MIN, RATIO_W_MAX);
    this.h = this.w * RATIO_H / ratioW;

    // 氣球水平中心位置（擺動時以此為基準左右移動）
    this.baseX = random(width);
    this.x = this.baseX;

    // 垂直位置：初始時隨機分佈，重生時放在畫面下方外側
    this.y = initial ? random(height) : height + this.h / 2;

    // 上升速度
    this.speed = random(SPEED_MIN, SPEED_MAX);

    // 左右擺動參數：幅度、速度、起始相位（讓每顆氣球擺動不同步）
    this.swayAmp = random(SWAY_AMP_MIN, SWAY_AMP_MAX);
    this.swaySpeed = random(SWAY_SPEED_MIN, SWAY_SPEED_MAX);
    this.phase = random(TWO_PI);

    // 氣球顏色：從色票隨機挑選，並套用 85%~100% 的透明度
    const c = color(random(PALETTE));
    c.setAlpha(map(random(ALPHA_MIN, ALPHA_MAX), 0, 100, 0, 255));
    this.col = c;
  }

  // 每幀更新位置
  update() {
    // 往上飄
    this.y -= this.speed * SPEED_SCALE;

    // 左右輕微飄動：用 sin 函式讓 x 在基準位置左右來回
    this.x = this.baseX + sin(frameCount * this.swaySpeed + this.phase) * this.swayAmp;

    // 氣球連同線條都飄出畫面頂端後，從下方重新產生，維持 25 個
    if (this.y + this.h / 2 + STRING_LENGTH < 0) {
      this.reset(false);
    }
  }

  // 繪製氣球（線條、綁結、氣球本體）
  show() {
    const knotY = this.y + this.h / 2; // 綁結位置 = 氣球底部

    // ---- 1. 飄動的線條 ----
    // 從綁結往下畫，每一段依 sin 函式左右偏移，並隨時間變化產生飄動感
    noFill();
    stroke(90, 90, 100, 200); // 灰色線條
    strokeWeight(2);
    beginShape();
    for (let i = 0; i <= STRING_SEGMENTS; i++) {
      const t = i / STRING_SEGMENTS;                // 0（綁結處）~ 1（線尾端）
      const py = knotY + KNOT_SIZE + t * STRING_LENGTH;
      // 越往下擺動幅度越大；frameCount 讓波浪隨時間流動
      const offset = sin(frameCount * 0.08 + this.phase + t * 4) * 12 * t;
      curveVertex(this.x + offset, py);
      // curveVertex 需要重複首尾點才能畫出完整曲線
      if (i === 0 || i === STRING_SEGMENTS) {
        curveVertex(this.x + offset, py);
      }
    }
    endShape();

    // ---- 2. 氣球下方的綁結（小三角形）----
    noStroke();
    fill(this.col);
    triangle(
      this.x, knotY - 2,                          // 上方尖端（貼近氣球底部）
      this.x - KNOT_SIZE / 2, knotY + KNOT_SIZE,  // 左下角
      this.x + KNOT_SIZE / 2, knotY + KNOT_SIZE   // 右下角
    );

    // ---- 3. 氣球本體（橢圓，寬高比 4:6，無框線）----
    noStroke();
    fill(this.col);
    ellipse(this.x, this.y, this.w, this.h);

    // ---- 4. 氣球右上方的星星 ----
    // 星星中心放在橢圓右上方：距離中心 45% 半寬、45% 半高的位置
    const starX = this.x + (this.w / 2) * STAR_OFFSET;
    const starY = this.y - (this.h / 2) * STAR_OFFSET;
    // 星星外半徑 = 氣球寬度的 10%，經計算整顆星星都會落在橢圓範圍內，不會超出氣球
    const starR = this.w * STAR_SIZE_RATIO;
    noStroke();
    fill(255, 255, 255, 230); // 白色星星，略微透明
    drawStar(starX, starY, starR, starR * 0.45, 5);
  }
}

// 繪製星星：以 (cx, cy) 為中心，外圈半徑 outerR、內圈半徑 innerR，npoints 個角
function drawStar(cx, cy, outerR, innerR, npoints) {
  const angle = TWO_PI / npoints;
  const half = angle / 2;
  beginShape();
  // 從正上方（-HALF_PI）開始，外圈點與內圈點交替連接
  for (let a = -HALF_PI; a < TWO_PI - HALF_PI; a += angle) {
    vertex(cx + cos(a) * outerR, cy + sin(a) * outerR);              // 外圈尖角
    vertex(cx + cos(a + half) * innerR, cy + sin(a + half) * innerR); // 內圈凹點
  }
  endShape(CLOSE);
}

// ===================== 爆破特效 =====================

// 碎片：爆破時往四面八方飛散，受重力下墜並逐漸消失
class Particle {
  constructor(x, y, col) {
    this.x = x;
    this.y = y;
    // 隨機方向與速度
    const a = random(TWO_PI);
    const s = random(3, 11);
    this.vx = cos(a) * s;
    this.vy = sin(a) * s;
    this.size = random(8, 22);
    this.life = 1;                        // 生命值 1 → 0，同時用來控制透明度
    this.decay = random(0.02, 0.04);      // 每幀減少的生命值
    // 沿用被爆破氣球的顏色（複製一份，避免被修改）
    this.col = color(red(col), green(col), blue(col));
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.25;   // 重力
    this.vx *= 0.98;   // 空氣阻力
    this.life -= this.decay;
  }

  show() {
    noStroke();
    const c = color(red(this.col), green(this.col), blue(this.col), this.life * 255);
    fill(c);
    circle(this.x, this.y, this.size * this.life);
  }

  isDead() {
    return this.life <= 0;
  }
}

// 衝擊圈：從爆破點向外擴散的圓環
class Shockwave {
  constructor(x, y, maxR, col) {
    this.x = x;
    this.y = y;
    this.r = 0;
    this.maxR = maxR;  // 最大半徑，依氣球大小決定
    this.col = col;
  }

  update() {
    // 越接近最大半徑擴散越慢
    this.r += (this.maxR - this.r) * 0.2 + 1;
  }

  show() {
    const t = this.r / this.maxR;                 // 擴散進度 0 → 1
    noFill();
    stroke(red(this.col), green(this.col), blue(this.col), (1 - t) * 255);
    strokeWeight(6 * (1 - t) + 1);
    circle(this.x, this.y, this.r * 2);
  }

  isDead() {
    return this.r >= this.maxR - 2;
  }
}

// 爆破一顆氣球：產生碎片與衝擊圈，並讓該氣球從下方重生，維持 25 個
function popBalloon() {
  // 只挑選目前在畫面內的氣球，才看得到爆破效果
  const visible = balloons.filter(b =>
    b.x > 0 && b.x < width && b.y + b.h / 2 > 0 && b.y - b.h / 2 < height
  );
  if (visible.length === 0) return;

  const b = random(visible);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle(b.x, b.y, b.col));
  }
  shockwaves.push(new Shockwave(b.x, b.y, b.w * 0.8, b.col));

  // 播放爆破音效（需已啟動音訊；每次爆破都會播放，可重疊）
  if (audioStarted && soundOn && popSfx) {
    popSfx.play();
  }

  b.reset(false); // 氣球消失，並從畫面下方重新生成一顆新的
}

// 啟動音訊並開始循環播放背景音樂
// 瀏覽器的自動播放限制：必須等使用者點擊或按鍵後才能出聲
function startAudio() {
  if (audioStarted) return;
  userStartAudio(); // 解除瀏覽器對音訊的封鎖
  bgm.setVolume(BGM_VOLUME);
  bgm.loop();       // 循環播放背景音樂
  audioStarted = true;
}

// 取得按鈕左上角座標（隨視窗大小，固定貼齊右上角）
function getButtonPos() {
  return { x: width - BTN_W - BTN_MARGIN, y: BTN_MARGIN };
}

// 判斷滑鼠是否在按鈕範圍內
function isOverButton() {
  const p = getButtonPos();
  return mouseX >= p.x && mouseX <= p.x + BTN_W &&
         mouseY >= p.y && mouseY <= p.y + BTN_H;
}

// 切換音效開關
// 做法刻意保持簡單：不去改任何音量，只控制「播不播放」，避免音量被卡在 0 而恢復不了
//   - 關閉：停止背景音樂；爆破音效因 soundOn 為 false 而不播放
//   - 開啟：背景音樂從頭重新循環播放；爆破音效恢復播放
function toggleSound() {
  soundOn = !soundOn;

  if (soundOn) {
    bgm.loop();  // 重新開始循環播放背景音樂
  } else {
    bgm.stop();  // 停止背景音樂
  }
}

// 使用者點擊畫面時：點到按鈕就切換開關，否則啟動音樂
function mousePressed() {
  if (isOverButton()) {
    // 若音樂還沒開始，點按鈕也會先啟動音訊（此時維持開啟狀態，不切換）
    if (!audioStarted) {
      startAudio();
    } else {
      toggleSound();
    }
    return;
  }
  startAudio();
}

// 使用者按下任意鍵可啟動音樂；按 M 鍵可切換音效開關
function keyPressed() {
  if ((key === 'm' || key === 'M') && audioStarted) {
    toggleSound();
    return;
  }
  startAudio();
}

// 繪製音效開關按鈕（圓角矩形 + 文字，滑過時顏色變亮）
function drawSoundButton() {
  const p = getButtonPos();
  const hover = isOverButton();

  noStroke();
  // 開啟時用綠色，靜音時用紅色；滑鼠移上去時透明度提高
  if (soundOn) {
    fill(40, 160, 90, hover ? 255 : 210);
  } else {
    fill(200, 60, 70, hover ? 255 : 210);
  }
  rectMode(CORNER);
  rect(p.x, p.y, BTN_W, BTN_H, 22);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text(soundOn ? '🔊 音效開' : '🔇 音效關', p.x + BTN_W / 2, p.y + BTN_H / 2);

  // 滑鼠移到按鈕上時顯示手指游標
  cursor(hover ? HAND : ARROW);
}

// 在音樂尚未開始時，於畫面中央顯示提示文字
function drawAudioHint() {
  if (audioStarted) return;
  noStroke();
  fill(0, 0, 0, 140);
  rectMode(CENTER);
  rect(width / 2, height / 2, 600, 70, 14);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(24);
  text('點擊畫面開始播放音樂（按 M 鍵可開關音效）', width / 2, height / 2);
  rectMode(CORNER); // 還原預設，避免影響其他繪圖
}

// ===================== p5.js 主要函式 =====================

// 預先載入音檔，確保 setup 與 draw 開始前就已載入完成
function preload() {
  bgm = loadSound(BGM_FILE);
  popSfx = loadSound(POP_SFX_FILE);
  popSfx.setVolume(SFX_VOLUME);
}

// 初始化：建立全螢幕畫布，並產生 25 個氣球
function setup() {
  createCanvas(windowWidth, windowHeight);
  for (let i = 0; i < BALLOON_COUNT; i++) {
    balloons.push(new Balloon(true));
  }
  // 初始化爆破計時：0.5 秒後爆破第一顆
  nextPopTime = millis() + POP_INTERVAL;
}

// 每幀執行：先以半透明背景覆蓋，再更新並繪製所有氣球與爆破特效
function draw() {
  const bg = color(BG_COLOR);
  bg.setAlpha(BG_ALPHA);
  background(bg);

  // ---- 爆破計時 ----
  // 每隔固定間隔（0.5 秒）爆破一顆，等於每 1 秒爆破 2 顆，且不會同時爆破，也不會加速
  const now = millis();
  if (now >= nextPopTime) {
    popBalloon();
    nextPopTime += POP_INTERVAL; // 以固定節奏累加，避免誤差累積
    // 若分頁被切到背景造成延遲，直接從現在重新計時，避免一次補爆多顆
    if (nextPopTime < now) nextPopTime = now + POP_INTERVAL;
  }

  // ---- 更新並繪製氣球 ----
  for (const b of balloons) {
    b.update();
    b.show();
  }

  // ---- 更新並繪製爆破特效，結束的就移除 ----
  for (const s of shockwaves) {
    s.update();
    s.show();
  }
  shockwaves = shockwaves.filter(s => !s.isDead());

  for (const p of particles) {
    p.update();
    p.show();
  }
  particles = particles.filter(p => !p.isDead());

  // ---- 音樂尚未啟動時顯示提示 ----
  drawAudioHint();

  // ---- 繪製音效開關按鈕（最上層）----
  drawSoundButton();
}

// 視窗大小改變時，畫布跟著調整，維持全螢幕
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
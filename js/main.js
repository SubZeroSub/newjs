// js/main.js — ПОЛНЫЙ ФИНАЛЬНЫЙ РАБОЧИЙ КОД

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";

// 3D: Летающие настоящие карты
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a001f);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 8;
const renderer = new THREE.WebGLRenderer({canvas: document.getElementById("three"), alpha: true, antialias: true});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

// --- Postprocessing: chromatic aberration + scanlines (fullscreen shader pass)
const renderTarget = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {depthBuffer: true});
const postScene = new THREE.Scene();
const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadGeo = new THREE.PlaneGeometry(2, 2);

const postUniforms = {
  tDiffuse: { value: renderTarget.texture },
  time: { value: 0 },
  resolution: { value: new THREE.Vector2(innerWidth, innerHeight) },
  aberration: { value: 0.002 },
  aberration: { value: 0.0008 },
  scanIntensity: { value: 0.02 },
  scanFreq: { value: 480.0 }
};

const postMaterial = new THREE.ShaderMaterial({
  uniforms: postUniforms,
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position,1.0); }
  `,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float time;
    uniform float aberration;
    uniform float scanIntensity;
    uniform float scanFreq;

    // simple RGB offset sampling
    vec3 sampleChroma(vec2 uv){
      float a = aberration * 0.5; // reduce effect further
      vec2 offR = vec2(a, -a) * (1.0 - vUv.y*0.6);
      vec2 offB = vec2(-a, a) * (1.0 - vUv.y*0.6);
      float r = texture2D(tDiffuse, uv + offR).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv + offB).b;
      return vec3(r,g,b);
    }

    void main(){
      vec2 uv = vUv;
      // scanlines effect
      // static subtle scanlines (no time modulation)
      float scan = sin((uv.y * resolution.y / scanFreq)) * 0.5 + 0.5;
      float scanMix = mix(1.0, scan, scanIntensity);

      vec3 col = sampleChroma(uv);

      // gentle vignette
      vec2 centered = uv - 0.5;
      float vign = smoothstep(0.9, 0.4, length(centered) * 1.2);

      col *= mix(0.95, 1.0, vign);
      col *= scanMix;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false
});

const quad = new THREE.Mesh(quadGeo, postMaterial);
postScene.add(quad);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const light = new THREE.DirectionalLight(0x9d4edd, 2.5);
light.position.set(5, 10, 7);
scene.add(light);

// --- ВОЛШЕБНЫЙ ДЫМ (ОТКЛЮЧЕН) ---
// Чтобы включить дым обратно:
// 1. Раскомментируй весь код ниже (от const smokeUniforms до scene.add(smokePlane))
// 2. В animateCards() найди строку: if (typeof smokeUniforms !== 'undefined' && smokeUniforms.time)
// 3. Убедись что она раскомментирована
//
// Параметры дыма для редактирования:
// - scale: 1.0-3.0 (размер, больше = больше)
// - speed: 0.3-1.0 (скорость движения)
// - intensity: 0.2-1.0 (яркость)

/* ЗАКОММЕНТИРОВАНО - ДЫМ ОТКЛЮЧЕН
const smokeUniforms = {
  time: { value: 0 },
  resolution: { value: new THREE.Vector2(innerWidth, innerHeight) },
  scale: { value: 2.2 },
  speed: { value: 0.7 },
  intensity: { value: 0.5 }
};

const smokeMaterial = new THREE.ShaderMaterial({
  uniforms: smokeUniforms,
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform float time;
    uniform vec2 resolution;
    uniform float scale;
    uniform float speed;
    uniform float intensity;

    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453123); }
    float noise(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
    }
    float fbm(vec2 p){
      float v = 0.0; float a = 0.5;
      for(int i=0;i<5;i++){
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    void main(){
      vec2 uv = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0) * scale;
      float t = time * speed;
      float n = fbm(uv + vec2(t*0.5, t*0.2));
      n += 0.5 * fbm(uv * 2.0 + vec2(t*0.8, -t*0.4));
      n += 0.3 * fbm(uv * 4.0 + vec2(-t*0.6, t*0.3));
      n = clamp(n, 0.0, 1.0);

      // Magical gradient: deep purple -> violet -> gold
      vec3 purpleTone = mix(vec3(0.4,0.1,0.8), vec3(0.8,0.2,1.0), n);
      vec3 goldTone = vec3(1.0,0.85,0.3);
      vec3 col = mix(purpleTone, goldTone, smoothstep(0.3, 0.8, n));
      
      // Add pulsing glow
      float glow = pow(sin(t + n*3.14159)*0.5+0.5, 2.0) * 0.3;
      col += vec3(0.9,0.3,1.0) * glow;
      
      float alpha = smoothstep(0.2, 0.7, n) * intensity * 0.85;

      gl_FragColor = vec4(col, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: THREE.NormalBlending
});

const smokePlane = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), smokeMaterial);
smokePlane.position.set(0, 0, 1.5);
smokePlane.renderOrder = 10;
scene.add(smokePlane);
*/

const loader = new THREE.TextureLoader();

const suits = ['clubs', 'diamonds', 'hearts', 'spades'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const cardsBaseUrl = 'assets/cards/';

const cardGeometry = new THREE.PlaneGeometry(0.8, 1.2);

const cards = [];

suits.forEach(suit => {
  ranks.forEach(rank => {
    const filename = `${suit}_${rank}.png`;
    const texture = loader.load(cardsBaseUrl + filename);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      metalness: 0.3,
      roughness: 0.7,
      emissive: 0x9d4edd,
      emissiveIntensity: 0.3
    });

    const mesh = new THREE.Mesh(cardGeometry, material);

    const radius = 3 + Math.random() * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    mesh.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );

    mesh.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);

    mesh.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.008,
      (Math.random() - 0.5) * 0.008,
      (Math.random() - 0.5) * 0.008
    );

    scene.add(mesh);
    cards.push(mesh);
  });
});

let mouseX = 0, mouseY = 0;
addEventListener("mousemove", e => {
  mouseX = (e.clientX / innerWidth - 0.5) * 5;
  mouseY = (e.clientY / innerHeight - 0.5) * 5;
});

// --- Motion Parallax (CSS layers) ---
const parallaxTargets = [
  {el: document.getElementById('overlay'), factor: 0.06},
  {el: document.getElementById('three'), factor: 0.03},
  {el: document.getElementById('stars'), factor: 0.02},
  {el: document.querySelector('.cards'), factor: 0.09}
];
let px = 0, py = 0, tx = 0, ty = 0;
addEventListener('mousemove', e => {
  tx = (e.clientX / innerWidth - 0.5) * 2;
  ty = (e.clientY / innerHeight - 0.5) * 2;
});
function rafParallax(){
  px += (tx - px) * 0.08;
  py += (ty - py) * 0.08;
  parallaxTargets.forEach(t => {
    if (!t.el) return;
    const dx = px * (t.factor * 100);
    const dy = py * (t.factor * 100);
    t.el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  });
  requestAnimationFrame(rafParallax);
}
rafParallax();

// --- Scroll-driven timeline & reveal ---
let scrollTarget = window.scrollY, scrollPos = window.scrollY;
addEventListener('scroll', () => { scrollTarget = window.scrollY; });
function rafScroll(){
  scrollPos += (scrollTarget - scrollPos) * 0.12;
  const hero = document.getElementById('hero');
  const cardsEl = document.querySelector('.cards');
  const max = Math.max(300, innerHeight * 0.5);
  const t = Math.min(scrollPos / max, 1);
  if (hero) {
    hero.style.transform = `translateY(${ -t * 40 }px)`;
    hero.style.opacity = String(1 - t * 0.7);
  }
  if (cardsEl) {
    // gentle rise of cards into view as you scroll
    cardsEl.style.transform = `translateY(${Math.max(0, (1 - t) * 80)}px)`;
    cardsEl.style.opacity = String(0.6 + t * 0.4);
  }

  // small parallax on three canvas to feel depth
  const threeEl = document.getElementById('three');
  if (threeEl) threeEl.style.transform = `translate3d(0, ${-t * 60}px, 0)`;

  requestAnimationFrame(rafScroll);
}
rafScroll();

function animateCards() {
  cards.forEach(card => {
    card.rotation.x += 0.006;
    card.rotation.y += 0.009;
    card.position.x += (mouseX - card.position.x * 0.2) * 0.01;
    card.position.y += (mouseY - card.position.y * 0.2) * 0.01;
    card.position.add(card.userData.velocity);
    card.material.emissiveIntensity = 0.3 + Math.sin(Date.now() * 0.001 + card.position.length()) * 0.4;
  });
  // render scene into renderTarget, then apply postprocessing shader
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  // update shader uniforms
  postUniforms.time.value = performance.now() / 1000;
  postUniforms.resolution.value.set(innerWidth, innerHeight);
  // update volumetric smoke time
  if (typeof smokeUniforms !== 'undefined' && smokeUniforms.time) smokeUniforms.time.value = performance.now() / 1000;
  renderer.render(postScene, postCamera);
  requestAnimationFrame(animateCards);
}
animateCards();

// Магический дым
function magicSmoke() {
  const s = document.getElementById("particles-canvas");
  if (!s) {
    console.error("particles-canvas not found");
    return;
  }
  const ctx = s.getContext("2d");
  if (!ctx) {
    console.error("2d context failed");
    return;
  }
  s.width = innerWidth;
  s.height = innerHeight;
  console.log("Canvas initialized:", s.width, s.height);
  
  const particles = Array.from({length: 300}, () => {
    const suits = ['♠', '♥', '♦', '♣'];
    return {
      x: Math.random() * s.width,
      y: Math.random() * s.height,
      z: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.8,
      wobble: Math.random() * Math.PI * 2,
      suit: suits[Math.floor(Math.random() * suits.length)]
    };
  });
  console.log("Particles created:", particles.length);
  
  let time = 0;
  function loop() {
    ctx.clearRect(0, 0, s.width, s.height);
    time++;
    particles.forEach(p => {
      // Вертикальное движение вниз
      p.y += p.z * 0.5;
      
      // Хаотичное горизонтальное смещение (конфети эффект)
      p.wobble += (Math.random() - 0.5) * 0.3;
      p.x += Math.sin(p.wobble) * p.z * 0.8;
      
      // Циклическое движение влево-вправо
      p.x += p.vx * (Math.sin(time * 0.02 + p.wobble) * 0.5);
      
      // Перезагрузить частицу если она упала вниз
      if (p.y > s.height) {
        p.y = -10;
        p.x = Math.random() * s.width;
      }
      
      // Граница по сторонам
      if (p.x < -20) p.x = s.width + 20;
      if (p.x > s.width + 20) p.x = -20;
      
      // Рисуем символы карточной магии вместо прямоугольников
      ctx.font = `bold ${p.z * 12}px Arial`;
      ctx.fillStyle = `rgba(200,220,255,${p.z * 0.25})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 10;
      ctx.shadowColor = `rgba(157,78,221,${p.z * 0.4})`;
      ctx.fillText(p.suit, p.x, p.y);
      ctx.shadowBlur = 0;
    });
    requestAnimationFrame(loop);
  }
  loop();
}
// disabled 2D canvas smoke in favor of GPU volumetric smoke
// Отложить вызов до полной загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    try {
      magicSmoke();
    } catch (e) {
      console.error('magicSmoke error:', e);
    }
  });
} else {
  try {
    magicSmoke();
  } catch (e) {
    console.error('magicSmoke error:', e);
  }
}

// Исчезновение заголовка при скролле
addEventListener("scroll", () => {
  if (window.scrollY > 100) {
    document.getElementById("hero").classList.add("scrolled");
  } else {
    document.getElementById("hero").classList.remove("scrolled");
  }
});

// SVG-only preloader animation (replaces canvas implementation)
function initSVGPreloader() {
  const svg = document.getElementById('preloader-svg');
  if (!svg) return;

  const group = svg.querySelector('g') || svg;
  const progressCircle = document.getElementById('progress');
  const progressText = document.getElementById('progressText');

  const totalCards = 20;
  const preloaderCards = [];

  // create SVG rects representing cards
  for (let i = 0; i < totalCards; i++) {
    // create SVG image using card texture so preloader shows real card faces
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttribute('width', 140);
    img.setAttribute('height', 200);
    img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    img.setAttribute('opacity', '0.95');
    img.style.filter = 'drop-shadow(0 10px 30px rgba(157,78,221,0.45))';

    // pick a card texture (reuse same logic as full preloader)
    const suitIndex = Math.floor(i / 13) % 4;
    const rankIndex = i % 13;
    const suit = suits[suitIndex];
    const rank = ranks[rankIndex];
    const filename = `${suit}_${rank}.png`;
    const href = cardsBaseUrl + filename;
    // set href for SVG image (compatibility)
    try { img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href); } catch(e) {}
    img.setAttribute('href', href);

    // initial random transform (will be animated)
    img.setAttribute('transform', `translate(${Math.random()*300-150}, ${Math.random()*200-100}) rotate(${Math.random()*360})`);
    group.appendChild(img);

    const angle = (i / totalCards) * Math.PI * 2;
    const distance = 120 + Math.random() * 80;

    preloaderCards.push({
      el: img,
      startX: Math.cos(angle) * distance,
      startY: Math.sin(angle) * distance,
      targetX: 0,
      targetY: 0,
      progress: 0,
      delay: i * 0.04,
      rotation: Math.random() * 360
    });
  }

  let time = 0;
  let shufflePhase = true;

  function tick() {
    time += 0.016;

    let allDone = true;

    preloaderCards.forEach(card => {
      let px = 0, py = 0;
      if (shufflePhase) {
        if (time < 2.6) {
          const ang = time * 3 + card.delay * 10;
          px = Math.cos(ang) * 110;
          py = Math.sin(ang) * 70;
          card.el.setAttribute('transform', `translate(${px}, ${py}) rotate(${(ang*50+card.rotation)%360})`);
          allDone = false;
        } else {
          shufflePhase = false;
          time = 0;
        }
      } else {
        if (time > card.delay) {
          card.progress = Math.min(card.progress + 0.02, 1);
        }
        const p = 1 - Math.pow(1 - card.progress, 3);
        px = card.startX + (card.targetX - card.startX) * p;
        py = card.startY + (card.targetY - card.startY) * p;
        const rot = (card.rotation * (1 - p)) + (p * 360 * 2);
        card.el.setAttribute('transform', `translate(${px}, ${py}) rotate(${rot % 360})`);
        if (card.progress < 1) allDone = false;
      }
    });

    // update progress UI
    const avg = preloaderCards.reduce((s,c)=>s+c.progress,0)/preloaderCards.length;
    const pct = Math.round(avg*100);
    const circumference = 2 * Math.PI * 50;
    if (progressCircle) progressCircle.style.strokeDashoffset = String(circumference * (1 - Math.min(1, avg)));
    if (progressText) progressText.textContent = `${pct}%`;
    if (avg > 0.75 && !svg.classList.contains('morphed')) svg.classList.add('morphed');

    if (!allDone) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

initSVGPreloader();

// Скрываем прелоадер
window.addEventListener("load", () => {
  const preloader = document.getElementById("preloader");
  if (preloader) {
    setTimeout(() => {
      // add final state to SVG for a smooth exit
      const svg = document.getElementById('preloader-svg');
      if (svg) svg.classList.add('done');
      setTimeout(() => preloader.classList.add("hidden"), 600);
    }, 3500); // время на анимацию
  }
});

// 8 проектов
const projects = [
  {title: "Manipulation", desc: "Искусство, где карты оживают в руках мастера.", img: "img/1.jpg", type: "mixed"},
  {title: "Stage Illusion", desc: "Грандиозные иллюзии с ассистентами и реквизитом.", img: "img/2.jpg", type: "mixed"},
  {title: "Mentalism", desc: "Магия разума — мысли читаются, будущее предсказывается.", img: "img/3.jpg", type: "mixed"},
  {title: "Close-Up Gallery", desc: "Крупный план: монеты, карты, невозможное рядом.", img: "img/4.jpg", type: "gallery"},
  {title: "Escape Acts", desc: "Побеги в стиле Гудини — цепи, вода, огонь.", img: "img/5.jpg", type: "gallery"},
  {title: "Grand Illusions", desc: "Левитация, исчезновение, пиление — классика магии.", img: "img/6.jpg", type: "gallery"},
  {title: "Levitation", desc: "Невозможное парение над сценой без опоры.", img: "img/7.jpg", type: "mixed"},
  {title: "Shadow Magic", desc: "Игра с тенями, где силуэты оживают и обманывают.", img: "img/8.jpg", type: "mixed"}
];

// Mixed контент
const mixedContent = {
  "Manipulation": [
    {type: "p", text: "Карты появляются, исчезают и меняют масть по желанию зрителя."},
    {type: "layout", direction: "left", img: "https://i.ytimg.com/vi/2vM0N3p4E1w/maxresdefault.jpg", text: "Техника, отточенная до совершенства — каждое движение обманывает глаз."},
    {type: "img", src: "https://as2.ftcdn.net/v2/jpg/08/10/01/21/1000_F_810012120_w0JuVQSkPsqTIkvdWFUx2KAs5gKNtig2.jpg"}
  ],
  "Stage Illusion": [
    {type: "p", text: "Ассистентка исчезает в ящике, появляется в другом месте зала."},
    {type: "layout", direction: "right", img: "https://c8.alamy.com/comp/G81E11/magicians-assistants-amy-berry-left-and-natalia-villalowga-stanton-G81E11.jpg", text: "Дым, вспышки и громкая музыка усиливают эффект."},
    {type: "youtube", id: "Sgg3cwl-DW0"},
    {type: "img", src: "https://ichef.bbci.co.uk/images/ic/1200xn/p08mt25p.jpg"}
  ],
  "Mentalism": [
    {type: "p", text: "Я вижу то, что вы только подумали."},
    {type: "layout", direction: "left", img: "https://www.magicianmentalist.com/wp-content/uploads/2020/06/mentalist-show.jpg", text: "Предсказания, которые сбываются на глазах у зрителей."},
    {type: "img", src: "https://www.seanalexandermagic.com/wp-content/uploads/2020/07/JIZ_1347.jpg"}
  ],
  "Levitation": [
    {type: "p", text: "Человек парит в воздухе без видимой поддержки — чистая магия."},
    {type: "youtube", id: "J4r4q_mqnx0"},
    {type: "layout", direction: "right", img: "https://i.ytimg.com/vi/J4r4q_mqnx0/maxresdefault.jpg", text: "Зрители видят со всех сторон — никаких тросов, только иллюзия."},
    {type: "img", src: "https://www.magictricks.com/assets/images/levitation/levitation2.jpg"}
  ],
  "Shadow Magic": [
    {type: "p", text: "Тени на стене оживают и рассказывают свою историю."},
    {type: "youtube", id: "0o4bL1c4n1E"},
    {type: "layout", direction: "left", img: "https://i.ytimg.com/vi/0o4bL1c4n1E/maxresdefault.jpg", text: "Простой свет — и рождается новая реальность, где силуэты обманывают разум."},
    {type: "img", src: "https://www.shadowgraphy.net/images/shadow-art.jpg"}
  ]
};

// Галереи
const galleryContent = {
  "Close-Up Gallery": [
    "https://vinc.gumlet.io/gallery/blog/catch-close-up-coin-magic-trick-637668012774767562.jpg",
    "https://blog.magicshop.co.uk/wp-content/uploads/2013/10/sleight-of-hand-techniques-coins.jpg",
    "https://m.media-amazon.com/images/I/5152a3R0HrL._AC_UF894,1000_QL80_.jpg",
    "https://vhx.imgix.net/magicmakerslearnmagic/assets/0b694197-8b3e-48e3-b8d3-3f8da226a08f.jpg",
    "https://i.ytimg.com/vi/3yYiCQHTBqk/hq720.jpg",
    "https://i.ytimg.com/vi/6SxOBAmsAeQ/sddefault.jpg"
  ],
  "Escape Acts": [
    "https://hungarytoday.hu/wp-content/uploads/2023/03/After_Harry_Houdini_jumps_off_Harvard_Bridge_in_Boston_1908-scaled-e1679648156654.jpg",
    "https://i2-prod.aberdeenlive.news/article7466941.ece/ALTERNATES/s1200b/0_Houdini-Portrait-in-Chains.jpg",
    "https://www.poolmagazine.com/wp-content/uploads/2023/07/houdini-escapes-swimming-pool.jpg"
  ],
  "Grand Illusions": [
    "https://i.ytimg.com/vi/Sgg3cwl-DW0/maxresdefault.jpg",
    "https://onmilwaukee.com/images/articles/sh/shiftswitchseebach/shiftswitchseebach_fullsize_story1.jpg",
    "https://ichef.bbci.co.uk/images/ic/1200xn/p08mt25p.jpg"
  ]
};

// Создание карточек
const cardsContainer = document.getElementById("cards");
projects.forEach(p => {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <img src="${p.img}" alt="${p.title}" loading="lazy">
    <div class="card-content">
      <h3>${p.title}</h3>
      <p>${p.desc}</p>
      <div class="badge" data-type="${p.type}" data-title="${p.title}">Открыть</div>
    </div>
  `;
  cardsContainer.appendChild(card);
});

// 3D Tilt эффект для карточек
function init3DTilt() {
  const cards = document.querySelectorAll('.card');
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.classList.add('tilt');
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.classList.remove('tilt');
    });
    
    card.addEventListener('mousemove', (e) => {
      if (!card.classList.contains('tilt')) return;
      
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / centerY * -15;
      const rotateY = (x - centerX) / centerX * 15;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(20px)`;
    });
  });
}

// Инициализация после создания карточек
init3DTilt();

// Голографический эффект
function initHologram() {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      card.style.setProperty('--holo-x', x + '%');
      card.style.setProperty('--holo-y', y + '%');
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.removeProperty('--holo-x');
      card.style.removeProperty('--holo-y');
    });
  });
}

// Параллакс звезд с глубиной
function initStarField() {
  const layers = 3;
  
  for(let layer = 0; layer < layers; layer++) {
    const starLayer = document.createElement('div');
    starLayer.className = `star-layer-${layer}`;
    starLayer.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: ${layer + 1};
    `;
    document.body.appendChild(starLayer);
    
    for(let i = 0; i < 30; i++) {
      const star = document.createElement('div');
      star.style.cssText = `
        position: absolute;
        width: ${layer + 1}px;
        height: ${layer + 1}px;
        background: #fff;
        border-radius: 50%;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        opacity: ${0.2 + layer * 0.2};
        box-shadow: 0 0 ${(layer + 1) * 2}px rgba(255,255,255,0.8);
      `;
      starLayer.appendChild(star);
    }
  }
  
  document.addEventListener('mousemove', e => {
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;
    
    for(let layer = 0; layer < layers; layer++) {
      const starLayer = document.querySelector(`.star-layer-${layer}`);
      const speed = (layer + 1) * 8;
      starLayer.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
    }
  });
}

initHologram();
initStarField();

// Анимация появления карточек
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => entry.target.classList.toggle("visible", entry.isIntersecting));
}, {threshold: 0.1});
document.querySelectorAll(".card").forEach(card => observer.observe(card));

// Модалки
const modal = document.getElementById("modal");
const lightbox = document.getElementById("lightbox");
const modalTitle = document.getElementById("mt");
const modalBody = document.getElementById("modal-body");
let currentGallery = [];
let lightboxIndex = 0;

document.addEventListener("click", e => {
  if (e.target.classList.contains("badge")) {
    const card = e.target.closest(".card");
    const title = card.querySelector("h3").textContent;
    const project = projects.find(p => p.title === title);
    modalTitle.textContent = project.title;

    if (project.type === "mixed") {
      modalBody.className = "mixed-container";
      modalBody.innerHTML = "";
      (mixedContent[project.title] || []).forEach(item => {
        if (item.type === "p") {
          const p = document.createElement("p");
          p.textContent = item.text;
          modalBody.appendChild(p);
        } else if (item.type === "img") {
          const img = document.createElement("img");
          img.src = item.src;
          img.loading = "lazy";
          modalBody.appendChild(img);
        } else if (item.type === "youtube") {
          const wrapper = document.createElement("div");
          wrapper.style.position = "relative";
          wrapper.style.paddingBottom = "56.25%";
          wrapper.style.height = "0";
          wrapper.style.margin = "60px 0";
          wrapper.style.borderRadius = "20px";
          wrapper.style.overflow = "hidden";
          wrapper.style.boxShadow = "0 0 60px rgba(157,78,221,.6)";

          const iframe = document.createElement("iframe");
          iframe.src = `https://www.youtube.com/embed/${item.id}?autoplay=1&mute=1&loop=1&playlist=${item.id}&controls=1&modestbranding=1&rel=0&fs=1&playsinline=1`;
          iframe.style.position = "absolute";
          iframe.style.top = "0";
          iframe.style.left = "0";
          iframe.style.width = "100%";
          iframe.style.height = "100%";
          iframe.style.border = "0";
          iframe.allow = "autoplay; encrypted-media; fullscreen";
          iframe.allowFullscreen = true;

          wrapper.appendChild(iframe);
          modalBody.appendChild(wrapper);
        } else if (item.type === "layout") {
          const block = document.createElement("div");
          block.style.display = "flex";
          block.style.gap = "60px";
          block.style.alignItems = "center";
          block.style.margin = "60px 0";
          block.style.flexDirection = item.direction === "right" ? "row-reverse" : "row";
          block.style.flexWrap = "wrap";
          block.style.justifyContent = "center";

          const img = document.createElement("img");
          img.src = item.img;
          img.style.maxWidth = "50%";
          img.style.borderRadius = "20px";
          img.style.boxShadow = "0 0 60px rgba(157,78,221,.5)";
          img.style.flex = "1 1 45%";

          const text = document.createElement("p");
          text.textContent = item.text;
          text.style.flex = "1 1 45%";
          text.style.fontSize = "20px";
          text.style.opacity = "0.9";

          block.appendChild(img);
          block.appendChild(text);
          modalBody.appendChild(block);
        }
      });
    } else {
      modalBody.className = "gallery-container";
      modalBody.innerHTML = "";
      currentGallery = galleryContent[project.title] || [];
      currentGallery.forEach((src, idx) => {
        const img = document.createElement("img");
        img.src = src;
        img.loading = "lazy";
        img.onclick = () => {
          lightboxIndex = idx;
          const slider = document.getElementById("lightbox-slider");
          slider.innerHTML = "";
          currentGallery.forEach(s => {
            const slide = document.createElement("div");
            slide.className = "lightbox-slide";
            const i = document.createElement("img");
            i.src = s;
            slide.appendChild(i);
            slider.appendChild(slide);
          });
          slider.style.transform = `translateX(-${lightboxIndex * 100}%)`;
          lightbox.classList.add("active");
        };
        modalBody.appendChild(img);
      });
    }
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    document.body.classList.add("modal-open");
    
    // Confetti burst effect
    createConfetti();
    // Sparkle particles
    createSparkles();
  }
});

// Confetti burst on modal open
function createConfetti() {
  const colors = ['#9d4edd', '#ffd700', '#ff3366', '#88aaff'];
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.style.position = 'fixed';
    confetti.style.width = '10px';
    confetti.style.height = '10px';
    confetti.style.borderRadius = '50%';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.left = window.innerWidth / 2 + 'px';
    confetti.style.top = window.innerHeight / 2 + 'px';
    confetti.style.pointerEvents = 'none';
    confetti.style.zIndex = '10000';
    confetti.style.boxShadow = `0 0 10px ${confetti.style.backgroundColor}`;
    document.body.appendChild(confetti);
    
    const duration = 2 + Math.random() * 1;
    const delay = Math.random() * 0.5;
    const angle = (Math.PI * 2 * i) / 50;
    const velocity = 5 + Math.random() * 8;
    
    let x = 0, y = 0, vx = Math.cos(angle) * velocity, vy = Math.sin(angle) * velocity - 3;
    const startTime = performance.now() + delay * 1000;
    
    const animate = (currentTime) => {
      if (currentTime < startTime) {
        requestAnimationFrame(animate);
        return;
      }
      const elapsed = (currentTime - startTime) / 1000;
      if (elapsed > duration) {
        confetti.remove();
        return;
      }
      x += vx;
      y += vy;
      vy += 0.15; // gravity
      confetti.style.transform = `translate(${x}px, ${y}px) rotate(${elapsed * 360}deg)`;
      confetti.style.opacity = 1 - elapsed / duration;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
}

// Sparkle particles effect
function createSparkles() {
  for (let i = 0; i < 30; i++) {
    const sparkle = document.createElement('div');
    sparkle.style.position = 'fixed';
    sparkle.style.width = '4px';
    sparkle.style.height = '4px';
    sparkle.style.backgroundColor = '#ffd700';
    sparkle.style.borderRadius = '50%';
    sparkle.style.left = window.innerWidth / 2 + 'px';
    sparkle.style.top = window.innerHeight / 2 + 'px';
    sparkle.style.pointerEvents = 'none';
    sparkle.style.zIndex = '10000';
    sparkle.style.boxShadow = '0 0 8px #ffd700';
    document.body.appendChild(sparkle);
    
    const angle = (Math.PI * 2 * i) / 30;
    const distance = 100 + Math.random() * 150;
    const duration = 1.5 + Math.random() * 1;
    
    const endX = Math.cos(angle) * distance;
    const endY = Math.sin(angle) * distance;
    
    const startTime = performance.now();
    const animate = (currentTime) => {
      const elapsed = (currentTime - startTime) / 1000;
      if (elapsed > duration) {
        sparkle.remove();
        return;
      }
      const progress = elapsed / duration;
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      sparkle.style.transform = `translate(calc(-50% + ${endX * easeProgress}px), calc(-50% + ${endY * easeProgress}px))`;
      sparkle.style.opacity = 1 - easeProgress;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
}

// Стрелки lightbox
document.querySelector(".lightbox-prev").onclick = () => {
  lightboxIndex = (lightboxIndex - 1 + currentGallery.length) % currentGallery.length;
  document.getElementById("lightbox-slider").style.transform = `translateX(-${lightboxIndex * 100}%)`;
};
document.querySelector(".lightbox-next").onclick = () => {
  lightboxIndex = (lightboxIndex + 1) % currentGallery.length;
  document.getElementById("lightbox-slider").style.transform = `translateX(-${lightboxIndex * 100}%)`;
};

// Закрытие модалок
document.querySelectorAll(".close").forEach(btn => {
  btn.onclick = () => {
    modal.classList.remove("active");
    lightbox.classList.remove("active");
    document.body.style.overflow = "";
    document.body.classList.remove("modal-open");
  };
});

// Resize
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  // update render target and post uniforms
  if (typeof renderTarget !== 'undefined' && renderTarget) renderTarget.setSize(innerWidth, innerHeight);
  if (typeof postUniforms !== 'undefined' && postUniforms.resolution) postUniforms.resolution.value.set(innerWidth, innerHeight);
  if (typeof smokeUniforms !== 'undefined' && smokeUniforms.resolution) smokeUniforms.resolution.value.set(innerWidth, innerHeight);
});
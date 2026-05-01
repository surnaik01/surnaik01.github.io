// ── Biosignal Processing System Diagram ──────────────────────────────────
const C = document.getElementById('techCanvas');
const X = C.getContext('2d');
let T = 0;

const DPR = window.devicePixelRatio || 1;
const FONT = '"IBM Plex Mono", monospace';

// Virtual coordinate space: 560 × 720
const VW = 560, VH = 720;

function setup() {
  const rect = C.getBoundingClientRect();
  C.width  = rect.width  * DPR;
  C.height = rect.height * DPR;
}

// ── Block definitions ─────────────────────────────────────────────────────
const BLOCKS = [
  // Analog front-end
  { id:'sens',    x:18,  y:52,  w:72, h:40, label:'BIO_SENS',  sub:'10µV–5V',   type:'in'  },
  { id:'inamp',   x:118, y:52,  w:80, h:40, label:'IN_AMP',    sub:'G=100×',    type:'sig' },
  { id:'notch',   x:228, y:28,  w:76, h:32, label:'NOTCH_F',   sub:'50/60 Hz',  type:'sig' },
  { id:'lpf',     x:228, y:82,  w:76, h:32, label:'AAF_LPF',   sub:'fc=800 Hz', type:'sig' },
  { id:'adc',     x:336, y:52,  w:80, h:40, label:'ADC_12B',   sub:'1 MSPS',    type:'sig' },
  { id:'vref',    x:336, y:122, w:80, h:28, label:'VREF',      sub:'2.048 V',   type:'ref' },
  // Digital core
  { id:'fifo',    x:18,  y:168, w:72, h:36, label:'FIFO_BUF',  sub:'512×16b',   type:'dig' },
  { id:'mcu',     x:130, y:158, w:118,h:58, label:'ARM_MCU',   sub:'Cortex-M4', type:'mcu' },
  { id:'kalman',  x:286, y:148, w:88, h:32, label:'KALMAN',    sub:'σ=0.012',   type:'dig' },
  { id:'fft',     x:286, y:192, w:88, h:32, label:'FFT_1024',  sub:'Δf=0.98Hz', type:'dig' },
  { id:'pid',     x:414, y:158, w:88, h:58, label:'PID_CTRL',  sub:'kp·ki·kd',  type:'dig' },
  // Output stage
  { id:'pwm',     x:130, y:288, w:80, h:36, label:'PWM_GEN',   sub:'20 kHz',    type:'out' },
  { id:'gate',    x:248, y:288, w:80, h:36, label:'GATE_DRV',  sub:'MOSFET ×4', type:'out' },
  { id:'hbr',     x:366, y:284, w:90, h:44, label:'H_BRIDGE',  sub:'5A / 24V',  type:'pwr' },
  { id:'motor',   x:200, y:370, w:80, h:40, label:'SERVO_M',   sub:'24V DC',    type:'pwr' },
  { id:'enc',     x:18,  y:268, w:72, h:36, label:'ENCODER',   sub:'1024 PPR',  type:'fdb' },
  { id:'isense',  x:366, y:344, w:90, h:28, label:'I_SENSE',   sub:'±5A shunt', type:'ref' },
];

// ── Connections (from, to, optional mid-waypoints, style) ─────────────────
// style: 'a'=analog  'd'=digital  'p'=power  'f'=feedback  'r'=ref
const CONNS = [
  { f:'sens',   t:'inamp',  wp:[],                              s:'a' },
  { f:'inamp',  t:'notch',  wp:[{x:214,y:72},{x:214,y:44}],    s:'a' },
  { f:'inamp',  t:'lpf',    wp:[{x:214,y:72},{x:214,y:98}],    s:'a' },
  { f:'notch',  t:'lpf',    wp:[{x:304,y:44},{x:304,y:98}],    s:'a' },
  { f:'lpf',    t:'adc',    wp:[],                              s:'a' },
  { f:'vref',   t:'adc',    wp:[],                              s:'r' },
  { f:'adc',    t:'mcu',    wp:[{x:376,y:112},{x:376,y:142},{x:188,y:142}], s:'d' },
  { f:'fifo',   t:'mcu',    wp:[],                              s:'d' },
  { f:'mcu',    t:'kalman', wp:[],                              s:'d' },
  { f:'mcu',    t:'fft',    wp:[{x:248,y:187},{x:286,y:208}],  s:'d' },
  { f:'kalman', t:'pid',    wp:[{x:374,y:164}],                s:'d' },
  { f:'fft',    t:'pid',    wp:[{x:502,y:208},{x:502,y:187}],  s:'d' },
  { f:'mcu',    t:'pwm',    wp:[{x:188,y:282}],                s:'d' },
  { f:'pid',    t:'pwm',    wp:[{x:458,y:320},{x:170,y:320},{x:170,y:306}], s:'d' },
  { f:'pwm',    t:'gate',   wp:[],                              s:'d' },
  { f:'gate',   t:'hbr',    wp:[],                              s:'p' },
  { f:'hbr',    t:'motor',  wp:[{x:411,y:388},{x:280,y:388}],  s:'p' },
  { f:'isense', t:'mcu',    wp:[{x:411,y:410},{x:94,y:410},{x:94,y:250},{x:130,y:250}], s:'f' },
  { f:'motor',  t:'enc',    wp:[{x:240,y:436},{x:54,y:436},{x:54,y:322}], s:'f' },
  { f:'enc',    t:'mcu',    wp:[{x:54,y:268},{x:54,y:155},{x:130,y:155}], s:'f' },
];

// Colours
const COL = {
  bg:   '#f0ede7',
  grid: '#ddd9d0',
  axis: '#cdc9c0',
  blk:  '#1c1c1a',
  dim:  '#6b6560',
  mute: '#9e9a92',
  pale: '#b8b4ac',
  a:    '#1c1c1a',  // analog trace
  d:    '#3a5a4a',  // digital trace (muted green)
  p:    '#7a4a2a',  // power trace
  f:    '#5a4a7a',  // feedback trace (muted purple)
  r:    '#9e9a92',  // reference
  fill: { in:'#e8e4dc', sig:'#eae6de', dig:'#e2e8e4', mcu:'#e0e4ea',
          out:'#e4e2e8', pwr:'#ece0d8', fdb:'#e8e4ec', ref:'#ededea' },
  border:{ in:'#8a8078', sig:'#7a7870', dig:'#4a7060', mcu:'#3a5070',
           out:'#6a6080', pwr:'#8a6050', fdb:'#6a5080', ref:'#7a7870' },
};

// ── Precompute paths ──────────────────────────────────────────────────────
function blockEdge(id, side) {
  const b = BLOCKS.find(b=>b.id===id);
  if (!b) return {x:0,y:0};
  return {
    x: side==='r' ? b.x+b.w : side==='l' ? b.x : b.x+b.w/2,
    y: side==='b' ? b.y+b.h : side==='t' ? b.y : b.y+b.h/2,
  };
}
function buildPath(conn) {
  const fb = BLOCKS.find(b=>b.id===conn.f);
  const tb = BLOCKS.find(b=>b.id===conn.t);
  const start = { x: fb.x+fb.w, y: fb.y+fb.h/2 };
  const end   = { x: tb.x,      y: tb.y+tb.h/2 };
  const pts = [start, ...conn.wp, end];
  const segs = [];
  let total = 0;
  for (let i=1; i<pts.length; i++) {
    const dx = pts[i].x-pts[i-1].x, dy = pts[i].y-pts[i-1].y;
    const len = Math.sqrt(dx*dx+dy*dy);
    segs.push({ x0:pts[i-1].x, y0:pts[i-1].y, dx, dy, len });
    total += len;
  }
  return { segs, total };
}
const PATHS = CONNS.map(c => buildPath(c));

// Particles
const PARTS = CONNS.map((c,i) => {
  const n = c.s==='p' ? 3 : c.s==='f' ? 2 : 4;
  return Array.from({length:n}, (_,j) => ({
    t: j/n, speed: c.s==='p' ? 0.0018 : c.s==='f' ? 0.0014 : c.s==='d' ? 0.0026 : 0.002,
  }));
});

function posOnPath(path, t) {
  const target = ((t%1)+1)%1 * path.total;
  let acc = 0;
  for (const seg of path.segs) {
    if (acc + seg.len >= target) {
      const frac = (target - acc) / seg.len;
      return { x: seg.x0 + frac*seg.dx, y: seg.y0 + frac*seg.dy };
    }
    acc += seg.len;
  }
  const last = path.segs[path.segs.length-1];
  return { x: last.x0+last.dx, y: last.y0+last.dy };
}

// ── Scale helpers ─────────────────────────────────────────────────────────
function sx(v){ return v * C.width  / VW; }
function sy(v){ return v * C.height / VH; }
function sf(v){ return v * Math.min(C.width/VW, C.height/VH); }

// ── Draw helpers ──────────────────────────────────────────────────────────
function dot(x,y,r,col){ X.beginPath();X.arc(sx(x),sy(y),sf(r),0,Math.PI*2);X.fillStyle=col;X.fill(); }
function line(x1,y1,x2,y2,col,w,dash=[]){
  X.beginPath();X.setLineDash(dash);X.moveTo(sx(x1),sy(y1));X.lineTo(sx(x2),sy(y2));
  X.strokeStyle=col;X.lineWidth=sf(w);X.stroke();X.setLineDash([]);
}
function txt(str,x,y,size,col,align='left'){
  X.font=`${sf(size)}px ${FONT}`;X.fillStyle=col;X.textAlign=align;
  X.fillText(str,sx(x),sy(y));
}

// ── Waveform inside block ─────────────────────────────────────────────────
function miniWave(b, type) {
  const px = sx(b.x+4), py = sy(b.y+b.h-8), pw = sx(b.w-8), ph = sy(12);
  X.save();
  X.beginPath(); X.rect(px,py-ph,pw,ph); X.clip();
  X.strokeStyle = COL.border[b.type]; X.lineWidth = sf(0.8);
  X.beginPath();
  for (let i=0;i<=80;i++) {
    const xp = px + (i/80)*pw;
    let yp;
    if (type==='sin') yp = py - ph/2 - Math.sin((i/80)*Math.PI*4 + T)*ph*0.38;
    else if (type==='sq') {
      const ph2 = ((i/80)*3+T*0.5)%1;
      yp = py - (ph2<0.5 ? ph*0.75 : ph*0.2);
    } else yp = py - ph/2 - (Math.sin((i/80)*Math.PI*6+T)*0.5+Math.sin((i/80)*Math.PI*11+T*1.3)*0.3)*ph*0.35;
    i===0?X.moveTo(xp,yp):X.lineTo(xp,yp);
  }
  X.stroke(); X.restore();
}

// ── Draw block ────────────────────────────────────────────────────────────
function drawBlock(b) {
  const rx = sf(2.5);
  X.beginPath();
  X.roundRect(sx(b.x),sy(b.y),sx(b.w),sy(b.h),rx);
  X.fillStyle = COL.fill[b.type] || '#e8e4dc';
  X.fill();
  X.strokeStyle = COL.border[b.type] || '#8a8078';
  X.lineWidth = sf(0.9);
  X.stroke();
  // label
  txt(b.label, b.x+b.w/2, b.y+11, 6.2, COL.blk, 'center');
  txt(b.sub,   b.x+b.w/2, b.y+20, 5.4, COL.dim,  'center');
  // waveform for key blocks
  if (b.id==='sens')  miniWave(b,'sin');
  if (b.id==='inamp') miniWave(b,'sin');
  if (b.id==='mcu')   miniWave(b,'mix');
  if (b.id==='pwm')   miniWave(b,'sq');
}

// ── Draw connection trace ─────────────────────────────────────────────────
function drawConn(conn, path) {
  const col = COL[conn.s]; const dash = conn.s==='r'?[sf(3),sf(2)]:[];
  X.beginPath(); X.setLineDash(dash);
  X.strokeStyle = col; X.lineWidth = sf(conn.s==='p'?1.4:0.9); X.globalAlpha = 0.7;
  path.segs.forEach((seg,i)=>{
    if(i===0) X.moveTo(sx(seg.x0),sy(seg.y0));
    X.lineTo(sx(seg.x0+seg.dx),sy(seg.y0+seg.dy));
  });
  X.stroke(); X.setLineDash([]); X.globalAlpha = 1;
  // arrowhead at end
  const last = path.segs[path.segs.length-1];
  const ang = Math.atan2(last.dy, last.dx);
  const ex = sx(last.x0+last.dx), ey = sy(last.y0+last.dy);
  const as = sf(3.5);
  X.beginPath();
  X.moveTo(ex, ey);
  X.lineTo(ex-as*Math.cos(ang-0.4), ey-as*Math.sin(ang-0.4));
  X.lineTo(ex-as*Math.cos(ang+0.4), ey-as*Math.sin(ang+0.4));
  X.closePath(); X.fillStyle=col; X.globalAlpha=0.7; X.fill(); X.globalAlpha=1;
}

// ── Spectrum display ──────────────────────────────────────────────────────
function drawSpectrum() {
  const bx=sx(18), by=sy(470), bw=sx(524), bh=sy(110);
  // frame
  X.fillStyle='#e8e4dc'; X.fillRect(bx,by,bw,bh);
  X.strokeStyle=COL.axis; X.lineWidth=sf(0.8); X.strokeRect(bx,by,bw,bh);
  // grid lines
  X.strokeStyle=COL.grid; X.lineWidth=sf(0.5);
  for(let i=1;i<8;i++){const gx=bx+bw*i/8;X.beginPath();X.moveTo(gx,by);X.lineTo(gx,by+bh);X.stroke();}
  for(let i=1;i<4;i++){const gy=by+bh*i/4;X.beginPath();X.moveTo(bx,gy);X.lineTo(bx+bw,gy);X.stroke();}
  // frequency bars
  const bands = 48;
  const profile = [0.2,0.6,1.0,0.75,0.5,0.35,0.25,0.18,0.28,0.42,0.55,0.38,0.22,0.15,0.10,0.08,0.12,0.20,0.16,0.10,0.07,0.05,0.08,0.12,0.10,0.07,0.04,0.03,0.05,0.08,0.07,0.05,0.03,0.02,0.03,0.05,0.04,0.03,0.02,0.02,0.03,0.04,0.03,0.02,0.02,0.01,0.02,0.03];
  const barW = bw / bands - sf(1);
  for (let i=0;i<bands;i++) {
    const noise = 0.05*Math.sin(T*3+i*0.8)+0.03*Math.sin(T*5+i*1.7);
    const h = (profile[i]+noise) * bh * 0.88;
    const hue = i/bands;
    const alpha = 0.55 + 0.35*(profile[i]);
    X.fillStyle = `rgba(40,40,36,${alpha})`;
    X.fillRect(bx + i*(bw/bands), by+bh-h, barW, h);
  }
  // overlay line
  X.beginPath(); X.strokeStyle='rgba(28,28,26,0.4)'; X.lineWidth=sf(0.7);
  for(let i=0;i<bands;i++){
    const noise=0.04*Math.sin(T*3+i*0.8);
    const h=(profile[i]+noise)*bh*0.88;
    const cx2=bx+(i+0.5)*(bw/bands);
    i===0?X.moveTo(cx2,by+bh-h):X.lineTo(cx2,by+bh-h);
  }
  X.stroke();
  // labels
  txt('FREQ_SPECTRUM', 18, 466, 5.5, COL.mute);
  txt('0 Hz', 18, 588, 5, COL.pale);
  txt('500 Hz', 140, 588, 5, COL.pale);
  txt('1 kHz', 275, 588, 5, COL.pale);
  txt('2 kHz', 410, 588, 5, COL.pale);
}

// ── Scope display ─────────────────────────────────────────────────────────
function drawScope() {
  const bx=sx(18), by=sy(598), bw=sx(524), bh=sy(100);
  X.fillStyle='#e8e4dc'; X.fillRect(bx,by,bw,bh);
  X.strokeStyle=COL.axis; X.lineWidth=sf(0.8); X.strokeRect(bx,by,bw,bh);
  X.strokeStyle=COL.grid; X.lineWidth=sf(0.5);
  for(let i=1;i<8;i++){const gx=bx+bw*i/8;X.beginPath();X.moveTo(gx,by);X.lineTo(gx,by+bh);X.stroke();}
  X.beginPath();X.moveTo(bx,by+bh/2);X.lineTo(bx+bw,by+bh/2);X.stroke();
  // CH1 sine
  X.beginPath(); X.strokeStyle='rgba(28,28,26,0.85)'; X.lineWidth=sf(1.1);
  for(let i=0;i<=320;i++){
    const xp=bx+(i/320)*bw;
    const yp=by+bh/2-Math.sin((i/320)*Math.PI*8+T)*(bh*0.32);
    i===0?X.moveTo(xp,yp):X.lineTo(xp,yp);
  }X.stroke();
  // CH2 — processed (smoother sine)
  X.beginPath(); X.strokeStyle='rgba(58,90,74,0.7)'; X.lineWidth=sf(0.9);
  for(let i=0;i<=320;i++){
    const xp=bx+(i/320)*bw;
    const yp=by+bh*0.72-Math.sin((i/320)*Math.PI*8+T+0.3)*(bh*0.16);
    i===0?X.moveTo(xp,yp):X.lineTo(xp,yp);
  }X.stroke();
  // CH3 — PWM square
  X.beginPath(); X.strokeStyle='rgba(122,74,42,0.6)'; X.lineWidth=sf(0.8);
  for(let i=0;i<=320;i++){
    const xp=bx+(i/320)*bw;
    const ph=((i/320)*12+T*0.8)%1;
    const yp=by+(ph<0.45?0.1:0.88)*bh;
    const prev=((Math.max(i-1,0)/320)*12+T*0.8)%1;
    if(i===0){X.moveTo(xp,yp);continue;}
    if(Math.abs(ph-prev)>0.4){X.moveTo(xp,yp);}else{X.lineTo(xp,yp);}
  }X.stroke();
  // labels
  txt('SCOPE_MONITOR', 18, 595, 5.5, COL.mute);
  txt('CH1: BIO_RAW', 20, 611, 5, 'rgba(28,28,26,0.8)');
  txt('CH2: FILTERED', 120, 611, 5, 'rgba(58,90,74,0.9)');
  txt('CH3: PWM_OUT', 230, 611, 5, 'rgba(122,74,42,0.9)');
  const v = (Math.sin(T)*1.65).toFixed(2);
  txt(`${v} V`, 490, 611, 5, COL.pale, 'right');
}

// ── Power rails ───────────────────────────────────────────────────────────
function drawRails() {
  // VCC top
  line(18, 22, 542, 22, 'rgba(122,74,42,0.35)', 1.2);
  txt('VCC  +3.3V / +5V / +24V', 18, 19, 5, COL.pale);
  // GND bottom
  line(18, 448, 542, 448, 'rgba(28,28,26,0.25)', 0.9, [sf(4),sf(3)]);
  txt('GND', 18, 457, 5, COL.pale);
  // Vertical drops from VCC to key blocks
  [72,188,248,330,458].forEach(bx=>{
    line(bx, 22, bx, 40, 'rgba(122,74,42,0.22)', 0.7);
    dot(bx, 40, 1.2, 'rgba(122,74,42,0.35)');
  });
}

// ── Net labels ────────────────────────────────────────────────────────────
function drawNetLabels() {
  const nets = [
    {s:'EMG_IN',  x:64,  y:66 }, {s:'/INAMP_OUT', x:104, y:48 },
    {s:'ADC_DATA',x:300, y:148},{s:'PID_CMD',    x:396, y:155},
    {s:'FB_ENC',  x:54,  y:232},{s:'I_LOOP',     x:356, y:420},
  ];
  nets.forEach(n=>txt(n.s, n.x, n.y, 4.8, COL.mute));
}

// ── Annotation box ────────────────────────────────────────────────────────
function drawAnnotation() {
  const bx=sx(18), by=sy(706), bw=sx(524), bh=sy(10);
  X.font=`${sf(5)}px ${FONT}`; X.fillStyle=COL.pale; X.textAlign='left';
  X.fillText('// biosignal_to_servo_v0.4  —  rev: sur  —  adaptive PID + Kalman-filtered EMG control loop', bx, by);
  X.textAlign='right';
  X.fillText('Cortex-M4 @ 168MHz', sx(542), by);
}

// ── Main draw ─────────────────────────────────────────────────────────────
function draw() {
  setup();
  const W=C.width, H=C.height;
  X.clearRect(0,0,W,H);
  X.fillStyle=COL.bg; X.fillRect(0,0,W,H);
  // dot grid
  for(let x=0;x<W;x+=sx(22)) for(let y=0;y<H;y+=sy(22)){
    X.beginPath();X.arc(x,y,sf(0.7),0,Math.PI*2);X.fillStyle=COL.grid;X.fill();
  }
  drawRails();
  // connections
  CONNS.forEach((c,i)=>drawConn(c,PATHS[i]));
  // junction dots at branch points
  [[214,72],[304,44]].forEach(([a,b])=>dot(a,b,2.2,'#1c1c1a'));
  // blocks
  BLOCKS.forEach(drawBlock);
  // particles
  CONNS.forEach((c,i)=>{
    const col = COL[c.s];
    PARTS[i].forEach(p=>{
      const pos=posOnPath(PATHS[i],p.t);
      dot(pos.x, pos.y, 1.8, col);
      p.t += p.speed;
    });
  });
  drawSpectrum();
  drawScope();
  drawNetLabels();
  drawAnnotation();
  T += 0.022;
  requestAnimationFrame(draw);
}

window.addEventListener('resize', setup);
draw();

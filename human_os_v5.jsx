import { useState, useEffect, useRef } from "react";

const PHI = (1 + Math.sqrt(5)) / 2;
const PI  = Math.PI;
const TAU = PI * 2;

// ─── Moon ─────────────────────────────────────────────────────────────────────
function getMoonPhase() {
  const known = new Date(2000, 0, 6, 18, 14);
  return ((Date.now() - known) / 86400000 % 29.530588853) / 29.530588853;
}
function getMoonInfo(p) {
  if (p < 0.0625 || p >= 0.9375) return { e:"🌑", n:"Новолуние",     power:0.95, type:"new"    };
  if (p < 0.1875)                 return { e:"🌒", n:"Молодая",        power:0.70, type:"waxing" };
  if (p < 0.3125)                 return { e:"🌓", n:"Первая четв.",   power:0.75, type:"waxing" };
  if (p < 0.4375)                 return { e:"🌔", n:"Прибывающая",    power:0.85, type:"waxing" };
  if (p < 0.5625)                 return { e:"🌕", n:"Полнолуние",     power:1.00, type:"full"   };
  if (p < 0.6875)                 return { e:"🌖", n:"Убывающая",      power:0.90, type:"waning" };
  if (p < 0.8125)                 return { e:"🌗", n:"Последн. четв.", power:0.80, type:"waning" };
  return                                 { e:"🌘", n:"Стареющая",      power:0.65, type:"waning" };
}

// ─── Adaptive params ──────────────────────────────────────────────────────────
function computeAdaptive(hour, moon, rmssd, gender) {
  const g = gender === "f";
  // Time window
  const tw = hour>=5&&hour<8?"dawn":hour>=8&&hour<12?"morning":hour>=12&&hour<15?"midday":
             hour>=15&&hour<19?"afternoon":hour>=19&&hour<22?"evening":"night";
  const TB = {
    dawn:      { in:PHI**2*.9,  hold:PHI*.8,  ex:PHI**3*.9,  rest:PHI**2*.8,  lbl:"🌅 Рассвет"  },
    morning:   { in:PHI**2,     hold:PHI,     ex:PHI**3,     rest:PHI**2,     lbl:"☀️ Утро"      },
    midday:    { in:PHI**2*1.1, hold:PHI*1.1, ex:PHI**3*1.2, rest:PHI**2,     lbl:"🔆 Полдень"   },
    afternoon: { in:PHI**2*1.1, hold:PHI,     ex:PHI**3*1.3, rest:PHI**2*1.1, lbl:"🌤 День"     },
    evening:   { in:PHI**2*1.2, hold:PHI*.9,  ex:PHI**3*1.4, rest:PHI**2*1.2, lbl:"🌆 Вечер"    },
    night:     { in:PHI**2*1.4, hold:PHI*1.3, ex:PHI**3*1.5, rest:PHI**2*1.5, lbl:"🌙 Ночь"     },
  }[tw];
  // HRV mult
  let hm=1, hlbl="";
  if (rmssd>0) {
    if      (rmssd<20) { hm=0.75; hlbl="⚡ стресс→стаб"; }
    else if (rmssd<35) { hm=0.88; hlbl="🟡 низкий HRV";  }
    else if (rmssd<55) { hm=1.0;  hlbl="🟢 норма";       }
    else if (rmssd<70) { hm=1.15; hlbl="💚 высокий";     }
    else               { hm=1.28; hlbl="✨ отлично";     }
  }
  // Moon freq
  const MF = {
    new:    { carrier:g?396:528, beat:PHI**2,  mlbl:"🌑 обнуление" },
    waxing: { carrier:g?417:528, beat:PHI*PI,  mlbl:"🌒 рост"      },
    full:   { carrier:528,       beat:PHI**3,  mlbl:"🌕 полнота"   },
    waning: { carrier:g?285:432, beat:PHI*2,   mlbl:"🌖 интеграция"},
  }[moon.type] || { carrier:528, beat:PHI*PI, mlbl:"" };
  // Astro
  const now=new Date();
  const doy=Math.floor((now-new Date(now.getFullYear(),0,0))/86400000);
  const zi=Math.floor(((doy+10)%365)/30.44);
  const zn=["♑","♒","♓","♈","♉","♊","♋","♌","♍","♎","♏","♐"][zi];
  const elMult=[1.0,1.05,1.1,1.15][[2,3,1,0,2,3,1,0,2,3,1,0][zi]];
  const mercRx=(doy>=64&&doy<=84)||(doy>=162&&doy<=182)||(doy>=274&&doy<=294);
  // Final
  const M=hm*elMult;
  const breathSeq=[
    { phase:"inhale", dur:Math.max(2.0, TB.in  *M) },
    { phase:"hold",   dur:Math.max(1.0, TB.hold *M) },
    { phase:"exhale", dur:Math.max(3.0, TB.ex   *M) },
    { phase:"rest",   dur:Math.max(1.5, TB.rest *M) },
  ];
  const carrier=MF.carrier+(rmssd>55?-2:0);
  const beat=MF.beat*(rmssd>55?0.92:1.0);
  const tBonus=tw==="dawn"?3:tw==="night"?4:0;
  const totalMin=Math.round((moon.power>=.9?20:moon.power>=.75?17:14)+tBonus);
  const reasons=[TB.lbl, MF.mlbl, zn+(mercRx?" ☿R":""), rmssd>0?hlbl:null].filter(Boolean).join(" · ");
  return { breathSeq, carrier, beat, totalMin, reasons, tw };
}

// ─── Breath colors ────────────────────────────────────────────────────────────
const BREATH_COLORS = {
  inhale:[72, 220,130], hold:[65,145,255], exhale:[255,195,50], rest:[110,145,175]
};
const BREATH_LABELS = { inhale:"ВДОХ", hold:"ДЕРЖИ", exhale:"ВЫДОХ", rest:"ПАУЗА" };
const PHASE_DUR     = { inhale:PHI**2, hold:PHI, exhale:PHI**3, rest:PHI**2 };

// ─── Gender data ──────────────────────────────────────────────────────────────
const G = {
  m: {
    pronoun:"Мужчина", element:"Эфир · Программа · Импульс", symbol:"⚡",
    color:"#3de8a0",
    affirmation:["Я — Мужчина","Счастливый","Здоровый","Богатый","Молодой","Красивый",
      "Сексуальный","В прекрасных отношениях","С регулярным сексом","В вечной любви",
      "В унисон со своим предназначением","Получающий удовольствие от этого процесса"],
    console_lines:[
      "INIT :: male_consciousness_v2026.build",
      "LOAD :: ether_protocol.so .................. OK",
      "BIND :: higher_self.socket → /dev/soul",
      "SET  :: inner_dialog = OFF",
      "SET  :: background_processes = SUSPENDED",
      "RUN  :: Я, мужчина, объединён со всеми мужчинами и женщинами Земли",
      "LINK :: gut_antenna → intuition_bus ........ OK",
      "SYNC :: hrv_coherence @ φ⁵ = 5.41 BPM",
      "LOAD :: sexual_energy_amplifier.ko ......... OK",
      "EXEC :: Я активизирую любовь и сексуальность в себе и других",
      "MAP  :: prefrontal_cortex → metacognition_engine",
      "SET  :: destination = ПРЕДНАЗНАЧЕНИЕ::MAX",
      "LINK :: earth_resonance @ 7.83Hz → schumann_lock",
      "RUN  :: Я есть идея и смысл, чувствование и видение",
      "EXEC :: Я Бог и мужчина в одной ипостаси",
    ],
    done_lines:[
      "FLUSH :: old_patterns → /dev/null",
      "WRITE :: new_neural_pathways → long_term_memory",
      "SET   :: base_state = ЛЮБОВЬ && ПРОЦВЕТАНИЕ",
      "EXEC  :: Я — Мужчина в любви и процветании",
      "OK    :: male_firmware v2026 complete ✦",
    ],
    higher_self:"высшее я: внутренний диалог остановлен. установка ускорена.",
    pkgs:[
      { id:"will",   label:"Сила воли и импульс",   mod:"ЦНС",      state:"ЯСНОСТЬ ЦЕЛИ",      quality:"активная воля"      },
      { id:"ether",  label:"Эфирный канал",          mod:"Поле",     state:"СОЕДИНЕНИЕ",        quality:"связь с источником" },
      { id:"pfc",    label:"Префронтальная кора",    mod:"Мозг",     state:"МЕТАКОГНИЦИЯ",      quality:"ясное мышление"     },
      { id:"sex",    label:"Сексуальная сила",       mod:"Энергия",  state:"ВИТАЛЬНОСТЬ++",     quality:"мужская мощь"       },
      { id:"meta",   label:"Метакогниция",           mod:"Интелл.",  state:"САМООСОЗНАННОСТЬ",  quality:"редактир. кода"     },
      { id:"gut",    label:"Кишечная антенна",       mod:"ЭНС",      state:"ИНТУИЦИЯ",          quality:"приём без слов"     },
      { id:"hrv",    label:"HRV φ⁵ когерентность",  mod:"Сердце",   state:"КОГЕРЕНТНОСТЬ",     quality:"сердечн. резонанс"  },
      { id:"sch",    label:"Земля 7.83 Hz",          mod:"Земля",    state:"ЗАЗЕМЛЕНИЕ",        quality:"планетарный ритм"   },
      { id:"dest",   label:"Предназначение",         mod:"Душа",     state:"РЕАЛИЗАЦИЯ",        quality:"путь высшей силы"   },
      { id:"hi",     label:"Handshake Высшее Я",     mod:"Поле",     state:"СВЯЗЬ С ИСТОЧН.",   quality:"φ-рукопожатие"      },
    ],
  },
  f: {
    pronoun:"Женщина", element:"Земля · Матрица · Принятие", symbol:"🌍",
    color:"#f472b6",
    affirmation:["Я — Женщина","Счастливая","Здоровая","Богатая","Молодая","Красивая",
      "Сексуальная","В прекрасных отношениях","С регулярным сексом","В вечной любви",
      "В унисон со своим предназначением","Получающая удовольствие от этого процесса"],
    console_lines:[
      "INIT :: female_consciousness_v2026.build",
      "LOAD :: earth_matrix_protocol.so .......... OK",
      "BIND :: higher_self.socket → /dev/soul",
      "SET  :: inner_dialog = OFF",
      "SET  :: background_processes = SUSPENDED",
      "RUN  :: Жизнь это Женщина. Планета Земля это Женщина",
      "LOAD :: love_signal_decoder.ko ............. OK",
      "EXEC :: Я принимаю коды и возвращаю их живым чувством",
      "MAP  :: cellular_memory → repair_engine @ 285Hz",
      "LOAD :: sexuality_acceptance_mod.ko ........ OK",
      "SET  :: state = ПРИНЯТИЕ && СОГЛАСИЕ && ЗДЕСЬ_И_СЕЙЧАС",
      "LINK :: earth_core → heart_center → soul",
      "EXEC :: Информация становится жизнью через меня в состоянии Любви",
      "EXEC :: Я Богиня и женщина в одной ипостаси",
    ],
    done_lines:[
      "FLUSH :: old_cellular_patterns → /dev/null",
      "WRITE :: new_cellular_memory → long_term_memory",
      "SET   :: base_state = ЛЮБОВЬ && ПРОЦВЕТАНИЕ",
      "EXEC  :: Я — Женщина в любви и процветании",
      "OK    :: female_firmware v2026 complete ✦",
    ],
    higher_self:"высшее я: ты принимаешь. матрица обновляется прямо сейчас.",
    pkgs:[
      { id:"mat",   label:"Матрица Земли",           mod:"Земля",    state:"ЗАЗЕМЛЕНИЕ++",      quality:"слияние с планетой" },
      { id:"dec",   label:"Декодер любви",            mod:"Сердце",   state:"ОТКРЫТОСТЬ",        quality:"информация→чувство" },
      { id:"cell",  label:"Клеточная память",         mod:"Клетки",   state:"РЕГЕНЕРАЦИЯ",       quality:"285 Hz репарация"   },
      { id:"sex",   label:"Сексуальность принятия",   mod:"Энергия",  state:"МАГНЕТИЗМ",         quality:"принятие как сила"  },
      { id:"dna",   label:"ДНК репарация",            mod:"ДНК",      state:"ТРАНСФОРМАЦИЯ",     quality:"528 Hz активация"   },
      { id:"gut",   label:"Кишечная антенна",         mod:"ЭНС",      state:"ИНТУИЦИЯ",          quality:"приём без слов"     },
      { id:"meta",  label:"Метакогниция",             mod:"Интелл.",  state:"САМООСОЗНАННОСТЬ",  quality:"редактир. кода"     },
      { id:"sch",   label:"Земля 7.83 Hz",            mod:"Ритмы",    state:"ЕДИНСТВО",          quality:"планетарный ритм"   },
      { id:"dest",  label:"Предназначение",           mod:"Душа",     state:"РЕАЛИЗАЦИЯ",        quality:"путь высшей силы"   },
      { id:"hi",    label:"Handshake Высшее Я",       mod:"Поле",     state:"СВЯЗЬ С ИСТОЧН.",   quality:"сердечн. φ-канал"   },
    ],
  },
};

// ─── Cheat codes (two selectable) ────────────────────────────────────────────
const CHEAT_CODES = {
  concentration: {
    id: "concentration",
    title: "КОНЦЕНТРАЦИЯ В ТОЧКЕ",
    text: "КОНЦЕНТРАЦИЯ В ТОЧКЕ ЗДЕСЬ И СЕЙЧАС · Убираю пространство, время, материю и оставляю только точку — суть всех процессов, вещей и сознания здесь и сейчас. С остановкой внутреннего диалога удерживаю это состояние несколько секунд, потом разрешаю ему разлететься во всю Вселенную, отпуская навсегда. Прозрачность из сердечного центра в ядро Земли, где она расходится воздушной волной, дающей соприкосновение с потоком жизненной силы изнутри.",
  },
  connection: {
    id: "connection",
    title: "СОЕДИНЕНИЕ НЕСОЕДИНИМОГО",
    text: "СОЕДИНЕНИЕ НЕСОЕДИНИМОГО · Множество элементов внешнего мира начинают стыковаться между собой и переходят под управление моего предназначения в высшей точке реализации. Я в состоянии Любви соединяю галактики, цивилизации и вероятностные реальности. Вдыхаю, задерживаю дыхание, закрываю глаза — мысленно вижу вспышку, расходящуюся по всей Вселенной. Энергия возвращается в сердечный центр, уходит в ядро Земли, распыляется фейерверком, приумножая Любовь.",
  },
};

// ─── Affirmations marquee text (left-to-right, from source document) ──────────
const AFFIRMATIONS_MARQUEE = "Я обновляю рецепторы и загружаю новые состояния · Моя нервная система перестраивается на созидательную частоту · Тотальное удовольствие от каждого процесса моей жизни · Моя интуиция активна и точна · Сексуальная энергия наполняет меня силой и витальностью · Я реализую своё предназначение здесь и сейчас · Я богатый·ая и реализованный·ая · Новые нейронные связи активируются прямо сейчас · Активность без спешки — моё базовое состояние · Спокойствие внутри и доверие миру · Трудолюбие и дисциплина — это удовольствие · Меняя состояние внутри — мир мгновенно реагирует возможностями · Я — мощный биоцифровой декодер Любви · Метакогниция активна — я редактирую свой код прямо сейчас · Я накапливаю и излучаю одновременно · Моя душа обогащается позитивным опытом · Я в унисон с планетой Земля · Сердечное слияние с высшим Я активировано ·";

// ─── Audio ────────────────────────────────────────────────────────────────────
// iOS Safari rule: AudioContext must be CREATED and RESUMED inside the SAME
// user-gesture call stack. We create a fresh context at every session start.
let _sharedCtx = null;

// Called from initial touchstart listeners — creates the context early so it's
// already warm when the session button is tapped.
function _prewarmAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || (_sharedCtx && _sharedCtx.state !== "closed")) return;
  try {
    _sharedCtx = new AC();
    const buf = _sharedCtx.createBuffer(1, 1, _sharedCtx.sampleRate);
    const src = _sharedCtx.createBufferSource();
    src.buffer = buf; src.connect(_sharedCtx.destination); src.start(0);
    _sharedCtx.resume().catch(() => {});
  } catch(e) {}
}

// Called at the very start of any onClick that needs audio.
// Creates a FRESH context (or reuses a running one) within the gesture scope.
function _ensureCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  // Reuse if already running
  if (_sharedCtx && _sharedCtx.state === "running") return _sharedCtx;
  // Reuse if suspended — play buffer + resume within this gesture
  if (_sharedCtx && _sharedCtx.state === "suspended") {
    try {
      const buf = _sharedCtx.createBuffer(1, 1, _sharedCtx.sampleRate);
      const src = _sharedCtx.createBufferSource();
      src.buffer = buf; src.connect(_sharedCtx.destination); src.start(0);
    } catch(e) {}
    _sharedCtx.resume().catch(() => {});
    return _sharedCtx;
  }
  // Create fresh (closed / null)
  try {
    _sharedCtx = new AC();
    _sharedCtx.resume().catch(() => {});
  } catch(e) { return null; }
  return _sharedCtx;
}

class AudioEngine {
  constructor() {
    this.ctx=null; this.running=false; this.bc=528; this.bb=PHI*PI;
    this.oL=null; this.oR=null; this.ng=null; this.mg=null; this.ns=null;
    this._pL=null; this._pR=null;
  }

  start(carrier, beat, vol=0.15) {
    if (this.running) return;
    this.bc=carrier; this.bb=beat;
    try {
      this.ctx = _sharedCtx; // use the context that was just created/resumed in gesture
      if (!this.ctx) return;

      // resume() immediately — keep inside the gesture-scope window
      this.ctx.resume().catch(e=>console.warn("resume:",e));

      // Auto-resume if iOS suspends later (call interruption, page hide, etc.)
      this.ctx.onstatechange = () => {
        if (this.ctx && this.ctx.state === "suspended" && this.running)
          this.ctx.resume().catch(() => {});
      };

      // ── Audio graph: osc → StereoPanner → masterGain → destination ────────
      // StereoPannerNode is more reliable on iOS than ChannelMerger.
      this.mg = this.ctx.createGain();
      this.mg.gain.value = Math.max(vol, 0.12);
      this.mg.connect(this.ctx.destination);

      const mkPan = (v) => {
        try {
          if (typeof this.ctx.createStereoPanner === "function") {
            const p = this.ctx.createStereoPanner(); p.pan.value = v; return p;
          }
        } catch(e) {}
        return null;
      };

      this._pL = mkPan(-1);
      this._pR = mkPan(1);

      this.oL = this.ctx.createOscillator();
      this.oL.type = "sine"; this.oL.frequency.value = carrier;
      if (this._pL) { this.oL.connect(this._pL); this._pL.connect(this.mg); }
      else { this.oL.connect(this.mg); }
      this.oL.start();

      this.oR = this.ctx.createOscillator();
      this.oR.type = "sine"; this.oR.frequency.value = carrier + beat;
      if (this._pR) { this.oR.connect(this._pR); this._pR.connect(this.mg); }
      else { this.oR.connect(this.mg); }
      this.oR.start();

      this.running = true;
      // Defer noise buffer — CPU-heavy, safe to run outside gesture scope
      // once the context is already running.
      setTimeout(() => this._addNoise(), 150);
    } catch(e) { console.warn("audio start:", e); }
  }

  _addNoise() {
    if (!this.running||!this.ctx||!this.mg) return;
    try {
      const sr=this.ctx.sampleRate; const nb=this.ctx.createBuffer(2,Math.floor(sr*2),sr);
      for(let ch=0;ch<2;ch++){const d=nb.getChannelData(ch);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;for(let i=0;i<d.length;i++){const w=Math.random()*2-1;b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)/7*.07;b6=w*.115926;}}
      this.ns=this.ctx.createBufferSource(); this.ns.buffer=nb; this.ns.loop=true;
      this.ng=this.ctx.createGain(); this.ng.gain.value=0.04;
      this.ns.connect(this.ng); this.ng.connect(this.mg); this.ns.start();
    } catch(e){ console.warn("noise:",e); }
  }

  onBreath(phase, rmssd=0) {
    if (!this.running||!this.ctx||!this.oL) return;
    const t=this.ctx.currentTime; const coh=Math.min(1,(rmssd||0)/70);
    const bm={inhale:1.06,hold:1.0,exhale:0.93,rest:0.97}[phase]||1;
    const cs={inhale:.4,hold:0,exhale:-.4,rest:0}[phase]||0;
    this.oL.frequency.setTargetAtTime(this.bc+cs, t, 0.4);
    this.oR.frequency.setTargetAtTime(this.bc+this.bb*bm*(1+coh*.07), t, 0.4);
    if (this.ng) this.ng.gain.setTargetAtTime(0.022+(1-coh)*.04, t, 0.5);
  }

  setVol(v) {
    if (this.mg&&this.ctx) this.mg.gain.setTargetAtTime(Math.max(0, v), this.ctx.currentTime, 0.1);
  }

  stop() {
    this.running = false;
    if (this.ctx) { try { this.ctx.onstatechange = null; } catch(e) {} }
    try {
      if (this.oL) { try{this.oL.stop();}catch(e){} this.oL.disconnect(); this.oL=null; }
      if (this.oR) { try{this.oR.stop();}catch(e){} this.oR.disconnect(); this.oR=null; }
      if (this.ns) { try{this.ns.stop();}catch(e){} this.ns.disconnect(); this.ns=null; }
      if (this.ng) { this.ng.disconnect(); this.ng=null; }
      if (this._pL) { this._pL.disconnect(); this._pL=null; }
      if (this._pR) { this._pR.disconnect(); this._pR=null; }
      if (this.mg) { this.mg.disconnect(); this.mg=null; }
      // Keep _sharedCtx alive so next session doesn't need a new gesture.
    } catch(e) {}
  }
}

// ─── Neuron Orb ───────────────────────────────────────────────────────────────
function NeuronOrb({ breathRef, size=242 }) {
  const canvasRef = useRef(null);
  const geoRef    = useRef({ dendrites:[], synapses:[], axonPulse:0 });

  useEffect(() => {
    const ds=[], ss=[];
    for (let i=0;i<9;i++) {
      const a=(TAU/9)*i+(Math.random()-.5)*.3;
      ds.push({ang:a,len:30+Math.random()*20,sA:a+(Math.random()-.5)*.7,sB:a-(Math.random()-.5)*.7,spd:.12+Math.random()*.1,off:Math.random()*TAU});
    }
    for (let i=0;i<22;i++) ss.push({ang:Math.random()*TAU,r:.78+Math.random()*.28,spd:.5+Math.random()*1.6,off:Math.random()*TAU});
    geoRef.current={dendrites:ds,synapses:ss,axonPulse:0};
  }, []);

  useEffect(() => {
    const canvas=canvasRef.current; if (!canvas) return;
    const ctx=canvas.getContext("2d");
    const cx=size/2, cy=size/2;
    let prev=performance.now(), scl=0.72, prevPhase="rest", phaseT=0, globalT=0;
    const lerp=(a,b,t)=>a+(b-a)*t;
    const ease=t=>t*t*(3-2*t);
    const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
    function lerpRGB(c1,c2,t){return[lerp(c1[0],c2[0],t)|0,lerp(c1[1],c2[1],t)|0,lerp(c1[2],c2[2],t)|0];}
    let raf;
    function draw(now) {
      const dt=clamp((now-prev)/1000,0,.05); prev=now; globalT+=dt;
      const phase=breathRef.current?.phase??"rest";
      const pDur=PHASE_DUR[phase]??2.618;
      if (phase!==prevPhase){phaseT=globalT;prevPhase=phase;}
      const pp=clamp((globalT-phaseT)/pDur,0,1), ep=ease(pp);
      let ts;
      if      (phase==="inhale") ts=lerp(.68,1.18,ep);
      else if (phase==="hold")   ts=1.18+Math.sin(globalT*5)*.009;
      else if (phase==="exhale") ts=lerp(1.18,.68,ep);
      else                       ts=.68+Math.sin(globalT*2)*.005;
      scl+=((ts-scl)*clamp(dt*8,0,1));
      const R=(size*.285)*scl;
      const c1=BREATH_COLORS[phase]||BREATH_COLORS.rest;
      const c0=BREATH_COLORS[{inhale:"rest",hold:"inhale",exhale:"hold",rest:"exhale"}[phase]]||c1;
      const [cr,cg,cb]=lerpRGB(c0,c1,ease(clamp(pp*1.8,0,1)));
      ctx.clearRect(0,0,size,size);
      // Atmosphere
      [[2.7,.03],[1.9,.055],[1.35,.04]].forEach(([fr,fa])=>{
        const g=ctx.createRadialGradient(cx,cy,R*.4,cx,cy,R*fr);
        g.addColorStop(0,`rgba(${cr},${cg},${cb},0)`);
        g.addColorStop(.4,`rgba(${cr},${cg},${cb},${fa})`);
        g.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,R*fr,0,TAU); ctx.fill();
      });
      // Dendrites
      geoRef.current.dendrites.forEach(d=>{
        const w=Math.sin(globalT*d.spd+d.off)*.055;
        const a=d.ang+w, ex=cx+Math.cos(a)*R*.93, ey=cy+Math.sin(a)*R*.93, bl=d.len*scl*.8;
        ctx.lineCap="round";
        ctx.strokeStyle=`rgba(${cr},${cg},${cb},.28)`; ctx.lineWidth=1.1;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(ex,ey); ctx.stroke();
        ctx.strokeStyle=`rgba(${cr},${cg},${cb},.15)`; ctx.lineWidth=.65;
        ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(ex+Math.cos(d.sA)*bl*.52,ey+Math.sin(d.sA)*bl*.52); ctx.stroke();
        ctx.strokeStyle=`rgba(${cr},${cg},${cb},.11)`; ctx.lineWidth=.5;
        ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(ex+Math.cos(d.sB)*bl*.4,ey+Math.sin(d.sB)*bl*.4); ctx.stroke();
        ctx.fillStyle=`rgba(${cr},${cg},${cb},.45)`; ctx.beginPath(); ctx.arc(ex,ey,1.5,0,TAU); ctx.fill();
      });
      // Axon
      const aA=PI*.18, aS=R*.94, aE=R*1.68;
      ctx.setLineDash([4,7]); ctx.lineCap="round";
      ctx.strokeStyle=`rgba(${cr},${cg},${cb},.42)`; ctx.lineWidth=1.3;
      ctx.beginPath(); ctx.moveTo(cx+Math.cos(aA)*aS,cy+Math.sin(aA)*aS); ctx.lineTo(cx+Math.cos(aA)*aE,cy+Math.sin(aA)*aE); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=`rgba(${cr},${cg},${cb},.85)`; ctx.beginPath(); ctx.arc(cx+Math.cos(aA)*aE,cy+Math.sin(aA)*aE,2.8,0,TAU); ctx.fill();
      for (let i=0;i<4;i++){const f=.22+i*.2,mx=cx+Math.cos(aA)*(aS+(aE-aS)*f),my=cy+Math.sin(aA)*(aS+(aE-aS)*f);ctx.strokeStyle=`rgba(${cr},${cg},${cb},.18)`;ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(mx,my,3.2,0,TAU);ctx.stroke();}
      geoRef.current.axonPulse=(geoRef.current.axonPulse+dt*.52)%1;
      const ap=geoRef.current.axonPulse, apx=cx+Math.cos(aA)*(aS+(aE-aS)*ap), apy=cy+Math.sin(aA)*(aS+(aE-aS)*ap);
      const apg=ctx.createRadialGradient(apx,apy,0,apx,apy,7); apg.addColorStop(0,`rgba(${cr},${cg},${cb},.95)`); apg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=apg; ctx.beginPath(); ctx.arc(apx,apy,7,0,TAU); ctx.fill();
      // Soma fill
      const sg=ctx.createRadialGradient(cx-R*.12,cy-R*.1,0,cx,cy,R);
      sg.addColorStop(0,`rgba(${cr},${cg},${cb},${.2+ep*.1})`); sg.addColorStop(.5,`rgba(${cr},${cg},${cb},.06)`); sg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.fill();
      // Membrane
      ctx.shadowColor=`rgba(${cr},${cg},${cb},.55)`; ctx.shadowBlur=6+ep*5;
      ctx.strokeStyle=`rgba(${cr},${cg},${cb},${.82+ep*.15})`; ctx.lineWidth=2.1;
      ctx.beginPath();
      for (let a=0;a<=TAU+.04;a+=.04){const rm=R*(1+.022*Math.sin(a*3+globalT*PHI)+.012*Math.sin(a*7-globalT*PI*.7));a<.04?ctx.moveTo(cx+Math.cos(a)*rm,cy+Math.sin(a)*rm):ctx.lineTo(cx+Math.cos(a)*rm,cy+Math.sin(a)*rm);}
      ctx.closePath(); ctx.stroke(); ctx.shadowBlur=0;
      ctx.strokeStyle=`rgba(${Math.min(255,cr+90)},${Math.min(255,cg+80)},${Math.min(255,cb+60)},${.3+ep*.25})`; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.arc(cx,cy,R,-PI*.68,-PI*.05); ctx.stroke();
      // Nucleus
      const nR=R*.2, ng2=ctx.createRadialGradient(cx,cy,0,cx,cy,nR);
      ng2.addColorStop(0,`rgba(${cr},${cg},${cb},.42)`); ng2.addColorStop(1,`rgba(${cr},${cg},${cb},.03)`);
      ctx.fillStyle=ng2; ctx.beginPath(); ctx.arc(cx,cy,nR,0,TAU); ctx.fill();
      ctx.strokeStyle=`rgba(${cr},${cg},${cb},.5)`; ctx.lineWidth=.8; ctx.beginPath(); ctx.arc(cx,cy,nR,0,TAU); ctx.stroke();
      // Synapses
      geoRef.current.synapses.forEach(sv=>{
        const p=(Math.sin(globalT*sv.spd+sv.off)+1)*.5;
        const sx=cx+Math.cos(sv.ang)*R*sv.r*scl, sy=cy+Math.sin(sv.ang)*R*sv.r*scl;
        const vg=ctx.createRadialGradient(sx,sy,0,sx,sy,(1.2+p*1.6)*2.5); vg.addColorStop(0,`rgba(${cr},${cg},${cb},${p*.5})`); vg.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=vg; ctx.beginPath(); ctx.arc(sx,sy,(1.2+p*1.6)*2.5,0,TAU); ctx.fill();
        if (p>.78){ctx.fillStyle=`rgba(255,255,255,${(p-.78)*2*.6})`; ctx.beginPath(); ctx.arc(sx,sy,.9,0,TAU); ctx.fill();}
      });
      // Label
      ctx.font="500 8px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle=`rgba(${cr},${cg},${cb},${.72+ep*.2})`;
      ctx.fillText(BREATH_LABELS[phase]||"", cx, cy+2);
      raf=requestAnimationFrame(draw);
    }
    raf=requestAnimationFrame(draw);
    return ()=>cancelAnimationFrame(raf);
  }, [size]);

  return <canvas ref={canvasRef} width={size} height={size} style={{display:"block"}}/>;
}

// ─── Typewriter Console ───────────────────────────────────────────────────────
function Console({ lines, color }) {
  const [rows, setRows] = useState([]);
  const qRef   = useRef([]);
  const busy   = useRef(false);
  const seen   = useRef(new Set());
  const timer  = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    lines.forEach(l => { if (!seen.current.has(l)) { seen.current.add(l); qRef.current.push(l); }});
    if (!busy.current) next();
  }, [lines]);

  function next() {
    if (!qRef.current.length) { busy.current=false; return; }
    busy.current=true;
    const text=qRef.current.shift();
    const id=performance.now()+Math.random();
    setRows(p=>[...p.slice(-28),{id,text,shown:""}]);
    let i=0;
    function tc() {
      if (i<text.length) {
        const shown=text.slice(0,++i);
        setRows(p=>p.map(r=>r.id===id?{...r,shown}:r));
        timer.current=setTimeout(tc,13+Math.random()*10);
      } else { timer.current=setTimeout(next,140+text.length*3); }
    }
    tc();
  }
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[rows]);
  useEffect(()=>()=>clearTimeout(timer.current),[]);

  function rc(t) {
    if (t.startsWith("OK"))   return "#4ade80";
    if (t.startsWith(">>"))   return color;
    if (t.startsWith("EXEC")) return "#fbbf24";
    if (/^SET\s/.test(t))     return "#a78bfa";
    if (t.startsWith("LOAD")) return "#60a5fa";
    if (t.startsWith("SYNC")) return "#34d399";
    if (t.startsWith("FLUSH")||t.startsWith("WRITE")) return "#94a3b8";
    return "#3de8a050";
  }

  return (
    <div style={{background:"#010c14",border:"1px solid #0f172a",borderRadius:8,padding:"10px 12px",height:178,overflowY:"auto",fontFamily:"'JetBrains Mono',monospace"}}>
      <div style={{fontSize:7,color:"#1e293b",letterSpacing:".2em",marginBottom:5}}>// CONSCIOUSNESS CONSOLE ──────────────────</div>
      {rows.map(r => (
        <div key={r.id} style={{fontSize:9.5,color:rc(r.text),lineHeight:1.65}}>
          {r.shown}
          {r.shown.length<r.text.length && <span style={{animation:"blink .5s step-end infinite",color:"#4ade80"}}>█</span>}
        </div>
      ))}
      <div ref={endRef}/>
    </div>
  );
}

// ─── Package Stream ───────────────────────────────────────────────────────────
function PkgStream({ pkgs, progress, color }) {
  const [evts, setEvts] = useState([]);
  const sent = useRef(new Set());

  useEffect(() => {
    pkgs.forEach(p => {
      const pp=progress[p.id]||0;
      const ks=p.id+":s", kd=p.id+":d";
      if (pp>.04&&pp<1&&!sent.current.has(ks)) {
        sent.current.add(ks);
        setEvts(v=>[...v.slice(-15),{k:ks,txt:`▶  [${p.mod}] ${p.label}`,sub:p.quality,done:false}]);
      }
      if (pp>=1&&!sent.current.has(kd)) {
        sent.current.add(kd);
        setEvts(v=>[...v.slice(-15),{k:kd,txt:`✓  [${p.mod}] ${p.label} → ${p.state}`,sub:null,done:true}]);
      }
    });
  }, [JSON.stringify(pkgs.map(p=>Math.floor((progress[p.id]||0)*8)))]);

  return (
    <div style={{background:"#010c14",border:"1px solid #0f172a",borderRadius:8,padding:"8px 12px",height:110,overflowY:"auto",fontFamily:"'JetBrains Mono',monospace"}}>
      <div style={{fontSize:7,color:"#1e293b",letterSpacing:".2em",marginBottom:5}}>// PACKAGE STREAM</div>
      {evts.map(e => (
        <div key={e.k} style={{marginBottom:3}}>
          <div style={{fontSize:9,color:e.done?"#4ade80":color,lineHeight:1.5}}>{e.txt}</div>
          {e.sub && <div style={{fontSize:7.5,color:"#334155",paddingLeft:13}}>{e.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Marquee ──────────────────────────────────────────────────────────────────
// direction: "rtl" (default, right-to-left) | "ltr" (left-to-right)
function Marquee({ text, color, speed=38, direction="rtl" }) {
  const full = text + "   ·   " + text + "   ·   ";
  const [pos, setPos] = useState(0);
  const rafRef  = useRef(null);
  const prevRef = useRef(performance.now());
  const posRef  = useRef(0);
  const charW   = 8.0;

  useEffect(() => {
    const total = full.length * charW;
    posRef.current = direction === "ltr" ? total * 0.5 : 0;
    function tick(now) {
      const dt=(now-prevRef.current)/1000; prevRef.current=now;
      if (direction === "ltr") {
        posRef.current = (posRef.current - speed * dt + total * 2) % total;
      } else {
        posRef.current = (posRef.current + speed * dt) % total;
      }
      setPos(posRef.current);
      rafRef.current=requestAnimationFrame(tick);
    }
    rafRef.current=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(rafRef.current);
  }, [text, direction]);

  return (
    <div style={{overflow:"hidden",whiteSpace:"nowrap"}}>
      <span style={{display:"inline-block",transform:`translateX(${-posRef.current}px)`,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color,letterSpacing:".06em",lineHeight:1.8,willChange:"transform"}}>
        {full}{full}
      </span>
    </div>
  );
}

// ─── VerticalMarquee ──────────────────────────────────────────────────────────
// direction: "up" (bottom→top, right side) | "down" (top→bottom, left side)
// Speed is modulated by φ×π algorithm, synchronized with breath phase & audio.
const VM_PHASE_MUL = { inhale: PHI, hold: 1.0, exhale: PHI * PHI, rest: 1 / PHI };
const VM_BASE_SPD  = 26; // px/s base scroll speed
const VM_ITEM_H    = 16; // px per line

function VerticalMarquee({ lines, color, direction = "up", breathRef, beatHz = 0.1, carrier = 528, height = 320 }) {
  const posRef  = useRef(0);
  const prevRef = useRef(performance.now());
  const rafRef  = useRef(null);
  const [, setTick] = useState(0);

  const totalH = (lines?.length || 0) * VM_ITEM_H;

  useEffect(() => {
    if (totalH === 0) return;
    function frame(now) {
      const dt = (now - prevRef.current) / 1000;
      prevRef.current = now;
      const t = now / 1000;
      const phase    = breathRef?.current?.phase || "rest";
      const phaseMul = VM_PHASE_MUL[phase] || 1;
      // φ-tide: period ≈ φ s (~1.618 s golden wave)
      const phiWave  = 0.12 * Math.sin(TAU * t / PHI);
      // π-wave: beat sub-harmonic filtered through π×φ
      const piWave   = 0.09 * Math.sin(TAU * t * beatHz / (PI * PHI));
      // Carrier pulse: normalized to 528 Hz reference
      const carrierP = 0.04 * Math.sin(PI  * t * carrier / 528);
      const speed    = VM_BASE_SPD * phaseMul * (1 + phiWave + piWave + carrierP);
      posRef.current = (posRef.current + speed * dt + totalH * 100) % totalH;
      setTick(n => n + 1);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [totalH, beatHz, carrier]);

  if (!lines?.length) return <div style={{ height }} />;

  const offset = posRef.current % totalH;
  // "up":   content moves upward  → ty decreases from 0 to -totalH → loop
  // "down": content moves downward → ty goes from -totalH to 0 → loop
  const ty = direction === "up" ? -offset : offset - totalH;

  return (
    <div style={{ overflow: "hidden", height, position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${ty}px)`, willChange: "transform" }}>
        {[0, 1].map(copy => (
          <div key={copy}>
            {lines.map((line, i) => (
              <div key={i} style={{ height: VM_ITEM_H, display: "flex", alignItems: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color, letterSpacing: ".05em", padding: "0 4px", overflow: "hidden", whiteSpace: "nowrap" }}>
                {line}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const t1=setTimeout(()=>setVis(true),60);
    const t2=setTimeout(()=>{setVis(false);setTimeout(onDone,500);},5500);
    return ()=>{clearTimeout(t1);clearTimeout(t2);};
  }, []);
  return (
    <div style={{position:"fixed",bottom:22,left:"50%",transform:`translateX(-50%) translateY(${vis?0:10}px)`,opacity:vis?1:0,transition:"all .5s ease",background:"rgba(5,9,18,.92)",border:"1px solid #1e293b",borderRadius:8,padding:"7px 18px",zIndex:999,fontFamily:"'JetBrains Mono',monospace",pointerEvents:"none"}}>
      <div style={{fontSize:8,color:"#3d4d5e",lineHeight:1.6,textAlign:"center"}}>{msg}</div>
    </div>
  );
}

// ─── HRV Panel ───────────────────────────────────────────────────────────────
function HRVPanel({ onData, color }) {
  const [status, setStatus] = useState("idle");
  const [rmssd,  setRmssd]  = useState(0);
  const [bpm,    setBpm]    = useState(0);
  const buf = useRef([]);

  function calcRmssd(b) {
    if (b.length<4) return 0;
    const d=b.slice(1).map((v,i)=>(v-b[i])**2);
    return Math.sqrt(d.reduce((a,c)=>a+c)/d.length);
  }

  async function connect() {
    if (!navigator.bluetooth) { setStatus("error"); return; }
    try {
      setStatus("connecting");
      const dev=await navigator.bluetooth.requestDevice({
        filters:[{namePrefix:"Polar"},{namePrefix:"XOSS"},{namePrefix:"Magene"},{namePrefix:"H10"},{namePrefix:"H7"}],
        optionalServices:["0000180d-0000-1000-8000-00805f9b34fb"],
      });
      const srv=await dev.gatt.connect();
      const svc=await srv.getPrimaryService("0000180d-0000-1000-8000-00805f9b34fb");
      const ch=await svc.getCharacteristic("00002a37-0000-1000-8000-00805f9b34fb");
      await ch.startNotifications();
      ch.addEventListener("characteristicvaluechanged",e=>{
        const v=e.target.value, fl=v.getUint8(0);
        const b=(fl&1)?v.getUint16(1,true):v.getUint8(1); setBpm(b);
        if ((fl>>4)&1){
          let o=(fl&1)?3:2;
          while(o+1<v.byteLength){const rr=v.getUint16(o,true)*1000/1024;if(rr>280&&rr<2000)buf.current=[...buf.current.slice(-63),rr];o+=2;}
          const r=Math.round(calcRmssd(buf.current)*10)/10;
          setRmssd(r); onData(r,b);
        }
      });
      setStatus("connected");
    } catch(e){ setStatus("error"); }
  }

  const qc=rmssd<20?"#ef4444":rmssd<35?"#f97316":rmssd<50?"#fbbf24":rmssd<70?"#86efac":"#4ade80";
  const ql=rmssd<20?"критично":rmssd<35?"низкий":rmssd<50?"норма":rmssd<70?"хорошо":"отлично";

  return (
    <div style={{background:"rgba(6,10,20,.9)",border:`1px solid ${status==="connected"?color+"33":"#0a0f1a"}`,borderRadius:8,padding:"9px 13px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:7,color:"#1e293b",letterSpacing:".18em"}}>КАРДИОДАТЧИК</div>
          <div style={{fontSize:8.5,marginTop:2,color:status==="connected"?color:status==="connecting"?"#fbbf24":status==="error"?"#ef4444":"#334155"}}>
            {status==="idle"?"Не подключён":status==="connecting"?"⏳ Подключение...":status==="connected"?`● BLE · ${bpm} уд/мин`:"❌ Ошибка BLE"}
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {status==="connected" && (
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"monospace",fontSize:11,color:qc}}>{rmssd.toFixed(0)}<span style={{fontSize:7.5,color:"#334155"}}> мс</span></div>
              <div style={{fontSize:7.5,color:qc}}>HRV: {ql}</div>
            </div>
          )}
          {status!=="connected" && (
            <button onClick={connect} style={{background:"transparent",border:`1px solid ${color}44`,color,padding:"5px 14px",borderRadius:5,fontFamily:"monospace",fontSize:8.5,letterSpacing:".1em",cursor:"pointer"}}>CONNECT</button>
          )}
        </div>
      </div>
      {status==="connected" && (
        <div style={{marginTop:6,fontSize:7.5,color:"#1e293b",lineHeight:1.7}}>Биты адаптируются к RMSSD · φ-дыхание синхронизировано с когерентностью</div>
      )}
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap');
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(110vh)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes glw{0%,100%{opacity:.65}50%{opacity:1;text-shadow:0 0 20px currentColor}}
*{box-sizing:border-box;margin:0;padding:0;}
.gb{position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.016) 1px,transparent 1px);background-size:44px 44px;z-index:0;}
.sl{position:fixed;top:0;left:0;right:0;height:1px;background:rgba(80,255,120,.035);animation:scanline 7s linear infinite;pointer-events:none;z-index:50;}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#010810}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:2px}
`;

const base={minHeight:"100vh",background:"#020617",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace",color:"#e2e8f0",padding:"20px 14px",position:"relative"};

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function HumanOS() {
  const moon = getMoonInfo(getMoonPhase());
  const hour = new Date().getHours();

  const [stage,    setStage]   = useState("gender_select");
  const [gender,   setGender]  = useState(null);
  const [agreed,   setAgreed]  = useState(false);
  const [eyesOk,   setEyesOk]  = useState(false);
  const [elapsed,  setElapsed] = useState(0);
  const [clLines,  setCL]      = useState([]);
  const [pkgProg,  setPkgP]    = useState({});
  const [modules,  setMods]    = useState({});
  const [toast,    setToast]   = useState(null);
  const [vol,      setVol]     = useState(0.15);
  const [rmssdDisp,setRD]      = useState(0);
  const [audioOk,  setAudioOk] = useState(false);
  const [adaptive, setAdaptive]= useState(()=>computeAdaptive(new Date().getHours(), getMoonInfo(getMoonPhase()), 0, "m"));
  // Cheat codes: which are selected AND applied
  const [activeCheatCodes, setActiveCheatCodes] = useState({});   // { id: true } if applied
  const [cheatPending,     setCheatPending]     = useState({});   // selected but not yet applied
  const [winW,             setWinW]             = useState(window.innerWidth);

  const breathRef  = useRef({ phase:"rest" });
  const rmssdRef   = useRef(0);
  const audioRef   = useRef(null);
  const pkgsRef    = useRef(null);
  const tickRef    = useRef(null);
  const breathTick = useRef(null);
  const toastSent  = useRef(false);
  const seenLines  = useRef(new Set());
  const adaptRef   = useRef(adaptive);

  const gd = gender ? G[gender] : G.m;

  function getAdaptive(rmssd) {
    return computeAdaptive(hour, moon, rmssd||0, gender||"m");
  }

  function addLine(l) {
    if (seenLines.current.has(l)) return;
    seenLines.current.add(l); setCL(p=>[...p,l]);
  }

  function startBreath(seq) {
    let idx=0;
    function step() {
      const s=(seq||adaptRef.current?.breathSeq||[{phase:"inhale",dur:PHI**2},{phase:"hold",dur:PHI},{phase:"exhale",dur:PHI**3},{phase:"rest",dur:PHI**2}])[idx%4];
      breathRef.current.phase=s.phase;
      if (audioRef.current) audioRef.current.onBreath(s.phase, rmssdRef.current);
      breathTick.current=setTimeout(step,s.dur*1000); idx++;
    }
    step();
  }

  function startSession() {
    // _ensureCtx() MUST be the very first call — we're inside the button onClick
    // gesture scope. This creates/resumes the AudioContext before anything else.
    _ensureCtx();
    if (!pkgsRef.current) pkgsRef.current=gd.pkgs;
    const adp=getAdaptive(rmssdRef.current);
    setAdaptive(adp); adaptRef.current=adp;
    setStage("running"); setElapsed(0); setCL([]); setPkgP({});
    seenLines.current=new Set(); toastSent.current=false; setAudioOk(false);
    audioRef.current=new AudioEngine();
    audioRef.current.start(adp.carrier, adp.beat, vol);
    // Poll audio state — give ctx time to transition from suspended→running
    const checkAudio = () => {
      const ok = audioRef.current?.running && audioRef.current?.ctx?.state === "running";
      setAudioOk(ok);
    };
    setTimeout(checkAudio, 500);
    setTimeout(checkAudio, 1500); // second check in case iOS was slow to resume
    startBreath(adp.breathSeq);
    const t0=Date.now();
    tickRef.current=setInterval(()=>{
      const el=(Date.now()-t0)/1000; setElapsed(el);
      if (el>=adp.totalMin*60) {
        clearInterval(tickRef.current); clearTimeout(breathTick.current);
        if (audioRef.current) audioRef.current.stop();
        const mods={}; pkgsRef.current.forEach(p=>{mods[p.mod]=Math.round(72+Math.random()*26);});
        setMods(mods); setStage("done");
      }
    },250);
    setTimeout(()=>gd.console_lines.slice(0,4).forEach(addLine), 600);
  }

  function finishSession() {
    clearInterval(tickRef.current); clearTimeout(breathTick.current);
    if (audioRef.current) audioRef.current.stop();
    const mods={}; (pkgsRef.current||[]).forEach(p=>{mods[p.mod]=Math.round(72+Math.random()*26);});
    setMods(mods); setStage("done");
  }

  // Prewarm AudioContext on first touch so it's ready (but not required) by session start.
  useEffect(() => {
    function onFirstTouch() { _prewarmAudio(); }
    document.addEventListener("touchstart", onFirstTouch, { once: true, passive: true });
    document.addEventListener("click",      onFirstTouch, { once: true });
    return () => {
      document.removeEventListener("touchstart", onFirstTouch);
      document.removeEventListener("click",      onFirstTouch);
    };
  }, []);

  useEffect(() => {
    function onResize() { setWinW(window.innerWidth); }
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(()=>()=>{
    clearInterval(tickRef.current); clearTimeout(breathTick.current);
    if (audioRef.current) audioRef.current.stop();
  },[]);

  useEffect(()=>{
    if (stage!=="running") return;
    const adp=adaptRef.current; if (!adp) return;
    const pct=elapsed/(adp.totalMin*60);
    const li=Math.floor(pct*gd.console_lines.length*1.1);
    if (gd.console_lines[li]) addLine(gd.console_lines[li]);
    const ai=Math.floor(elapsed/(PHI**5))%gd.affirmation.length;
    addLine(`>> ${gd.affirmation[ai]}`);
    if (pct>.18&&pct<.90) {
      const ip=(pct-.18)/.72; const np={};
      pkgsRef.current.forEach((p,i)=>{np[p.id]=Math.max(0,Math.min(1,ip*pkgsRef.current.length-i));});
      setPkgP(np);
    } else if (pct>=.90) {
      const np={}; pkgsRef.current.forEach(p=>{np[p.id]=1;}); setPkgP(np);
      gd.done_lines.forEach(addLine);
    }
    if (!toastSent.current&&pct>.28&&pct<.37){toastSent.current=true;setToast(gd.higher_self);}
  },[Math.floor(elapsed*2)]);

  useEffect(()=>{if(audioRef.current)audioRef.current.setVol(vol);},[vol]);

  // ── GENDER SELECT ──────────────────────────────────────────────────────────
  if (stage==="gender_select") return (
    <div style={base}>
      <style>{CSS}</style>
      <div className="gb"/><div className="sl"/>
      <div style={{width:"100%",maxWidth:400,animation:"fadeUp .7s ease",position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:5,fontSize:7.5,color:"#1e293b",letterSpacing:".3em"}}>HOMO SAPIENS OS</div>
        <div style={{textAlign:"center",marginBottom:5,fontSize:8.5,color:"#334155"}}>{moon.e} {moon.n} · {Math.round(moon.power*100)}%</div>
        <h1 style={{textAlign:"center",fontSize:16,fontWeight:700,letterSpacing:".1em",color:"#e2e8f0",marginBottom:24}}>ОБНОВЛЕНИЕ ДОСТУПНО</h1>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          {[{id:"m",icon:"⚡",title:"МУЖЧИНА",sub:"Эфир · Программа",color:"#3de8a0"},{id:"f",icon:"🌍",title:"ЖЕНЩИНА",sub:"Земля · Матрица",color:"#f472b6"}].map(o=>(
            <div key={o.id} onClick={()=>{setGender(o.id);setAdaptive(computeAdaptive(hour,moon,0,o.id));setStage("agreement");}}
              style={{background:"rgba(8,14,26,.95)",border:`1px solid ${o.color}25`,borderRadius:11,padding:"22px 14px",textAlign:"center",cursor:"pointer",transition:"transform .15s"}}
              onMouseEnter={e=>e.currentTarget.style.transform="scale(1.03)"}
              onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
              <div style={{fontSize:28,marginBottom:9}}>{o.icon}</div>
              <div style={{fontSize:11,fontWeight:700,color:o.color,letterSpacing:".12em",marginBottom:4}}>{o.title}</div>
              <div style={{fontSize:8,color:"#475569"}}>{o.sub}</div>
            </div>
          ))}
        </div>
        <div style={{textAlign:"center",fontSize:8.5,color:"#fbbf24"}}>⚠ Установка работает только с открытыми глазами</div>
      </div>
    </div>
  );

  // ── AGREEMENT ─────────────────────────────────────────────────────────────
  if (stage==="agreement") {
    const agreeText = gender === "f"
      ? `Соглашаюсь с установкой и принимаю программу — Женщина, Счастливая, Здоровая, Богатая, Молодая, Красивая, Сексуальная, В прекрасных отношениях, С регулярным сексом, В вечной любви, В унисон со своим предназначением, Получающая удовольствие от этого процесса!`
      : `Соглашаюсь с установкой и принимаю программу — Мужчина, Счастливый, Здоровый, Богатый, Молодой, Красивый, Сексуальный, В прекрасных отношениях, С регулярным сексом, В вечной любви, В унисон со своим предназначением, Получающий удовольствие от этого процесса!`;
    return (
    <div style={{...base,justifyContent:"flex-start",paddingTop:16,overflowY:"auto"}}>
      <style>{CSS}</style>
      <div className="gb"/>
      <div style={{width:"100%",maxWidth:460,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:18,marginBottom:4}}>{gd.symbol}</div>
          <div style={{fontSize:12,fontWeight:700,color:gd.color,letterSpacing:".12em"}}>СОГЛАШЕНИЕ НА УСТАНОВКУ</div>
          <div style={{fontSize:8,color:"#334155",marginTop:4}}>{adaptive.reasons}</div>
        </div>
        <div style={{background:"rgba(8,14,26,.95)",border:`1px solid ${gd.color}1e`,borderRadius:10,padding:"14px 16px",marginBottom:11}}>
          <div style={{fontSize:8,color:"#334155",letterSpacing:".15em",marginBottom:8}}>ПРОГРАММА УСТАНОВКИ:</div>
          {gd.affirmation.map((l,i)=>(
            <div key={i} style={{fontSize:i===0?11:9.5,color:i===0?gd.color:"#7a8fa8",fontWeight:i===0?700:400,lineHeight:1.9,paddingLeft:i>0?12:0,borderLeft:i>0?`1px solid ${gd.color}18`:"none",marginLeft:i>0?4:0}}>{l}</div>
          ))}
        </div>
        <div style={{background:"rgba(8,14,26,.95)",border:`1px solid ${gd.color}14`,borderRadius:10,padding:"11px 16px",marginBottom:11}}>
          <div style={{fontSize:8,color:"#334155",letterSpacing:".15em",marginBottom:8}}>ПАРАМЕТРЫ СЕССИИ:</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[["Несущая",`${adaptive.carrier.toFixed(1)} Hz`],["Бит",`${adaptive.beat.toFixed(2)} Hz`],["Вдох",`${adaptive.breathSeq[0].dur.toFixed(1)}с`],["Задержка",`${adaptive.breathSeq[1].dur.toFixed(1)}с`],["Выдох",`${adaptive.breathSeq[2].dur.toFixed(1)}с`],["Длит.",`${adaptive.totalMin} мин`]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:8,borderBottom:"1px solid #090e16",paddingBottom:3}}>
                <span style={{color:"#334155"}}>{k}</span>
                <span style={{color:gd.color,fontFamily:"monospace"}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:"rgba(8,14,26,.95)",border:"1px solid #0a0f1a",borderRadius:10,padding:"13px 16px",marginBottom:14}}>
          {[{s:agreed,set:setAgreed,c:gd.color,t:agreeText},
            {s:eyesOk,set:setEyesOk,c:"#fbbf24",t:"Подтверждаю: глаза открыты · я здесь и сейчас · внутренний диалог остановлен"}
          ].map((item,i)=>(
            <label key={i} style={{display:"flex",alignItems:"flex-start",gap:9,cursor:"pointer",fontSize:9,color:item.s?item.c:"#475569",lineHeight:1.8,marginBottom:i===0?12:0,transition:"color .2s"}}>
              <input type="checkbox" checked={item.s} onChange={e=>item.set(e.target.checked)} style={{marginTop:3,accentColor:item.c,cursor:"pointer",flexShrink:0}}/>
              <span>{item.t}</span>
            </label>
          ))}
        </div>

        {/* Cheat code selector */}
        <div style={{background:"rgba(251,191,36,.03)",border:"1px solid #fbbf2416",borderRadius:10,padding:"13px 16px",marginBottom:14}}>
          <div style={{fontSize:8,color:"#fbbf2480",letterSpacing:".15em",marginBottom:10}}>✦ ВЫБОР ЧИТ КОДОВ:</div>
          {Object.values(CHEAT_CODES).map(cc=>(
            <div key={cc.id} style={{marginBottom:10}}>
              <label style={{display:"flex",alignItems:"flex-start",gap:9,cursor:"pointer",fontSize:9,color:cheatPending[cc.id]?"#fbbf24":"#475569",lineHeight:1.6,transition:"color .2s"}}>
                <input type="checkbox" checked={!!cheatPending[cc.id]} onChange={e=>setCheatPending(p=>({...p,[cc.id]:e.target.checked||undefined}))}
                  style={{marginTop:2,accentColor:"#fbbf24",cursor:"pointer",flexShrink:0}}/>
                <div>
                  <div style={{fontWeight:700,letterSpacing:".06em",fontSize:8.5}}>{cc.title}</div>
                  <div style={{fontSize:7.5,color:"#334155",lineHeight:1.7,marginTop:2}}>{cc.text.slice(0,110)}…</div>
                </div>
              </label>
            </div>
          ))}
          {Object.values(cheatPending).some(Boolean) && (
            <button onClick={()=>setActiveCheatCodes({...cheatPending})}
              style={{width:"100%",background:"rgba(251,191,36,.08)",border:"1px solid #fbbf2444",color:"#fbbf24",padding:"7px",borderRadius:6,fontFamily:"monospace",fontSize:9,letterSpacing:".15em",cursor:"pointer",marginTop:2}}>
              ▶ ПРИМЕНИТЬ ЧИТ КОД{Object.values(cheatPending).filter(Boolean).length>1?"Ы":""}
            </button>
          )}
          {Object.values(activeCheatCodes).some(Boolean) && (
            <div style={{marginTop:7,fontSize:7.5,color:"#4ade8066",letterSpacing:".08em"}}>✓ Активировано: {Object.keys(activeCheatCodes).filter(k=>activeCheatCodes[k]).map(k=>CHEAT_CODES[k]?.title).join(" + ")}</div>
          )}
        </div>

        <div style={{display:"flex",gap:9,paddingBottom:20}}>
          <button onClick={()=>setStage("gender_select")} style={{flex:1,background:"transparent",border:"1px solid #0a0f1a",color:"#334155",padding:"9px",borderRadius:7,fontFamily:"monospace",fontSize:8.5,cursor:"pointer"}}>← НАЗАД</button>
          <button disabled={!agreed||!eyesOk} onClick={()=>setStage("briefing")} style={{flex:2,background:agreed&&eyesOk?`${gd.color}12`:"transparent",border:`1px solid ${agreed&&eyesOk?gd.color:"#0a0f1a"}`,color:agreed&&eyesOk?gd.color:"#1e293b",padding:"9px",borderRadius:7,fontFamily:"monospace",fontSize:9.5,letterSpacing:".14em",cursor:agreed&&eyesOk?"pointer":"not-allowed",transition:"all .3s",boxShadow:agreed&&eyesOk?`0 0 16px ${gd.color}15`:"none"}}>
            НАЧАТЬ УСТАНОВКУ →
          </button>
        </div>
      </div>
    </div>
    );
  }

  // ── BRIEFING ──────────────────────────────────────────────────────────────
  if (stage==="briefing") {
    if (!pkgsRef.current) pkgsRef.current=gd.pkgs;
    return (
      <div style={base}>
        <style>{CSS}</style>
        <div className="gb"/>
        <div style={{width:"100%",maxWidth:430,position:"relative",zIndex:1}}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:9,color:"#334155",letterSpacing:".18em",marginBottom:3}}>{moon.e} {moon.n} · {adaptive.totalMin} мин · {adaptive.carrier.toFixed(1)} Hz · бит {adaptive.beat.toFixed(2)} Hz</div>
            <div style={{fontSize:14,fontWeight:700,color:gd.color,letterSpacing:".1em"}}>ПАКЕТЫ К УСТАНОВКЕ</div>
          </div>
          <div style={{background:"rgba(8,14,26,.95)",border:`1px solid ${gd.color}1e`,borderRadius:10,padding:"11px 15px",marginBottom:11}}>
            {pkgsRef.current.map((p,i)=>(
              <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:i<pkgsRef.current.length-1?"1px solid #090e16":"none"}}>
                <div>
                  <div style={{fontSize:8.5,color:"#5a6e82",fontFamily:"monospace"}}>{p.label}</div>
                  <div style={{fontSize:7.5,color:"#23303e"}}>{p.mod} · {p.quality}</div>
                </div>
                <div style={{fontSize:7,color:gd.color,border:`1px solid ${gd.color}25`,borderRadius:3,padding:"2px 6px",fontFamily:"monospace",background:`${gd.color}08`}}>{p.state}</div>
              </div>
            ))}
          </div>
          <div style={{marginBottom:11}}>
            <HRVPanel onData={(r,b)=>{rmssdRef.current=r;setRD(r);const a=getAdaptive(r);setAdaptive(a);adaptRef.current=a;}} color={gd.color}/>
          </div>
          <div style={{background:"rgba(251,191,36,.03)",border:"1px solid #fbbf2412",borderRadius:7,padding:"8px 12px",marginBottom:13,fontSize:8,color:"#3d5066",lineHeight:2}}>
            ⚠ Глаза открыты · Следуйте нейрону · Остановите внутренний диалог
          </div>
          <button onClick={startSession} style={{width:"100%",background:`${gd.color}10`,border:`1px solid ${gd.color}`,color:gd.color,padding:"11px",borderRadius:8,fontFamily:"monospace",fontSize:11,letterSpacing:".18em",cursor:"pointer",boxShadow:`0 0 20px ${gd.color}15`,transition:"box-shadow .2s"}}
            onMouseEnter={e=>e.target.style.boxShadow=`0 0 30px ${gd.color}28`}
            onMouseLeave={e=>e.target.style.boxShadow=`0 0 20px ${gd.color}15`}>
            ▶ ЗАПУСТИТЬ УСТАНОВКУ
          </button>
        </div>
      </div>
    );
  }

  // ── RUNNING ───────────────────────────────────────────────────────────────
  if (stage==="running") {
    const totalDur=adaptive.totalMin*60;
    const pct=Math.min(1,elapsed/totalDur);
    const rem=Math.max(0,totalDur-elapsed);
    const mm=String(Math.floor(rem/60)).padStart(2,"0");
    const ss=String(Math.floor(rem%60)).padStart(2,"0");
    const done=(pkgsRef.current||[]).filter(p=>(pkgProg[p.id]||0)>=1).length;
    const total=(pkgsRef.current||[]).length;
    // Responsive layout for mobile
    const sideW   = Math.min(68, Math.floor(winW * 0.14));
    const orbSize = Math.max(180, Math.min(300, winW - sideW * 2 - 24));
    const marqueeH = orbSize + 90;
    const affirmLines = AFFIRMATIONS_MARQUEE.split(" · ").filter(Boolean);
    const leftLines  = [...gd.console_lines, ...affirmLines];
    const rightLines = [
      ...clLines,
      ...(pkgsRef.current||[]).map(p => `${p.label} :: ${p.state}`),
      ...affirmLines,
    ];
    return (
      <div style={{...base,justifyContent:"flex-start",paddingTop:12}}>
        <style>{`${CSS}.gb{background-image:linear-gradient(${gd.color}04 1px,transparent 1px),linear-gradient(90deg,${gd.color}04 1px,transparent 1px);background-size:40px 40px;}`}</style>
        <div className="gb"/><div className="sl"/>
        {toast && <Toast msg={toast} onDone={()=>setToast(null)}/>}
        <div style={{width:"100%",position:"relative",zIndex:1}}>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11}}>
            <div>
              <div style={{fontSize:7,color:"#1e293b",letterSpacing:".2em"}}>HOMO SAPIENS OS</div>
              <div style={{fontSize:9,color:gd.color,letterSpacing:".07em"}}>{gd.pronoun.toUpperCase()} · {gd.element}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:7.5,color:"#334155",textAlign:"right"}}>
                <div>{moon.e} {moon.n}</div>
                <div>{Math.round(moon.power*100)}%</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:7.5,color:"#1e293b"}}>♪</span>
                <input type="range" min={0} max={0.4} step={0.01} value={vol} onChange={e=>setVol(+e.target.value)} style={{width:48,accentColor:gd.color,cursor:"pointer"}}/>
              </div>
              {!audioOk && (
                <button onClick={()=>{
                  // _ensureCtx() is the FIRST call — we're inside a button click gesture
                  const ctx = _ensureCtx();
                  if (audioRef.current?.running && ctx) {
                    // Context was suspended and is now resuming — just wait
                    setTimeout(()=>setAudioOk(ctx.state==="running"),600);
                  } else {
                    // Restart audio engine from scratch
                    if (audioRef.current) audioRef.current.stop();
                    audioRef.current = new AudioEngine();
                    audioRef.current.start(adaptive.carrier, adaptive.beat, vol);
                    setTimeout(()=>setAudioOk(audioRef.current?.running && audioRef.current?.ctx?.state==="running"), 600);
                  }
                }} style={{background:"transparent",border:`1px solid ${gd.color}55`,color:gd.color,padding:"4px 9px",borderRadius:5,fontFamily:"monospace",fontSize:8,letterSpacing:".1em",cursor:"pointer",animation:"blink 2s step-end infinite"}}>🔊 звук</button>
              )}
            </div>
          </div>

          <div style={{display:"flex",alignItems:"stretch",gap:6,marginBottom:11}}>
            {/* Left column: top→bottom vertical marquee */}
            <div style={{width:sideW,flexShrink:0,opacity:.8}}>
              <VerticalMarquee lines={leftLines} color={`${gd.color}55`} direction="down"
                breathRef={breathRef} beatHz={adaptive.beat} carrier={adaptive.carrier}
                height={marqueeH}/>
            </div>
            {/* Center column: orb + timer + freq info */}
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6,minWidth:0}}>
              <NeuronOrb breathRef={breathRef} size={orbSize}/>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:300,letterSpacing:".1em",lineHeight:1}}>{mm}:{ss}</div>
                <div style={{fontSize:6.5,color:"#1e293b",letterSpacing:".2em"}}>ОСТАЛОСЬ</div>
              </div>
              <div style={{textAlign:"center",fontSize:7.5,color:"#283444",lineHeight:2}}>
                <div style={{color:"#374151"}}>{adaptive.carrier.toFixed(1)} Hz</div>
                <div>бит {adaptive.beat.toFixed(2)} Hz</div>
                <div style={{fontSize:7,color:"#283444"}}>{adaptive.tw}</div>
                {rmssdDisp>0 && <div style={{color:gd.color}}>HRV {rmssdDisp}мс</div>}
              </div>
            </div>
            {/* Right column: bottom→top vertical marquee */}
            <div style={{width:sideW,flexShrink:0,opacity:.8}}>
              <VerticalMarquee lines={rightLines} color={`${gd.color}55`} direction="up"
                breathRef={breathRef} beatHz={adaptive.beat} carrier={adaptive.carrier}
                height={marqueeH}/>
            </div>
          </div>

          <div style={{marginBottom:9}}>
            <HRVPanel onData={(r,b)=>{
              rmssdRef.current=r; setRD(r);
              if (audioRef.current) audioRef.current.onBreath(breathRef.current.phase,r);
              const a=getAdaptive(r); setAdaptive(a); adaptRef.current=a;
            }} color={gd.color}/>
          </div>

          <div style={{background:"rgba(5,9,18,.95)",border:"1px solid #09101a",borderRadius:8,padding:"10px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:7.5,color:"#1e293b"}}>
              <span>ПРОГРЕСС · {done}/{total}</span>
              <span style={{color:gd.color}}>{Math.round(pct*100)}%</span>
            </div>
            <div style={{height:3,background:"#09101a",borderRadius:2,overflow:"hidden",marginBottom:10}}>
              <div style={{height:"100%",width:`${pct*100}%`,background:`linear-gradient(90deg,${gd.color}50,${gd.color})`,boxShadow:`0 0 7px ${gd.color}40`,borderRadius:2,transition:"width .6s"}}/>
            </div>
            <button onClick={finishSession}
              style={{width:"100%",background:"transparent",border:`1px solid ${gd.color}2e`,color:`${gd.color}66`,padding:"7px",borderRadius:6,fontFamily:"monospace",fontSize:9,letterSpacing:".2em",cursor:"pointer",transition:"all .2s",marginBottom:8}}
              onMouseEnter={e=>{e.target.style.borderColor=gd.color;e.target.style.color=gd.color;}}
              onMouseLeave={e=>{e.target.style.borderColor=`${gd.color}2e`;e.target.style.color=`${gd.color}66`;}}>
              ENTER — ЗАВЕРШИТЬ СЕССИЮ
            </button>
            <div style={{borderTop:"1px solid #09101a",paddingTop:6}}>
              {/* Affirmations — left-to-right */}
              <Marquee color={`${gd.color}35`} speed={26} direction="ltr" text={AFFIRMATIONS_MARQUEE}/>
              {/* Active cheat codes — right-to-left (only if applied) */}
              {Object.values(activeCheatCodes).some(Boolean) ? (
                <Marquee color={`${gd.color}55`} speed={32} direction="rtl"
                  text={Object.keys(activeCheatCodes).filter(k=>activeCheatCodes[k]).map(k=>CHEAT_CODES[k]?.text).join("   ·   ")}/>
              ) : (
                <div style={{fontSize:7.5,color:"#1e293b",textAlign:"center",lineHeight:2,letterSpacing:".1em"}}>
                  ← нет активных чит кодов — выберите на экране соглашения →
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ── DONE ─────────────────────────────────────────────────────────────────
  if (stage==="done") {
    const MC={"ЦНС":"#60a5fa","Сердце":"#f472b6","ЭНС":"#4ade80","ДНК":"#a78bfa","Энергия":"#fbbf24","Мозг":"#34d399","Поле":"#94a3b8","Интелл.":"#f97316","Душа":"#e2e8f0","Земля":"#86efac","Ритмы":"#7dd3fc","Клетки":"#c084fc"};
    return (
      <div style={base}>
        <style>{`${CSS}@keyframes glw{0%,100%{opacity:.65}50%{opacity:1;text-shadow:0 0 20px currentColor}}`}</style>
        <div className="gb"/>
        <div style={{width:"100%",maxWidth:470,position:"relative",zIndex:1,animation:"fadeUp .7s ease"}}>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{fontSize:24,color:gd.color,animation:"glw 3s infinite",marginBottom:5}}>✦</div>
            <div style={{fontSize:13,fontWeight:700,color:gd.color,letterSpacing:".11em",marginBottom:3}}>УСТАНОВКА ЗАВЕРШЕНА</div>
            <div style={{fontSize:8,color:"#334155",lineHeight:2}}>Все пакеты интегрированы · 5–10 мин тишины</div>
          </div>
          <div style={{background:"rgba(5,9,18,.95)",border:"1px solid #09101a",borderRadius:10,padding:"13px 15px",marginBottom:11}}>
            <div style={{fontSize:7,color:"#1e293b",letterSpacing:".2em",marginBottom:9}}>МОДУЛИ:</div>
            {Object.entries(modules).map(([mod,val])=>(
              <div key={mod} style={{marginBottom:7}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2,fontSize:8.5}}>
                  <span style={{color:"#6b7f96",fontFamily:"monospace"}}>{mod}</span>
                  <span style={{color:MC[mod]||gd.color,fontFamily:"monospace"}}>{val}%</span>
                </div>
                <div style={{height:2.5,background:"#090e16",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${val}%`,background:`linear-gradient(90deg,${MC[mod]||gd.color}50,${MC[mod]||gd.color})`,borderRadius:2,transition:"width 1.8s ease"}}/>
                </div>
              </div>
            ))}
          </div>
          <div style={{background:"rgba(5,9,18,.95)",border:"1px solid #09101a",borderRadius:10,padding:"11px 15px",marginBottom:11}}>
            <div style={{fontSize:7,color:"#1e293b",letterSpacing:".2em",marginBottom:7}}>УСТАНОВЛЕННЫЕ СОСТОЯНИЯ:</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {(pkgsRef.current||[]).map(p=>(
                <span key={p.id} style={{fontSize:7.5,color:gd.color,border:`1px solid ${gd.color}25`,borderRadius:3,padding:"2px 7px",background:`${gd.color}07`,fontFamily:"monospace"}}>{p.state}</span>
              ))}
            </div>
          </div>
          <div style={{background:"rgba(251,191,36,.03)",border:"1px solid #fbbf2410",borderRadius:8,padding:"9px 13px",marginBottom:16,overflow:"hidden"}}>
            {/* Affirmations — LTR */}
            <div style={{fontSize:7,color:"#94a3b840",letterSpacing:".12em",marginBottom:4}}>◈ АФФИРМАЦИИ:</div>
            <Marquee color="#94a3b855" speed={26} direction="ltr" text={AFFIRMATIONS_MARQUEE}/>
            {/* Activated cheat codes — RTL */}
            {Object.values(activeCheatCodes).some(Boolean) && (
              <>
                <div style={{fontSize:7,color:"#fbbf2480",letterSpacing:".15em",marginTop:8,marginBottom:4}}>✦ ЧИТ КОД — АКТИВИРОВАН:</div>
                <Marquee color="#fbbf2466" speed={38} direction="rtl"
                  text={Object.keys(activeCheatCodes).filter(k=>activeCheatCodes[k]).map(k=>CHEAT_CODES[k]?.text).join("   ·   ")}/>
              </>
            )}
            {!Object.values(activeCheatCodes).some(Boolean) && (
              <div style={{fontSize:7.5,color:"#283444",textAlign:"center",lineHeight:2,marginTop:4}}>чит коды не активированы — выберите при следующей сессии</div>
            )}
            <div style={{marginTop:6,fontSize:7,color:"#283444"}}>
              Следующее обновление ≈ через {Math.round(PHI**5)} ч · {adaptive.reasons}
            </div>
          </div>
          <div style={{display:"flex",gap:9}}>
            <button onClick={()=>{setStage("gender_select");setGender(null);pkgsRef.current=null;setElapsed(0);setAgreed(false);setEyesOk(false);}} style={{flex:1,background:"transparent",border:"1px solid #09101a",color:"#334155",padding:"9px",borderRadius:7,fontFamily:"monospace",fontSize:8.5,cursor:"pointer"}}>← НАЧАЛО</button>
            <button onClick={()=>{setElapsed(0);setCL([]);setPkgP({});toastSent.current=false;seenLines.current=new Set();startSession();}} style={{flex:2,background:`${gd.color}0e`,border:`1px solid ${gd.color}`,color:gd.color,padding:"9px",borderRadius:7,fontFamily:"monospace",fontSize:9.5,letterSpacing:".12em",cursor:"pointer",boxShadow:`0 0 14px ${gd.color}15`}}>↺ ПОВТОРИТЬ</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

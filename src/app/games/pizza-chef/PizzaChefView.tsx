'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
type Topping = 'mushroom'|'cheese'|'pepperoni'|'corn'|'olive'|'tomato'|'broccoli'|'bacon'|'pineapple'|'shrimp';
type GamePhase = 'topPick'|'cutting'|'selecting'|'correct'|'wrong'|'angry'|'gameover';
interface AnimalEntry { emoji: string; name: string }
interface Order { numerator: number; denominator: number; topping: Topping; animal: AnimalEntry }
interface CoinParticle { id: number; amount: number }

// ─── Constants ─────────────────────────────────────────────────────────────────
const ORDER_TIME_BASE = 22;
interface GameSettings { streakInterval: number; timeReduction: number; minTime: number }
const DEFAULT_SETTINGS: GameSettings = { streakInterval: 3, timeReduction: 2, minTime: 8 };
function getOrderTime(streak: number, s: GameSettings): number {
  return Math.max(s.minTime, ORDER_TIME_BASE - Math.floor(streak / s.streakInterval) * s.timeReduction);
}
const MAX_WRONG  = 3;
const MAX_ANGRY  = 3;
const FEEDBACK_MS = 1600;
// Cumulative money thresholds: each new topping costs +100, +120, +140, +160, +180, +200, +220
const UNLOCK_MILESTONES = [100, 220, 360, 520, 700, 900, 1120];
const COIN_DENOMS = [100, 50, 10, 1];
const WRONG_MSGS: {display:string;speak:string}[] = [
  {display:'❌ Try again!',           speak:'Try again!'},
  {display:'🔄 Oops! Try once more!', speak:'Oops! Try once more!'},
  {display:'💪 Almost there!',        speak:'Almost there!'},
  {display:'🤔 Not quite right!',     speak:'Not quite right!'},
  {display:'😅 Keep trying!',         speak:'Keep trying!'},
  {display:'🍕 Check the order!',     speak:'Check the order!'},
  {display:'👀 Look again!',          speak:'Look again!'},
  {display:'🌟 You can do it!',       speak:'You can do it!'},
  {display:'💡 Think carefully!',     speak:'Think carefully!'},
  {display:'🎯 So close! Try again!', speak:'So close! Try again!'},
];
const CORRECT_MSGS: {display:string;speak:string}[] = [
  {display:'✅ Correct!',        speak:'Correct!'},
  {display:'🌟 Well done!',      speak:'Well done!'},
  {display:'🎉 Great job!',      speak:'Great job!'},
  {display:'🔥 Amazing!',        speak:'Amazing!'},
  {display:'🏆 Superstar!',      speak:'Superstar!'},
  {display:'🎊 Fantastic!',      speak:'Fantastic!'},
  {display:'⭐ You\'re brilliant!', speak:'You\'re brilliant!'},
  {display:'🍕 Perfect slice!',  speak:'Perfect slice!'},
  {display:'👏 Excellent!',      speak:'Excellent!'},
  {display:'🦸 Pizza Hero!',     speak:'Pizza Hero!'},
  {display:'🌈 Nice work!',      speak:'Nice work!'},
  {display:'✨ Nice job!',        speak:'Nice job!'},
];

const ALL_TOPPINGS: Topping[] = [
  'mushroom','cheese','pepperoni','corn','olive','tomato','broccoli','bacon','pineapple','shrimp',
];
const TOPPING_EMOJI: Record<Topping,string> = {
  mushroom:'🍄', cheese:'🧀', pepperoni:'🌭', corn:'🌽', olive:'🫒',
  tomato:'🍅', broccoli:'🥦', bacon:'🥓', pineapple:'🍍', shrimp:'🍤',
};
const TOPPING_NAME: Record<Topping,string> = {
  mushroom:'mushroom', cheese:'cheese', pepperoni:'pepperoni', corn:'corn', olive:'olive',
  tomato:'tomato', broccoli:'broccoli', bacon:'bacon', pineapple:'pineapple', shrimp:'shrimp',
};
const TOPPING_BG: Record<Topping,string> = {
  mushroom:  'linear-gradient(135deg,#fdf6ee,#f5e6d3)',
  cheese:    'linear-gradient(135deg,#fefce8,#fef9c3)',
  pepperoni: 'linear-gradient(135deg,#fff1f2,#ffe4e6)',
  corn:      'linear-gradient(135deg,#fefce8,#fef3c7)',
  olive:     'linear-gradient(135deg,#f0fdf4,#dcfce7)',
  tomato:    'linear-gradient(135deg,#fff1f2,#fee2e2)',
  broccoli:  'linear-gradient(135deg,#f0fdf4,#d1fae5)',
  bacon:     'linear-gradient(135deg,#fff7ed,#ffedd5)',
  pineapple: 'linear-gradient(135deg,#fefce8,#ecfccb)',
  shrimp:    'linear-gradient(135deg,#fff1f2,#fce7f3)',
};
const TOPPING_PIZZA_COLOR: Record<Topping,[string,string]> = {
  mushroom:  ['#fdf4e8','#f0d5b0'],
  cheese:    ['#fef3c7','#fde68a'],
  pepperoni: ['#fff0ef','#ffd5d3'],
  corn:      ['#fefce8','#fef8c0'],
  olive:     ['#f0fdf4','#d1fae5'],
  tomato:    ['#fff1f2','#fee2e2'],
  broccoli:  ['#f0fdf4','#bbf7d0'],
  bacon:     ['#fff7ed','#ffedd5'],
  pineapple: ['#fefce8','#ecfccb'],
  shrimp:    ['#fff1f2','#fce7f3'],
};
const DEFAULT_PIZZA_COLOR: [string,string] = ['#fef3c7','#fde68a'];
const TOPPING_TEXT: Record<Topping,string> = {
  mushroom:'#7c3a0a', cheese:'#78350f', pepperoni:'#7f1d1d', corn:'#713f12', olive:'#14532d',
  tomato:'#7f1d1d', broccoli:'#14532d', bacon:'#7c2d12', pineapple:'#365314', shrimp:'#9f1239',
};

const NORMAL_ANIMALS: AnimalEntry[] = [
  {emoji:'🐱',name:'Kitty'},{emoji:'🐶',name:'Puppy'},{emoji:'🐻',name:'Teddy'},
  {emoji:'🐸',name:'Froggy'},{emoji:'🐼',name:'Panda'},{emoji:'🦊',name:'Foxy'},
  {emoji:'🐰',name:'Bunny'},{emoji:'🐨',name:'Koala'},
];
const SPECIAL_ANIMALS: AnimalEntry[] = [
  {emoji:'🦁',name:'King Leo'},{emoji:'🐯',name:'Tiger'},
  {emoji:'🐻‍❄️',name:'Polar'},{emoji:'🦄',name:'Unicorn'},
];
const DENOMINATORS = [2,3,4,6,8];

const COIN_STYLE: Record<number,{outer:string;inner:string;text:string}> = {
  1:  {outer:'#a16207',inner:'#ca8a04',text:'#fff'},
  10: {outer:'#b45309',inner:'#fbbf24',text:'#7c2d12'},
  50: {outer:'#be185d',inner:'#f472b6',text:'#fff'},
  100:{outer:'#6d28d9',inner:'#a78bfa',text:'#fff'},
};

// Scattered topping positions inside pizza face (cx=100,cy=100,r≈75)
const TOPPING_POS = [
  [70,62],[128,58],[100,44],[54,98],[144,95],
  [76,134],[122,138],[50,70],[149,128],[100,108],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a;
}
function cutsNeeded(N: number) { return N % 2 === 0 ? N/2 : N; }
function pickAnimal(streak: number): AnimalEntry {
  if (streak > 0 && streak % 3 === 0)
    return SPECIAL_ANIMALS[Math.min(Math.floor(streak/3)-1, SPECIAL_ANIMALS.length-1)];
  return NORMAL_ANIMALS[Math.floor(Math.random()*NORMAL_ANIMALS.length)];
}
function mkQueue(streak: number): AnimalEntry[] {
  return Array.from({length:4},(_,i)=>pickAnimal(Math.max(0,streak-i)));
}
function mkOrder(toppingOrder: Topping[], count: number, streak: number): Order {
  const tops = toppingOrder.slice(0,count);
  const d = DENOMINATORS[Math.floor(Math.random()*DENOMINATORS.length)];
  const n = Math.floor(Math.random()*(d-1))+1;
  return {numerator:n,denominator:d,topping:tops[Math.floor(Math.random()*tops.length)],animal:pickAnimal(streak)};
}
function calcCoins(tLeft: number, orderTime: number) { return Math.max(1,Math.round((tLeft/orderTime)*10)); }
function orderSpeech(o: Order) {
  return `I want ${o.numerator} out of ${o.denominator}, of a ${TOPPING_NAME[o.topping]} pizza!`;
}
function calcCoinBreakdown(total: number): {denom:number;count:number}[] {
  const result: {denom:number;count:number}[] = [];
  let rem = total;
  for (const d of COIN_DENOMS) { const c=Math.floor(rem/d); result.push({denom:d,count:c}); rem-=c*d; }
  return result;
}

// ─── Audio ─────────────────────────────────────────────────────────────────────
function getAC(): AudioContext|null {
  if (typeof window==='undefined') return null;
  return new (window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext)();
}
function playSlice() {
  const c=getAC(); if(!c)return;
  const o=c.createOscillator(),g=c.createGain();
  o.type='sawtooth'; o.frequency.setValueAtTime(520,c.currentTime);
  o.frequency.exponentialRampToValueAtTime(180,c.currentTime+0.08);
  g.gain.setValueAtTime(0.1,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.08);
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+0.08);
}
function playChaChing() {
  const c=getAC(); if(!c)return;
  [880,1320,1760].forEach((freq,i)=>{
    const o=c.createOscillator(),g=c.createGain(); o.type='sine'; o.frequency.value=freq;
    const t=c.currentTime+i*0.09;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.16,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.45);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+0.5);
  });
}
function playWrong() {
  const c=getAC(); if(!c)return;
  const o=c.createOscillator(),g=c.createGain();
  o.type='square'; o.frequency.setValueAtTime(220,c.currentTime); o.frequency.setValueAtTime(160,c.currentTime+0.12);
  g.gain.setValueAtTime(0.09,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.3);
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+0.3);
}
function speak(text: string, rate = 0.92) {
  if (typeof window==='undefined') return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  window.speechSynthesis.speak(u);
}
function speakOrder(text: string) { speak(text, 0.72); }

// ─── Cut guides ───────────────────────────────────────────────────────────────
interface CutGuide { x1:number;y1:number;x2:number;y2:number }
function getCutGuides(N:number,cr=91,cx=100,cy=100): CutGuide[] {
  if (N%2===0) {
    return Array.from({length:N/2},(_,i)=>{
      const a=-Math.PI/2+(i/N)*2*Math.PI;
      return {x1:cx+cr*Math.cos(a),y1:cy+cr*Math.sin(a),x2:cx-cr*Math.cos(a),y2:cy-cr*Math.sin(a)};
    });
  }
  return Array.from({length:N},(_,i)=>{
    const a=(i/N)*2*Math.PI-Math.PI/2;
    return {x1:cx,y1:cy,x2:cx+cr*Math.cos(a),y2:cy+cr*Math.sin(a)};
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function CoinBadge({denom,size=30}:{denom:number;size?:number}) {
  const c=COIN_STYLE[denom];
  const fs=denom>=100?9:denom>=10?11:13;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <circle cx="18" cy="20" r="14" fill={c.outer}/>
      <circle cx="18" cy="18" r="14" fill={c.inner}/>
      <text x="18" y="20" textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="bold" fill={c.text}>{denom}</text>
    </svg>
  );
}

function ToppingDots({topping}:{topping:Topping}) {
  return (
    <>
      {TOPPING_POS.map(([x,y],i)=>(
        <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="14">
          {TOPPING_EMOJI[topping]}
        </text>
      ))}
    </>
  );
}

function PizzaPreview({chosenTop}:{chosenTop:Topping|null}) {
  const [c1,c2]=chosenTop?TOPPING_PIZZA_COLOR[chosenTop]:DEFAULT_PIZZA_COLOR;
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%">
      <defs>
        <radialGradient id="pre-c" cx="40%" cy="40%"><stop offset="0%" stopColor={c1}/><stop offset="100%" stopColor={c2}/></radialGradient>
        <radialGradient id="pre-k" cx="40%" cy="40%"><stop offset="0%" stopColor="#c2793a"/><stop offset="100%" stopColor="#92400e"/></radialGradient>
        <filter id="pre-s"><feDropShadow dx="0" dy="3" stdDeviation="5" floodOpacity="0.25"/></filter>
      </defs>
      <circle cx="100" cy="100" r="91" fill="url(#pre-k)" filter="url(#pre-s)"/>
      <circle cx="100" cy="100" r="80" fill="url(#pre-c)"/>
      {chosenTop ? <ToppingDots topping={chosenTop}/> : (
        <>
          <text x="100" y="90" textAnchor="middle" dominantBaseline="central" fontSize="40">🍕</text>
          <text x="100" y="128" textAnchor="middle" fontSize="10" fill="#c2793a" fontWeight="bold">← Pick a flavor!</text>
        </>
      )}
    </svg>
  );
}

function PizzaCutting({order,cuts,onCut,chosenTop}:{order:Order;cuts:Set<number>;onCut(i:number):void;chosenTop:Topping}) {
  const N=order.denominator, cx=100, cy=100, cr=91;
  const guides=getCutGuides(N,cr,cx,cy);
  const [c1,c2]=TOPPING_PIZZA_COLOR[chosenTop];
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%">
      <defs>
        <radialGradient id="cc-c" cx="40%" cy="40%"><stop offset="0%" stopColor={c1}/><stop offset="100%" stopColor={c2}/></radialGradient>
        <radialGradient id="cc-k" cx="40%" cy="40%"><stop offset="0%" stopColor="#c2793a"/><stop offset="100%" stopColor="#92400e"/></radialGradient>
        <filter id="cc-s"><feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.2"/></filter>
      </defs>
      <circle cx={cx} cy={cy} r={cr} fill="url(#cc-k)" filter="url(#cc-s)"/>
      <circle cx={cx} cy={cy} r={80} fill="url(#cc-c)"/>
      <ToppingDots topping={chosenTop}/>
      {guides.map((g,i)=>{
        const isCut=cuts.has(i);
        const midX=((g.x1+g.x2)/2).toFixed(1), midY=((g.y1+g.y2)/2).toFixed(1);
        return (
          <g key={i} onClick={()=>!isCut&&onCut(i)} style={{cursor:isCut?'default':'pointer'}}>
            <line x1={g.x1.toFixed(1)} y1={g.y1.toFixed(1)} x2={g.x2.toFixed(1)} y2={g.y2.toFixed(1)} stroke="transparent" strokeWidth="20"/>
            <line x1={g.x1.toFixed(1)} y1={g.y1.toFixed(1)} x2={g.x2.toFixed(1)} y2={g.y2.toFixed(1)}
              stroke={isCut?'#92400e':'#f97316'} strokeWidth={isCut?2.5:1.5}
              strokeDasharray={isCut?undefined:'6 3'} strokeOpacity={isCut?1:0.7}/>
            {!isCut&&<text x={midX} y={midY} textAnchor="middle" dominantBaseline="central" fontSize="13">✂️</text>}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="3.5" fill="#92400e"/>
    </svg>
  );
}

function PizzaSelecting({order,selected,onToggle,disabled,chosenTop}:{
  order:Order;selected:Set<number>;onToggle(i:number):void;disabled?:boolean;chosenTop:Topping;
}) {
  const N=order.denominator, cx=100, cy=100, r=80, cr=91;
  const [c1,c2]=TOPPING_PIZZA_COLOR[chosenTop];
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%">
      <defs>
        <radialGradient id="sc-c" cx="40%" cy="40%"><stop offset="0%" stopColor={c1}/><stop offset="100%" stopColor={c2}/></radialGradient>
        <radialGradient id="sc-k" cx="40%" cy="40%"><stop offset="0%" stopColor="#c2793a"/><stop offset="100%" stopColor="#92400e"/></radialGradient>
        <filter id="sc-s"><feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.2"/></filter>
      </defs>
      <circle cx={cx} cy={cy} r={cr} fill="url(#sc-k)" filter="url(#sc-s)"/>
      <circle cx={cx} cy={cy} r={r} fill="url(#sc-c)"/>
      <ToppingDots topping={chosenTop}/>
      {Array.from({length:N},(_,i)=>{
        const sa=(i/N)*2*Math.PI-Math.PI/2, ea=((i+1)/N)*2*Math.PI-Math.PI/2;
        const x1=(cx+r*Math.cos(sa)).toFixed(1), y1=(cy+r*Math.sin(sa)).toFixed(1);
        const x2=(cx+r*Math.cos(ea)).toFixed(1), y2=(cy+r*Math.sin(ea)).toFixed(1);
        const la=ea-sa>Math.PI?1:0;
        const d=`M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${la} 1 ${x2} ${y2}Z`;
        const sel=selected.has(i), ma=(sa+ea)/2, mr=r*0.56;
        return (
          <g key={i} onClick={disabled?undefined:()=>onToggle(i)} style={{cursor:disabled?'default':'pointer'}}>
            <path d={d} fill={sel?'rgba(251,191,36,0.55)':'transparent'} stroke="#b45309" strokeWidth="1.5"/>
            {sel&&<text x={(cx+mr*Math.cos(ma)).toFixed(1)} y={(cy+mr*Math.sin(ma)).toFixed(1)}
              textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="bold">✓</text>}
          </g>
        );
      })}
      {Array.from({length:N},(_,i)=>{
        const a=(i/N)*2*Math.PI-Math.PI/2;
        return <line key={i} x1={cx} y1={cy} x2={(cx+cr*Math.cos(a)).toFixed(1)} y2={(cy+cr*Math.sin(a)).toFixed(1)} stroke="#b45309" strokeWidth="1.5"/>;
      })}
      <circle cx={cx} cy={cy} r="3.5" fill="#92400e"/>
    </svg>
  );
}

function PhaseStepper({phase}:{phase:GamePhase}) {
  const steps: [GamePhase[],string][] = [
    [['topPick'],'1 Choose'],[['cutting'],'2 Cut'],
    [['selecting'],'3 Pick'],[['correct','wrong','angry'],'4 Serve'],
  ];
  return (
    <div className="flex items-center gap-1 text-[10px] font-bold">
      {steps.map(([phases,label],idx)=>{
        const active=phases.includes(phase);
        const done=steps.slice(0,idx).some(([pp])=>pp.includes(phase));
        return (
          <React.Fragment key={label}>
            {idx>0&&<span className="text-gray-300 text-[8px]">▶</span>}
            <span className={`px-1.5 py-0.5 rounded-full transition-colors
              ${active?'bg-orange-500 text-white':done?'bg-green-100 text-green-600':'bg-gray-100 text-gray-400'}`}>
              {done?'✓':label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function GameFrame({children}:{children:React.ReactNode}) {
  return (
    <div className="flex items-center justify-center bg-[#0b1130] p-4" style={{minHeight:'calc(100vh - 56px)'}}>
      <div className="relative flex flex-col bg-[#fffbf0] rounded-2xl overflow-hidden"
        style={{width:'960px',height:'640px',flexShrink:0,
          border:'3px solid #fb923c',
          boxShadow:'0 0 50px rgba(251,146,60,0.3),0 0 0 1px rgba(251,146,60,0.15)'}}>
        <style>{`
          @keyframes floatCoin{0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-80px) scale(1.8)}}
          .float-coin{animation:floatCoin 1.4s ease-out forwards}
          @keyframes popIn{0%{transform:scale(0.4);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
          .pop-in{animation:popIn 0.4s ease-out forwards}
          @keyframes pulse-purple{0%,100%{box-shadow:0 0 0 0 #a855f788}50%{box-shadow:0 0 0 12px #a855f700}}
          .pulse-purple{animation:pulse-purple 1.1s infinite}
          @keyframes zoneGlow{0%,100%{box-shadow:inset 0 0 0 2px #fb923c55}50%{box-shadow:inset 0 0 18px 3px #fb923caa}}
          .zone-glow{animation:zoneGlow 1.6s ease-in-out infinite}
        `}</style>
        {children}
      </div>
    </div>
  );
}

// ─── Fraction display: numerator on top, denominator on bottom ────────────────
function Frac({ n, d, size = '1.6rem' }: { n: number; d: number; size?: string }) {
  return (
    <span
      className="inline-flex flex-col items-center text-red-600 font-black mx-1 align-middle"
      style={{ fontSize: size, lineHeight: 1.15 }}
    >
      <span className="border-b-2 border-red-500 px-1.5 leading-tight">{n}</span>
      <span className="px-1.5 leading-tight">{d}</span>
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PizzaChefView() {
  const toppingOrderRef = useRef<Topping[]>(shuffle(ALL_TOPPINGS));
  const settingsRef = useRef<GameSettings>(DEFAULT_SETTINGS);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const updateSettings = useCallback((s: GameSettings) => { settingsRef.current = s; setSettings(s); }, []);
  const unlockedRef = useRef(3);
  const [unlockedCount, setUnlockedCountState] = useState(3);
  const setUnlocked = useCallback((n:number)=>{unlockedRef.current=n; setUnlockedCountState(n);},[]);

  const [gamePhase, setGamePhase] = useState<GamePhase>('topPick');
  const [streak, setStreak] = useState(0);
  const [order, setOrder] = useState<Order>(()=>mkOrder(toppingOrderRef.current,3,0));
  const [queue, setQueue] = useState<AnimalEntry[]>(()=>mkQueue(0));
  const [cuts, setCuts] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [chosenTop, setChosenTop] = useState<Topping|null>(null);
  const [money, setMoney] = useState(0);
  const [wrongs, setWrongs] = useState(0);
  const [angry, setAngry] = useState(0);
  const [tLeft, setTLeft] = useState(()=>getOrderTime(0, DEFAULT_SETTINGS));
  const [orderTime, setOrderTime] = useState(()=>getOrderTime(0, DEFAULT_SETTINGS));
  const [feedMsg, setFeedMsg] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [coinParticles, setCoinParticles] = useState<CoinParticle[]>([]);
  const [showUnlock, setShowUnlock] = useState<Topping|null>(null);
  const [showSpecial, setShowSpecial] = useState<AnimalEntry|null>(null);
  const [showSpeedUp, setShowSpeedUp] = useState(false);
  const pId = useRef(0);
  const streakRef = useRef(0);
  useEffect(()=>{streakRef.current=streak;},[streak]);

  const nextOrder = useCallback(()=>{
    const s=streakRef.current;
    const o=mkOrder(toppingOrderRef.current,unlockedRef.current,s);
    if (s>0&&s%3===0) {
      const idx=Math.min(Math.floor(s/3)-1,SPECIAL_ANIMALS.length-1);
      setShowSpecial(SPECIAL_ANIMALS[idx]);
      setTimeout(()=>setShowSpecial(null),2200);
    }
    const ot=getOrderTime(s, settingsRef.current); setOrderTime(ot);
    setOrder(o); setQueue(mkQueue(s));
    setCuts(new Set()); setSelected(new Set()); setChosenTop(null);
    setTLeft(ot); setGamePhase('topPick');
    setTimeout(()=>speakOrder(orderSpeech(o)),450);
  },[]);

  useEffect(()=>{
    if ((gamePhase!=='cutting'&&gamePhase!=='selecting')||isPaused||tLeft<=0) return;
    const id=setTimeout(()=>setTLeft(t=>t-1),1000);
    return ()=>clearTimeout(id);
  },[gamePhase,isPaused,tLeft]);

  useEffect(()=>{
    if (gamePhase!=='selecting'||tLeft>0) return;
    setAngry(prev=>prev+1); setStreak(0);
    setFeedMsg('⏰ Too slow! Customer left angry!');
    setGamePhase('angry'); playWrong();
  },[gamePhase,tLeft]);

  useEffect(()=>{
    if (gamePhase!=='angry') return;
    const id=setTimeout(()=>{if(angry>=MAX_ANGRY)setGamePhase('gameover');else nextOrder();},FEEDBACK_MS);
    return ()=>clearTimeout(id);
  },[gamePhase,angry,nextOrder]);

  useEffect(()=>{
    if (gamePhase!=='wrong') return;
    const id=setTimeout(()=>{
      if (wrongs>=MAX_WRONG) { setGamePhase('gameover'); return; }
      setChosenTop(null); setCuts(new Set()); setSelected(new Set());
      setTLeft(orderTime);
      setGamePhase('topPick');
    }, 1200);
    return ()=>clearTimeout(id);
  },[gamePhase,wrongs,orderTime]);

  useEffect(()=>{
    if (gamePhase!=='correct') return;
    const id=setTimeout(nextOrder,FEEDBACK_MS);
    return ()=>clearTimeout(id);
  },[gamePhase,nextOrder]);

  useEffect(()=>{
    if (gamePhase!=='cutting') return;
    if (cuts.size<cutsNeeded(order.denominator)) return;
    setGamePhase('selecting');
  },[gamePhase,cuts.size,order.denominator]);

  useEffect(()=>{setTimeout(()=>speakOrder(orderSpeech(order)),700);},[]);// eslint-disable-line react-hooks/exhaustive-deps

  function handleToppingSelect(t:Topping) {
    if (gamePhase!=='topPick'&&gamePhase!=='cutting') return;
    speak(TOPPING_NAME[t]);
    setChosenTop(t);
    if (gamePhase==='cutting') { setCuts(new Set()); } // reset cuts when changing topping mid-cut
    else { setGamePhase('cutting'); }
  }
  function handleCut(i:number) {
    if (cuts.has(i)||isPaused) return;
    playSlice(); setCuts(prev=>new Set([...prev,i]));
  }
  function toggleSlice(i:number) {
    if (gamePhase!=='selecting'||isPaused) return;
    setSelected(prev=>{const n=new Set(prev); n.has(i)?n.delete(i):n.add(i); return n;});
  }
  function submit() {
    if (gamePhase!=='selecting') return;
    const okSlices=selected.size===order.numerator;
    const okTop=chosenTop===order.topping;
    if (okSlices&&okTop) {
      const earned=calcCoins(tLeft,orderTime);
      const newMoney=money+earned;
      setMoney(newMoney); playChaChing();
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (getOrderTime(newStreak, settings) < getOrderTime(newStreak - 1, settings)) {
        setShowSpeedUp(true);
        setTimeout(() => setShowSpeedUp(false), 2200);
      }
      pId.current++;
      const pid=pId.current;
      setCoinParticles(prev=>[...prev,{id:pid,amount:earned}]);
      setTimeout(()=>setCoinParticles(prev=>prev.filter(p=>p.id!==pid)),1400);
      const newCount=3+UNLOCK_MILESTONES.filter(m=>newMoney>=m).length;
      if (newCount>unlockedCount) {
        setUnlocked(newCount);
        setShowUnlock(toppingOrderRef.current[newCount-1]);
        setTimeout(()=>setShowUnlock(null),2800);
      }
      const msg=CORRECT_MSGS[Math.floor(Math.random()*CORRECT_MSGS.length)];
      speak(msg.speak);
      setFeedMsg(`${msg.display} +${earned} 💰`); setGamePhase('correct');
    } else {
      const wrongMsg=WRONG_MSGS[Math.floor(Math.random()*WRONG_MSGS.length)];
      setWrongs(w=>w+1); setStreak(0); playWrong();
      speak(wrongMsg.speak);
      setFeedMsg(wrongMsg.display);
      setGamePhase('wrong');
    }
  }
  function restart() {
    toppingOrderRef.current=shuffle(ALL_TOPPINGS);
    setMoney(0); setWrongs(0); setAngry(0); setStreak(0); setIsPaused(false); setUnlocked(3);
    const o=mkOrder(toppingOrderRef.current,3,0);
    const ot0=getOrderTime(0, settingsRef.current); setOrderTime(ot0);
    setOrder(o); setQueue(mkQueue(0)); setCuts(new Set()); setSelected(new Set()); setChosenTop(null);
    setTLeft(ot0); setGamePhase('topPick');
    setTimeout(()=>speakOrder(orderSpeech(o)),450);
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const timerPct   = (tLeft/orderTime)*100;
  const timerColor = tLeft>orderTime*0.55?'#22c55e':tLeft>orderTime*0.28?'#f59e0b':'#ef4444';
  const canSubmit  = gamePhase==='selecting';
  const slicesOk   = selected.size===order.numerator;
  const activeToppings = toppingOrderRef.current.slice(0,unlockedCount);
  const nextUnlockIdx  = unlockedCount-3; // index into UNLOCK_MILESTONES
  const nextMilestoneAmt = nextUnlockIdx<UNLOCK_MILESTONES.length ? UNLOCK_MILESTONES[nextUnlockIdx] : undefined;
  const nextUnlockTop  = unlockedCount<ALL_TOPPINGS.length ? toppingOrderRef.current[unlockedCount] : undefined;
  const neededForNext  = nextMilestoneAmt!==undefined ? Math.max(0,nextMilestoneAmt-money) : 0;
  const coinRows = calcCoinBreakdown(money);
  const zone3Active = gamePhase==='topPick'||gamePhase==='cutting';
  const zone4Active = gamePhase==='cutting'||gamePhase==='selecting';
  const zone5Active = gamePhase==='selecting';

  // Adaptive topping button sizes based on count
  const iconSize = activeToppings.length<=5?'3.4rem':activeToppings.length<=7?'2.8rem':'2.2rem';
  const textCls  = activeToppings.length<=5?'text-xl':activeToppings.length<=7?'text-base':'text-sm';

  if (gamePhase==='gameover') {
    return (
      <GameFrame>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#fffbf0]">
          <div className="text-8xl mb-4 animate-bounce">🍕</div>
          <h1 className="text-4xl font-black text-orange-800 mb-1">Pizza Shop Closed!</h1>
          <p className="text-orange-400 mb-2">Today&apos;s earnings:</p>
          <p className="text-7xl font-black text-yellow-500 mb-4">💰 {money}</p>
          <div className="flex gap-6 bg-orange-100 rounded-2xl px-8 py-4 mb-8 text-orange-600 text-lg font-bold">
            <span>❌ {wrongs} wrong</span><span>😤 {angry} angry</span><span>🔥 Streak: {streak}</span>
          </div>
          <div className="flex gap-4">
            <Link href="/games" className="flex items-center gap-1.5 rounded-lg bg-zinc-900/10 px-3 py-1.5 text-sm font-bold text-zinc-700 hover:bg-zinc-900/15">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd"/></svg>
              Back
            </Link>
            <button onClick={restart} className="px-8 py-3 bg-orange-500 text-white font-black text-lg rounded-full shadow-lg hover:bg-orange-600 active:scale-95 transition-transform">🍕 Open Again!</button>
          </div>
        </div>
      </GameFrame>
    );
  }

  return (
    <GameFrame>
      {/* ── Overlays ── */}
      {coinParticles.map(p=>(
        <div key={p.id} className="absolute left-1/2 z-50 pointer-events-none font-black text-4xl text-yellow-300 drop-shadow-xl float-coin"
          style={{top:'32%',textShadow:'0 2px 8px rgba(0,0,0,0.4)'}}>+{p.amount} 💰</div>
      ))}
      {showUnlock&&(
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white border-4 border-yellow-400 rounded-3xl px-10 py-8 text-center shadow-2xl pop-in">
            <p className="text-7xl mb-3">{TOPPING_EMOJI[showUnlock]}</p>
            <p className="text-orange-700 font-black text-2xl">New Topping Unlocked!</p>
            <p className="text-orange-500 font-bold text-lg capitalize mt-1">{TOPPING_NAME[showUnlock]} 🎉</p>
          </div>
        </div>
      )}
      {showSpecial&&(
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white border-4 border-purple-400 rounded-3xl px-10 py-8 text-center shadow-2xl pop-in">
            <p className="text-7xl mb-3">{showSpecial.emoji}</p>
            <p className="text-purple-700 font-black text-2xl">VIP Customer!</p>
            <p className="text-purple-500 font-bold text-lg mt-1">{showSpecial.name} is here! 🌟</p>
          </div>
        </div>
      )}
      {showSpeedUp&&(
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none pop-in">
          <div className="bg-red-500 text-white font-black text-xl px-6 py-3 rounded-2xl shadow-2xl border-4 border-red-300 text-center">
            <p className="text-3xl mb-1">⚡</p>
            <p>Speed up! −{settings.timeReduction}s</p>
            <p className="text-sm font-bold opacity-80 mt-0.5">Time limit: {getOrderTime(streak, settings)}s</p>
          </div>
        </div>
      )}
      {(gamePhase==='correct'||gamePhase==='wrong'||gamePhase==='angry')&&(
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className={`font-black px-10 py-6 rounded-3xl shadow-2xl border-4 text-center text-2xl pop-in
            ${gamePhase==='correct'?'bg-green-50 text-green-700 border-green-400':'bg-red-50 text-red-700 border-red-400'}`}>
            {feedMsg}
          </div>
        </div>
      )}
      {isPaused&&(
        <div className="absolute inset-0 z-50 bg-black/75 rounded-2xl flex flex-col items-center justify-center gap-6">
          <p className="text-white text-7xl">⏸</p>
          <p className="text-white text-3xl font-black">Paused</p>
          <button onClick={()=>setIsPaused(false)} className="px-12 py-4 bg-orange-500 text-white font-black text-2xl rounded-full shadow-xl hover:bg-orange-600 active:scale-95">▶ Resume</button>
          <Link href="/games" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd"/></svg>
            Back
          </Link>
        </div>
      )}

      {/* ── Settings Modal ── */}
      {showSettings&&(
        <div className="absolute inset-0 bg-black/80 rounded-2xl flex items-center justify-center" style={{zIndex:60}}>
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-[420px]">
            <h2 className="text-xl font-black text-orange-800 mb-5 text-center">⚙️ 遊戲設定</h2>

            <div className="mb-4">
              <p className="text-sm font-black text-gray-600 mb-2">每答對幾題縮短時間？</p>
              <div className="flex gap-2 flex-wrap">
                {[2,3,5,7,10].map(n=>(
                  <button key={n} onClick={()=>updateSettings({...settings,streakInterval:n})}
                    className={`px-4 py-2 rounded-xl font-black text-sm transition-colors
                      ${settings.streakInterval===n?'bg-orange-500 text-white shadow-md':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {n} 題
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-black text-gray-600 mb-2">每次縮短幾秒？</p>
              <div className="flex gap-2">
                {[1,2,3].map(n=>(
                  <button key={n} onClick={()=>updateSettings({...settings,timeReduction:n})}
                    className={`px-4 py-2 rounded-xl font-black text-sm transition-colors
                      ${settings.timeReduction===n?'bg-orange-500 text-white shadow-md':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    −{n} 秒
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-sm font-black text-gray-600 mb-2">最短答題時間？</p>
              <div className="flex gap-2">
                {[5,8,10,12].map(n=>(
                  <button key={n} onClick={()=>updateSettings({...settings,minTime:n})}
                    className={`px-4 py-2 rounded-xl font-black text-sm transition-colors
                      ${settings.minTime===n?'bg-orange-500 text-white shadow-md':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {n} 秒
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-5 text-center">
              <p className="text-xs text-amber-700 font-bold">
                每答對 <span className="text-orange-600">{settings.streakInterval}</span> 題 → 縮短 <span className="text-orange-600">{settings.timeReduction}</span> 秒 ／ 最短 <span className="text-orange-600">{settings.minTime}</span> 秒
              </p>
              <p className="text-[10px] text-amber-500 mt-0.5">設定從下一題開始生效</p>
            </div>

            <button onClick={()=>{setShowSettings(false);setIsPaused(false);}}
              className="w-full py-3 bg-orange-500 text-white font-black text-base rounded-2xl hover:bg-orange-600 active:scale-95 transition-all">
              ✓ 確定，繼續遊戲
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-orange-100 to-amber-100 border-b-2 border-amber-300 shrink-0">
        <Link href="/games" className="flex items-center gap-1.5 rounded-lg bg-zinc-900/10 px-3 py-1.5 text-sm font-bold text-zinc-700 hover:bg-zinc-900/15 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd"/></svg>
          Back
        </Link>

        {/* Center: title + phase stepper + unlock hint */}
        <div className="flex flex-col items-center gap-0.5 min-w-0 px-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-orange-700">🍕 Pizza Chef</span>
            <PhaseStepper phase={gamePhase}/>
          </div>
          {nextUnlockTop ? (
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-full px-2.5 py-0.5 whitespace-nowrap">
              <span className="text-[10px] font-bold text-amber-700">🔓 Earn</span>
              <span className="text-[10px] font-black text-red-600">{neededForNext}</span>
              <span className="text-[10px] font-bold text-amber-700">more →</span>
              <span className="text-sm">{TOPPING_EMOJI[nextUnlockTop]}</span>
              <span className="text-[10px] font-black text-orange-700 capitalize">{TOPPING_NAME[nextUnlockTop]} pizza!</span>
            </div>
          ) : (
            <div className="text-[10px] font-black text-green-600 bg-green-50 border border-green-300 rounded-full px-2.5 py-0.5">🎉 All 10 flavors unlocked!</div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {streak>=3&&<span className="text-sm font-black text-purple-600 bg-purple-100 rounded-full px-2 py-0.5">🔥{streak}</span>}
          <span className="text-red-500 text-sm font-bold">❌{wrongs}/{MAX_WRONG}</span>
          <span className="text-orange-400 text-sm font-bold">😤{angry}/{MAX_ANGRY}</span>
          <button onClick={()=>{setIsPaused(true);setShowSettings(true);}} className="text-xl px-1 text-orange-400 hover:scale-110 active:scale-90 transition-transform" title="設定">⚙️</button>
          <button onClick={()=>setIsPaused(true)} className="text-2xl px-1 text-orange-400 hover:scale-110 active:scale-90 transition-transform">⏸</button>
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-2 bg-gray-200 shrink-0">
        {(gamePhase==='cutting'||gamePhase==='selecting')&&!isPaused&&(
          <div className="h-full rounded-r-full transition-[width] duration-1000 ease-linear" style={{width:`${timerPct}%`,background:timerColor}}/>
        )}
      </div>

      {/* ══ MAIN LAYOUT ═══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* ── TOP ROW: animal queue (left) + speech bubble (right) ── */}
        {/* Reversed render: queue[3..0], so current customer (queue[0]) is RIGHTMOST */}
        <div className="flex shrink-0 items-center gap-2 px-3 py-2 border-b-2 border-amber-200"
          style={{height:'26%',background:'linear-gradient(135deg,#eff6ff,#dbeafe)'}}>

          {/* LEFT: 4 animals, no frames, pure emoji — reversed so current is rightmost */}
          <div className="flex items-center gap-2 shrink-0 h-full py-1">
            {[...queue].reverse().map((a,i)=>{
              const isCurrent = i===queue.length-1; // last in reversed = queue[0] = current
              return (
                <div key={i} className="flex flex-col items-center justify-center"
                  style={{opacity: isCurrent?1:0.45+(i*0.12)}}>
                  <span style={{fontSize:isCurrent?'5.4rem':'2.2rem',lineHeight:1,filter:isCurrent?'drop-shadow(0 3px 8px rgba(59,130,246,0.4))':'none'}}>
                    {a.emoji}
                  </span>
                  <span className={`font-black text-center leading-none mt-0.5 ${isCurrent?'text-blue-700 text-[11px]':'text-blue-300 text-[9px]'}`}>
                    {a.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* RIGHT: Speech bubble — full English sentence, tail pointing LEFT */}
          <div className="flex-1 relative flex items-center min-w-0">
            {/* Tail pointing left */}
            <div className="absolute left-[-13px] top-1/2 -translate-y-1/2" style={{width:0,height:0,borderTop:'10px solid transparent',borderBottom:'10px solid transparent',borderRight:'13px solid #86efac'}}/>
            <div className="absolute left-[-9px] top-1/2 -translate-y-1/2" style={{width:0,height:0,borderTop:'9px solid transparent',borderBottom:'9px solid transparent',borderRight:'12px solid white'}}/>
            <div className="w-full bg-white rounded-3xl shadow-md px-5 py-3 flex items-center gap-3" style={{border:'2.5px solid #86efac'}}>
              <button onClick={()=>speakOrder(orderSpeech(order))}
                className="shrink-0 text-2xl hover:scale-110 active:scale-90 transition-transform">🔊</button>
              <p className="font-black text-blue-800 leading-snug min-w-0 flex items-center flex-wrap gap-x-1" style={{fontSize:'1.15rem'}}>
                <span>I want</span>
                <Frac n={order.numerator} d={order.denominator} />
                <span>of a{' '}<span className="text-orange-600 capitalize">{TOPPING_NAME[order.topping]}</span> pizza!</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── BOTTOM ROW ── */}
        <div className="flex flex-1 min-h-0">

          {/* Zone 3: Topping picker */}
          <div className={`shrink-0 flex flex-col p-2 gap-1 overflow-hidden transition-all duration-300 border-r-2
            ${zone3Active?'border-orange-300 zone-glow':'border-amber-200 opacity-40 pointer-events-none'}`}
            style={{width:'28%',background:zone3Active?'#fffbeb':'#f9fafb'}}>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest text-center shrink-0">Choose Flavor</p>
            {activeToppings.map(t=>(
              <button key={t} onClick={()=>handleToppingSelect(t)} disabled={gamePhase!=='topPick'&&gamePhase!=='cutting'}
                className={`flex-1 min-h-0 rounded-xl flex flex-row items-center justify-start px-2 gap-2 transition-all relative overflow-hidden
                  ${chosenTop===t?'shadow-lg z-10':'hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm'}`}
                style={{
                  background:TOPPING_BG[t],
                  border: chosenTop===t ? `3px solid #f97316` : `2px solid ${TOPPING_TEXT[t]}33`,
                  outline: chosenTop===t ? '2px solid #fed7aa' : 'none',
                  outlineOffset: '1px',
                }}>
                <span style={{fontSize:iconSize,lineHeight:1,filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.15))'}}>
                  {TOPPING_EMOJI[t]}
                </span>
                <span className={`font-black ${textCls} capitalize leading-tight`} style={{color:TOPPING_TEXT[t]}}>
                  {TOPPING_NAME[t]}
                </span>
                {chosenTop===t&&(
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white text-xs font-black bg-orange-500 rounded-full w-5 h-5 flex items-center justify-center shadow">✓</span>
                )}
              </button>
            ))}
          </div>

          {/* Zone 4: Pizza square frame */}
          <div className="flex-1 flex items-center justify-center min-w-0 bg-white p-2" style={{position:'relative'}}>
            <div className={`flex items-center justify-center rounded-2xl overflow-hidden ${zone4Active?'zone-glow':'opacity-40'}`}
              style={{width:'406px',height:'406px',flexShrink:0,border:'3px solid #fbbf24',background:'#fffbf0'}}>
              {gamePhase==='cutting'&&(
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-orange-500 text-white font-black text-sm px-4 py-1 rounded-full shadow-lg">
                  ✂️ Tap the lines to cut!
                </div>
              )}
              {gamePhase==='selecting'&&(
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-blue-500 text-white font-black text-sm px-4 py-1 rounded-full shadow-lg">
                  👆 Tap {order.numerator} slice{order.numerator>1?'s':''}!
                </div>
              )}
              <div style={{width:'100%',height:'100%'}}>
                {gamePhase==='topPick'?<PizzaPreview chosenTop={chosenTop}/>
                  :gamePhase==='cutting'?<PizzaCutting order={order} cuts={cuts} onCut={handleCut} chosenTop={chosenTop!}/>
                  :<PizzaSelecting order={order} selected={selected} onToggle={toggleSlice} disabled={gamePhase!=='selecting'} chosenTop={chosenTop!}/>}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="shrink-0 flex flex-col border-l-2 border-amber-200" style={{width:'24%'}}>

            {/* Zone 5: Action — purple when active */}
            <div className={`flex-[3] flex flex-col items-center justify-center p-3 border-b-2 gap-2 transition-all duration-300
              ${zone5Active?'bg-purple-50':'bg-gray-50'}`}
              style={zone5Active?{borderColor:'#c084fc'}:{borderColor:'#fde68a'}}>

              {gamePhase==='topPick'&&(
                <div className="flex flex-col items-center gap-2 opacity-40">
                  <span className="text-4xl">🍕</span>
                  <p className="text-sm font-bold text-gray-500 text-center">Choose a<br/>flavor first</p>
                </div>
              )}

              {gamePhase==='cutting'&&(
                <div className="text-center w-full flex flex-col items-center gap-2">
                  <p className="text-base font-black text-orange-700">
                    ✂️ <span className="text-2xl">{cuts.size}</span>/<span className="text-2xl">{cutsNeeded(order.denominator)}</span> cuts
                  </p>
                  <div className="flex gap-1.5 flex-wrap justify-center">
                    {Array.from({length:cutsNeeded(order.denominator)},(_,i)=>(
                      <div key={i} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black transition-all
                        ${cuts.has(i)?'bg-orange-500 text-white scale-110 shadow-md':'bg-white text-gray-400'}`}
                        style={{border:cuts.has(i)?'3px solid #ea580c':'3px solid #d1d5db'}}>
                        {cuts.has(i)?'✓':i+1}
                      </div>
                    ))}
                  </div>
                  <div className="relative flex items-center justify-center" style={{width:72,height:72}}>
                    <svg viewBox="0 0 72 72" width="72" height="72" style={{position:'absolute',top:0,left:0}}>
                      <circle cx="36" cy="36" r="30" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
                      <circle cx="36" cy="36" r="26" fill="none" stroke="#334155" strokeWidth="6"/>
                      <circle cx="36" cy="36" r="26" fill="none" stroke={timerColor} strokeWidth="6"
                        strokeDasharray={`${2*Math.PI*26}`}
                        strokeDashoffset={`${2*Math.PI*26*(1-timerPct/100)}`}
                        strokeLinecap="round" transform="rotate(-90 36 36)"
                        style={{transition:'stroke-dashoffset 1s linear,stroke 0.4s'}}/>
                    </svg>
                    <span style={{position:'relative',fontSize:'1.6rem',fontWeight:900,color:timerColor,textShadow:`0 0 8px ${timerColor}88`}}>{tLeft}</span>
                  </div>
                </div>
              )}

              {gamePhase==='selecting'&&(
                <div className="w-full flex flex-col items-center gap-2">
                  <p className="text-sm font-black text-purple-700 text-center">
                    Pick <span className="text-2xl font-black text-purple-600">{order.numerator}</span> slice{order.numerator>1?'s':''}
                    <br/><span className="text-xs font-normal text-purple-400">({selected.size} selected)</span>
                  </p>
                  <button onClick={submit}
                    className="w-full rounded-2xl font-black transition-all flex flex-col items-center justify-center gap-1.5 py-3 bg-purple-500 text-white shadow-xl hover:bg-purple-600 active:scale-95 pulse-purple">
                    <span style={{fontSize:'2.4rem'}}>🍕</span>
                    <span className="text-lg font-black">✓ Ready!</span>
                    <span className="text-xs opacity-90">Tap to deliver!</span>
                  </button>
                  <div className="relative flex items-center justify-center" style={{width:64,height:64}}>
                    <svg viewBox="0 0 72 72" width="64" height="64" style={{position:'absolute',top:0,left:0}}>
                      <circle cx="36" cy="36" r="30" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
                      <circle cx="36" cy="36" r="26" fill="none" stroke="#334155" strokeWidth="6"/>
                      <circle cx="36" cy="36" r="26" fill="none" stroke={timerColor} strokeWidth="6"
                        strokeDasharray={`${2*Math.PI*26}`}
                        strokeDashoffset={`${2*Math.PI*26*(1-timerPct/100)}`}
                        strokeLinecap="round" transform="rotate(-90 36 36)"
                        style={{transition:'stroke-dashoffset 1s linear,stroke 0.4s'}}/>
                    </svg>
                    <span style={{position:'relative',fontSize:'1.5rem',fontWeight:900,color:timerColor,textShadow:`0 0 8px ${timerColor}88`}}>{tLeft}</span>
                  </div>
                </div>
              )}

              {(gamePhase==='correct'||gamePhase==='wrong'||gamePhase==='angry')&&(
                <div className={`text-6xl ${gamePhase==='correct'?'text-green-500':'text-red-500'}`}>
                  {gamePhase==='correct'?'🎉':'❌'}
                </div>
              )}
            </div>

            {/* Zone 6: Money card — padded container so all corners are rounded */}
            <div className="flex-[2] flex flex-col min-h-0 p-2 pb-2">
              <div className="flex-1 flex flex-col rounded-2xl overflow-hidden min-h-0 p-2"
                style={{
                  background:'linear-gradient(160deg,#fff7ed,#fef3c7)',
                  border:'2px solid #fb923c',
                  boxShadow:'0 2px 10px rgba(251,146,60,0.18)',
                }}>

                {/* 2×2 coin grid */}
                <div className="grid grid-cols-2 gap-2">
                  {coinRows.map(({denom,count})=>(
                    <div key={denom} className={`flex items-center gap-2 bg-white/70 rounded-xl px-2 h-11 transition-opacity ${count===0?'opacity-25':''}`}>
                      <CoinBadge denom={denom} size={30}/>
                      <span className="text-base font-black text-gray-700">×{count}</span>
                    </div>
                  ))}
                </div>

                {/* Total — vertically centered in remaining space */}
                <div className="flex-1 flex items-center justify-between mt-2 border-t-2 border-amber-300 px-1">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-wide">Total</span>
                  <div className="flex items-center gap-1">
                    <span className="text-base">💰</span>
                    <span className="font-black text-yellow-600" style={{fontSize:'1.4rem'}}>{money}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GameFrame>
  );
}

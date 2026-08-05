'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import BackButton from '@/components/BackButton';
import { words as PHONICS_WORDS } from '@/data/words';
import type { Word } from '@/lib/types';
import { useCustomWords } from '@/lib/customWords';
import {
  useThisWeekClimbWords,
  useReinforcementClimbWords,
  usePhonicsClimbWords,
  useSightWordsClimb,
  ALL_WORD_SOURCES,
  type WordSourceKey,
} from '@/lib/heroClimbSettings';
import {
  usePixelInvadersLeaderboard,
  useLastPixelInvadersName,
  savePixelInvadersRecord,
  updatePixelInvadersName,
  DEFAULT_NAME,
} from '@/lib/pixelInvadersHistory';

// ─── Constants ────────────────────────────────────────────────────────────────
const CW = 480;
const CH = 640;
const COMBAT_SECS = 10;
const FIRE_RATE = 7;
const PLAYER_SPD = 5;
const BULLET_SPD = 11;
const EBULLET_SPD = 3.2;
const SHIELD_FRAMES = 90;
const MAX_HP = 5;
const BUBBLE_R = 20;
const BUBBLE_SPAWN = 220; // frames between bubble spawns

// ─── Ship sprite (bottom ship with 3 gun barrels, from 2048×2048 sheet) ──────
const GUN_TIPS = [
  { dx: -20, dy: -38 },
  { dx:   0, dy: -44 },
  { dx:  20, dy: -38 },
];

// ─── Spider definitions — 5 colours × 3 sizes ─────────────────────────────────
// kind 0-1: small  (bodyR=10, legLen=16)
// kind 2-3: medium (bodyR=15, legLen=24)
// kind 4:   large  (bodyR=22, legLen=36)
interface SpiderDef {
  color: string; accent: string; hi: string; eye: string;
  bodyR: number; legLen: number; legW: number;
  hp: number; score: number; hitR: number;
}
const SPIDERS: SpiderDef[] = [
  { color:'#33cc55', accent:'#1a7733', hi:'#88ffaa', eye:'#ff2200', bodyR:10, legLen:16, legW:1.5, hp:1, score:10, hitR:13 },
  { color:'#3388ff', accent:'#1155cc', hi:'#88ccff', eye:'#ffcc00', bodyR:10, legLen:16, legW:1.5, hp:2, score:20, hitR:13 },
  { color:'#ff8833', accent:'#cc5500', hi:'#ffbb88', eye:'#ff0000', bodyR:15, legLen:24, legW:2,   hp:3, score:40, hitR:19 },
  { color:'#cc33dd', accent:'#8800aa', hi:'#ee88ff', eye:'#ffff44', bodyR:15, legLen:24, legW:2,   hp:4, score:60, hitR:19 },
  { color:'#dd2233', accent:'#aa0011', hi:'#ff7788', eye:'#ffff00', bodyR:22, legLen:36, legW:2.8, hp:6, score:100,hitR:28 },
];

// ─── New monster defs (kind=5: beetle, kind=6: squid) ─────────────────────────
interface MonsterBase { hitR: number; bodyR: number; legLen: number; hp: number; score: number; }
const BEETLE_DEF: MonsterBase = { hitR:22, bodyR:18, legLen:12, hp:5, score:80  };
const SQUID_DEF:  MonsterBase = { hitR:26, bodyR:20, legLen:22, hp:8, score:150 };
function getMonsterBase(kind: number): MonsterBase {
  if (kind<=4) { const d=SPIDERS[kind]; return {hitR:d.hitR,bodyR:d.bodyR,legLen:d.legLen,hp:d.hp,score:d.score}; }
  return kind===5 ? BEETLE_DEF : SQUID_DEF;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Bullet  { id: number; x: number; y: number; }
interface EBullet { id: number; x: number; y: number; vx: number; vy: number; }
interface Enemy   { id: number; x: number; y: number; vx: number; kind: 0|1|2|3|4|5|6; hp: number; maxHp: number; }
interface Bubble  { id: number; x: number; y: number; kind: 'heart'|'skull'; phase: number; hp: number; }
interface Particle{ id: number; x: number; y: number; vx: number; vy: number; life: number; color: string; r: number; }
interface Star    { x: number; y: number; speed: number; r: number; }

type Phase = 'menu' | 'combat' | 'quiz' | 'gameover';
type BulletLevel = 1 | 2 | 3 | 4 | 5;
type MathQ    = { kind: 'math';    nums: number[]; ops: ('+'|'-')[]; answer: number; choices: number[] };
type EnglishQ = { kind: 'english'; emoji: string;  zh: string;       answer: string; choices: string[] };
type Question = MathQ | EnglishQ;


// ─── Helpers ──────────────────────────────────────────────────────────────────
let _id = 1;
const uid  = () => _id++;
const rnd  = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const dst  = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax-bx, ay-by);

function makeStars(): Star[] {
  return Array.from({ length: 90 }, () => ({
    x: Math.random() * CW, y: Math.random() * CH,
    speed: 0.3 + Math.random() * 1.4, r: 0.5 + Math.random() * 1.5,
  }));
}

function genMathQuestion(maxRange: number, count: number): MathQ {
  const nums: number[] = [];
  const ops: ('+'|'-')[] = [];
  nums.push(rnd(1, Math.max(1, maxRange)));
  let running = nums[0];
  for (let i = 1; i < Math.max(2, count); i++) {
    const canSub = running > 2;
    const op: '+'|'-' = (canSub && Math.random() < 0.4) ? '-' : '+';
    ops.push(op);
    let b: number;
    if (op === '+') { b = rnd(1, Math.max(1, maxRange - running)); }
    else            { b = rnd(1, running - 1); }
    nums.push(b);
    running = op === '+' ? running + b : running - b;
  }
  const answer = running;
  const spread = Math.max(2, Math.ceil(maxRange / 8));
  const wrong = new Set<number>();
  let tries = 0;
  while (wrong.size < 3 && tries++ < 80) {
    const off = rnd(1, spread) * (Math.random() < 0.5 ? 1 : -1);
    const w = answer + off;
    if (w >= 0 && w !== answer) wrong.add(w);
  }
  while (wrong.size < 3) wrong.add(answer + wrong.size + 1);
  return { kind: 'math', nums, ops, answer, choices: [answer, ...wrong].sort(() => Math.random()-0.5) };
}

// Correct answer drawn from the narrowest non-empty selected source tier;
// distractors drawn from the combined pool of all selected tiers — same
// priority convention as angry-cow's makeEnglishRound.
function genEnglishQuestion(wordTiers: Word[][]): EnglishQ {
  const combined = wordTiers.flat();
  const nonEmpty = wordTiers.find((p) => p.length > 0);
  const src = nonEmpty && nonEmpty.length > 0 ? nonEmpty : (combined.length > 0 ? combined : PHONICS_WORDS.filter(w => w.emoji));
  const correct = src[rnd(0, src.length - 1)];
  const distractorSrc = combined.length > 0 ? combined : PHONICS_WORDS.filter(w => w.emoji);
  const wrong = new Set<string>();
  let tries = 0;
  while (wrong.size < 3 && tries++ < 120) {
    const w = distractorSrc[rnd(0, distractorSrc.length - 1)];
    if (w.word !== correct.word) wrong.add(w.word);
  }
  // Fallback: draw from the full PHONICS_WORDS list
  while (wrong.size < 3) {
    const w = PHONICS_WORDS[rnd(0, PHONICS_WORDS.length - 1)];
    if (w.word !== correct.word) wrong.add(w.word);
  }
  const choices = [correct.word, ...wrong].sort(() => Math.random() - 0.5);
  return { kind: 'english', emoji: correct.emoji, zh: correct.zh, answer: correct.word, choices };
}

function pickQuestion(
  ranges: number[], counts: number[], comboStreak: number,
  mode: 'math'|'english'|'mixed', wordTiers: Word[][],
): Question {
  const wantEnglish = mode === 'english' || (mode === 'mixed' && Math.random() < 0.5);
  if (wantEnglish) return genEnglishQuestion(wordTiers);
  const sr = [...ranges].sort((a,b)=>a-b);
  const sc = [...counts].sort((a,b)=>a-b);
  const rIdx = Math.min(Math.floor(comboStreak/10), Math.max(0, sr.length-1));
  const cIdx = Math.min(Math.floor(comboStreak/10), Math.max(0, sc.length-1));
  return genMathQuestion(sr.length>0?sr[rIdx]:20, sc.length>0?sc[cIdx]:2);
}

function makeBlast(x: number, y: number, big: boolean): Particle[] {
  const cols = ['#ff8800','#ffdd00','#ff4400','#ffffff','#ff2222','#ffaa00'];
  return Array.from({ length: big ? 22 : 9 }, () => ({
    id: uid(), x, y,
    vx: (Math.random()-0.5) * (big ? 9 : 4),
    vy: (Math.random()-0.5) * (big ? 9 : 4),
    life: 1, color: cols[rnd(0,cols.length-1)], r: big ? rnd(4,10) : rnd(2,5),
  }));
}

function makeBubblePop(x: number, y: number, isHeart: boolean): Particle[] {
  const cols = isHeart
    ? ['#ff6699','#ffaacc','#ff3366','#ffffff','#ffccdd']
    : ['#66cc44','#aaffaa','#33aa22','#ffffff','#88ff66'];
  return Array.from({ length: 14 }, () => ({
    id: uid(), x, y,
    vx: (Math.random()-0.5) * 5.5,
    vy: (Math.random()-0.5) * 5.5 - 1,
    life: 1, color: cols[rnd(0,cols.length-1)], r: rnd(2,5),
  }));
}

// ─── Draw: Spider (pixel-art style) ──────────────────────────────────────────
function drawSpider(ctx: CanvasRenderingContext2D, e: Enemy) {
  const def = SPIDERS[e.kind];
  const { color, accent, hi, eye: EC, bodyR: R } = def;
  const cx = Math.round(e.x);
  const t = Date.now() / 240;
  const cy = Math.round(e.y + Math.sin(t + e.id * 1.7) * 1.4);
  const u = Math.max(2, Math.round(R / 4));  // pixel block unit
  const K = '#060606';
  const lw = Math.sin(t * 1.2 + e.id * 2.3); // leg wave

  // helper: fill rect in grid units
  const b = (col: string, dx: number, dy: number, w: number, h: number) => {
    ctx.fillStyle = col;
    ctx.fillRect(
      cx + Math.round(dx * u), cy + Math.round(dy * u),
      Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u))
    );
  };

  // ── 3 LEFT LEGS (each: body-attach → knee → tip, L-shaped) ──
  // upper left
  b(K, -5,-3, 2,2); b(accent,-4,-2, 2,1);
  b(K, -7,-4+lw*0.5, 3,2); b(color,-7,-3+lw*0.5, 2,1);
  b(K, -9,-2+lw*0.3, 3,2); b(accent,-8,-1+lw*0.3, 2,1);
  // middle left
  b(K, -5, 0, 2,2); b(accent,-4, 1, 2,1);
  b(K, -8,-0.3-lw*0.4, 4,2); b(color,-7, 0.5-lw*0.4, 3,1);
  // lower left
  b(K, -5, 2, 2,2); b(accent,-4, 3, 2,1);
  b(K, -8, 3.5+lw*0.4, 3,2); b(color,-7, 4.5+lw*0.4, 2,1);
  b(K, -9, 5.5+lw*0.2, 3,2); b(accent,-8, 6.5+lw*0.2, 2,1);

  // ── 3 RIGHT LEGS ──
  b(K, 3,-3, 2,2); b(accent, 2,-2, 2,1);
  b(K, 4,-4+lw*0.5, 3,2); b(color, 4,-3+lw*0.5, 2,1);
  b(K, 6,-2+lw*0.3, 3,2); b(accent, 6,-1+lw*0.3, 2,1);
  b(K, 3, 0, 2,2); b(accent, 2, 1, 2,1);
  b(K, 4,-0.3-lw*0.4, 4,2); b(color, 4, 0.5-lw*0.4, 3,1);
  b(K, 3, 2, 2,2); b(accent, 2, 3, 2,1);
  b(K, 4, 3.5+lw*0.4, 3,2); b(color, 4, 4.5+lw*0.4, 2,1);
  b(K, 6, 5.5+lw*0.2, 3,2); b(accent, 6, 6.5+lw*0.2, 2,1);

  // ── CHELICERAE / FRONT ARMS ──
  if (e.kind === 2 || e.kind === 4) {
    // Large curved arms (like green bug / boss) — hug upward then flare out
    b(K,-5,-8, 4,5); b(color,-4,-7, 3,4);
    b(K,-7,-9, 4,3); b(accent,-7,-8, 3,2); // outward tip
    b(K,-8,-7, 2,3); b(color,-7,-6, 2,2);  // inner elbow
    b(K, 1,-8, 4,5); b(color, 1,-7, 3,4);
    b(K, 3,-9, 4,3); b(accent, 3,-8, 3,2);
    b(K, 6,-7, 2,3); b(color, 5,-6, 2,2);
  } else {
    // Forked Y-shaped chelicerae (like purple spider / reference Image 3)
    b(K,-4,-8, 3,5); b(color,-3,-7, 2,4); // left arm shaft
    b(K,-6,-11, 2,4); b(accent,-5,-10, 2,3); // left fork - left prong
    b(K,-2,-11, 2,4); b(color, -2,-10, 2,3); // left fork - right prong
    b(K, 1,-8, 3,5); b(color, 1,-7, 2,4); // right arm shaft
    b(K, 0,-11, 2,4); b(color, 0,-10, 2,3); // right fork - left prong
    b(K, 4,-11, 2,4); b(accent, 4,-10, 2,3); // right fork - right prong
  }

  // ── BODY (pixel-art blob: stacked rects that taper at top/bottom) ──
  b(K, -5,-5, 10,11); // dark shadow backdrop
  b(color,-3,-7, 6, 2); // top cap
  b(color,-4,-6, 8, 2);
  b(color,-5,-4, 10, 9); // wide middle
  b(color,-4, 5, 8, 2);  // lower body
  b(color,-3, 6, 6, 1);  // bottom cap
  b(accent,-5,-4, 2, 9); // left shading strip
  b(accent, 3,-4, 2, 9); // right shading strip
  b(accent,-4, 5, 8, 2); // bottom shading

  // ── BODY HIGHLIGHT (bright spot, top-left) ──
  b(hi, -2,-4, 5,4);
  ctx.fillStyle = 'rgba(255,255,255,0.52)';
  ctx.fillRect(cx + Math.round(-1*u), cy + Math.round(-3*u), Math.max(1, u*2), Math.max(1, u*2));

  // ── HEAD / NECK ──
  b(K,-3,-8, 6,3);
  b(accent,-2,-9, 4,3);
  b(color,-1,-8, 2,2);

  // ── EYES ──
  if (e.kind === 4) {
    // Boss: large tri-color glowing golden eye
    b(K,-4,-3, 8,5);
    b('#660000',-3,-2, 6,4);
    b('#cc4400',-2,-1, 4,3);
    b('#ff9900',-1, 0, 2,2);
    b('#ffee00',-1, 0, 1,1);
  } else if (e.kind === 2) {
    // Orange/yellow glowing core (like pink spider in Image 4)
    b(K,-3,-2, 6,5);
    b('#882200',-2,-1, 4,4);
    b('#ff6600',-1, 0, 2,2);
    b('#ffcc00', 0, 0, 1,1);
  } else {
    // Two rectangular red eyes with white glint (like purple spider, Image 3)
    b(K,-5,-2, 5,4); b(EC,-4,-1, 3,3);
    b('#ffffff',-4,-1, 1,1); b('#ffaaaa',-3,-1, 1,1);
    b(K, 0,-2, 5,4); b(EC, 1,-1, 3,3);
    b('#ffffff', 1,-1, 1,1); b('#ffaaaa', 2,-1, 1,1);
  }

  // ── HP BAR ──
  if (e.hp < e.maxHp) {
    const bw = R * 3.2;
    ctx.fillStyle = '#222'; ctx.fillRect(cx-bw/2, cy - R*2.5 - u*2, bw, 4);
    ctx.fillStyle = '#ff3333'; ctx.fillRect(cx-bw/2, cy - R*2.5 - u*2, bw*e.hp/e.maxHp, 4);
  }
}

// ─── Draw: Beetle (kind=5) — blue-gray shell, raised pincers, orange eyes ──────
function drawBeetle(ctx: CanvasRenderingContext2D, e: Enemy) {
  const cx = Math.round(e.x);
  const t = Date.now()/260;
  const cy = Math.round(e.y + Math.sin(t+e.id*1.5)*1.2);
  const u = 5; // bodyR=18 → max(2,round(18/4))=5
  const K='#080808', COL='#5577aa', ACC='#334466', HI='#aaccee', EYE='#ff8800';
  const b=(col:string,dx:number,dy:number,w:number,h:number)=>{
    ctx.fillStyle=col;
    ctx.fillRect(cx+Math.round(dx*u),cy+Math.round(dy*u),Math.max(1,Math.round(w*u)),Math.max(1,Math.round(h*u)));
  };
  const lw=Math.sin(t*1.3+e.id*2.5);

  // 6 stubby legs
  b(K,-8,0,3,2); b(ACC,-7.5,0.5+lw*0.4,2,1);
  b(K,-8,3,3,2); b(ACC,-7.5,3.5,2,1);
  b(K,-7,6,3,2); b(COL,-6.5,6.5-lw*0.3,2,1);
  b(K,5,0,3,2);  b(ACC,5.5,0.5+lw*0.4,2,1);
  b(K,5,3,3,2);  b(ACC,5.5,3.5,2,1);
  b(K,4,6,3,2);  b(COL,4.5,6.5-lw*0.3,2,1);

  // Left raised pincer claw (C-shape pointing up-left)
  b(K,-8,-9,3,8); b(COL,-7.5,-8.5,2,7);
  b(K,-10,-11,4,3); b(ACC,-9.5,-10.5,3,2);
  b(K,-9,-13,3,3); b(HI,-8.5,-12.5,2,2);
  b(K,-6,-6,2,3); b(COL,-5.5,-5.5,1.5,2);

  // Right raised pincer claw (mirror)
  b(K,5,-9,3,8); b(COL,5.5,-8.5,2,7);
  b(K,6,-11,4,3); b(ACC,6.5,-10.5,3,2);
  b(K,6,-13,3,3); b(HI,6.5,-12.5,2,2);
  b(K,4,-6,2,3); b(COL,4,-5.5,1.5,2);

  // Shell body (beetle dome)
  b(K,-5,-7,10,14);
  b(COL,-2,-8,4,2); b(COL,-4,-7,8,2);
  b(COL,-5,-5,10,10);
  b(COL,-4,4,8,2); b(COL,-3,5,6,1);
  b(ACC,-5,-5,2,10); b(ACC,3,-5,2,10); b(ACC,-4,4,8,2);
  b(K,0,-6,1,10);   // center seam
  b(ACC,-3,0,6,1);  // cross stripe

  // Highlight
  b(HI,-2,-4,4,3);
  ctx.fillStyle='rgba(255,255,255,0.40)';
  ctx.fillRect(cx+Math.round(-1*u),cy+Math.round(-3*u),Math.max(1,Math.round(2*u)),Math.max(1,Math.round(1.5*u)));

  // 2 compound orange eyes
  b(K,-5,-3,4,3); b(EYE,-4.5,-2.5,3,2); b('#ffee00',-4,-2.5,1,1);
  b(K,1,-3,4,3);  b(EYE,1.5,-2.5,3,2);  b('#ffee00',2,-2.5,1,1);

  if (e.hp<e.maxHp) {
    const bw=58;
    ctx.fillStyle='#222'; ctx.fillRect(cx-bw/2,cy-72,bw,4);
    ctx.fillStyle='#ff6600'; ctx.fillRect(cx-bw/2,cy-72,bw*e.hp/e.maxHp,4);
  }
}

// ─── Draw: Squid (kind=6) — purple mantle, 3 eyes, 6 tentacles ───────────────
function drawSquid(ctx: CanvasRenderingContext2D, e: Enemy) {
  const cx = Math.round(e.x);
  const t = Date.now()/220;
  const cy = Math.round(e.y + Math.sin(t+e.id*1.2)*1.8);
  const u = 5; // bodyR=20 → max(2,round(20/4))=5
  const K='#080808', COL='#6644cc', ACC='#3322aa', HI='#9977ff', EYE='#ff8800';
  const b=(col:string,dx:number,dy:number,w:number,h:number)=>{
    ctx.fillStyle=col;
    ctx.fillRect(cx+Math.round(dx*u),cy+Math.round(dy*u),Math.max(1,Math.round(w*u)),Math.max(1,Math.round(h*u)));
  };

  // 6 animated tentacles hanging below
  for (let i=0;i<6;i++) {
    const tx=(i-2.5)*1.8;
    const tw=Math.sin(t*1.4+e.id*1.8+i*0.9)*0.8;
    b(K,tx,5,1.5,8); b(COL,tx+0.2,5.5+tw,1,6); b(ACC,tx+0.3,10.5+tw*0.5,0.8,2);
  }

  // Side fins
  b(K,-8,-3,4,5); b(COL,-7.5,-2.5,3,4); b(K,-9,-1,3,3); b(ACC,-8.5,-0.5,2.5,2);
  b(K, 4,-3,4,5); b(COL,4,-2.5,3,4);    b(K, 6,-1,3,3); b(ACC,6,-0.5,2.5,2);

  // Pointed mantle (spire at top)
  b(K,-1,-11,2,4); b(COL,-0.5,-10.5,1,3);
  b(K,-2,-9,4,4);  b(COL,-1.5,-8.5,3,3);
  b(K,-3,-7,6,3);  b(COL,-2.5,-6.5,5,2);

  // Round body
  b(K,-5,-5,10,11);
  b(COL,-3,-6,6,2); b(COL,-4,-5,8,2);
  b(COL,-5,-3,10,8);
  b(COL,-4,4,8,2); b(COL,-3,5,6,1);
  b(ACC,-5,-3,2,8); b(ACC,3,-3,2,8); b(ACC,-4,4,8,2);

  // Highlight
  b(HI,-3,-4,4,3);
  ctx.fillStyle='rgba(255,255,255,0.42)';
  ctx.fillRect(cx+Math.round(-1*u),cy+Math.round(-3*u),Math.max(1,Math.round(2*u)),Math.max(1,Math.round(1.5*u)));

  // 3 orange eyes in a row
  b(K,-5,-1,3,3); b(EYE,-4.5,-0.5,2,2); b('#ffee00',-4.5,-0.5,0.8,0.8);
  b(K,-1.5,-1,3,3); b(EYE,-1,-0.5,2,2); b('#ffee00',-1,-0.5,0.8,0.8);
  b(K,2,-1,3,3);  b(EYE,2.5,-0.5,2,2);  b('#ffee00',2.5,-0.5,0.8,0.8);

  if (e.hp<e.maxHp) {
    const bw=64;
    ctx.fillStyle='#222'; ctx.fillRect(cx-bw/2,cy-76,bw,4);
    ctx.fillStyle='#8844ff'; ctx.fillRect(cx-bw/2,cy-76,bw*e.hp/e.maxHp,4);
  }
}

// ─── Sound ────────────────────────────────────────────────────────────────────
type SoundKind = 'shoot1'|'shoot2'|'shoot3'|'shoot4'|'shoot5'|'hurt'|'heart'|'levelup';
function playSound(kind: SoundKind) {
  try {
    const AC = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const t = ctx.currentTime;
    switch (kind) {
      case 'shoot1': osc.type='square'; osc.frequency.setValueAtTime(880,t); osc.frequency.exponentialRampToValueAtTime(440,t+0.06); gain.gain.setValueAtTime(0.05,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.06); break;
      case 'shoot2': osc.type='square'; osc.frequency.setValueAtTime(1100,t); osc.frequency.exponentialRampToValueAtTime(550,t+0.07); gain.gain.setValueAtTime(0.07,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.07); break;
      case 'shoot3': osc.type='sawtooth'; osc.frequency.setValueAtTime(1320,t); osc.frequency.exponentialRampToValueAtTime(660,t+0.08); gain.gain.setValueAtTime(0.08,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.08); break;
      case 'shoot4': osc.type='sawtooth'; osc.frequency.setValueAtTime(1600,t); osc.frequency.exponentialRampToValueAtTime(700,t+0.09); gain.gain.setValueAtTime(0.1,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.1); break;
      case 'shoot5': osc.type='sawtooth'; osc.frequency.setValueAtTime(2000,t); osc.frequency.exponentialRampToValueAtTime(400,t+0.12); gain.gain.setValueAtTime(0.12,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.12); break;
      case 'hurt': osc.type='sawtooth'; osc.frequency.setValueAtTime(300,t); osc.frequency.exponentialRampToValueAtTime(80,t+0.35); gain.gain.setValueAtTime(0.25,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.35); break;
      case 'heart': osc.type='sine'; osc.frequency.setValueAtTime(523,t); osc.frequency.setValueAtTime(659,t+0.1); osc.frequency.setValueAtTime(784,t+0.18); gain.gain.setValueAtTime(0.15,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.3); break;
      case 'levelup': osc.type='triangle'; osc.frequency.setValueAtTime(440,t); osc.frequency.setValueAtTime(554,t+0.08); osc.frequency.setValueAtTime(659,t+0.16); osc.frequency.setValueAtTime(880,t+0.24); gain.gain.setValueAtTime(0.15,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.38); break;
    }
    osc.start(t); osc.stop(t+0.5);
    setTimeout(()=>ctx.close(), 600);
  } catch { /* no audio */ }
}

// ─── Draw: Bubble ─────────────────────────────────────────────────────────────
function drawBubble(ctx: CanvasRenderingContext2D, b: Bubble) {
  const wx = Math.sin(Date.now()/400 + b.phase) * 3;
  const wy = Math.sin(Date.now()/650 + b.phase*2) * 1.5;
  const bx = Math.round(b.x + wx), by = Math.round(b.y + wy);
  const isH = b.kind === 'heart';
  const dmg = 1 - (b.hp - 1) / 4; // 0 = full, 1 = almost dead

  ctx.save();
  ctx.shadowBlur = 14; ctx.shadowColor = isH ? '#ff6699' : '#88ff44';
  ctx.globalAlpha = Math.max(0.25, 0.38 - dmg * 0.1);
  ctx.fillStyle = isH ? '#ffd0e8' : '#d0f0cc';
  ctx.beginPath(); ctx.arc(bx, by, BUBBLE_R, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = isH ? '#ff88aa' : '#88cc44';
  ctx.lineWidth = 1.5 + dmg * 2;
  ctx.beginPath(); ctx.arc(bx, by, BUBBLE_R, 0, Math.PI*2); ctx.stroke();
  ctx.globalAlpha = 0.55; ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(bx-BUBBLE_R*0.35, by-BUBBLE_R*0.38, BUBBLE_R*0.3, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.font = `${BUBBLE_R * 1.05}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(isH ? '❤️' : '💀', bx, by+1);
  // remaining HP dots
  if (b.hp < 5) {
    ctx.font = 'bold 9px monospace'; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9;
    ctx.fillText('×'+b.hp, bx, by + BUBBLE_R + 8);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── Draw: Canvas ship ────────────────────────────────────────────────────────
function drawShipCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, lv: BulletLevel) {
  const gunTip  = lv >= 5 ? '#ff4400' : lv >= 3 ? '#ffbb00' : '#88ddff';
  const gunBody = lv >= 5 ? '#bb2200' : lv >= 3 ? '#cc8800' : '#3366aa';
  const glow    = lv >= 5 ? 8 : lv >= 3 ? 5 : 0;

  // ── Gun barrels ──
  const drawGun = (gx: number, gy: number, tw: number, th: number, bh: number) => {
    ctx.fillStyle = gunBody; ctx.fillRect(gx, gy, tw, bh);
    if (glow) { ctx.shadowBlur = glow; ctx.shadowColor = gunTip; }
    ctx.fillStyle = gunTip; ctx.fillRect(gx, gy - th, tw, th);
    ctx.shadowBlur = 0;
  };
  drawGun(x-23, y-34, 7, 6, 16); // left
  drawGun(x- 3, y-40, 7, 6, 22); // center (taller)
  drawGun(x+16, y-34, 7, 6, 16); // right

  // ── Gun platform ──
  ctx.fillStyle = '#1a2a44'; ctx.fillRect(x-28, y-20, 57, 8);
  ctx.fillStyle = '#2c3e5a'; ctx.fillRect(x-26, y-19, 53, 6);

  // ── Main fuselage ──
  ctx.fillStyle = '#1a2a44'; ctx.fillRect(x-16, y-14, 33, 36);
  ctx.fillStyle = '#253556'; ctx.fillRect(x-14, y-12, 29, 26);
  // Stripe
  ctx.fillStyle = '#3366bb'; ctx.fillRect(x-13, y-2, 27, 3);

  // ── Cockpit ──
  ctx.fillStyle = '#2288ff'; ctx.fillRect(x-8, y-10, 17, 12);
  ctx.fillStyle = '#66bbff'; ctx.fillRect(x-7,  y-9,  8,  5);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x-6, y-8, 3, 2);

  // ── Left wing ──
  ctx.fillStyle = '#1a2a44'; ctx.fillRect(x-40, y-4, 26, 16);
  ctx.fillStyle = '#253556'; ctx.fillRect(x-38, y-3, 22, 12);
  ctx.fillStyle = '#3366bb'; ctx.fillRect(x-37, y+4, 20,  3);

  // ── Right wing ──
  ctx.fillStyle = '#1a2a44'; ctx.fillRect(x+15, y-4, 26, 16);
  ctx.fillStyle = '#253556'; ctx.fillRect(x+17, y-3, 22, 12);
  ctx.fillStyle = '#3366bb'; ctx.fillRect(x+17, y+4, 20,  3);

  // ── Engine nacelles ──
  ctx.fillStyle = '#0d1a2d'; ctx.fillRect(x-14, y+20, 11, 8);
  ctx.fillRect(x+3, y+20, 11, 8);
}

// ─── Draw: Player ────────────────────────────────────────────────────────────
function drawPlayer(ctx: CanvasRenderingContext2D, px: number, py: number, sh: number, lv: BulletLevel) {
  const x = Math.round(px), y = Math.round(py);
  if (sh > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(0,210,255,${0.35+0.28*Math.sin(Date.now()/80)})`;
    ctx.shadowBlur = 14; ctx.shadowColor = '#00ddff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, 48, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  const fl = 10 + Math.sin(Date.now()/55) * 5;
  const flame = (fx: number) => {
    ctx.fillStyle='#ff6600'; ctx.fillRect(fx-4, y+27, 9, fl);
    ctx.fillStyle='#ffcc00'; ctx.fillRect(fx-2, y+27, 5, fl*0.65);
    ctx.fillStyle='#fffaaa'; ctx.fillRect(fx-1, y+27, 3, fl*0.3);
  };
  flame(x-9); flame(x+9);
  drawShipCanvas(ctx, x, y, lv);
}

// ─── Draw: Bullets ────────────────────────────────────────────────────────────
function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet, lv: BulletLevel) {
  if (lv >= 5) {
    // Power 3: super fire ball
    ctx.shadowBlur = 10; ctx.shadowColor = '#ff4400';
    ctx.fillStyle='#ff1100'; ctx.fillRect(b.x-5,b.y-15,10,30);
    ctx.fillStyle='#ff6600'; ctx.fillRect(b.x-3,b.y-17,6,34);
    ctx.fillStyle='#ffee00'; ctx.fillRect(b.x-1,b.y-18,3,12);
    ctx.shadowBlur = 0;
  } else if (lv >= 3) {
    // Power 2: orange/yellow medium bolt
    ctx.fillStyle='#ff8800'; ctx.fillRect(b.x-3,b.y-11,6,22);
    ctx.fillStyle='#ffdd00'; ctx.fillRect(b.x-1,b.y-13,3,26);
    ctx.fillStyle='#ffffff'; ctx.fillRect(b.x-1,b.y-13,2,4);
  } else {
    // Power 1: thin cyan bolt
    ctx.fillStyle='#44ddff'; ctx.fillRect(b.x-2,b.y-9,4,18);
    ctx.fillStyle='#ffffff'; ctx.fillRect(b.x-1,b.y-11,2,5);
  }
}
function drawEBullet(ctx: CanvasRenderingContext2D, b: EBullet) {
  ctx.fillStyle='#ff3333'; ctx.fillRect(b.x-4,b.y-4,8,8);
  ctx.fillStyle='#ff8888'; ctx.fillRect(b.x-2,b.y-6,4,12);
}

// ─── Draw: Timer bar & HUD ────────────────────────────────────────────────────
function drawTimerBar(ctx: CanvasRenderingContext2D, frac: number, frozen: boolean) {
  const bx=55, by=8, bw=CW-110, bh=16;
  ctx.fillStyle='#111'; ctx.fillRect(bx,by,bw,bh);
  const col = frozen ? '#00aaff' : frac>0.5 ? '#44ff44' : frac>0.25 ? '#ffcc00' : '#ff2222';
  ctx.fillStyle=col; ctx.fillRect(bx,by,bw*(frozen?1:frac),bh);
  if (!frozen && frac<0.3) {
    ctx.fillStyle=`rgba(255,255,255,${0.25*Math.abs(Math.sin(Date.now()/120))})`;
    ctx.fillRect(bx,by,bw*frac,bh);
  }
  ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.strokeRect(bx,by,bw,bh);
  ctx.fillStyle=frozen?'#aaddff':'#fff';
  ctx.font='bold 10px monospace'; ctx.textAlign='center';
  ctx.fillText(frozen?'⏸ FROZEN':'⏱', bx+bw/2, by+11);
  ctx.textAlign='left';
}

function drawHUD(ctx: CanvasRenderingContext2D, hp: number, score: number, streak: number) {
  ctx.fillStyle='#ffdd00'; ctx.font='bold 13px monospace';
  ctx.textAlign='right';
  ctx.fillText(`${score}pt`, CW-8, 22);
  if (streak>=5) {
    const lvl = streak>=20?5:streak>=15?4:streak>=10?3:streak>=5?2:1;
    const col = lvl>=5?'#ff2200':lvl>=4?'#ff6600':lvl>=3?'#ffaa00':'#ffcc00';
    ctx.fillStyle=col;
    ctx.fillText(`Lv.${lvl} 🔥×${streak}`,CW-8,40);
  }
  ctx.textAlign='left';
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PixelInvadersView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  const [phase,       setPhase]       = useState<Phase>('menu');
  const [score,       setScore]       = useState(0);
  const [hp,          setHp]          = useState(MAX_HP);
  const [streak,      setStreak]      = useState(0);
  const [bulletLevel, setBulletLevel] = useState<BulletLevel>(1);
  const [question,    setQuestion]    = useState<Question|null>(null);
  const [wrongCount,  setWrongCount]  = useState(0);
  const [flashOk,     setFlashOk]     = useState(false);
  const [flashBad,    setFlashBad]    = useState(false);
  const [flashRed,    setFlashRed]    = useState(false);
  const [newLevel,    setNewLevel]    = useState<BulletLevel|null>(null);
  const [quizSecsLeft,setQuizSecsLeft]= useState(8);
  const [paused,      setPaused]      = useState(false);
  const [totalCorrect,setTotalCorrect]= useState(0);
  const [totalWrong,  setTotalWrong]  = useState(0);
  const [killCount,   setKillCount]   = useState(0);
  const [playerName,  setPlayerName]  = useState('');
  const leaderboard   = usePixelInvadersLeaderboard();
  const lastSavedName = useLastPixelInvadersName();
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const lbPanelRef    = useRef<HTMLDivElement>(null);
  const pausedRef     = useRef(false);
  const playerNameRef = useRef(DEFAULT_NAME);
  const savedIdRef    = useRef('');
  const settingsRef   = useRef({
    ranges: [20] as number[], operandCounts: [2] as number[],
    combatSecs: 10, quizSecs: 8, shootSound: true,
    quizMode: 'math' as 'math'|'english'|'mixed',
    wordSources: [...ALL_WORD_SOURCES] as WordSourceKey[],
  });
  const [shootSoundOn, setShootSoundOn] = useState(true);

  useEffect(() => {
    try {
      const s = localStorage.getItem('pixelInvaders_settings');
      if (s) {
        const parsed = JSON.parse(s);
        settingsRef.current = { ...settingsRef.current, ...parsed };
        if (parsed.shootSound === false) setShootSoundOn(false);
        // Validate quizMode
        const validModes = ['math','english','mixed'];
        if (!validModes.includes(parsed.quizMode)) settingsRef.current.quizMode = 'math';
        // Validate wordSources
        const validSources = Array.isArray(parsed.wordSources)
          ? parsed.wordSources.filter((k: string) => ALL_WORD_SOURCES.includes(k as WordSourceKey))
          : [];
        settingsRef.current.wordSources = validSources.length > 0 ? validSources : [...ALL_WORD_SOURCES];
      }
    } catch { /* ignore */ }
  }, []);

  // Reactive word-source pools (curriculum/progress/custom words can change
  // between visits) — kept in a ref so the imperative game loop always
  // reads the latest without re-subscribing every frame. Narrowest scope
  // first, same priority convention as angry-cow/hero-climb/word-vault.
  const weekWords = useThisWeekClimbWords();
  const reinforcementWords = useReinforcementClimbWords();
  const customWords = useCustomWords();
  const phonicsWords = usePhonicsClimbWords();
  const sightWordsPool = useSightWordsClimb();
  const wordTiersRef = useRef<Word[][]>([]);
  useEffect(() => {
    const tiers: Array<{ key: WordSourceKey; words: Word[] }> = [
      { key: 'thisWeek', words: weekWords },
      { key: 'reinforcement', words: reinforcementWords },
      { key: 'custom', words: customWords },
      { key: 'phonics', words: phonicsWords },
      { key: 'sightWords', words: sightWordsPool },
    ];
    wordTiersRef.current = tiers
      .filter((t) => settingsRef.current.wordSources.includes(t.key))
      .map((t) => t.words.filter((w) => w.emoji));
  }, [weekWords, reinforcementWords, customWords, phonicsWords, sightWordsPool]);

  const toggleShootSound = useCallback(() => {
    const next = !settingsRef.current.shootSound;
    settingsRef.current.shootSound = next;
    setShootSoundOn(next);
    try {
      const s = JSON.parse(localStorage.getItem('pixelInvaders_settings') || '{}');
      localStorage.setItem('pixelInvaders_settings', JSON.stringify({ ...s, shootSound: next }));
    } catch { /* ignore */ }
  }, []);

  // Keep playerNameRef in sync with the last saved name
  useEffect(() => {
    if (!playerName) playerNameRef.current = lastSavedName;
  }, [lastSavedName, playerName]);

  // Match leaderboard panel height to canvas area height
  useEffect(() => {
    const canvas = canvasAreaRef.current;
    const lb = lbPanelRef.current;
    if (!canvas || !lb) return;
    const ro = new ResizeObserver(() => { lb.style.height = canvas.offsetHeight + 'px'; });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // The board used to be capped at a flat max-w-lg (512px) regardless of
  // screen size, which left a lot of unused space on an iPad's much taller
  // viewport. Since the canvas is portrait-shaped (CW:CH), the real limit on
  // a landscape/tablet screen is usually available HEIGHT, not width — grow
  // the box up to whatever height budget is left above/below it, converted
  // to a matching width via the fixed aspect ratio.
  const [boardMaxWidth, setBoardMaxWidth] = useState(512);
  useEffect(() => {
    function recompute() {
      const area = canvasAreaRef.current;
      if (!area) return;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const chromeAbove = area.getBoundingClientRect().top;
      const bottomSafety = 16;
      const availableHeight = viewportHeight - chromeAbove - bottomSafety;
      const widthFromHeight = availableHeight * (CW / CH);
      setBoardMaxWidth(Math.floor(Math.max(260, Math.min(720, widthFromHeight))));
    }
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('orientationchange', recompute);
    window.visualViewport?.addEventListener('resize', recompute);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('orientationchange', recompute);
      window.visualViewport?.removeEventListener('resize', recompute);
    };
  }, []);

  const gs = useRef({
    phase: 'menu' as Phase,
    hp: MAX_HP, score: 0, streak: 0, comboStreak: 0,
    bulletLevel: 1 as BulletLevel,
    timerFrames: 10*60, shieldFrames: 0,
    px: CW/2, py: CH-68,
    bullets: [] as Bullet[], ebullets: [] as EBullet[],
    enemies: [] as Enemy[], bubbles: [] as Bubble[],
    particles: [] as Particle[], stars: makeStars(),
    fireCounter: 0, spawnCounter: 0, bubbleCounter: 0,
    moveLeft: false, moveRight: false, wrongInPhase: 0,
    quizTimer: 0, totalCorrect: 0, totalWrong: 0, killCount: 0, maxCombo: 0,
  });

  // ── Start ────────────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const g = gs.current;
    const cs = settingsRef.current.combatSecs * 60;
    Object.assign(g, {
      phase:'combat', hp:MAX_HP, score:0, streak:0, comboStreak:0,
      bulletLevel:1, timerFrames:cs, shieldFrames:0,
      px:CW/2, bullets:[], ebullets:[], enemies:[], bubbles:[], particles:[],
      stars:makeStars(), fireCounter:0, spawnCounter:0, bubbleCounter:0, wrongInPhase:0, quizTimer:0,
    });
    pausedRef.current = false; setPaused(false);
    setPhase('combat'); setScore(0); setHp(MAX_HP); setStreak(0);
    setBulletLevel(1); setQuestion(null); setWrongCount(0);
    setFlashOk(false); setFlashBad(false); setNewLevel(null);
    setTotalCorrect(0); setTotalWrong(0); setKillCount(0);
    setPlayerName(''); savedIdRef.current = '';
  }, []);

  const togglePause = useCallback(() => {
    if (gs.current.phase !== 'combat') return;
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
  }, []);

  // ── Quiz answer ──────────────────────────────────────────────────────────────
  const handleAnswer = useCallback((chosen: number|string, q: Question) => {
    const g = gs.current;
    const isCorrect = q.kind === 'math' ? q.answer === (chosen as number) : q.answer === (chosen as string);
    if (isCorrect) {
      g.totalCorrect++; setTotalCorrect(g.totalCorrect);
      g.streak++; g.comboStreak++;
      g.maxCombo = Math.max(g.maxCombo, g.comboStreak);
      const prev = g.bulletLevel;
      if (g.comboStreak >= 20) g.bulletLevel = 5;
      else if (g.comboStreak >= 15) g.bulletLevel = 4;
      else if (g.comboStreak >= 10) g.bulletLevel = 3;
      else if (g.comboStreak >= 5) g.bulletLevel = 2;
      else g.bulletLevel = 1;
      if (g.bulletLevel !== prev) {
        setNewLevel(g.bulletLevel); setTimeout(() => setNewLevel(null), 2800);
        playSound('levelup');
      }
      g.shieldFrames=SHIELD_FRAMES; g.timerFrames=settingsRef.current.combatSecs*60;
      g.wrongInPhase=0; g.phase='combat'; g.quizTimer=0;
      setBulletLevel(g.bulletLevel as BulletLevel); setStreak(g.streak);
      setFlashOk(true); setPhase('combat'); setQuestion(null);
      setTimeout(() => setFlashOk(false), 300);
    } else {
      g.totalWrong++; setTotalWrong(g.totalWrong);
      g.wrongInPhase++;
      { const newLv = Math.max(1, g.bulletLevel - 1) as BulletLevel; g.bulletLevel=newLv; g.comboStreak=(newLv-1)*5; setBulletLevel(newLv); }
      setFlashBad(true); setTimeout(() => setFlashBad(false), 420);
      setWrongCount(g.wrongInPhase);
      setTimeout(() => setQuestion(pickQuestion(settingsRef.current.ranges, settingsRef.current.operandCounts, g.comboStreak, settingsRef.current.quizMode, wordTiersRef.current)), 420);
    }
  }, []);

  // ── Game loop ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const tick = () => {
      const g = gs.current;
      ctx.fillStyle='#05091c'; ctx.fillRect(0,0,CW,CH);

      g.stars.forEach(s => {
        s.y+=s.speed; if (s.y>CH) { s.y=0; s.x=Math.random()*CW; }
        ctx.fillStyle=`rgba(255,255,255,${Math.min(1,0.4+s.r*0.25)})`;
        ctx.fillRect(s.x,s.y,s.r,s.r);
      });

      if (g.phase === 'combat' && !pausedRef.current) {
        if (g.moveLeft)  g.px = Math.max(22, g.px-PLAYER_SPD);
        if (g.moveRight) g.px = Math.min(CW-22, g.px+PLAYER_SPD);

        // Auto fire
        g.fireCounter++;
        if (g.fireCounter >= FIRE_RATE) {
          g.fireCounter=0;
          const spawns = g.bulletLevel <= 1 ? [GUN_TIPS[1]]
            : g.bulletLevel <= 3 ? [GUN_TIPS[0], GUN_TIPS[2]]
            : GUN_TIPS;
          spawns.forEach(t => g.bullets.push({ id:uid(), x:g.px+t.dx, y:g.py+t.dy }));
        }

        g.bullets  = g.bullets.filter(b  => { b.y-=BULLET_SPD; return b.y>-20; });
        g.ebullets = g.ebullets.filter(b => {
          b.x+=b.vx; b.y+=b.vy;
          return b.y<CH+20 && b.x>-20 && b.x<CW+20;
        });

        // ── Spawn enemies ──
        g.spawnCounter++;
        const spawnInt = Math.max(55, 95-Math.floor(g.score/180)*3);
        if (g.spawnCounter >= spawnInt) {
          g.spawnCounter=0;
          const sc = g.score, cs = g.comboStreak;
          let kind: 0|1|2|3|4|5|6;
          if      (cs>=20 && Math.random()<0.22) kind=6;
          else if (cs>=10 && Math.random()<0.22) kind=5;
          else if (sc<100)      kind=Math.random()<0.6?0:1;
          else if (sc<250) kind=Math.random()<0.4?(Math.random()<0.5?0:1):(Math.random()<0.6?2:3);
          else              kind=([0,1,2,3,4] as const)[rnd(0,4)];
          const def = getMonsterBase(kind);
          g.enemies.push({
            id:uid(),
            x:rnd(def.hitR+10, CW-def.hitR-10),
            y:-(def.bodyR+def.legLen+10),
            vx:(Math.random()-0.5)*2.4,
            kind, hp:def.hp, maxHp:def.hp,
          });
        }

        // ── Spawn bubbles ──
        g.bubbleCounter++;
        if (g.bubbleCounter >= BUBBLE_SPAWN) {
          g.bubbleCounter=0;
          g.bubbles.push({
            id:uid(),
            x:rnd(BUBBLE_R+15, CW-BUBBLE_R-15),
            y:-(BUBBLE_R+5),
            kind: Math.random()<0.62 ? 'heart' : 'skull',
            phase: Math.random()*Math.PI*2,
            hp: 5,
          });
        }

        // Move enemies
        const descend = 1.3 + g.score/1800;
        g.enemies.forEach(e => {
          e.x+=e.vx; e.y+=descend;
          if (e.x<15||e.x>CW-15) e.vx*=-1;
          if (Math.random()<0.005) {
            const dx=g.px-e.x, dy=g.py-e.y, len=Math.hypot(dx,dy)||1;
            const bvx=dx/len*EBULLET_SPD, bvy=dy/len*EBULLET_SPD;
            // beetles fire 2 spread bullets, squids fire 3, spiders fire 1
            const angles = e.kind===6 ? [-0.38,0,0.38] : e.kind===5 ? [-0.22,0.22] : [0];
            angles.forEach(a => {
              const c=Math.cos(a), s=Math.sin(a);
              g.ebullets.push({ id:uid(), x:e.x, y:e.y, vx:bvx*c-bvy*s, vy:bvx*s+bvy*c });
            });
          }
        });

        // Move bubbles (slow descent + drift)
        g.bubbles = g.bubbles.filter(b => { b.y+=0.9; return b.y < CH+30; });

        // ── Bullet vs spider ──
        const deadB=new Set<number>(), deadE=new Set<number>();
        g.bullets.forEach(b => {
          g.enemies.forEach(e => {
            if (dst(b.x,b.y,e.x,e.y) < getMonsterBase(e.kind).hitR+4) {
              deadB.add(b.id); e.hp--;
              if (e.hp<=0) {
                deadE.add(e.id);
                g.particles.push(...makeBlast(e.x,e.y,e.kind>=3));
                if (e.kind>=6) g.particles.push(...makeBlast(e.x,e.y,true));
                g.score+=getMonsterBase(e.kind).score; setScore(g.score);
                g.killCount++; setKillCount(g.killCount);
              }
            }
          });
        });
        g.bullets  = g.bullets.filter(b => !deadB.has(b.id));
        g.enemies  = g.enemies.filter(e => !deadE.has(e.id));

        // ── Bullet vs bubble (5 hits to pop) ──
        const deadBub = new Set<number>();
        g.bullets.forEach(b => {
          g.bubbles.forEach(bub => {
            if (!deadBub.has(bub.id) && !deadB.has(b.id) && dst(b.x,b.y,bub.x,bub.y) < BUBBLE_R+4) {
              deadB.add(b.id);
              bub.hp--;
              g.particles.push(...makeBubblePop(bub.x, bub.y, bub.kind==='heart').slice(0,5));
              if (bub.hp <= 0) {
                deadBub.add(bub.id);
                g.particles.push(...makeBubblePop(bub.x, bub.y, bub.kind==='heart'));
                if (bub.kind==='heart') {
                  g.hp=Math.min(MAX_HP, g.hp+1); setHp(g.hp);
                  playSound('heart');
                } else {
                  g.hp--; g.shieldFrames=Math.max(g.shieldFrames, 40);
                  setHp(g.hp); setFlashRed(true); setTimeout(()=>setFlashRed(false),350);
                  playSound('hurt');
                  if (g.hp<=0) {
                    g.phase='gameover'; setPhase('gameover');
                    if (!savedIdRef.current) savedIdRef.current=savePixelInvadersRecord(playerNameRef.current,g.score,g.totalCorrect,g.totalWrong,g.killCount,g.maxCombo);
                  }
                }
              }
            }
          });
        });
        g.bubbles = g.bubbles.filter(b => !deadBub.has(b.id));
        g.bullets  = g.bullets.filter(b => !deadB.has(b.id));

        // ── Player hit ──
        {
          const ebHits = g.ebullets.filter(b => dst(b.x,b.y,g.px,g.py)<22);
          if (g.shieldFrames<=0) {
            const enH = g.enemies.find(e => {
              const bodyHit = Math.abs(e.x-g.px)<24 && Math.abs(e.y-g.py)<26;
              return bodyHit || dst(e.x,e.y,g.px,g.py)<getMonsterBase(e.kind).hitR+8;
            });
            if (ebHits.length>0||enH) {
              g.hp--; g.shieldFrames=SHIELD_FRAMES;
              g.particles.push(...makeBlast(g.px,g.py,false));
              setFlashRed(true); setTimeout(()=>setFlashRed(false),350);
              playSound('hurt');
              // Remove ALL colliding enemy bullets (not just the first one)
              if (ebHits.length>0) {
                const hitIds = new Set(ebHits.map(b=>b.id));
                g.ebullets = g.ebullets.filter(b=>!hitIds.has(b.id));
              }
              setHp(g.hp);
              if (g.hp<=0) {
                g.phase='gameover'; setPhase('gameover');
                if (!savedIdRef.current) savedIdRef.current=savePixelInvadersRecord(playerNameRef.current,g.score,g.totalCorrect,g.totalWrong,g.killCount,g.maxCombo);
              }
            }
          } else {
            // During shield: absorb (remove) any enemy bullets that enter the hitbox so they don't visually pass through
            if (ebHits.length>0) {
              const hitIds = new Set(ebHits.map(b=>b.id));
              g.ebullets = g.ebullets.filter(b=>!hitIds.has(b.id));
            }
          }
          if (g.shieldFrames>0) g.shieldFrames--;
        }
        g.enemies = g.enemies.filter(e=>e.y<CH+70);

        g.timerFrames--;
        if (g.timerFrames<=0) {
          const q = pickQuestion(settingsRef.current.ranges, settingsRef.current.operandCounts, g.comboStreak, settingsRef.current.quizMode, wordTiersRef.current);
          g.phase='quiz'; setPhase('quiz');
          g.quizTimer = settingsRef.current.quizSecs * 60;
          setQuizSecsLeft(settingsRef.current.quizSecs);
          setQuestion(q); setWrongCount(g.wrongInPhase=0);
        }
      }

      // ── Quiz countdown ──
      if (g.phase === 'quiz' && !pausedRef.current && g.quizTimer > 0) {
        g.quizTimer--;
        const sl = Math.ceil(g.quizTimer / 60);
        setQuizSecsLeft(sl);
        if (g.quizTimer <= 0) {
          g.totalWrong++; setTotalWrong(g.totalWrong);
          g.wrongInPhase++;
          { const newLv = Math.max(1, g.bulletLevel - 1) as BulletLevel; g.bulletLevel=newLv; g.comboStreak=(newLv-1)*5; setBulletLevel(newLv); }
          setWrongCount(g.wrongInPhase); setFlashBad(true);
          const newQ = pickQuestion(settingsRef.current.ranges, settingsRef.current.operandCounts, g.comboStreak, settingsRef.current.quizMode, wordTiersRef.current);
          setTimeout(() => {
            setFlashBad(false);
            setQuestion(newQ);
            g.quizTimer = settingsRef.current.quizSecs * 60;
            setQuizSecsLeft(settingsRef.current.quizSecs);
          }, 450);
        }
      }

      // Particles
      g.particles = g.particles.filter(p => {
        p.x+=p.vx; p.y+=p.vy; p.vx*=0.91; p.vy*=0.91; p.life-=0.025;
        return p.life>0;
      });

      // Render
      g.particles.forEach(p => {
        ctx.globalAlpha=p.life; ctx.fillStyle=p.color;
        ctx.fillRect(p.x-p.r,p.y-p.r,p.r*2,p.r*2); ctx.globalAlpha=1;
      });
      g.enemies.forEach(e => {
        if (e.kind===5) drawBeetle(ctx,e);
        else if (e.kind===6) drawSquid(ctx,e);
        else drawSpider(ctx,e);
      });
      g.bubbles.forEach(b  => drawBubble(ctx,b));
      g.ebullets.forEach(b => drawEBullet(ctx,b));
      g.bullets.forEach(b  => drawBullet(ctx,b,g.bulletLevel));
      drawPlayer(ctx,g.px,g.py,g.shieldFrames,g.bulletLevel);
      drawTimerBar(ctx,g.timerFrames/(settingsRef.current.combatSecs*60),g.phase==='quiz');
      drawHUD(ctx,g.hp,g.score,g.streak);

      rafRef.current=requestAnimationFrame(tick);
    };
    rafRef.current=requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const dn=(e:KeyboardEvent)=>{if(e.key==='ArrowLeft')gs.current.moveLeft=true;if(e.key==='ArrowRight')gs.current.moveRight=true;};
    const up=(e:KeyboardEvent)=>{if(e.key==='ArrowLeft')gs.current.moveLeft=false;if(e.key==='ArrowRight')gs.current.moveRight=false;};
    window.addEventListener('keydown',dn); window.addEventListener('keyup',up);
    return ()=>{window.removeEventListener('keydown',dn);window.removeEventListener('keyup',up);};
  }, []);

  const onPtr = useCallback((clientX: number) => {
    const c=canvasRef.current; if(!c||gs.current.phase!=='combat') return;
    const r=c.getBoundingClientRect();
    gs.current.px=Math.max(22,Math.min(CW-22,(clientX-r.left)*(CW/r.width)));
  }, []);

  const renderHint = (q: Question) => {
    if (q.kind !== 'math') return null;
    if (q.nums.length !== 2 || q.nums[0] > 15 || q.nums[1] > 15) return null;
    const a = q.nums[0], b = q.nums[1], op = q.ops[0];
    return (
      <div className="mt-3 p-2 rounded-lg bg-gray-800 border border-yellow-800">
        <p className="text-xs text-yellow-400 text-center mb-2 font-mono">💡 數一數看看！</p>
        {op==='+' ? (
          <div className="flex flex-wrap gap-1 justify-center">
            {Array.from({length:a},(_,i)=><span key={`a${i}`} className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center text-white text-xs font-bold">{i+1}</span>)}
            <span className="text-yellow-400 font-bold self-center">＋</span>
            {Array.from({length:b},(_,i)=><span key={`b${i}`} className="w-6 h-6 bg-green-500 rounded-md flex items-center justify-center text-white text-xs font-bold">{i+1}</span>)}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 justify-center">
            {Array.from({length:a},(_,i)=><span key={i} className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold ${i<a-b?'bg-blue-500':'bg-red-900 opacity-40'}`}>{i+1}</span>)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#05091c] py-4 px-2">
      <div className="flex gap-3 justify-center items-start w-full">

      {/* ── 英雄榜面板（lg+ 才顯示，高度跟遊戲畫面同步） ── */}
      <div ref={lbPanelRef}
        className="hidden lg:flex flex-col w-48 shrink-0 bg-gray-900/80 border border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-3 py-2.5 border-b border-gray-700 shrink-0">
          <h2 className="text-yellow-400 font-mono font-bold text-sm tracking-wide">🏆 英雄榜</h2>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {leaderboard.length === 0 ? (
            <p className="text-gray-600 text-[10px] font-mono text-center py-6 px-2">玩完第一場後<br/>成績會出現在這裡</p>
          ) : leaderboard.map((r, i) => (
            <div key={r.id} className={`px-2.5 py-1.5 border-b border-gray-800/60 ${i===0?'bg-yellow-900/20':''}`}>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-[10px] font-mono font-bold w-4 shrink-0 ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-amber-600':'text-gray-600'}`}>
                  {i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}
                </span>
                <span className="text-white text-[11px] font-mono truncate flex-1">{r.name}</span>
              </div>
              <div className="flex gap-2 text-[10px] font-mono mt-0.5 pl-5">
                <span className="text-yellow-400 font-bold">{r.score}pt</span>
                <span className="text-orange-400">💥{r.kills}</span>
                <span className="text-green-400">✅{r.correct}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 遊戲主體 ── */}
      <div className="flex flex-col items-center w-full" style={{ maxWidth: boardMaxWidth }}>
      <div className="w-full flex items-center mb-3 px-2 gap-2">
        <BackButton />
        <div className="flex flex-col ml-2">
          <h1 className="text-yellow-400 font-bold text-base font-mono leading-tight">時空戰術隊</h1>
          <span className="text-gray-500 text-[10px] font-mono">Pixel Math Invaders</span>
        </div>
        {newLevel && (
          <span className="text-xs font-bold font-mono animate-bounce ml-1" style={{
            color: newLevel>=5?'#ff2200':newLevel>=4?'#ff6600':newLevel>=3?'#ffaa00':'#ffcc00'
          }}>
            {newLevel===2?'⚡雙砲':newLevel===3?'💥強化':newLevel===4?'🔥三連':'☄️超強'}
          </span>
        )}
        <div className="ml-auto flex gap-1.5 items-center">
          <button onClick={toggleShootSound}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-yellow-500 bg-white/10 text-lg hover:bg-white/20"
            aria-label={shootSoundOn ? '關閉射擊音效' : '開啟射擊音效'}
            title={shootSoundOn ? '射擊音效：開' : '射擊音效：關'}>
            {shootSoundOn ? '🔊' : '🔇'}
          </button>
          <a href="/games/pixel-invaders/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-yellow-500 bg-white/10 text-lg hover:bg-white/20"
            aria-label="設定">⚙️</a>
          {phase === 'combat' && (
            <button onClick={togglePause}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-yellow-500 bg-white/10 text-base hover:bg-white/20"
              aria-label={paused ? '繼續' : '暫停'}>
              {paused ? '▶' : '⏸'}
            </button>
          )}
          {(phase === 'combat' || phase === 'quiz' || phase === 'gameover') && (
            <button onClick={startGame}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-yellow-500 bg-white/10 text-base hover:bg-white/20"
              aria-label="重新開始">🔄</button>
          )}
        </div>
      </div>

      {/* HP + 統計列 */}
      {phase !== 'menu' && (
        <div className="w-full flex items-center px-3 mb-1.5 gap-3" style={{ maxWidth: boardMaxWidth }}>
          {/* 愛心：左側，較大 */}
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-gray-500 text-[9px] font-mono leading-none">命</span>
            <div className="flex gap-1">
              {Array.from({length: MAX_HP}, (_, i) => (
                <span key={i} style={{
                  fontSize: '26px', lineHeight: 1,
                  color: i < hp ? '#ff3344' : '#2a2a2a',
                  filter: i < hp ? 'drop-shadow(0 0 6px #ff5566)' : 'none',
                  transition: 'color 0.15s, filter 0.15s',
                }}>♥</span>
              ))}
            </div>
          </div>
          {/* 統計：右側，較小 */}
          <div className="ml-auto flex gap-3 font-mono">
            {[
              { label:'✅答對', val: totalCorrect, col:'text-green-300' },
              { label:'❌答錯', val: totalWrong,   col:'text-red-300'   },
              { label:'命中率', val: totalCorrect+totalWrong===0?'—':`${Math.round(totalCorrect/(totalCorrect+totalWrong)*100)}%`, col:'text-white' },
              { label:'💥消滅', val: killCount,    col:'text-orange-300'},
            ].map(s => (
              <span key={s.label} className="flex flex-col items-center leading-tight">
                <span className="text-gray-500 text-[9px]">{s.label}</span>
                <span className={`${s.col} text-base font-bold tabular-nums`}>{s.val}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div ref={canvasAreaRef} className="relative w-full" style={{aspectRatio:`${CW}/${CH}`}}>
        <canvas ref={canvasRef} width={CW} height={CH}
          className="w-full h-full rounded-2xl border-2 border-gray-700 touch-none block"
          onPointerMove={e=>{ if(e.pointerType==='mouse') onPtr(e.clientX); }}
          onTouchStart={e=>{
            if(gs.current.phase!=='combat') return;
            const r=canvasRef.current!.getBoundingClientRect();
            const tx=(e.touches[0].clientX-r.left)*(CW/r.width);
            gs.current.moveLeft=tx<CW/2; gs.current.moveRight=tx>=CW/2;
          }}
          onTouchMove={e=>{
            if(gs.current.phase!=='combat') return;
            const r=canvasRef.current!.getBoundingClientRect();
            const tx=(e.touches[0].clientX-r.left)*(CW/r.width);
            gs.current.moveLeft=tx<CW/2; gs.current.moveRight=tx>=CW/2;
          }}
          onTouchEnd={()=>{gs.current.moveLeft=false; gs.current.moveRight=false;}}
        />

        {phase==='menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/82 rounded-2xl">
            <div className="text-6xl mb-3 animate-bounce">🕷️</div>
            <h2 className="text-3xl font-bold text-yellow-400 font-mono mb-1">時空戰術隊</h2>
            <p className="text-gray-300 text-xs font-mono mb-2">Pixel Math Invaders</p>
            <div className="bg-gray-900/80 rounded-xl px-4 py-3 mb-5 text-xs font-mono text-center max-w-xs space-y-1">
              <p className="text-gray-300">消滅怪物 10 秒 → ⏸ 時空凍結</p>
              <p className="text-gray-300">答對題目 → 繼續戰鬥（題型見設定）</p>
              <p className="text-yellow-500">❤️ 泡泡射破 +1 命　💀 泡泡射破 -1 命</p>
              <p className="text-blue-300">連答 +5→⚡雙砲　+10→💥三管　+15→🔥三連砲　+20→☄️超強</p>
              <p className="text-purple-300">連答 10題出現甲蟲🪲（2發）　20題出現魷魚🦑（3發）</p>
              <p className="text-gray-500 text-[10px]">（答錯歸零）</p>
            </div>
            <button onClick={startGame}
              className="px-10 py-4 bg-yellow-400 text-black font-bold text-xl rounded-2xl hover:bg-yellow-300 active:scale-95 transition-all font-mono shadow-xl shadow-yellow-400/20">
              開始遊戲！
            </button>
          </div>
        )}

        {flashRed && (
          <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{backgroundColor:'rgba(255,0,0,0.35)', animation:'none'}}/>
        )}

        {/* UPGRADE! 覆蓋層 */}
        {newLevel && phase === 'combat' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none rounded-2xl overflow-hidden">
            {/* 放射狀光暈背景 */}
            <div className="absolute inset-0" style={{
              background: `radial-gradient(ellipse at center, ${
                newLevel>=5?'rgba(255,34,0,0.22)':newLevel>=4?'rgba(255,102,0,0.20)':newLevel>=3?'rgba(255,170,0,0.18)':'rgba(255,204,0,0.15)'
              } 0%, transparent 70%)`,
            }}/>
            <div className="relative text-center px-4">
              <p className="font-black font-mono tracking-widest leading-none animate-bounce select-none"
                style={{
                  fontSize: 'clamp(2.8rem, 12vw, 4.5rem)',
                  color: newLevel>=5?'#ff2200':newLevel>=4?'#ff6600':newLevel>=3?'#ffaa00':'#ffdd00',
                  textShadow: newLevel>=5
                    ? '0 0 16px #ff2200, 0 0 40px #ff4400, 0 0 80px #ff0000'
                    : newLevel>=4
                    ? '0 0 16px #ff6600, 0 0 40px #ff8800, 0 0 70px #ff4400'
                    : newLevel>=3
                    ? '0 0 16px #ffaa00, 0 0 36px #ffcc00, 0 0 60px #ff8800'
                    : '0 0 14px #ffdd00, 0 0 30px #ffee88',
                }}>
                ⬆ UPGRADE!
              </p>
              <p className="font-bold font-mono text-white mt-2 select-none"
                style={{
                  fontSize: 'clamp(1rem, 4vw, 1.5rem)',
                  textShadow: '0 2px 10px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7)',
                }}>
                {newLevel===2?'⚡ 雙管齊發解鎖！'
                  :newLevel===3?'💥 火力強化解鎖！'
                  :newLevel===4?'🔥 三連砲解鎖！'
                  :'☄️ 超強火力解鎖！'}
              </p>
            </div>
          </div>
        )}

        {phase==='quiz' && question && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl transition-colors duration-200 ${flashOk?'bg-green-900/75':flashBad?'bg-red-900/70':'bg-black/78'}`}>
            {flashOk && <div className="absolute top-24 text-green-400 text-2xl font-bold font-mono animate-bounce drop-shadow-lg">✅ 太棒了！</div>}
            {flashBad && <div className="absolute top-24 text-red-400 text-xl font-bold font-mono drop-shadow-lg">❌ 再試一次！</div>}
            <div className="bg-gray-900/95 border-2 border-yellow-500 rounded-2xl p-5 w-72 shadow-2xl">
              <div className="text-center mb-2">
                <span className="text-xs text-blue-300 font-mono tracking-widest">⏸ 時空凍結！</span>
                <p className="text-xs text-gray-500 font-mono mt-0.5">答對才能繼續戰鬥</p>
              </div>
              {/* Quiz timer */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-gray-500 font-mono">⏱ 限時作答</span>
                  <span className={`text-base font-bold font-mono ${quizSecsLeft<=3?'text-red-400 animate-pulse':quizSecsLeft<=5?'text-yellow-400':'text-green-400'}`}>
                    {quizSecsLeft}s
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-700 rounded-full overflow-hidden">
                  <div style={{
                    width:`${Math.max(0, quizSecsLeft/settingsRef.current.quizSecs*100)}%`,
                    height:'100%', borderRadius:'9999px',
                    backgroundColor: quizSecsLeft<=3?'#ff3333':quizSecsLeft<=5?'#ffaa00':'#44ff88',
                    transition:'width 0.25s linear',
                  }}/>
                </div>
              </div>
              {question.kind === 'math' ? (
                <>
                  <div className="flex flex-wrap justify-center items-center gap-1 my-4 font-mono font-bold text-white" style={{fontSize: question.nums.length > 3 ? '1.5rem' : '2rem'}}>
                    {question.nums.map((n, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-yellow-400 mx-1">{question.ops[i-1]}</span>}
                        <span>{n}</span>
                      </span>
                    ))}
                    <span className="text-gray-500 mx-1">=</span>
                    <span className="text-yellow-300">?</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {question.choices.map(c=>(
                      <button key={c} onClick={()=>handleAnswer(c,question)}
                        className="py-4 text-2xl font-bold rounded-xl border-2 border-gray-600 bg-gray-800 hover:bg-blue-700 hover:border-blue-400 active:scale-95 text-white font-mono transition-all">
                        {c}
                      </button>
                    ))}
                  </div>
                  {wrongCount>=2 && renderHint(question)}
                </>
              ) : (
                <>
                  <div className="text-center my-3">
                    <div className="text-6xl mb-1 leading-none">{question.emoji}</div>
                    <p className="text-white font-bold text-xl mt-1">{question.zh}</p>
                    <p className="text-gray-500 text-[11px] font-mono mt-0.5">這是什麼英文？</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {question.choices.map(c=>(
                      <button key={c} onClick={()=>handleAnswer(c,question)}
                        className="py-3 text-xl font-bold rounded-xl border-2 border-gray-600 bg-gray-800 hover:bg-purple-700 hover:border-purple-400 active:scale-95 text-white font-mono transition-all tracking-wide uppercase">
                        {c}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {streak>0 && <p className="mt-3 text-gray-500 text-xs font-mono">連續答對：{streak} 次</p>}
          </div>
        )}

        {phase==='gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/88 rounded-2xl px-4">
            <div className="text-5xl mb-2">💥</div>
            <h2 className="text-3xl font-bold text-red-400 font-mono mb-1">GAME OVER</h2>
            <p className="text-yellow-400 text-2xl font-mono font-bold">{score}<span className="text-sm text-yellow-600 ml-1">分</span></p>
            <div className="flex gap-4 text-xs font-mono text-gray-400 mt-1 mb-3">
              <span>✅{totalCorrect}</span><span>❌{totalWrong}</span><span>💥{killCount}</span><span>🔥×{streak}</span>
            </div>
            {/* 玩家名稱 */}
            <div className="mb-4 text-center">
              <p className="text-gray-500 text-[10px] font-mono mb-1">玩家名稱（點擊可修改）</p>
              <input
                value={playerName || lastSavedName}
                onChange={e => {
                  setPlayerName(e.target.value);
                  playerNameRef.current = e.target.value;
                }}
                onBlur={e => {
                  const n = e.target.value.trim() || DEFAULT_NAME;
                  playerNameRef.current = n; setPlayerName(n);
                  if (savedIdRef.current) updatePixelInvadersName(savedIdRef.current, n);
                }}
                className="w-36 text-center bg-gray-800 border border-yellow-700 rounded-lg px-2 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-yellow-400"
                maxLength={10}
              />
            </div>
            <button onClick={startGame}
              className="px-8 py-3 bg-yellow-400 text-black font-bold text-xl rounded-2xl hover:bg-yellow-300 active:scale-95 transition-all font-mono">
              再玩一次！
            </button>
          </div>
        )}

        {paused && phase==='combat' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 rounded-2xl">
            <p className="text-4xl mb-1">⏸</p>
            <p className="text-2xl font-bold text-white font-mono mb-6">遊戲暫停</p>
            <button onClick={togglePause}
              className="px-10 py-3 bg-yellow-400 text-black font-bold text-lg rounded-xl hover:bg-yellow-300 active:scale-95 font-mono mb-3">
              ▶ 繼續遊戲
            </button>
            <button onClick={startGame}
              className="px-10 py-3 bg-gray-700 text-gray-200 font-bold text-base rounded-xl hover:bg-gray-600 active:scale-95 font-mono">
              🔄 重新開始
            </button>
          </div>
        )}

      </div>
      </div>{/* game panel */}
      </div>{/* flex row */}
    </div>
  );
}

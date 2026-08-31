// Canvas vehicle renderers for the space racer — purely cosmetic, doesn't
// touch gameplay logic. Every renderer draws nose-up (toward the top of the
// screen), centered on the origin, assuming the caller has already
// ctx.translate()'d to the vehicle's on-screen position.
//
// The track surface is a dark asphalt (#232530) — every body color below is
// deliberately kept bright/saturated (no black or near-black main colors)
// so the vehicle stays visible against it; small trim details (tires,
// windshield tint) can still be dark since they're a minor fraction of the
// silhouette.

export const VEHICLE_OPTIONS = [
  { value: 'redRacer', label: '🔴 紅色跑車' },
  { value: 'blueRacer', label: '🔵 藍色跑車' },
  { value: 'purpleRacer', label: '🟣 紫色跑車' },
  { value: 'yellowTaxi', label: '🚕 黃色計程車' },
  { value: 'greenJeep', label: '🟢 綠色吉普車' },
  { value: 'orangeTruck', label: '🟠 橘色小貨卡' },
  { value: 'orangeMoto', label: '🏍️ 橘色摩托車' },
  { value: 'pinkBike', label: '🚲 粉紅腳踏車' },
  { value: 'armyTank', label: '🛡️ 軍綠坦克車' },
  { value: 'silverUfo', label: '🛸 銀色飛碟' },
] as const;

export type VehicleKind = (typeof VEHICLE_OPTIONS)[number]['value'];

// Sharon wanted the vehicle look to just show up randomly each game rather
// than be a settings menu choice — no persisted preference, just re-roll on
// every fresh playthrough.
export function randomVehicleKind(): VehicleKind {
  return VEHICLE_OPTIONS[Math.floor(Math.random() * VEHICLE_OPTIONS.length)].value;
}

// Shared body plan for the three sedan/racer color variants — only the
// paint job differs between them.
function drawFourWheelBody(
  ctx: CanvasRenderingContext2D,
  bodyColor: string,
  stripeColor: string,
  glassColor: string,
) {
  ctx.fillStyle = '#14161c';
  ctx.fillRect(-16, -18, 7, 14);
  ctx.fillRect(9, -18, 7, 14);
  ctx.fillRect(-16, 6, 7, 14);
  ctx.fillRect(9, 6, 7, 14);

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.roundRect(-13, -24, 26, 48, 8);
  ctx.fill();

  ctx.fillStyle = stripeColor;
  ctx.fillRect(-3, -24, 6, 48);

  ctx.fillStyle = glassColor;
  ctx.beginPath();
  ctx.roundRect(-8, -18, 16, 14, 4);
  ctx.fill();

  ctx.fillStyle = '#14161c';
  ctx.fillRect(-14, 20, 28, 5);
}

function drawTaxi(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#14161c';
  ctx.fillRect(-16, -18, 7, 14);
  ctx.fillRect(9, -18, 7, 14);
  ctx.fillRect(-16, 6, 7, 14);
  ctx.fillRect(9, 6, 7, 14);

  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.roundRect(-13, -24, 26, 48, 8);
  ctx.fill();

  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#111827' : '#ffffff';
    ctx.fillRect(-13 + i * 6.5, -8, 6.5, 6);
  }

  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.roundRect(-8, -18, 16, 14, 4);
  ctx.fill();

  ctx.fillStyle = '#f97316';
  ctx.fillRect(-4, -22, 8, 4);

  ctx.fillStyle = '#14161c';
  ctx.fillRect(-14, 20, 28, 5);
}

function drawJeep(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#14161c';
  ctx.fillRect(-17, -18, 8, 15);
  ctx.fillRect(9, -18, 8, 15);
  ctx.fillRect(-17, 5, 8, 15);
  ctx.fillRect(9, 5, 8, 15);

  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.roundRect(-14, -24, 28, 50, 4);
  ctx.fill();

  ctx.strokeStyle = '#14161c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, -22);
  ctx.lineTo(-10, -6);
  ctx.moveTo(10, -22);
  ctx.lineTo(10, -6);
  ctx.moveTo(-10, -6);
  ctx.lineTo(10, -6);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-9, -20, 18, 8);

  ctx.fillStyle = '#14161c';
  ctx.beginPath();
  ctx.arc(0, 22, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4b5563';
  ctx.beginPath();
  ctx.arc(0, 22, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawTruck(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#14161c';
  ctx.fillRect(-16, -20, 7, 14);
  ctx.fillRect(9, -20, 7, 14);
  ctx.fillRect(-16, 10, 7, 14);
  ctx.fillRect(9, 10, 7, 14);

  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.roundRect(-13, -26, 26, 22, 6);
  ctx.fill();

  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.roundRect(-9, -22, 18, 10, 3);
  ctx.fill();

  ctx.fillStyle = '#c2410c';
  ctx.fillRect(-13, -2, 26, 26);
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 2;
  ctx.strokeRect(-13, -2, 26, 26);
}

function drawMoto(ctx: CanvasRenderingContext2D) {
  // Tire rims lightened (not pure black) so the thin wheel outlines still
  // read against dark asphalt.
  ctx.fillStyle = '#57534e';
  ctx.beginPath();
  ctx.arc(0, -20, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 22, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.arc(0, -20, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 22, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(0, 18);
  ctx.stroke();

  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.roundRect(-5, -8, 10, 16, 4);
  ctx.fill();

  ctx.fillStyle = '#0ea5e9';
  ctx.beginPath();
  ctx.roundRect(-6, -14, 12, 14, 5);
  ctx.fill();

  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(0, -18, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-9, -14);
  ctx.lineTo(9, -14);
  ctx.stroke();
}

function drawBike(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -18, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 20, 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(-4, 4);
  ctx.lineTo(0, 20);
  ctx.moveTo(-4, 4);
  ctx.lineTo(4, 4);
  ctx.lineTo(0, -18);
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.fillRect(-4, -4, 8, 4);

  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, -16);
  ctx.lineTo(8, -16);
  ctx.stroke();

  ctx.fillStyle = '#f9a8d4';
  ctx.fillRect(-6, -22, 12, 5);
}

function drawTank(ctx: CanvasRenderingContext2D) {
  // Tracks/turret kept on the lighter end of "olive drab" — a truly dark
  // military green would disappear into the asphalt.
  ctx.fillStyle = '#57534e';
  ctx.fillRect(-17, -22, 8, 48);
  ctx.fillRect(9, -22, 8, 48);

  ctx.fillStyle = '#78716c';
  for (let y = -20; y < 24; y += 6) {
    ctx.fillRect(-16, y, 6, 3);
    ctx.fillRect(10, y, 6, 3);
  }

  ctx.fillStyle = '#65a30d';
  ctx.beginPath();
  ctx.roundRect(-10, -18, 20, 40, 4);
  ctx.fill();

  ctx.fillStyle = '#4d7c0f';
  ctx.beginPath();
  ctx.arc(0, -2, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#84cc16';
  ctx.fillRect(-2, -26, 4, 26);
}

function drawUfo(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(168,85,247,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.ellipse(0, -6, 9, 8, 0, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = '#facc15';
  for (const angle of [-0.9, -0.3, 0.3, 0.9]) {
    ctx.beginPath();
    ctx.arc(Math.sin(angle) * 15, Math.cos(angle) * 2 + 4, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawVehicle(ctx: CanvasRenderingContext2D, kind: VehicleKind): void {
  switch (kind) {
    case 'redRacer':
      drawFourWheelBody(ctx, '#ef4444', '#ffcc33', '#1f2937');
      return;
    case 'blueRacer':
      drawFourWheelBody(ctx, '#2563eb', '#e2e8f0', '#0f172a');
      return;
    case 'purpleRacer':
      drawFourWheelBody(ctx, '#9333ea', '#facc15', '#1e1033');
      return;
    case 'yellowTaxi':
      drawTaxi(ctx);
      return;
    case 'greenJeep':
      drawJeep(ctx);
      return;
    case 'orangeTruck':
      drawTruck(ctx);
      return;
    case 'orangeMoto':
      drawMoto(ctx);
      return;
    case 'pinkBike':
      drawBike(ctx);
      return;
    case 'armyTank':
      drawTank(ctx);
      return;
    case 'silverUfo':
      drawUfo(ctx);
      return;
  }
}

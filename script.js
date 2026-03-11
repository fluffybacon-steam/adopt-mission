document.addEventListener("DOMContentLoaded", () => {
  gsap.registerPlugin(Draggable);

  const GRAVITY    = 0.42;
  const BOUNCE     = 0.30;
  const FRICTION   = 0.975;
  const FLOOR_FRIC = 0.85;
  const ROT_FRIC   = 0.90;
  const REST_SPEED = 0.08;

  const section    = document.querySelector('#bones');
  const photoStrip = section && section.querySelector('.photo-strip');
  if (!section || !photoStrip || typeof Draggable === 'undefined') return;

  const W = 92, H = 36;

  const el = document.createElement('div');
  el.className = 'easter-bone';
  el.style.cssText = `width:${W}px;height:${H}px;`;
  section.appendChild(el);

  // ── Cache strip rect once, relative to section ──────────────
  let strip = { left: 0, top: 0, right: 0, bottom: 0 };

  function cacheRects() {
    const sr = section.getBoundingClientRect();
    const r  = photoStrip.getBoundingClientRect();
    strip = {
      left:   r.left   - sr.left,
      top:    r.top    - sr.top,
      right:  r.right  - sr.left,
      bottom: r.bottom - sr.top,
    };
  }
  cacheRects();
  window.addEventListener('resize', () => { cacheRects(); bone.sleeping = false; }, { passive: true });

  // ── Initial state: just above strip center ───────────────────
  const bone = {
    x:    strip.left + (strip.right - strip.left) / 2 - W / 2,
    y:    strip.top - H - 2,
    vx:   (Math.random() - 0.5) * 0.6,
    vy:   0,
    rot:  (Math.random() - 0.5) * 18,
    vrot: (Math.random() - 0.5) * 1.0,
    dragging: false,
    sleeping: false,
  };
  gsap.set(el, { x: bone.x, y: bone.y, rotation: bone.rot, position: 'absolute' });

  // ── Physics: axis-separated strip collision ──────────────────
  // Move X first, resolve X. Then move Y, resolve Y.
  // Using prev position to know which face was entered — no shortest-escape jank.

  function resolveStripX(prevX) {
    if (bone.y + H <= strip.top  || bone.y >= strip.bottom) return; // not at strip height
    if (bone.x + W <= strip.left || bone.x >= strip.right)  return; // no overlap
    if (prevX + W <= strip.left) {                                   // entered from left
      bone.x = strip.left - W;
      bone.vx = -Math.abs(bone.vx) * BOUNCE;
      bone.vrot *= 0.8;
    } else if (prevX >= strip.right) {                               // entered from right
      bone.x = strip.right;
      bone.vx = Math.abs(bone.vx) * BOUNCE;
      bone.vrot *= 0.8;
    }
  }

  function resolveStripY(prevY) {
    if (bone.x + W <= strip.left || bone.x >= strip.right)  return; // not at strip width
    if (bone.y + H <= strip.top  || bone.y >= strip.bottom) return; // no overlap
    if (prevY + H <= strip.top) {                                    // landed on top
      bone.y = strip.top - H;
      bone.vy = -Math.abs(bone.vy) * BOUNCE;
      bone.vx *= FLOOR_FRIC;
      bone.vrot *= 0.72;
      if (Math.abs(bone.vy) < 0.35) bone.vy = 0;
    } else if (prevY >= strip.bottom) {                              // hit underside
      bone.y = strip.bottom;
      bone.vy = Math.abs(bone.vy) * BOUNCE;
    }
  }

  // ── Drag: liveSnap.points constrains position BEFORE GSAP sets it ──
  // This is the key — no fighting between physics and GSAP.
  // We track the constrained prev position so delta direction stays meaningful.
  let prevSnapX = bone.x, prevSnapY = bone.y;
  let grabOffsetX = 0, targetRotDuringDrag = 0;
  let px = 0, py = 0, pt = 0, tvx = 0, tvy = 0;

  Draggable.create(el, {
    type: 'x,y',
    liveSnap: {
      points(point) {
        const dx = point.x - prevSnapX;
        const dy = point.y - prevSnapY;
        let { x, y } = point;

        const overlapH = x + W > strip.left && x < strip.right;
        const overlapV = y + H > strip.top  && y < strip.bottom;

        if (overlapH && overlapV) {
          // Use drag direction to decide which axis to block on
          if (Math.abs(dx) >= Math.abs(dy)) {
            x = dx >= 0 ? strip.left - W : strip.right;
          } else {
            y = dy >= 0 ? strip.top - H : strip.bottom;
          }
        }

        // Track constrained position — keeps delta accurate next frame
        prevSnapX = x;
        prevSnapY = y;
        return { x, y };
      }
    },

    onDragStart(e) {
      bone.dragging = true;
      bone.sleeping = false;
      prevSnapX = this.x;
      prevSnapY = this.y;
      px = this.x; py = this.y; pt = Date.now();
      tvx = 0; tvy = 0;
      gsap.set(el, { zIndex: 99 });

      // Grab-point torque: rotate toward end-heavy tilt based on where you grabbed
      const pointer  = e.touches ? e.touches[0] : e;
      const boneRect = el.getBoundingClientRect();
      const rad      = -bone.rot * (Math.PI / 180);
      const rawDx    = pointer.clientX - (boneRect.left + W / 2);
      const rawDy    = pointer.clientY - (boneRect.top  + H / 2);
      grabOffsetX    = rawDx * Math.cos(rad) - rawDy * Math.sin(rad);
      targetRotDuringDrag = (grabOffsetX / (W * 0.5)) * 28;
    },

    onDrag() {
      bone.x = this.x; // already constrained by liveSnap
      bone.y = this.y;
      const now = Date.now(), dt = Math.max(now - pt, 8);
      tvx = (this.x - px) / dt * 16;
      tvy = (this.y - py) / dt * 16;
      px = this.x; py = this.y; pt = now;

      bone.rot += (targetRotDuringDrag - bone.rot) * 0.10;
      gsap.set(el, { rotation: bone.rot });
    },

    onDragEnd() {
      bone.dragging = false;
      bone.vx   = tvx;
      bone.vy   = tvy;
      bone.vrot = tvx * 0.4 + (Math.random() - 0.5) * 2;
      bone.x    = this.x;
      bone.y    = this.y;
      gsap.set(el, { zIndex: 20 });
    },
  });

  // ── Physics tick ─────────────────────────────────────────────
  function tick() {
    if (!bone.dragging && !bone.sleeping) {
      bone.vy   += GRAVITY;
      bone.vx   *= FRICTION;
      bone.vy   *= FRICTION;
      bone.vrot *= ROT_FRIC;

      const FLOOR = section.offsetHeight;
      const RIGHT = section.offsetWidth;

      // X axis
      const prevX = bone.x;
      bone.x += bone.vx;
      resolveStripX(prevX);

      // Y axis
      const prevY = bone.y;
      bone.y += bone.vy;
      bone.rot += bone.vrot;
      resolveStripY(prevY);

      // Section walls
      if (bone.x < 0)         { bone.x = 0;         bone.vx =  Math.abs(bone.vx) * BOUNCE; }
      if (bone.x + W > RIGHT) { bone.x = RIGHT - W; bone.vx = -Math.abs(bone.vx) * BOUNCE; }
      if (bone.y < 0)         { bone.y = 0;         bone.vy =  Math.abs(bone.vy) * BOUNCE; }
      if (bone.y + H > FLOOR) {
        bone.y  = FLOOR - H;
        bone.vy = -Math.abs(bone.vy) * BOUNCE;
        bone.vx *= FLOOR_FRIC;
        bone.vrot *= 0.7;
        if (Math.abs(bone.vy) < 0.35) bone.vy = 0;
      }

      const speed = Math.abs(bone.vx) + Math.abs(bone.vy) + Math.abs(bone.vrot);
      if (speed < REST_SPEED) {
        bone.sleeping = true;
        bone.vx = bone.vy = bone.vrot = 0;
      }

      gsap.set(el, { x: bone.x, y: bone.y, rotation: bone.rot });
    }
    requestAnimationFrame(tick);
  }

  tick();
});
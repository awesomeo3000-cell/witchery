// Local player: movement (walk, sprint, jump, glide, climb, swim, brush flight),
// camera, combat (strikes, spin, flicks, brush art, lock-on, dodge) and survival.
import * as THREE from 'three';
import { G, COLORS, inDungeonY } from '../core/ctx.js';
import { clamp, damp, dampAngle, angleDiff, lerp } from '../core/math.js';
import { makeCharacter } from './character.js';
import { Ribbon, SwingTrail } from '../combat/trails.js';

const R = 0.4, H = 1.75, STEP = 0.6;
const GRAV = 30;
const WALK = 5.8, SPRINT = 10, AIM_WALK = 3.4;
const JUMP_V = 10;
const RIDE_SPEED = 20, RIDE_BOOST = 36;
const UP = new THREE.Vector3(0, 1, 0);

export class Player {
  constructor(name, look) {
    this.name = name;
    this.look = look;
    this.char = makeCharacter(look);
    G.scene.add(this.char.group);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI; // facing
    this.camYaw = 0;
    this.camPitch = 0.25;
    this.camDist = 6;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.state = 'ground';
    this.grounded = false;
    this.maxHp = 12; // half hearts
    this.hp = 12;
    this.maxStamina = 100;
    this.stamina = 100;
    this.exhausted = false;
    this.staminaDelay = 0;
    this.ink = [100, 100, 100, 100];
    this.color = 0;
    this.attack = null;
    this.combo = 0;
    this.comboTimer = 0;
    this.holdTime = 0;
    this.aiming = false;
    this.aimHold = 0;
    this.streamTimer = 0;
    this.lock = null;
    this.invuln = 0;
    this.hurtFlash = 0;
    this.dodgeT = 0;
    this.deadT = 0;
    this.checkpoint = new THREE.Vector3();
    this.lastSafe = new THREE.Vector3();
    this.safeTimer = 0;
    this.climb = null;
    this.speed = 0;
    this.ridePitch = 0;
    this.rideRoll = 0;
    this.healTimer = 0;
    this.airTime = 0;
    this.touched = [];
    this.interactTarget = null;
    this.cameraShake = 0;
    this.aimPoint = new THREE.Vector3();
    this.char.setBrushColor(COLORS[0].hex);
    this.rideTrail = new Ribbon(G.scene, { width: 0.7, life: 0.85 });
    this.swingTrail = new SwingTrail(G.scene);
    this.attackBuffer = 0;
    this.bonusHp = 0; // golden half-hearts from Prism Tonic
    this.buffs = { power: 0, ink: 0, swift: 0 };
    this._tip = new THREE.Vector3();
    this._base = new THREE.Vector3();
  }

  spawn(p) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.checkpoint.copy(p);
    this.lastSafe.copy(p);
    this.state = 'ground';
    this.camPos.copy(p).add(new THREE.Vector3(0, 3, 6));
  }

  get inDungeon() { return inDungeonY(this.pos.y); }
  get alive() { return this.state !== 'dead'; }

  fwd(out = new THREE.Vector3()) { return out.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)); }
  right(out = new THREE.Vector3()) { return out.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw)); }

  setColor(i) {
    if (i === this.color) return;
    this.color = i;
    this.char.setBrushColor(COLORS[i].hex);
    G.hud.setColor(i);
    G.audio.play('flick', 0.5);
  }

  useStamina(a) {
    if (this.exhausted) return false;
    this.stamina -= this.buffs.swift > 0 ? a * 0.5 : a;
    this.staminaDelay = 0.8;
    if (this.stamina <= 0) {
      this.stamina = 0;
      this.exhausted = true;
    }
    return true;
  }

  applyBuff(key) {
    if (key === 'tonic') this.bonusHp = 6;
    else this.buffs[key] = 120;
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  takeDamage(n, from, opts = {}) {
    if (this.alive && this.dodgeT > 0 && from && !(G.flurry > 0)) { this.triggerFlurry(); return false; }
    if (!this.alive || this.invuln > 0 || G.godMode) return false;
    const absorbed = Math.min(this.bonusHp, n);
    this.bonusHp -= absorbed;
    this.hp -= n - absorbed;
    this.invuln = 0.9;
    this.hurtFlash = 0.35;
    this.cameraShake = 0.35;
    G.audio.play('hurt');
    G.hud.flash('rgba(255,40,40,0.35)');
    if (from) {
      const d = this.pos.clone().sub(from).setY(0).normalize();
      const kb = opts.knockback ?? 9;
      if (this.state !== 'ride') {
        this.vel.x = d.x * kb; this.vel.z = d.z * kb; this.vel.y = Math.max(this.vel.y, 5);
        if (this.state === 'ground') this.state = 'air';
      }
    }
    if (opts.element === 'fire') G.particles.flames(this.pos, 0.5, 6);
    if (opts.element === 'ice') G.particles.burst(this.pos.clone().setY(this.pos.y + 1), { count: 12, color: 0xcdefff, speed: 3 });
    if (this.hp <= 0) this.die();
    return true;
  }

  // Dodging an attack at the last moment slows the world down (Flurry Rush)
  triggerFlurry() {
    G.flurry = 2.4;
    this.invuln = Math.max(this.invuln, 0.8);
    G.audio.play('flurry');
    G.hud.toast('Flurry Rush!', '#bfe8ff', 1.5);
    G.particles.burst(this.pos.clone().setY(this.pos.y + 1), { count: 40, color: 0xbfe8ff, speed: 8, life: 0.6, size: 0.5, pool: 'glow', gravity: 0 });
  }

  die() {
    this.hp = 0;
    this.state = 'dead';
    this.deadT = 3.5;
    this.attack = null;
    this.lock = null;
    G.hud.toast('You fainted...', '#ffb0b0');
    G.net?.send({ t: 'fx', k: 'down', p: this.pos.toArray() });
  }

  respawn() {
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.exhausted = false;
    this.pos.copy(this.checkpoint);
    this.vel.set(0, 0, 0);
    this.state = 'air';
    this.invuln = 2;
    G.hud.toast('Back on your feet!', '#ffffff');
  }

  hazardRespawn(dmg, msg) {
    if (msg) G.hud.toast(msg, '#bfe8ff');
    this.pos.copy(this.lastSafe).add(new THREE.Vector3(0, 0.5, 0));
    this.vel.set(0, 0, 0);
    this.state = 'air';
    this.invuln = 0;
    this.takeDamage(dmg, null);
    this.invuln = 1.2;
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const inp = G.input;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    for (const k in this.buffs) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    this.cameraShake = Math.max(0, this.cameraShake - dt);
    this.char.setHurt(this.hurtFlash > 0 ? this.hurtFlash * 2 : 0);

    // Camera look
    // Mouse steers the colour wheel instead of the camera while Tab is held
    const sens = inp.down('Tab') ? 0 : 0.0023 * G.settings.sensitivity * (this.aiming ? 0.6 : 1);
    this.camYaw -= inp.mouse.dx * sens;
    this.camPitch += inp.mouse.dy * sens * (G.settings.invertY ? -1 : 1);
    this.camPitch = clamp(this.camPitch, -1.2, 1.35);
    if (inp.mouse.wheel && !this.aiming) this.camDist = clamp(this.camDist + inp.mouse.wheel * 0.8, 3, 14);

    if (this.state === 'dead') {
      this.deadT -= dt;
      this.vel.x = damp(this.vel.x, 0, 5, dt);
      this.vel.z = damp(this.vel.z, 0, 5, dt);
      this._physics(dt, true);
      if (this.deadT <= 0) this.respawn();
      this._animate(dt);
      return;
    }

    this._handleColors(inp);
    this._handleLock(inp);
    this._handleInteract(inp);

    if (inp.hit('KeyR')) this._toggleRide();

    switch (this.state) {
      case 'ride': this._updateRide(dt, inp); break;
      case 'climb': this._updateClimb(dt, inp); break;
      case 'swim': this._updateSwim(dt, inp); break;
      default: this._updateWalk(dt, inp); break;
    }

    this._updateCombat(dt, inp);
    this._updateStamina(dt);
    this._updateInk(dt);
    this._environment(dt);
    this._animate(dt);
  }

  _handleColors(inp) {
    for (let i = 0; i < 4; i++) if (inp.hit(`Digit${i + 1}`)) this.setColor(i);
    if (inp.hit('KeyE')) this.setColor((this.color + 1) % 4);
    if (inp.mouse.wheel && this.aiming) this.setColor((this.color + (inp.mouse.wheel > 0 ? 1 : 3)) % 4);
    if (inp.hit('Tab')) G.hud.openWheel(this.color);
    if (inp.down('Tab')) G.hud.wheelMove(inp.mouse.dx, inp.mouse.dy);
    if (inp.released.has('Tab')) {
      const c = G.hud.closeWheel();
      if (c !== null) this.setColor(c);
    }
  }

  _handleLock(inp) {
    if (inp.hit('KeyQ') || inp.btnDown(1)) {
      if (this.lock) this.lock = null;
      else {
        const f = this.fwd();
        this.lock = G.enemies.findLockTarget(this.pos, f, 32);
        if (!this.lock) G.hud.toast('No target nearby', '#dddddd', 1);
      }
    }
    if (this.lock && (!this.lock.alive || this.lock.pos.distanceTo(this.pos) > 45)) this.lock = null;
  }

  _handleInteract(inp) {
    let best = null, bd = Infinity;
    if (G.world) {
      for (const it of G.world.interactables.concat(G.trials?.interactables || [])) {
        if (it.enabled && !it.enabled()) continue;
        const d = it.pos.distanceTo(this.pos);
        if (d < it.radius && d < bd) { best = it; bd = d; }
      }
    }
    this.interactTarget = best;
    inp.contextA = !!best;
    G.hud.setPrompt(best ? (typeof best.prompt === 'function' ? best.prompt() : best.prompt) : null);
    if (best && inp.hit('KeyF')) best.action(this);
  }

  _toggleRide() {
    if (this.state === 'ride') {
      this.state = 'air';
      G.audio.play('glide');
      return;
    }
    if (this.inDungeon) { G.hud.toast('The trial\'s magic grounds your brush.', '#dddddd', 1.5); return; }
    if (this.exhausted || this.stamina < 8) { G.hud.toast('Too tired to fly!', '#ffcf8a', 1.2); return; }
    if (this.state === 'swim') this.pos.y += 1;
    this.state = 'ride';
    this.attack = null;
    this.aiming = false;
    this.vel.y = Math.max(this.vel.y, 6);
    G.audio.play('ride');
    G.particles.burst(this.pos.clone().setY(this.pos.y + 0.6), { count: 30, color: COLORS[this.color].hex, speed: 5, life: 0.7, size: 0.5, pool: 'glow' });
  }

  _moveInput(inp) {
    const a = inp.axis();
    const f = this.fwd(), r = this.right();
    return new THREE.Vector3().addScaledVector(f, a.z).addScaledVector(r, a.x);
  }

  _updateWalk(dt, inp) {
    const move = this._moveInput(inp);
    const moving = move.lengthSq() > 0.01;
    const grounded = this.state === 'ground';
    const sprint = inp.down('ShiftLeft') || inp.down('ShiftRight');
    let speed = this.aiming ? AIM_WALK : WALK;
    if (sprint && moving && grounded && !this.aiming && !this.exhausted && !this.lock) {
      speed = SPRINT;
      this.useStamina(14 * dt);
    }
    if (this.exhausted) speed *= 0.6;
    if (this.buffs.swift > 0) speed *= 1.25;
    if (this.attack && this.attack.kind !== 'spin') speed *= 0.3;

    // Dodge (locked-on)
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      if (this.dodgeT <= 0) this.state = grounded ? 'ground' : 'air';
    } else if (this.lock && grounded && inp.hit('Space')) {
      const dir = moving ? move.clone().normalize() : this.pos.clone().sub(this.lock.pos).setY(0).normalize();
      this.vel.x = dir.x * 15; this.vel.z = dir.z * 15;
      this.vel.y = 3;
      this.dodgeT = 0.38;
      this.invuln = Math.max(this.invuln, 0.4);
      this.state = 'air';
      this.dodging = true;
      G.audio.play('swing', 0.6);
    }

    const icy = this._onIce;
    const accel = grounded ? (icy ? 2.5 : 14) : 4;
    const target = move.multiplyScalar(speed);
    const lunging = this.attack && this.attack.kind !== 'spin' && this.attack.t < 0.4;
    if (this.dodgeT <= 0 && !lunging) {
      this.vel.x = damp(this.vel.x, target.x, accel, dt);
      this.vel.z = damp(this.vel.z, target.z, accel, dt);
    } else if (lunging && grounded) {
      this.vel.x = damp(this.vel.x, 0, 5, dt);
      this.vel.z = damp(this.vel.z, 0, 5, dt);
    }

    // Facing
    if (this.lock) {
      const d = this.lock.pos.clone().sub(this.pos);
      this.yaw = dampAngle(this.yaw, Math.atan2(d.x, d.z), 14, dt);
    } else if (this.aiming) {
      this.yaw = dampAngle(this.yaw, this.camYaw + Math.PI, 20, dt);
    } else if (moving && !this.attack) {
      this.yaw = dampAngle(this.yaw, Math.atan2(target.x, target.z), 12, dt);
    }

    // Jump / glide
    if (inp.hit('Space') && !this.lock) {
      if (grounded) {
        this.vel.y = JUMP_V;
        this.state = 'air';
        this.airTime = 0;
        G.audio.play('jump');
      } else if (this.state === 'glide') {
        this.state = 'air';
      } else if (this.state === 'air' && !this.exhausted && this.airTime > 0.15) {
        this.state = 'glide';
        G.audio.play('glide');
      }
    }
    if (this.state === 'glide') {
      if (this.exhausted) this.state = 'air';
      this.useStamina(3.5 * dt);
      const gs = sprint ? 13 : 9;
      const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const want = moving ? target.clone().setLength(gs) : f.multiplyScalar(gs * 0.7);
      this.vel.x = damp(this.vel.x, want.x, 2.2, dt);
      this.vel.z = damp(this.vel.z, want.z, 2.2, dt);
      if (moving) this.yaw = dampAngle(this.yaw, Math.atan2(want.x, want.z), 4, dt);
      const lift = this._updraftLift();
      if (lift > 0) this.vel.y = Math.min(this.vel.y + lift * dt, 15);
      else this.vel.y = Math.max(this.vel.y - 20 * dt, -2.6);
    }

    // Climb
    const c = G.collision.climbableAt(this.pos, R, H);
    if (c && moving && this.dodgeT <= 0) {
      const into = -(move.x * c.normal.x + move.z * c.normal.z) / Math.max(0.01, Math.hypot(move.x, move.z));
      if (into > 0.5) {
        this.state = 'climb';
        this.climb = c;
        this.vel.set(0, 0, 0);
        this.yaw = Math.atan2(-c.normal.x, -c.normal.z);
        return;
      }
    }

    this._physics(dt);
  }

  _updraftLift() {
    if (!G.world) return 0;
    for (const u of G.world.updrafts) {
      const d = Math.hypot(this.pos.x - u.x, this.pos.z - u.z);
      if (d < u.r + 2 && this.pos.y < u.y1 && this.pos.y > u.y0 - 5) return 55;
    }
    return 0;
  }

  _updateClimb(dt, inp) {
    const c = this.climb;
    if (!c || !c.active) { this.state = 'air'; this.climb = null; return; }
    const a = inp.axis();
    const tangent = new THREE.Vector3(-c.normal.z, 0, c.normal.x);
    // Screen-relative sideways: flip tangent if facing reversed relative to camera
    const camRight = this.right();
    const side = tangent.dot(camRight) >= 0 ? 1 : -1;
    this.pos.y += a.z * 4.2 * dt;
    this.pos.addScaledVector(tangent, a.x * side * 3 * dt);
    this.speed = Math.hypot(a.x, a.z) * 2;
    this.pos.x = clamp(this.pos.x, c.min.x - R, c.max.x + R);
    this.pos.z = clamp(this.pos.z, c.min.z - R, c.max.z + R);
    this.yaw = Math.atan2(-c.normal.x, -c.normal.z);
    // Mantle onto the top
    if (this.pos.y + 0.6 >= c.top) {
      this.pos.addScaledVector(c.normal, -1.1);
      this.pos.y = c.top + 0.05;
      this.state = 'ground';
      this.climb = null;
      this.vel.set(0, 0, 0);
      G.audio.play('jump', 0.5);
      return;
    }
    const g = G.collision.groundAt(this.pos.x, this.pos.z, R, this.pos.y + 0.1);
    if (this.pos.y < g.y) { this.pos.y = g.y; if (a.z < 0) { this.state = 'ground'; this.climb = null; } }
    if (inp.hit('Space')) {
      this.state = 'air';
      this.vel.copy(c.normal).multiplyScalar(6);
      this.vel.y = 7;
      this.climb = null;
      this.yaw += Math.PI;
    }
    if (!G.collision.climbableAt(this.pos, R + 0.3, H)) { this.state = 'air'; this.climb = null; }
  }

  _updateSwim(dt, inp) {
    const move = this._moveInput(inp);
    const moving = move.lengthSq() > 0.01;
    let sp = 3.6;
    if ((inp.down('ShiftLeft') || inp.down('Space')) && moving && !this.exhausted) {
      sp = 6.5;
      this.useStamina(16 * dt);
    }
    this.vel.x = damp(this.vel.x, move.x * sp, 4, dt);
    this.vel.z = damp(this.vel.z, move.z * sp, 4, dt);
    if (moving) this.yaw = dampAngle(this.yaw, Math.atan2(move.x, move.z), 8, dt);
    const w = G.collision.waterAt(this.pos.x, this.pos.y, this.pos.z);
    const level = w ? w.level : this.pos.y;
    this.vel.y = damp(this.vel.y, (level - 1.25 - this.pos.y) * 5, 6, dt);
    if (this.exhausted && this.stamina <= 0.01 && moving) {
      // Too tired: sink a bit but don't drown - keeps it friendly
      this.vel.y -= 1;
    }
    this._physics(dt);
  }

  _updateRide(dt, inp) {
    if (this.inDungeon) { this.state = 'air'; return; }
    const boost = (inp.down('ShiftLeft') || inp.down('ShiftRight')) && !this.exhausted;
    if (!this.useStamina((boost ? 9 : 2.2) * dt) || this.exhausted) {
      this.state = 'glide';
      G.hud.toast('Out of stamina!', '#ffcf8a', 1.2);
      return;
    }
    const a = inp.axis();
    const fwd3 = new THREE.Vector3(-Math.sin(this.camYaw) * Math.cos(this.camPitch), -Math.sin(this.camPitch), -Math.cos(this.camYaw) * Math.cos(this.camPitch));
    const r = this.right();
    let target = new THREE.Vector3();
    const cruise = boost ? RIDE_BOOST : RIDE_SPEED;
    if (a.z > 0) target.addScaledVector(fwd3, cruise * a.z);
    else if (a.z < 0) target.addScaledVector(fwd3, 6 * a.z);
    target.addScaledVector(r, a.x * 10);
    if (inp.down('Space')) target.y += 11;
    if (inp.down('KeyC')) target.y -= 11;
    const lift = this._updraftLift();
    if (lift) target.y += 10;
    // Gentle hover when idle
    if (target.lengthSq() < 0.01) target.y = Math.sin(G.time * 2) * 0.4;
    this.vel.lerp(target, 1 - Math.exp(-2.8 * dt));
    const hv = Math.hypot(this.vel.x, this.vel.z);
    if (hv > 0.5) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 6, dt);
    this.ridePitch = damp(this.ridePitch, clamp(-this.vel.y / 20, -0.6, 0.6), 5, dt);
    this.rideRoll = damp(this.rideRoll, clamp(a.x * 0.8 + angleDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * 0.5, -0.9, 0.9), 5, dt);
    // Paint trail
    if (Math.random() < dt * 40) {
      const back = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const p = this.pos.clone().addScaledVector(back, 1.6).setY(this.pos.y + 0.6);
      G.particles.burst(p, { count: 1, color: COLORS[this.color].hex, speed: 0.6, life: 1.2, size: boost ? 0.7 : 0.45, gravity: 1, pool: 'glow', alpha: 0.8 });
    }
    this._physics(dt, false, true);
  }

  _physics(dt, dead = false, flying = false) {
    const wasGrounded = this.state === 'ground';
    const vyBefore = this.vel.y;
    if (!flying && this.state !== 'swim' && this.state !== 'climb') this.vel.y -= GRAV * dt;
    if (this.vel.y < -55) this.vel.y = -55;

    // Horizontal move with sub-steps for fast flight
    const steps = Math.max(1, Math.ceil((Math.hypot(this.vel.x, this.vel.z) * dt) / 0.35));
    for (let i = 0; i < steps; i++) {
      this.pos.x += (this.vel.x * dt) / steps;
      this.pos.z += (this.vel.z * dt) / steps;
      G.collision.resolveHorizontal(this.pos, R, H, STEP, this.touched);
    }
    // Don't walk through enemies (bosses especially)
    if (!dead) {
      for (const e of G.enemies.list) {
        if (!e.alive) continue;
        const dx = this.pos.x - e.pos.x, dz = this.pos.z - e.pos.z;
        const rr = R + e.radius * 0.75;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr || this.pos.y > e.pos.y + e.height * 0.8 || this.pos.y + H < e.pos.y) continue;
        const d = Math.sqrt(d2) || 0.01;
        this.pos.x = e.pos.x + (dx / d) * rr;
        this.pos.z = e.pos.z + (dz / d) * rr;
      }
    }
    // Vertical
    this.pos.y += this.vel.y * dt;
    const ceil = G.collision.ceilingAt(this.pos.x, this.pos.z, R * 0.7, this.pos.y + H);
    if (this.pos.y + H > ceil && this.vel.y > 0) {
      this.pos.y = ceil - H;
      this.vel.y = 0;
    }
    const g = G.collision.groundAt(this.pos.x, this.pos.z, R, this.pos.y + STEP);
    this.groundObj = g.obj;
    if (this.pos.y <= g.y + 0.001) {
      const impact = -vyBefore;
      this.pos.y = g.y;
      if (this.vel.y < 0) this.vel.y = 0;
      if (flying) {
        // skim the ground
      } else if (this.state !== 'swim' && !dead) {
        if (!wasGrounded) this._land(impact);
        if (this.state !== 'air' || this.vel.y <= 0) this.state = 'ground';
        if (this.dodgeT > 0) this.state = 'air';
      }
    } else if (this.state === 'ground' && !dead) {
      // Snap down small steps / slopes when walking
      if (this.pos.y - g.y < 0.45 && this.vel.y <= 0) this.pos.y = g.y;
      else { this.state = 'air'; this.airTime = 0; }
    }
    if (this.state === 'air' || this.state === 'glide') this.airTime += dt;

    // Water
    if (!flying && !dead) {
      const w = G.collision.waterAt(this.pos.x, this.pos.y, this.pos.z);
      if (w && this.pos.y < w.level - 1.1) {
        if (w.cold) { this.hazardRespawn(2, 'Brrr! The water is freezing!'); return; }
        if (this.state !== 'swim') {
          this.state = 'swim';
          G.particles.burst(this.pos.clone().setY(w.level), { count: 20, color: 0xffffff, speed: 4, up: 3, life: 0.6, size: 0.4 });
          G.audio.play('splat', 0.6);
        }
      } else if (this.state === 'swim' && (!w || this.pos.y > w.level - 0.9)) {
        this.state = this.pos.y <= g.y + 0.05 ? 'ground' : 'air';
      }
    }
    // Fell out of the world
    if (this.pos.y < (this.inDungeon ? this.lastSafe.y - 40 : -80)) this.hazardRespawn(2, 'You fell...');
  }

  _land(impact) {
    // Bounce pads
    const pads = G.paint.splatsNear(this.pos, 0.3).filter((s) => s.pad);
    if (pads.length) {
      this.vel.y = 25;
      this.state = 'air';
      this.airTime = 0.2;
      pads[0].squash = 1;
      G.audio.play('bounce');
      G.particles.burst(this.pos, { count: 16, color: 0xf2c229, speed: 5, life: 0.5, size: 0.4, pool: 'glow' });
      return;
    }
    if (impact > 27) {
      const dmg = Math.min(8, 2 + Math.floor((impact - 27) / 5) * 2);
      this.takeDamage(dmg, null);
      G.hud.toast('Ouch! Use your glider (Space) when falling.', '#ffb0b0', 2);
    }
    if (impact > 6) {
      G.audio.play('land', Math.min(1, impact / 20));
      G.particles.burst(this.pos, { count: 6, color: 0xd8d0c0, speed: 2, life: 0.5, size: 0.5, gravity: 2 });
    }
  }

  _updateCombat(dt, inp) {
    if (this.state === 'ride' || this.state === 'climb' || this.state === 'swim') {
      this.aiming = false;
      this.attack = null;
      G.hud.showCrosshair(false);
      return;
    }
    this.aiming = inp.btn(2);
    G.hud.showCrosshair(this.aiming);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;

    // Aim point from the screen centre
    if (this.aiming) {
      const origin = G.camera.position.clone();
      const dir = new THREE.Vector3();
      G.camera.getWorldDirection(dir);
      const hit = G.collision.raycast(origin, dir, 140, { water: true });
      const eHit = G.enemies.rayHit(origin, dir, hit ? hit.dist : 140, 0.6);
      if (eHit) this.aimPoint.copy(eHit.pos).setY(eHit.pos.y + eHit.height * 0.5);
      else this.aimPoint.copy(hit ? hit.point : origin.addScaledVector(dir, 140));
    }

    if (this.aiming) {
      if (inp.btnDown(0)) { this.aimHold = 0; this.streamTimer = 0; }
      if (inp.btn(0)) {
        this.aimHold += dt;
        if (this.aimHold > 0.22) {
          this.streamTimer -= dt;
          if (this.streamTimer <= 0 && this.ink[this.color] >= 2) {
            this.streamTimer = 0.085;
            this.ink[this.color] -= 2.2;
            this._flick(true);
          }
        }
      }
      if (inp.btnUp(0) && this.aimHold <= 0.22) {
        if (this.ink[this.color] >= 8) {
          this.ink[this.color] -= 8;
          this._flick(false);
        } else {
          G.hud.toast(`Out of ${COLORS[this.color].name} ink!`, COLORS[this.color].light, 1);
          G.hud.inkShake(this.color);
        }
      }
      this.painting = inp.btn(0) && this.aimHold > 0.22;
      return;
    }
    this.painting = false;

    // Melee: inputs are buffered so combos chain smoothly; late recovery can be cancelled by moving
    if (inp.btnDown(0)) { this.holdTime = 0; this.attackBuffer = 0.35; }
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    const grounded = this.state === 'ground';
    const aNow = this.attack;
    if (this.attackBuffer > 0 && (!aNow || (aNow.kind !== 'spin' && aNow.kind !== 'plunge' && aNow.t > 0.42))) {
      this.attackBuffer = 0;
      const g = G.collision.groundAt(this.pos.x, this.pos.z, R, this.pos.y);
      if ((this.state === 'air' || this.state === 'glide') && this.pos.y - g.y > 1.8) this._startPlunge();
      else this._startSwing();
    }
    if (inp.btn(0) && grounded) {
      this.holdTime += dt;
      if (this.holdTime > 0.4 && (!this.attack || (this.attack.kind !== 'spin' && this.attack.kind !== 'plunge')) && !this.exhausted) {
        if (this.useStamina(18)) {
          this.attack = { kind: 'spin', t: 0, dur: 1.0, tick: 0, hit: new Set() };
          G.audio.play('spin');
        }
      }
    }
    if (this.attack) {
      const a = this.attack;
      const speed = G.flurry > 0 ? 1.7 : 1;
      a.t += (dt * speed) / a.dur;
      if (a.kind === 'spin') {
        this.yaw += dt * 16;
        a.tick -= dt;
        if (a.tick <= 0) {
          a.tick = 0.2;
          a.hit.clear();
          this._meleeHits(3.9, Math.PI, 8, a);
          G.particles.burst(this.pos.clone().setY(this.pos.y + 1), { count: 18, color: COLORS[this.color].hex, speed: 7, life: 0.35, size: 0.4, spread: 0.2, pool: 'glow', gravity: 0 });
        }
        if (!inp.btn(0) && a.t > 0.35) a.t = Math.max(a.t, 0.9);
      } else if (a.kind === 'plunge') {
        this.vel.x *= 0.9; this.vel.z *= 0.9;
        this.vel.y = -34;
        if (this.state === 'ground' || this.state === 'swim') {
          this._plungeImpact();
          this.attack = null;
          return;
        }
        a.t = Math.min(a.t, 0.5);
      } else {
        if (!a.done && a.t > 0.3) {
          a.done = true;
          const reach = a.kind === 2 ? 3.7 : 3.4;
          this._meleeHits(reach, 1.25, a.kind === 2 ? 13 : 9, a);
          this._swingPaint(a.kind);
        }
        // Recovery cancel: moving out of the tail of a swing feels snappier
        if (a.t > 0.72) {
          const ax = inp.axis();
          if (ax.x || ax.z) this.attack = null;
        }
      }
      if (this.attack && this.attack.t >= 1) this.attack = null;
    }
  }

  _startPlunge() {
    this.attack = { kind: 'plunge', t: 0, dur: 1, hit: new Set() };
    this.state = 'air';
    this.vel.y = 4;
    G.audio.play('swing', 0.8);
  }

  _plungeImpact() {
    const a = { hit: new Set() };
    this._meleeHits(4.2, Math.PI, 15, a);
    G.enemies.fx('slam', this.pos);
    this.cameraShake = 0.35;
    G.hitStop = Math.max(G.hitStop, 0.08);
    const n = UP.clone();
    const g = G.collision.groundAt(this.pos.x, this.pos.z, R, this.pos.y + 0.5);
    if (this.ink[this.color] >= 6) {
      this.ink[this.color] -= 6;
      G.paint.paintAt(this.pos.clone().setY(g.y), g.obj ? n : G.terrain.normalAt(this.pos.x, this.pos.z), this.color, g.obj ? 'box' : 'terrain', { radius: 2.4 });
    }
    G.particles.burst(this.pos.clone().setY(this.pos.y + 0.3), { count: 40, color: COLORS[this.color].hex, speed: 10, life: 0.5, size: 0.5, spread: 0.15, pool: 'glow', gravity: 4 });
  }

  _startSwing() {
    const kind = this.combo % 3;
    this.combo++;
    this.comboTimer = 0.9;
    this.attack = { kind, t: 0, dur: kind === 2 ? 0.5 : 0.36, hit: new Set() };
    G.audio.play('swing');
    // Face the input direction (camera-relative), then snap to a nearby enemy in that cone
    const move = this._moveInput(G.input);
    if (move.lengthSq() > 0.01 && !this.lock) this.yaw = Math.atan2(move.x, move.z);
    let target = this.lock;
    if (!target) target = G.enemies.findLockTarget(this.pos, new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 6.5);
    let lunge = 3;
    if (target) {
      const d = target.pos.clone().sub(this.pos);
      d.y = 0;
      this.yaw = Math.atan2(d.x, d.z);
      const gap = d.length() - target.radius - 1.6;
      if (gap > 0.3) lunge = Math.min(11, 3 + gap * 3.5); // close the distance
    }
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (this.state === 'ground') { this.vel.x = f.x * lunge; this.vel.z = f.z * lunge; }
  }

  _meleeHits(reach, arc, dmg, a) {
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const useInk = this.ink[this.color] >= 3;
    const el = useInk ? COLORS[this.color].element : null;
    let any = false;
    for (const e of G.enemies.list) {
      if (!e.alive || a.hit.has(e.id)) continue;
      const d = e.pos.clone().sub(this.pos);
      const dy = d.y;
      d.y = 0;
      const dist = d.length() - e.radius;
      if (dist > reach || dy > 3 + e.height || dy < -2.5) continue;
      if (arc < Math.PI && d.normalize().dot(f) < Math.cos(arc)) continue;
      a.hit.add(e.id);
      any = true;
      const bonus = (G.flurry > 0 ? 1.5 : 1) * (this.buffs.power > 0 ? 1.5 : 1) * (G.flags.charm_power ? 1.15 : 1);
      G.enemies.localHit(e, { dmg: Math.round(dmg * bonus), element: el, dir: d.clone().normalize(), source: 'melee', hy: this.pos.y + 1.3 });
      // Ink splatter flies off in the direction of the blow
      const hp = e.pos.clone().setY(e.pos.y + e.height * 0.5);
      G.particles.burst(hp, { count: 16, color: COLORS[this.color].hex, speed: 9, life: 0.45, size: 0.35, dir: d.clone().normalize().multiplyScalar(6), gravity: 12 });
      G.particles.burst(hp, { count: 1, color: COLORS[this.color].light, speed: 0, life: 0.1, size: 1.3, pool: 'glow', gravity: 0, alpha: 0.7 });
    }
    if (any) {
      if (useInk) this.ink[this.color] -= 3;
      this.cameraShake = Math.max(this.cameraShake, 0.16);
      G.hitStop = Math.max(G.hitStop, 0.065 + dmg * 0.002);
    }
    // Poke paint-reactive objects & ink flowers
    const tip = this.pos.clone().addScaledVector(f, 1.8).setY(this.pos.y + 1);
    for (const r of G.world.reactives) {
      if (!r.active) continue;
      if (r.pos.distanceTo(tip) < (r.radius || 2) + 1.2 && r.melee !== false) r.onPaint(el || 'none', tip, null);
    }
    this._checkFlowers(tip, 2.5);
  }

  _swingPaint(kind) {
    if (this.ink[this.color] < 3 || this.state !== 'ground') return;
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const p = this.pos.clone().addScaledVector(f, 1.8);
    const g = G.collision.groundAt(p.x, p.z, 0.2, this.pos.y + 1.5);
    if (g.y === -Infinity || Math.abs(g.y - this.pos.y) > 1.5) return;
    this.ink[this.color] -= 2;
    p.y = g.y;
    const n = g.obj ? UP.clone() : G.terrain.normalAt(p.x, p.z);
    G.paint.paintAt(p, n, this.color, g.obj ? 'box' : 'terrain', { radius: kind === 2 ? 1.4 : 1.0, loud: false });
  }

  _flick(small) {
    const tip = new THREE.Vector3();
    this.char.brushTip.getWorldPosition(tip);
    const from = this.pos.clone().setY(this.pos.y + 1.4).lerp(tip, 0.5);
    const to = this.aimPoint.clone();
    const dist = from.distanceTo(to);
    const speed = small ? 30 : 36;
    const t = dist / speed;
    const vel = to.clone().sub(from).normalize().multiplyScalar(speed);
    vel.y += 0.5 * 16 * t; // gravity compensation
    G.paint.throwGlob(from, vel, this.color, 'local', { small });
    G.net?.send({ t: 'glob', p: from.toArray().map((v) => +v.toFixed(2)), v: vel.toArray().map((v) => +v.toFixed(2)), c: this.color, s: small ? 1 : 0 });
    if (!small) G.audio.play('flick');
  }

  _checkFlowers(p, r) {
    for (const f of G.world.inkFlowers) {
      if (f.regrow > 0 || f.pos.distanceTo(p) > r) continue;
      f.regrow = 45;
      this.ink[f.color] = 100;
      G.audio.play('pickup');
      G.particles.burst(f.pos, { count: 25, color: COLORS[f.color].hex, speed: 5, life: 0.8, size: 0.45, pool: 'glow', up: 2 });
      G.hud.toast(`${COLORS[f.color].name} ink refilled!`, COLORS[f.color].light, 1.2);
      G.hud.inkShake(f.color);
    }
  }

  _updateStamina(dt) {
    this.staminaDelay -= dt;
    const resting = this.state === 'ground' || this.state === 'climb' || (this.state === 'swim' && !G.input.down('ShiftLeft'));
    if (this.staminaDelay <= 0 && resting) {
      this.stamina = Math.min(this.maxStamina, this.stamina + (this.exhausted ? 22 : 34) * dt);
    }
    if (this.exhausted && this.stamina >= this.maxStamina * 0.35) this.exhausted = false;
  }

  _updateInk(dt) {
    const regen = this.buffs.ink > 0 ? 14 : G.flags.charm_ink ? 3.75 : 2.5;
    for (let i = 0; i < 4; i++) this.ink[i] = Math.min(100, this.ink[i] + dt * (i === this.color && this.painting && regen < 5 ? 0 : regen));
  }

  _environment(dt) {
    // Standing effects from paint
    this._onIce = false;
    if (this.state === 'ground') {
      const near = G.paint.splatsNear(this.pos, 0);
      for (const s of near) {
        if (s.pad && this.state === 'ground') { this._land(0); break; }
        if (s.element === 'ice') this._onIce = true;
        if (s.hostile && s.element === 'fire' && this.invuln <= 0) this.takeDamage(1, null, { element: 'fire' });
        if (s.element === 'vine') {
          this.healTimer -= dt;
          if (this.healTimer <= 0 && this.hp < this.maxHp) {
            this.healTimer = 2.5;
            this.heal(1);
            G.particles.burst(this.pos.clone().setY(this.pos.y + 1), { count: 8, color: 0x8cf08c, speed: 1.5, up: 2, life: 0.8, size: 0.3, pool: 'glow', gravity: -1 });
          }
        }
      }
      this.safeTimer -= dt;
      if (this.safeTimer <= 0 && !this.groundObj?.tags?.has('floe') && !this.groundObj?.tags?.has('hazard')) {
        this.safeTimer = 0.5;
        this.lastSafe.copy(this.pos);
      }
    }
    // Lava
    for (const l of G.world.lavaZones) {
      if (Math.hypot(this.pos.x - l.x, this.pos.z - l.z) < l.r && this.pos.y < l.y + 0.3 && this.state !== 'ride') {
        G.particles.flames(this.pos, 0.6, 10);
        this.hazardRespawn(4, 'Lava! That was hot!');
        return;
      }
    }
    // Ink flowers by touch
    this._checkFlowers(this.pos.clone().setY(this.pos.y + 0.8), 1.3);
    // Citadel barrier
    const b = G.world.barrier;
    if (b && b.active) {
      const d = this.pos.clone().setY(this.pos.y + 1).sub(b.center);
      const len = d.length();
      if (len < b.radius + 1 && len > b.radius - 25) {
        d.normalize();
        this.pos.copy(b.center).addScaledVector(d, b.radius + 1.2).setY(this.pos.y + 0);
        this.vel.copy(d).multiplyScalar(14);
        if (!this._barrierMsg || G.time - this._barrierMsg > 3) {
          this._barrierMsg = G.time;
          const n = G.trials ? G.trials.shardCount() : 0;
          G.hud.toast(`A prismatic barrier repels you. (${n}/4 Prism Shards)`, '#e0c8ff', 2.5);
          G.audio.play('shield');
        }
      }
    }
    // Pickups
    G.enemies.collectPickups(this);
  }

  _surface() {
    const o = this.groundObj;
    if (o) {
      if (o.tags.has('floe')) return 'snow';
      if (o.tags.has('bridge') || o.tags.has('mossy')) return 'wood';
      return 'stone';
    }
    if (this.inDungeon) return 'stone';
    const h = this.pos.y;
    if (h < 3.3) return 'sand';
    const w = G.terrain.biome(this.pos.x, this.pos.z);
    if (w.frost > 0.5 && h > 18) return 'snow';
    if (w.ember > 0.5) return 'stone';
    if (w.spring > 0.5) return 'sand';
    return 'grass';
  }

  _animate(dt) {
    const g = this.char.group;
    g.position.copy(this.pos);
    if (this.state === 'ride') g.position.y += 0.1 + Math.sin(G.time * 3) * 0.06;
    g.rotation.y = this.yaw;
    const hv = Math.hypot(this.vel.x, this.vel.z);
    this.speed = hv;
    let st = this.state;
    if (st === 'ground') st = hv > 0.5 ? 'walk' : 'idle';
    if (st === 'air') st = this.vel.y > 0 ? 'jump' : 'fall';
    if (this.dodgeT > 0) st = 'dodge';
    this.animState = st;
    // Footsteps
    if (this.state === 'ground' && hv > 0.8) {
      this.stride = (this.stride || 0) + hv * dt;
      const len = hv > 8 ? 1.7 : 1.25;
      if (this.stride > len) {
        this.stride = 0;
        G.audio.footstep(this._surface());
      }
    } else if (this.state === 'swim' && hv > 0.5) {
      this.stride = (this.stride || 0) + hv * dt;
      if (this.stride > 1.6) { this.stride = 0; G.audio.footstep('water'); }
    }
    this.char.animate({
      state: st, speed: hv, attack: this.attack, aim: this.aiming, aimPitch: -this.camPitch * 0.6,
      paintHold: this.painting, pitch: this.ridePitch, roll: this.rideRoll,
    }, dt);
    if (this.state === 'ride') {
      g.rotation.x = 0;
      g.rotation.z = 0;
    }
    g.updateMatrixWorld(true);
    this.char.brushTip.getWorldPosition(this._tip);
    this.char.brushBase.getWorldPosition(this._base);
    const swinging = !!this.attack && (this.attack.kind === 'spin' || this.attack.kind === 'plunge' || (this.attack.t > 0.2 && this.attack.t < 0.7));
    this.swingTrail.update(dt, this._tip, this._base, swinging, COLORS[this.color].hex);
    this.rideTrail.update(dt, this._tip, this.state === 'ride' && hv > 5, COLORS[this.color].hex);
    if (this.invuln > 0 && this.state !== 'dead' && this.invuln < 0.9) g.visible = Math.floor(G.time * 20) % 2 === 0 || this.dodgeT > 0;
    else g.visible = true;
  }

  // ---------------------------------------------------------------- camera
  updateCamera(dt) {
    const cam = G.camera;
    const pivot = this.pos.clone().setY(this.pos.y + (this.state === 'ride' ? 1.8 : 1.55));
    let dist = this.camDist;
    let shoulder = 0;
    if (this.aiming) { dist = 2.6; shoulder = 0.9; }
    if (this.state === 'ride') dist = this.camDist + 3;
    if (this.state === 'dead') dist = 8;

    if (this.lock && this.lock.alive) {
      const d = this.lock.pos.clone().sub(this.pos);
      const want = Math.atan2(-d.x, -d.z);
      this.camYaw = dampAngle(this.camYaw, want, 6, dt);
      this.camPitch = damp(this.camPitch, 0.3, 4, dt);
    }

    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const back = new THREE.Vector3(Math.sin(this.camYaw) * cp, sp, Math.cos(this.camYaw) * cp);
    const right = this.right();
    const anchor = pivot.clone().addScaledVector(right, shoulder);
    let want = anchor.clone().addScaledVector(back, dist);
    // Camera collision
    const dir = want.clone().sub(anchor);
    const len = dir.length();
    dir.normalize();
    const hit = G.collision.raycast(anchor, dir, len, { noTerrain: false });
    if (hit && hit.dist < len) want = anchor.clone().addScaledVector(dir, Math.max(0.6, hit.dist - 0.35));
    const th = G.collision.terrainHeight(want.x, want.y, want.z);
    if (want.y < th + 0.4) want.y = th + 0.4;

    const k = this.aiming ? 22 : 14;
    this.camPos.x = damp(this.camPos.x, want.x, k, dt);
    this.camPos.y = damp(this.camPos.y, want.y, k, dt);
    this.camPos.z = damp(this.camPos.z, want.z, k, dt);
    if (this.camPos.distanceTo(want) > 30) this.camPos.copy(want);
    cam.position.copy(this.camPos);
    if (this.cameraShake > 0) {
      const s = this.cameraShake * 0.5;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    }
    const look = anchor.clone().addScaledVector(back, -10);
    cam.lookAt(look);
    const fovT = this.state === 'ride' ? (Math.hypot(this.vel.x, this.vel.y, this.vel.z) > 26 ? 82 : 74) : this.aiming ? 55 : 65;
    cam.fov = lerp(cam.fov, fovT, 1 - Math.exp(-4 * dt));
    cam.updateProjectionMatrix();
  }

  netState() {
    return {
      t: 'st',
      p: [+this.pos.x.toFixed(2), +this.pos.y.toFixed(2), +this.pos.z.toFixed(2)],
      y: +this.yaw.toFixed(2),
      s: this.animState,
      v: +this.speed.toFixed(1),
      c: this.color,
      a: this.attack ? [this.attack.kind, +this.attack.t.toFixed(2)] : null,
      m: this.aiming ? 1 : 0,
      pt: +this.camPitch.toFixed(2),
      hp: this.hp,
      mhp: this.maxHp,
      rp: +this.ridePitch.toFixed(2),
      rr: +this.rideRoll.toFixed(2),
    };
  }
}

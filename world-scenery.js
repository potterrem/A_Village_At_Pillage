    // --- ENEMY NERF TUNING ---
    // Global multipliers applied to every enemy (raiders of all biomes, Orcs,
    // Demons, Bear Warrior, Dark Knight, Scarecrow). 1.0 = original strength.
    //   hp     - enemy max HP (Skeleton Warriors stay one-hit-kill)
    //   damage - damage dealt to player squads, militia, towers and NPCs
    //   speed  - enemy warband/boat movement speed
    const ENEMY_NERF = { hp: 0.75, damage: 0.75, speed: 0.9 };

    // --- 0. MAIN MENU SUBTITLE (random flavor text each load) ---
    const MENU_SUBTITLES = [
      'Created By RemponiDev',
      'Are you Ready ?',
      'You can Also Try Fishingpals Game',
      'Just A Random Thoughts',
      'Defend More',
      'Make Them Suffer'
    ];
    document.getElementById('menu-subtitle').textContent =
      MENU_SUBTITLES[Math.floor(Math.random() * MENU_SUBTITLES.length)];

    // --- 1. SETUP SCENE, CAMERA & ORBIT CONTROLS ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0d8ef);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(14, 16, 18);

    // Creates the main WebGL renderer, retrying with lighter settings if the
    // device refuses ("Error creating WebGL context" - usually too many live
    // contexts or GPU memory pressure on a phone). Antialiasing is the first
    // thing dropped, then the GPU is asked for its low-power mode. If every
    // attempt fails, a Reload screen is shown instead of a dead page.
    function createMainRenderer() {
      const attempts = [
        { antialias: true },
        { antialias: false },
        { antialias: false, powerPreference: 'low-power' }
      ];
      let lastErr = null;
      for (const opts of attempts) {
        try { return new THREE.WebGLRenderer(opts); } catch (e) { lastErr = e; }
      }
      const failBox = document.createElement('div');
      failBox.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:#14100c;color:white;text-align:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;';
      failBox.innerHTML = '<div style="font-size:1.1rem;font-weight:bold;">Couldn\'t start 3D graphics</div>'
        + '<div style="font-size:0.85rem;opacity:0.8;max-width:290px;">Your device ran out of graphics memory. Close other tabs or previews, then reload.</div>'
        + '<button style="margin-top:8px;background:#c0392b;border:2px solid #e74c3c;color:white;padding:10px 18px;border-radius:10px;font-weight:bold;" onclick="window.location.reload()">Reload</button>';
      document.body.appendChild(failBox);
      throw lastErr;
    }
    const renderer = createMainRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Phones get a slightly lower pixel-ratio cap - a full-screen, full-DPR
    // canvas with shadows is the biggest single GPU memory cost, and running
    // out of it is what makes mobile browsers drop the WebGL context.
    const isCoarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarsePointer ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // --- WebGL Context Loss Recovery ---
    // Mobile GPUs can reclaim a page's WebGL context under memory pressure
    // (low RAM, thermal throttling, backgrounding, etc). three.js itself
    // listens for 'webglcontextlost'/'webglcontextrestored', logs "Context
    // Lost"/"Context Restored" to the console, and calls
    // event.preventDefault() so the browser is allowed to hand the context
    // back - that's the message that was showing up in the console. Restore
    // usually happens within a second or two and rendering just resumes on
    // its own. But until now there was no on-screen feedback while it was
    // down, so a lost context just looked like the game had silently frozen
    // on the last frame, with no sign anything was wrong or recovering.
    // This adds a visible overlay for as long as the context is lost, and a
    // "Tap to Reload" fallback if it hasn't come back after a few seconds,
    // so a stuck screen is never mistaken for a working one.
    const contextLostOverlay = document.createElement('div');
    contextLostOverlay.id = 'context-lost-overlay';
    contextLostOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999; display: none;
      align-items: center; justify-content: center; flex-direction: column;
      gap: 14px; background: rgba(10, 10, 14, 0.88); color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      text-align: center; padding: 24px;
    `;
    contextLostOverlay.innerHTML = `
      <div style="font-size:1.1rem; font-weight:bold;">Reconnecting graphics…</div>
      <div style="font-size:0.85rem; opacity:0.8; max-width:280px;">The device paused rendering to free up memory. This usually resolves on its own in a moment.</div>
      <button id="context-lost-reload-btn" style="display:none; margin-top:8px; background:#c0392b; border:2px solid #e74c3c; color:white; padding:10px 18px; border-radius:10px; font-weight:bold; font-size:0.85rem;">Tap to Reload</button>
    `;
    document.body.appendChild(contextLostOverlay);
    const contextLostReloadBtn = contextLostOverlay.querySelector('#context-lost-reload-btn');
    contextLostReloadBtn.addEventListener('click', () => window.location.reload());

    let contextLostTimeoutId = null;
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      // Redundant with three.js's own internal listener, but explicit and
      // harmless - multiple preventDefault() calls on the same event are
      // fine, and this guarantees restoration stays enabled even if that
      // changes in a future three.js version.
      event.preventDefault();
      contextLostOverlay.style.display = 'flex';
      contextLostReloadBtn.style.display = 'none';
      contextLostTimeoutId = setTimeout(() => {
        contextLostReloadBtn.style.display = 'inline-block';
      }, 4000);
    }, false);

    renderer.domElement.addEventListener('webglcontextrestored', () => {
      if (contextLostTimeoutId) { clearTimeout(contextLostTimeoutId); contextLostTimeoutId = null; }
      contextLostOverlay.style.display = 'none';
    }, false);

    // --- Defensive patch for a known OrbitControls (r128) touch crash ---
    // On some mobile browsers, lifting a finger mid-gesture (e.g. going from
    // two touches to one, or one to zero) fires a touch/pointer event with
    // fewer active touch points than OrbitControls' internal handler
    // expects, and it reads event.touches[0]/[1].pageX off an array that's
    // now too short - throwing "Cannot read properties of undefined
    // (reading 'pageX')" and interrupting the current gesture. That handler
    // lives inside the vendored OrbitControls.js, so it can't be edited
    // directly; instead we wrap every touch/pointer listener OrbitControls
    // registers on the canvas in a try/catch that quietly no-ops just that
    // one malformed event (letting the gesture resume cleanly on the next
    // event) while still surfacing any other, unrelated error normally.
    (function guardOrbitControlsTouchCrash(el) {
      const nativeAdd = el.addEventListener.bind(el);
      el.addEventListener = function(type, listener, options) {
        if (typeof listener === 'function' && /touch|pointer/.test(type)) {
          const safeListener = function(event) {
            try {
              return listener.call(this, event);
            } catch (err) {
              const isKnownTouchCrash = err instanceof TypeError &&
                /page[XY]/.test(err.message || '');
              if (!isKnownTouchCrash) throw err;
            }
          };
          return nativeAdd(type, safeListener, options);
        }
        return nativeAdd(type, listener, options);
      };
    })(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 40;
    controls.target.set(0, 1.5, 0);

    // --- 2. LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(12, 24, 12);
    dirLight.castShadow = true;
    // Three.js defaults a DirectionalLight's shadow camera to a tiny
    // -5..5 orthographic box. Ground outside the shadow camera's frustum
    // doesn't get proper shadow coverage, and because the light sits at an
    // equal x/z offset (12, 24, 12), that square frustum edge projects onto
    // the ground as a 45-degree diamond of hard-edged, mottled shading
    // right where the box cuts off - showing up as a "broken" brown patch.
    // A single fixed size was tried here before and still clipped: Large/
    // Huge islands, especially with Separate Small Islands added at an
    // angle that lands near that diamond's tightest corner, can reach past
    // a flat guess. updateShadowCoverage() (called at the end of every
    // generateRandomIsland() run, below) re-fits this box to whatever
    // terrain actually exists each time instead, so it can't clip no
    // matter how big a run turns out to be. -24..24 here is just the
    // starting default before the first island exists.
    dirLight.shadow.camera.left = -24;
    dirLight.shadow.camera.right = 24;
    dirLight.shadow.camera.top = 24;
    dirLight.shadow.camera.bottom = -24;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.updateProjectionMatrix();
    // Bumped alongside the larger frustum above - the same 1024 texels
    // spread over a much bigger area would otherwise look noticeably
    // blockier/lower-res than before.
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    // Without a bias, flat ground tiles self-shadow: depth-buffer precision
    // isn't quite enough to tell "this tile's own surface" apart from "the
    // shadow map's record of this tile's own surface", so the renderer
    // flickers between lit and shadowed texel-by-texel. On a big flat
    // expanse (the dirt/wood tiles - grass hides it better since the
    // lit/shadowed greens read as similar) that shows up as the banded
    // light/dark streaking reported before and after the frustum resize -
    // widening the frustum without this made the striping worse, since
    // each shadow-map texel now covers more ground. These two biases are
    // the standard fix for that self-shadow acne.
    dirLight.shadow.bias = -0.001;
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);

    // --- 3. MATERIALS ---
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x55aa55 });
    const dirtMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
    const sandMat = new THREE.MeshLambertMaterial({ color: 0xddcc88 });
    const waterMat = new THREE.MeshLambertMaterial({ color: 0x336699, transparent: true, opacity: 0.8 });
    
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x5c3a21 });
    const darkWoodMat = new THREE.MeshLambertMaterial({ color: 0x3d2314 });
    const foliageGreen = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
    const pineGreen = new THREE.MeshLambertMaterial({ color: 0x1e5631 });
    const bushGreen = new THREE.MeshLambertMaterial({ color: 0x4a9d4a });
    const roofRed = new THREE.MeshLambertMaterial({ color: 0xa52a2a });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0xffdd88 });
    const steelMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const leatherMat = new THREE.MeshLambertMaterial({ color: 0x2b1c10 });
    // Desert Palm's trunk - a pale, sun-bleached tan rather than the Oak/
    // Pine's dark woodMat, since a real palm's fibrous trunk reads much
    // lighter than a hardwood trunk.
    const palmTrunkMat = new THREE.MeshLambertMaterial({ color: 0xa87f4a });
    const frostPineMat = new THREE.MeshLambertMaterial({ color: 0x3f6e5e }); // cool blue-green needles for the Northernlands' Frost Pine
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xddaa22 });
    const snowMat = new THREE.MeshLambertMaterial({ color: 0xf0f4f7 });
    const roadMat = new THREE.MeshLambertMaterial({ color: 0xa89880 });
    const roadMat2 = new THREE.MeshLambertMaterial({ color: 0x9c8b72 });

    const boneMat = new THREE.MeshLambertMaterial({ color: 0xe3dac9 });
    const bloodDecalMat = new THREE.MeshLambertMaterial({ color: 0x660000, transparent: true, opacity: 0.8, depthWrite: false });

    // Sized to comfortably outrun every island size's satellite islands, not
    // just the main island itself. Separate Small Islands can land as far
    // out as sizeCfg.baseRadius + gap + satRadius + 1 from center (see the
    // satellite-placement loop in generateRandomIsland) - for Huge that's
    // up to ~13.6, plus the satellite's own blob radius on top of that. The
    // old 26x26 plane (half-width 13) fell just short of that on Large and
    // cut Huge off outright, so a satellite (and the bridge reaching it)
    // could end up sitting past the water's edge with nothing rendered
    // beneath it. Doubling to 44x44 leaves headroom well past the worst case.
    const waterGeo = new THREE.BoxGeometry(44, 0.5, 44);
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(0, -0.25, 0);
    scene.add(water);

    // Water surface height + floating-corpse tuning (top face of the water box above)
    const WATER_SURFACE_Y = water.position.y + waterGeo.parameters.height / 2;
    const WATER_BOB_AMPLITUDE = 0.06;
    const WATER_BOB_SPEED = 1.8;
    const WATER_DRIFT_SPEED = 0.12;
    const WATER_BOUNDS = 21; // keep floating bodies roughly within the (now larger) water plane

    // Dynamic projectile, FX, ragdoll & blood decal collections
    const activeProjectiles = [];
    const activeParticles = [];
    // Ninja passive (Smoke Bomb) - billowing smoke puffs, tracked
    // separately from activeParticles since they float and expand
    // instead of falling under gravity - see spawnSmokeBombEffect.
    const activeSmokePuffs = [];
    // Paladin passive (Holy Light) - reuses the same rising golden light
    // pillar + expanding ground ring originally built for Divine
    // Resurrection, now doubling as the "heals an ally" half of Holy
    // Light - see spawnDivineResurrectionEffect.
    const activeHolyBeams = [];
    // Bear Warrior passive (Summon Lightning) and Paladin passive (Holy
    // Light's smite-an-enemy half) - active lightning-bolt/light-beam
    // strikes down at a target position, ticked/cleaned up the same way
    // activeHolyBeams is (see spawnLightningBoltEffect and its update
    // block below).
    const activeLightningBolts = [];
    // Paladin passive (Light Shock) - an expanding double ring of holy
    // energy centered on the Paladin, scaled up to the ability's actual
    // damage radius (see spawnLightShockEffect and its update block).
    const activeLightShockBursts = [];
    // Kitsune Twinblade attack swings (both Ember Fang and Frost Warden) -
    // a camera-facing glowing crescent arc that flashes in on the strike,
    // distinct from the small ember/frost particle bursts that already
    // fire at the same moment (see spawnSlashArc and its update block).
    const activeSlashArcs = [];
    // Siege Engineer passive (Barricade) - the temporary wooden barrier
    // crate spawned at its feet on taking a hit, tracked separately so
    // it can fade out on its own short timer (see spawnSiegeBarricade/
    // BARRICADE_SHIELD_DURATION) instead of tumbling or billowing like
    // the collections above.
    const activeSiegeBarricades = [];
    // Slasher passive (Ghost Step) - a dark shockwave ring + core flash
    // at both the vanish point and the landing point of the blink,
    // tracked separately since it grows/fades on its own schedule
    // rather than tumbling (activeParticles) or billowing
    // (activeSmokePuffs) - see spawnShadowExplosion.
    const activeShadowBursts = [];

    // Steel Revenant passive (Steel Grasp) - the ground claw hands and
    // the rectangular zone flash spawned by triggerSteelRevenantSteelGrasp,
    // updated each frame in the "Update Steel Revenant Steel Grasp FX"
    // block in animate() and cleaned up the same way as activeShadowBursts
    // above.
    const activeGraspFX = [];
    // Goddess of Death passive (Soul Vessel) - active possessions, see goddessDeath.
    const goddessPossessions = [];
    const activeFloatingTexts = [];
    const ragdolls = [];
    const bloodDecals = [];
    // Steel Revenant passive (Soulbound Armor) death effects - see
    // steelRevenantSoulDeath and the "Update Steel Revenant Soul Effects"
    // block in animate().
    const steelSouls = [];
    const birds = []; // Crows & seagulls scavenging on corpses

    // "Suspected Death" lingering-death system: a fatally wounded unit doesn't
    // ragdoll instantly. It either crawls along the ground or staggers on its
    // feet clutching the wound, trailing blood, before finally collapsing.
    const dyingUnits = [];
    const CRAWL_DEATH_DURATION = 10;   // seconds spent crawling before death
    const STAGGER_DEATH_DURATION = 5;  // seconds staggering before kneeling
    const KNEEL_DURATION = 0.8;        // seconds spent kneeling before death
    const CRAWL_SPEED = 0.22;
    const STAGGER_SPEED = 0.4;
    const CRAWL_SETTLE_TIME = 0.4;   // seconds easing from the standing pose down into the crawl
    const CRAWL_CYCLE_SPEED = 2.5;   // speed of the alternating drag/pull cycle
    const CRAWL_BOB_AMOUNT = 0.03;   // vertical dip on each forward pull
    const CRAWL_SWAY_AMOUNT = 0.1;   // hip/shoulder side-to-side roll while dragging
    // How far the whole body sinks toward the ground as it settles into the
    // crawl. The rig's arm/leg pivots stay at their standing-height anchors
    // (shoulder ~0.7, hip ~0.3 above the feet) no matter how the torso is
    // rotated, so tilting the torso alone left the whole unit hovering at
    // standing height with just its chest leaning over - reading as an odd
    // floating tilt rather than a body actually down on the ground. Sinking
    // the unit itself brings those anchors down with it, tuned low enough
    // that the bent knees (see CRAWL_LEG_FOLD below) still clear the ground.
    const CRAWL_SINK_HEIGHT = 0.22;
    const CRAWL_LEG_FOLD = 1.5;      // knee bend angle (rad) once settled - keeps feet off the ground at full sink
    const BLOOD_TRAIL_INTERVAL = 0.25; // seconds between trail decal drops
    const SUSPECTED_DEATH_CHANCE = 0.35; // odds a land death lingers instead of dying instantly
    const RIDER_SUSPECTED_DEATH_CHANCE = 0.6; // riders get thrown clear rather than crushed with the horse, so they linger more often than foot units
    const UP_AXIS = new THREE.Vector3(0, 1, 0);
    const DEATH_COLLAPSE_FORCE_MULT = 0.1; // near-zero impulse so the final collapse doesn't fling the body

    // A resting corpse that settles right at the coastline tips over and
    // rolls into the water instead of freezing on dry land beside it.
    const COASTAL_EDGE_CHECK_RADIUS = 0.65; // how far out to sample for adjacent water when a body settles
    const COASTAL_ROLL_SPEED = 0.5;         // how fast it rolls into the water once tipped over the edge
    const COASTAL_ROLL_SPIN = 3.5;          // rotation speed (rad/s) as it rolls in, log-rolling style

    // Minimum center-to-center gap enforced between same-kind death effects,
    // so a chokepoint that kills several units in nearly the same spot piles
    // bodies, weapons, and blood into a natural spread instead of every kill
    // landing exactly on top of the last one.
    const CORPSE_MIN_SPACING = 0.4;
    const WEAPON_MIN_SPACING = 0.3;
    // How long a dropped weapon lies on the ground before disappearing -
    // see the removal pass in the "Update Dropped Weapons" loop.
    const DROPPED_WEAPON_LIFETIME = 10;
    const BLOOD_DECAL_MIN_SPACING = 0.22;
    // How long a blood decal (land or water) stays before fading out and
    // being removed - see the fade in the "Update Blood Decals" loop.
    const BLOOD_DECAL_LIFETIME = 10;

    // Options menu settings - Corpse Limit caps how many ragdolls (see the
    // `ragdolls` array above) are allowed to exist at once, culling the
    // oldest once a new one pushes past the cap (see the trim in
    // createRagdollDeath) so a long battle doesn't quietly pile up hundreds
    // of physics bodies. Blood Enabled gates both blood-spawning functions
    // (createBloodSplatter, spawnBloodTrailDecal) - flipping it off also
    // clears whatever decals are already down (see setBloodEnabled).
    let corpseLimit = 10;
    let bloodEnabled = true;

    // Steel Revenant passive (Soulbound Armor) - the spirit bound inside the
    // plate splits free of it on death instead of the armor bleeding: it
    // rises clear (Rise), a pair of ghostly hands claw up out of the ground
    // and close around it (Grab), then hands and soul sink back under
    // together (Descend) - only once it's gone does whatever plates hadn't
    // already gone flying get their final outward scatter burst. See
    // steelRevenantSoulDeath and scatterRemainingArmor.
    const STEEL_SOUL_RISE_DURATION = 1.2;
    const STEEL_SOUL_GRAB_DURATION = 0.8;
    const STEEL_SOUL_DESCEND_DURATION = 0.9;
    const STEEL_SOUL_RISE_HEIGHT = 1.5;
    const STEEL_SOUL_HAND_SPREAD = 0.35;

    // Shared spacing resolver: starting from (x, z), repeatedly nudges away
    // from whatever `findOverlap(px, pz)` reports as the nearest conflicting
    // point (it should return null, or {dx, dz, dist} to the closest one
    // within the caller's own minSpacing) until clear or out of tries. Push
    // direction is away from that point, or a random direction if the two
    // are dead-center on each other. Never nudges into water - if a step
    // would leave solid ground, the last valid spot is kept instead.
    function resolveSpacing(x, z, minSpacing, findOverlap) {
      let px = x, pz = z;
      for (let tries = 0; tries < 6; tries++) {
        const overlap = findOverlap(px, pz);
        if (!overlap) break;

        let pushX, pushZ;
        if (overlap.dist < 0.001) {
          const ang = Math.random() * Math.PI * 2;
          pushX = Math.cos(ang);
          pushZ = Math.sin(ang);
        } else {
          pushX = overlap.dx / overlap.dist;
          pushZ = overlap.dz / overlap.dist;
        }

        const pushDist = minSpacing - overlap.dist + 0.02;
        const testX = px + pushX * pushDist;
        const testZ = pz + pushZ * pushDist;
        if (getSurfaceY(testX, testZ) === null) break; // would step into water - stop here
        px = testX;
        pz = testZ;
      }
      return { x: px, z: pz };
    }

    // Checks a list of {x, z}-bearing points for the nearest one within
    // minSpacing of (px, pz), returning the {dx, dz, dist} resolveSpacing
    // expects, or null if nothing nearby conflicts. `getPoint` maps a list
    // entry to the {x, z} to compare against (and can return null to skip
    // an entry, e.g. a corpse that hasn't settled yet).
    function nearestOverlap(list, skip, minSpacing, px, pz, getPoint) {
      let best = null;
      for (const entry of list) {
        if (entry === skip) continue;
        const pt = getPoint(entry);
        if (!pt) continue;
        const dx = px - pt.x;
        const dz = pz - pt.z;
        const dist = Math.hypot(dx, dz);
        if (dist < minSpacing && (!best || dist < best.dist)) best = { dx, dz, dist };
      }
      return best;
    }

    // Called once a corpse comes to a full stop. If another already-settled
    // corpse is sitting within CORPSE_MIN_SPACING, nudges this one outward
    // (away from that corpse, or a random direction if they're dead-center on
    // each other) so bodies spread into a pile instead of stacking exactly.
    function separateRestingCorpse(rag) {
      const spot = resolveSpacing(
        rag.group.position.x, rag.group.position.z, CORPSE_MIN_SPACING,
        (px, pz) => nearestOverlap(ragdolls, rag, CORPSE_MIN_SPACING, px, pz,
          o => o.isGrounded ? o.group.position : null)
      );
      const newY = getSurfaceY(spot.x, spot.z);
      if (newY === null) return; // nudge would've left solid ground - leave the corpse where it is
      rag.group.position.x = spot.x;
      rag.group.position.z = spot.z;
      rag.group.position.y = newY + 0.05;
    }

    // Carrion bird tuning
    const BIRD_SPAWN_DELAY = 40;     // seconds after death before a scavenge attempt can trigger
    const BIRD_SPAWN_CHANCE = 0.10;  // chance a given corpse attracts birds at that moment (10%)
    const BIRD_SKY_HEIGHT = 9;       // altitude birds swoop in from
    const BIRD_APPROACH_SPEED = 5.5; // how fast incoming birds close the distance
    const BIRD_EAT_DURATION_MIN = 8;
    const BIRD_EAT_DURATION_MAX = 16;
    const SKELETON_LIFETIME = 60; // seconds a skeleton lingers before vanishing for good
    const SKELETON_CORPSE_LIFETIME = 30; // seconds a Shadow Island Skeleton Warrior's own corpse lingers after death before vanishing
    // Seconds a fallen Zombie ally's own corpse lingers before vanishing -
    // matches a normal unit's total decay-to-gone span (decayTime +
    // SKELETON_LIFETIME below) rather than the much shorter throwaway-raider
    // SKELETON_CORPSE_LIFETIME, since a Zombie is a defender the player
    // actually raised, not disposable raider fodder.
    const ZOMBIE_CORPSE_LIFETIME = 180;

    // --- 4. COLLISION REGISTRY & PROP CREATORS ---
    const colliders = [];
    let coastTiles = [];

    // --- Event: Death - Attacker / Defender sides ---
    // In Event: Death the player is the ATTACKER and the Heavenly Island's
    // Valkyrie & Angel guards are the DEFENDERS. The island is split along
    // its longest axis: the player's squads always start on the attacker
    // edge, and every defender guard post is placed on the opposite
    // defender side, so the assault has to push across the island.
    // eventSideInfo is only set during an Event: Death run (null otherwise).
    let eventSideInfo = null;
    const EVENT_ATTACKER_ZONE_MAX_T = 0.35; // attacker edge = first 35% of the island
    const EVENT_DEFENDER_ZONE_MIN_T = 0.55; // defender side = last 45% of the island

    function computeEventSideInfo(tiles) {
      if (!tiles || tiles.length === 0) return null;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      tiles.forEach(t => {
        if (t.x < minX) minX = t.x; if (t.x > maxX) maxX = t.x;
        if (t.z < minZ) minZ = t.z; if (t.z > maxZ) maxZ = t.z;
      });
      const axis = (maxX - minX) >= (maxZ - minZ) ? 'x' : 'z';
      return { axis, min: axis === 'x' ? minX : minZ, max: axis === 'x' ? maxX : maxZ };
    }

    // 0 = attacker edge of the island, 1 = defender edge.
    function eventSideT(x, z) {
      if (!eventSideInfo) return 0.5;
      const span = Math.max(1, eventSideInfo.max - eventSideInfo.min);
      const p = eventSideInfo.axis === 'x' ? x : z;
      return (p - eventSideInfo.min) / span;
    }
    const isEventAttackerSide = t => eventSideT(t.x, t.z) <= EVENT_ATTACKER_ZONE_MAX_T;
    const isEventDefenderSide = t => eventSideT(t.x, t.z) >= EVENT_DEFENDER_ZONE_MIN_T;

    // Declared here (not down by chooseEventFaction/beginEventBattle,
    // where the "Event" menu logic itself lives) because the very first
    // generateRandomIsland() call at page load happens BEFORE that part of
    // the script runs - reading a `let` before its own declaration line
    // has executed throws a ReferenceError, which used to abort the rest
    // of the script's startup entirely (no UI, no enemies, nothing).
    let pendingEventFaction = null;
    let eventFactionActive = null;

    // In Event: Death the attackers don't start on land - each squad sails
    // in on its own boat and beaches on the attacker side, exactly like a
    // raider warband landing (see createRaiderSquad/updateBoatSailing/
    // disembarkRaiderSquad). Units ride slightly raised inside the hull
    // while aboard; disembarking drops them back onto their formation slots.
    const ATTACKER_BOAT_UNIT_LIFT = 0.16;

    // Picks one beach per squad on the attacker side of the island: a
    // walkable coast tile with open water next to it (preferring the sea
    // edge facing away from the defenders) and a clear run of water out to
    // the boat's starting spot. Landings are spread apart so boats don't
    // overlap. May return fewer than `count` on a very cramped coast - the
    // remaining squads simply start on land instead.
    function pickAttackerLandings(count) {
      if (!eventSideInfo) return [];
      const awayDir = eventSideInfo.axis === 'x' ? [-1, 0] : [0, -1];
      const isWater = (x, z) => heightMap[Math.round(x) + ',' + Math.round(z)] === undefined;
      const remaining = coastTiles.filter(t => isTileWalkable(t.x, t.z) && isEventAttackerSide(t));
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }

      const tryTile = t => {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => isWater(t.x + dx, t.z + dz));
        const isAway = d => (d[0] === awayDir[0] && d[1] === awayDir[1]) ? 1 : 0;
        dirs.sort((a, b) => isAway(b) - isAway(a));
        for (const [dx, dz] of dirs) {
          const seaDist = 4.5 + Math.random() * 3;
          let clear = true;
          for (let step = 1; step <= Math.ceil(seaDist); step++) {
            if (!isWater(t.x + dx * step, t.z + dz * step)) { clear = false; break; }
          }
          if (clear) return { tile: t, wdx: dx, wdz: dz, seaX: t.x + dx * seaDist, seaZ: t.z + dz * seaDist };
        }
        return null;
      };

      const chosen = [];
      while (chosen.length < count && remaining.length > 0) {
        let bestIdx = 0, bestD = -1;
        remaining.forEach((t, idx) => {
          const d = chosen.length ? Math.min(...chosen.map(c => Math.hypot(t.x - c.tile.x, t.z - c.tile.z))) : 0;
          if (d > bestD) { bestD = d; bestIdx = idx; }
        });
        if (chosen.length > 0 && bestD < 2.5) break; // no room left to keep boats apart
        const landing = tryTile(remaining.splice(bestIdx, 1)[0]);
        if (landing) chosen.push(landing);
      }
      return chosen;
    }

    // Puts a player squad aboard its own boat out at sea, bow pointed at
    // its beach. Mirrors createRaiderSquad's boat setup; updateBoatSailing
    // then carries it in and disembarkRaiderSquad lands it.
    function boardSquadOnBoat(squad, landing) {
      const boat = createBoat();
      squad.group.add(boat);
      squad.boat = boat;
      squad.onBoat = true;
      squad.group.userData.onBoat = true;
      squad.landingTile = { x: landing.tile.x, z: landing.tile.z, dirX: landing.wdx, dirZ: landing.wdz };
      squad.group.position.set(landing.seaX, 0, landing.seaZ);
      squad.group.rotation.y = Math.atan2(-landing.wdx, -landing.wdz);
      squad.isMoving = false;
      squad.group.userData.isMoving = false;
      squad.currentPath = [];
      squad.currentWaypoint = 0;
      squad.members.forEach(u => {
        u.position.y += ATTACKER_BOAT_UNIT_LIFT;
        if (u.userData.formationOffset) u.userData.formationOffset.y += ATTACKER_BOAT_UNIT_LIFT;
      });
    }
    let marketplaceTiles = [];
    const buildingTileKeys = new Set();
    const propTileKeys = new Set(); // tiles occupied by trees/rocks/bushes - hard obstacles for pathfinding
    // Tiles with a tree or bush specifically (a subset of propTileKeys,
    // excluding rocks) - Ninja squads standing on/near one of these go
    // untargetable to raiders. See isNearStealthCover / the raider
    // targeting loop in processUnitAttack.
    const stealthTileKeys = new Set();
    // Tiles a Ninja can actually climb onto and stand on top of - House,
    // Marketplace, Barracks, Blacksmith rooftops and Boulders. A subset of
    // stealthTileKeys (trees/bushes give concealment but aren't climbable).
    // See findPath's allowParkour flag and surfaceYFor below.
    const parkourTileKeys = new Set();
    const NINJA_PARKOUR_HEIGHT = 0.55; // extra elevation while perched on a parkour tile
    const roadTiles = new Set();
    const ROAD_SPEED_MULTIPLIER = 1.6;
    const SQUAD_COLLISION_RADIUS = 0.85; // min center-to-center gap between player squads - wider than each squad's ~0.34 formation radius so they stop with a visible gap instead of overlapping into each other
    const roadPlaneGeo = new THREE.PlaneGeometry(0.94, 0.94);

    function addCollider(x, z, radius) {
      colliders.push({ x, z, radius });
    }

    // Ninja passive (Camouflage) - true only when the given world position
    // is itself on a stealth tile (tree/bush/building/boulder), not merely
    // near one. Used to make a Ninja standing on cover untargetable to
    // raiders (see the raider targeting loop) and to drive the visual fade.
    function isNearStealthCover(x, z) {
      const cx = Math.round(x), cz = Math.round(z);
      return stealthTileKeys.has(cx + ',' + cz);
    }

    const heightMap = {};
    function getSurfaceY(x, z) {
      const key = Math.round(x) + ',' + Math.round(z);
      const h = heightMap[key];
      return h !== undefined ? h - 0.5 : null;
    }

    // Same as getSurfaceY, but when climbEnabled is true (a Ninja or
    // Slasher squad) and the tile is a parkour tile, adds the extra perch
    // height so the unit renders standing on top of the roof/boulder
    // instead of at ground level.
    function surfaceYFor(x, z, climbEnabled) {
      const base = getSurfaceY(x, z);
      if (base === null) return null;
      const key = Math.round(x) + ',' + Math.round(z);
      if (climbEnabled && parkourTileKeys.has(key)) return base + NINJA_PARKOUR_HEIGHT;
      return base;
    }

    // Ninja passive (Concealment) and Slasher passive (Parkour) both let
    // their squad path onto and stand on top of a parkour tile - House/
    // Marketplace/Barracks/Blacksmith rooftops and Boulders (never a
    // Wizard Tower or Church - see the village house branch in island
    // generation, which only adds the shorter buildings to
    // parkourTileKeys in the first place). Every other squad type still
    // routes around these tiles like a normal obstacle.
    function canSquadParkour(type) {
      return type === 'ninja' || type === 'slasher';
    }

    // Slasher passive (Rooftop Ambush) - true when the given world position
    // is itself standing on a parkour tile (a House/Marketplace/Barracks/
    // Blacksmith rooftop or a Boulder), i.e. up on a structure rather than
    // down on regular ground. See triggerSlasherAmbush.
    function isOnParkourTile(x, z) {
      const key = Math.round(x) + ',' + Math.round(z);
      return parkourTileKeys.has(key);
    }

    function isTileWalkable(x, z) {
      if (heightMap[x + ',' + z] === undefined) return false;
      return true;
    }

    function walkableNeighborCandidates(x, z) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const diagDirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      const clear = (nx, nz) => isTileWalkable(nx, nz) && !buildingTileKeys.has(nx + ',' + nz) && !propTileKeys.has(nx + ',' + nz);

      const tiers = [
        dirs.filter(([dx, dz]) => clear(x + dx, z + dz)),
        diagDirs.filter(([dx, dz]) => clear(x + dx, z + dz)),
        dirs.filter(([dx, dz]) => isTileWalkable(x + dx, z + dz)),
        diagDirs.filter(([dx, dz]) => isTileWalkable(x + dx, z + dz)),
      ];
      const out = [];
      tiers.forEach(tier => tier.forEach(([dx, dz]) => out.push({ x: x + dx, z: z + dz })));
      return out;
    }

    function nearestWalkableNeighbor(x, z) {
      const candidates = walkableNeighborCandidates(x, z);
      return candidates.length ? candidates[0] : null;
    }

    // Smart pathfinding support for player squads --------------------------
    // Tiles currently occupied by every OTHER squad that squad would
    // actually collide with (mirrors the exact same skip rules
    // stepSquadMovement's per-step collision check uses: raiders don't
    // block fellow raiders, a boat that hasn't landed blocks nothing, and
    // the two Castle Interior assault sides pass through each other), so a
    // freshly-planned route treats a parked squad as a solid obstacle to
    // route around - the same way it already routes around a tree - instead
    // of walking straight at it and only discovering the collision one step
    // at a time.
    function collidableSquadBlockedKeys(squad) {
      const blocked = new Set();
      const allLiveSquads = squads.concat(militiaSquads, raiderSquads);
      for (const other of allLiveSquads) {
        if (other === squad || other.members.length === 0) continue;
        if (other.onBoat) continue;
        if (squad.type === 'raiders' && other.type === 'raiders') continue;
        if (inCastleInterior && ((squad.type === 'raiders') !== (other.type === 'raiders'))) continue;
        blocked.add(Math.round(other.group.position.x) + ',' + Math.round(other.group.position.z));
      }
      return blocked;
    }

    // Finds the nearest tile to (goalX, goalZ) that's actually walkable
    // under the same rules findPath would use (buildings/props/parkour/
    // blockedKeys), searching outward ring by ring. Used so a tap that
    // lands on a tree, a wall, or a tile another squad is standing on still
    // sends the squad as close as it can get instead of doing nothing.
    function findNearestOpenGoal(goalX, goalZ, avoidBuildings, avoidProps, allowParkour, blockedKeys) {
      const open = (x, z) => {
        if (!isTileWalkable(x, z)) return false;
        const key = x + ',' + z;
        if (allowParkour && parkourTileKeys.has(key)) return true;
        if (avoidBuildings && buildingTileKeys.has(key)) return false;
        if (avoidProps && propTileKeys.has(key)) return false;
        if (blockedKeys && blockedKeys.has(key)) return false;
        return true;
      };
      if (open(goalX, goalZ)) return { x: goalX, z: goalZ };
      for (let r = 1; r <= 8; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const nx = goalX + dx, nz = goalZ + dz;
            if (open(nx, nz)) return { x: nx, z: nz };
          }
        }
      }
      return null;
    }

    function findPath(startX, startZ, goalX, goalZ, avoidBuildings, avoidProps = true, allowParkour = false, blockedKeys = null) {
      startX = Math.round(startX); startZ = Math.round(startZ);
      goalX = Math.round(goalX); goalZ = Math.round(goalZ);

      // Buildings only block when the caller asks to route around them.
      // Trees/rocks/bushes block by default too, but callers (raiders) can
      // pass avoidProps=false to path straight through them instead.
      // A Ninja squad passes allowParkour=true, which lets it path onto a
      // parkour tile (House/Marketplace/Barracks/Blacksmith/Boulder) even
      // though those same tiles block everyone else. blockedKeys is an
      // optional Set of extra "x,z" tiles to treat as temporarily solid -
      // used to route a player squad's move order around whichever tiles
      // other player squads currently stand on (see
      // collidableSquadBlockedKeys), the same way propTileKeys routes it
      // around a tree.
      const walkable = (x, z) => {
        if (!isTileWalkable(x, z)) return false;
        const key = x + ',' + z;
        if (allowParkour && parkourTileKeys.has(key)) return true;
        if (avoidBuildings && buildingTileKeys.has(key)) return false;
        if (avoidProps && propTileKeys.has(key)) return false;
        if (blockedKeys && blockedKeys.has(key)) return false;
        return true;
      };

      if (!walkable(goalX, goalZ)) return null;
      if (startX === goalX && startZ === goalZ) return [];

      const key = (x, z) => x + ',' + z;
      const open = new Map();
      const cameFrom = new Map();
      const gScore = new Map();
      const closed = new Set();

      const h = (x, z) => Math.abs(x - goalX) + Math.abs(z - goalZ);

      gScore.set(key(startX, startZ), 0);
      open.set(key(startX, startZ), { x: startX, z: startZ, f: h(startX, startZ) });

      // Horizontal/vertical moves only - no diagonal steps.
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

      while (open.size > 0) {
        let currentKey = null, current = null;
        for (const [k, node] of open) {
          if (!current || node.f < current.f) { current = node; currentKey = k; }
        }

        if (current.x === goalX && current.z === goalZ) {
          const path = [];
          let ck = currentKey;
          while (cameFrom.has(ck)) {
            const [cx, cz] = ck.split(',').map(Number);
            path.push({ x: cx, z: cz });
            ck = cameFrom.get(ck);
          }
          path.reverse();
          return path;
        }

        open.delete(currentKey);
        closed.add(currentKey);

        for (const [dx, dz] of dirs) {
          const nx = current.x + dx, nz = current.z + dz;
          const nk = key(nx, nz);
          if (closed.has(nk) || !walkable(nx, nz)) continue;

          const tentativeG = gScore.get(currentKey) + 1;
          if (tentativeG < (gScore.get(nk) ?? Infinity)) {
            cameFrom.set(nk, currentKey);
            gScore.set(nk, tentativeG);
            open.set(nk, { x: nx, z: nz, f: tentativeG + h(nx, nz) });
          }
        }
      }

      return null;
    }

    function isRoadWalkable(x, z) {
      return isTileWalkable(x, z) && !buildingTileKeys.has(x + ',' + z);
    }

    function findRoadPath(startX, startZ, goalX, goalZ) {
      startX = Math.round(startX); startZ = Math.round(startZ);
      goalX = Math.round(goalX); goalZ = Math.round(goalZ);

      if (!isRoadWalkable(goalX, goalZ)) return null;
      if (startX === goalX && startZ === goalZ) return [];

      const key = (x, z) => x + ',' + z;
      const open = new Map();
      const cameFrom = new Map();
      const gScore = new Map();
      const closed = new Set();

      const h = (x, z) => Math.abs(x - goalX) + Math.abs(z - goalZ);

      gScore.set(key(startX, startZ), 0);
      open.set(key(startX, startZ), { x: startX, z: startZ, f: h(startX, startZ) });

      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

      while (open.size > 0) {
        let currentKey = null, current = null;
        for (const [k, node] of open) {
          if (!current || node.f < current.f) { current = node; currentKey = k; }
        }

        if (current.x === goalX && current.z === goalZ) {
          const path = [];
          let ck = currentKey;
          while (cameFrom.has(ck)) {
            const [cx, cz] = ck.split(',').map(Number);
            path.push({ x: cx, z: cz });
            ck = cameFrom.get(ck);
          }
          path.reverse();
          return path;
        }

        open.delete(currentKey);
        closed.add(currentKey);

        for (const [dx, dz] of dirs) {
          const nx = current.x + dx, nz = current.z + dz;
          const nk = key(nx, nz);
          if (closed.has(nk) || !isRoadWalkable(nx, nz)) continue;

          const tentativeG = gScore.get(currentKey) + 1;
          if (tentativeG < (gScore.get(nk) ?? Infinity)) {
            cameFrom.set(nk, currentKey);
            gScore.set(nk, tentativeG);
            open.set(nk, { x: nx, z: nz, f: tentativeG + h(nx, nz) });
          }
        }
      }

      return null;
    }

    function buildRoadNetwork(points) {
      const seen = new Set();
      const uniquePoints = [];
      for (const p of points) {
        let x = Math.round(p.x), z = Math.round(p.z);

        if (!isTileWalkable(x, z) || buildingTileKeys.has(x + ',' + z)) {
          const doorstep = nearestWalkableNeighbor(x, z);
          if (!doorstep) continue;
          x = doorstep.x; z = doorstep.z;
        }

        const k = x + ',' + z;
        if (seen.has(k)) continue;
        seen.add(k);
        uniquePoints.push({ x, z });
      }
      if (uniquePoints.length < 2) return;

      const connected = [uniquePoints[0]];
      roadTiles.add(uniquePoints[0].x + ',' + uniquePoints[0].z);
      const remaining = uniquePoints.slice(1);

      while (remaining.length > 0) {
        let bestIdx = -1, bestDist = Infinity, bestTarget = null;
        remaining.forEach((p, i) => {
          connected.forEach(c => {
            const d = Math.hypot(p.x - c.x, p.z - c.z);
            if (d < bestDist) { bestDist = d; bestIdx = i; bestTarget = c; }
          });
        });

        const p = remaining.splice(bestIdx, 1)[0];
        const path = findRoadPath(p.x, p.z, bestTarget.x, bestTarget.z);
        if (path) {
          roadTiles.add(p.x + ',' + p.z);
          path.forEach(tile => roadTiles.add(tile.x + ',' + tile.z));
        }
        connected.push(p);
      }
    }

    function renderRoads() {
      roadTiles.forEach(key => {
        const [x, z] = key.split(',').map(Number);
        const h = heightMap[key];
        if (h === undefined) return;
        const mat = Math.random() > 0.5 ? roadMat : roadMat2;
        const tile = new THREE.Mesh(roadPlaneGeo, mat);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(x, h - 0.5 + 0.015, z);
        tile.receiveShadow = true;
        islandGroup.add(tile);
      });
    }

    // Scale multipliers for scenery - bumped up so trees/rocks/bushes and
    // buildings read as bigger, more substantial props on the island.
    const NATURE_SCALE = 1.4;
    const STRUCTURE_SCALE = 1.3;
    // Orc Fortress uses its own, larger scale (see createOrcFortress) so
    // the keep itself spans the center 3x3 block of tiles inside its 5x5
    // plot, instead of sitting on a single tile like every other special
    // structure - the outer ring (see ORC_FORTRESS_SIZE in
    // generateRandomIsland) stays a 1-tile-wide palisade wall around it.
    const ORC_FORTRESS_SCALE = 3.3;

    function createOakTree(x, y, z) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.6, 6), woodMat);
      trunk.position.y = 0.3;
      trunk.castShadow = true;
      
      const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 1), foliageGreen);
      leaves.position.y = 0.75;
      leaves.castShadow = true;
      
      tree.add(trunk, leaves);
      tree.scale.setScalar(NATURE_SCALE);
      tree.position.set(x, y, z);
      addCollider(x, z, 0.25 * NATURE_SCALE);
      return tree;
    }

    function createPineTree(x, y, z) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 6), woodMat);
      trunk.position.y = 0.25;
      trunk.castShadow = true;

      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4 - i * 0.08, 0.4, 6), pineGreen);
        cone.position.y = 0.45 + i * 0.22;
        cone.castShadow = true;
        tree.add(cone);
      }
      tree.add(trunk);
      tree.scale.setScalar(NATURE_SCALE);
      tree.position.set(x, y, z);
      addCollider(x, z, 0.25 * NATURE_SCALE);
      return tree;
    }

    // Frost Pine - replaces the Oak/Pine mix as the scenery tree while the
    // Northernlands biome is active (see createSceneryTree below). Same
    // three-tier cone silhouette as the classic Pine, but each tier gets a
    // shallow snow-cap cone nested at its peak and the needles themselves
    // lean cool blue-green rather than classic forest green, so islands
    // read as frosted rather than merely re-tinted.
    function createFrostPine(x, y, z) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 6), darkWoodMat);
      trunk.position.y = 0.25;
      trunk.castShadow = true;
      tree.add(trunk);

      for (let i = 0; i < 3; i++) {
        const tierRadius = 0.4 - i * 0.08;
        const tierY = 0.45 + i * 0.22;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(tierRadius, 0.4, 6), frostPineMat);
        cone.position.y = tierY;
        cone.castShadow = true;
        tree.add(cone);

        // Snow cap - a shallow cone nested at this tier's peak, just wide
        // enough to read as a dusting of snow on the needles below it
        // rather than replacing the tier's color entirely.
        const cap = new THREE.Mesh(new THREE.ConeGeometry(tierRadius * 0.65, 0.14, 6), snowMat);
        cap.position.y = tierY + 0.15;
        cap.castShadow = true;
        tree.add(cap);
      }

      tree.scale.setScalar(NATURE_SCALE);
      tree.position.set(x, y, z);
      addCollider(x, z, 0.25 * NATURE_SCALE);
      return tree;
    }

    // Desert Palm - replaces the Oak/Pine as the scenery tree while the
    // Desert biome is active (see createSceneryTree below). A tall,
    // slightly leaning fibrous trunk topped with a crown of drooping
    // fronds radiating outward, rather than a leafy canopy or pine cones
    // that wouldn't read as desert flora.
    function createDesertPalm(x, y, z) {
      const tree = new THREE.Group();

      // Trunk built from two segments with an increasing lean. Each
      // segment's position is computed from where the previous one
      // actually ends (using its own tilt), rather than a hard-coded
      // guess, so the two always join with no seam or visible kink.
      const lean1 = 0.06;
      const lowerLen = 0.45;
      const dirLower = new THREE.Vector3(-Math.sin(lean1), Math.cos(lean1), 0);
      const trunkLower = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, lowerLen, 7), palmTrunkMat);
      trunkLower.rotation.z = lean1;
      trunkLower.position.copy(dirLower.clone().multiplyScalar(lowerLen / 2));
      trunkLower.castShadow = true;
      tree.add(trunkLower);

      const lean2 = 0.22; // continues the lean further toward the crown
      const upperLen = 0.48;
      const dirUpper = new THREE.Vector3(-Math.sin(lean2), Math.cos(lean2), 0);
      const trunkTop = dirLower.clone().multiplyScalar(lowerLen); // exact top of trunkLower
      const trunkUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, upperLen, 7), palmTrunkMat);
      trunkUpper.rotation.z = lean2;
      trunkUpper.position.copy(trunkTop.clone().add(dirUpper.clone().multiplyScalar(upperLen / 2)));
      trunkUpper.castShadow = true;
      tree.add(trunkUpper);

      // Crown sits exactly at the top of the leaning trunk.
      const crown = new THREE.Group();
      crown.position.copy(trunkTop.clone().add(dirUpper.clone().multiplyScalar(upperLen)));
      tree.add(crown);

      // Each frond is two segments: a base that rises up and outward from
      // the crown, then a tip that continues past horizontal and arcs back
      // downward - a real palm frond bends over roughly halfway along its
      // length rather than sticking straight out like a spike. The tip is
      // a SIBLING of the base (not a child of it) with its own absolute
      // tilt angle, so its rotation doesn't compound with the base's tilt
      // - that compounding bug is what previously sent fronds off at
      // broken, near-random angles instead of a smooth droop. Fronds are
      // also flattened (scale.z) into blade shapes instead of solid cones,
      // and given a touch of length variation so the crown doesn't read as
      // a perfectly symmetrical, mechanical rosette.
      const frondCount = 8;
      for (let i = 0; i < frondCount; i++) {
        const frondPivot = new THREE.Group();
        frondPivot.rotation.y = (i / frondCount) * Math.PI * 2 + 0.3;
        crown.add(frondPivot);

        const lenVariance = ((i * 37) % 7) / 7 * 0.08; // deterministic pseudo-random variety

        const baseLen = 0.42 + lenVariance;
        const baseAngle = 0.85; // tilt from vertical - rises up and outward
        const baseDir = new THREE.Vector3(0, Math.cos(baseAngle), Math.sin(baseAngle));

        const base = new THREE.Mesh(new THREE.ConeGeometry(0.05, baseLen, 3), foliageGreen);
        base.scale.z = 0.22; // flatten into a blade rather than a round spike
        base.rotation.x = baseAngle;
        base.position.copy(baseDir.clone().multiplyScalar(baseLen / 2)); // seats the wide end at the crown
        base.castShadow = true;
        frondPivot.add(base);

        const baseTop = baseDir.clone().multiplyScalar(baseLen); // exact far end of the base segment

        const tipLen = 0.36 + lenVariance;
        const tipAngle = 2.3; // well past horizontal - arcs back downward
        const tipDir = new THREE.Vector3(0, Math.cos(tipAngle), Math.sin(tipAngle));

        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, tipLen, 3), foliageGreen);
        tip.scale.z = 0.18;
        tip.rotation.x = tipAngle;
        tip.position.copy(baseTop.clone().add(tipDir.clone().multiplyScalar(tipLen / 2))); // continues seamlessly from the base
        tip.castShadow = true;
        frondPivot.add(tip);
      }

      tree.scale.setScalar(NATURE_SCALE);
      tree.position.set(x, y, z);
      addCollider(x, z, 0.25 * NATURE_SCALE);
      return tree;
    }

    // Dead Swamp Tree - replaces the Oak/Pine when Shadow Island's outdoor
    // Swamp variant is active (see createSceneryTree below). A bare,
    // slightly leaning trunk with a few gnarled bare branches and no
    // canopy at all - reads as dead, waterlogged timber rather than
    // healthy woodland.
    function createDeadSwampTree(x, y, z) {
      const tree = new THREE.Group();
      const lean = 0.1;
      const trunkLen = 0.7;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.13, trunkLen, 6), darkWoodMat);
      trunk.rotation.z = lean;
      trunk.position.set(Math.sin(lean) * trunkLen / 2, Math.cos(lean) * trunkLen / 2, 0);
      trunk.castShadow = true;
      tree.add(trunk);

      const trunkTop = new THREE.Vector3(Math.sin(lean) * trunkLen, Math.cos(lean) * trunkLen, 0);
      const branchCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < branchCount; i++) {
        const angle = (i / branchCount) * Math.PI * 2 + Math.random() * 0.6;
        const tilt = 0.9 + Math.random() * 0.4;
        const len = 0.28 + Math.random() * 0.12;
        const dir = new THREE.Vector3(Math.cos(angle) * Math.sin(tilt), Math.cos(tilt), Math.sin(angle) * Math.sin(tilt));
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.045, len, 5), darkWoodMat);
        branch.position.copy(trunkTop.clone().add(dir.clone().multiplyScalar(len / 2)));
        branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        branch.castShadow = true;
        tree.add(branch);
      }

      tree.scale.setScalar(NATURE_SCALE);
      tree.position.set(x, y, z);
      addCollider(x, z, 0.25 * NATURE_SCALE);
      return tree;
    }

    // Ruined Pillar - stands in for the scenery tree slot on Shadow
    // Island's indoor Dungeon variant, where a living tree wouldn't make
    // sense. A stack of roughly-aligned broken stone blocks, tallest at
    // the base, with the top block cracked off at an angle - like a
    // support column that's partially collapsed.
    function createRuinPillar(x, y, z) {
      const pillar = new THREE.Group();
      const blockCount = 3 + Math.floor(Math.random() * 2);
      let h = 0;
      for (let i = 0; i < blockCount; i++) {
        const size = 0.32 - i * 0.03;
        const blockH = 0.22 - i * 0.02;
        const block = new THREE.Mesh(new THREE.BoxGeometry(size, blockH, size), stoneMat);
        block.rotation.y = Math.random() * 0.3 - 0.15;
        if (i === blockCount - 1) block.rotation.z = 0.25; // cracked-off top block, tilted
        block.position.y = h + blockH / 2;
        block.castShadow = true;
        pillar.add(block);
        h += blockH;
      }
      pillar.scale.setScalar(NATURE_SCALE);
      pillar.position.set(x, y, z);
      addCollider(x, z, 0.2 * NATURE_SCALE);
      return pillar;
    }

    // Rubble Pile - stands in for the "rock" prop slot on Shadow Island's
    // Dungeon variant. A scatter of broken masonry blocks rather than a
    // smooth boulder, so the indoor look reads as collapsed stonework
    // instead of naturally-occurring rock.
    function createRubblePile(x, y, z) {
      const pile = new THREE.Group();
      const chunkCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < chunkCount; i++) {
        const size = 0.12 + Math.random() * 0.12;
        const chunk = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.8, size), stoneMat);
        chunk.position.set(
          (Math.random() - 0.5) * 0.3,
          size * 0.4,
          (Math.random() - 0.5) * 0.3
        );
        chunk.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
        chunk.castShadow = true;
        pile.add(chunk);
      }
      pile.scale.set(1.2 * NATURE_SCALE, 0.9 * NATURE_SCALE, 1.2 * NATURE_SCALE);
      pile.position.set(x, y, z);
      addCollider(x, z, 0.35 * NATURE_SCALE);
      return pile;
    }

    // Demonic Portal materials - jagged obsidian archway laced with
    // glowing magma cracks, wrapped around a layered void vortex, for
    // the rare landmark that can appear on Shadow Island's indoor
    // Dungeon variant (see DEMONIC_PORTAL_SPAWN_CHANCE in
    // generateRandomIsland and createDemonicPortal below). The vortex
    // discs and drifting embers are spun up each frame by
    // updateDemonicPortals via the demonicPortalFX registry.
    const charredStoneMat = new THREE.MeshLambertMaterial({ color: 0x14101a });
    const magmaCrackMat = new THREE.MeshBasicMaterial({ color: 0xff5a1f });
    const voidCoreMat = new THREE.MeshBasicMaterial({ color: 0x140022, side: THREE.DoubleSide });
    const portalGlowMat = new THREE.MeshBasicMaterial({ color: 0xa64dff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    const portalGlowMat2 = new THREE.MeshBasicMaterial({ color: 0x6a1fb8, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    const portalEmberMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });

    // Demonic Portal - a rare single-tile landmark unique to Shadow
    // Island's indoor Dungeon variant. A pair of jagged obsidian pillars,
    // veined with glowing magma cracks and each capped by a spiked tip,
    // lean inward to form a proper archway around a layered, slowly
    // spinning void vortex; a scattering of rubble and ember rune stones
    // sits at the base. Purely a landmark (no resident NPC, unlike the
    // Cemetery's Undertaker) - it just marks its tile as solid,
    // unwalkable ground like any other structure. Its vortex/ember
    // animation state is registered in demonicPortalFX and driven each
    // frame by updateDemonicPortals.
    function createDemonicPortal(x, y, z) {
      const portal = new THREE.Group();
      const phase = Math.random() * Math.PI * 2;

      // Two obsidian pillars, each built from two stacked blocks that
      // lean inward as they rise and finish in a magma-lit spike -
      // blocky in keeping with the game's low-poly look, but with a
      // jagged, glowing silhouette for a much more striking archway
      // than the original plain fang ring.
      [-1, 1].forEach(side => {
        const pillar = new THREE.Group();

        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), charredStoneMat);
        lower.position.set(side * 0.32, 0.21, 0);
        lower.castShadow = true;
        pillar.add(lower);

        const lowerCrack = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.32, 0.005), magmaCrackMat);
        lowerCrack.position.set(0, 0, 0.083);
        lower.add(lowerCrack);

        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.34, 0.13), charredStoneMat);
        upper.position.set(side * 0.26, 0.6, 0);
        upper.rotation.z = -side * 0.16;
        upper.castShadow = true;
        pillar.add(upper);

        const upperCrack = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.24, 0.005), magmaCrackMat);
        upperCrack.position.set(0, 0, 0.068);
        upper.add(upperCrack);

        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), charredStoneMat);
        spike.position.set(0, 0.32, 0);
        spike.castShadow = true;
        upper.add(spike);

        const spikeGlow = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.13, 5), magmaCrackMat);
        spikeGlow.position.set(0, 0.02, 0);
        spike.add(spikeGlow);

        portal.add(pillar);
      });

      // Keystone bridging the two pillar tops, set with a small glowing
      // gem for a hint of built, ritual craftsmanship.
      const keystone = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.16), charredStoneMat);
      keystone.position.set(0, 0.9, 0);
      keystone.castShadow = true;
      portal.add(keystone);
      const keystoneGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), magmaCrackMat);
      keystoneGem.position.set(0, -0.02, 0.09);
      keystone.add(keystoneGem);

      // Squat charred base ring the pillars root out of.
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 10), charredStoneMat);
      base.position.y = 0.04;
      base.castShadow = true;
      portal.add(base);

      // A few broken rubble chunks and ember rune stones scattered at
      // the base, like the Gravestones scattered around the Cemetery.
      const runeCount = 3;
      for (let i = 0; i < runeCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 0.5 + Math.random() * 0.14;
        const rune = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), portalEmberMat);
        rune.position.set(Math.cos(angle) * r, 0.04, Math.sin(angle) * r);
        rune.rotation.y = Math.random() * Math.PI;
        rune.castShadow = true;
        portal.add(rune);
      }

      // The vortex itself: a dark void backdrop behind two
      // counter-rotating glow discs and a pulsing core, plus a soft
      // point light so it actually lights up the ground around it.
      // Spin/pulse state lives in demonicPortalFX, updated each frame
      // by updateDemonicPortals.
      const vortex = new THREE.Group();
      vortex.position.set(0, 0.48, 0);

      const voidBack = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), voidCoreMat);
      vortex.add(voidBack);

      const glowDisc1 = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.3, 5, 1), portalGlowMat);
      glowDisc1.position.z = 0.01;
      vortex.add(glowDisc1);

      const glowDisc2 = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.24, 6, 1), portalGlowMat2);
      glowDisc2.position.z = 0.015;
      vortex.add(glowDisc2);

      const core = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), portalEmberMat.clone());
      core.position.z = 0.02;
      vortex.add(core);

      const portalLight = new THREE.PointLight(0x9b30ff, 1.1, 2.4);
      portalLight.position.z = 0.15;
      vortex.add(portalLight);

      portal.add(vortex);

      // A handful of embers drifting in slow orbit around the vortex
      // mouth, bobbing gently up and down.
      const embers = [];
      const emberCount = 5;
      for (let i = 0; i < emberCount; i++) {
        const ember = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), portalEmberMat);
        ember.userData = {
          angle: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 0.4,
          radius: 0.36 + Math.random() * 0.1,
          baseY: 0.48 + (Math.random() - 0.5) * 0.2,
          phase: Math.random() * Math.PI * 2
        };
        portal.add(ember);
        embers.push(ember);
      }

      portal.scale.setScalar(STRUCTURE_SCALE);
      portal.position.set(x, y, z);
      portal.rotation.y = Math.random() * Math.PI * 2;
      addCollider(x, z, 0.46 * STRUCTURE_SCALE);

      demonicPortalFX.push({ glowDisc1, glowDisc2, core, embers, phase });

      return portal;
    }

    // Orc Fortress materials - crude dark-stained log construction, bone
    // trophies, and rusted iron banding, for the rare hostile landmark
    // that can appear on the Classic biome (see ORC_FORTRESS_SPAWN_CHANCE
    // in generateRandomIsland and createOrcFortress below).
    const orcLogMat = new THREE.MeshLambertMaterial({ color: 0x4a3320 });
    const orcLogDarkMat = new THREE.MeshLambertMaterial({ color: 0x2e2013 });
    const orcRoofMat = new THREE.MeshLambertMaterial({ color: 0x241a11 });
    const orcSkullMat = new THREE.MeshLambertMaterial({ color: 0xe8dfc4 });
    const orcIronMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3d });
    const orcBannerMat = new THREE.MeshLambertMaterial({ color: 0x6b1f1f, side: THREE.DoubleSide });
    const orcFireMat = new THREE.MeshBasicMaterial({ color: 0xff8a1f });

    // Orc Fortress - a rare hostile landmark unique to the Classic biome,
    // its keep spanning the center 3x3 block of tiles inside its 5x5 plot
    // (see ORC_FORTRESS_SCALE and ORC_FORTRESS_SIZE in generateRandomIsland).
    // A small wooden castle: a squared log keep with corner turrets and a
    // crenellated parapet, a barred gate facing the wall's gate gap, and a
    // taller central tower topped with a lit brazier that doubles as the
    // arrow-loosing point in updateOrcFortress (see ORC_FORTRESS_FIRE_HEIGHT).
    // Unlike every other special structure (Cemetery, Demonic Portal), this
    // one is actively hostile on its own - no resident NPC or portal-spawned
    // squad needed - it just fires arrows directly at any player/militia
    // squad that strays within ORC_FORTRESS_RANGE, checked every frame by
    // updateOrcFortress. Only one mesh is ever built for the whole keep -
    // the other 8 tiles under its footprint are registered solid by the
    // 'orcFortressKeepExtra' branch in the propMeshes loop rather than each
    // getting their own copy of this mesh.
    function createOrcFortress(x, y, z) {
      const fortress = new THREE.Group();

      // Squared log keep body.
      const keepW = 0.62, keepD = 0.62, keepH = 0.5;
      const keep = new THREE.Mesh(new THREE.BoxGeometry(keepW, keepH, keepD), orcLogMat);
      keep.position.y = keepH / 2;
      keep.castShadow = true;
      fortress.add(keep);

      // Horizontal log-course lines etched into the keep walls, so it
      // reads as stacked logs rather than a smooth plank box.
      [0.13, 0.28, 0.43].forEach(hy => {
        const course = new THREE.Mesh(new THREE.BoxGeometry(keepW + 0.01, 0.02, keepD + 0.01), orcLogDarkMat);
        course.position.y = hy;
        fortress.add(course);
      });

      // Notched corner posts, poking slightly past the keep body like
      // interlocked log-cabin joints - the classic "wooden castle" tell.
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, keepH + 0.06, 0.09), orcLogDarkMat);
        post.position.set(sx * keepW / 2, keepH / 2, sz * keepD / 2);
        post.castShadow = true;
        fortress.add(post);
      });

      // Crenellated parapet ring along the keep roofline.
      const merlonY = keepH + 0.05;
      for (let side = 0; side < 4; side++) {
        const along = side % 2 === 0 ? keepW : keepD;
        const axis = side % 2 === 0 ? 'x' : 'z';
        const face = side < 2 ? 1 : -1;
        const other = side % 2 === 0 ? keepD / 2 : keepW / 2;
        const merlonCount = 4;
        for (let i = 0; i < merlonCount; i++) {
          const t = (i / (merlonCount - 1) - 0.5) * (along - 0.1);
          const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.09), orcLogMat);
          if (axis === 'x') merlon.position.set(t, merlonY, face * other);
          else merlon.position.set(face * other, merlonY, t);
          merlon.castShadow = true;
          fortress.add(merlon);
        }
      }

      // Barred wooden gate on the face pointing toward the palisade's
      // gate gap (see generateRandomIsland - the gap sits on the -x side
      // of the fortress tile).
      const gate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.26), orcLogDarkMat);
      gate.position.set(-keepW / 2 - 0.01, 0.17, 0);
      fortress.add(gate);
      [-0.08, 0, 0.08].forEach(gz => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.025), orcIronMat);
        bar.position.set(-keepW / 2 - 0.03, 0.17, gz);
        fortress.add(bar);
      });

      // Four corner turrets rising above the parapet, each with a small
      // shingled conical roof.
      const turretR = 0.09, turretH = 0.34;
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const tx = sx * (keepW / 2), tz = sz * (keepD / 2);
        const turret = new THREE.Mesh(new THREE.CylinderGeometry(turretR, turretR, turretH, 8), orcLogMat);
        turret.position.set(tx, keepH + turretH / 2, tz);
        turret.castShadow = true;
        fortress.add(turret);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(turretR + 0.03, 0.16, 8), orcRoofMat);
        roof.position.set(tx, keepH + turretH + 0.08, tz);
        roof.castShadow = true;
        fortress.add(roof);
      });

      // Skull trophies mounted above the gate - the keep's own hostile
      // warning marker, on top of the stakes ringing the outer wall.
      [-0.06, 0.06].forEach(sx => {
        const skull = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.07), orcSkullMat);
        skull.position.set(-keepW / 2 - 0.02, 0.38, sx);
        skull.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
        skull.castShadow = true;
        fortress.add(skull);
      });

      // Taller central watch tower rising from the middle of the keep
      // roof, its own small crenellated top holding the brazier -
      // updateOrcFortress fires arrows from here (see ORC_FORTRESS_FIRE_HEIGHT).
      const towerR = 0.15, towerH = 0.55;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(towerR, towerR + 0.02, towerH, 10), orcLogMat);
      tower.position.y = keepH + towerH / 2;
      tower.castShadow = true;
      fortress.add(tower);
      [0.15, 0.32].forEach(hy => {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(towerR + 0.015, towerR + 0.015, 0.025, 10), orcIronMat);
        band.position.y = keepH + hy;
        fortress.add(band);
      });
      const towerMerlonCount = 6;
      for (let i = 0; i < towerMerlonCount; i++) {
        const angle = (i / towerMerlonCount) * Math.PI * 2;
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.05), orcLogDarkMat);
        merlon.position.set(Math.cos(angle) * towerR, keepH + towerH + 0.03, Math.sin(angle) * towerR);
        fortress.add(merlon);
      }

      // Ragged banner hanging off the watch tower.
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.24), orcBannerMat);
      banner.position.set(towerR + 0.01, keepH + towerH - 0.05, 0);
      banner.rotation.y = Math.PI / 2;
      fortress.add(banner);

      // Brazier at the top center - the arrow-loosing point updateOrcFortress
      // fires from (see ORC_FORTRESS_FIRE_HEIGHT).
      const brazierBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.07, 8), orcIronMat);
      brazierBowl.position.y = keepH + towerH + 0.09;
      fortress.add(brazierBowl);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 6), orcFireMat);
      flame.position.y = keepH + towerH + 0.16;
      fortress.add(flame);
      const brazierLight = new THREE.PointLight(0xff7a1f, 0.9, 2.2);
      brazierLight.position.y = keepH + towerH + 0.18;
      fortress.add(brazierLight);

      fortress.scale.setScalar(ORC_FORTRESS_SCALE);
      fortress.position.set(x, y, z);
      fortress.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2); // axis-aligned so the gate faces a grid direction
      addCollider(x, z, 1.42);

      return fortress;
    }

    // Orc Fortress palisade wall - a segment of the 5x5 ring surrounding
    // the watchtower (see ORC_FORTRESS_SIZE in generateRandomIsland): a
    // lashed row of sharpened log stakes, chunkier and rougher than the
    // Cemetery's iron pickets so it reads as a hostile barricade rather
    // than a tidy fence.
    function createOrcFortressWall(x, y, z) {
      const wall = new THREE.Group();
      const railHeight = 0.32;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.05, 0.05), orcIronMat);
      rail.position.y = railHeight;
      rail.castShadow = true;
      wall.add(rail);
      const stakeCount = 3;
      for (let i = 0; i < stakeCount; i++) {
        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, railHeight + 0.16, 6), orcLogDarkMat);
        stake.position.set(-0.34 + (i / (stakeCount - 1)) * 0.68, (railHeight + 0.16) / 2 - 0.05, 0);
        stake.castShadow = true;
        wall.add(stake);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 5), orcLogDarkMat);
        tip.position.set(stake.position.x, (railHeight + 0.16) - 0.05, 0);
        tip.castShadow = true;
        wall.add(tip);
      }
      wall.scale.setScalar(STRUCTURE_SCALE);
      wall.rotation.y = Math.floor(Math.random() * 2) * (Math.PI / 2); // runs along either grid axis
      wall.position.set(x, y, z);
      addCollider(x, z, 0.46 * STRUCTURE_SCALE);
      return wall;
    }

    // Same wall segment as above, but with its run direction forced
    // explicitly instead of randomized - a real perimeter needs its north/
    // south edges running east-west and its east/west edges running
    // north-south, not a coin flip. Used to ring the Castle Interior
    // courtyard (see buildCastleInteriorMap).
    function createCastleWallSegment(x, y, z, alongX) {
      const wall = createOrcFortressWall(x, y, z);
      wall.rotation.y = alongX ? 0 : Math.PI / 2;
      return wall;
    }

    // --- Castle Interior props (Assault the Castle) ---
    // Crude dressing for the walled courtyard beyond the Fortress's blown
    // gate - reuses the same log/iron/roof materials as the Fortress
    // itself (orcLogMat/orcLogDarkMat/orcRoofMat/orcIronMat) so the
    // interior reads as part of the same keep rather than a mismatched
    // new biome. See buildCastleInteriorMap for how these get scattered.

    // A single crude orc hovel - solid/unwalkable footprint, same as a
    // village House, just built out of the Fortress's own log/roof kit
    // instead of the classic biome's shingle-and-stone look.
    function createOrcHovel(x, y, z) {
      const hovel = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.7), orcLogMat);
      body.position.y = 0.25;
      body.castShadow = true;
      hovel.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.42, 4), orcRoofMat);
      roof.position.y = 0.71;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      hovel.add(roof);
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.04), orcLogDarkMat);
      doorFrame.position.set(0, 0.16, 0.36);
      hovel.add(doorFrame);
      hovel.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
      hovel.position.set(x, y, z);
      addCollider(x, z, 0.5);
      return hovel;
    }

    // A small fenced crop patch - walkable ground dressing, no collider
    // and no buildingTileKeys entry, same treatment as the classic
    // biome's marketplace stalls.
    const orcFarmSoilMat = new THREE.MeshLambertMaterial({ color: 0x4a3826 });
    const orcFarmCropMat = new THREE.MeshLambertMaterial({ color: 0x6b8f3a });
    function createOrcFarmPatch(x, y, z) {
      const farm = new THREE.Group();
      const soil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.9), orcFarmSoilMat);
      soil.position.y = 0.03;
      soil.receiveShadow = true;
      farm.add(soil);
      for (let row = -1; row <= 1; row++) {
        for (let col = -1; col <= 1; col++) {
          if (Math.random() < 0.25) continue;
          const crop = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16 + Math.random() * 0.08, 5), orcFarmCropMat);
          crop.position.set(col * 0.28, 0.1, row * 0.28);
          crop.castShadow = true;
          farm.add(crop);
        }
      }
      farm.position.set(x, y, z);
      return farm;
    }

    // A prisoner cage - open iron-bar cylinder, solid footprint (nobody
    // paths through it, same as a Cemetery fence post).
    function createOrcCage(x, y, z) {
      const cage = new THREE.Group();
      const barCount = 6;
      const radius = 0.32;
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2;
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 5), orcIronMat);
        bar.position.set(Math.cos(angle) * radius, 0.275, Math.sin(angle) * radius);
        bar.castShadow = true;
        cage.add(bar);
      }
      const topRing = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.025, 5, barCount), orcIronMat);
      topRing.rotation.x = Math.PI / 2;
      topRing.position.y = 0.55;
      cage.add(topRing);
      const bottomRing = topRing.clone();
      bottomRing.position.y = 0.02;
      cage.add(bottomRing);
      cage.position.set(x, y, z);
      addCollider(x, z, radius + 0.1);
      return cage;
    }

    // A fallen orc corpse with a blood pool beneath it - walkable ground
    // dressing, same treatment as a battlefield blood decal.
    const orcCorpseBodyMat = new THREE.MeshLambertMaterial({ color: 0x5c6b3a });
    const orcCorpsePoolMat = new THREE.MeshBasicMaterial({ color: 0x5a0f0f, transparent: true, opacity: 0.75 });
    function createOrcCorpseProp(x, y, z) {
      const corpse = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.5, 6), orcCorpseBodyMat);
      torso.rotation.z = Math.PI / 2;
      torso.position.y = 0.13;
      torso.castShadow = true;
      corpse.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), orcCorpseBodyMat);
      head.position.set(0.3, 0.13, 0);
      corpse.add(head);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.3 + Math.random() * 0.12, 10), orcCorpsePoolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.015;
      pool.userData.isBloodPool = true; // hidden while Options > Blood is Disabled
      pool.visible = bloodEnabled;
      corpse.add(pool);
      corpse.rotation.y = Math.random() * Math.PI * 2;
      corpse.position.set(x, y, z);
      return corpse;
    }

    // Scenery tree dispatcher - Desert islands get Palms and Northernlands
    // islands get Frost Pines instead of the classic Oak/Pine mix, same
    // way createChurch/createWizardTower swap to Far East structures under
    // selectedBiomeTheme === 'japan'. Shadow Island swaps in a Ruined
    // Pillar (Dungeon variant) or Dead Swamp Tree (Swamp variant) instead.
    // Kept as a single chokepoint so both island-prop placement sites
    // (main island and the small satellite islands) stay in sync
    // automatically.
    function createSceneryTree(x, y, z) {
      if (selectedBiomeTheme === 'shadowIsland') {
        return shadowIslandVariant === 'dungeon' ? createRuinPillar(x, y, z) : createDeadSwampTree(x, y, z);
      }
      if (selectedBiomeTheme === 'heaven') return createRuinPillar(x, y, z);
      if (selectedBiomeTheme === 'desert') return createDesertPalm(x, y, z);
      if (selectedBiomeTheme === 'northernlands') return createFrostPine(x, y, z);
      return Math.random() > 0.5 ? createOakTree(x, y, z) : createPineTree(x, y, z);
    }

    function createRock(x, y, z) {
      if (selectedBiomeTheme === 'shadowIsland' && shadowIslandVariant === 'dungeon') {
        return createRubblePile(x, y, z);
      }
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), stoneMat);
      rock.scale.set(1.2 * NATURE_SCALE, 0.7 * NATURE_SCALE, 1.2 * NATURE_SCALE);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.position.set(x, y + 0.1, z);
      rock.castShadow = true;
      addCollider(x, z, 0.35 * NATURE_SCALE);
      return rock;
    }

    function createBush(x, y, z) {
      const bush = new THREE.Group();
      const puffCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < puffCount; i++) {
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 + Math.random() * 0.06, 0), bushGreen);
        puff.position.set(
          (Math.random() - 0.5) * 0.18,
          0.15 + Math.random() * 0.06,
          (Math.random() - 0.5) * 0.18
        );
        puff.rotation.set(Math.random(), Math.random(), Math.random());
        puff.scale.set(1, 0.85, 1);
        puff.castShadow = true;
        bush.add(puff);
      }
      bush.scale.setScalar(NATURE_SCALE);
      bush.position.set(x, y, z);
      addCollider(x, z, 0.2 * NATURE_SCALE);
      return bush;
    }

    function createHouse(x, y, z) {
      const house = new THREE.Group();

      if (selectedBiomeTheme === 'desert') {
        // Desert Adobe House - a flat-roofed mudbrick cube with a stepped
        // parapet lip, a turquoise-trimmed mashrabiya lattice window, a
        // pointed archway over the door, and a small corner windcatcher
        // (badgir) that stands in for the classic House's gabled shingle
        // roof and stone chimney under the Desert biome.
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.65), adobeMat);
        body.position.y = 0.25;
        body.castShadow = true;

        const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.79, 0.06, 0.69), adobeDarkMat);
        parapet.position.y = 0.53;
        parapet.castShadow = true;

        // Windcatcher - a short square shaft with a trimmed cap, perched
        // on a back corner of the roof to funnel breeze down inside.
        const windcatcherShaft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.14), adobeMat);
        windcatcherShaft.position.set(-0.24, 0.72, -0.18);
        windcatcherShaft.castShadow = true;

        const windcatcherCap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.18), desertTrimMat);
        windcatcherCap.position.set(-0.24, 0.9, -0.18);

        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.03), desertTrimMat);
        doorFrame.position.set(0, 0.15, 0.325);

        // Pointed arch cresting the doorframe, matching the Desert
        // Mosque/Garrison archways rather than a flat lintel.
        const doorArch = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.13, 4), desertTrimMat);
        doorArch.rotation.y = Math.PI / 4;
        doorArch.scale.set(1, 1, 0.28);
        doorArch.position.set(0, 0.315, 0.325);
        doorArch.castShadow = true;

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.02), darkWoodMat);
        door.position.set(0, 0.14, 0.34);

        // Mashrabiya - a small turquoise-latticed window beside the door.
        const lattice = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.025), desertTrimMat);
        lattice.position.set(0.22, 0.3, 0.326);

        house.add(body, parapet, windcatcherShaft, windcatcherCap, doorFrame, doorArch, door, lattice);
      } else if (selectedBiomeTheme === 'northernlands') {
        // Viking Longhouse - a low timber hall under a steep snow-capped
        // roof, with crossed carved beam-ends jutting past the ridge at
        // the front gable (the classic Norse roofline silhouette) and a
        // round shield hung beside the door, standing in for the House's
        // shingle roof and stone chimney under the Northernlands biome.
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.42, 0.62), norseWoodMat);
        body.position.y = 0.21;
        body.castShadow = true;

        const roofGeo = new THREE.ConeGeometry(0.58, 0.52, 4);
        roofGeo.rotateY(Math.PI / 4);
        const roof = new THREE.Mesh(roofGeo, snowMat);
        roof.scale.set(1, 1, 1.05);
        roof.position.y = 0.68;
        roof.castShadow = true;

        // Crossed beam-ends poking above the ridge at the front gable.
        // Positioned close to the apex (not out toward the eaves) so
        // they sit right on the sloped roof surface instead of
        // hovering above it.
        const beam1 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 5), darkWoodMat);
        beam1.rotation.z = 0.55;
        beam1.position.set(0, 0.8, 0.12);
        beam1.castShadow = true;
        const beam2 = beam1.clone();
        beam2.rotation.z = -0.55;

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.02), darkWoodMat);
        door.position.set(0, 0.13, 0.311);

        // Round shield hung beside the door, with a small gold boss at
        // its center.
        const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12), norseFurMat);
        shield.rotation.x = Math.PI / 2;
        shield.position.set(0.26, 0.26, 0.312);
        shield.castShadow = true;
        const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), norseGoldMat);
        shieldBoss.position.set(0.26, 0.26, 0.335);

        house.add(body, roof, beam1, beam2, door, shield, shieldBoss);
      } else {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.65), woodMat);
        body.position.y = 0.25;
        body.castShadow = true;

        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.4, 4), roofRed);
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 0.7;
        roof.castShadow = true;

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.02), darkWoodMat);
        door.position.set(0, 0.125, 0.326);

        const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), stoneMat);
        chimney.position.set(-0.2, 0.65, -0.1);

        house.add(body, roof, door, chimney);
      }

      house.scale.setScalar(STRUCTURE_SCALE);
      house.position.set(x, y, z);
      house.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
      addCollider(x, z, 0.55 * STRUCTURE_SCALE);
      return house;
    }

    function createChurch(x, y, z) {
      const church = new THREE.Group();

      if (selectedBiomeTheme === 'japan') {
        // Japanese shrine (haiden hall) - a low vermilion hall under a dark
        // hip-and-gable roof, fronted by a torii gate the player walks
        // through to reach the door. Replaces the Church for The Far East.
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.6), shrineRedMat);
        body.position.y = 0.25;
        body.castShadow = true;

        const roofBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.07, 0.85), shrineRoofMat);
        roofBase.position.y = 0.535;
        roofBase.castShadow = true;

        const roofCap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.34, 4), shrineRoofMat);
        roofCap.rotation.y = Math.PI / 4;
        roofCap.position.y = 0.75;
        roofCap.castShadow = true;

        const katsuogi1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), shrineTrimMat);
        katsuogi1.rotation.z = Math.PI / 2;
        katsuogi1.position.set(0, 0.58, -0.12);
        const katsuogi2 = katsuogi1.clone();
        katsuogi2.position.set(0, 0.58, 0.12);

        const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.58, 8), shrineRedMat);
        pillarL.position.set(-0.24, 0.29, 0.78);
        pillarL.castShadow = true;
        const pillarR = pillarL.clone();
        pillarR.position.set(0.24, 0.29, 0.78);

        const kasagi = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.055, 0.06), shrineRedMat);
        kasagi.position.set(0, 0.59, 0.78);
        const nuki = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.035, 0.035), darkWoodMat);
        nuki.position.set(0, 0.44, 0.78);

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.02), darkWoodMat);
        door.position.set(0, 0.15, 0.301);

        const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), lanternMat);
        lantern.position.set(0.2, 0.44, 0.34);

        church.add(body, roofBase, roofCap, katsuogi1, katsuogi2, pillarL, pillarR, kasagi, nuki, door, lantern);
      } else if (selectedBiomeTheme === 'desert') {
        // Desert Mosque - a squat adobe prayer hall crowned by a turquoise
        // onion dome and gold finial, with a slender corner minaret of its
        // own and a pointed-arch doorway, replacing the Church/Shrine for
        // the Desert biome.
        const hall = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.62), adobeMat);
        hall.position.y = 0.21;
        hall.castShadow = true;

        const domeDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.08, 16), adobeDarkMat);
        domeDrum.position.y = 0.46;
        domeDrum.castShadow = true;

        // Onion dome - the top half of a sphere, sitting on the drum like a
        // cap over the prayer hall.
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
          desertTrimMat
        );
        dome.position.y = 0.5;
        dome.castShadow = true;

        const finialBall = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), desertGoldMat);
        finialBall.position.y = 0.68;

        const finialSpike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 6), desertGoldMat);
        finialSpike.position.y = 0.78;
        finialSpike.castShadow = true;

        // Corner minaret - a tall tapering shaft topped by its own small
        // balcony and dome cap, standing beside the prayer hall.
        const minaretShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.8, 10), adobeMat);
        minaretShaft.position.set(0.3, 0.4, -0.28);
        minaretShaft.castShadow = true;

        const minaretBalcony = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10), adobeDarkMat);
        minaretBalcony.position.set(0.3, 0.8, -0.28);
        minaretBalcony.castShadow = true;

        const minaretDome = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.13, 10), desertTrimMat);
        minaretDome.position.set(0.3, 0.9, -0.28);
        minaretDome.castShadow = true;

        const minaretSpike = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.09, 6), desertGoldMat);
        minaretSpike.position.set(0.3, 1.0, -0.28);

        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.04), desertTrimMat);
        doorFrame.position.set(0, 0.16, 0.32);

        // Pointed arch cresting the doorframe, echoing classic mosque
        // archways rather than a flat lintel.
        const doorArch = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.16, 4), desertTrimMat);
        doorArch.rotation.y = Math.PI / 4;
        doorArch.scale.set(1, 1, 0.28);
        doorArch.position.set(0, 0.36, 0.32);
        doorArch.castShadow = true;

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.02), darkWoodMat);
        door.position.set(0, 0.14, 0.34);

        church.add(
          hall, domeDrum, dome, finialBall, finialSpike,
          minaretShaft, minaretBalcony, minaretDome, minaretSpike,
          doorFrame, doorArch, door
        );
      } else if (selectedBiomeTheme === 'northernlands') {
        // Viking Great Hall - a tall timber hall under a steep, deeply
        // pitched snow-capped roof, crowned by a carved dragon-head
        // finial rearing up at the front gable and flanked by a pair of
        // standing rune stones by the doorway - replacing the Church/
        // Shrine/Mosque for the Northernlands biome.
        const hall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.7), norseWoodMat);
        hall.position.y = 0.25;
        hall.castShadow = true;

        const roofGeo = new THREE.ConeGeometry(0.52, 0.4, 4);
        roofGeo.rotateY(Math.PI / 4);
        const roof = new THREE.Mesh(roofGeo, snowMat);
        roof.scale.set(1, 1, 1.35);
        roof.position.y = 0.7;
        roof.castShadow = true;

        // Dragon-head finial - a curved neck (a tilted cone) rearing up
        // from the roof's apex, capped by an open-jawed head. The roof
        // is a 4-sided pyramid whose single ridge point sits at
        // (0, 0.9, 0) in world space (roof.position.y=0.7 + half its
        // 0.4 height); the neck's base is anchored exactly there and
        // tilted forward so nothing hangs apart from the roof surface.
        const neck = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.32, 6), darkWoodMat);
        neck.rotation.x = 0.4;
        neck.position.set(0, 1.047, 0.062);
        neck.castShadow = true;
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), darkWoodMat);
        head.rotation.x = Math.PI / 2 - 0.2;
        head.position.set(0, 1.24, 0.16);
        head.castShadow = true;

        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.03), darkWoodMat);
        doorFrame.position.set(0, 0.15, 0.36);
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.27, 0.02), darkWoodMat);
        door.position.set(0, 0.135, 0.371);

        // A pair of standing rune stones flanking the doorway, each
        // tilted slightly outward like a real weathered standing stone.
        const runeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.06), stoneMat);
        runeL.position.set(-0.32, 0.16, 0.4);
        runeL.rotation.z = 0.06;
        runeL.castShadow = true;
        const runeR = runeL.clone();
        runeR.position.set(0.32, 0.16, 0.4);
        runeR.rotation.z = -0.06;

        church.add(hall, roof, neck, head, doorFrame, door, runeL, runeR);
      } else {
        // Classic Church - a stone nave under a red gabled roof, with a
        // squarer bell tower rising behind it, capped by its own spire and
        // a cross, plus a round rosette window over the door.
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.7), stoneMat);
        body.position.y = 0.25;
        body.castShadow = true;

        // Gabled roof over the nave - a 4-sided cone stretched into a
        // ridge shape along the nave's depth axis. The 45-degree turn is
        // baked into the geometry itself (rather than set via
        // roof.rotation) so the later z-scale stretches the roof along the
        // building's actual front-to-back axis. Doing the scale on an
        // still-diagonal cone (rotation set after the fact) used to
        // produce a roof skewed off at 45 degrees that dug into the bell
        // tower behind it - this keeps the ridge running straight back
        // and clear of the tower.
        const roofGeo = new THREE.ConeGeometry(0.5, 0.32, 4);
        roofGeo.rotateY(Math.PI / 4);
        const roof = new THREE.Mesh(roofGeo, roofRed);
        roof.scale.set(1, 1, 1.4);
        roof.position.y = 0.66;
        roof.castShadow = true;

        // Bell tower - a squarer tower standing behind the nave, taller
        // than the ridge line and set far enough back to clear the
        // roof's eave.
        const tower = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.24), stoneMat);
        tower.position.set(0, 0.45, -0.42);
        tower.castShadow = true;

        // Louvred bell opening near the top of the tower.
        const belfry = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), darkWoodMat);
        belfry.position.set(0, 0.78, -0.42);

        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.32, 4), roofRed);
        spire.rotation.y = Math.PI / 4;
        spire.position.set(0, 1.06, -0.42);
        spire.castShadow = true;

        // Cross - two thin gold bars mounted above the spire tip.
        const crossVert = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.03), goldMat);
        crossVert.position.set(0, 1.3, -0.42);
        const crossHoriz = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.03), goldMat);
        crossHoriz.position.set(0, 1.34, -0.42);

        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.03), darkWoodMat);
        doorFrame.position.set(0, 0.15, 0.36);

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.27, 0.02), darkWoodMat);
        door.position.set(0, 0.135, 0.371);

        // Rosette window - a plain round window over the doorway rather
        // than an arched one.
        const windowGlass = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), glassMat);
        windowGlass.position.set(0, 0.46, 0.351);

        church.add(body, roof, tower, belfry, spire, crossVert, crossHoriz, doorFrame, door, windowGlass);
      }

      church.scale.setScalar(STRUCTURE_SCALE);
      church.position.set(x, y, z);
      church.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
      addCollider(x, z, 0.55 * STRUCTURE_SCALE);
      return church;
    }

    function createBlacksmith(x, y, z) {
      const smith = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.6), stoneMat);
      body.position.y = 0.225;
      body.castShadow = true;

      const roof = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.7), darkWoodMat);
      roof.position.y = 0.49;
      roof.castShadow = true;

      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), stoneMat);
      chimney.position.set(0.25, 0.65, -0.15);
      chimney.castShadow = true;

      const anvilBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.1, 6), steelMat);
      anvilBase.position.set(0.32, 0.05, 0.35);
      const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.06), steelMat);
      anvilTop.position.set(0.32, 0.13, 0.35);

      const door = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.02), darkWoodMat);
      door.position.set(-0.1, 0.16, 0.301);

      smith.add(body, roof, chimney, anvilBase, anvilTop, door);
      smith.scale.setScalar(STRUCTURE_SCALE);
      smith.position.set(x, y, z);
      smith.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
      addCollider(x, z, 0.55 * STRUCTURE_SCALE);
      return smith;
    }

    const wizardRoofMat = new THREE.MeshLambertMaterial({ color: 0x5533aa });
    const wizardOrbMat = new THREE.MeshLambertMaterial({ color: 0x66ffee, emissive: 0x2299aa });

    // Japanese-shrine / pagoda palette, swapped in for the Church and Wizard
    // Tower when The Far East biome theme is active (see selectedBiomeTheme).
    const shrineRedMat = new THREE.MeshLambertMaterial({ color: 0xb33b24 });
    const shrineRoofMat = new THREE.MeshLambertMaterial({ color: 0x262421 });
    const shrineTrimMat = new THREE.MeshLambertMaterial({ color: 0xf5f0e6 });
    const lanternMat = new THREE.MeshLambertMaterial({ color: 0xffaa33, emissive: 0xcc6600, emissiveIntensity: 0.5 });

    // Sun-baked adobe/sandstone palette, swapped in for the Church and
    // Wizard Tower when the Desert biome theme is active (see
    // selectedBiomeTheme) - same two "flavor" buildings The Far East
    // reskins above, just re-themed as mudbrick desert structures instead.
    const adobeMat = new THREE.MeshLambertMaterial({ color: 0xcda06a });
    const adobeDarkMat = new THREE.MeshLambertMaterial({ color: 0xa87c4a });
    const desertTrimMat = new THREE.MeshLambertMaterial({ color: 0x2ca6a0 }); // turquoise inlay, echoes the desert biome's oasis water color
    const desertGoldMat = new THREE.MeshLambertMaterial({ color: 0xe0b464 });
    const desertStripeMat = new THREE.MeshLambertMaterial({ color: 0xb5432e }); // terracotta bazaar-awning stripe

    // Weathered timber / fur palette, swapped in for the House and Church
    // when the Northernlands biome theme is active (see selectedBiomeTheme)
    // - a Viking longhouse/great-hall look standing in for the two
    // "flavor" buildings The Far East and Desert reskin above. Snow-capped
    // roofs reuse the shared snowMat rather than a dedicated color.
    const norseWoodMat = new THREE.MeshLambertMaterial({ color: 0x4a3524 });
    const norseFurMat = new THREE.MeshLambertMaterial({ color: 0x6b5a48 });
    const norseGoldMat = new THREE.MeshLambertMaterial({ color: 0xc9a84a });

    // Viking Shaman Temple / Shaman palette - the Northernlands' reskin of the
    // Wizard Tower and its resident. Rune glow is an aurora teal (cold-sky
    // cousin of the classic tower's cyan orb) so the temple still reads as
    // the "magic" building at a glance.
    const shamanRobeMat = new THREE.MeshLambertMaterial({ color: 0x35516a });
    const shamanFurMat = new THREE.MeshLambertMaterial({ color: 0xe6e1d3 });
    const shamanBeardMat = new THREE.MeshLambertMaterial({ color: 0xd8d4c8 });
    const shamanRuneMat = new THREE.MeshLambertMaterial({ color: 0x7dffd8, emissive: 0x1fa88a });

    function createWizardTower(x, y, z) {
      const tower = new THREE.Group();

      if (selectedBiomeTheme === 'japan') {
        // Japanese pagoda - three stacked, shrinking vermilion tiers under
        // dark overhanging roofs, topped with a golden sorin spire and
        // finial. Replaces the Wizard Tower for The Far East.
        const tier1Body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), shrineRedMat);
        tier1Body.position.y = 0.2;
        tier1Body.castShadow = true;
        const tier1Roof = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.62), shrineRoofMat);
        tier1Roof.position.y = 0.435;
        tier1Roof.castShadow = true;

        const tier2Body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), shrineRedMat);
        tier2Body.position.y = 0.63;
        tier2Body.castShadow = true;
        const tier2Roof = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.48), shrineRoofMat);
        tier2Roof.position.y = 0.82;
        tier2Roof.castShadow = true;

        const tier3Body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), shrineRedMat);
        tier3Body.position.y = 0.97;
        tier3Body.castShadow = true;
        const tier3Roof = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 4), shrineRoofMat);
        tier3Roof.rotation.y = Math.PI / 4;
        tier3Roof.position.y = 1.16;
        tier3Roof.castShadow = true;

        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 6), goldMat);
        spire.position.y = 1.42;

        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 8), goldMat);
        ring1.rotation.x = Math.PI / 2;
        ring1.position.y = 1.32;
        const ring2 = ring1.clone();
        ring2.position.y = 1.46;

        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), goldMat);
        finial.position.y = 1.6;

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.26, 0.02), darkWoodMat);
        door.position.set(0, 0.13, 0.211);

        const window1 = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), glassMat);
        window1.position.set(0, 0.63, 0.161);

        tower.add(tier1Body, tier1Roof, tier2Body, tier2Roof, tier3Body, tier3Roof, spire, ring1, ring2, finial, door, window1);
      } else if (selectedBiomeTheme === 'desert') {
        // Desert Sand Spire - a tapering adobe minaret in place of the
        // stone Wizard Tower, banded with turquoise trim (echoing the
        // Desert biome's oasis water color) and topped with a golden
        // crescent finial instead of the stone tower's glowing orb.
        const baseWide = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.5, 8), adobeMat);
        baseWide.position.y = 0.25;
        baseWide.castShadow = true;

        const baseNarrow = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.5, 8), adobeDarkMat);
        baseNarrow.position.y = 0.75;
        baseNarrow.castShadow = true;

        const trimBand = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.06, 8), desertTrimMat);
        trimBand.position.y = 1.02;

        const capTop = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 8), adobeMat);
        capTop.position.y = 1.25;
        capTop.castShadow = true;

        const finialBase = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6), desertGoldMat);
        finialBase.position.y = 1.52;

        const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 12, Math.PI * 1.5), desertGoldMat);
        crescent.rotation.x = Math.PI / 2;
        crescent.position.y = 1.64;

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.02), darkWoodMat);
        door.position.set(0, 0.15, 0.33);

        const window1 = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), desertTrimMat);
        window1.position.set(0, 0.85, 0.27);

        tower.add(baseWide, baseNarrow, trimBand, capTop, finialBase, crescent, door, window1);
      } else if (selectedBiomeTheme === 'northernlands') {
        // Viking Shaman Temple - a stepped timber stave temple with two
        // snow-capped roofs on a low stone platform, dark dragon-horn
        // finials at the lower roof's corners, and a pair of glowing rune
        // stones flanking the door. Replaces the Wizard Tower for the
        // Northernlands biome.
        const platform = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.76), stoneMat);
        platform.position.y = 0.04;
        platform.castShadow = true;

        const hall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.5), norseWoodMat);
        hall.position.y = 0.25; // spans 0.08 - 0.42
        hall.castShadow = true;

        const lowerRoofGeo = new THREE.ConeGeometry(0.44, 0.2, 4);
        lowerRoofGeo.rotateY(Math.PI / 4);
        const lowerRoof = new THREE.Mesh(lowerRoofGeo, snowMat);
        lowerRoof.position.y = 0.52; // base at 0.42, tip at 0.62
        lowerRoof.castShadow = true;

        const upperHall = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.26), norseWoodMat);
        upperHall.position.y = 0.65; // spans 0.50 - 0.80, base buried in the lower roof
        upperHall.castShadow = true;

        const upperRoofGeo = new THREE.ConeGeometry(0.28, 0.3, 4);
        upperRoofGeo.rotateY(Math.PI / 4);
        const upperRoof = new THREE.Mesh(upperRoofGeo, snowMat);
        upperRoof.position.y = 0.95; // base at 0.80, tip at 1.10
        upperRoof.castShadow = true;

        // Dragon-horn finials leaning outward off each corner of the lower roof.
        const finialGeo = new THREE.ConeGeometry(0.022, 0.2, 5);
        const cornerFinials = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => {
          const f = new THREE.Mesh(finialGeo, darkWoodMat);
          f.position.set(sx * 0.29, 0.5, sz * 0.29);
          f.rotation.z = -sx * 0.55;
          f.rotation.x = sz * 0.55;
          f.castShadow = true;
          return f;
        });

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.26, 0.02), darkWoodMat);
        door.position.set(0, 0.21, 0.251); // hall's front face sits at z = 0.25
        const doorRune = new THREE.Mesh(new THREE.CircleGeometry(0.035, 8), shamanRuneMat);
        doorRune.position.set(0, 0.385, 0.252);

        // Standing rune stones out front, each carved with a glowing glyph.
        const runeStoneGeo = new THREE.BoxGeometry(0.08, 0.3, 0.06);
        const runeGlyphGeo = new THREE.PlaneGeometry(0.035, 0.12);
        const runeStones = [-0.24, 0.24].map(sx => {
          const stone = new THREE.Mesh(runeStoneGeo, stoneMat);
          stone.position.set(sx, 0.23, 0.33);
          stone.castShadow = true;
          const glyph = new THREE.Mesh(runeGlyphGeo, shamanRuneMat);
          glyph.position.set(sx, 0.25, 0.361);
          return [stone, glyph];
        }).flat();

        tower.add(
          platform, hall, lowerRoof, upperHall, upperRoof,
          ...cornerFinials, door, doorRune, ...runeStones
        );
      } else {
        // Classic Wizard Tower - a round stone tower under a tall purple
        // conical roof, topped with a glowing cyan orb on a short spire.
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 1.0, 8), stoneMat);
        shaft.position.y = 0.5;
        shaft.castShadow = true;

        const roofCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 8), darkWoodMat);
        roofCollar.position.y = 1.03;
        roofCollar.castShadow = true;

        const roofCone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 8), wizardRoofMat);
        roofCone.position.y = 1.3;
        roofCone.castShadow = true;

        const finialSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), steelMat);
        finialSpire.position.y = 1.66;

        // Glowing orb - the tower's signature, floating just above the
        // spire tip.
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), wizardOrbMat);
        orb.position.y = 1.82;

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.02), darkWoodMat);
        door.position.set(0, 0.15, 0.301);

        const window1 = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), wizardOrbMat);
        window1.position.set(0, 0.65, 0.261);

        const window2 = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), wizardOrbMat);
        window2.position.set(0.2, 0.85, 0.18);
        window2.rotation.y = -Math.PI / 4;

        tower.add(shaft, roofCollar, roofCone, finialSpire, orb, door, window1, window2);
      }

      tower.scale.setScalar(STRUCTURE_SCALE);
      tower.position.set(x, y, z);
      tower.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
      addCollider(x, z, 0.4 * STRUCTURE_SCALE);
      return tower;
    }

    // --- WIZARD TOWER RESIDENT NPCs (Cleric / Apprentice Mage) ---
    const clericRobeMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    const clericTrimMat = new THREE.MeshLambertMaterial({ color: 0xdaa520 });
    const mageRobeMat = new THREE.MeshLambertMaterial({ color: 0x6633aa });
    const mageTrimMat = new THREE.MeshLambertMaterial({ color: 0x99ccff });
    const mageOrbMat = new THREE.MeshLambertMaterial({ color: 0x66ffee, emissive: 0x2299aa });
    // Monk (Far East Wizard Tower/Pagoda resident) - warm saffron robe with
    // a pale rope sash, no hood (bald head instead).
    const monkRobeMat = new THREE.MeshLambertMaterial({ color: 0xb5651d });
    const monkTrimMat = new THREE.MeshLambertMaterial({ color: 0xf0e6d2 });

    function createSpecialVillagerMesh(kind) {
      // kind: 'cleric', 'monk', 'shaman', or a fallback mage-robed villager
      const group = new THREE.Group();
      const skinMat = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
      const robeMat = kind === 'cleric' ? clericRobeMat : (kind === 'monk' ? monkRobeMat : (kind === 'shaman' ? shamanRobeMat : mageRobeMat));
      const trimMat = kind === 'cleric' ? clericTrimMat : (kind === 'monk' ? monkTrimMat : (kind === 'shaman' ? shamanFurMat : mageTrimMat));

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.46, 0.19), robeMat);
      body.position.y = 0.34;
      body.castShadow = true;
      group.add(body);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), skinMat);
      head.position.y = 0.68;
      head.castShadow = true;
      group.add(head);

      if (kind === 'monk') {
        // Bald head - no hood - plus a pale rope sash tied at the waist.
        const sash = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.2), trimMat);
        sash.position.y = 0.24;
        sash.castShadow = true;
        group.add(sash);
      } else if (kind === 'shaman') {
        // Viking Shaman - a shaggy fur mantle over the shoulders, a long
        // grey beard, and a bone skull-cap crowned with a pair of antlers
        // (no hood).
        const mantle = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.26), trimMat);
        mantle.position.y = 0.57;
        mantle.castShadow = true;
        group.add(mantle);

        const beard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.17, 0.05), shamanBeardMat);
        beard.position.set(0, 0.6, 0.12);
        beard.castShadow = true;
        group.add(beard);

        const skullCap = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.07, 0.25), boneMat);
        skullCap.position.y = 0.8;
        skullCap.castShadow = true;
        group.add(skullCap);

        [-1, 1].forEach(side => {
          const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.22, 5), boneMat);
          beam.position.set(side * 0.11, 0.93, 0);
          beam.rotation.z = -side * 0.5;
          const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.013, 0.11, 5), boneMat);
          tine.position.set(side * 0.167, 0.99, 0);
          tine.rotation.z = -side * 0.9;
          group.add(beam, tine);
        });
      } else {
        const hood = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 8), robeMat);
        hood.position.y = 0.88;
        hood.castShadow = true;
        group.add(hood);
      }

      const armGeo = new THREE.BoxGeometry(0.08, 0.26, 0.08);
      const armL = createVillagerLimb(armGeo, robeMat, -0.18, 0.56, 0);
      const armR = createVillagerLimb(armGeo, robeMat, 0.18, 0.56, 0);
      group.add(armL, armR);

      const legGeo = new THREE.BoxGeometry(0.1, 0.22, 0.1);
      const legL = new THREE.Mesh(legGeo, robeMat);
      legL.position.set(-0.07, 0.11, 0);
      legL.castShadow = true;
      const legR = new THREE.Mesh(legGeo, robeMat);
      legR.position.set(0.07, 0.11, 0);
      legR.castShadow = true;
      group.add(legL, legR);

      // Staff is attached to the right-hand pivot (armR) so it swings and
      // rotates together with the arm instead of floating independently.
      if (kind === 'cleric') {
        const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), trimMat);
        staff.position.set(0.05, -0.15, 0.03);
        staff.castShadow = true;
        const symbol = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 10), trimMat);
        symbol.position.set(0.05, 0.11, 0.03);
        armR.add(staff, symbol);
      } else if (kind === 'monk') {
        // Plain wooden bo staff - no orb or holy symbol, just a fighting staff.
        const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.65, 6), darkWoodMat);
        staff.position.set(0.05, -0.22, 0.03);
        staff.castShadow = true;
        const capL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6), trimMat);
        capL.position.set(0.05, -0.545, 0.03);
        const capR = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6), trimMat);
        capR.position.set(0.05, 0.105, 0.03);
        armR.add(staff, capL, capR);
      } else if (kind === 'shaman') {
        // Gnarled wooden staff forked at the top like a pair of antlers,
        // cradling a glowing teal rune-orb - held in the right-hand pivot
        // so it swings with the arm.
        const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.62, 6), darkWoodMat);
        staff.position.set(0.05, -0.2, 0.03);
        staff.castShadow = true;
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), shamanRuneMat);
        orb.position.set(0.05, 0.15, 0.03);
        const prongL = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 5), boneMat);
        prongL.position.set(0.005, 0.13, 0.03);
        prongL.rotation.z = 0.45;
        const prongR = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 5), boneMat);
        prongR.position.set(0.095, 0.13, 0.03);
        prongR.rotation.z = -0.45;
        armR.add(staff, orb, prongL, prongR);
      } else {
        const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6), trimMat);
        staff.position.set(0.05, -0.13, 0.03);
        staff.rotation.z = 0.1;
        staff.castShadow = true;
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mageOrbMat);
        orb.position.set(0.07, 0.15, 0.03);
        armR.add(staff, orb);
      }

      group.userData = { idlePhase: Math.random() * Math.PI * 2, legL, legR, armL, armR, walkTimer: 0 };
      return group;
    }

    // Apprentice Mage NPC uses the exact same model as a player Mage squad unit
    // (same humanoid rig, robe color, and staff) so it's visually identical in the field.
    function createApprenticeMageMesh() {
      const mageColor = (CLASS_DEFS.find(d => d.type === 'mages') || {}).color || 0x8a3fc9;
      const mesh = createBlockyHumanoid(mageColor, false);
      equipUnit(mesh, 'mages');

      // Hold the staff out horizontally (rolled flat) instead of the default
      // upright forward-casting angle used by the player Mages squad. Also
      // level the arm itself so the staff reads as flat/horizontal, not
      // angled upward by the default casting arm pose.
      const staffMesh = mesh.userData.handR.children[0];
      if (staffMesh) {
        staffMesh.rotation.x = Math.PI / 2;
      }
      mesh.userData.armR.rotation.set(-Math.PI / 2, 0, 0);
      mesh.userData.armL.rotation.set(-Math.PI / 2, 0, 0);

      // This NPC doesn't participate in the HP/combat-log system, so drop the
      // DOM health-bar element createBlockyHumanoid attaches by default.
      if (mesh.userData.hpElement) {
        mesh.userData.hpElement.remove();
        mesh.userData.hpElement = null;
        mesh.userData.hpFillElement = null;
      }

      // Player squads are rendered at 0.6 scale - match that so the NPC is the
      // same size/proportions you see in your own Mages squad.
      mesh.scale.set(0.6, 0.6, 0.6);
      return mesh;
    }

    function spawnSpecialNpc(x, y, z, kind) {
      const mesh = kind === 'apprenticeMage' ? createApprenticeMageMesh() : createSpecialVillagerMesh(kind);
      const angle = Math.random() * Math.PI * 2;
      const doorOffset = VILLAGER_HOME_CLEARANCE;
      mesh.position.set(x + Math.cos(angle) * doorOffset, y, z + Math.sin(angle) * doorOffset);
      islandGroup.add(mesh);

      villagers.push({
        mesh,
        home: { x, y, z },
        wanderTarget: { x: mesh.position.x, z: mesh.position.z },
        wanderCooldown: 1 + Math.random() * 2,
        hidden: false,
        fleeing: false,
        roaming: false,
        roamPath: [],
        roamWaypoint: 0,
        roamSpeed: 0.5 + Math.random() * 0.2,
        npcKind: kind,
        assisting: false,
        healCooldown: 0,
        attackCooldown: 0,
        // The Cleric and Apprentice Mage stand and fight instead of hiding,
        // so unlike regular villagers (who die in one hit if caught) they
        // have a small HP pool a raider has to chip through first.
        hp: NPC_MAX_HP,
        maxHp: NPC_MAX_HP,
        npcAttackCooldown: 0,
        dead: false,
      });
    }

    function createMarketplace(x, y, z) {
      const market = new THREE.Group();

      if (selectedBiomeTheme === 'desert') {
        // Desert Souk Stall - a striped bazaar awning peaked like a market
        // tent over a low adobe counter, hung with terracotta jars and a
        // rolled rug, replacing the wooden stand and flat gold canopy for
        // the Desert biome.
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.6), adobeMat);
        base.position.y = 0.03;
        base.castShadow = true;

        const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6);
        const postPositions = [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]];
        const posts = postPositions.map(([px, pz]) => {
          const post = new THREE.Mesh(postGeo, adobeDarkMat);
          post.position.set(px, 0.28, pz);
          post.castShadow = true;
          return post;
        });

        // Striped canopy - a flat terracotta slab topped by a shallow
        // turquoise-trimmed tent peak, reading as a bazaar awning rather
        // than the flat gold roof of the classic stall.
        const canopyBase = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.05, 0.72), desertStripeMat);
        canopyBase.position.y = 0.54;
        canopyBase.castShadow = true;

        const canopyPeak = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.18, 4), desertTrimMat);
        canopyPeak.rotation.y = Math.PI / 4;
        canopyPeak.scale.set(1, 1, 0.72);
        canopyPeak.position.y = 0.66;
        canopyPeak.castShadow = true;

        const jarGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.14, 8);
        const jar1 = new THREE.Mesh(jarGeo, adobeDarkMat);
        jar1.position.set(0.2, 0.1, 0);
        jar1.castShadow = true;
        const jar2 = new THREE.Mesh(jarGeo, adobeDarkMat);
        jar2.position.set(0.28, 0.1, 0.12);
        jar2.castShadow = true;

        // Rolled rug leaning against a back post.
        const rug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), roofRed);
        rug.rotation.z = Math.PI / 2;
        rug.position.set(-0.28, 0.24, -0.24);
        rug.castShadow = true;

        market.add(base, canopyBase, canopyPeak, ...posts, jar1, jar2, rug);
      } else {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.6), woodMat);
        base.position.y = 0.03;
        base.castShadow = true;

        const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6);
        const postPositions = [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]];
        const posts = postPositions.map(([px, pz]) => {
          const post = new THREE.Mesh(postGeo, woodMat);
          post.position.set(px, 0.28, pz);
          post.castShadow = true;
          return post;
        });

        const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.7), goldMat);
        canopy.position.y = 0.56;
        canopy.castShadow = true;

        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), woodMat);
        crate.position.set(0.2, 0.1, 0);
        crate.castShadow = true;

        market.add(base, canopy, ...posts, crate);
      }

      market.position.set(x, y, z);
      market.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
      addCollider(x, z, 0.5);
      return market;
    }

    const barracksFlagMat = new THREE.MeshLambertMaterial({ color: 0x992222 });

    function createBarracks(x, y, z) {
      const barracks = new THREE.Group();

      if (selectedBiomeTheme === 'desert') {
        // Desert Garrison - crenellated adobe walls with a pointed-arch
        // doorway and a crescent-topped banner, standing in for the
        // leather-and-timber Barracks and its flat wood roof under the
        // Desert biome.
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.55), adobeMat);
        body.position.y = 0.2;
        body.castShadow = true;

        const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.59), adobeDarkMat);
        parapet.position.y = 0.44;
        parapet.castShadow = true;

        // Crenellations - a row of small merlons along the parapet's front
        // edge, the classic notched fort-wall silhouette.
        const merlonGeo = new THREE.BoxGeometry(0.1, 0.08, 0.06);
        const merlonXs = [-0.38, -0.19, 0, 0.19, 0.38];
        const merlons = merlonXs.map(mx => {
          const m = new THREE.Mesh(merlonGeo, adobeDarkMat);
          m.position.set(mx, 0.52, 0.26);
          m.castShadow = true;
          return m;
        });

        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.03), desertTrimMat);
        doorFrame.position.set(0, 0.15, 0.276);

        const doorArch = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.14, 4), desertTrimMat);
        doorArch.rotation.y = Math.PI / 4;
        doorArch.scale.set(1, 1, 0.24);
        doorArch.position.set(0, 0.315, 0.276);
        doorArch.castShadow = true;

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.02), darkWoodMat);
        door.position.set(0, 0.14, 0.29);

        const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), adobeDarkMat);
        flagPole.position.set(0.4, 0.6, -0.2);
        flagPole.castShadow = true;

        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.01), roofRed);
        flag.position.set(0.48, 0.75, -0.2);

        // Crescent finial atop the flagpole, echoing the Sand Spire's
        // golden crescent instead of a bare pole tip.
        const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI * 1.5), desertGoldMat);
        crescent.rotation.x = Math.PI / 2;
        crescent.position.set(0.4, 0.82, -0.2);

        barracks.add(body, parapet, ...merlons, doorFrame, doorArch, door, flagPole, flag, crescent);
      } else {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.55), leatherMat);
        body.position.y = 0.2;
        body.castShadow = true;

        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.65), darkWoodMat);
        roof.position.y = 0.45;
        roof.castShadow = true;

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.02), darkWoodMat);
        door.position.set(0, 0.14, 0.276);

        const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), woodMat);
        flagPole.position.set(0.4, 0.6, -0.2);
        flagPole.castShadow = true;

        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.01), barracksFlagMat);
        flag.position.set(0.48, 0.75, -0.2);

        barracks.add(body, roof, door, flagPole, flag);
      }

      barracks.scale.setScalar(STRUCTURE_SCALE);
      barracks.position.set(x, y, z);
      barracks.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
      addCollider(x, z, 0.55 * STRUCTURE_SCALE);
      return barracks;
    }

    let spawnedSpecial = { church: false, blacksmith: false, wizardTower: false, barracks: false };
    let barracksTile = null; // {x, z} of the island's Barracks, if one has been built - a fleeing horse's hiding spot

    // Cemetery / Undertaker House tracking - only set on islands where the
    // Cemetery structure (see CEMETERY_SPAWN_CHANCE in generateRandomIsland)
    // actually generated. The Undertaker NPC below only ever spawns when
    // both undertakerHouseTile and undertakerGateTile are non-null, i.e.
    // when the Cemetery AND its Undertaker House both exist on the island.
    let undertakerHouseTile = null; // {x, z} world tile of the Undertaker House
    let undertakerGateTile = null;  // {x, z} the single walkable gap left in the graveyard fence ring
    let undertaker = null; // { mesh, state, path, waypoint, target, carryMesh, scanTimer, deliverTimer }
    // Demonic Portal tile (see DEMONIC_PORTAL_SPAWN_CHANCE in
    // generateRandomIsland) - non-null only when this island's Dungeon
    // variant actually rolled a Portal. Read by maybeOpenDemonPortal,
    // called at the start of every wave, to decide where a Demon squad
    // materializes when the portal opens.
    let demonPortalTile = null; // {x, z} world tile of the Demonic Portal

    // Scarecrow (Demon faction) - a rare Shadow Island Swamp raider that
    // stands on an island as an ordinary-looking scarecrow prop until a
    // wave starts and it wakes up and attacks (see SCARECROW_SPAWN_CHANCE
    // in generateRandomIsland, createScarecrowProp, and maybeAwakenScarecrow
    // called from startWave). scarecrowTile/scarecrowMesh are only non-null
    // while a dormant scarecrow is actually standing on the current island.
    const SCARECROW_SPAWN_CHANCE = 0.2;   // chance a Swamp island generates a scarecrow at all
    const SCARECROW_AWAKEN_CHANCE = 0.25; // chance, each wave, that a dormant scarecrow wakes up
    const SCARECROW_HP = 250;             // lone raider standing in for a whole warband
    // Terrify - when it wakes, every defender within this many world tiles
    // recoils away from it and can't attack for SCARECROW_TERRIFY_DURATION
    // seconds (see scarecrowTerrify).
    const SCARECROW_TERRIFY_RADIUS = 2.6;
    const SCARECROW_TERRIFY_DURATION = 1.6;
    const SCARECROW_TERRIFY_RECOIL = 2.2;
    // Drain - fraction of the damage a landed hit actually deals that it
    // heals back (see scarecrowDrain).
    const SCARECROW_DRAIN_HEAL_FRACTION = 0.4;
    const SCARECROW_STRAW_COLOR = 0xd6b44a;
    const SCARECROW_BURLAP_COLOR = 0xa8854f;
    const SCARECROW_CLOTH_COLOR = 0x3b2a33;
    const SCARECROW_EYE_GLOW = 0xff4a1a;
    const SCARECROW_THEME = { body: SCARECROW_CLOTH_COLOR, pants: 0x241a20, headbandColor: null };
    let scarecrowTile = null; // {x, z} world tile of the dormant Scarecrow
    let scarecrowMesh = null; // the dormant Scarecrow prop currently standing on that tile
    let scarecrowFarm = null; // { houseRotY } - set when the Scarecrow got a full farm (see 'farmHouse'/'wheat' in generateRandomIsland)

    // Gargoyle Statue (new raider) - a Shadow Island Dungeon-only pair of
    // ordinary-looking stone statues that stand on land until a wave
    // starts, at which point each independently rolls a chance to crack
    // open and take flight as a live Gargoyle raider (see
    // GARGOYLE_STATUE_COUNT in generateRandomIsland, createGargoyleStatueProp,
    // and maybeAwakenGargoyles called from startWave) - the same
    // dormant-prop-wakes-on-wave-start pattern as the Scarecrow above,
    // just two of them, Dungeon-only, and the awakened form flies and
    // fights at range with a thrown stone bolt instead of melee.
    // gargoyleTiles/gargoyleMeshesByTile track dormant statues by tile
    // key, one entry per statue still standing on the current island.
    const GARGOYLE_STATUE_COUNT = 2;      // exactly two Gargoyle Statues per Dungeon island
    const GARGOYLE_AWAKEN_CHANCE = 0.25;  // chance, each wave, that a given dormant statue wakes
    const GARGOYLE_HP = 150;              // per awakened Gargoyle - two can wake, so lighter than the Scarecrow's 250
    const GARGOYLE_HOVER_HEIGHT = 0.9;    // fixed flight altitude above the ground it'd otherwise stand on
    const GARGOYLE_STONE_COLOR = 0x6e7378;
    const GARGOYLE_EYE_GLOW = 0xff8a1a;
    const GARGOYLE_THEME = { body: GARGOYLE_STONE_COLOR, pants: 0x4b4f52, headbandColor: null };
    let gargoyleTiles = [];  // [{x, z}, ...] world tiles of dormant Gargoyle Statues currently standing
    let gargoyleMeshesByTile = {}; // "x,z" tile key -> that statue's prop mesh, so maybeAwakenGargoyles can find it without needing generateRandomIsland's function-local propMeshes map

    // Orc Fortress tile (see ORC_FORTRESS_SPAWN_CHANCE in generateRandomIsland)
    // - non-null only when the Classic biome rolled one on island generation.
    // A hostile landmark rather than a raider spawn point: updateOrcFortress
    // (called every frame from animate) reads this each tick to shoot arrows
    // at any player/militia squad that wanders within ORC_FORTRESS_RANGE
    // tiles of it. orcFortressCooldown gates how often it can loose a shot.
    let orcFortressTile = null; // {x, z} world tile of the Orc Fortress
    // Gate tile of the Orc Fortress - the one walkable opening in its
    // otherwise-solid 5x5 footprint (see the fortress placement block in
    // generateRandomIsland). maybeSpawnOrcWarband spawns squads here
    // rather than at orcFortressTile, since orcFortressTile is the keep's
    // own center - solid/unwalkable on every side within the footprint -
    // and a squad placed there had no walkable neighbor to step onto,
    // leaving it stuck in place forever.
    let orcFortressGateTile = null;
    // The wall ring's 4 orthogonal edge-midpoint tiles (N/E/S/W) - the
    // only wall segments close enough to the keep to ever double as the
    // gate (see ORC_FORTRESS_SIEGE_RANGE) - and which one is currently
    // the open gap. Set up once per Fortress in generateRandomIsland;
    // relocateOrcFortressGate swaps the gap to whichever side a squad is
    // actually attacking from instead of leaving it fixed forever.
    let orcFortressSideTiles = null; // { N, E, S, W } -> { x, z }
    let orcFortressOpenSide = null;
    // 'x,z' -> mesh, for just those 4 side tiles - lets
    // relocateOrcFortressGate reseal/reopen a specific segment without
    // needing a reference into generateRandomIsland's own local
    // propMeshes map.
    let orcFortressWallMeshes = {};
    // Every mesh that visually makes up the Fortress (the keep plus each
    // palisade wall segment) - what a mouse click on the Fortress is tested
    // against. See hitOrcFortress: these are Groups, so the ground-tile
    // raycast (which doesn't look inside Groups) can't see them itself.
    let orcFortressPickMeshes = [];
    let orcFortressCooldown = 0;
    // Siegeable state for the Orc Fortress - tapping the keep (see the
    // pointerup handler) opens #orc-fortress-panel with a Siege button;
    // pressing it sends the currently selected squad to march to
    // orcFortressGateTile and start chipping away at orcFortressHp once
    // in range (see updateSquadsSiegingOrcFortress). hp/maxHp are set the
    // moment the fortress spawns (see the 'orcFortress' propPlan branch)
    // and reset to null-ish alongside orcFortressTile whenever a fresh
    // island rolls one - or doesn't. orcFortressHpFillElement mirrors the
    // watch tower's hpFillElement pattern, just driving the panel's own
    // bar instead of a screen-space floating one.
    let orcFortressHp = 0;
    let orcFortressMaxHp = 0;
    let orcFortressDestroyed = false;
    let orcFortressHpFillElement = null;
    // True once a planted charge has gone off (see
    // detonateOrcFortressExplosives) - the Fortress stops firing arrows
    // (updateOrcFortress) and mustering warbands (maybeSpawnOrcWarband)
    // from this point on, but the keep itself still stands until its
    // defenders are cleared out in the Assault (see orcFortressAssaultActive
    // and updateOrcFortressAssault) that finally brings it down for good.
    let orcFortressUnarmed = false;
    // True for the duration of the Assault the Castle battle, from the
    // moment startFortressAssault musters the last defenders until
    // updateOrcFortressAssault confirms every one of them is dead.
    let orcFortressAssaultActive = false;
    // True once the captured Fortress has been fought back down to 0 HP by
    // raiders (see updateRaidersAttackingCapturedFortress/razeCapturedFortress)
    // - it stays standing but permanently stops offering the Captured
    // Fortress panel (Garrison/Heal/Replenish) or being a raider target
    // from that point on, same "still there, no longer functional" shape
    // as a razed structure elsewhere in this file. Reset alongside every
    // other orcFortress* flag whenever a fresh island does/doesn't roll one.
    let orcFortressRazed = false;
    // Pseudo-"squad" target object ({ group: { position } }) standing in
    // for the captured Fortress once it's the player's - see
    // findRaiderTarget's capturedFortressTarget candidate and
    // updateRaidersAttackingCapturedFortress for what happens once a
    // warband picks it and closes in. Same shape as a Watch Tower entry
    // (see createWatchTower's build step), just a single persistent
    // object instead of an array, since there's only ever one Fortress.
    // Null whenever there's no standing captured Fortress to attack (not
    // yet captured, or already razed).
    let capturedFortressTarget = null;

    // --- Castle Interior (Assault the Castle) ---
    // True while the player is inside the walled courtyard map beyond the
    // blown gate (see enterCastleInterior) rather than out on the main
    // island - drives the Start Wave button's disabled state (updateWaveUI)
    // and the Retreat button's visibility. Set back to false by
    // retreatToOuterIsland, whether the assault was won or abandoned.
    let inCastleInterior = false;
    // True once every defender squad mustered inside the interior has been
    // wiped (see updateOrcFortressAssault) - the actual FORTRESS CONQUERED!
    // payoff and keep teardown (destroyOrcFortress) are deferred until the
    // player actually retreats back outside, since the outer island's own
    // orcFortressTile/heightMap aren't the live map while inside.
    let castleInteriorCleared = false;
    // Everything enterCastleInterior needs retreatToOuterIsland to undo:
    // the specific heightMap/buildingTileKeys keys and collider count it
    // added (so the outer island's own tiles are restored exactly, never
    // wholesale-cleared), the outer raiderSquads it stashed out of the
    // active array, the camera/controls pose to snap back to, and each
    // player squad's pre-assault position. Null whenever inCastleInterior
    // is false.
    let castleInteriorState = null;
    // How many defenders survived the last abandoned assault, carried over
    // so retreating doesn't hand the garrison back to full strength - null
    // means no assault has been attempted yet (or the last one wiped every
    // defender/conquered the fortress), so the next entry musters a fresh
    // full garrison as normal. Set by retreatToOuterIsland when the player
    // retreats with defenders still alive, read by enterCastleInterior to
    // spawn only that many orcs next attempt, and cleared once the fortress
    // is actually conquered/destroyed (a torn-down keep has no garrison to
    // remember) - see destroyOrcFortress.
    let orcFortressSurvivingDefenderCount = null;
    const ORC_FORTRESS_MAX_HP = 1400;
    // How close a squad's center has to be to the keep (orcFortressTile)
    // before it can start sieging - the gate tile sits 2 tiles out from
    // the keep's center (see orcFortressGateTile), and the keep's own
    // footprint is solid/unwalkable, so a squad can never actually stand
    // any closer than the gate. A little slack past that exact distance
    // absorbs squad-collision jitter while it settles in.
    const ORC_FORTRESS_SIEGE_RANGE = 2.3;

    // Siege Tent - a free-standing healing structure that always spawns a
    // safe distance from the Fortress's gate whenever one rolls (see the
    // orcFortressWillSpawn placement block in generateRandomIsland), and is
    // torn down the moment that Fortress falls for good (see
    // destroyOrcFortress/removeSiegeTent) - it never outlives its own
    // Fortress's siege. Tapping it (see the pointerup handler's
    // siege-tent-tap check) opens #siege-tent-panel with a Heal button.
    let siegeTentTile = null; // {x, z} world tile of the Siege Tent, or null if this island has no Fortress (or found nowhere to fit one)
    let siegeTentMesh = null;
    const SIEGE_TENT_HEAL_RANGE = 3.0; // tiles - how close a squad has to be camped to be healed
    const SIEGE_TENT_HEAL_AMOUNT = 40; // flat HP restored per wounded member, per use
    const SIEGE_TENT_HEAL_COST = 10; // gold per use - only actually charged if it healed someone (see useSiegeTentHeal)

    // Watch Tower - the Siege Engineer squad's ability (see the 'siege'
    // CLASS_DEFS entry and updateSiegeEngineerSupport). Unlike the Orc
    // Fortress/Demonic Portal, this is a player-built structure rather
    // than a terrain-generation landmark, so it isn't reset by
    // generateRandomIsland's heightMap/propPlan clearing - it's torn
    // down explicitly instead (see the reset block below).
    // watchTowers holds every currently-standing tower: { x, z, mesh, hp,
    // maxHp, hpElement, hpFillElement, cooldown, operatorSquad, group }.
    // Multiple can stand at once - one per Siege Engineer squad the
    // player has fielded (see maybeStartWatchTowerBuild).
    let watchTowers = [];
    // watchTowerBuilds holds every in-progress build: { x, z, timer,
    // duration, mesh, dustCooldown, squad }.
    let watchTowerBuilds = [];
    // Total Watch Towers started (finished or not) so far this run,
    // across every Siege Engineer squad combined. Without a cap here a
    // run with several Siege Engineer squads, each free to rebuild after
    // its own tower falls, could keep chaining replacement towers
    // indefinitely. Reset to 0 alongside watchTowers/watchTowerBuilds on
    // a fresh run (see the generateRandomIsland reset block).
    let watchTowersBuiltCount = 0;
    const WATCH_TOWER_BUILD_LIMIT = 4;

    // Rare-tier player squad. Its baseDmg is 0 (see CLASS_DEFS) and it
    // never enters the attack/targeting loop (see the 'siege'
    // early-return in processUnitAttack) - it works exclusively through
    // this ability instead.
    const WATCH_TOWER_BUILD_TIME = 10;      // seconds to construct
    const WATCH_TOWER_MAX_HP = 500;
    const WATCH_TOWER_RANGE = 3;            // tiles it fires at raiders within
    const WATCH_TOWER_FIRE_COOLDOWN = 1.6;
    const WATCH_TOWER_FIRE_HEIGHT = 1.85;
    // Chance, each time the tower fires, that the targeted raider warband
    // strikes back at the tower rather than just taking the hit -
    // incidental damage from whoever it happens to be shooting at,
    // mirroring the Orc Fortress's own "anything that wanders close gets
    // shot at" shape, just in reverse and mutual. This is on top of the
    // real, deliberate damage a warband that has actually picked the
    // tower as its target deals once it closes in - see
    // updateRaidersAttackingWatchTower.
    const WATCH_TOWER_RETALIATION_CHANCE = 0.45;
    const WATCH_TOWER_RETALIATION_DMG_MIN = 15;
    const WATCH_TOWER_RETALIATION_DMG_MAX = 30;

    // Siege Engineer passive - Barricade (replaces the old Retreat
    // passive it used to share with the Doctor - see the 'siege' branch
    // in applyDamage's hit-reaction block, and the barricadeShieldTimer
    // decrement in processUnitAttack). Instead of stepping back a tile
    // on taking a hit, it plants a wooden barricade at its own feet and
    // is fully immune to damage for BARRICADE_SHIELD_DURATION seconds
    // afterward - the hit that triggered it still lands, but nothing
    // else does until the barricade timer runs out.
    const BARRICADE_SHIELD_DURATION = 2.5;
    const barricadeCrateMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2a });
    const barricadeBandMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3d });

    // Builds and registers the temporary barrier crate a Siege Engineer
    // drops at worldPos when its Barricade passive triggers - three
    // stacked wooden crates with iron banding, faded out over
    // BARRICADE_SHIELD_DURATION by the activeSiegeBarricades update pass
    // (see the animate loop's projectile/particle section).
    function spawnSiegeBarricade(worldPos) {
      const group = new THREE.Group();
      [[-0.14, 0, 0.55], [0.15, 0, -0.5], [0, 0.16, 0.05]].forEach(([ox, oy, oz], i) => {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.26), barricadeCrateMat);
        crate.position.set(ox, 0.12 + oy, oz);
        crate.rotation.y = i * 0.6;
        group.add(crate);
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.03, 0.27), barricadeBandMat);
        band.position.set(ox, 0.12 + oy, oz);
        band.rotation.y = crate.rotation.y;
        group.add(band);
      });
      group.position.copy(worldPos);
      scene.add(group);
      activeSiegeBarricades.push({ mesh: group, age: 0, duration: BARRICADE_SHIELD_DURATION });
    }

    // Watch Tower materials - clean light timber and a pale blue banner,
    // a deliberately friendlier palette than the Orc Fortress's crude
    // dark logs and blood-red banner so the two read as opposing sides
    // at a glance.
    const towerWoodMat = new THREE.MeshLambertMaterial({ color: 0x9c7248 });
    const towerWoodDarkMat = new THREE.MeshLambertMaterial({ color: 0x6b4d2e });
    const towerRoofMat = new THREE.MeshLambertMaterial({ color: 0x5a3d24 });
    const towerBannerMat = new THREE.MeshLambertMaterial({ color: 0x2f6fb0, side: THREE.DoubleSide });

    // Watch Tower - the finished structure a Siege Engineer builds (see
    // maybeStartWatchTowerBuild/updateSiegeEngineerSupport). Four angled
    // stilt legs with a ladder up one side, a railed platform, and a
    // peaked shingle roof with a banner - fires arrows from
    // WATCH_TOWER_FIRE_HEIGHT once the Engineer who built it has climbed
    // inside to operate it. Single-tile footprint, same addCollider
    // treatment as every other structure.
    function createWatchTower(x, y, z) {
      const tower = new THREE.Group();

      const legTopY = 0.85, legR = 0.045;
      const legSpread = 0.32;
      const legPositions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      legPositions.forEach(([sx, sz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR * 1.3, legTopY, 6), towerWoodMat);
        leg.position.set(sx * legSpread, legTopY / 2, sz * legSpread);
        leg.rotation.x = sz * 0.09;
        leg.rotation.z = -sx * 0.09;
        leg.castShadow = true;
        tower.add(leg);
      });
      // Cross-bracing between the legs for a sturdier, less spindly read.
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([sx, sz]) => {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(sx ? 0.5 : 0.05, 0.04, sz ? 0.5 : 0.05), towerWoodDarkMat);
        brace.position.set(sx * legSpread * 0.6, legTopY * 0.45, sz * legSpread * 0.6);
        tower.add(brace);
      });

      // Ladder rungs up the -Z face.
      for (let i = 0; i < 5; i++) {
        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.02), towerWoodDarkMat);
        rung.position.set(0, 0.12 + i * 0.15, -legSpread - 0.02);
        tower.add(rung);
      }

      // Platform.
      const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 8), towerWoodMat);
      platform.position.y = legTopY + 0.04;
      platform.castShadow = true;
      tower.add(platform);

      // Low railing around the platform edge.
      const railCount = 8;
      for (let i = 0; i < railCount; i++) {
        const angle = (i / railCount) * Math.PI * 2;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 5), towerWoodDarkMat);
        post.position.set(Math.cos(angle) * 0.4, legTopY + 0.19, Math.sin(angle) * 0.4);
        tower.add(post);
      }
      const railTop = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.015, 6, 16), towerWoodDarkMat);
      railTop.rotation.x = Math.PI / 2;
      railTop.position.y = legTopY + 0.29;
      tower.add(railTop);

      // Peaked roof, held up by four corner posts.
      const roofPostH = 0.32;
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, roofPostH, 6), towerWoodDarkMat);
        post.position.set(sx * 0.34, legTopY + 0.08 + roofPostH / 2, sz * 0.34);
        tower.add(post);
      });
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.3, 4), towerRoofMat);
      roof.position.y = legTopY + 0.08 + roofPostH + 0.15;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      tower.add(roof);

      // Banner flying from the roof peak.
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.22), towerBannerMat);
      banner.position.set(0.08, legTopY + 0.08 + roofPostH + 0.28, 0);
      banner.rotation.y = Math.PI / 2;
      tower.add(banner);

      tower.position.set(x, y, z);
      tower.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
      addCollider(x, z, 0.42);

      return tower;
    }

    // Watch Tower construction scaffold - a plain translucent placeholder
    // (not a dimmed clone of the real tower, so it never risks mutating
    // the real tower's shared materials) that updateSiegeEngineerSupport
    // scales up from the ground as watchTowerBuild.timer advances toward
    // WATCH_TOWER_BUILD_TIME, so construction progress is visible at a
    // glance before the real createWatchTower mesh replaces it.
    const scaffoldMat = new THREE.MeshBasicMaterial({ color: 0xd8c49a, transparent: true, opacity: 0.4 });
    const scaffoldEdgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    function createWatchTowerScaffold(x, y, z) {
      const scaffold = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 0.6), scaffoldMat);
      box.position.y = 0.65;
      scaffold.add(box);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), scaffoldEdgeMat);
      edges.position.y = 0.65;
      scaffold.add(edges);
      scaffold.position.set(x, y, z);
      return scaffold;
    }

    // Removes one Watch Tower (destroyed, or torn down by a scene reset)
    // and restores whichever Siege Engineer squad was operating it back
    // to a normal, visible, targetable state - see the isOperatingTower
    // flag set in updateSiegeEngineerSupport.
    function destroyWatchTower(tower, silent) {
      if (!tower) return;
      const idx = watchTowers.indexOf(tower);
      if (idx === -1) return;
      if (tower.hpElement) tower.hpElement.remove();
      scene.remove(tower.mesh);
      if (tower.operatorSquad) {
        tower.operatorSquad.members.forEach(m => {
          m.userData.isOperatingTower = false;
          m.visible = true;
        });
      }
      if (!silent) {
        spawnFloatingText(new THREE.Vector3(tower.x, (getSurfaceY(tower.x, tower.z) || 0) + 1.4, tower.z), 'Watch Tower Destroyed!', '#ff5544');
      }
      watchTowers.splice(idx, 1);
    }

    // Starts a new Watch Tower build, called once per wave from
    // startWave (see maybeOpenDemonPortal/maybeSpawnOrcWarband for the
    // exact same "roll/trigger once at wave start" shape). No-ops
    // Starts a new Watch Tower build for every currently-idle Siege
    // Engineer squad - one already mid-build or already operating a
    // tower is skipped rather than pulled off duty to start a redundant
    // one, but multiple different Siege Engineer squads each get their
    // own simultaneous build/tower instead of only the first one found
    // ever getting to build. Total lifetime builds across every squad
    // combined are still capped at WATCH_TOWER_BUILD_LIMIT.
    function maybeStartWatchTowerBuild() {
      if (watchTowersBuiltCount >= WATCH_TOWER_BUILD_LIMIT) return;

      const busySquads = new Set();
      watchTowerBuilds.forEach(wb => busySquads.add(wb.squad));
      watchTowers.forEach(wt => { if (wt.operatorSquad) busySquads.add(wt.operatorSquad); });

      const idleEngineerSquads = squads.filter(s => s.type === 'siege' && !busySquads.has(s) && !s.isSiegingFortress &&
          s.members.some(m => m.userData.hp > 0 && !m.userData.isOperatingTower));

      for (const engineerSquad of idleEngineerSquads) {
        if (watchTowersBuiltCount >= WATCH_TOWER_BUILD_LIMIT) break;

        const bx = engineerSquad.group.position.x, bz = engineerSquad.group.position.z;
        const by = getSurfaceY(bx, bz) || 0;
        const scaffold = createWatchTowerScaffold(bx, by, bz);
        scaffold.scale.y = 0.06;
        scene.add(scaffold);

        watchTowersBuiltCount++;
        watchTowerBuilds.push({ x: bx, z: bz, timer: 0, duration: WATCH_TOWER_BUILD_TIME, mesh: scaffold, dustCooldown: 0, squad: engineerSquad });
        spawnFloatingText(new THREE.Vector3(bx, by + 1, bz), 'Building Watch Tower...', '#ffcc66');
      }
    }

    // Drives both halves of the Siege Engineer's ability every frame:
    // advancing every in-progress build (see watchTowerBuilds, started by
    // maybeStartWatchTowerBuild) through to completion, and firing each
    // standing tower at any raider warband within WATCH_TOWER_RANGE -
    // see the 'siege' early-return in processUnitAttack for why this
    // needs its own separate pass instead of going through the normal
    // attack loop (same shape as updateDoctorSupport). Several builds
    // and several towers can be live at once - one per Siege Engineer
    // squad the player has fielded.
    function updateSiegeEngineerSupport(delta) {
      for (let i = watchTowerBuilds.length - 1; i >= 0; i--) {
        const wb = watchTowerBuilds[i];

        // The building squad was wiped out before finishing - abandon
        // the build rather than leaving an unfinished scaffold stuck
        // forever with nobody left to complete it.
        if (!wb.squad.members.some(m => m.userData.hp > 0)) {
          scene.remove(wb.mesh);
          watchTowerBuilds.splice(i, 1);
          continue;
        }

        wb.timer += delta;
        const t = Math.min(wb.timer / wb.duration, 1);
        wb.mesh.scale.y = 0.06 + 0.94 * t;

        // Simple hammering bob on whoever's building it.
        wb.squad.members.forEach(m => {
          if (m.userData.hp <= 0) return;
          const swing = Math.sin(wb.timer * 9) * 0.5;
          if (m.userData.armR) m.userData.armR.rotation.x = -swing;
        });

        if (wb.timer >= wb.duration) {
          scene.remove(wb.mesh);
          const groundY = getSurfaceY(wb.x, wb.z) || 0;
          const towerMesh = createWatchTower(wb.x, groundY, wb.z);
          scene.add(towerMesh);

          const hpBg = document.createElement('div');
          hpBg.className = 'hp-bar-bg';
          const hpFill = document.createElement('div');
          hpFill.className = 'hp-bar-fill';
          hpBg.appendChild(hpFill);
          hpContainer.appendChild(hpBg);

          // Each tower is the single source of truth for its own hp -
          // aliasing towerMesh.userData to the same object lets the
          // generic updateUnitUI screen-space HP bar helper treat the
          // tower exactly like any other unit, with zero special-casing.
          const newTower = {
            x: wb.x, z: wb.z, mesh: towerMesh,
            hp: WATCH_TOWER_MAX_HP, maxHp: WATCH_TOWER_MAX_HP,
            hpElement: hpBg, hpFillElement: hpFill,
            cooldown: 0, operatorSquad: wb.squad,
            // Lets findRaiderTarget/updateRaiderAI treat the tower
            // exactly like a player squad for targeting and pathing
            // purposes - both only ever read .group.position.x/.z off
            // whatever they're aiming at. See
            // updateRaidersAttackingWatchTower for the actual
            // damage-dealing once a warband arrives and settles in.
            group: { position: new THREE.Vector3(wb.x, groundY, wb.z) },
          };
          towerMesh.userData = newTower;
          watchTowers.push(newTower);

          // The Engineer(s) climb inside to operate it - hidden and
          // pulled out of allPlayerUnits (see updateCombatSystem's
          // gather step) so raiders can no longer target them at all
          // while they're operating the tower instead of standing in
          // the open.
          wb.squad.members.forEach(m => {
            if (m.userData.hp <= 0) return;
            m.userData.isOperatingTower = true;
            m.visible = false;
            // isOperatingTower units drop out of allPlayerUnits entirely
            // (see updateCombatSystem's gather step), so updateUnitUI
            // never runs on them again to update this - hide it
            // explicitly now, or a bar showing at less-than-full HP would
            // otherwise hang frozen in place over an empty tile.
            if (m.userData.hpElement) m.userData.hpElement.style.display = 'none';
          });
          wb.squad.group.position.set(wb.x, groundY, wb.z);

          spawnFloatingText(new THREE.Vector3(wb.x, groundY + 1.6, wb.z), 'Watch Tower Built!', '#ffdd66');
          watchTowerBuilds.splice(i, 1);
        }
      }

      watchTowers.forEach(watchTower => {
        // An unmanned tower (its operator squad ejected - see the
        // pointerup move-command handler's eject branch - and not yet
        // sent back in by clicking its tile) stands idle rather than
        // firing on its own; someone has to actually be inside operating
        // it.
        const hasOperator = watchTower.operatorSquad &&
            watchTower.operatorSquad.members.some(m => m.userData.hp > 0 && m.userData.isOperatingTower);
        if (!hasOperator) return;

        watchTower.cooldown -= delta;
        if (watchTower.cooldown > 0) return;

        const liveRaiderSquads = raiderSquads.filter(s => s.members.length > 0);
        if (liveRaiderSquads.length === 0) return;

        let nearest = null, nearestDist = WATCH_TOWER_RANGE;
        liveRaiderSquads.forEach(rs => {
          const d = Math.hypot(rs.group.position.x - watchTower.x, rs.group.position.z - watchTower.z);
          if (d <= nearestDist) { nearestDist = d; nearest = rs; }
        });
        if (!nearest) return;

        const liveMembers = nearest.members.filter(m => m.userData.hp > 0);
        if (liveMembers.length === 0) return;
        const targetUnit = liveMembers[Math.floor(Math.random() * liveMembers.length)];

        const groundY = getSurfaceY(watchTower.x, watchTower.z) || 0;
        const startPos = new THREE.Vector3(watchTower.x, groundY + WATCH_TOWER_FIRE_HEIGHT, watchTower.z);
        // shooterUnitType 'siege' - its own dmgType bucket, distinct from a
        // real Archer's arrow, so the tower never inherits Piercing Shot.
        spawnProjectile(startPos, targetUnit, 'arrow', 1, 'siege');
        watchTower.cooldown = WATCH_TOWER_FIRE_COOLDOWN;

        if (Math.random() < WATCH_TOWER_RETALIATION_CHANCE) {
          const dmg = WATCH_TOWER_RETALIATION_DMG_MIN + Math.random() * (WATCH_TOWER_RETALIATION_DMG_MAX - WATCH_TOWER_RETALIATION_DMG_MIN);
          watchTower.hp -= dmg;
          if (watchTower.hpFillElement) {
            watchTower.hpFillElement.style.width = Math.max(0, (watchTower.hp / watchTower.maxHp) * 100) + '%';
          }
          spawnFloatingText(new THREE.Vector3(watchTower.x, groundY + WATCH_TOWER_FIRE_HEIGHT + 0.2, watchTower.z), '-' + Math.round(dmg), '#ff8844');
          if (watchTower.hp <= 0) destroyWatchTower(watchTower);
        }
      });
    }

    // Cemetery & Undertaker House materials - grimy weathered stone and
    // rotten timber for the rare walled-graveyard landmark that can appear
    // on Shadow Island's outdoor Swamp variant (see the cemetery placement
    // block in generateRandomIsland, and createUndertakerHouse/
    // createGravestone/createCemeteryFence below).
    const graveStoneMat = new THREE.MeshLambertMaterial({ color: 0x5c5f57 });
    const mossyStoneMat = new THREE.MeshLambertMaterial({ color: 0x3f4a3d });
    const rottenWoodMat = new THREE.MeshLambertMaterial({ color: 0x2c2620 });
    const rottenRoofMat = new THREE.MeshLambertMaterial({ color: 0x232821 });
    const ironFenceMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1e });
    const graveLanternMat = new THREE.MeshLambertMaterial({ color: 0x6fdc8c, emissive: 0x2a8a4a, emissiveIntensity: 0.6 });

    // Undertaker House - the single building inside the Cemetery structure.
    // A smaller, gloomier reskin of the classic House: rotten dark timber
    // walls and roof, a mossy stone chimney, a shovel leaning by the door,
    // and a sickly green lantern in place of a normal house's warm glow.
    function createUndertakerHouse(x, y, z) {
      const house = new THREE.Group();

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.48, 0.6), rottenWoodMat);
      body.position.y = 0.24;
      body.castShadow = true;

      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.36, 4), rottenRoofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 0.66;
      roof.castShadow = true;

      const door = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.02), darkWoodMat);
      door.position.set(0, 0.125, 0.306);

      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.1), mossyStoneMat);
      chimney.position.set(-0.2, 0.66, -0.1);
      chimney.castShadow = true;

      // Hanging lantern by the door, glowing sickly green rather than the
      // warm gold window-light of a normal village house.
      const lanternPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), rottenWoodMat);
      lanternPole.position.set(0.28, 0.42, 0.31);
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06), graveLanternMat);
      lantern.position.set(0.28, 0.32, 0.31);

      // Shovel leaning against the wall by the door - the Undertaker's
      // tool of the trade.
      const shovelHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), woodMat);
      shovelHandle.rotation.z = 0.35;
      shovelHandle.position.set(-0.3, 0.2, 0.32);
      const shovelBlade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.012), steelMat);
      shovelBlade.rotation.z = 0.35;
      shovelBlade.position.set(-0.37, 0.03, 0.32);

      house.add(body, roof, door, chimney, lanternPole, lantern, shovelHandle, shovelBlade);
      house.scale.setScalar(STRUCTURE_SCALE);
      house.position.set(x, y, z);
      house.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
      addCollider(x, z, 0.55 * STRUCTURE_SCALE);
      return house;
    }

    // Gravestone - a small weathered slab with a rounded top, planted at a
    // slight random lean so a cluster of them doesn't look too uniform.
    // Fills the Cemetery structure's interior tiles around the Undertaker
    // House.
    function createGravestone(x, y, z) {
      const grave = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.06), graveStoneMat);
      slab.position.y = 0.15;
      slab.castShadow = true;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12), graveStoneMat);
      cap.rotation.x = Math.PI / 2;
      cap.position.y = 0.3;
      cap.castShadow = true;
      grave.add(slab, cap);
      grave.scale.setScalar(NATURE_SCALE);
      grave.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.15);
      grave.position.set(x, y, z);
      addCollider(x, z, 0.14 * NATURE_SCALE);
      return grave;
    }

    // Cemetery Fence - a short iron picket-and-rail segment ringing the
    // Cemetery structure's outer tiles (the corners and edges of its 4x4
    // footprint), reading as a low graveyard wall enclosing the Undertaker
    // House and its graves.
    function createCemeteryFence(x, y, z) {
      const fence = new THREE.Group();
      const railHeight = 0.22;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.03, 0.03), ironFenceMat);
      rail.position.y = railHeight;
      rail.castShadow = true;
      fence.add(rail);
      const picketCount = 4;
      for (let i = 0; i < picketCount; i++) {
        const picket = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, railHeight + 0.04, 6), ironFenceMat);
        picket.position.set(-0.38 + (i / (picketCount - 1)) * 0.76, railHeight / 2, 0);
        picket.castShadow = true;
        fence.add(picket);
      }
      fence.scale.setScalar(NATURE_SCALE);
      fence.rotation.y = Math.floor(Math.random() * 2) * (Math.PI / 2); // runs along either grid axis
      fence.position.set(x, y, z);
      addCollider(x, z, 0.4 * NATURE_SCALE);
      return fence;
    }

    // Siege Tent - a small medieval field-camp tent marking the healing
    // structure that always accompanies a rolled Orc Fortress (see
    // siegeTentTile/createSiegeTent's call site in the propPlan loop). A
    // single-mesh A-frame canvas body (triangular cross-section extruded
    // along its ridge), a shadowed triangular doorway on the front face,
    // and a small red-cross banner on a pole at the peak so it visually
    // reads as a field-medic tent rather than a plain supply tent.
    function createSiegeTent(x, y, z) {
      const tent = new THREE.Group();
      const canvasMat = new THREE.MeshLambertMaterial({ color: 0xcdb896 });
      const canvasDarkMat = new THREE.MeshLambertMaterial({ color: 0x8f7a5a });
      const crossMat = new THREE.MeshLambertMaterial({ color: 0x8a1f1f });
      const flagClothMat = new THREE.MeshLambertMaterial({ color: 0xf2ede0 });

      const width = 0.85, depth = 0.75, height = 0.52;

      // A-frame canvas body - a triangular profile (the tent's front/back
      // silhouette) extruded along Z into a full ridge-tent shape in one
      // solid mesh, rather than assembling separate slanted wall panels.
      const triShape = new THREE.Shape();
      triShape.moveTo(-width / 2, 0);
      triShape.lineTo(width / 2, 0);
      triShape.lineTo(0, height);
      triShape.lineTo(-width / 2, 0);
      const bodyGeo = new THREE.ExtrudeGeometry(triShape, { depth, bevelEnabled: false });
      const body = new THREE.Mesh(bodyGeo, canvasMat);
      body.position.z = -depth / 2; // extrusion runs 0..depth - recenter it on the tile
      body.castShadow = true;
      tent.add(body);

      // Shadowed triangular doorway, inset flush against the front face.
      const doorW = width * 0.5, doorH = height * 0.75;
      const doorShape = new THREE.Shape();
      doorShape.moveTo(-doorW / 2, 0);
      doorShape.lineTo(doorW / 2, 0);
      doorShape.lineTo(0, doorH);
      doorShape.lineTo(-doorW / 2, 0);
      const door = new THREE.Mesh(new THREE.ShapeGeometry(doorShape), canvasDarkMat);
      door.position.set(0, 0, depth / 2 + 0.005);
      tent.add(door);

      // Red-cross banner on a short pole at the ridge peak - the same
      // two-box cross idiom used elsewhere for the Doctor's satchel,
      // marking this tent as a field-medic camp rather than a supply tent.
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), darkWoodMat);
      flagPole.position.y = height + 0.11;
      tent.add(flagPole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.01), flagClothMat);
      flag.position.set(0.09, height + 0.19, 0);
      tent.add(flag);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.012), crossMat);
      crossV.position.set(0.09, height + 0.19, 0.006);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.012), crossMat);
      crossH.position.set(0.09, height + 0.19, 0.006);
      tent.add(crossV, crossH);

      tent.scale.setScalar(STRUCTURE_SCALE);
      tent.position.set(x, y, z);
      tent.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
      addCollider(x, z, 0.45 * STRUCTURE_SCALE);
      return tent;
    }

    // --- Undertaker NPC & Zombie Reanimation ---
    // Only ever active on an island where the Cemetery/Undertaker House
    // structure actually generated (see CEMETERY_SPAWN_CHANCE above). The
    // Undertaker waits by its House; whenever an ally unit dies on land, it
    // walks out through the single gate gap left in the graveyard fence,
    // collects the corpse, carries it home, and once the House has glowed
    // green for a moment a Zombie Militia unit - green flame burning on its
    // head - rises to fight alongside the player.
    const zombieFlames = []; // flame props currently burning on zombies' heads, animated each frame
    const houseGlows = [];   // temporary green PointLights marking a delivery in progress
    const demonicPortalFX = []; // vortex discs/embers for any Demonic Portal on the current island, animated each frame (see createDemonicPortal / updateDemonicPortals)
    const UNDERTAKER_MOVE_SPEED = 1.3;
    const UNDERTAKER_SCAN_INTERVAL = 1.5; // seconds between scans for a fresh ally corpse to collect
    const UNDERTAKER_DELIVER_TIME = 2.5;  // seconds the House glows green before the Zombie rises
    const ZOMBIE_SHIRT_COLOR = 0x3c4a34;  // rotted, moss-dark clothing
    const ZOMBIE_PANTS_COLOR = 0x2b2620;
    const ZOMBIE_SKIN_TINT = 0x7fae6f;    // sickly green-grey reanimated flesh


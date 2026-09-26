    function createUndertakerMesh() {
      const group = new THREE.Group();
      const robeMat = new THREE.MeshLambertMaterial({ color: 0x2b2620 });
      const skinMat = new THREE.MeshLambertMaterial({ color: 0xcdb89a });
      const hoodMat = new THREE.MeshLambertMaterial({ color: 0x1c1814 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.2), robeMat);
      body.position.y = 0.42;
      body.castShadow = true;
      group.add(body);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), skinMat);
      head.position.y = 0.72;
      head.castShadow = true;
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), hoodMat);
      hood.position.y = 0.13;
      head.add(hood);
      group.add(head);

      const armGeo = new THREE.BoxGeometry(0.08, 0.28, 0.08);
      const armL = createVillagerLimb(armGeo, robeMat, -0.18, 0.58, 0);
      const armR = createVillagerLimb(armGeo, robeMat, 0.18, 0.58, 0);
      group.add(armL, armR);

      const legGeo = new THREE.BoxGeometry(0.1, 0.22, 0.1);
      const legL = new THREE.Mesh(legGeo, robeMat);
      legL.position.set(-0.07, 0.11, 0);
      legL.castShadow = true;
      const legR = new THREE.Mesh(legGeo, robeMat);
      legR.position.set(0.07, 0.11, 0);
      legR.castShadow = true;
      group.add(legL, legR);

      // Shovel slung on the back - the same tool leaning by the House door.
      const shovelHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), woodMat);
      shovelHandle.rotation.x = 0.3;
      shovelHandle.position.set(0, 0.56, -0.14);
      const shovelBlade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.012), steelMat);
      shovelBlade.rotation.x = 0.3;
      shovelBlade.position.set(0, 0.4, -0.2);
      group.add(shovelHandle, shovelBlade);

      group.userData = { legL, legR, armL, armR, walkTimer: 0 };
      return group;
    }

    // The wrapped body the Undertaker carries home, added as a child of its
    // own mesh (so it rides along automatically) and removed on delivery.
    function createCarriedBodyMesh() {
      const wrapMat = new THREE.MeshLambertMaterial({ color: 0xcfc9b8 });
      const bundle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.34), wrapMat);
      bundle.rotation.x = Math.PI / 2.4;
      bundle.position.set(0, 0.6, -0.2);
      bundle.castShadow = true;
      return bundle;
    }

    function spawnUndertaker(houseX, houseY, houseZ) {
      const mesh = createUndertakerMesh();
      const gx = undertakerGateTile ? undertakerGateTile.x : houseX;
      const gz = undertakerGateTile ? undertakerGateTile.z : houseZ;
      const gy = getSurfaceY(gx, gz);
      mesh.position.set(gx, gy !== null ? gy : houseY, gz);
      islandGroup.add(mesh);

      undertaker = {
        mesh,
        state: 'idle', // 'idle' -> 'toCorpse' -> 'carrying' -> 'delivering' -> 'idle'
        path: [],
        waypoint: 0,
        target: null,
        carryMesh: null,
        scanTimer: 0.5 + Math.random(),
        deliverTimer: 0
      };
    }

    // Finds the nearest not-yet-claimed ally corpse that's actually resting
    // on land (never a raider corpse, never one already drifting out to sea).
    function findNearestCollectibleCorpse(fromX, fromZ) {
      let best = null, bestDist = Infinity;
      for (const r of ragdolls) {
        // isZombie corpses are already a reanimated body - skip them so the
        // Undertaker doesn't loop a fallen Zombie ally back through the
        // Cemetery and raise it a second time.
        if (r.isEnemy || r.isZombie || r.claimed || r.isFloating || r.isRollingToWater) continue;
        const d = Math.hypot(r.group.position.x - fromX, r.group.position.z - fromZ);
        if (d < bestDist) { bestDist = d; best = r; }
      }
      return best;
    }

    // Advances the Undertaker one tick along undertaker.path (set by
    // findPath), moving one axis at a time like every other unit in the
    // game. Returns true once it has reached the final waypoint.
    function stepUndertakerPath(delta, speed) {
      if (undertaker.waypoint >= undertaker.path.length) return true;
      const wp = undertaker.path[undertaker.waypoint];
      const wpY = getSurfaceY(wp.x, wp.z);
      const pos = undertaker.mesh.position;
      const dx = wp.x - pos.x, dz = wp.z - pos.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.08) {
        pos.x = wp.x; pos.z = wp.z;
        if (wpY !== null) pos.y = wpY;
        undertaker.waypoint++;
        return undertaker.waypoint >= undertaker.path.length;
      }

      const dir = new THREE.Vector3();
      if (Math.abs(dx) > 0.05) dir.set(Math.sign(dx), 0, 0);
      else dir.set(0, 0, Math.sign(dz));
      undertaker.mesh.rotation.y = Math.atan2(dir.x, dir.z);

      const step = speed * delta;
      pos.x += Math.min(Math.abs(dx), step) * dir.x;
      pos.z += Math.min(Math.abs(dz), step) * dir.z;
      if (wpY !== null) pos.y = wpY;

      const uData = undertaker.mesh.userData;
      uData.walkTimer += delta * 10;
      const swing = Math.sin(uData.walkTimer) * 0.5;
      if (uData.legL) uData.legL.rotation.x = swing;
      if (uData.legR) uData.legR.rotation.x = -swing;
      if (uData.armL) uData.armL.rotation.x = -swing * 0.7;
      if (uData.armR) uData.armR.rotation.x = swing * 0.7;
      return false;
    }

    function updateUndertaker(delta) {
      if (!undertaker) return;
      const m = undertaker.mesh;

      if (undertaker.state === 'idle') {
        undertaker.scanTimer -= delta;
        if (undertaker.scanTimer <= 0) {
          undertaker.scanTimer = UNDERTAKER_SCAN_INTERVAL;
          const corpse = findNearestCollectibleCorpse(m.position.x, m.position.z);
          if (corpse) {
            const goalX = Math.round(corpse.group.position.x);
            const goalZ = Math.round(corpse.group.position.z);
            // avoidProps=false - the Undertaker walks straight through the
            // graves and out its own gate, unlike ordinary squads.
            const path = findPath(m.position.x, m.position.z, goalX, goalZ, true, false);
            if (path) {
              corpse.claimed = true;
              undertaker.target = corpse;
              undertaker.path = path;
              undertaker.waypoint = 0;
              undertaker.state = 'toCorpse';
            }
          }
        }
        return;
      }

      if (undertaker.state === 'toCorpse') {
        const arrived = stepUndertakerPath(delta, UNDERTAKER_MOVE_SPEED);
        if (arrived) {
          const rag = undertaker.target;
          const idx = rag ? ragdolls.indexOf(rag) : -1;
          if (idx !== -1) {
            scene.remove(rag.group);
            ragdolls.splice(idx, 1);
            const bundle = createCarriedBodyMesh();
            m.add(bundle);
            undertaker.carryMesh = bundle;
          }
          const gx = undertakerGateTile.x, gz = undertakerGateTile.z;
          undertaker.path = findPath(m.position.x, m.position.z, gx, gz, true, false) || [];
          undertaker.waypoint = 0;
          undertaker.state = 'carrying';
        }
        return;
      }

      if (undertaker.state === 'carrying') {
        const arrived = stepUndertakerPath(delta, UNDERTAKER_MOVE_SPEED);
        if (arrived) {
          if (undertaker.carryMesh) {
            m.remove(undertaker.carryMesh);
            undertaker.carryMesh = null;
          }
          undertaker.target = null;
          undertaker.deliverTimer = UNDERTAKER_DELIVER_TIME;
          undertaker.state = 'delivering';
          const hy = getSurfaceY(undertakerHouseTile.x, undertakerHouseTile.z);
          triggerHouseGreenGlow(undertakerHouseTile.x, hy !== null ? hy : m.position.y, undertakerHouseTile.z, UNDERTAKER_DELIVER_TIME);
        }
        return;
      }

      if (undertaker.state === 'delivering') {
        undertaker.deliverTimer -= delta;
        if (undertaker.deliverTimer <= 0) {
          spawnZombieAlly(undertakerGateTile.x, undertakerGateTile.z);
          undertaker.state = 'idle';
          undertaker.scanTimer = 1 + Math.random();
        }
      }
    }

    // Green PointLight that ramps up, holds, then fades over `duration` -
    // the House "lighting up green" while a body is being reanimated inside.
    function triggerHouseGreenGlow(x, y, z, duration) {
      const light = new THREE.PointLight(0x33ff66, 0, 2.2, 2);
      light.position.set(x, y + 0.5, z);
      scene.add(light);
      houseGlows.push({ light, age: 0, duration });
    }

    function updateHouseGlows(delta) {
      for (let i = houseGlows.length - 1; i >= 0; i--) {
        const g = houseGlows[i];
        g.age += delta;
        const t = Math.min(1, g.age / g.duration);
        let intensity;
        if (t < 0.25) intensity = (t / 0.25) * 3.5;
        else if (t < 0.75) intensity = 3.5;
        else intensity = Math.max(0, 3.5 * (1 - (t - 0.75) / 0.25));
        g.light.intensity = intensity;
        if (g.age >= g.duration) {
          scene.remove(g.light);
          houseGlows.splice(i, 1);
        }
      }
    }

    // Small green flame prop, rigged onto a Zombie's head - flickers via
    // updateZombieFlames each frame.
    function createZombieFlame() {
      const flameGroup = new THREE.Group();
      const outerMat = new THREE.MeshBasicMaterial({ color: 0x33ff66, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
      const innerMat = new THREE.MeshBasicMaterial({ color: 0xd6ffd6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), outerMat);
      outer.position.y = 0.1;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.13, 6), innerMat);
      inner.position.y = 0.08;
      flameGroup.add(outer, inner);
      flameGroup.position.y = 0.17; // sits just above the 0.3-tall head box
      flameGroup.userData = { phase: Math.random() * Math.PI * 2, outer };
      return flameGroup;
    }

    function updateZombieFlames(time) {
      for (let i = zombieFlames.length - 1; i >= 0; i--) {
        const f = zombieFlames[i];
        if (!f.parent) { zombieFlames.splice(i, 1); continue; } // its zombie died and was removed
        const s = 1 + Math.sin(time * 9 + f.userData.phase) * 0.2;
        f.userData.outer.scale.y = s;
        f.rotation.y = time * 1.4 + f.userData.phase;
      }
    }

    // Spins the Demonic Portal's two glow discs in opposite directions,
    // pulses its core, and orbits its drifting embers - one entry per
    // portal in demonicPortalFX (populated by createDemonicPortal,
    // cleared whenever the island regenerates).
    function updateDemonicPortals(time, delta) {
      demonicPortalFX.forEach(p => {
        p.glowDisc1.rotation.z += delta * 0.6;
        p.glowDisc2.rotation.z -= delta * 0.9;
        const pulse = 1 + Math.sin(time * 2.4 + p.phase) * 0.08;
        p.core.scale.setScalar(pulse);
        p.core.material.opacity = 0.75 + Math.sin(time * 3 + p.phase) * 0.2;
        p.embers.forEach(e => {
          e.userData.angle += e.userData.speed * delta;
          e.position.set(
            Math.cos(e.userData.angle) * e.userData.radius,
            e.userData.baseY + Math.sin(time * 1.6 + e.userData.phase) * 0.06,
            Math.sin(e.userData.angle) * e.userData.radius
          );
        });
      });
    }

    // Reanimates the delivered corpse as a friendly Zombie unit - registered
    // as its own single-member entry in militiaSquads, so it automatically
    // gets the full Villager Militia AI (roam while idle, rally and engage
    // raiders during a wave - see updateMilitiaAI) and is folded into the
    // main combat system's allPlayerUnits list (see updateCombatSystem)
    // exactly like any other defending unit, without any bespoke AI here.
    function spawnZombieAlly(x, z) {
      const sy = getSurfaceY(x, z);

      const group = new THREE.Group();
      const unit = createBlockyHumanoid(ZOMBIE_SHIRT_COLOR, false, ZOMBIE_PANTS_COLOR);
      equipUnit(unit, 'militia', ['sword', 'spear', 'bow'][Math.floor(Math.random() * 3)]);
      unit.userData.isMilitia = true;
      unit.userData.isZombie = true;
      if (unit.userData.head && unit.userData.head.material) {
        unit.userData.head.material.color.setHex(ZOMBIE_SKIN_TINT);
      }

      const flame = createZombieFlame();
      unit.userData.head.add(flame);
      zombieFlames.push(flame);

      unit.userData.formationOffset = new THREE.Vector3(0, 0, 0);
      group.add(unit);
      group.scale.set(0.6, 0.6, 0.6);
      group.position.set(x, sy !== null ? sy : 0, z);
      scene.add(group);

      militiaSquads.push({
        type: 'militia',
        group,
        members: [unit],
        isMoving: false,
        targetPosition: new THREE.Vector3(),
        currentPath: [],
        currentWaypoint: 0,
        moveSpeed: MILITIA_MOVE_SPEED,
        state: 'roaming',
        roamTimer: 1 + Math.random() * 2,
        homeTile: { x, z },
        aiCooldown: 0,
        currentTargetSquad: null,
        isZombieSquad: true
      });

      for (let i = 0; i < 10; i++) {
        spawnParticle(group.position.clone(), 0x39ff6a, 0.09 + Math.random() * 0.06, 0.6 + Math.random() * 0.2, false);
      }
    }

    function createHouseVariant(x, y, z) {
      const options = [
        { type: 'house',       weight: 0.32, create: createHouse,       unique: false },
        { type: 'church',      weight: 0.16, create: createChurch,      unique: true },
        { type: 'blacksmith',  weight: 0.16, create: createBlacksmith,  unique: true },
        { type: 'wizardTower', weight: 0.16, create: createWizardTower, unique: true },
        { type: 'marketplace', weight: 0.12, create: createMarketplace, unique: false },
        { type: 'barracks',    weight: 0.08, create: createBarracks,    unique: true },
      ].filter(o => !o.unique || !spawnedSpecial[o.type]);

      const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
      let r = Math.random() * totalWeight;
      for (const o of options) {
        if (r < o.weight) {
          if (o.unique) spawnedSpecial[o.type] = true;
          return { mesh: o.create(x, y, z), type: o.type };
        }
        r -= o.weight;
      }
      return { mesh: createHouse(x, y, z), type: 'house' };
    }

    // --- VILLAGER NPCs ---
    const villagers = [];
    const VILLAGER_COLORS = [0x8b5a2b, 0x6b8e23, 0xcd853f, 0x4a708b, 0xa0522d, 0xb08968];
    const PRIEST_SHIRT_COLOR = 0x2b2b33; // dark cassock, so the Priest stands out from regular villagers
    const BLACKSMITH_SHIRT_COLOR = 0x4a3226; // dark leather apron, so the Blacksmith stands out from regular villagers
    const fishingRodMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    const fishingLineMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    const hammerHandleMat = darkWoodMat;
    const hammerHeadMat = steelMat;
    // Buildings register a collider of this same radius (0.55 * STRUCTURE_SCALE) around
    // their center. Villagers must stand at least that far from their own home point
    // (plus a small buffer) or they visually clip into/through their house's walls.
    const VILLAGER_HOME_CLEARANCE = 0.55 * STRUCTURE_SCALE + 0.1;

    // --- RAIDERS VS VILLAGER NPCs ---
    // Regular villagers (and the Priest/Blacksmith) have no HP pool - if a
    // raider catches one out in the open (still fleeing home, not yet
    // hidden) it's a single killing blow, same as Bad North. The Cleric and
    // Apprentice Mage don't run and hide - they stand and fight - so they
    // get a real HP pool a raider has to hack through instead of dying to
    // the first hit that lands.
    const RAIDER_VILLAGER_KILL_RANGE = 0.55; // catch radius for a raider to strike down a fleeing villager
    const RAIDER_NPC_ATTACK_RANGE = 0.9;     // how close a raider must be to strike the Cleric/Apprentice
    const RAIDER_NPC_DAMAGE = Math.max(1, Math.round(16 * ENEMY_NERF.damage));            // damage per raider hit against the Cleric/Apprentice
    const RAIDER_NPC_ATTACK_INTERVAL = 1.1;  // seconds between raider hits on the Cleric/Apprentice
    const NPC_MAX_HP = 60;

    // --- CLERIC RAID-TIME HEALING BEHAVIOR ---
    const CLERIC_HEAL_RANGE = 1.8;       // world units the cleric can reach with a heal
    const CLERIC_HEAL_AMOUNT = 20;       // HP restored per heal pulse
    const CLERIC_HEAL_INTERVAL = 1.4;    // seconds between heal pulses
    const CLERIC_APPROACH_SPEED = 1.3;   // how fast the cleric rushes to the squad
    const CLERIC_STANDOFF = 0.55;        // distance the cleric keeps from the squad's center

    // --- VIKING SHAMAN RAID-TIME HEALING (Northernlands Shaman Temple resident) ---
    // Unlike the Cleric's single-target heal, the Shaman's "Spirit Ward"
    // pulses a ring of healing that mends EVERY wounded squad member
    // standing near it at once. It walks to the squad the same way the
    // Cleric does (see updateClericAssist).
    const SHAMAN_HEAL_RANGE = 2.2;       // world units around the shaman the ward reaches
    const SHAMAN_HEAL_AMOUNT = 12;       // HP restored to each ally in range, per pulse
    const SHAMAN_HEAL_INTERVAL = 2.0;    // seconds between pulses (after one that healed someone)
    // Summon Lightning - on its own cooldown the Shaman also calls a bolt
    // down on the nearest raider in range, dealing AoE damage to every
    // raider caught around the strike (shields don't stop it).
    const SHAMAN_LIGHTNING_RANGE = 5.0;      // how far off a raider can be and still get struck
    const SHAMAN_LIGHTNING_COOLDOWN = 5.0;   // seconds between strikes
    const SHAMAN_LIGHTNING_RADIUS = 1.5;     // AoE radius around the strike point
    const SHAMAN_LIGHTNING_DAMAGE = 35;      // damage to each raider in the blast

    // --- APPRENTICE MAGE RAID-TIME COMBAT SUPPORT ---
    const APPRENTICE_ATTACK_RANGE = 4.5;     // world units the apprentice can snipe raiders from
    const APPRENTICE_ATTACK_COOLDOWN = 2.2;  // seconds between magic bolts
    const APPRENTICE_APPROACH_SPEED = 1.3;   // how fast the apprentice rushes to the Mage squad
    const APPRENTICE_STANDOFF = 0.6;         // distance the apprentice keeps from the squad's center

    // --- MONK RAID-TIME MELEE COMBAT (Far East Wizard Tower/Pagoda resident) ---
    // Unlike the Cleric (heals from range) and Apprentice Mage (snipes with
    // bolts), the Monk wades straight into melee against the nearest raider
    // and trades blows with its staff.
    const MONK_ATTACK_RANGE = 0.8;         // melee reach of the monk's staff
    const MONK_ATTACK_DAMAGE = 20;         // damage per staff strike
    const MONK_ATTACK_INTERVAL = 1.0;      // seconds between staff strikes
    const MONK_APPROACH_SPEED = 1.4;       // how fast the monk closes on a raider
    // Once every raider is cleared, a surviving Monk blesses the player's
    // squads: every living unit is healed for this fraction of its max HP.
    const MONK_POST_FIGHT_HEAL_PCT = 0.4;

    function createVillagerLimb(geometry, material, x, y, z) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = -geometry.parameters.height / 2;
      mesh.castShadow = true;
      pivot.add(mesh);
      return pivot;
    }

    function createVillagerMesh(shirtColor, hasHammer) {
      const group = new THREE.Group();
      const skinMat = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
      const bodyMat = new THREE.MeshLambertMaterial({ color: shirtColor });
      const pantsMat = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.17), bodyMat);
      body.position.y = 0.4;
      body.castShadow = true;
      group.add(body);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), skinMat);
      head.position.y = 0.68;
      head.castShadow = true;
      group.add(head);

      const armGeo = new THREE.BoxGeometry(0.08, 0.26, 0.08);
      const armL = createVillagerLimb(armGeo, skinMat, -0.17, 0.56, 0);
      const armR = createVillagerLimb(armGeo, skinMat, 0.17, 0.56, 0);
      group.add(armL, armR);

      const legGeo = new THREE.BoxGeometry(0.1, 0.22, 0.1);
      const legL = new THREE.Mesh(legGeo, pantsMat);
      legL.position.set(-0.07, 0.11, 0);
      legL.castShadow = true;
      const legR = new THREE.Mesh(legGeo, pantsMat);
      legR.position.set(0.07, 0.11, 0);
      legR.castShadow = true;
      group.add(legL, legR);

      // Fishing rod rigged to the right hand. Hidden until the villager
      // actually starts a fishing trip, so it moves and swings naturally
      // with the arm's own animation the rest of the time. The rodTip
      // marker has no geometry of its own - it just lets us read the
      // pole's tip position in world space each frame, so the fishing
      // line (a separate, unparented mesh) can hang straight down from
      // it into the water instead of swinging around with the arm.
      const rodLength = 0.75;
      const rodPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, rodLength, 6), fishingRodMat);
      rodPole.position.y = -rodLength / 2;
      rodPole.castShadow = true;
      const rodTip = new THREE.Object3D();
      rodTip.position.y = -rodLength;
      const fishingRod = new THREE.Group();
      fishingRod.add(rodPole, rodTip);
      fishingRod.position.set(0, -0.26, 0.02);
      fishingRod.rotation.set(-0.9, 0, 0.3);
      fishingRod.visible = false;
      armR.add(fishingRod);

      // Blacksmith's hammer, rigged to the same right-hand pivot as the fishing
      // rod above. Hidden until the Blacksmith actually starts hammering at the
      // anvil, so it doesn't clutter the arm the rest of the time.
      let hammer = null;
      if (hasHammer) {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 6), hammerHandleMat);
        handle.position.y = -0.16;
        handle.castShadow = true;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.09), hammerHeadMat);
        head.position.y = -0.32;
        head.castShadow = true;
        hammer = new THREE.Group();
        hammer.add(handle, head);
        hammer.position.set(0, -0.24, 0.02);
        hammer.rotation.set(0, 0, 0.15);
        hammer.visible = false;
        armR.add(hammer);
      }

      group.userData = { idlePhase: Math.random() * Math.PI * 2, legL, legR, armL, armR, walkTimer: 0, fishingRod, rodTip, hammer };
      return group;
    }

    function pickRandomRoadTile() {
      if (roadTiles.size === 0) return null;
      const idx = Math.floor(Math.random() * roadTiles.size);
      let i = 0;
      for (const key of roadTiles) {
        if (i === idx) {
          const [x, z] = key.split(',').map(Number);
          return { x, z };
        }
        i++;
      }
      return null;
    }

    // Any real land tile on the island (heightMap only has entries for
    // actual land, never open water) - used to let Zombies roam anywhere
    // on the island instead of just near their Undertaker House.
    function pickRandomLandTile() {
      const keys = Object.keys(heightMap);
      if (keys.length === 0) return null;
      const key = keys[Math.floor(Math.random() * keys.length)];
      const [x, z] = key.split(',').map(Number);
      return { x, z };
    }

    function spawnVillager(x, y, z) {
      const color = VILLAGER_COLORS[Math.floor(Math.random() * VILLAGER_COLORS.length)];
      const mesh = createVillagerMesh(color);
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
        talking: false,
        talkPartner: null,
        talkTimer: 0,
        activity: null,
        activityPhase: null,
        activityPath: [],
        activityWaypoint: 0,
        activityFace: null,
        activityFaceAngle: null,
        activityTimer: 0,
        shopMarket: null,
        fishTugTimer: 0,
        fishTugPulse: 0,
      });
    }

    // The Priest lives at the Church. Visually and behaviorally it's a regular
    // villager (wanders, roams the roads, chats, shops at the market) - it just
    // never goes fishing, so it's tagged with npcKind: 'priest' rather than
    // being left indistinguishable from any other villager.
    function spawnPriest(x, y, z) {
      const mesh = createVillagerMesh(PRIEST_SHIRT_COLOR);
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
        talking: false,
        talkPartner: null,
        talkTimer: 0,
        activity: null,
        activityPhase: null,
        activityPath: [],
        activityWaypoint: 0,
        activityFace: null,
        activityFaceAngle: null,
        activityTimer: 0,
        shopMarket: null,
        fishTugTimer: 0,
        fishTugPulse: 0,
        npcKind: 'priest',
      });
    }

    // The Blacksmith's anvil sits at a fixed spot inside createBlacksmith's local
    // geometry (see anvilBase/anvilTop above). Given the building's home position
    // and the y-rotation it was placed with, this works out the world-space spot
    // just in front of the anvil where the Blacksmith villager should stand to
    // hammer, plus the facing angle that turns them toward it.
    function getBlacksmithAnvilSpot(homeX, homeZ, buildingRotationY) {
      const localX = 0.32 * STRUCTURE_SCALE;
      const localZ = 0.35 * STRUCTURE_SCALE;
      // Push the stand point a bit further out than the anvil itself so the
      // villager's model doesn't clip into it while swinging the hammer.
      const standScale = 1.35;
      const sx = localX * standScale, sz = localZ * standScale;
      const cos = Math.cos(buildingRotationY), sin = Math.sin(buildingRotationY);
      const standX = homeX + (sx * cos + sz * sin);
      const standZ = homeZ + (-sx * sin + sz * cos);
      const anvilX = homeX + (localX * cos + localZ * sin);
      const anvilZ = homeZ + (-localX * sin + localZ * cos);
      const faceAngle = Math.atan2(anvilX - standX, anvilZ - standZ);
      return { x: standX, z: standZ, faceAngle };
    }

    // The Blacksmith lives at the Blacksmith's forge. Same daily-life behavior as
    // a regular villager (wanders, roams the roads, chats, shops at the market),
    // except it never goes fishing, and it occasionally heads back to its own
    // building to hammer away at the anvil instead.
    function spawnBlacksmithVillager(x, y, z, buildingRotationY) {
      const mesh = createVillagerMesh(BLACKSMITH_SHIRT_COLOR, true);
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
        talking: false,
        talkPartner: null,
        talkTimer: 0,
        activity: null,
        activityPhase: null,
        activityPath: [],
        activityWaypoint: 0,
        activityFace: null,
        activityFaceAngle: null,
        activityTimer: 0,
        shopMarket: null,
        fishTugTimer: 0,
        fishTugPulse: 0,
        npcKind: 'blacksmith',
        smithSpot: getBlacksmithAnvilSpot(x, z, buildingRotationY || 0),
      });
    }

    function hideVillagers() {
      villagers.forEach(v => {
        // The cleric, apprentice mage, and monk don't run and hide - they rush out to support the troops instead.
        if (v.npcKind === 'cleric' || v.npcKind === 'apprenticeMage' || v.npcKind === 'monk' || v.npcKind === 'shaman') {
          v.assisting = true;
          v.fleeing = false;
          v.roaming = false;
          v.roamPath = [];
          v.healCooldown = 0;
          v.attackCooldown = 0;
          v.mesh.visible = true;
          v.hidden = false;
          return;
        }
        // Regular villagers run back to their house and hide once they arrive.
        if (v.hidden) return;
        v.fleeing = true;
        v.roaming = false;
        v.roamPath = [];
        v.talking = false;
        v.talkPartner = null;
        v.activity = null;
        v.activityPhase = null;
        v.activityPath = [];
        v.activitySpot = null;
        if (v.mesh.userData.fishingRod) v.mesh.userData.fishingRod.visible = false;
        if (v.mesh.userData.hammer) v.mesh.userData.hammer.visible = false;
        if (v.fishingLineMesh) v.fishingLineMesh.visible = false;

        // Path home over actual land tiles instead of a straight beeline -
        // a villager caught out fishing on the coast (or anywhere else the
        // straight line back to the house crosses open water) now walks
        // the shore around it like any other pathed unit. isTileWalkable
        // only ever covers real land, so a route found here can never
        // cross water. Falls back to the old direct approach in
        // updateVillagers if no path is found (e.g. a truly isolated spot).
        const startX = Math.round(v.mesh.position.x), startZ = Math.round(v.mesh.position.z);
        const homeX = Math.round(v.home.x), homeZ = Math.round(v.home.z);
        v.fleePath = findPath(startX, startZ, homeX, homeZ, false, false) || null;
        v.fleeWaypoint = 0;
      });
    }

    function revealVillagers() {
      villagers.forEach(v => {
        if (!v.hidden && !v.fleeing && !v.assisting) return;
        // No more snapping straight back to the house here - a hidden
        // villager already walked itself home before going invisible (see
        // the fleeing branch in updateVillagers, which now paths there
        // instead of cutting a straight line), and an assisting cleric/
        // mage/monk was never hidden in the first place, so repositioning
        // either one here was an outright teleport back to their house in
        // full view. Just resume normal behavior from wherever the
        // villager actually is.
        v.mesh.visible = true;
        v.hidden = false;
        v.fleeing = false;
        v.fleePath = null;
        v.fleeWaypoint = 0;
        v.roaming = false;
        v.roamPath = [];
        v.assisting = false;
        v.healCooldown = 0;
        v.attackCooldown = 0;
        v.talking = false;
        v.talkPartner = null;
        v.activity = null;
        v.activityPhase = null;
        v.activityPath = [];
        v.activityWaypoint = 0;
        v.activityFace = null;
        v.activityFaceAngle = null;
        v.shopMarket = null;
        v.activitySpot = null;
        if (v.mesh.userData.fishingRod) v.mesh.userData.fishingRod.visible = false;
        if (v.mesh.userData.hammer) v.mesh.userData.hammer.visible = false;
        if (v.fishingLineMesh) v.fishingLineMesh.visible = false;
        if (v.mesh.userData.armL) v.mesh.userData.armL.rotation.set(0, 0, 0);
        if (v.mesh.userData.armR) v.mesh.userData.armR.rotation.set(0, 0, 0);
        v.wanderCooldown = 0.5 + Math.random();
      });
    }

    // Moves the cleric toward the nearest active player squad and periodically
    // heals whichever member of that squad is most wounded, while raiders are active.
    function updateClericAssist(v, delta) {
      const m = v.mesh;
      const uData = m.userData;

      // First choice: whichever squad contains the nearest wounded ally, so the
      // cleric actively goes to heal someone rather than just camping by
      // whichever squad happens to be closest. Falls back to the nearest
      // squad overall (e.g. to stay close to the fight) if no one is hurt.
      let target = null, fallbackTarget = null, bestDist = Infinity, bestWoundedDist = Infinity;
      const unitWorldPos = new THREE.Vector3();

      squads.forEach(s => {
        if (s.members.length === 0) return;
        const d = Math.hypot(s.group.position.x - m.position.x, s.group.position.z - m.position.z);
        if (d < bestDist) { bestDist = d; fallbackTarget = s; }

        s.members.forEach(unit => {
          const ud = unit.userData;
          if (ud.hp <= 0 || ud.hp >= ud.maxHp) return;
          unit.getWorldPosition(unitWorldPos);
          const wd = Math.hypot(unitWorldPos.x - m.position.x, unitWorldPos.z - m.position.z);
          if (wd < bestWoundedDist) { bestWoundedDist = wd; target = s; }
        });
      });

      if (!target) target = fallbackTarget;

      if (!target) {
        if (uData.legL) uData.legL.rotation.x = 0;
        if (uData.legR) uData.legR.rotation.x = 0;
        return;
      }

      const dx = target.group.position.x - m.position.x;
      const dz = target.group.position.z - m.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > CLERIC_STANDOFF) {
        // Move along one axis at a time (horizontal OR vertical, never diagonal)
        const dir = new THREE.Vector3();
        if (Math.abs(dx) > 0.05) {
          dir.set(Math.sign(dx), 0, 0);
        } else {
          dir.set(0, 0, Math.sign(dz));
        }
        m.rotation.y = Math.atan2(dir.x, dir.z);

        const step = Math.min(dist - CLERIC_STANDOFF, CLERIC_APPROACH_SPEED * delta);
        m.position.x += dir.x * step;
        m.position.z += dir.z * step;

        const surfY = getSurfaceY(m.position.x, m.position.z);
        if (surfY !== null) m.position.y = surfY;

        uData.walkTimer += delta * 11;
        const legAngle = Math.sin(uData.walkTimer) * 0.5;
        if (uData.legL) uData.legL.rotation.x = legAngle;
        if (uData.legR) uData.legR.rotation.x = -legAngle;
        if (uData.armL) uData.armL.rotation.x = -legAngle * 0.6;
      } else {
        m.rotation.y = Math.atan2(dx, dz);
        if (uData.legL) uData.legL.rotation.x = 0;
        if (uData.legR) uData.legR.rotation.x = 0;

        uData.idlePhase += delta * 3;
        const castPhase = Math.sin(uData.idlePhase) * 0.15;
        if (uData.armR) uData.armR.rotation.x = -Math.PI / 2.4 + castPhase;
        if (uData.armL) uData.armL.rotation.x = -0.2;
      }

      v.healCooldown -= delta;

      // Viking Shaman - Spirit Ward. Every wounded member of ANY squad within
      // SHAMAN_HEAL_RANGE gets healed at once, with a ring of teal rune
      // sparks bursting out from the shaman. If nobody nearby is hurt it
      // just re-checks a moment later, so a fresh wound gets mended quickly.
      if (v.npcKind === 'shaman') {
        if (v.healCooldown <= 0) {
          const shamanWorldPos = new THREE.Vector3();
          m.getWorldPosition(shamanWorldPos);
          const allyWorldPos = new THREE.Vector3();
          let healedAny = false;
          squads.forEach(s => s.members.forEach(unit => {
            const ud = unit.userData;
            if (ud.hp <= 0 || ud.hp >= ud.maxHp) return;
            unit.getWorldPosition(allyWorldPos);
            if (shamanWorldPos.distanceTo(allyWorldPos) > SHAMAN_HEAL_RANGE) return;
            if (healUnit(unit, SHAMAN_HEAL_AMOUNT)) healedAny = true;
          }));
          if (healedAny) {
            v.healCooldown = SHAMAN_HEAL_INTERVAL;
            spawnShamanWardRing(shamanWorldPos);
          } else {
            v.healCooldown = 0.25;
          }
        }
        updateShamanLightning(v, delta);
        return;
      }

      if (v.healCooldown <= 0) {
        v.healCooldown = CLERIC_HEAL_INTERVAL;

        const clericWorldPos = new THREE.Vector3();
        m.getWorldPosition(clericWorldPos);

        // Heal whichever ally in range is currently the most wounded
        let woundedTarget = null, worstPct = 1;
        const unitWorldPos = new THREE.Vector3();
        target.members.forEach(unit => {
          const ud = unit.userData;
          if (ud.hp <= 0 || ud.hp >= ud.maxHp) return;
          unit.getWorldPosition(unitWorldPos);
          if (clericWorldPos.distanceTo(unitWorldPos) > CLERIC_HEAL_RANGE) return;
          const pct = ud.hp / ud.maxHp;
          if (pct < worstPct) { worstPct = pct; woundedTarget = unit; }
        });

        if (woundedTarget) healUnit(woundedTarget, CLERIC_HEAL_AMOUNT);
      }
    }

    // Viking Shaman - Summon Lightning. Whenever its cooldown is ready and a
    // raider is within SHAMAN_LIGHTNING_RANGE, calls a teal bolt down on the
    // nearest one and damages every raider inside SHAMAN_LIGHTNING_RADIUS of
    // the strike. Raises its staff arm for a moment as it casts. Reuses the
    // Bear Warrior's lightning visual (spawnLightningBoltEffect), recolored
    // to the Shaman's aurora teal.
    function updateShamanLightning(v, delta) {
      const uData = v.mesh.userData;

      if (v.lightningCastTimer > 0) {
        v.lightningCastTimer -= delta;
        if (uData.armR) uData.armR.rotation.x = v.lightningCastTimer > 0 ? -Math.PI * 0.85 : 0;
      }

      if (v.lightningCooldown === undefined) v.lightningCooldown = 2;
      v.lightningCooldown = Math.max(0, v.lightningCooldown - delta);
      if (v.lightningCooldown > 0) return;

      const shamanPos = new THREE.Vector3();
      v.mesh.getWorldPosition(shamanPos);
      const rPos = new THREE.Vector3();
      let nearest = null, nearestDist = Infinity;
      raiderSquads.forEach(rs => rs.members.forEach(unit => {
        if (unit.userData.hp <= 0) return;
        unit.getWorldPosition(rPos);
        const d = shamanPos.distanceTo(rPos);
        if (d < nearestDist) { nearestDist = d; nearest = unit; }
      }));
      if (!nearest || nearestDist > SHAMAN_LIGHTNING_RANGE) return;

      v.lightningCooldown = SHAMAN_LIGHTNING_COOLDOWN;
      v.lightningCastTimer = 0.5;

      const strikePos = new THREE.Vector3();
      nearest.getWorldPosition(strikePos);
      spawnFloatingText(shamanPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'LIGHTNING!', '#7dffd8');
      spawnLightningBoltEffect(strikePos.clone(), 0x7dffd8, 0xd6fff3);

      [...raiderSquads].forEach(rs => rs.members.slice().forEach(unit => {
        const ud = unit.userData;
        if (!ud || ud.hp <= 0) return;
        unit.getWorldPosition(rPos);
        if (rPos.distanceTo(strikePos) <= SHAMAN_LIGHTNING_RADIUS) {
          applyDamage(unit, SHAMAN_LIGHTNING_DAMAGE, 'shamanLightning', strikePos, null, false);
        }
      }));
    }

    // Moves the apprentice mage to stick close to the player's Mages squad and
    // periodically snipes the nearest raider in range with a magic bolt.
    function updateApprenticeMageAssist(v, delta) {
      const m = v.mesh;
      const uData = m.userData;

      const target = squads.find(s => s.type === 'mages' && s.members.length > 0);

      if (!target) {
        if (uData.legL) uData.legL.rotation.x = 0;
        if (uData.legR) uData.legR.rotation.x = 0;
        return;
      }

      const dx = target.group.position.x - m.position.x;
      const dz = target.group.position.z - m.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > APPRENTICE_STANDOFF) {
        // Move along one axis at a time (horizontal OR vertical, never diagonal)
        const dir = new THREE.Vector3();
        if (Math.abs(dx) > 0.05) {
          dir.set(Math.sign(dx), 0, 0);
        } else {
          dir.set(0, 0, Math.sign(dz));
        }
        m.rotation.y = Math.atan2(dir.x, dir.z);

        const step = Math.min(dist - APPRENTICE_STANDOFF, APPRENTICE_APPROACH_SPEED * delta);
        m.position.x += dir.x * step;
        m.position.z += dir.z * step;

        const surfY = getSurfaceY(m.position.x, m.position.z);
        if (surfY !== null) m.position.y = surfY;

        uData.walkTimer += delta * 11;
        const legAngle = Math.sin(uData.walkTimer) * 0.5;
        if (uData.legL) uData.legL.rotation.x = legAngle;
        if (uData.legR) uData.legR.rotation.x = -legAngle;
        if (uData.armL) uData.armL.rotation.x = -legAngle * 0.6;
      } else {
        if (uData.legL) uData.legL.rotation.x = 0;
        if (uData.legR) uData.legR.rotation.x = 0;
      }

      v.attackCooldown -= delta;
      if (v.attackCooldown <= 0) {
        const apprenticeWorldPos = new THREE.Vector3();
        m.getWorldPosition(apprenticeWorldPos);

        // Snipe the nearest raider within range
        let nearestRaider = null, closestDist = APPRENTICE_ATTACK_RANGE;
        const raiderWorldPos = new THREE.Vector3();
        raiderSquads.forEach(rs => rs.members.forEach(unit => {
          const ud = unit.userData;
          if (ud.hp <= 0) return;
          unit.getWorldPosition(raiderWorldPos);
          const d = apprenticeWorldPos.distanceTo(raiderWorldPos);
          if (d <= closestDist) { closestDist = d; nearestRaider = unit; }
        }));

        if (nearestRaider) {
          v.attackCooldown = APPRENTICE_ATTACK_COOLDOWN;

          const raiderPos = new THREE.Vector3();
          nearestRaider.getWorldPosition(raiderPos);
          const fdx = raiderPos.x - apprenticeWorldPos.x;
          const fdz = raiderPos.z - apprenticeWorldPos.z;
          if (fdx * fdx + fdz * fdz > 0.001) m.rotation.y = Math.atan2(fdx, fdz);

          uData.idlePhase += delta * 3;
          if (uData.armR) uData.armR.rotation.x = -Math.PI / 2 - 0.4;
          if (uData.armL) uData.armL.rotation.x = -Math.PI / 3;

          spawnProjectile(apprenticeWorldPos.clone().add(new THREE.Vector3(0, 0.5, 0)), nearestRaider, 'magic');
        }
      }
    }

    // Moves the Monk straight at the nearest live raider and trades blows
    // with it in melee once in range - unlike the Cleric (heals from range)
    // or Apprentice Mage (snipes from range), the Monk is a front-line
    // fighter itself.
    function updateMonkAssist(v, delta) {
      const m = v.mesh;
      const uData = m.userData;

      const monkWorldPos = new THREE.Vector3();
      m.getWorldPosition(monkWorldPos);

      let nearestRaider = null, closestDist = Infinity;
      const raiderWorldPos = new THREE.Vector3();
      raiderSquads.forEach(rs => rs.members.forEach(unit => {
        const ud = unit.userData;
        if (ud.hp <= 0) return;
        unit.getWorldPosition(raiderWorldPos);
        const d = monkWorldPos.distanceTo(raiderWorldPos);
        if (d < closestDist) { closestDist = d; nearestRaider = unit; }
      }));

      if (!nearestRaider) {
        if (uData.legL) uData.legL.rotation.x = 0;
        if (uData.legR) uData.legR.rotation.x = 0;
        return;
      }

      nearestRaider.getWorldPosition(raiderWorldPos);
      const dx = raiderWorldPos.x - m.position.x;
      const dz = raiderWorldPos.z - m.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > MONK_ATTACK_RANGE) {
        // Move along one axis at a time (horizontal OR vertical, never diagonal)
        const dir = new THREE.Vector3();
        if (Math.abs(dx) > 0.05) {
          dir.set(Math.sign(dx), 0, 0);
        } else {
          dir.set(0, 0, Math.sign(dz));
        }
        m.rotation.y = Math.atan2(dir.x, dir.z);

        const step = Math.min(dist - MONK_ATTACK_RANGE, MONK_APPROACH_SPEED * delta);
        m.position.x += dir.x * step;
        m.position.z += dir.z * step;

        const surfY = getSurfaceY(m.position.x, m.position.z);
        if (surfY !== null) m.position.y = surfY;

        uData.walkTimer += delta * 11;
        const legAngle = Math.sin(uData.walkTimer) * 0.5;
        if (uData.legL) uData.legL.rotation.x = legAngle;
        if (uData.legR) uData.legR.rotation.x = -legAngle;
        if (uData.armL) uData.armL.rotation.x = -legAngle * 0.6;
        return;
      }

      if (dx * dx + dz * dz > 0.001) m.rotation.y = Math.atan2(dx, dz);
      if (uData.legL) uData.legL.rotation.x = 0;
      if (uData.legR) uData.legR.rotation.x = 0;

      v.attackCooldown -= delta;
      if (v.attackCooldown <= 0) {
        v.attackCooldown = MONK_ATTACK_INTERVAL;

        uData.idlePhase += delta * 3;
        if (uData.armR) uData.armR.rotation.x = -Math.PI / 2 - 0.3;
        if (uData.armL) uData.armL.rotation.x = -Math.PI / 3;

        applyDamage(nearestRaider, MONK_ATTACK_DAMAGE, 'monk', monkWorldPos.clone());
      }
    }

    // --- VILLAGER "DAILY LIFE" BEHAVIOR: fishing, marketplace shopping, and
    // silent face-to-face conversations between free-roaming villagers ---
    const TALK_DURATION_MIN = 3, TALK_DURATION_MAX = 6;
    const FISH_DURATION_MIN = 5, FISH_DURATION_MAX = 9;
    const SHOP_DURATION_MIN = 4, SHOP_DURATION_MAX = 7;
    const SMITH_DURATION_MIN = 4, SMITH_DURATION_MAX = 8;
    const ACTIVITY_WALK_SPEED = 0.55;
    const TALK_SEARCH_RADIUS = 4.5;

    function findNearbyIdleVillager(v) {
      let best = null, bestDist = TALK_SEARCH_RADIUS;
      for (const other of villagers) {
        if (other === v || (other.npcKind && other.npcKind !== 'priest' && other.npcKind !== 'blacksmith')) continue;
        if (other.hidden || other.fleeing || other.assisting) continue;
        if (other.talking || other.activity || other.roaming) continue;
        const d = Math.hypot(other.mesh.position.x - v.mesh.position.x, other.mesh.position.z - v.mesh.position.z);
        if (d < bestDist) { bestDist = d; best = other; }
      }
      return best;
    }

    // True if some other (non-hidden) villager is already standing at, or
    // walking to, this exact tile for their own activity. Used so fishing/
    // shopping villagers spread out across the available spots instead of
    // all converging on the single "nearest" one and jostling each other.
    function isActivitySpotTaken(x, z, excludeV) {
      return villagers.some(v => v !== excludeV && !v.hidden && v.activitySpot && v.activitySpot.x === x && v.activitySpot.z === z);
    }

    function pickNearestCoastTile(x, z, excludeV) {
      const candidates = [];
      coastTiles.forEach(t => {
        if (buildingTileKeys.has(t.x + ',' + t.z) || propTileKeys.has(t.x + ',' + t.z)) return;
        candidates.push(t);
      });
      candidates.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
      const free = candidates.find(t => !isActivitySpotTaken(t.x, t.z, excludeV));
      return free || candidates[0] || null;
    }

    // A coast tile touches open water on at least one side (that's what
    // makes it a coast tile). This returns the facing angle pointing out
    // over that water, so a villager standing there faces the water instead
    // of whatever direction they happened to walk in from.
    function getCoastFacingAngle(x, z) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const waterDirs = dirs.filter(([dx, dz]) => heightMap[(x + dx) + ',' + (z + dz)] === undefined);
      if (waterDirs.length === 0) return null;
      let sx = 0, sz = 0;
      waterDirs.forEach(([dx, dz]) => { sx += dx; sz += dz; });
      if (sx === 0 && sz === 0) { [sx, sz] = waterDirs[0]; }
      return Math.atan2(sx, sz);
    }

    function pickMarketplaceApproach(x, z, excludeV) {
      // Consider every marketplace (not just the nearest one) and every walkable
      // tile around each, nearest-first, so a shopper who finds their preferred
      // spot already taken spreads out to the next one instead of walking
      // straight into whoever's already there.
      const markets = marketplaceTiles.slice().sort((a, b) =>
        Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
      let fallback = null;
      for (const market of markets) {
        const candidates = walkableNeighborCandidates(market.x, market.z);
        for (const approach of candidates) {
          if (!fallback) fallback = { approach, market };
          if (!isActivitySpotTaken(approach.x, approach.z, excludeV)) {
            return { approach, market };
          }
        }
      }
      return fallback;
    }

    // Sends a villager off on a fishing or marketplace-shopping trip. Returns
    // true only if a valid destination and walkable path were both found.
    function startVillagerActivity(v, type) {
      const m = v.mesh;
      const startX = Math.round(m.position.x), startZ = Math.round(m.position.z);
      let goal = null, faceTarget = null, faceAngle = null, market = null;

      if (type === 'fish') {
        goal = pickNearestCoastTile(startX, startZ, v);
        if (goal) faceAngle = getCoastFacingAngle(goal.x, goal.z);
      } else if (type === 'shop') {
        const res = pickMarketplaceApproach(startX, startZ, v);
        if (res) { goal = res.approach; faceTarget = res.market; market = res.market; }
      } else if (type === 'smith') {
        if (!v.smithSpot) return false;
        goal = { x: Math.round(v.home.x), z: Math.round(v.home.z) };
        faceAngle = v.smithSpot.faceAngle;
      }
      if (!goal) return false;

      const path = findPath(startX, startZ, goal.x, goal.z, true);
      if (path === null) return false;

      v.activity = type;
      v.activityPhase = 'walkTo';
      v.activityPath = path;
      v.activityWaypoint = 0;
      v.activityFace = faceTarget;
      v.activityFaceAngle = faceAngle;
      v.shopMarket = market;
      v.activityTimer = 0;
      v.activitySpot = { x: goal.x, z: goal.z };
      if (type === 'fish' && m.userData.fishingRod) {
        m.userData.fishingRod.visible = true;
        if (!v.fishingLineMesh) {
          v.fishingLineMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 4), fishingLineMat);
          v.fishingLineMesh.visible = false;
          islandGroup.add(v.fishingLineMesh);
        }
      } else if (type === 'smith' && m.userData.hammer) {
        m.userData.hammer.visible = true;
      }
      return true;
    }

    // Rolls for one of the "life" activities an idle villager can start: a
    // wordless chat with a nearby villager, a fishing trip, or a shopping
    // trip. Returns true once one of them actually gets underway.
    function startVillagerSpecialActivity(v) {
      const roll = Math.random();
      if (roll < 0.10) {
        const partner = findNearbyIdleVillager(v);
        if (partner) {
          const dur = TALK_DURATION_MIN + Math.random() * (TALK_DURATION_MAX - TALK_DURATION_MIN);
          v.talking = true; v.talkPartner = partner; v.talkTimer = dur;
          partner.talking = true; partner.talkPartner = v; partner.talkTimer = dur;
          return true;
        }
      } else if (roll < 0.20 && v.npcKind === 'blacksmith') {
        if (startVillagerActivity(v, 'smith')) return true;
      } else if (roll < 0.20 && coastTiles.length > 0 && v.npcKind !== 'priest' && v.npcKind !== 'blacksmith') {
        if (startVillagerActivity(v, 'fish')) return true;
      } else if (roll < 0.30 && marketplaceTiles.length > 0) {
        if (startVillagerActivity(v, 'shop')) return true;
      }
      return false;
    }

    // Walks two paired-up villagers toward each other and plays a silent
    // talking-gesture animation - body language only, no chat bubble.
    function updateVillagerTalk(v, delta) {
      const m = v.mesh;
      const uData = m.userData;
      const partner = v.talkPartner;

      if (!partner || partner.hidden || partner.fleeing || !partner.talking) {
        v.talking = false;
        v.talkPartner = null;
        if (uData.armL) uData.armL.rotation.x = 0;
        if (uData.armR) uData.armR.rotation.x = 0;
        v.wanderCooldown = 1 + Math.random();
        return;
      }

      const pm = partner.mesh;
      const dx = pm.position.x - m.position.x;
      const dz = pm.position.z - m.position.z;
      const dist = Math.hypot(dx, dz);
      const TALK_STANDOFF = 0.5;

      if (dist > TALK_STANDOFF) {
        const dir = new THREE.Vector3();
        if (Math.abs(dx) > 0.04) dir.set(Math.sign(dx), 0, 0);
        else dir.set(0, 0, Math.sign(dz));
        m.rotation.y = Math.atan2(dir.x, dir.z);

        const step = Math.min(dist - TALK_STANDOFF, ACTIVITY_WALK_SPEED * delta);
        m.position.x += dir.x * step;
        m.position.z += dir.z * step;
        const surfY = getSurfaceY(m.position.x, m.position.z);
        if (surfY !== null) m.position.y = surfY;

        uData.walkTimer += delta * 10;
        const legAngle = Math.sin(uData.walkTimer) * 0.5;
        if (uData.legL) uData.legL.rotation.x = legAngle;
        if (uData.legR) uData.legR.rotation.x = -legAngle;
        if (uData.armL) uData.armL.rotation.x = -legAngle * 0.6;
        if (uData.armR) uData.armR.rotation.x = legAngle * 0.6;
        return;
      }

      if (uData.legL) uData.legL.rotation.x = 0;
      if (uData.legR) uData.legR.rotation.x = 0;
      m.rotation.y = Math.atan2(dx, dz);

      // Silent conversation gesture: an alternating arm raise instead of a
      // chat bubble, so it reads as two people talking without any text/UI.
      uData.idlePhase += delta * 4;
      const gesture = Math.sin(uData.idlePhase) * 0.4;
      if (uData.armR) uData.armR.rotation.x = -Math.PI / 2.8 + gesture;
      if (uData.armL) uData.armL.rotation.x = -0.2 - Math.max(0, -gesture) * 0.5;

      v.talkTimer -= delta;
      if (v.talkTimer <= 0) {
        v.talking = false;
        v.talkPartner = null;
        if (uData.armL) uData.armL.rotation.x = 0;
        if (uData.armR) uData.armR.rotation.x = 0;
        v.wanderCooldown = 1.5 + Math.random() * 2.5;
      }
    }

    // Drives a villager's walk-there / do-it / walk-back trip for the
    // fishing and marketplace-shopping activities.
    function updateVillagerActivity(v, delta) {
      const m = v.mesh;
      const uData = m.userData;

      if (v.activityPhase === 'walkTo' || v.activityPhase === 'walkBack') {
        const wp = v.activityPath[v.activityWaypoint];
        if (!wp) {
          if (v.activityPhase === 'walkTo') {
            v.activityPhase = 'doing';
            v.activityTimer = v.activity === 'fish'
              ? FISH_DURATION_MIN + Math.random() * (FISH_DURATION_MAX - FISH_DURATION_MIN)
              : v.activity === 'smith'
              ? SMITH_DURATION_MIN + Math.random() * (SMITH_DURATION_MAX - SMITH_DURATION_MIN)
              : SHOP_DURATION_MIN + Math.random() * (SHOP_DURATION_MAX - SHOP_DURATION_MIN);
            if (v.activity === 'smith' && v.smithSpot) {
              // The pathfinder only guarantees the home tile, not the fractional
              // spot right in front of the anvil - snap to it now, and turn to
              // face the anvil, so the hammering plays in the right place.
              m.position.x = v.smithSpot.x;
              m.position.z = v.smithSpot.z;
              const surfY = getSurfaceY(m.position.x, m.position.z);
              if (surfY !== null) m.position.y = surfY;
              m.rotation.y = v.smithSpot.faceAngle;
            } else if (v.activity === 'fish' && v.activityFaceAngle !== null) {
              m.rotation.y = v.activityFaceAngle;
            } else if (v.activityFace) {
              const fdx = v.activityFace.x - m.position.x;
              const fdz = v.activityFace.z - m.position.z;
              if (Math.abs(fdx) + Math.abs(fdz) > 0.001) m.rotation.y = Math.atan2(fdx, fdz);
            }
          } else {
            endVillagerActivity(v);
          }
          return;
        }

        const dx = wp.x - m.position.x;
        const dz = wp.z - m.position.z;
        const dist = Math.hypot(dx, dz);
        const targetY = getSurfaceY(wp.x, wp.z);

        if (dist < 0.06) {
          m.position.x = wp.x;
          m.position.z = wp.z;
          if (targetY !== null) m.position.y = targetY;
          v.activityWaypoint++;
        } else {
          const onRoad = roadTiles.has(Math.round(m.position.x) + ',' + Math.round(m.position.z));
          const speed = ACTIVITY_WALK_SPEED * (onRoad ? ROAD_SPEED_MULTIPLIER : 1);
          const dir = new THREE.Vector3();
          if (Math.abs(dx) > 0.05) dir.set(Math.sign(dx), 0, 0);
          else dir.set(0, 0, Math.sign(dz));
          m.rotation.y = Math.atan2(dir.x, dir.z);

          const step = speed * delta;
          if (dir.x !== 0) m.position.x += Math.min(Math.abs(dx), step) * dir.x;
          else m.position.z += Math.min(Math.abs(dz), step) * dir.z;
          if (targetY !== null) m.position.y = targetY;

          uData.walkTimer += delta * 10;
          const legAngle = Math.sin(uData.walkTimer) * 0.5;
          if (uData.legL) uData.legL.rotation.x = legAngle;
          if (uData.legR) uData.legR.rotation.x = -legAngle;
          if (uData.armL) uData.armL.rotation.x = -legAngle * 0.7;
          if (uData.armR) uData.armR.rotation.x = legAngle * 0.7;
        }
        return;
      }

      if (v.activityPhase === 'doing') {
        if (uData.legL) uData.legL.rotation.x = 0;
        if (uData.legR) uData.legR.rotation.x = 0;

        if (v.activity === 'fish') {
          // Rod held out over the water, gently bobbing, with an occasional
          // sharp "tug" when something bites.
          uData.idlePhase += delta * 1.4;
          const bob = Math.sin(uData.idlePhase) * 0.06;
          if (uData.armR) uData.armR.rotation.x = -Math.PI / 2.3 + bob;
          if (uData.armL) uData.armL.rotation.x = -Math.PI / 2.6 + bob * 0.6;

          v.fishTugTimer -= delta;
          if (v.fishTugTimer <= 0) {
            v.fishTugTimer = 1.5 + Math.random() * 2;
            v.fishTugPulse = 0.3;
          }
          if (v.fishTugPulse > 0) {
            v.fishTugPulse = Math.max(0, v.fishTugPulse - delta * 1.5);
            if (uData.armR) uData.armR.rotation.x -= v.fishTugPulse * 1.1;
          }

          // The line hangs straight down from the rod tip into the water,
          // independent of the rod's own bobbing rotation - so it always
          // reads as "falling into the water" rather than swinging with the arm.
          if (v.fishingLineMesh && uData.rodTip) {
            const tipWorld = new THREE.Vector3();
            uData.rodTip.getWorldPosition(tipWorld);
            const dropLen = tipWorld.y - WATER_SURFACE_Y;
            if (dropLen > 0.02) {
              v.fishingLineMesh.position.set(tipWorld.x, (tipWorld.y + WATER_SURFACE_Y) / 2, tipWorld.z);
              v.fishingLineMesh.scale.y = dropLen;
              v.fishingLineMesh.rotation.set(0, 0, 0);
              v.fishingLineMesh.visible = true;
            } else {
              v.fishingLineMesh.visible = false;
            }
          }
        } else if (v.activity === 'shop') {
          // Leaning in and reaching toward the stall's goods.
          uData.idlePhase += delta * 2;
          const reach = (Math.sin(uData.idlePhase) * 0.5 + 0.5) * 0.5;
          if (uData.armR) uData.armR.rotation.x = -Math.PI / 2.5 - reach * 0.4;
          if (uData.armL) uData.armL.rotation.x = -0.15;
        } else if (v.activity === 'smith') {
          // Hammer swings: a slow raise, a brief hold overhead, then a sharp
          // snap down into the strike - shaped so the impact reads as a
          // sudden hit rather than a smooth bob like the fishing/shopping arms.
          uData.idlePhase += delta * 3.6;
          const cycle = uData.idlePhase % 3.3;
          let raise;
          if (cycle < 2.0) {
            raise = cycle / 2.0;
          } else if (cycle < 2.6) {
            raise = 1;
          } else {
            raise = Math.max(0, 1 - (cycle - 2.6) / 0.5);
          }
          if (uData.armR) uData.armR.rotation.x = -Math.PI / 1.7 * raise;
          if (uData.armL) uData.armL.rotation.x = -0.1;

          // A quick full-body dip right at the moment of impact, so the strike
          // has a bit of follow-through instead of just the arm moving.
          const justStruck = raise < 0.08 && cycle >= 2.6;
          m.position.y = (getSurfaceY(m.position.x, m.position.z) ?? m.position.y) - (justStruck ? 0.015 : 0);
        }

        v.activityTimer -= delta;
        if (v.activityTimer <= 0) {
          if (v.fishingLineMesh) v.fishingLineMesh.visible = false;
          v.activitySpot = null; // free up the spot immediately so another villager can use it
          const startX = Math.round(m.position.x), startZ = Math.round(m.position.z);
          const homeX = Math.round(v.home.x), homeZ = Math.round(v.home.z);
          const path = findPath(startX, startZ, homeX, homeZ, true);
          if (path === null) {
            endVillagerActivity(v);
          } else {
            v.activityPhase = 'walkBack';
            v.activityPath = path;
            v.activityWaypoint = 0;
          }
        }
      }
    }

    function endVillagerActivity(v) {
      const uData = v.mesh.userData;
      if (uData.armL) uData.armL.rotation.x = 0;
      if (uData.armR) uData.armR.rotation.x = 0;
      if (uData.fishingRod) uData.fishingRod.visible = false;
      if (uData.hammer) uData.hammer.visible = false;
      if (v.fishingLineMesh) v.fishingLineMesh.visible = false;
      v.activity = null;
      v.activityPhase = null;
      v.activityPath = [];
      v.activityWaypoint = 0;
      v.activityFace = null;
      v.activityFaceAngle = null;
      v.shopMarket = null;
      v.activitySpot = null;
      v.wanderCooldown = 1.5 + Math.random() * 2.5;
    }

    function updateVillagers(delta) {
      villagers.forEach(v => {
        if (v.hidden) return;
        const m = v.mesh;
        const uData = m.userData;

        if ((v.npcKind === 'cleric' || v.npcKind === 'shaman') && v.assisting) {
          updateClericAssist(v, delta);
          return;
        }

        if (v.npcKind === 'apprenticeMage' && v.assisting) {
          updateApprenticeMageAssist(v, delta);
          return;
        }

        if (v.npcKind === 'monk' && v.assisting) {
          updateMonkAssist(v, delta);
          return;
        }

        if (v.fleeing) {
          // Follow the land-only route computed in hideVillagers (see
          // v.fleePath) waypoint by waypoint instead of beelining straight
          // for v.home - keeps a villager caught out near the coast from
          // cutting across open water on the way back. Falls through to a
          // direct final approach once the path is exhausted (or if none
          // was found at all), same shape as the old beeline movement.
          let targetX, targetZ, arriveThreshold, finalApproach;
          if (v.fleePath && v.fleeWaypoint < v.fleePath.length) {
            const wp = v.fleePath[v.fleeWaypoint];
            targetX = wp.x; targetZ = wp.z;
            arriveThreshold = 0.06;
            finalApproach = false;
          } else {
            targetX = v.home.x; targetZ = v.home.z;
            arriveThreshold = 0.08;
            finalApproach = true;
          }

          const dx = targetX - m.position.x;
          const dz = targetZ - m.position.z;
          const dist = Math.hypot(dx, dz);

          if (dist < arriveThreshold) {
            if (!finalApproach) {
              m.position.x = targetX;
              m.position.z = targetZ;
              const wpY = getSurfaceY(targetX, targetZ);
              if (wpY !== null) m.position.y = wpY;
              v.fleeWaypoint++;
              return;
            }
            m.visible = false;
            v.hidden = true;
            v.fleeing = false;
            v.fleePath = null;
            v.fleeWaypoint = 0;
            return;
          }
          // Move along one axis at a time (horizontal OR vertical, never diagonal)
          const fleeDir = new THREE.Vector3();
          if (Math.abs(dx) > 0.05) {
            fleeDir.set(Math.sign(dx), 0, 0);
          } else {
            fleeDir.set(0, 0, Math.sign(dz));
          }
          m.rotation.y = Math.atan2(fleeDir.x, fleeDir.z);

          const step = 1.6 * delta;
          if (fleeDir.x !== 0) {
            m.position.x += Math.min(Math.abs(dx), step) * fleeDir.x;
          } else {
            m.position.z += Math.min(Math.abs(dz), step) * fleeDir.z;
          }

          uData.walkTimer += delta * 14;
          const fleeLeg = Math.sin(uData.walkTimer) * 0.6;
          if (uData.legL) uData.legL.rotation.x = fleeLeg;
          if (uData.legR) uData.legR.rotation.x = -fleeLeg;
          if (uData.armL) uData.armL.rotation.x = -fleeLeg * 0.8;
          if (uData.armR) uData.armR.rotation.x = fleeLeg * 0.8;
          return;
        }

        if (v.talking) {
          updateVillagerTalk(v, delta);
          return;
        }

        if (v.activity) {
          updateVillagerActivity(v, delta);
          return;
        }

        // Currently walking a road route around the village
        if (v.roaming) {
          const wp = v.roamPath[v.roamWaypoint];
          if (!wp) {
            v.roaming = false;
            v.roamPath = [];
            v.wanderCooldown = 2 + Math.random() * 3;
          } else {
            const dx = wp.x - m.position.x;
            const dz = wp.z - m.position.z;
            const dist = Math.hypot(dx, dz);
            const targetY = getSurfaceY(wp.x, wp.z);

            if (dist < 0.06) {
              m.position.x = wp.x;
              m.position.z = wp.z;
              if (targetY !== null) m.position.y = targetY;
              v.roamWaypoint++;
              if (v.roamWaypoint >= v.roamPath.length) {
                v.roaming = false;
                v.roamPath = [];
                v.wanderCooldown = 2 + Math.random() * 3;
              }
            } else {
              const onRoad = roadTiles.has(Math.round(m.position.x) + ',' + Math.round(m.position.z));
              const speed = v.roamSpeed * (onRoad ? ROAD_SPEED_MULTIPLIER : 1);

              // Move along one axis at a time (horizontal OR vertical, never diagonal)
              const roamDir = new THREE.Vector3();
              if (Math.abs(dx) > 0.05) {
                roamDir.set(Math.sign(dx), 0, 0);
              } else {
                roamDir.set(0, 0, Math.sign(dz));
              }
              m.rotation.y = Math.atan2(roamDir.x, roamDir.z);

              const step = speed * delta;
              if (roamDir.x !== 0) {
                m.position.x += Math.min(Math.abs(dx), step) * roamDir.x;
              } else {
                m.position.z += Math.min(Math.abs(dz), step) * roamDir.z;
              }
              if (targetY !== null) m.position.y = targetY;

              uData.walkTimer += delta * 10;
              const legAngle = Math.sin(uData.walkTimer) * 0.5;
              if (uData.legL) uData.legL.rotation.x = legAngle;
              if (uData.legR) uData.legR.rotation.x = -legAngle;
              if (uData.armL) uData.armL.rotation.x = -legAngle * 0.7;
              if (uData.armR) uData.armR.rotation.x = legAngle * 0.7;
            }
            return;
          }
        }

        // Idle stance when not walking a road route
        if (uData.legL) uData.legL.rotation.x = 0;
        if (uData.legR) uData.legR.rotation.x = 0;
        if (uData.armL) uData.armL.rotation.x = 0;
        if (uData.armR) uData.armR.rotation.x = 0;

        // Gentle idle wander close to home, occasionally heading out to roam the roads
        v.wanderCooldown -= delta;
        if (v.wanderCooldown <= 0) {
          if ((!v.npcKind || v.npcKind === 'priest' || v.npcKind === 'blacksmith') && startVillagerSpecialActivity(v)) return;

          let startedRoam = false;
          if (roadTiles.size > 0 && Math.random() < 0.5) {
            const target = pickRandomRoadTile();
            if (target) {
              const startX = Math.round(m.position.x), startZ = Math.round(m.position.z);
              const path = findRoadPath(startX, startZ, target.x, target.z);
              if (path && path.length > 0) {
                v.roaming = true;
                v.roamPath = path;
                v.roamWaypoint = 0;
                startedRoam = true;
              }
            }
          }
          if (!startedRoam) {
            const angle = Math.random() * Math.PI * 2;
            const r = VILLAGER_HOME_CLEARANCE + Math.random() * 0.25;
            v.wanderTarget.x = v.home.x + Math.cos(angle) * r;
            v.wanderTarget.z = v.home.z + Math.sin(angle) * r;
            v.wanderCooldown = 2 + Math.random() * 3;
          } else {
            return;
          }
        }
        const dx = v.wanderTarget.x - m.position.x;
        const dz = v.wanderTarget.z - m.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.03) {
          // Move along one axis at a time (horizontal OR vertical, never diagonal)
          const wanderDir = new THREE.Vector3();
          if (Math.abs(dx) > 0.02) {
            wanderDir.set(Math.sign(dx), 0, 0);
          } else {
            wanderDir.set(0, 0, Math.sign(dz));
          }
          m.rotation.y = Math.atan2(wanderDir.x, wanderDir.z);

          const step = 0.3 * delta;
          if (wanderDir.x !== 0) {
            m.position.x += Math.min(Math.abs(dx), step) * wanderDir.x;
          } else {
            m.position.z += Math.min(Math.abs(dz), step) * wanderDir.z;
          }

          uData.walkTimer += delta * 7;
          const wanderLeg = Math.sin(uData.walkTimer) * 0.35;
          if (uData.legL) uData.legL.rotation.x = wanderLeg;
          if (uData.legR) uData.legR.rotation.x = -wanderLeg;
          if (uData.armL) uData.armL.rotation.x = -wanderLeg * 0.6;
          if (uData.armR) uData.armR.rotation.x = wanderLeg * 0.6;
        } else {
          uData.walkTimer = 0;
        }
        uData.idlePhase += delta * 3;
        m.position.y = v.home.y + Math.sin(uData.idlePhase) * 0.01;
      });
    }

    // --- Prevent villagers from overlapping/clipping through each other ---
    const VILLAGER_COLLISION_RADIUS = 0.16; // ~half a villager's width
    function resolveVillagerCollisions() {
      const minDist = VILLAGER_COLLISION_RADIUS * 2;
      const minDistSq = minDist * minDist;
      // Multiple passes so a cluster of 3+ overlapping villagers (e.g. several
      // converging on the same market/coast spot) fully separates within a
      // single frame instead of drifting apart visibly over several frames.
      const ITERATIONS = 3;
      for (let iter = 0; iter < ITERATIONS; iter++) {
        let anyOverlap = false;
        for (let i = 0; i < villagers.length; i++) {
          const a = villagers[i];
          if (a.hidden || !a.mesh.visible) continue;
          for (let j = i + 1; j < villagers.length; j++) {
            const b = villagers[j];
            if (b.hidden || !b.mesh.visible) continue;

            const dx = b.mesh.position.x - a.mesh.position.x;
            const dz = b.mesh.position.z - a.mesh.position.z;
            const distSq = dx * dx + dz * dz;
            if (distSq >= minDistSq) continue;
            anyOverlap = true;

            const dist = Math.sqrt(distSq);
            let nx, nz;
            if (dist < 1e-4) {
              // Exactly (or almost exactly) coincident - dx/dz give no usable
              // direction to push along (normalizing a zero vector just stays
              // zero), which is what let pairs sit stacked on each other
              // indefinitely. Pick a random push direction instead.
              const randAngle = Math.random() * Math.PI * 2;
              nx = Math.cos(randAngle);
              nz = Math.sin(randAngle);
            } else {
              nx = dx / dist;
              nz = dz / dist;
            }
            // A hair more than the strict overlap so they don't resettle
            // exactly at the contact boundary and re-trigger next frame.
            const overlap = (minDist - dist) / 2 + 0.003;

            a.mesh.position.x -= nx * overlap;
            a.mesh.position.z -= nz * overlap;
            b.mesh.position.x += nx * overlap;
            b.mesh.position.z += nz * overlap;

            const aY = getSurfaceY(a.mesh.position.x, a.mesh.position.z);
            if (aY !== null) a.mesh.position.y = aY;
            const bY = getSurfaceY(b.mesh.position.x, b.mesh.position.z);
            if (bY !== null) b.mesh.position.y = bY;
          }
        }
        if (!anyOverlap) break;
      }
    }

    // --- 5. PROCEDURAL ISLAND GENERATOR ---

    // Main Island Size options, picked on the Custom Game options screen.
    // gridSize drives how many tiles the generator sweeps; baseRadius is the
    // island's rough footprint before per-tile coastline noise is applied.
    const ISLAND_SIZE_CONFIG = {
      small:  { gridSize: 8,  baseRadius: 3.6 },
      medium: { gridSize: 10, baseRadius: 4.6 },
      large:  { gridSize: 14, baseRadius: 6.2 },
      huge:   { gridSize: 16, baseRadius: 7.8 },
    };
    let selectedIslandSize = 'medium';

    function selectIslandSize(size) {
      if (!ISLAND_SIZE_CONFIG[size]) return;
      selectedIslandSize = size;
      document.querySelectorAll('#island-size-group .size-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.size === size);
      });
    }

    // Biome Theme options, picked on the Custom Game options screen. Each
    // theme just retints the shared terrain/foliage/sky/water materials -
    // the island generator itself is untouched, so shape and difficulty
    // stay identical between themes.
    const BIOME_THEME_CONFIG = {
      classic: { sky: 0xa0d8ef, grass: 0x55aa55, sand: 0xddcc88, water: 0x336699, foliage: 0x2e8b57, bush: 0x4a9d4a },
      japan:   { sky: 0xf6c9d8, grass: 0x74b06a, sand: 0xe9ddc4, water: 0x5f8fa3, foliage: 0xf4a6c6, bush: 0xe98fb0 },
      // Desert - dry, sun-bleached palette: warm hazy sky, parched khaki
      // scrubland standing in for "grass" tiles, deep golden dune sand,
      // and a turquoise oasis water color in place of the classic sea.
      // Foliage/bush lean olive-green (scrub brush and palm canopy) rather
      // than the lush greens of the other two themes.
      desert:  { sky: 0xf0cf8f, grass: 0xb8a355, sand: 0xe3c16f, water: 0x2ca6a0, foliage: 0x7a9c3f, bush: 0x9c8a4a },
      // Heaven - the Heavenly Island backdrop for the Event: Death & Life
      // gamemode. A bright, glowing palette: pale sky-blue heavens, warm
      // marble-white "grass"/sand standing in for cloud-marble flooring,
      // a glassy sky-blue water, and soft gold-green foliage/bush. A very
      // light, bright fog stands in for a soft heavenly haze rather than
      // Shadow Island's gloom or Northernlands' cold mist.
      heaven: { sky: 0xbfe3ff, grass: 0xe8e0c8, sand: 0xf5efe0, water: 0x8fd6ff, foliage: 0xe3ecc9, bush: 0xeef4dc, fog: 0xe6f4ff, fogDensity: 0.012, ambient: 0.95, sun: 1.05 },
      // Shadow Island - no village ever spawns here (see the house branch
      // in generateRandomIsland), so the whole tile budget goes to dense
      // scenery props instead. Each generation rolls one of two looks at
      // random (see applyBiomeTheme below): a gloomy castle/dungeon
      // interior, or a misty outdoor swamp. Both live under this one
      // top-level key so the Biome Theme picker only shows a single
      // "Shadow Island" button.
      shadowIsland: {
        dungeon: { sky: 0x151018, grass: 0x3a3540, sand: 0x2c2833, water: 0x14131c, foliage: 0x4a4550, bush: 0x39343d, fog: 0x151018, fogDensity: 0.055, ambient: 0.32, sun: 0.35 },
        swamp:   { sky: 0x525d4f, grass: 0x475c3c, sand: 0x585a3f, water: 0x263a28, foliage: 0x39482c, bush: 0x445634, fog: 0x5c665a, fogDensity: 0.05, ambient: 0.5, sun: 0.55 },
      },
      // Northernlands - icy Viking/Norse palette: a pale frost-white sky,
      // snow-blue "grass" tiles standing in for green fields, icy pale
      // sand, a deep slate-blue fjord water color, and cool blue-green
      // foliage/bush tones (frosted pines, frost-bitten scrub) rather than
      // the classic theme's lush greens. A light, cold FogExp2 (see the
      // generic branch of applyBiomeTheme below) reads as blowing snow
      // haze without going as dark or dense as Shadow Island's fog.
      northernlands: { sky: 0xb9cdd6, grass: 0xc7d6d6, sand: 0xd8e2e4, water: 0x2f4d5e, foliage: 0x3f6e5e, bush: 0x6f8f87, fog: 0xc4d3d8, fogDensity: 0.02, ambient: 0.68, sun: 0.78 },
    };
    let selectedBiomeTheme = 'classic';
    // Which of Shadow Island's two looks is active right now - re-rolled
    // every time a Shadow Island run generates a new island (see
    // generateRandomIsland), so it doesn't always land on the same
    // dungeon-vs-swamp look. Read by createSceneryTree/createRock to swap
    // in the right prop meshes for whichever look is currently active.
    let shadowIslandVariant = 'dungeon';

    function selectBiomeTheme(theme) {
      if (!BIOME_THEME_CONFIG[theme]) return;
      selectedBiomeTheme = theme;
      document.querySelectorAll('#biome-theme-group .size-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.biome === theme);
      });
    }

    // Campaign's own Map picker - separate from Custom Game's Biome Theme
    // selection above (selectedBiomeTheme/#biome-theme-group) so switching
    // maps in one mode never disturbs the other's last choice. Read by
    // startCampaignLevel, which now applies this instead of always
    // hardcoding 'classic'.
    let selectedCampaignBiome = 'classic';
    function selectCampaignBiomeTheme(theme) {
      if (!BIOME_THEME_CONFIG[theme]) return;
      selectedCampaignBiome = theme;
      document.querySelectorAll('#campaign-biome-theme-group .size-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.biome === theme);
      });
    }

    // Applies a Biome Theme's palette to the shared scene background and
    // materials. Called right before island generation so every tile,
    // tree and bush placed afterward picks up the new colors automatically.
    // Shadow Island is special-cased: it re-rolls which of its two looks
    // (dungeon interior / outdoor swamp) is active and drives fog + light
    // levels for that gloomy look - every other theme resets those back to
    // the normal clear-day defaults.
    function applyBiomeTheme(theme) {
      if (theme === 'shadowIsland') {
        shadowIslandVariant = Math.random() < 0.5 ? 'dungeon' : 'swamp';
        const cfg = BIOME_THEME_CONFIG.shadowIsland[shadowIslandVariant];
        scene.background = new THREE.Color(cfg.sky);
        grassMat.color.setHex(cfg.grass);
        sandMat.color.setHex(cfg.sand);
        waterMat.color.setHex(cfg.water);
        foliageGreen.color.setHex(cfg.foliage);
        bushGreen.color.setHex(cfg.bush);
        scene.fog = new THREE.FogExp2(cfg.fog, cfg.fogDensity);
        ambientLight.intensity = cfg.ambient;
        dirLight.intensity = cfg.sun;
        return;
      }
      const cfg = BIOME_THEME_CONFIG[theme] || BIOME_THEME_CONFIG.classic;
      scene.background = new THREE.Color(cfg.sky);
      grassMat.color.setHex(cfg.grass);
      sandMat.color.setHex(cfg.sand);
      waterMat.color.setHex(cfg.water);
      foliageGreen.color.setHex(cfg.foliage);
      bushGreen.color.setHex(cfg.bush);
      // Northernlands carries its own light cold-mist fog and dimmer
      // light levels (see BIOME_THEME_CONFIG.northernlands above); every
      // other non-Shadow-Island theme has no cfg.fog and falls back to
      // the normal clear-day defaults with no fog at all.
      scene.fog = cfg.fog ? new THREE.FogExp2(cfg.fog, cfg.fogDensity || 0.03) : null;
      ambientLight.intensity = cfg.ambient || 0.65;
      dirLight.intensity = cfg.sun || 0.85;
    }


    // Separate Small Islands: how many extra tiny islands ring the main
    // island, each stitched back to it with a wooden bridge.
    let selectedSatelliteCount = 1;

    function selectSatelliteCount(n) {
      selectedSatelliteCount = n;
      document.querySelectorAll('#satellite-count-group .count-btn').forEach(btn => {
        btn.classList.toggle('selected', Number(btn.dataset.count) === n);
      });
    }

    // Wave Limit: how many waves a Custom Game runs before declaring
    // victory. Either a number from 1-20 (typed into the input) or the
    // string 'endless', picked via the dedicated button.
    let selectedWaveLimit = 20;

    function clampWaveLimit(n) {
      n = Math.round(n);
      if (isNaN(n)) return 1;
      return Math.max(1, Math.min(20, n));
    }

    function selectWaveLimitFromInput() {
      const input = document.getElementById('wave-limit-input');
      const n = Number(input.value);
      selectedWaveLimit = isNaN(n) ? selectedWaveLimit : clampWaveLimit(n);
      updateWaveLimitUI();
    }

    // Snaps the visible input back into the 1-20 range once the player
    // finishes editing it (blur / enter), so out-of-range typing like
    // "25" or "0" settles on a valid value instead of staying displayed.
    function clampWaveLimitInput() {
      const input = document.getElementById('wave-limit-input');
      const n = clampWaveLimit(Number(input.value));
      input.value = n;
      selectedWaveLimit = n;
      updateWaveLimitUI();
    }

    function selectWaveLimit(value) {
      if (value === 'endless') {
        selectedWaveLimit = 'endless';
      } else {
        clampWaveLimitInput();
      }
      updateWaveLimitUI();
    }

    function updateWaveLimitUI() {
      const input = document.getElementById('wave-limit-input');
      const btn = document.getElementById('wave-limit-endless-btn');
      if (!input || !btn) return;
      const isEndless = selectedWaveLimit === 'endless';
      input.classList.toggle('selected', !isEndless);
      btn.classList.toggle('selected', isEndless);
    }

    // Default the UI to reflect the initial selection once the DOM is ready.
    document.addEventListener('DOMContentLoaded', () => {
      selectIslandSize(selectedIslandSize);
      selectSatelliteCount(selectedSatelliteCount);
      selectBiomeTheme(selectedBiomeTheme);
      selectCampaignBiomeTheme(selectedCampaignBiome);
      updateWaveLimitUI();
    });

    const islandGroup = new THREE.Group();
    scene.add(islandGroup);

    const gridGroup = new THREE.Group();
    scene.add(gridGroup);

    // Castle Interior - the walled, land-only courtyard beyond the Orc
    // Fortress's blown gate (see enterCastleInterior/buildCastleInteriorMap).
    // Kept as its own always-present group, separate from islandGroup/
    // gridGroup, so entering it is just a visibility swap + a far-away
    // camera move rather than tearing down and rebuilding the outer
    // island. Hidden until an Assault is actually launched.
    const castleInteriorGroup = new THREE.Group();
    scene.add(castleInteriorGroup);
    castleInteriorGroup.visible = false;
    const gridLineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 });

    function createTileOutline(x, y, z) {
      const half = 0.5;
      const points = [
        new THREE.Vector3(x - half, y, z - half),
        new THREE.Vector3(x + half, y, z - half),
        new THREE.Vector3(x + half, y, z + half),
        new THREE.Vector3(x - half, y, z + half),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.LineLoop(geo, gridLineMat);
    }

    const targetHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffee55, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    targetHighlight.rotation.x = -Math.PI / 2;
    targetHighlight.visible = false;
    scene.add(targetHighlight);

    let GRID_SIZE = 10;
    const CUBE_SIZE = 1;
    const cubeGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

    function hash2(x, z) {
      const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
      return n - Math.floor(n);
    }
    function valueNoise2D(x, z) {
      const xi = Math.floor(x), zi = Math.floor(z);
      const xf = x - xi, zf = z - zi;
      const fade = t => t * t * (3 - 2 * t);
      const u = fade(xf), v = fade(zf);
      const a = hash2(xi, zi), b = hash2(xi + 1, zi);
      const c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, z, octaves) {
      let total = 0, amp = 0.5, freq = 1, maxAmp = 0;
      for (let i = 0; i < octaves; i++) {
        total += valueNoise2D(x * freq, z * freq) * amp;
        maxAmp += amp;
        amp *= 0.5;
        freq *= 2;
      }
      return total / maxAmp;
    }

    // Re-fits the directional light's shadow frustum to whatever terrain a
    // given run actually produced. The light sits at an equal x/z offset,
    // so its frustum's left/right axis lines up with the world's (1,-1)
    // diagonal - a tile out along exactly that diagonal needs roughly
    // sqrt(2) more frustum half-size than its straight-line distance from
    // the island center just to stay inside the box, which is why a flat
    // "generous-looking" fixed size could still clip on some runs (see the
    // comment on dirLight's setup above). Called once every
    // generateRandomIsland(), after every tile - main island, and any
    // Separate Small Islands and their bridges - has been placed, so this
    // always matches this run's real extent instead of a static guess.
    function updateShadowCoverage(tiles) {
      let maxExtent = 0;
      for (const t of tiles) {
        maxExtent = Math.max(maxExtent, Math.abs(t.x), Math.abs(t.z));
      }
      const halfSize = Math.max(24, maxExtent * Math.SQRT2 * 1.35);
      dirLight.shadow.camera.left = -halfSize;
      dirLight.shadow.camera.right = halfSize;
      dirLight.shadow.camera.top = halfSize;
      dirLight.shadow.camera.bottom = -halfSize;
      dirLight.shadow.camera.updateProjectionMatrix();
    }

    function generateRandomIsland() {
      while (islandGroup.children.length > 0) {
        islandGroup.remove(islandGroup.children[0]);
      }
      while (gridGroup.children.length > 0) {
        gridGroup.remove(gridGroup.children[0]);
      }
      targetHighlight.visible = false;

      // Apply the chosen Main Island Size for this run.
      const sizeCfg = ISLAND_SIZE_CONFIG[selectedIslandSize] || ISLAND_SIZE_CONFIG.medium;
      GRID_SIZE = sizeCfg.gridSize;

      // Re-applying here (not just at game start) means Shadow Island
      // re-rolls its dungeon-vs-swamp look on every "New Island" reroll
      // too, not just once when the run begins.
      applyBiomeTheme(selectedBiomeTheme);

      colliders.length = 0;
      roadTiles.clear();
      buildingTileKeys.clear();
      propTileKeys.clear();
      stealthTileKeys.clear();
      parkourTileKeys.clear();
      for (const key in heightMap) delete heightMap[key];
      spawnedSpecial = { church: false, blacksmith: false, wizardTower: false, barracks: false };
      barracksTile = null;
      // The Undertaker's mesh lives in islandGroup (cleared above) so it
      // doesn't need explicit scene removal - just drop the references.
      undertakerHouseTile = null;
      undertakerGateTile = null;
      undertaker = null;
      demonPortalTile = null;
      scarecrowTile = null;
      scarecrowMesh = null;
      scarecrowFarm = null;
      gargoyleTiles = [];
      gargoyleMeshesByTile = {};
      orcFortressTile = null;
      orcFortressGateTile = null;
      orcFortressSideTiles = null;
      orcFortressOpenSide = null;
      orcFortressWallMeshes = {};
      orcFortressPickMeshes = [];
      orcFortressCooldown = 0;
      orcFortressHp = 0;
      orcFortressMaxHp = 0;
      orcFortressDestroyed = false;
      orcFortressUnarmed = false;
      orcFortressAssaultActive = false;
      orcFortressSurvivingDefenderCount = null;
      orcFortressRazed = false;
      capturedFortressTarget = null;
      hideOrcFortressPanel();
      // The Siege Tent's mesh lives in islandGroup (cleared above) so it
      // doesn't need explicit scene removal - just drop the references and
      // close its panel if it happened to be open.
      siegeTentTile = null;
      siegeTentMesh = null;
      hideSiegeTentPanel();
      squads.forEach(s => { s.isSiegingFortress = false; s.fortressPlantTimer = null; s.fortressFuseTimer = null; });
      // The Watch Tower is player-built and not part of islandGroup (see
      // its own scene.add in createWatchTower/watchTowerBuilds), so it
      // needs explicit teardown here rather than getting swept up by the
      // heightMap/propPlan reset above. Multiple can exist at once.
      watchTowers.forEach(tower => {
        if (tower.hpElement) tower.hpElement.remove();
        scene.remove(tower.mesh);
        // Restore whoever was operating it, same as destroyWatchTower -
        // otherwise a reset mid-operation would leave that Engineer
        // permanently invisible/untargetable on the new island.
        if (tower.operatorSquad) {
          tower.operatorSquad.members.forEach(m => {
            m.userData.isOperatingTower = false;
            m.visible = true;
          });
        }
      });
      watchTowers = [];
      watchTowerBuilds.forEach(wb => scene.remove(wb.mesh));
      watchTowerBuilds = [];
      watchTowersBuiltCount = 0;
      zombieFlames.length = 0;
      houseGlows.forEach(g => scene.remove(g.light));
      houseGlows.length = 0;
      demonicPortalFX.length = 0;

      // Clear raiders and FX
      raiderSquads.forEach(s => removeSquadFromScene(s));
      raiderSquads.length = 0;
      militiaSquads.forEach(s => removeSquadFromScene(s));
      militiaSquads.length = 0;
      fallingHorses.forEach(fh => { if (fh.mesh.parent) fh.mesh.parent.remove(fh.mesh); });
      fallingHorses.length = 0;
      fleeingHorses.forEach(fh => { if (fh.mesh.parent) fh.mesh.parent.remove(fh.mesh); });
      fleeingHorses.length = 0;
      droppedWeapons.forEach(w => { if (w.parent) w.parent.remove(w); });
      droppedWeapons.length = 0;
      strandedBoats.length = 0;
      villagers.length = 0;
      
      activeProjectiles.forEach(p => scene.remove(p.mesh));
      activeProjectiles.length = 0;
      pendingMagicMissiles.length = 0;
      activeParticles.forEach(p => scene.remove(p.mesh));
      activeParticles.length = 0;
      activeSmokePuffs.forEach(p => scene.remove(p.mesh));
      activeSmokePuffs.length = 0;
      activeHolyBeams.forEach(hb => { scene.remove(hb.beam); scene.remove(hb.ring); });
      activeHolyBeams.length = 0;
      activeLightningBolts.forEach(lb => { scene.remove(lb.bolt); scene.remove(lb.ring); });
      activeLightningBolts.length = 0;
      activeLightShockBursts.forEach(ls => { scene.remove(ls.ring); scene.remove(ls.ring2); });
      activeLightShockBursts.length = 0;
      activeSlashArcs.forEach(s => { scene.remove(s.group); });
      activeSlashArcs.length = 0;
      activeShadowBursts.forEach(sb => { scene.remove(sb.ring); scene.remove(sb.core); });
      activeShadowBursts.length = 0;
      activeGraspFX.forEach(gc => scene.remove(gc.mesh));
      activeGraspFX.length = 0;
      goddessPossessions.forEach(p => cancelGoddessPossession(p));
      goddessPossessions.length = 0;

      ragdolls.forEach(r => scene.remove(r.group));
      ragdolls.length = 0;
      bloodDecals.forEach(b => scene.remove(b.mesh));
      bloodDecals.length = 0;
      steelSouls.forEach(s => {
        scene.remove(s.soulMesh); disposeSoulGroup(s.soulMesh);
        scene.remove(s.handL); disposeSoulGroup(s.handL);
        scene.remove(s.handR); disposeSoulGroup(s.handR);
      });
      steelSouls.length = 0;
      dyingUnits.forEach(d => {
        if (d.uData.hpElement) d.uData.hpElement.remove();
        if (d.unit.parent) d.unit.parent.remove(d.unit);
      });
      dyingUnits.length = 0;
      birds.forEach(b => scene.remove(b.mesh));
      birds.length = 0;

      waveNumber = 0;
      if (waveCooldownInterval) { clearInterval(waveCooldownInterval); waveCooldownInterval = null; }
      waveCooldownActive = false;
      waveIntermissionActive = false;
      waveInProgress = false;
      waveCooldownRemaining = 0;
      coastTiles = [];
      marketplaceTiles = [];

      const seedX = Math.random() * 100;
      const seedZ = Math.random() * 100;
      const tileHeights = [];
      const buildingTiles = [];

      const rawGrid = {};
      for (let x = -GRID_SIZE/2 - 1; x <= GRID_SIZE/2 + 1; x++) {
        for (let z = -GRID_SIZE/2 - 1; z <= GRID_SIZE/2 + 1; z++) {
          const distFromCenter = Math.sqrt(x*x + z*z);
          const angle = Math.atan2(z, x);

          const nx = (x + seedX), nz = (z + seedZ);
          const elevation = fbm(nx * 0.18, nz * 0.18, 4);
          const detail = fbm(nx * 0.5 + 40, nz * 0.5 + 40, 2);
          const coastWarp = fbm(Math.cos(angle) * 1.6 + seedX * 0.3, Math.sin(angle) * 1.6 + seedZ * 0.3, 3);

          const islandRadius = sizeCfg.baseRadius + (coastWarp - 0.5) * 3.4;
          let rawHeight = (islandRadius - distFromCenter) * 0.85
                        + (elevation - 0.35) * 5.5
                        + (detail - 0.5) * 1.2;

          rawGrid[x + ',' + z] = rawHeight;
        }
      }

      const smoothGrid = {};
      for (let x = -GRID_SIZE/2; x < GRID_SIZE/2; x++) {
        for (let z = -GRID_SIZE/2; z < GRID_SIZE/2; z++) {
          const self = rawGrid[x + ',' + z];
          const n = rawGrid[(x+1) + ',' + z] + rawGrid[(x-1) + ',' + z] +
                    rawGrid[x + ',' + (z+1)] + rawGrid[x + ',' + (z-1)];
          smoothGrid[x + ',' + z] = self * 0.6 + (n / 4) * 0.4;
        }
      }

      const propPlan = {};

      // Orc Fortress - rolled once up front (rather than after the tile
      // loop like the Cemetery/Demonic Portal specials) because it needs
      // to change how the main tile loop below behaves: an island that
      // rolls a Fortress skips its normal village-house chance entirely
      // and fills every non-Fortress tile with forest/props instead (see
      // the isOrcFortressIsland branch just below) - Classic biome only,
      // never mixed with a village on the same island. Never on the
      // Small Main Island Size - its 8x8 grid is too tight to fit the
      // 5x5 footprint plus any breathing room around it, so the roll is
      // skipped outright rather than repeatedly failing to find a spot.
      const ORC_FORTRESS_SPAWN_CHANCE = 0.15; // low chance per island generation
      const ORC_FORTRESS_SIZE = 5; // 5x5 tile footprint
      const orcFortressWillSpawn = selectedBiomeTheme === 'classic' &&
          selectedIslandSize !== 'small' &&
          Math.random() < ORC_FORTRESS_SPAWN_CHANCE;

      for (let x = -GRID_SIZE/2; x < GRID_SIZE/2; x++) {
        for (let z = -GRID_SIZE/2; z < GRID_SIZE/2; z++) {
          const height = smoothGrid[x + ',' + z] > 0 ? 1 : 0;
          if (height === 0) continue;

          const tile = { x, z, y: height };
          tileHeights.push(tile);
          heightMap[x + ',' + z] = height;

          // Sand belongs on the coastline, not scattered at random through
          // the interior - a tile counts as coastal if any of its 4
          // neighbors is water (height <= 0, including grid edges where
          // the neighbor doesn't exist at all). Coastal tiles mostly get
          // sand (with a little grass mixed in so the shoreline isn't a
          // perfectly clean ring); interior tiles are almost always grass,
          // with only a rare stray patch of sand for texture.
          const nN = smoothGrid[x + ',' + (z - 1)];
          const nS = smoothGrid[x + ',' + (z + 1)];
          const nE = smoothGrid[(x + 1) + ',' + z];
          const nW = smoothGrid[(x - 1) + ',' + z];
          const isCoastal = [nN, nS, nE, nW].some(h => h === undefined || h <= 0);
          const mat = isCoastal
            ? (Math.random() > 0.2 ? sandMat : grassMat)
            : (Math.random() > 0.92 ? sandMat : grassMat);
          const block = new THREE.Mesh(cubeGeo, mat);
          block.position.set(x, 0, z);
          block.castShadow = true;
          block.receiveShadow = true;
          islandGroup.add(block);

          gridGroup.add(createTileOutline(x, height - 0.5 + 0.01, z));

          const topY = height - 0.5;
          const randProp = Math.random();
          const isShadowIsland = selectedBiomeTheme === 'shadowIsland';

          if (isShadowIsland) {
            // Shadow Island never spawns a village - the tile budget that
            // would've gone to houses (and their resident villagers/
            // specials) is spent on extra props instead, at a noticeably
            // higher density than the other biomes. Which prop dominates
            // depends on which look this generation rolled: the Dungeon
            // variant favors rubble/broken-pillar "rock" props over living
            // greenery (a tree wouldn't make sense indoors), the Swamp
            // variant favors dead trees and murky reed bushes.
            if (shadowIslandVariant === 'dungeon') {
              if (randProp < 0.60) propPlan[x + ',' + z] = 'rock';
              else if (randProp < 0.72) propPlan[x + ',' + z] = 'tree';
              else propPlan[x + ',' + z] = null;
            } else {
              if (randProp < 0.32) propPlan[x + ',' + z] = 'tree';
              else if (randProp < 0.55) propPlan[x + ',' + z] = 'rock';
              else if (randProp < 0.85) propPlan[x + ',' + z] = 'bush';
              else propPlan[x + ',' + z] = null;
            }
            continue;
          }

          // Heaven skips the normal village too - the Heavenly Island is a
          // temple ruin, not a farming village, so the tile budget goes to
          // marble ruin pillars (createSceneryTree's heaven branch) and
          // patches of grass/bush instead of houses.
          if (selectedBiomeTheme === 'heaven') {
            if (randProp < 0.42) propPlan[x + ',' + z] = 'tree';
            else if (randProp < 0.58) propPlan[x + ',' + z] = 'rock';
            else if (randProp < 0.78) propPlan[x + ',' + z] = 'bush';
            else propPlan[x + ',' + z] = null;
            continue;
          }

          // An island that rolled an Orc Fortress (see orcFortressWillSpawn
          // above) never spawns its normal village either - same idea as
          // Shadow Island above, just for the Classic biome: the tile
          // budget that would've gone to houses is spent on extra forest
          // (trees, rocks, bushes) instead, so the Fortress placed after
          // this loop reads as a hostile camp carved out of the woods
          // rather than sitting next to a peaceful village.
          if (orcFortressWillSpawn) {
            if (randProp < 0.38) propPlan[x + ',' + z] = 'tree';
            else if (randProp < 0.58) propPlan[x + ',' + z] = 'rock';
            else if (randProp < 0.80) propPlan[x + ',' + z] = 'bush';
            else propPlan[x + ',' + z] = null;
            continue;
          }

          if (randProp < 0.08) {
            const built = createHouseVariant(x, topY, z);
            islandGroup.add(built.mesh);
            buildingTiles.push({ x, z });
            buildingTileKeys.add(x + ',' + z);
            propPlan[x + ',' + z] = 'house';
            if (built.type === 'wizardTower') {
              // A Wizard Tower is on the island — give it a resident Cleric or
              // Apprentice Mage. On The Far East biome it's a Pagoda instead,
              // so it gets a melee Monk in their place, and in The
              // Northernlands it's a Viking Shaman Temple whose resident is
              // a Viking Shaman that heals the squad standing near it.
              if (selectedBiomeTheme === 'japan') {
                spawnSpecialNpc(x, topY, z, 'monk');
              } else if (selectedBiomeTheme === 'northernlands') {
                spawnSpecialNpc(x, topY, z, 'shaman');
              } else {
                spawnSpecialNpc(x, topY, z, Math.random() < 0.5 ? 'cleric' : 'apprenticeMage');
              }
            } else if (built.type === 'church') {
              // A Church is on the island — give it a resident Priest
              spawnPriest(x, topY, z);
            } else if (built.type === 'blacksmith') {
              // A Blacksmith's forge is on the island — give it a resident Blacksmith
              spawnBlacksmithVillager(x, topY, z, built.mesh.rotation.y);
            } else if (built.type === 'barracks') {
              // A Barracks is on the island — raise a 4-strong Villager Militia
              barracksTile = { x: Math.round(x), z: Math.round(z) };
              spawnMilitiaSquad(x, topY, z);
            } else {
              spawnVillager(x, topY, z);
            }
            if (built.type === 'marketplace') {
              marketplaceTiles.push({ x, z });
            }
            // Ninja passive (Concealment) - House, Marketplace, Barracks and
            // Blacksmith rooftops count as stealth cover too, on top of the
            // usual tree/bush tiles, so a Ninja can also go untargetable and
            // fade near-invisible by parking up on one of these buildings.
            if (built.type === 'house' || built.type === 'marketplace' ||
                built.type === 'barracks' || built.type === 'blacksmith') {
              stealthTileKeys.add(x + ',' + z);
              parkourTileKeys.add(x + ',' + z);
            }
          } else if (randProp < 0.22) {
            propPlan[x + ',' + z] = 'tree';
          } else if (randProp < 0.35) {
            propPlan[x + ',' + z] = 'rock';
          } else if (randProp < 0.48) {
            propPlan[x + ',' + z] = 'bush';
          } else {
            propPlan[x + ',' + z] = null;
          }
        }
      }

      // --- Shadow Island Swamp special structure: Cemetery & Undertaker House ---
      // A rare 4x4-tile landmark that can appear only on Shadow Island's
      // outdoor Swamp variant (never the indoor Dungeon variant, and never
      // on any other biome). Low roll, at most one per island generation,
      // and only placed if a clear 4x4 patch of flat swamp land can be
      // found - otherwise the island just generates without one, same as
      // any other biome missing its optional specials. Runs after the main
      // tile loop above (so heightMap/propPlan are fully populated) and
      // before the neighbor-thinning pass below, which only touches
      // tree/rock/bush entries so it can't disturb this structure.
      const CEMETERY_SPAWN_CHANCE = 0.15; // low chance per island generation
      const CEMETERY_SIZE = 4; // 4x4 tile footprint
      if (selectedBiomeTheme === 'shadowIsland' && shadowIslandVariant === 'swamp' &&
          Math.random() < CEMETERY_SPAWN_CHANCE) {
        const cemeteryCandidates = [];
        for (let ox = -GRID_SIZE / 2; ox <= GRID_SIZE / 2 - CEMETERY_SIZE; ox++) {
          for (let oz = -GRID_SIZE / 2; oz <= GRID_SIZE / 2 - CEMETERY_SIZE; oz++) {
            const h = heightMap[ox + ',' + oz];
            if (h === undefined) continue;
            let fits = true;
            for (let li = 0; li < CEMETERY_SIZE && fits; li++) {
              for (let lj = 0; lj < CEMETERY_SIZE && fits; lj++) {
                if (heightMap[(ox + li) + ',' + (oz + lj)] !== h) fits = false;
              }
            }
            if (fits) cemeteryCandidates.push({ ox, oz });
          }
        }
        if (cemeteryCandidates.length > 0) {
          const pick = cemeteryCandidates[Math.floor(Math.random() * cemeteryCandidates.length)];
          // The Undertaker House lands on one of the 4 interior tiles; the
          // other 3 interior tiles become graves, and every corner/edge
          // tile of the 4x4 ring becomes a fence segment enclosing the plot.
          const houseLi = 1 + Math.floor(Math.random() * 2);
          const houseLj = 1 + Math.floor(Math.random() * 2);
          for (let li = 0; li < CEMETERY_SIZE; li++) {
            for (let lj = 0; lj < CEMETERY_SIZE; lj++) {
              const key = (pick.ox + li) + ',' + (pick.oz + lj);
              const isCorner = (li === 0 || li === CEMETERY_SIZE - 1) && (lj === 0 || lj === CEMETERY_SIZE - 1);
              const isEdge = !isCorner && (li === 0 || li === CEMETERY_SIZE - 1 || lj === 0 || lj === CEMETERY_SIZE - 1);
              if (li === houseLi && lj === houseLj) {
                propPlan[key] = 'cemeteryHouse';
              } else if (isCorner || isEdge) {
                propPlan[key] = 'cemeteryFence';
              } else {
                propPlan[key] = 'grave';
              }
            }
          }

          // Leave a single gate-sized gap in the fence ring, directly in
          // front of the Undertaker House's column (li=0, same lj as the
          // house), so the Undertaker actually has a way in and out - the
          // ring above seals every corner/edge tile otherwise, which would
          // make the whole Cemetery unreachable by normal pathfinding.
          undertakerHouseTile = { x: pick.ox + houseLi, z: pick.oz + houseLj };
          undertakerGateTile = { x: pick.ox, z: pick.oz + houseLj };
          propPlan[undertakerGateTile.x + ',' + undertakerGateTile.z] = null;
        }
      }

      // --- Shadow Island Dungeon special structure: Demonic Portal ---
      // A rare single-tile landmark that can appear only on Shadow
      // Island's indoor Dungeon variant (never the outdoor Swamp variant,
      // and never on any other biome) - the Dungeon counterpart to the
      // Swamp variant's Cemetery above. Low roll, at most one per island
      // generation. Runs after the main tile loop (so heightMap is fully
      // populated) and before the neighbor-thinning pass below, which
      // only touches tree/rock/bush entries so it can't disturb this
      // structure.
      const DEMONIC_PORTAL_SPAWN_CHANCE = 0.15; // low chance per island generation
      if (selectedBiomeTheme === 'shadowIsland' && shadowIslandVariant === 'dungeon' &&
          Math.random() < DEMONIC_PORTAL_SPAWN_CHANCE) {
        const portalCandidates = Object.keys(heightMap);
        if (portalCandidates.length > 0) {
          const pickKey = portalCandidates[Math.floor(Math.random() * portalCandidates.length)];
          propPlan[pickKey] = 'demonicPortal';
          const [pkx, pkz] = pickKey.split(',').map(Number);
          demonPortalTile = { x: pkx, z: pkz };
        }
      }

      // --- Shadow Island Swamp special: abandoned farm with a dormant Scarecrow ---
      // A rare farmstead that can appear only on Shadow Island's outdoor
      // Swamp variant (never the indoor Dungeon variant, and never on any
      // other biome). Low roll, at most one per island generation. It's a
      // 4x3 patch of land: an Abandoned Farm House at one end, the dormant
      // Scarecrow two tiles in front of its door, and wheat fields on every
      // other tile. The Scarecrow just stands there like any other prop
      // until a wave starts and it wakes up - see maybeAwakenScarecrow.
      // Prefers a perfectly flat patch and never overlaps the Cemetery; if
      // the island has no room for the whole farm at all, the Scarecrow
      // still spawns alone on a free inland tile.
      if (selectedBiomeTheme === 'shadowIsland' && shadowIslandVariant === 'swamp' &&
          Math.random() < SCARECROW_SPAWN_CHANCE) {
        const FARM_LONG = 4, FARM_SHORT = 3;

        // Tiles already spoken for by the Cemetery, plus the ring around
        // its fence gate, are off limits.
        const farmReserved = new Set();
        for (const k in propPlan) {
          const t = propPlan[k];
          if (t === 'cemeteryHouse' || t === 'cemeteryFence' || t === 'grave') farmReserved.add(k);
        }
        if (undertakerGateTile) {
          for (let gx = -1; gx <= 1; gx++) {
            for (let gz = -1; gz <= 1; gz++) {
              farmReserved.add((undertakerGateTile.x + gx) + ',' + (undertakerGateTile.z + gz));
            }
          }
        }

        const flatSites = [], anySites = [];
        [true, false].forEach(alongX => {
          const fw = alongX ? FARM_LONG : FARM_SHORT;
          const fd = alongX ? FARM_SHORT : FARM_LONG;
          for (let ox = -GRID_SIZE / 2; ox <= GRID_SIZE / 2 - fw; ox++) {
            for (let oz = -GRID_SIZE / 2; oz <= GRID_SIZE / 2 - fd; oz++) {
              const h0 = heightMap[ox + ',' + oz];
              if (h0 === undefined) continue;
              let fits = true, flat = true;
              for (let li = 0; li < fw && fits; li++) {
                for (let lj = 0; lj < fd && fits; lj++) {
                  const k = (ox + li) + ',' + (oz + lj);
                  const h = heightMap[k];
                  if (h === undefined || farmReserved.has(k)) fits = false;
                  else if (h !== h0) flat = false;
                }
              }
              if (fits) (flat ? flatSites : anySites).push({ ox, oz, alongX, fw, fd });
            }
          }
        });
        const farmPool = flatSites.length > 0 ? flatSites : anySites;

        if (farmPool.length > 0) {
          const site = farmPool[Math.floor(Math.random() * farmPool.length)];
          // The house sits at one end of the long axis (either end), the
          // Scarecrow two tiles in from it, in the middle row of the short
          // axis. The door faces down the long axis toward the Scarecrow.
          const houseAtStart = Math.random() < 0.5;
          const houseA = houseAtStart ? 0 : FARM_LONG - 1;
          const scarecrowA = houseAtStart ? 2 : FARM_LONG - 3;
          const midB = 1;
          for (let li = 0; li < site.fw; li++) {
            for (let lj = 0; lj < site.fd; lj++) {
              const a = site.alongX ? li : lj; // index along the long axis
              const b = site.alongX ? lj : li; // index along the short axis
              const key = (site.ox + li) + ',' + (site.oz + lj);
              if (a === houseA && b === midB) propPlan[key] = 'farmHouse';
              else if (a === scarecrowA && b === midB) {
                propPlan[key] = 'scarecrow';
                scarecrowTile = { x: site.ox + li, z: site.oz + lj };
              } else propPlan[key] = 'wheat';
            }
          }
          const faceDir = houseAtStart ? 1 : -1;
          scarecrowFarm = { houseRotY: site.alongX ? faceDir * Math.PI / 2 : (faceDir > 0 ? 0 : Math.PI) };
        } else {
          // No room for a whole farm - fall back to the lone Scarecrow
          // on a free inland tile (any free tile if none is inland).
          const freeKeys = Object.keys(heightMap).filter(k => !propPlan[k]);
          const inlandKeys = freeKeys.filter(k => {
            const [kx, kz] = k.split(',').map(Number);
            return heightMap[(kx + 1) + ',' + kz] !== undefined && heightMap[(kx - 1) + ',' + kz] !== undefined &&
                   heightMap[kx + ',' + (kz + 1)] !== undefined && heightMap[kx + ',' + (kz - 1)] !== undefined;
          });
          const scarecrowPool = inlandKeys.length > 0 ? inlandKeys : freeKeys;
          if (scarecrowPool.length > 0) {
            const scKey = scarecrowPool[Math.floor(Math.random() * scarecrowPool.length)];
            propPlan[scKey] = 'scarecrow';
            const [scx, scz] = scKey.split(',').map(Number);
            scarecrowTile = { x: scx, z: scz };
          }
        }
      }

      // --- Shadow Island Dungeon special: dormant Gargoyle Statues ---
      // Exactly GARGOYLE_STATUE_COUNT (2) ordinary-looking stone statues,
      // placed on land only on Shadow Island's indoor Dungeon variant
      // (never the outdoor Swamp variant, and never any other biome).
      // No structure like the Scarecrow's farm - just two free inland
      // tiles (falling back to any free tile if the island has fewer
      // than two inland spots), each holding one statue. They just stand
      // there like any other prop until a wave starts, at which point
      // each independently rolls a chance to wake - see
      // maybeAwakenGargoyles.
      if (selectedBiomeTheme === 'shadowIsland' && shadowIslandVariant === 'dungeon') {
        const gFreeKeys = Object.keys(heightMap).filter(k => !propPlan[k]);
        const gInlandKeys = gFreeKeys.filter(k => {
          const [kx, kz] = k.split(',').map(Number);
          return heightMap[(kx + 1) + ',' + kz] !== undefined && heightMap[(kx - 1) + ',' + kz] !== undefined &&
                 heightMap[kx + ',' + (kz + 1)] !== undefined && heightMap[kx + ',' + (kz - 1)] !== undefined;
        });
        const gPool = (gInlandKeys.length >= GARGOYLE_STATUE_COUNT ? gInlandKeys : gFreeKeys).slice();
        for (let i = 0; i < GARGOYLE_STATUE_COUNT && gPool.length > 0; i++) {
          const pick = Math.floor(Math.random() * gPool.length);
          const gKey = gPool.splice(pick, 1)[0];
          propPlan[gKey] = 'gargoyleStatue';
          const [gx, gz] = gKey.split(',').map(Number);
          gargoyleTiles.push({ x: gx, z: gz });
        }
      }

      // --- Classic biome special structure: Orc Fortress ---
      // A rare 5x5-tile hostile landmark that can appear only on the
      // Classic biome (never any other biome theme) - see
      // orcFortressWillSpawn, rolled up front before the main tile loop
      // since it also controls whether this island spawns a village at
      // all (see the isOrcFortressIsland-style branch above). Same
      // candidate-search shape as the Cemetery's 4x4 placement, just a
      // 5x5 footprint: a palisade wall ring of sharpened stakes around
      // the outside, a watchtower at dead center (see createOrcFortress -
      // also the tile updateOrcFortress fires arrows from), and open yard
      // tiles filling the ring between them. A single gate gap is left in
      // the wall, same reasoning as the Cemetery's gate - otherwise the
      // ring would seal the whole 5x5 plot off from normal pathfinding.
      if (orcFortressWillSpawn) {
        const fortressCandidates = [];
        for (let ox = -GRID_SIZE / 2; ox <= GRID_SIZE / 2 - ORC_FORTRESS_SIZE; ox++) {
          for (let oz = -GRID_SIZE / 2; oz <= GRID_SIZE / 2 - ORC_FORTRESS_SIZE; oz++) {
            const h = heightMap[ox + ',' + oz];
            if (h === undefined) continue;
            let fits = true;
            for (let li = 0; li < ORC_FORTRESS_SIZE && fits; li++) {
              for (let lj = 0; lj < ORC_FORTRESS_SIZE && fits; lj++) {
                if (heightMap[(ox + li) + ',' + (oz + lj)] !== h) fits = false;
              }
            }
            if (fits) fortressCandidates.push({ ox, oz });
          }
        }
        if (fortressCandidates.length > 0) {
          const pick = fortressCandidates[Math.floor(Math.random() * fortressCandidates.length)];
          const center = Math.floor(ORC_FORTRESS_SIZE / 2);
          for (let li = 0; li < ORC_FORTRESS_SIZE; li++) {
            for (let lj = 0; lj < ORC_FORTRESS_SIZE; lj++) {
              const key = (pick.ox + li) + ',' + (pick.oz + lj);
              const isCorner = (li === 0 || li === ORC_FORTRESS_SIZE - 1) && (lj === 0 || lj === ORC_FORTRESS_SIZE - 1);
              const isEdge = !isCorner && (li === 0 || li === ORC_FORTRESS_SIZE - 1 || lj === 0 || lj === ORC_FORTRESS_SIZE - 1);
              if (li === center && lj === center) {
                propPlan[key] = 'orcFortress';
              } else if (isCorner || isEdge) {
                propPlan[key] = 'orcFortressWall';
              } else {
                // Rest of the 3x3 keep block (the single mesh built at the
                // center tile above visually spans all of it) - solid and
                // unwalkable, but no mesh of its own. See the
                // 'orcFortressKeepExtra' branch in the propMeshes loop.
                propPlan[key] = 'orcFortressKeepExtra';
              }
            }
          }

          // Gate gap directly in front of the watchtower (li=0, same lj
          // as center), same purpose as the Cemetery's undertakerGateTile.
          orcFortressTile = { x: pick.ox + center, z: pick.oz + center };
          const gateTile = { x: pick.ox, z: pick.oz + center };
          orcFortressGateTile = gateTile;
          propPlan[gateTile.x + ',' + gateTile.z] = null;

          // The other 3 orthogonal edge-midpoints, alongside the gate
          // tile itself, are the full set of candidate gate positions
          // relocateOrcFortressGate can ever swap the gap between (see
          // its own comment for why only these 4 qualify).
          orcFortressSideTiles = {
            W: gateTile,
            E: { x: pick.ox + ORC_FORTRESS_SIZE - 1, z: pick.oz + center },
            N: { x: pick.ox + center, z: pick.oz },
            S: { x: pick.ox + center, z: pick.oz + ORC_FORTRESS_SIZE - 1 },
          };
          orcFortressOpenSide = 'W';
          orcFortressWallMeshes = {};
          orcFortressPickMeshes = [];

          // --- Siege Tent ---
          // A free healing structure that always accompanies a freshly
          // rolled Fortress - parked well clear of the keep itself (past
          // both its firing range and the gate's warband muster point).
          // Prefers the open (west) approach a squad marches in from to
          // siege it, but fans out through all 8 compass directions across
          // a small ring of distances so it reliably finds somewhere to
          // land - a Fortress should practically never spawn without one.
          const SIEGE_TENT_SAFE_DISTANCE = 5; // tiles from the Fortress center - keeps it clear of ORC_FORTRESS_RANGE and the gate muster point
          const SIEGE_TENT_SEARCH_MAX = 9; // how far out the ring search is willing to look before giving up
          const tentDirs = [
            { dx: -1, dz: 0 }, { dx: -1, dz: 1 }, { dx: -1, dz: -1 }, // west first - the open gate side
            { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
            { dx: 1, dz: 0 }, { dx: 1, dz: 1 }, { dx: 1, dz: -1 },
          ];
          const tentCandidates = [];
          for (let dist = SIEGE_TENT_SAFE_DISTANCE; dist <= SIEGE_TENT_SEARCH_MAX; dist++) {
            tentDirs.forEach(d => tentCandidates.push({ x: orcFortressTile.x + d.dx * dist, z: orcFortressTile.z + d.dz * dist }));
          }
          const tentSpot = tentCandidates.find(t =>
            heightMap[t.x + ',' + t.z] !== undefined &&
            !propPlan[t.x + ',' + t.z]
          );
          if (tentSpot) {
            siegeTentTile = tentSpot;
            propPlan[tentSpot.x + ',' + tentSpot.z] = 'siegeTent';
          }
        }
      }

      function neighborObstacleCount(x, z) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        let count = 0;
        for (const [dx, dz] of dirs) {
          if (propPlan[(x + dx) + ',' + (z + dz)]) count++;
        }
        return count;
      }
      for (const key in propPlan) {
        const type = propPlan[key];
        if (type !== 'tree' && type !== 'rock' && type !== 'bush') continue;
        const [px, pz] = key.split(',').map(Number);
        if (neighborObstacleCount(px, pz) >= 3) {
          propPlan[key] = null;
        }
      }

      const propMeshes = {};
      for (const key in propPlan) {
        const type = propPlan[key];
        if (!type || type === 'house') continue;
        const [px, pz] = key.split(',').map(Number);
        const topY = heightMap[key] - 0.5;
        if (type === 'tree') {
          const jx = px + (Math.random() - 0.5) * 0.2;
          const jz = pz + (Math.random() - 0.5) * 0.2;
          const tree = createSceneryTree(jx, topY, jz);
          islandGroup.add(tree);
          propMeshes[key] = tree;
          propTileKeys.add(key);
          stealthTileKeys.add(key);
        } else if (type === 'rock') {
          // Jitter kept small (was up to ±0.15) so the Boulder's mesh stays
          // visually anchored inside its own tile instead of bleeding
          // toward - or past - the tile edge, which made it look like the
          // cover was on a different square than the one actually granting
          // Concealment.
          const jx = px + (Math.random() - 0.5) * 0.14;
          const jz = pz + (Math.random() - 0.5) * 0.14;
          const rock = createRock(jx, topY, jz);
          islandGroup.add(rock);
          propMeshes[key] = rock;
          propTileKeys.add(key);
          // Ninja passive (Concealment) - Boulders count as stealth cover
          // too, same as trees/bushes, and are also climbable (parkour).
          stealthTileKeys.add(key);
          parkourTileKeys.add(key);
        } else if (type === 'bush') {
          const jx = px + (Math.random() - 0.5) * 0.14;
          const jz = pz + (Math.random() - 0.5) * 0.14;
          const bush = createBush(jx, topY, jz);
          islandGroup.add(bush);
          propMeshes[key] = bush;
          propTileKeys.add(key);
          stealthTileKeys.add(key);
        } else if (type === 'cemeteryHouse') {
          // The Cemetery structure's lone building - solid, unwalkable
          // footprint like every other building, plus stealth/parkour
          // cover on its roof (same as House/Marketplace/Barracks/
          // Blacksmith - see the village house branch above).
          const house = createUndertakerHouse(px, topY, pz);
          islandGroup.add(house);
          propMeshes[key] = house;
          buildingTileKeys.add(key);
          stealthTileKeys.add(key);
          parkourTileKeys.add(key);
          // The Undertaker only ever exists alongside its House - spawn it
          // here, right as the House itself is placed.
          spawnUndertaker(px, topY, pz);
        } else if (type === 'demonicPortal') {
          // Demonic Portal - solid, unwalkable footprint like any other
          // structure. No stealth/parkour cover (nothing to stand on top
          // of), unlike a house roof or boulder.
          const portal = createDemonicPortal(px, topY, pz);
          islandGroup.add(portal);
          propMeshes[key] = portal;
          buildingTileKeys.add(key);
        } else if (type === 'farmHouse') {
          // Abandoned Farm House - solid, unwalkable footprint like any
          // other building, with stealth/parkour cover on its roof (same
          // as the Undertaker House). Its door faces the Scarecrow.
          const farmHouse = createAbandonedFarmHouse(px, topY, pz, scarecrowFarm ? scarecrowFarm.houseRotY : 0);
          islandGroup.add(farmHouse);
          propMeshes[key] = farmHouse;
          buildingTileKeys.add(key);
          stealthTileKeys.add(key);
          parkourTileKeys.add(key);
        } else if (type === 'wheat') {
          // Wheat field tile - purely decorative and walkable (no
          // collider, no propTileKeys entry), so squads can wade through
          // it and nothing gets walled off from the Scarecrow.
          const wheat = createWheatField(px, topY, pz);
          islandGroup.add(wheat);
          propMeshes[key] = wheat;
        } else if (type === 'scarecrow') {
          // Dormant Scarecrow - blocks its tile like a tree/gravestone
          // until it wakes up (see maybeAwakenScarecrow). No stealth or
          // parkour cover.
          const scarecrow = createScarecrowProp(px, topY, pz);
          islandGroup.add(scarecrow);
          propMeshes[key] = scarecrow;
          propTileKeys.add(key);
          scarecrowMesh = scarecrow;
        } else if (type === 'gargoyleStatue') {
          // Dormant Gargoyle Statue - blocks its tile like the Scarecrow
          // above, until it wakes up (see maybeAwakenGargoyles). No
          // stealth or parkour cover.
          const gargoyleStatue = createGargoyleStatueProp(px, topY, pz);
          islandGroup.add(gargoyleStatue);
          propMeshes[key] = gargoyleStatue;
          propTileKeys.add(key);
          gargoyleMeshesByTile[key] = gargoyleStatue;
        } else if (type === 'orcFortress') {
          // Orc Fortress - solid, unwalkable footprint like any other
          // structure. No stealth/parkour cover, same as the Demonic
          // Portal - the stake ring and brazier aren't a climbable roof.
          const fortress = createOrcFortress(px, topY, pz);
          islandGroup.add(fortress);
          propMeshes[key] = fortress;
          orcFortressPickMeshes.push(fortress);
          buildingTileKeys.add(key);
          // Sieging state - see the Siege panel's tap handling and
          // updateSquadsSiegingOrcFortress. Fresh full HP and un-destroyed
          // every time a new island actually rolls a Fortress.
          orcFortressHp = ORC_FORTRESS_MAX_HP;
          orcFortressMaxHp = ORC_FORTRESS_MAX_HP;
          orcFortressDestroyed = false;
          orcFortressUnarmed = false;
          orcFortressAssaultActive = false;
        } else if (type === 'orcFortressWall') {
          // Palisade ring around the Fortress - solid/unwalkable like the
          // Cemetery's fence, minus a single gate gap left as `null` by
          // generateRandomIsland.
          const wall = createOrcFortressWall(px, topY, pz);
          islandGroup.add(wall);
          propMeshes[key] = wall;
          orcFortressPickMeshes.push(wall);
          buildingTileKeys.add(key);
          // One of these is an edge-midpoint segment relocateOrcFortressGate
          // may need to reopen later - track it by tile key so that
          // function has a handle on it without reaching into this
          // function-local propMeshes map.
          if (orcFortressSideTiles && Object.values(orcFortressSideTiles).some(t => t.x === px && t.z === pz)) {
            orcFortressWallMeshes[key] = wall;
          }
        } else if (type === 'orcFortressKeepExtra') {
          // Rest of the keep's 3x3 footprint - the single mesh built for
          // the 'orcFortress' center tile above visually covers this
          // whole area already, so these tiles get no mesh of their own,
          // just marked solid/unwalkable like the tile it's built on.
          buildingTileKeys.add(key);
        } else if (type === 'grave') {
          const grave = createGravestone(px, topY, pz);
          islandGroup.add(grave);
          propMeshes[key] = grave;
          propTileKeys.add(key);
          stealthTileKeys.add(key);
        } else if (type === 'cemeteryFence') {
          const fence = createCemeteryFence(px, topY, pz);
          islandGroup.add(fence);
          propMeshes[key] = fence;
          propTileKeys.add(key);
          stealthTileKeys.add(key);
        } else if (type === 'siegeTent') {
          // Siege Tent - a free healing structure that only ever exists
          // alongside an Orc Fortress (see the orcFortressWillSpawn
          // placement block above) and is torn down the moment that
          // Fortress falls (see destroyOrcFortress/removeSiegeTent).
          // Solid/unwalkable footprint, no stealth/parkour cover - same
          // treatment as the Fortress and Portal.
          const tent = createSiegeTent(px, topY, pz);
          islandGroup.add(tent);
          propMeshes[key] = tent;
          buildingTileKeys.add(key);
          siegeTentMesh = tent;
        }
      }

      // --- Separate Small Islands (Custom Game option) ---
      // Scatters `selectedSatelliteCount` tiny islands around the main
      // island's perimeter and stitches each one back with a single-tile-
      // wide wooden bridge, so they're reachable on foot.
      function bresenhamLine(x0, z0, x1, z1) {
        const points = [];
        const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
        const sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
        let err = dx - dz, cx = x0, cz = z0;
        while (true) {
          points.push({ x: cx, z: cz });
          if (cx === x1 && cz === z1) break;
          const e2 = 2 * err;
          if (e2 > -dz) { err -= dz; cx += sx; }
          if (e2 < dx) { err += dx; cz += sz; }
        }
        return points;
      }

      const satelliteCount = Math.max(0, Math.min(4, selectedSatelliteCount || 0));
      const angleOffset = seedX * 0.11; // vary orientation from run to run

      for (let i = 0; i < satelliteCount; i++) {
        const angle = angleOffset + (i / satelliteCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
        const satRadius = 1.1 + Math.random() * 0.7;
        const gap = 2 + Math.random(); // width of open water the bridge spans
        const centerDist = sizeCfg.baseRadius + gap + satRadius + 1;
        const cx = Math.round(Math.cos(angle) * centerDist);
        const cz = Math.round(Math.sin(angle) * centerDist);

        // Carve a small round-ish blob of tiles for this island. Done in
        // two passes: first stake out which tiles belong to the blob (and
        // register them in heightMap), then build the meshes - so the
        // coastal check below can see every tile's finished neighbors
        // instead of only whichever ones happened to be visited earlier
        // in the scan, which is what was producing sand scattered at
        // random through the middle of these little islands.
        const satelliteKeys = new Set();
        const blobSpan = Math.ceil(satRadius) + 1;
        for (let dx = -blobSpan; dx <= blobSpan; dx++) {
          for (let dz = -blobSpan; dz <= blobSpan; dz++) {
            const x = cx + dx, z = cz + dz;
            const key = x + ',' + z;
            if (heightMap[key] !== undefined) continue; // don't overlap existing land
            const d = Math.hypot(dx, dz) + (hash2(x + 500, z + 500) - 0.5) * 0.9;
            if (d > satRadius) continue;

            const tile = { x, z, y: 1 };
            tileHeights.push(tile);
            heightMap[key] = 1;
            satelliteKeys.add(key);
          }
        }

        satelliteKeys.forEach(key => {
          const [x, z] = key.split(',').map(Number);

          // Same coastal rule as the main island: sand hugs the edge of
          // the blob, grass fills the interior.
          const nN = heightMap[x + ',' + (z - 1)];
          const nS = heightMap[x + ',' + (z + 1)];
          const nE = heightMap[(x + 1) + ',' + z];
          const nW = heightMap[(x - 1) + ',' + z];
          const isCoastal = [nN, nS, nE, nW].some(h => h === undefined || h <= 0);
          const mat = isCoastal
            ? (Math.random() > 0.2 ? sandMat : grassMat)
            : (Math.random() > 0.92 ? sandMat : grassMat);
          const block = new THREE.Mesh(cubeGeo, mat);
          block.position.set(x, 0, z);
          block.castShadow = true;
          block.receiveShadow = true;
          islandGroup.add(block);
          gridGroup.add(createTileOutline(x, 0.51, z));

          // Sparse flavor prop so the little island isn't bare.
          if (Math.random() < 0.18) {
              const topY = 0.5;
              // Kept small, same reasoning as the main island's prop
              // jitter above - stays visually anchored on its own tile.
              const jx = x + (Math.random() - 0.5) * 0.14;
              const jz = z + (Math.random() - 0.5) * 0.14;
              const propRoll = Math.random();
              let prop;
              if (propRoll < 0.45) prop = createSceneryTree(jx, topY, jz);
              else if (propRoll < 0.75) prop = createRock(jx, topY, jz);
              else prop = createBush(jx, topY, jz);
              islandGroup.add(prop);
              propTileKeys.add(key);
              // Trees, Boulders (rocks) and bushes all count as stealth
              // cover for the Ninja's Concealment passive; Boulders are
              // also climbable (parkour).
              stealthTileKeys.add(key);
              if (propRoll >= 0.45 && propRoll < 0.75) parkourTileKeys.add(key);
            }
        });
        if (satelliteKeys.size === 0) continue; // no room to carve this one - skip it

        // Lay the bridge from the satellite's edge back to the main island
        // (or to whatever land it first reaches, if a path crosses one).
        // Two tiles wide (not a single-block-wide line) so squads can
        // actually walk across it rather than being funneled onto one tile.
        function layBridgeTile(x, z) {
          const key = x + ',' + z;
          if (heightMap[key] !== undefined) return; // already land - leave it
          const tile = { x, z, y: 1 };
          tileHeights.push(tile);
          heightMap[key] = 1;

          const block = new THREE.Mesh(cubeGeo, woodMat);
          block.position.set(x, 0, z);
          block.castShadow = true;
          block.receiveShadow = true;
          islandGroup.add(block);
          gridGroup.add(createTileOutline(x, 0.51, z));
        }

        // Aim the bridge at whichever land tile is actually nearest the
        // satellite, not at the main island's center (0,0). A straight
        // shot at the center can, whenever a satellite sits off to the
        // side of a cove or inlet, run parallel to the coast for a long
        // stretch before it finally reaches land - landing the bridge deep
        // inside the main island's silhouette instead of right at its
        // edge. Searching outward for the closest land tile guarantees the
        // shortest possible crossing, which always lands at the true
        // nearest edge.
        function findNearestLandTile(originX, originZ, maxSearch) {
          let best = null, bestDist = Infinity;
          for (let dx = -maxSearch; dx <= maxSearch; dx++) {
            for (let dz = -maxSearch; dz <= maxSearch; dz++) {
              const x = originX + dx, z = originZ + dz;
              const key = x + ',' + z;
              if (satelliteKeys.has(key)) continue;
              if (heightMap[key] === undefined) continue;
              const d = dx * dx + dz * dz;
              if (d < bestDist) { bestDist = d; best = { x, z }; }
            }
          }
          return best;
        }

        const searchRadius = Math.ceil(sizeCfg.baseRadius + gap + satRadius + 6);
        const landTarget = findNearestLandTile(cx, cz, searchRadius) || { x: 0, z: 0 };

        // Belt-and-suspenders cap on top of targeting the nearest point:
        // even if something upstream ever left landTarget unexpectedly far
        // away, never let a single bridge run longer than the water gap it
        // was meant to span (plus a small buffer for the diagonal jogs a
        // Bresenham line can take), so it can never wander deep into the
        // island under any circumstance.
        const maxBridgeSteps = Math.ceil(Math.hypot(landTarget.x - cx, landTarget.z - cz)) + 2;

        const line = bresenhamLine(cx, cz, landTarget.x, landTarget.z);
        const dirX = landTarget.x - cx, dirZ = landTarget.z - cz;
        // Widen perpendicular to the bridge's direction of travel, offset
        // toward whichever side the line is actually stepping (matching the
        // minor axis's step sign) so the extra row lands on the correct
        // side of every diagonal jog instead of the wrong one.
        let widenX = 0, widenZ = 0;
        if (Math.abs(dirX) >= Math.abs(dirZ)) {
          widenZ = dirZ === 0 ? 1 : Math.sign(dirZ);
        } else {
          widenX = dirX === 0 ? 1 : Math.sign(dirX);
        }
        let bridgeSteps = 0;
        for (const p of line) {
          const key = p.x + ',' + p.z;
          if (satelliteKeys.has(key)) continue; // still inside the small island itself
          if (heightMap[key] !== undefined) break; // reached land - bridge complete
          if (bridgeSteps >= maxBridgeSteps) break; // safety net - never spans further than the intended gap

          layBridgeTile(p.x, p.z);
          const wx = p.x + widenX, wz = p.z + widenZ;
          if (!satelliteKeys.has(wx + ',' + wz)) layBridgeTile(wx, wz);
          bridgeSteps++;
        }
        // Belt-and-suspenders: Bresenham can still step diagonally between
        // consecutive tiles (x and z both changing by 1), which only touch
        // at a corner and leave a diamond-shaped gap a unit can't cross.
        // Fill both corner tiles at every such step so the deck is solid.
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1], b = line[i];
          if (Math.abs(b.x - a.x) === 1 && Math.abs(b.z - a.z) === 1) {
            if (!satelliteKeys.has(a.x + ',' + b.z)) layBridgeTile(a.x, b.z);
            if (!satelliteKeys.has(b.x + ',' + a.z)) layBridgeTile(b.x, a.z);
          }
        }
      }

      updateShadowCoverage(tileHeights);

      coastTiles = tileHeights.filter(t => {
        const neighborKeys = [(t.x+1)+','+t.z, (t.x-1)+','+t.z, t.x+','+(t.z+1), t.x+','+(t.z-1)];
        return neighborKeys.some(k => heightMap[k] === undefined);
      });

      const SPAWN_PADDING = 0.3;
      tileHeights.sort((a, b) => b.y - a.y);

      const clearTiles = tileHeights.filter(tile =>
        colliders.every(c => Math.hypot(tile.x - c.x, tile.z - c.z) >= c.radius + SPAWN_PADDING)
      );
      const inlandClearTiles = clearTiles.filter(tile => !coastTiles.includes(tile));

      // If this island rolled an Orc Fortress, keep player/militia squads
      // from ever starting the game within its firing range - spawning
      // inside (or right at the edge of) ORC_FORTRESS_RANGE would mean
      // getting shot at before the player has even moved. These pools
      // are tried first, well before falling back to the unfiltered ones
      // further down, so a spawn only ever lands closer than the safe
      // distance if the island genuinely has nowhere else to put it.
      const ORC_FORTRESS_SPAWN_SAFE_DISTANCE = 4; // tiles from the Fortress center
      const farFromOrcFortress = tile => !orcFortressTile ||
          Math.hypot(tile.x - orcFortressTile.x, tile.z - orcFortressTile.z) >= ORC_FORTRESS_SPAWN_SAFE_DISTANCE;
      const inlandClearTilesFarFromFortress = inlandClearTiles.filter(farFromOrcFortress);
      const clearTilesFarFromFortress = clearTiles.filter(farFromOrcFortress);
      const tileHeightsFarFromFortress = tileHeights.filter(farFromOrcFortress);

      // BUG FIX: this used to pick ONE pool up-front (inland clear tiles, or
      // clear tiles, or all tiles) and stick with it even if that pool
      // turned out to have fewer distinct tiles than there are squads - on
      // a small/cramped island (e.g. a "Separate Small Islands" satellite),
      // pickSpawnTiles() would then return fewer tiles than requested, and
      // the placement loop below silently reused the last tile for every
      // leftover squad, spawning them stacked exactly on top of each other.
      // Falling through to progressively larger pools here means we only
      // run out of distinct tiles if the WHOLE island has fewer land tiles
      // than squads, which practically never happens.
      // Event: Death - the player is the Attacker, so their squads start on
      // the attacker edge of the island (the defenders hold the far side;
      // see spawnHeavenDefenders). Attacker-side pools are tried first and
      // fall through to the normal pools only if that edge is too cramped.
      eventSideInfo = eventFactionActive === 'death' ? computeEventSideInfo(tileHeights) : null;

      function pickSpawnTiles(count) {
        const normalPools = [
          inlandClearTilesFarFromFortress, clearTilesFarFromFortress, tileHeightsFarFromFortress,
          inlandClearTiles, clearTiles, tileHeights,
        ];
        const pools = eventSideInfo
          ? [
              inlandClearTiles.filter(isEventAttackerSide),
              clearTiles.filter(isEventAttackerSide),
              tileHeights.filter(isEventAttackerSide),
            ].concat(normalPools)
          : normalPools;
        const pool = pools.find(p => p.length >= count) || pools[pools.length - 1];
        if (pool.length === 0) return [];
        const chosen = [pool[0]];
        while (chosen.length < count) {
          let best = null, bestDist = -1;
          for (const tile of pool) {
            if (chosen.includes(tile)) continue;
            const minDist = Math.min(...chosen.map(c => Math.hypot(tile.x - c.x, tile.z - c.z)));
            if (minDist > bestDist) { bestDist = minDist; best = tile; }
          }
          if (!best) break;
          chosen.push(best);
        }
        return chosen;
      }

      let spawnTiles = [];
      if (typeof squads !== 'undefined' && squads.length > 0) {
        spawnTiles = pickSpawnTiles(squads.length);
        // Event: Death - one beach per squad on the attacker side; each
        // squad sails in on its own boat instead of starting on land.
        const attackerLandings = pickAttackerLandings(squads.length);
        squads.forEach((squad, i) => {
          // A squad reused across a restart may still carry last run's boat.
          if (squad.boat && squad.boat.parent === squad.group) squad.group.remove(squad.boat);
          squad.boat = null;
          squad.onBoat = false;
          squad.group.userData.onBoat = false;
          let tile = spawnTiles[i];
          if (!tile) {
            // Should only happen if the island has fewer land tiles than
            // squads (near-impossible in practice) - rather than reusing
            // another squad's exact tile and spawning stacked on top of
            // it, ring this squad out around the last known tile so it's
            // still at a safe, non-overlapping distance.
            const base = spawnTiles[spawnTiles.length - 1] || { x: 0, y: 1, z: 0 };
            const angle = (i / squads.length) * Math.PI * 2;
            tile = { x: base.x + Math.cos(angle) * 0.9, y: base.y, z: base.z + Math.sin(angle) * 0.9 };
          }
          squad.isMoving = false;
          squad.group.userData.isMoving = false;
          squad.currentPath = [];
          squad.currentWaypoint = 0;
          if (squad.attackMarker) squad.attackMarker.visible = false;

          // Place the squad on its assigned, well-spread tile - and on the
          // tile's actual surface height, not left wherever it was before
          // (which could be buried under the newly generated terrain).
          squad.group.position.set(tile.x, tile.y - 0.5, tile.z);

          // Respawn dead units in squad
          respawnSquad(squad);

          const landing = attackerLandings[i];
          if (landing) {
            boardSquadOnBoat(squad, landing);
            spawnTiles[i] = landing.tile;
          }
        });
        targetHighlight.visible = false;
      }

      buildRoadNetwork(buildingTiles.concat(spawnTiles));

      roadTiles.forEach(key => {
        const mesh = propMeshes[key];
        if (mesh) {
          islandGroup.remove(mesh);
          delete propMeshes[key];
          propTileKeys.delete(key);
        }
      });

      renderRoads();
      updateWaveUI();
      updateSquadCountUI();
    }

    // --- 6. WEAPON BUILDERS ---
    function createSword() {
      const sword = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.02), steelMat);
      blade.position.y = 0.25;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.04), goldMat);
      guard.position.y = 0.05;
      const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), woodMat);
      sword.add(blade, guard, hilt);
      return sword;
    }

    // Desert Warriors squad weapon - Scimitar: a curved single-edged
    // blade for the squad's front-line shield pairing (see equipUnit's
    // 'desertWarriors' branch). Built from three short blade segments,
    // each stacked a little further out from the guard and rotated a
    // bit more than the last, which fakes a smooth sweeping curve out
    // of straight box geometry (the same trick as the Katana's subtle
    // curve, just carried across more segments for a proper scimitar
    // arc) and finished with an angled point.
    function createScimitar() {
      const scimitar = new THREE.Group();

      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), goldMat);
      pommel.position.y = -0.13;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 6), leatherMat);
      hilt.position.y = -0.06;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.04), goldMat);
      guard.position.y = 0.01;

      const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.018), steelMat);
      seg1.position.set(0, 0.09, 0.005);
      seg1.rotation.x = 0.05;

      const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.016), steelMat);
      seg2.position.set(0, 0.24, 0.03);
      seg2.rotation.x = 0.22;

      const seg3 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.14, 0.014), steelMat);
      seg3.position.set(0, 0.37, 0.09);
      seg3.rotation.x = 0.42;

      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 4), steelMat);
      tip.rotation.x = Math.PI / 2 + 0.55;
      tip.position.set(0, 0.45, 0.15);

      scimitar.add(pommel, hilt, guard, seg1, seg2, seg3, tip);
      return scimitar;
    }

    // Chakram Dancers squad weapon - a flat bladed throwing ring, built
    // from a thick steel torus (the actual cutting rim) with a thinner
    // gold torus inset just inside it for a decorative banded edge, plus
    // a small leather-wrapped grip bar across the middle so it reads as
    // held rather than floating in the hand. Lies flat in its own local
    // XY plane by default (THREE.TorusGeometry's natural orientation),
    // which equipUnit rotates to face outward like a shield. Also reused
    // undecorated as the spare ring holstered on each hip - see
    // equipUnit's 'chakramDancers' branch.
    function createChakram() {
      const chakram = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 20), steelMat);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.008, 6, 20), goldMat);
      rim.position.z = 0.012;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.02), leatherMat);
      chakram.add(ring, rim, grip);
      return chakram;
    }

    function createPike() {
      const pike = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4), woodMat);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = 0.4;

      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), steelMat);
      tip.rotation.x = Math.PI / 2;
      tip.position.z = 1.15;

      pike.add(shaft, tip);
      return pike;
    }

    // Hell Trident - the Demon's only loadout (see DEMON_WEAPON_TYPES and
    // equipUnit's 'hellTrident' branch). A two-handed polearm like
    // createPike, but topped with three splayed prongs instead of one
    // point, and a dull ember-red glow running through the steel.
    function createHellTrident() {
      const trident = new THREE.Group();
      const embersMat = new THREE.MeshLambertMaterial({ color: 0x3a2018, emissive: 0x7a1a08, emissiveIntensity: 0.5 });

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.4), embersMat);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = 0.4;
      trident.add(shaft);

      const prongMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e, emissive: 0xaa2200, emissiveIntensity: 0.4 });
      const centerProng = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.24, 4), prongMat);
      centerProng.rotation.x = Math.PI / 2;
      centerProng.position.z = 1.22;
      trident.add(centerProng);

      const sideProngGeo = new THREE.ConeGeometry(0.028, 0.19, 4);
      const prongL = new THREE.Mesh(sideProngGeo, prongMat);
      prongL.position.set(-0.09, 0, 1.14);
      prongL.rotation.set(Math.PI / 2, 0, 0.35);
      trident.add(prongL);
      const prongR = new THREE.Mesh(sideProngGeo, prongMat);
      prongR.position.set(0.09, 0, 1.14);
      prongR.rotation.set(Math.PI / 2, 0, -0.35);
      trident.add(prongR);

      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.02), prongMat);
      crossbar.position.z = 1.0;
      trident.add(crossbar);

      return trident;
    }

    // Revenant Mace - the Steel Revenant's only loadout (see the
    // 'steelRevenant' branch in equipUnit).
    // A massive two-handed flanged mace built from the same brutalist
    // language as its armor: a long iron haft topped with an oversized
    // flanged head studded with four heavy angular spikes (one per
    // cardinal direction) rather than a bladed edge, with a slab
    // crossguard and a heavy angular pommel spike.
    function createRevenantBlade() {
      const blade = new THREE.Group();
      const ironMat = new THREE.MeshLambertMaterial({ color: 0x1c1d20 });
      const trimMat = new THREE.MeshLambertMaterial({ color: 0x3a3d44 });
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xcfe9ff });

      const gripMat = new THREE.MeshLambertMaterial({ color: 0x24201c });
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.34), gripMat);
      grip.rotation.x = Math.PI / 2;
      grip.position.z = 0.17;
      blade.add(grip);

      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.06), trimMat);
      guard.position.z = 0.36;
      blade.add(guard);

      const pommel = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), ironMat);
      pommel.rotation.x = -Math.PI / 2;
      pommel.position.z = -0.02;
      blade.add(pommel);

      // Long iron haft running from the crossguard up to the flanged
      // head - thicker than the Desert Bandit's stubby one-handed Mace
      // (createMace) since this is swung two-handed.
      const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.05, 0.75, 6), ironMat);
      haft.rotation.x = Math.PI / 2;
      haft.position.z = 0.775;
      haft.castShadow = true;
      blade.add(haft);

      // A thin glowing collar marking the join between haft and head,
      // echoing the helm's spectral T-visor.
      const glowCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 8), glowMat);
      glowCollar.rotation.x = Math.PI / 2;
      glowCollar.position.z = 1.05;
      blade.add(glowCollar);

      // Large flanged head - an oversized low-poly ball, big enough to
      // read as a boss-tier weapon rather than the Bandit's stubby Mace.
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), ironMat);
      head.position.z = 1.2;
      head.castShadow = true;
      blade.add(head);

      // Four heavy angular spikes ringing the head, one in each
      // cardinal direction and each pointing straight outward, scaled
      // up and sharpened versions of the Desert Bandit Mace's flanges
      // (createMace).
      const spikeGeo = new THREE.ConeGeometry(0.06, 0.32, 4);
      const spikeConfigs = [
        { x: 0.24, y: 0, rot: [0, 0, -Math.PI / 2] },  // +X
        { x: -0.24, y: 0, rot: [0, 0, Math.PI / 2] },  // -X
        { x: 0, y: 0.24, rot: [0, 0, 0] },             // +Y
        { x: 0, y: -0.24, rot: [0, 0, Math.PI] }       // -Y
      ];
      spikeConfigs.forEach(({ x, y, rot }) => {
        const spike = new THREE.Mesh(spikeGeo, ironMat);
        spike.position.set(x, y, 1.2);
        spike.rotation.set(rot[0], rot[1], rot[2]);
        spike.castShadow = true;
        blade.add(spike);
      });

      return blade;
    }


    function updateCombatSystem(delta) {
      // Gather all live units
      const allPlayerUnits = [];
      // isOperatingTower units (a Siege Engineer who's climbed inside a
      // finished Watch Tower - see updateSiegeEngineerSupport) are left
      // out entirely: hidden and parked at the tower, they should never
      // be a valid raider attack target, healing candidate, or show a
      // floating HP bar, same as if they'd left the battlefield. A squad
      // hidden inside a captured Orc Fortress (isGarrisonedAtFortress -
      // see garrisonAllUnitsAtFortress) gets the exact same treatment for
      // the exact same reason.
      squads.forEach(s => s.members.forEach(m => { if (!m.userData.isOperatingTower && !m.userData.isGarrisonedAtFortress) allPlayerUnits.push(m); }));
      militiaSquads.forEach(s => s.members.forEach(m => allPlayerUnits.push(m)));

      const allRaiderUnits = [];
      raiderSquads.forEach(s => s.members.forEach(m => allRaiderUnits.push(m)));

      // 0. Advance any units currently in their lingering death sequence
      updateDyingUnits(delta);

      // Paladin passives (Holy Light + Light Shock)
      updatePaladinAbilities(delta);
      updateLichAbilities(delta);
      updateKitsuneTwinbladeAbilities(delta);

      // Goddess of Life passives (Lightbringer Wave + Cradle of Life)
      updateGoddessOfLifeAbilities(delta);

      // Doctor passives (Field Medic heal + Resurrection revive)
      updateDoctorSupport(delta);

      // Siege Engineer ability (build/operate the Watch Tower)
      updateSiegeEngineerSupport(delta);

      // 1. Process Attack AI & Bad North Archetypes
      const processUnitAttack = (unit, targets) => {
        const uData = unit.userData;
        if (uData.hp <= 0) return;

        uData.attackCooldown -= delta;
        uData.stunTimer -= delta;
        // Generic "actively fighting" flag, set whenever this unit lands an
        // attack (see the bestTarget/attackCooldown block below) and ticking
        // back down otherwise. Currently only consumed by the Paladin
        // Squad's Encourage passive (updatePaladinAbilities), but harmless
        // bookkeeping for every other unit type too.
        if (uData.inCombatTimer > 0) uData.inCombatTimer = Math.max(0, uData.inCombatTimer - delta);
        if (uData.swordDashCooldown > 0) uData.swordDashCooldown = Math.max(0, uData.swordDashCooldown - delta);
        if (uData.deflectAnimTimer > 0) uData.deflectAnimTimer = Math.max(0, uData.deflectAnimTimer - delta);
        if (uData.ghostStepDashAnimTimer > 0) uData.ghostStepDashAnimTimer = Math.max(0, uData.ghostStepDashAnimTimer - delta);
        if (uData.shockAnimTimer > 0) uData.shockAnimTimer = Math.max(0, uData.shockAnimTimer - delta);
        // Paladin passives (Holy Light / Light Shock) - drives the cast
        // gesture in updateUnitAnims; set whenever either ability actually
        // fires a visible effect (see updatePaladinAbilities).
        if (uData.holyLightCastAnimTimer > 0) uData.holyLightCastAnimTimer = Math.max(0, uData.holyLightCastAnimTimer - delta);
        if (uData.lightShockCastAnimTimer > 0) uData.lightShockCastAnimTimer = Math.max(0, uData.lightShockCastAnimTimer - delta);
        // Slasher passive (Assassinate) - drives the blood-flick follow-
        // through pose in updateUnitAnims; set whenever a landed dagger
        // strike lands its guaranteed kill, whether from a normal
        // in-place stab or a Rooftop Ambush finisher (see
        // triggerSlasherKillFlourish).
        if (uData.slasherKillFlourishAnimTimer > 0) uData.slasherKillFlourishAnimTimer = Math.max(0, uData.slasherKillFlourishAnimTimer - delta);
        // Bear Warrior passive (Summon Lightning) - counts down regardless
        // of whether this unit currently has a target in range, so the
        // ability is ready the instant it engages rather than only after
        // its first swing (see the isBearWarrior branch in the melee block
        // below, which checks this before deciding Claw/Bite vs Lightning).
        if (uData.bearLightningCooldown > 0) uData.bearLightningCooldown = Math.max(0, uData.bearLightningCooldown - delta);
        if (uData.attackAnimTimer > 0) {
          uData.attackAnimTimer = Math.max(0, uData.attackAnimTimer - delta);
          if (uData.attackAnimTimer === 0) {
            uData.attackAnimPoseOverride = null;
            // Feral Pounce leaves the body pushed forward/down mid-lunge
            // (see applyAttackPose's isAkumaFeral branch) - snap it back
            // now that the anim is over, since nothing else resets it.
            if (uData.raiderFaction === 'akuma') uData.body.position.z = 0;
            // Steel Grasp - make sure the hand-glow fully clears rather
            // than possibly holding at a tiny leftover opacity from the
            // fade curve in applyAttackPose's 'steelGrasp' branch.
            if (uData.graspGlowMesh) uData.graspGlowMesh.userData.mats.forEach(m => m.opacity = 0);
            // Unbreakable - same fully-clear safety net for the chest
            // glow, plus restore the offhand grip's visibility now that
            // the hand is done pressing against the chest.
            if (uData.unbreakableGlowMesh) uData.unbreakableGlowMesh.userData.mats.forEach(m => m.opacity = 0);
            if (uData.offhandGripMesh) uData.offhandGripMesh.visible = true;
          }
        }

        // Pikeman passive (Fortitude) duration bookkeeping - see applyDamage
        // for the trigger and the defense reduction itself.
        if (uData.fortitudeTimer > 0) uData.fortitudeTimer = Math.max(0, uData.fortitudeTimer - delta);

        // Elite Swordsman passive (Last Stand) duration bookkeeping - see
        // applyDamage for the HP-threshold trigger and the defense
        // reduction itself.
        if (uData.lastStandTimer > 0) uData.lastStandTimer = Math.max(0, uData.lastStandTimer - delta);

        // Ninja passive (Smoke Bomb) - countdown until the cloak wears off
        // and the Ninja reappears. See maybeTriggerNinjaSmokeBomb for the
        // trigger and applyDamage for the untargetable/immune handling.
        if (uData.vanished) {
          uData.vanishTimer -= delta;
          if (uData.vanishTimer <= 0) {
            uData.vanished = false;
            unit.visible = true;
            const reappearPos = new THREE.Vector3();
            unit.getWorldPosition(reappearPos);
            spawnFloatingText(reappearPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'REAPPEARS!', '#bbbbbb');
            spawnSmokeBombEffect(reappearPos.clone().add(new THREE.Vector3(0, 0.4, 0)));
          } else {
            return; // Still cloaked - sits out this frame's attack logic entirely
          }
        }

        // Ninja passive (Concealment) - fade the model toward
        // near-invisible while standing still next to a tree/bush, on
        // top of the untargetable status isNearStealthCover already
        // grants below. Lerped so the fade is smooth rather than a snap.
        if (uData.concealMats) {
          const nPos = new THREE.Vector3();
          unit.getWorldPosition(nPos);
          const concealed = !unit.parent.userData.isMoving && isNearStealthCover(nPos.x, nPos.z);
          uData.concealOpacity = THREE.MathUtils.lerp(uData.concealOpacity, concealed ? NINJA_CONCEALED_OPACITY : 1, Math.min(1, delta * 6));
          uData.concealMats.forEach(m => { m.opacity = uData.concealOpacity; });
        }

        // Cavalry passive (Bleeding) duration bookkeeping - ticks down and
        // deals periodic damage while active; see applyBleed for the trigger.
        if (uData.bleedTicksRemaining > 0 && uData.hp > 0) {
          uData.bleedTickTimer -= delta;
          if (uData.bleedTickTimer <= 0) {
            uData.bleedTickTimer = BLEED_TICK_INTERVAL;
            uData.bleedTicksRemaining--;
            applyDamage(unit, BLEED_TICK_DAMAGE, 'bleedTick', null, null);
            if (uData.hp <= 0) return;
          }
        }

        // Dragon Ronin passive (Dragon's Breath) duration bookkeeping -
        // ticks down and deals periodic fire damage while active; see
        // applyBurn for the trigger.
        if (uData.burnTicksRemaining > 0 && uData.hp > 0) {
          uData.burnTickTimer -= delta;
          if (uData.burnTickTimer <= 0) {
            uData.burnTickTimer = BURN_TICK_INTERVAL;
            uData.burnTicksRemaining--;
            applyDamage(unit, BURN_TICK_DAMAGE, 'burnTick', null, null);
            if (uData.hp <= 0) return;
          }
        }

        // War Elephant passive (Venom Arrows) duration bookkeeping - ticks
        // down and deals periodic poison damage while active; see
        // applyPoison for the trigger.
        if (uData.poisonTicksRemaining > 0 && uData.hp > 0) {
          uData.poisonTickTimer -= delta;
          if (uData.poisonTickTimer <= 0) {
            uData.poisonTickTimer = POISON_TICK_INTERVAL;
            uData.poisonTicksRemaining--;
            applyDamage(unit, POISON_TICK_DAMAGE, 'poisonTick', null, null);
            if (uData.hp <= 0) return;
          }
        }

        // Kitsune Twinblade passive (Fox Spirit Renewal) duration
        // bookkeeping - ticks down and restores a slice of max HP each
        // tick while active, same shape as the burn/poison DOTs just
        // above but healing instead of damaging; see applyRegen for the
        // trigger.
        if (uData.regenTicksRemaining > 0 && uData.hp > 0) {
          uData.regenTickTimer -= delta;
          if (uData.regenTickTimer <= 0) {
            uData.regenTickTimer = uData.regenTickInterval || 1;
            uData.regenTicksRemaining--;
            healUnit(unit, uData.regenTickAmount);
          }
        }

        // Apply knockback momentum physics. Friction is expressed as "0.85
        // retained per 1/60s tick" and rescaled by delta so it decays at
        // the same real-world rate regardless of the device's actual frame
        // rate - previously multiplyScalar(0.85) ran once per rendered
        // frame with no delta factored in at all, so a device dropping
        // frames (common on mobile, especially mid-battle with a lot on
        // screen) let a unit keep sliding from a hit for much longer in
        // real time before it settled back within range of anything to
        // fight.
        if (uData.knockbackVel.lengthSq() > 0.001) {
          // Height tier the unit is standing on BEFORE this step's slide,
          // so a step that crosses onto a different tier (stairs, a
          // raised building foundation) can be told apart from ordinary
          // same-tier drift below.
          const kbPrevWorldPos = new THREE.Vector3();
          unit.getWorldPosition(kbPrevWorldPos);
          const kbPrevSurfY = getSurfaceY(kbPrevWorldPos.x, kbPrevWorldPos.z);
          const prevX = unit.position.x, prevZ = unit.position.z;

          unit.position.addScaledVector(uData.knockbackVel, delta);
          uData.knockbackVel.multiplyScalar(Math.pow(0.85, delta * 60));

          // Safety net: knockback is meant to be purely horizontal (see the
          // flattened direction vectors where knockbackVel is built), but
          // clamp the unit back onto the terrain surface here too - both
          // sinking into the ground AND floating/hovering above it. A
          // knockback can easily slide a unit sideways off a raised tile
          // (a boulder/parkour perch, a cliff edge) onto lower ground
          // right next to it; only correcting the sink-below-ground case
          // left it still carrying its old, higher y all the way across
          // that lower tile, visibly hovering above the surface instead of
          // settling onto it.
          const kbWorldPos = new THREE.Vector3();
          unit.getWorldPosition(kbWorldPos);
          const kbSurfY = getSurfaceY(kbWorldPos.x, kbWorldPos.z);
          if (kbPrevSurfY !== null && kbSurfY !== null && Math.abs(kbSurfY - kbPrevSurfY) > 0.05) {
            // The slide just crossed onto a different terrain tier this
            // frame (e.g. church/castle steps, a raised foundation).
            // Snapping y to match that tile - which the block below does
            // for ordinary same-tier drift - would hoist the unit up (or
            // drop it down) onto ground it never should have reached via
            // a sideways shove, and once the knockback decays to a stop
            // there's nothing left to bring it back down: it's stranded,
            // visibly floating above the rest of the fight. Instead, stop
            // the slide right at the tier boundary and kill the
            // remaining knockback outright.
            unit.position.x = prevX;
            unit.position.z = prevZ;
            uData.knockbackVel.set(0, 0, 0);
          } else if (kbSurfY !== null && Math.abs(kbWorldPos.y - kbSurfY) > 0.001) {
            unit.position.y += (kbSurfY - kbWorldPos.y);
          }
        }

        // stunTimer still counts down (see the decrement above) and is
        // still available for a future hurt-flinch pose, but it no
        // longer gates the attack loop itself - a unit keeps searching
        // for targets and swinging even while it's mid-knockback/still
        // sliding from a hit, instead of being frozen in place until
        // the stun window lapses.

        // Siege Engineer passive - Barricade: counts down regardless of
        // the early-return just below, same reasoning as stunTimer above -
        // see the immunity check at the top of applyDamage and the
        // trigger in its hit-reaction block. Once the timer actually
        // lapses, it steps back out from behind the barricade - visible
        // and targetable again.
        if (uData.unitType === 'siege' && uData.barricadeShieldTimer > 0) {
          uData.barricadeShieldTimer -= delta;
          if (uData.barricadeShieldTimer <= 0) {
            uData.barricadeShieldTimer = 0;
            unit.visible = true;
          }
        }

        // Doctor passive - never attacks, so it sits out targeting/attack
        // entirely (timers and knockback physics above still run
        // normally). Its own healing/reviving is driven separately, once
        // per frame for the whole roster, by updateDoctorSupport below.
        // Siege Engineer follows the same shape - never attacks, and its
        // own build ability is driven separately by
        // updateSiegeEngineerSupport.
        if (uData.unitType === 'doctor' || uData.unitType === 'siege') return;

        const attackerWorldPos = new THREE.Vector3();
        unit.getWorldPosition(attackerWorldPos);

        // BAD NORTH PIKE BRACE MECHANIC: Stationary Pikes create a front death-wall
        const isPikeBraced = uData.unitType === 'pikes' && !unit.parent.userData.isMoving;
        const isRaiderSpear = uData.unitType === 'raiders' && (uData.raiderWeapon === 'spear' || uData.raiderWeapon === 'spearShield' || uData.raiderWeapon === 'marauderSpear');
        const isRaiderBow = uData.unitType === 'raiders' && (uData.raiderWeapon === 'bow' || uData.raiderWeapon === 'wokouBow' || uData.raiderWeapon === 'banditBow');
        // Shadow Island Acolyte - casts a bolt from range same as a Bow
        // raider, just from its bare hand instead of a bow (see
        // spawnProjectile's 'darkBolt' type below).
        const isRaiderAcolyte = uData.unitType === 'raiders' && uData.raiderWeapon === 'acolyteBolt';
        // Gargoyle (the awakened form of a Dungeon-variant Gargoyle
        // Statue - see maybeAwakenGargoyles) - flies and casts a bolt
        // from range exactly like the Acolyte above, just a hurled stone
        // shard instead of dark magic (see spawnProjectile's
        // 'gargoyleBolt' type below).
        const isRaiderGargoyle = uData.unitType === 'raiders' && uData.raiderWeapon === 'gargoyleBolt';
        const isCavalrySword = uData.unitType === 'cavalry' && uData.cavalryWeapon === 'sword';
        const isCavalrySpear = uData.unitType === 'cavalry' && uData.cavalryWeapon === 'spear';
        const isCavalryBow = uData.unitType === 'cavalry' && uData.cavalryWeapon === 'bow';
        // War Elephant squad - the two Desert Warrior archers (memberIndex
        // 1-2, see uData.elephantRole set in createSquad/respawnSquad).
        // Given the same reach/projectile/cooldown treatment as a bow-armed
        // unit everywhere below, and its arrow is tagged 'archers' at the
        // spawnProjectile call site so it also inherits Piercing Shot -
        // Venom Arrows is applied separately via the poisonOnHit flag.
        const isElephantArcher = uData.unitType === 'warElephant' && uData.elephantRole === 'archer';
        // Militia gets the same reach as a real spear/bow user for its
        // Spear/Bow loadouts (see equipUnit's 'militia' branch), but
        // deliberately never joins isPikeBraced above - no ability means no
        // brace counter-damage bonus either, just the plain longer reach.
        const isMilitiaSpear = uData.unitType === 'militia' && uData.militiaWeapon === 'spear';
        const isMilitiaBow = uData.unitType === 'militia' && uData.militiaWeapon === 'bow';
        // Akuma Feral - a Far East raider variant that fights bare-clawed
        // (see equipUnit's 'claws' weapon and RAIDER_TYPE_DEFS). Its whole
        // attack is a leap (Feral Pounce, handled in the melee branch
        // below) rather than a normal swing, so it gets a longer reach
        // than a regular melee raider to represent closing the gap in a
        // single bound.
        const isAkumaFeral = uData.unitType === 'raiders' && uData.raiderFaction === 'akuma';
        // Bear Warrior - the Northernlands' lone raider (see BEAR_* consts
        // above). Fights at plain melee reach with a Claw/Bite swing (see
        // the isBearWarrior branch in the melee block below), but
        // periodically trades that swing for a Summon Lightning strike
        // instead (see summonBearLightningStrike).
        const isBearWarrior = uData.unitType === 'raiders' && uData.raiderFaction === 'bear';
        // Steel Revenant passive (Death Slam / Steel Grasp) - true for the
        // player's own singleton squad member (unitType 'steelRevenant').
        // createRaiderSquad no longer builds an enemy Steel Revenant, but
        // the uData.isSteelRevenant fallback is kept here in case some
        // other unit ever sets that flag directly.
        const isSteelRevenant = uData.unitType === 'steelRevenant' || uData.isSteelRevenant;
        // Berserker passive (Rage) - live off current HP rather than a
        // one-shot proc: true for as long as HP sits at or below
        // BERSERKER_RAGE_HP_THRESHOLD, false again the moment it's
        // healed back above it. Drives the faster attackCooldown set
        // where this unit's swing lands below, and the one-time "RAGE!"
        // announcement right after.
        const isBerserkerRaging = (uData.unitType === 'berserker' || uData.raiderFaction === 'wolfWarrior') && uData.hp > 0 && (uData.hp / uData.maxHp) <= BERSERKER_RAGE_HP_THRESHOLD;
        if (isBerserkerRaging && !uData.berserkerRaging) {
          spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'RAGE!', '#ff3300');
        }
        uData.berserkerRaging = isBerserkerRaging;

        let bestTarget = null;
        let closestDist = Infinity;
        // Ninja passive (Camouflage) - a fallback pool of hidden Ninjas a
        // raider can still fall back on if literally nothing else is in
        // range, so hiding doesn't make a lone Ninja unkillable.
        let hiddenFallback = null;
        let hiddenFallbackDist = Infinity;
        // Plain melee reach used to fall back to 0.8/0.9, which is LESS than
        // SQUAD_COLLISION_RADIUS (0.85) - the closest two opposing squads'
        // centers are ever allowed to get. A unit sitting at or near its own
        // squad's center (any singleton squad like Dragon Ronin, or a
        // formation's back-row member) could then end up standing exactly
        // at the enforced stopping distance with nothing in its 0.8/0.9
        // range - it would just stand there next to the fight forever,
        // never landing a hit. MELEE_ENGAGE_RANGE is derived from
        // SQUAD_COLLISION_RADIUS with a safety margin so any melee unit can
        // always reach once its squad has closed to that minimum gap,
        // regardless of exactly where within the formation it stands.
        // All melee attack reach is a flat 1 tile (1 world unit - tiles
        // are laid out on integer grid coordinates, see the terrain
        // generation loops above) rather than the old per-weapon spread
        // (pike/spear/sword/bare melee each had a slightly different
        // reach). MELEE_ENGAGE_RANGE is kept only as the historical name
        // for that flat melee reach, still used elsewhere as a safety
        // margin reference against SQUAD_COLLISION_RADIUS.
        const MELEE_ENGAGE_RANGE = 1.0;
        const attackRange = (uData.unitType === 'archers' || uData.unitType === 'crossbow' || uData.unitType === 'mages' || uData.unitType === 'lich' || isCavalryBow || isRaiderBow || isMilitiaBow || isRaiderAcolyte || isRaiderGargoyle || isElephantArcher)
          ? 5.5
          : uData.unitType === 'ninja'
            ? 3.5
          : isAkumaFeral
            ? 1.6
          : uData.unitType === 'valkyrie'
            ? 2.2
          : (uData.unitType === 'goddessOfDeath' || uData.unitType === 'goddessOfLife')
            ? 1.5
          : MELEE_ENGAGE_RANGE;

        // Flying units (currently just the Valkyrie) are out of a
        // ground-bound melee unit's reach - only something that attacks at
        // range (bow/crossbow/mage/thrown-weapon types, same list the
        // projectile-attack branch below uses) or another flier can
        // actually connect with them.
        const attackerReachesFlying = uData.unitType === 'archers' || uData.unitType === 'crossbow' || uData.unitType === 'mages' || uData.unitType === 'lich'
          || isCavalryBow || isRaiderBow || isMilitiaBow || isRaiderAcolyte || isRaiderGargoyle || uData.unitType === 'ninja'
          || uData.unitType === 'valkyrie' || uData.raiderFaction === 'wolfWarrior' || isElephantArcher;

        targets.forEach(t => {
          if (t.userData.hp <= 0) return;
          // Ground melee can't reach a flying target - see attackerReachesFlying above.
          if (t.userData.unitType === 'valkyrie' && !attackerReachesFlying) return;
          // Ninja passive (Smoke Bomb) - a vanished Ninja is completely
          // gone, not even a fallback target like a merely-camouflaged
          // one further down (see isHiddenNinja).
          if (t.userData.unitType === 'ninja' && t.userData.vanished) return;
          const targetWorldPos = new THREE.Vector3();
          t.getWorldPosition(targetWorldPos);
          // Horizontal distance only - a mounted rider sits noticeably
          // higher off the ground than a foot unit (the horse), and with
          // melee range already tight, counting that height difference as
          // "distance" was eating into a ground unit's reach enough that
          // riders were effectively unkillable in melee. Terrain elevation
          // differences shouldn't gate a sword swing either.
          const d = Math.hypot(targetWorldPos.x - attackerWorldPos.x, targetWorldPos.z - attackerWorldPos.z);

          const targetOnBoat = t.parent && t.parent.userData && t.parent.userData.onBoat;
          // Wolf Warrior passive (Axe Throw) - a flying target is only
          // reachable at WOLF_WARRIOR_AXE_THROW_RANGE (a thrown weapon),
          // not the flat 1-tile melee range every other target of theirs
          // uses - see attackerReachesFlying above and the throw branch
          // in processUnitAttack below.
          const effectiveRange = targetOnBoat ? Math.min(attackRange, BOAT_HIT_RANGE)
            : (uData.raiderFaction === 'wolfWarrior' && t.userData.unitType === 'valkyrie') ? WOLF_WARRIOR_AXE_THROW_RANGE
            : attackRange;

          // Ninja passive (Camouflage) - a stationary Ninja standing on or
          // next to a tree/bush is invisible to raiders as long as another
          // target exists; it only lands in the fallback pool instead.
          const isHiddenNinja = uData.unitType === 'raiders' && t.userData.unitType === 'ninja'
            && t.parent && !t.parent.userData.isMoving
            && isNearStealthCover(targetWorldPos.x, targetWorldPos.z);

          if (d <= effectiveRange && d < (isHiddenNinja ? hiddenFallbackDist : closestDist)) {
            if (isHiddenNinja) {
              hiddenFallbackDist = d;
              hiddenFallback = t;
            } else {
              closestDist = d;
              bestTarget = t;
            }
          }
        });

        if (!bestTarget && hiddenFallback) bestTarget = hiddenFallback;

        // Knockback recovery: a unit that's been shoved out of its
        // formation slot (a big Cavalry Charge, or one too many small
        // per-hit knockbacks piling up over a long fight) previously had
        // nothing pulling it back - if the shove happened to leave it just
        // outside everyone's attack range, it would stand there idle
        // forever, permanently out of the fight, while the rest of its
        // squad kept going. Once its own knockback has fully settled and
        // it genuinely has nothing in range to swing at right now, walk it
        // back toward its original assigned slot so it can rejoin.
        if (!bestTarget && uData.formationOffset && uData.knockbackVel.lengthSq() <= 0.001
            && (uData.formationOffset.x !== unit.position.x || uData.formationOffset.z !== unit.position.z)) {
          const homeDx = uData.formationOffset.x - unit.position.x;
          const homeDz = uData.formationOffset.z - unit.position.z;
          const homeDist = Math.hypot(homeDx, homeDz);
          const homeStep = KNOCKBACK_RECOVERY_SPEED * delta;
          if (homeDist <= homeStep || homeDist < 0.02) {
            unit.position.x = uData.formationOffset.x;
            unit.position.z = uData.formationOffset.z;
          } else {
            unit.position.x += (homeDx / homeDist) * homeStep;
            unit.position.z += (homeDz / homeDist) * homeStep;
            unit.rotation.y = Math.atan2(homeDx, homeDz);
          }
          // unit.position is LOCAL to squad.group (which already sits at
          // the correct terrain height - see resyncStationarySquadGroundHeight),
          // not a world-space coordinate. Passing it straight into
          // getSurfaceY() looked up whatever tile those small local offsets
          // happened to round to (usually the tile under the map's origin)
          // instead of the tile this squad is actually standing on, so a
          // unit recovering from knockback would snap its local y to that
          // unrelated tile's height and end up visibly hovering above (or
          // sunk below) the rest of its own squad. It only needs to settle
          // back to its formation slot's own resting height.
          unit.position.y = uData.formationOffset.y;
        }

        if (bestTarget && uData.attackCooldown <= 0) {
          uData.inCombatTimer = PALADIN_IN_COMBAT_WINDOW;
          const targetWorldPos = new THREE.Vector3();
          bestTarget.getWorldPosition(targetWorldPos);

          // Marching player units keep facing the squad's travel direction
          // even while attacking, instead of twisting to face whatever
          // target is off to the left or right - only a stopped squad's
          // units turn to aim precisely at their target.
          const marchingPlayerUnit = uData.unitType !== 'raiders' && unit.parent.userData.isMoving;

          if (marchingPlayerUnit) {
            unit.rotation.y = 0;
          } else {
            // Face enemy target - rotate only this unit, not the whole squad
            // formation, so attacking while the squad is on the move doesn't
            // spin the group backwards mid-walk.
            const dx = targetWorldPos.x - attackerWorldPos.x;
            const dz = targetWorldPos.z - attackerWorldPos.z;
            if (dx * dx + dz * dz > 0.001) {
              unit.rotation.y = Math.atan2(dx, dz) - unit.parent.rotation.y;
            }
          }

          // Raider passive (Javelin Throw) - the first time a Spear raider
          // gets an attack opportunity, flip a coin ONCE and remember the
          // result forever after (spearThrowResolved). Heads: hurl the
          // spear as a one-shot ranged javelin, then permanently re-arm
          // with an Axe or Sword for the rest of the fight. Tails: no
          // throw ever happens - it just fights on with the spear in
          // melee like a normal Spear raider.
          if (isRaiderSpear && !uData.spearThrowResolved) {
            uData.spearThrowResolved = true;
            if (Math.random() < RAIDER_SPEAR_THROW_CHANCE) {
              spawnProjectile(
                attackerWorldPos.clone().add(new THREE.Vector3(0, 0.5, 0)),
                bestTarget,
                'spear',
                uData.dmgMultiplier || 1
              );
              const newWeapon = Math.random() < 0.5 ? 'axe' : 'sword';
              equipUnit(unit, 'raiders', newWeapon);
              uData.attackAnimPoseOverride = 'spearThrow';
              uData.attackAnimDuration = 0.4;
              uData.attackAnimTimer = uData.attackAnimDuration;
              uData.attackCooldown = 0.9;
              return;
            }
          }

          // Wokou passive (Bomb Throw) - the first time ANY Wokou raider
          // (Katana, Sickle, or Bow alike) gets an attack opportunity, flip
          // a coin ONCE and remember the result forever after
          // (bombThrowResolved). Heads: lob a single bomb at whichever one
          // target it's about to engage, then carry on fighting with its
          // normal weapon for the rest of the battle. Tails: no bomb ever
          // gets thrown - it just opens with its normal weapon like any
          // other raider.
          if (uData.raiderFaction === 'wokou' && !uData.bombThrowResolved) {
            uData.bombThrowResolved = true;
            if (Math.random() < WOKOU_BOMB_THROW_CHANCE) {
              spawnProjectile(
                attackerWorldPos.clone().add(new THREE.Vector3(0, 0.5, 0)),
                bestTarget,
                'bomb',
                uData.dmgMultiplier || 1,
                uData.unitType
              );
              spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'BOMB!', '#ff6633');
              uData.attackAnimPoseOverride = 'bombThrow';
              uData.attackAnimDuration = 0.5;
              uData.attackAnimTimer = uData.attackAnimDuration;
              uData.attackCooldown = 1.2;
              return;
            }
          }

          // Wolf Warrior passive (Axe Throw) - its Double Axe has no reach
          // against a flying target (currently just the Valkyrie), so
          // rather than swinging in melee it hurls the axe at it instead,
          // every time it's what's being engaged (unlike Javelin/Bomb
          // Throw above, this isn't a one-time coin flip - it happens on
          // every attack against a flying target, and it still fights a
          // ground target with the normal melee swing below). Same base
          // damage and Rage-scaled cooldown as its melee swing.
          if (uData.raiderFaction === 'wolfWarrior' && bestTarget.userData.unitType === 'valkyrie') {
            spawnProjectile(
              attackerWorldPos.clone().add(new THREE.Vector3(0, 0.5, 0)),
              bestTarget,
              'throwingAxe',
              uData.dmgMultiplier || 1,
              uData.unitType
            );
            uData.attackAnimPoseOverride = 'axeThrow';
            uData.attackAnimDuration = 0.35;
            uData.attackAnimTimer = uData.attackAnimDuration;
            uData.attackCooldown = BERSERKER_BASE_ATTACK_COOLDOWN * (isBerserkerRaging ? BERSERKER_RAGE_COOLDOWN_MULT : 1);
            return;
          }

          // Execute Bad North Combat Actions
          if (uData.unitType === 'archers' || uData.unitType === 'crossbow' || uData.unitType === 'mages' || uData.unitType === 'lich' || isCavalryBow || isRaiderBow || isMilitiaBow || isRaiderAcolyte || isRaiderGargoyle || uData.unitType === 'ninja' || isElephantArcher) {
            // Ninja passive - Shadow Tactics: every attack is a thrown
            // Shuriken. (Smoke Bomb is now a separate low-HP escape
            // passive - see maybeTriggerNinjaSmokeBomb - rather than a
            // per-attack coin flip.)
            spawnProjectile(
              attackerWorldPos.clone().add(new THREE.Vector3(0, 0.5, 0)),
              bestTarget,
              uData.unitType === 'ninja' ? 'shuriken' : (uData.unitType === 'crossbow' ? 'bolt' : ((uData.unitType === 'archers' || isCavalryBow || isRaiderBow || isMilitiaBow || isElephantArcher) ? 'arrow' : (isRaiderAcolyte ? 'darkBolt' : (isRaiderGargoyle ? 'gargoyleBolt' : (uData.unitType === 'lich' ? 'frostbolt' : 'magic'))))),
              uData.dmgMultiplier || 1,
              // War Elephant passive (Venom Arrows) - a Desert Warrior's
              // arrow is tagged as a plain Archer's shot (so it also gets
              // Piercing Shot) rather than its own 'warElephant' shooter
              // type, since Poison is layered on separately via the
              // poisonOnHit flag below instead of a new damage-type tag.
              isElephantArcher ? 'archers' : uData.unitType,
              isElephantArcher
            );

            // Mage passive - Magic Missile: small chance to follow up the
            // cast with a rapid extra barrage at the same target.
            if (uData.unitType === 'mages' && Math.random() < MAGIC_MISSILE_CHANCE) {
              queueMagicMissileBarrage(unit, bestTarget, uData.dmgMultiplier || 1);
            }

            // Cavalry passive - Volley Fire: a Bow rider always follows up
            // with extra arrows at the same target, every single shot.
            if (isCavalryBow) {
              queueCavalryVolley(unit, bestTarget, uData.dmgMultiplier || 1);
            }

            uData.attackCooldown = (uData.unitType === 'archers' || isElephantArcher) ? 1.8 : (uData.unitType === 'crossbow' ? 3.4 : ((isCavalryBow || isRaiderBow || isMilitiaBow) ? 2.2 : (uData.unitType === 'ninja' ? 1.6 : (uData.unitType === 'lich' ? 3.0 : 2.5))));
            uData.attackAnimDuration = (uData.unitType === 'archers' || isElephantArcher) ? 0.45 : (uData.unitType === 'crossbow' ? 0.6 : ((isCavalryBow || isRaiderBow || isMilitiaBow) ? 0.45 : (uData.unitType === 'ninja' ? 0.35 : (uData.unitType === 'lich' ? 0.5 : 0.55))));
            uData.attackAnimTimer = uData.attackAnimDuration;
          } else {
            // Melee Slash / Pike Thrust
            uData.attackAnimDuration = (uData.unitType === 'pikes' || isRaiderSpear || isCavalrySpear || isMilitiaSpear) ? 0.4 : (isAkumaFeral ? 0.55 : ((uData.unitType === 'berserker' || uData.raiderFaction === 'wolfWarrior') ? 0.3 * (isBerserkerRaging ? 0.6 : 1) : (uData.unitType === 'valkyrie' ? 0.5 : (uData.unitType === 'chakramDancers' ? 0.45 : ((uData.unitType === 'goddessOfDeath' || uData.unitType === 'goddessOfLife') ? 0.55 : (uData.unitType === 'ghoul' ? 0.22 : 0.3))))));
            uData.attackAnimTimer = uData.attackAnimDuration;
            let dmg = isAkumaFeral ? 26 : (isBearWarrior ? BEAR_CLAW_DMG : ((uData.unitType === 'berserker' || uData.raiderFaction === 'wolfWarrior') ? BERSERKER_BASE_DMG : (uData.unitType === 'valkyrie' ? VALKYRIE_BASE_DMG : (uData.unitType === 'ghoul' ? GHOUL_BASE_DMG : (uData.unitType === 'kitsuneTwinblade' ? KITSUNE_BASE_DMG : 22)))));

            // Bad North Pike counter: High damage if enemy charges into braced pikes
            if (isPikeBraced) {
              dmg = 45;
              spawnFloatingText(targetWorldPos, 'BRACED!', '#ffcc00');
            }

            // Squad Upgrade bonus (player squads only - raiders have no dmgMultiplier)
            dmg *= (uData.dmgMultiplier || 1);

            // Cavalry passive - Charge: a Spear rider has a 10% chance per
            // swing to charge instead of a normal thrust (see
            // triggerCavalryCharge for the knockback/instant-kill outcome).
            if (isCavalrySpear && Math.random() < CAVALRY_CHARGE_CHANCE) {
              triggerCavalryCharge(unit, bestTarget, attackerWorldPos, dmg);
            } else if (uData.unitType === 'warElephant' && uData.elephantRole === 'elephant' && Math.random() < WAR_ELEPHANT_STOMP_CHANCE) {
              triggerWarElephantStomp(unit, bestTarget, attackerWorldPos, dmg);
            } else if (isSteelRevenant && Math.random() < STEEL_REVENANT_GRASP_CHANCE) {
              // Steel Grasp - trade the normal single-target swing for a
              // rectangular claw-zone pull (see
              // triggerSteelRevenantSteelGrasp). Rolled ahead of Death
              // Slam below so the two can't both fire off the same swing.
              // If the roll fires but nothing actually ended up inside
              // the zone, fall back to a normal hit on bestTarget rather
              // than wasting the swing entirely.
              const grasped = triggerSteelRevenantSteelGrasp(unit, targets, attackerWorldPos, dmg);
              if (!grasped) applyDamage(bestTarget, dmg, uData.unitType, attackerWorldPos, unit);
            } else if (isSteelRevenant && Math.random() < STEEL_REVENANT_SLAM_CHANCE) {
              // Death Slam - trade the normal single-target swing for a
              // heavy rectangular slam (see triggerSteelRevenantDeathSlam).
              // If the roll fires but nothing actually ended up inside the
              // rectangle, fall back to a normal hit on bestTarget rather
              // than wasting the swing entirely.
              const slammed = triggerSteelRevenantDeathSlam(unit, targets, attackerWorldPos, dmg);
              if (!slammed) applyDamage(bestTarget, dmg, uData.unitType, attackerWorldPos, unit);
            } else if (uData.unitType === 'dragonRonin' && uData.swordDashCooldown <= 0 && Math.random() < DRAGON_SWORD_DASH_CHANCE) {
              triggerDragonSwordDash(unit, bestTarget, attackerWorldPos);
            } else if (isAkumaFeral) {
              // Feral Pounce - every single attack is a leap, not a swing.
              // Tagged as its own attackerType ('akumaLeap') rather than
              // 'raiders' so applyDamage's shield-block check treats it
              // like Piercing Shot: the pounce muscles straight through a
              // raised shield instead of being blocked like a normal
              // raider hit.
              spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'POUNCE!', '#8b2fc9');
              applyDamage(bestTarget, dmg, 'akumaLeap', attackerWorldPos, unit);
            } else if (isBearWarrior) {
              // Bear Warrior passives (Claws, Bite, Summon Lightning) -
              // once its lightning cooldown is ready, this swing is
              // traded for a lightning strike on the target's position
              // (AoE, bypasses shields) instead of a single-target hit;
              // otherwise it's a normal melee swing that rolls between a
              // Claw and a heavier Bite every time (see BEAR_BITE_CHANCE).
              if (uData.bearLightningCooldown <= 0) {
                summonBearLightningStrike(unit, targetWorldPos, attackerWorldPos);
                uData.bearLightningCooldown = BEAR_LIGHTNING_COOLDOWN_MIN + Math.random() * BEAR_LIGHTNING_COOLDOWN_RANGE;
              } else {
                let bearDmg = dmg;
                if (Math.random() < BEAR_BITE_CHANCE) {
                  bearDmg = BEAR_BITE_DMG;
                  spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'BITE!', '#c92f2f');
                }
                applyDamage(bestTarget, bearDmg, uData.unitType, attackerWorldPos, unit);
              }
            } else if (uData.unitType === 'goddessOfDeath') {
              // Goddess passives - Death's Decree / Reaper's Sweep / Soul Harvest
              goddessStrike(unit, targets, bestTarget, attackerWorldPos);
            } else if (uData.unitType === 'goddessOfLife') {
              // Goddess of Life passive - Gentle Touch (Lightbringer Wave,
              // Cradle of Life and Second Dawn run separately - see
              // updateGoddessOfLifeAbilities/goddessOfLifeRebirth)
              goddessOfLifeStrike(unit, targets, bestTarget, attackerWorldPos);
            } else if (uData.unitType === 'slasher') {
              // Slasher passive - Rooftop Ambush: perched up on a
              // rooftop/boulder, a landed strike isn't a calm in-place
              // swing - it flash-steps straight down onto the target,
              // startling it, with the actual killing blow following a
              // beat later (see triggerSlasherAmbush). Only attempted
              // while elevated; falls through to the normal in-place
              // Assassinate if it's not on a parkour tile, or if the
              // teleport itself finds nowhere clear to land.
              const ambushed = isOnParkourTile(attackerWorldPos.x, attackerWorldPos.z) &&
                triggerSlasherAmbush(unit, bestTarget, attackerWorldPos);
              if (!ambushed) {
                // Slasher passive - Assassinate: every landed dagger
                // strike is a guaranteed kill outright. Tagged
                // 'cavalryCharge' - the same lethal-bypass attackerType
                // Cavalry Charge and Dragon Sword Dash's finisher already
                // use - so applyDamage skips shields/Fortitude entirely
                // rather than needing its own bypass branch.
                spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'ASSASSINATE!', '#ff2222');
                triggerSlasherKillFlourish(unit, targetWorldPos);
                applyDamage(bestTarget, 9999, 'cavalryCharge', attackerWorldPos, unit);
              }
            } else if (uData.unitType === 'valkyrie') {
              // Sky Strike - a normal dive deals plain melee damage, but
              // landing on any ranged unit (see isRangedUnitType) is a
              // guaranteed kill instead, representing the Valkyrie
              // plunging down out of reach of its bow/staff before it can
              // ever loose another shot.
              if (isRangedUnitType(bestTarget.userData)) {
                spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'SKY STRIKE!', '#ffe066');
                applyDamage(bestTarget, 9999, 'cavalryCharge', attackerWorldPos, unit);
              } else {
                applyDamage(bestTarget, dmg, uData.unitType, attackerWorldPos, unit);
              }
            } else if (uData.unitType === 'kitsuneTwinblade' && uData.kitsuneRole === 'blade') {
              // Ember Fang passive - Quickdraw: a chance per swing to
              // land a fast quick-draw cut for bonus damage instead of
              // a normal strike.
              if (Math.random() < KITSUNE_QUICKDRAW_CHANCE) {
                spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'QUICKDRAW!', '#ff6a3d');
                const quickdrawTargetPos = new THREE.Vector3();
                bestTarget.getWorldPosition(quickdrawTargetPos);
                quickdrawTargetPos.y += 0.8;
                const quickdrawDir = new THREE.Vector3().subVectors(quickdrawTargetPos, attackerWorldPos);
                spawnSlashArc(quickdrawTargetPos, { color: 0xff6a3d, coreColor: 0xffe066, radius: 0.75, arcSpan: Math.PI * 0.65, duration: 0.2, facingDir: quickdrawDir });
                applyDamage(bestTarget, dmg * KITSUNE_QUICKDRAW_DMG_MULT, uData.unitType, attackerWorldPos, unit);
                triggerKitsuneTwinStrike(unit, bestTarget, dmg);
              } else {
                applyDamage(bestTarget, dmg, uData.unitType, attackerWorldPos, unit);
              }
              // Ember Fang's katana itself carries a lick of fox-fire, so
              // every landed swing - Quickdraw included - sets its target
              // Burning (see applyBurn/BURN_TICK_* for the DOT this opens
              // up), independent of and on top of the separate Flame
              // Crescent proc just below.
              if (bestTarget.userData.hp > 0) applyBurn(bestTarget);
              // Ember Fang passive - Flame Crescent: a separate, independent
              // chance per swing to also loose a diagonal fox-fire slash at
              // the same target, on top of whatever the melee hit above
              // just resolved to.
              if (bestTarget.userData.hp > 0 && Math.random() < KITSUNE_FLAME_CRESCENT_CHANCE) {
                triggerKitsuneFlameCrescent(unit, bestTarget, attackerWorldPos);
              }
            } else if (uData.unitType === 'kitsuneTwinblade' && uData.kitsuneRole === 'spear') {
              // Frost Warden passive - Guard the Flank: a normal hit,
              // plus a chance to shove the target back afterward,
              // covering her partner's flank.
              applyDamage(bestTarget, dmg, uData.unitType, attackerWorldPos, unit);
              if (Math.random() < KITSUNE_GUARD_KNOCKBACK_CHANCE) {
                triggerKitsuneGuardKnockback(unit, bestTarget, attackerWorldPos);
              }
            } else {
              const hpBeforeHit = bestTarget.userData.hp;
              applyDamage(bestTarget, dmg, uData.unitType, attackerWorldPos, unit);
              // Scarecrow passive - Drain: heals off the damage this hit
              // actually dealt (see scarecrowDrain).
              if (uData.isScarecrow) scarecrowDrain(unit, bestTarget, hpBeforeHit, attackerWorldPos);
              // Cavalry passive - Sword Slash: every landed hit opens a
              // Bleeding wound that ticks for extra damage afterward.
              if (isCavalrySword && bestTarget.userData.hp > 0) {
                applyBleed(bestTarget);
              }
              // Dragon Ronin passive - Dragon's Breath: every landed
              // katana hit bursts into flame and sets the target Burning.
              if (uData.unitType === 'dragonRonin' && bestTarget.userData.hp > 0) {
                applyBurn(bestTarget);
                spawnDragonFlameBurst(targetWorldPos.clone().add(new THREE.Vector3(0, 0.5, 0)));
              }
              // Chakram Dancers passive - Spinning Shield: every swing
              // tops the dancer's own overshield up further, regardless
              // of the target's outcome - see applyChakramDancerShield.
              if (uData.unitType === 'chakramDancers') {
                applyChakramDancerShield(unit);
              }
            }
            uData.attackCooldown = (uData.unitType === 'pikes' || isRaiderSpear || isCavalrySpear || isMilitiaSpear) ? 0.9 : (isAkumaFeral ? 1.5 : (isBearWarrior ? 1.3 : ((uData.unitType === 'berserker' || uData.raiderFaction === 'wolfWarrior') ? BERSERKER_BASE_ATTACK_COOLDOWN * (isBerserkerRaging ? BERSERKER_RAGE_COOLDOWN_MULT : 1) : (uData.unitType === 'valkyrie' ? 1.4 : (uData.unitType === 'chakramDancers' ? 1.2 : ((uData.unitType === 'goddessOfDeath' || uData.unitType === 'goddessOfLife') ? 1.3 : (uData.unitType === 'ghoul' ? GHOUL_ATTACK_COOLDOWN : 1.1)))))));
          }
        } else if (unit.parent.userData.isMoving && uData.unitType !== 'raiders') {
          // While the squad is on the march and this unit isn't actively
          // engaging a target, keep it facing the squad's travel direction
          // instead of leaving it locked onto wherever it last attacked.
          unit.rotation.y = 0;
        }
      };

      // Siege Engineer passive (Barricade) - while ducked behind its
      // barricade (barricadeShieldTimer still counting down, see
      // applyDamage's trigger and processUnitAttack's decrement), it's
      // fully immune anyway, but this also keeps raiders from wasting a
      // swing visibly hitting empty air where a hidden unit used to
      // stand.
      const raiderTargetableUnits = allPlayerUnits.filter(m =>
        !(m.userData.unitType === 'siege' && m.userData.barricadeShieldTimer > 0));
      allPlayerUnits.forEach(u => processUnitAttack(u, allRaiderUnits));
      allRaiderUnits.forEach(u => processUnitAttack(u, raiderTargetableUnits));

      // 2. Update Dynamic Projectiles
      updatePendingMagicMissiles(delta);
      updatePendingCavalryVolleys(delta);
      updatePendingSlasherAmbushKills(delta);
      updatePendingSlasherAmbushReturns(delta);
      for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const p = activeProjectiles[i];
        if (!p.targetUnit || p.targetUnit.userData.hp <= 0) {
          scene.remove(p.mesh);
          activeProjectiles.splice(i, 1);
          continue;
        }

        const targetPos = new THREE.Vector3();
        p.targetUnit.getWorldPosition(targetPos);
        targetPos.y += 0.4;

        const dir = new THREE.Vector3().subVectors(targetPos, p.mesh.position).normalize();
        p.mesh.position.addScaledVector(dir, p.speed * delta);
        p.mesh.lookAt(targetPos);
        if (p.spinSpeed) p.mesh.rotation.z += p.spinSpeed * delta;

        if (p.mesh.position.distanceTo(targetPos) < 0.25) {
          // Arrows are shared by four unit types (Archers, Cavalry,
          // Raiders, and Militia). Only a real Archer's arrow should ever
          // register as 'archers' and trigger Piercing Shot - tag it with
          // the actual shooter's unitType so Cavalry/Raider/Militia bow
          // shots don't inherit a passive they were never meant to have.
          const dmgType = p.type === 'arrow' ? (p.shooterType || 'archers') : (p.type === 'bolt' ? (p.shooterType || 'crossbow') : (p.type === 'shuriken' ? 'ninja' : (p.type === 'spear' ? 'raiders' : (p.type === 'bomb' ? 'bomb' : (p.type === 'frostbolt' ? 'lich' : (p.type === 'flameSlash' ? 'kitsuneTwinblade' : 'mages'))))));
          if (p.type === 'bomb') {
            spawnBombExplosion(p.mesh.position.clone());
            spawnFloatingText(p.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 'BOOM!', '#ff6633');
          }
          applyDamage(p.targetUnit, p.damage, dmgType, p.mesh.position, null, true);
          // War Elephant passive (Venom Arrows) - see spawnProjectile's
          // poisonOnHit flag, set only for a Desert Warrior's arrow.
          if (p.poisonOnHit) applyPoison(p.targetUnit);
          // Kitsune Twinblade passive (Flame Crescent) - every Flame
          // Crescent slash sets its target alight on landing, same
          // applyBurn DOT the Dragon Ronin's Dragon's Breath uses.
          if (p.type === 'flameSlash') applyBurn(p.targetUnit);
          scene.remove(p.mesh);
          activeProjectiles.splice(i, 1);
        }
      }

      // 3. Update Visual Particles
      for (let i = activeParticles.length - 1; i >= 0; i--) {
        const pt = activeParticles[i];
        pt.age += delta;
        pt.mesh.position.addScaledVector(pt.velocity, delta);
        pt.velocity.y -= 9.8 * delta; // gravity

        if (pt.age >= pt.duration) {
          scene.remove(pt.mesh);
          activeParticles.splice(i, 1);
        }
      }

      // 2a. Update Siege Engineer Barricades - just a fixed-duration
      // lifetime (no motion/fade), matching how long the Barricade
      // passive's damage immunity itself lasts (BARRICADE_SHIELD_DURATION).
      for (let i = activeSiegeBarricades.length - 1; i >= 0; i--) {
        const b = activeSiegeBarricades[i];
        b.age += delta;
        if (b.age >= b.duration) {
          scene.remove(b.mesh);
          activeSiegeBarricades.splice(i, 1);
        }
      }

      // 3a. Update Ninja Smoke Bomb puffs - grow, drift upward, and fade
      // out over their lifetime instead of falling like gore/impact FX.
      for (let i = activeSmokePuffs.length - 1; i >= 0; i--) {
        const sp = activeSmokePuffs[i];
        sp.age += delta;
        const t = Math.min(sp.age / sp.duration, 1);

        sp.mesh.position.addScaledVector(sp.velocity, delta);
        sp.velocity.multiplyScalar(0.94); // drift slows as the puff billows out

        const scale = sp.startScale * (1 + (sp.growth - 1) * t);
        sp.mesh.scale.setScalar(scale / sp.startScale);
        sp.mesh.material.opacity = 0.75 * (1 - t);

        if (sp.age >= sp.duration) {
          scene.remove(sp.mesh);
          sp.mesh.geometry.dispose();
          sp.mesh.material.dispose();
          activeSmokePuffs.splice(i, 1);
        }
      }

      // 3a2. Update Doctor Resurrection / Paladin Holy Light beams/rings -
      // the pillar rises and thins out while the ground ring expands
      // outward, both fading to nothing over their short duration.
      for (let i = activeHolyBeams.length - 1; i >= 0; i--) {
        const hb = activeHolyBeams[i];
        hb.age += delta;
        const t = Math.min(hb.age / hb.duration, 1);

        hb.beam.scale.y = 1 + t * 0.7;
        hb.beam.material.opacity = 0.55 * (1 - t);
        hb.beam.rotation.y += delta * 2.4;

        const ringScale = 1 + t * 4;
        hb.ring.scale.set(ringScale, ringScale, ringScale);
        hb.ring.material.opacity = 0.85 * (1 - t);

        if (hb.age >= hb.duration) {
          scene.remove(hb.beam);
          hb.beam.geometry.dispose();
          hb.beam.material.dispose();
          scene.remove(hb.ring);
          hb.ring.geometry.dispose();
          hb.ring.material.dispose();
          activeHolyBeams.splice(i, 1);
        }
      }

      // 3a2b. Update Bear Warrior lightning bolts - a much quicker
      // flash-and-fade than the Holy Beam above (see spawnLightningBoltEffect):
      // the bolt shrinks back into the ground while its ring snaps outward,
      // both gone within under half a second.
      for (let i = activeLightningBolts.length - 1; i >= 0; i--) {
        const lb = activeLightningBolts[i];
        lb.age += delta;
        const t = Math.min(lb.age / lb.duration, 1);

        lb.bolt.scale.y = 1 - t * 0.5;
        lb.bolt.material.opacity = 0.9 * (1 - t);

        const ringScale = 1 + t * 5;
        lb.ring.scale.set(ringScale, ringScale, ringScale);
        lb.ring.material.opacity = 0.9 * (1 - t);

        if (lb.age >= lb.duration) {
          scene.remove(lb.bolt);
          lb.bolt.geometry.dispose();
          lb.bolt.material.dispose();
          scene.remove(lb.ring);
          lb.ring.geometry.dispose();
          lb.ring.material.dispose();
          activeLightningBolts.splice(i, 1);
        }
      }

      // 3a2c. Update Paladin Light Shock bursts - both rings expand out to
      // the ability's actual damage radius (targetScale, computed in
      // spawnLightShockEffect) rather than a fixed small multiplier, since
      // this one needs to visually match where the AoE damage lands.
      for (let i = activeLightShockBursts.length - 1; i >= 0; i--) {
        const ls = activeLightShockBursts[i];
        ls.age += delta;
        const t = Math.min(ls.age / ls.duration, 1);
        const eased = 1 - Math.pow(1 - t, 2); // ease-out, fast start then settle

        const ringScale = 1 + eased * (ls.targetScale - 1);
        ls.ring.scale.set(ringScale, ringScale, ringScale);
        ls.ring.material.opacity = 0.85 * (1 - t);

        // The inner ring trails slightly behind the outer one's growth for
        // the double-pulse look.
        const ring2Scale = 1 + eased * (ls.targetScale - 1) * 0.7;
        ls.ring2.scale.set(ring2Scale, ring2Scale, ring2Scale);
        ls.ring2.material.opacity = 0.9 * (1 - t);

        if (ls.age >= ls.duration) {
          scene.remove(ls.ring);
          ls.ring.geometry.dispose();
          ls.ring.material.dispose();
          scene.remove(ls.ring2);
          ls.ring2.geometry.dispose();
          ls.ring2.material.dispose();
          activeLightShockBursts.splice(i, 1);
        }
      }

      // 3a2d. Update Kitsune Twinblade slash arcs - a fast flash-and-grow:
      // the crescent expands slightly while both bands fade out, gone
      // well within a third of a second (see spawnSlashArc).
      for (let i = activeSlashArcs.length - 1; i >= 0; i--) {
        const s = activeSlashArcs[i];
        s.age += delta;
        const t = Math.min(s.age / s.duration, 1);
        const scale = 1 + t * 0.4;
        s.group.scale.set(scale, scale, scale);
        s.outer.material.opacity = 0.95 * (1 - t);
        s.inner.material.opacity = 1 * (1 - t);

        if (s.age >= s.duration) {
          scene.remove(s.group);
          s.outer.geometry.dispose();
          s.outer.material.dispose();
          s.inner.geometry.dispose();
          s.inner.material.dispose();
          activeSlashArcs.splice(i, 1);
        }
      }

      // 3a3. Update Slasher Ghost Step shadow bursts - ground ring
      // blows outward while the core flash blooms and both fade to
      // nothing over a short, punchy duration.
      for (let i = activeShadowBursts.length - 1; i >= 0; i--) {
        const sb = activeShadowBursts[i];
        sb.age += delta;
        const t = Math.min(sb.age / sb.duration, 1);

        const ringScale = 1 + t * 5;
        sb.ring.scale.set(ringScale, ringScale, ringScale);
        sb.ring.material.opacity = 0.85 * (1 - t);

        const coreScale = 1 + t * 2.2;
        sb.core.scale.setScalar(coreScale);
        sb.core.material.opacity = 0.9 * (1 - t);

        if (sb.age >= sb.duration) {
          scene.remove(sb.ring);
          sb.ring.geometry.dispose();
          sb.ring.material.dispose();
          scene.remove(sb.core);
          sb.core.geometry.dispose();
          sb.core.material.dispose();
          activeShadowBursts.splice(i, 1);
        }
      }

      // 3a4. Update Steel Revenant Steel Grasp FX - the ground claw hands
      // punch up, curl into a fist as the pull lands, then sink back down
      // and fade; the rectangular zone flash just blooms and fades on its
      // own much shorter timer. See triggerSteelRevenantSteelGrasp.
      for (let i = activeGraspFX.length - 1; i >= 0; i--) {
        const gx = activeGraspFX[i];
        gx.age += delta;
        const t = Math.min(gx.age / gx.duration, 1);

        if (gx.kind === 'claw') {
          // Rise for the first 40%, curl into a fist through the next
          // 40% (as the pull actually drags the target), then hold/fade
          // through the last 20%.
          const rise = Math.min(t / 0.4, 1);
          const curl = t < 0.4 ? 0 : Math.min((t - 0.4) / 0.4, 1);
          gx.mesh.position.y = gx.baseY + rise * 0.22;
          gx.mesh.scale.setScalar(0.7 + rise * 0.5);
          gx.mesh.rotation.x = -curl * 1.1;
          const clawFade = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
          gx.mats.forEach(m => m.opacity = 0.85 * clawFade);
        } else if (gx.kind === 'ghostMace') {
          // Ghost Of Mace - hangs right where the slam connected and
          // simply fades out, reading as a spectral afterimage left
          // behind by the swing rather than a moving object.
          gx.mats.forEach(m => m.opacity = 0.5 * (1 - t));
        } else if (gx.kind === 'ring') {
          // Goddess crescent / death ring - expands and fades.
          const rs = 1 + t * (gx.grow || 0.3);
          gx.mesh.scale.set(rs, 1, rs);
          gx.mats.forEach(m => m.opacity = (gx.baseOpacity || 0.5) * (1 - t));
        } else {
          // Zone flash - a quick bloom outward that fades to nothing.
          const scale = 1 + t * 0.15;
          gx.mesh.scale.set(scale, 1, scale);
          gx.mats.forEach(m => m.opacity = 0.38 * (1 - t));
        }

        if (gx.age >= gx.duration) {
          scene.remove(gx.mesh);
          gx.mesh.traverse(child => { if (child.geometry) child.geometry.dispose(); });
          gx.mats.forEach(m => m.dispose());
          activeGraspFX.splice(i, 1);
        }
      }

      // 3b. Update Blood Decals - all fade out and disappear after
      // BLOOD_DECAL_LIFETIME; water decals additionally bloom outward,
      // blend into the water color, and drift while they fade.
      for (let i = bloodDecals.length - 1; i >= 0; i--) {
        const bd = bloodDecals[i];
        bd.age += delta;
        const t = Math.min(bd.age / bd.maxAge, 1);

        if (bd.isWater) {
          // Spreads/blooms outward quickly at first, like blood diffusing into water
          const bloom = 1 + Math.min(bd.age / 3, 1) * 2.2;
          bd.mesh.scale.set(bloom, bloom, bloom);

          // Blends from blood-red toward the water's own color as it dilutes
          bd.mesh.material.color.copy(bd.startColor).lerp(bd.endColor, Math.min(t * 1.4, 1));

          // Drifts gently with the water like a real slick would
          bd.mesh.position.x += bd.driftDir.x * delta;
          bd.mesh.position.z += bd.driftDir.z * delta;
        }

        // Fades out, faster in the final third of its life - shared by land and water.
        bd.mesh.material.opacity = bd.baseOpacity * (1 - t * t);

        if (bd.age >= bd.maxAge) {
          scene.remove(bd.mesh);
          bd.mesh.geometry.dispose();
          bd.mesh.material.dispose();
          bloodDecals.splice(i, 1);
        }
      }

      // 3b2. Update Dropped Weapons - shrinks away over its final second,
      // then is removed once DROPPED_WEAPON_LIFETIME is up. Scaled down
      // rather than faded via material opacity, since a weapon mesh's
      // material may still be shared with the same weapon type on a living
      // unit (mutating shared opacity would fade those too).
      for (let i = droppedWeapons.length - 1; i >= 0; i--) {
        const dw = droppedWeapons[i];
        dw.userData.dropAge = (dw.userData.dropAge || 0) + delta;
        const shrinkStart = DROPPED_WEAPON_LIFETIME - 1;
        if (dw.userData.dropAge >= shrinkStart) {
          const shrinkT = Math.min((dw.userData.dropAge - shrinkStart) / 1, 1);
          const s = 1 - shrinkT;
          const base = dw.userData.baseScale || dw.scale;
          dw.scale.set(base.x * s, base.y * s, base.z * s);
        }
        if (dw.userData.dropAge >= DROPPED_WEAPON_LIFETIME) {
          if (dw.parent) dw.parent.remove(dw);
          droppedWeapons.splice(i, 1);
        }
      }

      // 3c. Update Steel Revenant Soul Effects - the soul separates and
      // rises free of the collapsing armor, a pair of ghostly hands claw up
      // out of the ground and close around it, then hands and soul sink
      // back under together - only then do the leftover plates get their
      // outward scatter burst. See steelRevenantSoulDeath.
      for (let i = steelSouls.length - 1; i >= 0; i--) {
        const s = steelSouls[i];
        s.age += delta;

        const groundY = getSurfaceY(s.origin.x, s.origin.z) ?? s.origin.y;

        if (s.age < STEEL_SOUL_RISE_DURATION) {
          // Phase 1: the soul climbs free of the collapsing armor
          const t = s.age / STEEL_SOUL_RISE_DURATION;
          const eased = 1 - Math.pow(1 - t, 2);
          s.soulMesh.position.y = s.origin.y + 0.5 + eased * STEEL_SOUL_RISE_HEIGHT;
          s.soulMesh.rotation.y += delta * 0.8;
          s.soulMesh.userData.mats.forEach(m => m.opacity = 0.8 * Math.min(t * 2, 1));
        } else if (s.age < STEEL_SOUL_RISE_DURATION + STEEL_SOUL_GRAB_DURATION) {
          // Phase 2: a pair of hands claw up out of the ground and close in
          const t = (s.age - STEEL_SOUL_RISE_DURATION) / STEEL_SOUL_GRAB_DURATION;
          const soulY = s.origin.y + 0.5 + STEEL_SOUL_RISE_HEIGHT + Math.sin(s.age * 3) * 0.04;
          s.soulMesh.position.y = soulY;
          s.soulMesh.rotation.y += delta * 0.8;

          const handRise = Math.min(t * 1.6, 1);
          [s.handL, s.handR].forEach((hand, idx) => {
            const side = idx === 0 ? -1 : 1;
            hand.position.set(
              s.origin.x + side * STEEL_SOUL_HAND_SPREAD * (1 - handRise * 0.6),
              (groundY - 0.4) + handRise * (soulY - (groundY - 0.4)),
              s.origin.z
            );
            hand.rotation.z = side * (0.3 - handRise * 0.3);
            hand.userData.mats.forEach(m => m.opacity = 0.9 * handRise);
          });
        } else if (s.age < STEEL_SOUL_RISE_DURATION + STEEL_SOUL_GRAB_DURATION + STEEL_SOUL_DESCEND_DURATION) {
          // Phase 3: hands and soul sink back down into the ground together
          const t = (s.age - STEEL_SOUL_RISE_DURATION - STEEL_SOUL_GRAB_DURATION) / STEEL_SOUL_DESCEND_DURATION;
          const startY = s.origin.y + 0.5 + STEEL_SOUL_RISE_HEIGHT;
          const y = lerp(startY, groundY - 0.7, t);
          const scale = Math.max(1 - t, 0.001);

          s.soulMesh.position.y = y;
          s.soulMesh.scale.setScalar(scale);
          s.soulMesh.userData.mats.forEach(m => m.opacity = 0.8 * (1 - t));

          [s.handL, s.handR].forEach((hand, idx) => {
            const side = idx === 0 ? -1 : 1;
            hand.position.set(s.origin.x + side * STEEL_SOUL_HAND_SPREAD * 0.4 * scale, y, s.origin.z);
            hand.scale.setScalar(scale);
            hand.userData.mats.forEach(m => m.opacity = 0.9 * (1 - t));
          });
        } else {
          // Finale: the soul is gone - scatter whatever plates are still
          // intact, drop a little dust where it sank, and retire the effect.
          if (!s.scattered) {
            s.scattered = true;
            if (s.rag) scatterRemainingArmor(s.rag);
            for (let d = 0; d < 6; d++) {
              spawnParticle(new THREE.Vector3(s.origin.x, groundY + 0.05, s.origin.z), 0x9fb8c8, 0.06, 0.5);
            }
          }
          scene.remove(s.soulMesh);
          disposeSoulGroup(s.soulMesh);
          scene.remove(s.handL);
          disposeSoulGroup(s.handL);
          scene.remove(s.handR);
          disposeSoulGroup(s.handR);
          steelSouls.splice(i, 1);
        }
      }

      // 4. Update Ragdoll Physics Simulation & 2-Minute Skeleton Decay Cycle
      for (let i = ragdolls.length - 1; i >= 0; i--) {
        const rag = ragdolls[i];
        rag.age += delta;

        // 40-Second Carrion Bird Chance: fresh bodies may attract 1-4 crows/seagulls
        // that dive in, land, and start eating. Skeletonized remains never trigger this.
        if (!rag.birdCheckDone && rag.age >= BIRD_SPAWN_DELAY) {
          rag.birdCheckDone = true;
          if (!rag.isDecayed && Math.random() < BIRD_SPAWN_CHANCE) {
            spawnCarrionBirds(rag);
          }
        }

        // Recompute the terrain height under the body every frame - a body that gets
        // flung from land out over the water needs the water's height right now, not
        // the land height cached from wherever the unit originally died. Using a stale
        // cached height is what caused bodies to stop and hang frozen in mid-air above
        // the water instead of landing on its surface.
        const tileY = getSurfaceY(rag.group.position.x, rag.group.position.z);
        const overWater = tileY === null;
        const groundY = overWater ? WATER_SURFACE_Y : tileY;

        // Physics step for the whole body (torso + attached limbs) as ONE rigid object,
        // so it falls and lands as a single consistent unit instead of each limb pushing
        // the shared group position around and disagreeing about when it has landed.
        if (rag.isRollingToWater) {
          // Settled right at the coastline: tip over and roll into the water
          // instead of freezing on dry land beside it.
          rag.group.position.addScaledVector(rag.rollDir, COASTAL_ROLL_SPEED * delta);
          rag.group.rotateOnWorldAxis(rag.rollAxis, COASTAL_ROLL_SPIN * delta);
          const rollTileY = getSurfaceY(rag.group.position.x, rag.group.position.z);
          if (rollTileY === null) {
            // Reached open water - splash down and float away like any other body.
            rag.isRollingToWater = false;
            rag.isFloating = true;
            rag.floatPhase = Math.random() * Math.PI * 2;
            rag.driftDir.copy(rag.rollDir).multiplyScalar(WATER_DRIFT_SPEED);
            rag.group.position.y = WATER_SURFACE_Y + 0.05;
            rag.group.rotation.x = Math.PI / 2;
            rag.group.rotation.z = (Math.random() - 0.5) * 0.3;
            for (let s = 0; s < 6; s++) {
              spawnParticle(rag.group.position.clone(), 0xe8f4ff, 0.07, 0.5);
            }
          } else {
            rag.group.position.y = rollTileY + 0.05;
          }
        } else if (!rag.isGrounded && !rag.isFloating) {
          rag.velocity.y -= 9.81 * delta; // Gravity
          rag.group.position.addScaledVector(rag.velocity, delta);

          if (!rag.hasLanded) {
            // Still actually airborne before the first touchdown - free tumble
            rag.group.rotation.x += rag.rotVel.x * delta;
            rag.group.rotation.z += rag.rotVel.z * delta;
          } else {
            // Already touched down at least once - only ever ease toward lying flat
            // from here on (every frame, including small settling hops between
            // bounces), so it can never tumble back toward standing upright.
            rag.group.rotation.x = lerp(rag.group.rotation.x, Math.PI / 2, 0.2);
            rag.group.rotation.z *= 0.85;
          }

          // Surface Collision (ground or water)
          if (rag.group.position.y <= groundY + 0.1) {
            if (overWater) {
              rag.group.position.y = groundY + 0.05;
              rag.velocity.set(0, 0, 0);
              rag.rotVel.set(0, 0, 0);
              // Splash down and start floating instead of freezing in place
              rag.isFloating = true;
              rag.floatPhase = Math.random() * Math.PI * 2;
              rag.driftDir.set((Math.random() - 0.5), 0, (Math.random() - 0.5)).normalize().multiplyScalar(WATER_DRIFT_SPEED);
              rag.group.rotation.x = Math.PI / 2;
              rag.group.rotation.z = (Math.random() - 0.5) * 0.3;
              for (let s = 0; s < 6; s++) {
                spawnParticle(rag.group.position.clone(), 0xe8f4ff, 0.07, 0.5);
              }
            } else {
              // Land: bounce/slide/tumble to a natural stop instead of freezing instantly.
              rag.group.position.y = groundY + 0.05;
              rag.hasLanded = true;

              // Lose most of the vertical energy on each bounce; keep bouncing a little
              // until it's too small to matter, rather than snapping dead on first touch.
              rag.velocity.y = Math.abs(rag.velocity.y) > 0.05 ? -rag.velocity.y * 0.28 : 0;
              // Sliding friction on the ground plane
              rag.velocity.x *= 0.78;
              rag.velocity.z *= 0.78;
              // Tumbling slows down each time it touches the ground
              rag.rotVel.multiplyScalar(0.72);

              const restEnergy = rag.velocity.length() + rag.rotVel.length();
              if (restEnergy < 0.25) {
                // About to come to a full stop - but if it settled right at the
                // coastline, tip it over the edge and let it roll into the water
                // instead of freezing on the beach.
                const waterDir = findNearbyWaterDir(rag.group.position, COASTAL_EDGE_CHECK_RADIUS);
                rag.velocity.set(0, 0, 0);
                rag.rotVel.set(0, 0, 0);
                if (waterDir) {
                  rag.isRollingToWater = true;
                  rag.rollDir = waterDir;
                  // Roll end-over-end like a log, about the horizontal axis
                  // perpendicular to the direction it's rolling in - not a
                  // spin in place around the vertical axis.
                  rag.rollAxis = new THREE.Vector3().crossVectors(UP_AXIS, waterDir).normalize();
                } else {
                  rag.isGrounded = true;
                  rag.group.rotation.x = Math.PI / 2; // Lie flat on ground
                  rag.group.rotation.z = 0;
                  separateRestingCorpse(rag);
                }
              }
            }
          }
        } else if (rag.isFloating) {
          // Gently bob and rock on the water surface while drifting with the current
          rag.group.position.x += rag.driftDir.x * delta;
          rag.group.position.z += rag.driftDir.z * delta;
          rag.group.position.x = THREE.MathUtils.clamp(rag.group.position.x, -WATER_BOUNDS, WATER_BOUNDS);
          rag.group.position.z = THREE.MathUtils.clamp(rag.group.position.z, -WATER_BOUNDS, WATER_BOUNDS);
          rag.group.position.y = WATER_SURFACE_Y + Math.sin(rag.age * WATER_BOB_SPEED + rag.floatPhase) * WATER_BOB_AMPLITUDE;
          rag.group.rotation.z = Math.sin(rag.age * WATER_BOB_SPEED * 0.6 + rag.floatPhase) * 0.12;
        }

        // Independent physics for severed limbs (they fly off separately from the body)
        rag.parts.forEach(part => {
          if (part.isSevered) {
            if (!part.isGrounded && !part.isFloating) {
              part.velocity.y -= 9.81 * delta; // Gravity
              part.mesh.position.addScaledVector(part.velocity, delta);
              part.mesh.rotation.x += part.rotVel.x * delta;
              part.mesh.rotation.y += part.rotVel.y * delta;

              const partTileY = getSurfaceY(part.mesh.position.x, part.mesh.position.z);
              const partOverWater = partTileY === null;
              const partGroundY = partOverWater ? WATER_SURFACE_Y : partTileY;

              if (part.mesh.position.y <= partGroundY + 0.1) {
                if (partOverWater) {
                  part.mesh.position.y = partGroundY + 0.05;
                  part.velocity.set(0, 0, 0);
                  part.rotVel.set(0, 0, 0);
                  part.isFloating = true;
                  part.floatPhase = Math.random() * Math.PI * 2;
                  part.driftDir.set((Math.random() - 0.5), 0, (Math.random() - 0.5)).normalize().multiplyScalar(WATER_DRIFT_SPEED);
                  for (let s = 0; s < 3; s++) {
                    spawnParticle(part.mesh.position.clone(), 0xe8f4ff, 0.05, 0.4);
                  }
                } else {
                  // Bounce/slide/tumble to a natural stop, same as the main body
                  part.mesh.position.y = partGroundY + 0.05;
                  part.velocity.y = Math.abs(part.velocity.y) > 0.05 ? -part.velocity.y * 0.28 : 0;
                  part.velocity.x *= 0.78;
                  part.velocity.z *= 0.78;
                  part.rotVel.multiplyScalar(0.72);

                  const partRestEnergy = part.velocity.length() + part.rotVel.length();
                  if (partRestEnergy < 0.25) {
                    part.velocity.set(0, 0, 0);
                    part.rotVel.set(0, 0, 0);
                    part.isGrounded = true;
                  }
                }
              }
            } else if (part.isFloating) {
              part.mesh.position.x += part.driftDir.x * delta;
              part.mesh.position.z += part.driftDir.z * delta;
              part.mesh.position.x = THREE.MathUtils.clamp(part.mesh.position.x, -WATER_BOUNDS, WATER_BOUNDS);
              part.mesh.position.z = THREE.MathUtils.clamp(part.mesh.position.z, -WATER_BOUNDS, WATER_BOUNDS);
              part.mesh.position.y = WATER_SURFACE_Y + Math.sin(rag.age * WATER_BOB_SPEED + part.floatPhase) * WATER_BOB_AMPLITUDE;
            }
          } else if (!rag.isGrounded && !rag.isFloating) {
            // Small local wobble for attached limbs while the body is still falling
            part.mesh.rotation.x += part.rotVel.x * delta;
            part.mesh.rotation.z += part.rotVel.z * delta;
          }
        });

        // 2-Minute Decaying Skeleton Transition (120 Seconds) - Shadow Island's
        // Skeleton Warriors are already bare bone when they die, so they never
        // run this transition and their corpses never vanish on a timer.
        // Zombie allies get the same exemption - they're already a rotted
        // reanimated corpse, so they skip straight to the isZombie vanish
        // check below instead of decaying down to a plain human skeleton.
        // The Steel Revenant has no flesh to decay either - its plate just
        // disappears outright once decayTime is up (see below), rather than
        // decaying down to a skeleton first.
        if (rag.age >= rag.decayTime && !rag.isDecayed && !rag.isSkeleton && !rag.isZombie && !rag.isSteelRevenant && !rag.isWarElephant) {
          rag.isDecayed = true;

          // Hide fleshed limbs and activate skeleton corpse mesh
          rag.parts.forEach(p => {
            p.mesh.visible = false;
          });
          if (rag.skelMesh) {
            rag.skelMesh.visible = true;
            // No extra rotation here - skelMesh is a child of rag.group, which is
            // already lying flat (rotated to Math.PI/2). Rotating it again on top of
            // that compounded to a full 180-degree flip, snapping the skeleton back
            // into a standing-looking pose the instant it appeared.
          }

          // Spawn bone dust particles
          for (let b = 0; b < 10; b++) {
            spawnParticle(rag.group.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xe3dac9, 0.1, 0.8);
          }
        }

        // Skeleton fully vanishes some time after decaying down to bone - not
        // applicable to units that were already Skeleton Warriors (or
        // Zombie allies) in life.
        if (rag.isDecayed && !rag.isSkeleton && !rag.isZombie && (rag.age - rag.decayTime) >= SKELETON_LIFETIME) {
          scene.remove(rag.group);
          ragdolls.splice(i, 1);
          continue;
        }

        // Shadow Island Skeleton Warriors were already bare bone at death, so
        // they skip the fleshed decay transition above entirely - instead
        // their corpse just vanishes outright a fixed time after death. A
        // fallen Zombie ally gets the same straight-to-vanish treatment,
        // just on its own longer clock (ZOMBIE_CORPSE_LIFETIME) so it keeps
        // looking like a zombie the whole time it lingers.
        if (rag.isSkeleton && rag.age >= SKELETON_CORPSE_LIFETIME) {
          scene.remove(rag.group);
          ragdolls.splice(i, 1);
        } else if (rag.isZombie && rag.age >= ZOMBIE_CORPSE_LIFETIME) {
          scene.remove(rag.group);
          ragdolls.splice(i, 1);
        } else if (rag.isSteelRevenant && rag.age >= rag.decayTime) {
          // The empty suit disappears outright at the 2-minute mark instead
          // of decaying to bone first. scatterRemainingArmor (see
          // steelRevenantSoulDeath) re-parents every plate piece from
          // rag.group into the scene directly once it scatters, so each
          // one needs removing individually here too, not just rag.group.
          rag.parts.forEach(p => { if (p.mesh.parent) p.mesh.parent.remove(p.mesh); });
          scene.remove(rag.group);
          ragdolls.splice(i, 1);
        } else if (rag.isWarElephant && rag.age >= rag.decayTime) {
          // Body disappears outright at the 2-minute mark instead of
          // decaying down into a human skeleton first.
          scene.remove(rag.group);
          ragdolls.splice(i, 1);
        }
      }

      // 4b. Update Carrion Birds (crows & seagulls scavenging on corpses)
      for (let i = birds.length - 1; i >= 0; i--) {
        const bird = birds[i];
        const rag = bird.rag;
        const stillValid = rag && ragdolls.indexOf(rag) !== -1;

        // Nothing left to peck once the body is a skeleton (or gone) - fly off
        if (bird.state !== 'fleeing' && (!stillValid || (rag && rag.isDecayed))) {
          bird.state = 'fleeing';
        }

        const anchor = stillValid ? rag.group.position : bird.mesh.position;
        const tileY = getSurfaceY(anchor.x, anchor.z);
        const perchY = (tileY === null ? WATER_SURFACE_Y : tileY) + 0.1;
        const targetX = anchor.x + bird.offsetX;
        const targetZ = anchor.z + bird.offsetZ;

        if (bird.state === 'incoming') {
          const dx = targetX - bird.mesh.position.x;
          const dz = targetZ - bird.mesh.position.z;
          const dy = perchY - bird.mesh.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const step = Math.min(1, (BIRD_APPROACH_SPEED * delta) / Math.max(dist, 0.001));
          bird.mesh.position.x += dx * step;
          bird.mesh.position.y += dy * step;
          bird.mesh.position.z += dz * step;

          if (dx * dx + dz * dz > 0.0001) {
            bird.mesh.rotation.y = Math.atan2(dx, dz);
          }

          // Fast flapping while swooping down
          bird.flapPhase += delta * 14;
          const flap = Math.sin(bird.flapPhase) * 0.9;
          bird.wingL.rotation.z = flap;
          bird.wingR.rotation.z = -flap;

          if (dist < 0.12) {
            bird.state = 'eating';
            bird.mesh.position.set(targetX, perchY, targetZ);
            bird.mesh.rotation.y = Math.atan2(anchor.x - targetX, anchor.z - targetZ);
          }
        } else if (bird.state === 'eating') {
          // Ride along if the corpse is drifting (e.g. floating out on the water)
          bird.mesh.position.x = targetX;
          bird.mesh.position.z = targetZ;

          // Folded wings, with a small idle settle
          bird.flapPhase += delta * 2;
          const settle = Math.sin(bird.flapPhase) * 0.05;
          bird.wingL.rotation.z = settle;
          bird.wingR.rotation.z = -settle;

          // Pecking bob - head/body dip down toward the body rhythmically
          bird.peckPhase += delta * 5;
          const peck = Math.max(0, Math.sin(bird.peckPhase));
          bird.head.rotation.x = peck * 0.9;
          bird.mesh.position.y = perchY - peck * 0.045;

          bird.eatTimer -= delta;
          if (bird.eatTimer <= 0) {
            bird.state = 'fleeing';
          }
        } else if (bird.state === 'fleeing') {
          bird.fleeTimer += delta;
          bird.head.rotation.x = 0;
          bird.mesh.position.y += delta * 3.2;
          bird.mesh.position.x += Math.sin(bird.fleeTimer * 2 + bird.peckPhase) * delta * 1.5;
          bird.mesh.position.z += delta * 2.5;

          bird.flapPhase += delta * 16;
          const flap = Math.sin(bird.flapPhase) * 1.1;
          bird.wingL.rotation.z = flap;
          bird.wingR.rotation.z = -flap;

          if (bird.mesh.position.y - perchY > 8) {
            scene.remove(bird.mesh);
            birds.splice(i, 1);
          }
        }
      }

      // 5. Update Screen-Space Floating Text & HP Bar Positions
      const tempVec = new THREE.Vector3();

      const updateUnitUI = (unit) => {
        const uData = unit.userData;
        if (!uData.hpElement) return;

        if (uData.hp <= 0 || uData.vanished) {
          uData.hpElement.style.display = 'none';
          return;
        }

        // Siege Engineer passive (Barricade) - hidden behind its
        // barricade for the duration of barricadeShieldTimer (see
        // applyDamage's trigger), so its HP bar stays hidden right
        // alongside the mesh itself instead of floating over empty
        // ground where the unit used to stand.
        if (uData.unitType === 'siege' && uData.barricadeShieldTimer > 0) {
          uData.hpElement.style.display = 'none';
          return;
        }

        // Only show the bar once a unit has actually taken damage - at
        // full health there's nothing useful for it to convey, and
        // leaving it visible on every idle villager/militia member all
        // the time (even outside a raid, per "No raiders yet") is what
        // was reading as broken geometry: a cluster of full-health units
        // standing close together (by a tree, at the Fortress gate) each
        // draw their own bar on top of each other's, and several
        // overlapping bright-green pill shapes floating in open air look
        // like a rendering glitch rather than a stat readout. Hiding the
        // full-health case means a bar only ever appears once there's an
        // actual number changing for the player to track.
        if (uData.hp >= uData.maxHp) {
          uData.hpElement.style.display = 'none';
          return;
        }

        unit.getWorldPosition(tempVec);
        tempVec.y += 0.9; // Position above head
        tempVec.project(camera);

        // Check if behind camera frustum
        if (tempVec.z > 1.0) {
          uData.hpElement.style.display = 'none';
          return;
        }

        const x = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-tempVec.y * 0.5 + 0.5) * window.innerHeight;

        uData.hpElement.style.display = 'block';
        uData.hpElement.style.left = `${x}px`;
        uData.hpElement.style.top = `${y}px`;
      };

      allPlayerUnits.forEach(updateUnitUI);
      allRaiderUnits.forEach(updateUnitUI);
      watchTowers.forEach(t => updateUnitUI(t.mesh));

      for (let i = activeFloatingTexts.length - 1; i >= 0; i--) {
        const ft = activeFloatingTexts[i];
        ft.age += delta;
        ft.pos.y += delta * 0.8;

        tempVec.copy(ft.pos).project(camera);
        const x = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-tempVec.y * 0.5 + 0.5) * window.innerHeight;

        ft.element.style.left = `${x}px`;
        ft.element.style.top = `${y}px`;
        ft.element.style.opacity = (1 - ft.age / ft.maxAge).toString();

        if (ft.age >= ft.maxAge) {
          ft.element.remove();
          activeFloatingTexts.splice(i, 1);
        }
      }

      // 6. Clean up finished Raider Squads
      for (let i = raiderSquads.length - 1; i >= 0; i--) {
        if (raiderSquads[i].members.length === 0) {
          removeSquadFromScene(raiderSquads[i], true);
          raiderSquads.splice(i, 1);
          updateWaveUI();
        }
      }
      const raidActiveNow = raiderSquads.length > 0;
      if (raidWasActiveLastFrame && !raidActiveNow) {
        applyMonkPostFightHeal();
        onWaveFinished();
      }
      raidWasActiveLastFrame = raidActiveNow;
      if (!raidActiveNow) revealVillagers();
    }

    // Safety net: re-syncs every STATIONARY squad's group height to the
    // actual terrain surface directly beneath it, every frame. Fixes the
    // "units hovering/floating above the ground" bug - a squad's
    // group.position.y is only ever written when it starts moving, finishes
    // a step, or is first placed on a new island (see stepSquadMovement's
    // two surfaceYFor() writes and generateRandomIsland's spawn-tile
    // placement below); if a squad is standing still and something else
    // leaves its y stale or wrong (a leftover value from before the last
    // "New Island" reroll, a knockback/launch animation that didn't fully
    // resolve, etc.), nothing ever corrected it before now. Moving squads
    // are skipped here since stepSquadMovement already keeps them glued to
    // the ground on every step; boats, tower-operators and fortress-
    // garrisoned units own their own vertical position and are left alone.
    function resyncStationarySquadGroundHeight(squadList) {
      squadList.forEach(squad => {
        if (squad.isMoving) return;
        if (squad.onBoat) return;
        if (squad.members.some(m => m.userData.isOperatingTower || m.userData.isGarrisonedAtFortress)) return;
        const groundY = getSurfaceY(squad.group.position.x, squad.group.position.z);
        if (groundY === null) return; // off the walkable grid - leave it as-is
        const desiredY = groundY + (squad.isGargoyle ? GARGOYLE_HOVER_HEIGHT : 0);
        if (Math.abs(squad.group.position.y - desiredY) > 0.001) {
          squad.group.position.y = desiredY;
        }
      });
    }

    // Step squad movement wrapper
    function stepSquadMovement(squad) {
      if (!squad.isMoving) return;

      const currentPos = squad.group.position;
      const dx = squad.targetPosition.x - currentPos.x;
      const dz = squad.targetPosition.z - currentPos.z;

      const distance = Math.hypot(dx, dz);

      if (distance < 0.1) {
        squad.group.position.x = squad.targetPosition.x;
        squad.group.position.z = squad.targetPosition.z;
        // Gargoyle flies - hovers a fixed height above whatever ground Y
        // the pathing logic computed rather than sitting on the terrain
        // like every other raider (see GARGOYLE_HOVER_HEIGHT).
        squad.group.position.y = squad.targetPosition.y + (squad.isGargoyle ? GARGOYLE_HOVER_HEIGHT : 0);

        squad.currentWaypoint++;
        if (squad.currentWaypoint < squad.currentPath.length) {
          const next = squad.currentPath[squad.currentWaypoint];
          const nextY = surfaceYFor(next.x, next.z, canSquadParkour(squad.type));
          squad.targetPosition.set(next.x, nextY !== null ? nextY : squad.targetPosition.y, next.z);
        } else {
          squad.isMoving = false;
          squad.group.userData.isMoving = false;
          squad.currentPath = [];
          squad.currentWaypoint = 0;
          squad.members.forEach(unit => unit.userData.isWalking = false);
          if (squads[selectedSquadIndex] === squad) targetHighlight.visible = false;
          if (squad.attackMarker) squad.attackMarker.visible = false;

          // Siege Engineer passive (Watchtower Construction) - a squad
          // walking back to reoperate a tower (see pendingTowerEntryTower,
          // set by the pointerup handler's towerAtTile branch) has now
          // actually arrived at that tower's tile: climb inside and go
          // hidden here, at the end of the walk, rather than the instant
          // the order was given.
          if (squad.pendingTowerEntryTower) {
            const enterTower = squad.pendingTowerEntryTower;
            squad.pendingTowerEntryTower = null;
            if (watchTowers.includes(enterTower) && enterTower.operatorSquad === squad) {
              squad.members.forEach(m => {
                if (m.userData.hp <= 0) return;
                m.userData.isOperatingTower = true;
                m.visible = false;
                if (m.userData.hpElement) m.userData.hpElement.style.display = 'none';
              });
              spawnFloatingText(new THREE.Vector3(enterTower.x, enterTower.mesh.position.y + 1.2, enterTower.z), 'Enters Watch Tower!', '#ffdd66');
            }
          }
        }
      } else {
        // Move along one axis at a time - horizontal or vertical only, no
        // diagonal stepping.
        const dir = new THREE.Vector3();
        if (Math.abs(dx) > 0.05) {
          dir.set(Math.sign(dx), 0, 0);
        } else {
          dir.set(0, 0, Math.sign(dz));
        }

        const targetAngle = Math.atan2(dir.x, dir.z);
        squad.group.rotation.y = targetAngle;

        const onRoad = roadTiles.has(Math.round(currentPos.x) + ',' + Math.round(currentPos.z));
        const roadSpeedMult = onRoad ? ROAD_SPEED_MULTIPLIER : 1;

        const step = dir.clone().multiplyScalar(squad.moveSpeed * roadSpeedMult * stepSquadMovement.currentDelta);
        if (Math.abs(step.x) > Math.abs(dx)) step.x = dx;
        if (Math.abs(step.z) > Math.abs(dz)) step.z = dz;

        const nextPos = currentPos.clone().add(step);

        let hitObstacle = false;
        const nextGroundY = surfaceYFor(nextPos.x, nextPos.z, canSquadParkour(squad.type));
        if (nextGroundY === null) {
          hitObstacle = true;
        }

        // All squads block each other - player, militia, and raiders alike
        // stop before walking into/through another squad's formation
        // instead of overlapping it. Without this, nothing stopped
        // different squads (especially raiders, who previously had no
        // collision checks at all) from marching straight onto the exact
        // same tile as whoever they were fighting, piling every unit from
        // both sides into one unreadable stack. Individual units within a
        // squad's 2x2 formation still spread toward the enemy enough to
        // stay inside normal melee range even while their squad centers
        // stay this far apart.
        //
        // Raider warbands are the one exception: on a big wave, several
        // squads converge on the same defending squad from different
        // landing points, and the first ones to arrive were forming a wall
        // (0.85 apart) that blocked the ones behind before they ever got
        // within RAIDER_ATTACK_RANGE (0.9). Those trailing squads then sat
        // stuck just out of range every AI tick - never attacking, and
        // being unreachable themselves, never dying either. Raiders no
        // longer collide with fellow raiders so the whole warband can pack
        // in around the target instead of jamming into each other.
        //
        // Castle Interior assault is the other exception, and a bigger
        // one: unlike the spread-out outer island, buildCastleInteriorMap's
        // courtyard is small enough, and enterCastleInterior clusters every
        // player squad plus all 4 Orc defender squads (CASTLE_INTERIOR_
        // DEFENDER_SQUAD_COUNT) close enough, that once the melee actually
        // clumps up every neighboring tile around a squad is already within
        // SQUAD_COLLISION_RADIUS of some other squad - friend or foe. That
        // leaves nowhere left for stepSquadMovement to step at all, so
        // player squads (and defenders) just freeze in place mid-fight,
        // completely unable to reposition.
        //
        // Only cross-side pairs (a player squad vs an Orc defender squad,
        // whose own type is always 'raiders' - see createRaiderSquad) skip
        // collision here, not every pair - a squad still collides with its
        // OWN side (other player squads). Disabling it for every pair
        // fixed the freeze but let a player squad walk straight into and
        // overlap another player squad, the two then reading as one merged
        // blob that moved together instead of independently. This way a
        // player squad can push through the Orc scrum it's fighting
        // without losing the ability to stay a separate, individually
        // selectable/movable unit from the player's other squads.
        let squadBlocked = false;
        if (!hitObstacle) {
          const allLiveSquads = squads.concat(militiaSquads, raiderSquads);
          for (const other of allLiveSquads) {
            if (other === squad || other.members.length === 0) continue;
            if (other.onBoat) continue; // boats haven't landed yet, nothing to collide with on the beach
            if (squad.type === 'raiders' && other.type === 'raiders') continue; // raiders don't block fellow raiders
            if (inCastleInterior && ((squad.type === 'raiders') !== (other.type === 'raiders'))) continue; // cross-side pair - let the storming/defending sides push past each other
            const dxo = nextPos.x - other.group.position.x;
            const dzo = nextPos.z - other.group.position.z;
            if (Math.hypot(dxo, dzo) < SQUAD_COLLISION_RADIUS) {
              hitObstacle = true;
              squadBlocked = true;
              break;
            }
          }
        }

        if (!hitObstacle) {
          squad.group.position.add(step);
          // See the Gargoyle hover note above.
          squad.group.position.y = nextGroundY + (squad.isGargoyle ? GARGOYLE_HOVER_HEIGHT : 0);
        } else if (squadBlocked && squad.moveGoal && squad.type !== 'raiders' && squad.type !== 'militia') {
          // Smart pathfinding: a player squad blocked mid-route by another
          // squad pauses and tries to reroute around it instead of simply
          // freezing in place - the squad in the way may just be passing
          // through. Rate-limited via repathCooldown so a squad that's
          // genuinely boxed in doesn't re-run A* every single frame, and
          // gives up (falls back to the normal stop-in-place behavior
          // below) after a handful of failed attempts rather than waiting
          // forever.
          squad.repathCooldown = (squad.repathCooldown || 0) - stepSquadMovement.currentDelta;
          if (squad.repathCooldown <= 0) {
            squad.repathCooldown = 0.3;
            const canParkour = squad.moveGoalCanParkour || false;
            const blockedKeys = collidableSquadBlockedKeys(squad);
            const newPath = findPath(currentPos.x, currentPos.z, squad.moveGoal.x, squad.moveGoal.z, true, false, canParkour, blockedKeys);
            if (newPath && newPath.length > 0) {
              squad.currentPath = newPath;
              squad.currentWaypoint = 0;
              squad.repathFailStreak = 0;
              const firstStep = newPath[0];
              const stepY = surfaceYFor(firstStep.x, firstStep.z, canParkour);
              squad.targetPosition.set(firstStep.x, stepY !== null ? stepY : squad.targetPosition.y, firstStep.z);
            } else {
              squad.repathFailStreak = (squad.repathFailStreak || 0) + 1;
              if (squad.repathFailStreak >= 5) {
                squad.isMoving = false;
                squad.group.userData.isMoving = false;
                squad.currentPath = [];
                squad.currentWaypoint = 0;
                squad.members.forEach(unit => unit.userData.isWalking = false);
                if (squads[selectedSquadIndex] === squad) targetHighlight.visible = false;
                if (squad.attackMarker) squad.attackMarker.visible = false;
              }
            }
          }
          // else: still on cooldown - hold position this frame and try
          // rerouting again once it expires.
        } else {
          squad.isMoving = false;
          squad.group.userData.isMoving = false;
          squad.currentPath = [];
          squad.currentWaypoint = 0;
          squad.members.forEach(unit => unit.userData.isWalking = false);
          if (squads[selectedSquadIndex] === squad) targetHighlight.visible = false;
          if (squad.attackMarker) squad.attackMarker.visible = false;
        }
      }
    }

    // --- Prevent Player Squads from ever overlapping/pushing each other ---
    // stepSquadMovement()'s collision check stops a squad from walking INTO
    // another one, but that's a move-time check only - it doesn't cover a
    // squad already standing still getting nudged into a neighbor by combat
    // knockback, a Cavalry charge shove, or any other stray displacement.
    // This runs every frame as a backstop: any two of the player's OWN
    // squads (the "squads" array only - militia/raiders are untouched)
    // found closer than SQUAD_COLLISION_RADIUS get pushed apart along the
    // line between their centers until they're back at a legal distance.
    // A squad that's actively mid-move toward a waypoint is left alone so
    // it doesn't get yanked off its path - only idle/stationary squads get
    // shifted (if both are idle, they split the correction evenly).
    function resolvePlayerSquadOverlaps() {
      for (let i = 0; i < squads.length; i++) {
        const a = squads[i];
        if (!a || a.members.length === 0 || a.onBoat) continue;
        for (let j = i + 1; j < squads.length; j++) {
          const b = squads[j];
          if (!b || b.members.length === 0 || b.onBoat) continue;

          const dx = b.group.position.x - a.group.position.x;
          const dz = b.group.position.z - a.group.position.z;
          let dist = Math.hypot(dx, dz);

          // Exactly stacked (shouldn't normally happen) - nudge apart along
          // a fixed axis first so there's a direction to push along.
          let nx, nz;
          if (dist < 0.0001) {
            nx = 1; nz = 0; dist = 0;
          } else {
            nx = dx / dist;
            nz = dz / dist;
          }

          if (dist >= SQUAD_COLLISION_RADIUS) continue;

          const overlap = (SQUAD_COLLISION_RADIUS - dist) / 2 + 0.01;
          const aCanShift = !a.isMoving;
          const bCanShift = !b.isMoving;

          if (aCanShift && bCanShift) {
            a.group.position.x -= nx * overlap;
            a.group.position.z -= nz * overlap;
            b.group.position.x += nx * overlap;
            b.group.position.z += nz * overlap;
          } else if (aCanShift) {
            a.group.position.x -= nx * overlap * 2;
            a.group.position.z -= nz * overlap * 2;
          } else if (bCanShift) {
            b.group.position.x += nx * overlap * 2;
            b.group.position.z += nz * overlap * 2;
          } else {
            // Both squads are actively mid-move (e.g. two paths crossed
            // right on top of each other for an instant) - still separate
            // them a hair so neither renders stacked on the other, without
            // fighting their own movement code hard.
            a.group.position.x -= nx * overlap * 0.5;
            a.group.position.z -= nz * overlap * 0.5;
            b.group.position.x += nx * overlap * 0.5;
            b.group.position.z += nz * overlap * 0.5;
          }

          const aY = surfaceYFor(a.group.position.x, a.group.position.z, canSquadParkour(a.type));
          if (aY !== null) a.group.position.y = aY;
          const bY = surfaceYFor(b.group.position.x, b.group.position.z, canSquadParkour(b.type));
          if (bY !== null) b.group.position.y = bY;
        }
      }
    }

    function lerp(a, b, t) { return a + (b - a) * t; }
    function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

    // Archer arm poses: raised into the "always ready" aiming stance while
    // advancing (matches the stance set at equip time), relaxed down into a
    // natural resting pose once fully stopped and not actively firing.
    const ARCHER_READY_ARM_L = { x: -Math.PI / 2, y: 0, z: -Math.PI / 20 };
    const ARCHER_READY_ARM_R = { x: -Math.PI / 2.1, y: 0, z: Math.PI / 14 };
    const ARCHER_REST_ARM_L = { x: -0.2, y: 0, z: 0.05 };
    const ARCHER_REST_ARM_R = { x: -0.1, y: 0, z: 0 };

    // Drives the weapon-swing / bow-draw / staff-cast animation for a unit
    // while its attackAnimTimer is counting down. Runs AFTER the walk/idle
    // pose so it overrides the resting arm rotations during the attack.
    function applyAttackPose(unit) {
      const uData = unit.userData;
      const p = 1 - (uData.attackAnimTimer / uData.attackAnimDuration); // 0 -> 1

      const isRaiderSpear = uData.unitType === 'raiders' && (uData.raiderWeapon === 'spear' || uData.raiderWeapon === 'spearShield' || uData.raiderWeapon === 'marauderSpear');
      const isRaiderBow = uData.unitType === 'raiders' && (uData.raiderWeapon === 'bow' || uData.raiderWeapon === 'wokouBow' || uData.raiderWeapon === 'banditBow');
      const isRaiderAcolyte = uData.unitType === 'raiders' && uData.raiderWeapon === 'acolyteBolt';
      const isRaiderGargoyle = uData.unitType === 'raiders' && uData.raiderWeapon === 'gargoyleBolt';
      const isCavalrySword = uData.unitType === 'cavalry' && uData.cavalryWeapon === 'sword';
      const isCavalrySpear = uData.unitType === 'cavalry' && uData.cavalryWeapon === 'spear';
      const isCavalryBow = uData.unitType === 'cavalry' && uData.cavalryWeapon === 'bow';
      const isMilitiaSword = uData.unitType === 'militia' && uData.militiaWeapon === 'sword';
      const isMilitiaSpear = uData.unitType === 'militia' && uData.militiaWeapon === 'spear';
      const isMilitiaBow = uData.unitType === 'militia' && uData.militiaWeapon === 'bow';
      const isAkumaFeral = uData.unitType === 'raiders' && uData.raiderFaction === 'akuma';

      if (uData.unitType === 'valkyrie') {
        // Sky Strike dive: swoop down from hover height to ground level
        // for the strike (peaking at the midpoint of the swing) and back
        // up to VALKYRIE_HOVER_HEIGHT by the end, with a sword swing
        // timed to land right at the bottom of the dive.
        const dive = Math.sin(p * Math.PI); // 0 -> 1 -> 0 over the swing
        unit.position.y = VALKYRIE_HOVER_HEIGHT * (1 - dive);
        uData.body.rotation.x = 0.3 + dive * 0.5;
        const swing = Math.sin(Math.min(1, p * 1.6) * Math.PI);
        uData.armR.rotation.x = -Math.PI / 4 - swing * 0.9;
        uData.armR.rotation.z = -swing * 0.2;
        uData.armL.rotation.x = -Math.PI / 6 - swing * 0.2;
      }
      else if (uData.unitType === 'chakramDancers') {
        // Two-phase whirling dervish strike: a quick crouching wind-up
        // that pulls both rings crossed in tight over the chest, then an
        // explosive release into a full one-and-a-half pirouette that
        // rises briefly onto its toes at the peak and snaps both arms
        // out into a wide, fully-extended fling - a punchier, more
        // acrobatic read than a plain single-turn swing.
        const windup = Math.min(1, p / 0.25); // 0 -> 1 over the first quarter of the swing
        const release = Math.max(0, Math.min(1, (p - 0.25) / 0.75)); // 0 -> 1 over the rest
        const releaseEase = Math.sin(release * Math.PI / 2); // fast snap out of the coil, soft finish
        const rise = Math.sin(release * Math.PI); // 0 -> 1 -> 0 across the release, peaking mid-spin

        // Wind-up: crouch down with both rings crossed in tight over the
        // chest and elbows bent, coiling for the release. The hop at the
        // peak of the release (rise) is applied on top of the same
        // baseline offset the idle/walk poses use, and mirrored onto the
        // head so the neck doesn't stretch.
        const bodyY = 0.525 - windup * 0.08 + rise * 0.12;
        uData.body.position.y = bodyY;
        uData.head.position.y = 0.9 - windup * 0.08 + rise * 0.12;
        uData.body.rotation.x = windup * 0.2 * (1 - releaseEase);
        uData.body.rotation.y = release * Math.PI * 3; // one-and-a-half full turns

        const coilX = -Math.PI / 3, coilZ = 0.7; // arms crossed in tight
        const flingX = -Math.PI / 6, flingZ = 1.3; // arms snapped wide open
        const armX = coilX + (flingX - coilX) * releaseEase;
        const armZ = coilZ + (flingZ - coilZ) * releaseEase;
        uData.armR.rotation.x = armX;
        uData.armR.rotation.z = -armZ;
        uData.armL.rotation.x = armX;
        uData.armL.rotation.z = armZ;
        const elbowBend = 0.7 * windup * (1 - releaseEase);
        if (uData.armRElbow) uData.armRElbow.rotation.x = elbowBend;
        if (uData.armLElbow) uData.armLElbow.rotation.x = elbowBend;

        // Both rings spin far faster through the release than the
        // wind-up, selling the sudden burst of the strike itself.
        uData.weaponMesh && (uData.weaponMesh.rotation.z = p * Math.PI * 16);
        uData.offhandChakramMesh && (uData.offhandChakramMesh.rotation.z = -p * Math.PI * 16);
      }
      else if (uData.unitType === 'kitsuneTwinblade' && uData.kitsuneRole === 'blade') {
        // Ember Fang's Quickdraw - now uses the exact same kesa-giri
        // draw-cut animation as the Dragon Ronin's own attack (see the
        // 'dragonRonin' branch above): a grounded jodan (overhead,
        // blade-up) guard that unloads into ONE committed diagonal cut,
        // shoulder to opposite hip, driven by a hard forward step
        // (fumikomi) and hip rotation, replacing her old low
        // near-sheathed Vergil-style quickdraw guard. The ember-fire
        // slash FX below are unchanged and still themed to "Ember Fang".
        if (uData.weaponMesh) {
          uData.weaponMesh.visible = true;
          uData.weaponMesh.rotation.x = Math.PI / 2;
          uData.weaponMesh.rotation.z = 0;
        }
        if (uData.sheathMesh) uData.sheathMesh.visible = false;
        const windUp = Math.min(p / 0.25, 1);
        const releaseT = p <= 0.25 ? 0 : Math.min((p - 0.25) / 0.5, 1);
        const release = Math.pow(releaseT, 0.5);
        const recover = p <= 0.85 ? 0 : (p - 0.85) / 0.15;

        // Fumikomi step: weight loads back onto the rear (left) leg as
        // the blade lifts into guard, then stamps forward hard onto the
        // front (right) leg through the cut - a real step-through lunge
        // instead of both legs crouching evenly in place.
        uData.legR.rotation.x = -0.3 * windUp + 0.55 * release - 0.15 * recover;
        if (uData.legRKnee) uData.legRKnee.rotation.x = 0.3 * windUp + 0.35 * release;
        uData.legL.rotation.x = 0.15 * windUp - 0.35 * release;
        if (uData.legLKnee) uData.legLKnee.rotation.x = 0.15 * windUp + 0.1 * release;

        // Jodan-no-kamae: blade raised straight overhead, both hands on
        // the hilt, elbows tucked in tight - then a single downward
        // diagonal cut (kesa-giri) rather than a wide sweeping arc.
        uData.armR.rotation.x = -Math.PI / 6 - windUp * 2.3 + release * 2.6;
        uData.armR.rotation.z = -windUp * 0.1 + release * 0.55;
        uData.armL.rotation.x = -Math.PI / 6 - windUp * 2.1 + release * 2.4;
        uData.armL.rotation.z = windUp * 0.05 - release * 0.3;
        if (uData.armRElbow) uData.armRElbow.rotation.x = Math.max(-0.05, 0.5 * windUp - release * 0.4 + recover * 0.2);
        if (uData.armLElbow) uData.armLElbow.rotation.x = Math.max(-0.05, 0.45 * windUp - release * 0.35 + recover * 0.2);

        // Hips lead the cut with a sharp but modest rotation - real
        // power comes from the step and hip torque, not a full spin.
        uData.body.rotation.y = windUp * 0.1 - release * 0.45 + recover * 0.15;
        uData.body.rotation.x = 0.08 + windUp * 0.05 + release * 0.18;

        // Zanshin: the head holds a brief, low finishing pose after the
        // cut lands instead of snapping straight back to neutral.
        uData.head.rotation.x = 0.05 + release * 0.1;
        uData.head.rotation.y = 0;

        if (uData.kitsuneTail) uData.kitsuneTail.rotation.z = Math.sin(release * Math.PI) * 0.6;

        // Judgment-cut style flash: three thin, near-simultaneous ember-
        // fire slash-lines fan out along the cut instead of a single
        // spray of sparks - a white-hot core streaking to deep orange-red
        // at the edges, true to "Ember Fang" - fires exactly once per
        // swing (reset the instant the next wind-up begins) rather than
        // every frame.
        if (windUp < 0.05) uData.kitsuneSlashFxDone = false;
        if (release > 0.9 && !uData.kitsuneSlashFxDone) {
          uData.kitsuneSlashFxDone = true;
          const flashPos = new THREE.Vector3();
          unit.getWorldPosition(flashPos);
          flashPos.y += 0.85;
          for (let line = 0; line < 3; line++) {
            const angle = (-0.35 + line * 0.35) + Math.PI * 0.5;
            for (let i = 0; i < 5; i++) {
              const t = (i / 4 - 0.5) * 0.9;
              spawnParticle(
                flashPos.clone().add(new THREE.Vector3(Math.cos(angle) * t, Math.sin(angle) * t * 0.4, (Math.random() - 0.5) * 0.15)),
                i === 2 ? 0xfff2c2 : (Math.random() < 0.5 ? 0xff7a1a : 0xd9280f), 0.03 + Math.random() * 0.03, 0.18 + Math.random() * 0.1
              );
            }
          }
          // A bright glowing crescent streak across the cut itself, on top
          // of the ember particle fan above - reads as an actual slash
          // in the air rather than just sparks, true to a fast katana cut.
          // facingDir turns the arc to match the direction this unit is
          // actually facing (set to aim at its target in processUnitAttack)
          // instead of always landing in the same fixed orientation.
          const emberFacingDir = new THREE.Vector3(0, 0, 1).applyQuaternion(unit.getWorldQuaternion(new THREE.Quaternion()));
          spawnSlashArc(flashPos, { color: 0xff5a1a, coreColor: 0xfff2c2, radius: 0.85, arcSpan: Math.PI * 0.6, rotationZ: -0.6, duration: 0.22, facingDir: emberFacingDir });
        }

        // Ember afterimage trail - a few small streaking motes flick off
        // the blade continuously through the cut, not just the one-shot
        // fan above at the very end - reads as the blade cutting fast
        // enough to blur rather than simply rotating from A to B.
        // Throttled to roughly every other frame (Math.random() < 0.55)
        // so a sustained swing doesn't flood the particle system.
        if (release > 0.08 && release < 0.95 && Math.random() < 0.55) {
          const trailPos = new THREE.Vector3();
          unit.getWorldPosition(trailPos);
          trailPos.y += 0.85 + (release - 0.5) * 0.3;
          const trailAngle = Math.PI * 0.5 - 0.3 + release * 0.6;
          trailPos.x += Math.cos(trailAngle) * 0.35;
          trailPos.z += Math.sin(trailAngle) * 0.36;
          spawnParticle(trailPos, Math.random() < 0.4 ? 0xfff2c2 : 0xff7a1a, 0.022 + Math.random() * 0.018, 0.12 + Math.random() * 0.06);
        }
      }
      else if (uData.unitType === 'kitsuneTwinblade' && uData.kitsuneRole === 'spear') {
        // Frost Warden's Guard the Flank - now uses the exact same plain
        // spear thrust as a normal Spearman (see the 'pikes'/isRaiderSpear/
        // isCavalrySpear/isMilitiaSpear branch below), replacing her old
        // wide two-handed Raiden Shogun-style naginata sweep. The frost-
        // themed ice-shard burst and afterimage trail below are unchanged
        // and still fire off this simpler thrust motion.
        const thrust = Math.sin(p * Math.PI);
        uData.armR.rotation.x = -Math.PI / 4 - thrust * 0.6;
        if (!uData.hasShield) uData.armL.rotation.x = -Math.PI / 3 - thrust * 0.6;

        // Frost shatter: sharp white-and-pale-cyan ice shards burst off
        // the blade in a small jagged cluster right as the thrust lands,
        // reading as a crackling frost discharge rather than a soft mist
        // - fires exactly once per swing (reset the instant the next
        // wind-up begins) rather than every frame.
        if (thrust < 0.05) uData.kitsuneSlashFxDone = false;
        if (thrust > 0.9 && !uData.kitsuneSlashFxDone) {
          uData.kitsuneSlashFxDone = true;
          const tipPos = new THREE.Vector3();
          unit.getWorldPosition(tipPos);
          tipPos.y += 0.9;
          for (let i = 0; i < 9; i++) {
            spawnParticle(
              tipPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3, 0.25 + Math.random() * 0.35)),
              i % 3 === 0 ? 0xffffff : 0xaeeaff, 0.03 + Math.random() * 0.045, 0.2 + Math.random() * 0.15
            );
          }
          // A wide glowing crescent streak across the thrust, on top of
          // the ice-shard burst above - reads as an actual frost-blue
          // slash arc in the air, not just a shower of sparks.
          // facingDir turns the arc to match the direction this unit is
          // actually facing (set to aim at its target in processUnitAttack)
          // instead of always landing in the same fixed orientation.
          const frostFacingDir = new THREE.Vector3(0, 0, 1).applyQuaternion(unit.getWorldQuaternion(new THREE.Quaternion()));
          spawnSlashArc(tipPos, { color: 0xaeeaff, coreColor: 0xffffff, radius: 0.95, arcSpan: Math.PI * 1.1, rotationZ: 0.15, duration: 0.24, facingDir: frostFacingDir });
        }

        // Frost afterimage trail - a thin trace of pale motes follows the
        // spear tip through the thrust, not just the one-shot shatter
        // above at impact. Throttled to roughly every other frame
        // (Math.random() < 0.5) so a sustained swing doesn't flood the
        // particle system.
        if (thrust > 0.08 && thrust < 0.95 && Math.random() < 0.5) {
          const trailPos = new THREE.Vector3();
          unit.getWorldPosition(trailPos);
          trailPos.y += 0.9;
          trailPos.z += 0.3 + thrust * 0.35;
          spawnParticle(trailPos, Math.random() < 0.5 ? 0xffffff : 0xaeeaff, 0.02 + Math.random() * 0.02, 0.14 + Math.random() * 0.06);
        }
      }
      else if (uData.attackAnimPoseOverride === 'spearThrow') {
        // One-off javelin throw pose for a Spear raider mid-rearm - by the
        // time this pose is applied the weapon has already been swapped
        // to an Axe/Sword, so this override keeps the throw reading as a
        // throw instead of falling through to the sword-swing pose below.
        const thrust = Math.sin(p * Math.PI);
        uData.armR.rotation.x = -Math.PI / 4 - thrust * 0.6;
        uData.armL.rotation.x = -Math.PI / 3 - thrust * 0.6;
      }
      else if (uData.attackAnimPoseOverride === 'bombThrow') {
        // Wokou Bomb Throw - a two-handed overhand lob: both arms hoist up
        // and swing forward and down together, distinct from the sideways
        // sword-swing/javelin-thrust poses so tossing the bomb reads as its
        // own action.
        const toss = Math.sin(p * Math.PI);
        uData.armR.rotation.x = -Math.PI / 1.6 - toss * 0.9;
        uData.armR.rotation.z = -toss * 0.3;
        uData.armL.rotation.x = -Math.PI / 2.2 - toss * 0.5;
      }
      else if (uData.attackAnimPoseOverride === 'axeThrow') {
        // Wolf Warrior Axe Throw - the same two-handed overhand hurl as
        // the Wokou Bomb Throw pose above, since it's the whole two-handed
        // Double Axe being tossed rather than swung/stabbed - see the
        // isWolfWarriorRaider branch in processUnitAttack.
        const toss = Math.sin(p * Math.PI);
        uData.armR.rotation.x = -Math.PI / 1.6 - toss * 0.9;
        uData.armR.rotation.z = -toss * 0.3;
        uData.armL.rotation.x = -Math.PI / 2.2 - toss * 0.5;
      }
      else if (uData.attackAnimPoseOverride === 'drinkPotion') {
        // Second Wind: the flask (uData.potionMesh, made visible by
        // maybeTriggerDragonSecondWind) is raised in the off hand up to
        // the mouth, tipped back for a beat, then lowered again - a
        // simple three-part drink rather than a swing/thrust, using its
        // own much longer, slower timing (DRAGON_SECOND_WIND_DRINK_DURATION)
        // instead of the fast attack-swing curve.
        if (uData.weaponMesh) uData.weaponMesh.visible = false;
        if (uData.sheathMesh) uData.sheathMesh.visible = true;

        // Raise through the first third, hold the drink through the
        // middle third, lower back down through the last third.
        const raise = p < 0.3 ? Math.pow(p / 0.3, 0.5) : (p < 0.75 ? 1 : Math.max(0, 1 - (p - 0.75) / 0.25));

        // Off hand lifts the flask straight up to the mouth; sword hand
        // stays loose at the side rather than gripping a weapon.
        uData.armL.rotation.set(-2.3 * raise, 0.15, 0.1);
        uData.armLElbow.rotation.x = 1.5 * raise;
        uData.armR.rotation.set(-0.1 * raise, 0, -0.05);
        uData.armRElbow.rotation.x = 0;

        // Head tips back to drink, then settles back level as it lowers.
        uData.head.rotation.x = -0.35 * raise;
        uData.body.rotation.x = 0.05 * raise;
        uData.body.rotation.y = 0;

        if (uData.potionMesh) uData.potionMesh.visible = raise > 0.02;
      }
      else if (uData.attackAnimPoseOverride === 'swordDash') {
        // Sword Dash: a single explosive flash-step lunge/thrust rather
        // than the normal Spinning Slash's big overhead wind-up-and-cut
        // - the blade snaps straight out of its sheath and the whole
        // stance drives forward fast, front leg planting deep and back
        // leg kicking out straight behind, selling one burst of speed
        // instead of a windup swing. See triggerDragonSwordDash for the
        // streak particles/flame/guaranteed-kill layered on top.
        if (uData.weaponMesh) {
          uData.weaponMesh.visible = true;
          uData.weaponMesh.rotation.x = Math.PI / 2;
          uData.weaponMesh.rotation.z = 0;
        }
        if (uData.sheathMesh) uData.sheathMesh.visible = false;

        // Near-instant snap out, a short hold at full extension, then
        // easing back through the recovery - much faster than the
        // normal swing's wind-up/release/recover split.
        const snap = p < 0.3 ? Math.pow(p / 0.3, 0.4) : (p < 0.65 ? 1 : Math.max(0, 1 - (p - 0.65) / 0.35));

        // Deep forward lunge - front (right) leg drives low and bent,
        // back (left) leg kicks straight out behind for the reach.
        uData.legR.rotation.x = -0.85 * snap;
        uData.legL.rotation.x = 0.55 * snap;
        uData.legRKnee.rotation.x = 0.7 * snap;
        uData.legLKnee.rotation.x = 0.1 * snap;

        uData.body.rotation.x = 0.5 * snap;
        uData.body.rotation.y = 0;
        uData.head.rotation.x = 0.2 * snap;

        // Both arms punch the blade straight out in one thrust rather
        // than the wide overhead arc of a normal cut.
        uData.armR.rotation.set(-1.5 * snap, 0.1, -0.1);
        uData.armL.rotation.set(-1.3 * snap, -0.1, 0.15);
        uData.armRElbow.rotation.x = 0.15 * snap;
        uData.armLElbow.rotation.x = 0.2 * snap;
      }
      else if (uData.attackAnimPoseOverride === 'steelGrasp') {
        // Steel Grasp cast - unlike the two-handed Overhead Smash below,
        // only the left (off) hand does anything here: it thrusts out
        // and down toward the claw zone, clawed fingers spread, while
        // the right arm stays low bracing the mace's weight rather than
        // winding up for a swing - reads as a one-handed claw cast
        // rather than another haymaker. See triggerSteelRevenantSteelGrasp
        // for the zone/claw-hand FX this pose is timed against.
        if (uData.weaponMesh) uData.weaponMesh.rotation.set(0, 0, 0);

        // Reach out through the first third, hold/channel through the
        // middle third while the pull actually lands, ease back to rest
        // through the last third.
        const reach = p < 0.3 ? Math.pow(p / 0.3, 0.5) : (p < 0.7 ? 1 : Math.max(0, 1 - (p - 0.7) / 0.3));
        const channeling = p >= 0.3 && p < 0.75;

        uData.armL.rotation.x = -Math.PI / 2.8 - reach * 0.55;
        uData.armL.rotation.y = -Math.PI / 8 - reach * 0.35;
        uData.armL.rotation.z = reach * 0.15;
        uData.armLElbow.rotation.x = 0.25 * reach;
        uData.handL.rotation.x = -reach * 0.3;

        // Right arm/mace stays braced low rather than winding up for a
        // swing of its own.
        uData.armR.rotation.x = -Math.PI / 2.6 + reach * 0.15;
        uData.armR.rotation.y = -Math.PI / 6;
        uData.armRElbow.rotation.x = 0.1 * reach;

        uData.body.rotation.x = 0.08 * reach;
        uData.body.rotation.y = -reach * 0.12;
        uData.head.rotation.x = 0.1 * reach;
        uData.head.rotation.y = -reach * 0.1;

        // A slight braced stance shift rather than a lunge - the pull
        // comes from the claw zone, not from closing distance itself.
        uData.legL.rotation.x = 0.06 * reach;
        uData.legR.rotation.x = -0.04 * reach;
        uData.legLKnee.rotation.x = 0.1 * reach;
        uData.legRKnee.rotation.x = 0.05 * reach;

        // Hand-glow flares as the claw reaches out, pulses fast while
        // channeling the pull, and fades out through the release - see
        // createSteelGraspGlowMesh.
        if (uData.graspGlowMesh) {
          const pulse = channeling ? (0.75 + Math.sin(p * 60) * 0.25) : 1;
          const fade = p < 0.75 ? reach : Math.max(0, 1 - (p - 0.75) / 0.25);
          uData.graspGlowMesh.userData.mats.forEach(m => m.opacity = 0.9 * fade * pulse);
          const glowScale = 0.8 + reach * 0.6 + (channeling ? Math.sin(p * 60) * 0.15 : 0);
          uData.graspGlowMesh.scale.setScalar(Math.max(0.1, glowScale));
        }
      }
      else if (uData.attackAnimPoseOverride === 'unbreakable') {
        // Unbreakable cast - the mace hangs loose in the right hand
        // (bracing low rather than swinging) while the left hand lets go
        // of its offhand grip, crosses the body, and presses flat
        // against the chest as the armor knits itself back together -
        // see maybeTriggerSteelRevenantUnbreakable for the trigger and
        // heal this pose is timed against.
        if (uData.weaponMesh) uData.weaponMesh.rotation.set(0, 0, 0);
        if (uData.offhandGripMesh) uData.offhandGripMesh.visible = false;

        // Cross through the first quarter to bring the hand up onto the
        // chest, hold it pressed there through the long middle stretch
        // while the heal actually lands, then let it drop back through
        // the last quarter.
        const press = p < 0.25 ? Math.pow(p / 0.25, 0.5) : (p < 0.8 ? 1 : Math.max(0, 1 - (p - 0.8) / 0.2));
        const channeling = p >= 0.25 && p < 0.8;

        // Elbow bends sharply to bring the palm to the sternum, arm
        // rotated inward across the body rather than out to the side.
        uData.armL.rotation.x = -Math.PI / 2.1 - press * 0.35;
        uData.armL.rotation.y = -Math.PI / 10 + press * 0.55;
        uData.armL.rotation.z = press * 0.1;
        uData.armLElbow.rotation.x = 1.35 * press;
        uData.handL.rotation.x = -press * 0.2;

        // Right arm/mace stays low and still, braced rather than
        // winding up - this is a heal, not an attack.
        uData.armR.rotation.x = -Math.PI / 2.5;
        uData.armR.rotation.y = -Math.PI / 8;
        uData.armRElbow.rotation.x = 0.1;

        // A slow, steady inward breath rather than any lunge or flinch -
        // head bows slightly toward the healing hand.
        uData.body.rotation.x = 0.05 * press;
        uData.body.rotation.y = press * 0.08;
        uData.head.rotation.x = 0.12 * press;
        uData.head.rotation.y = press * 0.1;

        // Chest-glow flares as the hand presses in, pulses steadily
        // while channeling the heal, and fades out through the release -
        // see createUnbreakableGlowMesh.
        if (uData.unbreakableGlowMesh) {
          const pulse = channeling ? (0.7 + Math.sin(p * 22) * 0.3) : 1;
          const fade = p < 0.8 ? press : Math.max(0, 1 - (p - 0.8) / 0.2);
          uData.unbreakableGlowMesh.userData.mats.forEach(m => m.opacity = 0.85 * fade * pulse);
          const glowScale = 0.6 + press * 1.1 + (channeling ? Math.sin(p * 22) * 0.2 : 0);
          uData.unbreakableGlowMesh.scale.setScalar(Math.max(0.1, glowScale));
          if (uData.unbreakableGlowMesh.userData.ring) uData.unbreakableGlowMesh.userData.ring.rotation.z = p * 4;
        }
      }
      else if (uData.unitType === 'swords' || isCavalrySword || isMilitiaSword || (uData.unitType === 'raiders' && !isRaiderSpear && !isRaiderBow && !isAkumaFeral && !isRaiderAcolyte && !isRaiderGargoyle)) {
        const swing = Math.sin(p * Math.PI);
        uData.armR.rotation.x = -Math.PI / 3 - swing * 1.2;
        uData.armR.rotation.y = swing * 0.5;
        uData.armR.rotation.z = -swing * 0.4;
      }
      else if (uData.unitType === 'goddessOfDeath') {
        // Reaping swing: the scythe is hauled up and back, then chopped
        // forward and down in a wide arc. Reaper's Sweep uses the same
        // motion, bigger, with the scythe swelling through the cut.
        // Plain single-pivot limbs (no elbows) - see createGoddessOfDeathHumanoid.
        const sweep = uData.attackAnimPoseOverride === 'reaperSweep';
        const windUp = Math.min(p / 0.4, 1);
        const releaseT = p <= 0.4 ? 0 : Math.min((p - 0.4) / 0.35, 1);
        const release = Math.pow(releaseT, 0.55);
        const recover = p <= 0.75 ? 0 : (p - 0.75) / 0.25;

        uData.armR.rotation.x = -0.35 - 1.85 * windUp + 1.5 * release + 0.35 * recover;
        uData.armR.rotation.y = 0;
        uData.armR.rotation.z = -0.06 - 0.15 * windUp + 0.3 * release - 0.09 * recover;
        uData.armL.rotation.x = -0.15 - 1.2 * windUp + 1.0 * release + 0.35 * recover;
        uData.armL.rotation.y = 0;
        uData.armL.rotation.z = 0.12 + 0.4 * windUp - 0.4 * release - 0.12 * recover;
        uData.handR.rotation.x = -0.35 * windUp + 0.85 * release - 0.5 * recover;
        uData.body.rotation.x = -0.12 * windUp + 0.42 * release - 0.3 * recover;
        uData.body.rotation.y = 0.3 * windUp - 0.6 * release + 0.3 * recover;
        uData.head.rotation.x = -0.1 * windUp + 0.3 * release - 0.2 * recover;
        uData.head.rotation.y = 0;
        uData.legR.rotation.x = 0.1 * windUp - 0.55 * release + 0.45 * recover;
        uData.legL.rotation.x = -0.1 * windUp + 0.35 * release - 0.25 * recover;

        if (uData.weaponMesh) {
          uData.weaponMesh.visible = true;
          uData.weaponMesh.rotation.x = GODDESS_SCYTHE_REST_TILT;
          uData.weaponMesh.scale.setScalar(sweep ? 1 + Math.max(0, 0.35 * release - 0.35 * recover) : 1);
        }
      }
      else if (uData.unitType === 'goddessOfLife') {
        if (uData.attackAnimPoseOverride === 'moonBless') {
          // Blessing gesture: both arms lift skyward, head tilted up, the
          // staff held aloft, then everything settles back down.
          const lift = Math.sin(Math.min(1, p * 1.25) * Math.PI * 0.5) * (p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3);
          uData.armR.rotation.x = -0.35 - 2.0 * lift;
          uData.armR.rotation.y = 0;
          uData.armR.rotation.z = -0.06 - 0.5 * lift;
          uData.armL.rotation.x = -0.15 - 2.2 * lift;
          uData.armL.rotation.y = 0;
          uData.armL.rotation.z = 0.12 + 0.55 * lift;
          uData.handR.rotation.x = 0;
          uData.body.rotation.x = -0.1 * lift;
          uData.body.rotation.y = 0;
          uData.head.rotation.x = -0.25 * lift;
          uData.head.rotation.y = 0;
          uData.legR.rotation.x = 0;
          uData.legL.rotation.x = 0;
          if (uData.weaponMesh) {
            uData.weaponMesh.visible = true;
            uData.weaponMesh.rotation.x = GOLIFE_STAFF_REST_TILT;
            uData.weaponMesh.scale.setScalar(1);
          }
        } else {
          // Staff swing: the moon staff is lifted up and back, then brought
          // down and forward in a graceful arc.
          const windUp = Math.min(p / 0.4, 1);
          const releaseT = p <= 0.4 ? 0 : Math.min((p - 0.4) / 0.35, 1);
          const release = Math.pow(releaseT, 0.55);
          const recover = p <= 0.75 ? 0 : (p - 0.75) / 0.25;

          uData.armR.rotation.x = -0.35 - 1.7 * windUp + 1.4 * release + 0.32 * recover;
          uData.armR.rotation.y = 0;
          uData.armR.rotation.z = -0.06 - 0.12 * windUp + 0.24 * release - 0.06 * recover;
          uData.armL.rotation.x = -0.15 - 0.9 * windUp + 0.8 * release + 0.25 * recover;
          uData.armL.rotation.y = 0;
          uData.armL.rotation.z = 0.12 + 0.3 * windUp - 0.3 * release - 0.12 * recover;
          uData.handR.rotation.x = -0.3 * windUp + 0.7 * release - 0.4 * recover;
          uData.body.rotation.x = -0.1 * windUp + 0.34 * release - 0.24 * recover;
          uData.body.rotation.y = 0.22 * windUp - 0.44 * release + 0.22 * recover;
          uData.head.rotation.x = -0.08 * windUp + 0.22 * release - 0.14 * recover;
          uData.head.rotation.y = 0;
          uData.legR.rotation.x = 0.08 * windUp - 0.4 * release + 0.32 * recover;
          uData.legL.rotation.x = -0.08 * windUp + 0.25 * release - 0.17 * recover;
          if (uData.weaponMesh) {
            uData.weaponMesh.visible = true;
            uData.weaponMesh.rotation.x = GOLIFE_STAFF_REST_TILT;
            uData.weaponMesh.scale.setScalar(1);
          }
        }
      }
      else if (uData.unitType === 'steelRevenant') {
        // Overhead Smash: a slow, two-handed haymaker rather than the
        // generic one-armed sword swing above - a heavy overhead
        // wind-up on both arms, a deep knee-bend load, then a driving
        // downward crash with the whole frame lurching into it. Uses
        // the elbow/knee/wrist joints the plain sword-swing pose never
        // touches, so a weapon this size actually reads as heavy.
        if (uData.weaponMesh) uData.weaponMesh.rotation.set(0, 0, 0);

        // Slow wind-up (40%), a driving release (next 40%), a short
        // settle (last 20%) - weighted toward the wind-up/release since
        // a weapon this heavy telegraphs before it swings.
        const windUp = Math.min(p / 0.4, 1);
        const releaseT = p <= 0.4 ? 0 : Math.min((p - 0.4) / 0.4, 1);
        const release = Math.pow(releaseT, 0.6);
        const recover = p <= 0.8 ? 0 : (p - 0.8) / 0.2;

        // Both arms haul the mace up and back overhead, elbows bending
        // to cock it, then drive down and extend straight through the
        // crash - the elbow's flex-then-extend is what sells the power
        // transfer that a single arm rotation alone can't.
        uData.armR.rotation.x = -Math.PI / 5 - windUp * 1.9 + release * 2.5;
        uData.armR.rotation.y = -Math.PI / 14 - windUp * 0.1 + release * 0.15;
        // Left arm now follows through further down through the crash
        // (release coefficient raised from 2.3 to 2.7) so it swings down
        // in step with the right arm instead of stopping short near
        // horizontal.
        uData.armL.rotation.x = -Math.PI / 6 - windUp * 1.7 + release * 2.7;
        uData.armL.rotation.y = Math.PI / 10 + windUp * 0.1 - release * 0.15;
        uData.armRElbow.rotation.x = Math.max(0, 0.65 * windUp - release * 0.55 + recover * 0.15);
        uData.armLElbow.rotation.x = Math.max(0, 0.55 * windUp - release * 0.5 + recover * 0.15);

        // A small wrist snap through the crash itself, easing back out
        // on the recovery.
        uData.handR.rotation.x = release * 0.3 - recover * 0.12;
        uData.handL.rotation.x = release * 0.25 - recover * 0.1;

        // Deep knee-bend load on both legs through the wind-up, then a
        // driving half-extension through the release like the weight is
        // being thrown down into the ground - not a normal walking
        // knee-drive, a braced two-footed crash.
        uData.legR.rotation.x = 0.12 * windUp - 0.4 * release + 0.08 * recover;
        uData.legL.rotation.x = -0.08 * windUp + 0.25 * release - 0.05 * recover;
        uData.legRKnee.rotation.x = 0.55 * windUp + 0.15 * release;
        uData.legLKnee.rotation.x = 0.35 * windUp + 0.4 * release;

        // The torso rocks back to load the swing, then lurches forward
        // and down into the crash, head following it down.
        uData.body.rotation.x = -0.15 * windUp + 0.55 * release - 0.1 * recover;
        uData.body.rotation.y = 0;
        uData.head.rotation.x = -0.1 * windUp + 0.35 * release;

        // Death Slam - the mace visibly swells as it drives through the
        // crash, peaking right at the moment of impact (release hits 1),
        // then eases back down to its normal size through the recovery -
        // sells the weight of the hit beyond what the arm-swing alone
        // can convey. Only a Death Slam sets the 'deathSlam' override
        // (see triggerSteelRevenantDeathSlam), so a normal swing never
        // touches the mace's scale, and any leftover scale from a Slam
        // is explicitly reset back to 1 here so it can never bleed into
        // the next ordinary swing.
        if (uData.weaponMesh) {
          if (uData.attackAnimPoseOverride === 'deathSlam') {
            const growth = 0.6 * release;   // swells up to +60% size through the crash
            const shrink = 0.6 * recover;   // and eases back down through the recovery
            uData.weaponMesh.scale.setScalar(1 + Math.max(0, growth - shrink));
          } else {
            uData.weaponMesh.scale.setScalar(1);
          }
        }
      }
      else if (uData.unitType === 'dragonRonin') {
        // Kesa-giri draw cut: a grounded jodan (overhead, blade-up)
        // guard that unloads into ONE committed diagonal cut - shoulder
        // to opposite hip - driven by a hard forward step (fumikomi)
        // and hip rotation, the way a real kenjutsu/iaido strike works,
        // rather than a wide anime-style full-body spin with a hop.
        // Weight is grounded and asymmetric front-to-back (a lunge),
        // not an even two-legged crouch/jump.
        if (uData.weaponMesh) {
          uData.weaponMesh.visible = true;
          // Sword Rest idle tilts the katana to a resting diagonal (see
          // the ready-stance branch in updateUnitAnims) - snap it back to
          // the normal swing orientation the instant an attack starts.
          uData.weaponMesh.rotation.x = Math.PI / 2;
          uData.weaponMesh.rotation.z = 0;
        }
        // The blade draws from the hip the instant it swings - hide the
        // sheathed idle prop in favor of the now-visible hand-held katana.
        if (uData.sheathMesh) uData.sheathMesh.visible = false;
        const windUp = Math.min(p / 0.25, 1);
        const releaseT = p <= 0.25 ? 0 : Math.min((p - 0.25) / 0.5, 1);
        const release = Math.pow(releaseT, 0.5);
        const recover = p <= 0.85 ? 0 : (p - 0.85) / 0.15;

        // Fumikomi step: weight loads back onto the rear (left) leg as
        // the blade lifts into guard, then stamps forward hard onto the
        // front (right) leg through the cut - a real step-through lunge
        // instead of both legs crouching evenly in place.
        uData.legR.rotation.x = -0.3 * windUp + 0.55 * release - 0.15 * recover;
        uData.legRKnee.rotation.x = 0.3 * windUp + 0.35 * release;
        uData.legL.rotation.x = 0.15 * windUp - 0.35 * release;
        uData.legLKnee.rotation.x = 0.15 * windUp + 0.1 * release;

        // Jodan-no-kamae: blade raised straight overhead, both hands on
        // the hilt, elbows tucked in tight - then a single downward
        // diagonal cut (kesa-giri) rather than a wide sweeping arc.
        uData.armR.rotation.x = -Math.PI / 6 - windUp * 2.3 + release * 2.6;
        uData.armR.rotation.z = -windUp * 0.1 + release * 0.55;
        uData.armL.rotation.x = -Math.PI / 6 - windUp * 2.1 + release * 2.4;
        uData.armL.rotation.z = windUp * 0.05 - release * 0.3;
        uData.armRElbow.rotation.x = Math.max(-0.05, 0.5 * windUp - release * 0.4 + recover * 0.2);
        uData.armLElbow.rotation.x = Math.max(-0.05, 0.45 * windUp - release * 0.35 + recover * 0.2);

        // Hips lead the cut with a sharp but modest rotation - real
        // power comes from the step and hip torque, not a full spin.
        uData.body.rotation.y = windUp * 0.1 - release * 0.45 + recover * 0.15;
        uData.body.rotation.x = 0.08 + windUp * 0.05 + release * 0.18;

        // Zanshin: the head and stance hold a brief, low finishing
        // pose after the cut lands instead of snapping straight back
        // to neutral - eyes fixed on the target through the follow-through.
        uData.head.rotation.x = 0.05 + release * 0.1;
      }
      else if (uData.unitType === 'paladins' || uData.unitType === 'eliteSwordsmen') {
        if (uData.isPaladinLeader) {
          // Leader - heavy two-handed overhead chop. Elbow-driven wind-up/
          // release (like Dragon Ronin's cut, but simpler/no draw-from-
          // sheath), a forward knee-drive step, and a wrist snap right at
          // the moment of impact to sell the follow-through pronating
          // through contact.
          const windUp = Math.min(p / 0.35, 1);
          const releaseT = p <= 0.35 ? 0 : Math.min((p - 0.35) / 0.45, 1);
          const release = Math.pow(releaseT, 0.6);
          const recover = p <= 0.85 ? 0 : (p - 0.85) / 0.15;

          // The idle shoulder-carry pose leaves a lateral twist on the
          // shoulder/wrist (see the idle 'paladins' branch below) that
          // the swing below doesn't otherwise touch - clear it so the
          // two-handed chop doesn't inherit an off-axis skew.
          uData.armR.rotation.y = 0;
          uData.armL.rotation.y = 0;
          uData.handR.rotation.z = 0;
          uData.handL.rotation.z = 0;

          uData.legR.rotation.x = -0.25 * windUp + 0.4 * release - 0.1 * recover;
          uData.legRKnee.rotation.x = 0.25 * windUp + 0.3 * release;
          uData.legL.rotation.x = 0.1 * windUp - 0.2 * release;
          uData.legLKnee.rotation.x = 0.1 * windUp + 0.05 * release;

          uData.armR.rotation.x = Math.PI / 6 + windUp * 1.9 - release * 2.3;
          uData.armR.rotation.z = windUp * 0.15 - release * 0.3;
          uData.armL.rotation.x = -Math.PI / 6 - windUp * 1.7 + release * 2.1;
          uData.armL.rotation.z = windUp * 0.1 - release * 0.2;
          uData.armRElbow.rotation.x = Math.max(0, 0.5 * windUp - release * 0.35 + recover * 0.25);
          uData.armLElbow.rotation.x = Math.max(0, 0.4 * windUp - release * 0.3 + recover * 0.2);

          // Wrist snap: the hand group doubles as the wrist joint (see
          // createJointedLimb/createBlockyHumanoid) - a quick flick layered
          // on top of the elbow/shoulder swing through the release phase.
          uData.handR.rotation.x = release * 0.5 - recover * 0.2;
          uData.handL.rotation.x = release * 0.4 - recover * 0.15;

          uData.body.rotation.x = 0.06 + windUp * 0.05 + release * 0.16;
          uData.body.rotation.y = windUp * 0.08 - release * 0.35 + recover * 0.1;
          uData.head.rotation.x = 0.04 + release * 0.08;
        } else {
          // Elite Swordsman - same quick horizontal slash silhouette as a
          // Swords unit, plus a real elbow bend through the swing and a
          // wrist snap at the moment of impact. Shield arm stays up
          // guarding rather than joining the swing.
          const swing = Math.sin(p * Math.PI);
          uData.armR.rotation.x = -Math.PI / 3 - swing * 1.2;
          uData.armR.rotation.y = swing * 0.5;
          uData.armR.rotation.z = -swing * 0.4;
          uData.armRElbow.rotation.x = Math.max(0, swing * 0.6);
          uData.handR.rotation.x = swing * 0.35;
        }
      }
      else if (uData.unitType === 'pikes' || isRaiderSpear || isCavalrySpear || isMilitiaSpear) {
        const thrust = Math.sin(p * Math.PI);
        uData.armR.rotation.x = -Math.PI / 4 - thrust * 0.6;
        if (!uData.hasShield) uData.armL.rotation.x = -Math.PI / 3 - thrust * 0.6; // shield arm stays up guarding instead of thrusting
      }
      else if (uData.unitType === 'archers' || uData.unitType === 'crossbow' || isCavalryBow || isRaiderBow || isMilitiaBow || (uData.unitType === 'warElephant' && uData.elephantRole === 'archer')) {
        // Bow arm holds the SAME angle as the ready-aim stance used at
        // rest/while walking - it previously jumped to a different,
        // more upward angle the instant the draw animation began (and
        // snapped back down when it ended), so the bow visibly flicked
        // up off the target with every single shot instead of staying
        // aimed where it's actually pointed. Only the string arm (armR)
        // animates, pulling back and releasing.
        const draw = Math.sin(p * Math.PI);
        uData.armL.rotation.set(ARCHER_READY_ARM_L.x, ARCHER_READY_ARM_L.y, ARCHER_READY_ARM_L.z);
        uData.armR.rotation.x = ARCHER_READY_ARM_R.x + draw * 0.3;
        uData.armR.rotation.z = ARCHER_READY_ARM_R.z - draw * 0.5;
      }
      else if (uData.unitType === 'mages' || uData.unitType === 'lich' || isRaiderAcolyte || isRaiderGargoyle) {
        const cast = Math.sin(p * Math.PI);
        uData.armR.rotation.x = -Math.PI / 2 - cast * 0.6;
        uData.armL.rotation.x = -Math.PI / 3 - cast * 0.4;
      }
      else if (isAkumaFeral) {
        // Feral Pounce - a full-body lunge rather than a weapon swing: no
        // held weapon, so both arms and the whole torso carry the motion.
        // Crouches back low, then springs forward with claws splayed.
        const crouch = Math.min(p / 0.35, 1);
        const springT = p <= 0.35 ? 0 : (p - 0.35) / 0.65;
        const spring = Math.pow(springT, 0.6);

        uData.body.rotation.x = 0.5 + crouch * 0.3 - spring * 1.0;
        uData.body.position.z = -crouch * 0.05 + spring * 0.22;
        uData.body.position.y = 0.525 - crouch * 0.1 + spring * 0.12;
        uData.head.rotation.x = 0.2 - spring * 0.5;

        uData.armL.rotation.x = -0.3 - crouch * 0.3 - spring * 1.0;
        uData.armR.rotation.x = -0.3 - crouch * 0.3 - spring * 1.0;
        uData.armL.rotation.z = 0.35 + spring * 0.3;
        uData.armR.rotation.z = -0.35 - spring * 0.3;

        uData.legL.rotation.x = 0.3 + crouch * 0.3 - spring * 0.5;
        uData.legR.rotation.x = 0.3 + crouch * 0.3 - spring * 0.5;
      }
      else if (uData.unitType === 'ninja') {
        // Shuriken throw - a fast low wind-up (arm cocked back behind
        // the hip) followed by a sharp snapping release across the
        // body, with a torso twist and a lunging front leg for
        // follow-through. Much quicker and snappier than a soldier's
        // slower weapon swing, matching the Ninja's speed theme.
        const windUp = Math.min(p / 0.3, 1);
        const releaseT = p <= 0.3 ? 0 : (p - 0.3) / 0.7;
        const release = Math.pow(releaseT, 0.6);

        uData.armR.rotation.x = -0.5 - windUp * 0.7 + release * 1.55;
        uData.armR.rotation.y = -windUp * 0.3 + release * 0.5;
        uData.armR.rotation.z = -release * 0.45;
        uData.armL.rotation.set(-0.5, 0.05, 0.15);

        uData.body.rotation.y = -windUp * 0.2 + release * 0.3;
        uData.body.rotation.x = 0.12 + release * 0.08;

        uData.legL.rotation.x = 0.18 + release * 0.22;
        uData.legR.rotation.x = 0.26 - release * 0.14;
      }
      else if (uData.unitType === 'slasher') {
        // Reverse-grip dagger stab - was previously unhandled here, so
        // the Slasher fell through this whole else-if chain with no
        // match at all. Since the idle 'slasher' branch in
        // updateUnitAnims only poses the arms while attackAnimTimer <= 0,
        // that left the dagger arm simply frozen in whatever rotation it
        // last held the instant an attack started, instead of actually
        // swinging - which is what read as the arm being stuck attached
        // backward / not swinging the right way. Drives the strike
        // forward and down from the same cocked windup angle as the idle
        // guard (rotation.x starts at -0.2, matching the idle branch)
        // rather than inverting it, so the stab reads as a continuation
        // of the stance instead of a reversed swing. Left arm holds its
        // guard position throughout - only the dagger hand drives the hit.
        const stab = Math.sin(p * Math.PI);
        uData.armR.rotation.x = -0.2 - stab * 1.6;
        uData.armR.rotation.z = -0.18 - stab * 0.15;
        uData.armRElbow.rotation.x = 0.4 - stab * 1.1;
        uData.armL.rotation.set(-0.45, 0, 0.18);
        uData.armLElbow.rotation.x = 0.15;
        uData.body.rotation.x = 0.3 + stab * 0.25;
        uData.body.rotation.y = -stab * 0.15;
      }
    }

    // --- 11. ANIMATION LOOP ---
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      // Update Controls & Camera
      controls.update();
      updateSquadArrows();

      // Paused: keep rendering (camera can still orbit) but freeze all
      // simulation - squads, raiders, combat, animations all stay put.
      if (gamePaused) {
        renderer.render(scene, camera);
        return;
      }

      try {
      // Update Squad Movement
      stepSquadMovement.currentDelta = delta;
      squads.forEach(squad => {
        // Event: Death attackers sail in first, then take orders on landing.
        if (squad.onBoat) updateBoatSailing(squad, delta);
        else stepSquadMovement(squad);
      });
      // Safety net: catches any player squad pushed into another by combat
      // knockback/charges rather than by normal movement (see function doc).
      resolvePlayerSquadOverlaps();
      raiderSquads.forEach(squad => {
        if (squad.onBoat) {
          updateBoatSailing(squad, delta);
        } else if (squad.isFleeing) {
          updateDesertBanditFleeAI(squad, delta);
          stepSquadMovement(squad);
        } else {
          updateRaiderAI(squad, delta);
          stepSquadMovement(squad);
        }
      });
      militiaSquads.forEach(squad => {
        updateMilitiaAI(squad, delta);
        stepSquadMovement(squad);
      });

      // Fixes units rendering as hovering/floating above the terrain -
      // see resyncStationarySquadGroundHeight's own doc comment above.
      resyncStationarySquadGroundHeight(squads);
      resyncStationarySquadGroundHeight(militiaSquads);
      resyncStationarySquadGroundHeight(raiderSquads);

      // Undertaker NPC - only active on islands with a Cemetery/Undertaker
      // House (updateUndertaker no-ops when undertaker is null); zombie
      // flames and House delivery glows are independent of it existing.
      updateUndertaker(delta);
      updateZombieFlames(time);
      updateHouseGlows(delta);
      updateDemonicPortals(time, delta);
      updateOrcFortress(delta);
      updateSquadsSiegingOrcFortress(delta);
      updateOrcFortressAssault();

      // Update Combat Logic & Ragdoll Physics
      updateCombatSystem(delta);

      // Goddess of Death - Soul Vessel possessions (host countdown, blast, revival)
      updateGoddessPossessions(delta, time);

      // Sink beached boats after they've sat stranded for a while
      updateStrandedBoats(delta, time);

      // Collapse any horses whose riders just took a killing blow
      updateFallingHorses(delta);

      // Run panic-fleeing horses toward random points, then home to the Barracks
      updateFleeingHorses(delta);

      // Villager NPC wandering / hiding
      updateVillagers(delta);
      // Landed raiders catching and killing exposed villagers/NPCs
      updateRaiderVsVillagers(delta);
      // Warbands that have picked the Watch Tower as their objective
      // (see findRaiderTarget) chipping away at it in melee/ranged range
      updateRaidersAttackingWatchTower(delta);
      updateRaidersAttackingCapturedFortress(delta);
      // Villagers are allowed to walk through/overlap each other freely -
      // resolveVillagerCollisions() (mutual push-apart) intentionally not called.

    // Unit Animation Updates (Walking / Idle / Attack Poses)
    const updateUnitAnims = (unit) => {
        const uData = unit.userData;
        if (uData.hp <= 0) return;

        // Angel spawn descent - glides down from ANGEL_DESCEND_HEIGHT into
        // its formation spot (set up in createDefenderSquad) trailing
        // white-gold light particles, then flashes on landing. Eases out
        // (fast at first, gentle at touchdown) rather than a straight
        // linear fall, and skips the normal idle/walk pose entirely while
        // it's still in the air.
        if (uData.descendTimer > 0) {
          uData.descendTimer = Math.max(0, uData.descendTimer - delta);
          const p = 1 - (uData.descendTimer / uData.descendDuration); // 0 -> 1
          const eased = 1 - Math.pow(1 - p, 3);
          unit.position.y = uData.descendFromY - (uData.descendFromY - uData.descendToY) * eased;
          // Wings-out glide pose + a light-trail particle a few times a
          // second while still descending.
          if (uData.armL && uData.armR) {
            uData.armL.rotation.set(-0.3, 0, 0.9);
            uData.armR.rotation.set(-0.3, 0, -0.9);
          }
          if (Math.random() < delta * 6) {
            const trailPos = new THREE.Vector3();
            unit.getWorldPosition(trailPos);
            spawnParticle(trailPos, Math.random() < 0.5 ? 0xfff2c4 : 0xffffff, 0.07 + Math.random() * 0.05, 0.35 + Math.random() * 0.15);
          }
          if (uData.descendTimer <= 0) {
            unit.position.y = uData.descendToY;
            const landPos = new THREE.Vector3();
            unit.getWorldPosition(landPos);
            landPos.y += 0.1;
            for (let i = 0; i < 10; i++) {
              spawnParticle(landPos.clone(), i % 2 === 0 ? 0xfff2c4 : 0xffffff, 0.09 + Math.random() * 0.06, 0.4 + Math.random() * 0.2);
            }
          }
          return;
        }

        if (uData.isMounted) {
          // Mounted militia keep a fixed riding pose - legs stay straddled
          // around the horse instead of running a walk cycle, with just a
          // light bob for the gait.
          uData.legL.rotation.set(-1.15, 0, 0.22);
          uData.legR.rotation.set(-1.15, 0, -0.22);
          const bob = uData.isWalking
            ? Math.sin(time * 10 + uData.idlePhase) * 0.03
            : Math.sin(time * 2 + uData.idlePhase) * 0.02;
          uData.body.position.y = 0.525 + bob;
          uData.head.position.y = 0.9 + bob;

          const isMountedBowUser = uData.unitType === 'archers' || (uData.unitType === 'cavalry' && uData.cavalryWeapon === 'bow') || (uData.unitType === 'militia' && uData.militiaWeapon === 'bow');
          if (isMountedBowUser && !uData.isWalking && uData.attackAnimTimer <= 0) {
            uData.armL.rotation.set(ARCHER_REST_ARM_L.x, ARCHER_REST_ARM_L.y, ARCHER_REST_ARM_L.z);
            uData.armR.rotation.set(ARCHER_REST_ARM_R.x, ARCHER_REST_ARM_R.y, ARCHER_REST_ARM_R.z);
          } else if (isMountedBowUser) {
            uData.armL.rotation.set(ARCHER_READY_ARM_L.x, ARCHER_READY_ARM_L.y, ARCHER_READY_ARM_L.z);
            uData.armR.rotation.set(ARCHER_READY_ARM_R.x, ARCHER_READY_ARM_R.y, ARCHER_READY_ARM_R.z);
          }

          if (uData.attackAnimTimer > 0) applyAttackPose(unit);
          return;
        }

        if (uData.unitType === 'raiders' && uData.isGargoyle) {
          // Gargoyle - flies rather than walks, same early-return shape
          // as the Valkyrie block below: wings flap from their own
          // pivots (createGargoyleHumanoid) instead of the wings being
          // dragged around as children of body, which is what made them
          // look disconnected from the back before. Altitude itself
          // comes from GARGOYLE_HOVER_HEIGHT applied at the squad's
          // group level (see the movement update in stepSquadMovement),
          // not here - this only drives the wingbeat/body-sway/leg-tuck
          // cosmetics.
          const flapSpeed = uData.isWalking ? 12 : 5;
          const flapPrimary = Math.sin(time * flapSpeed + uData.idlePhase);
          const flapSecondary = Math.sin(time * flapSpeed * 2 + uData.idlePhase) * 0.25;
          const flap = flapPrimary + flapSecondary;
          const flapAmt = uData.isWalking ? 0.65 : 0.35;
          if (uData.wingL) {
            uData.wingL.rotation.z = flap * flapAmt;
            uData.wingL.rotation.x = Math.max(0, flapPrimary) * 0.15;
          }
          if (uData.wingR) {
            uData.wingR.rotation.z = -flap * flapAmt;
            uData.wingR.rotation.x = Math.max(0, flapPrimary) * 0.15;
          }

          // Legs tucked up and trailing rather than striding, drifting
          // gently with the wingbeat since it never touches ground.
          const legDrift = flapPrimary * 0.05;
          uData.legL.rotation.set(-0.4 + legDrift, 0, 0.06);
          uData.legR.rotation.set(-0.4 + legDrift, 0, -0.06);

          const bob = Math.sin(time * (uData.isWalking ? 3 : 1.2) + uData.idlePhase) * (uData.isWalking ? 0.05 : 0.08) + flapPrimary * 0.02;
          uData.body.position.y = 0.525 + bob;
          uData.head.position.y = 0.9 + bob;
          // Keeps the permanent flight-crouch lean baked in at creation
          // (see createBlockyHumanoid's isGargoyle branch) rather than
          // letting it sit frozen - a little wingbeat-driven sway on top.
          uData.body.rotation.x = 0.18 + flapPrimary * 0.03;
          uData.head.rotation.x = 0.1;

          if (uData.armL && uData.attackAnimTimer <= 0) {
            uData.armL.rotation.x = -0.15 + Math.sin(time * 1.3 + uData.idlePhase) * 0.06;
          }
          if (uData.armR && uData.attackAnimTimer <= 0) {
            uData.armR.rotation.x = -0.15 + Math.sin(time * 1.3 + uData.idlePhase + Math.PI) * 0.06;
          }

          if (uData.attackAnimTimer > 0) applyAttackPose(unit);
          return;
        }

        if (uData.unitType === 'valkyrie') {
          // Flies rather than walks - handled as its own early-return
          // block (same shape as the isMounted case above) instead of
          // threading a flight case into every branch of the walking/idle
          // chains below, since almost nothing about a ground gait
          // applies to it: wings flap instead of arms swinging for
          // balance, and legs stay tucked rather than running a stride.
          // Flap is a blend of a fast primary beat and a slower secondary
          // wave (instead of one flat sine) so the stroke has a springier,
          // less mechanical down-up rhythm - a quick power stroke followed
          // by a softer recovery, the way a real wingbeat reads.
          const flapSpeed = uData.isWalking ? 14 : 6;
          const flapPrimary = Math.sin(time * flapSpeed + uData.idlePhase);
          const flapSecondary = Math.sin(time * flapSpeed * 2 + uData.idlePhase) * 0.25;
          const flap = flapPrimary + flapSecondary;
          const flapAmt = uData.isWalking ? 0.75 : 0.4;
          if (uData.wingL) {
            uData.wingL.rotation.z = flap * flapAmt;
            uData.wingL.rotation.x = -0.1 + Math.max(0, flapPrimary) * 0.18;
            // Slight tip flutter on the recovery stroke, opposite each wing.
            uData.wingL.rotation.y = Math.max(0, -flapPrimary) * 0.12;
          }
          if (uData.wingR) {
            uData.wingR.rotation.z = -flap * flapAmt;
            uData.wingR.rotation.x = -0.1 + Math.max(0, flapPrimary) * 0.18;
            uData.wingR.rotation.y = -Math.max(0, -flapPrimary) * 0.12;
          }

          // Legs trail back and drift gently with the wingbeat rather than
          // holding a dead static pose - a soaring/gliding flutter instead
          // of the tucked ~90° fold that used to read as sitting
          // cross-legged in midair, since it never touches ground while airborne.
          const legDrift = flapPrimary * 0.06;
          uData.legL.rotation.set(-0.45 + legDrift, 0, 0.08);
          uData.legR.rotation.set(-0.45 + legDrift, 0, -0.08);

          // Two overlapping bob waves (a slow rise/fall plus a quicker
          // wingbeat-driven ripple) read as buoyant hovering rather than a
          // single metronomic bounce.
          const bobSlow = Math.sin(time * (uData.isWalking ? 3 : 1.1) + uData.idlePhase) * (uData.isWalking ? 0.05 : 0.09);
          const bobFast = flapPrimary * (uData.isWalking ? 0.03 : 0.025);
          const bob = bobSlow + bobFast;
          uData.body.position.y = 0.525 + bob;
          uData.head.position.y = 0.9 + bob;
          // Forward lean while banking toward a target; at rest, a faint
          // sway on both the pitch and roll axes plus a slow yaw drift, so
          // hovering looks like actively riding the air rather than a
          // static model pinned in place.
          uData.body.rotation.x = uData.isWalking ? 0.25 : 0.04 + flapPrimary * 0.02;
          uData.body.rotation.z = uData.isWalking ? 0 : Math.sin(time * 0.7 + uData.idlePhase) * 0.05;
          unit.rotation.y += Math.sin(time * 0.5 + uData.idlePhase) * 0.15 * delta;

          // Arms drift in a slow counter-sway for balance instead of
          // hanging frozen in their rig-default pose.
          if (uData.armL && uData.attackAnimTimer <= 0) {
            uData.armL.rotation.x = -0.15 + Math.sin(time * 1.4 + uData.idlePhase) * 0.08;
          }
          if (uData.armR && uData.attackAnimTimer <= 0) {
            uData.armR.rotation.x = -0.15 + Math.sin(time * 1.4 + uData.idlePhase + Math.PI) * 0.08;
          }

          if (uData.attackAnimTimer > 0) {
            // See applyAttackPose's 'valkyrie' branch - drives the actual
            // swoop down to ground level and back up, plus the sword swing.
            applyAttackPose(unit);
          } else {
            // Hovering at VALKYRIE_HOVER_HEIGHT above the squad's own
            // ground-level y (the same way a mounted Militia's seat height
            // is a per-unit position.y offset above the squad above) -
            // swoops back up to this height as soon as a dive-attack ends.
            unit.position.y = VALKYRIE_HOVER_HEIGHT + bob * 0.5;
          }
          return;
        }

        if (uData.unitType === 'goddessOfDeath') {
          // Goddess of Death - own walk/idle/attack handling, see updateGoddessAnim.
          updateGoddessAnim(unit, time, delta);
          return;
        }

        if (uData.unitType === 'goddessOfLife') {
          // Goddess of Life - own walk/idle/attack handling, see updateGoddessOfLifeAnim.
          updateGoddessOfLifeAnim(unit, time, delta);
          return;
        }

        if (uData.unitType === 'kitsuneTwinblade') {
          // Kitsune Twinblade - own walk/idle/attack handling, see updateKitsuneTwinbladeAnim.
          updateKitsuneTwinbladeAnim(unit, time, delta);
          return;
        }

        if (uData.isWalking) {
          const isNinja = uData.unitType === 'ninja';
          const isAkuma = uData.raiderFaction === 'akuma';
          // Ninjas cover ground in a quicker, lighter sprint cadence than
          // a marching soldier's stride. Akuma Ferals crawl-run at a
          // similarly quick cadence but with a much lower, hunched gait.
          uData.walkTimer += delta * (isNinja || isAkuma ? 16 : 12);
          const cycle = Math.sin(uData.walkTimer);
          const legAngle = cycle * (isNinja ? 1.3 : (isAkuma ? 1.1 : 0.6));
          uData.legL.rotation.x = legAngle;
          uData.legR.rotation.x = -legAngle;

          if (isNinja) {
            // Full-tilt sprinter's stride, matching a dead-run reference
            // pose: a big scissoring leg swing with the trailing leg
            // kicking slightly outward, arms driving opposite the legs
            // in wide crossing arcs, and the torso + head leaning
            // sharply forward together with a bit of counter-twist -
            // like a dead sprint rather than a jog.
            uData.legL.rotation.z = Math.max(0, -legAngle) * 0.3;
            uData.legR.rotation.z = -Math.max(0, legAngle) * 0.3;

            const armSwing = cycle * 1.3;
            uData.armL.rotation.set(-0.5 - armSwing, -armSwing * 0.45, 0.2);
            uData.armR.rotation.set(-0.5 + armSwing, armSwing * 0.45, -0.2);

            uData.body.rotation.x = 0.5;
            uData.body.rotation.y = -cycle * 0.12;
            uData.head.rotation.x = 0.45;
            const stride = Math.abs(cycle);
            uData.body.position.y = 0.44 + stride * 0.05;
            uData.head.position.y = 0.77 + stride * 0.05;
          } else if (isAkuma) {
            // Crawler gait - hunched forward much further than the Ninja's
            // sprint lean, arms driving low and forward like paws hitting
            // the ground rather than pumping at the sides.
            const armSwing = cycle * 1.1;
            uData.armL.rotation.set(-0.9 - Math.max(0, -armSwing), 0, 0.15);
            uData.armR.rotation.set(-0.9 - Math.max(0, armSwing), 0, -0.15);
            // Splay the legs outward from the hip (unlike a normal biped
            // stride, which swings them straight fore/aft) - without this
            // they stay tucked directly behind the torso, which is already
            // pitched down close to horizontal, so from the game's
            // overhead camera the legs get hidden behind/under that torso
            // plate and the whole creature reads as just a floating upper
            // body. The outward splay keeps them visible past the torso's
            // silhouette, like a real low quadruped crawl.
            uData.legL.rotation.z = Math.max(0, -legAngle) * 0.35;
            uData.legR.rotation.z = -Math.max(0, legAngle) * 0.35;

            uData.body.rotation.x = 0.95;
            uData.body.rotation.y = cycle * 0.08;
            uData.head.rotation.x = -0.15;
            const stride = Math.abs(cycle);
            uData.body.position.y = 0.34 + stride * 0.04;
            uData.head.position.y = 0.62 + stride * 0.04;
          } else if (uData.unitType === 'dragonRonin') {
            // Authentic samurai running sprint: low forward lean, sharp
            // knee-drive, but the katana stays sheathed at the hip the
            // whole time instead of being drawn just to move - the
            // right hand stays in close, resting near the hilt to
            // steady the sheath as it runs (a real samurai doesn't
            // sprint with a drawn blade), while the left arm does the
            // actual counter-swing for balance. The blade still draws
            // instantly the moment it actually attacks or deflects -
            // see applyAttackPose and the deflect branch below.
            if (uData.weaponMesh) uData.weaponMesh.visible = false;
            if (uData.sheathMesh) uData.sheathMesh.visible = true;
            uData.legL.rotation.z = Math.max(0, -legAngle) * 0.25;
            uData.legR.rotation.z = -Math.max(0, legAngle) * 0.25;
            // Real knee-drive now that the leg has a joint to bend: the
            // recovering leg (swinging back through the stride) folds the
            // knee up sharply, the planted/driving leg stays straighter -
            // an actual bent-knee running gait instead of a stiff-legged
            // scissor kick from the hip alone.
            uData.legLKnee.rotation.x = Math.max(0, -legAngle) * 0.9;
            uData.legRKnee.rotation.x = Math.max(0, legAngle) * 0.9;
            const armSwing = cycle * 0.9;
            // Left arm carries the running motion on its own since the
            // right is held close to the hilt - a bigger swing than a
            // normal two-armed sprint to still sell speed and momentum.
            uData.armL.rotation.set(-0.4 - Math.abs(armSwing) * 0.55, 0, 0.35 + armSwing * 0.2);
            // Right arm stays tucked in near the sheathed hilt at the
            // hip - just a small twitch with the stride instead of a
            // real swing, like a hand steadying the saya on the run.
            uData.armR.rotation.set(-0.15 - Math.abs(armSwing) * 0.08, 0, -0.35 - armSwing * 0.05);
            uData.armLElbow.rotation.x = 0.3 + Math.abs(armSwing) * 0.5;
            uData.armRElbow.rotation.x = 0.35;
            uData.body.rotation.x = 0.35;
            uData.body.rotation.y = -cycle * 0.1;
            uData.head.rotation.x = 0.15;
            const stride = Math.abs(cycle);
            uData.body.position.y = 0.5 + stride * 0.05;
            uData.head.position.y = 0.87 + stride * 0.05;
          } else if (uData.unitType === 'paladins' || uData.unitType === 'eliteSwordsmen') {
            // Armored march - real knee-drive on the swinging leg now
            // that it has a joint, plus a light elbow bend so the arms
            // don't swing perfectly straight.
            uData.legL.rotation.z = 0;
            uData.legR.rotation.z = 0;
            uData.legLKnee.rotation.x = Math.max(0, -legAngle) * 0.6;
            uData.legRKnee.rotation.x = Math.max(0, legAngle) * 0.6;
            if (uData.isPaladinLeader) {
              // Swaps back to a steady two-handed marching grip the
              // instant it starts moving (it's carried one-handed on the
              // shoulder at rest - see the idle pose below), with just a
              // light stride sway rather than a full opposite-arm swing.
              // Sets every axis explicitly so it doesn't inherit the
              // idle pose's shoulder/wrist twist.
              uData.armL.rotation.set(-Math.PI / 5 - legAngle * 0.15, 0, Math.PI / 10);
              uData.armR.rotation.set(Math.PI / 6 - legAngle * 0.15, 0, 0);
              uData.armLElbow.rotation.x = 0.35 + Math.abs(legAngle) * 0.15;
              uData.armRElbow.rotation.x = 0.3 + Math.abs(legAngle) * 0.15;
              uData.handL.rotation.set(0, 0, 0);
              uData.handR.rotation.set(0, 0, 0);
            } else {
              // Shield stays up guarding; only the sword arm swings with
              // the stride.
              uData.armR.rotation.x = -legAngle * 0.35;
              uData.armRElbow.rotation.x = Math.abs(legAngle) * 0.3;
            }
          } else if (uData.unitType === 'slasher') {
            // Dedicated running stride - without this the Slasher fell
            // into the generic catch-all below, which only swings the
            // arms and never touches body/head height while walking. It
            // would then just hold whatever position.y the idle crouch
            // last left it at while the legs swung underneath, reading
            // as gliding/floating instead of actually running. A real
            // knee-driven stride with its own body bob fixes that.
            uData.legL.rotation.z = 0;
            uData.legR.rotation.z = 0;
            uData.legLKnee.rotation.x = Math.max(0, -legAngle) * 0.7;
            uData.legRKnee.rotation.x = Math.max(0, legAngle) * 0.7;
            const armSwing = cycle * 0.8;
            uData.armL.rotation.set(-0.3 - armSwing, 0, 0.1);
            uData.armR.rotation.set(-0.3 + armSwing, 0, -0.1);
            uData.armLElbow.rotation.x = 0.3 + Math.abs(armSwing) * 0.3;
            uData.armRElbow.rotation.x = 0.3 + Math.abs(armSwing) * 0.3;
            uData.body.rotation.x = 0.3;
            uData.body.rotation.y = -cycle * 0.1;
            uData.head.rotation.x = 0.1;
            const stride = Math.abs(cycle);
            uData.body.position.y = 0.44 + stride * 0.05;
            uData.head.position.y = 0.78 + stride * 0.05;
          } else if (uData.unitType !== 'pikes' && !(uData.unitType === 'militia' && uData.militiaWeapon === 'spear')) {
            // Archers now swing their arms the same natural way mages do
            // while advancing - no more holding the bow rigidly raised
            // through the whole walk.
            uData.armL.rotation.x = -legAngle * 0.5;
            uData.armR.rotation.x = legAngle * 0.5;
          }
        } else {
          uData.walkTimer = 0;
          uData.legL.rotation.x = 0;
          uData.legR.rotation.x = 0;
          if (uData.unitType === 'ninja') {
            // Clear the sprint-only leg kick and head/torso forward lean
            // so they don't bleed into the idle poses below.
            uData.legL.rotation.z = 0;
            uData.legR.rotation.z = 0;
            uData.head.rotation.x = 0;
          }

          // Idle breathing
          const breath = Math.sin(time * 2 + uData.idlePhase) * 0.03;
          uData.body.position.y = 0.525 + breath;
          uData.head.position.y = 0.9 + breath;

          // Standing still and not mid-shot - let the bow arm drop to a
          // relaxed resting pose instead of staying permanently drawn,
          // and clear the walking lean/sway so it doesn't stick.
          if ((uData.unitType === 'archers' || uData.unitType === 'crossbow' || (uData.unitType === 'raiders' && (uData.raiderWeapon === 'bow' || uData.raiderWeapon === 'wokouBow' || uData.raiderWeapon === 'banditBow')) || (uData.unitType === 'militia' && uData.militiaWeapon === 'bow') || (uData.unitType === 'warElephant' && uData.elephantRole === 'archer')) && uData.attackAnimTimer <= 0) {
            uData.armL.rotation.set(ARCHER_REST_ARM_L.x, ARCHER_REST_ARM_L.y, ARCHER_REST_ARM_L.z);
            uData.armR.rotation.set(ARCHER_REST_ARM_R.x, ARCHER_REST_ARM_R.y, ARCHER_REST_ARM_R.z);
            uData.body.rotation.x = 0;
            uData.body.rotation.y = 0;
          } else if (uData.unitType === 'paladins' || uData.unitType === 'eliteSwordsmen') {
            if (uData.isPaladinLeader) {
              // Relaxed shoulder-carry stance (reference: a knight resting
              // a long weapon up against the shoulder in a one-handed
              // grip) - the haft rests folded up near the shoulder instead
              // of held low in a two-handed guard, while the off hand
              // drops to hang loose at the side rather than bracing it. A
              // slow breathing sway and an occasional head turn keep it
              // from reading as a frozen action pose.
              const sway = Math.sin(time * 0.8 + uData.idlePhase) * 0.03;
              const breathe = Math.sin(time * 1.3 + uData.idlePhase) * 0.02;
              const scan = Math.sin(time * 0.3 + uData.idlePhase) * 0.12;

              uData.legL.rotation.z = 0.03;
              uData.legR.rotation.z = -0.04;
              uData.legR.rotation.x = 0.04; // right foot settled a touch forward
              uData.body.rotation.x = 0.02 + breathe * 0.3;
              uData.body.rotation.y = -0.06 + sway * 0.3;
              uData.head.rotation.y = scan;
              uData.head.rotation.x = 0.02;

              if (uData.attackAnimTimer <= 0) {
                // Weapon arm - carried forward and slightly out from the
                // shoulder (a confident, ready-to-swing carry) rather than
                // held flat back against it, with a slow sway plus a
                // periodic "settle the grip" flourish through the elbow
                // and wrist so the pose reads as alert rather than frozen.
                const grip = Math.sin(time * 0.45 + uData.idlePhase) * 0.09;
                uData.armR.rotation.set(-0.85 + breathe * 0.3 + grip, 0, 0.08);
                uData.armRElbow.rotation.x = 0.85 + Math.abs(grip) * 0.5;
                uData.handR.rotation.set(grip * 0.6, 0, 0);

                // Off hand hangs loose, with a slow open/close flex at the
                // wrist (doubling as the hand joint - see
                // createJointedLimb) so it doesn't read as a dead prop
                // hanging at the side.
                const flex = Math.sin(time * 0.6 + uData.idlePhase + 1.5) * 0.18;
                uData.armL.rotation.set(-0.08 + breathe * 0.4, 0, 0.06);
                uData.armLElbow.rotation.x = 0.12 + Math.max(0, flex);
                uData.handL.rotation.set(flex * 0.35, 0, 0);
              }
            } else {
              // Elite Swordsman - a disciplined shield-line guard: the
              // shield stays braced steady while a light forward-leaning
              // weight shift and a small sword-arm twitch keep the pose
              // from reading as stiff or static.
              const sway = Math.sin(time * 1.1 + uData.idlePhase) * 0.03;
              const shift = Math.sin(time * 0.5 + uData.idlePhase) * 0.05;
              uData.body.rotation.x = 0.03 + shift * 0.4;
              uData.legL.rotation.x = shift * 0.15;
              uData.legR.rotation.x = -shift * 0.15;
              if (uData.attackAnimTimer <= 0) {
                uData.armR.rotation.x = sway * 0.3;
                uData.armRElbow.rotation.x = 0.15 + Math.abs(sway) * 0.4;
                uData.armL.rotation.x = -shift * 0.1;
              }
            }
          } else if (uData.unitType === 'chakramDancers') {
            // Idle Chakram flourish - a slow dancer's weight-shift sway
            // with a light dance-step bounce on the legs, both rings
            // kept lazily spinning in hand the entire time it's standing
            // still (not just mid-swing - see the much faster blur in
            // applyAttackPose) so it reads as a performer showing off
            // rather than a soldier just standing at attention.
            const sway = Math.sin(time * 1.2 + uData.idlePhase);
            const step = Math.sin(time * 0.6 + uData.idlePhase);
            uData.body.rotation.y = sway * 0.12;
            uData.body.rotation.z = sway * 0.05;
            uData.head.rotation.y = -sway * 0.15;
            uData.legL.rotation.x = step * 0.08;
            uData.legR.rotation.x = -step * 0.08;
            if (uData.attackAnimTimer <= 0) {
              uData.armR.rotation.set(-Math.PI / 5 + sway * 0.08, 0, -0.15 - sway * 0.1);
              uData.armL.rotation.set(-Math.PI / 5 - sway * 0.08, 0, 0.15 + sway * 0.1);
              if (uData.armRElbow) uData.armRElbow.rotation.x = 0.2;
              if (uData.armLElbow) uData.armLElbow.rotation.x = 0.2;
            }
            if (uData.weaponMesh) uData.weaponMesh.rotation.z += delta * 3.5;
            if (uData.offhandChakramMesh) uData.offhandChakramMesh.rotation.z -= delta * 3.5;
          } else if (uData.raiderFaction === 'akuma') {
            // Low, hunched crouch on all fours rather than a standing
            // idle - held even mid-attack-windup, since applyAttackPose
            // only overrides the pose once actually pouncing.
            const sway = Math.sin(time * 1.4 + uData.idlePhase) * 0.05;
            uData.legL.rotation.x = 0.3;
            uData.legR.rotation.x = 0.3;
            // Splay the legs outward from the hip, matching the walking
            // gait fix above - without it they sit tucked directly behind
            // the torso even at rest, and since the torso is already
            // pitched down close to horizontal, the overhead camera reads
            // the creature as a floating upper body with no visible legs.
            uData.legL.rotation.z = 0.2;
            uData.legR.rotation.z = -0.2;
            uData.body.rotation.x = 0.75 + sway * 0.3;
            uData.body.position.y = 0.36 + breath * 0.6;
            uData.head.position.y = 0.66 + breath * 0.6;
            uData.head.rotation.x = -0.2;
            if (uData.attackAnimTimer <= 0) {
              uData.armL.rotation.set(-0.7 + sway, 0, 0.2);
              uData.armR.rotation.set(-0.7 - sway, 0, -0.2);
            }
          } else if (uData.unitType === 'ninja') {
            if (uData.idleVariant === 1) {
              // Variant 1 - tall stealth stance: standing nearly upright,
              // feet together, hands clasped in a ninjutsu hand-seal at
              // the chest. Sways gently side-to-side like it's listening
              // for something rather than winding up to strike.
              const seal = Math.sin(time * 1.1 + uData.idlePhase) * 0.04;
              const lean = Math.sin(time * 0.7 + uData.idlePhase) * 0.03;
              uData.legL.rotation.x = 0.04;
              uData.legR.rotation.x = 0.04;
              uData.body.rotation.x = 0.03;
              uData.body.rotation.y = lean;
              uData.body.position.y = 0.5 + breath * 0.6;
              uData.head.position.y = 0.895 + breath * 0.6;
              if (uData.attackAnimTimer <= 0) {
                // Both hands drawn to the centerline, forearms crossed
                // up in front of the chest, fingers interlaced.
                uData.armL.rotation.set(-1.7 + seal, 0.35, 0.5);
                uData.armR.rotation.set(-1.7 - seal, -0.35, -0.5);
              }
            } else {
              // Variant 0 - low, alert crouch: knees bent, arms tucked
              // into a ready guard, with a subtle tension sway instead of
              // a relaxed soldier's idle stance - held even mid-attack-
              // windup, since applyAttackPose only overrides the arms
              // once actually firing.
              const sway = Math.sin(time * 1.6 + uData.idlePhase) * 0.05;
              uData.legL.rotation.x = 0.22;
              uData.legR.rotation.x = 0.22;
              uData.body.rotation.x = 0.12;
              uData.body.rotation.y = 0;
              uData.body.position.y = 0.465 + breath * 0.5;
              uData.head.position.y = 0.85 + breath * 0.5;
              if (uData.attackAnimTimer <= 0) {
                uData.armL.rotation.set(-0.55 + sway, 0.05, 0.15);
                uData.armR.rotation.set(-0.55 - sway, -0.05, -0.15);
              }
            }
          } else if (uData.unitType === 'dragonRonin') {
            // Only one idle stance now (see equipUnit's 'dragonRonin'
            // branch) - purely cosmetic, no gameplay effect. Keeps the
            // blade sheathed at the hip rather than drawn - swap back
            // to the hand-held weaponMesh the instant it walks,
            // attacks, or deflects (see those branches above/below).
            if (uData.weaponMesh) uData.weaponMesh.visible = false;
            if (uData.sheathMesh) uData.sheathMesh.visible = true;

            {
              // Sword Rest stance (reference: a traditional ronin
              // standing portrait, sedge hat tipped down, blade
              // sheathed at the hip) - a calmer, more settled pose than
              // a raised fighting guard. Kept to small, gentle motion
              // (a slight forward tip of the head/hat, a soft weight
              // shift between the legs, one hand resting near the
              // hilt) rather than a big torso twist - this rig's
              // simple single-pivot limbs don't hold up well to large
              // yaw twists, which read as a broken/clipped pose instead
              // of a natural turn.
              const lean = Math.sin(time * 0.7 + uData.idlePhase) * 0.02;
              const weightShift = Math.sin(time * 0.35 + uData.idlePhase);

              uData.body.rotation.x = 0.1 + lean;
              uData.body.rotation.y = 0;
              uData.head.rotation.x = 0.15; // brim tips down, shading the face
              uData.head.rotation.y = 0;

              // Weight settles onto whichever leg the sway currently
              // favors, the other trailing a half-step back - a standing
              // weight-shift rather than a static bent-knee crouch.
              uData.legL.rotation.set(0.05 - weightShift * 0.08, 0, 0.05);
              uData.legR.rotation.set(0.05 + weightShift * 0.08, 0, -0.05);
              // The trailing (unweighted) leg carries a touch more knee bend
              // than the weighted one, matching whichever side the shift
              // currently favors - reads as resting weight on one leg
              // rather than standing stiff-kneed on both.
              uData.legLKnee.rotation.x = 0;
              uData.legRKnee.rotation.x = 0;

              if (uData.attackAnimTimer <= 0) {
                // Right hand hovers just above the sheathed hilt at the
                // hip, as if ready to draw at any moment; left hand
                // rests loosely at the side instead of the old raised,
                // two-handed grip on a held blade.
                const breathe = Math.sin(time * 1.1 + uData.idlePhase) * 0.02;
                uData.armR.rotation.set(-0.3 + breathe, -0.1, -0.25);
                uData.armL.rotation.set(-0.05 + breathe, 0.05, 0.05);
                // Straight-armed - the katana is a long, rigidly-attached
                // blade, so any elbow rotation gets amplified way out at
                // its tip and reads as a dislocated arm under the close,
                // static scrutiny of a standing pose.
                uData.armRElbow.rotation.x = 0;
                uData.armLElbow.rotation.x = 0;
              }
            }
          } else if (uData.unitType === 'slasher') {
            // Idle Pose (reference: a forward lunge stance - right leg
            // stepped out in front, left leg swept back and crouched
            // deep behind it, torso leaning forward over the front leg
            // with the head up and facing forward rather than down/
            // scanning. Left arm hangs down and forward, right arm
            // raised up and back like a wind-up before a strike - an
            // asymmetric, off-balance-looking readiness rather than a
            // symmetrical guard). Single base stance, no variants (see
            // equipUnit's 'slasher' branch) - but a periodic dagger-twirl
            // flourish on top of it (further below, gated on
            // idleFidgetTimer).
            const sway = Math.sin(time * 1.1 + uData.idlePhase) * 0.02;
            const shift = Math.sin(time * 0.5 + uData.idlePhase) * 0.03;

            // Right leg stepped forward, mostly straight with a slight
            // knee bend for a planted front foot. Left leg swept back
            // and extended straight behind rather than bent into a deep
            // crouch - a trailing leg, not a second bent support.
            uData.legR.rotation.set(-0.35 + shift * 0.3, 0, -0.06);
            uData.legRKnee.rotation.x = 0.2 + Math.max(0, shift) * 0.3;
            uData.legL.rotation.set(0.6 - shift * 0.3, 0, 0.06);
            uData.legLKnee.rotation.x = 0.12 + Math.max(0, -shift) * 0.3;

            // Torso leans forward over the front leg, sunk down with the
            // crouch. Head stays up and forward-facing rather than
            // tipped down watching the ground.
            uData.body.rotation.x = 0.3 + sway * 0.3;
            uData.body.rotation.y = 0;
            uData.body.position.y = 0.4 + breath * 0.6;
            uData.head.rotation.x = 0.02; // up, facing forward
            uData.head.position.y = 0.76 + breath * 0.6;

            // Slow head-scan - a wide, unhurried side-to-side glance
            // (like it's watching a room) rather than the tight nervous
            // wobble the sway values above would give it. Deliberately a
            // much slower, wider, independent wave from every other
            // motion in this stance so it doesn't just read as noise -
            // still centered on facing forward.
            uData.head.rotation.y = Math.sin(time * 0.35 + uData.idlePhase * 1.7) * 0.32;

            if (uData.attackAnimTimer <= 0) {
              // Dagger hand (right) - upper arm angled forward (not
              // swept back behind the torso) so the elbow folds forward
              // in front of the body instead of hooking backward.
              // Elbow only rotates on x (a hinge joint, same as every
              // other unit's elbow in this rig, including the Slasher's
              // own walk cycle above) - a y-axis twist here was untwisting
              // the forearm out of alignment with the upper arm, which is
              // what made it read as attached backward.
              uData.armR.position.y = 0.7 - 0.15;
              uData.armR.rotation.set(-0.5 + sway * 0.4, 0, -0.18);
              uData.armRElbow.rotation.x = -0.9;
              // Free hand (left) extended forward and out to the side as
              // a clear, separate guard arm, mostly straight.
              uData.armL.position.y = 0.7 - 0.15;
              uData.armL.rotation.set(0.8 - sway * 0.3, 0, 0.18);
              uData.armLElbow.rotation.x = -0.9;

              // Dagger-twirl flourish - a periodic "cool" beat where it
              // idly spins the blade once around in hand before settling
              // back to the resting wound-up grip, on a per-unit
              // randomized timer (see idleFidgetTimer, seeded in
              // equipUnit) so a squad of four doesn't all flourish in
              // lockstep. Only ticks down while genuinely idle (this
              // whole branch is already inside the "not walking" case),
              // and only starts a new flourish once the previous one has
              // finished.
              if (uData.idleFidgetAnimTimer > 0) {
                uData.idleFidgetAnimTimer -= delta;
                const fp = 1 - Math.max(0, uData.idleFidgetAnimTimer) / SLASHER_FIDGET_ANIM_DURATION; // 0 -> 1
                // A quick full spin of the blade around its own shaft,
                // eased so it snaps out fast and settles gently back
                // into the resting grip rather than moving at a
                // constant rate the whole way through.
                const spin = (1 - Math.pow(1 - fp, 3)) * Math.PI * 2;
                if (uData.weaponMesh) {
                  uData.weaponMesh.rotation.z = spin % (Math.PI * 2);
                  uData.weaponMesh.rotation.y = Math.PI / 2; // held horizontal, left
                }
                // A small lift-and-flick of the wrist/elbow rides along
                // with the spin so it reads as a hand flourish, not just
                // the blade mesh spinning in place.
                const lift = Math.sin(fp * Math.PI);
                uData.armR.rotation.x -= lift * 0.35;
                uData.armRElbow.rotation.x += lift * 0.5;
              } else {
                if (uData.weaponMesh) {
                  uData.weaponMesh.rotation.z = 0;
                  uData.weaponMesh.rotation.y = Math.PI / 2; // held horizontal, left
                }
                uData.idleFidgetTimer -= delta;
                if (uData.idleFidgetTimer <= 0) {
                  uData.idleFidgetAnimTimer = SLASHER_FIDGET_ANIM_DURATION;
                  uData.idleFidgetTimer = SLASHER_FIDGET_MIN_INTERVAL + Math.random() * SLASHER_FIDGET_INTERVAL_RANGE;
                }
              }
            }
          } else if (uData.unitType === 'steelRevenant') {
            // "Grindstone" idle (reference: a silent iron colossus
            // standing sentinel over its own weapon) - a hunched,
            // motionless vigil rather than a normal soldier's relaxed
            // stance, broken only by a slow, deliberate breath and an
            // occasional heave-and-grind of the mace, like it's idly
            // testing the weight of the thing before the next kill.
            // Held even mid-attack-windup below (applyAttackPose only
            // overrides the arms once it's actually swinging).
            const slowBreath = Math.sin(time * 0.55 + uData.idlePhase) * 0.02;
            const slowSway = Math.sin(time * 0.3 + uData.idlePhase) * 0.02;
            // A slow, faint side-to-side lean layered under everything
            // else - not tied to the breath cycle - so the colossus
            // never quite reads as perfectly still/grounded, more like
            // it's drifting in place. Overwritten instantly by the
            // Spectral Shudder's sharper jitter below when that fires.
            const hoverDrift = Math.sin(time * 0.17 + uData.idlePhase * 0.7) * 0.015;

            // Wide, rooted stance - feet planted slightly outward rather
            // than square, like something built to never be knocked
            // over, knees carrying a faint permanent bend rather than
            // locked straight so the weight actually looks grounded.
            uData.legL.rotation.set(0.03, 0, 0.05);
            uData.legR.rotation.set(0.03, 0, -0.05);
            uData.legLKnee.rotation.x = 0.05;
            uData.legRKnee.rotation.x = 0.05;

            // Permanently hunched forward under the mace's weight, chest
            // sunk low - a much heavier, lower breath cycle than any
            // living unit's, in place of the shared breath value above.
            uData.body.rotation.x = 0.05 + slowBreath;
            uData.body.rotation.y = slowSway * 0.5;
            uData.body.rotation.z = hoverDrift;
            uData.body.position.y = 0.52 + slowBreath * 0.5;

            // The faceless helm hangs tipped down, tracking side to side
            // very slowly and widely - reads as patient and watchful
            // rather than nervous, the opposite of the Slasher's quick
            // head-scan above.
            uData.head.rotation.x = 0.05;
            uData.head.rotation.y = Math.sin(time * 0.22 + uData.idlePhase * 1.3) * 0.22;
            uData.head.position.y = 0.9 + slowBreath * 0.5;

            if (uData.attackAnimTimer <= 0) {
              // Spectral Shudder - a second, independent idle beat: a
              // quick full-body glitch-shiver, like the ghost briefly
              // slipping out of phase with the world, at a much higher
              // frequency than anything else in its idle pose and
              // fading out fast rather than sustaining like the
              // Grindstone heave above. Runs on its own separate timer
              // (shudderTimer/shudderAnimTimer, seeded alongside
              // idleFidgetTimer in equipUnit's 'steelRevenant'
              // branches) so the two flourishes don't always land
              // together, and can fire independently of the mace heave.
              if (uData.shudderAnimTimer > 0) {
                uData.shudderAnimTimer -= delta;
                const sp = 1 - Math.max(0, uData.shudderAnimTimer) / STEEL_REVENANT_SHUDDER_ANIM_DURATION; // 0 -> 1
                const fade = 1 - sp;
                const jitter = Math.sin(sp * 70) * fade * 0.05;
                uData.body.rotation.z = hoverDrift + jitter;
                uData.head.rotation.z = jitter * 1.4;
                uData.body.position.x = Math.sin(sp * 90) * fade * 0.015;
              } else {
                uData.head.rotation.z = 0;
                uData.body.position.x = 0;
                uData.shudderTimer -= delta;
                if (uData.shudderTimer <= 0) {
                  uData.shudderAnimTimer = STEEL_REVENANT_SHUDDER_ANIM_DURATION;
                  uData.shudderTimer = STEEL_REVENANT_SHUDDER_MIN_INTERVAL + Math.random() * STEEL_REVENANT_SHUDDER_INTERVAL_RANGE;
                }
              }
            }
          }
        }

        // Dragon Ronin passive (Deflect) - a fast snap-block the instant a
        // parry/deflect lands: the blade whips up diagonally to intercept,
        // the torso braces back with a slight twist, and the stance roots
        // itself with a bent front knee. Takes priority over the idle/walk
        // pose set above, but yields to the unit's own attack swing if
        // both timers somehow overlap.
        if (uData.deflectAnimTimer > 0 && uData.attackAnimTimer <= 0) {
          const dp = 1 - (uData.deflectAnimTimer / DRAGON_RONIN_DEFLECT_ANIM_DURATION); // 0 -> 1
          // Fast snap up to the block within the first third, hold
          // briefly, then ease back out through the last third so it
          // doesn't just vanish the instant the timer runs out.
          const snap = dp < 0.35 ? Math.pow(dp / 0.35, 0.5) : (dp < 0.7 ? 1 : Math.max(0, 1 - (dp - 0.7) / 0.3));
          if (uData.weaponMesh) {
            uData.weaponMesh.visible = true;
            uData.weaponMesh.rotation.x = Math.PI / 2;
            uData.weaponMesh.rotation.z = 0;
          }
          // Same draw-from-the-hip swap as the attack pose above - a
          // parry snaps the blade out of its sheath too.
          if (uData.sheathMesh) uData.sheathMesh.visible = false;
          uData.armR.rotation.set(-1.3 - snap * 0.4, 0.15, -0.5 - snap * 0.3);
          uData.armL.rotation.set(-1.1 - snap * 0.3, -0.1, 0.4 + snap * 0.3);
          uData.armRElbow.rotation.x = 0.5 * snap;
          uData.armLElbow.rotation.x = 0.4 * snap;
          uData.body.rotation.x = 0.1 + snap * 0.08;
          uData.body.rotation.y = -snap * 0.15;
          uData.head.rotation.x = 0.1;
          uData.legL.rotation.x = 0.15 * snap;
          uData.legR.rotation.x = 0.1 * snap;
          uData.legLKnee.rotation.x = 0.3 * snap;
          uData.legRKnee.rotation.x = 0.2 * snap;
        }

        // Slasher passive (Ghost Step) - the dash-flicker the instant a
        // projectile deflect lands: a single explosive half-lunge toward
        // the attacker and back, front leg driving low, dagger snapping
        // out and across to bat the shot aside, torso whipping into the
        // lean - reads as a burst of speed rather than an actual step,
        // since the unit's position never changes (see
        // triggerSlasherGhostStepDeflect). Takes priority over the idle/
        // walk pose set above, but yields to the unit's own attack swing
        // if both timers somehow overlap.
        if (uData.ghostStepDashAnimTimer > 0 && uData.attackAnimTimer <= 0) {
          const gp = 1 - (uData.ghostStepDashAnimTimer / SLASHER_GHOST_STEP_DASH_ANIM_DURATION); // 0 -> 1
          // Near-instant snap out, a short hold at full extension, then
          // ease back through the recovery - the same fast snap/hold/
          // recover split Dragon Ronin's Deflect uses just above.
          const flick = gp < 0.35 ? Math.pow(gp / 0.35, 0.5) : (gp < 0.7 ? 1 : Math.max(0, 1 - (gp - 0.7) / 0.3));
          uData.armR.rotation.set(-0.6 - flick * 1.1, 0.1 + flick * 0.3, -0.2 - flick * 0.4);
          uData.armRElbow.rotation.x = 0.2 + flick * 0.6;
          uData.armL.rotation.set(-0.45 - flick * 0.3, -0.1, 0.18 + flick * 0.2);
          uData.armLElbow.rotation.x = 0.15 + flick * 0.25;
          uData.body.rotation.x = 0.3 + flick * 0.2;
          uData.body.rotation.y = -flick * 0.2;
          uData.head.rotation.x = 0.05;
          uData.legR.rotation.x = -0.3 * flick;
          uData.legRKnee.rotation.x = 0.5 * flick;
          uData.legL.rotation.x = 0.4 * flick;
          uData.legLKnee.rotation.x = 0.15 * flick;
        }

        // Slasher passive (Rooftop Ambush) - a target's startled flinch
        // the instant a Slasher flash-steps onto it from a rooftop/
        // boulder perch: head snapped back, arms flung open in surprise,
        // torso rocked backward - reads as caught completely off guard a
        // beat before the actual killing blow lands (see
        // triggerSlasherAmbush / pendingSlasherAmbushKills). Generic to
        // every unit type, since any unit can end up on the receiving end
        // of an ambush - takes priority over the idle/walk pose set
        // above, but yields to the unit's own attack swing if both timers
        // somehow overlap.
        if (uData.shockAnimTimer > 0 && uData.attackAnimTimer <= 0) {
          const sp = 1 - (uData.shockAnimTimer / SLASHER_AMBUSH_SHOCK_DURATION); // 0 -> 1
          // Snap back fast within the first third, then ease back toward
          // neutral through the rest as the timer runs out.
          const startle = sp < 0.3 ? Math.pow(sp / 0.3, 0.5) : Math.max(0, 1 - (sp - 0.3) / 0.7);
          uData.body.rotation.x = -0.25 * startle;
          uData.body.rotation.y = 0;
          uData.head.rotation.x = -0.3 * startle;
          uData.head.rotation.y = 0;
          uData.armL.rotation.set(-1.4 * startle, -0.3 * startle, 0.5 * startle);
          uData.armR.rotation.set(-1.4 * startle, 0.3 * startle, -0.5 * startle);
          // armLElbow/armRElbow only exist for jointed-limb rigs (Dragon
          // Ronin, Paladins, Slasher, Steel Revenant) - null for every
          // other unit type, and this startle pose is generic to any
          // unit an ambush can land on, so it must guard these like the
          // rest of the file does.
          if (uData.armLElbow) uData.armLElbow.rotation.x = 0.2 * startle;
          if (uData.armRElbow) uData.armRElbow.rotation.x = 0.2 * startle;
          uData.legL.rotation.x = 0.15 * startle;
          uData.legR.rotation.x = 0.15 * startle;
        }

        // Paladin passive (Holy Light) - both arms thrown up and outward
        // to invoke a beam of light from above, chest open, head tilted
        // back to look up into it. Snaps up fast, holds at the peak
        // while the heal/smite beams actually land (see
        // updatePaladinAbilities), then eases back down into whatever
        // pose - idle or marching - was already playing underneath.
        // Takes priority over the idle/walk pose set above, but yields
        // to the unit's own attack swing if both timers somehow overlap.
        if (uData.holyLightCastAnimTimer > 0 && uData.attackAnimTimer <= 0) {
          const hp = 1 - (uData.holyLightCastAnimTimer / PALADIN_HOLY_LIGHT_CAST_ANIM_DURATION); // 0 -> 1
          const raise = hp < 0.35 ? Math.pow(hp / 0.35, 0.5) : (hp < 0.75 ? 1 : Math.max(0, 1 - (hp - 0.75) / 0.25));
          uData.armR.rotation.set(-1.9 * raise, 0, 0.35 * raise);
          uData.armL.rotation.set(-1.9 * raise, 0, -0.35 * raise);
          if (uData.armRElbow) uData.armRElbow.rotation.x = 0.15 * raise;
          if (uData.armLElbow) uData.armLElbow.rotation.x = 0.15 * raise;
          if (uData.handR) uData.handR.rotation.x = -0.2 * raise;
          if (uData.handL) uData.handL.rotation.x = -0.2 * raise;
          uData.body.rotation.x = -0.18 * raise;
          uData.head.rotation.x = -0.35 * raise;
          uData.head.rotation.y = 0;
        }

        // Paladin passive (Light Shock) - a fast two-handed overhead
        // raise and ground slam to release the ring, both knees bracing
        // wide to sell the shockwave kicking outward from its feet -
        // the same windup/slam/recover shape as its normal two-handed
        // chop, just quicker and generic (no weapon-specific wrist
        // snap) since it's meant to read as a burst of channeled energy
        // rather than a swing. Takes priority over the idle/walk pose
        // set above, but yields to the unit's own attack swing if both
        // timers somehow overlap.
        if (uData.lightShockCastAnimTimer > 0 && uData.attackAnimTimer <= 0) {
          const lp = 1 - (uData.lightShockCastAnimTimer / PALADIN_LIGHT_SHOCK_CAST_ANIM_DURATION); // 0 -> 1
          const windUp = Math.min(lp / 0.3, 1);
          const slamT = lp <= 0.3 ? 0 : Math.min((lp - 0.3) / 0.4, 1);
          const slam = Math.pow(slamT, 0.6);
          const recover = lp <= 0.8 ? 0 : (lp - 0.8) / 0.2;
          uData.armR.rotation.set(-Math.PI / 6 - windUp * 1.8 + slam * 2.4, 0, 0);
          uData.armL.rotation.set(-Math.PI / 6 - windUp * 1.6 + slam * 2.2, 0, 0);
          if (uData.armRElbow) uData.armRElbow.rotation.x = Math.max(0, 0.4 * windUp - slam * 0.3 + recover * 0.2);
          if (uData.armLElbow) uData.armLElbow.rotation.x = Math.max(0, 0.35 * windUp - slam * 0.25 + recover * 0.15);
          uData.legL.rotation.z = 0.15 * slam;
          uData.legR.rotation.z = -0.15 * slam;
          uData.legLKnee.rotation.x = 0.3 * slam;
          uData.legRKnee.rotation.x = 0.3 * slam;
          uData.body.rotation.x = 0.05 + windUp * 0.05 + slam * 0.2;
          uData.head.rotation.x = 0.05 + slam * 0.1;
        }

        // Slasher passive (Assassinate) - a quick blood-flick follow-
        // through the instant a guaranteed-kill dagger strike lands (see
        // triggerSlasherKillFlourish): the dagger snaps out to the side
        // in a sharp flicking arc, head and torso turn to track the
        // fallen target, then it eases back down into guard. Fires off
        // both the normal in-place Assassinate and the Rooftop Ambush
        // finisher, so it isn't specific to either. Takes priority over
        // the idle/walk pose set above, but yields to the unit's own
        // attack swing if both timers somehow overlap.
        if (uData.slasherKillFlourishAnimTimer > 0 && uData.attackAnimTimer <= 0) {
          const kp = 1 - (uData.slasherKillFlourishAnimTimer / SLASHER_KILL_FLOURISH_DURATION); // 0 -> 1
          const flick = kp < 0.3 ? Math.pow(kp / 0.3, 0.5) : (kp < 0.6 ? 1 : Math.max(0, 1 - (kp - 0.6) / 0.4));
          uData.armR.rotation.x = -0.2 - flick * 0.5;
          uData.armR.rotation.z = -0.18 + flick * 0.7;
          if (uData.armRElbow) uData.armRElbow.rotation.x = 0.4 + flick * 0.5;
          uData.armL.rotation.set(-0.45, 0, 0.18);
          uData.body.rotation.y = -flick * 0.2;
          uData.body.rotation.x = 0.08 + flick * 0.1;
          uData.head.rotation.x = 0.05;
          uData.head.rotation.y = -flick * 0.15;
        }

        // Override arm poses during active attack animation
        if (uData.attackAnimTimer > 0) {
          applyAttackPose(unit);
        }
      };

      squads.forEach(s => s.members.forEach(updateUnitAnims));
      raiderSquads.forEach(s => s.members.forEach(updateUnitAnims));
      militiaSquads.forEach(s => s.members.forEach(updateUnitAnims));

      } catch (err) {
        // A bug anywhere in the per-frame simulation used to throw here and
        // silently freeze the whole game: requestAnimationFrame(animate) at
        // the very top of this function had already scheduled the next
        // frame before the error happened, so the loop kept calling itself
        // and kept hitting the same error before ever reaching
        // renderer.render() below - nothing moved, nothing fought, the
        // screen just stuck on the last good frame, while anything driven
        // by its own real-time interval (like the wave-cooldown countdown)
        // kept ticking normally since it isn't part of this loop at all.
        // Catching it here means one bad interaction degrades gracefully
        // instead of freezing everything: it's logged so the real cause is
        // visible in the console, and rendering still happens so the scene
        // doesn't appear stuck.
        console.error('Simulation error (frame skipped):', err);
        // TEMP DEBUG (mobile-friendly): show the error on-screen since a
        // phone has no accessible dev console. Only the FIRST error is
        // kept on screen (so a per-frame repeating error doesn't spam),
        // but a counter shows how many times it has fired since.
        const overlay = document.getElementById('debug-error-overlay');
        if (overlay) {
          if (!window.__debugErrCount) {
            window.__debugErrCount = 0;
            overlay.style.display = 'block';
            overlay.textContent = 'FRAME ERROR:\n' + (err && err.stack ? err.stack : String(err));
          }
          window.__debugErrCount++;
          overlay.textContent = overlay.textContent.split('\n(repeated')[0] + '\n(repeated ' + window.__debugErrCount + 'x)';
        }
      }

      renderer.render(scene, camera);
    }

    animate();

    // Window Resize Handler - keeps the 3D canvas filling the screen as
    // its size actually changes.
    function fitRendererToScreen() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', fitRendererToScreen);
    // Rotating a phone/tablet fires 'resize' in most modern mobile browsers
    // already, but 'orientationchange' fires a beat earlier on some older
    // WebViews and can land before the OS has finished reporting the new
    // window dimensions - refit immediately and once more shortly after so
    // the canvas doesn't get stuck sized for the old orientation.
    window.addEventListener('orientationchange', () => {
      fitRendererToScreen();
      setTimeout(fitRendererToScreen, 300);
    });
    // iOS Safari toggling its address bar changes the visual viewport
    // height without always firing 'resize' on window - listen for it
    // directly when available so the canvas/UI don't end up with a strip
    // of stale space at the bottom.
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', fitRendererToScreen);
    }

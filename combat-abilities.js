    function maybeTriggerNinjaSmokeBomb(targetUnit, targetWorldPos) {
      const uData = targetUnit.userData;
      if (uData.unitType !== 'ninja' || uData.hp <= 0 || uData.vanished) return;
      if (uData.hp / uData.maxHp > NINJA_LOW_HP_THRESHOLD) return;
      if (Math.random() >= NINJA_LOW_HP_SMOKE_CHANCE) return;

      uData.vanished = true;
      uData.vanishTimer = NINJA_VANISH_DURATION;
      targetUnit.visible = false;
      spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'SMOKE BOMB!', '#bbbbbb');
      spawnSmokeBombEffect(targetWorldPos.clone().add(new THREE.Vector3(0, 0.4, 0)));
    }

    // Damage Processor with Bad North Class Interactions
    // Dragon Ronin passive - Deflect: as long as nothing has closed to
    // melee range on it, any incoming projectile gets swatted out of the
    // air. DRAGON_RONIN_DEFLECT_RANGE mirrors a normal melee engagement
    // distance - once an enemy is that close the ability simply stops
    // triggering, since applyDamage checks this fresh on every hit.
    const DRAGON_RONIN_DEFLECT_RANGE = 1.0;

    // Dragon Ronin passive - Deflect, melee half: a Sekiro-style read on
    // an incoming blade already in melee range, rather than the
    // guaranteed ranged swat above. Every successful parry (melee or
    // ranged) builds posture; DRAGON_RONIN_DEATHBLOW_PARRY_STACKS of them
    // cash in for a free, guaranteed Deathblow - the same instant-kill
    // flame dash as a normal Sword Dash proc. See the Deflect branch in
    // applyDamage.
    const DRAGON_RONIN_MELEE_DEFLECT_CHANCE = 0.35;
    const DRAGON_RONIN_DEATHBLOW_PARRY_STACKS = 3;

    // Slasher passive - Ghost Step, melee half: a straight percentage
    // chance to evade an incoming melee strike outright (no dash flicker,
    // no damage taken) - on top of Ghost Step's existing ranged-projectile
    // deflect above. See the Ghost Step branch in applyDamage.
    const SLASHER_MELEE_EVADE_CHANCE = 0.25;

    // Slasher passive - Ghost Step, ranged half: how long the dash-flicker
    // pose (see the ghostStepDashAnimTimer branch in updateUnitAnims) holds
    // after a successful projectile deflect before falling back to the
    // normal idle/attack pose. Short and sharp, matching the snap-block
    // timing Dragon Ronin's Deflect uses.
    const SLASHER_GHOST_STEP_DASH_ANIM_DURATION = 0.3;

    // Dragon Ronin passive - Deflect animation: how long the snap-block
    // pose (see the 'dragonRonin' branch in updateUnitAnims) holds after a
    // successful parry/deflect before falling back to the normal idle or
    // attack pose. Short and sharp - a Sekiro-style flash-parry rather than
    // a held stance.
    const DRAGON_RONIN_DEFLECT_ANIM_DURATION = 0.3;

    function isDragonRoninInCloseCombat(targetUnit) {
      const pos = new THREE.Vector3();
      targetUnit.getWorldPosition(pos);
      for (const rs of raiderSquads) {
        for (const m of rs.members) {
          if (m === targetUnit || m.userData.hp <= 0) continue;
          const mPos = new THREE.Vector3();
          m.getWorldPosition(mPos);
          if (Math.hypot(mPos.x - pos.x, mPos.z - pos.z) <= DRAGON_RONIN_DEFLECT_RANGE) return true;
        }
      }
      return false;
    }

    // Slasher passive - Ghost Step: used to blink the Slasher straight up
    // to the shooter. Now it deflects the incoming shot in place instead -
    // no relocation, no tile checks - and sells the read with a quick
    // dash-flicker: the assassin snaps into a lunging dash pose (see the
    // ghostStepDashAnimTimer branch in updateUnitAnims) with a short
    // afterimage streak toward the attacker and a shadow burst right where
    // it's standing, then eases back to normal. Always succeeds - unlike
    // the old blink, there's no tile to fail to reach.
    function triggerSlasherGhostStepDeflect(targetUnit, attackerWorldPos) {
      const targetWorldPos = new THREE.Vector3();
      targetUnit.getWorldPosition(targetWorldPos);

      const dx = attackerWorldPos.x - targetWorldPos.x;
      const dz = attackerWorldPos.z - targetWorldPos.z;
      const dist = Math.hypot(dx, dz);
      const dirX = dist > 0.001 ? dx / dist : 0;
      const dirZ = dist > 0.001 ? dz / dist : 1;

      // Face the shooter for the dash-flicker/deflect pose, same as it
      // would turn to face an attacker for a normal strike.
      targetUnit.rotation.y = Math.atan2(dirX, dirZ);
      targetUnit.userData.ghostStepDashAnimTimer = SLASHER_GHOST_STEP_DASH_ANIM_DURATION;

      // Afterimage streak - a short burst of particles along a half-step
      // lurch toward the attacker, reading as a fast dash flicker rather
      // than an actual teleport since the unit's position never changes.
      for (let i = 1; i <= 3; i++) {
        const streakPos = targetWorldPos.clone()
          .add(new THREE.Vector3(dirX * 0.3 * (i / 3), 0.5, dirZ * 0.3 * (i / 3)));
        spawnParticle(streakPos, 0x7fe8ff, 0.09, 0.22);
      }
      // Single shadow burst right where it's standing - the shadow tears
      // open and snaps shut on the spot instead of at a vanish/landing
      // pair like the old blink used.
      spawnShadowExplosion(targetWorldPos.clone());
      spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.6, 0)), 'DEFLECT!', '#7fe8ff');
      return true;
    }

    // Slasher passive - Rooftop Ambush: landing a dagger strike while
    // perched up on a rooftop/boulder (see isOnParkourTile) isn't a normal
    // in-place swing - the Slasher drops straight off its perch and
    // flash-steps right onto the target, the same shadow-tear teleport
    // Ghost Step uses, closing whatever distance separates them in an
    // instant. The target gets caught completely off guard: a brief
    // startled pose (see shockAnimTimer) and a beat of hesitation before
    // the killing blow actually lands, rather than the strike landing the
    // same instant the Slasher appears.
    // Slasher idle - dagger-twirl flourish timing (see the 'slasher' idle
    // branch in animate()'s pose loop). Purely cosmetic personality beat,
    // unrelated to the Rooftop Ambush combat passive just below.
    const SLASHER_FIDGET_ANIM_DURATION = 0.7;   // how long one twirl takes
    const SLASHER_FIDGET_MIN_INTERVAL = 3;      // shortest gap before the next twirl
    const SLASHER_FIDGET_INTERVAL_RANGE = 3;    // added on top, randomized per-unit

    // Steel Revenant idle - "Grindstone" flourish timing (see the
    // 'steelRevenant' idle branch in animate()'s pose loop). Reuses the
    // same generic idleFidgetTimer/idleFidgetAnimTimer fields the Slasher
    // uses above, just on a much slower, heavier cadence befitting a
    // lumbering colossus: a long pause standing motionless over its
    // planted mace, then one slow heave-and-grind of the weapon before
    // settling back down. Purely cosmetic, no gameplay effect.
    const STEEL_REVENANT_FIDGET_ANIM_DURATION = 2.1; // how long one heave-and-grind takes
    const STEEL_REVENANT_FIDGET_MIN_INTERVAL = 4;    // shortest gap before the next one
    const STEEL_REVENANT_FIDGET_INTERVAL_RANGE = 3;  // added on top, randomized per-unit

    // Steel Revenant idle - "Spectral Shudder" flourish timing (see the
    // 'steelRevenant' idle branch in animate()'s pose loop). A second,
    // independent idle beat alongside the Grindstone heave above: a
    // quick full-body glitch-shiver, like the ghost briefly slipping
    // out of phase with the world, on its own separate timer so the
    // two flourishes don't always land together. Purely cosmetic, no
    // gameplay effect.
    const STEEL_REVENANT_SHUDDER_ANIM_DURATION = 0.5;  // how long one shiver takes
    const STEEL_REVENANT_SHUDDER_MIN_INTERVAL = 5;     // shortest gap before the next one
    const STEEL_REVENANT_SHUDDER_INTERVAL_RANGE = 4;   // added on top, randomized per-unit

    const SLASHER_AMBUSH_SHOCK_DURATION = 0.45; // how long the target's startled pose holds
    const SLASHER_AMBUSH_FINISHER_DELAY = 0.25; // beat between the flash-step landing and the killing blow
    const SLASHER_AMBUSH_RETURN_DELAY = 0.35; // beat after the killing blow before hopping back to the rooftop
    const SLASHER_KILL_FLOURISH_DURATION = 0.4; // how long the post-kill blood-flick pose holds

    const pendingSlasherAmbushKills = [];
    const pendingSlasherAmbushReturns = [];

    // Slasher passive (Assassinate) - the visual/animation payoff for a
    // landed guaranteed-kill dagger strike, shared by both the normal
    // in-place stab and the Rooftop Ambush finisher (see the 'slasher'
    // branch in processUnitAttack and updatePendingSlasherAmbushKills) so
    // the two don't drift out of sync with each other. A quick red
    // slash-arc flashes across the target, a blood decal marks the spot,
    // and the attacker gets a brief blood-flick follow-through pose (see
    // the slasherKillFlourishAnimTimer block in updateUnitAnims) instead
    // of snapping straight back to idle the instant the blow lands.
    function triggerSlasherKillFlourish(attackerUnit, targetWorldPos) {
      attackerUnit.userData.slasherKillFlourishAnimTimer = SLASHER_KILL_FLOURISH_DURATION;
      spawnBloodTrailDecal(targetWorldPos.clone(), 0x8a0000);
      for (let i = 0; i < 6; i++) {
        if (bloodEnabled) spawnParticle(targetWorldPos.clone().add(new THREE.Vector3(0, 0.7, 0)), 0xaa0000, 0.09, 0.35, true);
      }
    }

    function triggerSlasherAmbush(attackerUnit, targetUnit, attackerWorldPos) {
      const targetWorldPos = new THREE.Vector3();
      targetUnit.getWorldPosition(targetWorldPos);

      // Slasher is a 4-member squad, not a true singleton like Dragon
      // Ronin - move just this one member's local position (same
      // world-space-delta trick Ghost Step uses on the target) rather than
      // the whole squadGroup, so only the ambushing assassin actually
      // relocates. Snaps to a single straight cardinal direction toward
      // the target and steps one tile at a time so it can't flash straight
      // through a blocker, landing on the closest clear tile next to the
      // target instead.
      const dx = targetWorldPos.x - attackerWorldPos.x;
      const dz = targetWorldPos.z - attackerWorldPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.001) return false;

      // Remembers exactly where up on the rooftop/boulder it jumped from
      // - not just the tile, but the actual perched world height (see
      // surfaceYFor's parkour-height bump) - so it can hop straight back
      // up to that same spot afterward (see pendingSlasherAmbushReturns)
      // instead of being left stranded down at the target's level.
      const rooftopOrigin = attackerWorldPos.clone();

      const straightX = Math.abs(dx) >= Math.abs(dz) ? Math.sign(dx) : 0;
      const straightZ = straightX === 0 ? Math.sign(dz) : 0;
      const originX = attackerWorldPos.x, originZ = attackerWorldPos.z;
      const maxSteps = Math.max(1, Math.round(dist) - 1); // stop one tile short of the target's own tile
      let landX = Math.round(originX), landZ = Math.round(originZ);
      let tilesMoved = 0;
      for (let step = 1; step <= maxSteps; step++) {
        const nextX = Math.round(originX + straightX * step);
        const nextZ = Math.round(originZ + straightZ * step);
        const clear = isTileWalkable(nextX, nextZ) &&
          !buildingTileKeys.has(nextX + ',' + nextZ) &&
          !propTileKeys.has(nextX + ',' + nextZ);
        if (!clear) break;
        landX = nextX; landZ = nextZ; tilesMoved = step;
      }
      // Nowhere clear to land - the ambush fizzles and falls back to a
      // normal in-place strike.
      if (tilesMoved === 0) return false;

      const landY = getSurfaceY(landX, landZ);
      // Shadow explosion where the Slasher vanishes from its perch, before
      // it actually moves - reads as tearing straight down off the roof.
      spawnShadowExplosion(attackerWorldPos.clone());

      attackerUnit.position.x += landX - originX;
      attackerUnit.position.z += landZ - originZ;
      if (landY !== null) attackerUnit.position.y += landY - attackerWorldPos.y;
      // Update its formation "home" too, same reason Ghost Step does -
      // otherwise the knockback-recovery walk would slowly drag it back
      // toward its old rooftop slot.
      attackerUnit.userData.formationOffset = new THREE.Vector3(attackerUnit.position.x, attackerUnit.position.y, attackerUnit.position.z);
      attackerUnit.rotation.y = Math.atan2(-straightX, -straightZ);

      for (let i = 1; i <= 3; i++) {
        const streakPos = attackerWorldPos.clone().lerp(new THREE.Vector3(landX, attackerWorldPos.y, landZ), i / 4).add(new THREE.Vector3(0, 0.5, 0));
        spawnParticle(streakPos, 0x7fe8ff, 0.09, 0.25);
      }
      // Second shadow explosion right beside the target, so the drop reads
      // as tearing out of the rooftop and bursting open right next to it.
      spawnShadowExplosion(new THREE.Vector3(landX, landY !== null ? landY : attackerWorldPos.y, landZ));
      spawnFloatingText(new THREE.Vector3(landX, (landY !== null ? landY : attackerWorldPos.y) + 0.9, landZ), 'AMBUSH!', '#ff2222');

      // The target flinches back in surprise - a startled pose plus a
      // bright flash and a "!" callout - before the actual killing blow
      // lands a beat later (see pendingSlasherAmbushKills below).
      targetUnit.userData.shockAnimTimer = SLASHER_AMBUSH_SHOCK_DURATION;
      spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), '!', '#ffe066');
      spawnParticle(targetWorldPos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xffe066, 0.16, 0.3);

      pendingSlasherAmbushKills.push({
        attackerUnit,
        targetUnit,
        rooftopOrigin,
        timer: SLASHER_AMBUSH_FINISHER_DELAY
      });

      return true;
    }

    // Fires off the actual killing blow for any Rooftop Ambush whose
    // beat-of-hesitation delay has elapsed - kept separate from the
    // teleport/shock-reaction above so the target visibly registers being
    // ambushed before the strike itself lands, the same staggered-timer
    // pattern the Mage's Magic Missile / Cavalry's Volley Fire barrages use.
    function updatePendingSlasherAmbushKills(delta) {
      for (let i = pendingSlasherAmbushKills.length - 1; i >= 0; i--) {
        const k = pendingSlasherAmbushKills[i];
        k.timer -= delta;
        if (k.timer > 0) continue;

        pendingSlasherAmbushKills.splice(i, 1);
        if (!k.attackerUnit || k.attackerUnit.userData.hp <= 0) continue;

        // Queue the hop back up to the rooftop regardless of whether the
        // target is still alive to actually strike (see below) - the
        // Slasher doesn't loiter down at ground level either way, it's
        // straight back up into the shadows.
        pendingSlasherAmbushReturns.push({
          attackerUnit: k.attackerUnit,
          rooftopOrigin: k.rooftopOrigin,
          timer: SLASHER_AMBUSH_RETURN_DELAY
        });

        if (!k.targetUnit || k.targetUnit.userData.hp <= 0) continue;

        const attackerPos = new THREE.Vector3();
        k.attackerUnit.getWorldPosition(attackerPos);
        const ambushTargetPos = new THREE.Vector3();
        k.targetUnit.getWorldPosition(ambushTargetPos);
        // Slasher passive - Assassinate: every landed dagger strike is a
        // guaranteed kill outright, same lethal-bypass path as the normal
        // in-place strike below.
        spawnFloatingText(attackerPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'ASSASSINATE!', '#ff2222');
        triggerSlasherKillFlourish(k.attackerUnit, ambushTargetPos);
        applyDamage(k.targetUnit, 9999, 'cavalryCharge', attackerPos, k.attackerUnit);
      }
    }

    // Hops the Slasher straight back up to the exact rooftop/boulder perch
    // it ambushed from, once the return delay past the killing blow has
    // elapsed - the same flash-step-with-shadow-burst treatment as the
    // trip down, just run in reverse, so it ends the ambush back in its
    // elevated vantage point instead of stranded at ground level next to
    // the corpse.
    function updatePendingSlasherAmbushReturns(delta) {
      for (let i = pendingSlasherAmbushReturns.length - 1; i >= 0; i--) {
        const r = pendingSlasherAmbushReturns[i];
        r.timer -= delta;
        if (r.timer > 0) continue;

        if (!r.attackerUnit || r.attackerUnit.userData.hp <= 0) {
          pendingSlasherAmbushReturns.splice(i, 1);
          continue;
        }

        const squadGroup = r.attackerUnit.parent;
        // If the squad has since been ordered to march somewhere, hold
        // off instead of yanking it back to a rooftop it may now be well
        // clear of - crucially, leave the entry queued rather than
        // dropping it here. It used to be spliced out unconditionally
        // before this check, so a Slasher that happened to still be
        // mid-march the instant its return timer expired lost its trip
        // home for good and was stranded at ground level. Now it just
        // waits and hops back up the moment the squad stops moving.
        if (squadGroup && squadGroup.userData.isMoving) continue;

        pendingSlasherAmbushReturns.splice(i, 1);

        const currentPos = new THREE.Vector3();
        r.attackerUnit.getWorldPosition(currentPos);

        spawnShadowExplosion(currentPos.clone());

        r.attackerUnit.position.x += r.rooftopOrigin.x - currentPos.x;
        r.attackerUnit.position.z += r.rooftopOrigin.z - currentPos.z;
        r.attackerUnit.position.y += r.rooftopOrigin.y - currentPos.y;
        r.attackerUnit.userData.formationOffset = new THREE.Vector3(r.attackerUnit.position.x, r.attackerUnit.position.y, r.attackerUnit.position.z);

        for (let i2 = 1; i2 <= 3; i2++) {
          const streakPos = currentPos.clone().lerp(r.rooftopOrigin, i2 / 4).add(new THREE.Vector3(0, 0.5, 0));
          spawnParticle(streakPos, 0x7fe8ff, 0.09, 0.25);
        }
        spawnShadowExplosion(r.rooftopOrigin.clone());
      }
    }

    // Shared by Valkyrie's Sky Strike passive (see the 'valkyrie' branch in
    // updateCombatSystem's melee block) to identify any unit that fights
    // from range rather than melee - covers every bow/bolt/staff loadout
    // across both player squads and raider factions, plus the Ninja's
    // thrown shuriken, so a Valkyrie dive-kill works the same regardless
    // of which ranged unit it lands on.
    function isRangedUnitType(tUData) {
      if (tUData.hp <= 0) return false;
      if (tUData.unitType === 'archers' || tUData.unitType === 'crossbow' || tUData.unitType === 'mages' || tUData.unitType === 'lich' || tUData.unitType === 'ninja') return true;
      if (tUData.unitType === 'cavalry' && tUData.cavalryWeapon === 'bow') return true;
      if (tUData.unitType === 'militia' && tUData.militiaWeapon === 'bow') return true;
      if (tUData.unitType === 'warElephant' && tUData.elephantRole === 'archer') return true;
      if (tUData.unitType === 'raiders' && (tUData.raiderWeapon === 'bow' || tUData.raiderWeapon === 'wokouBow' || tUData.raiderWeapon === 'banditBow' || tUData.raiderWeapon === 'acolyteBolt' || tUData.raiderWeapon === 'gargoyleBolt')) return true;
      return false;
    }

    function applyDamage(targetUnit, damage, attackerType, attackerWorldPos, attackerUnit, isProjectile = false) {
      const uData = targetUnit.userData;
      if (uData.hp <= 0) return;

      // Enemy nerf: every hit landing on a player-side unit comes from an
      // enemy, so scale it here once. Guaranteed-kill sentinels (9999) are
      // left alone so instant-kill mechanics keep working.
      if (!uData.isEnemy && damage < 9000) damage *= ENEMY_NERF.damage;

      // Siege Engineer passive - Barricade: while its shield timer is
      // still counting down (set by the barricade trigger further below,
      // decremented every frame in processUnitAttack), it's fully immune
      // to any further damage - even attacker types that otherwise
      // bypass shields/Fortitude (bleedTick/burnTick included), since
      // this is a flat immunity window rather than a block chance.
      if (uData.unitType === 'siege' && uData.barricadeShieldTimer > 0) return;

      const targetWorldPos = new THREE.Vector3();
      targetUnit.getWorldPosition(targetWorldPos);

      // Ninja passive (Smoke Bomb) - a vanished Ninja is gone: nothing
      // still in flight toward it (an arrow, a swing already committed)
      // is allowed to land.
      if (uData.unitType === 'ninja' && uData.vanished) {
        return;
      }

      // Cavalry passive (Bleeding) - a periodic tick from an active bleed.
      // Ignores shields/Fortitude entirely (it's already under the skin)
      // and never applies knockback, but still goes through the normal
      // death handling if it's the killing blow.
      if (attackerType === 'bleedTick') {
        uData.hp -= damage;
        spawnFloatingText(targetWorldPos, `-${Math.round(damage)}`, '#c0203a');
        if (uData.hpFillElement) {
          const pct = Math.max(0, (uData.hp / uData.maxHp) * 100);
          uData.hpFillElement.style.width = pct + '%';
        }
        if (uData.hp > 0) maybeTriggerNinjaSmokeBomb(targetUnit, targetWorldPos);
        if (uData.hp > 0) maybeTriggerDragonSecondWind(targetUnit);
        if (uData.hp > 0) maybeTriggerSteelRevenantUnbreakable(targetUnit);
        if (uData.hp <= 0) {
          // Immortal passive - Resurrection: checked before any other
          // death handling, even on a lethal bleed tick.
          if (maybeTriggerImmortalResurrection(targetUnit)) return;
          // Akuma Feral passive - Instant Vanish: skips the drop-weapon/
          // suspected-death roll entirely, even on a lethal bleed tick.
          if (uData.raiderFaction === 'akuma') { vanishAkumaFeral(targetUnit); return; }

          // Desert Bandit passive (Loot & Flee) - same one-time squad-wide
          // roll as the normal damage path; see triggerDesertBanditFlee.
          if (uData.raiderFaction === 'desertBandit') {
            const banditSquad = raiderSquads.find(s => s.members.includes(targetUnit));
            if (banditSquad && !banditSquad.isFleeing && banditSquad.members.length > 1 && Math.random() < DESERT_BANDIT_FLEE_CHANCE) {
              triggerDesertBanditFlee(banditSquad, targetUnit);
              return;
            }
          }
          dropWeapon(targetUnit);
          const wasMounted = uData.isMounted;
          if (wasMounted) killMilitiaHorse(targetUnit);
          const deathChance = wasMounted ? RIDER_SUSPECTED_DEATH_CHANCE : SUSPECTED_DEATH_CHANCE;
          const onLand = getSurfaceY(targetWorldPos.x, targetWorldPos.z) !== null;
          if (onLand && Math.random() < deathChance) {
            startDeathSequence(targetUnit, null);
          } else {
            killUnit(targetUnit, null);
          }
        }
        return;
      }

      // Dragon Ronin passive (Dragon's Breath) - a periodic tick from an
      // active burn. Same shape as bleedTick above: ignores shields/
      // Fortitude and never applies knockback, but still goes through
      // normal death handling if it's the killing blow.
      if (attackerType === 'burnTick') {
        uData.hp -= damage;
        spawnFloatingText(targetWorldPos, `-${Math.round(damage)}`, '#ff6a1a');
        if (uData.hpFillElement) {
          const pct = Math.max(0, (uData.hp / uData.maxHp) * 100);
          uData.hpFillElement.style.width = pct + '%';
        }
        if (uData.hp > 0) maybeTriggerNinjaSmokeBomb(targetUnit, targetWorldPos);
        if (uData.hp > 0) maybeTriggerDragonSecondWind(targetUnit);
        if (uData.hp > 0) maybeTriggerSteelRevenantUnbreakable(targetUnit);
        if (uData.hp <= 0) {
          // Immortal passive - Resurrection: checked before any other
          // death handling, even on a lethal burn tick.
          if (maybeTriggerImmortalResurrection(targetUnit)) return;
          if (uData.raiderFaction === 'akuma') { vanishAkumaFeral(targetUnit); return; }
          if (uData.raiderFaction === 'desertBandit') {
            const banditSquad = raiderSquads.find(s => s.members.includes(targetUnit));
            if (banditSquad && !banditSquad.isFleeing && banditSquad.members.length > 1 && Math.random() < DESERT_BANDIT_FLEE_CHANCE) {
              triggerDesertBanditFlee(banditSquad, targetUnit);
              return;
            }
          }
          dropWeapon(targetUnit);
          const wasMounted = uData.isMounted;
          if (wasMounted) killMilitiaHorse(targetUnit);
          // Burning Death - a fatal burn tick always sends the unit into
          // the panicked "burn" lingering-death sequence (see
          // startDeathSequence/updateDyingUnits) instead of rolling the
          // normal SUSPECTED_DEATH_CHANCE crawl/stagger coinflip; it also
          // marks the corpse to settle charred/burnt once the sequence
          // ends (see createRagdollDeath). Only skipped if it dies out
          // over open water, where there's nowhere to panic-run to.
          uData.isBurningDeath = true;
          const onLand = getSurfaceY(targetWorldPos.x, targetWorldPos.z) !== null;
          if (onLand) {
            startDeathSequence(targetUnit, null, 'burn');
          } else {
            killUnit(targetUnit, null);
          }
        }
        return;
      }

      // War Elephant passive (Venom Arrows) - a periodic tick from an
      // active poison. Same shape as bleedTick/burnTick above: ignores
      // shields/Fortitude entirely and never applies knockback, but still
      // goes through normal death handling if it's the killing blow.
      if (attackerType === 'poisonTick') {
        uData.hp -= damage;
        spawnFloatingText(targetWorldPos, `-${Math.round(damage)}`, '#5fbf3a');
        if (uData.hpFillElement) {
          const pct = Math.max(0, (uData.hp / uData.maxHp) * 100);
          uData.hpFillElement.style.width = pct + '%';
        }
        if (uData.hp > 0) maybeTriggerNinjaSmokeBomb(targetUnit, targetWorldPos);
        if (uData.hp > 0) maybeTriggerDragonSecondWind(targetUnit);
        if (uData.hp > 0) maybeTriggerSteelRevenantUnbreakable(targetUnit);
        if (uData.hp <= 0) {
          // Immortal passive - Resurrection: checked before any other
          // death handling, even on a lethal poison tick.
          if (maybeTriggerImmortalResurrection(targetUnit)) return;
          if (uData.raiderFaction === 'akuma') { vanishAkumaFeral(targetUnit); return; }
          if (uData.raiderFaction === 'desertBandit') {
            const banditSquad = raiderSquads.find(s => s.members.includes(targetUnit));
            if (banditSquad && !banditSquad.isFleeing && banditSquad.members.length > 1 && Math.random() < DESERT_BANDIT_FLEE_CHANCE) {
              triggerDesertBanditFlee(banditSquad, targetUnit);
              return;
            }
          }
          dropWeapon(targetUnit);
          const wasMounted = uData.isMounted;
          if (wasMounted) killMilitiaHorse(targetUnit);
          const deathChance = wasMounted ? RIDER_SUSPECTED_DEATH_CHANCE : SUSPECTED_DEATH_CHANCE;
          const onLand = getSurfaceY(targetWorldPos.x, targetWorldPos.z) !== null;
          if (onLand && Math.random() < deathChance) {
            startDeathSequence(targetUnit, null);
          } else {
            killUnit(targetUnit, null);
          }
        }
        return;
      }

      // Cavalry passive (Charge) - the instant-kill half of a Charge.
      // Bypasses shields and Fortitude entirely, same as Piercing Shot,
      // but is always fatal rather than dealing raw damage.
      if (attackerType === 'cavalryCharge') {
        // Dark Knight passive (Unbreakable) - completely immune to any
        // guaranteed-lethal/instant-kill attack (Cavalry Charge's
        // instant-kill half, Dragon Ronin's Deathblow, Slasher's
        // Assassinate). The blow still lands and still hurts - it's
        // redirected into a normal, defense-respecting hit instead of an
        // outright kill, so a shield can still block it and it can
        // never one-shot the Dark Knight's 300 HP.
        if (uData.isDarkKnight) {
          spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), 'UNBREAKABLE!', '#8899aa');
          applyDamage(targetUnit, DARK_KNIGHT_INSTANT_KILL_IMMUNE_DAMAGE, 'darkKnightBypass', attackerWorldPos, attackerUnit, isProjectile);
          return;
        }
        // Event bosses (Goddess of Death, Goddess of Life) - never fall to a
        // guaranteed-lethal/instant-kill attack (Cavalry Charge's instant-kill
        // half, Dragon Ronin's Deathblow, Slasher's Assassinate), same
        // Unbreakable-style redirect as the Dark Knight above: the blow still
        // lands as a solid, defense-respecting hit instead of an outright kill.
        if (uData.unitType === 'goddessOfDeath' || uData.unitType === 'goddessOfLife') {
          spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), 'UNBREAKABLE!', '#8899aa');
          applyDamage(targetUnit, DARK_KNIGHT_INSTANT_KILL_IMMUNE_DAMAGE, 'darkKnightBypass', attackerWorldPos, attackerUnit, isProjectile);
          return;
        }
        // Goddess of Life passive - Second Dawn: even a guaranteed-lethal hit
        // is answered by her rebirth when it is available.
        if (uData.unitType === 'goddessOfLife' && !(uData.lifeRebirthCooldown > 0)) {
          uData.hp = 0;
          if (uData.hpFillElement) uData.hpFillElement.style.width = '0%';
          if (goddessOfLifeRebirth(targetUnit)) return;
        }
        // Immortal passive - Resurrection: a Charge is always fatal to the
        // hit it lands, but the Immortal still gets its one-time revive
        // like any other lethal hit.
        if (uData.raiderFaction === 'immortal' && !uData.immortalResurrected) {
          uData.hp = 0;
          if (uData.hpFillElement) uData.hpFillElement.style.width = '0%';
          if (maybeTriggerImmortalResurrection(targetUnit)) return;
        }
        // Akuma Feral passive - Instant Vanish: a Charge is always fatal to
        // it same as anything else, but it never gets the gory Impaled
        // treatment - straight to vanishing.
        if (uData.raiderFaction === 'akuma') {
          uData.hp = 0;
          if (uData.hpFillElement) uData.hpFillElement.style.width = '0%';
          vanishAkumaFeral(targetUnit);
          return;
        }
        // Desert Bandit passive (Loot & Flee) - same one-time squad-wide
        // roll as the normal damage path; a Charge is still always fatal
        // to the unit it hits, but the squad can still break off and flee
        // afterward instead of fighting to the last member.
        if (uData.raiderFaction === 'desertBandit') {
          const banditSquad = raiderSquads.find(s => s.members.includes(targetUnit));
          if (banditSquad && !banditSquad.isFleeing && banditSquad.members.length > 1 && Math.random() < DESERT_BANDIT_FLEE_CHANCE) {
            uData.hp = 0;
            if (uData.hpFillElement) uData.hpFillElement.style.width = '0%';
            triggerDesertBanditFlee(banditSquad, targetUnit);
            return;
          }
        }
        spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), 'IMPALED!', '#ff2222');
        const hitDir = attackerWorldPos ? new THREE.Vector3().subVectors(targetWorldPos, attackerWorldPos).normalize() : new THREE.Vector3(0, 1, 0);
        // Shadow Island's Skeleton Warriors have no blood to spill, Demons
        // are left bloodless too, and the Steel Revenant's Soulbound Armor
        // never bleeds either - see steelRevenantSoulDeath for what happens
        // to it instead.
        if (!uData.isSkeleton && !uData.isDemon && !uData.isScarecrow && !uData.isSteelRevenant && !uData.isGargoyle && !uData.isAngel && uData.unitType !== 'goddessOfDeath' && uData.unitType !== 'goddessOfLife') createBloodSplatter(targetWorldPos.clone().add(new THREE.Vector3(0, 0.4, 0)), hitDir, (uData.raiderFaction === 'acolyte' || uData.unitType === 'ghoul') ? ACOLYTE_BLOOD_COLOR : undefined);
        uData.hp = 0;
        if (uData.hpFillElement) uData.hpFillElement.style.width = '0%';
        dropWeapon(targetUnit);
        const wasMounted = uData.isMounted;
        if (wasMounted) killMilitiaHorse(targetUnit);
        const deathChance = wasMounted ? RIDER_SUSPECTED_DEATH_CHANCE : SUSPECTED_DEATH_CHANCE;
        const onLand = getSurfaceY(targetWorldPos.x, targetWorldPos.z) !== null;
        if (onLand && Math.random() < deathChance) {
          startDeathSequence(targetUnit, attackerWorldPos);
        } else {
          killUnit(targetUnit, attackerWorldPos);
        }
        return;
      }

      // Dragon Ronin passive - Deflect (Sekiro-style parry): a ranged
      // attack (arrow, shuriken, thrown javelin, bomb, magic bolt) is
      // swatted clean out of the air for free, as long as no enemy has
      // closed to melee range - the instant something IS that close, its
      // focus shifts to the blade in front of it and the ranged deflect
      // stops triggering. A melee strike instead gets a straight
      // percentage parry read (DRAGON_RONIN_MELEE_DEFLECT_CHANCE),
      // working regardless of range. Either kind of successful parry
      // builds posture, and a run of DRAGON_RONIN_DEATHBLOW_PARRY_STACKS
      // of them earns a free, guaranteed Deathblow on the attacker.
      if (uData.unitType === 'dragonRonin' &&
          attackerType !== 'burnTick' && attackerType !== 'bleedTick' && attackerType !== 'cavalryCharge' &&
          ((isProjectile && !isDragonRoninInCloseCombat(targetUnit)) ||
           (!isProjectile && Math.random() < DRAGON_RONIN_MELEE_DEFLECT_CHANCE))) {
        spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), isProjectile ? 'DEFLECT!' : 'PARRY!', '#ffd35c');
        spawnParticle(targetWorldPos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xffe066, 0.14);
        uData.deflectAnimTimer = DRAGON_RONIN_DEFLECT_ANIM_DURATION;

        uData.roninPostureStacks = (uData.roninPostureStacks || 0) + 1;
        if (uData.roninPostureStacks >= DRAGON_RONIN_DEATHBLOW_PARRY_STACKS && attackerUnit && attackerUnit.userData.hp > 0) {
          uData.roninPostureStacks = 0;
          spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'DEATHBLOW!', '#ff2222');
          triggerDragonSwordDash(targetUnit, attackerUnit, targetWorldPos);
        }
        return;
      }

      // Slasher passive - Ghost Step: same "nothing has closed to melee
      // range yet" gate as Dragon Ronin's Deflect just above (reusing
      // isDragonRoninInCloseCombat directly - it's just a generic "is any
      // raider within melee range of this unit" check despite the name),
      // but a projectile hit is swatted aside in place - a deflect with a
      // dash-flicker animation - rather than a blink to the shooter.
      if (uData.unitType === 'slasher' && isProjectile &&
          attackerType !== 'burnTick' && attackerType !== 'bleedTick' &&
          !isDragonRoninInCloseCombat(targetUnit) &&
          triggerSlasherGhostStepDeflect(targetUnit, attackerWorldPos)) {
        return;
      }

      // Slasher passive - Ghost Step, melee half: a straight percentage
      // chance to sidestep an incoming melee strike outright - no dash
      // flicker, just a clean dodge, since the attacker is already right
      // on top of it.
      if (uData.unitType === 'slasher' && !isProjectile &&
          attackerType !== 'burnTick' && attackerType !== 'bleedTick' &&
          Math.random() < SLASHER_MELEE_EVADE_CHANCE) {
        spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), 'EVADE!', '#c9a0ff');
        spawnParticle(targetWorldPos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0x8a2be2, 0.14);
        return;
      }

      // Kitsune Twinblade passive - Parry & Deflect (Ember Fang): a
      // straight percentage chance to fully turn aside an incoming melee
      // strike (Parry), and a separate, deliberately low chance to also
      // swat aside an incoming projectile (Deflect) - unlike Dragon
      // Ronin's Deflect above, neither half is gated on melee range,
      // since this is read as a straight reflex check rather than a
      // "nothing's closed in yet" ranged swat.
      const KITSUNE_BLADE_PARRY_CHANCE = 0.3;    // melee
      const KITSUNE_BLADE_DEFLECT_CHANCE = 0.12; // ranged - kept low deliberately
      if (uData.unitType === 'kitsuneTwinblade' && uData.kitsuneRole === 'blade' &&
          attackerType !== 'burnTick' && attackerType !== 'bleedTick' && attackerType !== 'cavalryCharge' &&
          ((isProjectile && Math.random() < KITSUNE_BLADE_DEFLECT_CHANCE) ||
           (!isProjectile && Math.random() < KITSUNE_BLADE_PARRY_CHANCE))) {
        spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), isProjectile ? 'DEFLECT!' : 'PARRY!', '#ff8a4d');
        spawnParticle(targetWorldPos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xff8a4d, 0.14);
        return;
      }

      // Archer passive - Piercing Shot: an arrow ignores the target's
      // defensive stats entirely on hit - no shield block, no Fortitude
      // mitigation. It still can't be dodged/reduced, but it also doesn't
      // deal any bonus damage; it simply guarantees the raw damage lands.
      // Wokou passive - Bomb Throw: an exploding bomb is treated the same
      // way - a shield doesn't stop a blast, so it always lands full damage.
      // Akuma Feral passive - Feral Pounce: every attack is a leap that
      // muscles straight through a raised shield the same way, since a
      // shield braced for a swing doesn't stop a full-body pounce.
      // Demon passive (Hellfire Burst) - the explosion's AoE damage
      // bypasses shields the same way an arrow/bomb/pounce does.
      const isPiercingShot = attackerType === 'archers' || attackerType === 'crossbow' || attackerType === 'bomb' || attackerType === 'akumaLeap' || attackerType === 'demonExplosion' || attackerType === 'bearLightning' || attackerType === 'shamanLightning' || attackerType === 'paladinHolyLight' || attackerType === 'paladinLightShock';

      // --- BAD NORTH TACTICAL SHIELD & PIKE LOGIC ---
      let blocked = false;

      // 1. Shield Block: Blocks frontal attacks, including arrows - player
      // Swordsmen and any shield-carrying raider (Sword+Shield, Spear+Shield)
      if (!isPiercingShot && (uData.unitType === 'swords' || uData.hasShield)) {
        // World-space facing = squad heading PLUS this unit's own turn-to-
        // face-target rotation (set in processUnitAttack). Using only the
        // squad's heading ignored that a stationary unit turns to track
        // whichever enemy it's actually trading blows with, so a defender
        // could "block" hits coming from a direction it wasn't even facing.
        const targetRotY = (targetUnit.parent ? targetUnit.parent.rotation.y : 0) + targetUnit.rotation.y;
        const attackDir = new THREE.Vector3().subVectors(attackerWorldPos, targetWorldPos).normalize();
        const facingDir = new THREE.Vector3(Math.sin(targetRotY), 0, Math.cos(targetRotY));

        // Narrowed from a near-full-circle 203 deg cone (dot > -0.2) to a
        // genuine ~130 deg frontal arc (dot > 0.25) - wide enough to feel
        // forgiving, but a shield can no longer block hits from the side or
        // rear, which combined with the facing-direction bug above was
        // making shielded units nearly unkillable in prolonged melees.
        // Ranged attacks (arrows/magic) are still reliably blocked when in
        // the frontal arc. Melee attacks only have a CHANCE to be blocked -
        // lowered so shields don't make units nearly unkillable in
        // prolonged close-combat melees.
        const isMeleeAttacker = attackerType !== 'archers' && attackerType !== 'crossbow' && attackerType !== 'mages' && attackerType !== 'lich' && attackerType !== 'lichFrostNova' && attackerType !== 'lichDeathCoil';
        const MELEE_BLOCK_CHANCE = 0.2;
        const blockRoll = isMeleeAttacker ? Math.random() < MELEE_BLOCK_CHANCE : true;
        if (facingDir.dot(attackDir) > 0.25 && blockRoll) { // Attack from front arc
          blocked = true;
          spawnFloatingText(targetWorldPos, 'BLOCK!', '#3399ff');
          spawnParticle(targetWorldPos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xcccccc, 0.12);

          // Swordsman passive - Shield Bash: blocking a melee hit isn't just
          // free defense, it punishes the attacker with a retaliatory shove.
          // Ranged attacks (arrows/magic) are blocked too but there's no
          // adjacent attacker to physically bash, so this only fires for
          // isMeleeAttacker hits.
          if (uData.unitType === 'swords' && isMeleeAttacker && attackerUnit) {
            triggerShieldBash(targetUnit, attackerUnit);
          }
        }
      } else if (isPiercingShot && (uData.unitType === 'swords' || uData.hasShield)) {
        // Would normally have a chance to raise its shield - Piercing Shot
        // skips straight past it, purely as feedback for the player.
        spawnFloatingText(targetWorldPos, 'PIERCE!', '#ffaa00');
      }

      if (!blocked) {
        // Pikeman passive - Fortitude: while active, incoming damage is
        // reduced 30%. Every hit that actually lands (this one included)
        // refreshes the buff to a fresh 3-second window, so a Pike squad
        // taking sustained fire gets progressively harder to bring down
        // rather than the buff lapsing mid-fight. Piercing Shot bypasses
        // the reduction itself (though the hit still refreshes the timer
        // for whatever non-piercing attacker hits it next).
        if (uData.unitType === 'pikes') {
          if (uData.fortitudeTimer > 0) {
            if (isPiercingShot) {
              spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), 'PIERCE!', '#ffaa00');
            } else {
              damage *= (1 - FORTITUDE_DEFENSE_REDUCTION);
              spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), 'FORTITUDE!', '#c9a24b');
            }
          }
          uData.fortitudeTimer = FORTITUDE_DURATION;
        }

        // Elite Swordsman passive - Last Stand: while the buff is active,
        // incoming damage is cut down sharply. Doesn't get re-announced on
        // every hit like Fortitude - just quietly reduces damage for as
        // long as the timer (refreshed below, once HP is actually at or
        // under the threshold) keeps running.
        if (uData.unitType === 'eliteSwordsmen' && uData.lastStandTimer > 0) {
          damage *= (1 - LAST_STAND_DEFENSE_REDUCTION);
        }

        // Lich passive - Frost Armor: unlike Last Stand above, this is a
        // permanent, unconditional reduction rather than a low-HP-triggered
        // buff - a flat chill radiating off it that shaves down every hit
        // it takes, no timer or threshold involved.
        if (uData.unitType === 'lich') {
          damage *= (1 - LICH_FROST_ARMOR_REDUCTION);
        }

        // Chakram Dancers passive - Spinning Shield: any active
        // overshield (topped up on every attack - see
        // applyChakramDancerShield) absorbs damage before it ever
        // touches HP, only the leftover beyond what the shield can
        // soak actually reduces HP.
        if (uData.absorbShield > 0) {
          const absorbed = Math.min(uData.absorbShield, damage);
          uData.absorbShield -= absorbed;
          damage -= absorbed;
          if (uData.hpShieldFillElement) {
            uData.hpShieldFillElement.style.width = Math.max(0, (uData.absorbShield / uData.maxHp) * 100) + '%';
          }
          if (absorbed > 0) {
            spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.45, 0)), `-${Math.round(absorbed)} SHIELD`, '#46d2ff');
          }
        }

        uData.hp -= damage;

        // Kitsune Twinblade passive - Guardian's Ward: whenever Frost
        // Warden takes a hit and survives it, a chance to shield both
        // her and Ember Fang - see triggerKitsuneGuardianWard.
        if (uData.unitType === 'kitsuneTwinblade' && uData.kitsuneRole === 'spear' && uData.hp > 0 && Math.random() < KITSUNE_WARD_CHANCE) {
          triggerKitsuneGuardianWard(targetUnit);
        }

        // Elite Swordsman passive - Last Stand trigger: once this hit
        // leaves the unit at or below LAST_STAND_HP_THRESHOLD (and it's
        // still alive), turn the defense buff on (or refresh its window if
        // already running) for LAST_STAND_DURATION seconds. Only announces
        // the moment it first kicks in, not every refresh.
        if (uData.unitType === 'eliteSwordsmen' && uData.hp > 0 && (uData.hp / uData.maxHp) <= LAST_STAND_HP_THRESHOLD) {
          if (uData.lastStandTimer <= 0) {
            spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), 'LAST STAND!', '#ff5566');
          }
          uData.lastStandTimer = LAST_STAND_DURATION;
        }

        // Realistic Blood Impact Splatter - Shadow Island's Skeleton
        // Warriors have no blood to spill, Demons are left bloodless too
        // (their fiery Hellfire Burst on death is effect enough), the
        // Steel Revenant's Soulbound Armor never bleeds either, and
        // neither the straw-stuffed Scarecrow nor the stone-bodied
        // Gargoyle have any blood in them at all.
        if (!uData.isSkeleton && !uData.isDemon && !uData.isScarecrow && !uData.isSteelRevenant && !uData.isGargoyle && !uData.isAngel && uData.unitType !== 'goddessOfDeath' && uData.unitType !== 'goddessOfLife') {
          const hitDir = attackerWorldPos ? new THREE.Vector3().subVectors(targetWorldPos, attackerWorldPos).normalize() : new THREE.Vector3(0, 1, 0);
          createBloodSplatter(targetWorldPos.clone().add(new THREE.Vector3(0, 0.4, 0)), hitDir, (uData.raiderFaction === 'acolyte' || uData.unitType === 'ghoul') ? ACOLYTE_BLOOD_COLOR : undefined);
        }
        // A Scarecrow has no blood - a hit knocks loose a puff of straw instead.
        if (uData.isScarecrow) {
          for (let i = 0; i < 3; i++) {
            spawnParticle(targetWorldPos.clone().add(new THREE.Vector3(0, 0.4, 0)), SCARECROW_STRAW_COLOR, 0.07 + Math.random() * 0.05, 0.4 + Math.random() * 0.2);
          }
        }

        spawnFloatingText(targetWorldPos, `-${Math.round(damage)}`, isEnemyUnit(targetUnit) ? '#ff4444' : '#ff9999');

        // Hurt Stun Animation
        uData.stunTimer = 0.2;

        // Doctor passive - Retreat: having no attack of its own to
        // trade back, a Doctor steps a full tile directly away from
        // whoever just hit it instead of taking the normal physics-based
        // knockback below - an immediate, deliberate repositioning
        // rather than a shove that decays back to a stop. Same flat
        // "1 tile = 1 world unit" convention as MELEE_ENGAGE_RANGE.
        if (uData.unitType === 'doctor' && attackerWorldPos) {
          const retreatDir = new THREE.Vector3(targetWorldPos.x - attackerWorldPos.x, 0, targetWorldPos.z - attackerWorldPos.z);
          if (retreatDir.lengthSq() > 0.0001) retreatDir.normalize(); else retreatDir.set(0, 0, 1);
          targetUnit.position.addScaledVector(retreatDir, DOCTOR_RETREAT_DISTANCE);
          const retreatWorldPos = new THREE.Vector3();
          targetUnit.getWorldPosition(retreatWorldPos);
          const retreatSurfY = getSurfaceY(retreatWorldPos.x, retreatWorldPos.z);
          if (retreatSurfY !== null) targetUnit.position.y += (retreatSurfY - retreatWorldPos.y);
        }

        // Siege Engineer passive - Barricade: rather than stepping away
        // like the Doctor, it plants a wooden barricade right where it's
        // standing, ducks down behind it (hidden - see updateUnitUI and
        // the raiderTargetableUnits filter above), and goes fully immune
        // to damage for BARRICADE_SHIELD_DURATION seconds (see the
        // early-return at the top of applyDamage) - the hit that
        // triggered this still lands, but nothing else does until the
        // shield runs out. Retriggering mid-shield (another hit landing
        // in the brief window before it's actually hidden) just refreshes
        // the timer instead of stacking a second barricade prop on top of
        // the first or re-triggering the hide.
        if (uData.unitType === 'siege') {
          const alreadyTakingCover = uData.barricadeShieldTimer > 0;
          uData.barricadeShieldTimer = BARRICADE_SHIELD_DURATION;
          if (!alreadyTakingCover) {
            spawnSiegeBarricade(targetWorldPos.clone());
            targetUnit.visible = false;
            spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.5, 0)), 'Takes Cover!', '#e8c27a');
          }
        }

        // Apply Knockback (Mages and Wokou bombs apply heavy knockback).
        // Flattened to the horizontal plane - attacker/target world
        // positions can differ in height (weapon tip, terrain slope), and a
        // raw 3D direction let knockback shove a unit downward into the
        // ground instead of just away from the attacker.
        if (uData.unitType !== 'doctor' && uData.unitType !== 'siege' && attackerWorldPos) {
          const kbForce = (attackerType === 'mages' || attackerType === 'bomb') ? 1.8 : 0.4;
          const dir = new THREE.Vector3(targetWorldPos.x - attackerWorldPos.x, 0, targetWorldPos.z - attackerWorldPos.z);
          if (dir.lengthSq() > 0.0001) dir.normalize();
          uData.knockbackVel.add(dir.multiplyScalar(kbForce));
        }

        // Update UI Fill
        if (uData.hpFillElement) {
          const pct = Math.max(0, (uData.hp / uData.maxHp) * 100);
          uData.hpFillElement.style.width = pct + '%';
        }

        if (uData.hp > 0) maybeTriggerNinjaSmokeBomb(targetUnit, targetWorldPos);
        if (uData.hp > 0) maybeTriggerDragonSecondWind(targetUnit);
        if (uData.hp > 0) maybeTriggerSteelRevenantUnbreakable(targetUnit);

        // Check Death - a chance to enter the lingering "suspected death"
        // sequence (crawl or stagger-and-kneel) instead of dying instantly.
        // Only triggers on land; units killed over water always die outright
        // since there's no ground to crawl/stagger/bleed onto.
        if (uData.hp <= 0) {
          // Ghoul passive (Cannibalize) - the instant this Ghoul's own
          // swing lands a killing blow, it heals a portion of its own
          // missing HP. Checked before any of the victim's own death
          // passives below since it belongs to the attacker, not the
          // target, and none of those can undo a kill that already
          // landed.
          if (attackerUnit && attackerUnit.userData.unitType === 'ghoul' && attackerUnit.userData.hp > 0) {
            triggerGhoulCannibalize(attackerUnit);
          }

          // Immortal passive - Resurrection: checked before any other
          // death handling - see maybeTriggerImmortalResurrection.
          if (maybeTriggerImmortalResurrection(targetUnit)) return;

          // Akuma Feral passive - Instant Vanish: never staggers, crawls,
          // or leaves a body behind - see vanishAkumaFeral.
          if (uData.raiderFaction === 'akuma') { vanishAkumaFeral(targetUnit); return; }

          // Desert Bandit passive - Loot & Flee: rolled once per warband,
          // the instant one of its members would otherwise die. On a
          // success the whole squad breaks off and retreats to its boat
          // instead of this unit going through the normal death sequence.
          if (uData.raiderFaction === 'desertBandit') {
            const banditSquad = raiderSquads.find(s => s.members.includes(targetUnit));
            if (banditSquad && !banditSquad.isFleeing && banditSquad.members.length > 1 && Math.random() < DESERT_BANDIT_FLEE_CHANCE) {
              triggerDesertBanditFlee(banditSquad, targetUnit);
              return;
            }
          }

          // Weapon hits the ground the instant the killing blow lands,
          // whether the unit then dies outright or lingers a while first.
          dropWeapon(targetUnit);

          // The horse (if any) always dies the instant its rider takes the
          // killing blow - it's detached from the rider and collapses on
          // its own, independently of whatever the rider does next.
          const wasMounted = uData.isMounted;
          if (wasMounted) killMilitiaHorse(targetUnit);

          // A thrown rider gets a better shot at lingering than a foot
          // soldier would, since the horse (not the rider) usually absorbs
          // the worst of the killing blow.
          const deathChance = wasMounted ? RIDER_SUSPECTED_DEATH_CHANCE : SUSPECTED_DEATH_CHANCE;

          const onLand = getSurfaceY(targetWorldPos.x, targetWorldPos.z) !== null;
          if (onLand && Math.random() < deathChance) {
            startDeathSequence(targetUnit, attackerWorldPos);
          } else {
            killUnit(targetUnit, attackerWorldPos);
          }
        }
      }
    }

    // Ghoul passive (Cannibalize) - heals the Ghoul for a portion of its
    // own missing HP the instant one of its attacks lands a killing blow
    // (see the attacker check in applyDamage's generic death block
    // above). A simplified, self-triggered take on Warcraft 3's
    // Cannibalize (which lets a Ghoul feed on any nearby corpse) - here
    // it fires specifically off its own kills rather than scanning for
    // corpses in range.
    function triggerGhoulCannibalize(unit) {
      const uData = unit.userData;
      const missing = uData.maxHp - uData.hp;
      if (missing <= 0) return;
      uData.hp = Math.min(uData.maxHp, uData.hp + missing * GHOUL_CANNIBALIZE_HEAL_PCT);
      if (uData.hpFillElement) {
        const pct = Math.max(0, (uData.hp / uData.maxHp) * 100);
        uData.hpFillElement.style.width = pct + '%';
      }
      const worldPos = new THREE.Vector3();
      unit.getWorldPosition(worldPos);
      spawnFloatingText(worldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), `+${Math.round(missing * GHOUL_CANNIBALIZE_HEAL_PCT)}`, '#7fd97f');
    }

    // Swordsman passive - Shield Bash: fires when a blocked melee hit lands
    // on a player Swordsman (see applyDamage above). Re-enters the normal
    // damage pipeline against the attacker for a flat retaliation hit
    // (blood, knockback, and death-handling all come along for free), then
    // layers extra stagger on top so a bashed attacker is knocked off its
    // rhythm rather than just flinching like a regular hit would.
    const SHIELD_BASH_DAMAGE = 10;
    const SHIELD_BASH_STUN = 0.6;

    function triggerShieldBash(defenderUnit, attackerUnit) {
      if (!attackerUnit || attackerUnit.userData.hp <= 0) return;

      const defenderPos = new THREE.Vector3();
      defenderUnit.getWorldPosition(defenderPos);
      const attackerPos = new THREE.Vector3();
      attackerUnit.getWorldPosition(attackerPos);

      spawnFloatingText(attackerPos.clone().add(new THREE.Vector3(0, 0.3, 0)), 'BASH!', '#ffdd55');
      spawnParticle(attackerPos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xffe066, 0.14);

      applyDamage(attackerUnit, SHIELD_BASH_DAMAGE, 'swords', defenderPos);

      if (attackerUnit.userData.hp > 0) {
        attackerUnit.userData.stunTimer = Math.max(attackerUnit.userData.stunTimer, SHIELD_BASH_STUN);
      }
    }

    // Heal Processor - counterpart to applyDamage, used by the Cleric NPC
    function healUnit(targetUnit, amount) {
      const uData = targetUnit.userData;
      if (uData.hp <= 0 || uData.hp >= uData.maxHp) return false;

      uData.hp = Math.min(uData.maxHp, uData.hp + amount);

      if (uData.hpFillElement) {
        const pct = Math.max(0, (uData.hp / uData.maxHp) * 100);
        uData.hpFillElement.style.width = pct + '%';
      }

      const targetWorldPos = new THREE.Vector3();
      targetUnit.getWorldPosition(targetWorldPos);
      spawnFloatingText(targetWorldPos, `+${Math.round(amount)}`, '#66ff88');
      spawnParticle(targetWorldPos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0x66ffaa, 0.09, 0.5);
      return true;
    }

    // Viking Shaman "Spirit Ward" pulse - a ring of teal rune sparks that
    // bursts outward along the ground to the edge of SHAMAN_HEAL_RANGE and
    // falls back down, using the shared activeParticles physics (gravity
    // pulls each spark back to ground level by the end of its 0.5s life).
    function spawnShamanWardRing(centerPos) {
      const SPARKS = 20;
      const outward = SHAMAN_HEAL_RANGE / 0.5;
      for (let i = 0; i < SPARKS; i++) {
        const a = (i / SPARKS) * Math.PI * 2;
        const pMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.06, 0.06),
          new THREE.MeshBasicMaterial({ color: 0x7dffd8, transparent: true, opacity: 0.9 })
        );
        pMesh.position.copy(centerPos).add(new THREE.Vector3(0, 0.08, 0));
        scene.add(pMesh);
        activeParticles.push({
          mesh: pMesh,
          velocity: new THREE.Vector3(Math.cos(a) * outward, 2.4, Math.sin(a) * outward),
          duration: 0.5,
          age: 0,
          isGore: false
        });
      }
    }

    // Fires once, the instant the last raider on the island falls, if a
    // Monk is alive to bless the troops. Heals every living player squad
    // member for MONK_POST_FIGHT_HEAL_PCT of its own max HP.
    function applyMonkPostFightHeal() {
      const monkAlive = villagers.some(v => v.npcKind === 'monk' && !v.dead);
      if (!monkAlive) return;

      squads.forEach(s => {
        s.members.forEach(unit => {
          const ud = unit.userData;
          if (ud.hp <= 0) return;
          healUnit(unit, ud.maxHp * MONK_POST_FIGHT_HEAL_PCT);
        });
      });
    }

    function isEnemyUnit(unit) {
      return unit.userData.isEnemy;
    }

    // Skeleton Mesh Builder for Decayed Corpses
    function createSkeletonMesh() {
      const skelGroup = new THREE.Group();

      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.35, 0.16), boneMat);
      rib.position.y = 0.5;
      skelGroup.add(rib);

      const skull = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), boneMat);
      skull.position.y = 0.85;
      skelGroup.add(skull);

      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), darkWoodMat);
      eyeL.position.set(-0.05, 0.87, 0.11);
      const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), darkWoodMat);
      eyeR.position.set(0.05, 0.87, 0.11);
      skelGroup.add(eyeL, eyeR);

      const limbGeo = new THREE.BoxGeometry(0.08, 0.35, 0.08);
      const armL = new THREE.Mesh(limbGeo, boneMat);
      armL.position.set(-0.2, 0.5, 0);
      const armR = new THREE.Mesh(limbGeo, boneMat);
      armR.position.set(0.2, 0.5, 0);
      const legL = new THREE.Mesh(limbGeo, boneMat);
      legL.position.set(-0.09, 0.2, 0);
      const legR = new THREE.Mesh(limbGeo, boneMat);
      legR.position.set(0.09, 0.2, 0);

      skelGroup.add(armL, armR, legL, legR);
      return skelGroup;
    }

    // Low-poly Crow / Seagull Builder (for carrion birds)
    function createBirdMesh(type) {
      const isCrow = type === 'crow';
      const bodyColor = isCrow ? 0x1c1c1c : 0xf5f5f2;
      const wingColor = isCrow ? 0x0d0d0d : 0xdedede;
      const beakColor = isCrow ? 0x2e2e2e : 0xff9933;

      const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const wingMat = new THREE.MeshLambertMaterial({ color: wingColor });
      const beakMat = new THREE.MeshLambertMaterial({ color: beakColor });

      const group = new THREE.Group();

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.24), bodyMat);
      body.position.y = 0.1;
      body.castShadow = true;
      group.add(body);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), bodyMat);
      head.position.set(0, 0.17, 0.13);
      head.castShadow = true;
      group.add(head);

      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.09, 4), beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.16, 0.2);
      group.add(beak);

      function makeWing(sign) {
        const pivot = new THREE.Group();
        pivot.position.set(sign * 0.05, 0.13, 0);
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.1), wingMat);
        wing.position.set(sign * 0.12, 0, 0);
        wing.castShadow = true;
        pivot.add(wing);
        return pivot;
      }
      const wingL = makeWing(-1);
      const wingR = makeWing(1);
      group.add(wingL, wingR);

      return { group, wingL, wingR, head };
    }

    // Spawn 1-4 crows/seagulls diving in from the sky to land and peck at a corpse.
    // Only ever called on fresh (non-skeleton) bodies - see the age-40s trigger below.
    function spawnCarrionBirds(rag) {
      const count = 1 + Math.floor(Math.random() * 4); // 1 to 4 birds
      for (let i = 0; i < count; i++) {
        const type = Math.random() < 0.5 ? 'crow' : 'seagull';
        const built = createBirdMesh(type);

        const angle = Math.random() * Math.PI * 2;
        const perchRadius = 0.18 + Math.random() * 0.16;

        const startPos = rag.group.position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          BIRD_SKY_HEIGHT + Math.random() * 2,
          (Math.random() - 0.5) * 3
        ));
        built.group.position.copy(startPos);
        built.group.rotation.y = Math.random() * Math.PI * 2;
        scene.add(built.group);

        birds.push({
          mesh: built.group,
          wingL: built.wingL,
          wingR: built.wingR,
          head: built.head,
          type,
          state: 'incoming', // incoming -> eating -> fleeing
          offsetX: Math.cos(angle) * perchRadius,
          offsetZ: Math.sin(angle) * perchRadius,
          rag,
          flapPhase: Math.random() * Math.PI * 2,
          peckPhase: Math.random() * Math.PI * 2,
          eatTimer: BIRD_EAT_DURATION_MIN + Math.random() * (BIRD_EAT_DURATION_MAX - BIRD_EAT_DURATION_MIN),
          fleeTimer: 0
        });
      }
    }

    // Physical Physics Ragdoll Creation with Gore & Dismemberment
    function createRagdollDeath(unit, attackerWorldPos, forceMultiplier = 1) {
      const uData = unit.userData;
      const originPos = new THREE.Vector3();
      unit.getWorldPosition(originPos);

      const ragGroup = new THREE.Group();
      ragGroup.position.copy(originPos);
      // Match the unit's actual on-screen size (squads render at 0.6 scale)
      // so the ragdoll doesn't suddenly pop to a different size at death.
      const worldScale = new THREE.Vector3();
      unit.getWorldScale(worldScale);
      ragGroup.scale.copy(worldScale);
      // Use the unit's actual world-facing angle rather than assuming its
      // parent holds the facing rotation - dying units are detached directly
      // into the scene and carry their own facing on unit.rotation.y.
      const worldQuat = new THREE.Quaternion();
      unit.getWorldQuaternion(worldQuat);
      ragGroup.rotation.y = new THREE.Euler().setFromQuaternion(worldQuat, 'YXZ').y;

      // Determine dismemberment chance - skipped for a gentle, low-force
      // collapse (e.g. the end of a "suspected death" sequence) so no limbs
      // go flying on what should be a quiet collapse.
      const isDismembered = forceMultiplier > 0.5 && Math.random() < 0.55;
      const severedPart = isDismembered ? ['head', 'armL', 'armR', 'legL'][Math.floor(Math.random() * 4)] : null;

      // Calculate death impulse force vector
      const hitVector = attackerWorldPos ? new THREE.Vector3().subVectors(originPos, attackerWorldPos).normalize() : new THREE.Vector3(0, 0, 1);
      hitVector.y = 0.6 + Math.random() * 0.5;
      hitVector.normalize();

      const impactForce = (3.5 + Math.random() * 2.5) * forceMultiplier;

      // Single shared velocity/rotation for the whole ragdoll body (torso + attached limbs).
      // Previously each limb got its own velocity but all wrote into the SAME rag.group.position,
      // which summed several velocities into one position every frame (bodies rocketing into the
      // air) and let each limb's own isGrounded flag fight over that shared position afterward
      // (bodies twitching/hovering above the ground). Now the body moves as one rigid object.
      const groupVelocity = hitVector.clone().multiplyScalar(impactForce);
      const groupRotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 6 * forceMultiplier,
        0,
        (Math.random() - 0.5) * 6 * forceMultiplier
      );

      // Read the pants color straight off the living unit's own leg mesh
      // rather than hardcoding gray - raiders get re-skinned per Biome
      // Theme (see RAIDER_THEME_CONFIG/WOKOU_THEME/AKUMA_THEME) and their
      // corpses should keep that theme's pants color instead of reverting
      // to the old default.
      const livePantsColor = uData.meshLegL && uData.meshLegL.material
        ? uData.meshLegL.material.color.getHex()
        : (uData.meshLegR && uData.meshLegR.material ? uData.meshLegR.material.color.getHex() : 0x333333);

      // Skeleton Warriors keep the same bare bone-white override here as
      // createBlockyHumanoid, instead of reverting to uData.shirtColor's
      // tattered-clothing tint - otherwise the ragdoll would pop back to
      // a fleshed-out look for the moment before it decays into the bare
      // createSkeletonMesh prop below.
      const bodyMat = new THREE.MeshLambertMaterial({ color: uData.isSkeleton ? 0xe3dac9 : (uData.shirtColor || 0x333333) });
      // Zombie allies keep their sickly green reanimated-flesh tint on the
      // corpse too, instead of reverting to a normal fleshy skin tone the
      // instant they go down. The Steel Revenant has no exposed flesh at
      // all when alive (see createBlockyHumanoid's isSteelRevenant branch,
      // where its head/arms use the same dark plate material as its
      // torso) - its ragdoll's "skin" parts follow suit here instead of
      // popping to a stray patch of tan human skin.
      // Orc corpses keep their own green skin tone here too, instead of
      // popping to a stray patch of tan human skin the instant they go
      // down - same idea as the Zombie/Steel Revenant/Bear overrides
      // above (see ORC_SKIN_COLOR, the same color createBlockyHumanoid's
      // isOrc branch uses while alive).
      // Ghoul and Gargoyle corpses keep their own rotting-flesh/stone
      // skin tones for the same reason (see GHOUL_SKIN_COLOR/
      // GARGOYLE_STONE_COLOR, the same colors createBlockyHumanoid's
      // isGhoul/isGargoyle branches use while alive).
      const skinMat = new THREE.MeshLambertMaterial({ color: uData.isSkeleton ? 0xe3dac9 : (uData.isZombie ? ZOMBIE_SKIN_TINT : (uData.isSteelRevenant ? (uData.shirtColor || 0x101114) : (uData.isOrc ? ORC_SKIN_COLOR : ((uData.isBear || uData.raiderFaction === 'bear') ? BEAR_FUR_COLOR : (uData.isGhoul ? (uData.isCrimsonGhoul ? CRIMSON_GHOUL_SKIN_COLOR : GHOUL_SKIN_COLOR) : (uData.isGargoyle ? GARGOYLE_STONE_COLOR : (uData.isEnemy ? 0xccaa88 : 0xffcc99))))))) });
      const pantsMat = new THREE.MeshLambertMaterial({ color: livePantsColor });

      // Burning Death - a corpse that finished the panicked "burn"
      // lingering-death sequence (see updateDyingUnits) settles charred
      // and blackened, overriding every other race/faction skin, shirt
      // and pants tint above - fire doesn't care what color the cloth or
      // flesh used to be.
      if (uData.isBurningDeath) {
        bodyMat.color.setHex(BURNT_BODY_COLOR);
        skinMat.color.setHex(BURNT_SKIN_COLOR);
        pantsMat.color.setHex(BURNT_PANTS_COLOR);
        uData.isBurningDeath = false;
      }

      const parts = [];

      function addRagPart(mesh, name, relPos, isSevered) {
        mesh.castShadow = true;
        mesh.position.copy(relPos);

        let partObj;
        if (isSevered) {
          // Dismembered limbs fly off independently and need their own full physics state.
          const partVelocity = hitVector.clone().multiplyScalar(impactForce * 1.4);
          partVelocity.x += (Math.random() - 0.5) * 2;
          partVelocity.z += (Math.random() - 0.5) * 2;
          partVelocity.y += 1.5;

          partObj = {
            mesh,
            name,
            velocity: partVelocity,
            rotVel: new THREE.Vector3(
              (Math.random() - 0.5) * 12,
              (Math.random() - 0.5) * 12,
              (Math.random() - 0.5) * 12
            ),
            isGrounded: false,
            isFloating: false,
            floatPhase: 0,
            driftDir: new THREE.Vector3(),
            isSevered
          };
        } else {
          // Attached limbs move with the shared rag.group body - only a small local
          // rotation wobble here for visual flair, no independent position/velocity.
          partObj = {
            mesh,
            name,
            rotVel: new THREE.Vector3(
              (Math.random() - 0.5) * 4,
              (Math.random() - 0.5) * 4,
              (Math.random() - 0.5) * 4
            ),
            isSevered
          };
        }

        if (isSevered) {
          // Dismembered limb flies independently in scene space - scale it to
          // match the body it came from so it doesn't look mismatched in size.
          mesh.scale.copy(worldScale);
          mesh.position.add(originPos);
          scene.add(mesh);

          // Gore blood fountain at dismemberment site - Shadow Island's
          // Skeleton Warriors have no blood to spill, just bones flying
          // apart, the Steel Revenant's Soulbound Armor never bleeds
          // either - just empty plate - and neither the Scarecrow nor
          // the Gargoyle have any blood in them at all.
          if (bloodEnabled && !uData.isSkeleton && !uData.isSteelRevenant && !uData.isScarecrow && !uData.isGargoyle && !uData.isAngel) {
            for (let i = 0; i < 8; i++) {
              spawnParticle(mesh.position, (uData.raiderFaction === 'acolyte' || uData.unitType === 'ghoul') ? ACOLYTE_BLOOD_COLOR : 0x880000, 0.08, 0.8, true);
            }
          }
        } else {
          ragGroup.add(mesh);
        }

        parts.push(partObj);
      }

      // Carry over any cosmetic add-ons the living unit was wearing so the
      // corpse still reads as the same unit instead of reverting to a bare
      // generic body - headband/face mask/Oni mask/samurai hair/Ronin hat
      // all live as children of uData.head, and the Ronin robe/Paladin
      // armor+cape live as children of uData.body (see createBlockyHumanoid).
      // Cloned (not moved) since the living meshes are about to be discarded
      // with the rest of the unit anyway, but cloning keeps this safe even
      // if that ever changes.
      function copyCosmetics(liveMesh, ragMesh) {
        if (!liveMesh) return;
        liveMesh.children.forEach(child => {
          ragMesh.add(child.clone(true));
        });
      }

      // Same hollow dark eye sockets createBlockyHumanoid adds to a living
      // Skeleton Warrior's head - kept on the ragdoll head too so it still
      // reads as a skull for the moment before it decays into the bare
      // createSkeletonMesh prop.
      function addSkullEyeSockets(headMesh) {
        const eyeSocketMat = new THREE.MeshLambertMaterial({ color: 0x3d2314 });
        const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), eyeSocketMat);
        eyeL.position.set(-0.06, 0.02, 0.151);
        const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), eyeSocketMat);
        eyeR.position.set(0.06, 0.02, 0.151);
        headMesh.add(eyeL, eyeR);
      }

      // Same isSkeleton size overrides as createBlockyHumanoid, so a
      // Skeleton Warrior's ragdoll doesn't pop from thin bare bones back
      // to a fleshed-out human silhouette for the moment before it
      // decays into the bare createSkeletonMesh prop.
      const ragBodyGeo = uData.isSkeleton ? [0.26, 0.4, 0.16] : [0.35, 0.45, 0.22];
      const ragLimbGeo = uData.isSkeleton ? [0.08, 0.4, 0.08] : [0.12, 0.4, 0.12];
      const ragLegGeo = uData.isSkeleton ? [0.09, 0.3, 0.09] : [0.14, 0.3, 0.14];

      // 1. Torso Body
      // Orcs (and Bear Warriors) go shirtless while alive - their torso
      // uses skinMat, not bodyMat, in createBlockyHumanoid (see the
      // isOrc/isBear check on `body`'s material there). Mirrored here so
      // the corpse's torso doesn't pop to bodyMat's shirtColor/gray
      // fallback the instant it goes down. Ghoul/Gargoyle are bare-torso
      // creatures too (see createBlockyHumanoid's isGhoul/isGargoyle
      // branches), so their ragdoll torso needs the same skinMat
      // override rather than popping to a "shirt" they never had.
      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(...ragBodyGeo), (uData.isOrc || uData.isBear || uData.raiderFaction === 'bear' || uData.isGhoul || uData.isGargoyle) ? skinMat : bodyMat);
      copyCosmetics(uData.body, bodyMesh);
      addRagPart(bodyMesh, 'torso', new THREE.Vector3(0, 0.525, 0), false);

      // 2. Head
      if (severedPart !== 'head') {
        const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skinMat);
        copyCosmetics(uData.head, headMesh);
        if (uData.isSkeleton) addSkullEyeSockets(headMesh);
        addRagPart(headMesh, 'head', new THREE.Vector3(0, 0.9, 0), false);
      } else {
        const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skinMat);
        copyCosmetics(uData.head, headMesh);
        if (uData.isSkeleton) addSkullEyeSockets(headMesh);
        addRagPart(headMesh, 'head', new THREE.Vector3(0, 0.9, 0), true);
      }

      // 3. Left Arm
      const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(...ragLimbGeo), skinMat);
      addRagPart(armLMesh, 'armL', new THREE.Vector3(-0.24, 0.5, 0), severedPart === 'armL');

      // 4. Right Arm
      const armRMesh = new THREE.Mesh(new THREE.BoxGeometry(...ragLimbGeo), skinMat);
      addRagPart(armRMesh, 'armR', new THREE.Vector3(0.24, 0.5, 0), severedPart === 'armR');

      // 5. Left Leg
      const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(...ragLegGeo), pantsMat);
      addRagPart(legLMesh, 'legL', new THREE.Vector3(-0.1, 0.15, 0), severedPart === 'legL');

      // 6. Right Leg
      const legRMesh = new THREE.Mesh(new THREE.BoxGeometry(...ragLegGeo), pantsMat);
      addRagPart(legRMesh, 'legR', new THREE.Vector3(0.1, 0.15, 0), false);

      scene.add(ragGroup);

      // Skeleton representation for 2-minute decay cycle
      const skelMesh = createSkeletonMesh();
      skelMesh.visible = false;
      ragGroup.add(skelMesh);

      const ragdollRecord = {
        group: ragGroup,
        parts,
        skelMesh,
        age: 0,
        decayTime: 120, // 2 minutes (120 seconds) decay transition
        isDecayed: false,
        // Shadow Island Skeleton Warriors are already bare bone - they never
        // decay further and never get scavenged, so their corpses are exempt
        // from the decay clock and the carrion-bird roll below.
        isSkeleton: !!uData.isSkeleton,
        // Zombie allies are already reanimated corpses when they go down a
        // second time - same exemption as Skeleton Warriors above, so the
        // body keeps its rotted-green look instead of decaying down to a
        // plain human skeleton (see the decay-transition check below).
        isZombie: !!uData.isZombie,
        // Steel Revenant's empty plate has no flesh to decay down to a
        // skeleton either - same exemption as above, but instead of
        // lingering on its own separate clock it just disappears outright
        // once rag.decayTime (2 minutes) is up, plate and all (see the
        // decay-transition check below).
        isSteelRevenant: !!uData.isSteelRevenant,
        // War Elephant - no human skeleton to decay down to, so it skips
        // the fleshed decay transition below the same way Steel Revenant's
        // empty plate does, and just disappears outright, tusks and all,
        // once rag.decayTime (2 minutes) is up.
        isWarElephant: !!(uData.unitType === 'warElephant' && uData.elephantRole === 'elephant'),
        birdCheckDone: !!(uData.isSkeleton || uData.isZombie || uData.isSteelRevenant), // whether the 40s carrion-bird roll has happened yet
        // Undertaker collection bookkeeping - isEnemy mirrors the unit this
        // corpse came from (raiders are never collected), claimed flags a
        // corpse the Undertaker is already en route to or carrying so it
        // isn't double-picked while several bodies are down at once.
        isEnemy: !!uData.isEnemy,
        claimed: false,
        // Single rigid-body physics state for the torso + attached limbs
        velocity: groupVelocity,
        rotVel: groupRotVel,
        isGrounded: false,
        hasLanded: false,
        isFloating: false,
        floatPhase: 0,
        driftDir: new THREE.Vector3(),
        isRollingToWater: false,
        rollDir: null,
        rollAxis: null
      };
      ragdolls.push(ragdollRecord);
      // Options menu - Corpse Limit: cull the oldest corpse(s) once the cap
      // is exceeded, same cleanup a corpse gets when it naturally decays
      // away (see the ragdolls.splice calls in the physics update loop) -
      // handles the Steel Revenant's separately-scattered plates too, so a
      // capped-out Revenant corpse doesn't leave orphaned armor behind.
      while (ragdolls.length > corpseLimit) {
        const oldest = ragdolls[0];
        if (oldest.parts) oldest.parts.forEach(p => { if (p.mesh.parent) p.mesh.parent.remove(p.mesh); });
        scene.remove(oldest.group);
        ragdolls.shift();
      }
      // Returned so a special death effect (see steelRevenantSoulDeath) can
      // hook into this specific corpse's parts later - e.g. to give any
      // still-attached plates their own scatter burst once its own effect
      // finishes, rather than immediately.
      return ragdollRecord;
    }

    // Weapons left lying on the ground once their owner dies. Kept in a flat
    // scene-level list so they persist independently of whatever squad or
    // death-sequence bookkeeping the unit itself goes through.
    // Most weapons are modeled standing upright (blade/shaft along local Y),
    // so laying them flat means tipping 90° on X; the pike is already built
    // running along local Z, so it only needs a little settling tilt.

    // Detaches a unit's equipped weapon at the moment of its killing blow and
    // leaves it lying on the ground where it fell, independent of whether the
    // unit then dies outright or lingers through a "suspected death" sequence.
    function dropWeapon(unit) {
      const uData = unit.userData;
      const weapon = uData.weaponMesh;
      if (!weapon || !weapon.parent) return;
      // Goddess of Death's scythe fades away with her instead of dropping.
      if (uData.unitType === 'goddessOfDeath') return;
      // Goddess of Life's moon staff fades away with her too.
      if (uData.unitType === 'goddessOfLife') return;

      const worldPos = new THREE.Vector3();
      const worldScale = new THREE.Vector3();
      weapon.getWorldPosition(worldPos);
      weapon.getWorldScale(worldScale);

      const groundY = getSurfaceY(worldPos.x, worldPos.z);
      if (groundY === null) return; // died over water - no ground to drop it onto, keep it with the unit

      // Spread out from other weapons already lying nearby, so a chokepoint
      // that kills several units in the same spot doesn't drop every weapon
      // exactly on top of the last one.
      const spot = resolveSpacing(
        worldPos.x, worldPos.z, WEAPON_MIN_SPACING,
        (px, pz) => nearestOverlap(droppedWeapons, null, WEAPON_MIN_SPACING, px, pz, w => w.position)
      );
      const spotY = getSurfaceY(spot.x, spot.z) ?? groundY;

      weapon.parent.remove(weapon);
      scene.add(weapon);
      weapon.scale.copy(worldScale);
      weapon.position.set(spot.x, spotY + 0.015, spot.z);

      const isRaiderSpear = uData.unitType === 'raiders' && (uData.raiderWeapon === 'spear' || uData.raiderWeapon === 'spearShield' || uData.raiderWeapon === 'marauderSpear');
      const isCavalrySpear = uData.unitType === 'cavalry' && uData.cavalryWeapon === 'spear';
      const isMilitiaSpear = uData.unitType === 'militia' && uData.militiaWeapon === 'spear';
      const layX = (isRaiderSpear || isCavalrySpear || isMilitiaSpear) ? 0 : (WEAPON_DROP_LAY_X[uData.unitType] ?? Math.PI / 2);
      weapon.rotation.set(
        layX + (Math.random() - 0.5) * 0.25,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.3
      );

      droppedWeapons.push(weapon);
      // Age this weapon so it can be removed once DROPPED_WEAPON_LIFETIME is
      // up - stored on the weapon's own userData rather than a parallel
      // record, since droppedWeapons elsewhere (e.g. the spacing check
      // above) expects a flat list of the raw meshes themselves. baseScale
      // is captured so the shrink-out in its final second (see the "Update
      // Dropped Weapons" loop) can lerp from wherever it actually landed,
      // not assume a scale of 1.
      weapon.userData.dropAge = 0;
      weapon.userData.baseScale = weapon.scale.clone();
      uData.weaponMesh = null;
    }

    function killUnit(unit, attackerWorldPos) {
      const uData = unit.userData;

      // Demon passive (Hellfire Burst) - explodes instead of the normal
      // blood/ragdoll death below. See explodeDemon.
      if (uData.isDemon) { explodeDemon(unit); return; }

      // Scarecrow - falls apart in a burst of straw and crows instead of
      // leaving a ragdoll corpse. See burstScarecrow.
      if (uData.isScarecrow) { burstScarecrow(unit); return; }

      // Angel - dissolves in a burst of light instead of bleeding out
      // into a ragdoll corpse. See vanishAngel.
      if (uData.isAngel) { vanishAngel(unit); return; }

      // Steel Revenant passive (Soulbound Armor) - the spirit inside splits
      // free of the plate instead of the armor just bleeding out. See
      // steelRevenantSoulDeath.
      if (uData.isSteelRevenant) { steelRevenantSoulDeath(unit, attackerWorldPos); return; }

      // Goddess of Death - dissolves into petals, no ragdoll. See goddessDeath.
      if (uData.unitType === 'goddessOfDeath') { goddessDeath(unit, attackerWorldPos); return; }

      // Goddess of Life - fades into petals, no ragdoll. See goddessOfLifeDeath.
      if (uData.unitType === 'goddessOfLife') { goddessOfLifeDeath(unit, attackerWorldPos); return; }

      // War Elephant - when the elephant itself goes down, its two Desert
      // Warrior archers (elephantRole 'archer') have nothing left under
      // them to ride: they're separate top-level squad members seated at
      // howdah height (see squadMemberFormationPosition), not children of
      // the elephant's own mesh, so without this they'd keep floating at
      // that height and even walk/recover back up to it (see the
      // formationOffset homing logic in the main update loop). Dismount
      // them to ground level and lower their home position to match so
      // they carry on fighting as normal grounded archers from here on.
      if (uData.unitType === 'warElephant' && uData.elephantRole === 'elephant') {
        const elephantSquad = squads.find(s => s.members.includes(unit));
        if (elephantSquad) {
          elephantSquad.members.forEach(m => {
            if (m !== unit && m.userData.elephantRole === 'archer') {
              m.position.y = 0;
              if (m.userData.formationOffset) m.userData.formationOffset.y = 0;
            }
          });
        }
      }

      if (uData.hpElement) uData.hpElement.remove();

      // Spawn blood/debris particles and physical ragdoll
      createRagdollDeath(unit, attackerWorldPos);

      // Remove from squad lists
      if (isEnemyUnit(unit)) {
        raiderSquads.forEach(s => {
          const idx = s.members.indexOf(unit);
          if (idx !== -1) s.members.splice(idx, 1);
        });
        updateWaveUI();

        // Raider kill Gold (and rare Contract Scroll) reward - see
        // awardRaiderKillLoot above.
        const lootPos = new THREE.Vector3();
        unit.getWorldPosition(lootPos);
        awardRaiderKillLoot(lootPos);
      } else {
        squads.forEach(s => {
          const idx = s.members.indexOf(unit);
          if (idx !== -1) s.members.splice(idx, 1);
        });
        militiaSquads.forEach(s => {
          const idx = s.members.indexOf(unit);
          if (idx !== -1) s.members.splice(idx, 1);
        });
        updateSquadCountUI();
      }

      if (unit.parent) unit.parent.remove(unit);
    }

    // Akuma Feral passive - Instant Vanish: unlike every other raider, an
    // Akuma Feral never staggers into the crawl/stagger "suspected death"
    // sequence and never leaves a ragdoll corpse behind (see the hp<=0
    // branches in applyDamage, all of which check for this before falling
    // through to the normal killUnit/startDeathSequence path). Whatever the
    // killing blow was, it just drops on the spot and vanishes outright in
    // a puff of shadow instead.
    function vanishAkumaFeral(unit) {
      const uData = unit.userData;
      if (uData.hpElement) uData.hpElement.remove();

      const pos = new THREE.Vector3();
      unit.getWorldPosition(pos);
      pos.y += 0.4;
      for (let i = 0; i < 10; i++) {
        spawnParticle(pos.clone(), 0x2b2030, 0.14 + Math.random() * 0.1, 0.5 + Math.random() * 0.2);
      }
      spawnFloatingText(pos, 'VANISHED', '#b57bd6');

      raiderSquads.forEach(s => {
        const idx = s.members.indexOf(unit);
        if (idx !== -1) s.members.splice(idx, 1);
      });
      updateWaveUI();

      // Raider kill Gold (and rare Contract Scroll) reward - see
      // awardRaiderKillLoot above. An Instant Vanish is still a raider
      // kill, so it pays out the same as any other.
      awardRaiderKillLoot(pos);

      if (unit.parent) unit.parent.remove(unit);
    }

    // Angel - the Heavenly Island's own defenders (and the invading
    // warband version of the same, on the rare biome roll that spawns
    // one) shed no blood and leave no ragdoll corpse behind on death;
    // instead they dissolve on the spot in a burst of white-gold light,
    // same idea as vanishAkumaFeral above just with a holy palette
    // instead of a puff of shadow. Triggered from killUnit for any
    // uData.isAngel unit, itself reached straight from startDeathSequence
    // (Angels never stagger/crawl either - see the isAngel check there).
    function vanishAngel(unit) {
      const uData = unit.userData;
      if (uData.hpElement) uData.hpElement.remove();

      const pos = new THREE.Vector3();
      unit.getWorldPosition(pos);
      pos.y += 0.4;
      for (let i = 0; i < 12; i++) {
        spawnParticle(pos.clone(), i % 2 === 0 ? 0xfff2c4 : 0xffffff, 0.1 + Math.random() * 0.08, 0.5 + Math.random() * 0.25);
      }
      spawnFloatingText(pos, 'ASCENDED', '#fff2c4');

      raiderSquads.forEach(s => {
        const idx = s.members.indexOf(unit);
        if (idx !== -1) s.members.splice(idx, 1);
      });
      updateWaveUI();

      // Still a raider kill - pays out the same Gold/Scroll loot as a
      // normal ragdoll death would.
      awardRaiderKillLoot(pos);

      if (unit.parent) unit.parent.remove(unit);
    }

    // Demon passive (Hellfire Burst) - triggered from killUnit for any
    // uData.isDemon unit, in place of the normal blood/ragdoll death. No
    // corpse, no stagger - it just detonates on the spot in a fiery
    // violet-and-ember blast (see DEMON_EXPLOSION_RADIUS/_DAMAGE) that
    // hits every nearby player Squad and Villager Militia member, shields
    // or not (see applyDamage's isPiercingShot check for 'demonExplosion').
    function explodeDemon(unit) {
      const uData = unit.userData;
      if (uData.hpElement) uData.hpElement.remove();

      const pos = new THREE.Vector3();
      unit.getWorldPosition(pos);
      pos.y += 0.4;

      const EXPLOSION_COLORS = [0x8a2be2, 0xff3b1f, 0xffcc33, 0x2a1440];
      for (let i = 0; i < 20; i++) {
        const color = EXPLOSION_COLORS[Math.floor(Math.random() * EXPLOSION_COLORS.length)];
        spawnParticle(pos.clone(), color, 0.1 + Math.random() * 0.09, 0.5 + Math.random() * 0.3, false);
      }
      spawnParticle(pos.clone(), 0xffffaa, 0.26, 0.15);
      spawnFloatingText(pos, 'HELLFIRE BURST!', '#ff5a2a');

      // AoE damage to every nearby player Squad / Villager Militia member -
      // raider squads (including other Demons) are untouched, matching the
      // convention that raiders never friendly-fire each other.
      [...squads, ...militiaSquads].forEach(s => {
        s.members.slice().forEach(member => {
          const mData = member.userData;
          if (!mData || mData.hp <= 0) return;
          const mPos = new THREE.Vector3();
          member.getWorldPosition(mPos);
          if (mPos.distanceTo(pos) <= DEMON_EXPLOSION_RADIUS) {
            applyDamage(member, DEMON_EXPLOSION_DAMAGE, 'demonExplosion', pos, null, false);
          }
        });
      });

      raiderSquads.forEach(s => {
        const idx = s.members.indexOf(unit);
        if (idx !== -1) s.members.splice(idx, 1);
      });
      updateWaveUI();

      // Raider kill Gold (and rare Contract Scroll) reward - see
      // awardRaiderKillLoot above. A Hellfire Burst is still a raider
      // kill, so it pays out the same as any other.
      awardRaiderKillLoot(pos);

      if (unit.parent) unit.parent.remove(unit);
    }

    // Bear Warrior passive (Summon Lightning) - called from
    // processUnitAttack's isBearWarrior branch in place of a normal Claw/
    // Bite swing, once uData.bearLightningCooldown is ready. Strikes the
    // target's current position with a telegraphed bolt (see
    // spawnLightningBoltEffect) and deals AoE damage to every nearby
    // player Squad/Villager Militia member, bypassing shields the same
    // way the Demon's Hellfire Burst does (see applyDamage's
    // isPiercingShot check for 'bearLightning'). Unlike Hellfire Burst,
    // this doesn't kill or remove the Bear Warrior itself - it's a
    // repeatable ability, not a death trigger.
    function summonBearLightningStrike(unit, targetWorldPos, attackerWorldPos) {
      const pos = targetWorldPos.clone();
      pos.y = attackerWorldPos.y;

      spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'LIGHTNING!', '#aef0ff');
      spawnLightningBoltEffect(pos);

      [...squads, ...militiaSquads].forEach(s => {
        s.members.slice().forEach(member => {
          const mData = member.userData;
          if (!mData || mData.hp <= 0) return;
          const mPos = new THREE.Vector3();
          member.getWorldPosition(mPos);
          if (mPos.distanceTo(pos) <= BEAR_LIGHTNING_RADIUS) {
            applyDamage(member, BEAR_LIGHTNING_DAMAGE, 'bearLightning', pos, null, false);
          }
        });
      });
    }

    // A pale, faceless wisp standing in for the spirit bound inside a Steel
    // Revenant's plate - see steelRevenantSoulDeath. Deliberately not a
    // humanoid silhouette (no body/head shape) - just a soft drifting orb
    // of light, additive-blended so it reads as ethereal rather than solid.
    function createSteelRevenantSoulMesh() {
      const group = new THREE.Group();
      const soulMat = new THREE.MeshBasicMaterial({
        color: 0x1adbc4,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), soulMat);
      group.add(core);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), soulMat);
      group.add(halo);
      group.userData.mats = [soulMat];
      return group;
    }

    // A single ghostly grasping hand - reused mirrored left/right in
    // steelRevenantSoulDeath - that claws up out of the ground to drag the
    // departed soul back under it.
    function createSoulHandMesh() {
      const handMat = new THREE.MeshBasicMaterial({
        color: 0x2a2438,
        transparent: true,
        opacity: 0
      });
      const group = new THREE.Group();
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.05), handMat);
      group.add(palm);
      for (let i = 0; i < 3; i++) {
        const finger = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.12, 5), handMat);
        finger.position.set((i - 1) * 0.035, 0.13, 0);
        finger.rotation.x = Math.PI;
        group.add(finger);
      }
      group.userData.mats = [handMat];
      return group;
    }

    // Disposes every geometry/material under a soul or hand group - called
    // once its steelSouls entry finishes and is about to be removed.
    function disposeSoulGroup(group) {
      group.traverse(child => { if (child.geometry) child.geometry.dispose(); });
      if (group.userData.mats) group.userData.mats.forEach(m => m.dispose());
    }

    // Steel Revenant passive (Soulbound Armor) finale - once the soul has
    // been dragged under (see the "Update Steel Revenant Soul Effects"
    // block in animate()), whatever plates hadn't already been sent flying
    // by createRagdollDeath's normal dismemberment roll get one outward
    // burst so the whole suit ends up scattered across the ground instead
    // of resting as one intact heap.
    function scatterRemainingArmor(rag) {
      const origin = rag.group.position.clone();
      rag.parts.forEach(part => {
        if (part.isSevered) return; // already flying independently
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        part.mesh.getWorldPosition(worldPos);
        part.mesh.getWorldQuaternion(worldQuat);
        part.mesh.getWorldScale(worldScale);

        // Detach from the (now-resting) ragdoll group into scene space,
        // same as a dismembered limb, so it can fly off on its own.
        rag.group.remove(part.mesh);
        scene.add(part.mesh);
        part.mesh.position.copy(worldPos);
        part.mesh.quaternion.copy(worldQuat);
        part.mesh.scale.copy(worldScale);

        const outDir = new THREE.Vector3(worldPos.x - origin.x, 0, worldPos.z - origin.z);
        if (outDir.lengthSq() < 0.0001) outDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        outDir.normalize();

        part.isSevered = true;
        part.velocity = outDir.multiplyScalar(1.4 + Math.random() * 1.6).add(new THREE.Vector3(0, 2.2 + Math.random() * 1.4, 0));
        part.rotVel = new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
        part.isGrounded = false;
        part.isFloating = false;
        part.floatPhase = 0;
        part.driftDir = new THREE.Vector3();
      });
    }

    // Steel Revenant passive (Soulbound Armor) - the armor never bleeds
    // (see every createBloodSplatter/gore-fountain check above), and
    // instead of just flopping over, the spirit bound inside splits free
    // of the plate first: it rises clear of the falling armor, hovers, then
    // a pair of ghostly hands claw up out of the ground and drag it back
    // under - only once it's gone does whatever's left standing get its
    // final outward scatter burst (see scatterRemainingArmor). The full
    // phase timeline lives in the "Update Steel Revenant Soul Effects"
    // block in animate().
    function steelRevenantSoulDeath(unit, attackerWorldPos) {
      const uData = unit.userData;
      if (uData.hpElement) uData.hpElement.remove();

      const pos = new THREE.Vector3();
      unit.getWorldPosition(pos);

      // The armor still collapses/tumbles like any other ragdoll - just
      // bloodless - while the soul effect below plays out over it.
      const rag = createRagdollDeath(unit, attackerWorldPos);

      const soulMesh = createSteelRevenantSoulMesh();
      soulMesh.position.set(pos.x, pos.y + 0.5, pos.z);
      scene.add(soulMesh);

      const handL = createSoulHandMesh();
      const handR = createSoulHandMesh();
      scene.add(handL);
      scene.add(handR);

      steelSouls.push({
        origin: pos.clone(),
        age: 0,
        rag,
        scattered: false,
        soulMesh,
        handL,
        handR
      });

      // Remove from squad lists - Steel Revenant is a player-recruitable
      // squad now (see createRaiderSquad's comment above), not a raider,
      // so it normally needs to come out of squads/militiaSquads and
      // refresh the player-side UI. The raiderSquads branch is kept only
      // for safety in case anything ever spawns one as an enemy again.
      if (isEnemyUnit(unit)) {
        raiderSquads.forEach(s => {
          const idx = s.members.indexOf(unit);
          if (idx !== -1) s.members.splice(idx, 1);
        });
        updateWaveUI();

        // Raider kill Gold (and rare Contract Scroll) reward - see
        // awardRaiderKillLoot above. Still a raider kill, so it pays out
        // the same as any other.
        awardRaiderKillLoot(pos);
      } else {
        squads.forEach(s => {
          const idx = s.members.indexOf(unit);
          if (idx !== -1) s.members.splice(idx, 1);
        });
        militiaSquads.forEach(s => {
          const idx = s.members.indexOf(unit);
          if (idx !== -1) s.members.splice(idx, 1);
        });
        updateSquadCountUI();
      }

      if (unit.parent) unit.parent.remove(unit);
    }

    // Kills a villager NPC caught by a raider - reuses the same ragdoll/gore
    // death as a squad unit, then permanently removes the NPC from the
    // island (it does not come back when revealVillagers() runs at the end
    // of the wave).
    function killVillagerNpc(v, attackerWorldPos) {
      if (v.dead) return;
      v.dead = true;
      v.hidden = true;
      v.fleeing = false;
      v.assisting = false;
      killUnit(v.mesh, attackerWorldPos);
      const idx = villagers.indexOf(v);
      if (idx !== -1) villagers.splice(idx, 1);
    }

    // Lets landed raiders actually catch and kill villager NPCs instead of
    // every villager being guaranteed-safe the instant a raid starts.
    // Ordinary villagers (and the Priest/Blacksmith) die in a single blow if
    // a raider reaches them while they're still out fleeing to their house.
    // The Cleric, Apprentice Mage, and Monk never flee - they hold their
    // ground to support the troops - so instead they trade hits with any
    // raider that gets close, backed by a real HP pool.
    function updateRaiderVsVillagers(delta) {
      const liveRaiders = [];
      raiderSquads.forEach(s => s.members.forEach(u => { if (u.userData.hp > 0) liveRaiders.push(u); }));
      if (liveRaiders.length === 0 || villagers.length === 0) return;

      const raiderWorldPos = new THREE.Vector3();
      const villagerWorldPos = new THREE.Vector3();
      const toKill = [];

      villagers.forEach(v => {
        if (v.dead || v.hidden || !v.mesh.visible) return;

        const isCombatNpc = v.npcKind === 'cleric' || v.npcKind === 'apprenticeMage' || v.npcKind === 'monk' || v.npcKind === 'shaman';
        if (isCombatNpc) {
          if (!v.assisting) return;
        } else if (!v.fleeing) {
          return; // safely hidden, or hasn't reacted to the raid yet
        }

        v.mesh.getWorldPosition(villagerWorldPos);

        let nearestRaider = null, nearestDist = Infinity;
        liveRaiders.forEach(r => {
          r.getWorldPosition(raiderWorldPos);
          const d = raiderWorldPos.distanceTo(villagerWorldPos);
          if (d < nearestDist) { nearestDist = d; nearestRaider = r; }
        });
        if (!nearestRaider) return;

        if (isCombatNpc) {
          if (nearestDist > RAIDER_NPC_ATTACK_RANGE) return;
          v.npcAttackCooldown -= delta;
          if (v.npcAttackCooldown > 0) return;
          v.npcAttackCooldown = RAIDER_NPC_ATTACK_INTERVAL;

          nearestRaider.getWorldPosition(raiderWorldPos);
          v.hp -= RAIDER_NPC_DAMAGE;
          spawnFloatingText(villagerWorldPos, `-${RAIDER_NPC_DAMAGE}`, '#ff9999');
          const hitDir = new THREE.Vector3().subVectors(villagerWorldPos, raiderWorldPos).normalize();
          createBloodSplatter(villagerWorldPos.clone().add(new THREE.Vector3(0, 0.4, 0)), hitDir);

          if (v.hp <= 0) toKill.push({ v, pos: raiderWorldPos.clone() });
        } else if (nearestDist <= RAIDER_VILLAGER_KILL_RANGE) {
          nearestRaider.getWorldPosition(raiderWorldPos);
          toKill.push({ v, pos: raiderWorldPos.clone() });
        }
      });

      toKill.forEach(({ v, pos }) => killVillagerNpc(v, pos));
    }

    // Raiders actively assaulting a standing Watch Tower - see the tower
    // candidates added in findRaiderTarget. A tower isn't a real
    // attackable unit (no hurtbox, never appears in raiderTargetableUnits),
    // so it can't go through the normal per-unit processUnitAttack loop a
    // player squad would; a warband that has picked one as its current
    // objective (squad.currentTargetSquad, checked against watchTowers)
    // and closed to its own attack range instead chips its HP directly
    // here, once per RAIDER_TOWER_ATTACK_INTERVAL - on top of the passive
    // retaliation chance a tower already risks each time it fires back
    // (see updateSiegeEngineerSupport). Runs every frame like
    // updateRaiderVsVillagers, rather than piggybacking on
    // updateRaiderAI's own throttled (0.8-1.4s) decision cadence, so the
    // cooldown actually counts down in real time instead of only ticking
    // once per AI decision. Multiple warbands can each be laying into a
    // different tower (or even the same one) simultaneously - nothing
    // here assumes there's only one tower standing.
    const RAIDER_TOWER_ATTACK_INTERVAL = 1.4;
    const RAIDER_TOWER_DAMAGE_PER_MEMBER_MIN = 4 * ENEMY_NERF.damage;
    const RAIDER_TOWER_DAMAGE_PER_MEMBER_MAX = 8 * ENEMY_NERF.damage;
    function updateRaidersAttackingWatchTower(delta) {
      if (watchTowers.length === 0) return;

      for (const squad of raiderSquads) {
        if (squad.members.length === 0) continue;
        const tower = squad.currentTargetSquad;
        if (!tower || !watchTowers.includes(tower)) continue;
        if (squad.isMoving) continue; // still marching in, not engaging yet

        const dist = Math.hypot(squad.group.position.x - tower.x, squad.group.position.z - tower.z);
        const squadAttackRange = isSquadFullyRanged(squad) ? RAIDER_RANGED_ATTACK_RANGE : RAIDER_ATTACK_RANGE;
        if (dist > squadAttackRange) continue;

        squad.towerAttackCooldown = (squad.towerAttackCooldown || 0) - delta;
        if (squad.towerAttackCooldown > 0) continue;
        squad.towerAttackCooldown = RAIDER_TOWER_ATTACK_INTERVAL;

        const liveMembers = squad.members.filter(m => m.userData.hp > 0);
        if (liveMembers.length === 0) continue;

        const perMember = RAIDER_TOWER_DAMAGE_PER_MEMBER_MIN + Math.random() * (RAIDER_TOWER_DAMAGE_PER_MEMBER_MAX - RAIDER_TOWER_DAMAGE_PER_MEMBER_MIN);
        const dmg = Math.round(perMember * liveMembers.length);
        tower.hp -= dmg;
        if (tower.hpFillElement) {
          tower.hpFillElement.style.width = Math.max(0, (tower.hp / tower.maxHp) * 100) + '%';
        }
        const groundY = getSurfaceY(tower.x, tower.z) || 0;
        spawnFloatingText(new THREE.Vector3(tower.x, groundY + WATCH_TOWER_FIRE_HEIGHT, tower.z), '-' + dmg, '#ff8844');

        // Swing animation for the visual sell - the same generic
        // sword-swing pose every melee raider already uses (see
        // applyAttackPose's 'raiders' branch), triggered directly since
        // there's no player-unit target here to route through the
        // normal attack loop that would otherwise set this.
        liveMembers.forEach(m => {
          m.userData.attackAnimTimer = m.userData.attackAnimDuration || 0.4;
        });

        if (tower.hp <= 0) destroyWatchTower(tower);
      }
    }

    // Raiders laying siege to the captured Orc Fortress - same shape as
    // updateRaidersAttackingWatchTower just above (a warband that's
    // picked capturedFortressTarget as its currentTargetSquad and closed
    // to range chips its HP directly here), reusing the same per-member
    // damage/interval constants. The Fortress just has far more HP
    // (ORC_FORTRESS_MAX_HP, 1400 vs a tower's 500) to reflect it being a
    // whole keep rather than one wooden platform, so it takes sustained
    // pressure from more than one warband to actually bring down. No
    // floating HP bar for this one (the panel it lost isn't shown while
    // it's under siege), just the same per-hit damage numbers as a tower.
    function updateRaidersAttackingCapturedFortress(delta) {
      if (!capturedFortressTarget || !orcFortressTile) return;

      for (const squad of raiderSquads) {
        if (squad.members.length === 0) continue;
        if (squad.currentTargetSquad !== capturedFortressTarget) continue;
        if (squad.isMoving) continue; // still marching in, not engaging yet

        const dist = Math.hypot(squad.group.position.x - capturedFortressTarget.group.position.x, squad.group.position.z - capturedFortressTarget.group.position.z);
        const squadAttackRange = isSquadFullyRanged(squad) ? RAIDER_RANGED_ATTACK_RANGE : RAIDER_ATTACK_RANGE;
        if (dist > squadAttackRange) continue;

        squad.towerAttackCooldown = (squad.towerAttackCooldown || 0) - delta;
        if (squad.towerAttackCooldown > 0) continue;
        squad.towerAttackCooldown = RAIDER_TOWER_ATTACK_INTERVAL;

        const liveMembers = squad.members.filter(m => m.userData.hp > 0);
        if (liveMembers.length === 0) continue;

        const perMember = RAIDER_TOWER_DAMAGE_PER_MEMBER_MIN + Math.random() * (RAIDER_TOWER_DAMAGE_PER_MEMBER_MAX - RAIDER_TOWER_DAMAGE_PER_MEMBER_MIN);
        const dmg = Math.round(perMember * liveMembers.length);
        orcFortressHp -= dmg;
        const groundY = getSurfaceY(orcFortressTile.x, orcFortressTile.z) || 0;
        spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + ORC_FORTRESS_FIRE_HEIGHT, orcFortressTile.z), '-' + dmg, '#ff8844');

        liveMembers.forEach(m => {
          m.userData.attackAnimTimer = m.userData.attackAnimDuration || 0.4;
        });

        if (orcFortressHp <= 0) { razeCapturedFortress(); break; }
      }
    }

    // Small non-permanent-radius blood decal dropped along a dying unit's
    // path. bloodColor lets a Shadow Island Acolyte leave its own dark
    // violet trail (see ACOLYTE_BLOOD_COLOR) instead of the default red -
    // same optional-color pattern as createBloodSplatter below.
    function spawnBloodTrailDecal(pos, bloodColor) {
      // Options menu - Blood Enabled toggle.
      if (!bloodEnabled) return;
      const surfaceY = getSurfaceY(pos.x, pos.z);
      if (surfaceY === null) return;
      const radius = 0.07 + Math.random() * 0.06;
      const decalMat = new THREE.MeshLambertMaterial({ color: bloodColor || 0x660000, transparent: true, opacity: 0.8, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 6), decalMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.random() * Math.PI * 2;
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.1,
        surfaceY + 0.013 + bloodDecals.length * 0.0001,
        pos.z + (Math.random() - 0.5) * 0.1
      );
      scene.add(mesh);
      bloodDecals.push({ mesh, isWater: false, age: 0, maxAge: BLOOD_DECAL_LIFETIME, baseOpacity: 0.8 });
    }

    // Pull a unit out of its squad formation group and re-add it directly to
    // the scene at the same world transform, so it can move independently
    // during its death sequence instead of being dragged by the squad.
    function detachUnitToWorld(unit) {
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      const worldScale = new THREE.Vector3();
      unit.getWorldPosition(worldPos);
      unit.getWorldQuaternion(worldQuat);
      unit.getWorldScale(worldScale);
      if (unit.parent) unit.parent.remove(unit);
      scene.add(unit);
      unit.position.copy(worldPos);
      unit.quaternion.copy(worldQuat);
      // Squads are rendered at a 0.6 scale, so without copying that over too
      // a detached unit would suddenly pop up to full size the moment it
      // starts crawling/staggering. Keep it exactly the size it already was.
      unit.scale.copy(worldScale);
    }

    // Begin a fatally wounded unit's lingering "suspected death" sequence
    // instead of killing it outright. It immediately stops fighting and is
    // pulled from its squad/wave bookkeeping (same as an instant kill), but
    // keeps moving and animating on its own for a few seconds first:
    //  - crawl: collapses prone and drags itself along the ground, leaving a
    //    blood trail, for CRAWL_DEATH_DURATION seconds, then dies where it lies.
    //  - stagger: stays on its feet clutching its torso, stumbles forward
    //    leaving a blood trail for STAGGER_DEATH_DURATION seconds, then
    //    kneels briefly before finally dying.
    function startDeathSequence(unit, attackerWorldPos, forcedType) {
      const uData = unit.userData;
      if (uData.isDying) return;

      // Shadow Island's Skeleton Warriors have no flesh to bleed or wounds
      // to crawl from - they never enter the lingering "suspected death"
      // sequence below, they just drop on the spot like every other
      // instant kill.
      if (uData.isSkeleton) { killUnit(unit, attackerWorldPos); return; }

      // Demon passive (Hellfire Burst) - never staggers or crawls either;
      // it drops on the spot and explodes immediately (see explodeDemon,
      // triggered from killUnit for any uData.isDemon unit).
      if (uData.isDemon) { killUnit(unit, attackerWorldPos); return; }

      // Scarecrow - never staggers or crawls either; it drops straight
      // into its straw-and-crows burst (see burstScarecrow, triggered
      // from killUnit for any uData.isScarecrow unit).
      if (uData.isScarecrow) { killUnit(unit, attackerWorldPos); return; }

      // Angel - has no flesh to bleed or wounds to crawl from; it drops
      // straight into its burst of light (see vanishAngel, triggered
      // from killUnit for any uData.isAngel unit).
      if (uData.isAngel) { killUnit(unit, attackerWorldPos); return; }

      // Steel Revenant passive (Soulbound Armor) - no flesh to stagger or
      // crawl on either; it drops immediately into its own soul-departure
      // death (see steelRevenantSoulDeath, triggered from killUnit for any
      // uData.isSteelRevenant unit).
      if (uData.isSteelRevenant) { killUnit(unit, attackerWorldPos); return; }

      // Goddess of Death never staggers or crawls - see goddessDeath.
      if (uData.unitType === 'goddessOfDeath') { killUnit(unit, attackerWorldPos); return; }

      // Goddess of Life never staggers or crawls either - see goddessOfLifeDeath.
      if (uData.unitType === 'goddessOfLife') { killUnit(unit, attackerWorldPos); return; }

      // War Elephant - the elephant itself (not its two Desert Warrior
      // archers, who die normally like any other unit) is far too massive
      // to plausibly crawl or stagger through a lingering "suspected
      // death" - it drops instantly the moment it's killed, same
      // treatment as the Steel Revenant's plate above. See killUnit for
      // the archer-dismount handling that also fires from this branch.
      if (uData.unitType === 'warElephant' && uData.elephantRole === 'elephant') { killUnit(unit, attackerWorldPos); return; }

      uData.hp = 0;
      uData.isWalking = false;
      uData.attackAnimTimer = 0;

      if (uData.hpElement) { uData.hpElement.remove(); uData.hpElement = null; }

      // Stop fighting immediately and drop out of squad/wave bookkeeping,
      // same as an instant kill would.
      if (isEnemyUnit(unit)) {
        raiderSquads.forEach(s => {
          const idx = s.members.indexOf(unit);
          if (idx !== -1) s.members.splice(idx, 1);
        });
        updateWaveUI();

        // Raider kill Gold (and rare Contract Scroll) reward - see
        // awardRaiderKillLoot above. Paid out here (the fatal blow) rather
        // than at the end of the crawl/stagger sequence, matching the
        // instant-kill timing in killUnit.
        const lootPos = new THREE.Vector3();
        unit.getWorldPosition(lootPos);
        awardRaiderKillLoot(lootPos);
      } else {
        squads.forEach(s => {
          const idx = s.members.indexOf(unit);
          if (idx !== -1) s.members.splice(idx, 1);
        });
        militiaSquads.forEach(s => {
          const idx = s.members.indexOf(unit);
          if (idx !== -1) s.members.splice(idx, 1);
        });
        updateSquadCountUI();
      }

      detachUnitToWorld(unit);

      // Stumble/crawl away from whoever landed the killing blow.
      const originPos = new THREE.Vector3();
      unit.getWorldPosition(originPos);
      const dir = attackerWorldPos
        ? new THREE.Vector3().subVectors(originPos, attackerWorldPos).setY(0).normalize()
        : new THREE.Vector3(Math.sin(unit.rotation.y), 0, Math.cos(unit.rotation.y));
      if (!isFinite(dir.x) || dir.lengthSq() < 0.0001) dir.set(0, 0, 1);
      unit.rotation.y = Math.atan2(dir.x, dir.z);

      const dyingType = forcedType || (Math.random() < 0.5 ? 'crawl' : 'stagger');

      dyingUnits.push({
        unit,
        uData,
        type: dyingType,
        timer: 0,
        duration: dyingType === 'crawl' ? CRAWL_DEATH_DURATION : (dyingType === 'burn' ? BURN_DEATH_DURATION : STAGGER_DEATH_DURATION),
        phase: 'move', // stagger only: 'move' -> 'kneel'
        kneelTimer: 0,
        trailTimer: 0,
        dirChangeTimer: 0, // burn only: counts down to the next panicked direction change
        moveDir: dir,
        animPhase: Math.random() * Math.PI * 2
      });

      uData.isDying = true;
    }

    // Final collapse at the end of a death sequence: spawns the physical
    // ragdoll/gore and removes the unit mesh, mirroring the tail end of the
    // old instant killUnit().
    function finishDeathSequence(unit, moveDir) {
      const worldPos = new THREE.Vector3();
      unit.getWorldPosition(worldPos);
      // Treat the direction it was already moving as the "hit" direction so
      // the ragdoll settles continuing that motion rather than snapping back.
      const pseudoAttackerPos = worldPos.clone().sub(moveDir);
      // Very low force multiplier: after crawling/staggering out its death,
      // the final collapse should settle quietly in place, not fling the body.
      createRagdollDeath(unit, pseudoAttackerPos, DEATH_COLLAPSE_FORCE_MULT);
      if (unit.parent) unit.parent.remove(unit);
    }

    // Finds a direction close to `dir` that keeps the next step on land,
    // trying the preferred direction first and then increasingly wide turns
    // to either side (so a dying unit steers along the coastline instead of
    // walking/crawling into the water). Returns null if it's boxed in by
    // water on every side, in which case the caller should just hold still.
    const LAND_STEER_ANGLES = [0, 25, -25, 50, -50, 90, -90, 130, -130, 180];
    function pickLandSafeDir(currentPos, dir, stepLen) {
      for (const angleDeg of LAND_STEER_ANGLES) {
        const testDir = dir.clone().applyAxisAngle(UP_AXIS, angleDeg * Math.PI / 180);
        const testPos = currentPos.clone().addScaledVector(testDir, stepLen);
        if (getSurfaceY(testPos.x, testPos.z) !== null) return testDir;
      }
      return null;
    }

    // Samples a ring around `pos` at `radius` looking for open water, so a
    // corpse that settles right at the coastline can tip over and roll in
    // instead of freezing on the beach beside it. Returns a normalized
    // direction toward the nearest water sample found, or null if the spot
    // isn't near any water.
    function findNearbyWaterDir(pos, radius) {
      const samples = 10;
      for (let k = 0; k < samples; k++) {
        const angle = (k / samples) * Math.PI * 2;
        const testX = pos.x + Math.cos(angle) * radius;
        const testZ = pos.z + Math.sin(angle) * radius;
        if (getSurfaceY(testX, testZ) === null) {
          return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        }
      }
      return null;
    }

    // Drives movement, pose and blood-trail spawning for every unit currently
    // in its lingering death sequence. Called once per frame with delta time.
    function updateDyingUnits(delta) {
      for (let i = dyingUnits.length - 1; i >= 0; i--) {
        const d = dyingUnits[i];
        const unit = d.unit;
        const uData = d.uData;

        // The unit group itself only ever turns on Y to face its travel
        // direction - all hunching/crouching tilt is applied locally to the
        // body/head meshes instead, so steering never gets tangled up with pose.
        unit.rotation.x = 0;
        unit.rotation.z = 0;

        d.trailTimer += delta;
        const dropTrail = () => {
          if (d.trailTimer >= BLOOD_TRAIL_INTERVAL) {
            d.trailTimer = 0;
            // Scarecrow/Gargoyle have no blood at all - no trail to leave
            // while crawling/staggering toward death either.
            if (uData.isScarecrow || uData.isGargoyle) return;
            const p = new THREE.Vector3();
            unit.getWorldPosition(p);
            spawnBloodTrailDecal(p, (uData.raiderFaction === 'acolyte' || uData.unitType === 'ghoul') ? ACOLYTE_BLOOD_COLOR : undefined);
          }
        };

        if (d.type === 'crawl') {
          d.timer += delta;

          // Ease down from whatever pose the unit was in the instant it died
          // into the low crawling pose, so it settles into place over a beat
          // instead of snapping straight into position.
          const settleT = Math.min(d.timer / CRAWL_SETTLE_TIME, 1);
          const settle = easeOutQuad(settleT);

          const stepLen = CRAWL_SPEED * delta;
          const safeDir = pickLandSafeDir(unit.position, d.moveDir, stepLen);
          if (safeDir) {
            d.moveDir.copy(safeDir).normalize();
            unit.position.x += d.moveDir.x * stepLen;
            unit.position.z += d.moveDir.z * stepLen;
            unit.rotation.y = Math.atan2(d.moveDir.x, d.moveDir.z);
          }
          // Boxed in by water on every side: stay put and just keep
          // animating/bleeding in place rather than risk entering the water.

          // Re-settle height every frame (not just on frames where it moves)
          // so the sink into the ground eases in smoothly from the standing
          // pose instead of snapping down once movement resumes.
          const groundYNow = getSurfaceY(unit.position.x, unit.position.z);
          if (groundYNow !== null) unit.position.y = groundYNow - CRAWL_SINK_HEIGHT * settle;

          // Low crawling pose on hands and knees: torso and head pitched
          // down, knees bent well up under the body, arms reaching forward
          // and pulling in an alternating drag motion - one arm/opposite leg
          // pull at a time, like a real low crawl - with a hip sway and a
          // small forward-pull bob for weight. CRAWL_SINK_HEIGHT above does
          // the real work of grounding the pose; this only has to move the
          // limbs believably around that now-lowered body instead of also
          // fighting to fake the height drop through rotation alone.
          d.animPhase += delta * CRAWL_CYCLE_SPEED;
          const drag = Math.sin(d.animPhase);
          const pull = Math.max(0, -Math.cos(d.animPhase)); // pulses once per full reach-and-pull
          const sway = Math.sin(d.animPhase * 0.5) * CRAWL_SWAY_AMOUNT;

          uData.body.rotation.x = lerp(0, -1.3, settle);
          uData.body.rotation.z = sway;
          uData.body.position.y = lerp(0.525, 0.34 - pull * CRAWL_BOB_AMOUNT, settle);
          uData.head.rotation.x = lerp(0, -0.3, settle) - pull * 0.12;
          uData.head.rotation.z = -sway * 0.6;
          uData.head.position.y = lerp(0.9, 0.62 - pull * CRAWL_BOB_AMOUNT, settle);

          uData.armL.rotation.x = lerp(0, -1.1, settle) + drag * 0.4;
          uData.armR.rotation.x = lerp(0, -1.1, settle) - drag * 0.4;
          uData.armL.rotation.z = drag * 0.1;
          uData.armR.rotation.z = -drag * 0.1;
          // Knees stay folded well up under the body throughout the cycle
          // (only a small extra sway on top, rather than swinging back
          // toward fully extended) so the feet never dip back down past
          // ground level as CRAWL_SINK_HEIGHT brings the whole body down.
          uData.legL.rotation.x = lerp(0, -CRAWL_LEG_FOLD, settle) - drag * 0.15;
          uData.legR.rotation.x = lerp(0, -CRAWL_LEG_FOLD, settle) + drag * 0.15;
          // Jointed-limb rigs (Dragon Ronin, Paladins, Slasher, Steel
          // Revenant) have a separate thigh+knee instead of a single rigid
          // leg box. Without folding the knee too, the thigh above swings
          // all the way back to CRAWL_LEG_FOLD while the shin stays locked
          // straight in line with it - reading as one long stiff leg
          // kicked out behind the body instead of a knee tucked under it.
          // Non-jointed rigs have no knee (legLKnee/legRKnee are null), so
          // this only ever applies where there's an actual joint to bend.
          if (uData.legLKnee) uData.legLKnee.rotation.x = lerp(0, CRAWL_LEG_FOLD, settle);
          if (uData.legRKnee) uData.legRKnee.rotation.x = lerp(0, CRAWL_LEG_FOLD, settle);

          dropTrail();

          if (d.timer >= d.duration) {
            finishDeathSequence(unit, d.moveDir);
            dyingUnits.splice(i, 1);
          }
        } else if (d.type === 'burn') {
          // Burning Death: blind panic rather than a calm stagger - it
          // keeps changing direction at random as it tries to outrun the
          // flames, sprinting faster than a normal stagger, flailing at
          // itself instead of clutching a wound, and trailing embers
          // instead of a blood trail.
          d.timer += delta;
          d.dirChangeTimer -= delta;

          if (d.dirChangeTimer <= 0) {
            d.dirChangeTimer = BURN_DIR_CHANGE_MIN + Math.random() * (BURN_DIR_CHANGE_MAX - BURN_DIR_CHANGE_MIN);
            const randomTurn = (Math.random() - 0.5) * Math.PI * 1.6;
            d.moveDir.applyAxisAngle(UP_AXIS, randomTurn);
          }

          const stepLen = BURN_PANIC_SPEED * delta;
          const safeDir = pickLandSafeDir(unit.position, d.moveDir, stepLen);
          if (safeDir) {
            d.moveDir.copy(safeDir).normalize();
            const nextPos = unit.position.clone().addScaledVector(d.moveDir, stepLen);
            const groundY = getSurfaceY(nextPos.x, nextPos.z);
            unit.position.x = nextPos.x;
            unit.position.z = nextPos.z;
            unit.position.y = groundY;
            unit.rotation.y = Math.atan2(d.moveDir.x, d.moveDir.z);
          }
          // Boxed in by water on every side: stay put and keep thrashing
          // in place rather than risk stepping into the water.

          // Frantic flailing sprint - both arms thrown up beating at the
          // flames, legs pumping hard, head thrown back, rather than the
          // stagger's single arm clutched over the wound.
          uData.walkTimer += delta * 11;
          const flail = Math.sin(uData.walkTimer);
          uData.legL.rotation.x = flail * 0.5;
          uData.legR.rotation.x = -flail * 0.5;
          uData.armL.rotation.set(-2.6 + flail * 0.5, 0, 0.3);
          uData.armR.rotation.set(-2.6 - flail * 0.5, 0, -0.3);
          uData.body.rotation.x = -0.15 + Math.sin(uData.walkTimer * 0.5) * 0.1;
          uData.head.rotation.x = -0.3;

          // Full-body flames instead of a blood trail - it's burning, not
          // bleeding. Rather than one ember at chest height, spread a
          // burst of flame licks from ankle to just-above-the-head every
          // tick so the whole silhouette reads as engulfed while it runs.
          if (d.trailTimer >= BURN_EMBER_INTERVAL) {
            d.trailTimer = 0;
            const p = new THREE.Vector3();
            unit.getWorldPosition(p);
            for (let f = 0; f < BURN_FLAME_PARTICLES_PER_TICK; f++) {
              const flamePos = p.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * BURN_FLAME_RADIUS,
                BURN_FLAME_HEIGHT_MIN + Math.random() * (BURN_FLAME_HEIGHT_MAX - BURN_FLAME_HEIGHT_MIN),
                (Math.random() - 0.5) * BURN_FLAME_RADIUS
              ));
              const flameColor = BURN_FLAME_COLORS[Math.floor(Math.random() * BURN_FLAME_COLORS.length)];
              spawnParticle(flamePos, flameColor, 0.08 + Math.random() * 0.09, 0.28 + Math.random() * 0.22);
            }
          }

          if (d.timer >= d.duration) {
            finishDeathSequence(unit, d.moveDir);
            dyingUnits.splice(i, 1);
          }
        } else {
          // Stagger: upright, clutching the torso wound, then kneels and dies.
          if (d.phase === 'move') {
            d.timer += delta;

            const stepLen = STAGGER_SPEED * delta;
            const safeDir = pickLandSafeDir(unit.position, d.moveDir, stepLen);
            if (safeDir) {
              d.moveDir.copy(safeDir).normalize();
              const nextPos = unit.position.clone().addScaledVector(d.moveDir, stepLen);
              const groundY = getSurfaceY(nextPos.x, nextPos.z);
              unit.position.x = nextPos.x;
              unit.position.z = nextPos.z;
              unit.position.y = groundY;
              unit.rotation.y = Math.atan2(d.moveDir.x, d.moveDir.z);
            }
            // Boxed in by water on every side: stay put and keep staggering
            // in place rather than risk stepping into the water.

            uData.walkTimer += delta * 5;
            const legAngle = Math.sin(uData.walkTimer) * 0.3;
            uData.legL.rotation.x = legAngle;
            uData.legR.rotation.x = -legAngle;
            // One arm clutched across the torso over the wound, the other
            // hanging and swaying loosely with the stumble. Hunched lean is
            // on the body/head locally so the group's facing stays clean.
            uData.armR.rotation.set(-1.9, 0.3, -0.4);
            uData.armL.rotation.set(-0.15 + Math.sin(uData.walkTimer) * 0.1, 0, 0);
            uData.body.rotation.x = 0.35;
            uData.head.rotation.x = 0.2;

            dropTrail();

            if (d.timer >= d.duration) {
              d.phase = 'kneel';
              d.kneelTimer = 0;
            }
          } else {
            d.kneelTimer += delta;
            const t = Math.min(d.kneelTimer / KNEEL_DURATION, 1);
            const ease = easeOutQuad(t);

            // Sinks down onto its knees, still clutching the wound, then dies.
            uData.body.rotation.x = lerp(0.35, 0.75, ease);
            uData.head.rotation.x = lerp(0.2, 0.45, ease);
            uData.legL.rotation.x = lerp(0, 1.6, ease);
            uData.legR.rotation.x = lerp(0, -0.3, ease);
            uData.body.position.y = lerp(0.525, 0.36, ease);
            uData.head.position.y = lerp(0.9, 0.68, ease);

            if (t >= 1) {
              finishDeathSequence(unit, d.moveDir);
              dyingUnits.splice(i, 1);
            }
          }
        }
      }
    }

    function removeSquadFromScene(squad, keepBoat) {
      squad.members.forEach(u => {
        if (u.userData.hpElement) u.userData.hpElement.remove();
      });
      if (squad.boat) {
        if (!keepBoat) {
          if (squad.boat.parent) squad.boat.parent.remove(squad.boat);
        } else if (squad.boat.parent === squad.group) {
          // Squad wiped out before disembarking - detach the boat with its
          // current world transform so it stays put instead of vanishing
          // along with the group.
          const worldPos = new THREE.Vector3();
          const worldQuat = new THREE.Quaternion();
          const worldScale = new THREE.Vector3();
          squad.boat.getWorldPosition(worldPos);
          squad.boat.getWorldQuaternion(worldQuat);
          squad.boat.getWorldScale(worldScale);
          squad.group.remove(squad.boat);
          squad.boat.position.copy(worldPos);
          squad.boat.quaternion.copy(worldQuat);
          squad.boat.scale.copy(worldScale);
          scene.add(squad.boat);
          registerStrandedBoat(squad.boat);
        } else {
          registerStrandedBoat(squad.boat);
        }
      }
      scene.remove(squad.group);
    }

    // Real-Time Combat Update Tick
    // --- Paladin passives (Holy Light + Light Shock) ---
    // How often the Paladin casts Holy Light, and how far it can reach an
    // ally to heal or an enemy to smite.
    const PALADIN_HOLY_LIGHT_INTERVAL = 8;
    const PALADIN_HOLY_LIGHT_RANGE = 6.0;
    const PALADIN_HOLY_LIGHT_HEAL_PCT = 0.5;   // heals the target ally for 50% of ITS max HP
    const PALADIN_HOLY_LIGHT_SMITE_PCT = 0.5;  // damages the target enemy for 50% of ITS max HP
    // How often the Paladin casts Light Shock, its damage, and how far
    // out from the Paladin itself the ring reaches.
    const PALADIN_LIGHT_SHOCK_INTERVAL = 10;
    const PALADIN_LIGHT_SHOCK_RADIUS = 3.0;
    const PALADIN_LIGHT_SHOCK_DAMAGE = 35;
    // How long the caster's own Holy Light / Light Shock cast gestures
    // (see the pose blocks in updateUnitAnims) hold before falling back
    // to the idle/attack pose - independent of the effect's own visual
    // timing, which is driven separately by spawnDivineResurrectionEffect/
    // spawnLightShockEffect.
    const PALADIN_HOLY_LIGHT_CAST_ANIM_DURATION = 0.7;
    const PALADIN_LIGHT_SHOCK_CAST_ANIM_DURATION = 0.55;
    // How long a unit is considered "actively in combat" after it last
    // landed an attack (see the inCombatTimer set in processUnitAttack).
    // This was being read before it was ever defined, throwing a
    // ReferenceError on every single melee/ranged hit and freezing the
    // battle. Encourage (the passive meant to consume this flag and boost
    // nearby Paladins' dmgMultiplier while allies are fighting - see the
    // comment on baseDmgMultiplier in applySquadLevelStats) isn't wired up
    // in updatePaladinAbilities yet, so inCombatTimer is just being
    // tracked, not acted on, until that passive is actually built.
    const PALADIN_IN_COMBAT_WINDOW = 3;

    // --- Lich passives (Frost Nova + Death Coil) ---
    // How often the Lich casts Frost Nova, its damage, and how far out
    // from the Lich itself the ring reaches - same shape as Paladin's
    // Light Shock above, just icy instead of holy.
    const LICH_FROST_NOVA_INTERVAL = 9;
    const LICH_FROST_NOVA_RADIUS = 3.0;
    const LICH_FROST_NOVA_DAMAGE = 30;
    // How often the Lich casts Death Coil, how far it reaches for a
    // target, and how much damage/healing each cast moves.
    const LICH_DEATH_COIL_INTERVAL = 7;
    const LICH_DEATH_COIL_RANGE = 6.0;
    const LICH_DEATH_COIL_AMOUNT = 40;

    // Drives both Lich passives every frame, independently of each other
    // and of its own melee staff swing in processUnitAttack - same
    // pattern as updatePaladinAbilities just below, reusing
    // spawnLightShockEffect for Frost Nova's ring visual (it's already a
    // plain expanding-ring effect, not holy-colored geometry) and
    // healUnit/spawnFloatingText for Death Coil's heal half.
    function updateLichAbilities(delta) {
      const allPlayerUnits = [];
      squads.forEach(s => s.members.forEach(m => allPlayerUnits.push(m)));
      militiaSquads.forEach(s => s.members.forEach(m => allPlayerUnits.push(m)));
      const allRaiderUnits = [];
      raiderSquads.forEach(s => s.members.forEach(m => allRaiderUnits.push(m)));

      squads.forEach(squad => {
        if (squad.type !== 'lich') return;

        squad.members.forEach(lich => {
          const lData = lich.userData;
          if (lData.hp <= 0) return;

          const lichWorldPos = new THREE.Vector3();
          lich.getWorldPosition(lichWorldPos);

          // Frost Nova - a ring of freezing energy centered on the Lich
          // itself, damaging every enemy caught within it.
          lData.frostNovaCooldown = (lData.frostNovaCooldown || 0) - delta;
          if (lData.frostNovaCooldown <= 0) {
            lData.frostNovaCooldown = LICH_FROST_NOVA_INTERVAL;

            let hitAny = false;
            allRaiderUnits.forEach(r => {
              if (r.userData.hp <= 0) return;
              const rPos = new THREE.Vector3();
              r.getWorldPosition(rPos);
              if (lichWorldPos.distanceTo(rPos) > LICH_FROST_NOVA_RADIUS) return;
              hitAny = true;
              applyDamage(r, LICH_FROST_NOVA_DAMAGE, 'lichFrostNova', lichWorldPos, lich, false);
            });
            if (hitAny) {
              spawnLightShockEffect(lichWorldPos.clone(), LICH_FROST_NOVA_RADIUS);
              spawnFloatingText(lichWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'FROST NOVA!', '#7fe8ff');
            }
          }

          // Death Coil - fires at the nearest enemy in range, damaging
          // it and healing the most wounded ally on the field for the
          // same amount. Same independent-target-search shape as
          // Paladin's Holy Light - the heal half can land even if no
          // enemy is in range to be hit, and vice versa.
          lData.deathCoilCooldown = (lData.deathCoilCooldown || 0) - delta;
          if (lData.deathCoilCooldown <= 0) {
            lData.deathCoilCooldown = LICH_DEATH_COIL_INTERVAL;

            let coilTarget = null, coilDist = Infinity;
            allRaiderUnits.forEach(r => {
              if (r.userData.hp <= 0) return;
              const rPos = new THREE.Vector3();
              r.getWorldPosition(rPos);
              const d = lichWorldPos.distanceTo(rPos);
              if (d <= LICH_DEATH_COIL_RANGE && d < coilDist) { coilDist = d; coilTarget = r; }
            });

            let woundedTarget = null, worstPct = 1;
            allPlayerUnits.forEach(m => {
              if (m === lich || m.userData.hp <= 0 || m.userData.hp >= m.userData.maxHp) return;
              const pct = m.userData.hp / m.userData.maxHp;
              if (pct < worstPct) { worstPct = pct; woundedTarget = m; }
            });

            if (coilTarget) {
              const coilWorldPos = new THREE.Vector3();
              coilTarget.getWorldPosition(coilWorldPos);
              applyDamage(coilTarget, LICH_DEATH_COIL_AMOUNT, 'lichDeathCoil', lichWorldPos, lich, false);
              spawnFloatingText(coilWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'DEATH COIL!', '#8b5ce8');
              spawnParticle(coilWorldPos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0x8b5ce8, 0.09, 0.5);
            }
            if (woundedTarget) {
              healUnit(woundedTarget, LICH_DEATH_COIL_AMOUNT);
            }
          }
        });
      });
    }

    // Kitsune Twinblade passive - Fox Spirit Renewal: once Frost Warden
    // has been actively fighting for KITSUNE_RENEWAL_INTERVAL seconds
    // (tracked via the shared inCombatTimer every unit already keeps,
    // refreshed on each attack it lands - see the PALADIN_IN_COMBAT_WINDOW
    // comment above), she restores a slice of both her own and Ember
    // Fang's max HP. That first proc is guaranteed; every
    // KITSUNE_RENEWAL_INTERVAL seconds after that, as long as combat is
    // still going, only a low chance triggers another one, rather than a
    // free heal on a flat repeating clock. Dropping out of combat (her
    // inCombatTimer lapsing) resets the whole thing, so a fresh fight
    // always starts with another guaranteed first heal.
    const KITSUNE_RENEWAL_INTERVAL = 10; // seconds between combat checks/procs
    const KITSUNE_RENEWAL_HEAL_PCT = 0.12; // 12% of max HP restored, to each of the pair
    const KITSUNE_RENEWAL_REPEAT_CHANCE = 0.3; // chance to repeat after the first guaranteed proc
    const KITSUNE_RENEWAL_TICK_COUNT = 5; // regen spread across this many ticks...
    const KITSUNE_RENEWAL_TICK_INTERVAL = 1; // ...one per second, rather than landing all at once

    function triggerKitsuneFoxSpiritRenewal(spearUnit) {
      const pos = new THREE.Vector3();
      spearUnit.getWorldPosition(pos);
      spawnFloatingText(pos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'FOX SPIRIT RENEWAL!', '#8fffb0');
      spawnKitsuneRenewalBurst(pos);

      applyRegen(spearUnit, spearUnit.userData.maxHp * KITSUNE_RENEWAL_HEAL_PCT, KITSUNE_RENEWAL_TICK_COUNT, KITSUNE_RENEWAL_TICK_INTERVAL);
      if (spearUnit.parent) {
        const partner = spearUnit.parent.children.find(c =>
          c.userData && c.userData.unitType === 'kitsuneTwinblade' && c.userData.kitsuneRole === 'blade' && c.userData.hp > 0);
        if (partner) {
          const partnerPos = new THREE.Vector3();
          partner.getWorldPosition(partnerPos);
          spawnKitsuneRenewalBurst(partnerPos);
          applyRegen(partner, partner.userData.maxHp * KITSUNE_RENEWAL_HEAL_PCT, KITSUNE_RENEWAL_TICK_COUNT, KITSUNE_RENEWAL_TICK_INTERVAL);
        }
      }
    }

    function updateKitsuneTwinbladeAbilities(delta) {
      squads.forEach(squad => {
        if (squad.type !== 'kitsuneTwinblade') return;
        squad.members.forEach(unit => {
          const uData = unit.userData;
          if (uData.kitsuneRole !== 'spear' || uData.hp <= 0) return;

          if (uData.inCombatTimer <= 0) {
            // Out of combat - reset so the next fight starts fresh with
            // another guaranteed first heal rather than picking up
            // mid-cooldown or mid-chance-streak from a fight long over.
            uData.foxRenewalTimer = 0;
            uData.foxRenewalFirstProcDone = false;
            return;
          }

          uData.foxRenewalTimer = (uData.foxRenewalTimer || 0) - delta;
          if (uData.foxRenewalTimer > 0) return;
          uData.foxRenewalTimer = KITSUNE_RENEWAL_INTERVAL;

          const shouldHeal = !uData.foxRenewalFirstProcDone || Math.random() < KITSUNE_RENEWAL_REPEAT_CHANCE;
          uData.foxRenewalFirstProcDone = true;
          if (shouldHeal) triggerKitsuneFoxSpiritRenewal(unit);
        });
      });
    }


    // other and of the normal attack/targeting loop (same shape as
    // updateDoctorSupport just below) - a Paladin still swings its
    // Greatsword/Warhammer normally in processUnitAttack; these are
    // separate periodic casts layered on top.
    function updatePaladinAbilities(delta) {
      const allPlayerUnits = [];
      squads.forEach(s => s.members.forEach(m => allPlayerUnits.push(m)));
      militiaSquads.forEach(s => s.members.forEach(m => allPlayerUnits.push(m)));
      const allRaiderUnits = [];
      raiderSquads.forEach(s => s.members.forEach(m => allRaiderUnits.push(m)));

      squads.forEach(squad => {
        if (squad.type !== 'paladins') return;

        squad.members.forEach(paladin => {
          const pData = paladin.userData;
          if (pData.hp <= 0) return;

          const paladinWorldPos = new THREE.Vector3();
          paladin.getWorldPosition(paladinWorldPos);

          // Holy Light - heals the most wounded ally in range for 50% of
          // its own max HP, and separately smites the nearest enemy in
          // range for 50% of its own max HP in damage. Either half can
          // fire on its own (e.g. no enemy in range yet still heals an
          // ally) - they're independent target searches, not a
          // heal-then-damage combo that requires both to be found.
          pData.holyLightCooldown = (pData.holyLightCooldown || 0) - delta;
          if (pData.holyLightCooldown <= 0) {
            pData.holyLightCooldown = PALADIN_HOLY_LIGHT_INTERVAL;

            let woundedTarget = null, worstPct = 1;
            allPlayerUnits.forEach(m => {
              if (m === paladin || m.userData.hp <= 0 || m.userData.hp >= m.userData.maxHp) return;
              const mPos = new THREE.Vector3();
              m.getWorldPosition(mPos);
              if (paladinWorldPos.distanceTo(mPos) > PALADIN_HOLY_LIGHT_RANGE) return;
              const pct = m.userData.hp / m.userData.maxHp;
              if (pct < worstPct) { worstPct = pct; woundedTarget = m; }
            });

            let smiteTarget = null, smiteDist = Infinity;
            allRaiderUnits.forEach(r => {
              if (r.userData.hp <= 0) return;
              const rPos = new THREE.Vector3();
              r.getWorldPosition(rPos);
              const d = paladinWorldPos.distanceTo(rPos);
              if (d <= PALADIN_HOLY_LIGHT_RANGE && d < smiteDist) { smiteDist = d; smiteTarget = r; }
            });

            if (woundedTarget) {
              const healAmount = woundedTarget.userData.maxHp * PALADIN_HOLY_LIGHT_HEAL_PCT;
              healUnit(woundedTarget, healAmount);
              const healWorldPos = new THREE.Vector3();
              woundedTarget.getWorldPosition(healWorldPos);
              spawnFloatingText(healWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'HOLY LIGHT!', '#ffe066');
              spawnDivineResurrectionEffect(healWorldPos.clone());
            }

            if (smiteTarget) {
              const smiteDmg = smiteTarget.userData.maxHp * PALADIN_HOLY_LIGHT_SMITE_PCT;
              const smiteWorldPos = new THREE.Vector3();
              smiteTarget.getWorldPosition(smiteWorldPos);
              applyDamage(smiteTarget, smiteDmg, 'paladinHolyLight', smiteWorldPos, paladin, false);
              spawnFloatingText(smiteWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'SMITE!', '#fff2c0');
              // Same "bolt strikes down from the sky" shape as the Bear
              // Warrior's lightning, just recolored gold-white for a holy
              // smite instead of an electric strike.
              spawnLightningBoltEffect(smiteWorldPos.clone(), 0xfff2c0, 0xffffff);
            }

            // Play the caster's own arms-raised invocation gesture (see
            // updateUnitAnims) whenever Holy Light actually did something
            // visible - no point striking the pose over an empty field.
            if (woundedTarget || smiteTarget) {
              pData.holyLightCastAnimTimer = PALADIN_HOLY_LIGHT_CAST_ANIM_DURATION;
            }
          }

          // Light Shock - an expanding ring of holy energy centered on
          // the Paladin itself, damaging every enemy caught inside it
          // once it's fully landed rather than a beam aimed at any one
          // target.
          pData.lightShockCooldown = (pData.lightShockCooldown || 0) - delta;
          if (pData.lightShockCooldown <= 0) {
            pData.lightShockCooldown = PALADIN_LIGHT_SHOCK_INTERVAL;

            const hasEnemyInRange = allRaiderUnits.some(r => {
              if (r.userData.hp <= 0) return false;
              const rPos = new THREE.Vector3();
              r.getWorldPosition(rPos);
              return paladinWorldPos.distanceTo(rPos) <= PALADIN_LIGHT_SHOCK_RADIUS;
            });
            if (hasEnemyInRange) {
              spawnFloatingText(paladinWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'LIGHT SHOCK!', '#fff2c0');
              spawnLightShockEffect(paladinWorldPos.clone(), PALADIN_LIGHT_SHOCK_RADIUS);
              // Play the caster's own two-handed ground-slam gesture (see
              // updateUnitAnims) in lockstep with the ring actually
              // landing.
              pData.lightShockCastAnimTimer = PALADIN_LIGHT_SHOCK_CAST_ANIM_DURATION;
              allRaiderUnits.forEach(r => {
                if (r.userData.hp <= 0) return;
                const rPos = new THREE.Vector3();
                r.getWorldPosition(rPos);
                if (paladinWorldPos.distanceTo(rPos) <= PALADIN_LIGHT_SHOCK_RADIUS) {
                  applyDamage(r, PALADIN_LIGHT_SHOCK_DAMAGE, 'paladinLightShock', rPos, paladin, false);
                }
              });
            }
          }
        });
      });
    }

    // Doctor passives - Field Medic (heal) and Resurrection (revive).
    // Unlike every other squad passive, which is driven from inside
    // processUnitAttack per-unit, the Doctor is handled in its own pass
    // here (mirroring updatePaladinAbilities' shape) since it never enters
    // the attack/targeting loop at all - see the 'doctor' early-return in
    // processUnitAttack above.
    const DOCTOR_HEAL_RANGE = 3.0;        // world units a Doctor can reach with a heal
    const DOCTOR_HEAL_AMOUNT = 18;        // HP restored per heal pulse
    const DOCTOR_HEAL_INTERVAL = 1.3;     // seconds between heal pulses, per Doctor
    const DOCTOR_RES_CHECK_INTERVAL = 10; // seconds between revive rolls, per Doctor
    const DOCTOR_RES_CHANCE = 0.3;        // chance per roll to revive one fallen ally
    const DOCTOR_RETREAT_DISTANCE = 1.0;  // 1 tile, same flat unit as MELEE_ENGAGE_RANGE

    function updateDoctorSupport(delta) {
      const allPlayerUnits = [];
      squads.forEach(s => s.members.forEach(m => allPlayerUnits.push(m)));
      militiaSquads.forEach(s => s.members.forEach(m => allPlayerUnits.push(m)));

      squads.forEach(squad => {
        if (squad.type !== 'doctor') return;

        squad.members.forEach(doctor => {
          const dData = doctor.userData;
          if (dData.hp <= 0) return;

          const doctorWorldPos = new THREE.Vector3();
          doctor.getWorldPosition(doctorWorldPos);

          // Field Medic - periodically heals whichever wounded ally
          // (anywhere in the player's forces, not just its own squad,
          // same reach philosophy as the Cleric NPC's updateClericAssist)
          // is both in range and currently the most hurt.
          dData.doctorHealCooldown = (dData.doctorHealCooldown || 0) - delta;
          if (dData.doctorHealCooldown <= 0) {
            dData.doctorHealCooldown = DOCTOR_HEAL_INTERVAL;

            let woundedTarget = null;
            let worstPct = 1;
            allPlayerUnits.forEach(m => {
              if (m === doctor || m.userData.hp <= 0 || m.userData.hp >= m.userData.maxHp) return;
              const mWorldPos = new THREE.Vector3();
              m.getWorldPosition(mWorldPos);
              if (doctorWorldPos.distanceTo(mWorldPos) > DOCTOR_HEAL_RANGE) return;
              const pct = m.userData.hp / m.userData.maxHp;
              if (pct < worstPct) { worstPct = pct; woundedTarget = m; }
            });

            if (woundedTarget) healUnit(woundedTarget, DOCTOR_HEAL_AMOUNT);
          }

          // Resurrection - periodically rolls a chance to bring back one
          // fallen member of any squad in the player's own roster. A
          // zombie-reanimated ally is never a candidate: it isn't a
          // fallen squad member to begin with (spawnZombieAlly registers
          // it as its own single-member militiaSquads entry, entirely
          // outside the squads array this scans), but the isZombie guard
          // is kept here too as an explicit belt-and-braces exclusion in
          // case that ever changes.
          dData.doctorResCooldown = (dData.doctorResCooldown || 0) - delta;
          if (dData.doctorResCooldown <= 0) {
            dData.doctorResCooldown = DOCTOR_RES_CHECK_INTERVAL;

            const candidates = squads.filter(s => {
              if (s.isZombieSquad || s.members.some(m => m.userData.isZombie)) return false;
              const maxMembers = (squadDef(s.type) || {}).memberCount || 4;
              return s.members.length < maxMembers;
            });

            if (candidates.length > 0 && Math.random() < DOCTOR_RES_CHANCE) {
              const targetSquad = candidates[Math.floor(Math.random() * candidates.length)];
              const revived = reviveNextSquadMember(targetSquad);
              if (revived) {
                const revivedWorldPos = new THREE.Vector3();
                revived.getWorldPosition(revivedWorldPos);
                spawnFloatingText(revivedWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'REVIVED!', '#66ff88');
                spawnDivineResurrectionEffect(revivedWorldPos.clone());
                spawnFloatingText(doctorWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'RESURRECTION!', '#66ff88');
              }
            }
          }
        });
      });
    }


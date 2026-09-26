    function killMilitiaHorse(unit) {
      const uData = unit.userData;
      const horse = uData.horseMesh;
      if (!horse) return;

      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      const worldScale = new THREE.Vector3();
      horse.getWorldPosition(worldPos);
      horse.getWorldQuaternion(worldQuat);
      horse.getWorldScale(worldScale);

      unit.remove(horse);
      scene.add(horse);
      horse.position.copy(worldPos);
      horse.quaternion.copy(worldQuat);
      horse.scale.copy(worldScale);

      // A lucky horse bolts instead of going down with its rider - it only
      // gets the chance to flee if there's a Barracks on the island to run
      // home to; otherwise it always collapses as before.
      if (barracksTile && Math.random() < HORSE_SURVIVE_CHANCE) {
        fleeingHorses.push({
          mesh: horse,
          phase: 'panic', // 'panic' (running loose) -> 'toBarracks' -> removed on arrival
          panicTimer: HORSE_FLEE_DURATION,
          legTimer: 0, // time left running toward the current panic waypoint
          waypoint: null
        });
      } else {
        spawnBloodTrailDecal(worldPos);
        fallingHorses.push({ mesh: horse, fallTimer: 0 });
      }

      // The rider is on foot from here on - drop back to ground height and
      // clear the riding leg pose so the normal walk/idle/death animations
      // take over cleanly instead of the fixed straddle pose.
      uData.horseMesh = null;
      uData.isMounted = false;
      unit.position.y = 0;
      uData.legL.rotation.z = 0;
      uData.legR.rotation.z = 0;
    }

    // Tips a detached horse over onto its side and settles it into the
    // ground, then removes it - a quick, self-contained "death" for the
    // horse that runs independently of the rider's own death animation.
    function updateFallingHorses(delta) {
      for (let i = fallingHorses.length - 1; i >= 0; i--) {
        const fh = fallingHorses[i];
        fh.fallTimer += delta;
        const t = Math.min(1, fh.fallTimer / HORSE_FALL_DURATION);
        fh.mesh.rotation.z = t * (Math.PI / 2);
        fh.mesh.position.y -= delta * 0.6 * (1 - t);
        if (t >= 1) {
          if (fh.mesh.parent) fh.mesh.parent.remove(fh.mesh);
          fallingHorses.splice(i, 1);
        }
      }
    }

    // Picks a random nearby point for a panicking horse to bolt toward,
    // preferring land it can actually reach - tries a handful of angles at
    // shrinking distance before giving up and just picking a short hop in a
    // random direction.
    function pickHorsePanicWaypoint(pos) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 1 + Math.random() * HORSE_ROAM_RADIUS;
        const x = pos.x + Math.cos(angle) * dist;
        const z = pos.z + Math.sin(angle) * dist;
        if (getSurfaceY(x, z) !== null) return { x, z };
      }
      const angle = Math.random() * Math.PI * 2;
      return { x: pos.x + Math.cos(angle) * 0.6, z: pos.z + Math.sin(angle) * 0.6 };
    }

    // Drives a riderless horse that survived its rider's death: it panic-runs
    // to random nearby points for HORSE_FLEE_DURATION seconds, then breaks
    // for the Barracks and disappears once it reaches the door.
    function updateFleeingHorses(delta) {
      for (let i = fleeingHorses.length - 1; i >= 0; i--) {
        const fh = fleeingHorses[i];
        const pos = fh.mesh.position;

        if (fh.phase === 'panic') {
          fh.panicTimer -= delta;
          fh.legTimer -= delta;
          if (!fh.waypoint || fh.legTimer <= 0) {
            fh.waypoint = pickHorsePanicWaypoint(pos);
            fh.legTimer = HORSE_ROAM_LEG_MIN + Math.random() * (HORSE_ROAM_LEG_MAX - HORSE_ROAM_LEG_MIN);
          }
          if (fh.panicTimer <= 0) {
            fh.phase = 'toBarracks';
            fh.waypoint = null;
          }
        }

        // Re-check fh.phase (rather than reusing the check above) since
        // the panic timer running out just above can flip it to
        // 'toBarracks' on this very frame - reading fh.waypoint.x here
        // unconditionally used to crash the instant that happened,
        // because it had just been cleared to null a few lines up.
        let targetX, targetZ;
        if (fh.phase === 'panic') {
          targetX = fh.waypoint.x;
          targetZ = fh.waypoint.z;
        } else {
          targetX = barracksTile ? barracksTile.x : pos.x;
          targetZ = barracksTile ? barracksTile.z : pos.z;
        }

        const dx = targetX - pos.x;
        const dz = targetZ - pos.z;
        const dist = Math.hypot(dx, dz);

        if (fh.phase === 'toBarracks' && dist < HORSE_HIDE_DISTANCE) {
          if (fh.mesh.parent) fh.mesh.parent.remove(fh.mesh);
          fleeingHorses.splice(i, 1);
          continue;
        }

        if (dist > 0.001) {
          const dirX = dx / dist, dirZ = dz / dist;
          const step = Math.min(dist, HORSE_FLEE_SPEED * delta);
          pos.x += dirX * step;
          pos.z += dirZ * step;
          fh.mesh.rotation.y = Math.atan2(dirX, dirZ);
          const groundY = getSurfaceY(pos.x, pos.z);
          if (groundY !== null) pos.y = groundY;
        }
      }
    }

    // Picks one of the six militia classes: Sword, Spear, or Archer, each
    // either on foot or mounted.
    function randomMilitiaLoadout() {
      const weapon = MILITIA_WEAPON_TYPES[Math.floor(Math.random() * MILITIA_WEAPON_TYPES.length)];
      const mounted = Math.random() < 0.5;
      return { weapon, mounted };
    }

    function createMilitiaUnit(loadout) {
      const unit = createBlockyHumanoid(MILITIA_COLOR, false);
      equipUnit(unit, loadout.weapon);
      unit.userData.isMilitia = true;
      unit.userData.isMounted = loadout.mounted;

      if (loadout.mounted) {
        const horse = createMilitiaHorse();
        horse.position.set(0, -MILITIA_MOUNT_SEAT_Y, -0.05);
        unit.add(horse);
        unit.userData.horseMesh = horse;
        // Raise the rider into the saddle and bend the legs into a straddling pose.
        unit.position.y = MILITIA_MOUNT_SEAT_Y;
        unit.userData.legL.rotation.set(-1.15, 0, 0.22);
        unit.userData.legR.rotation.set(-1.15, 0, -0.22);
      }

      return unit;
    }

    function createMilitiaSquad(x, y, z) {
      const group = new THREE.Group();
      const members = [];

      for (let i = 0; i < 4; i++) {
        const loadout = randomMilitiaLoadout();
        const unit = createMilitiaUnit(loadout);
        const col = i % 2, row = Math.floor(i / 2);
        unit.position.x = col * 0.45 - 0.225;
        unit.position.z = row * 0.45 - 0.225;
        // See createSquad - lets a knocked-back Militia member walk back
        // into formation once it has nothing left in range to fight.
        unit.userData.formationOffset = new THREE.Vector3(unit.position.x, unit.position.y, unit.position.z);
        group.add(unit);
        members.push(unit);
      }

      group.scale.set(0.6, 0.6, 0.6);
      group.position.set(x, y, z);
      scene.add(group);

      return {
        type: 'militia',
        group,
        members,
        isMoving: false,
        targetPosition: new THREE.Vector3(),
        currentPath: [],
        currentWaypoint: 0,
        moveSpeed: MILITIA_MOVE_SPEED,
        state: 'roaming', // 'roaming' -> 'rallying' -> 'engaging'
        roamTimer: 1 + Math.random() * 2,
        homeTile: { x: Math.round(x), z: Math.round(z) },
        aiCooldown: 0,
        currentTargetSquad: null, // which raider warband this militia squad is currently committed to fighting
      };
    }

    // Spawns a 4-unit Villager Militia squad beside a newly placed Barracks.
    function spawnMilitiaSquad(x, y, z) {
      const squad = createMilitiaSquad(x, y, z);
      militiaSquads.push(squad);
    }

    // Kicks off a path for a militia squad exactly the way a player's move
    // command does, without needing a mouse click.
    function issueMilitiaMove(squad, goalX, goalZ) {
      // A Zombie ally spawns and stands right inside the Cemetery's walled
      // enclosure, ringed with gravestone/fence colliders (see
      // createGravestone/createCemeteryFence). The Undertaker itself
      // bypasses those same colliders when it walks the corpse in through
      // the gate (avoidProps=false - see updateUndertaker), but this call
      // defaulted to avoidProps=true for every militia squad, so a Zombie's
      // own roam/rally/engage path out of the graveyard kept coming back
      // blocked/null and it never actually left - it just stood there.
      // Route it the same way the Undertaker does.
      const path = findPath(squad.group.position.x, squad.group.position.z, goalX, goalZ, true, !squad.isZombieSquad);
      if (!path || path.length === 0) return false;

      squad.currentPath = path;
      squad.currentWaypoint = 0;

      const firstStep = path[0];
      const stepY = getSurfaceY(firstStep.x, firstStep.z);
      squad.targetPosition.set(firstStep.x, stepY !== null ? stepY : squad.group.position.y, firstStep.z);
      squad.isMoving = true;
      squad.group.userData.isMoving = true;
      squad.members.forEach(unit => unit.userData.isWalking = true);

      const startDx = squad.targetPosition.x - squad.group.position.x;
      const startDz = squad.targetPosition.z - squad.group.position.z;
      const startDir = new THREE.Vector3();
      if (Math.abs(startDx) > 0.05) startDir.set(Math.sign(startDx), 0, 0);
      else startDir.set(0, 0, Math.sign(startDz));
      squad.group.rotation.y = Math.atan2(startDir.x, startDir.z);
      return true;
    }

    function findNearestRaiderSquad(squad) {
      const liveRaiderSquads = raiderSquads.filter(rs => rs.members.length > 0 && !rs.onBoat);
      if (liveRaiderSquads.length === 0) return null;

      // Same spread logic as the raiders' own targeting (see
      // RAIDER_TARGET_SPREAD_PENALTY): with several warbands ashore,
      // militia squads fan out to meet different landing parties instead of
      // every squad converging on whichever warband happens to be closest,
      // which otherwise let other warbands walk in unopposed.
      let best = null, bestScore = Infinity;
      liveRaiderSquads.forEach(rs => {
        const d = Math.hypot(
          rs.group.position.x - squad.group.position.x,
          rs.group.position.z - squad.group.position.z
        );

        let claims = 0;
        militiaSquads.forEach(ms => {
          if (ms !== squad && ms.currentTargetSquad === rs && ms.members.length > 0) claims++;
        });

        const score = d + claims * RAIDER_TARGET_SPREAD_PENALTY;
        if (score < bestScore) { bestScore = score; best = rs; }
      });

      squad.currentTargetSquad = best;
      return best;
    }

    // Roam / Rally / Engage state machine for a Villager Militia squad.
    function updateMilitiaAI(squad, delta) {
      if (squad.members.length === 0) return;

      const raidActive = raiderSquads.length > 0;

      if (raidActive && squad.state === 'roaming') {
        // Raiders have landed (or are on the way) - fall back to the
        // Barracks and rally before sallying out.
        squad.state = 'rallying';
      } else if (!raidActive && squad.state !== 'roaming') {
        // The raid is over - stand down and go back to wandering the island.
        squad.state = 'roaming';
        squad.roamTimer = MILITIA_ROAM_INTERVAL_MIN + Math.random() * (MILITIA_ROAM_INTERVAL_MAX - MILITIA_ROAM_INTERVAL_MIN);
      }

      squad.aiCooldown -= delta;

      if (squad.state === 'roaming') {
        squad.roamTimer -= delta;
        if (!squad.isMoving && squad.roamTimer <= 0) {
          squad.roamTimer = MILITIA_ROAM_INTERVAL_MIN + Math.random() * (MILITIA_ROAM_INTERVAL_MAX - MILITIA_ROAM_INTERVAL_MIN);
          let goalX, goalZ;
          if (squad.isZombieSquad) {
            // Zombies roam the whole island rather than sticking near the
            // Undertaker House - sample an actual land tile (heightMap only
            // has entries for real land, never open water) so each wander
            // leg can carry it well away from home instead of repeatedly
            // aiming at the sea.
            const landTile = pickRandomLandTile();
            if (landTile) { goalX = landTile.x; goalZ = landTile.z; }
            else { goalX = squad.group.position.x; goalZ = squad.group.position.z; }
          } else {
            const angle = Math.random() * Math.PI * 2;
            const dist = 1 + Math.random() * MILITIA_ROAM_RADIUS;
            goalX = Math.round(squad.homeTile.x + Math.cos(angle) * dist);
            goalZ = Math.round(squad.homeTile.z + Math.sin(angle) * dist);
          }
          issueMilitiaMove(squad, goalX, goalZ);
        }
        return;
      }

      if (squad.state === 'rallying') {
        if (!squad.isMoving) {
          const d = Math.hypot(squad.group.position.x - squad.homeTile.x, squad.group.position.z - squad.homeTile.z);
          if (d <= MILITIA_RALLY_RADIUS) {
            squad.state = 'engaging';
          } else if (squad.aiCooldown <= 0) {
            squad.aiCooldown = 0.6;
            issueMilitiaMove(squad, squad.homeTile.x, squad.homeTile.z);
          }
        }
        return;
      }

      if (squad.state === 'engaging') {
        if (squad.isMoving || squad.aiCooldown > 0) return;
        squad.aiCooldown = 0.8 + Math.random() * 0.6;

        const target = findNearestRaiderSquad(squad);
        if (!target) return;

        const dx = target.group.position.x - squad.group.position.x;
        const dz = target.group.position.z - squad.group.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist < RAIDER_ATTACK_RANGE) {
          if (dx * dx + dz * dz > 0.0001) squad.group.rotation.y = Math.atan2(dx, dz);
          return;
        }

        const goalX = Math.round(target.group.position.x);
        const goalZ = Math.round(target.group.position.z);
        issueMilitiaMove(squad, goalX, goalZ);
      }
    }

    function startWave() {
      // The short post-start cooldown blocks a re-press, but the
      // intermission doesn't - pressing Start Wave during it skips the
      // rest of the countdown and starts the next wave right away.
      if (waveCooldownActive && !waveIntermissionActive) return;
      if (activeWaveLimit !== 'endless' && waveNumber >= activeWaveLimit) return;

      waveNumber++;
      spawnRaiderWave(waveNumber);
      maybeOpenDemonPortal();
      maybeAwakenScarecrow();
      maybeAwakenGargoyles();
      maybeSpawnOrcWarband();
      maybeStartWatchTowerBuild();
      hideVillagers();

      waveInProgress = true;
      runWaveCooldown(WAVE_COOLDOWN_SECONDS, false);
    }

    // Shared countdown for the Start Wave button. Used for the short
    // anti-spam cooldown right after a wave starts, and for the 60s
    // intermission after a wave is finished, which auto-starts the next
    // wave when it hits 0. The countdown holds while the game is paused.
    function runWaveCooldown(seconds, isIntermission) {
      waveIntermissionActive = !!isIntermission;
      waveCooldownActive = true;
      waveCooldownRemaining = seconds;
      updateWaveUI();

      if (waveCooldownInterval) clearInterval(waveCooldownInterval);
      waveCooldownInterval = setInterval(() => {
        if (gamePaused) return;
        waveCooldownRemaining--;
        if (waveCooldownRemaining <= 0) {
          clearInterval(waveCooldownInterval);
          waveCooldownInterval = null;
          waveCooldownActive = false;
          waveIntermissionActive = false;
          waveCooldownRemaining = 0;
          updateWaveUI();
          // Intermission over -> the next wave starts by itself (not
          // while the player is inside the Castle; the Start Wave
          // button takes over again once they retreat).
          if (isIntermission && !inCastleInterior) startWave();
          return;
        }
        updateWaveUI();
      }, 1000);
    }

    // Called the moment the last raider falls. Starts the intermission
    // unless the run is over (final wave -> Victory) or the player is
    // inside the Castle.
    function onWaveFinished() {
      if (!waveInProgress) return;
      waveInProgress = false;
      if (inCastleInterior) return;
      if (activeWaveLimit !== 'endless' && waveNumber >= activeWaveLimit) { updateWaveUI(); return; }
      runWaveCooldown(WAVE_INTERMISSION_SECONDS, true);
    }

    function updateWaveUI() {
      const info = document.getElementById('wave-info');
      const btn = document.getElementById('wave-btn');
      if (!info || !btn) return;

      // Start Wave is disabled for the duration of the Castle Interior
      // assault (see enterCastleInterior) and comes back on its own the
      // moment this function next runs after retreatToOuterIsland clears
      // inCastleInterior - no separate re-enable path needed.
      if (inCastleInterior) {
        info.textContent = castleInteriorCleared ? '🏰 Castle cleared - retreat to claim it' : '🏯 Assaulting the Castle...';
        btn.disabled = true;
        btn.textContent = '⚔️ Inside the Castle';
        return;
      }

      const raiderCount = raiderSquads.reduce((n, s) => n + s.members.length, 0);
      const hasLimit = activeWaveLimit !== 'endless';
      const atFinalWave = hasLimit && waveNumber >= activeWaveLimit;

      // Once the last allowed wave has been cleared, declare victory
      // instead of offering another wave.
      if (atFinalWave && waveNumber > 0 && raiderCount === 0) {
        info.textContent = eventFactionActive === 'death'
          ? `💀 Victory! The Heavenly Island has fallen`
          : eventFactionActive === 'life'
            ? `✨ Victory! The Heavenly Island stands`
            : `🏆 Victory! All ${activeWaveLimit} waves cleared`;
        btn.disabled = true;
        btn.textContent = '🏆 Victory!';
        return;
      }

      info.textContent = waveIntermissionActive
        ? `✅ Wave ${waveNumber} cleared • Next wave in ${waveCooldownRemaining}s`
        : waveNumber > 0
          ? `Wave ${waveNumber}${hasLimit ? ' / ' + activeWaveLimit : ''} • Raiders: ${raiderCount}`
          : 'No raiders yet';

      if (atFinalWave) {
        btn.disabled = true;
        btn.textContent = 'Final Wave';
      } else {
        btn.disabled = waveCooldownActive && !waveIntermissionActive;
        btn.textContent = waveIntermissionActive
          ? `⚔️ Start Wave (${waveCooldownRemaining}s)`
          : waveCooldownActive ? `⏳ ${waveCooldownRemaining}s` : '⚔️ Start Wave';
      }
    }

    function updateSquadCountUI() {
      squads.forEach((s, i) => {
        const el = document.getElementById(`count-slot-${i}`);
        const maxMembers = (squadDef(s.type) || {}).memberCount || 4;
        if (el) el.textContent = `${s.members.length}/${maxMembers}`;

        // A wiped-out squad has nothing left to select - hide its
        // selection ring rather than leaving it glowing on the empty
        // ground where the squad used to stand. (Its group/ring aren't
        // removed from the scene entirely since a wiped squad can still
        // respawn - see respawnSquad - so the ring needs to be hidden
        // here rather than relying on the group being torn down.)
        if (s.members.length === 0 && s.ring) s.ring.visible = false;
        if (s.members.length === 0 && s.attackMarker) s.attackMarker.visible = false;
      });
    }


    const selectionRingGeo = new THREE.RingGeometry(0.55, 0.7, 24);
    const selectionRingMat = new THREE.MeshBasicMaterial({ color: 0xffee55, transparent: true, opacity: 0.85, side: THREE.DoubleSide });

    // Attack-area marker: one persistent ground zone PER player squad
    // (unlike the single shared targetHighlight, which only ever shows
    // the currently SELECTED squad's move target) - a filled red disc
    // plus outline ring dropped at wherever that squad was last ordered
    // to move/attack, visible for every squad at once so you can see the
    // whole battle plan without tapping through each squad. Hidden again
    // the moment that squad arrives or gives up pathing (see
    // stepSquadMovement's three arrival/fail sites).
    const attackAreaGeo = new THREE.CircleGeometry(0.42, 24);
    const attackAreaMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    const attackAreaRingGeo = new THREE.RingGeometry(0.4, 0.48, 24);
    const attackAreaRingMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });

    function createAttackAreaMarker() {
      const marker = new THREE.Group();
      const fill = new THREE.Mesh(attackAreaGeo, attackAreaMat);
      const outline = new THREE.Mesh(attackAreaRingGeo, attackAreaRingMat);
      fill.rotation.x = outline.rotation.x = -Math.PI / 2;
      marker.add(fill, outline);
      marker.visible = false;
      marker.renderOrder = 5;
      scene.add(marker);
      return marker;
    }

    // Shows squad's attack-area marker at (x, z) - called from every
    // player-issued move/attack order site (tap-to-move, Siege the
    // Fortress) alongside that order's own targetHighlight update.
    function showAttackArea(squad, x, z, y) {
      if (!squad.attackMarker) return;
      squad.attackMarker.position.set(x, (y ?? 0) + 0.03, z);
      squad.attackMarker.visible = true;
    }

    // Builds one Desert Warriors squad member with a randomly-rolled
    // "Arabic" outfit/headwear combo - shared by createSquad and
    // respawnSquad so a fresh squad and a respawned one dress the same
    // way. Each unit rolls its own outfit and headwear independently, so
    // a 4-member squad reads as a mixed band rather than four clones.
    function createDesertWarriorHumanoid() {
      const outfit = DESERT_WARRIOR_OUTFITS[Math.floor(Math.random() * DESERT_WARRIOR_OUTFITS.length)];
      const headwearColor = DESERT_WARRIOR_HEADWEAR_COLORS[Math.floor(Math.random() * DESERT_WARRIOR_HEADWEAR_COLORS.length)];
      const headwearVariant = Math.random() < 0.5 ? 'keffiyeh' : 'turban';
      return createBlockyHumanoid(outfit.body, false, outfit.pants, headwearColor, false, false, false, false, headwearVariant);
    }

    // Builds one Chakram Dancers squad member - the same randomized
    // Arabic robe palette and headwrap silhouette as a Desert Warrior
    // (see createDesertWarriorHumanoid/DESERT_WARRIOR_OUTFITS), but
    // always wrapped in the lighter keffiyeh veil style rather than a
    // rolled turban, reading closer to a dancer's flowing wrap. The
    // actual Chakram rings are added in equipUnit's 'chakramDancers'
    // branch, not here - this only builds the body/headwear.
    function createChakramDancerHumanoid() {
      const outfit = DESERT_WARRIOR_OUTFITS[Math.floor(Math.random() * DESERT_WARRIOR_OUTFITS.length)];
      const headwearColor = DESERT_WARRIOR_HEADWEAR_COLORS[Math.floor(Math.random() * DESERT_WARRIOR_HEADWEAR_COLORS.length)];
      return createBlockyHumanoid(outfit.body, false, outfit.pants, headwearColor, false, false, false, false, 'keffiyeh');
    }

    // Builds one Berserker Squad member with a randomly-rolled wolf or
    // bear pelt color - shared by createSquad and respawnSquad so a
    // fresh squad and a respawned one dress the same way, the same
    // pattern as createDesertWarriorHumanoid above.
    function createBerserkerHumanoid(color) {
      const furColor = BERSERKER_PELT_COLORS[Math.floor(Math.random() * BERSERKER_PELT_COLORS.length)];
      return createBlockyHumanoid(color, false, 0x3a2f28, null, false, false, false, false, null, false, false, false, false, false, false, false, false, false, false, false, true, furColor);
    }

    // Ghoul (Rare) - a feral hunched undead swarm unit styled after
    // Warcraft 3's Ghoul. Thin wrapper around createBlockyHumanoid's
    // isGhoul branch, same pattern as createBerserkerHumanoid/
    // createValkyrieHumanoid above - pantsColor here is a tattered dark
    // olive loincloth tint rather than actual clothing.
    function createGhoulHumanoid(color) {
      return createBlockyHumanoid(color, false, 0x2a2f22, null, false, false, false, false, null, false, false, false, false, false, false, false, false, false, false, false, false, 0x6b6b6b, false, false, false, true);
    }

    // War Elephant (Legendary, memberIndex 0 of the 'warElephant' squad -
    // see equipUnit's 'warElephant' branch and createSquad's elephantRole
    // assignment). A genuine quadruped rig rather than a re-skinned
    // createBlockyHumanoid: armored grey hide, curling tusked trunk, and a
    // wood-and-rope howdah platform on its back draped in red cloth and
    // studded with round gold shields, with a small bare-handed mahout
    // seated up front.
    //
    // Built inside the EXACT same unscaled coordinate envelope every
    // createBlockyHumanoid rig uses - legs planted at y=0 rising to a
    // hip/shoulder line at y=0.3, torso centered on y=0.525, head centered
    // on y=0.9 - because updateUnitAnims' idle/walk/breathing code
    // (see e.g. "uData.body.position.y = 0.525 + breath" /
    // "uData.head.position.y = 0.9 + breath") writes those two exact
    // numbers into uData.body/head.position.y every single frame for any
    // unit type it doesn't special-case, 'warElephant' included. Building
    // to a different envelope would have the animation loop yank the
    // torso down onto the legs every frame. The actual bigger-than-human
    // "towering" silhouette instead comes from a single non-uniform
    // charGroup.scale applied at the very end (see ELEPHANT_SCALE below) -
    // the same trick isSteelRevenant uses for its own oversized rig.
    //
    // Exposes the same userData contract as createBlockyHumanoid (body/
    // head/armL/armR/handL/handR/legL/legR/backMount/hipMount/hp bar
    // elements/every combat timer field) so every generic system
    // downstream - equipUnit, updateUnitAnims, applyAttackPose,
    // applyDamage, createRagdollDeath, the ninja Concealment fade, etc. -
    // keeps working unmodified; it just points those names at elephant
    // anatomy instead of human. legL/legR drive only the front pair of
    // legs (the generic walk-cycle sway is a single-pivot swing per side,
    // not a true gait); the back pair stays a static mesh parented
    // directly to the body so it still bobs/breathes in sync with it - a
    // deliberate simplification given the walk animation was built for a
    // biped.
    function createWarElephantVisual(mahoutColor) {
      const charGroup = new THREE.Group();

      const hideMat = new THREE.MeshLambertMaterial({ color: 0xab9c86 });
      const hideDarkMat = new THREE.MeshLambertMaterial({ color: 0x8d7c65 });
      const hideEarMat = new THREE.MeshLambertMaterial({ color: 0x9c8c74, side: THREE.DoubleSide });
      const tuskMat = new THREE.MeshLambertMaterial({ color: 0xefe4cd });
      const nailMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc2 });
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0x1a1410 });
      const woodMat = new THREE.MeshLambertMaterial({ color: 0x3c2a1a });
      const clothMat = new THREE.MeshLambertMaterial({ color: 0xa8342f, side: THREE.DoubleSide });
      const clothDarkMat = new THREE.MeshLambertMaterial({ color: 0x7c2420, side: THREE.DoubleSide });
      const goldMat = new THREE.MeshLambertMaterial({ color: 0xcda130 });
      const goldRimMat = new THREE.MeshLambertMaterial({ color: 0x7a5f1c });
      const ropeMat = new THREE.MeshLambertMaterial({ color: 0x241c14 });
      const armorMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4c });
      const mahoutRobeMat = new THREE.MeshLambertMaterial({ color: mahoutColor || 0x8a3a2a });
      const mahoutSkinMat = new THREE.MeshLambertMaterial({ color: 0xccaa88 });

      // Matches createBlockyHumanoid's own leg anchor exactly (legGeo
      // height 0.3, pivot at y=0.3 down to the ground at y=0) - see the
      // function comment above for why this can't move.
      const LEG_TOP_Y = 0.3;

      // ---- Legs (upper/lower/foot + toenails), 0.3 total length ----
      function makeLeg() {
        const leg = new THREE.Group();
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.135, 0.14, 8), hideMat);
        upper.position.y = -0.07;
        upper.castShadow = true;
        leg.add(upper);
        const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.12, 0.11, 8), hideDarkMat);
        lower.position.y = -0.195;
        lower.castShadow = true;
        leg.add(lower);
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.115, 0.05, 8), hideDarkMat);
        foot.position.y = -0.275;
        foot.castShadow = true;
        leg.add(foot);
        for (let n = -1; n <= 1; n++) {
          const nail = new THREE.Mesh(new THREE.SphereGeometry(0.02, 5, 4), nailMat);
          nail.position.set(n * 0.045, -0.29, 0.1);
          leg.add(nail);
        }
        return { leg, mainMesh: upper };
      }

      const legFLData = makeLeg();
      const legFLPivot = new THREE.Group();
      legFLPivot.position.set(-0.19, LEG_TOP_Y, 0.26);
      legFLPivot.add(legFLData.leg);
      charGroup.add(legFLPivot);

      const legFRData = makeLeg();
      const legFRPivot = new THREE.Group();
      legFRPivot.position.set(0.19, LEG_TOP_Y, 0.26);
      legFRPivot.add(legFRData.leg);
      charGroup.add(legFRPivot);

      // Back legs are static (no walk-cycle pivot - see function comment)
      // and parented to the body itself (rather than charGroup) so they
      // still bob/breathe in sync with the torso instead of visibly
      // detaching from it every idle cycle.
      const legBLData = makeLeg();
      legBLData.leg.position.set(-0.19, LEG_TOP_Y - 0.525, -0.28);
      const legBRData = makeLeg();
      legBRData.leg.position.set(0.19, LEG_TOP_Y - 0.525, -0.28);

      // ---- Body - centered on y=0.525 (see function comment: this is
      // the exact value updateUnitAnims force-writes every frame, so the
      // box's OWN position must start there, with everything else that
      // should move with the torso parented onto it instead). ----
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.85), hideMat);
      body.position.y = 0.525;
      body.castShadow = true;
      charGroup.add(body);
      body.add(legBLData.leg, legBRData.leg);

      const shoulderHump = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), hideMat);
      shoulderHump.scale.set(1, 0.75, 0.8);
      shoulderHump.position.set(0, 0.33, 0.22);
      body.add(shoulderHump);

      const belly = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.72), hideDarkMat);
      belly.position.y = -0.19;
      body.add(belly);

      // ---- Tail (parented to body, same reasoning as the back legs) ----
      const tail = new THREE.Group();
      tail.position.set(0, 0.13, -0.45);
      const tailRope = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.26, 6), hideDarkMat);
      tailRope.position.y = -0.13;
      tailRope.rotation.x = 0.25;
      tail.add(tailRope);
      const tailTuft = new THREE.Mesh(new THREE.SphereGeometry(0.032, 5, 4), ropeMat);
      tailTuft.position.set(0, -0.28, 0.06);
      tail.add(tailTuft);
      body.add(tail);

      // ---- Head (trunk, tusks, ears, forehead armor plate) - a direct
      // charGroup child, NOT parented to body, because updateUnitAnims
      // force-writes uData.head.position.y itself every frame (see
      // function comment); x/z stay whatever's set here since the
      // animation loop only ever touches .y. ----
      const head = new THREE.Group();
      head.position.set(0, 0.9, 0.5);
      charGroup.add(head);

      const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.28), hideMat);
      headBox.castShadow = true;
      head.add(headBox);

      const forehead = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), hideMat);
      forehead.scale.set(1.1, 1, 0.9);
      forehead.position.set(0, 0.13, 0.05);
      head.add(forehead);

      [-1, 1].forEach(side => {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.28), hideEarMat);
        ear.position.set(side * 0.2, 0.02, -0.02);
        ear.rotation.y = side * 0.5;
        ear.rotation.z = side * 0.1;
        ear.castShadow = true;
        head.add(ear);
      });

      [-1, 1].forEach(side => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), eyeMat);
        eye.position.set(side * 0.15, 0.05, 0.16);
        head.add(eye);
      });

      [-1, 1].forEach(side => {
        const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.32, 6), tuskMat);
        tusk.position.set(side * 0.1, -0.14, 0.22);
        tusk.rotation.x = Math.PI / 2 - 0.35;
        tusk.rotation.z = side * -0.25;
        tusk.castShadow = true;
        head.add(tusk);
      });

      // Trunk - a short chain of tapering segments, each one rotated
      // relative to the last so the whole thing reads as a single curl
      // down and slightly back in, the way the reference art curls it.
      const trunk = new THREE.Group();
      trunk.position.set(0, -0.02, 0.16);
      head.add(trunk);
      let trunkCursor = new THREE.Group();
      trunk.add(trunkCursor);
      [
        { len: 0.16, rad0: 0.075, rad1: 0.062, rotX: 0.35 },
        { len: 0.15, rad0: 0.062, rad1: 0.05, rotX: 0.55 },
        { len: 0.13, rad0: 0.05, rad1: 0.04, rotX: 0.7 },
        { len: 0.11, rad0: 0.04, rad1: 0.032, rotX: 0.55 },
      ].forEach(seg => {
        trunkCursor.rotation.x = seg.rotX;
        const segMesh = new THREE.Mesh(new THREE.CylinderGeometry(seg.rad0, seg.rad1, seg.len, 7), hideMat);
        segMesh.position.y = -seg.len / 2;
        segMesh.castShadow = true;
        trunkCursor.add(segMesh);
        const nextCursor = new THREE.Group();
        nextCursor.position.y = -seg.len;
        trunkCursor.add(nextCursor);
        trunkCursor = nextCursor;
      });

      const headPlate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.03), armorMat);
      headPlate.position.set(0, 0.14, 0.185);
      head.add(headPlate);

      // ---- Howdah: wood platform, red cloth panels, round gold shields -
      // parented to the body (same bob-in-sync reasoning as the back legs
      // and tail above). ----
      const howdah = new THREE.Group();
      howdah.position.set(0, 0.25, -0.05);
      body.add(howdah);

      const platform = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.5), woodMat);
      platform.position.y = 0.06;
      platform.castShadow = true;
      howdah.add(platform);

      const postGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.34, 6);
      [[-0.26, 0.2], [0.26, 0.2], [-0.26, -0.2], [0.26, -0.2]].forEach(([px, pz]) => {
        const post = new THREE.Mesh(postGeo, woodMat);
        post.position.set(px, 0.26, pz);
        howdah.add(post);
      });

      [0.19, -0.19].forEach(pz => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.03), clothMat);
        panel.position.set(0, 0.26, pz);
        howdah.add(panel);
        [-0.16, 0, 0.16].forEach(px => {
          const rim = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.014, 6, 12), goldRimMat);
          rim.position.set(px, 0.26, pz + (pz > 0 ? 0.021 : -0.021));
          rim.rotation.y = pz > 0 ? 0 : Math.PI;
          howdah.add(rim);
          const face = new THREE.Mesh(new THREE.CircleGeometry(0.055, 12), goldMat);
          face.position.set(px, 0.26, pz + (pz > 0 ? 0.022 : -0.022));
          face.rotation.y = pz > 0 ? 0 : Math.PI;
          howdah.add(face);
        });
      });

      [-0.29, 0.29].forEach(px => {
        const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.46), clothDarkMat);
        sideWall.position.set(px, 0.22, 0);
        howdah.add(sideWall);
      });

      const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.03, 0.52), woodMat);
      canopy.position.y = 0.44;
      howdah.add(canopy);

      // Rope harness crossing the body, anchoring the howdah in place -
      // parented to the body for the same reason as everything else above.
      const ropeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.62, 5);
      [-0.15, 0.15].forEach(zOff => {
        const rope = new THREE.Mesh(ropeGeo, ropeMat);
        rope.position.set(0, -0.02, zOff);
        rope.rotation.z = Math.PI / 2;
        body.add(rope);
      });

      // ---- Mahout - a small bare-handed rider seated at the front of
      // the howdah. ----
      const rider = new THREE.Group();
      rider.position.set(0, 0.2, 0.05);
      howdah.add(rider);

      const riderTorso = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.11), mahoutRobeMat);
      riderTorso.position.y = 0.1;
      riderTorso.castShadow = true;
      rider.add(riderTorso);

      const riderHead = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), mahoutSkinMat);
      riderHead.position.y = 0.26;
      riderHead.castShadow = true;
      rider.add(riderHead);
      riderHead.add(createHeadwrapTurban(0xe8dcc0));

      function createRiderLimb(mat, x, y, z) {
        const pivot = new THREE.Group();
        pivot.position.set(x, y, z);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), mat);
        mesh.position.y = -0.08;
        mesh.castShadow = true;
        pivot.add(mesh);
        const hand = new THREE.Group();
        hand.position.set(0, -0.08, 0);
        mesh.add(hand);
        return { pivot, hand, mesh };
      }

      const armLData = createRiderLimb(mahoutSkinMat, -0.1, 0.19, 0);
      const armRData = createRiderLimb(mahoutSkinMat, 0.1, 0.19, 0);
      rider.add(armLData.pivot, armRData.pivot);

      // Stub mount points - never populated for the elephant itself (see
      // equipUnit's 'warElephant' branch, which only ever touches
      // handL/handR), but equipUnit unconditionally clears
      // backMount/hipMount's children on every call, so both must exist.
      // Direct charGroup children (matching createBlockyHumanoid), not
      // body children - equipUnit never actually populates them here so
      // it doesn't matter that they won't bob with the torso.
      const backMount = new THREE.Group();
      backMount.position.set(0, 0.9, -0.3);
      charGroup.add(backMount);
      const hipMount = new THREE.Group();
      hipMount.position.set(0.3, 0.4, 0.1);
      charGroup.add(hipMount);

      // Create DOM Health Bar - identical markup to createBlockyHumanoid's,
      // so the same CSS and hp-bar update code (hpFillElement/
      // hpShieldFillElement) works unmodified.
      const hpBg = document.createElement('div');
      hpBg.className = 'hp-bar-bg';
      const hpShieldFill = document.createElement('div');
      hpShieldFill.className = 'hp-bar-shield';
      hpBg.appendChild(hpShieldFill);
      const hpFill = document.createElement('div');
      hpFill.className = 'hp-bar-fill';
      hpBg.appendChild(hpFill);
      hpContainer.appendChild(hpBg);

      charGroup.userData = {
        armL: armLData.pivot,
        armR: armRData.pivot,
        handL: armLData.hand,
        handR: armRData.hand,
        meshArmL: armLData.mesh,
        meshArmR: armRData.mesh,
        meshLegL: legFLData.mainMesh,
        meshLegR: legFRData.mainMesh,
        armLElbow: null,
        armRElbow: null,
        legLKnee: null,
        legRKnee: null,
        body: body,
        head: head,
        shirtColor: mahoutColor,
        backMount: backMount,
        hipMount: hipMount,
        tailMesh: tail,
        isAkuma: false,
        isPaladinRig: false,
        isSkeleton: false,
        isAcolyte: false,
        isGhoul: false,
        isGargoyle: false,
        isDarkKnight: false,
        isDemon: false,
        isOrc: false,
        isBear: false,
        isScarecrow: false,
        legL: legFLPivot,
        legR: legFRPivot,
        unitType: 'warElephant',
        isWalking: false,
        walkTimer: 0,
        hp: 100,
        maxHp: 100,
        attackCooldown: 0,
        isEnemy: false,
        hpElement: hpBg,
        hpFillElement: hpFill,
        absorbShield: 0,
        hpShieldFillElement: hpShieldFill,
        stunTimer: 0,
        knockbackVel: new THREE.Vector3(),
        attackAnimTimer: 0,
        attackAnimDuration: 0.3,
        idlePhase: Math.random() * Math.PI * 2,
        weaponMesh: null,
        hasShield: false,
        raiderWeapon: null,
        raiderFaction: null,
        spearThrowResolved: false,
        bombThrowResolved: false,
        attackAnimPoseOverride: null,
        fortitudeTimer: 0,
        lastStandTimer: 0,
        berserkerRaging: false,
        bleedTicksRemaining: 0,
        bleedTickTimer: 0,
        burnTicksRemaining: 0,
        burnTickTimer: 0,
        poisonTicksRemaining: 0,
        poisonTickTimer: 0,
        idleVariant: undefined,
        idleFidgetTimer: 0,
        idleFidgetAnimTimer: 0,
        sheathMesh: null,
        potionMesh: null,
        graspGlowMesh: null,
        unbreakableGlowMesh: null,
        offhandGripMesh: null,
        secondWindUsed: false,
        swordDashCooldown: 0,
        roninPostureStacks: 0,
        deflectAnimTimer: 0,
        ghostStepDashAnimTimer: 0,
        shockAnimTimer: 0,
        cavalryWeapon: null,
        vanished: false,
        vanishTimer: 0,
        concealMats: null,
        concealOpacity: 1,
        isSteelRevenant: false,
      };

      // The actual "towering war elephant" silhouette: a single
      // non-uniform scale applied to the whole assembled rig, same trick
      // isSteelRevenant uses (charGroup.scale.y = 1.3) to read as
      // oversized without touching any of the coordinate math above -
      // noticeably taller, wider and considerably longer than the human
      // rig it's built on top of.
      charGroup.scale.set(1.4, 1.6, 1.9);

      return charGroup;
    }


    // Shared unit-mesh builder for every squad-member-creation site
    // (createSquad, respawnSquad, and reviveNextSquadMember below) - each
    // squad type that needs a distinct silhouette (Ninja's dark headband,
    // Dragon Ronin's topknot, Paladins/Elite Swordsmen's plate, Slasher's
    // mask, Steel Revenant's armor, Desert Warriors' robes, War Elephant's
    // howdah-mounted mahout) gets it here exactly once, so a unit built by
    // any of those three call sites always looks the same. memberIndex is
    // only meaningful for the War Elephant squad, where slot 0 is the
    // elephant itself and slots 1-2 are its Desert Warrior archer escort
    // (see equipUnit's 'warElephant' branch / createSquad's elephantRole
    // assignment) - every other squad type ignores it.
    function createSquadMemberVisual(type, color, memberIndex) {
      if (type === 'warElephant') return memberIndex === 0 ? createWarElephantVisual(color) : createDesertWarriorHumanoid();
      if (type === 'goddessOfDeath') return createGoddessOfDeathHumanoid();
      if (type === 'goddessOfLife') return createGoddessOfLifeHumanoid();
      if (type === 'kitsuneTwinblade') return memberIndex === 0 ? createKitsuneBladeHumanoid(color) : createKitsuneSpearHumanoid(color);
      return type === 'ninja'
        ? createBlockyHumanoid(color, false, 0x1a1a1a, 0x111111, true)
        : type === 'dragonRonin'
          ? createBlockyHumanoid(color, false, 0x1a1512, null, false, false, true)
          : (type === 'paladins' || type === 'eliteSwordsmen')
            ? createBlockyHumanoid(color, false, 0x2b2b30, null, false, false, false, true)
            : type === 'slasher'
              ? createBlockyHumanoid(color, false, 0x1a1a1a, null, false, false, false, false, null, false, false, false, true)
              : type === 'steelRevenant'
                ? createBlockyHumanoid(color, false, STEEL_REVENANT_THEME.pants, null, false, false, false, false, null, false, false, false, false, false, false, true)
                : type === 'lich'
                  ? createBlockyHumanoid(color, false, 0x14203a, null, false, false, false, false, null, false, true, false, false, false, false, false, false, false, false, false, false, undefined, false, false, true)
                  : type === 'desertWarriors'
                  ? createDesertWarriorHumanoid()
                  : type === 'skeletonWarriors'
                  // Reuses the raider Skeleton look (see createRaiderSquad's
                  // isSkeleton branch / createBlockyHumanoid's isSkeleton
                  // param) for a player-recruitable squad - bare bone-white
                  // materials and skull face override shirt/pants color
                  // regardless of what's passed here, so the squad's own
                  // 0xe3dac9 CLASS_DEFS color is only used for UI chrome
                  // (Squad Index icon background, etc), not the body.
                  ? createBlockyHumanoid(color, false, 0x333333, null, false, false, false, false, null, false, true)
                  : type === 'chakramDancers'
                    ? createChakramDancerHumanoid()
                    : type === 'berserker'
                    ? createBerserkerHumanoid(color)
                    : type === 'ghoul'
                    ? createGhoulHumanoid(color)
                    : type === 'valkyrie'
                      ? createValkyrieHumanoid(color)
                      : createBlockyHumanoid(color, false);
    }

    // Formation-slot position for a given squad member index, in the
    // squad's local (pre-scale) coordinate space. The default is the
    // plain 2x2 grid every squad type uses. The War Elephant is a special
    // case - its slot 0 elephant model (see createWarElephantVisual) is
    // considerably bigger than the 0.45-unit grid cell a normal humanoid
    // fits in, so its two Desert Warrior archers (slots 1-2) ride up in
    // its howdah instead - seated shoulder to shoulder behind the mahout,
    // the way the reference art has them, rather than flanking it on the
    // ground. The y figure (1.5) matches the howdah's seat height once
    // createWarElephantVisual's own charGroup.scale (1.4, 1.6, 1.9) is
    // applied to the unscaled rider seat position baked into that
    // function (body.position.y 0.525 + howdah.position.y 0.25 +
    // rider.position.y 0.2 = 0.975, times scale.y 1.6 ≈ 1.56) - kept as
    // a plain literal here since archers are separate top-level squad
    // members, not children of the elephant's own charGroup, so nothing
    // recomputes this automatically if that rig ever changes.
    function squadMemberFormationPosition(type, i, memberCount) {
      if (type === 'warElephant') {
        if (i === 0) return [0, -0.05];
        return [i === 1 ? -0.16 : 0.16, i === 1 ? -0.18 : 0.08, 1.5];
      }
      if (memberCount === 1) return [0, 0];
      return [(i % 2) * 0.45 - 0.225, Math.floor(i / 2) * 0.45 - 0.225];
    }

    function createSquad(def) {
      const group = new THREE.Group();
      const members = [];
      // Legendary Dragon Ronin squad is a lone unit rather than the usual
      // 4-man line - see memberCount on its CLASS_DEFS entry.
      const memberCount = def.memberCount || 4;

      for (let i = 0; i < memberCount; i++) {
        // Ninjas get dark pants and a dark headband so they read as a
        // distinct silhouette from the rest of the roster. Dragon Ronin
        // and Paladins get no headband at all (see createSamuraiHair/
        // createCommanderHair) - a topknot/cropped hair takes that spot
        // instead, and both are solo units (memberCount 1) so the
        // formation grid below never applies to them either.
        const unit = createSquadMemberVisual(def.type, def.color, i);
        {
          const [px, pz, py] = squadMemberFormationPosition(def.type, i, memberCount);
          unit.position.set(px, py || 0, pz);
        }
        // Remembers this unit's assigned slot within the squad's local
        // coordinate space, so a unit shoved out of place by knockback has
        // somewhere to walk back to - see the recovery step in
        // processUnitAttack, which reads this once knockback has settled
        // and the unit has nothing in range to fight. Captured after the
        // Militia mount block below (not right after the initial
        // position.set) so a mounted unit's home slot includes the
        // saddle-height y offset - otherwise knockback recovery would walk
        // it back down to ground level, sinking the horse into the floor.
        equipUnit(unit, def.type, null, i);
        applySquadLevelStats(unit, def.type);

        // War Elephant squad: memberIndex 0 is the elephant itself
        // (Charge & Stomp, gated on this flag in the melee damage
        // branch); 1-2 are its Desert Warrior archers (Venom Arrows,
        // tagged via the poisonOnHit projectile flag at the ranged
        // attack call site). See equipUnit's 'warElephant' branch for
        // the matching visual loadout.
        if (def.type === 'warElephant') {
          unit.userData.elephantRole = i === 0 ? 'elephant' : 'archer';
        }

        // Kitsune Twinblade squad: memberIndex 0 is "Ember Fang" (Quickdraw
        // katana passive), memberIndex 1 is "Frost Warden" (Guard the
        // Flank spear passive) - see equipUnit's 'kitsuneTwinblade' branch
        // for the matching weapon/stance and the melee damage branch below
        // for both passives.
        if (def.type === 'kitsuneTwinblade') {
          unit.userData.kitsuneRole = i === 0 ? 'blade' : 'spear';
        }

        // Militia: same 50/50 per-unit mount chance as the AI Villager
        // Militia (see createMilitiaUnit) - a mixed squad of some units on
        // foot, some on horseback.
        if (def.type === 'militia') {
          unit.userData.isMounted = Math.random() < 0.5;
          if (unit.userData.isMounted) {
            const horse = createMilitiaHorse();
            horse.position.set(0, -MILITIA_MOUNT_SEAT_Y, -0.05);
            unit.add(horse);
            unit.userData.horseMesh = horse;
            unit.position.y = MILITIA_MOUNT_SEAT_Y;
            unit.userData.legL.rotation.set(-1.15, 0, 0.22);
            unit.userData.legR.rotation.set(-1.15, 0, -0.22);
          }
        }

        unit.userData.formationOffset = new THREE.Vector3(unit.position.x, unit.position.y, unit.position.z);

        group.add(unit);
        members.push(unit);
      }

      const ring = new THREE.Mesh(selectionRingGeo, selectionRingMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      ring.visible = false;
      group.add(ring);

      // Selected-squad arrow: a spinning, bobbing yellow arrow floating
      // above the squad (shown only while it's the selected one - see
      // updateSquadArrows). Drawn on top of the scene so terrain/props
      // never hide it.
      const arrow = new THREE.Group();
      const arrowFill = new THREE.MeshBasicMaterial({ color: 0xffee55, transparent: true, depthTest: false });
      const arrowEdge = new THREE.MeshBasicMaterial({ color: 0x3a2a00, transparent: true, depthTest: false, side: THREE.BackSide });
      const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 4), arrowFill);
      arrowHead.rotation.x = Math.PI;
      const arrowHeadEdge = new THREE.Mesh(arrowHead.geometry, arrowEdge);
      arrowHeadEdge.rotation.x = Math.PI;
      arrowHeadEdge.scale.set(1.3, 1.15, 1.3);
      const arrowShaft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.1), arrowFill);
      arrowShaft.position.y = 0.29;
      const arrowShaftEdge = new THREE.Mesh(arrowShaft.geometry, arrowEdge);
      arrowShaftEdge.position.y = 0.29;
      arrowShaftEdge.scale.set(1.5, 1.12, 1.5);
      [arrowHeadEdge, arrowShaftEdge, arrowHead, arrowShaft].forEach((m, n) => { m.renderOrder = 998 + (n > 1 ? 1 : 0); arrow.add(m); });
      arrow.position.y = 2.3;
      arrow.visible = false;
      group.add(arrow);

      group.scale.set(0.6, 0.6, 0.6);
      scene.add(group);

      return {
        arrow,
        type: def.type,
        color: def.color,
        group,
        members,
        ring,
        attackMarker: createAttackAreaMarker(),
        isMoving: false,
        targetPosition: new THREE.Vector3(),
        currentPath: [],
        currentWaypoint: 0,
        // The Steel Revenant is a heavy, deliberate mover - slower than
        // every other squad, befitting its towering armored bulk (see
        // STEEL_REVENANT_HP/applySquadLevelStats' STEEL_REVENANT_HP_MULT).
        // Ghoul is a fast, aggressive swarm unit - quicker than the 1.75
        // default line-unit pace, though still behind Cavalry.
        moveSpeed: def.type === 'cavalry' ? 2.6 : def.type === 'ghoul' ? 2.1 : def.type === 'steelRevenant' ? 1.1 : def.type === 'goddessOfDeath' ? 1.45 : def.type === 'goddessOfLife' ? 1.6 : 1.75,
      };
    }

    function respawnSquad(squad) {
      // Remove any lingering member graphics/elements
      squad.members.forEach(u => {
        if (u.userData.hpElement) u.userData.hpElement.remove();
        squad.group.remove(u);
      });
      squad.members = [];

      // Mirror createSquad's memberCount handling - a Dragon Ronin squad
      // respawns as its usual lone unit rather than a 4-man line.
      const memberCount = (squadDef(squad.type) || {}).memberCount || 4;

      for (let i = 0; i < memberCount; i++) {
        // Mirror createSquad's ninja/dragonRonin/paladins handling -
        // otherwise a respawn (new island, or a wiped-out squad coming
        // back) rebuilds Ninjas as plain humanoids with no mask/gear,
        // Dragon Ronin with no hachimaki headband, and Paladins with no
        // cropped hair.
        const unit = createSquadMemberVisual(squad.type, squad.color, i);
        {
          const [px, pz, py] = squadMemberFormationPosition(squad.type, i, memberCount);
          unit.position.set(px, py || 0, pz);
        }
        // See createSquad - remembers the assigned slot so knockback
        // recovery (in processUnitAttack) has a home position to return
        // to. Captured after the Militia mount block below, same reason
        // as createSquad.
        equipUnit(unit, squad.type, null, i);
        applySquadLevelStats(unit, squad.type);

        // Mirror createSquad's War Elephant role assignment too, for the same reason.
        if (squad.type === 'warElephant') {
          unit.userData.elephantRole = i === 0 ? 'elephant' : 'archer';
        }

        // Mirror createSquad's Kitsune Twinblade role assignment too, for the
        // same reason - without this, applyAttackPose's 'blade'/'spear'
        // branches never match and the arms freeze mid-swing instead of
        // animating.
        if (squad.type === 'kitsuneTwinblade') {
          unit.userData.kitsuneRole = i === 0 ? 'blade' : 'spear';
        }

        // Mirror createSquad's Militia mount handling too, for the same reason.
        if (squad.type === 'militia') {
          unit.userData.isMounted = Math.random() < 0.5;
          if (unit.userData.isMounted) {
            const horse = createMilitiaHorse();
            horse.position.set(0, -MILITIA_MOUNT_SEAT_Y, -0.05);
            unit.add(horse);
            unit.userData.horseMesh = horse;
            unit.position.y = MILITIA_MOUNT_SEAT_Y;
            unit.userData.legL.rotation.set(-1.15, 0, 0.22);
            unit.userData.legR.rotation.set(-1.15, 0, -0.22);
          }
        }

        unit.userData.formationOffset = new THREE.Vector3(unit.position.x, unit.position.y, unit.position.z);

        squad.group.add(unit);
        squad.members.push(unit);
      }
    }

    // Generic single-member revival, shared by any passive that raises a
    // fallen squad member back into an empty formation slot (currently
    // just the Doctor's Resurrection - see updateDoctorSupport). Builds
    // on the same createSquadMemberVisual/formation-slot logic as
    // createSquad/respawnSquad above. Slots aren't individually tracked -
    // an arbitrary squad just fills in at the next open index - safe
    // because the grid formula below only depends on that index, not on
    // which original member held it.
    function reviveNextSquadMember(squad) {
      const def = squadDef(squad.type) || {};
      const memberCount = def.memberCount || 4;
      if (squad.members.length >= memberCount) return null;
      const slot = squad.members.length;

      const unit = createSquadMemberVisual(squad.type, squad.color, slot);

      {
        const [px, pz, py] = squadMemberFormationPosition(squad.type, slot, memberCount);
        unit.position.set(px, py || 0, pz);
      }
      unit.userData.formationOffset = new THREE.Vector3(unit.position.x, unit.position.y, unit.position.z);
      equipUnit(unit, squad.type, null, slot);
      applySquadLevelStats(unit, squad.type);

      if (squad.type === 'warElephant') {
        unit.userData.elephantRole = slot === 0 ? 'elephant' : 'archer';
      }

      // Mirror createSquad's Kitsune Twinblade role assignment too, for the
      // same reason as respawnSquad above.
      if (squad.type === 'kitsuneTwinblade') {
        unit.userData.kitsuneRole = slot === 0 ? 'blade' : 'spear';
      }

      if (squad.type === 'militia') {
        unit.userData.isMounted = Math.random() < 0.5;
        if (unit.userData.isMounted) {
          const horse = createMilitiaHorse();
          horse.position.set(0, -MILITIA_MOUNT_SEAT_Y, -0.05);
          unit.add(horse);
          unit.userData.horseMesh = horse;
          unit.position.y = MILITIA_MOUNT_SEAT_Y;
          unit.userData.legL.rotation.set(-1.15, 0, 0.22);
          unit.userData.legR.rotation.set(-1.15, 0, -0.22);
        }
      }

      // Re-captured after the Militia mount block above (not right after
      // the initial position.set), same reason as createSquad/respawnSquad.
      unit.userData.formationOffset = new THREE.Vector3(unit.position.x, unit.position.y, unit.position.z);

      squad.group.add(unit);
      squad.members.push(unit);
      return unit;
    }

    // --- Squad Composition (chosen in the "Manage Squad" main-menu screen) ---
    // Up to 4 slots, each holding a squad type or null (empty). Duplicates
    // are allowed (e.g. two Archers squads instead of Swords + Mages), which
    // is why player squads are addressed by array index everywhere in the
    // game rather than by type - type is no longer guaranteed unique.
    const SQUAD_SLOT_COUNT = 4;
    const SQUAD_TYPE_OPTIONS = [null, 'swords', 'pikes', 'archers', 'mages', 'cavalry'];
    let squadComposition = ['swords', 'pikes', 'archers', 'mages'];

    function squadDef(type) {
      return CLASS_DEFS.find(d => d.type === type) || null;
    }

    // Returns the HTML markup for a squad def's icon: an <img> tag when the
    // def carries a custom iconImage (currently just the Slasher's mask
    // artwork), otherwise the plain emoji glyph. Callers that previously set
    // `.textContent = def.icon` should switch to `.innerHTML = iconHtml(def)`
    // so the <img> tag actually renders instead of showing as literal text.
    function iconHtml(def) {
      if (!def) return '';
      if (def.iconImage) {
        return `<img class="def-icon-img" src="${def.iconImage}" alt="${def.label}">`;
      }
      return def.icon;
    }

    // --- Squad Upgrade System ---
    // Every squad type has its own level (1-SQUAD_MAX_LEVEL), raised by
    // spending duplicate recruit fragments earned from The Recruiter's Gacha
    // (playerSquadTokens - a "Squad" pull result that isn't a brand new type
    // just lands here as a dupe). Each level adds a flat % to that type's HP
    // and damage, applied whenever its units are (re)spawned.
    const SQUAD_MAX_LEVEL = 20;
    const SQUAD_LEVEL_BONUS_PCT = 12; // +12% HP & damage per level above 1

    let playerSquadLevels = {};
    try {
      playerSquadLevels = JSON.parse(localStorage.getItem('bt_squadLevels')) || {};
    } catch (e) { playerSquadLevels = {}; }
    CLASS_DEFS.forEach(def => { if (!playerSquadLevels[def.type]) playerSquadLevels[def.type] = 1; });

    function saveSquadLevels() {
      localStorage.setItem('bt_squadLevels', JSON.stringify(playerSquadLevels));
    }

    // --- Squad Unlocking ---
    // Only the four core Common-tier squads - Swords, Pikes, Archers,
    // Mages - start unlocked. Every other squad type is force-locked
    // regardless of rarity or startsLocked, and has to be pulled from
    // The Recruiter's Gacha in the Recruit Shop before it's available.
    const STARTER_UNLOCKED_TYPES = ['swords', 'pikes', 'archers', 'mages'];
    let playerSquadUnlocked = {};
    try {
      playerSquadUnlocked = JSON.parse(localStorage.getItem('bt_squadUnlocked')) || {};
    } catch (e) { playerSquadUnlocked = {}; }
    CLASS_DEFS.forEach(def => {
      // Forced rather than left to a previously-saved value, so a squad
      // unlocked earlier (via Gacha pull, or from before this rule was
      // added) doesn't stick around unlocked in localStorage - only the
      // four core squads are ever unlocked from the start.
      playerSquadUnlocked[def.type] = STARTER_UNLOCKED_TYPES.includes(def.type);
    });
    saveSquadUnlocked();

    function saveSquadUnlocked() {
      localStorage.setItem('bt_squadUnlocked', JSON.stringify(playerSquadUnlocked));
    }

    function isSquadUnlocked(type) {
      return !!playerSquadUnlocked[type];
    }

    // --- Raiders Index (bestiary) ---
    // Each entry is one raider weapon loadout (RAIDER_WEAPON_TYPES). The
    // player only sees info on a loadout after it's actually shown up in
    // battle - see discoverRaiderType(), called from equipUnit() whenever
    // a raider is armed with a given weapon.
    const RAIDER_TYPE_DEFS = [
      { type: 'axe', icon: '🪓', label: 'Axe Raider', desc: 'The classic raider loadout - a heavy two-handed axe swing and nothing fancy behind it.',
        passives: [
          { name: 'None', trigger: '—', effect: 'No special passive - just steady, straightforward melee damage.' },
        ] },
      { type: 'sword', icon: '🗡️', label: 'Sword Raider', desc: 'A fast one-handed blade with no shield to slow it down.',
        passives: [
          { name: 'None', trigger: '—', effect: 'No special passive - quicker strikes than the Axe, but nothing to block with.' },
        ] },
      { type: 'swordShield', icon: '🛡️', label: 'Sword & Shield Raider', desc: 'One-handed sword paired with a raised shield.',
        passives: [
          { name: 'Shield Block', trigger: 'Hit from the front - melee has a chance, ranged always triggers it', effect: 'Blocks the attack outright, no damage taken' },
        ] },
      { type: 'spear', icon: '🔱', label: 'Spear Raider', desc: 'A two-handed spear/pike, gripped with both hands for melee reach.',
        passives: [
          { name: 'Javelin Throw', trigger: 'Its first attack opportunity in the fight - one-time coin flip', effect: 'Hurls the spear as a one-shot ranged javelin, then re-arms with an Axe or Sword for the rest of the battle' },
        ] },
      { type: 'spearShield', icon: '🔱', label: 'Spear & Shield Raider', desc: 'One-handed spear grip with a shield free in the other hand.',
        passives: [
          { name: 'Shield Block', trigger: 'Hit from the front - melee has a chance, ranged always triggers it', effect: 'Blocks the attack outright, no damage taken' },
          { name: 'Javelin Throw', trigger: 'Its first attack opportunity in the fight - one-time coin flip', effect: 'Hurls the spear as a one-shot ranged javelin, then re-arms with an Axe or Sword for the rest of the battle' },
        ] },
      { type: 'bow', icon: '🏹', label: 'Bow Raider', desc: 'A ranged raider that peppers the defenders with arrows from range instead of closing to melee.',
        passives: [
          { name: 'None', trigger: '—', effect: 'No special passive - reliable ranged damage from a distance.' },
        ] },
      { type: 'marauderAxe', icon: '🪓', label: 'Marauder Axeman', desc: 'A heavier-armed raider that lands in a Marauder warband instead of the usual mixed loadout - a punishing two-handed axe swing, same rig as a classic Axe Raider.',
        passives: [
          { name: 'None', trigger: '—', effect: 'No special passive - the same steady, straightforward melee damage as a classic Axe Raider.' },
        ] },
      { type: 'marauderMace', icon: '🔨', label: 'Marauder Mace Warrior', desc: 'A heavier-armed raider swinging a stubby flanged mace. Part of a Marauder warband.',
        passives: [
          { name: 'None', trigger: '—', effect: 'No special passive - steady, straightforward melee damage, same as an Axe Raider.' },
        ] },
      { type: 'marauderSpear', icon: '🔱', label: 'Marauder Spearman', desc: 'A heavier-armed raider wielding a two-handed spear for melee reach. Part of a Marauder warband.',
        passives: [
          { name: 'Javelin Throw', trigger: 'Its first attack opportunity in the fight - one-time coin flip', effect: 'Hurls the spear as a one-shot ranged javelin, then re-arms with an Axe or Sword for the rest of the battle' },
        ] },
      { type: 'katana', icon: '🗡️', label: 'Wokou Katana Raider', desc: 'A Japanese pirate raider wielding a curved katana in fast one-handed slashes. Part of a Wokou warband - see Bomb Throw below.',
        passives: [
          { name: 'Bomb Throw', trigger: 'Its first attack opportunity in the fight - one-time coin flip', effect: 'Lobs a single bomb at its target that ignores shields and knocks back hard, then fights on with its katana for the rest of the battle' },
        ] },
      { type: 'sickle', icon: '🔪', label: 'Wokou Sickle Raider', desc: 'A Japanese pirate raider wielding a short, hooked sickle for quick close-in slashes. Part of a Wokou warband - see Bomb Throw below.',
        passives: [
          { name: 'Bomb Throw', trigger: 'Its first attack opportunity in the fight - one-time coin flip', effect: 'Lobs a single bomb at its target that ignores shields and knocks back hard, then fights on with its sickle for the rest of the battle' },
        ] },
      { type: 'wokouBow', icon: '🏹', label: 'Wokou Bow Raider', desc: 'A Japanese pirate raider that peppers defenders with arrows from range. Part of a Wokou warband - see Bomb Throw below.',
        passives: [
          { name: 'Bomb Throw', trigger: 'Its first attack opportunity in the fight - one-time coin flip', effect: 'Lobs a single bomb at its target that ignores shields and knocks back hard, then keeps shooting arrows for the rest of the battle' },
        ] },
      { type: 'claws', icon: '👹', label: 'Akuma Feral', desc: 'A demonic crawler stalking The Far East coastline - humanoid but hunched low on bare clawed limbs, with a curling demon tail and a scowling Oni mask. Fights unarmed instead of carrying any weapon loadout.',
        passives: [
          { name: 'Feral Pounce', trigger: 'Every attack', effect: 'Leaps at its target in a single bound - the pounce muscles straight through a raised shield, always landing full damage' },
          { name: 'Wall Crawler', trigger: 'Passive', effect: 'Climbs up onto rooftops and boulders like a Ninja, closing in from terrain other raiders can\'t reach' },
          { name: 'Instant Vanish', trigger: 'On death', effect: 'Never staggers, crawls, or leaves a body behind - drops on the spot and vanishes in a puff of shadow' },
        ] },
      { type: 'onryoStaff', icon: '🏮', label: 'Onryo', desc: 'A vengeful female ghost that lands alone on The Far East coast instead of in a warband - long black hair framing a gaunt, hollow-eyed face under a wrathful spiked halo, a huge gaping mouth splitting her chest, fighting two-handed with a crimson ritual staff topped by a spiked golden lantern, a kusarigama hanging unused from her free hand.',
        passives: [
          { name: 'None', trigger: '—', effect: 'No special passive - steady, straightforward melee damage with its staff, same as an Axe Raider.' },
        ] },
      { type: 'banditSword', icon: '🗡️', label: 'Desert Bandit Swordsman', desc: 'A desert raider wielding a fast one-handed blade, masked with a dark cloth wrap. Part of a Desert Bandit warband.',
        passives: [
          { name: 'None', trigger: '—', effect: 'No special passive - the same quick, shieldless strikes as a classic Sword Raider.' },
        ] },
      { type: 'mace', icon: '🔨', label: 'Desert Bandit Mace Raider', desc: 'A desert raider swinging a stubby flanged mace. Part of a Desert Bandit warband.',
        passives: [
          { name: 'None', trigger: '—', effect: 'No special passive - steady, straightforward melee damage, same as an Axe Raider.' },
        ] },
      { type: 'banditBow', icon: '🏹', label: 'Desert Bandit Archer', desc: 'A desert raider that peppers the defenders with arrows from range instead of closing to melee. Part of a Desert Bandit warband.',
        passives: [
          { name: 'None', trigger: '—', effect: 'No special passive - reliable ranged damage from a distance.' },
        ] },
      { type: 'immortalSword', icon: '⚔️', label: 'Immortal', desc: 'An elite desert warrior in black armor, face hidden behind a silver demonic mask worn under a black turban. Fights with a sword alone - no shield, no ranged loadout. Part of an Immortal warband.',
        passives: [
          { name: 'Tougher', trigger: 'Passive', effect: 'Carries a noticeably bigger HP pool than a normal raider.' },
          { name: 'Resurrection', trigger: 'The first time it would die', effect: 'Rises back up with half its max HP restored instead of dying - a one-time reprieve per life; the next lethal hit kills it for good.' },
        ] },
      { type: 'skeleton', icon: '💀', label: 'Skeleton Warrior', desc: 'A risen, bone-white raider that lands in every warband on Shadow Island instead of a living Classic Raider. Carries the same mix of Axe, Sword, Sword & Shield, Spear, Spear & Shield, or Bow loadouts a Classic Raider would - and fights the same way - but has no blood or flesh to spare.',
        passives: [
          { name: 'Brittle Bones', trigger: 'Passive', effect: 'Only a single hit point - any attack that actually lands finishes it instantly, same as it would a normal raider at full health.' },
          { name: 'Shield Block', trigger: 'On a Sword & Shield or Spear & Shield loadout - hit from the front', effect: 'Blocks the attack outright, no damage taken, exactly like a living Sword/Spear & Shield Raider.' },
          { name: 'Javelin Throw', trigger: 'On a Spear loadout - its first attack opportunity in the fight, one-time coin flip', effect: 'Hurls the spear as a one-shot ranged javelin, then re-arms with an Axe or Sword for the rest of the battle.' },
        ] },
      { type: 'acolyteBolt', icon: '🔮', label: 'Shadow Island Acolyte', desc: 'A still-living cultist warband that can land on Shadow Island instead of the usual Skeleton Warriors - hooded in a dark violet cult robe rather than reanimated bone. Fights entirely at range, launching a bolt of dark magic straight out of its raised hand with no weapon in sight, and bleeds a dark violet color instead of red when struck.',
        passives: [
          { name: 'None', trigger: '—', effect: 'No special passive - reliable ranged damage from a distance, same reach as a Bow Raider.' },
        ] },
      { type: 'darkKnight', icon: '🖤', label: 'Dark Knight', desc: 'A still-living, heavily-armored knight warband that can land on Shadow Island instead of the usual Skeleton Warriors - sealed head to toe in dark plate armor and a black cape, face hidden behind an enclosed helmet with glowing red eye slits. Always carries a raised shield paired with either a sword or a mace.',
        passives: [
          { name: 'Unbreakable', trigger: 'Passive', effect: 'A massive 300 HP pool, and can never be finished off by a guaranteed-lethal/instant-kill attack (Assassinate, Deathblow, Cavalry Charge) - the blow still lands and still hurts, it just can never one-shot it.' },
          { name: 'Shield Block', trigger: 'Hit from the front - melee has a chance, ranged always triggers it', effect: 'Blocks the attack outright, no damage taken' },
        ] },
      { type: 'demon', icon: '😈', label: 'Demon', desc: 'A red-skinned, horned and tailed fiend that erupts from a Shadow Island Demonic Portal rather than landing by boat, fighting two-handed with a Hell Trident. No passive while alive - a plain line unit - but see Hellfire Burst below.',
        passives: [
          { name: 'Hellfire Burst', trigger: 'On death', effect: 'Explodes in a fiery blast that damages every nearby unit, bypassing shields entirely.' },
        ] },
      { type: 'scarecrowScythe', icon: '🎃', label: 'Scarecrow', desc: 'A Demon-faction raider unique to Shadow Island\'s outdoor Swamp. It looks like nothing more than an ordinary scarecrow on its post, out in a wheat field beside an abandoned farmhouse - burlap-sack head, droopy tattered hat, straw spilling from its sleeves, a crow perched nearby - until, every so often when a wave begins, it wakes, climbs down and attacks the squads with a rusted scythe, its stitched face now burning with hellish eyes. Stands alone rather than in a warband, never lands by boat, and carries a much bigger HP pool than a normal raider.',
        passives: [
          { name: 'Dormant Menace', trigger: 'Start of a wave - low chance while it stands on its post', effect: 'Stays perfectly still, passing for scenery, until it suddenly wakes and goes after the player\'s squads.' },
          { name: 'Terrify', trigger: 'The moment it wakes', effect: 'Every defender close by recoils away from it in fear and can\'t attack for a moment.' },
          { name: 'Drain', trigger: 'Every landed melee hit', effect: 'Heals itself for a portion of the damage it actually deals - a blocked hit drains nothing.' },
          { name: 'Crows Scatter', trigger: 'On death', effect: 'Never staggers or leaves a body - bursts apart in a cloud of straw as its crows scatter.' },
        ] },
      { type: 'orcAxe', icon: '🪓', label: 'Orc Axe-Warrior', desc: 'A green-skinned, shirtless brute that musters from an island\'s Orc Fortress gate rather than landing by boat - a crude pauldron on each shoulder and a tusked iron helmet, swinging a heavy two-handed axe.',
        passives: [
          { name: 'None', trigger: '—', effect: 'No special passive - the same steady, straightforward melee damage as a classic Axe Raider.' },
        ] },
      { type: 'orcAxeShield', icon: '🛡️', label: 'Orc Axe & Shield', desc: 'An Orc warband member fighting one-handed axe paired with a raised shield instead of a two-handed swing.',
        passives: [
          { name: 'Shield Block', trigger: 'Hit from the front - melee has a chance, ranged always triggers it', effect: 'Blocks the attack outright, no damage taken' },
        ] },
      { type: 'orcBow', icon: '🏹', label: 'Orc Archer', desc: 'An Orc warband member that peppers the defenders with arrows from range instead of closing to melee.',
        passives: [
          { name: 'None', trigger: '—', effect: 'No special passive - reliable ranged damage from a distance.' },
        ] },
      { type: 'bearClaws', icon: '🐻‍❄️', label: 'Bear Warrior', desc: 'A shaggy white-furred bear humanoid that lands alone on the Northernlands coast instead of in a Viking warband - no armor, no weapon, just fur, claws, and teeth. Tankier than a normal raider to make up for fighting solo.',
        passives: [
          { name: 'Claws & Bite', trigger: 'Every landed melee swing', effect: 'Rolls between a normal Claw hit and a heavier, slower Bite.' },
          { name: 'Summon Lightning', trigger: 'Every several seconds, in place of a swing', effect: 'Calls down a lightning bolt on its target, dealing AoE damage to everyone nearby and bypassing shields entirely.' },
        ] },
      { type: 'wolfAxe', icon: '🐺', label: 'Wolf Warrior', desc: 'A Northernlands warband that replaces the usual mixed Viking landing - shirtless brawlers in nothing but a wolf-head pelt helmet and fur pauldrons, swinging a heavy two-handed Double Axe just like the player\'s own Berserker Squad. Passive: Rage - once its HP drops to 30% or below, its attacks come out dramatically faster. Passive: Wall Crawler - climbs up onto rooftops and boulders like a Ninja, closing in from terrain other raiders can\'t reach. Passive: Axe Throw - hurls its axe at any flying target it can\'t otherwise reach.',
        passives: [
          { name: 'Rage', trigger: 'HP drops to 30% or below', effect: 'Attacks come out dramatically faster for the rest of the fight.' },
          { name: 'Wall Crawler', trigger: 'Passive', effect: 'Climbs up onto rooftops and boulders like a Ninja, closing in from terrain other raiders can\'t reach' },
          { name: 'Axe Throw', trigger: 'Engaging a flying target', effect: 'Hurls its Double Axe as a thrown weapon instead of closing to melee, since flying targets are otherwise out of its reach' },
        ] },
    ];

    // Biome icon/label shown on each Raiders Index entry - reuses the same
    // theme keys as BIOME_THEME_CONFIG (Custom Game's Biome Theme picker),
    // so "which biome was this raider seen on" reads the same way here.
    const RAIDER_BIOME_LABELS = { classic: '🏝️ Classic', japan: '🌸 The Far East', desert: '🏜️ Desert', shadowIsland: '🌑 Shadow Island', northernlands: '❄️ The Northernlands' };

    let discoveredRaiderTypes = {};
    try {
      const raw = JSON.parse(localStorage.getItem('bt_raidersDiscovered')) || {};
      Object.keys(raw).forEach(t => {
        if (raw[t] === true) {
          // Legacy save from before biome-tracking existed - the only
          // biome that could have been played back then was Classic.
          discoveredRaiderTypes[t] = { classic: true };
        } else if (raw[t] && typeof raw[t] === 'object') {
          discoveredRaiderTypes[t] = raw[t];
        }
      });
    } catch (e) { discoveredRaiderTypes = {}; }

    function saveDiscoveredRaiderTypes() {
      localStorage.setItem('bt_raidersDiscovered', JSON.stringify(discoveredRaiderTypes));
    }

    function isRaiderTypeDiscovered(type) {
      const entry = discoveredRaiderTypes[type];
      return !!(entry && Object.keys(entry).some(b => entry[b]));
    }

    // Which biome(s) this raider loadout has actually been seen on.
    function discoveredRaiderBiomes(type) {
      const entry = discoveredRaiderTypes[type];
      return entry ? Object.keys(entry).filter(b => entry[b]) : [];
    }

    // Marks a raider weapon loadout as seen on a given biome - called every
    // time a raider is actually equipped with that weapon (equipUnit), so
    // the Raiders Index fills in the first time each loadout appears on
    // the battlefield, and tracks every biome it's shown up on since.
    function discoverRaiderType(type, biome) {
      if (!discoveredRaiderTypes[type]) discoveredRaiderTypes[type] = {};
      if (!discoveredRaiderTypes[type][biome]) {
        discoveredRaiderTypes[type][biome] = true;
        saveDiscoveredRaiderTypes();
      }
    }

    // --- Boss Index ---
    // Sits alongside the Raiders Index as a second tab on the same Main
    // Menu panel (see the raiders-index-tab buttons and
    // showRaidersIndexTab()). Unlike a raider loadout, a boss isn't tied to
    // a biome - each one only ever appears once, as the final-wave boss of
    // its own side of Event: Death & Life (see createEventBossUnit and the
    // event field below) - so discovery here is a flat type -> seen map
    // rather than the per-biome map discoveredRaiderTypes uses.
    const BOSS_TYPE_DEFS = [
      { type: 'goddessOfDeath', icon: '☠️', label: 'Goddess of Death', iconImage: GODDESS_ICON_URI,
        event: 'Event: Life', encounter: 'Lands alone on the final wave of the Undead assault on your own island - no boat, no warband, just her.',
        desc: 'The opposing Goddess herself, thrown into the last wave of Event: Life as a one-woman boss - far beefier and harder-hitting than the guard-post escorts around her, built from the exact same moveset as the playable Goddess of Death.',
        passives: [
          { name: "Reaper's Sweep", trigger: 'A chance on any melee swing', effect: 'A wide crescent slash that hits everything caught in front of her at once, knocking back and stunning whatever it lands on.' },
          { name: "Death's Decree", trigger: 'Her target is already badly wounded', effect: 'Instantly finishes the target off instead of a normal strike - no shield or armor saves them.' },
          { name: 'Soul Harvest', trigger: 'Every kill', effect: 'Heals herself for a portion of her max HP - the more she kills in one hit, the more she recovers.' },
          { name: 'Soul Vessel', trigger: 'On death, with a living raider nearby', effect: 'A chance to possess that raider and rise again in its body, unleashing a soul blast that damages everyone caught near her return.' },
        ] },
      { type: 'goddessOfLife', icon: '🌙', label: 'Goddess of Life', iconImage: GOLIFE_ICON_URI,
        event: 'Event: Death', encounter: "Holds a guard post on the Heavenly Island's last line of defense, alongside the Valkyrie & Angel squads.",
        desc: "The Heavenly Island's own Goddess, standing as the final boss of Event: Death - far tougher and harder-hitting than the guard posts around her, built from the exact same moveset as the playable Goddess of Life.",
        passives: [
          { name: 'Gentle Touch', trigger: 'Every staff strike', effect: 'Mends her most wounded nearby ally at the same moment she damages her target.' },
          { name: 'Second Dawn', trigger: 'The moment she would fall - limited by a cooldown', effect: 'Rises back up with half her max HP and a shield, and the burst of light mends every wounded ally nearby.' },
          { name: 'Lightbringer Wave', trigger: 'Periodically, once an enemy is in range', effect: 'Sends out a wave of light that damages, knocks back, and stuns everyone it catches.' },
          { name: 'Cradle of Life', trigger: 'Periodically', effect: 'Revives one fallen member of whichever allied squad has taken the most losses.' },
        ] },
    ];

    let discoveredBossTypes = {};
    try {
      discoveredBossTypes = JSON.parse(localStorage.getItem('bt_bossesDiscovered')) || {};
    } catch (e) { discoveredBossTypes = {}; }

    function saveDiscoveredBossTypes() {
      localStorage.setItem('bt_bossesDiscovered', JSON.stringify(discoveredBossTypes));
    }

    function isBossTypeDiscovered(type) {
      return !!discoveredBossTypes[type];
    }

    // Marks a boss as seen - called once from createEventBossUnit, the
    // moment either Event: Death & Life boss actually spawns in the world.
    function discoverBossType(type) {
      if (!discoveredBossTypes[type]) {
        discoveredBossTypes[type] = true;
        saveDiscoveredBossTypes();
      }
    }

    // Fragments required to advance FROM the given level to the next one.
    function squadUpgradeCost(level) {
      return level * 3;
    }

    function squadStatMultiplier(type) {
      const level = playerSquadLevels[type] || 1;
      return 1 + (level - 1) * (SQUAD_LEVEL_BONUS_PCT / 100);
    }

    // Applies this squad type's current upgrade level to a freshly-equipped
    // unit's combat stats - bumps max/current HP and stores a damage
    // multiplier that melee/projectile damage rolls read from at hit-time.
    // Dragon Ronin is a lone singleton unit standing in for a whole
    // 4-member squad, so it carries a much bigger HP pool than any one
    // regular unit's 100 - closer to a small squad's combined health,
    // on top of which its own upgrade-level multiplier still applies.
    const DRAGON_RONIN_HP_MULT = 3.5;
    // Paladins are the tankiest regular squad member - both the Leader and
    // the Elite Swordsmen carry a much bigger health pool than a normal
    // 100-HP line unit, on top of which the squad's own upgrade-level
    // multiplier still applies (see squadStatMultiplier).
    const PALADIN_HP_MULT = 2.75;
    // Slasher squad members are set to a flat 800 HP each, regardless of
    // the base 100-HP line-unit pool - on top of which the squad's own
    // upgrade-level multiplier still applies (see squadStatMultiplier).
    const SLASHER_HP_MULT = 8;
    // Steel Revenant passive (Colossus) - a lone singleton unit standing
    // in for an entire squad, so it carries the same towering HP pool
    // (STEEL_REVENANT_HP, 600) it did as an enemy - derived here as a
    // multiplier off the normal 100-HP line-unit baseline so the squad's
    // own upgrade-level multiplier still applies on top of it.
    const STEEL_REVENANT_HP_MULT = STEEL_REVENANT_HP / 100;
    // Lich is a lone singleton unit standing in for a whole squad, same
    // reasoning as Dragon Ronin/Steel Revenant above, but squishier than
    // either - it's meant to be kept at range behind the front line and
    // protected, not tanked with, so its pool sits well below theirs.
    const LICH_HP_MULT = 3;
    // Kitsune Twinblade is a 2-member squad standing in for the usual
    // 4-member line, so each of its two members carries a bigger pool
    // than a normal 100-HP unit - on top of which the squad's own
    // upgrade-level multiplier still applies (see squadStatMultiplier).
    const KITSUNE_HP_MULT = 3.5;
    // Frost Armor passive - a flat fraction of incoming damage shaved off
    // every hit, applied in applyDamage right before the damage roll is
    // subtracted from HP.
    const LICH_FROST_ARMOR_REDUCTION = 0.25;

    function applySquadLevelStats(unit, type) {
      const mult = squadStatMultiplier(type);
      const baseHp = type === 'dragonRonin' ? 100 * DRAGON_RONIN_HP_MULT
        : type === 'paladins' ? 100 * PALADIN_HP_MULT
        : type === 'slasher' ? 100 * SLASHER_HP_MULT
        : type === 'steelRevenant' ? 100 * STEEL_REVENANT_HP_MULT
        : type === 'goddessOfDeath' ? 100 * GODDESS_HP_MULT
        : type === 'goddessOfLife' ? 100 * GOLIFE_HP_MULT
        : type === 'lich' ? 100 * LICH_HP_MULT
        : type === 'kitsuneTwinblade' ? 100 * KITSUNE_HP_MULT
        : 100;
      unit.userData.maxHp = Math.round(baseHp * mult);
      unit.userData.hp = unit.userData.maxHp;
      // baseDmgMultiplier is the Squad Upgrade level scalar alone; dmgMultiplier
      // is what combat code actually reads and starts out equal to it. For a
      // Paladin Elite Swordsman it gets re-derived from baseDmgMultiplier every
      // frame in updatePaladinAbilities (Encourage passive) - see there.
      unit.userData.baseDmgMultiplier = mult;
      unit.userData.dmgMultiplier = mult;
    }

    // Tears down whatever squad groups currently exist, then builds a fresh
    // `squads` array from squadComposition. Called once at startup (with the
    // default composition) and again whenever a run starts, so a composition
    // change made in the menu actually takes effect on the next battle.
    let squads = [];
    let selectedSquadIndex = 0;
    function rebuildPlayerSquads() {
      squads.forEach(squad => {
        squad.members.forEach(u => { if (u.userData.hpElement) u.userData.hpElement.remove(); });
        scene.remove(squad.group);
      });

      let chosenTypes = squadComposition.filter(t => !!t);
      if (chosenTypes.length === 0) chosenTypes = ['swords']; // never start with zero squads

      squads = chosenTypes.map(type => createSquad(squadDef(type)));

      selectedSquadIndex = squads.findIndex(s => s.type === 'archers');
      if (selectedSquadIndex === -1) selectedSquadIndex = 0;
      squads[selectedSquadIndex].ring.visible = true;

      buildActionBar();
    }

    // Builds the bottom action bar from the current `squads` array (whatever
    // types/count were chosen), keyed by slot index rather than type so
    // duplicate squad types each get their own button.
    function buildActionBar() {
      const bar = document.getElementById('action-bar');
      bar.innerHTML = '';
      squads.forEach((squad, i) => {
        const def = squadDef(squad.type) || { icon: '?', label: squad.type };
        const btn = document.createElement('button');
        btn.className = 'action-btn' + (i === selectedSquadIndex ? ' active' : '');
        btn.onclick = () => selectSquad(i, btn);
        const maxMembers = def.memberCount || 4;
        btn.innerHTML = `<span class="hotkey-badge">${i + 1}</span><span class="icon">${iconHtml(def)}</span>
          <span>${def.label}</span>
          <span class="unit-count" id="count-slot-${i}">${squad.members.length}/${maxMembers}</span>`;
        bar.appendChild(btn);
      });
    }

    // Converts a CLASS_DEFS hex color number (e.g. 0x2266bb) to a CSS color
    // string, used to tint both the slot portraits and the draggable tray
    // portraits so a squad's equipped color is visible at a glance.
    function classColorCss(type) {
      const def = squadDef(type);
      return def ? '#' + def.color.toString(16).padStart(6, '0') : '#2a2d30';
    }

    // --- Save / Load Squad (3 slots) ---
    // Each slot stores a copy of the four equipped squad slots
    // (squadComposition). Saved to localStorage so it survives a reload.
    const SQUAD_LOADOUT_SLOTS = 3;
    let squadLoadouts = [];
    try {
      const raw = JSON.parse(localStorage.getItem('bt_squadLoadouts'));
      if (Array.isArray(raw)) squadLoadouts = raw;
    } catch (e) { squadLoadouts = []; }
    while (squadLoadouts.length < SQUAD_LOADOUT_SLOTS) squadLoadouts.push(null);
    squadLoadouts.length = SQUAD_LOADOUT_SLOTS;

    function persistSquadLoadouts() {
      try { localStorage.setItem('bt_squadLoadouts', JSON.stringify(squadLoadouts)); } catch (e) {}
    }

    // Custom slot names (blank / missing = the default "Squad N").
    let squadLoadoutNames = [];
    try {
      const rawNames = JSON.parse(localStorage.getItem('bt_squadLoadoutNames'));
      if (Array.isArray(rawNames)) squadLoadoutNames = rawNames;
    } catch (e) { squadLoadoutNames = []; }
    while (squadLoadoutNames.length < SQUAD_LOADOUT_SLOTS) squadLoadoutNames.push(null);
    squadLoadoutNames.length = SQUAD_LOADOUT_SLOTS;

    function squadLoadoutName(i) {
      const n = squadLoadoutNames[i];
      return (typeof n === 'string' && n.trim()) ? n.trim() : 'Squad ' + (i + 1);
    }

    let loadoutRenaming = -1;
    function commitLoadoutRename(i, value) {
      if (loadoutRenaming !== i) return;
      loadoutRenaming = -1;
      const clean = String(value || '').trim().slice(0, 16);
      squadLoadoutNames[i] = clean || null;
      try { localStorage.setItem('bt_squadLoadoutNames', JSON.stringify(squadLoadoutNames)); } catch (e) {}
      renderSquadLoadouts();
    }

    let loadoutOverwritePending = -1;
    let loadoutOverwriteTimer = null;
    let loadoutStatusTimer = null;

    function setLoadoutStatus(msg) {
      const el = document.getElementById('squad-loadout-status');
      if (!el) return;
      el.textContent = msg;
      clearTimeout(loadoutStatusTimer);
      loadoutStatusTimer = setTimeout(() => { el.textContent = ''; }, 3000);
    }

    function squadLoadoutMatches(saved) {
      if (!saved) return false;
      for (let i = 0; i < SQUAD_SLOT_COUNT; i++) {
        if ((saved[i] || null) !== (squadComposition[i] || null)) return false;
      }
      return true;
    }

    function saveSquadLoadout(i) {
      if (!squadComposition.some(t => !!t)) { setLoadoutStatus('Equip at least one squad before saving.'); return; }
      if (squadLoadouts[i] && loadoutOverwritePending !== i) {
        // Slot already holds a squad - require a second tap to overwrite it.
        loadoutOverwritePending = i;
        clearTimeout(loadoutOverwriteTimer);
        loadoutOverwriteTimer = setTimeout(() => { loadoutOverwritePending = -1; renderSquadLoadouts(); }, 2500);
        renderSquadLoadouts();
        return;
      }
      loadoutOverwritePending = -1;
      clearTimeout(loadoutOverwriteTimer);
      squadLoadouts[i] = Array.from({ length: SQUAD_SLOT_COUNT }, (_, n) => squadComposition[n] || null);
      persistSquadLoadouts();
      renderSquadLoadouts();
      setLoadoutStatus('Saved to ' + squadLoadoutName(i) + '.');
    }

    function loadSquadLoadout(i) {
      const saved = squadLoadouts[i];
      if (!saved) return;
      let skipped = 0;
      const next = [];
      for (let n = 0; n < SQUAD_SLOT_COUNT; n++) {
        const type = saved[n];
        const def = type ? squadDef(type) : null;
        if (!def || !isSquadUnlocked(type) || (def.singleton && next.includes(type))) {
          if (type) skipped++;
          next.push(null);
        } else {
          next.push(type);
        }
      }
      if (!next.some(t => !!t)) { setLoadoutStatus('None of those squads are available.'); return; }
      for (let n = 0; n < SQUAD_SLOT_COUNT; n++) squadComposition[n] = next[n];
      loadoutOverwritePending = -1;
      renderManageSquadPanel();
      setLoadoutStatus(skipped ? 'Loaded ' + squadLoadoutName(i) + ' (' + skipped + ' unavailable skipped).' : 'Loaded ' + squadLoadoutName(i) + '.');
    }

    function renderSquadLoadouts() {
      const box = document.getElementById('squad-loadouts');
      if (!box) return;
      const prevStatus = (document.getElementById('squad-loadout-status') || {}).textContent || '';
      box.innerHTML = '';
      for (let i = 0; i < SQUAD_LOADOUT_SLOTS; i++) {
        const saved = squadLoadouts[i];
        const row = document.createElement('div');
        row.className = 'squad-loadout' + (squadLoadoutMatches(saved) ? ' active' : '');

        const main = document.createElement('div');
        main.className = 'squad-loadout-main';
        const name = document.createElement('div');
        name.className = 'squad-loadout-name';
        if (loadoutRenaming === i) {
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'squad-loadout-input';
          input.maxLength = 16;
          input.value = squadLoadoutNames[i] || '';
          input.placeholder = 'Squad ' + (i + 1);
          input.enterKeyHint = 'done';
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitLoadoutRename(i, input.value); }
            else if (e.key === 'Escape') { loadoutRenaming = -1; renderSquadLoadouts(); }
          });
          input.addEventListener('blur', () => commitLoadoutRename(i, input.value));
          name.appendChild(input);
          setTimeout(() => { input.focus(); input.select(); }, 0);
        } else {
          const title = document.createElement('span');
          title.className = 'squad-loadout-title';
          title.textContent = squadLoadoutName(i);
          name.appendChild(title);
          const pen = document.createElement('button');
          pen.className = 'squad-loadout-rename';
          pen.textContent = '✏️';
          pen.setAttribute('aria-label', 'Rename ' + squadLoadoutName(i));
          pen.onclick = () => { loadoutRenaming = i; renderSquadLoadouts(); };
          name.appendChild(pen);
          if (squadLoadoutMatches(saved)) {
            const tag = document.createElement('small');
            tag.textContent = 'Equipped';
            name.appendChild(tag);
          }
        }
        main.appendChild(name);

        if (saved) {
          const icons = document.createElement('div');
          icons.className = 'squad-loadout-icons';
          for (let n = 0; n < SQUAD_SLOT_COUNT; n++) {
            const def = saved[n] ? squadDef(saved[n]) : null;
            const ic = document.createElement('div');
            ic.className = 'squad-loadout-icon' + (def ? '' : ' empty');
            if (def) { ic.style.background = classColorCss(def.type); ic.innerHTML = iconHtml(def); ic.title = def.label; }
            icons.appendChild(ic);
          }
          main.appendChild(icons);
        } else {
          const empty = document.createElement('div');
          empty.className = 'squad-loadout-empty';
          empty.textContent = 'Empty slot';
          main.appendChild(empty);
        }
        row.appendChild(main);

        const saveBtn = document.createElement('button');
        const confirming = loadoutOverwritePending === i;
        saveBtn.className = 'squad-loadout-btn save' + (confirming ? ' confirm' : '');
        saveBtn.textContent = confirming ? 'Overwrite?' : 'Save';
        saveBtn.onclick = () => saveSquadLoadout(i);
        row.appendChild(saveBtn);

        const loadBtn = document.createElement('button');
        loadBtn.className = 'squad-loadout-btn';
        loadBtn.textContent = 'Load';
        loadBtn.disabled = !saved;
        loadBtn.onclick = () => loadSquadLoadout(i);
        row.appendChild(loadBtn);

        box.appendChild(row);
      }
      const status = document.createElement('div');
      status.id = 'squad-loadout-status';
      status.className = 'squad-loadout-status';
      status.textContent = prevStatus;
      box.appendChild(status);
    }

    // Renders the Manage Squad screen: 4 portrait "slots" (drop targets,
    // one per squad) above a tray of draggable unit-type portraits. Dragging
    // a portrait from the tray onto a slot equips that type into that slot;
    // tapping a filled slot's ✕ clears it back to empty.
    function renderManageSquadPanel() {
      const grid = document.getElementById('squad-slot-grid');
      grid.innerHTML = '';
      for (let i = 0; i < SQUAD_SLOT_COUNT; i++) {
        const type = squadComposition[i];
        const def = squadDef(type);

        const slot = document.createElement('div');
        slot.className = 'squad-slot' + (def ? ' filled' : '');
        slot.dataset.slotIndex = String(i);
        slot.style.background = def ? classColorCss(type) : '#2a2d30';
        slot.style.borderColor = def ? classColorCss(type) : '#4a4e52';

        const number = document.createElement('span');
        number.className = 'slot-number';
        number.textContent = String(i + 1);
        slot.appendChild(number);

        if (def) {
          const icon = document.createElement('span');
          icon.className = 'slot-icon';
          icon.innerHTML = iconHtml(def);
          slot.appendChild(icon);

          const label = document.createElement('span');
          label.className = 'slot-label';
          label.textContent = def.label;
          slot.appendChild(label);

          const clearBtn = document.createElement('button');
          clearBtn.className = 'slot-clear-btn';
          clearBtn.textContent = '✕';
          clearBtn.onclick = (e) => {
            e.stopPropagation();
            squadComposition[i] = null;
            renderManageSquadPanel();
          };
          slot.appendChild(clearBtn);
        } else {
          const hint = document.createElement('span');
          hint.className = 'slot-empty-hint';
          hint.textContent = '+';
          slot.appendChild(hint);
        }

        grid.appendChild(slot);
      }

      const tray = document.getElementById('unit-portrait-tray');
      tray.innerHTML = '';
      // Only unlocked squads appear here - locked ones are omitted entirely
      // instead of showing a locked placeholder card. Browse everything
      // (unlocked or not) in the Squad Index list below. A singleton type
      // (currently just Dragon Ronin) also drops out of the tray once it's
      // already sitting in one of the slots below - only one copy of it can
      // ever be equipped at a time, so there's nothing left to drag.
      CLASS_DEFS.forEach(def => {
        const unlocked = isSquadUnlocked(def.type);
        if (!unlocked) return;
        if (def.singleton && squadComposition.includes(def.type)) return;

        const card = document.createElement('div');
        card.className = 'unit-portrait';
        card.style.background = classColorCss(def.type);

        const icon = document.createElement('span');
        icon.className = 'portrait-icon';
        icon.innerHTML = iconHtml(def);
        card.appendChild(icon);

        const label = document.createElement('span');
        label.className = 'portrait-label';
        label.textContent = def.label;
        card.appendChild(label);

        attachPortraitDrag(card, def.type);
        tray.appendChild(card);
      });

      // Fades out the tray-wrap's right-edge scroll hint once the row is
      // scrolled all the way to its end (or doesn't need to scroll at
      // all), and keeps it in sync as the user scrolls.
      const trayWrap = tray.closest('.unit-portrait-tray-wrap');
      if (trayWrap) {
        const updateTrayScrollHint = () => {
          const atEnd = tray.scrollWidth - tray.clientWidth - tray.scrollLeft <= 2;
          trayWrap.classList.toggle('at-end', atEnd);
        };
        tray.addEventListener('scroll', updateTrayScrollHint);
        updateTrayScrollHint();
      }

      renderSquadIndexList();
      renderSquadLoadouts();
    }

    // --- Dev Tools: lock / unlock a squad from the Squad Index ---
    // devToolsEnabled is declared further down the script, so read it
    // through a guard in case this runs before that line has executed.
    function devToolsIsOn() {
      try { return !!devToolsEnabled; } catch (e) { return false; }
    }
    function devSetSquadUnlocked(type, unlock) {
      playerSquadUnlocked[type] = !!unlock;
      saveSquadUnlocked();
      if (!unlock) {
        // A locked squad can't stay equipped.
        for (let n = 0; n < squadComposition.length; n++) {
          if (squadComposition[n] === type) squadComposition[n] = null;
        }
      }
      renderManageSquadPanel();
    }

    // Renders the Squad Index: a plain browsable list (separate from the
    // drag-to-equip tray above) of every squad type, unlocked or not.
    // Tapping any row opens the Squad Detail modal with full info and a
    // Passive Ability Preview - a locked entry can still be tapped to
    // preview what it does before pulling for it in the Gacha.
    function renderSquadIndexList() {
      const list = document.getElementById('squad-index-list');
      list.innerHTML = '';
      CLASS_DEFS.forEach(def => {
        const unlocked = isSquadUnlocked(def.type);

        const item = document.createElement('div');
        item.className = 'squad-index-item' + (unlocked ? '' : ' locked');
        item.onclick = () => openSquadDetail(def.type);

        const icon = document.createElement('div');
        icon.className = 'squad-index-icon';
        icon.style.background = unlocked ? classColorCss(def.type) : '#2a2d30';
        icon.innerHTML = unlocked ? iconHtml(def) : '🔒';
        item.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'squad-index-name';
        name.textContent = def.label;
        item.appendChild(name);

        if (!unlocked) {
          const lock = document.createElement('span');
          lock.className = 'squad-index-lock';
          lock.textContent = '🔒';
          item.appendChild(lock);
        }

        // Dev Tools only: per-squad Lock / Unlock toggle.
        if (devToolsIsOn()) {
          const devBtn = document.createElement('button');
          devBtn.type = 'button';
          devBtn.className = 'squad-index-dev-btn ' + (unlocked ? 'do-lock' : 'do-unlock');
          devBtn.textContent = unlocked ? 'Lock' : 'Unlock';
          devBtn.onclick = (e) => {
            e.stopPropagation();
            devSetSquadUnlocked(def.type, !unlocked);
          };
          item.appendChild(devBtn);
        }

        const chevron = document.createElement('span');
        chevron.className = 'squad-index-chevron';
        chevron.textContent = '›';
        item.appendChild(chevron);

        list.appendChild(item);
      });
    }

    // Opens the Squad Detail modal for one squad type: header (icon, name,
    // rarity, unlock status), current stats (if unlocked), the full squad
    // description, and a Passive Ability Preview breaking each passive down
    // into a Trigger -> Effect flow so it's clear how it actually works.
    function openSquadDetail(type) {
      const def = squadDef(type);
      if (!def) return;
      const unlocked = isSquadUnlocked(type);
      const rarityLabel = squadRarityLabel(def.rarity);

      document.getElementById('squad-detail-icon').style.background = unlocked ? classColorCss(type) : '#2a2d30';
      document.getElementById('squad-detail-icon').innerHTML = unlocked ? iconHtml(def) : '🔒';
      document.getElementById('squad-detail-name').textContent = def.label;

      const rarityBadge = document.getElementById('squad-detail-rarity');
      rarityBadge.textContent = rarityLabel;
      rarityBadge.className = 'squad-rarity-badge ' + def.rarity;

      const status = document.getElementById('squad-detail-status');
      if (unlocked) {
        const level = playerSquadLevels[type] || 1;
        status.textContent = `✅ Unlocked - Lv. ${level}${level >= SQUAD_MAX_LEVEL ? ' (MAX)' : ' / ' + SQUAD_MAX_LEVEL}`;
        status.className = 'unlocked-status';
      } else {
        status.textContent = '🔒 Locked - pull for this squad in The Recruiter\'s Gacha';
        status.className = '';
      }

      const statsEl = document.getElementById('squad-detail-stats');
      if (unlocked) {
        const mult = squadStatMultiplier(type);
        const hp = Math.round(100 * mult);
        const dmg = Math.round(def.baseDmg * mult);
        statsEl.style.display = '';
        statsEl.innerHTML = `<span>❤️ ${hp}</span><span>⚔️ ${dmg}</span>`;
      } else {
        statsEl.style.display = 'none';
        statsEl.innerHTML = '';
      }

      document.getElementById('squad-detail-desc').textContent = def.desc;

      // Biome-encountered row only applies to the Raiders Index modal.
      const biomeElSquad = document.getElementById('squad-detail-biomes');
      biomeElSquad.style.display = 'none';
      biomeElSquad.innerHTML = '';

      const passivesEl = document.getElementById('squad-detail-passives');
      passivesEl.innerHTML = '';
      (def.passives || []).forEach(p => {
        const card = document.createElement('div');
        card.className = 'squad-detail-passive-card';
        card.innerHTML = `
          <div class="squad-detail-passive-name">✨ ${p.name}</div>
          <div class="squad-detail-passive-flow">
            <div class="squad-detail-passive-step trigger">
              <span class="step-label">Trigger</span>
              <span class="step-text">${p.trigger}</span>
            </div>
            <span class="squad-detail-passive-arrow">➜</span>
            <div class="squad-detail-passive-step effect">
              <span class="step-label">Effect</span>
              <span class="step-text">${p.effect}</span>
            </div>
          </div>
        `;
        passivesEl.appendChild(card);
      });

      document.getElementById('squad-detail-overlay').classList.add('visible');
    }

    function closeSquadDetail() {
      document.getElementById('squad-detail-overlay').classList.remove('visible');
    }

    // Renders the Raiders Index list on the Main Menu: every known raider
    // weapon loadout, shown as "???" and greyed out until the player has
    // actually faced that loadout in battle (see discoverRaiderType()).
    function renderRaidersIndexList() {
      const list = document.getElementById('raiders-index-list');
      list.innerHTML = '';
      RAIDER_TYPE_DEFS.forEach(def => {
        const discovered = isRaiderTypeDiscovered(def.type);

        const item = document.createElement('div');
        item.className = 'squad-index-item' + (discovered ? '' : ' locked');
        item.onclick = () => openRaiderDetail(def.type);

        const icon = document.createElement('div');
        icon.className = 'squad-index-icon';
        icon.style.background = discovered ? '#5a1e1e' : '#2a2d30';
        icon.textContent = discovered ? def.icon : '❓';
        item.appendChild(icon);

        const nameCol = document.createElement('div');
        nameCol.className = 'squad-index-name-col';
        const name = document.createElement('span');
        name.className = 'squad-index-name';
        name.textContent = discovered ? def.label : '???';
        nameCol.appendChild(name);

        if (discovered) {
          const biomes = discoveredRaiderBiomes(def.type);
          const sub = document.createElement('span');
          sub.className = 'squad-index-sub';
          sub.textContent = biomes.map(b => RAIDER_BIOME_LABELS[b] || b).join('  ');
          nameCol.appendChild(sub);
        }
        item.appendChild(nameCol);

        if (!discovered) {
          const lock = document.createElement('span');
          lock.className = 'squad-index-lock';
          lock.textContent = '❓';
          item.appendChild(lock);
        }

        const chevron = document.createElement('span');
        chevron.className = 'squad-index-chevron';
        chevron.textContent = '›';
        item.appendChild(chevron);

        list.appendChild(item);
      });
    }

    // Switches between the Raiders Index panel's two tabs. Shares one panel
    // (menu-panel-raiders-index) and the same underlying Squad Detail modal
    // as the raider entries - see openBossDetail below.
    function showRaidersIndexTab(tab) {
      document.getElementById('raiders-index-list').classList.toggle('hidden', tab !== 'raiders');
      document.getElementById('boss-index-list').classList.toggle('hidden', tab !== 'bosses');
      document.getElementById('raiders-index-tab-raiders').classList.toggle('active', tab === 'raiders');
      document.getElementById('raiders-index-tab-bosses').classList.toggle('active', tab === 'bosses');
      if (tab === 'bosses') renderBossIndexList(); else renderRaidersIndexList();
    }

    // Renders the Boss Index list: the two Event: Death & Life bosses,
    // shown as "???" and greyed out until the player has actually reached
    // the final wave that spawns them (see discoverBossType, called from
    // createEventBossUnit).
    function renderBossIndexList() {
      const list = document.getElementById('boss-index-list');
      list.innerHTML = '';
      BOSS_TYPE_DEFS.forEach(def => {
        const discovered = isBossTypeDiscovered(def.type);

        const item = document.createElement('div');
        item.className = 'squad-index-item' + (discovered ? '' : ' locked');
        item.onclick = () => openBossDetail(def.type);

        const icon = document.createElement('div');
        icon.className = 'squad-index-icon';
        icon.style.background = discovered ? '#5a1e1e' : '#2a2d30';
        icon.innerHTML = discovered ? iconHtml(def) : '❓';
        item.appendChild(icon);

        const nameCol = document.createElement('div');
        nameCol.className = 'squad-index-name-col';
        const name = document.createElement('span');
        name.className = 'squad-index-name';
        name.textContent = discovered ? def.label : '???';
        nameCol.appendChild(name);

        if (discovered) {
          const sub = document.createElement('span');
          sub.className = 'squad-index-sub';
          sub.textContent = def.event;
          nameCol.appendChild(sub);
        }
        item.appendChild(nameCol);

        if (!discovered) {
          const lock = document.createElement('span');
          lock.className = 'squad-index-lock';
          lock.textContent = '❓';
          item.appendChild(lock);
        }

        const chevron = document.createElement('span');
        chevron.className = 'squad-index-chevron';
        chevron.textContent = '›';
        item.appendChild(chevron);

        list.appendChild(item);
      });
    }

    // Opens the shared Squad Detail modal in "boss" mode - same layout as a
    // raider entry, but tagged with the Boss rarity badge and showing which
    // side of Event: Death & Life the boss is encountered on instead of a
    // biome list.
    function openBossDetail(type) {
      const def = BOSS_TYPE_DEFS.find(d => d.type === type);
      if (!def) return;
      const discovered = isBossTypeDiscovered(type);

      const iconEl = document.getElementById('squad-detail-icon');
      iconEl.style.background = discovered ? '#5a1e1e' : '#2a2d30';
      iconEl.innerHTML = discovered ? iconHtml(def) : '❓';
      document.getElementById('squad-detail-name').textContent = discovered ? def.label : '???';

      const rarityBadge = document.getElementById('squad-detail-rarity');
      rarityBadge.textContent = '☠️ Boss';
      rarityBadge.className = 'squad-rarity-badge boss';

      const status = document.getElementById('squad-detail-status');
      if (discovered) {
        status.textContent = '✅ Discovered';
        status.className = 'unlocked-status';
      } else {
        status.textContent = '❓ Undiscovered - reach the final wave of ' + def.event + ' to face her';
        status.className = '';
      }

      const statsEl = document.getElementById('squad-detail-stats');
      statsEl.style.display = 'none';
      statsEl.innerHTML = '';

      document.getElementById('squad-detail-desc').textContent = discovered
        ? def.desc
        : 'You haven\'t faced this boss yet.';

      const biomeEl = document.getElementById('squad-detail-biomes');
      if (discovered) {
        biomeEl.style.display = '';
        biomeEl.innerHTML = `<span class="squad-detail-biome-label">⚔️ Encountered in:</span> <span class="squad-detail-biome-pill">${def.event}</span> <span style="display:block; margin-top:4px; opacity:0.8; font-size:0.8em;">${def.encounter}</span>`;
      } else {
        biomeEl.style.display = 'none';
        biomeEl.innerHTML = '';
      }

      const passivesEl = document.getElementById('squad-detail-passives');
      passivesEl.innerHTML = '';
      if (discovered) {
        (def.passives || []).forEach(p => {
          const card = document.createElement('div');
          card.className = 'squad-detail-passive-card';
          card.innerHTML = `
            <div class="squad-detail-passive-name">✨ ${p.name}</div>
            <div class="squad-detail-passive-flow">
              <div class="squad-detail-passive-step trigger">
                <span class="step-label">Trigger</span>
                <span class="step-text">${p.trigger}</span>
              </div>
              <span class="squad-detail-passive-arrow">➜</span>
              <div class="squad-detail-passive-step effect">
                <span class="step-label">Effect</span>
                <span class="step-text">${p.effect}</span>
              </div>
            </div>
          `;
          passivesEl.appendChild(card);
        });
      }

      document.getElementById('squad-detail-overlay').classList.add('visible');
    }

    // Opens the shared Squad Detail modal in "raider" mode: same layout as
    // a player squad, minus stats (raiders don't have levels), showing the
    // loadout's description and a Passive Ability Preview once discovered.
    function openRaiderDetail(type) {
      const def = RAIDER_TYPE_DEFS.find(d => d.type === type);
      if (!def) return;
      const discovered = isRaiderTypeDiscovered(type);

      document.getElementById('squad-detail-icon').style.background = discovered ? '#5a1e1e' : '#2a2d30';
      document.getElementById('squad-detail-icon').textContent = discovered ? def.icon : '❓';
      document.getElementById('squad-detail-name').textContent = discovered ? def.label : '???';

      const rarityBadge = document.getElementById('squad-detail-rarity');
      rarityBadge.textContent = '🏴 Raider';
      rarityBadge.className = 'squad-rarity-badge raider';

      const status = document.getElementById('squad-detail-status');
      if (discovered) {
        status.textContent = '✅ Discovered';
        status.className = 'unlocked-status';
      } else {
        status.textContent = '❓ Undiscovered - face this raider in battle to learn about it';
        status.className = '';
      }

      const statsEl = document.getElementById('squad-detail-stats');
      statsEl.style.display = 'none';
      statsEl.innerHTML = '';

      document.getElementById('squad-detail-desc').textContent = discovered
        ? def.desc
        : 'You haven\'t faced this raider loadout yet. Defend a few more waves to find out how it fights.';

      const biomeEl = document.getElementById('squad-detail-biomes');
      if (discovered) {
        const biomes = discoveredRaiderBiomes(type);
        biomeEl.style.display = '';
        biomeEl.innerHTML = '<span class="squad-detail-biome-label">🗺️ Seen on:</span> '
          + biomes.map(b => `<span class="squad-detail-biome-pill">${RAIDER_BIOME_LABELS[b] || b}</span>`).join(' ');
      } else {
        biomeEl.style.display = 'none';
        biomeEl.innerHTML = '';
      }

      const passivesEl = document.getElementById('squad-detail-passives');
      passivesEl.innerHTML = '';
      if (discovered) {
        (def.passives || []).forEach(p => {
          const card = document.createElement('div');
          card.className = 'squad-detail-passive-card';
          card.innerHTML = `
            <div class="squad-detail-passive-name">✨ ${p.name}</div>
            <div class="squad-detail-passive-flow">
              <div class="squad-detail-passive-step trigger">
                <span class="step-label">Trigger</span>
                <span class="step-text">${p.trigger}</span>
              </div>
              <span class="squad-detail-passive-arrow">➜</span>
              <div class="squad-detail-passive-step effect">
                <span class="step-label">Effect</span>
                <span class="step-text">${p.effect}</span>
              </div>
            </div>
          `;
          passivesEl.appendChild(card);
        });
      }

      document.getElementById('squad-detail-overlay').classList.add('visible');
    }

    // Wires up pointer-based drag-to-equip for one tray portrait. Pointer
    // Events (rather than native HTML5 drag-and-drop, which touch browsers
    // support inconsistently) drive a floating "ghost" copy of the portrait
    // that follows the finger/cursor; on release, whichever squad slot is
    // under the pointer gets this unit type equipped into it.
    //
    // The tray itself needs to scroll horizontally (there are more unit
    // types than fit on one screen), so a plain pointerdown->preventDefault
    // would swallow every sideways swipe and make the row unscrollable.
    // Instead this waits for the first few pixels of movement and looks at
    // its direction: a swipe that's mostly sideways is left alone so the
    // browser's native touch-action:pan-x scrolling handles it, while a
    // swipe that's mostly vertical (dragging a portrait up toward a slot)
    // commits to the drag-to-equip gesture below.
    function attachPortraitDrag(card, unitType) {
      const DRAG_COMMIT_THRESHOLD = 6; // px of movement before deciding drag vs scroll

      card.addEventListener('pointerdown', (downEvt) => {
        const pointerId = downEvt.pointerId;
        const startX = downEvt.clientX;
        const startY = downEvt.clientY;
        const def = squadDef(unitType);

        let dragActive = false;
        let ghost = null;
        let hoveredSlot = null;

        const findSlotAt = (x, y) => {
          ghost.style.display = 'none';
          const under = document.elementFromPoint(x, y);
          ghost.style.display = '';
          return under ? under.closest('.squad-slot') : null;
        };

        const beginDrag = (evt) => {
          dragActive = true;
          card.setPointerCapture(pointerId);
          card.classList.add('dragging-source');
          ghost = document.createElement('div');
          ghost.className = 'drag-ghost';
          ghost.style.background = classColorCss(unitType);
          ghost.innerHTML = `<span class="portrait-icon">${iconHtml(def)}</span>`;
          document.body.appendChild(ghost);
          ghost.style.left = evt.clientX + 'px';
          ghost.style.top = evt.clientY + 'px';
        };

        const cleanup = () => {
          card.removeEventListener('pointermove', onMove);
          card.removeEventListener('pointerup', onUp);
          card.removeEventListener('pointercancel', onCancel);
          if (dragActive) {
            try { card.releasePointerCapture(pointerId); } catch (e) {}
            card.classList.remove('dragging-source');
            if (hoveredSlot) hoveredSlot.classList.remove('drag-over');
            if (ghost) ghost.remove();
          }
        };

        const onMove = (moveEvt) => {
          if (!dragActive) {
            const dx = moveEvt.clientX - startX;
            const dy = moveEvt.clientY - startY;
            if (Math.abs(dx) < DRAG_COMMIT_THRESHOLD && Math.abs(dy) < DRAG_COMMIT_THRESHOLD) return;
            if (Math.abs(dy) <= Math.abs(dx)) {
              // Sideways-dominant: this is a scroll swipe, not a drag -
              // back off and let the browser's native pan-x take over.
              cleanup();
              return;
            }
            moveEvt.preventDefault();
            beginDrag(moveEvt);
          }
          moveEvt.preventDefault();
          ghost.style.left = moveEvt.clientX + 'px';
          ghost.style.top = moveEvt.clientY + 'px';
          const slotEl = findSlotAt(moveEvt.clientX, moveEvt.clientY);
          if (slotEl !== hoveredSlot) {
            if (hoveredSlot) hoveredSlot.classList.remove('drag-over');
            if (slotEl) slotEl.classList.add('drag-over');
            hoveredSlot = slotEl;
          }
        };

        const onUp = (upEvt) => {
          if (dragActive && hoveredSlot) {
            hoveredSlot.classList.remove('drag-over');
            const slotIndex = parseInt(hoveredSlot.dataset.slotIndex, 10);
            // Singleton safety net (e.g. Dragon Ronin): the tray already
            // hides a singleton type once it's equipped, but if a copy is
            // somehow dropped again anyway, clear it out of whichever
            // other slot it was in instead of letting it duplicate.
            if (def && def.singleton) {
              for (let i = 0; i < squadComposition.length; i++) {
                if (i !== slotIndex && squadComposition[i] === unitType) squadComposition[i] = null;
              }
            }
            squadComposition[slotIndex] = unitType;
            renderManageSquadPanel();
          }
          cleanup();
        };

        const onCancel = () => { cleanup(); };

        card.addEventListener('pointermove', onMove);
        card.addEventListener('pointerup', onUp);
        card.addEventListener('pointercancel', onCancel);
      });
    }

    rebuildPlayerSquads();

    // Island generation is now deferred until the player picks Custom Game
    // or a Campaign level from the Main Menu (see startCustomGame /
    // startCampaignLevel below) instead of firing immediately on page load.

    // --- MAIN MENU ---
    const CAMPAIGN_LEVELS = [
      { name: 'Level 1 — Coastal Watch',  startWave: 0, desc: 'A gentle landing. Learn the ropes.' },
      { name: 'Level 2 — Windward Isle',  startWave: 2, desc: 'Raiders grow bolder.' },
      { name: 'Level 3 — Stormfall',      startWave: 4, desc: 'Multiple warbands strike at once.' },
      { name: 'Level 4 — Ashen Coast',    startWave: 6, desc: 'Full raiding parties, hard-pressed defenses.' },
      { name: 'Level 5 — The Last Stand', startWave: 9, desc: 'Everything the raiders have.' },
    ];

    // Screen-% positions (left/top) for each CAMPAIGN_LEVELS entry, in the
    // same 0-100 coordinate space as the .campaign-map-trail viewBox above,
    // so the node buttons land exactly on the trail's dots/islands.
    const CAMPAIGN_MAP_NODES = [
      { x: 20, y: 88 },
      { x: 72, y: 74 },
      { x: 30, y: 56 },
      { x: 76, y: 36 },
      { x: 50, y: 14 },
    ];

    (function populateCampaignWorldMap() {
      const map = document.getElementById('campaign-world-map');
      CAMPAIGN_LEVELS.forEach((level, i) => {
        const pos = CAMPAIGN_MAP_NODES[i] || { x: 50, y: 50 };
        const btn = document.createElement('button');
        btn.className = 'campaign-map-node';
        btn.style.left = pos.x + '%';
        btn.style.top = pos.y + '%';
        btn.title = level.desc;
        btn.onclick = () => startCampaignLevel(i);
        // Node shows just the level number; the label below carries the
        // place name (whatever follows the em dash in CAMPAIGN_LEVELS'
        // "Level N — Place Name" convention, falling back to the full name).
        const placeName = level.name.includes('—') ? level.name.split('—')[1].trim() : level.name;
        btn.innerHTML = `<span class="node-dot">${i + 1}</span><span class="node-label">${placeName}</span>`;
        map.appendChild(btn);
      });
    })();

    // Swaps which panel is visible inside the Main Menu ('root', 'play', 'campaign', etc).
    function showMenuPanel(panel) {
      if (panel === 'root') pendingEventFaction = null;
      document.getElementById('menu-title').classList.toggle('hidden', panel !== 'root');
      document.getElementById('menu-subtitle').classList.toggle('hidden', panel !== 'root');
      document.getElementById('menu-panel-root').classList.toggle('hidden', panel !== 'root');
      document.getElementById('menu-panel-play').classList.toggle('hidden', panel !== 'play');
      document.getElementById('menu-panel-custom-options').classList.toggle('hidden', panel !== 'custom-options');
      document.getElementById('menu-panel-campaign').classList.toggle('hidden', panel !== 'campaign');
      document.getElementById('menu-panel-manage-squad').classList.toggle('hidden', panel !== 'manage-squad');
      document.getElementById('menu-panel-squad-info').classList.toggle('hidden', panel !== 'squad-info');
      document.getElementById('menu-panel-recruit-shop').classList.toggle('hidden', panel !== 'recruit-shop');
      document.getElementById('menu-panel-daily-shop').classList.toggle('hidden', panel !== 'daily-shop');
      document.getElementById('menu-panel-raiders-index').classList.toggle('hidden', panel !== 'raiders-index');
      document.getElementById('menu-panel-event-lore').classList.toggle('hidden', panel !== 'event-lore');
      document.getElementById('menu-panel-event-shop').classList.toggle('hidden', panel !== 'event-shop');
      document.getElementById('menu-panel-player-info').classList.toggle('hidden', panel !== 'player-info');
      document.getElementById('menu-panel-coop').classList.toggle('hidden', panel !== 'coop');
      document.getElementById('menu-panel-coop-lobby').classList.toggle('hidden', panel !== 'coop-lobby');
      if (panel === 'coop' && typeof coopResetMenuError === 'function') coopResetMenuError();
      if (panel === 'manage-squad') { renderManageSquadPanel(); updateEventAssaultBanner(); }
      if (panel === 'squad-info') renderSquadInfoPanel();
      if (panel === 'recruit-shop') { rollRecruiter(); switchRecruitShopPage(1); renderRecruitShopPanel(); startExclusiveBannerTimer(); } else { stopExclusiveBannerTimer(); }
      if (panel === 'daily-shop') { renderDailyShopPanel(); startDailyShopTimer(); } else { stopDailyShopTimer(); }
      if (panel === 'event-shop') renderEventShopPanel();
      if (panel === 'raiders-index') showRaidersIndexTab('raiders');
      if (panel === 'player-info' && typeof renderPlayerInfoPanel === 'function') renderPlayerInfoPanel();
    }

    // --- Recruit Shop pages ---
    // Page 1 is The Recruiter's main Gacha (all non-exclusive squads, plus
    // Dragon Ronin/Paladins) and never shows any Exclusive banner content.
    // Pages 2 and 3 are the two Exclusive Squads Recruitment banners
    // (EXCLUSIVE_BANNER_SLOTS of them). Each one features a different
    // Exclusive squad picked at random from EXCLUSIVE_BANNER_TYPES, and the
    // lineup re-rolls every 7 real-world days (see
    // getFeaturedExclusiveTypes below) - so new exclusives can be added to
    // that list without ever needing another page. Reached by the
    // arrow/dot nav at the top of the Recruit Shop panel. Always reset to
    // Page 1 on opening the panel (see showMenuPanel above) so the player
    // lands on the main Gacha first every time.
    const RECRUIT_SHOP_PAGE_COUNT = 3;
    let recruitShopPage = 1;

    function switchRecruitShopPage(page) {
      if (page < 1) page = RECRUIT_SHOP_PAGE_COUNT;
      if (page > RECRUIT_SHOP_PAGE_COUNT) page = 1;
      recruitShopPage = page;
      for (let p = 1; p <= RECRUIT_SHOP_PAGE_COUNT; p++) {
        document.getElementById('recruit-shop-page-' + p).classList.toggle('hidden', p !== page);
        document.getElementById('shop-page-dot-' + p).classList.toggle('active', p === page);
      }
    }

    // --- Recruit Shop currencies ---
    // Gold and Contract Scrolls are persisted across sessions via localStorage.
    // New players start with a handful of scrolls so The Recruiter's Gacha
    // is immediately playable without needing another system to grant them.
    //
    // One-time reset: an earlier build stored an "unlimited" placeholder
    // value (999999999) for these keys. If that's what's sitting in
    // localStorage, wipe it out here so the player starts back at the
    // real defaults below instead of keeping the old unlimited numbers.
    const UNLIMITED_CURRENCY_RESET_THRESHOLD = 1000000;
    if (parseInt(localStorage.getItem('bt_gold'), 10) >= UNLIMITED_CURRENCY_RESET_THRESHOLD) {
      localStorage.removeItem('bt_gold');
    }
    if (parseInt(localStorage.getItem('bt_contractScrolls'), 10) >= UNLIMITED_CURRENCY_RESET_THRESHOLD) {
      localStorage.removeItem('bt_contractScrolls');
    }
    try {
      const storedTokens = JSON.parse(localStorage.getItem('bt_squadTokens'));
      if (storedTokens && Object.values(storedTokens).some(v => v >= UNLIMITED_CURRENCY_RESET_THRESHOLD)) {
        localStorage.removeItem('bt_squadTokens');
      }
    } catch (e) { /* malformed - leave for the normal parse below to handle */ }

    let playerGold = parseInt(localStorage.getItem('bt_gold'), 10) || 0;
    let playerContractScrolls = parseInt(localStorage.getItem('bt_contractScrolls'), 10);
    if (isNaN(playerContractScrolls)) playerContractScrolls = 20;

    // War Points - an Event-only currency (see the Event Shop, opened
    // from the Event: Death & Life menu). Earned only by killing enemies
    // during an active Event: Death or Event: Life run (see
    // awardRaiderKillLoot's eventFactionActive check below) - never in
    // Campaign or Custom Game. Spent in the Event Shop for Contract
    // Scrolls and Goddess of Death/Life Fragments.
    let playerWarPoints = parseInt(localStorage.getItem('bt_warPoints'), 10) || 0;

    // Recruit tokens won from the Gacha - one counter per squad type, so a
    // "Squads" pull result has somewhere persistent to land even though
    // squad composition itself is chosen freely in Manage Squad.
    let playerSquadTokens = {};
    try {
      playerSquadTokens = JSON.parse(localStorage.getItem('bt_squadTokens')) || {};
    } catch (e) { playerSquadTokens = {}; }
    CLASS_DEFS.forEach(def => { if (!playerSquadTokens[def.type]) playerSquadTokens[def.type] = 0; });

    function saveShopCurrencies() {
      localStorage.setItem('bt_gold', String(playerGold));
      localStorage.setItem('bt_contractScrolls', String(playerContractScrolls));
      localStorage.setItem('bt_squadTokens', JSON.stringify(playerSquadTokens));
      localStorage.setItem('bt_warPoints', String(playerWarPoints));
      updateCurrencyHud();
      refreshShopButtonStates();
    }

    // Keeps the Gacha Pull and Daily Shop Buy buttons' available/greyed-out
    // state in sync with the current currency totals whenever those
    // currencies change from something OTHER than the shop panel itself -
    // e.g. the Dev Tools "Add Gold/Scrolls" buttons, the HUD's +/- nudge
    // buttons, or Gold/Scrolls dropped by a raider kill mid-wave. Before
    // this, only opening the panel (or the pull/buy action itself) toggled
    // these classes, so topping up via Dev Tools to exactly (or just past)
    // a price left the button still looking disabled until you backed all
    // the way out of the panel and reopened it. Safe to call anytime -
    // every element here may not exist yet (an Exclusive banner page that
    // hasn't rendered once, or a shop panel that's simply not open right
    // now), so every lookup is guarded before use. GACHA_COST_SINGLE/TEN,
    // EXCLUSIVE_GACHA_COST_SINGLE/TEN and dailyShopStock are only read
    // here, never at call time before they're initialized, since this
    // function only ever runs from saveShopCurrencies - itself only ever
    // called in response to gameplay/UI events after the whole script (and
    // those consts) has already loaded.
    function refreshShopButtonStates() {
      const pull1Btn = document.getElementById('gacha-pull-1-btn');
      const pull10Btn = document.getElementById('gacha-pull-10-btn');
      if (pull1Btn) pull1Btn.classList.toggle('disabled', playerContractScrolls < GACHA_COST_SINGLE);
      if (pull10Btn) pull10Btn.classList.toggle('disabled', playerContractScrolls < GACHA_COST_TEN);

      for (let slot = 1; slot <= EXCLUSIVE_BANNER_SLOTS; slot++) {
        const area = document.getElementById('exclusive-pull-area-' + slot);
        if (area) {
          const btns = area.querySelectorAll('.gacha-pull-btn');
          if (btns[0]) btns[0].classList.toggle('disabled', playerContractScrolls < EXCLUSIVE_GACHA_COST_SINGLE);
          if (btns[1]) btns[1].classList.toggle('disabled', playerContractScrolls < EXCLUSIVE_GACHA_COST_TEN);
        }
      }

      document.querySelectorAll('#daily-shop-list .daily-shop-card').forEach((card, i) => {
        const btn = card.querySelector('.daily-shop-buy-btn');
        const item = dailyShopStock[i];
        if (!btn || !item || btn.classList.contains('sold')) return;
        btn.classList.toggle('disabled', playerGold < item.price);
      });
    }

    // Refreshes the in-game top-left currency HUD (Gold on top, Contract
    // Scrolls below - see #currency-hud) from the current playerGold/
    // playerContractScrolls values. Called from saveShopCurrencies so it
    // never drifts out of sync with whatever changed the currencies
    // (raider kill loot, Gacha pulls, Daily Shop purchases, etc), and once
    // at startup below so it shows the right numbers before anything has
    // changed yet.
    function updateCurrencyHud() {
      const goldEl = document.getElementById('hud-gold-amount');
      const scrollsEl = document.getElementById('hud-scrolls-amount');
      if (goldEl) goldEl.textContent = playerGold;
      if (scrollsEl) scrollsEl.textContent = playerContractScrolls;
      // Each pill stays out of the HUD entirely until the player has
      // actually earned some of that currency - a fresh save starting at
      // 0/0 no longer shows two pills reading "0" before anything's
      // happened. Hidden again the instant a pill's value returns to
      // (or starts at) exactly 0/negative.
      const goldPill = document.getElementById('hud-gold-pill');
      const scrollsPill = document.getElementById('hud-scrolls-pill');
      if (goldPill) goldPill.style.display = playerGold > 0 ? 'flex' : 'none';
      if (scrollsPill) scrollsPill.style.display = playerContractScrolls > 0 ? 'flex' : 'none';
      // War Points pill: only ever shown during an active Event: Death/Life
      // run (eventFactionActive), regardless of amount - it's meaningless
      // outside an Event, so it stays out of the HUD in every other mode.
      const warPointsEl = document.getElementById('hud-warpoints-amount');
      const warPointsPill = document.getElementById('hud-warpoints-pill');
      if (warPointsEl) warPointsEl.textContent = playerWarPoints;
      if (warPointsPill) warPointsPill.style.display = eventFactionActive ? 'flex' : 'none';
      // Also keeps the Recruit Shop's and Daily Shop's own currency pills
      // (present in the DOM even while their panel is hidden) in sync, so
      // anything that changes currency elsewhere (Dev Tools panel, raider
      // kills, etc) is reflected immediately without needing the panel to
      // be re-rendered. shop-gold-amount/shop-scrolls-amount are <input>
      // elements (click-to-edit when Dev Tools is on - see
      // updateDevToolsToggleUI/devSetGoldFromInput), so each is skipped
      // here while the player has it focused - overwriting .value out
      // from under their own keystrokes would fight their typing and
      // swallow things like a leading zero on the way to "10".
      const shopGoldEl = document.getElementById('shop-gold-amount');
      const shopScrollsEl = document.getElementById('shop-scrolls-amount');
      const dailyShopGoldEl = document.getElementById('daily-shop-gold-amount');
      if (shopGoldEl && document.activeElement !== shopGoldEl) shopGoldEl.value = playerGold;
      if (shopScrollsEl && document.activeElement !== shopScrollsEl) shopScrollsEl.value = playerContractScrolls;
      if (dailyShopGoldEl) dailyShopGoldEl.textContent = playerGold;
    }
    updateCurrencyHud();

    // --- Gold & Contract Scrolls from raider kills ---
    // On top of the Gacha's big lump-sum Gold rewards, every raider killed
    // in battle also drops a small amount of Gold on the spot, plus a low
    // chance of a single bonus Contract Scroll - so fighting off waves is
    // itself a steady (if slower) way to fund the Recruit Shop and Gacha,
    // not just something you do in between shopping trips.
    const RAIDER_KILL_GOLD_MIN = 3;
    const RAIDER_KILL_GOLD_MAX = 8;
    const RAIDER_KILL_SCROLL_CHANCE = 0.05; // low chance per kill

    // Awards the Gold (and rare Contract Scroll) from a single raider kill,
    // saves the updated currencies, and pops a floating readout at the
    // raider's death position - same floating-text style as damage numbers
    // - so the reward is visible without opening the Recruit Shop panel.
    // Called only for raider deaths (see killUnit/vanishAkumaFeral), never
    // for a player unit or villager death.
    const WAR_POINTS_KILL_MIN = 1;
    const WAR_POINTS_KILL_MAX = 3;

    function awardRaiderKillLoot(worldPos) {
      const gold = RAIDER_KILL_GOLD_MIN + Math.floor(Math.random() * (RAIDER_KILL_GOLD_MAX - RAIDER_KILL_GOLD_MIN + 1));
      playerGold += gold;
      spawnFloatingText(worldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), `+${gold} 🪙`, '#ffd700');

      if (Math.random() < RAIDER_KILL_SCROLL_CHANCE) {
        playerContractScrolls += 1;
        spawnFloatingText(worldPos.clone().add(new THREE.Vector3(0, 0.55, 0)), '+1 📜', '#e0c080');
      }

      // War Points - only while an Event: Death/Life run is actually
      // active (see eventFactionActive), so Campaign/Custom Game kills
      // never grant any.
      if (eventFactionActive) {
        const warPoints = WAR_POINTS_KILL_MIN + Math.floor(Math.random() * (WAR_POINTS_KILL_MAX - WAR_POINTS_KILL_MIN + 1));
        playerWarPoints += warPoints;
        spawnFloatingText(worldPos.clone().add(new THREE.Vector3(0, 0.8, 0)), `+${warPoints} ⚔️`, '#ff5555');
      }

      saveShopCurrencies();
    }

    // --- Random Recruiter: a new look (and sometimes a male recruiter) with
    // random dialogue every time the shop opens; tap the portrait to re-roll.
    const RECRUITER_COLORWAYS = 4;           // matches the data-variant CSS rules
    const RECRUITER_MALE_CHANCE = 0.35;
    const RECRUITER_LINES_F = [
      "Scrolls in hand? Let's see who signs up today.",
      "Fresh scrolls, fresh faces - shall we begin?",
      "Ooh, a lucky day! Let's find you a hero.",
      "The stars say someone strong is waiting.",
      "Hehe, I have a good feeling about you.",
      "Step right up - every scroll is a little adventure.",
      "Careful, recruits tend to fall in love with their squad.",
      "Come on, come on! Don't leave the good ones waiting.",
      "I've saved the best sign-ups just for you."
    ];
    const RECRUITER_LINES_M = [
      "Name's on the scroll? Good. Let's move.",
      "Recruits don't sign themselves. Pull a scroll.",
      "Hm. You look like someone who plays the odds.",
      "I only pick the ones who can hold a line.",
      "Got scrolls? Then we've got business.",
      "Try your luck, commander. I'll be watching.",
      "Every legend starts with a signature.",
      "Not bad. Let's see what fate hands you today.",
      "Steel and nerve - that's all a squad needs."
    ];
    let recruiterLook = { gender: 'f', variant: 0, line: RECRUITER_LINES_F[0] };

    function applyRecruiterLook() {
      const portrait = document.getElementById('recruiter-portrait');
      if (!portrait) return;
      portrait.dataset.gender = recruiterLook.gender;
      portrait.dataset.variant = String(recruiterLook.variant);
      const line = document.getElementById('recruiter-main-line');
      if (line) line.textContent = '"' + recruiterLook.line + '"';
      const hint = document.getElementById('recruiter-variant-row');
      if (hint) hint.textContent = 'Tap to meet another recruiter';
    }

    function rollRecruiter() {
      const prev = recruiterLook;
      let gender, variant;
      do {
        gender = Math.random() < RECRUITER_MALE_CHANCE ? 'm' : 'f';
        variant = Math.floor(Math.random() * RECRUITER_COLORWAYS);
      } while (gender === prev.gender && variant === prev.variant);
      const pool = gender === 'm' ? RECRUITER_LINES_M : RECRUITER_LINES_F;
      let line;
      do { line = pool[Math.floor(Math.random() * pool.length)]; } while (line === prev.line && pool.length > 1);
      recruiterLook = { gender, variant, line };
      applyRecruiterLook();
    }
    function cycleRecruiterVariant() { rollRecruiter(); }

    function renderRecruitShopPanel() {
      applyRecruiterLook();
      document.getElementById('shop-gold-amount').value = playerGold;
      document.getElementById('shop-scrolls-amount').value = playerContractScrolls;
      document.getElementById('gacha-cost-1').textContent = GACHA_COST_SINGLE;
      document.getElementById('gacha-cost-10').textContent = GACHA_COST_TEN;

      const pull1Btn = document.getElementById('gacha-pull-1-btn');
      const pull10Btn = document.getElementById('gacha-pull-10-btn');
      pull1Btn.classList.toggle('disabled', playerContractScrolls < GACHA_COST_SINGLE);
      pull10Btn.classList.toggle('disabled', playerContractScrolls < GACHA_COST_TEN);

      const collectionRow = document.getElementById('gacha-collection-row');
      collectionRow.innerHTML = '';
      CLASS_DEFS.forEach(def => {
        const unlocked = isSquadUnlocked(def.type);
        const rarityLabel = squadRarityLabel(def.rarity);
        const item = document.createElement('div');
        item.className = 'gacha-collection-item'
          + (unlocked ? '' : ' locked')
          + (def.rarity !== 'common' ? ' ' + def.rarity : '');
        item.innerHTML = unlocked
          ? `<span class="gc-icon">${iconHtml(def)}</span><span class="gc-count">${playerSquadTokens[def.type] || 0}</span>`
          : `<span class="gc-icon">🔒</span><span class="gc-count">${def.rarity !== 'common' ? rarityLabel : 'Locked'}</span>`;
        collectionRow.appendChild(item);
      });

      // Exclusive Banners: Pages 2 and 3 each show exactly one Exclusive-
      // tier squad, two different ones at a time, chosen at random by
      // getFeaturedExclusiveTypes() below, which re-rolls the pair every 7
      // real-world days. Portraits use the same iconHtml() helper as the
      // Squad Index/Squad Detail so they show the squad's real in-game icon
      // instead of a plain placeholder emoji.
      const featuredTypes = getFeaturedExclusiveTypes();
      for (let slot = 1; slot <= EXCLUSIVE_BANNER_SLOTS; slot++) {
        const featuredType = featuredTypes[slot - 1];
        if (!featuredType) continue;
        const featuredInfo = EXCLUSIVE_BANNER_INFO[featuredType];

        const exclusivePortrait = document.getElementById('exclusive-banner-portrait-' + slot);
        if (exclusivePortrait) exclusivePortrait.innerHTML = iconHtml(squadDef(featuredType));
        const exclusiveName = document.getElementById('exclusive-banner-name-' + slot);
        if (exclusiveName) exclusiveName.textContent = featuredInfo.name;
        const exclusiveLine = document.getElementById('exclusive-banner-line-' + slot);
        if (exclusiveLine) exclusiveLine.textContent = featuredInfo.line;

        // Each banner can only hand out its own featured Exclusive squad -
        // exclude every other Exclusive-tier type (including the one on the
        // other banner) from its roll pool and Drop Rates list.
        const excludeOthers = EXCLUSIVE_BANNER_TYPES.filter(t => t !== featuredType).join(',');
        renderExclusiveBannerArea('exclusive-pull-area-' + slot, excludeOthers);
      }
    }

    // Renders the pull row for one of the two Exclusive Squads
    // Recruitment banners (Page 2 or 3) - whichever squad
    // getFeaturedExclusiveTypes() assigned to that banner. The pull itself works like The
    // Recruiter's main Gacha (50% Gold, 50% weighted squad roll - see
    // performExclusivePull/rollGachaReward below) but at the pricier
    // EXCLUSIVE_GACHA_COST_SINGLE/TEN cost, and the squad half of the roll
    // is restricted to Epic/Legendary/Exclusive-tier squads. excludeType
    // drops the other Exclusive-tier types out of that pool, so each
    // banner can only ever hand out its own featured squad.
    function renderExclusiveBannerArea(containerId, excludeType) {
      const area = document.getElementById(containerId);
      const excludeArg = excludeType ? `'${excludeType}'` : 'null';
      area.innerHTML = `
        <div class="gacha-pull-row">
          <button class="gacha-pull-btn" onclick="performExclusivePull(1, ${excludeArg})">
            <span>Pull ×1</span>
            <span class="pull-cost">📜 ${EXCLUSIVE_GACHA_COST_SINGLE}</span>
          </button>
          <button class="gacha-pull-btn" onclick="performExclusivePull(10, ${excludeArg})">
            <span>Pull ×10</span>
            <span class="pull-cost">📜 ${EXCLUSIVE_GACHA_COST_TEN}</span>
          </button>
        </div>
        <button class="menu-btn menu-btn-secondary" style="margin-top:10px;" onclick="openGachaRates(true, ${excludeArg})">📊 Drop Rates</button>
      `;
      const btns = area.querySelectorAll('.gacha-pull-btn');
      btns[0].classList.toggle('disabled', playerContractScrolls < EXCLUSIVE_GACHA_COST_SINGLE);
      btns[1].classList.toggle('disabled', playerContractScrolls < EXCLUSIVE_GACHA_COST_TEN);
    }

    // --- Daily Shop ---
    // A separate, gold-only storefront from the Recruiter's Gacha: a fixed
    // DAILY_SHOP_SLOT_COUNT lineup of squad-fragment and Contract Scroll
    // bundles, priced steeply above what those items are otherwise "worth"
    // (Gold itself mostly comes from the Gacha) since this is meant as a
    // premium, guaranteed way to round out what RNG hasn't given you - not
    // a replacement for pulling. Every slot is a ONE-TIME purchase: once
    // bought it's marked sold and can't be bought again until the whole
    // lineup rerolls the next real-world day.
    const DAILY_SHOP_SLOT_COUNT = 10;
    const DAILY_SHOP_FRAGMENT_PRICE_PER_UNIT = 60;
    const DAILY_SHOP_SCROLL_PRICE_PER_UNIT = 40;

    let dailyShopDate = localStorage.getItem('bt_dailyShopDate') || '';
    let dailyShopStock = [];
    try {
      dailyShopStock = JSON.parse(localStorage.getItem('bt_dailyShopStock')) || [];
    } catch (e) { dailyShopStock = []; }
    let dailyShopPurchased = [];
    try {
      dailyShopPurchased = JSON.parse(localStorage.getItem('bt_dailyShopPurchased')) || [];
    } catch (e) { dailyShopPurchased = []; }

    function saveDailyShopState() {
      localStorage.setItem('bt_dailyShopDate', dailyShopDate);
      localStorage.setItem('bt_dailyShopStock', JSON.stringify(dailyShopStock));
      localStorage.setItem('bt_dailyShopPurchased', JSON.stringify(dailyShopPurchased));
    }

    function generateDailyShopStock() {
      const stock = [];
      for (let i = 0; i < DAILY_SHOP_SLOT_COUNT; i++) {
        if (Math.random() < 0.55) {
          const def = CLASS_DEFS[Math.floor(Math.random() * CLASS_DEFS.length)];
          const amount = 3 + Math.floor(Math.random() * 4); // 3-6 fragments
          stock.push({ kind: 'fragment', type: def.type, amount, price: amount * DAILY_SHOP_FRAGMENT_PRICE_PER_UNIT });
        } else {
          const amount = 5 + Math.floor(Math.random() * 6); // 5-10 scrolls
          stock.push({ kind: 'scrolls', amount, price: amount * DAILY_SHOP_SCROLL_PRICE_PER_UNIT });
        }
      }
      return stock;
    }

    // Rerolls the whole lineup (and clears every sold-out mark) the first
    // time the panel is opened on a new real-world calendar day.
    function ensureDailyShopStock() {
      const today = new Date().toDateString();
      if (dailyShopDate !== today || dailyShopStock.length !== DAILY_SHOP_SLOT_COUNT) {
        dailyShopDate = today;
        dailyShopStock = generateDailyShopStock();
        dailyShopPurchased = new Array(DAILY_SHOP_SLOT_COUNT).fill(false);
        saveDailyShopState();
      }
    }

    // Restock countdown - ticks down to the next real-world local midnight,
    // which is the same boundary ensureDailyShopStock() checks against
    // (dailyShopDate !== today) to reroll the lineup. Only runs while the
    // Daily Shop panel is actually open (started/stopped from
    // showMenuPanel) so it isn't ticking in the background for no reason.
    let dailyShopTimerInterval = null;

    function formatDailyShopCountdown(ms) {
      const totalSec = Math.max(0, Math.floor(ms / 1000));
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function updateDailyShopTimerDisplay() {
      const textEl = document.getElementById('daily-shop-timer-text');
      const pillEl = document.getElementById('daily-shop-timer');
      if (!textEl || !pillEl) return;

      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      const msLeft = nextMidnight - now;

      textEl.textContent = formatDailyShopCountdown(msLeft);
      pillEl.classList.toggle('urgent', msLeft <= 5 * 60 * 1000);

      // Countdown hit zero while the panel was sitting open - reroll the
      // lineup immediately instead of waiting for the player to leave and
      // reopen the panel to trigger ensureDailyShopStock().
      if (msLeft <= 0) renderDailyShopPanel();
    }

    function startDailyShopTimer() {
      stopDailyShopTimer();
      updateDailyShopTimerDisplay();
      dailyShopTimerInterval = setInterval(updateDailyShopTimerDisplay, 1000);
    }

    function stopDailyShopTimer() {
      if (dailyShopTimerInterval) {
        clearInterval(dailyShopTimerInterval);
        dailyShopTimerInterval = null;
      }
    }

    function renderDailyShopPanel() {
      ensureDailyShopStock();
      document.getElementById('daily-shop-gold-amount').textContent = playerGold;

      const list = document.getElementById('daily-shop-list');
      list.innerHTML = '';

      dailyShopStock.forEach((item, i) => {
        const sold = !!dailyShopPurchased[i];
        const canAfford = !sold && playerGold >= item.price;

        const card = document.createElement('div');
        card.className = 'daily-shop-card' + (sold ? ' sold-out' : '');

        const icon = document.createElement('div');
        icon.className = 'daily-shop-icon';
        let name;
        if (item.kind === 'fragment') {
          const def = squadDef(item.type);
          icon.style.background = classColorCss(item.type);
          icon.innerHTML = iconHtml(def);
          name = `${item.amount} ${def.label} Fragments`;
        } else {
          icon.style.background = '#8a5a1f';
          icon.textContent = '📜';
          name = `${item.amount} Contract Scrolls`;
        }
        card.appendChild(icon);

        const body = document.createElement('div');
        body.className = 'daily-shop-body';
        body.innerHTML = `
          <div class="daily-shop-name">${name}</div>
          <div class="daily-shop-price">🪙 ${item.price}</div>
        `;
        card.appendChild(body);

        const btn = document.createElement('button');
        if (sold) {
          btn.className = 'daily-shop-buy-btn sold';
          btn.textContent = 'SOLD';
          btn.disabled = true;
        } else {
          btn.className = 'daily-shop-buy-btn' + (canAfford ? '' : ' disabled');
          btn.textContent = 'Buy';
          btn.onclick = () => buyDailyShopItem(i);
        }
        card.appendChild(btn);

        list.appendChild(card);
      });
    }

    function buyDailyShopItem(index) {
      const item = dailyShopStock[index];
      if (!item || dailyShopPurchased[index]) return;
      if (playerGold < item.price) return;

      playerGold -= item.price;
      if (item.kind === 'fragment') {
        playerSquadTokens[item.type] = (playerSquadTokens[item.type] || 0) + item.amount;
      } else {
        playerContractScrolls += item.amount;
      }
      dailyShopPurchased[index] = true;

      saveShopCurrencies();
      saveDailyShopState();
      renderDailyShopPanel();
    }

    // --- Event Shop ---
    // A fixed, always-in-stock storefront (unlike the Daily Shop above -
    // no restock timer, no one-per-day limit) that spends War Points, the
    // Event: Death & Life-only currency earned from kills during an
    // active Event run (see awardRaiderKillLoot). Reached from the Event:
    // Death & Life menu itself so it's just as available before a run as
    // mid-battle via Pause > Event: Death & Life > Event Shop.
    const EVENT_SHOP_ITEMS = [
      { kind: 'scrolls', amount: 1000, price: 50, icon: '📜', iconBg: '#8a5a1f', name: '1000 Contract Scrolls' },
      { kind: 'fragment', type: 'goddessOfDeath', amount: 1, price: 100, iconImage: EVENT_SHOP_DEATH_FRAGMENT_ICON_URI, iconBg: '#4a1030', name: 'Goddess of Death Fragment' },
      { kind: 'fragment', type: 'goddessOfLife', amount: 1, price: 100, iconImage: EVENT_SHOP_LIFE_FRAGMENT_ICON_URI, iconBg: '#2f5d8a', name: 'Goddess of Life Fragment' },
    ];

    function renderEventShopPanel() {
      const wpEl = document.getElementById('event-shop-warpoints-amount');
      if (wpEl) wpEl.textContent = playerWarPoints;

      const list = document.getElementById('event-shop-list');
      list.innerHTML = '';

      EVENT_SHOP_ITEMS.forEach((item, i) => {
        const canAfford = playerWarPoints >= item.price;

        const card = document.createElement('div');
        card.className = 'daily-shop-card';

        const icon = document.createElement('div');
        icon.className = 'daily-shop-icon';
        icon.style.background = item.iconBg;
        icon.innerHTML = item.iconImage ? `<img class="def-icon-img" src="${item.iconImage}" alt="${item.name}">` : item.icon;
        card.appendChild(icon);

        const body = document.createElement('div');
        body.className = 'daily-shop-body';
        body.innerHTML = `
          <div class="daily-shop-name">${item.name}</div>
          <div class="daily-shop-price">⚔️ ${item.price}</div>
        `;
        card.appendChild(body);

        const btn = document.createElement('button');
        btn.className = 'daily-shop-buy-btn' + (canAfford ? '' : ' disabled');
        btn.textContent = 'Buy';
        btn.onclick = () => buyEventShopItem(i);
        card.appendChild(btn);

        list.appendChild(card);
      });
    }

    function buyEventShopItem(index) {
      const item = EVENT_SHOP_ITEMS[index];
      if (!item || playerWarPoints < item.price) return;

      playerWarPoints -= item.price;
      if (item.kind === 'fragment') {
        playerSquadTokens[item.type] = (playerSquadTokens[item.type] || 0) + item.amount;
      } else {
        playerContractScrolls += item.amount;
      }

      saveShopCurrencies();
      renderEventShopPanel();
    }

    // --- The Recruiter's Gacha System ---
    // Pull ×1 costs GACHA_COST_SINGLE scrolls; Pull ×10 is discounted versus
    // ten single pulls. Each roll independently resolves to either a Gold
    // reward (random 100-1000) or a Squad recruit token for one of the
    // currently available squad types (CLASS_DEFS).
    const GACHA_COST_SINGLE = 20;
    const GACHA_COST_TEN = 100;

    // The Exclusive Squads Recruitment banners (Recruit Shop pages 2 and 3) use
    // the same Gold/Squad roll mechanic as The Recruiter's Gacha above, but
    // cost more and roll against a higher-floor pool (Epic through
    // Exclusive tier only, no Common/Rare) - see rollGachaReward and
    // performExclusivePull below.
    const EXCLUSIVE_GACHA_COST_SINGLE = 160;
    const EXCLUSIVE_GACHA_COST_TEN = 1000;

    // Rare-tier squads (Cavalry) are drawn far less often than Common-tier
    // ones, and Epic-tier squads (Ninja) rarer still - these weights only
    // apply within the 'squad' branch below, so they control the split
    // *among* squad types, not the gold/squad odds.
    // Legendary-tier squads (Dragon Ronin, Paladins) are rarer still than
    // Epic - only used within the 'squad' branch below, same as the other
    // weights. Exclusive-tier squads (Slasher, Steel Revenant) sit above
    // Legendary and are rarer still - excluded from The Recruiter's main
    // pool (Page 1) and only reachable through the Exclusive Squads
    // Recruitment banners (Page 2/3), which roll against the full pool
    // including them - see EXCLUSIVE_BANNER_TYPES/rollGachaReward below.
    const RARITY_PULL_WEIGHT = { common: 20, rare: 6, epic: 2, legendary: 1, exclusive: 0.4 };

    // Shared low-to-high tier ordering, used to sort the Drop Rates modal
    // (Common -> Exclusive) and to find the best rarity in a set of pull
    // results for the Gacha Summon Animation (see playSummonAnimation).
    const RARITY_SORT_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, exclusive: 4 };

    // Squad types excluded from The Recruiter's main Gacha pool (Page 1)
    // because they're only obtainable from the Exclusive Squads
    // Recruitment banners on Pages 2 and 3. Two of these are featured at a
    // time (one per banner), picked at random and re-rolled every 7 days
    // (see getFeaturedExclusiveTypes below). Each banner rolls against the
    // full CLASS_DEFS pool (including these types) via
    // rollGachaReward(true, ...) - see performExclusivePull below. Add a
    // new type here to fold it into the random rotation - no extra page
    // needed.
    const EXCLUSIVE_BANNER_TYPES = ['slasher', 'steelRevenant', 'goddessOfDeath', 'goddessOfLife', 'kitsuneTwinblade'];

    // How many Exclusive Squads Recruitment banners are shown at once
    // (Pages 2 and 3). Each shows a different Exclusive squad.
    const EXCLUSIVE_BANNER_SLOTS = 2;

    // Display name + flavor line for each Exclusive-tier squad, shown on
    // its banner whenever that squad is one of the two featured.
    const EXCLUSIVE_BANNER_INFO = {
      slasher: { name: 'Slasher', line: '"Let\'s just respect what or who deserves respect. Respect the Gods."' },
      steelRevenant: { name: 'Steel Revenant', line: '"It doesn\'t march with an army. It doesn\'t need one."' },
      goddessOfDeath: { name: 'Goddess of Death', line: '"Every ending is a rule. I only keep it."' },
      goddessOfLife: { name: 'Goddess of Life', line: '"Rest now. The moon keeps watch over every breath."' },
      kitsuneTwinblade: { name: 'Kitsune Twinblade', line: '"Guard my back. I\'ll guard the kill."' }
    };

    // One fixed reference Sunday (start of a UTC week) that the rotation
    // counts forward from, so which squads are featured only depends on
    // the real-world date - not on session state, load order, or how many
    // times the panel has been opened. Every player sees the same pair
    // featured in the same real-world week.
    const EXCLUSIVE_BANNER_ROTATION_EPOCH = Date.UTC(2024, 0, 7); // a Sunday
    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

    // Small seeded PRNG (mulberry32) so a given week always rolls the same
    // "random" lineup no matter how often the panel is reopened or the page
    // is reloaded, instead of re-rolling on every open.
    function exclusiveBannerRng(seed) {
      let a = (seed * 2654435761) >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    // Every way to choose k items out of list (order ignored).
    function exclusiveBannerCombos(list, k) {
      if (k === 0) return [[]];
      const out = [];
      list.forEach((item, i) => {
        exclusiveBannerCombos(list.slice(i + 1), k - 1).forEach(rest => out.push([item, ...rest]));
      });
      return out;
    }

    let exclusiveBannerCache = { week: null, types: null };

    // Picks the Exclusive-tier squads featured on Pages 2 and 3 right now:
    // EXCLUSIVE_BANNER_SLOTS different types out of EXCLUSIVE_BANNER_TYPES,
    // chosen at random and re-rolled every 7 real-world days. The roll is
    // seeded by the week number (so it's stable all week) and always
    // differs from the previous week's lineup, so a new week never looks
    // like nothing changed. Which banner (Page 2 vs 3) gets which squad is
    // shuffled too.
    function getFeaturedExclusiveTypes() {
      const week = Math.floor((Date.now() - EXCLUSIVE_BANNER_ROTATION_EPOCH) / MS_PER_WEEK);
      if (exclusiveBannerCache.week === week) return exclusiveBannerCache.types.slice();

      const slots = Math.min(EXCLUSIVE_BANNER_SLOTS, EXCLUSIVE_BANNER_TYPES.length);
      const lineups = exclusiveBannerCombos(EXCLUSIVE_BANNER_TYPES, slots);

      // Walk forward from the epoch so "different from last week" holds
      // without needing to store anything.
      let prevKey = null;
      let current = lineups[0];
      for (let w = 0; w <= Math.max(0, week); w++) {
        let options = lineups.filter(l => l.join() !== prevKey);
        if (!options.length) options = lineups;
        current = options[Math.floor(exclusiveBannerRng(w + 1)() * options.length)];
        prevKey = current.join();
      }

      // Seeded Fisher-Yates so the two banners swap places at random too.
      const order = current.slice();
      const rng = exclusiveBannerRng(Math.max(0, week) + 1000003);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }

      exclusiveBannerCache = { week, types: order };
      return order.slice();
    }

    // Countdown to the next weekly rotation (see
    // EXCLUSIVE_BANNER_ROTATION_EPOCH/MS_PER_WEEK above) - the moment
    // getFeaturedExclusiveTypes() swaps in a new pair of squads. Computed
    // independently of exclusiveBannerCache so it stays correct even if
    // the cache hasn't been touched yet this session.
    function msUntilNextExclusiveBannerRotation() {
      const week = Math.floor((Date.now() - EXCLUSIVE_BANNER_ROTATION_EPOCH) / MS_PER_WEEK);
      const nextBoundary = EXCLUSIVE_BANNER_ROTATION_EPOCH + (week + 1) * MS_PER_WEEK;
      return nextBoundary - Date.now();
    }

    function formatExclusiveBannerCountdown(ms) {
      const totalSec = Math.max(0, Math.floor(ms / 1000));
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      // Days left in the week: no need for second-level precision, so show
      // "Xd YYh" and only drop to a live HH:MM:SS readout once under a day.
      if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    let exclusiveBannerTimerInterval = null;

    function updateExclusiveBannerTimerDisplay() {
      const msLeft = msUntilNextExclusiveBannerRotation();
      const text = formatExclusiveBannerCountdown(msLeft);
      const urgent = msLeft <= 60 * 60 * 1000; // last hour before the swap

      for (let slot = 1; slot <= EXCLUSIVE_BANNER_SLOTS; slot++) {
        const pillEl = document.getElementById('exclusive-banner-timer-' + slot);
        if (!pillEl) continue;
        const textEl = pillEl.querySelector('.exclusive-banner-timer-text');
        if (textEl) textEl.textContent = text;
        pillEl.classList.toggle('urgent', urgent);
      }

      // Rotation boundary passed while the panel was sitting open - refresh
      // the banners immediately instead of waiting for the player to leave
      // and reopen Recruit Shop to pick up the new featured squads.
      if (msLeft <= 0) renderRecruitShopPanel();
    }

    function startExclusiveBannerTimer() {
      stopExclusiveBannerTimer();
      updateExclusiveBannerTimerDisplay();
      exclusiveBannerTimerInterval = setInterval(updateExclusiveBannerTimerDisplay, 1000);
    }

    function stopExclusiveBannerTimer() {
      if (exclusiveBannerTimerInterval) {
        clearInterval(exclusiveBannerTimerInterval);
        exclusiveBannerTimerInterval = null;
      }
    }

    // Shared rarity -> display label lookup, used everywhere a squad's
    // rarity badge/text is rendered (Manage Squad tray, Squad Detail,
    // Recruit Shop collection row, Squad Info panel).
    function squadRarityLabel(rarity) {
      return rarity === 'exclusive' ? 'Exclusive' : rarity === 'legendary' ? 'Legendary' : rarity === 'epic' ? 'Epic' : rarity === 'rare' ? 'Rare' : 'Common';
    }

    // includeExclusives=false (The Recruiter's main Gacha, Page 1) rolls
    // against every squad type except Slasher/Steel Revenant.
    // includeExclusives=true (either Exclusive Squads Recruitment banner,
    // Page 2/3) rolls only against Epic/Legendary/Exclusive-tier squads -
    // Common and Rare are excluded from this pool entirely - same 50% Gold
    // / 50% weighted-squad shape either way, just a different pool feeding
    // the weighted pick. excludeType additionally drops one specific type
    // out of that pool - used so Slasher's banner never hands out Steel
    // Revenant (see performExclusivePull/renderExclusiveBannerArea).

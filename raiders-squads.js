    function goddessOfLifeDeath(unit, attackerWorldPos) {
      const u = unit.userData;
      u.hp = 0;
      const pos = new THREE.Vector3();
      unit.getWorldPosition(pos);

      if (u.hpElement) u.hpElement.remove();
      spawnGoLifePetals(pos, 46, 0.6);
      spawnGoLifeRing(pos, 0.2, 0.5, 2.0, 0.8, 0.6, 0xbfe6ff);
      spawnFloatingText(pos.clone().add(new THREE.Vector3(0, 1.0, 0)), 'The Goddess of Life fades...', '#bfe6ff');

      if (isEnemyUnit(unit)) {
        raiderSquads.forEach(sq => {
          const idx = sq.members.indexOf(unit);
          if (idx !== -1) sq.members.splice(idx, 1);
        });
        updateWaveUI();
      } else {
        squads.forEach(sq => {
          const idx = sq.members.indexOf(unit);
          if (idx !== -1) sq.members.splice(idx, 1);
        });
        militiaSquads.forEach(sq => {
          const idx = sq.members.indexOf(unit);
          if (idx !== -1) sq.members.splice(idx, 1);
        });
        updateSquadCountUI();
      }
      if (unit.parent) unit.parent.remove(unit);
    }

    // --- 8. SQUAD SETUP & INITIALIZATION ---
    const CLASS_DEFS = [
      { type: 'swords',  icon: '⚔️', label: 'Swords',  color: 0x2266bb, baseDmg: 22, rarity: 'common', desc: 'Shield-carrying melee line. Blocks frontal hits, including arrows. Passive: Shield Bash - a blocked melee hit gets bashed back with retaliation damage and a stagger.',
        passives: [
          { name: 'Shield Bash', trigger: 'Blocks a frontal hit (melee or arrow)', effect: 'Bashes back with retaliation damage and a stagger' },
        ] },
      { type: 'pikes',   icon: '🍢', label: 'Pikes',   color: 0xcc7a22, baseDmg: 22, rarity: 'common', desc: 'Braces into a death-wall when standing still - massive counter damage. Passive: Fortitude - taking a hit reduces damage taken by 30% for the next 3 seconds.',
        passives: [
          { name: 'Fortitude', trigger: 'Takes a hit', effect: 'Damage taken is reduced 30% for the next 3 seconds' },
        ] },
      { type: 'archers', icon: '🏹', label: 'Archers', color: 0x2e9e4f, baseDmg: 28, rarity: 'common', desc: 'Ranged skirmishers that soften enemies with arrows from afar. Passive: Piercing Shot - arrows ignore shield blocks and Fortitude, always landing full damage.',
        passives: [
          { name: 'Piercing Shot', trigger: 'Every arrow it fires', effect: 'Ignores shield blocks and Fortitude - always lands full damage' },
        ] },
      { type: 'mages',   icon: '🔮', label: 'Mages',   color: 0x8a3fc9, baseDmg: 45, rarity: 'common', desc: 'Slow-casting ranged bombardment with the heaviest hit per shot. Passive: Magic Missile - 5% chance per cast to rapid-fire 2 extra bolts at the target.',
        passives: [
          { name: 'Magic Missile', trigger: '5% chance on each cast', effect: 'Rapid-fires 2 extra bolts at the target' },
        ] },
      // Common-tier, but see startsLocked below: like Militia/Desert
      // Warriors above, it does NOT start unlocked - it has to be pulled
      // from the Gacha at least once first, same unlock flow as
      // Cavalry/Ninja just at Common pull odds.
      { type: 'doctor', icon: '⚕️', label: 'Doctor', color: 0xf2f2f2, baseDmg: 0, rarity: 'common', startsLocked: true, desc: 'A support squad that carries no weapon and never attacks. Each Doctor rushes to whichever wounded ally needs it most and heals them, and periodically has a chance to revive a fallen ally back into its squad - a zombie-reanimated ally can never be revived this way. Passive: Field Medic - periodically heals the most wounded ally in range. Passive: Resurrection - periodically, a chance to revive one fallen ally, excluding any zombie-reanimated unit. Passive: Retreat - having no attack of its own, taking a hit sends it stepping back a full tile instead of just reeling from the blow.',
        passives: [
          { name: 'Field Medic', trigger: 'Periodic, while a wounded ally is in range', effect: 'Heals the most wounded ally in range - the Doctor never attacks' },
          { name: 'Resurrection', trigger: 'Periodic chance while any ally is down', effect: 'Chance to revive one fallen ally back into its squad - a zombie-reanimated ally can never be revived' },
          { name: 'Retreat', trigger: 'Takes a hit', effect: 'Steps back a full tile away from whoever hit it, instead of just staggering in place' },
        ] },
      { type: 'cavalry', icon: '🐎', label: 'Cavalry', color: 0x7a4a2a, baseDmg: 22, rarity: 'rare', desc: 'Mounted riders - each one randomly wields a Sword, Spear, or Bow. Passive varies by weapon: Sword inflicts Bleeding on hit, Spear has a 10% chance to Charge for a knockback or an instant kill, and Bow fires a Volley of extra arrows with every shot.',
        passives: [
          { name: 'Bleeding (Sword riders)', trigger: 'Rider is Sword-armed and lands a hit', effect: 'Target bleeds, taking damage over time' },
          { name: 'Charge (Spear riders)', trigger: 'Rider is Spear-armed - 10% chance per hit', effect: 'Knocks the target back, or scores an instant kill' },
          { name: 'Volley (Bow riders)', trigger: 'Rider is Bow-armed, every shot', effect: 'Fires extra arrows in a volley' },
        ] },
      // Rare tier: a heavier ranged line than Archers - a slow reload
      // (long attackCooldown, see processUnitAttack's crossbow branch)
      // trades off against much higher per-bolt damage. Shares the
      // Archer's exact Piercing Shot passive (see isPiercingShot) but
      // fires its own 'bolt' projectile type instead of an 'arrow' so the
      // two never get confused for damage/animation purposes.
      { type: 'crossbow', icon: '🏹', label: 'Crossbow', color: 0x5a5f66, baseDmg: 50, rarity: 'rare', desc: 'Heavy ranged line armed with steel-prod crossbows - a slow reload between shots, but each bolt hits far harder than an Archer\'s arrow. Passive: Piercing Shot - bolts ignore shield blocks and Fortitude, always landing full damage.',
        passives: [
          { name: 'Piercing Shot', trigger: 'Every bolt it fires', effect: 'Ignores shield blocks and Fortitude - always lands full damage' },
        ] },
      // Rare tier melee line - a shirtless, fur-pelted warrior swinging a
      // two-headed Double Axe (see createDoubleAxe/createBerserkerHumanoid).
      // Passive: Rage - see BERSERKER_RAGE_HP_THRESHOLD/isBerserkerRaging
      // in processUnitAttack.
      { type: 'berserker', icon: '🪓', label: 'Berserker', color: 0x6b6b6b, baseDmg: 32, rarity: 'rare', desc: 'Shirtless melee brawler in a wolf or bear pelt helmet, shoulders wrapped in fur pauldrons, swinging a heavy Double Axe with both hands. Passive: Rage - once its HP drops to 30% or below, its attacks come out dramatically faster.',
        passives: [
          { name: 'Rage', trigger: 'HP drops to 30% or below', effect: 'Attack cooldown is slashed way down - swings roughly 3x faster for as long as it stays below the threshold' },
        ] },
      // Rare tier feral swarm unit - a hunched, clawed undead creature
      // styled after Warcraft 3's Ghoul (see createGhoulHumanoid). Fights
      // bare-clawed with no weapon, swings fast and cheap rather than
      // hard. Passive: Cannibalize - see GHOUL_CANNIBALIZE_HEAL_PCT/
      // triggerGhoulCannibalize in applyDamage's death handling.
      { type: 'ghoul', icon: '🧟', label: 'Ghoul', color: 0x6b7a5e, baseDmg: 20, rarity: 'rare', desc: 'A hunched, feral undead creature with rotting gray-green flesh and clawed hands, fighting bare-handed rather than with any weapon. Fast, cheap, and aggressive - it does not remember what it was, only that it is hungry. Passive: Cannibalize - landing a killing blow heals it for a portion of its own missing HP.',
        passives: [
          { name: 'Cannibalize', trigger: 'Its attack lands a killing blow', effect: 'Heals a portion of its own missing HP' },
        ] },
      // Rare tier support squad - carries no weapon and never fights (see
      // the 'siege' early-return in processUnitAttack, same shape as the
      // Doctor's). Its ability is handled entirely in its own pass,
      // updateSiegeEngineerSupport, called at the start of every wave -
      // see maybeStartWatchTowerBuild.
      { type: 'siege', icon: '🏗️', label: 'Siege Engineer', color: 0x8a7355, baseDmg: 0, rarity: 'rare', desc: 'A support squad that carries no weapon and never attacks. Whenever it isn\'t already busy, it spends 10 seconds building a Watch Tower right where it\'s stationed - a defensive structure with 500 HP that fires at any raider warband that wanders close. Field more than one Siege Engineer squad and each idle one builds and operates its own tower at the same time. Up to 4 towers total can be built over a run. Passive: Watchtower Construction - build a Watch Tower whenever idle. Passive: Barricade - having no attack of its own, taking a hit drops a wooden barricade on the spot, ducks down completely out of sight behind it, and is fully immune to further damage for a few seconds.',
        passives: [
          { name: 'Watchtower Construction', trigger: 'A new wave starts and this squad isn\'t already building or operating a tower', effect: 'Spends 10 seconds building one on the spot - 500 HP, fires at nearby raiders. Each Siege Engineer squad can run its own tower; up to 4 total per run' },
          { name: 'Barricade', trigger: 'Takes a hit', effect: 'Plants a wooden barricade and hides behind it, untargetable and fully immune to damage for a few seconds' },
        ] },
      { type: 'ninja',   icon: '🥷', label: 'Ninja',   color: 0x2b2b30, baseDmg: 24, rarity: 'epic', desc: 'Fades near-invisible and goes untargetable when standing still by a tree or bush, as long as another target is available. Passive: Smoke Bomb - below 10% HP, every hit it takes has a 40% chance to drop a Smoke Bomb and vanish outright for several seconds, fully hidden and untouchable.',
        passives: [
          { name: 'Shadow Fade', trigger: 'Standing still near a tree/bush, while another target is available', effect: 'Turns near-invisible and untargetable' },
          { name: 'Smoke Bomb', trigger: 'Below 10% HP - 40% chance on each hit taken', effect: 'Drops a smoke bomb and vanishes, fully hidden and untouchable for several seconds' },
        ] },
      // Common-tier, but see startsLocked below: unlike the other three
      // Commons it does NOT start unlocked - it has to be pulled from the
      // Gacha at least once first, same unlock flow as Cavalry/Ninja just
      // at Common pull odds. Deliberately plain: reuses the Villager
      // Militia's own look and randomized per-unit loadout (see equipUnit's
      // 'militia' branch) and carries no passives array/ability at all -
      // just a steady, no-frills filler line unit.
      { type: 'militia', icon: '🛡️', label: 'Militia', color: 0x556b2f, baseDmg: 20, rarity: 'common', startsLocked: true, desc: 'Irregular defenders raised from the villagers, identical to the Villager Militia that rallies around a Barracks - each one randomly wields a Sword & Shield, Spear, or Bow, and some ride out on horseback. No passive ability - a plain, reliable line unit.',
        passives: [] },
      // Common-tier, startsLocked like Militia above - pulled from the Gacha
      // at Common odds. Shares Militia's exact per-unit random loadout
      // (Sword & Shield / Spear / Bow, see equipUnit's shared 'militia' ||
      // 'skeletonWarriors' branch) but reuses the bone-white Skeleton
      // raider look from the Shadow Island biome (see createBlockyHumanoid's
      // isSkeleton flag, wired up in createSquadMemberVisual) instead of a
      // living villager. No passive ability, same as Militia - just a
      // plain, reliable line unit with a different skin.
      { type: 'skeletonWarriors', icon: '💀', label: 'Skeleton Warriors', color: 0xe3dac9, baseDmg: 20, rarity: 'common', startsLocked: true, desc: 'A line of animated bone warriors, the same bare bone-white Skeletons fielded by Raiders out of the Shadow Island - each one randomly wields a Sword & Shield, Spear, or Bow, same as Militia. No passive ability - a plain, reliable line unit.',
        passives: [] },
      // Common-tier, startsLocked like Militia above - pulled from the
      // Gacha at Common odds rather than starting available. A fixed
      // 2-melee/2-ranged formation rather than a per-unit random loadout:
      // slots 0-1 (front row) always carry a Scimitar & Shield, slots 2-3
      // (back row) always carry a Bow - see equipUnit's 'desertWarriors'
      // branch, which keys the loadout off memberIndex. Appearance is
      // randomized per-unit instead of a fixed squad color - each member
      // gets its own robe/pants outfit and keffiyeh-or-turban headwear
      // rolled from DESERT_WARRIOR_OUTFITS/DESERT_WARRIOR_HEADWEAR_COLORS
      // (see createSquad/respawnSquad), so a squad reads as a mixed band
      // of desert fighters rather than four identical clones. No passive
      // ability - like Militia, a plain, reliable line unit.
      { type: 'desertWarriors', icon: '🗡️', label: 'Desert Warriors', color: 0xcda06a, baseDmg: 22, rarity: 'common', startsLocked: true, desc: 'A desert-raised warband dressed in randomized Arabic robes and keffiyeh/turban headwear - two Scimitar-and-Shield fighters hold the front row while two archers cover them with bows from the back. No passive ability - a plain, reliable line unit.',
        passives: [] },
      // Legendary tier: a squad of just one, far stronger per-hit than any
      // 4-member squad, and the only type with memberCount 1 (see
      // createSquad/respawnSquad's use of def.memberCount). startsLocked
      // is set, so - same as any other non-Common squad - it stays locked
      // until pulled from The Recruiter's Gacha at its Legendary odds.
      // singleton: true means only one copy of it can ever be equipped
      // across the 4 squad slots at once - see renderManageSquadPanel's
      // tray filtering and attachPortraitDrag's drop handler.
      { type: 'dragonRonin', icon: '🐉', label: 'Dragon Ronin', color: 0x7a1020, baseDmg: 60, rarity: 'legendary', startsLocked: true, memberCount: 1, singleton: true,
        desc: 'A lone masterless swordsman fighting alone as its own single-member squad, wielding an oversized katana wreathed in flame, dressed in a wide wizard hat and flowing robes. Idles in one of three calm samurai stances - sword sheathed at the hip, a still meditative vigil, or playing a bamboo flute - a purely cosmetic touch. Fights like a shinobi out of Sekiro: parries blades out of the air in melee, deflects arrows from a distance, and cashes in a string of parries for an instant-kill deathblow.',
        passives: [
          { name: 'Dragon\'s Breath', trigger: 'Every landed katana hit', effect: 'Sets the target Burning, dealing extra fire damage over time' },
          { name: 'Deflect', trigger: 'Hit by an attack', effect: 'Guaranteed vs. ranged attacks while nothing is in melee range; a chance to parry incoming blade strikes outright in melee' },
          { name: 'Deathblow', trigger: 'After 3 successful parries', effect: 'The next swing flash-steps through the target for an instant kill, wreathed in dragon flame - same finisher as Sword Dash' },
        ] },
      // Legendary tier: a 3-member squad out of the desert - a towering
      // War Elephant (memberIndex 0, see equipUnit's 'warElephant' branch)
      // flanked by two Desert Warrior archers (memberIndex 1-2). The
      // archers' arrows are tagged poisonOnHit in spawnProjectile's call
      // site below and resolved by applyPoison/POISON_TICK_* (mirrors
      // Cavalry's Bleeding). The elephant's Charge & Stomp is a chance-
      // per-swing bonus hit gated on uData.elephantRole==='elephant' in
      // the melee damage branch, reusing the knockbackVel physics engine
      // (see WAR_ELEPHANT_STOMP_KNOCKBACK) the same way Steel Revenant's
      // Slam and Cavalry's Charge do.
      { type: 'warElephant', icon: '🐘', label: 'War Elephant', color: 0x9a7a4a, baseDmg: 34, rarity: 'legendary', startsLocked: true, memberCount: 3, singleton: true,
        desc: 'A three-strong legendary squad out of the desert dunes: a towering armored War Elephant flanked by two Desert Warriors carrying recurve bows. Passive: Venom Arrows - both archers coat their arrowheads in venom, so any arrow that lands also Poisons its target, dealing damage over time. Passive: Charge & Stomp - rather than trading blows in place, the elephant deliberately closes the distance on whatever it is fighting, then rears up and stomps its target for heavy damage with a hefty knockback that sends lesser raiders sprawling.',
        passives: [
          { name: 'Venom Arrows', trigger: 'Every arrow that lands from either Desert Warrior', effect: 'Poisons the target, dealing damage over time on top of the arrow\'s own hit' },
          { name: 'Charge & Stomp', trigger: 'Chance per swing once the elephant reaches melee range', effect: 'A heavy stomp that deals bonus damage and knocks its target back' },
        ] },
      // Exclusive tier: a 4-member squad of hooded assassins (see
      // memberCount) rather than the old lone-blade layout - sits one
      // tier above Legendary (see RARITY_PULL_WEIGHT/squadRarityLabel)
      // and is force-unlocked directly in the Squad Unlocking init above
      // rather than through The Recruiter's Gacha, befitting the rarer
      // tier. singleton: true still means only one Slasher squad can be
      // equipped across the 4 squad slots at once, same as Paladins.
      { type: 'slasher', icon: '🗡️', label: 'Slasher', color: 0x2b2b30, baseDmg: 50, rarity: 'exclusive', startsLocked: true, memberCount: 4, singleton: true, iconImage: 'data:image/png;base64,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',
        desc: 'A four-member squad of hooded assassins, each with a single red scar across its pale mask, armed with nothing but a dagger. Every landed strike is a guaranteed kill outright - no shield, no armor, no Fortitude stops it. Passive: Ghost Step - if nothing has yet closed to melee range of one, an incoming arrow, bolt, or spell is deflected aside in a flickering blur of dashing motion instead of landing, leaving the assassin untouched and right where it stood. Passive: Rooftop Ambush - perched up on a rooftop or boulder, a landed strike flash-steps the assassin straight down onto its target instead of swinging in place, catching it visibly off guard a beat before the killing blow lands, before it flash-steps right back up to its perch.',
        passives: [
          { name: 'Assassinate', trigger: 'Every landed dagger strike', effect: 'Guaranteed instant kill - bypasses shields and Fortitude entirely' },
          { name: 'Ghost Step', trigger: 'Hit by an incoming projectile with nothing yet in melee range', effect: 'Deflects the shot in place with a flickering dash animation instead of taking the hit - no damage, no repositioning' },
          { name: 'Rooftop Ambush', trigger: 'Landing a strike while perched on a rooftop/boulder', effect: 'Flash-steps down onto the target instead of striking in place, startling it before the killing blow lands, then flash-steps back up to its perch' },
        ] },
      // Legendary tier: a 3-member squad (see memberCount) rather than the
      // usual 4-man line - one Leader (slot 0, gold-armored, wields a
      // randomly-chosen Greatsword or Warhammer two-handed, no shield) plus
      // two Elite Swordsmen (slots 1-2, sword & shield, same passive
      // shield-blocking as a Swords unit). startsLocked is set, so like any
      // other non-Common squad it stays locked until pulled from The
      // Recruiter's Gacha at its Legendary odds - see the Squad Unlocking
      // init above.
      // singleton: true means only one copy of it can ever be equipped
      // across the 4 squad slots at once - see renderManageSquadPanel's
      // tray filtering and attachPortraitDrag's drop handler.
      { type: 'paladins', icon: '🛡️', label: 'Paladins', color: 0xf2c14e, baseDmg: 30, rarity: 'legendary', startsLocked: true, memberCount: 1, singleton: true,
        desc: 'A legendary lone Paladin - gold-armored, wielding a two-handed Greatsword or Warhammer. Far tankier than any other line unit, with a much larger health pool. Passive: Holy Light - periodically calls down a beam of holy light that heals the most wounded ally anywhere on the field for 50% of its max HP, while a second beam smites the nearest enemy for damage equal to 50% of its max HP. Passive: Light Shock - periodically unleashes a ring of holy energy around itself that deals AoE damage to every enemy caught within it.',
        passives: [
          { name: 'Holy Light', trigger: 'Periodic cast while alive', effect: 'Heals the most wounded ally anywhere on the field for 50% of its max HP, and smites the nearest enemy for damage equal to 50% of its max HP' },
          { name: 'Light Shock', trigger: 'Periodic cast while alive', effect: 'A ring of holy energy expands out from the Paladin, dealing AoE damage to every enemy caught within it' },
        ] },
      // Epic 4-member squad - full plate armor, sword & shield, and a
      // knight helmet on every member, same gear as a Paladin Elite
      // Swordsman but with no Leader in the formation - see equipUnit's
      // 'eliteSwordsmen' branch for the shared loadout.
      { type: 'eliteSwordsmen', icon: '⚜️', label: 'Elite Swordsmen', color: 0x4d6d8a, baseDmg: 26, rarity: 'epic', memberCount: 4,
        desc: 'A 4-member squad of heavily-armored Elite Swordsmen - full plate armor, sword and shield, same gear as the Paladins\' own Elite Swordsmen. Passive: Shield Bash - a blocked melee hit gets bashed back with retaliation damage and a stagger. Passive: Last Stand - dropping to 10% HP or below sharply increases defense for 5 seconds.',
        passives: [
          { name: 'Shield Bash', trigger: 'Blocks a frontal hit (melee or arrow)', effect: 'Bashes back with retaliation damage and a stagger' },
          { name: 'Last Stand', trigger: 'HP drops to 10% or below', effect: '40% less damage taken for 5 seconds' },
        ] },
      // Epic 4-member squad - the only player squad that flies rather than
      // walks (see the 'valkyrie' early-return block in updateUnitAnims
      // and the dive branch in applyAttackPose). Sword & shield, same base
      // loadout as an Elite Swordsman, but bare-headed with feathered
      // wings bolted onto the back (createValkyrieHumanoid) instead of a
      // knight helmet.
      { type: 'valkyrie', icon: '👼', label: 'Valkyrie', color: 0xf2c14e, baseDmg: 30, rarity: 'epic', memberCount: 4,
        desc: 'A 4-member squad of winged shieldmaidens that hover above the battlefield rather than marching with the rest of the roster, swooping down to land each strike before lifting back into the air. Passive: Sky Strike - a dive that lands on any ranged unit (Archers, Crossbow, Mages, Ninja, or a bow/acolyte-armed Cavalry, Militia, or Raider) is a guaranteed instant kill, plunging it out of the fight before it can loose another shot.',
        passives: [
          { name: 'Sky Strike', trigger: 'Every landed dive-attack on a ranged unit', effect: 'Guaranteed instant kill, bypassing shields and Fortitude entirely - same as Assassinate/Deathblow/Charge' },
        ] },
      // Epic 4-member squad - female desert warriors dressed the same as
      // the Desert Warriors' headwrap/robe silhouette, but each one
      // wields a bladed Chakram in each hand instead of a Scimitar &
      // Shield, plus a spare ring holstered on each hip (see equipUnit's
      // 'chakramDancers' branch). Every swing has the held chakram spin
      // rapidly on its own axis while the whole body pirouettes through
      // the strike - see applyAttackPose's 'chakramDancers' branch.
      { type: 'chakramDancers', icon: '💫', label: 'Chakram Dancers', color: 0xcc5f3a, baseDmg: 22, rarity: 'epic', memberCount: 4,
        desc: 'A 4-member squad of female desert warriors, veiled and robed like the Desert Warriors band, each fighting with a bladed Chakram in each hand - a spare ring holstered on each hip for the next throw. Every strike is a whirling dervish spin that sends both rings flashing around their own rims before landing the hit. Passive: Spinning Shield - every swing tops up a personal overshield equal to 5% of the dancer\'s max HP, absorbing incoming damage before it touches HP.',
        passives: [
          { name: 'Spinning Shield', trigger: 'Every swing', effect: 'Gains a shield equal to 5% of max HP (capped at 100% of max HP), which absorbs damage before HP' },
        ] },
      // Exclusive tier: a lone singleton unit (see memberCount), the same
      // shape as the Legendary Dragon Ronin but a rung above it in
      // rarity/pull odds (see RARITY_PULL_WEIGHT/squadRarityLabel) -
      // reuses the same faceless, crowned T-visor helm and brutalist
      // trapezoid/shard plate armor (see createBlockyHumanoid's
      // isSteelRevenant branch) and massive two-handed flanged Revenant Mace
      // this unit always carried. startsLocked is set, so like any other
      // non-Common squad it stays locked until pulled from The
      // Recruiter's Gacha at its Exclusive odds - see the Squad Unlocking
      // init above. singleton: true means only one copy of it can ever
      // be equipped across the 4 squad slots at once, same as Dragon
      // Ronin/Paladins/Slasher.
      // Legendary tier: a lone singleton spellcaster (see memberCount) in
      // the mold of Warcraft III's Lich - reuses createBlockyHumanoid's
      // isSkeleton silhouette (the same bone-white reskin the raider
      // Skeleton Warriors wear) under a navy/icy robe with a high
      // vampire-style popped collar (isLich, see
      // createBlockyHumanoid), but fights entirely at range: it carries
      // no weapon mesh at all (see equipUnit's 'lich' branch), conjuring
      // Frostbolts (spawnProjectile's 'frostbolt' type) straight out of
      // its raised bare hand, and never takes bleed damage or shows
      // blood on a hit (see the isSkeleton checks in
      // createBloodSplatter/applyDamage's hit-effect branch).
      // startsLocked is set, so like any other non-Common squad it stays
      // locked until pulled from The Recruiter's Gacha at its Legendary
      // odds - same as Dragon Ronin, rather than through either
      // Exclusive Squads Recruitment banner (it is deliberately left out
      // of EXCLUSIVE_BANNER_TYPES below). singleton: true means only one
      // Lich squad can ever be equipped across the 4 squad slots at
      // once, same as Dragon Ronin/Slasher/Steel Revenant.
      { type: 'lich', icon: '❄️', label: 'Lich', color: 0x3d6fa8, baseDmg: 38, rarity: 'legendary', startsLocked: true, memberCount: 1, singleton: true,
        // Custom portrait (iconHtml prefers iconImage over the plain
        // emoji icon above whenever it's set - see iconHtml) rather
        // than a generic emoji: a small inline SVG bust matching the
        // in-game model's own look - the bone-white skull, glowing icy
        // eye sockets, navy popped collar (createVampireCollar) and
        // icy-spiked crown (createLichCrown) all drawn to echo the
        // actual 3D silhouette instead of standing in for it.
        iconImage: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+CiAgPGRlZnM+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9ImJnIiBjeD0iNTAlIiBjeT0iNDAlIiByPSI3MCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjM2Q2ZmE4Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzE0MjAzYSIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iOCIgZmlsbD0idXJsKCNiZykiLz4KCiAgPCEtLSBjb2xsYXIgd2luZ3MgLS0+CiAgPHBvbHlnb24gcG9pbnRzPSIxNCw0NiAyMiwzMCAyNiw0NCAxOCw1MCIgZmlsbD0iIzFjMjQzOCIgc3Ryb2tlPSIjN2ZlOGZmIiBzdHJva2Utd2lkdGg9IjEiLz4KICA8cG9seWdvbiBwb2ludHM9IjUwLDQ2IDQyLDMwIDM4LDQ0IDQ2LDUwIiBmaWxsPSIjMWMyNDM4IiBzdHJva2U9IiM3ZmU4ZmYiIHN0cm9rZS13aWR0aD0iMSIvPgoKICA8IS0tIHNrdWxsIC0tPgogIDxlbGxpcHNlIGN4PSIzMiIgY3k9IjM0IiByeD0iMTIiIHJ5PSIxMyIgZmlsbD0iI2UzZGFjOSIvPgogIDxyZWN0IHg9IjI0IiB5PSI0MCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjgiIHJ4PSIyIiBmaWxsPSIjZTNkYWM5Ii8+CgogIDwhLS0gZXllIHNvY2tldHMgZ2xvd2luZyAtLT4KICA8ZWxsaXBzZSBjeD0iMjciIGN5PSIzMyIgcng9IjMiIHJ5PSIzLjYiIGZpbGw9IiMwYTE2MjIiLz4KICA8ZWxsaXBzZSBjeD0iMzciIGN5PSIzMyIgcng9IjMiIHJ5PSIzLjYiIGZpbGw9IiMwYTE2MjIiLz4KICA8Y2lyY2xlIGN4PSIyNyIgY3k9IjMzIiByPSIxLjQiIGZpbGw9IiNhZWYyZmYiLz4KICA8Y2lyY2xlIGN4PSIzNyIgY3k9IjMzIiByPSIxLjQiIGZpbGw9IiNhZWYyZmYiLz4KCiAgPCEtLSBuYXNhbCBjYXZpdHkgLS0+CiAgPHBvbHlnb24gcG9pbnRzPSIzMiwzNiAzMCw0MCAzNCw0MCIgZmlsbD0iIzBhMTYyMiIvPgoKICA8IS0tIHRlZXRoIC0tPgogIDxyZWN0IHg9IjI2IiB5PSI0MyIgd2lkdGg9IjIuNSIgaGVpZ2h0PSI0IiBmaWxsPSIjMGExNjIyIi8+CiAgPHJlY3QgeD0iMzAiIHk9IjQzIiB3aWR0aD0iMi41IiBoZWlnaHQ9IjQiIGZpbGw9IiMwYTE2MjIiLz4KICA8cmVjdCB4PSIzNCIgeT0iNDMiIHdpZHRoPSIyLjUiIGhlaWdodD0iNCIgZmlsbD0iIzBhMTYyMiIvPgoKICA8IS0tIGNyb3duIGJhbmQgLS0+CiAgPHJlY3QgeD0iMTkiIHk9IjIxIiB3aWR0aD0iMjYiIGhlaWdodD0iNCIgcng9IjEiIGZpbGw9IiMzYTQ0NTIiLz4KICA8IS0tIGNyb3duIHNwaWtlcyAtLT4KICA8cG9seWdvbiBwb2ludHM9IjMyLDggMzYsMjIgMjgsMjIiIGZpbGw9IiNhZWYyZmYiLz4KICA8cG9seWdvbiBwb2ludHM9IjIxLDE0IDI1LDIzIDE4LDIzIiBmaWxsPSIjYWVmMmZmIi8+CiAgPHBvbHlnb24gcG9pbnRzPSI0MywxNCA0NiwyMyAzOSwyMyIgZmlsbD0iI2FlZjJmZiIvPgo8L3N2Zz4K',
        desc: 'A legendary singleton squad: a gaunt, bone-pale undead sorcerer robed in tattered dark navy, conjuring Frostbolts straight out of its raised bare hand rather than carrying any weapon, fighting from range instead of closing to melee. Passive: Frost Nova - periodically detonates a ring of freezing energy centered on itself, damaging every enemy caught within it. Passive: Death Coil - periodically fires a bolt of necrotic energy at the nearest enemy in range, damaging it and healing the most wounded ally on the field for the same amount. Passive: Frost Armor - a permanent chill radiating off it reduces all damage it takes.',
        passives: [
          { name: 'Frost Nova', trigger: 'Periodic cast while alive', effect: 'A ring of freezing energy expands out from the Lich, dealing AoE damage to every enemy caught within it' },
          { name: 'Death Coil', trigger: 'Periodic cast while alive', effect: 'Fires a bolt of necrotic energy at the nearest enemy in range for damage, and heals the most wounded ally on the field for the same amount' },
          { name: 'Frost Armor', trigger: 'Passive', effect: 'Takes reduced damage from every hit' },
        ] },
      { type: 'steelRevenant', icon: '🗿', label: 'Steel Revenant', color: 0x101114, baseDmg: 55, rarity: 'exclusive', startsLocked: true, memberCount: 1, singleton: true,
        iconImage: 'data:image/png;base64,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',
        desc: 'An exclusive singleton squad: a towering, ghost-pale iron horror that fights completely alone, sealed behind a faceless, crowned T-visor helm and brutalist trapezoid-and-shard plate armor, wielding a massive two-handed flanged Revenant Mace studded with four heavy spikes. Moves more slowly than any other squad, but carries a towering HP pool and hits devastatingly hard. Passive: Colossus - a flat HP pool built to stand in for an entire squad on its own. Passive: Death Slam - some swings are a heavy, forward-facing mace slam that crushes every enemy caught in a rectangle ahead of it for 80% damage, not just the one it swung at, marked by a teal zone flash and a fading ghost of the mace. Passive: Steel Grasp - some swings instead flare its off hand with spectral claw-energy and punch a clawed hand of the same energy up under every enemy caught in a rectangle ahead of it, dealing 40% damage and yanking them back toward it instead of knocking them away. Passive: Unbreakable - once its HP falls to 20% or below, every hit has a 20% chance to instantly heal it for 80% of its max HP, its left hand pressed glowing against its own chest as the armor knits itself back together.',
        passives: [
          { name: 'Colossus', trigger: 'Passive', effect: 'A towering HP pool, built to stand in for an entire squad on its own. Moves more slowly than any other squad, but hits hard.' },
          { name: 'Death Slam', trigger: 'Chance per swing', effect: 'A heavy two-handed slam that hits every enemy in a rectangle directly in front of it for 80% damage instead of a single target, with a knockback on each one hit, a teal rectangular zone flash marking the impact area, and a fading spectral ghost of the mace left hanging where it struck.' },
          { name: 'Steel Grasp', trigger: 'Chance per swing', effect: 'Its off hand flares with spectral claw-energy and a clawed hand of the same energy punches up under every enemy in a rectangle ahead of it, dealing 40% damage, pulling them back toward it and stunning them briefly instead of dealing a normal hit.' },
          { name: 'Unbreakable', trigger: '20% chance per hit at ≤20% HP', effect: 'Its left hand presses glowing against its own chest and it instantly heals for 80% of its max HP, the armor knitting itself back together with spectral energy.' },
        ] },
      // Exclusive tier: a lone Goddess of Death (see the GODDESS_* block above),
      // appearance inspired by Ronova. Singleton, one member, locked until
      // pulled from her own Exclusive Squads Recruitment banner (Page 4).
      { type: 'goddessOfDeath', icon: '☠️', label: 'Goddess of Death', color: 0x4a1030, baseDmg: 42, rarity: 'exclusive', startsLocked: true, memberCount: 1, singleton: true, iconImage: GODDESS_ICON_URI,
        desc: 'An exclusive singleton squad: a tall, pale Goddess of Death with knee-length white hair, faceless, with near-black arms marked with red eyes and crimson wings, fighting completely alone with a tall reaping scythe. Passive: Death\'s Decree - a scythe strike against any enemy at or below 30% HP is a guaranteed instant kill. Passive: Reaper\'s Sweep - some swings unleash a wide crescent that cuts everything in a frontal arc. Passive: Soul Harvest - every enemy she kills restores part of her max HP. Passive: Soul Vessel - when she dies with a raider nearby, she has a 35% chance to possess it; ten seconds later its body explodes and she rises from the blast.',
        passives: [
          { name: 'Death\'s Decree', trigger: 'Scythe strike on an enemy at or below 30% HP', effect: 'Guaranteed instant kill - bypasses shields and Fortitude entirely' },
          { name: 'Reaper\'s Sweep', trigger: '30% chance per swing', effect: 'A crimson crescent slash hits every enemy in a wide frontal arc for 70% damage with knockback and a brief stun' },
          { name: 'Soul Harvest', trigger: 'Every enemy she kills', effect: 'Restores 15% of her max HP per kill, with a swirl of soul-light' },
          { name: 'Soul Vessel', trigger: '35% chance on death, if a raider is nearby', effect: 'Her soul possesses the nearest raider, which stops attacking and glows crimson. After 10 seconds (or if it is killed first) its body explodes, hurting nearby raiders, and she revives on the spot with 60% HP.' },
        ] },
      // Exclusive tier: a lone Goddess of Life (see the GOLIFE_* block above),
      // appearance inspired by Columbina. The gentle counterpart of the Goddess
      // of Death: singleton, one member, locked until pulled from an Exclusive
      // Squads Recruitment banner (she is part of EXCLUSIVE_BANNER_TYPES).
      { type: 'goddessOfLife', icon: '🌙', label: 'Goddess of Life', color: 0x6f7dd9, baseDmg: 24, rarity: 'exclusive', startsLocked: true, memberCount: 1, singleton: true, iconImage: GOLIFE_ICON_URI,
        desc: 'An exclusive singleton squad and the strongest healer in the roster: a gentle Goddess of Life with long snow-white hair tipped in pale blue and gathered into one thick braid, faceless like the Goddess of Death, gowned in flowing white and indigo with a blue crescent gem at her chest and white dove wings, fighting completely alone with a crescent moon staff. Passive: Lightbringer Wave - periodically sends out a wave of holy light that damages, knocks back and stuns every enemy close to her. Passive: Gentle Touch - every staff strike also mends the most wounded ally near her. Passive: Cradle of Life - quickly raises fallen members of the most depleted allied squad. Passive: Second Dawn - when she would fall she rises again with most of her HP and a moonlight shield, mending nearby allies.',
        passives: [
          { name: 'Lightbringer Wave', trigger: 'Every 7 seconds, while an enemy is within range', effect: 'A wave of holy light bursts out from her, dealing 36 damage to every enemy close to her, knocking it back and stunning it so it cannot attack for 2 seconds' },
          { name: 'Gentle Touch', trigger: 'Every staff strike', effect: 'Also heals the most wounded ally near her for 12% of that ally\'s max HP' },
          { name: 'Cradle of Life', trigger: 'Every 12 seconds, if any allied squad has a fallen member', effect: 'Raises one fallen member of the most depleted allied squad back into formation in a pillar of light' },
          { name: 'Second Dawn', trigger: 'When she would fall (once every 90 seconds)', effect: 'She rises again at 60% HP with a moonlight shield worth 25% of her max HP, and the burst heals nearby wounded allies for 35% of their max HP' },
        ] },
      // Exclusive tier: a paired 2-member squad rather than the usual 4-man
      // line or lone singleton - a fox-spirit (kitsune) duo. Member 0
      // "Ember Fang" is a fast low-crouched katana striker; member 1
      // "Frost Warden" is a taller spear guardian standing just behind
      // her (see squadMemberFormationPosition's default grid, createSquad's
      // kitsuneRole assignment, and createSquadMemberVisual's dispatch by
      // memberIndex to createKitsuneBladeHumanoid/createKitsuneSpearHumanoid).
      { type: 'kitsuneTwinblade', icon: '🦊', label: 'Kitsune Twinblade', color: 0xb5202a, baseDmg: 42, rarity: 'exclusive', startsLocked: true, memberCount: 2, singleton: true, iconImage: KITSUNE_ICON_URI,
        desc: 'An exclusive 2-member fox-spirit squad fighting as a paired unit: "Ember Fang", a low, fast katana striker with red hair and warm orange fox ears/tail, and "Frost Warden", a taller spear guardian with silver hair and grey-white fox ears/tail who covers her partner\'s flank. Passive: Quickdraw - Ember Fang has a chance on every swing to land a fast, heavier quick-draw cut. Passive: Fox Fire - Ember Fang\'s katana itself carries a lick of flame, so every landed strike sets its target Burning. Passive: Flame Crescent - Ember Fang has a separate chance on every swing to also loose a diagonal arc of fox-fire that burns whatever it hits. Passive: Parry & Deflect - Ember Fang can turn aside an incoming melee strike outright, and has a low chance to also deflect an incoming projectile. Passive: Guard the Flank - Frost Warden has a chance on every swing to knock her target back, keeping enemies off her partner. Passive: Guardian\'s Ward - whenever Frost Warden is struck, a chance to ward both her and Ember Fang with a protective shield. Passive: Fox Spirit Renewal - after 10 seconds of combat, Frost Warden sets herself and Ember Fang regenerating HP over the next few seconds; every 10 seconds after that, a low chance to do it again for as long as the fight goes on. Passive: Twin Strike - whenever Ember Fang lands a Quickdraw, Frost Warden (if still standing) immediately follows up with a bonus spear jab on the same target.',
        passives: [
          { name: 'Quickdraw', trigger: 'Every katana swing (Ember Fang)', effect: 'A chance to land a fast quick-draw cut for bonus damage instead of a normal strike' },
          { name: 'Fox Fire', trigger: 'Every landed katana strike (Ember Fang)', effect: 'Her blade itself carries flame, setting its target Burning on every hit' },
          { name: 'Flame Crescent', trigger: 'Every katana swing (Ember Fang)', effect: 'A separate chance to also loose a diagonal fox-fire slash at her target, setting it aflame' },
          { name: 'Parry & Deflect', trigger: 'Whenever Ember Fang is struck', effect: 'A chance to fully parry a melee strike, plus a low chance to deflect an incoming projectile' },
          { name: 'Guard the Flank', trigger: 'Every spear swing (Frost Warden)', effect: 'A chance to knock her target back, covering her partner\'s flank' },
          { name: 'Guardian\'s Ward', trigger: 'Whenever Frost Warden is hit', effect: 'A chance to shield both her and Ember Fang, each for a slice of their own max HP' },
          { name: 'Fox Spirit Renewal', trigger: '10 seconds into combat, then every 10 seconds after (Frost Warden)', effect: 'Sets herself and Ember Fang regenerating HP over a few seconds; the first proc is guaranteed, later ones only have a low chance to fire' },
          { name: 'Twin Strike', trigger: 'Whenever Ember Fang\'s Quickdraw connects', effect: 'Frost Warden immediately follows up with a bonus spear jab on the same target, as long as she\'s still standing' },
        ] },
    ];

    let raiderSquads = [];
    const strandedBoats = [];
    const MAX_STRANDED_BOATS = 3;
    const BOAT_SINK_DELAY = 60; // seconds a beached boat sits before it sinks
    const BOAT_SINK_DURATION = 2.5; // seconds the sinking animation takes

    function registerStrandedBoat(boat) {
      strandedBoats.push({ boat, strandedAt: clock.getElapsedTime(), sinking: false, sinkTimer: 0 });
      while (strandedBoats.length > MAX_STRANDED_BOATS) {
        const oldest = strandedBoats.shift();
        if (oldest.boat.parent) oldest.boat.parent.remove(oldest.boat);
      }
    }

    function updateStrandedBoats(delta, time) {
      for (let i = strandedBoats.length - 1; i >= 0; i--) {
        const entry = strandedBoats[i];
        if (!entry.sinking) {
          if (time - entry.strandedAt >= BOAT_SINK_DELAY) {
            entry.sinking = true;
            entry.baseY = entry.boat.position.y;
          }
          continue;
        }
        entry.sinkTimer += delta;
        const t = Math.min(1, entry.sinkTimer / BOAT_SINK_DURATION);
        entry.boat.position.y = entry.baseY - t * 0.6;
        entry.boat.rotation.z = t * 0.5;
        entry.boat.rotation.x = t * 0.15;
        if (t >= 1) {
          if (entry.boat.parent) entry.boat.parent.remove(entry.boat);
          strandedBoats.splice(i, 1);
        }
      }
    }
    let waveNumber = 0;
    let waveCooldownActive = false;
    let waveCooldownRemaining = 0;
    let waveCooldownInterval = null;
    const WAVE_COOLDOWN_SECONDS = 10;
    // Intermission: once a wave is finished (every raider dead) the next
    // wave can't be started for this many seconds.
    const WAVE_INTERMISSION_SECONDS = 60;
    let waveIntermissionActive = false;
    let waveInProgress = false; // true from startWave() until that wave's raiders are all dead
    // Tracks whether raiders were on the island last frame, so the Monk's
    // post-fight heal (see applyMonkPostFightHeal) fires exactly once at the
    // moment the last raider falls, instead of every frame the island is quiet.
    let raidWasActiveLastFrame = false;
    // The wave limit for the run in progress: a number (1-20) or 'endless'.
    // Set from the Custom Game menu's selection when a run starts; Campaign
    // levels are always 'endless' since they don't use this control.
    let activeWaveLimit = 'endless';
    // Per-biome raider appearance. "classic" keeps the original dark
    // leather-and-iron look; "japan" retints raiders to a black/charcoal
    // ronin outfit and adds a red hachimaki headband, so warbands visually
    // match The Far East theme they're landing on. "desert" retints them
    // to sun-worn tan/sand robes with a pale cloth wrap, matching desert
    // nomad raiders rather than the original dark leather look.
    const RAIDER_THEME_CONFIG = {
      classic: { body: 0x3a1414, pants: 0x241010, headbandColor: null },
      japan:   { body: 0x2b2320, pants: 0x1a1512, headbandColor: 0xb5202a },
      desert:  { body: 0x8a6f42, pants: 0x4a3826, headbandColor: 0xe8dcc0 },
      // Shadow Island - tattered dark rag/leather armor over bare bone (see
      // createBlockyHumanoid's isSkeleton flag, set in createRaiderSquad
      // below for this biome), rather than a living raider's skin tone.
      shadowIsland: { body: 0x35322e, pants: 0x201e1b, headbandColor: null },
      // Northernlands - retints raiders to a cold-weather fur-and-hide
      // Norse reaver look (warm brown fur over dark leather trousers)
      // rather than the original dark leather outfit, matching the
      // frosty biome they're landing on. headbandColor here doubles as
      // the horn tint on the Viking helmet every raider in this biome
      // wears (see createBlockyHumanoid's isViking branch) rather than a
      // cloth headband color.
      northernlands: { body: 0x5c4a3a, pants: 0x2e241c, headbandColor: 0xd9c9a3 },
    };

    // Cloth tones a Desert-biome raider's keffiyeh/turban is randomly
    // picked from (see createRaiderSquad), instead of every raider in a
    // warband wearing an identical wrap - a mix of cream, sandy, and
    // sun-bleached white tones.
    const DESERT_HEADWEAR_COLORS = [0xe8dcc0, 0xf2ede0, 0xd9c9a3, 0xc9b28a, 0xf5f0e2];

    // Desert Warriors squad (player-recruitable, Common tier) - randomized
    // "Arabic" outfit palette. Each entry pairs a robe color with a
    // coordinated pants color so a squad dressed randomly per-unit still
    // reads as deliberate outfits rather than clashing colors - see
    // createSquad/respawnSquad's 'desertWarriors' branch, which rolls one
    // of these per member.
    const DESERT_WARRIOR_OUTFITS = [
      { body: 0x1f6f5c, pants: 0x123a30 }, // deep teal
      { body: 0x8a1f2b, pants: 0x4a1016 }, // maroon
      { body: 0x1c3f6b, pants: 0x10233d }, // indigo blue
      { body: 0xb5822a, pants: 0x6b4a18 }, // mustard gold
      { body: 0x4a5e2a, pants: 0x2b3818 }, // olive green
      { body: 0xe3ddc9, pants: 0x8a7d5a }, // sandstone cream
    ];

    // Cloth tones for the Desert Warriors' randomized keffiyeh/turban -
    // the same sun-bleached nomad palette as a Desert biome raider's
    // headwear, plus a couple of richer accent tones so the squad's
    // wraps don't all come out pale and identical.
    const DESERT_WARRIOR_HEADWEAR_COLORS = DESERT_HEADWEAR_COLORS.concat([0xb5202a, 0x1c3f6b]);

    // Wokou - a distinct band of Japanese pirate raiders that can show up
    // alongside the regular warbands once The Far East biome is active. Kept
    // as its own palette (cool dark robe, white bandana) so a Wokou warband
    // reads as a different threat at a glance instead of just another
    // reskinned classic raider.
    const WOKOU_THEME = { body: 0x263238, pants: 0x151b1e, headbandColor: 0xf0ede2 };

    // Valkyrie & Angel - the Heavenly Island's own defenders, only ever
    // rolled when selectedBiomeTheme === 'heaven' (see the Event: Death &
    // Life gamemode). Valkyrie wears pale silver-blue armor with a gold
    // headband and fights with spear/spearShield like a regular melee
    // raider; Angel wears white-gold robes and fights at range with the
    // Acolyte's holy-bolt staff loadout, reskinned, and wears a glowing
    // halo (see createAngelHalo/the isAngel branch in createBlockyHumanoid)
    // instead of a cloth headband - its headbandColor below is unused as a
    // result, just left in place alongside body/pants for a uniform theme
    // shape. Neither introduces new geometry - both ride the existing
    // body/weapon rigs so they're as low-risk as every other biome reskin
    // above. Angels also shed no blood and never leave a ragdoll corpse -
    // see the isAngel checks in applyDamage/createRagdollDeath and
    // vanishAngel, triggered from killUnit.
    const VALKYRIE_THEME = { body: 0xdde6f2, pants: 0x8fa3c9, headbandColor: 0xffd76b };
    const ANGEL_THEME = { body: 0xfffaf0, pants: 0xe9dfc0, headbandColor: 0xffffff };
    // Heavenly Island defender spawn descent - how high above its landing
    // spot (in the squad group's own local/scaled space) a freshly-spawned
    // guard starts, and how long (seconds) it takes to glide down to its
    // actual formation position. Driven per-frame from updateUnitAnims'
    // uData.descendTimer/descendFromY block below, which also trails
    // light particles behind it and flashes a burst on landing (same
    // white-gold palette as vanishAngel's ascend-on-death effect). Named
    // for Angel, who had it first, but createDefenderSquad now gives both
    // Angel and Valkyrie guards the same descent.
    const ANGEL_DESCEND_HEIGHT = 9;
    const ANGEL_DESCEND_DURATION = 1.1;
    const VALKYRIE_WEAPON_TYPES = ['spear', 'spearShield'];
    const ANGEL_WEAPON_TYPES = ['acolyteBolt'];
    function randomValkyrieWeapon() {
      return VALKYRIE_WEAPON_TYPES[Math.floor(Math.random() * VALKYRIE_WEAPON_TYPES.length)];
    }

    const RAIDER_ATTACK_RANGE = 0.9;
    // Stop-and-shoot distance for a warband made up entirely of ranged
    // raiders (Bow/Wokou Bow/Bandit Bow/Acolyte Bolt - see
    // RANGED_RAIDER_WEAPON_TYPES below) - kept a little inside the 5.5
    // individual attack range those unit types use in updateCombatSystem,
    // so the squad has already stopped and is safely within its own
    // members' firing range the moment it decides to hold position,
    // instead of continuing to close the last few tiles into melee like
    // RAIDER_ATTACK_RANGE would. A squad with even one melee member mixed
    // in still uses the plain RAIDER_ATTACK_RANGE below - it has a melee
    // fighter that needs to actually close the distance.
    const RAIDER_RANGED_ATTACK_RANGE = 4.5;
    const BOAT_SLOWDOWN_DISTANCE = 1.8;
    const BOAT_MIN_SPEED_FACTOR = 0.22;
    const BOAT_HIT_RANGE = 1.6; // ranged units can't snipe raiders from far out at sea
    const BEACH_OFFSET = 1.6; // boat is ~2.3 units long (3x scale), needs this much clearance from land
    const RAIDER_WEAPON_TYPES = ['axe', 'sword', 'swordShield', 'spear', 'spearShield', 'bow'];
    // Every raider loadout that fights entirely at range (mirrors the
    // per-unit isRaiderBow/isRaiderAcolyte checks in updateCombatSystem) -
    // used by isSquadFullyRanged to decide whether a whole warband should
    // hold at range instead of closing to melee.
    const RANGED_RAIDER_WEAPON_TYPES = ['bow', 'wokouBow', 'banditBow', 'acolyteBolt', 'orcBow'];

    // True only when every living member of the warband is one of the
    // ranged loadouts above - a mixed warband (the common case for a
    // classic/Wokou/Desert Bandit landing) still has melee members that
    // need to close the gap, so it keeps the old close-to-melee behavior.
    function isSquadFullyRanged(squad) {
      return squad.members.length > 0 && squad.members.every(u => RANGED_RAIDER_WEAPON_TYPES.includes(u.userData.raiderWeapon));
    }

    function randomRaiderWeapon() {
      return RAIDER_WEAPON_TYPES[Math.floor(Math.random() * RAIDER_WEAPON_TYPES.length)];
    }

    // Wokou loadouts - Katana and Sickle are melee-only (no shield variants),
    // plus their own Bow loadout so a Wokou Bow Raider is tracked separately
    // from a classic Bow Raider in the Raiders Index. See equipUnit() for how
    // 'wokouBow' renders identically to the classic bow rig.
    const WOKOU_WEAPON_TYPES = ['katana', 'sickle', 'wokouBow'];

    function randomWokouWeapon() {
      return WOKOU_WEAPON_TYPES[Math.floor(Math.random() * WOKOU_WEAPON_TYPES.length)];
    }

    // Raider passive (Javelin Throw) - odds that a Spear-armed raider hurls
    // its spear as a one-time ranged throw the first time it gets to
    // attack, instead of just thrusting with it in melee. See
    // processUnitAttack for where the roll happens and the re-arm logic.
    const RAIDER_SPEAR_THROW_CHANCE = 0.5;

    // Marauders - a heavier-hitting warband that can show up alongside the
    // normal mixed-weapon raiders once the Classic biome is active. Every
    // Marauder forgoes the classic Sword/Sword & Shield/Bow loadouts
    // entirely in favor of one of three heavy melee weapons - Axe, Mace, or
    // Spear - so a Marauder warband reads as an all-melee brawl rather than
    // the usual mixed loadout. Kept as its own worn, grittier palette (drab
    // hide over dark leather, with a blood-red rag headband) so it reads as
    // a different threat at a glance, the same convention Wokou/Desert
    // Bandit use for their own warbands below. 'marauderAxe' and
    // 'marauderMace' render with the exact same rig as a classic Axe/Mace
    // raider (see equipUnit's 'raiders' branch), and 'marauderSpear' with
    // the same two-handed pike rig and Javelin Throw passive a classic
    // Spear Raider gets (see isRaiderSpear's use of 'marauderSpear' in
    // updateCombatSystem/applyAttackPose/dropWeaponOnDeath) - just tracked
    // under their own loadout keys (the same convention 'wokouBow'/
    // 'banditSword' use) so the Raiders Index counts a Marauder as its own
    // entry rather than folding it into the plain Axe/Spear Raider or
    // Desert Bandit Mace Raider entries.
    const MARAUDER_THEME = { body: 0x4a4238, pants: 0x2b271f, headbandColor: 0x8a1f1f };
    const MARAUDER_WEAPON_TYPES = ['marauderAxe', 'marauderMace', 'marauderSpear'];

    function randomMarauderWeapon() {
      return MARAUDER_WEAPON_TYPES[Math.floor(Math.random() * MARAUDER_WEAPON_TYPES.length)];
    }

    // Chance that a warband landing while the Classic biome is active is a
    // Marauder warband (entirely Axe/Mace/Spear-armed) rather than a normal
    // mixed-weapon raider warband. Marauders never appear outside that
    // biome, and - like Desert Bandits - don't compete against any other
    // special warband for the roll.
    const MARAUDER_WARBAND_CHANCE = 0.35;

    // Wokou passive (Bomb Throw) - odds that a Wokou raider, on the first
    // attack opportunity it gets in the fight, lobs a single bomb at
    // whichever one target it's about to engage instead of opening with its
    // normal weapon. One-time coin flip per unit, same shape as the classic
    // Raider's Javelin Throw. See processUnitAttack for the roll.
    const WOKOU_BOMB_THROW_CHANCE = 0.35;

    // Chance that a warband landing while The Far East biome is active is a
    // Wokou warband (entirely Katana/Sickle/Bow-armed) rather than a normal
    // mixed-weapon raider warband. Wokou never appear outside that biome.
    const WOKOU_WARBAND_CHANCE = 0.4;

    // Akuma Feral - a demonic crawler unique to The Far East. Its own
    // palette (ashen grey-purple hide) since it isn't wearing raider armor
    // at all - just bare hide, an Oni mask, and a tail (see
    // createBlockyHumanoid's isAkuma flag). Fights bare-clawed rather than
    // with a weapon loadout - see AKUMA_WEAPON_TYPES/equipUnit's 'claws'
    // branch - and moves/attacks entirely differently from a normal raider:
    // faster, able to climb parkour tiles (see canClimb on the squad object
    // and its use in updateRaiderAI/stepSquadMovement), attacks with a
    // shield-piercing leap (see isAkumaFeral in processUnitAttack), and
    // never lingers or leaves a corpse on death (see vanishAkumaFeral).
    const AKUMA_THEME = { body: 0x4a4358, pants: 0x2e2836, headbandColor: null };
    const AKUMA_WEAPON_TYPES = ['claws'];

    // Chance that a warband landing while The Far East biome is active is a
    // lone Akuma Feral pack instead of a normal mixed-weapon raider warband.
    // Rolled only when the warband didn't already come up Wokou - an Akuma
    // Feral pack never appears outside that biome, and never mixes with
    // Wokou in the same warband.
    const AKUMA_WARBAND_CHANCE = 0.25;

    // Onryo - a vengeful female ghost unique to The Far East, rolled
    // independently of Wokou/Akuma above (never mixing with either in the
    // same warband - see spawnRaiderWave). Its own pale, sickly robe
    // palette (see createBlockyHumanoid's isOnryo branch for the
    // hollow-eyed face/gaping chest maw/halo that goes with it) rather
    // than the dark Wokou palette or Akuma's bare demonic hide. Lands
    // alone rather than as a warband, same idea as Bear Warrior - see the
    // (isBear || isOnryo) ? 1 override in spawnRaiderWave - and fights
    // two-handed with a single ritual staff loadout (see
    // ONRYO_WEAPON_TYPES/createOnryoStaff).
    const ONRYO_THEME = { body: 0xcfc6ab, pants: 0x2a241d, headbandColor: null };
    const ONRYO_WEAPON_TYPES = ['onryoStaff'];

    // Chance that a warband landing while The Far East biome is active is
    // a lone Onryo instead of a normal mixed-weapon raider warband. Only
    // rolled when the warband didn't already come up Wokou or Akuma -
    // Onryo never mixes with either.
    const ONRYO_WARBAND_CHANCE = 0.2;

    // Desert Bandits - a distinct warband that can show up alongside the
    // normal (reskinned) desert raiders once the Desert biome is active.
    // Kept as its own darker, rougher palette (worn leather over sun-faded
    // cloth, with a dark cloth mask instead of the pale keffiyeh/turban a
    // regular desert raider wears) so a Bandit warband reads as a
    // different threat at a glance. Each Bandit is independently issued
    // one of three loadouts - Sword, Mace, or Bow - see
    // DESERT_BANDIT_WEAPON_TYPES/equipUnit's 'banditSword'/'mace'/
    // 'banditBow' branches. 'banditSword' and 'banditBow' render with the
    // exact same rig as a classic Sword/Bow raider, just tracked under
    // their own loadout key (the same convention 'wokouBow' uses) so the
    // Raiders Index counts a Desert Bandit as its own entry rather than
    // folding it into the plain Sword/Bow Raider.
    const DESERT_BANDIT_THEME = { body: 0x5c4a30, pants: 0x362a1c, headbandColor: 0x2b2320 };
    const DESERT_BANDIT_WEAPON_TYPES = ['banditSword', 'mace', 'banditBow'];

    function randomDesertBanditWeapon() {
      return DESERT_BANDIT_WEAPON_TYPES[Math.floor(Math.random() * DESERT_BANDIT_WEAPON_TYPES.length)];
    }

    // Chance that a warband landing while the Desert biome is active is a
    // Desert Bandit warband (entirely Sword/Mace/Bow-armed) rather than a
    // normal mixed-weapon raider warband. Desert Bandits never appear
    // outside that biome, and - unlike Wokou/Akuma - don't compete against
    // any other special warband for the roll.
    const DESERT_BANDIT_WARBAND_CHANCE = 0.35;

    // Immortals - an elite desert warband, rarer than the Desert Bandits and
    // never mixing with them in the same landing. Fully masked and armored
    // in black rather than dressed like a nomad raider: black plate/robe,
    // a black turban, and a silver demonic mask (see createBlockyHumanoid's
    // isImmortal flag). Every Immortal fights with a plain sword and
    // nothing else - no shield, no ranged loadout - but is noticeably
    // tankier than a normal raider and gets a one-time Resurrection on
    // death (see IMMORTAL_HP_MULT and maybeTriggerImmortalResurrection).
    const IMMORTAL_THEME = { body: 0x141414, pants: 0x0a0a0a, headbandColor: 0x111111 };
    const IMMORTAL_WEAPON_TYPES = ['immortalSword'];

    // Immortal passive (Tougher) - noticeably beefier than a normal
    // 100-hp raider on top of its one-time Resurrection below, so it
    // actually takes real sustained damage to put down for good. See
    // equipUnit's 'immortalSword' branch for where this gets applied.
    const IMMORTAL_HP_MULT = 1.75;

    // Chance that a warband landing while the Desert biome is active is an
    // Immortal warband (entirely Sword-armed) rather than a normal
    // mixed-weapon raider warband. Only rolled when the warband didn't
    // already come up Desert Bandit - Immortals never appear outside the
    // Desert biome, and never mix with Desert Bandits in the same warband.
    const IMMORTAL_WARBAND_CHANCE = 0.2;

    // Acolytes - a cult warband unique to Shadow Island. Unlike every other
    // raider that lands there, an Acolyte is NOT reanimated into a Skeleton
    // Warrior (see the isAcolyte exemption in createRaiderSquad's isSkeleton
    // line) - it's a still-living cultist in a hooded robe, so it keeps its
    // own dark violet palette and fleshed silhouette instead of the bone-
    // white skeleton reskin. Fights entirely at range, casting a bolt
    // straight out of its raised hand rather than carrying any weapon prop
    // (see equipUnit's 'acolyteBolt' branch and the isRaiderAcolyte casting
    // pose in applyAttackPose) - and bleeds a dark violet color instead of
    // red when hit (see ACOLYTE_BLOOD_COLOR).
    const ACOLYTE_THEME = { body: 0x2a1f38, pants: 0x1a1424, headbandColor: null };
    const ACOLYTE_WEAPON_TYPES = ['acolyteBolt'];
    const ACOLYTE_BLOOD_COLOR = 0x6a2d82;

    // Chance that a warband landing while Shadow Island is active is an
    // Acolyte cult warband instead of the default all-Skeleton-Warrior
    // landing every other Shadow Island raider comes back as.
    const ACOLYTE_WARBAND_CHANCE = 0.3;

    // Dark Knights - Shadow Island's other special raider warband,
    // alongside the cult Acolytes above. Unlike the reanimated Skeleton
    // Warriors every other Shadow Island raider comes back as, a Dark
    // Knight is no risen skeleton - it's a still-living knight encased
    // head to toe in dark plate: an enclosed dark knight helmet, a full
    // plate cuirass with pauldrons and waist guard, and a flowing black
    // cape (see createDarkKnightArmor/createDarkKnightHelmet and
    // createBlockyHumanoid's isDarkKnight branch), wielding a shield
    // paired with either a sword or a mace, never dual-wielded or
    // two-handed (see DARK_KNIGHT_WEAPON_TYPES/randomDarkKnightWeapon
    // and equipUnit's 'darkKnightSword'/'darkKnightMace' branch). Far
    // tankier than a normal raider (see DARK_KNIGHT_HP) and can never be
    // finished off by a guaranteed-lethal/instant-kill attack - see
    // applyDamage's isDarkKnight check in the 'cavalryCharge' branch,
    // which turns a would-be Assassinate/Deathblow/Charge kill into a
    // solid but survivable hit instead.
    const DARK_KNIGHT_THEME = { body: 0x1c1c22, pants: 0x141418, headbandColor: null };
    const DARK_KNIGHT_WEAPON_TYPES = ['darkKnightSword', 'darkKnightMace'];

    // Dark Knight passive (Unbreakable) - a flat, memorable HP threshold
    // rather than a multiplier off the normal 100-hp raider baseline
    // (contrast with IMMORTAL_HP_MULT).
    const DARK_KNIGHT_HP = 300;

    // Dark Knight passive (Unbreakable), continued - how much damage a
    // would-be instant-kill/guaranteed-lethal attack deals instead of an
    // outright kill (see applyDamage's isDarkKnight check in the
    // 'cavalryCharge' branch). A solid hit, comparable to the game's
    // heaviest normal weapon swings, but nowhere near lethal on its own
    // against DARK_KNIGHT_HP.
    const DARK_KNIGHT_INSTANT_KILL_IMMUNE_DAMAGE = 45;

    function randomDarkKnightWeapon() {
      return DARK_KNIGHT_WEAPON_TYPES[Math.floor(Math.random() * DARK_KNIGHT_WEAPON_TYPES.length)];
    }

    // Chance that a warband landing while Shadow Island is active is a
    // Dark Knight warband instead of the default all-Skeleton-Warrior
    // landing - rolled independently of, and only when the warband
    // didn't already come up, the Acolyte roll above, since the two
    // never mix in the same warband.
    const DARK_KNIGHT_WARBAND_CHANCE = 0.2;

    // Crimson Ghouls ("Undead Forces") - Shadow Island's rarest warband
    // alternative, rolled independently of, and only when the warband
    // didn't already come up Acolyte or Dark Knight above. Unlike every
    // other Shadow Island raider it is NOT a reanimated Skeleton Warrior -
    // it reuses the same feral, hunched Ghoul silhouette the player's own
    // rare Ghoul squad has (see createBlockyHumanoid's isGhoul branch:
    // bare flesh, permanent hunch, clawed hands, glowing eyes), just
    // recolored a deep blood crimson (see CRIMSON_GHOUL_SKIN_COLOR/
    // CRIMSON_GHOUL_EYE_GLOW via the isCrimsonGhoul flag) and fighting
    // bare-clawed under its own 'ghoulClaws' loadout key. Deliberately
    // left out of RAIDER_TYPE_DEFS so it never registers a Raiders Index
    // entry, no matter how many times it's actually fought.
    const CRIMSON_GHOUL_SKIN_COLOR = 0x8a1622;
    const CRIMSON_GHOUL_EYE_GLOW = 0xff2a1a;
    const CRIMSON_GHOUL_THEME = { body: 0x3a0508, pants: 0x220305, headbandColor: null };
    const UNDEAD_WEAPON_TYPES = ['ghoulClaws'];

    // Kept deliberately low - a rarer, more limited sight than either the
    // Acolyte or Dark Knight rolls above.
    const UNDEAD_WARBAND_CHANCE = 0.12;

    // Demons - not a warband roll like Acolytes/Dark Knights above; a Demon
    // squad only ever comes from the Demonic Portal special structure (see
    // DEMONIC_PORTAL_SPAWN_CHANCE in generateRandomIsland and
    // maybeOpenDemonPortal, called at the start of every wave). A red-
    // skinned, horned, tailed humanoid (see createBlockyHumanoid's isDemon
    // branch and createDemonHorns/createDemonTail) fighting with a two-
    // handed Hell Trident (see createHellTrident and equipUnit's
    // 'hellTrident' branch). No passive while alive - a plain line unit,
    // same as a classic Axe Raider - but see DEMON_EXPLOSION_DAMAGE/
    // DEMON_EXPLOSION_RADIUS below for what happens the moment it dies.
    const DEMON_THEME = { body: 0x3a0f0f, pants: 0x200a0a, headbandColor: null };
    // 'scarecrowScythe' (the Shadow Island Swamp Scarecrow) belongs to the
    // Demon faction too - see createScarecrowSquad/maybeAwakenScarecrow.
    const DEMON_WEAPON_TYPES = ['hellTrident', 'scarecrowScythe'];

    // Demon passive (Hellfire Burst) - AoE damage and radius (world tiles)
    // for the fiery burst a Demon leaves behind the instant it dies (see
    // explodeDemon, called from killUnit in place of the normal ragdoll
    // death for any uData.isDemon unit).
    const DEMON_EXPLOSION_DAMAGE = 35;
    const DEMON_EXPLOSION_RADIUS = 1.6;

    // Odds, rolled at the start of every wave (see startWave), that an
    // island's Demonic Portal - if one actually generated (demonPortalTile
    // non-null) - opens and disgorges a fresh Demon squad. Kept low so it's
    // a rare event rather than a near-certainty each wave. Independent of
    // the warband-count/coastline-landing logic spawnRaiderWave uses for
    // every other raider type, since Demons erupt from the portal itself
    // rather than sailing in.
    const DEMON_PORTAL_OPEN_CHANCE = 0.08;
    const DEMON_PORTAL_MIN_COUNT = 2;
    const DEMON_PORTAL_MAX_COUNT = 4;

    // Orcs - a new hostile faction, same "erupts from its own landmark
    // instead of sailing in" pattern as the Demons above: an Orc warband
    // only ever comes from the Orc Fortress special structure (see
    // ORC_FORTRESS_SPAWN_CHANCE in generateRandomIsland and
    // maybeSpawnOrcWarband, called at the start of every wave alongside
    // maybeOpenDemonPortal) - never lands by boat, and never mixes with
    // any of the boat-borne warbands. Classic biome only, since that's
    // the only biome the Orc Fortress itself can ever generate on.
    // Green-skinned and shirtless (see createBlockyHumanoid's isOrc
    // branch, which overrides the torso to bare skinMat instead of a
    // shirt) but not bare-shouldered - a crude pauldron on each shoulder
    // (see createOrcPauldrons) and a tusked iron orc helmet
    // (see createOrcHelmet) give it a real silhouette rather than just
    // a reskinned raider. Fights with a one-handed Axe (plain or paired
    // with a shield) or a Bow - see ORC_WEAPON_TYPES/randomOrcWeapon and
    // equipUnit's 'orcAxe'/'orcAxeShield'/'orcBow' branches, which reuse
    // the classic Axe/Shield/Bow rigs under their own loadout keys (the
    // same convention 'marauderAxe'/'wokouBow' use) so the Raiders Index
    // counts an Orc as its own entry.
    const ORC_SKIN_COLOR = 0x5c8a3a;
    // Ghoul (Rare) - a rotting grayish-green undead flesh tone, distinct
    // from the Orc's healthy saturated green above - see createGhoulHumanoid.
    const GHOUL_SKIN_COLOR = 0x6b7a5e;
    const ORC_THEME = { body: 0x4a3826, pants: 0x362a1c, headbandColor: null };
    const ORC_WEAPON_TYPES = ['orcAxe', 'orcAxeShield', 'orcBow'];

    function randomOrcWeapon() {
      return ORC_WEAPON_TYPES[Math.floor(Math.random() * ORC_WEAPON_TYPES.length)];
    }

    // Odds, rolled at the start of every wave (see startWave) alongside
    // maybeOpenDemonPortal, that an island's Orc Fortress - if one
    // actually generated (orcFortressTile non-null) - musters a fresh
    // Orc warband from its gate. Kept low, same idea as
    // DEMON_PORTAL_OPEN_CHANCE, so it's a rare extra threat rather than
    // a near-certainty every wave.
    const ORC_WARBAND_CHANCE = 0.2;
    const ORC_WARBAND_MIN_COUNT = 2;
    const ORC_WARBAND_MAX_COUNT = 4;

    // Bear Warrior - a lone Northernlands raider that lands alone instead
    // of in a Viking warband, built from the same humanoid rig as every
    // other raider but reskinned as a shaggy bear humanoid (see
    // createBlockyHumanoid's isBear flag/createBearFeatures) rather than
    // wearing raider armor at all. Fights entirely unarmed - claws and
    // teeth (see BEAR_WEAPON_TYPES/equipUnit's 'bearClaws' branch, which
    // reuses the same no-weapon rig as an Akuma Feral's claws) - with every
    // landed melee swing rolling between a normal Claw hit and a heavier
    // Bite (see BEAR_BITE_CHANCE/BEAR_BITE_DMG in processUnitAttack), and
    // periodically calls down a Lightning Strike on its target instead of
    // swinging at all (see BEAR_LIGHTNING_* below and
    // summonBearLightningStrike). Tankier than a normal raider to make up
    // for fighting alone (see BEAR_HP).
    const BEAR_FUR_COLOR = 0xf0ede4;
    const BEAR_THEME = { body: BEAR_FUR_COLOR, pants: BEAR_FUR_COLOR, headbandColor: null };

    // Berserker Squad cosmetic palette - each unit rolls a wolf-grey or
    // bear-brown pelt independently (see createBerserkerHumanoid), so a
    // full squad reads as a mixed warband rather than four identical
    // clones, the same idea as DESERT_WARRIOR_HEADWEAR_COLORS.
    const BERSERKER_PELT_COLORS = [0x6b6b6b, 0x8a5a2a];
    const BEAR_WEAPON_TYPES = ['bearClaws'];
    const BEAR_HP = 340;

    // Chance that a warband landing while the Northernlands biome is active
    // is a lone Bear Warrior (count forced to 1 - see maybeSpawnRaiderWave)
    // instead of the usual mixed-size Viking squad. Rolled independently of
    // every other biome's special-warband checks, since none of those ever
    // fire in the Northernlands anyway.
    const BEAR_WARBAND_CHANCE = 0.22;

    // Claws vs Bite - every landed melee swing rolls this chance to be a
    // slower, harder Bite instead of the normal Claw hit (see the
    // isBearWarrior branch in processUnitAttack's melee block).
    const BEAR_CLAW_DMG = 26;
    const BEAR_BITE_DMG = 42;
    const BEAR_BITE_CHANCE = 0.3;

    // Summon Lightning passive - instead of a normal Claw/Bite swing, a
    // Bear Warrior periodically calls down a lightning bolt on its current
    // target's position, dealing AoE damage to every nearby player Squad/
    // Villager Militia member (bypassing shields, same convention as the
    // Demon's Hellfire Burst) rather than a single-target hit. Gated by its
    // own cooldown (uData.bearLightningCooldown, ticked in
    // processUnitAttack) rather than a per-swing coin flip, so it fires on
    // a rhythm instead of the first (or every) attack opportunity.
    const BEAR_LIGHTNING_COOLDOWN_MIN = 7;
    const BEAR_LIGHTNING_COOLDOWN_RANGE = 4;
    const BEAR_LIGHTNING_RADIUS = 2.2;
    const BEAR_LIGHTNING_DAMAGE = 38;

    // Wolf Warrior - a Northernlands raider variant that reuses the
    // player-recruitable Berserker Squad's own shirtless, pelt-helmeted
    // look and two-handed Double Axe (see createBlockyHumanoid's
    // isBerserker flag/createBerserkerPeltHelmet/createBerserkerPauldrons
    // and equipUnit's Double Axe rig, reused here under its own 'wolfAxe'
    // loadout key), just always wearing the wolf-grey pelt rather than
    // rolling between wolf and bear the way a Berserker Squad member does
    // (see BERSERKER_PELT_COLORS) - hence "Wolf" rather than "Berserker"
    // Warrior. Shares the Berserker's Rage passive (see
    // BERSERKER_RAGE_HP_THRESHOLD/isBerserkerRaging, which checks
    // uData.raiderFaction === 'wolfWarrior' alongside unitType==='berserker')
    // and, on top of that, can climb up onto rooftops and boulders the same
    // way an Akuma Feral pack can (see canClimb in createRaiderSquad's
    // return value below and Wall Crawler in the Raiders Index).
    const WOLF_WARRIOR_FUR_COLOR = 0x6b6b6b;
    const WOLF_WARRIOR_THEME = { body: WOLF_WARRIOR_FUR_COLOR, pants: 0x3a2f28, headbandColor: null };
    const WOLF_WARRIOR_WEAPON_TYPES = ['wolfAxe'];

    // Chance that a warband landing while the Northernlands biome is active
    // is an all-Wolf-Warrior landing instead of the usual mixed Viking
    // squad or a lone Bear Warrior - rolled independently of
    // BEAR_WARBAND_CHANCE, and only when this warband didn't already come
    // up Bear (see the isBear/isWolfWarrior rolls in maybeSpawnRaiderWave).
    const WOLF_WARRIOR_WARBAND_CHANCE = 0.22;

    // Wolf Warrior passive (Axe Throw) - a flying target (currently just
    // the Valkyrie) is out of a Double Axe's melee reach, so a Wolf
    // Warrior instead hurls the axe as a thrown weapon whenever a flying
    // target is what it's engaging (see the isWolfWarriorRaider branch in
    // processUnitAttack and spawnProjectile's 'throwingAxe' type below).
    // Only widens its reach for a flying target specifically - against a
    // normal ground target it still closes in and swings the axe in
    // melee like any other raider, at the flat MELEE_ENGAGE_RANGE.
    const WOLF_WARRIOR_AXE_THROW_RANGE = 4.5;

    // Steel Revenant - a tall, ghost-pale iron horror in brutalist
    // trapezoid/triangle plate armor (see createRevenantArmor) under a
    // towering, crowned T-visor helm (see createRevenantHelmet) that
    // hides any face entirely, fighting two-handed with a flanged
    // Revenant Mace (see createRevenantBlade). Not a raider warband - it's
    // a player-recruitable Exclusive squad only (see CLASS_DEFS's
    // 'steelRevenant' entry and equipUnit's 'steelRevenant' branch),
    // landing as a lone singleton unit the same way Dragon Ronin does.
    // STEEL_REVENANT_THEME is used by that player-squad creation path
    // directly, not by createRaiderSquad below.
    const STEEL_REVENANT_THEME = { body: 0x101114, pants: 0x0a0a0c, headbandColor: null };

    // Steel Revenant passive (Colossus) - a towering flat HP pool, well
    // beyond even the Dark Knight's DARK_KNIGHT_HP, befitting a lone unit
    // standing in for an entire squad on its own - see applySquadLevelStats'
    // STEEL_REVENANT_HP_MULT, which derives the same total from the normal
    // 100-HP line-unit baseline.
    const STEEL_REVENANT_HP = 600;

    function createRaiderSquad(x, z, count, isWokou, isAkuma, isDesertBandit, isImmortal, isAcolyte, isDarkKnight, isMarauder, isBear, isWolfWarrior, isOnryo, isValkyrie, isAngel, isUndead) {
      const group = new THREE.Group();
      const members = [];
      const raiderTheme = isAngel ? ANGEL_THEME : (isValkyrie ? VALKYRIE_THEME : (isBear ? BEAR_THEME : (isWolfWarrior ? WOLF_WARRIOR_THEME : (isUndead ? CRIMSON_GHOUL_THEME : (isAcolyte ? ACOLYTE_THEME : (isDarkKnight ? DARK_KNIGHT_THEME : (isAkuma ? AKUMA_THEME : (isWokou ? WOKOU_THEME : (isOnryo ? ONRYO_THEME : (isDesertBandit ? DESERT_BANDIT_THEME : (isImmortal ? IMMORTAL_THEME : (isMarauder ? MARAUDER_THEME : (RAIDER_THEME_CONFIG[selectedBiomeTheme] || (selectedBiomeTheme === 'heaven' ? RAIDER_THEME_CONFIG.shadowIsland : RAIDER_THEME_CONFIG.classic))))))))))))));
      // Desert-biome raiders (never Wokou/Akuma - those are Far-East-only,
      // and never Desert Bandits or Immortals, which get their own headwear
      // handling below instead) each get a keffiyeh or turban in a randomly
      // picked cloth tone, rolled per-unit so a warband doesn't all wear
      // identical headwear.
      const isDesertRaider = !isWokou && !isAkuma && !isDesertBandit && !isImmortal && selectedBiomeTheme === 'desert';
      // Northernlands raiders are Vikings - a horned helmet and beard
      // (see createBlockyHumanoid's isViking branch) rather than the
      // bare-headed look every other biome without its own headwear
      // falls back to. There's no separate sub-faction here the way
      // Wokou/Desert Bandits are (see the checks above) - every raider
      // that lands in this biome gets the Viking look.
      const isViking = selectedBiomeTheme === 'northernlands' && !isBear && !isWolfWarrior;
      // Shadow Island raiders are Skeleton Warriors - bone-white skin (see
      // createBlockyHumanoid's isSkeleton flag), no blood when hit (see
      // applyDamage/createRagdollDeath), and a single hit is always lethal
      // (forced to 1 HP right after creation below) rather than going down
      // to weapon damage numbers like a living raider would. Acolytes are
      // the one exception - a still-living cult warband that keeps its own
      // fleshed, robed silhouette instead of the skeleton reskin. The Dark
      // Knight is the other exception, for the same reason - not a
      // reanimated bone reskin. Crimson Ghouls are the third exception -
      // already their own distinct undead creature, not a risen human.
      // During Event: Life the Heavenly Island's Undead Forces get the
      // same Skeleton Warrior treatment (isAcolyte/isDarkKnight are always
      // false on this biome, so the condition below reduces to "every
      // heaven warband that didn't roll Crimson Ghoul").
      const isSkeleton = (selectedBiomeTheme === 'shadowIsland' || selectedBiomeTheme === 'heaven') && !isAcolyte && !isDarkKnight && !isUndead;

      const boat = createBoat();
      group.add(boat);

      for (let i = 0; i < count; i++) {
        // A Desert Bandit wears the same keffiyeh/turban rig as a regular
        // desert raider, just always in the warband's own dark cloth tone
        // (drawn up over the lower face like a mask) rather than the pale
        // nomad colors. An Immortal always wears a black turban - no
        // keffiyeh variant, since the silver demonic mask underneath it
        // (see createBlockyHumanoid's isImmortal flag) is the whole point
        // of its silhouette.
        const headwearVariant = isImmortal ? 'turban' : (isDesertRaider || isDesertBandit) ? (Math.random() < 0.5 ? 'keffiyeh' : 'turban') : null;
        const headwearColor = isDesertRaider ? DESERT_HEADWEAR_COLORS[Math.floor(Math.random() * DESERT_HEADWEAR_COLORS.length)] : raiderTheme.headbandColor;
        const unit = createBlockyHumanoid(raiderTheme.body, true, raiderTheme.pants, headwearColor, false, isAkuma, false, false, headwearVariant, isImmortal, isSkeleton, isAcolyte, false, isDarkKnight, false, false, isViking, isMarauder, false, isBear, isWolfWarrior, WOLF_WARRIOR_FUR_COLOR, isOnryo, false, false, isUndead, false, isAngel, isUndead);
        // Angel flag - read by applyDamage/createBloodSplatter/
        // createRagdollDeath (no blood) and killUnit (vanishes in a burst
        // of light instead of leaving a ragdoll corpse - see vanishAngel).
        if (isAngel) unit.userData.isAngel = true;
        if (isSkeleton) { unit.userData.maxHp = 1; unit.userData.hp = 1; }
        // Dark Knight passive (Unbreakable) - a flat, tanky HP pool (see
        // DARK_KNIGHT_HP) rather than the normal 100-hp raider baseline.
        if (isDarkKnight) { unit.userData.maxHp = Math.round(DARK_KNIGHT_HP * ENEMY_NERF.hp); unit.userData.hp = unit.userData.maxHp; }
        // Bear Warrior - a tanky lone unit standing in for a whole warband
        // (see BEAR_HP), same idea as Dark Knight's Unbreakable above.
        if (isBear) { unit.userData.maxHp = Math.round(BEAR_HP * ENEMY_NERF.hp); unit.userData.hp = unit.userData.maxHp; }
        const col = i % 2, row = Math.floor(i / 2);
        unit.position.set(col * 0.28 - 0.14, 0.16, row * 0.28 - 0.35);
        equipUnit(unit, 'raiders', isAngel ? 'acolyteBolt' : (isValkyrie ? randomValkyrieWeapon() : (isUndead ? 'ghoulClaws' : (isAkuma ? 'claws' : (isWokou ? randomWokouWeapon() : (isOnryo ? 'onryoStaff' : (isDesertBandit ? randomDesertBanditWeapon() : (isImmortal ? 'immortalSword' : (isAcolyte ? 'acolyteBolt' : (isDarkKnight ? randomDarkKnightWeapon() : (isMarauder ? randomMarauderWeapon() : (isBear ? 'bearClaws' : (isWolfWarrior ? 'wolfAxe' : randomRaiderWeapon())))))))))))));
        group.add(unit);
        members.push(unit);
      }

      group.scale.set(0.6, 0.6, 0.6);
      group.position.set(x, 0, z);
      group.userData.onBoat = true;
      scene.add(group);

      return {
        type: 'raiders',
        isWokou: !!isWokou,
        isAkuma: !!isAkuma,
        isDesertBandit: !!isDesertBandit,
        isImmortal: !!isImmortal,
        isDarkKnight: !!isDarkKnight,
        isUndead: !!isUndead,
        isMarauder: !!isMarauder,
        isBear: !!isBear,
        isWolfWarrior: !!isWolfWarrior,
        isOnryo: !!isOnryo,
        isValkyrie: !!isValkyrie,
        isAngel: !!isAngel,
        // Akuma Feral packs and Wolf Warrior warbands can climb up onto
        // rooftops/boulders the same way a Ninja squad can - see
        // stepSquadMovement/updateRaiderAI's use of this flag alongside
        // their squad.type === 'ninja' checks.
        canClimb: !!isAkuma || !!isWolfWarrior,
        group,
        members,
        boat,
        onBoat: true,
        landingTile: null,
        isMoving: false,
        targetPosition: new THREE.Vector3(),
        currentPath: [],
        currentWaypoint: 0,
        // Bear Warrior - a heavy lone brawler, noticeably slower to close
        // the distance than a normal Viking raider squad.
        moveSpeed: (isAkuma ? 2.3 : (isBear ? 1.1 : 1.4)) * ENEMY_NERF.speed,
        aiCooldown: 0,
        currentTargetSquad: null, // which ally squad this warband is currently committed to attacking
      };
    }

    function disembarkRaiderSquad(squad) {
      const tile = squad.landingTile;
      const landY = getSurfaceY(tile.x, tile.z);

      if (squad.boat) {
        const worldRotY = squad.group.rotation.y;
        const dirX = tile.dirX || 0, dirZ = tile.dirZ || 0;
        squad.group.remove(squad.boat);
        squad.boat.position.set(tile.x + dirX * BEACH_OFFSET, 0, tile.z + dirZ * BEACH_OFFSET);
        squad.boat.rotation.y = worldRotY;
        squad.boat.scale.copy(squad.group.scale);
        scene.add(squad.boat);
      }

      // A player squad (Event: Death attackers) drops back onto its own
      // formation slots; raiders use the simple 2-wide block below.
      const isPlayerSquad = squad.type !== 'raiders';
      squad.members.forEach((unit, i) => {
        const fo = unit.userData.formationOffset;
        if (isPlayerSquad && fo) {
          fo.y -= ATTACKER_BOAT_UNIT_LIFT;
          unit.position.set(fo.x, fo.y, fo.z);
          return;
        }
        const col = i % 2, row = Math.floor(i / 2);
        unit.position.set(col * 0.45 - 0.225, 0, row * 0.45 - 0.225);
      });
      if (isPlayerSquad && squad.boat) {
        // Left on the beach, then sinks after a while like any stranded boat.
        registerStrandedBoat(squad.boat);
        squad.boat = null;
      }

      squad.group.position.set(tile.x, landY !== null ? landY : 0, tile.z);
      squad.onBoat = false;
      squad.group.userData.onBoat = false;
      squad.isMoving = false;
      squad.group.userData.isMoving = false;
      squad.currentPath = [];
      squad.currentWaypoint = 0;
      squad.aiCooldown = 0;
    }

    function updateBoatSailing(squad, delta) {
      const currentPos = squad.group.position;
      const dx = squad.landingTile.x - currentPos.x;
      const dz = squad.landingTile.z - currentPos.z;
      const dist = Math.hypot(dx, dz);

      if (dist < BEACH_OFFSET) {
        disembarkRaiderSquad(squad);
        return;
      }

      const dir = new THREE.Vector3(dx, 0, dz).normalize();
      squad.group.rotation.y = Math.atan2(dir.x, dir.z);

      const speedFactor = Math.max(BOAT_MIN_SPEED_FACTOR, Math.min(1, dist / BOAT_SLOWDOWN_DISTANCE));
      const step = dir.multiplyScalar(squad.moveSpeed * 0.85 * speedFactor * delta);

      if (step.length() > dist) {
        currentPos.x = squad.landingTile.x;
        currentPos.z = squad.landingTile.z;
      } else {
        currentPos.add(step);
      }
      currentPos.y = 0;
    }

    function spawnRaiderWave(n) {
      // Event: Death & Life - the Heavenly Island's Valkyrie & Angel forces
      // play two different roles depending on which side the player picked.
      // In Death the player is the attacker, so the Valkyrie/Angel are
      // stationary defenders guarding the temple (spawnHeavenDefenders) -
      // they never sail in, and the fight is about pushing across the
      // island to reach them. In Life the player is defending their own
      // village, so this now falls through to the normal boat-landing
      // logic below: real warbands of Valkyrie/Angel sail in and actively
      // assault the player's squads/fortress each wave, same as raiders in
      // every other biome (isValkyrie/isAngel below are already keyed off
      // selectedBiomeTheme === 'heaven', so the landing warbands keep their
      // Heavenly Island look either way).
      if (selectedBiomeTheme === 'heaven' && eventFactionActive === 'death') { spawnHeavenDefenders(n); return; }

      const landingTiles = coastTiles.filter(t => isTileWalkable(t.x, t.z));
      if (landingTiles.length === 0) return;

      const warbandCount = Math.min(1 + Math.floor((n - 1) / 2), 4);
      const raidersPerWarband = Math.min(3 + Math.floor(n / 3), 6);
      const usedLandingTiles = new Set(); // avoid stacking multiple warbands on the same beach this wave
      const LANDING_SEARCH_ATTEMPTS = 10;

      for (let i = 0; i < warbandCount; i++) {
        // Try several candidate landing tiles instead of committing to the first
        // roll: this both lets a warband skip past a tile with no open water
        // next to it (previously it would just be silently dropped) and spreads
        // warbands out across different parts of the coastline when possible.
        let landTile = null, wdx = 0, wdz = 0;
        for (let attempt = 0; attempt < LANDING_SEARCH_ATTEMPTS; attempt++) {
          const candidate = landingTiles[Math.floor(Math.random() * landingTiles.length)];
          const key = candidate.x + ',' + candidate.z;
          if (usedLandingTiles.has(key) && attempt < LANDING_SEARCH_ATTEMPTS - 1) continue;

          const waterDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(
            ([dx, dz]) => heightMap[(candidate.x + dx) + ',' + (candidate.z + dz)] === undefined
          );
          if (waterDirs.length === 0) continue;

          const [dx, dz] = waterDirs[Math.floor(Math.random() * waterDirs.length)];
          landTile = candidate;
          wdx = dx; wdz = dz;
          usedLandingTiles.add(key);
          break;
        }
        if (!landTile) continue;

        // Boats now spawn well out to sea instead of just off the coast, so
        // there's a longer, more visible approach before they beach.
        const seaDist = 4.5 + Math.random() * 3;
        const seaX = landTile.x + wdx * seaDist;
        const seaZ = landTile.z + wdz * seaDist;

        const isWokou = selectedBiomeTheme === 'japan' && Math.random() < WOKOU_WARBAND_CHANCE;
        // Akuma Feral packs never mix with Wokou in the same warband - only
        // rolled when this warband didn't already come up Wokou.
        const isAkuma = !isWokou && selectedBiomeTheme === 'japan' && Math.random() < AKUMA_WARBAND_CHANCE;
        // Onryo never mixes with Wokou or Akuma in the same warband - only
        // rolled when this warband didn't already come up as either.
        const isOnryo = !isWokou && !isAkuma && selectedBiomeTheme === 'japan' && Math.random() < ONRYO_WARBAND_CHANCE;
        const isDesertBandit = selectedBiomeTheme === 'desert' && Math.random() < DESERT_BANDIT_WARBAND_CHANCE;
        // Immortals never mix with Desert Bandits in the same warband -
        // only rolled when this warband didn't already come up Bandit.
        const isImmortal = !isDesertBandit && selectedBiomeTheme === 'desert' && Math.random() < IMMORTAL_WARBAND_CHANCE;
        // Acolytes are Shadow Island's own alternative to the default
        // all-Skeleton-Warrior landing - rolled independently of the
        // Wokou/Akuma/Desert Bandit/Immortal checks above since none of
        // those ever fire outside Japan/Desert anyway.
        const isAcolyte = selectedBiomeTheme === 'shadowIsland' && Math.random() < ACOLYTE_WARBAND_CHANCE;
        // Dark Knights never mix with Acolytes in the same warband - only
        // rolled when this warband didn't already come up Acolyte.
        const isDarkKnight = !isAcolyte && selectedBiomeTheme === 'shadowIsland' && Math.random() < DARK_KNIGHT_WARBAND_CHANCE;
        // Crimson Ghouls (Undead Forces) - Shadow Island's rarest warband
        // alternative, rolled only when this warband didn't already come
        // up Acolyte or Dark Knight. On the Heavenly Island during Event:
        // Life (see beginEventBattle/spawnRaiderWave) the Undead Forces
        // take over as the attacking side entirely - every warband here is
        // forced to be Crimson Ghoul or the default Skeleton Warrior
        // (isSkeleton below), 50/50, the same all-or-nothing split Valkyrie/
        // Angel used to get on this biome. Death's own Valkyrie & Angel
        // guard posts are untouched - they're built separately by
        // createDefenderSquad/spawnHeavenDefenders, which this loop never
        // reaches during an Event: Death run.
        const isUndead = selectedBiomeTheme === 'heaven'
          ? Math.random() < 0.5
          : !isAcolyte && !isDarkKnight && selectedBiomeTheme === 'shadowIsland' && Math.random() < UNDEAD_WARBAND_CHANCE;
        // Marauders are Classic biome's own alternative to the default
        // mixed-weapon landing - rolled independently of the checks above
        // since none of those ever fire outside Japan/Desert/Shadow Island
        // anyway, so there's no other special warband to compete against.
        const isMarauder = selectedBiomeTheme === 'classic' && Math.random() < MARAUDER_WARBAND_CHANCE;
        // Bear Warrior - the Northernlands' own alternative to the default
        // all-Viking landing, same idea as Marauder above: rolled
        // independently since nothing else ever fires in this biome. Always
        // lands alone, so the normal raidersPerWarband count is overridden
        // to 1 whenever this rolls true.
        const isBear = selectedBiomeTheme === 'northernlands' && Math.random() < BEAR_WARBAND_CHANCE;
        // Wolf Warrior - the Northernlands' own alternative to the default
        // all-Viking landing, same idea as Marauder above: rolled
        // independently, and only when this warband didn't already come up
        // Bear. Unlike Bear Warrior it lands as a full warband rather than
        // alone, so the normal raidersPerWarband count is left untouched.
        const isWolfWarrior = !isBear && selectedBiomeTheme === 'northernlands' && Math.random() < WOLF_WARRIOR_WARBAND_CHANCE;
        // Valkyrie & Angel no longer land here - Event: Life's Heavenly
        // Island attackers are now Undead Forces (see the isUndead roll
        // above), so this loop always passes false/false for them. Death's
        // Valkyrie & Angel are still built separately as static guard
        // posts (createDefenderSquad/spawnHeavenDefenders) and never pass
        // through here.
        const isValkyrie = false;
        const isAngel = false;
        // Steel Revenant no longer lands as a raider warband - it's now a
        // player-recruitable Exclusive squad (see CLASS_DEFS) rather than
        // an enemy, so createRaiderSquad no longer takes a Steel Revenant
        // parameter at all.
        const squad = createRaiderSquad(seaX, seaZ, (isBear || isOnryo) ? 1 : raidersPerWarband, isWokou, isAkuma, isDesertBandit, isImmortal, isAcolyte, isDarkKnight, isMarauder, isBear, isWolfWarrior, isOnryo, isValkyrie, isAngel, isUndead);
        squad.landingTile = { x: landTile.x, z: landTile.z, dirX: wdx, dirZ: wdz };
        raiderSquads.push(squad);
      }

      // Event: Life - the last wave (activeWaveLimit) throws a Goddess of
      // Death boss into the Undead assault, same appearance as the
      // playable Goddess of Death squad - see createGoddessOfDeathBossSquad.
      if (eventFactionActive === 'life' && n === activeWaveLimit) {
        const bossTile = landingTiles[Math.floor(Math.random() * landingTiles.length)];
        if (bossTile) raiderSquads.push(createGoddessOfDeathBossSquad(bossTile.x, bossTile.z));
      }
    }

    // A Demon squad - unlike every squad createRaiderSquad builds, this
    // one never sails in on a boat: it erupts fully landed at the Demonic
    // Portal's own tile (see maybeOpenDemonPortal below), so there's no
    // boat mesh, no sea-to-beach approach, and onBoat is false from the
    // moment it's created. Every member is a Hell Trident-wielding Demon
    // (see DEMON_THEME/DEMON_WEAPON_TYPES) - no loadout variety, no
    // Skeleton reskin (a Demon is not a risen Shadow Island corpse).
    function createDemonSquad(x, z, count) {
      const group = new THREE.Group();
      const members = [];

      for (let i = 0; i < count; i++) {
        const unit = createBlockyHumanoid(DEMON_THEME.body, true, DEMON_THEME.pants, null, false, false, false, false, null, false, false, false, false, false, true);
        equipUnit(unit, 'raiders', 'hellTrident');
        const col = i % 2, row = Math.floor(i / 2);
        unit.position.set(col * 0.45 - 0.225, 0, row * 0.45 - 0.225);
        group.add(unit);
        members.push(unit);
      }

      const landY = getSurfaceY(x, z);
      group.scale.set(0.6, 0.6, 0.6);
      group.position.set(x, landY !== null ? landY : 0, z);
      group.userData.onBoat = false;
      scene.add(group);

      return {
        type: 'raiders',
        isDemon: true,
        canClimb: false,
        group,
        members,
        boat: null,
        onBoat: false,
        landingTile: { x, z, dirX: 0, dirZ: 0 },
        isMoving: false,
        targetPosition: new THREE.Vector3(),
        currentPath: [],
        currentWaypoint: 0,
        moveSpeed: 1.4 * ENEMY_NERF.speed,
        aiCooldown: 0,
        currentTargetSquad: null,
      };
    }

    // A Heavenly Island defender squad - Valkyrie or Angel, guarding a
    // fixed post on the island rather than sailing in like an invading
    // raider warband (see createDemonSquad above for the same no-boat
    // pattern). guardPost is the tile it holds and falls back to whenever
    // no attacker is close enough or fighting nearby - see
    // findDefenderTarget/updateRaiderAI's isDefender branch below.
    function createDefenderSquad(x, z, count, isValkyrie, isAngel) {
      const group = new THREE.Group();
      const members = [];
      const theme = isAngel ? ANGEL_THEME : VALKYRIE_THEME;

      for (let i = 0; i < count; i++) {
        // Valkyrie guards now share the exact same look as the player's
        // recruitable Valkyrie squad (see createValkyrieHumanoid/the
        // 'valkyrie' branch of equipUnit): the Paladin plate rig with
        // wings bolted onto the back and flowing hair. createValkyrieHumanoid
        // itself hardcodes isEnemy = false, which is fine for a player
        // squad but would break isEnemyUnit() targeting on a raider, so
        // its body+wings are reproduced inline here with isEnemy true
        // instead of calling it directly. Angel keeps its own separate,
        // unchanged look.
        let unit;
        if (isAngel) {
          unit = createBlockyHumanoid(theme.body, true, theme.pants, theme.headbandColor, false, false, false, false, null, false, false, false, false, false, false, false, false, false, false, false, false, 0x6b6b6b, false, false, false, false, false, true);
          unit.userData.isAngel = true;
        } else {
          unit = createBlockyHumanoid(theme.body, true, 0xf2f2f2, null, false, false, false, true);
          const wings = createValkyrieWings();
          wings.position.set(0, 0.55, 0.05);
          unit.add(wings);
          unit.userData.wingL = wings.userData.wingPivots[0];
          unit.userData.wingR = wings.userData.wingPivots[1];
          const hair = createValkyrieHair();
          unit.userData.head.add(hair);
          unit.userData.hairMesh = hair;
        }
        equipUnit(unit, 'raiders', isAngel ? 'acolyteBolt' : randomValkyrieWeapon());
        const col = i % 2, row = Math.floor(i / 2);
        const formationY = 0;
        // Spawn descent - both guard types start high above their post
        // and glide straight down into formation (see ANGEL_DESCEND_
        // HEIGHT/_DURATION above and the shared uData.descendTimer block
        // in updateUnitAnims) instead of just popping into existence.
        // Valkyrie now gets the exact same descent Angel always had.
        unit.position.set(col * 0.45 - 0.225, formationY + ANGEL_DESCEND_HEIGHT, row * 0.45 - 0.225);
        unit.userData.descendTimer = ANGEL_DESCEND_DURATION;
        unit.userData.descendDuration = ANGEL_DESCEND_DURATION;
        unit.userData.descendFromY = formationY + ANGEL_DESCEND_HEIGHT;
        unit.userData.descendToY = formationY;
        group.add(unit);
        members.push(unit);
      }

      const landY = getSurfaceY(x, z);
      group.scale.set(0.6, 0.6, 0.6);
      group.position.set(x, landY !== null ? landY : 0, z);
      group.userData.onBoat = false;
      scene.add(group);

      return {
        type: 'raiders',
        isValkyrie: !!isValkyrie,
        isAngel: !!isAngel,
        isDefender: true,
        guardPost: { x, z },
        canClimb: false,
        group,
        members,
        boat: null,
        onBoat: false,
        landingTile: { x, z, dirX: 0, dirZ: 0 },
        isMoving: false,
        targetPosition: new THREE.Vector3(),
        currentPath: [],
        currentWaypoint: 0,
        moveSpeed: 1.4 * ENEMY_NERF.speed,
        aiCooldown: 0,
        currentTargetSquad: null,
      };
    }

    // Event: Death & Life boss wave - on the last wave of either event,
    // the opposing Goddess shows up as a one-woman boss unit, built from
    // the exact same visual/animation/ability code as her playable
    // counterpart (createGoddessOfDeathHumanoid/createGoddessOfLifeHumanoid,
    // equipUnit's goddessOfDeath/goddessOfLife branches, goddessStrike/
    // goddessOfLifeStrike, updateGoddessOfLifeAbilities, goddessDeath/
    // goddessOfLifeDeath's isEnemyUnit branch) with isEnemy forced true so
    // she reads as a raider to isEnemyUnit/targeting/HP-bar color. Far
    // beefier than the guard-post/warband units around her, as a boss
    // should be.
    const EVENT_BOSS_HP_MULT = 2.4;
    const EVENT_BOSS_DMG_MULT = 1.6;

    function createEventBossUnit(type, isDefender) {
      discoverBossType(type);
      const unit = type === 'goddessOfDeath' ? createGoddessOfDeathHumanoid(true) : createGoddessOfLifeHumanoid(true);
      equipUnit(unit, type);
      const bossHpMult = (type === 'goddessOfDeath' ? GODDESS_HP_MULT : GOLIFE_HP_MULT) * EVENT_BOSS_HP_MULT;
      const bossHp = Math.max(1, Math.round(100 * bossHpMult * ENEMY_NERF.hp));
      unit.userData.maxHp = bossHp;
      unit.userData.hp = bossHp;
      unit.userData.baseDmgMultiplier = EVENT_BOSS_DMG_MULT;
      unit.userData.dmgMultiplier = EVENT_BOSS_DMG_MULT;
      unit.userData.formationOffset = new THREE.Vector3(0, 0, 0);
      // Same sky-drop entrance the Valkyrie/Angel guard posts use
      // (createDefenderSquad above) - a dramatic descent reads well for a
      // boss reveal, defender or attacker alike.
      unit.position.set(0, ANGEL_DESCEND_HEIGHT, 0);
      unit.userData.descendTimer = ANGEL_DESCEND_DURATION;
      unit.userData.descendDuration = ANGEL_DESCEND_DURATION;
      unit.userData.descendFromY = ANGEL_DESCEND_HEIGHT;
      unit.userData.descendToY = 0;
      return unit;
    }

    // Event: Life boss - a Goddess of Death raider, added to the last
    // wave's Undead assault on the player's own island. Lands alone and
    // unmounted (no boat) straight onto a beach tile, then fights exactly
    // like any other attacking warband (findRaiderTarget) - see
    // spawnRaiderWave's call to this at n === activeWaveLimit.
    function createGoddessOfDeathBossSquad(x, z) {
      const group = new THREE.Group();
      const unit = createEventBossUnit('goddessOfDeath', false);
      group.add(unit);

      const landY = getSurfaceY(x, z);
      group.scale.set(0.6, 0.6, 0.6);
      group.position.set(x, landY !== null ? landY : 0, z);
      group.userData.onBoat = false;
      scene.add(group);
      spawnFloatingText(new THREE.Vector3(x, (landY || 0) + 2.2, z), 'THE GODDESS OF DEATH ARRIVES!', '#ff2255');

      return {
        type: 'goddessOfDeath',
        isEventBoss: true,
        canClimb: false,
        group,
        members: [unit],
        boat: null,
        onBoat: false,
        landingTile: { x, z, dirX: 0, dirZ: 0 },
        isMoving: false,
        targetPosition: new THREE.Vector3(),
        currentPath: [],
        currentWaypoint: 0,
        moveSpeed: 1.45,
        aiCooldown: 0,
        currentTargetSquad: null,
      };
    }

    // Event: Death boss - a Goddess of Life raider, added to the last
    // wave's Heavenly Island defense. Holds a guard post exactly like a
    // Valkyrie/Angel guard squad (isDefender/guardPost, findDefenderTarget)
    // - see spawnHeavenDefenders' call to this at n === activeWaveLimit.
    function createGoddessOfLifeBossSquad(x, z) {
      const group = new THREE.Group();
      const unit = createEventBossUnit('goddessOfLife', true);
      group.add(unit);

      const landY = getSurfaceY(x, z);
      group.scale.set(0.6, 0.6, 0.6);
      group.position.set(x, landY !== null ? landY : 0, z);
      group.userData.onBoat = false;
      scene.add(group);
      spawnFloatingText(new THREE.Vector3(x, (landY || 0) + 2.2, z), 'THE GODDESS OF LIFE DEFENDS!', '#bfe6ff');

      return {
        type: 'goddessOfLife',
        isEventBoss: true,
        isDefender: true,
        guardPost: { x, z },
        canClimb: false,
        group,
        members: [unit],
        boat: null,
        onBoat: false,
        landingTile: { x, z, dirX: 0, dirZ: 0 },
        isMoving: false,
        targetPosition: new THREE.Vector3(),
        currentPath: [],
        currentWaypoint: 0,
        moveSpeed: 1.6,
        aiCooldown: 0,
        currentTargetSquad: null,
      };
    }

    // Called by spawnRaiderWave instead of the normal boat-landing loop
    // during an Event: Death run (selectedBiomeTheme === 'heaven' AND
    // eventFactionActive === 'death'). Picks interior (non-coast)
    // walkable tiles for guard posts, spread out with the same
    // used-tile-avoidance idea as the normal landing loop, and scales
    // guard-post count/squad size with wave number the same way
    // warbandCount/raidersPerWarband do.
    function spawnHeavenDefenders(n) {
      let interiorTiles = Object.keys(heightMap)
        .filter(k => !buildingTileKeys.has(k))
        .map(k => { const parts = k.split(','); return { x: Number(parts[0]), z: Number(parts[1]) }; })
        .filter(t => isTileWalkable(t.x, t.z));
      if (interiorTiles.length === 0) return;

      // Event: Death - defenders hold the far (defender) side of the island,
      // opposite the attacker edge the player starts on. Falls back to any
      // interior tile only if the defender side has no walkable ground.
      if (eventSideInfo) {
        const defenderTiles = interiorTiles.filter(isEventDefenderSide);
        if (defenderTiles.length > 0) interiorTiles = defenderTiles;
      }

      const guardCount = Math.min(1 + Math.floor((n - 1) / 2), 4);
      const defendersPerGuard = Math.min(3 + Math.floor(n / 3), 6);
      const usedTiles = new Set();
      const GUARD_SEARCH_ATTEMPTS = 10;

      for (let i = 0; i < guardCount; i++) {
        let tile = null;
        for (let attempt = 0; attempt < GUARD_SEARCH_ATTEMPTS; attempt++) {
          const candidate = interiorTiles[Math.floor(Math.random() * interiorTiles.length)];
          const key = candidate.x + ',' + candidate.z;
          if (usedTiles.has(key) && attempt < GUARD_SEARCH_ATTEMPTS - 1) continue;
          tile = candidate;
          usedTiles.add(key);
          break;
        }
        if (!tile) continue;

        // Every guard post rolls independently between Valkyrie and
        // Angel, so a wave's defenders are a mix rather than all-or-
        // nothing like the earlier isValkyrie/isAngel roll in the normal
        // boat-landing loop (which only needed one roll per warband).
        const postIsAngel = Math.random() < 0.5;
        const squad = createDefenderSquad(tile.x, tile.z, defendersPerGuard, !postIsAngel, postIsAngel);
        raiderSquads.push(squad);
      }

      // Event: Death - the last wave (activeWaveLimit) adds a Goddess of
      // Life boss to the Heavenly Island's defense, same appearance as the
      // playable Goddess of Life squad - see createGoddessOfLifeBossSquad.
      if (n === activeWaveLimit) {
        const bossTile = interiorTiles[Math.floor(Math.random() * interiorTiles.length)];
        if (bossTile) raiderSquads.push(createGoddessOfLifeBossSquad(bossTile.x, bossTile.z));
      }
    }

    // disgorge a fresh Demon squad right on its own tile, with a burst of
    // violet portal-glow particles to sell the eruption.
    function maybeOpenDemonPortal() {
      if (!demonPortalTile) return;
      if (Math.random() >= DEMON_PORTAL_OPEN_CHANCE) return;

      const count = DEMON_PORTAL_MIN_COUNT + Math.floor(Math.random() * (DEMON_PORTAL_MAX_COUNT - DEMON_PORTAL_MIN_COUNT + 1));
      const squad = createDemonSquad(demonPortalTile.x, demonPortalTile.z, count);
      raiderSquads.push(squad);

      const portalWorldPos = new THREE.Vector3(demonPortalTile.x, getSurfaceY(demonPortalTile.x, demonPortalTile.z) || 0, demonPortalTile.z);
      const PORTAL_OPEN_COLORS = [0x8a2be2, 0xff3b1f, 0x2a1440];
      for (let i = 0; i < 16; i++) {
        const color = PORTAL_OPEN_COLORS[Math.floor(Math.random() * PORTAL_OPEN_COLORS.length)];
        spawnParticle(portalWorldPos.clone().add(new THREE.Vector3(0, 0.4 + Math.random() * 0.3, 0)), color, 0.1 + Math.random() * 0.08, 0.5 + Math.random() * 0.3, false);
      }
      spawnFloatingText(portalWorldPos.clone().add(new THREE.Vector3(0, 0.8, 0)), 'THE PORTAL OPENS!', '#c76bff');
    }

    // The awake Scarecrow - a lone Demon-faction raider (see
    // SCARECROW_HP) that never sails in on a boat: it climbs down off its
    // post right where the dormant prop stood (see maybeAwakenScarecrow),
    // so it's landed and onBoat is false from the moment it's created,
    // same as createDemonSquad.
    function createScarecrowSquad(x, z) {
      const group = new THREE.Group();
      const members = [];

      const unit = createBlockyHumanoid(
        SCARECROW_THEME.body, true, SCARECROW_THEME.pants, null,
        false, false, false, false,   // isNinja, isAkuma, isDragonRonin, isPaladin
        null,                         // desertHeadwear
        false, false, false, false, false, // isImmortal, isSkeleton, isAcolyte, isSlasher, isDarkKnight
        false, false, false, false,   // isDemon, isSteelRevenant, isViking, isMarauder
        false, false, false,          // isOrc, isBear, isBerserker
        0x6b6b6b,                     // berserkerFurColor (unused)
        false,                        // isOnryo
        true                          // isScarecrow
      );
      unit.userData.maxHp = Math.round(SCARECROW_HP * ENEMY_NERF.hp);
      unit.userData.hp = unit.userData.maxHp;
      equipUnit(unit, 'raiders', 'scarecrowScythe');
      unit.position.set(0, 0, 0);
      group.add(unit);
      members.push(unit);

      const landY = getSurfaceY(x, z);
      group.scale.set(0.6, 0.6, 0.6);
      group.position.set(x, landY !== null ? landY : 0, z);
      group.userData.onBoat = false;
      scene.add(group);

      return {
        type: 'raiders',
        isScarecrow: true,
        canClimb: false,
        group,
        members,
        boat: null,
        onBoat: false,
        landingTile: { x, z, dirX: 0, dirZ: 0 },
        isMoving: false,
        targetPosition: new THREE.Vector3(),
        currentPath: [],
        currentWaypoint: 0,
        moveSpeed: 1.3 * ENEMY_NERF.speed,
        aiCooldown: 0,
        currentTargetSquad: null,
      };
    }

    // Called once at the start of every wave (see startWave). If this
    // island generated a dormant Scarecrow (scarecrowTile non-null), rolls
    // SCARECROW_AWAKEN_CHANCE for it to wake: the scenery prop is swapped
    // out for a live Scarecrow raider on the same tile, in a burst of
    // scattering crows, and starts attacking the player's squads like any
    // other raider. Once awake it's an ordinary raider - the dormant state
    // is gone for the rest of the island.
    function maybeAwakenScarecrow() {
      if (!scarecrowTile) return;
      if (Math.random() >= SCARECROW_AWAKEN_CHANCE) return;

      const { x, z } = scarecrowTile;
      const tileKey = x + ',' + z;

      // If something (a road, say) already swept the prop off its tile
      // there's nothing left to wake up.
      if (!scarecrowMesh || !scarecrowMesh.parent) {
        scarecrowTile = null;
        scarecrowMesh = null;
        return;
      }

      islandGroup.remove(scarecrowMesh);
      propTileKeys.delete(tileKey);
      for (let i = colliders.length - 1; i >= 0; i--) {
        if (colliders[i].x === x && colliders[i].z === z) colliders.splice(i, 1);
      }
      scarecrowMesh = null;
      scarecrowTile = null;

      const squad = createScarecrowSquad(x, z);
      raiderSquads.push(squad);
      updateWaveUI();

      const worldPos = new THREE.Vector3(x, getSurfaceY(x, z) || 0, z);
      const WAKE_COLORS = [0x141018, 0x141018, SCARECROW_STRAW_COLOR, SCARECROW_EYE_GLOW, 0x8a2be2];
      for (let i = 0; i < 18; i++) {
        const color = WAKE_COLORS[Math.floor(Math.random() * WAKE_COLORS.length)];
        spawnParticle(worldPos.clone().add(new THREE.Vector3(0, 0.4 + Math.random() * 0.5, 0)), color, 0.08 + Math.random() * 0.08, 0.5 + Math.random() * 0.4, false);
      }
      spawnFloatingText(worldPos.clone().add(new THREE.Vector3(0, 1.1, 0)), 'THE SCARECROW AWAKENS!', '#ff7a2a');
      scarecrowTerrify(worldPos);
    }

    // The awakened Gargoyle raider - a single-unit "squad" exactly like
    // createScarecrowSquad above, just flying (GARGOYLE_HOVER_HEIGHT,
    // set on the returned squad object so the movement update patches
    // that check squad.isGargoyle pick it up) and armed with a ranged
    // 'gargoyleBolt' instead of a melee weapon.
    function createGargoyleSquad(x, z) {
      const group = new THREE.Group();
      const members = [];

      const unit = createGargoyleHumanoid(GARGOYLE_THEME.body);
      unit.userData.maxHp = Math.round(GARGOYLE_HP * ENEMY_NERF.hp);
      unit.userData.hp = unit.userData.maxHp;
      equipUnit(unit, 'raiders', 'gargoyleBolt');
      unit.position.set(0, 0, 0);
      group.add(unit);
      members.push(unit);

      const landY = getSurfaceY(x, z);
      group.scale.set(0.62, 0.62, 0.62);
      group.position.set(x, (landY !== null ? landY : 0) + GARGOYLE_HOVER_HEIGHT, z);
      group.userData.onBoat = false;
      scene.add(group);

      return {
        type: 'raiders',
        isGargoyle: true,
        canClimb: false,
        group,
        members,
        boat: null,
        onBoat: false,
        landingTile: { x, z, dirX: 0, dirZ: 0 },
        isMoving: false,
        targetPosition: new THREE.Vector3(),
        currentPath: [],
        currentWaypoint: 0,
        moveSpeed: 2.0 * ENEMY_NERF.speed, // faster than the Scarecrow's 1.3 - it flies
        aiCooldown: 0,
        currentTargetSquad: null,
      };
    }

    // Called once at the start of every wave (see startWave), right after
    // maybeAwakenScarecrow. Each dormant Gargoyle Statue still standing
    // (see gargoyleTiles/GARGOYLE_STATUE_COUNT) independently rolls
    // GARGOYLE_AWAKEN_CHANCE; a statue that wins is swapped for a live,
    // flying Gargoyle raider on the same tile in a burst of stone
    // fragments, exactly like the Scarecrow's wake-up above but per
    // statue rather than a single guaranteed one. A statue that loses the
    // roll (or was already swept off its tile) just keeps standing for
    // the next wave to try again.
    function maybeAwakenGargoyles() {
      if (gargoyleTiles.length === 0) return;
      const stillDormant = [];

      gargoyleTiles.forEach(tile => {
        const { x, z } = tile;
        const tileKey = x + ',' + z;
        const mesh = gargoyleMeshesByTile[tileKey];

        if (!mesh || !mesh.parent) return; // swept off its tile - gone for good
        if (Math.random() >= GARGOYLE_AWAKEN_CHANCE) { stillDormant.push(tile); return; }

        islandGroup.remove(mesh);
        delete gargoyleMeshesByTile[tileKey];
        propTileKeys.delete(tileKey);
        for (let i = colliders.length - 1; i >= 0; i--) {
          if (colliders[i].x === x && colliders[i].z === z) colliders.splice(i, 1);
        }

        const squad = createGargoyleSquad(x, z);
        raiderSquads.push(squad);
        updateWaveUI();

        const worldPos = new THREE.Vector3(x, (getSurfaceY(x, z) || 0) + 0.3, z);
        const WAKE_COLORS = [GARGOYLE_STONE_COLOR, 0x3f4245, GARGOYLE_EYE_GLOW];
        for (let i = 0; i < 16; i++) {
          const color = WAKE_COLORS[Math.floor(Math.random() * WAKE_COLORS.length)];
          spawnParticle(worldPos.clone().add(new THREE.Vector3(0, Math.random() * 0.5, 0)), color, 0.07 + Math.random() * 0.07, 0.5 + Math.random() * 0.4, false);
        }
        spawnFloatingText(worldPos.clone().add(new THREE.Vector3(0, 1.0, 0)), 'A GARGOYLE TAKES FLIGHT!', '#ff8a1a');
      });

      gargoyleTiles = stillDormant;
    }

    // Scarecrow passive (Terrify) - the instant it wakes, every player
    // Squad / Villager Militia member within SCARECROW_TERRIFY_RADIUS is
    // frightened: shoved back away from it, flinching, and unable to attack
    // for SCARECROW_TERRIFY_DURATION seconds (attacks are gated by
    // attackCooldown, so pushing that out is what actually holds them back
    // - stunTimer alone is only a flinch pose).
    function scarecrowTerrify(pos) {
      const terrifiedSquads = new Set();
      [...squads, ...militiaSquads].forEach(s => {
        s.members.forEach(member => {
          const mData = member.userData;
          if (!mData || mData.hp <= 0) return;
          const mPos = new THREE.Vector3();
          member.getWorldPosition(mPos);
          const dx = mPos.x - pos.x, dz = mPos.z - pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist > SCARECROW_TERRIFY_RADIUS) return;

          const angle = Math.random() * Math.PI * 2;
          const dir = dist > 0.001 ? new THREE.Vector3(dx / dist, 0, dz / dist) : new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
          if (mData.knockbackVel) mData.knockbackVel.add(dir.multiplyScalar(SCARECROW_TERRIFY_RECOIL));
          mData.stunTimer = Math.max(mData.stunTimer || 0, 0.4);
          mData.attackCooldown = Math.max(mData.attackCooldown || 0, SCARECROW_TERRIFY_DURATION);

          if (!terrifiedSquads.has(s)) {
            terrifiedSquads.add(s);
            spawnFloatingText(mPos.clone().add(new THREE.Vector3(0, 0.7, 0)), 'TERRIFIED!', '#c9a0ff');
          }
        });
      });
      // A ring of violet fear-wisps spreading out from the scarecrow.
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        spawnParticle(pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.5, 0.3 + Math.random() * 0.3, Math.sin(a) * 0.5)), i % 2 ? 0x8a2be2 : 0x2a1440, 0.09 + Math.random() * 0.05, 0.6 + Math.random() * 0.3, false);
      }
    }

    // Scarecrow passive (Drain) - called right after each of its melee
    // swings resolves. Heals it for SCARECROW_DRAIN_HEAL_FRACTION of the
    // damage that swing actually took off the target, so a blocked hit
    // (shield) or a miss heals nothing. hpBefore is the target's HP from
    // just before applyDamage ran.
    function scarecrowDrain(unit, target, hpBefore, attackerWorldPos) {
      const dealt = Math.max(0, hpBefore - Math.max(0, target.userData.hp));
      if (dealt <= 0) return;
      const healed = healUnit(unit, dealt * SCARECROW_DRAIN_HEAL_FRACTION);
      if (!healed) return; // already at full HP - nothing to drain into
      spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'DRAIN!', '#c9a0ff');
      const targetPos = new THREE.Vector3();
      target.getWorldPosition(targetPos);
      for (let i = 0; i < 4; i++) {
        const t = (i + 1) / 5;
        spawnParticle(new THREE.Vector3(
          targetPos.x + (attackerWorldPos.x - targetPos.x) * t,
          targetPos.y + 0.4 + Math.random() * 0.2,
          targetPos.z + (attackerWorldPos.z - targetPos.z) * t
        ), 0xb06bff, 0.07, 0.4);
      }
    }

    // Scarecrow death - triggered from killUnit for any uData.isScarecrow
    // unit, in place of the normal blood/ragdoll death. No corpse, no
    // stagger: it falls apart in a burst of straw while its crow scatters.
    function burstScarecrow(unit) {
      const uData = unit.userData;
      if (uData.hpElement) uData.hpElement.remove();

      const pos = new THREE.Vector3();
      unit.getWorldPosition(pos);
      pos.y += 0.4;

      const BURST_COLORS = [SCARECROW_STRAW_COLOR, SCARECROW_STRAW_COLOR, SCARECROW_STRAW_COLOR, 0x141018, SCARECROW_EYE_GLOW];
      for (let i = 0; i < 22; i++) {
        const color = BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)];
        spawnParticle(pos.clone(), color, 0.08 + Math.random() * 0.08, 0.5 + Math.random() * 0.3, false);
      }
      spawnFloatingText(pos, 'CROWS SCATTER!', '#c9a0ff');

      raiderSquads.forEach(s => {
        const idx = s.members.indexOf(unit);
        if (idx !== -1) s.members.splice(idx, 1);
      });
      updateWaveUI();

      // Still a raider kill - pays out the same Gold/Scroll loot.
      awardRaiderKillLoot(pos);

      if (unit.parent) unit.parent.remove(unit);
    }

    // Orc warband - erupts from the Orc Fortress gate rather than
    // landing by boat, same idea as createDemonSquad above just with
    // its own green-skinned, tusk-helmeted look and mixed Axe/Axe &
    // Shield/Bow loadout instead of a uniform Hell Trident (see
    // ORC_THEME/randomOrcWeapon and createBlockyHumanoid's isOrc
    // branch).
    function createOrcSquad(x, z, count) {
      const group = new THREE.Group();
      const members = [];

      for (let i = 0; i < count; i++) {
        const unit = createBlockyHumanoid(ORC_THEME.body, true, ORC_THEME.pants, ORC_THEME.headbandColor, false, false, false, false, null, false, false, false, false, false, false, false, false, false, true);
        equipUnit(unit, 'raiders', randomOrcWeapon());
        const col = i % 2, row = Math.floor(i / 2);
        unit.position.set(col * 0.45 - 0.225, 0, row * 0.45 - 0.225);
        group.add(unit);
        members.push(unit);
      }

      const landY = getSurfaceY(x, z);
      group.scale.set(0.6, 0.6, 0.6);
      group.position.set(x, landY !== null ? landY : 0, z);
      group.userData.onBoat = false;
      scene.add(group);

      return {
        type: 'raiders',
        isOrc: true,
        canClimb: false,
        group,
        members,
        boat: null,
        onBoat: false,
        landingTile: { x, z, dirX: 0, dirZ: 0 },
        isMoving: false,
        targetPosition: new THREE.Vector3(),
        currentPath: [],
        currentWaypoint: 0,
        moveSpeed: 1.4 * ENEMY_NERF.speed,
        aiCooldown: 0,
        currentTargetSquad: null,
      };
    }

    // Called once at the start of every wave (see startWave), right
    // alongside maybeOpenDemonPortal. If this island actually generated
    // an Orc Fortress (orcFortressTile non-null), rolls ORC_WARBAND_CHANCE
    // for it to muster a fresh Orc warband right at its own gate, with a
    // small dust/wood-chip burst to sell the gate bursting open.
    function maybeSpawnOrcWarband() {
      if (!orcFortressTile || orcFortressDestroyed || orcFortressUnarmed) return;
      if (Math.random() >= ORC_WARBAND_CHANCE) return;

      const count = ORC_WARBAND_MIN_COUNT + Math.floor(Math.random() * (ORC_WARBAND_MAX_COUNT - ORC_WARBAND_MIN_COUNT + 1));
      // Spawn at the gate, not orcFortressTile (the keep's own center) -
      // the keep interior is solid/unwalkable on every side within the
      // fortress footprint, so a squad placed there had nowhere to step
      // and got stuck in place. Fall back to the keep tile only in the
      // unexpected case a fortress exists with no recorded gate.
      const spawnTile = orcFortressGateTile || orcFortressTile;
      const squad = createOrcSquad(spawnTile.x, spawnTile.z, count);
      raiderSquads.push(squad);

      const gateWorldPos = new THREE.Vector3(spawnTile.x, getSurfaceY(spawnTile.x, spawnTile.z) || 0, spawnTile.z);
      const ORC_MUSTER_COLORS = [0x5c8a3a, 0x6b4a30, 0x4a4a48];
      for (let i = 0; i < 14; i++) {
        const color = ORC_MUSTER_COLORS[Math.floor(Math.random() * ORC_MUSTER_COLORS.length)];
        spawnParticle(gateWorldPos.clone().add(new THREE.Vector3(0, 0.4 + Math.random() * 0.3, 0)), color, 0.1 + Math.random() * 0.08, 0.5 + Math.random() * 0.3, false);
      }
      spawnFloatingText(gateWorldPos.clone().add(new THREE.Vector3(0, 0.8, 0)), 'ORCS MUSTER!', '#7bc766');
    }

    // Orc Fortress hostile behavior - how close (in world tiles) a player
    // or militia squad has to get before the fortress starts shooting at
    // it, how long it waits between shots, and the height above its own
    // tile its arrows are loosed from (the brazier atop the watchtower -
    // see createOrcFortress).
    const ORC_FORTRESS_RANGE = 2;
    const ORC_FORTRESS_SHOT_COOLDOWN = 1.4;
    const ORC_FORTRESS_FIRE_HEIGHT = 1.21 * ORC_FORTRESS_SCALE;

    // Called every frame from animate (see the updateDemonicPortals call
    // site). Unlike a raider warband, the Orc Fortress never moves and
    // never picks a committed target - it simply re-checks every live
    // player/militia squad each time its cooldown is up, and looses a
    // single arrow at a random live member of the nearest squad standing
    // within ORC_FORTRESS_RANGE. No-ops entirely when this island didn't
    // roll a Fortress (orcFortressTile is null), or once it's been sieged
    // down to 0 HP (see destroyOrcFortress/updateSquadsSiegingOrcFortress).
    function updateOrcFortress(delta) {
      if (!orcFortressTile || orcFortressDestroyed || orcFortressUnarmed) return;
      orcFortressCooldown -= delta;
      if (orcFortressCooldown > 0) return;

      const fx = orcFortressTile.x, fz = orcFortressTile.z;
      const liveAllySquads = squads.concat(militiaSquads).filter(s => s.members.length > 0);
      if (liveAllySquads.length === 0) return;

      let nearest = null, nearestDist = ORC_FORTRESS_RANGE;
      liveAllySquads.forEach(playerSquad => {
        const d = Math.hypot(playerSquad.group.position.x - fx, playerSquad.group.position.z - fz);
        if (d <= nearestDist) { nearestDist = d; nearest = playerSquad; }
      });
      if (!nearest) return;

      const liveMembers = nearest.members.filter(m => m.userData.hp > 0);
      if (liveMembers.length === 0) return;
      const targetUnit = liveMembers[Math.floor(Math.random() * liveMembers.length)];

      const fy = getSurfaceY(fx, fz) || 0;
      const startPos = new THREE.Vector3(fx, fy + ORC_FORTRESS_FIRE_HEIGHT, fz);
      // shooterUnitType 'raiders' - same dmgType bucket a plain Bow Raider's
      // arrow uses, so it doesn't inherit an Archer's Piercing Shot passive.
      spawnProjectile(startPos, targetUnit, 'arrow', 1, 'raiders');
      orcFortressCooldown = ORC_FORTRESS_SHOT_COOLDOWN;
    }

    // --- Orc Fortress Siege Panel ---
    // Tapping the fortress keep (see the pointerup handler's fortress-tap
    // check) opens this instead of issuing a normal move order. Non-modal,
    // same as the Wave panel - the fight keeps running underneath it.
    function showOrcFortressPanel() {
      if (!orcFortressTile || orcFortressDestroyed) return;
      orcFortressHpFillElement = document.getElementById('orc-fortress-hp-fill');
      updateOrcFortressPanelHp();
      updateOrcFortressPanelButton();
      renderOrcFortressSquadList();
      document.getElementById('orc-fortress-panel').classList.add('visible');
    }

    function hideOrcFortressPanel() {
      const panel = document.getElementById('orc-fortress-panel');
      if (panel) panel.classList.remove('visible');
    }

    function updateOrcFortressPanelHp() {
      if (!orcFortressHpFillElement) return;
      const pct = orcFortressMaxHp > 0 ? Math.max(0, (orcFortressHp / orcFortressMaxHp) * 100) : 0;
      orcFortressHpFillElement.style.width = pct + '%';
    }

    // Swaps the panel's single action button between its three states:
    // a plain Siege order (gate still armed), Assault the Castle (gate
    // blown - see detonateOrcFortressExplosives), or a disabled
    // in-progress label once the Assault has actually been launched (see
    // startFortressAssault/updateOrcFortressAssault). Called whenever the
    // panel is opened and right after whichever state transition changes
    // it, so it never has to be polled every frame.
    function updateOrcFortressPanelButton() {
      const btn = document.getElementById('orc-fortress-siege-btn');
      if (!btn) return;
      if (orcFortressAssaultActive) {
        btn.textContent = '⚔️ Assault Underway...';
        btn.disabled = true;
        btn.onclick = null;
      } else if (orcFortressUnarmed) {
        btn.textContent = '🏯 Assault the Castle';
        btn.disabled = false;
        btn.onclick = startFortressAssault;
      } else {
        btn.textContent = '💣 Siege';
        btn.disabled = false;
        btn.onclick = startOrcFortressSiege;
      }
      renderOrcFortressSquadList();
    }

    // Populates the panel's Recommended Squad list every time it's shown
    // or the Fortress's state changes (see showOrcFortressPanel/
    // updateOrcFortressPanelButton) - one row per squad the player has
    // fielded, so a squad can be made the active one (same as tapping its
    // bottom-bar button - see selectSquad) without leaving the panel.
    // A live Siege Engineer squad is starred as the top pick while the
    // gate's still armed, since it's the only type that can actually
    // plant a charge instead of just hacking away at the gate (see
    // updateSquadsSiegingOrcFortress); a wiped-out squad is still listed,
    // just greyed out and unselectable. Once the gate's already blown
    // (orcFortressUnarmed) there's no squad recommendation left to make,
    // so the heading and list are hidden entirely.
    function renderOrcFortressSquadList() {
      const heading = document.getElementById('orc-fortress-squad-heading');
      const tip = document.getElementById('orc-fortress-squad-tip');
      const list = document.getElementById('orc-fortress-squad-list');
      if (!heading || !tip || !list) return;

      if (orcFortressUnarmed || orcFortressDestroyed) {
        heading.style.display = 'none';
        tip.style.display = 'none';
        list.style.display = 'none';
        return;
      }
      heading.style.display = '';
      tip.style.display = '';
      list.style.display = '';

      const liveSquads = squads.filter(s => s.members.length > 0);
      const engineerSquad = liveSquads.find(s => s.type === 'siege');

      // Which squad to actually recommend, and why: a live Siege
      // Engineer always wins since it's the only type that can plant a
      // charge (see updateSquadsSiegingOrcFortress) instead of standing
      // in arrow range hacking at the gate by hand. Failing that, the
      // squad with the most live members deals the most damage per hit
      // (SIEGE_FORTRESS_DAMAGE_PER_MEMBER_MIN/MAX scales per member, the
      // same regardless of squad type), so it clears the gate fastest -
      // and fastest matters more without a charge, since the Fortress
      // keeps shooting at whoever's sieging it the whole time.
      if (engineerSquad) {
        tip.textContent = '🏗️ Send the Siege Engineer - it plants a charge that blows the gate open in 10s flat, with nobody standing in arrow range for it.';
      } else if (liveSquads.length > 0) {
        const bestSquad = liveSquads.reduce((a, b) => b.members.length > a.members.length ? b : a);
        const bestDef = squadDef(bestSquad.type) || { label: bestSquad.type };
        tip.textContent = `⚠️ No Siege Engineer on hand, so the gate has to be battered down by hand - slower, and the Fortress keeps shooting whoever's doing it. ${bestDef.label} has the most members and will chip it down fastest.`;
      } else {
        tip.textContent = '⚠️ No squads left to send. Field one before opening the gate.';
      }

      list.innerHTML = '';
      const actionBtns = document.querySelectorAll('#action-bar .action-btn');
      squads.forEach((squad, i) => {
        const def = squadDef(squad.type) || { icon: '?', label: squad.type };
        const alive = squad.members.length > 0;
        const maxMembers = def.memberCount || 4;
        const isRecommended = squad.type === 'siege' && alive;

        const row = document.createElement('div');
        row.className = 'orc-fortress-squad-row'
          + (i === selectedSquadIndex ? ' selected' : '')
          + (alive ? '' : ' wiped');
        row.innerHTML = `<span class="row-icon">${iconHtml(def)}</span>
          <span class="row-label">${def.label}</span>
          <span class="row-count">${squad.members.length}/${maxMembers}</span>
          ${isRecommended ? '<span class="row-star" title="Can plant explosives - the fastest way to disarm the gate">★</span>' : ''}`;

        if (alive) {
          row.onclick = () => {
            selectSquad(i, actionBtns[i]);
            renderOrcFortressSquadList();
          };
        }
        list.appendChild(row);
      });
    }

    // --- Siege Tent panel ---
    // Tapping the tent (see the pointerup handler's siege-tent-tap check)
    // opens this instead of issuing a normal move order. Non-modal, same
    // as the Orc Fortress/Wave panels - the fight keeps running underneath.
    function showSiegeTentPanel() {
      if (!siegeTentTile) return;
      updateSiegeTentPanelButton();
      document.getElementById('siege-tent-panel').classList.add('visible');
    }

    function hideSiegeTentPanel() {
      const panel = document.getElementById('siege-tent-panel');
      if (panel) panel.classList.remove('visible');
    }

    function updateSiegeTentPanelButton() {
      const btn = document.getElementById('siege-tent-heal-btn');
      if (!btn) return;
      btn.textContent = `💊 Heal (${SIEGE_TENT_HEAL_COST} 🪙)`;
      btn.disabled = playerGold < SIEGE_TENT_HEAL_COST;
    }

    // Fired by the Siege Tent panel's Heal button - costs SIEGE_TENT_HEAL_COST
    // gold per press and restores SIEGE_TENT_HEAL_AMOUNT HP to every
    // wounded member of any player squad currently camped within
    // SIEGE_TENT_HEAL_RANGE of the tent (healUnit no-ops on a full-health
    // or dead unit, so it never overheals or revives). Gold is only
    // actually spent if at least one unit was healed, so pressing it with
    // nobody nearby - or everybody already topped up - is a free no-op
    // rather than a wasted charge.
    function useSiegeTentHeal() {
      if (!siegeTentTile) return;
      if (playerGold < SIEGE_TENT_HEAL_COST) return;

      let healedAny = false;
      squads.forEach(squad => {
        if (squad.members.length === 0) return;
        const d = Math.hypot(squad.group.position.x - siegeTentTile.x, squad.group.position.z - siegeTentTile.z);
        if (d > SIEGE_TENT_HEAL_RANGE) return;
        squad.members.forEach(unit => {
          if (healUnit(unit, SIEGE_TENT_HEAL_AMOUNT)) healedAny = true;
        });
      });

      const groundY = getSurfaceY(siegeTentTile.x, siegeTentTile.z) || 0;
      if (!healedAny) {
        spawnFloatingText(new THREE.Vector3(siegeTentTile.x, groundY + 1.1, siegeTentTile.z), 'No one to heal', '#aaaaaa');
        return;
      }

      playerGold -= SIEGE_TENT_HEAL_COST;
      saveShopCurrencies();
      spawnFloatingText(new THREE.Vector3(siegeTentTile.x, groundY + 1.1, siegeTentTile.z), `-${SIEGE_TENT_HEAL_COST} 🪙`, '#ffd700');
      updateSiegeTentPanelButton();
    }

    // --- Captured Fortress panel ---
    // Once orcFortressDestroyed (conquered - see destroyOrcFortress),
    // tapping the keep's footprint opens this instead of the old Siege
    // Garrison and Heal are both free - Replenish (which actually
    // conjures brand-new squad members, not just repositioning or
    // restoring HP on ones already alive) still costs gold.
    const CAPTURED_FORTRESS_ACTION_COST = 50;

    function showCapturedFortressPanel() {
      if (!orcFortressTile || !orcFortressDestroyed) return;
      updateCapturedFortressPanelButtons();
      document.getElementById('captured-fortress-panel').classList.add('visible');
    }

    function hideCapturedFortressPanel() {
      const panel = document.getElementById('captured-fortress-panel');
      if (panel) panel.classList.remove('visible');
    }

    function updateCapturedFortressPanelButtons() {
      const replenishAffordable = playerGold >= CAPTURED_FORTRESS_ACTION_COST;
      const garrisonBtn = document.getElementById('captured-fortress-garrison-btn');
      const healBtn = document.getElementById('captured-fortress-heal-btn');
      const replenishBtn = document.getElementById('captured-fortress-replenish-btn');
      if (garrisonBtn) { garrisonBtn.textContent = '🏰 Garrison All Units (Free)'; garrisonBtn.disabled = false; }
      if (healBtn) { healBtn.textContent = '💊 Heal Units (Free)'; healBtn.disabled = false; }
      if (replenishBtn) { replenishBtn.textContent = `➕ Replenish Squad (${CAPTURED_FORTRESS_ACTION_COST} 🪙)`; replenishBtn.disabled = !replenishAffordable; }
    }

    // Garrison All Units - sends every live player squad inside the
    // captured keep and hides them there, free of charge, the same
    // "climb inside and go hidden, invisible and untargetable until
    // recalled" treatment a Siege Engineer squad gets operating a Watch
    // Tower (see updateSiegeEngineerSupport/isOperatingTower) - just
    // applied to every squad at once here instead of one at a time.
    // isGarrisonedAtFortress is checked in updateCombatSystem (keeps them
    // out of allPlayerUnits entirely - no raider target, no HP bar) and
    // in findRaiderTarget (no warband ever beelines for a garrisoned
    // squad). A squad only comes back out - visible and targetable again
    // - the moment the player gives it its next move order (see the
    // pointerup handler's squadIsGarrisonedAtFortress eject branch),
    // exactly mirroring how a tower operator squad ejects.
    //
    // The exact spot a squad is parked at while hidden doesn't matter -
    // nothing renders and nothing paths there - so every squad is simply
    // teleported straight onto orcFortressTile itself (the keep's own
    // center tile) rather than fanned across separate tiles.
    function fortressGateExitTile() {
      const gate = orcFortressGateTile || orcFortressTile;
      const dirX = Math.sign(gate.x - orcFortressTile.x);
      const dirZ = Math.sign(gate.z - orcFortressTile.z);
      let tx = gate.x + dirX, tz = gate.z + dirZ;
      if (!isTileWalkable(tx, tz) || buildingTileKeys.has(tx + ',' + tz)) {
        const fallback = nearestWalkableNeighbor(tx, tz);
        if (fallback) { tx = fallback.x; tz = fallback.z; }
      }
      return { x: tx, z: tz };
    }

    function garrisonAllUnitsAtFortress() {
      if (!orcFortressTile || !orcFortressDestroyed) return;

      const groundY = getSurfaceY(orcFortressTile.x, orcFortressTile.z) || 0;
      const liveSquads = squads.filter(s => s.members.length > 0 && !s.isGarrisonedAtFortress);
      if (liveSquads.length === 0) {
        spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + 1.6, orcFortressTile.z), 'No squads to garrison', '#aaaaaa');
        return;
      }

      liveSquads.forEach(s => {
        s.group.position.set(orcFortressTile.x, groundY, orcFortressTile.z);
        s.currentPath = [];
        s.currentWaypoint = 0;
        s.isMoving = false;
        if (s.targetPosition) s.targetPosition.copy(s.group.position);
        s.isGarrisonedAtFortress = true;
        s.members.forEach(m => {
          if (m.userData.hp <= 0) return;
          m.userData.isGarrisonedAtFortress = true;
          m.visible = false;
          if (m.userData.hpElement) m.userData.hpElement.style.display = 'none';
        });
      });

      spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + 1.6, orcFortressTile.z), 'Garrisoned inside the Fortress!', '#66ff88');
      updateCapturedFortressPanelButtons();
    }

    // Heal Units - same shape as useSiegeTentHeal, just applied to every
    // live player squad island-wide rather than only ones camped nearby -
    // the captured keep is a proper home base now, not a battlefield
    // outpost with a short healing radius. Free.
    function healUnitsAtCapturedFortress() {
      if (!orcFortressTile || !orcFortressDestroyed) return;

      let healedAny = false;
      squads.forEach(squad => {
        squad.members.forEach(unit => {
          if (healUnit(unit, SIEGE_TENT_HEAL_AMOUNT)) healedAny = true;
        });
      });

      const groundY = getSurfaceY(orcFortressTile.x, orcFortressTile.z) || 0;
      if (!healedAny) {
        spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + 1.6, orcFortressTile.z), 'No one to heal', '#aaaaaa');
        return;
      }

      spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + 1.6, orcFortressTile.z), 'Healed!', '#66ff88');
      updateCapturedFortressPanelButtons();
    }

    // Replenish Squad - refills the currently selected squad back up to
    // its full member count (see reviveNextSquadMember, the same per-
    // member revival the Doctor's Resurrection passive uses) for one
    // flat cost regardless of how many members are actually missing.
    function replenishSquadAtCapturedFortress() {
      if (!orcFortressTile || !orcFortressDestroyed) return;
      if (playerGold < CAPTURED_FORTRESS_ACTION_COST) return;

      const groundY = getSurfaceY(orcFortressTile.x, orcFortressTile.z) || 0;
      // Targets the selected squad if it's under strength; otherwise the
      // first wiped-out squad (those can't be selected), then any other
      // under-strength squad.
      const needsMembers = sq => !!sq && sq.members.length < ((squadDef(sq.type) || {}).memberCount || 4);
      let squad = squads[selectedSquadIndex];
      if (!needsMembers(squad)) {
        squad = squads.find(sq => sq.members.length === 0) || squads.find(needsMembers) || squad;
      }
      if (!squad) return;
      const maxMembers = (squadDef(squad.type) || {}).memberCount || 4;
      if (squad.members.length >= maxMembers) {
        spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + 1.6, orcFortressTile.z), 'Already at full strength', '#aaaaaa');
        return;
      }

      while (squad.members.length < maxMembers) {
        if (!reviveNextSquadMember(squad)) break;
      }

      playerGold -= CAPTURED_FORTRESS_ACTION_COST;
      saveShopCurrencies();
      updateSquadCountUI();
      spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + 1.6, orcFortressTile.z), 'Squad Replenished!', '#66ff88');
      updateCapturedFortressPanelButtons();
    }

    // Fired by the panel's Siege button - sends whichever squad is
    // currently selected to march on the Fortress's gate (its only
    // walkable approach - see orcFortressGateTile) and flags it to start
    // chipping away at orcFortressHp once it arrives (see
    // updateSquadsSiegingOrcFortress). Same findPath/currentPath plumbing
    // as a normal tap-to-move order, just aimed at the gate tile instead
    // of wherever was tapped.
    // Which of the wall ring's 4 edge-midpoints (see orcFortressSideTiles)
    // is nearest to a given world position - used by startOrcFortressSiege
    // to figure out which side a squad is actually attacking from.
    function nearestOrcFortressSide(fromX, fromZ) {
      const dx = fromX - orcFortressTile.x;
      const dz = fromZ - orcFortressTile.z;
      if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 'E' : 'W';
      return dz >= 0 ? 'S' : 'N';
    }

    // Reseals the currently-open side of the wall ring and knocks a
    // fresh gap in whichever side is passed in - the "gate" isn't a
    // fixed door, just whichever edge-midpoint wall segment happens to
    // be missing right now (see orcFortressSideTiles/orcFortressOpenSide,
    // set up once per Fortress in generateRandomIsland). No-ops if that
    // side is already the open one.
    function relocateOrcFortressGate(newSide) {
      if (!orcFortressSideTiles || newSide === orcFortressOpenSide) return;

      const oldTile = orcFortressSideTiles[orcFortressOpenSide];
      const newTile = orcFortressSideTiles[newSide];
      const oldKey = oldTile.x + ',' + oldTile.z;
      const newKey = newTile.x + ',' + newTile.z;

      // Seal the old gap back up with a fresh wall segment.
      const groundY = getSurfaceY(oldTile.x, oldTile.z);
      if (groundY !== null) {
        const wall = createOrcFortressWall(oldTile.x, groundY, oldTile.z);
        islandGroup.add(wall);
        orcFortressWallMeshes[oldKey] = wall;
        orcFortressPickMeshes.push(wall);
        buildingTileKeys.add(oldKey);
      }

      // Knock the new side open.
      const existingWall = orcFortressWallMeshes[newKey];
      if (existingWall) {
        islandGroup.remove(existingWall);
        delete orcFortressWallMeshes[newKey];
      }
      buildingTileKeys.delete(newKey);

      orcFortressGateTile = newTile;
      orcFortressOpenSide = newSide;
    }

    function startOrcFortressSiege() {
      if (!orcFortressTile || !orcFortressGateTile || orcFortressDestroyed || orcFortressUnarmed) return;
      const squad = squads[selectedSquadIndex];
      hideOrcFortressPanel();
      if (!squad || squad.members.length === 0) return;

      // Blow the gap open on whichever side of the wall ring the squad
      // is actually attacking from, instead of always sending it all the
      // way around to one fixed opening.
      relocateOrcFortressGate(nearestOrcFortressSide(squad.group.position.x, squad.group.position.z));

      squad.isSiegingFortress = true;
      squad.fortressPlantTimer = null;
      squad.fortressFuseTimer = null;
      squad.fortressAttackCooldown = 0;

      const canParkour = canSquadParkour(squad.type);
      const goalX = orcFortressGateTile.x, goalZ = orcFortressGateTile.z;
      const blockedKeys = collidableSquadBlockedKeys(squad);
      const path = findPath(squad.group.position.x, squad.group.position.z, goalX, goalZ, true, false, canParkour, blockedKeys);
      if (path && path.length > 0) {
        squad.currentPath = path;
        squad.currentWaypoint = 0;
        squad.moveGoal = { x: goalX, z: goalZ };
        squad.moveGoalCanParkour = canParkour;
        squad.repathCooldown = 0;
        squad.repathFailStreak = 0;
        const firstStep = path[0];
        squad.targetPosition.set(firstStep.x, surfaceYFor(firstStep.x, firstStep.z, canParkour) ?? squad.group.position.y, firstStep.z);
        squad.isMoving = true;
        squad.group.userData.isMoving = true;
        squad.members.forEach(unit => unit.userData.isWalking = true);

        const startDx = squad.targetPosition.x - squad.group.position.x;
        const startDz = squad.targetPosition.z - squad.group.position.z;
        const startDir = new THREE.Vector3();
        if (Math.abs(startDx) > 0.05) startDir.set(Math.sign(startDx), 0, 0);
        else startDir.set(0, 0, Math.sign(startDz));
        squad.group.rotation.y = Math.atan2(startDir.x, startDir.z);

        targetHighlight.position.set(goalX, (surfaceYFor(goalX, goalZ, canParkour) ?? squad.group.position.y) + 0.51, goalZ);
        targetHighlight.visible = true;
        showAttackArea(squad, goalX, goalZ, surfaceYFor(goalX, goalZ, canParkour) ?? squad.group.position.y);
      }
      spawnFloatingText(new THREE.Vector3(goalX, (getSurfaceY(goalX, goalZ) || 0) + 1.2, goalZ), 'SIEGE!', '#ff8844');
    }

    // Per-frame loop for whichever squad(s) currently have
    // isSiegingFortress set (see startOrcFortressSiege). Only one squad
    // can usefully be sieging at once in practice (the gate is a single
    // tile), but nothing here assumes that. A Siege Engineer squad
    // (squad.type === 'siege') plants a timed charge instead of
    // fighting - see the fortressFuseTimer/fortressPlantTimer branch.
    // Every other squad has no charge to plant, so it just hacks away at
    // the gate directly, same shape as updateRaidersAttackingWatchTower
    // run in the opposite direction - chipping down orcFortressHp until
    // it hits 0, at which point the gate gives out and disarms the
    // Fortress exactly like a detonated charge would (see
    // disarmOrcFortress), just without the explosion.
    // How long the Siege Engineer spends planting the charge at the
    // gate, and how long the fuse burns after that before it actually
    // goes off (see updateSquadsSiegingOrcFortress/
    // detonateOrcFortressExplosives).
    const ORC_FORTRESS_PLANT_TIME = 5;
    const ORC_FORTRESS_FUSE_TIME = 5;
    const SIEGE_FORTRESS_ATTACK_INTERVAL = 1.4;
    const SIEGE_FORTRESS_DAMAGE_PER_MEMBER_MIN = 4;
    const SIEGE_FORTRESS_DAMAGE_PER_MEMBER_MAX = 8;
    function updateSquadsSiegingOrcFortress(delta) {
      if (!orcFortressTile || orcFortressDestroyed || orcFortressUnarmed) return;

      squads.forEach(squad => {
        if (!squad.isSiegingFortress || squad.members.length === 0) return;
        if (squad.isMoving) return; // still marching in, not engaging yet

        const dist = Math.hypot(squad.group.position.x - orcFortressTile.x, squad.group.position.z - orcFortressTile.z);
        if (dist > ORC_FORTRESS_SIEGE_RANGE) return;

        const liveMembers = squad.members.filter(m => m.userData.hp > 0);
        if (liveMembers.length === 0) return;

        // Only a Siege Engineer carries a charge to plant - everyone
        // else falls through to the plain melee-attack branch below.
        if (squad.type !== 'siege') {
          squad.fortressAttackCooldown = (squad.fortressAttackCooldown || 0) - delta;
          if (squad.fortressAttackCooldown > 0) return;
          squad.fortressAttackCooldown = SIEGE_FORTRESS_ATTACK_INTERVAL;

          const perMember = SIEGE_FORTRESS_DAMAGE_PER_MEMBER_MIN + Math.random() * (SIEGE_FORTRESS_DAMAGE_PER_MEMBER_MAX - SIEGE_FORTRESS_DAMAGE_PER_MEMBER_MIN);
          const dmg = Math.round(perMember * liveMembers.length);
          orcFortressHp = Math.max(0, orcFortressHp - dmg);
          updateOrcFortressPanelHp();

          const groundY = getSurfaceY(orcFortressTile.x, orcFortressTile.z) || 0;
          spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + ORC_FORTRESS_FIRE_HEIGHT, orcFortressTile.z), '-' + dmg, '#ffcc66');

          // Same generic sword-swing pose every melee unit already uses
          // for an attack (see applyAttackPose) - triggered directly
          // since there's no player-unit/raider-unit target here to
          // route through the normal per-unit attack loop that would
          // otherwise set this.
          liveMembers.forEach(m => {
            m.userData.attackAnimTimer = m.userData.attackAnimDuration || 0.4;
          });

          if (orcFortressHp <= 0) disarmOrcFortress(false);
          return;
        }

        // The charge is already planted and just counting down to the
        // detonation - no more hammering to animate here.
        if (squad.fortressFuseTimer != null) {
          squad.fortressFuseTimer -= delta;
          if (squad.fortressFuseTimer <= 0) detonateOrcFortressExplosives(squad);
          return;
        }

        if (squad.fortressPlantTimer == null) {
          squad.fortressPlantTimer = 0;
          const groundY = getSurfaceY(orcFortressTile.x, orcFortressTile.z) || 0;
          spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + 1.2, orcFortressTile.z), 'Planting Explosives...', '#ffcc66');
        }
        squad.fortressPlantTimer += delta;

        // Same hammering bob a Siege Engineer plays while building a
        // Watch Tower (see updateSiegeEngineerSupport) - sells "working"
        // rather than idly standing at the gate for 5 seconds.
        liveMembers.forEach(m => {
          const swing = Math.sin(squad.fortressPlantTimer * 9) * 0.5;
          if (m.userData.armR) m.userData.armR.rotation.x = -swing;
        });

        if (squad.fortressPlantTimer >= ORC_FORTRESS_PLANT_TIME) {
          squad.fortressPlantTimer = null;
          squad.fortressFuseTimer = ORC_FORTRESS_FUSE_TIME;
          const groundY = getSurfaceY(orcFortressTile.x, orcFortressTile.z) || 0;
          spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + 1.2, orcFortressTile.z), 'Explosives Planted!', '#ff8844');
        }
      });
    }

    // Shared disarm transition - silences the Fortress's own arrow fire
    // and warband musters for good (see the orcFortressUnarmed checks in
    // updateOrcFortress/maybeSpawnOrcWarband) and frees every squad that
    // was sieging it back to normal control. Reached either by a Siege
    // Engineer's charge going off (see detonateOrcFortressExplosives,
    // withExplosion true) or by any other squad simply battering
    // orcFortressHp down to 0 (withExplosion false - the gate just gives
    // out, no boom). The keep itself is left standing either way - only
    // an Assault the Castle push (see startFortressAssault) against
    // whatever defenders are left actually brings it down.
    function disarmOrcFortress(withExplosion) {
      if (!orcFortressTile || orcFortressDestroyed || orcFortressUnarmed) return;
      orcFortressUnarmed = true;
      squads.forEach(s => { s.isSiegingFortress = false; s.fortressPlantTimer = null; s.fortressFuseTimer = null; });

      const groundY = getSurfaceY(orcFortressTile.x, orcFortressTile.z) || 0;
      if (withExplosion) {
        const boomPos = new THREE.Vector3(orcFortressTile.x, groundY + ORC_FORTRESS_FIRE_HEIGHT, orcFortressTile.z);
        const BOOM_COLORS = [0xffaa33, 0xff5522, 0x554433, 0x222222];
        for (let i = 0; i < 30; i++) {
          const color = BOOM_COLORS[Math.floor(Math.random() * BOOM_COLORS.length)];
          spawnParticle(boomPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, Math.random() * 1.2, (Math.random() - 0.5) * 1.4)), color, 0.12 + Math.random() * 0.12, 0.7 + Math.random() * 0.4, false);
        }
      }
      spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + 1.6, orcFortressTile.z), 'FORTRESS DISARMED!', '#ff5544');

      updateOrcFortressPanelButton();
    }

    // Fires once the planted charge's fuse (see updateSquadsSiegingOrcFortress)
    // runs out - just the explosion flavor of disarmOrcFortress above.
    function detonateOrcFortressExplosives(squad) {
      disarmOrcFortress(true);
    }

    // --- Castle Interior map (Assault the Castle) ---
    // Fired by the panel's "Assault the Castle" button, which only
    // appears once the gate's been blown (see detonateOrcFortressExplosives).
    // Rather than mustering the last defenders in place on the main
    // island, this now swaps the whole view over to a separate walled
    // courtyard map (see enterCastleInterior) - orc hovels, farm patches,
    // cages and corpses dressing the ground, a full warband holding it,
    // no water anywhere inside the walls, and every player squad still
    // standing storming in as the attacker.
    function startFortressAssault() {
      if (!orcFortressTile || !orcFortressGateTile || orcFortressDestroyed || !orcFortressUnarmed || orcFortressAssaultActive) return;
      orcFortressAssaultActive = true;
      hideOrcFortressPanel();
      enterCastleInterior();
    }

    const CASTLE_INTERIOR_ORIGIN = { x: 400, z: 400 }; // far outside any real island's own coordinate range, so its tiles/colliders never collide with the outer world's
    const CASTLE_INTERIOR_SIZE = 20; // a generous walled courtyard - "larger castle grounds" rather than a tight arena
    const CASTLE_INTERIOR_DEFENDER_SQUAD_SIZE = 6;
    const CASTLE_INTERIOR_DEFENDER_SQUAD_COUNT = 4; // ~24 orcs total, spread across the grounds rather than clumped at the gate
    const CASTLE_INTERIOR_HOUSE_COUNT = 5;
    const CASTLE_INTERIOR_FARM_COUNT = 4;
    const CASTLE_INTERIOR_CAGE_COUNT = 3;
    const CASTLE_INTERIOR_CORPSE_COUNT = 6;
    const CASTLE_INTERIOR_TREE_COUNT = 8;
    const CASTLE_INTERIOR_BUSH_COUNT = 6;

    // Builds the walled, all-land courtyard beyond the Fortress's blown
    // gate into castleInteriorGroup: every tile is land (no water inside
    // the walls at all), ringed by a palisade with a single gate gap the
    // player enters through, and dressed with orc hovels, farm patches,
    // cages and corpses. Returns the layout enterCastleInterior needs
    // (which heightMap/buildingTileKeys keys it added, the gate/spawn
    // tile, and where the defender squads should muster) so
    // retreatToOuterIsland can undo exactly this and nothing else.
    function buildCastleInteriorMap() {
      while (castleInteriorGroup.children.length > 0) {
        castleInteriorGroup.remove(castleInteriorGroup.children[0]);
      }

      const half = CASTLE_INTERIOR_SIZE / 2;
      const ox = CASTLE_INTERIOR_ORIGIN.x, oz = CASTLE_INTERIOR_ORIGIN.z;
      const addedHeightKeys = [];
      const addedBuildingKeys = [];

      // Flat land, every tile - the point of "no water only land inside
      // of walls" is automatic here: the courtyard is fully tiled with
      // ground and ringed by walls, so the sea plane never shows through.
      for (let dx = -half; dx < half; dx++) {
        for (let dz = -half; dz < half; dz++) {
          const x = ox + dx, z = oz + dz;
          const key = x + ',' + z;
          heightMap[key] = 1;
          addedHeightKeys.push(key);
          const mat = Math.random() > 0.9 ? sandMat : grassMat;
          const block = new THREE.Mesh(cubeGeo, mat);
          block.position.set(x, 0, z);
          block.castShadow = true;
          block.receiveShadow = true;
          castleInteriorGroup.add(block);
          // Movement grid outline - same createTileOutline used for every
          // outer-island tile (see gridGroup above), just added straight
          // into castleInteriorGroup instead of the separate gridGroup:
          // that group only ever covers the outer island's own coordinate
          // range, and this courtyard sits far outside it (see
          // CASTLE_INTERIOR_ORIGIN). Parenting it here means it's cleared
          // and rebuilt for free every time this function reruns, same as
          // every other courtyard prop, with no extra bookkeeping needed.
          castleInteriorGroup.add(createTileOutline(x, 0.51, z));
        }
      }

      // Perimeter wall, with a single gate gap on the south edge where the
      // player's squads muster in through the blown gate.
      const gateTile = { x: ox, z: oz + half - 1 };
      for (let dx = -half; dx < half; dx++) {
        for (let dz = -half; dz < half; dz++) {
          const onEdge = dx === -half || dx === half - 1 || dz === -half || dz === half - 1;
          if (!onEdge) continue;
          const x = ox + dx, z = oz + dz;
          if (x === gateTile.x && z === gateTile.z) continue; // the gate gap itself - left open
          const key = x + ',' + z;
          const alongX = (dz === -half || dz === half - 1); // north/south edges run east-west; east/west edges run north-south
          const wall = createCastleWallSegment(x, 0.5, z, alongX);
          castleInteriorGroup.add(wall);
          buildingTileKeys.add(key);
          addedBuildingKeys.push(key);
        }
      }

      // Scatter houses/farms/cages/corpses (and pick defender muster
      // spots) across the inner tiles, staying clear of the wall ring and
      // the entry lane just past the gate.
      const usedKeys = new Set();
      function randomInnerTile() {
        for (let tries = 0; tries < 40; tries++) {
          const dx = Math.floor(-half + 1.5 + Math.random() * (CASTLE_INTERIOR_SIZE - 3));
          const dz = Math.floor(-half + 1.5 + Math.random() * (CASTLE_INTERIOR_SIZE - 3));
          const x = ox + dx, z = oz + dz;
          const key = x + ',' + z;
          if (usedKeys.has(key)) continue;
          if (Math.abs(x - gateTile.x) < 3 && Math.abs(z - gateTile.z) < 3) continue; // keep the entry lane clear
          usedKeys.add(key);
          return { x, z, key };
        }
        return null;
      }

      for (let i = 0; i < CASTLE_INTERIOR_HOUSE_COUNT; i++) {
        const t = randomInnerTile(); if (!t) continue;
        castleInteriorGroup.add(createOrcHovel(t.x, 0.5, t.z));
        buildingTileKeys.add(t.key);
        addedBuildingKeys.push(t.key);
      }
      for (let i = 0; i < CASTLE_INTERIOR_FARM_COUNT; i++) {
        const t = randomInnerTile(); if (!t) continue;
        castleInteriorGroup.add(createOrcFarmPatch(t.x, 0.5, t.z)); // walkable, no buildingTileKeys entry
      }
      for (let i = 0; i < CASTLE_INTERIOR_CAGE_COUNT; i++) {
        const t = randomInnerTile(); if (!t) continue;
        castleInteriorGroup.add(createOrcCage(t.x, 0.5, t.z));
        buildingTileKeys.add(t.key);
        addedBuildingKeys.push(t.key);
      }
      for (let i = 0; i < CASTLE_INTERIOR_CORPSE_COUNT; i++) {
        const t = randomInnerTile(); if (!t) continue;
        castleInteriorGroup.add(createOrcCorpseProp(t.x, 0.5, t.z)); // walkable ground dressing
      }

      // Trees and bushes - the same scenery props scattered across every
      // outer island (see createSceneryTree/createBush and generateRandomIsland's
      // propPlan loop), planted here too so the courtyard doesn't read as
      // barren dirt inside the walls. Like a tree/bush anywhere else on
      // the island, each one blocks that tile for pathfinding
      // (propTileKeys) and counts as Ninja/Slasher stealth cover
      // (stealthTileKeys) - tracked in addedPropKeys so
      // retreatToOuterIsland can undo exactly these entries, the same way
      // it already undoes addedHeightKeys/addedBuildingKeys.
      const addedPropKeys = [];
      for (let i = 0; i < CASTLE_INTERIOR_TREE_COUNT; i++) {
        const t = randomInnerTile(); if (!t) continue;
        const jx = t.x + (Math.random() - 0.5) * 0.2;
        const jz = t.z + (Math.random() - 0.5) * 0.2;
        castleInteriorGroup.add(createSceneryTree(jx, 0.5, jz));
        propTileKeys.add(t.key);
        stealthTileKeys.add(t.key);
        addedPropKeys.push(t.key);
      }
      for (let i = 0; i < CASTLE_INTERIOR_BUSH_COUNT; i++) {
        const t = randomInnerTile(); if (!t) continue;
        const jx = t.x + (Math.random() - 0.5) * 0.14;
        const jz = t.z + (Math.random() - 0.5) * 0.14;
        castleInteriorGroup.add(createBush(jx, 0.5, jz));
        propTileKeys.add(t.key);
        stealthTileKeys.add(t.key);
        addedPropKeys.push(t.key);
      }

      const defenderSpawnTiles = [];
      for (let i = 0; i < CASTLE_INTERIOR_DEFENDER_SQUAD_COUNT; i++) {
        defenderSpawnTiles.push(randomInnerTile() || { x: ox, z: oz });
      }

      return {
        addedHeightKeys,
        addedBuildingKeys,
        addedPropKeys,
        gateTile,
        spawnTile: { x: gateTile.x, z: gateTile.z - 1 }, // just inside the gate
        defenderSpawnTiles,
      };
    }

    // Swaps the view from the main island over to the walled Castle
    // Interior map: stashes exactly what needs restoring later (see
    // retreatToOuterIsland), builds the courtyard, mans it with a full
    // orc warband spread across the grounds, and marches every live
    // player squad in through the gate as the attacker.
    function enterCastleInterior() {
      if (inCastleInterior) return;
      inCastleInterior = true;
      castleInteriorCleared = false;

      const preColliderCount = colliders.length;
      const layout = buildCastleInteriorMap();

      castleInteriorState = {
        addedHeightKeys: layout.addedHeightKeys,
        addedBuildingKeys: layout.addedBuildingKeys,
        addedPropKeys: layout.addedPropKeys,
        preColliderCount,
        gateTile: layout.gateTile,
        spawnTile: layout.spawnTile,
        raiderSquads: raiderSquads.slice(),
        cameraPosition: camera.position.clone(),
        controlsTarget: controls.target.clone(),
        squadPositions: new Map(squads.map(s => [s, s.group.position.clone()])),
        // The outer island's own sky/fog (whatever the active Biome
        // Theme set - see applyBiomeTheme) - stashed so
        // retreatToOuterIsland can put it back exactly, the same way it
        // restores camera/squad positions.
        sceneBackground: scene.background ? scene.background.clone() : null,
        sceneFog: scene.fog,
      };

      // Swap the open sky for a close, enclosed backdrop the color of the
      // Fortress's own log walls (see orcLogMat/orcLogDarkMat) - the
      // courtyard is walled in on every side, so the horizon should read
      // as timber ramparts hemming the view in rather than the same open
      // sky as the outer island. A matching FogExp2 fades anything past
      // the walls into that same wood-brown instead of the usual blue/
      // haze, so the far side of the courtyard visually dissolves into
      // "wall" rather than showing empty sky over the palisade.
      scene.background = new THREE.Color(0x2a1c10);
      scene.fog = new THREE.FogExp2(0x241a11, 0.045);

      // Hide the outer island - its own tiles/props/colliders are left
      // exactly as they are, just out of view while the interior is up.
      islandGroup.visible = false;
      gridGroup.visible = false;
      water.visible = false;
      castleInteriorGroup.visible = true;

      // The last defenders now hold the whole courtyard rather than
      // mustering in place - isFortressDefenders marks every squad so
      // updateOrcFortressAssault can tell when the keep's last stand has
      // actually been cleared. If a previous assault was retreated from
      // partway through, orcFortressSurvivingDefenderCount holds how many
      // orcs made it out alive - the garrison is rebuilt at that reduced
      // strength (spread across the same spawn tiles, smallest squads
      // first) instead of back at full CASTLE_INTERIOR_DEFENDER_SQUAD_SIZE
      // each, so retreating no longer heals the garrison back to full.
      raiderSquads.length = 0;
      let remainingToSpawn = orcFortressSurvivingDefenderCount != null
        ? orcFortressSurvivingDefenderCount
        : layout.defenderSpawnTiles.length * CASTLE_INTERIOR_DEFENDER_SQUAD_SIZE;
      layout.defenderSpawnTiles.forEach(t => {
        if (remainingToSpawn <= 0) return;
        const squadSize = Math.min(CASTLE_INTERIOR_DEFENDER_SQUAD_SIZE, remainingToSpawn);
        remainingToSpawn -= squadSize;
        const squad = createOrcSquad(t.x, t.z, squadSize);
        squad.isFortressDefenders = true;
        squad.isCastleInteriorDefender = true;
        raiderSquads.push(squad);
      });
      orcFortressSurvivingDefenderCount = null;

      // Every player squad still standing storms in through the gate
      // together - "you are the attackers" now. Fanned out on whole
      // tile-center offsets (not fractional 0.5 spacing) so every squad
      // actually lands centered on one of the grid tiles just added in
      // buildCastleInteriorMap, instead of straddling the line between
      // two tiles. The entry lane right around spawnTile is kept clear of
      // trees/bushes (see randomInnerTile's exclusion zone), so every one
      // of these offsets is guaranteed open ground.
      const spawn = layout.spawnTile;
      const spawnY = getSurfaceY(spawn.x, spawn.z) || 0;
      const CASTLE_SPAWN_OFFSETS = [
        { x: 0, z: 0 }, { x: -1, z: 0 }, { x: 1, z: 0 },
        { x: -1, z: -1 }, { x: 0, z: -1 }, { x: 1, z: -1 },
        { x: -2, z: 0 }, { x: 2, z: 0 },
        { x: -2, z: -1 }, { x: 2, z: -1 },
      ];
      squads.forEach((s, i) => {
        const off = CASTLE_SPAWN_OFFSETS[i] || CASTLE_SPAWN_OFFSETS[CASTLE_SPAWN_OFFSETS.length - 1];
        const tx = spawn.x + off.x, tz = spawn.z + off.z;
        const ty = getSurfaceY(tx, tz) ?? spawnY;
        s.group.position.set(tx, ty, tz);
        s.currentPath = [];
        s.currentWaypoint = 0;
        s.isMoving = false;
        if (s.targetPosition) s.targetPosition.copy(s.group.position);
      });

      camera.position.set(spawn.x, 14, spawn.z + 10);
      controls.target.set(spawn.x, 1.5, spawn.z);
      controls.update();

      document.getElementById('retreat-btn').style.display = 'block';
      updateWaveUI();
      updateOrcFortressPanelButton();

      spawnFloatingText(new THREE.Vector3(spawn.x, spawnY + 1.2, spawn.z), 'ASSAULT THE CASTLE!', '#ff8844');
    }

    // Fired by the Retreat button (visible only while inCastleInterior),
    // and how leaving the courtyard always resolves whether the assault
    // was won or abandoned partway through. Restores exactly what
    // enterCastleInterior stashed - the outer island's own tiles/
    // colliders were never touched, just left alone underneath.
    function retreatToOuterIsland() {
      if (!inCastleInterior) return;
      const wasCleared = castleInteriorCleared;
      const state = castleInteriorState;

      // Abandon whatever's left of the assault inside - any surviving
      // defenders are cleared out along with the interior map itself;
      // orcFortressUnarmed stays true so the panel's button just offers
      // "Assault the Castle" again for another attempt (see
      // updateOrcFortressPanelButton). Their count is saved first (unless
      // the assault was actually won) so the next attempt musters that
      // many orcs instead of a fresh full garrison - see
      // orcFortressSurvivingDefenderCount and enterCastleInterior.
      if (!wasCleared) {
        orcFortressSurvivingDefenderCount = raiderSquads
          .filter(s => s.isFortressDefenders)
          .reduce((sum, s) => sum + s.members.length, 0);
      }
      raiderSquads.forEach(s => removeSquadFromScene(s));
      raiderSquads.length = 0;
      raiderSquads.push(...state.raiderSquads);
      orcFortressAssaultActive = false;

      state.addedHeightKeys.forEach(k => delete heightMap[k]);
      state.addedBuildingKeys.forEach(k => buildingTileKeys.delete(k));
      // Trees/bushes planted by buildCastleInteriorMap (see addedPropKeys
      // there) only ever mark propTileKeys/stealthTileKeys - never
      // buildingTileKeys - so they need their own cleanup here too, same
      // reasoning as the height/building keys just above: this is a
      // fixed-coordinate courtyard (CASTLE_INTERIOR_ORIGIN) reused by
      // every future assault, so stale entries left behind would
      // permanently block tiles a later castle interior plants nothing on.
      if (state.addedPropKeys) {
        state.addedPropKeys.forEach(k => { propTileKeys.delete(k); stealthTileKeys.delete(k); });
      }
      colliders.length = state.preColliderCount;

      // Swap the Fortress-wall backdrop (see enterCastleInterior) back
      // for whichever sky/fog the outer island's own Biome Theme had -
      // restoring the exact stashed color/fog rather than re-deriving it
      // from selectedBiomeTheme, since Shadow Island rolls one of two
      // looks per generation (see shadowIslandVariant) and re-deriving
      // could land on the wrong one.
      if (state.sceneBackground) scene.background = state.sceneBackground;
      scene.fog = state.sceneFog;

      castleInteriorGroup.visible = false;
      while (castleInteriorGroup.children.length > 0) {
        castleInteriorGroup.remove(castleInteriorGroup.children[0]);
      }
      islandGroup.visible = true;
      gridGroup.visible = true;
      water.visible = true;

      camera.position.copy(state.cameraPosition);
      controls.target.copy(state.controlsTarget);
      controls.update();

      squads.forEach(s => {
        const pos = state.squadPositions.get(s);
        if (!pos) return;
        s.group.position.copy(pos);
        s.currentPath = [];
        s.currentWaypoint = 0;
        s.isMoving = false;
        if (s.targetPosition) s.targetPosition.copy(pos);
      });

      inCastleInterior = false;
      castleInteriorCleared = false;
      castleInteriorState = null;
      document.getElementById('retreat-btn').style.display = 'none';
      updateWaveUI();

      const groundY = getSurfaceY(orcFortressTile.x, orcFortressTile.z) || 0;
      if (wasCleared) {
        destroyOrcFortress();
        spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + 1.9, orcFortressTile.z), 'FORTRESS CONQUERED!', '#66ff88');
      } else {
        updateOrcFortressPanelButton();
        spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + 1.6, orcFortressTile.z), 'Retreated from the castle', '#cccccc');
      }
    }

    // Checked every frame once an Assault is underway (see
    // enterCastleInterior) - the instant every defender squad mustered
    // inside the courtyard is wiped out, the last stand is cleared. The
    // outer island's own orcFortressTile/heightMap aren't the live map
    // right now, so the actual FORTRESS CONQUERED!/destroyOrcFortress
    // payoff (reusing the same burnt-out visual treatment as the old
    // direct-siege ending) is deferred until retreatToOuterIsland brings
    // that map back.
    function updateOrcFortressAssault() {
      if (!orcFortressAssaultActive || orcFortressDestroyed) return;
      const anyDefendersLeft = raiderSquads.some(s => s.isFortressDefenders && s.members.length > 0);
      if (anyDefendersLeft) return;

      orcFortressAssaultActive = false;

      if (inCastleInterior) {
        castleInteriorCleared = true;
        if (castleInteriorState) {
          const spawn = castleInteriorState.spawnTile;
          const y = getSurfaceY(spawn.x, spawn.z) || 0;
          spawnFloatingText(new THREE.Vector3(spawn.x, y + 1.8, spawn.z), 'CASTLE CLEARED! Retreat to claim it.', '#66ff88');
        }
        return;
      }

      destroyOrcFortress();
      const groundY = getSurfaceY(orcFortressTile.x, orcFortressTile.z) || 0;
      spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + 1.9, orcFortressTile.z), 'FORTRESS CONQUERED!', '#66ff88');
    }

    // Fires once the Fortress's HP is sieged down to 0 - stops it from
    // ever mustering another warband (maybeSpawnOrcWarband) or firing
    // another arrow (updateOrcFortress), and releases whichever squad(s)
    // were sieging it back to normal control. The keep, wall ring and
    // turrets keep their original, un-darkened look once captured - it's
    // the player's fortress now, not a burnt-out ruin.
    function destroyOrcFortress() {
      if (orcFortressDestroyed) return;
      orcFortressDestroyed = true;
      hideOrcFortressPanel();
      // The keep is torn down for good - no garrison left to remember
      // between attempts (see orcFortressSurvivingDefenderCount).
      orcFortressSurvivingDefenderCount = null;
      squads.forEach(s => { s.isSiegingFortress = false; });
      // The siege is over - the Siege Tent that accompanied this Fortress
      // has no reason to stick around either.
      removeSiegeTent();

      const groundY = getSurfaceY(orcFortressTile.x, orcFortressTile.z) || 0;
      spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + ORC_FORTRESS_FIRE_HEIGHT, orcFortressTile.z), 'ORC FORTRESS CAPTURED!', '#ffdd66');

      // Yours now, but that doesn't mean safe - full HP again under new
      // management, and any raider warband that wanders close will lay
      // siege right back (see updateRaidersAttackingCapturedFortress and
      // findRaiderTarget's capturedFortressTarget candidate) same as they
      // would a Watch Tower, just a much bigger one. Positioned on the
      // (already-open) gate tile rather than the solid 3x3 keep footprint
      // itself - findPath refuses to path onto a solid tile at all (see
      // its walkable() check), so aiming raiders at the true center would
      // leave every warband stuck re-picking an unreachable goal forever.
      orcFortressHp = ORC_FORTRESS_MAX_HP;
      orcFortressMaxHp = ORC_FORTRESS_MAX_HP;
      orcFortressRazed = false;
      const fortressApproachTile = orcFortressGateTile || orcFortressTile;
      capturedFortressTarget = { group: { position: new THREE.Vector3(fortressApproachTile.x, groundY, fortressApproachTile.z) } };
    }

    // Fired once raiders have chipped the captured Fortress's HP down to 0
    // (see updateRaidersAttackingCapturedFortress) - they've taken it back.
    // The keep itself stays standing (same "no reason to remodel/remove
    // the mesh" reasoning as the original conquest), but it stops being
    // interactive or a target from here on: any squads sheltering inside
    // are turned out first, same as walking a garrisoned squad away
    // manually (see the pointerup handler's isGarrisonedAtFortress case).
    function razeCapturedFortress() {
      if (!orcFortressTile || orcFortressRazed) return;
      orcFortressRazed = true;
      capturedFortressTarget = null;
      hideCapturedFortressPanel();

      squads.forEach(s => {
        if (!s.members.some(m => m.userData.isGarrisonedAtFortress)) return;
        s.isGarrisonedAtFortress = false;
        s.members.forEach(m => { m.userData.isGarrisonedAtFortress = false; m.visible = true; });
        const exitTile = fortressGateExitTile();
        const exitY = getSurfaceY(exitTile.x, exitTile.z) || 0;
        s.group.position.set(exitTile.x, exitY, exitTile.z);
        s.currentPath = [];
        s.currentWaypoint = 0;
        s.isMoving = false;
        if (s.targetPosition) s.targetPosition.set(exitTile.x, exitY, exitTile.z);
        spawnFloatingText(new THREE.Vector3(exitTile.x, exitY + 1.2, exitTile.z), 'Driven from the Fortress!', '#ff8844');
      });

      const groundY = getSurfaceY(orcFortressTile.x, orcFortressTile.z) || 0;
      spawnFloatingText(new THREE.Vector3(orcFortressTile.x, groundY + ORC_FORTRESS_FIRE_HEIGHT, orcFortressTile.z), 'FORTRESS LOST!', '#ff4444');
    }

    // Tears the Siege Tent down once the siege it accompanied is over -
    // called from destroyOrcFortress, the single point every ending path
    // (direct siege, or Disarm -> Assault -> Conquer) funnels into. Unlike
    // the Fortress itself (which stays standing, captured), the tent is
    // just a temporary aid station for the siege - it actually needs to
    // come out of islandGroup and free up its tile, or it lingers on
    // screen (and keeps blocking that tile as solid ground) forever.
    function removeSiegeTent() {
      if (!siegeTentTile) return;
      hideSiegeTentPanel();
      const groundY = getSurfaceY(siegeTentTile.x, siegeTentTile.z) || 0;
      spawnFloatingText(new THREE.Vector3(siegeTentTile.x, groundY + 0.9, siegeTentTile.z), 'Siege Tent packed up', '#cdb896');
      if (siegeTentMesh) islandGroup.remove(siegeTentMesh);
      buildingTileKeys.delete(siegeTentTile.x + ',' + siegeTentTile.z);
      siegeTentTile = null;
      siegeTentMesh = null;
    }

    // How strongly a warband avoids piling onto a target that other warbands
    // are already committed to, expressed in equivalent tiles of distance.
    // Raiders still gang up when there's nothing else worth attacking (the
    // penalty is finite, not exclusion), but with several live ally squads
    // on the island they'll fan out and put pressure on all of them instead
    // of every warband beelining for whichever squad happens to be closest.
    const RAIDER_TARGET_SPREAD_PENALTY = 6;

    function findRaiderTarget(squad) {
      // A squad hidden inside a captured Orc Fortress (see
      // garrisonAllUnitsAtFortress/isGarrisonedAtFortress) isn't a valid
      // target either - same reasoning as the members.length filter right
      // below: it's effectively left the battlefield until the player
      // recalls it.
      const liveAllySquads = squads.concat(militiaSquads).filter(s => s.members.length > 0 && !s.isGarrisonedAtFortress);
      // Every standing Watch Tower is also a valid target - each one
      // isn't a squad (no members of its own to fight through, so none
      // can pass the members.length filter above) and is appended
      // separately instead. Each competes for a warband's attention
      // purely on distance (plus the same anti-pileup spread penalty
      // below) exactly like any player squad - with multiple Siege
      // Engineer squads each running their own tower, a warband simply
      // picks whichever standing tower or player/militia squad is
      // currently its best (closest, least-contested) option. See
      // updateRaidersAttackingWatchTower for what actually happens once
      // a warband picks a tower and closes in.
      const candidates = liveAllySquads.concat(watchTowers);
      // The captured Orc Fortress (once it's the player's - see
      // destroyOrcFortress) is a candidate the exact same way, just a
      // single persistent target instead of an array - see
      // updateRaidersAttackingCapturedFortress for the payoff.
      if (capturedFortressTarget) candidates.push(capturedFortressTarget);
      if (candidates.length === 0) return null;

      let best = null, bestScore = Infinity;
      candidates.forEach(playerSquad => {
        const d = Math.hypot(
          playerSquad.group.position.x - squad.group.position.x,
          playerSquad.group.position.z - squad.group.position.z
        );

        // Count how many OTHER warbands are already committed to this squad.
        let claims = 0;
        raiderSquads.forEach(rs => {
          if (rs !== squad && rs.currentTargetSquad === playerSquad && rs.members.length > 0) claims++;
        });

        const score = d + claims * RAIDER_TARGET_SPREAD_PENALTY;
        if (score < bestScore) { bestScore = score; best = playerSquad; }
      });

      squad.currentTargetSquad = best;
      return best;
    }

    // --- Heavenly Island defender AI ("smart" guard behavior) ---
    // Ordinary raider warbands (findRaiderTarget above) always beeline for
    // the closest player/militia squad - fine for an invading warband, but
    // wrong for a defender that's supposed to be guarding the temple. A
    // defender only spots an attacker once it comes within
    // DEFENDER_DETECTION_RADIUS of its own guard post (not wherever it's
    // currently standing), and posts call each other in as reinforcements
    // once one of them is already fighting - see the "alert" pass below.
    const DEFENDER_DETECTION_RADIUS = 6.5;
    const DEFENDER_ALERT_RADIUS = 9;

    function findDefenderTarget(squad) {
      const liveAllySquads = squads.concat(militiaSquads).filter(s => s.members.length > 0 && !s.isGarrisonedAtFortress);
      if (liveAllySquads.length === 0) { squad.currentTargetSquad = null; return null; }

      const post = squad.guardPost || { x: squad.group.position.x, z: squad.group.position.z };

      let best = null, bestScore = Infinity;
      liveAllySquads.forEach(playerSquad => {
        const d = Math.hypot(playerSquad.group.position.x - post.x, playerSquad.group.position.z - post.z);
        if (d > DEFENDER_DETECTION_RADIUS) return;

        let claims = 0;
        raiderSquads.forEach(rs => {
          if (rs !== squad && rs.currentTargetSquad === playerSquad && rs.members.length > 0) claims++;
        });

        const score = d + claims * RAIDER_TARGET_SPREAD_PENALTY;
        if (score < bestScore) { bestScore = score; best = playerSquad; }
      });

      // Nothing close enough to this post to spot on its own - check
      // whether a fellow defender guarding a nearby post is already
      // fighting and pull this squad in as reinforcement, so an attacker
      // can't just isolate and swarm one guard post at a time.
      if (!best) {
        raiderSquads.forEach(rs => {
          if (best || rs === squad || !rs.isDefender || !rs.currentTargetSquad || rs.members.length === 0 || !rs.guardPost) return;
          const d = Math.hypot(rs.guardPost.x - post.x, rs.guardPost.z - post.z);
          if (d <= DEFENDER_ALERT_RADIUS) best = rs.currentTargetSquad;
        });
      }

      squad.currentTargetSquad = best;
      return best;
    }

    // Walks a defender squad with no current target back to the post it's
    // guarding, so it doesn't just freeze wherever combat last left it -
    // mirrors the path-kickoff code later in updateRaiderAI.
    function returnDefenderToPost(squad) {
      if (!squad.guardPost) return;
      const dx = squad.guardPost.x - squad.group.position.x;
      const dz = squad.guardPost.z - squad.group.position.z;
      if (Math.hypot(dx, dz) < 0.6) return; // already home - stand watch

      const curX = Math.round(squad.group.position.x);
      const curZ = Math.round(squad.group.position.z);
      const path = findPath(curX, curZ, squad.guardPost.x, squad.guardPost.z, true, false, squad.canClimb);
      if (path && path.length > 0) {
        squad.currentPath = path;
        squad.currentWaypoint = 0;
        const firstStep = path[0];
        const stepY = surfaceYFor(firstStep.x, firstStep.z, squad.canClimb);
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
      }
    }

    function updateRaiderAI(squad, delta) {
      squad.aiCooldown -= delta;
      if (squad.isMoving || squad.aiCooldown > 0) return;
      squad.aiCooldown = 0.8 + Math.random() * 0.6;

      const target = squad.isDefender ? findDefenderTarget(squad) : findRaiderTarget(squad);
      if (!target) {
        if (squad.isDefender) returnDefenderToPost(squad);
        return;
      }

      const dx = target.group.position.x - squad.group.position.x;
      const dz = target.group.position.z - squad.group.position.z;
      const distToTarget = Math.hypot(dx, dz);

      // A warband of pure ranged raiders (e.g. a Shadow Island Acolyte
      // cult warband, always 100% Acolyte Bolt) holds much further back
      // and just keeps shooting, rather than marching all the way into
      // melee range like every other warband - see RAIDER_RANGED_ATTACK_RANGE.
      const squadAttackRange = isSquadFullyRanged(squad) ? RAIDER_RANGED_ATTACK_RANGE : RAIDER_ATTACK_RANGE;

      if (distToTarget < squadAttackRange) {
        if (dx * dx + dz * dz > 0.0001) {
          squad.group.rotation.y = Math.atan2(dx, dz);
        }
        return;
      }

      const curX = Math.round(squad.group.position.x);
      const curZ = Math.round(squad.group.position.z);

      // A fully-ranged warband paths to a standoff point short of the
      // target's own tile - along the straight line toward it, but pulled
      // back inside RAIDER_RANGED_ATTACK_RANGE - instead of beelining onto
      // the target's tile like a melee warband. Without this, nothing else
      // stops an in-progress march early: stepSquadMovement only halts a
      // squad once squad-collision physics kicks in at ~0.85 units (see
      // SQUAD_COLLISION_RADIUS), which is basically melee range, so the
      // squad would still end up walked in right next to the player
      // despite the hold check above.
      let goalX, goalZ;
      if (isSquadFullyRanged(squad)) {
        const standoff = RAIDER_RANGED_ATTACK_RANGE - 1;
        const dirX = dx / distToTarget;
        const dirZ = dz / distToTarget;
        goalX = Math.round(target.group.position.x - dirX * standoff);
        goalZ = Math.round(target.group.position.z - dirZ * standoff);
      } else {
        goalX = Math.round(target.group.position.x);
        goalZ = Math.round(target.group.position.z);
      }

      // Raiders push straight through trees/rocks/bushes instead of routing
      // around them (avoidProps=false) but still can't walk through
      // buildings - except an Akuma Feral pack (squad.canClimb), which
      // paths up onto rooftops/boulders the same way a Ninja squad can.
      let path = findPath(curX, curZ, goalX, goalZ, true, false, squad.canClimb);
      // The standoff tile above can land somewhere unreachable (off the
      // island's edge, in water) - rather than leaving the warband stuck
      // re-rolling the same failing goal forever, fall back to beelining
      // at the target directly like a melee warband would.
      if ((!path || path.length === 0) && (goalX !== Math.round(target.group.position.x) || goalZ !== Math.round(target.group.position.z))) {
        path = findPath(curX, curZ, Math.round(target.group.position.x), Math.round(target.group.position.z), true, false, squad.canClimb);
      }
      if (path && path.length > 0) {
        squad.currentPath = path;
        squad.currentWaypoint = 0;

        const firstStep = path[0];
        const stepY = surfaceYFor(firstStep.x, firstStep.z, squad.canClimb);
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
      }
    }

    // --- Desert Bandit passive (Loot & Flee) ---
    // Odds that a Desert Bandit warband cuts its losses the moment it takes
    // a casualty: the survivors break off combat entirely, drag the fallen
    // Bandit's body back to their beached boat, and sail off for good
    // instead of fighting to the last member. Rolled once per squad (see
    // the hp<=0 branch in applyDamage) - a squad that fails the roll just
    // keeps fighting normally and never rolls again.
    const DESERT_BANDIT_FLEE_CHANCE = 0.3;
    // How close the squad needs to get to its old landing tile before it
    // stops walking and climbs back into the boat.
    const DESERT_BANDIT_BOARD_DISTANCE = 0.5;
    // How far out to sea the boat sails before the squad is considered
    // gone for good and removed from the fight.
    const DESERT_BANDIT_FLEE_SEA_DIST = 6;

    // Called the instant a Desert Bandit's hp hits 0, in place of the
    // normal killUnit/startDeathSequence path - see applyDamage. Rather
    // than leaving a corpse for the player to see, the unit is quietly
    // removed and a simplified dragged-body prop (createDraggedBanditBody)
    // is slung onto the nearest surviving squadmate instead.
    function triggerDesertBanditFlee(squad, deadUnit) {
      const uData = deadUnit.userData;
      if (uData.hpElement) uData.hpElement.remove();
      const idx = squad.members.indexOf(deadUnit);
      if (idx !== -1) squad.members.splice(idx, 1);
      if (deadUnit.parent) deadUnit.parent.remove(deadUnit);

      if (squad.members.length === 0) return; // nobody left to carry the body

      // Nearest survivor to the fallen Bandit becomes the carrier.
      const deadPos = deadUnit.position;
      let carrier = squad.members[0], bestDist = Infinity;
      squad.members.forEach(m => {
        const d = m.position.distanceTo(deadPos);
        if (d < bestDist) { bestDist = d; carrier = m; }
      });

      const draggedBody = createDraggedBanditBody();
      draggedBody.position.set(0, 0.02, -0.4);
      carrier.add(draggedBody);
      carrier.userData.draggedBodyMesh = draggedBody;

      squad.isFleeing = true;
      squad.fleePhase = 'toBoat';
      squad.currentTargetSquad = null;
      squad.isMoving = false;
      squad.currentPath = [];
      squad.currentWaypoint = 0;
      squad.aiCooldown = 0;
      // Dragging a body slows the retreat down a little compared to a
      // normal warband's advance.
      squad.moveSpeed = squad.moveSpeed * 0.75;

      spawnFloatingText(
        (() => { const p = new THREE.Vector3(); carrier.getWorldPosition(p); p.y += 0.4; return p; })(),
        'FLEEING!', '#e0c060'
      );
    }

    // Drives a fleeing Desert Bandit warband back to its boat instead of
    // the normal combat AI - see triggerDesertBanditFlee. Reuses the same
    // squad.isMoving/currentPath/targetPosition fields stepSquadMovement
    // already knows how to advance, exactly like updateRaiderAI does, so
    // the caller (the main loop) still finishes each frame with a call to
    // stepSquadMovement(squad).
    function updateDesertBanditFleeAI(squad, delta) {
      if (squad.fleePhase === 'sailing') {
        const currentPos = squad.group.position;
        const dx = squad.fleeSailTarget.x - currentPos.x;
        const dz = squad.fleeSailTarget.z - currentPos.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.3) {
          // Gone for good - remove the whole warband (raiders, boat, and
          // dragged body along with it) without leaving a stranded boat
          // behind, unlike a warband that's wiped out on land.
          squad.members.forEach(u => { if (u.userData.hpElement) u.userData.hpElement.remove(); });
          scene.remove(squad.group);
          const sIdx = raiderSquads.indexOf(squad);
          if (sIdx !== -1) raiderSquads.splice(sIdx, 1);
          updateWaveUI();
          return;
        }

        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        const step = dir.multiplyScalar(squad.moveSpeed * 0.85 * delta);
        if (step.length() > dist) {
          currentPos.x = squad.fleeSailTarget.x;
          currentPos.z = squad.fleeSailTarget.z;
        } else {
          currentPos.add(step);
        }
        currentPos.y = 0;
        return;
      }

      // fleePhase === 'toBoat'
      squad.aiCooldown -= delta;
      if (squad.isMoving || squad.aiCooldown > 0) return;
      squad.aiCooldown = 0.3;

      const tile = squad.landingTile;
      const dx = tile.x - squad.group.position.x;
      const dz = tile.z - squad.group.position.z;
      const distToBoat = Math.hypot(dx, dz);

      if (distToBoat < DESERT_BANDIT_BOARD_DISTANCE) {
        // Reached the beach - climb back aboard (the reverse of
        // disembarkRaiderSquad) and set sail back out to sea.
        if (squad.boat) {
          if (squad.boat.parent) squad.boat.parent.remove(squad.boat);
          squad.boat.position.set(0, 0, 0);
          squad.boat.rotation.set(0, 0, 0);
          squad.boat.scale.set(1, 1, 1);
          squad.group.add(squad.boat);
        }
        squad.members.forEach((unit, i) => {
          const col = i % 2, row = Math.floor(i / 2);
          unit.position.set(col * 0.28 - 0.14, 0.16, row * 0.28 - 0.35);
        });
        squad.group.position.set(tile.x, 0, tile.z);

        const seaDx = tile.dirX || 0, seaDz = tile.dirZ || 0;
        squad.fleeSailTarget = {
          x: tile.x + seaDx * DESERT_BANDIT_FLEE_SEA_DIST,
          z: tile.z + seaDz * DESERT_BANDIT_FLEE_SEA_DIST,
        };
        squad.group.rotation.y = Math.atan2(seaDx, seaDz);
        squad.fleePhase = 'sailing';
        squad.isMoving = false;
        squad.currentPath = [];
        return;
      }

      const curX = Math.round(squad.group.position.x);
      const curZ = Math.round(squad.group.position.z);
      const goalX = Math.round(tile.x);
      const goalZ = Math.round(tile.z);

      const path = findPath(curX, curZ, goalX, goalZ, true, false, squad.canClimb);
      if (path && path.length > 0) {
        squad.currentPath = path;
        squad.currentWaypoint = 0;

        const firstStep = path[0];
        const stepY = surfaceYFor(firstStep.x, firstStep.z, squad.canClimb);
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
      } else {
        // No walkable path back (fully boxed in) - just walk straight for
        // the beach rather than getting stuck standing still forever.
        squad.targetPosition.set(tile.x, squad.group.position.y, tile.z);
        squad.isMoving = true;
        squad.group.userData.isMoving = true;
        squad.members.forEach(unit => unit.userData.isWalking = true);
        squad.group.rotation.y = Math.atan2(dx, dz);
      }
    }

    // --- VILLAGER MILITIA (Barracks defenders) ---
    // The Barracks fields a 4-strong squad of armed villagers. Each one is
    // independently rolled into one of six classes - Sword, Spear or Archer,
    // either on foot or on horseback - so every militia squad looks a little
    // different. While no raid is active they wander the island like the
    // regular villagers; the moment a wave starts they fall back to rally at
    // the Barracks, then push out together to meet the raiders.
    const militiaSquads = [];
    const MILITIA_COLOR = 0x556b2f; // dark olive drab, reads as "irregulars" next to the regular squads
    const MILITIA_WEAPON_TYPES = ['swords', 'pikes', 'archers']; // Sword / Spear (reuses pike visuals) / Archer
    // Player Cavalry squad - each rider is independently issued one of these
    // three loadouts at random. Passive behavior is keyed off this, not off
    // unitType (which just stays 'cavalry' for every rider).
    const CAVALRY_WEAPON_TYPES = ['sword', 'spear', 'bow'];
    const MILITIA_MOVE_SPEED = 1.6;
    const MILITIA_ROAM_RADIUS = 4;       // how far a militia squad wanders from its Barracks while idle
    const MILITIA_ROAM_INTERVAL_MIN = 4; // seconds between idle wander destinations
    const MILITIA_ROAM_INTERVAL_MAX = 8;
    const MILITIA_RALLY_RADIUS = 0.75;   // how close to the Barracks counts as "rallied"
    const HORSE_SCALE = 1.5; // bigger, more imposing mount
    const MILITIA_MOUNT_SEAT_Y = 0.42 * HORSE_SCALE;   // rider height above the horse's back
    const fallingHorses = []; // horses mid-collapse, detached from their rider and dying independently
    const HORSE_FALL_DURATION = 0.5; // seconds for a detached horse to instantly keel over and settle
    const fleeingHorses = []; // riderless horses that survived, spooked and running loose on the island
    const HORSE_SURVIVE_CHANCE = 0.25; // odds a riderless horse bolts instead of collapsing with its rider
    const HORSE_FLEE_DURATION = 10; // seconds spent panic-running around the island before heading for the Barracks
    const HORSE_FLEE_SPEED = 2.4; // panicked gallop speed - faster than a normal ridden pace
    const HORSE_ROAM_LEG_MIN = 1.2; // seconds spent running toward each random panic waypoint
    const HORSE_ROAM_LEG_MAX = 2.5;
    const HORSE_ROAM_RADIUS = 3.5; // how far a fresh panic waypoint can be from the horse's current spot
    const HORSE_HIDE_DISTANCE = 0.12; // how close to the Barracks counts as "made it inside"

    // Weapons left lying on the ground once their owner dies. Kept in a flat
    // scene-level list so they persist independently of whatever squad or
    // death-sequence bookkeeping the unit itself goes through.
    const droppedWeapons = [];
    // Most weapons are modeled standing upright (blade/shaft along local Y),
    // so laying them flat means tipping 90° on X; the pike is already built
    // running along local Z, so it only needs a little settling tilt.
    const WEAPON_DROP_LAY_X = { swords: Math.PI / 2, archers: Math.PI / 2, mages: Math.PI / 2, raiders: Math.PI / 2, pikes: 0 };
    const horseBodyMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
    const horseManeMat = new THREE.MeshLambertMaterial({ color: 0x2b1d12 });

    // A simple blocky horse for mounted militia - just enough shapes to read
    // clearly at this game's scale (body, neck, head, mane, tail, four legs).
    function createMilitiaHorse() {
      const horse = new THREE.Group();

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.5), horseBodyMat);
      body.position.set(0, 0.33, 0.02);
      body.castShadow = true;
      horse.add(body);

      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), horseBodyMat);
      neck.position.set(0, 0.48, 0.28);
      neck.rotation.x = -0.35;
      neck.castShadow = true;
      horse.add(neck);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.15, 0.22), horseBodyMat);
      head.position.set(0, 0.58, 0.42);
      head.castShadow = true;
      horse.add(head);

      const mane = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.24), horseManeMat);
      mane.position.set(0, 0.55, 0.22);
      horse.add(mane);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), horseManeMat);
      tail.position.set(0, 0.3, -0.28);
      tail.rotation.x = 0.4;
      tail.castShadow = true;
      horse.add(tail);

      const legGeo = new THREE.BoxGeometry(0.08, 0.32, 0.08);
      const legPositions = [
        [-0.09, 0.16, 0.17], [0.09, 0.16, 0.17],
        [-0.09, 0.16, -0.17], [0.09, 0.16, -0.17],
      ];
      legPositions.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, horseBodyMat);
        leg.position.set(lx, ly, lz);
        leg.castShadow = true;
        horse.add(leg);
      });

      horse.scale.setScalar(HORSE_SCALE);
      return horse;
    }

    // Detaches a mounted militia unit's horse from its rider and starts an
    // instant, independent collapse - the horse dies the moment the fatal
    // blow lands, regardless of whether the rider then dies outright or
    // enters the lingering "suspected death" sequence. Once separated, the
    // rider becomes a regular unmounted unit for the rest of its own death.

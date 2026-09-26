    function createRealisticBow() {
      const bowGroup = new THREE.Group();
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.42, -0.06),
        new THREE.Vector3(0, 0.35, -0.01),
        new THREE.Vector3(0, 0.20, 0.05),
        new THREE.Vector3(0, 0.07, 0.03),
        new THREE.Vector3(0, 0.00, 0.02),
        new THREE.Vector3(0, -0.07, 0.03),
        new THREE.Vector3(0, -0.20, 0.05),
        new THREE.Vector3(0, -0.35, -0.01),
        new THREE.Vector3(0, -0.42, -0.06)
      ]);

      const stave = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.016, 6, false), woodMat);
      stave.castShadow = true;
      bowGroup.add(stave);

      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8), leatherMat);
      grip.position.set(0, 0, 0.02);
      bowGroup.add(grip);

      const stringMat = new THREE.LineBasicMaterial({ color: 0xf5f5f5 });
      const stringGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.40, -0.05),
        new THREE.Vector3(0, 0.00, -0.02),
        new THREE.Vector3(0, -0.40, -0.05)
      ]);
      bowGroup.add(new THREE.Line(stringGeo, stringMat));

      return bowGroup;
    }

    // Crossbow Squad's weapon - held horizontally rather than upright like
    // the Archer's longbow, so it reads as a distinct silhouette even
    // though it's mounted to the same handL slot with the same aiming-arm
    // rig. A dark wooden stock runs front-to-back with a steel prod (the
    // horizontal "bow" part) lashed across the front and a taut string -
    // slower to nock but hits far harder, matching its low-attack-speed/
    // high-damage Piercing Shot bolts.
    function createCrossbow() {
      const cbGroup = new THREE.Group();

      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.5), darkWoodMat);
      stock.position.set(0, 0, 0.08);
      cbGroup.add(stock);

      const prodCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.26, 0, -0.02),
        new THREE.Vector3(-0.14, 0, 0.04),
        new THREE.Vector3(0, 0, 0.06),
        new THREE.Vector3(0.14, 0, 0.04),
        new THREE.Vector3(0.26, 0, -0.02)
      ]);
      const prod = new THREE.Mesh(new THREE.TubeGeometry(prodCurve, 20, 0.015, 6, false), steelMat);
      prod.position.set(0, 0, -0.16);
      cbGroup.add(prod);

      const stringMat2 = new THREE.LineBasicMaterial({ color: 0xf5f5f5 });
      const stringGeo2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.26, 0, -0.18),
        new THREE.Vector3(0, 0, -0.04),
        new THREE.Vector3(0.26, 0, -0.18)
      ]);
      cbGroup.add(new THREE.Line(stringGeo2, stringMat2));

      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), leatherMat);
      grip.rotation.x = Math.PI / 2;
      grip.position.set(0, -0.09, 0.16);
      cbGroup.add(grip);

      return cbGroup;
    }

    function createShield() {
      return new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.35, 0.25),
        new THREE.MeshLambertMaterial({ color: 0xaa2222 })
      );
    }

    function createStaff() {
      const staff = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.85, 6), darkWoodMat);
      shaft.position.y = 0.42;

      const orbMat = new THREE.MeshLambertMaterial({ color: 0x66ddff, emissive: 0x2299cc, emissiveIntensity: 0.6 });
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), orbMat);
      orb.position.y = 0.88;

      const cradle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 6, 8), goldMat);
      cradle.rotation.x = Math.PI / 2;
      cradle.position.y = 0.78;

      staff.add(shaft, orb, cradle);
      return staff;
    }

    function createAxe() {
      const axe = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), darkWoodMat);
      shaft.position.y = 0.25;

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.16), steelMat);
      head.position.set(0, 0.44, 0.04);

      axe.add(shaft, head);
      return axe;
    }

    // Berserker weapon - Double Axe: the classic raider Axe's single
    // blade mirrored to both sides of the haft (front and back) instead
    // of just the one, so it reads as a proper double-bitted war axe
    // rather than the one-handed pattern every other axe-wielder uses.
    // See equipUnit's 'berserker' branch.
    function createDoubleAxe() {
      const axe = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), darkWoodMat);
      shaft.position.y = 0.25;
      axe.add(shaft);

      const headGeo = new THREE.BoxGeometry(0.05, 0.2, 0.16);
      const headFront = new THREE.Mesh(headGeo, steelMat);
      headFront.position.set(0, 0.44, 0.09);
      axe.add(headFront);

      const headBack = new THREE.Mesh(headGeo, steelMat);
      headBack.position.set(0, 0.44, -0.09);
      axe.add(headBack);

      return axe;
    }

    // Desert Bandit weapon - Mace: a stubby leather-wrapped haft topped
    // with a flanged steel head (a knobbly ball ringed by a few blocky
    // flanges), the blunt-force counterpart to the Bandit's Sword/Bow
    // loadouts. See DESERT_BANDIT_WEAPON_TYPES/equipUnit's 'mace' branch.
    function createMace() {
      const mace = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.38, 6), leatherMat);
      shaft.position.y = 0.19;

      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), steelMat);
      head.position.y = 0.42;

      // A few small flanges stuck to the head so it doesn't read as a
      // plain ball on a stick.
      const flangeGeo = new THREE.BoxGeometry(0.03, 0.11, 0.03);
      const flangePositions = [
        [0.08, 0.42, 0], [-0.08, 0.42, 0], [0, 0.42, 0.08], [0, 0.42, -0.08]
      ];
      const flanges = flangePositions.map(([fx, fy, fz]) => {
        const f = new THREE.Mesh(flangeGeo, steelMat);
        f.position.set(fx, fy, fz);
        return f;
      });

      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 8), goldMat);
      collar.position.y = 0.34;

      mace.add(shaft, head, collar, ...flanges);
      return mace;
    }

    // Desert Bandit passive (Loot & Flee) - a small limp body prop a
    // fleeing Bandit drags along the ground behind it, standing in for a
    // fallen comrade rather than leaving the body behind. Built lying flat
    // along local -Z (behind the carrier, whichever way the squad is
    // currently facing) in the same theme colors every Bandit wears, so it
    // reads as one of their own rather than a random victim. See
    // triggerDesertBanditFlee/updateDesertBanditFleeAI for how it's
    // attached and animated.
    function createDraggedBanditBody() {
      const body = new THREE.Group();
      const shirtMat = new THREE.MeshLambertMaterial({ color: DESERT_BANDIT_THEME.body });
      const pantsMat = new THREE.MeshLambertMaterial({ color: DESERT_BANDIT_THEME.pants });
      const skinMat = new THREE.MeshLambertMaterial({ color: 0xccaa88 });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.3), shirtMat);
      torso.position.set(0, 0.06, -0.05);

      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.32), pantsMat);
      legs.position.set(0, 0.05, -0.38);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), skinMat);
      head.position.set(0, 0.08, 0.16);

      // Arms trail limply out to either side rather than tucked in.
      const armGeo = new THREE.BoxGeometry(0.07, 0.07, 0.24);
      const armL = new THREE.Mesh(armGeo, shirtMat);
      armL.position.set(0.15, 0.045, -0.02);
      armL.rotation.y = 0.35;
      const armR = new THREE.Mesh(armGeo, shirtMat);
      armR.position.set(-0.15, 0.045, -0.02);
      armR.rotation.y = -0.35;

      body.add(torso, legs, head, armL, armR);
      return body;
    }

    // Paladin Leader weapon (option A) - Greatsword: an oversized two-handed
    // blade with a wide crossguard and a weighted pommel, read as a heavy,
    // ceremonial weapon rather than a quick side-arm. See equipUnit's
    // 'paladins' branch, which picks between this and createWarhammer once
    // per Leader at spawn/revive time.
    function createGreatsword() {
      const sword = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.75, 0.03), steelMat);
      blade.position.y = 0.42;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.05), goldMat);
      guard.position.y = 0.05;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 6), leatherMat);
      hilt.position.y = -0.07;
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), goldMat);
      pommel.position.y = -0.2;
      sword.add(blade, guard, hilt, pommel);
      return sword;
    }

    // Paladin Leader weapon (option B) - Warhammer: a long haft topped with
    // a blocky steel head and a rear spike, the blunt-force counterpart to
    // the Greatsword. Same two-handed, right-hand grip convention as every
    // other weapon here (see equipUnit's 'paladins' branch).
    function createWarhammer() {
      const hammer = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.7, 6), darkWoodMat);
      shaft.position.y = 0.32;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.15), steelMat);
      head.position.y = 0.64;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 4), steelMat);
      spike.rotation.x = -Math.PI / 2;
      spike.position.set(0, 0.64, 0.15);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), goldMat);
      collar.position.y = 0.5;
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), goldMat);
      pommel.position.y = -0.05;
      hammer.add(shaft, head, spike, collar, pommel);
      return hammer;
    }

    // Wokou (Japanese pirate raider) weapon - Katana: a longer, single-edged
    // blade with a slight curve and a wrapped hilt, distinct from the raider
    // Sword's plain double-edged look.
    function createKatana() {
      const katana = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.52, 0.02), steelMat);
      blade.position.y = 0.3;
      blade.rotation.z = 0.06; // subtle curve read
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 8), goldMat);
      guard.rotation.x = Math.PI / 2;
      guard.position.y = 0.045;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      hilt.position.y = -0.035;
      katana.add(blade, guard, hilt);
      return katana;
    }

    // Sheathed companion to createKatana, for the Dragon Ronin's hip
    // mount - built along the same local +Y axis (hilt end near the
    // origin, tip end away from it) so it drops onto hipMount with the
    // same conventions as the hand-held blade, just with a solid
    // lacquered saya hiding the blade and a cord-wrapped koiguchi
    // (scabbard mouth) instead of an exposed blade edge. Shown only
    // while the unit is genuinely idle; hidden the instant it draws to
    // attack or deflect - see updateUnitAnims.
    function createKatanaSheath() {
      const sheath = new THREE.Group();
      const sayaMat = new THREE.MeshLambertMaterial({ color: 0x1c1108 });
      const saya = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.44, 0.028), sayaMat);
      saya.position.y = 0.2;
      const koiguchi = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.025, 8), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
      koiguchi.rotation.x = Math.PI / 2;
      koiguchi.position.y = 0.03;
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 8), goldMat);
      guard.rotation.x = Math.PI / 2;
      guard.position.y = 0.045;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      hilt.position.y = -0.035;
      sheath.add(saya, koiguchi, guard, hilt);
      return sheath;
    }

    // Dragon Ronin passive (Second Wind) - a small healing flask carried
    // in the off hand, invisible until the heal actually fires (see
    // maybeTriggerDragonSecondWind and applyAttackPose's 'drinkPotion'
    // branch). Built along the same local +Y-up convention as the
    // katana/sheath so it sits naturally in a closed hand.
    function createHealingPotion() {
      const potion = new THREE.Group();
      const glassMat = new THREE.MeshLambertMaterial({ color: 0x8fd9ff, transparent: true, opacity: 0.55 });
      const liquidMat = new THREE.MeshLambertMaterial({ color: 0x2ecc71, emissive: 0x145a32, emissiveIntensity: 0.4 });
      const corkMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.09, 8), glassMat);
      body.position.y = 0.09;
      const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.06, 8), liquidMat);
      liquid.position.y = 0.075;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.04, 8), glassMat);
      neck.position.y = 0.155;
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.025, 8), corkMat);
      cork.position.y = 0.185;

      potion.add(body, liquid, neck, cork);
      return potion;
    }

    // Doctor loadout - Medic Bag: a small satchel with a red cross on the
    // side, carried in place of any weapon (see equipUnit's 'doctor'
    // branch) - the Doctor never fights, so this is purely cosmetic, the
    // same way the Healing Potion above is purely cosmetic until it
    // actually triggers.
    function createMedicBag() {
      const bag = new THREE.Group();
      const bagMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
      const crossMat = new THREE.MeshLambertMaterial({ color: 0xc0203a });
      const strapMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.08), bagMat);
      body.position.y = 0.05;
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.082), strapMat);
      strap.position.y = 0.09;
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.005), crossMat);
      crossV.position.set(0, 0.05, 0.043);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.005), crossMat);
      crossH.position.set(0, 0.05, 0.043);

      bag.add(body, strap, crossV, crossH);
      return bag;
    }

    // Siege Engineer loadout - Mallet: a carpenter's wooden mallet carried
    // in place of any weapon (see equipUnit's 'siege' branch) - the Siege
    // Engineer never fights (see the 'siege' early-return in
    // processUnitAttack), so this is purely cosmetic. Its actual ability
    // (building a Watch Tower) is handled in updateSiegeEngineerSupport.
    function createSiegeMallet() {
      const mallet = new THREE.Group();
      const handleMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
      const headMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2a });

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.28, 6), handleMat);
      handle.position.y = 0.14;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8), headMat);
      head.rotation.z = Math.PI / 2;
      head.position.y = 0.28;

      mallet.add(handle, head);
      return mallet;
    }

    // Wokou weapon - Sickle: a short kama-style hooked blade on a stubby
    // wooden handle, read as a fast close-in slashing tool.
    function createSickle() {
      const sickle = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.3, 6), woodMat);
      handle.position.y = 0.15;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.018), steelMat);
      blade.position.set(0.09, 0.31, 0);
      blade.rotation.z = -0.55; // hooked curve angle
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 6), goldMat);
      collar.position.y = 0.3;
      sickle.add(handle, blade, collar);
      return sickle;
    }

    // Onryo weapon - a tall crimson-lacquered ritual staff topped with an
    // ornate golden reliquary lantern ringed in short spikes, matching The
    // Far East's own vengeful-spirit-priest raider (see ONRYO_THEME/
    // ONRYO_WARBAND_CHANCE and createBlockyHumanoid's isOnryo branch).
    // Held two-handed like a polearm - see equipUnit's 'onryoStaff' branch
    // for the grip pose - and otherwise fights with the same generic
    // melee swing/damage/cooldown as any other unlisted raider weapon
    // (katana, mace, etc. all fall through the same default combat path).
    function createOnryoStaff() {
      const staff = new THREE.Group();
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x8a1f1f });
      const lanternMat = new THREE.MeshLambertMaterial({ color: 0xddaa22 });
      const capMat = new THREE.MeshLambertMaterial({ color: 0x3d2a14 });

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.62, 6), poleMat);
      pole.position.y = 0.31;
      staff.add(pole);

      const footCap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 6), capMat);
      footCap.position.y = 0.01;
      staff.add(footCap);

      // Lantern/reliquary head - a small latticed box lit from within,
      // matching the reference art's boxy finial.
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.09), lanternMat);
      lantern.position.y = 0.7;
      staff.add(lantern);

      const lanternWindow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffdd88 }));
      lanternWindow.position.y = 0.7;
      staff.add(lanternWindow);

      const collarTop = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.03, 6), capMat);
      collarTop.position.y = 0.615;
      const collarBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.03, 6), capMat);
      collarBottom.position.y = 0.785;
      staff.add(collarTop, collarBottom);

      // Ring of short golden spikes radiating out around the lantern -
      // the staff-top echo of the halo behind the head (see
      // createSpikedHalo), so the two read as a matched set.
      const spikeCount = 8;
      for (let i = 0; i < spikeCount; i++) {
        const a = (i / spikeCount) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.09, 5), lanternMat);
        spike.position.set(Math.cos(a) * 0.06, 0.7, Math.sin(a) * 0.06);
        spike.rotation.x = Math.PI / 2;
        spike.rotation.z = -a;
        spike.rotation.x += Math.PI / 2.4;
        staff.add(spike);
      }

      return staff;
    }

    // Onryo offhand accessory - a kusarigama (sickle blade on a length of
    // chain) hanging loosely from the free hand, purely cosmetic (it isn't
    // a separate thrown weapon - the staff above is the unit's actual
    // melee weapon) so the raider's silhouette matches the reference art's
    // two-item loadout without needing its own attack/throw logic.
    function createKusarigamaAccessory() {
      const group = new THREE.Group();
      const chainMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });

      const linkCount = 5;
      for (let i = 0; i < linkCount; i++) {
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 5, 8), chainMat);
        link.position.y = -0.05 - i * 0.045;
        link.rotation.x = Math.PI / 2;
        link.rotation.y = (i % 2) * (Math.PI / 2);
        group.add(link);
      }

      const sickle = createSickle();
      sickle.scale.set(0.8, 0.8, 0.8);
      sickle.rotation.z = Math.PI;
      sickle.position.y = -0.05 - linkCount * 0.045;
      group.add(sickle);

      return group;
    }

    // Onryo head accessory - a ring of thin golden spikes radiating out
    // behind the head like a wrathful halo, matching the reference art.
    // Attached as a child of `head` in createBlockyHumanoid so it turns
    // with every idle/attack head movement, sitting flush against the
    // back of the skull rather than floating free in front of the face.
    function createSpikedHalo() {
      const group = new THREE.Group();
      const haloMat = new THREE.MeshBasicMaterial({ color: 0xf0c848 });

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 20), haloMat);
      group.add(ring);

      const spikeCount = 14;
      for (let i = 0; i < spikeCount; i++) {
        const a = (i / spikeCount) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.09, 5), haloMat);
        spike.position.set(Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0);
        spike.rotation.z = a - Math.PI / 2;
        group.add(spike);
      }

      group.position.z = -0.1;
      return group;
    }

    // Onryo chest accessory - a huge gaping mouth splitting down from the
    // chin over the torso, matching the reference art (in place of a
    // normal face/beard). Attached to charGroup rather than to head in
    // createBlockyHumanoid, running from the chin (just under the head)
    // down to the waist, lined with small jagged teeth along both edges
    // of the dark slit.
    function createBigMouth() {
      const group = new THREE.Group();
      const voidMat = new THREE.MeshBasicMaterial({ color: 0x0a0705 });
      const gumMat = new THREE.MeshLambertMaterial({ color: 0x5a1216 });

      const maw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.03), voidMat);
      maw.position.set(0, 0.6, 0.115);
      group.add(maw);

      const toothCount = 7;
      for (let i = 0; i < toothCount; i++) {
        const y = 0.75 - (i / (toothCount - 1)) * 0.3;
        const toothL = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.035, 4), gumMat);
        toothL.position.set(-0.032, y, 0.12);
        toothL.rotation.z = Math.PI / 2 - 0.15;
        group.add(toothL);
        const toothR = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.035, 4), gumMat);
        toothR.position.set(0.032, y, 0.12);
        toothR.rotation.z = -Math.PI / 2 + 0.15;
        group.add(toothR);
      }

      return group;
    }

    // Onryo is a female ghost (an onryo/yurei) - long straggly black hair
    // streaming down the back of the head past the shoulders, plus a
    // ragged lock hanging down over each side of the face, the classic
    // long-black-hair silhouette of a Japanese vengeful spirit. Attached
    // as a child of `head` in createBlockyHumanoid alongside the spiked
    // halo, so it turns and tilts naturally with every idle/attack head
    // movement.
    function createGhostHair(color = 0x0d0d0d) {
      const group = new THREE.Group();
      const hairMat = new THREE.MeshLambertMaterial({ color });

      const bUpper = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.05), hairMat);
      bUpper.position.set(0, -0.24, -0.1);
      group.add(bUpper);
      const bMid = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.2, 0.045), hairMat);
      bMid.position.set(0, -0.43, -0.1);
      group.add(bMid);
      const bTip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.04), hairMat);
      bTip.position.set(0, -0.6, -0.1);
      group.add(bTip);

      [-1, 1].forEach(side => {
        const lock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.035), hairMat);
        lock.position.set(side * 0.1, -0.28, 0.09);
        lock.rotation.z = side * 0.06;
        group.add(lock);
      });

      return group;
    }

    const boatSailMat = new THREE.MeshLambertMaterial({ color: 0x8a1f1f, side: THREE.DoubleSide });
    const boatTrimMat = new THREE.MeshLambertMaterial({ color: 0xa87c45 });
    const boatShieldMatA = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const boatShieldMatB = new THREE.MeshLambertMaterial({ color: 0x8a1f1f });
    // Ghost Ship materials - used instead of the normal wood/sail/shield
    // materials whenever a raider warband spawns on Shadow Island (see
    // createBoat below). Pale, faintly greenish, and semi-transparent so
    // the hull and tattered sail read as spectral rather than solid timber.
    const ghostHullMat = new THREE.MeshLambertMaterial({ color: 0x7c9088, transparent: true, opacity: 0.6, emissive: 0x0e1a16 });
    const ghostDarkMat = new THREE.MeshLambertMaterial({ color: 0x4d5c56, transparent: true, opacity: 0.65, emissive: 0x0a140f });
    const ghostTrimMat = new THREE.MeshLambertMaterial({ color: 0x647a70, transparent: true, opacity: 0.6 });
    const ghostSailMat = new THREE.MeshLambertMaterial({ color: 0xd6e0da, side: THREE.DoubleSide, transparent: true, opacity: 0.4, emissive: 0x0e1a16 });
    const ghostShieldMat = new THREE.MeshLambertMaterial({ color: 0xb7c2ba, transparent: true, opacity: 0.55 });

    const BOAT_SCALE = 3;

    // Ghost Ship on Shadow Island (see the ghost*Mat materials above) - same
    // hull shape as the normal raider boat, just re-materialed pale,
    // faintly glowing, and semi-transparent so it reads as spectral rather
    // than solid wood. selectedBiomeTheme is read once at build time here,
    // same as every other per-biome dispatcher in the file (createSceneryTree,
    // createRock, etc.) - each new warband's boat is built fresh, so this
    // always reflects whichever biome is currently active.
    function createBoat() {
      const isGhost = selectedBiomeTheme === 'shadowIsland';
      const hullMat = isGhost ? ghostHullMat : woodMat;
      const darkMat = isGhost ? ghostDarkMat : darkWoodMat;
      const trimMat = isGhost ? ghostTrimMat : boatTrimMat;
      const sailMat = isGhost ? ghostSailMat : boatSailMat;
      const shieldMatA = isGhost ? ghostShieldMat : boatShieldMatA;
      const shieldMatB = isGhost ? ghostShieldMat : boatShieldMatB;

      const boat = new THREE.Group();
      const hull = new THREE.Group();
      hull.scale.set(BOAT_SCALE, BOAT_SCALE, BOAT_SCALE);
      boat.add(hull);
      const profile = [0.3, 0.46, 0.5, 0.46, 0.3];
      const segDepth = 0.22;
      profile.forEach((w, i) => {
        const z = -0.44 + i * segDepth;
        const seg = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, segDepth + 0.01), hullMat);
        seg.position.set(0, 0.04, z);
        seg.castShadow = true;
        seg.receiveShadow = true;
        hull.add(seg);
      });

      const keel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 1.05), darkMat);
      keel.position.set(0, -0.08, 0);
      keel.castShadow = true;
      hull.add(keel);

      [-1, 1].forEach(side => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 1.0), trimMat);
        rail.position.set(side * 0.24, 0.15, 0);
        hull.add(rail);
      });

      const prowPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.12), hullMat);
      prowPost.position.set(0, 0.22, 0.58);
      prowPost.rotation.x = -0.55;
      prowPost.castShadow = true;
      hull.add(prowPost);

      const prowTip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), darkMat);
      prowTip.rotation.x = -0.55;
      prowTip.rotation.y = Math.PI / 4;
      prowTip.position.set(0, 0.44, 0.7);
      prowTip.castShadow = true;
      hull.add(prowTip);

      const sternPost = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.32, 0.1), hullMat);
      sternPost.position.set(0, 0.16, -0.58);
      sternPost.rotation.x = 0.4;
      sternPost.castShadow = true;
      hull.add(sternPost);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.62, 6), darkMat);
      mast.position.set(0, 0.36, -0.1);
      mast.castShadow = true;
      hull.add(mast);

      const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 6), darkMat);
      yard.rotation.z = Math.PI / 2;
      yard.position.set(0, 0.56, -0.1);
      yard.castShadow = true;
      hull.add(yard);

      const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.32), sailMat);
      sail.position.set(0, 0.4, -0.1);
      sail.rotation.y = Math.PI / 2;
      hull.add(sail);

      const pennant = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 3), sailMat);
      pennant.rotation.z = Math.PI / 2;
      pennant.rotation.y = Math.PI / 2;
      pennant.position.set(0, 0.66, -0.1);
      hull.add(pennant);

      const shieldZs = [-0.32, 0.06, 0.34];
      shieldZs.forEach((z, i) => {
        [-1, 1].forEach(side => {
          const shield = new THREE.Mesh(
            new THREE.CylinderGeometry(0.09, 0.09, 0.02, 8),
            i % 2 === 0 ? shieldMatA : shieldMatB
          );
          shield.rotation.z = Math.PI / 2;
          shield.position.set(side * 0.27, 0.05, z);
          hull.add(shield);
        });
      });

      return boat;
    }

    // --- 7. HUMANOID CREATOR ---
    const hpContainer = document.getElementById('hp-container');

    // A thin box "ring" wrapped around a blocky head, plus two trailing
    // knot tails - reads as a hachimaki (Japanese headband) at this scale.
    // Used to give raiders a Far East silhouette when that biome is active.
    // Jagged crown for the Lich - a tight iron-dark band hugging the bare
    // skull (sized against the same 0.3-unit head cube as
    // createHeadband, just closer-fitting) with three glowing icy-blue
    // spikes jutting up off it: a tall center spike over the brow and a
    // shorter one over each ear, echoing Warcraft III's Lich crown.
    // Parented to head in createBlockyHumanoid's isLich branch, the same
    // way createCultHood is parented for the Acolyte.
    function createLichCrown(bandColor = 0x3a4452, spikeColor = 0xaef2ff) {
      const group = new THREE.Group();
      const bandMat = new THREE.MeshLambertMaterial({ color: bandColor });
      const spikeMat = new THREE.MeshLambertMaterial({ color: spikeColor, emissive: 0x2ec8e6 });

      const front = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.02), bandMat);
      front.position.set(0, 0.12, 0.16);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.02), bandMat);
      back.position.set(0, 0.12, -0.16);
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.32), bandMat);
      left.position.set(-0.16, 0.12, 0);
      const right = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.32), bandMat);
      right.position.set(0.16, 0.12, 0);
      group.add(front, back, left, right);

      const spikeGeo = new THREE.ConeGeometry(0.035, 0.16, 5);
      const centerSpike = new THREE.Mesh(spikeGeo, spikeMat);
      centerSpike.position.set(0, 0.24, 0.13);
      centerSpike.rotation.x = -0.15;
      group.add(centerSpike);

      const sideSpikeGeo = new THREE.ConeGeometry(0.028, 0.11, 5);
      const sideSpikeL = new THREE.Mesh(sideSpikeGeo, spikeMat);
      sideSpikeL.position.set(-0.15, 0.21, -0.02);
      sideSpikeL.rotation.z = 0.35;
      group.add(sideSpikeL);
      const sideSpikeR = new THREE.Mesh(sideSpikeGeo, spikeMat);
      sideSpikeR.position.set(0.15, 0.21, -0.02);
      sideSpikeR.rotation.z = -0.35;
      group.add(sideSpikeR);

      return group;
    }

    // High popped collar for the Lich, styled after a classic vampire
    // cape collar - two flat wings flaring up and outward from the
    // shoulders to frame the jaw, plus a low back plate joining them
    // behind the neck, each wing showing a narrower lining color on its
    // inward-facing side against the darker outer panel. Parented to
    // `body` (not `head`) in createBlockyHumanoid's isLich branch, the
    // same way createRoninRobe's shoulder pieces are, since it needs to
    // rise up from the shoulder line rather than hang off the skull.
    function createVampireCollar(color = 0x1c2438, liningColor = 0x7fe8ff) {
      const group = new THREE.Group();
      const outerMat = new THREE.MeshLambertMaterial({ color });
      const liningMat = new THREE.MeshLambertMaterial({ color: liningColor });

      const wingGeo = new THREE.BoxGeometry(0.035, 0.3, 0.15);
      const liningGeo = new THREE.BoxGeometry(0.012, 0.26, 0.11);

      const wingL = new THREE.Mesh(wingGeo, outerMat);
      wingL.position.set(-0.14, 0.16, -0.02);
      wingL.rotation.z = 0.55;
      wingL.rotation.y = 0.3;
      wingL.castShadow = true;
      group.add(wingL);

      const liningL = new THREE.Mesh(liningGeo, liningMat);
      liningL.position.set(0.02, 0, 0.025);
      wingL.add(liningL);

      const wingR = new THREE.Mesh(wingGeo, outerMat);
      wingR.position.set(0.14, 0.16, -0.02);
      wingR.rotation.z = -0.55;
      wingR.rotation.y = -0.3;
      wingR.castShadow = true;
      group.add(wingR);

      const liningR = new THREE.Mesh(liningGeo, liningMat);
      liningR.position.set(-0.02, 0, 0.025);
      wingR.add(liningR);

      const backPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.03), outerMat);
      backPlate.position.set(0, 0.13, -0.08);
      backPlate.castShadow = true;
      group.add(backPlate);

      return group;
    }

    function createHeadband(color) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });

      const front = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.02), mat);
      front.position.set(0, 0.04, 0.16);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.02), mat);
      back.position.set(0, 0.04, -0.16);
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.32), mat);
      left.position.set(-0.16, 0.04, 0);
      const right = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.32), mat);
      right.position.set(0.16, 0.04, 0);
      group.add(front, back, left, right);

      const tailGeo = new THREE.BoxGeometry(0.05, 0.16, 0.02);
      const tailL = new THREE.Mesh(tailGeo, mat);
      tailL.position.set(-0.04, -0.06, -0.17);
      tailL.rotation.x = 0.3;
      const tailR = new THREE.Mesh(tailGeo, mat);
      tailR.position.set(0.04, -0.08, -0.17);
      tailR.rotation.x = 0.15;
      group.add(tailL, tailR);

      return group;
    }

    // Angel head accessory - a plain glowing halo floating flat above the
    // head, worn in place of the hachimaki headband every other raider
    // variant gets (see the isAngel branch in createBlockyHumanoid, which
    // takes priority over the plain headbandColor branch below). White-gold
    // to match ANGEL_THEME. Parented to `head` like the other accessories
    // above so it turns naturally with idle/attack head movement.
    function createAngelHalo() {
      const group = new THREE.Group();
      const haloMat = new THREE.MeshBasicMaterial({ color: 0xfff2c4, transparent: true, opacity: 0.95 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.016, 8, 24), haloMat);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      // Soft outer glow ring, same idea as the Goddess of Life's halo.
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
      const glow = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.032, 8, 24), glowMat);
      glow.rotation.x = Math.PI / 2;
      group.add(glow);

      group.position.set(0, 0.26, 0);
      return group;
    }

    // Keffiyeh/ghutra - a draped cloth headwrap for Desert-biome raiders,
    // giving them an Arabian silhouette instead of the Far East hachimaki.
    // A domed cap over the crown, front/back/side flaps draping down past
    // the shoulders, and a dark agal cord ring holding it all in place.
    function createHeadwrapKeffiyeh(clothColor, cordColor) {
      const group = new THREE.Group();
      const clothMat = new THREE.MeshLambertMaterial({ color: clothColor });
      const cordMat = new THREE.MeshLambertMaterial({ color: cordColor });

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.34), clothMat);
      cap.position.y = 0.16;
      group.add(cap);

      // Front flap - drapes down over the brow.
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.03), clothMat);
      front.position.set(0, 0.02, 0.165);
      group.add(front);

      // Back flap - drapes down over the nape.
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.03), clothMat);
      back.position.set(0, -0.02, -0.165);
      group.add(back);

      // Side flaps - the signature part of the silhouette, hanging down
      // past the shoulders on either side of the head.
      const sideGeo = new THREE.BoxGeometry(0.05, 0.34, 0.3);
      const sideL = new THREE.Mesh(sideGeo, clothMat);
      sideL.position.set(-0.175, -0.05, 0);
      sideL.rotation.z = 0.05;
      group.add(sideL);
      const sideR = new THREE.Mesh(sideGeo, clothMat);
      sideR.position.set(0.175, -0.05, 0);
      sideR.rotation.z = -0.05;
      group.add(sideR);

      // Agal - the dark cord ring worn around the crown to hold the cloth
      // in place.
      const agal = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.02, 6, 12), cordMat);
      agal.rotation.x = Math.PI / 2;
      agal.position.y = 0.12;
      group.add(agal);

      return group;
    }

    // Turban - a wound cloth headwrap, the other Desert-biome raider
    // headwear variant alongside the keffiyeh above. Built from a few
    // stacked, shrinking torus "coils" to read as wrapped fabric rather
    // than a single smooth dome, plus a short trailing tail of cloth.
    function createHeadwrapTurban(clothColor) {
      const group = new THREE.Group();
      const clothMat = new THREE.MeshLambertMaterial({ color: clothColor });

      const coilGeo = new THREE.TorusGeometry(0.17, 0.055, 6, 10);
      for (let i = 0; i < 3; i++) {
        const coil = new THREE.Mesh(coilGeo, clothMat);
        coil.rotation.x = Math.PI / 2;
        coil.position.set((i - 1) * 0.015, 0.1 + i * 0.05, (i - 1) * 0.01);
        coil.scale.setScalar(1 - i * 0.12);
        group.add(coil);
      }

      // Crown cap - fills in the top so it doesn't look hollow from above.
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), clothMat);
      cap.position.y = 0.22;
      group.add(cap);

      // Trailing tail - a short loose end hanging down one side.
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.03), clothMat);
      tail.position.set(0.15, 0.02, 0.1);
      tail.rotation.z = 0.3;
      group.add(tail);

      return group;
    }

    // A samurai-style tied-back queue for the Dragon Ronin, replacing its
    // old hachimaki headband now that it wears a wizard hat instead: a
    // hair mass at the back of the head with a bound tail hanging down
    // behind the neck. Deliberately kept low, well below the hat's own
    // brim (which is wide enough to shadow most of the head right at
    // crown height) so the tail actually reads as visible hair instead
    // of disappearing under it.
    function createSamuraiHair(color = 0x161010, tieColor = 0xb5202a) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });
      const tieMat = new THREE.MeshLambertMaterial({ color: tieColor });

      const back = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.12), mat);
      back.position.set(0, 0, -0.17);
      back.castShadow = true;
      group.add(back);

      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.28, 8), mat);
      tail.position.set(0, -0.28, -0.2);
      tail.rotation.x = 0.15; // hangs down behind the neck, angled slightly out
      tail.castShadow = true;
      group.add(tail);

      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 10), tieMat);
      tie.rotation.x = Math.PI / 2;
      tie.position.set(0, -0.13, -0.19);
      group.add(tie);

      return group;
    }

    // Short, combed-back hair for the Paladin Leader, who fights
    // bare-headed (no knight helmet - see equipUnit's 'paladins' branch)
    // and reads as bare-skulled without something on top. A flat cap
    // across the crown plus a slightly larger back piece gives a cropped
    // "commander" silhouette rather than the Dragon Ronin's tied-back
    // queue, which would look out of place on a western-plate Paladin.
    function createCommanderHair(color = 0x3b2415) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });

      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.07, 0.31), mat);
      crown.position.set(0, 0.145, 0);
      crown.castShadow = true;
      group.add(crown);

      const back = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.16, 0.08), mat);
      back.position.set(0, 0.06, -0.15);
      back.castShadow = true;
      group.add(back);

      return group;
    }

    // Long, flowing hair for the Valkyrie, replacing the generic cropped
    // "commander" style it used to borrow (see equipUnit's 'valkyrie'
    // branch) with something that actually reads as a shieldmaiden:
    // a center-parted crown, strands framing the face, a back mass that
    // flows down into a three-segment tapering tail past the shoulder
    // blades, a single braid swept forward over one shoulder, and a thin
    // gold circlet across the brow that echoes the wings' own trim color
    // (see createValkyrieWings) so the whole silhouette reads as one
    // cohesive golden-and-white set. The tail is kept close to the spine
    // (z around -0.1 to -0.18) rather than spreading wide, so it clears
    // the wing struts mounted further out at the shoulder blades instead
    // of tangling with them.
    function createValkyrieHair(color = 0xf0d18e) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });
      const trimMat = new THREE.MeshLambertMaterial({ color: 0xf2c14e });

      // Center part - two angled slabs across the crown instead of one
      // flat cap, so the hairline reads as parted rather than a solid lid.
      const crownL = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.065, 0.32), mat);
      crownL.position.set(-0.08, 0.145, 0);
      crownL.rotation.z = 0.12;
      crownL.castShadow = true;
      group.add(crownL);
      const crownR = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.065, 0.32), mat);
      crownR.position.set(0.08, 0.145, 0);
      crownR.rotation.z = -0.12;
      crownR.castShadow = true;
      group.add(crownR);

      // Strands framing the face down past the temples.
      [-1, 1].forEach(side => {
        const strand = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.24, 0.065), mat);
        strand.position.set(side * 0.155, -0.03, 0.1);
        strand.rotation.z = side * -0.06;
        strand.castShadow = true;
        group.add(strand);
      });

      // Solid mass at the back of the head bridging into the flowing tail.
      const backMass = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.1), mat);
      backMass.position.set(0, 0.02, -0.16);
      backMass.castShadow = true;
      group.add(backMass);

      // Three tapering segments falling down the back, each a little
      // thinner and angled further forward than the last, so the tail
      // reads as loose hair settling against the back rather than a
      // single stiff rod (same "graduated" idea as the wings' own
      // feather fans in createValkyrieWings).
      const flowSegments = [
        { len: 0.24, r0: 0.11,  r1: 0.09,  y: -0.2,  z: -0.18, rotX: 0.05 },
        { len: 0.22, r0: 0.09,  r1: 0.065, y: -0.4,  z: -0.16, rotX: 0.12 },
        { len: 0.18, r0: 0.065, r1: 0.03,  y: -0.58, z: -0.1,  rotX: 0.22 },
      ];
      flowSegments.forEach(seg => {
        const piece = new THREE.Mesh(new THREE.CylinderGeometry(seg.r1, seg.r0, seg.len, 6), mat);
        piece.position.set(0, seg.y, seg.z);
        piece.rotation.x = seg.rotX;
        piece.castShadow = true;
        group.add(piece);
      });

      // A single thin braid swept forward over the right shoulder, tied
      // off with a small gold ring, for a bit of asymmetry against the
      // plain flowing mass behind it.
      const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, 0.32, 6), mat);
      braid.position.set(0.13, -0.12, 0.13);
      braid.rotation.z = 0.35;
      braid.rotation.x = 0.3;
      braid.castShadow = true;
      group.add(braid);
      const braidTie = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 10), trimMat);
      braidTie.rotation.x = Math.PI / 2;
      braidTie.position.set(0.1, -0.02, 0.12);
      group.add(braidTie);

      // Thin gold circlet across the brow, matching the wings' trim tint.
      const circletFront = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.025, 0.02), trimMat);
      circletFront.position.set(0, 0.095, 0.155);
      group.add(circletFront);
      const circletL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.22), trimMat);
      circletL.position.set(-0.16, 0.095, 0);
      group.add(circletL);
      const circletR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.22), trimMat);
      circletR.position.set(0.16, 0.095, 0);
      group.add(circletR);

      return group;
    }

    // Long hair for Kitsune Twinblade member 0 "Ember Fang" (see
    // createKitsuneBladeHumanoid) - loose and windswept per the
    // reference art: falls well past the shoulders with a slight
    // sideways sway through the tail instead of hanging perfectly
    // straight down the spine. The crown/back pieces are sized a hair
    // past the head's own 0.3x0.3 box on every side (not flush with it)
    // so no sliver of skin-colored scalp shows through at the seams -
    // an earlier flush-fit version of this cap read as visible bald
    // patches at the crown in testing.
    function createKitsuneLongHair(color) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });

      // Full-coverage cap over the crown - sized a hair wider/deeper than
      // the 0.3x0.3 head box itself (not just matching it) so there's no
      // sliver of skin-colored scalp peeking out at the seams from any
      // angle, front corners included.
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.32), mat);
      cap.position.set(0, 0.15, 0);
      cap.castShadow = true;
      group.add(cap);

      // Thin fringe bridging the cap down to the brow, so there's no
      // bare-forehead gap, without adding real bulk out front.
      const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.035), mat);
      fringe.position.set(0, 0.1, 0.155);
      fringe.castShadow = true;
      group.add(fringe);

      // Full side panels over each temple - covering the whole side of
      // the head between the cap above and where the long strand below
      // picks up, so the temple itself doesn't sit bare above the
      // strand's start point.
      [-1, 1].forEach(side => {
        const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.28), mat);
        sidePanel.position.set(side * 0.16, 0.03, 0);
        sidePanel.castShadow = true;
        group.add(sidePanel);
      });

      // Long strands framing the face down past the shoulders - a lock
      // of hair hanging alongside the cheek, not a wide slab against it.
      [-1, 1].forEach(side => {
        const strand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), mat);
        strand.position.set(side * 0.16, -0.1, 0.07);
        strand.rotation.z = side * -0.1;
        strand.castShadow = true;
        group.add(strand);
      });

      // A modest mass at the back of the head bridging into the flowing
      // tail - tall enough to overlap the cap above it with no seam gap,
      // thin front-to-back so it doesn't puff out into a dome.
      const backMass = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.22, 0.07), mat);
      backMass.position.set(0, 0.05, -0.15);
      backMass.castShadow = true;
      group.add(backMass);

      // Four longer tapering segments falling well past the shoulders,
      // swaying alternately left/right on the way down for a loose,
      // windswept read rather than hair settling straight and flat.
      const flowSegments = [
        { len: 0.26, r0: 0.09,  r1: 0.075, y: -0.18, z: -0.16, x: 0,      rotX: 0.05,  rotZ: 0.05 },
        { len: 0.26, r0: 0.075, r1: 0.06,  y: -0.42, z: -0.14, x: 0.02,   rotX: 0.1,   rotZ: -0.08 },
        { len: 0.24, r0: 0.06,  r1: 0.045, y: -0.64, z: -0.09, x: -0.02,  rotX: 0.2,   rotZ: 0.12 },
        { len: 0.2,  r0: 0.045, r1: 0.02,  y: -0.84, z: -0.02, x: 0.03,   rotX: 0.32,  rotZ: -0.14 },
      ];
      flowSegments.forEach(seg => {
        const piece = new THREE.Mesh(new THREE.CylinderGeometry(seg.r1, seg.r0, seg.len, 6), mat);
        piece.position.set(seg.x, seg.y, seg.z);
        piece.rotation.x = seg.rotX;
        piece.rotation.z = seg.rotZ;
        piece.castShadow = true;
        group.add(piece);
      });

      // A couple of loose, windswept wisps flicking out to one side, so
      // the whole mane doesn't read as one perfectly tidy rope.
      [{ y: -0.3, z: -0.1 }, { y: -0.5, z: -0.05 }].forEach(pos => {
        const wisp = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.22, 5), mat);
        wisp.position.set(0.13, pos.y, pos.z);
        wisp.rotation.z = -0.7;
        wisp.rotation.x = 0.15;
        wisp.castShadow = true;
        group.add(wisp);
      });

      return group;
    }

    // Short, tousled hair for Kitsune Twinblade member 1 "Frost Warden"
    // (see createKitsuneSpearHumanoid) - a cropped, layered cut per the
    // reference art: spiky/uneven on top, a side-swept fringe rather
    // than a straight-across bang, and short sides that stop at the
    // jaw with no long strands or ponytail down the back.
    function createKitsuneShortHair(color) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });

      // Full-coverage base layer sitting right against the scalp, under
      // the tousled top pieces below - those are deliberately uneven/
      // overlapping for a spiky read and don't reliably cover every seam
      // by themselves, so this solid layer underneath guarantees no
      // skin-colored gaps show through no matter the angle.
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.05, 0.31), mat);
      base.position.set(0, 0.15, 0);
      base.castShadow = true;
      group.add(base);

      // Tousled top - three overlapping slabs at slightly different
      // heights/angles instead of one flat cap, for a layered, spiky
      // read rather than a smooth helmet-like crown.
      const topPieces = [
        { w: 0.22, h: 0.06, d: 0.2,  x: -0.04, y: 0.16,  z: -0.03, rotZ: 0.1,  rotX: -0.05 },
        { w: 0.2,  h: 0.06, d: 0.18, x: 0.06,  y: 0.175, z: -0.06, rotZ: -0.14, rotX: 0.08 },
        { w: 0.16, h: 0.05, d: 0.16, x: 0.0,   y: 0.19,  z: 0.02,  rotZ: 0.05, rotX: -0.12 },
      ];
      topPieces.forEach(p => {
        const piece = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat);
        piece.position.set(p.x, p.y, p.z);
        piece.rotation.z = p.rotZ;
        piece.rotation.x = p.rotX;
        piece.castShadow = true;
        group.add(piece);
      });

      // Side-swept fringe - longer over one eye than the other, instead
      // of a symmetric straight-across bang.
      const fringeL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.04), mat);
      fringeL.position.set(-0.06, 0.095, 0.155);
      fringeL.rotation.z = 0.1;
      fringeL.castShadow = true;
      group.add(fringeL);
      const fringeR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.04), mat);
      fringeR.position.set(0.1, 0.115, 0.15);
      fringeR.rotation.z = -0.08;
      fringeR.castShadow = true;
      group.add(fringeR);

      // Full side panels over each temple - covering the whole side of
      // the head from the base layer above down past the ear to the
      // jaw, and front-to-back enough to meet the fringe and back mass
      // with no seam gap. A thin single strand here previously left the
      // temple/side of the head bare.
      [-1, 1].forEach(side => {
        const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.28), mat);
        sidePanel.position.set(side * 0.16, 0.03, 0);
        sidePanel.castShadow = true;
        group.add(sidePanel);

        // A short flicked-out tip at the jawline on top of the panel,
        // so the cut still reads as choppy short hair rather than a
        // flat helmet side.
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.05), mat);
        tip.position.set(side * 0.17, -0.1, 0.06);
        tip.rotation.z = side * -0.15;
        tip.castShadow = true;
        group.add(tip);
      });

      // A short mass hugging the nape - cropped, not bridging into any
      // flowing tail. Tall enough to overlap the base layer above it
      // with no seam gap.
      const backMass = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.08), mat);
      backMass.position.set(0, 0.06, -0.15);
      backMass.castShadow = true;
      group.add(backMass);

      return group;
    }

    // A dark wrap around the lower half of a blocky head - front plate
    // covering the nose/mouth plus two side straps - reads as a ninja face
    // mask. Sits slightly proud of the head's own faces so it doesn't
    // z-fight with the skin material underneath.
    function createFaceMask(color) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });

      const front = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.04), mat);
      front.position.set(0, -0.03, 0.17);
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.3), mat);
      left.position.set(-0.16, -0.03, 0);
      const right = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.3), mat);
      right.position.set(0.16, -0.03, 0);

      group.add(front, left, right);
      return group;
    }

    // A full-face Oni mask for the Akuma Feral - a scowling demon plate
    // covering the whole head (not just the lower half like the Ninja's
    // wrap), with a furrowed brow, two bared ivory tusks, and a pair of
    // curved horns sweeping back off the top. Used to give the Far East's
    // feral raider its unmistakable demon silhouette.
    function createOniMask(color = 0xb5202a) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });
      const accentMat = new THREE.MeshLambertMaterial({ color: 0xf0e6d2 }); // ivory tusks
      const hornMat = new THREE.MeshLambertMaterial({ color: 0x241c1a }); // dark horns

      const face = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.06), mat);
      face.position.set(0, 0, 0.15);
      group.add(face);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.05), mat);
      brow.position.set(0, 0.09, 0.18);
      brow.rotation.x = -0.2;
      group.add(brow);

      const tuskGeo = new THREE.ConeGeometry(0.025, 0.09, 5);
      const tuskL = new THREE.Mesh(tuskGeo, accentMat);
      tuskL.position.set(-0.08, -0.12, 0.19);
      tuskL.rotation.x = Math.PI;
      const tuskR = new THREE.Mesh(tuskGeo, accentMat);
      tuskR.position.set(0.08, -0.12, 0.19);
      tuskR.rotation.x = Math.PI;
      group.add(tuskL, tuskR);

      const hornGeo = new THREE.ConeGeometry(0.035, 0.24, 5);
      const hornL = new THREE.Mesh(hornGeo, hornMat);
      hornL.position.set(-0.09, 0.24, 0.01);
      hornL.rotation.set(0.3, 0, 0.4);
      const hornR = new THREE.Mesh(hornGeo, hornMat);
      hornR.position.set(0.09, 0.24, 0.01);
      hornR.rotation.set(0.3, 0, -0.4);
      group.add(hornL, hornR);

      return group;
    }

    // A curling demon tail for the Akuma Feral - three tapering segments
    // arcing up and back from the hips to a pointed tip. Attached to
    // charGroup itself (not the body box) in createBlockyHumanoid, so it
    // reads as sprouting from the creature's lower back regardless of how
    // the torso leans during animation.
    function createDemonTail(color = 0x3a1620) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });

      const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 6), mat);
      seg1.rotation.x = Math.PI / 2.3;
      group.add(seg1);

      const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.16, 6), mat);
      seg2.position.set(0, 0.07, -0.19);
      seg2.rotation.x = Math.PI / 6;
      group.add(seg2);

      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 6), mat);
      tip.position.set(0, 0.17, -0.28);
      tip.rotation.x = -Math.PI / 2.6;
      group.add(tip);

      return group;
    }

    // Fox ears - a pair of low-poly triangular ears for the Kitsune
    // Twinblade squad (see createKitsuneBladeHumanoid/
    // createKitsuneSpearHumanoid below), angled up and outward off the
    // top of the head with a small two-tone inner-ear patch. Meant to be
    // added as a child of a unit's own `head` mesh so they turn and tilt
    // together with it, same convention as createHeadband/createFaceMask.
    function createFoxEars(furColor = 0xd9722c, innerColor = 0x2a1a12) {
      const group = new THREE.Group();
      const furMat = new THREE.MeshLambertMaterial({ color: furColor });
      const innerMat = new THREE.MeshLambertMaterial({ color: innerColor });

      [-1, 1].forEach(side => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), furMat);
        ear.position.set(side * 0.09, 0.17, 0.01);
        ear.rotation.z = side * 0.35;
        ear.rotation.y = Math.PI / 4;
        ear.castShadow = true;
        group.add(ear);

        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.09, 4), innerMat);
        inner.position.set(side * 0.093, 0.145, 0.02);
        inner.rotation.copy(ear.rotation);
        group.add(inner);
      });

      return group;
    }

    // Fox tail - a bushy, curved tail for the Kitsune Twinblade squad,
    // built from three overlapping fur-colored puffs with a lighter tip
    // segment, same "add to charGroup at hip height" convention
    // createDemonTail above uses (see its attach site in
    // createBlockyHumanoid, and createKitsuneBladeHumanoid/
    // createKitsuneSpearHumanoid below for this tail's own attach site).
    function createFoxTail(furColor = 0xd9722c, tipColor = 0xf2ede0) {
      const group = new THREE.Group();
      const furMat = new THREE.MeshLambertMaterial({ color: furColor });
      const tipMat = new THREE.MeshLambertMaterial({ color: tipColor });

      const base = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), furMat);
      base.position.set(0, 0, -0.05);
      base.scale.set(1, 0.9, 1.3);
      group.add(base);

      const mid = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), furMat);
      mid.position.set(0, 0.06, -0.23);
      mid.scale.set(1, 0.9, 1.2);
      group.add(mid);

      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), tipMat);
      tip.position.set(0, 0.12, -0.4);
      tip.scale.set(0.9, 0.85, 1.1);
      group.add(tip);

      [base, mid, tip].forEach(m => m.castShadow = true);
      return group;
    }

    // Abandoned Farm House - the derelict farmstead's building, standing
    // beside the dormant Scarecrow's wheat field on Shadow Island's Swamp
    // variant. A sagging, weather-grayed timber house: gabled roof with a
    // caved-in hole, boarded-up windows, a door hanging open onto a dark
    // interior, a crooked mossy chimney, and straw-patched, moss-stained
    // shingles. Its front (+z) is turned by rotY to face the Scarecrow.
    function createAbandonedFarmHouse(x, y, z, rotY) {
      const house = new THREE.Group();
      const plankMat = new THREE.MeshLambertMaterial({ color: 0x6b5d4c });
      const plankDarkMat = new THREE.MeshLambertMaterial({ color: 0x3d3427 });
      const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a3f33 });
      const mossMat = new THREE.MeshLambertMaterial({ color: 0x475c3c });
      const strawMat = new THREE.MeshLambertMaterial({ color: 0x8a7a4a });
      const voidMat = new THREE.MeshLambertMaterial({ color: 0x0c0806 });

      const W = 0.7, H = 0.46, D = 0.56;
      const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), plankMat);
      body.position.y = H / 2;
      body.castShadow = true;
      house.add(body);

      // Gable end-walls filling in under the roof slopes.
      const gableShape = new THREE.Shape();
      gableShape.moveTo(-W / 2, 0);
      gableShape.lineTo(W / 2, 0);
      gableShape.lineTo(0, 0.22);
      gableShape.closePath();
      const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(gableShape, { depth: D, bevelEnabled: false }), plankDarkMat);
      gable.position.set(0, H, -D / 2);
      gable.castShadow = true;
      house.add(gable);

      // Roof - two slabs meeting at the ridge (+/-0.55 rad pitch). The
      // left slope has caved in: split into a front and back piece with a
      // gap between them, and a dark hole showing through.
      const pitch = 0.55, slab = 0.46;
      const slabX = (slab / 2) * Math.cos(pitch), slabY = H + slab * Math.sin(pitch) - (slab / 2) * Math.sin(pitch);
      const rightSlab = new THREE.Mesh(new THREE.BoxGeometry(slab, 0.03, D + 0.1), roofMat);
      rightSlab.position.set(slabX, slabY, 0);
      rightSlab.rotation.z = -pitch;
      rightSlab.castShadow = true;
      house.add(rightSlab);
      [[-0.2, 0.2], [0.24, 0.16]].forEach(([zc, len]) => {
        const piece = new THREE.Mesh(new THREE.BoxGeometry(slab, 0.03, len), roofMat);
        piece.position.set(-slabX, slabY - (zc > 0 ? 0.015 : 0), zc);
        piece.rotation.z = pitch + (zc > 0 ? 0.08 : 0);
        piece.castShadow = true;
        house.add(piece);
      });
      const roofHole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.16), voidMat);
      roofHole.position.set(-slabX + 0.02, H + 0.005, 0.02);
      house.add(roofHole);
      // Snapped rafters poking up out of the hole.
      [-0.05, 0.07].forEach((rz, i) => {
        const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.03), plankDarkMat);
        rafter.position.set(-slabX + 0.03 + i * 0.05, H + 0.11, rz);
        rafter.rotation.set(0.15 * (i ? 1 : -1), 0, (i ? -1 : 1) * 0.5);
        house.add(rafter);
      });

      // Straw thatch patches and moss on the surviving shingles.
      const thatch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.2), strawMat);
      thatch.position.set(slabX - 0.02, slabY + 0.02, -0.12);
      thatch.rotation.z = -pitch;
      house.add(thatch);
      const moss = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.18), mossMat);
      moss.position.set(slabX + 0.06, slabY - 0.03, 0.14);
      moss.rotation.z = -pitch;
      house.add(moss);

      // Doorway on the front (+z): a dark opening with the door hanging
      // half off its hinges, and a broken step.
      const doorway = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.27, 0.01), voidMat);
      doorway.position.set(0, 0.135, D / 2 + 0.003);
      house.add(doorway);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.26, 0.02), darkWoodMat);
      door.position.set(-0.1, 0.13, D / 2 + 0.06);
      door.rotation.set(0, 1.0, 0.08);
      house.add(door);
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.1), plankDarkMat);
      step.position.set(0.02, 0.015, D / 2 + 0.09);
      step.rotation.y = 0.12;
      house.add(step);

      // Boarded-up windows - a dark opening with two planks nailed across.
      [-0.24, 0.24].forEach(wx => {
        const hole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.01), voidMat);
        hole.position.set(wx, 0.3, D / 2 + 0.003);
        house.add(hole);
        [0.45, -0.45].forEach(a => {
          const board = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.015), plankDarkMat);
          board.position.set(wx, 0.3, D / 2 + 0.014);
          board.rotation.z = a;
          house.add(board);
        });
      });

      // Missing / warped wall planks along the side and a lean-to fallen
      // board.
      const gapBoard = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.14), voidMat);
      gapBoard.position.set(W / 2 + 0.003, 0.2, -0.1);
      house.add(gapBoard);
      const fallen = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.09), plankDarkMat);
      fallen.position.set(W / 2 + 0.08, 0.15, -0.1);
      fallen.rotation.z = -0.45;
      house.add(fallen);

      // Crooked, moss-streaked stone chimney on the surviving slope.
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), mossyStoneMat);
      chimney.position.set(0.2, H + 0.2, -0.14);
      chimney.rotation.z = 0.14;
      chimney.castShadow = true;
      house.add(chimney);

      house.scale.setScalar(STRUCTURE_SCALE);
      house.position.set(x, y, z);
      house.rotation.set(0, rotY || 0, 0.02);
      addCollider(x, z, 0.55 * STRUCTURE_SCALE);
      return house;
    }

    // One tile of overgrown, withered wheat field - a few dozen leaning
    // stalks with drooping ears, drawn as two InstancedMeshes (stems +
    // ears) so a whole 10+ tile field stays cheap. Decorative only.
    function createWheatField(x, y, z) {
      const field = new THREE.Group();
      const COUNT = 40;
      const STEM_H = 0.42;
      const stemGeo = new THREE.BoxGeometry(0.014, STEM_H, 0.014);
      stemGeo.translate(0, STEM_H / 2, 0);
      const earGeo = new THREE.BoxGeometry(0.032, 0.11, 0.032);
      earGeo.translate(0, 0.055, 0);
      const stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshLambertMaterial({ color: 0x8f8348 }), COUNT);
      const ears = new THREE.InstancedMesh(earGeo, new THREE.MeshLambertMaterial({ color: 0xc4a44a }), COUNT);
      const dummy = new THREE.Object3D();
      const tip = new THREE.Vector3();
      for (let i = 0; i < COUNT; i++) {
        const px = (Math.random() - 0.5) * 0.92;
        const pz = (Math.random() - 0.5) * 0.92;
        const h = 0.75 + Math.random() * 0.5;
        dummy.position.set(px, 0, pz);
        dummy.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        stems.setMatrixAt(i, dummy.matrix);

        // Ear sits at the tip of its (tilted, stretched) stem.
        tip.set(0, STEM_H * h, 0).applyEuler(dummy.rotation);
        dummy.position.set(px + tip.x, tip.y, pz + tip.z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        ears.setMatrixAt(i, dummy.matrix);
      }
      stems.instanceMatrix.needsUpdate = true;
      ears.instanceMatrix.needsUpdate = true;
      // Instances are spread across the tile, well outside the base
      // geometry's own bounding sphere - don't let culling drop them.
      stems.frustumCulled = false;
      ears.frustumCulled = false;
      field.add(stems, ears);
      field.position.set(x, y, z);
      return field;
    }

    // --- Scarecrow (Demon faction, Shadow Island Swamp) ---
    // One shared look used by both the dormant scenery prop
    // (createScarecrowProp) and the awake raider (createBlockyHumanoid's
    // isScarecrow branch), so the thing that climbs down off the post is
    // recognizably the same scarecrow: a burlap-sack head with a stitched
    // face, a droopy tattered hat, straw spilling from every cuff and
    // tear, a ragged patchwork coat, and a crow.

    // A loose handful of straw - blades fan out and hang downward from
    // the origin, so it reads as straw poking out of a cuff or hem.
    // Rotate the returned group to aim it elsewhere.
    function createStrawTuft(blades = 6, length = 0.12, spread = 0.7) {
      const tuft = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: SCARECROW_STRAW_COLOR });
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < blades; i++) {
        const len = length * (0.7 + Math.random() * 0.6);
        const a = (i / blades) * Math.PI * 2 + Math.random() * 0.5;
        const tilt = 0.2 + Math.random() * spread;
        const dir = new THREE.Vector3(Math.cos(a) * Math.sin(tilt), -Math.cos(tilt), Math.sin(a) * Math.sin(tilt));
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, len, 0.012), mat);
        blade.position.copy(dir.clone().multiplyScalar(len / 2));
        blade.quaternion.setFromUnitVectors(up, dir);
        tuft.add(blade);
      }
      return tuft;
    }

    // Stitched burlap face for a 0.3-unit head cube (front is +z) plus the
    // rope tied around the neck. awake=false is the plain dark button-eyed
    // scarecrow face; awake=true adds glowing hellish eyes and an ember-lit
    // mouth behind the stitches.
    function createScarecrowFace(awake) {
      const face = new THREE.Group();
      const dark = new THREE.MeshLambertMaterial({ color: 0x150f0c });
      const glow = new THREE.MeshBasicMaterial({ color: SCARECROW_EYE_GLOW });

      [-0.065, 0.065].forEach(ex => {
        const socket = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.065, 0.012), dark);
        socket.position.set(ex, 0.03, 0.152);
        face.add(socket);
        if (awake) {
          const ember = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.01), glow);
          ember.position.set(ex, 0.03, 0.16);
          face.add(ember);
        }
      });

      if (awake) {
        const mouthGlow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.006), new THREE.MeshBasicMaterial({ color: 0x7a1a08 }));
        mouthGlow.position.set(0, -0.065, 0.151);
        face.add(mouthGlow);
      }
      const mouthLine = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.014, 0.012), dark);
      mouthLine.position.set(0, -0.065, 0.153);
      mouthLine.rotation.z = 0.06;
      face.add(mouthLine);
      for (let i = 0; i < 5; i++) {
        const stitch = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.012), dark);
        stitch.position.set(-0.07 + i * 0.035, -0.065, 0.154);
        stitch.rotation.z = (i % 2 ? 1 : -1) * 0.12;
        face.add(stitch);
      }

      // Stitched seam across the brow of the sack.
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.012), dark);
      seam.position.set(0.01, 0.105, 0.152);
      seam.rotation.z = -0.08;
      face.add(seam);

      const ropeMat = new THREE.MeshLambertMaterial({ color: 0x5a4630 });
      const rope = new THREE.Mesh(new THREE.BoxGeometry(0.325, 0.035, 0.325), ropeMat);
      rope.position.y = -0.14;
      face.add(rope);
      return face;
    }

    // Droopy, tattered wide-brim hat with a crooked crown and a
    // dog-eared tip, straw sticking out from under the brim. Sits on top
    // of a 0.3-unit head cube (head-local origin = head center).
    function createScarecrowHat() {
      const hat = new THREE.Group();
      const clothMat = new THREE.MeshLambertMaterial({ color: 0x2c2030 });
      const bandMat = new THREE.MeshLambertMaterial({ color: 0x6b2a52 });

      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 10), clothMat);
      brim.position.y = 0.16;
      brim.rotation.set(-0.06, 0, 0.1);
      brim.castShadow = true;
      hat.add(brim);

      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.2, 8), clothMat);
      crown.position.set(0.01, 0.27, 0);
      crown.rotation.z = -0.12;
      crown.castShadow = true;
      hat.add(crown);

      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.153, 0.158, 0.04, 8), bandMat);
      band.position.set(0.0, 0.19, 0);
      band.rotation.z = -0.12;
      hat.add(band);

      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 8), clothMat);
      tip.position.set(-0.04, 0.43, 0);
      tip.rotation.z = 0.7;
      hat.add(tip);

      for (let i = 0; i < 5; i++) {
        const a = -0.6 + i * 0.9;
        const tuft = createStrawTuft(4, 0.1, 0.5);
        tuft.position.set(Math.sin(a) * 0.25, 0.15, Math.cos(a) * 0.25);
        hat.add(tuft);
      }
      return hat;
    }

    // A small black crow - perched on the awake Scarecrow's shoulder and on
    // the dormant prop's cross-beam. Faces +z.
    function createScarecrowCrow() {
      const crow = new THREE.Group();
      const black = new THREE.MeshLambertMaterial({ color: 0x141018 });
      const beakMat = new THREE.MeshLambertMaterial({ color: 0xc9782a });
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.15), black);
      body.position.set(0, 0.05, 0);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), black);
      head.position.set(0, 0.1, 0.075);
      const beak = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.05), beakMat);
      beak.position.set(0, 0.095, 0.125);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.09), black);
      tail.position.set(0, 0.045, -0.11);
      tail.rotation.x = -0.25;
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.05, 0.11), black);
      wingL.position.set(-0.048, 0.055, -0.01);
      const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.05, 0.11), black);
      wingR.position.set(0.048, 0.055, -0.01);
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.012), eyeMat);
      eyeL.position.set(-0.031, 0.105, 0.085);
      const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.012), eyeMat);
      eyeR.position.set(0.031, 0.105, 0.085);
      crow.add(body, head, beak, tail, wingL, wingR, eyeL, eyeR);
      return crow;
    }

    // Front patches, a torn-open chest with straw spilling out, a rope
    // belt, and ragged back panels for a 0.35x0.45x0.22 torso box
    // (torso-local origin = torso center; front is +z). Shared by the
    // dormant prop and the awake raider.
    function createScarecrowTorsoDetails() {
      const d = new THREE.Group();
      const stitchMat = new THREE.MeshLambertMaterial({ color: 0x140e0c });
      const patch = (color, w, h, x, y) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), new THREE.MeshLambertMaterial({ color }));
        m.position.set(x, y, 0.117);
        d.add(m);
        [h / 2, -h / 2].forEach(oy => {
          const st = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.008, 0.014), stitchMat);
          st.position.set(x, y + oy, 0.118);
          d.add(st);
        });
      };
      patch(0x6b4a2e, 0.12, 0.11, -0.08, 0.1);
      patch(0x4a5a3a, 0.1, 0.1, 0.09, -0.09);

      const tear = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.006), new THREE.MeshLambertMaterial({ color: 0x0e0a08 }));
      tear.position.set(0.03, 0.02, 0.114);
      d.add(tear);
      const chestStraw = createStrawTuft(6, 0.11, 0.6);
      chestStraw.position.set(0.03, 0.03, 0.118);
      chestStraw.rotation.x = -Math.PI / 2; // hang-down blades now point out of the chest
      d.add(chestStraw);

      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.035, 0.24), new THREE.MeshLambertMaterial({ color: 0x5a4630 }));
      belt.position.y = -0.19;
      d.add(belt);

      const ragMat = new THREE.MeshLambertMaterial({ color: 0x2a1e2a });
      [[-0.1, 0.34, 0.06], [0.02, 0.46, -0.05], [0.12, 0.3, 0.08]].forEach(([rx, rh, rz]) => {
        const rag = new THREE.Mesh(new THREE.BoxGeometry(0.1, rh, 0.012), ragMat);
        rag.position.set(rx, -0.05 - rh / 2 + 0.05, -0.122);
        rag.rotation.z = rz;
        d.add(rag);
      });
      return d;
    }

    // The awake Scarecrow's weapon - a battered farm scythe with a rusted,
    // notched blade and a rag tied at the collar. Built upright along +y
    // like the Onryo staff (see equipUnit's 'scarecrowScythe' branch), with
    // the blade hooking forward (+z) off the top of the snath.
    function createScarecrowScythe() {
      const scythe = new THREE.Group();
      const shaftMat = new THREE.MeshLambertMaterial({ color: 0x4b3522 });
      const steelMat = new THREE.MeshLambertMaterial({ color: 0x8b8580 });
      const rustMat = new THREE.MeshLambertMaterial({ color: 0x7a4a2c });
      const ragMat = new THREE.MeshLambertMaterial({ color: 0x5a1f2a });

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 1.0, 6), shaftMat);
      shaft.position.y = 0.22;
      shaft.castShadow = true;
      scythe.add(shaft);

      // The little side handle a scythe's snath has for the off hand.
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.13, 5), shaftMat);
      peg.rotation.z = Math.PI / 2;
      peg.position.set(0.06, 0.34, 0);
      scythe.add(peg);

      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, 0.055), rustMat);
      collar.position.y = 0.7;
      scythe.add(collar);

      const rag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.012), ragMat);
      rag.position.set(0.03, 0.62, 0);
      rag.rotation.z = 0.25;
      scythe.add(rag);

      // Curved blade - a fan of tapering slabs following a circular arc in
      // the Y/Z plane, alternating rusty and bare steel down its length.
      const R = 0.26, top = 0.78, cy = top - R;
      const N = 6, phiMax = 1.9;
      for (let i = 0; i < N; i++) {
        const p0 = i / N * phiMax, p1 = (i + 1) / N * phiMax, pm = (p0 + p1) / 2;
        const segLen = R * (p1 - p0) * 1.08;
        const wdt = 0.07 * (1 - i / N) + 0.012;
        const rMid = R - wdt / 2;
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.014, wdt, segLen), i % 2 ? rustMat : steelMat);
        seg.position.set(0, cy + rMid * Math.cos(pm), rMid * Math.sin(pm));
        seg.rotation.x = pm;
        seg.castShadow = true;
        scythe.add(seg);
      }
      return scythe;
    }

    // The dormant Scarecrow - a wooden post and cross-beam with the whole
    // figure hung on it: limp sleeves over the beam, dangling legs, a
    // crow perched on one arm. Built in the same units as the awake raider
    // rig (torso 0.35x0.45x0.22, 0.3 head cube) lifted DY onto the post,
    // so it visibly becomes the same character when it wakes. Deliberately
    // has no glowing eyes - it should pass for ordinary scenery.
    function createScarecrowProp(x, y, z) {
      const prop = new THREE.Group();
      const DY = 0.2;
      const clothMat = new THREE.MeshLambertMaterial({ color: SCARECROW_CLOTH_COLOR });
      const burlapMat = new THREE.MeshLambertMaterial({ color: SCARECROW_BURLAP_COLOR });
      const pantsMat = new THREE.MeshLambertMaterial({ color: SCARECROW_THEME.pants });

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.05, 6), darkWoodMat);
      post.position.y = 0.525;
      post.castShadow = true;
      prop.add(post);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), darkWoodMat);
      beam.rotation.z = Math.PI / 2;
      beam.position.y = 0.87;
      beam.castShadow = true;
      prop.add(beam);

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.22), clothMat);
      torso.position.y = 0.525 + DY;
      torso.castShadow = true;
      torso.add(createScarecrowTorsoDetails());
      prop.add(torso);

      [-1, 1].forEach(side => {
        const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.12), clothMat);
        sleeve.position.set(side * 0.34, 0.87, 0);
        sleeve.rotation.z = side * -0.05;
        prop.add(sleeve);
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.07), burlapMat);
        hand.position.set(side * 0.53, 0.79, 0);
        prop.add(hand);
        const cuffStraw = createStrawTuft(6, 0.14, 0.7);
        cuffStraw.position.set(side * 0.53, 0.73, 0);
        prop.add(cuffStraw);

        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.14), pantsMat);
        leg.position.set(side * 0.09, 0.36, 0);
        leg.rotation.z = side * 0.06;
        prop.add(leg);
        const hemStraw = createStrawTuft(5, 0.12, 0.7);
        hemStraw.position.set(side * 0.1, 0.2, 0);
        prop.add(hemStraw);
      });

      const collarStraw = createStrawTuft(6, 0.1, 0.9);
      collarStraw.position.set(0, 0.95, 0.06);
      prop.add(collarStraw);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), burlapMat);
      head.position.y = 0.9 + DY;
      head.rotation.set(0.05, 0.15, 0.12); // drooping, off-kilter
      head.castShadow = true;
      head.add(createScarecrowFace(false));
      head.add(createScarecrowHat());
      prop.add(head);

      const crow = createScarecrowCrow();
      crow.position.set(0.42, 0.9, 0);
      crow.rotation.y = 0.7;
      crow.scale.setScalar(1.15);
      prop.add(crow);

      prop.scale.set(0.62, 0.68, 0.62);
      prop.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.08);
      prop.position.set(x, y, z);
      addCollider(x, z, 0.2);
      return prop;
    }

    // Gargoyle wings - shared between the dormant Statue prop and the
    // awakened Gargoyle raider (see createGargoyleHumanoid) so the same
    // wings visibly unfurl when it wakes rather than being replaced
    // outright. Each wing is its own pivot Group anchored at the
    // shoulder-blade attachment point (same pattern as
    // createValkyrieWings) with the actual wing panel offset outward
    // from that pivot - so flapping always reads as rotating from the
    // back rather than the wing floating as a separate disconnected
    // plane. group.userData.wingPivots holds [pivotL, pivotR] for
    // whichever caller needs to flap them.
    function createGargoyleWings(awake) {
      const group = new THREE.Group();
      const wingMat = new THREE.MeshLambertMaterial({ color: GARGOYLE_STONE_COLOR });
      const wingPivots = [];

      [-1, 1].forEach(side => {
        const wingPivot = new THREE.Group();
        wingPivot.position.set(side * 0.1, 0, 0);

        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.03), wingMat);
        // Offset from the pivot rather than centered on it, so the
        // pivot's own rotation swings the whole panel like a real
        // shoulder joint instead of spinning it in place.
        wing.position.set(side * 0.22, -0.02, 0);
        wing.castShadow = true;
        wingPivot.add(wing);

        if (awake) {
          // Fanned out and swept back for flight.
          wingPivot.rotation.z = side * 0.3;
          wingPivot.rotation.y = side * -0.4;
        } else {
          // Folded tight against the back for the dormant statue.
          wingPivot.rotation.z = side * 1.35;
          wingPivot.rotation.y = side * 0.1;
        }

        group.add(wingPivot);
        wingPivots.push(wingPivot);
      });

      group.userData.wingPivots = wingPivots;
      return group;
    }

    // The dormant Gargoyle Statue - a crouched stone sculpture on a small
    // plinth, wings folded against its back, blank unglowing eyes, built
    // from the same low-poly box/cone vocabulary as every other prop in
    // this file. Two of these spawn per Shadow Island Dungeon island (see
    // GARGOYLE_STATUE_COUNT in generateRandomIsland) and just sit there
    // like ordinary scenery until maybeAwakenGargoyles swaps one out for
    // a live Gargoyle raider.
    function createGargoyleStatueProp(x, y, z) {
      const prop = new THREE.Group();
      const stoneBodyMat = new THREE.MeshLambertMaterial({ color: GARGOYLE_STONE_COLOR });
      const darkStoneMat = new THREE.MeshLambertMaterial({ color: 0x3f4245 });

      const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), darkStoneMat);
      base.position.y = 0.07;
      base.castShadow = true;
      prop.add(base);

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.24), stoneBodyMat);
      torso.position.y = 0.34;
      torso.rotation.x = 0.4;
      torso.castShadow = true;
      prop.add(torso);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), stoneBodyMat);
      head.position.set(0, 0.54, 0.1);
      head.rotation.x = 0.25;
      head.castShadow = true;
      prop.add(head);
      head.add(createDemonHorns(0x2a2d2f));

      // Blank carved eyes - deliberately no glow at all while dormant,
      // unlike the awakened form's amber glow (see GARGOYLE_EYE_GLOW).
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0x24272a });
      [-0.07, 0.07].forEach(ex => {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), eyeMat);
        eye.position.set(ex, 0.02, 0.145);
        head.add(eye);
      });

      const wings = createGargoyleWings(false);
      wings.position.y = 0.42;
      wings.rotation.x = 0.4;
      prop.add(wings);

      [-1, 1].forEach(side => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.1), stoneBodyMat);
        arm.position.set(side * 0.2, 0.28, 0.14);
        arm.rotation.x = -0.6;
        arm.castShadow = true;
        prop.add(arm);

        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.22), stoneBodyMat);
        leg.position.set(side * 0.12, 0.24, 0.02);
        leg.castShadow = true;
        prop.add(leg);
      });

      prop.rotation.y = Math.random() * Math.PI * 2;
      prop.position.set(x, y, z);
      addCollider(x, z, 0.25);
      return prop;
    }

    // A pair of bare curved horns for the Demon (see createBlockyHumanoid's
    // isDemon branch) - the same horn sculpt as the Akuma Feral's Oni mask
    // above, just standalone rather than mounted on a full face plate,
    // since a Demon's own red skin (see skinMat's isDemon branch) is the
    // whole face.
    function createDemonHorns(color = 0x1a1210) {
      const group = new THREE.Group();
      const hornMat = new THREE.MeshLambertMaterial({ color });
      const hornGeo = new THREE.ConeGeometry(0.035, 0.22, 5);
      const hornL = new THREE.Mesh(hornGeo, hornMat);
      hornL.position.set(-0.09, 0.2, 0.01);
      hornL.rotation.set(0.3, 0, 0.4);
      hornL.castShadow = true;
      const hornR = new THREE.Mesh(hornGeo, hornMat);
      hornR.position.set(0.09, 0.2, 0.01);
      hornR.rotation.set(0.3, 0, -0.4);
      hornR.castShadow = true;
      group.add(hornL, hornR);
      return group;
    }

    // Bear Warrior facial features - a pair of small rounded ears on top
    // of the skull and a blunt snout jutting out over the mouth, so the
    // shared humanoid head rig (see createBlockyHumanoid's isBear branch)
    // reads as a bear rather than a bare-headed raider. Colored a shade
    // darker than BEAR_FUR_COLOR so the snout/ears still stand out against
    // the fur-toned skinMat covering the rest of the body.
    function createBearFeatures(furColor = BEAR_FUR_COLOR) {
      const group = new THREE.Group();
      const darkFurMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2e });

      const earGeo = new THREE.SphereGeometry(0.055, 8, 6);
      const earL = new THREE.Mesh(earGeo, darkFurMat);
      earL.position.set(-0.12, 0.15, -0.02);
      earL.castShadow = true;
      const earR = new THREE.Mesh(earGeo, darkFurMat);
      earR.position.set(0.12, 0.15, -0.02);
      earR.castShadow = true;
      group.add(earL, earR);

      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14), darkFurMat);
      snout.position.set(0, -0.06, 0.19);
      snout.castShadow = true;
      group.add(snout);

      const noseMat = new THREE.MeshLambertMaterial({ color: 0x161010 });
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, 0.03), noseMat);
      nose.position.set(0, -0.03, 0.26);
      group.add(nose);

      return group;
    }

    // Viking helmet - a domed steel cap on a low brow band, a nose guard
    // bar hanging down the middle of the face, and two curved horns swept
    // up and outward from the sides. Gives Northernlands raiders a proper
    // Norse reaver silhouette instead of going bare-headed like the plain
    // RAIDER_THEME_CONFIG recolor alone would leave them (see the
    // isViking flag in createBlockyHumanoid, set from createRaiderSquad
    // when selectedBiomeTheme === 'northernlands'). Worn instead of the
    // hachimaki headband/desert headwrap those other biomes use.
    function createVikingHelmet(metalColor = 0x767b80, hornColor = 0xd9c9a3) {
      const group = new THREE.Group();
      const metalMat = new THREE.MeshLambertMaterial({ color: metalColor });
      const hornMat = new THREE.MeshLambertMaterial({ color: hornColor });

      // Dome/brow radius sized to actually enclose the raider's head -
      // that head is the plain BoxGeometry(0.3, 0.3, 0.3) from
      // createBlockyHumanoid, whose corners sit 0.15*sqrt(2) ≈ 0.212 from
      // its center. The old radius (0.175) was smaller than that no
      // matter how the dome was positioned, so the box head's square
      // corners always poked out past the round helmet. Sized up past
      // 0.212 (with a little headroom, as createKnightHelmet's box dome
      // does for the same head) so the head's corners stay tucked inside
      // the curve at every height the dome/brow actually cover.
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.225, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), metalMat);
      dome.position.y = 0.08;
      dome.castShadow = true;
      group.add(dome);

      // Brow band - a low rim the dome sits on, so the helmet reads as
      // having a bottom edge instead of a dome floating on the head.
      const brow = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.235, 0.055, 10), metalMat);
      brow.position.y = -0.02;
      brow.castShadow = true;
      group.add(brow);

      // Nose guard - a short bar hanging down over the middle of the face.
      // Pushed out to the new, wider brow's front edge so it still reads
      // as resting against the face instead of floating inside the helmet.
      const noseGuard = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.03), metalMat);
      noseGuard.position.set(0, -0.09, 0.2);
      group.add(noseGuard);

      // Horns - swept up and out from either side of the brow band,
      // angled back slightly rather than standing straight up. Moved out
      // in step with the wider brow so they still root at its edge
      // instead of sinking into the dome.
      const hornGeo = new THREE.ConeGeometry(0.032, 0.28, 6);
      const hornL = new THREE.Mesh(hornGeo, hornMat);
      hornL.position.set(-0.195, 0.05, -0.02);
      hornL.rotation.set(0.1, 0, 0.75);
      hornL.castShadow = true;
      const hornR = new THREE.Mesh(hornGeo, hornMat);
      hornR.position.set(0.195, 0.05, -0.02);
      hornR.rotation.set(0.1, 0, -0.75);
      hornR.castShadow = true;
      group.add(hornL, hornR);

      return group;
    }

    // A short, blocky Norse beard for Northernlands raiders - a wider
    // upper jaw mass tapering down to a narrower chin point, worn
    // alongside the Viking helmet above (see the isViking flag in
    // createBlockyHumanoid) so raiders in that biome read as bearded
    // reavers rather than bare-faced like every other raider warband.
    function createNordicBeard(color = 0xcfc9bd) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });

      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.08), mat);
      upper.position.set(0, -0.14, 0.14);
      upper.castShadow = true;
      group.add(upper);

      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.07), mat);
      lower.position.set(0, -0.24, 0.13);
      lower.castShadow = true;
      group.add(lower);

      return group;
    }

    // A wizard's hat for the Dragon Ronin - a flat, wide jingasa-style
    // conical brim topped with a short peak that tapers gently rather
    // than coming to a sharp point (a blunt frustum capped with a
    // rounded tip), plus a colored trim band where the two meet.
    // Attached to the head in createBlockyHumanoid so it turns and tilts
    // naturally with every idle/attack head movement.
    function createRoninHat(color = 0x1a1512, trimColor = 0xb5202a) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });
      const trimMat = new THREE.MeshLambertMaterial({ color: trimColor });

      const brim = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.09, 8), mat);
      brim.position.y = 0.19;
      brim.castShadow = true;
      group.add(brim);

      const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.10, 0.09, 10), mat);
      peak.position.y = 0.28;
      peak.castShadow = true;
      group.add(peak);

      const peakCap = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat);
      peakCap.position.y = 0.36;
      peakCap.castShadow = true;
      group.add(peakCap);

      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 12), trimMat);
      trim.rotation.x = Math.PI / 2;
      trim.position.y = 0.24;
      group.add(trim);

      return group;
    }

    // Flowing robe pieces for the Dragon Ronin - front/back panels that
    // hang past the hips over the legs, boxy pauldron-like shoulder
    // guards for a bolder silhouette, and a gold sash cinched at the
    // waist. Attached to the body box in createBlockyHumanoid so the
    // whole ensemble leans and sways with the torso during animation.
    function createRoninRobe(color = 0x7a1020, trimColor = 0xffd35c) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });
      const trimMat = new THREE.MeshLambertMaterial({ color: trimColor });

      const flapGeo = new THREE.BoxGeometry(0.3, 0.32, 0.04);
      const frontFlap = new THREE.Mesh(flapGeo, mat);
      frontFlap.position.set(0, -0.32, 0.1);
      frontFlap.castShadow = true;
      group.add(frontFlap);

      const backFlap = new THREE.Mesh(flapGeo, mat);
      backFlap.position.set(0, -0.32, -0.1);
      backFlap.castShadow = true;
      group.add(backFlap);

      const shoulderGeo = new THREE.BoxGeometry(0.14, 0.1, 0.26);
      const shoulderL = new THREE.Mesh(shoulderGeo, mat);
      shoulderL.position.set(-0.22, 0.18, 0);
      shoulderL.castShadow = true;
      group.add(shoulderL);
      const shoulderR = new THREE.Mesh(shoulderGeo, mat);
      shoulderR.position.set(0.22, 0.18, 0);
      shoulderR.castShadow = true;
      group.add(shoulderR);

      const sash = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.26), trimMat);
      sash.position.set(0, -0.16, 0);
      group.add(sash);

      return group;
    }

    // Hooded cowl for the Shadow Island Acolyte - a draped cloth dome over
    // the crown and back of the head with a low forward peak, plus a dark
    // recessed panel across the face opening so the wearer reads as
    // shadowed/obscured under the hood rather than plainly visible. Worn
    // instead of any headband/keffiyeh/turban (see createBlockyHumanoid's
    // isAcolyte branch). Built entirely from BoxGeometry, sized against the
    // 0.3-unit head cube it's parented to (see createBlockyHumanoid's head),
    // matching the blocky look of every other headwear piece (headband,
    // keffiyeh, turban) instead of the sphere/cone it used previously - that
    // round cowl not only clashed with the boxy head underneath it (the
    // head's corners poked out past the sphere's rounded surface), it was
    // also oversized enough to fully engulf the brim and shadow panel below,
    // hiding the hood's whole "shadowed face" effect inside its own mesh.
    function createCultHood(color = 0x2a1f38, shadowColor = 0x0d0812) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });
      const shadowMat = new THREE.MeshLambertMaterial({ color: shadowColor });

      // Main cowl - a box crown covering the top, back and sides of the
      // 0.3-wide head box (0.34 wide/0.02 overhang per side, same margin
      // the keffiyeh/turban caps use). Held short of the head's front face
      // (head front is at local z=0.15; this crown stops at z=0.09) so the
      // brim and shadow panel below sit in front of it, exposed, rather
      // than buried inside an oversized dome.
      const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.28), mat);
      cowl.position.set(0, 0.02, -0.05);
      cowl.castShadow = true;
      group.add(cowl);

      // Front brim - drapes down and angles forward over the brow,
      // a low, drawn-down cowl edge that actually shadows the eyes. Its
      // back edge tucks just under the crown's front face for a clean
      // seam; the front half projects clear of the crown, visible.
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.08), mat);
      brim.position.set(0, 0.05, 0.13);
      brim.rotation.x = -0.25;
      brim.castShadow = true;
      group.add(brim);

      // Recessed dark panel under the brim - the actual "face" of the
      // hood, sunk back far enough that the brim above casts it in
      // shadow rather than sitting flush and fully lit. Sits entirely in
      // front of the crown box now, so it actually renders instead of
      // being swallowed by it.
      const shadowPanel = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.17, 0.02), shadowMat);
      shadowPanel.position.set(0, -0.02, 0.135);
      group.add(shadowPanel);

      // Trailing point - a cowl tail draped down the back of the neck,
      // leaning back and down instead of forward, so the hood ends in a
      // proper hanging point rather than a bald dome. Butts flush against
      // the crown's new back face (z=-0.19) instead of floating off it.
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.06), mat);
      tail.position.set(0, -0.12, -0.21);
      tail.rotation.x = 0.5;
      tail.castShadow = true;
      group.add(tail);

      // Side drapes - loose cloth hanging past the ears down onto the
      // shoulders, tying the hood visually into the cult robe below
      // instead of stopping abruptly at the jawline. Inner face sits flush
      // against the crown's side faces (x=+/-0.17) for a seamless join.
      const sideGeo = new THREE.BoxGeometry(0.05, 0.24, 0.2);
      const sideL = new THREE.Mesh(sideGeo, mat);
      sideL.position.set(-0.17, -0.09, -0.04);
      sideL.rotation.z = 0.06;
      sideL.castShadow = true;
      group.add(sideL);
      const sideR = new THREE.Mesh(sideGeo, mat);
      sideR.position.set(0.17, -0.09, -0.04);
      sideR.rotation.z = -0.06;
      sideR.castShadow = true;
      group.add(sideR);

      return group;
    }

    // Slasher mask - a dark, tight-fitting hood over an angular pale mask
    // with narrow black eye slits and a single diagonal scar, worn instead
    // of any headband/mask combo (see createBlockyHumanoid's isSlasher
    // branch). Built the same way as createCultHood just above - boxes
    // sized against the 0.3-unit head cube, with the hood's crown held
    // short of the head's front face (head front is z=0.15; this crown
    // stops at z=0.09) so the mask plate in front of it stays exposed
    // instead of getting buried inside the hood the way the old Acolyte
    // cowl used to (see createCultHood's own comment for that history).
    function createSlasherMask(hoodColor = 0x2b2b30, maskColor = 0xe8e2d0, scarColor = 0xcc1f1f) {
      const group = new THREE.Group();
      const hoodMat = new THREE.MeshLambertMaterial({ color: hoodColor });
      const maskMat = new THREE.MeshLambertMaterial({ color: maskColor });
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
      const scarMat = new THREE.MeshLambertMaterial({ color: scarColor });

      // Hood crown - a rounded shell hugging the Slasher's ovoid head
      // (see createBlockyHumanoid's isSlasher head geometry) instead of
      // the old flat-sided box, so the hood reads as fitted headwear
      // wrapped around a round skull rather than a crate balanced on top
      // of one. Built the same sphere-then-bake-scale way as the head
      // itself, just a size up so it clears the head with a small even
      // gap all the way round. Pulled back only slightly (not all the
      // way to the head's own front face) so it still keeps reaching
      // forward enough at the top to cover the forehead - the brow
      // piece below bridges whatever's left of that seam down to the
      // mask, but the crown itself should already be doing most of the
      // work instead of leaving a bare gap for it to patch.
      const crownGeo = new THREE.SphereGeometry(0.18, 10, 8);
      crownGeo.scale(1, 1.08, 1);
      const crown = new THREE.Mesh(crownGeo, hoodMat);
      crown.position.set(0, 0.03, -0.03);
      crown.castShadow = true;
      group.add(crown);

      // Brow - a smaller domed cap bridging the seam between the
      // crown's front edge and the mask's upper edge across the
      // forehead, so no strip of bare head shows through between the
      // two curved pieces (the exact gap called out on the rooftop
      // screenshot). Reads as the hood dipping down low over the brow
      // before the mask itself takes over from the eyes down - sized
      // and placed to clear the eye slits below it (see their y/z
      // below) rather than covering them.
      const browGeo = new THREE.SphereGeometry(0.15, 10, 8);
      browGeo.scale(0.94, 0.55, 0.62);
      const brow = new THREE.Mesh(browGeo, hoodMat);
      brow.position.set(0, 0.09, 0.08);
      brow.castShadow = true;
      group.add(brow);

      // The mask itself - a shallow curved plate (a squashed sphere)
      // rather than a flat plane, so its face follows the head's own
      // curve edge to edge instead of only touching it dead center and
      // gapping away at the jaw/brow like a flat plate would on a round
      // head.
      const maskGeo = new THREE.SphereGeometry(0.135, 10, 8);
      maskGeo.scale(1, 1.05, 0.32);
      const mask = new THREE.Mesh(maskGeo, maskMat);
      mask.position.set(0, -0.015, 0.135);
      mask.castShadow = true;
      group.add(mask);

      // Narrow angled eye slits, tilted down toward the nose for a sharp,
      // menacing look rather than a flat blank stare. Sat just proud of
      // the mask's own curved outer surface at eye height.
      const eyeGeo = new THREE.BoxGeometry(0.065, 0.025, 0.02);
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.05, 0.015, 0.175);
      eyeL.rotation.z = 0.22;
      group.add(eyeL);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.05, 0.015, 0.175);
      eyeR.rotation.z = -0.22;
      group.add(eyeR);

      // Single diagonal scar cutting down across the right side of the
      // mask, the mask's one splash of color against the pale plate.
      const scar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.13, 0.022), scarMat);
      scar.position.set(0.045, -0.05, 0.172);
      scar.rotation.z = 0.5;
      group.add(scar);

      // Side drapes and trailing tail, same hanging-cloth pieces as
      // createCultHood, tying the hood into the rest of the outfit and
      // giving it a tail rather than ending in a bald dome. Nudged in
      // slightly to sit against the narrower rounded crown instead of
      // the old wider box.
      const sideGeo = new THREE.BoxGeometry(0.05, 0.22, 0.18);
      const sideL = new THREE.Mesh(sideGeo, hoodMat);
      sideL.position.set(-0.15, -0.08, -0.04);
      sideL.rotation.z = 0.08;
      sideL.castShadow = true;
      group.add(sideL);
      const sideR = new THREE.Mesh(sideGeo, hoodMat);
      sideR.position.set(0.15, -0.08, -0.04);
      sideR.rotation.z = -0.08;
      sideR.castShadow = true;
      group.add(sideR);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.06), hoodMat);
      tail.position.set(0, -0.11, -0.2);
      tail.rotation.x = 0.5;
      tail.castShadow = true;
      group.add(tail);

      return group;
    }

    // Slasher assassin garb - a fitted black tunic worn snugly over the
    // torso, with a diagonal chest strap and collar breaking up the
    // silhouette so it doesn't read as a flat recolor of the plain body
    // box. Paired with createBlockyHumanoid's isSlasher branch swapping
    // the arm material to the same black cloth tone, so the Slasher now
    // wears full black sleeves down to the wrist instead of the bare
    // skin-toned forearms it used to have.
    function createAssassinGarb(color = 0x1a1a1a) {
      const garb = new THREE.Group();
      const clothMat = new THREE.MeshLambertMaterial({ color });
      const strapMat = new THREE.MeshLambertMaterial({ color: 0x101013 });

      // Tunic - sits just outside the plain body box (0.35 x 0.45 x
      // 0.22) as a snug outer layer rather than simply recoloring the
      // body mesh itself.
      const tunic = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.44, 0.24), clothMat);
      tunic.castShadow = true;
      garb.add(tunic);

      // Diagonal chest strap, like a harness/scabbard belt worn across
      // the torso - the outfit's one bit of visual detail against the
      // otherwise flat black tunic.
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.26), strapMat);
      strap.rotation.z = 0.55;
      strap.position.y = 0.01;
      garb.add(strap);

      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.19), strapMat);
      collar.position.y = 0.22;
      garb.add(collar);

      return garb;
    }

    // Slasher's melee weapon - a short single-edged dagger, much shorter
    // than createSword's blade so it reads as a quick assassin's knife
    // rather than a full sword. Same three-piece build (blade/guard/hilt)
    // as createSword, just scaled down.
    function createDagger() {
      const dagger = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.012), steelMat);
      blade.position.y = 0.11;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 4), steelMat);
      tip.position.y = 0.215;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.018, 0.02), goldMat);
      guard.position.y = 0.02;
      const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.08, 0.022), leatherMat);
      hilt.position.y = -0.02;
      dagger.add(blade, tip, guard, hilt);
      return dagger;
    }
    // both the Leader and Elite Swordsmen a fully-armored silhouette instead
    // of a plain tunic showing underneath. Sized to fully enclose the body
    // box rather than just overlay its front face. Attached to the body box
    // in createBlockyHumanoid (mirroring the Dragon Ronin's robe above), so
    // it leans and sways with the torso during animation. trimColor lets the
    // Leader's gold-trimmed set read apart from a plainer steel trim.
    function createPaladinArmor(trimColor = 0xddaa22) {
      const group = new THREE.Group();
      const trimMat = new THREE.MeshLambertMaterial({ color: trimColor });

      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.42, 0.26), steelMat);
      chest.position.y = 0.01;
      chest.castShadow = true;
      group.add(chest);

      const pauldronGeo = new THREE.BoxGeometry(0.18, 0.14, 0.22);
      const pauldronL = new THREE.Mesh(pauldronGeo, steelMat);
      pauldronL.position.set(-0.24, 0.19, 0);
      pauldronL.castShadow = true;
      const pauldronR = new THREE.Mesh(pauldronGeo, steelMat);
      pauldronR.position.set(0.24, 0.19, 0);
      pauldronR.castShadow = true;
      group.add(pauldronL, pauldronR);

      const rimGeo = new THREE.BoxGeometry(0.19, 0.03, 0.23);
      const rimL = new THREE.Mesh(rimGeo, trimMat);
      rimL.position.set(-0.24, 0.27, 0);
      const rimR = new THREE.Mesh(rimGeo, trimMat);
      rimR.position.set(0.24, 0.27, 0);
      group.add(rimL, rimR);

      const waist = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.08, 0.24), trimMat);
      waist.position.y = -0.24;
      group.add(waist);

      // Chest cross emblem for a classic paladin look.
      const emblemV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.01), trimMat);
      emblemV.position.set(0, 0.02, 0.14);
      const emblemH = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.01), trimMat);
      emblemH.position.set(0, 0.05, 0.14);
      group.add(emblemV, emblemH);

      return group;
    }

    // A flowing back cape for the Paladins - an upper panel plus a wider,
    // slightly back-tilted lower panel that reads as hanging cloth rather
    // than a stiff board. Attached to the body box in createBlockyHumanoid,
    // same as the armor above, so it sways with every idle/walk/attack lean.
    // Colored to match the wearer's own shirt color (gold for the Leader,
    // blue-grey for the Elite Swordsmen - see createSquad's per-slot pick).
    function createCape(color = 0x7a1020, trimColor = 0xddaa22) {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color });
      const trimMat = new THREE.MeshLambertMaterial({ color: trimColor });

      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.04), mat);
      upper.position.set(0, 0.07, -0.15);
      upper.castShadow = true;
      group.add(upper);

      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.04), mat);
      lower.position.set(0, -0.28, -0.19);
      lower.rotation.x = 0.12;
      lower.castShadow = true;
      group.add(lower);

      const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.03), trimMat);
      clasp.position.set(0, 0.21, -0.13);
      group.add(clasp);

      return group;
    }

    // A fully-enclosing great-helm for the Paladin Elite Swordsmen only -
    // the Leader goes helmetless, topped with its own commander hair
    // instead (see createCommanderHair), for a clearer silhouette (see
    // equipUnit's 'paladins' branch, which is where this actually gets
    // attached to uData.head, since that's the only place the Leader/
    // Elite Swordsman distinction is available). Boxy dome with a T-shaped
    // visor slit and a trim crest fin running front-to-back on top.
    function createKnightHelmet(trimColor = 0xddaa22) {
      const group = new THREE.Group();
      const trimMat = new THREE.MeshLambertMaterial({ color: trimColor });
      const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

      const dome = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), steelMat);
      dome.castShadow = true;
      group.add(dome);

      const slitV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.02), darkMat);
      slitV.position.set(0, -0.02, 0.17);
      const slitH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.02), darkMat);
      slitH.position.set(0, 0.03, 0.17);
      group.add(slitV, slitH);

      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.32), trimMat);
      crest.position.set(0, 0.2, 0);
      crest.castShadow = true;
      group.add(crest);

      return group;
    }

    // Dark Knight's dark counterpart to the Paladins' bright steel plate
    // armor (see createPaladinArmor above) - the same breastplate/
    // pauldron/waist-guard shape, just built in its own near-black plate
    // material instead of the shared steelMat, with a darker trim and an
    // X-cross emblem in place of the Paladins' upright cross so the two
    // elite-armored silhouettes don't read as the same faction at a
    // glance. See createBlockyHumanoid's isDarkKnight branch.
    function createDarkKnightArmor(plateColor = 0x1c1c22, trimColor = 0x4a0f18) {
      const group = new THREE.Group();
      const plateMat = new THREE.MeshLambertMaterial({ color: plateColor });
      const trimMat = new THREE.MeshLambertMaterial({ color: trimColor });

      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.42, 0.26), plateMat);
      chest.position.y = 0.01;
      chest.castShadow = true;
      group.add(chest);

      const pauldronGeo = new THREE.BoxGeometry(0.18, 0.14, 0.22);
      const pauldronL = new THREE.Mesh(pauldronGeo, plateMat);
      pauldronL.position.set(-0.24, 0.19, 0);
      pauldronL.castShadow = true;
      const pauldronR = new THREE.Mesh(pauldronGeo, plateMat);
      pauldronR.position.set(0.24, 0.19, 0);
      pauldronR.castShadow = true;
      group.add(pauldronL, pauldronR);

      const rimGeo = new THREE.BoxGeometry(0.19, 0.03, 0.23);
      const rimL = new THREE.Mesh(rimGeo, trimMat);
      rimL.position.set(-0.24, 0.27, 0);
      const rimR = new THREE.Mesh(rimGeo, trimMat);
      rimR.position.set(0.24, 0.27, 0);
      group.add(rimL, rimR);

      const waist = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.08, 0.24), trimMat);
      waist.position.y = -0.24;
      group.add(waist);

      // X-cross chest emblem, angled the opposite way from the Paladins'
      // plain upright cross.
      const emblemA = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.01), trimMat);
      emblemA.position.set(0, 0.02, 0.14);
      emblemA.rotation.z = Math.PI / 4;
      const emblemB = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.01), trimMat);
      emblemB.position.set(0, 0.02, 0.14);
      emblemB.rotation.z = -Math.PI / 4;
      group.add(emblemA, emblemB);

      return group;
    }

    // Dark Knight's fully-enclosing helmet - the same boxy great-helm
    // shape as createKnightHelmet above, built in the Dark Knight's own
    // near-black plate instead of steelMat, with a pair of glowing red
    // eye slits (emissive) in place of the Paladins' flat dark visor for
    // a more menacing read. Always worn (see createBlockyHumanoid's
    // isDarkKnight branch), unlike the Paladins' helmet which is only
    // ever attached in equipUnit's 'paladins' Elite Swordsman branch.
    function createDarkKnightHelmet(plateColor = 0x1c1c22, trimColor = 0x4a0f18) {
      const group = new THREE.Group();
      const plateMat = new THREE.MeshLambertMaterial({ color: plateColor });
      const trimMat = new THREE.MeshLambertMaterial({ color: trimColor });
      const visorMat = new THREE.MeshLambertMaterial({ color: 0x3a0000, emissive: 0xff2222, emissiveIntensity: 0.8 });

      const dome = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), plateMat);
      dome.castShadow = true;
      group.add(dome);

      const slitV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.02), visorMat);
      slitV.position.set(0, -0.02, 0.17);
      const slitH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.02), visorMat);
      slitH.position.set(0, 0.03, 0.17);
      group.add(slitV, slitH);

      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.32), trimMat);
      crest.position.set(0, 0.2, 0);
      crest.castShadow = true;
      group.add(crest);

      return group;
    }

    // Marauder's helmet - the same enclosing dome/brow/nose-guard shape
    // as the Viking helmet above (sized to the same 0.225 sphere radius
    // so it clears the 0.3-box head's corners the same way), but topped
    // with a jagged cluster of scavenged iron spikes instead of swept
    // horns, and a riveted, battle-worn brow band instead of a smooth
    // rim - reads as a looted, hand-forged warhelm rather than a clean
    // Norse or knight's helm. Open-faced like the Viking helmet too
    // (just a nasal guard, no visor plate), so the raider's own face
    // still shows underneath. See createBlockyHumanoid's isMarauder
    // branch.
    function createMarauderHelmet(metalColor = 0x3a3530, trimColor = 0x8a1f1f) {
      const group = new THREE.Group();
      const metalMat = new THREE.MeshLambertMaterial({ color: metalColor });
      const trimMat = new THREE.MeshLambertMaterial({ color: trimColor });
      const spikeMat = new THREE.MeshLambertMaterial({ color: 0x1c1a17 });

      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.225, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), metalMat);
      dome.position.y = 0.08;
      dome.castShadow = true;
      group.add(dome);

      const brow = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.235, 0.055, 10), metalMat);
      brow.position.y = -0.02;
      brow.castShadow = true;
      group.add(brow);

      const noseGuard = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.03), metalMat);
      noseGuard.position.set(0, -0.09, 0.2);
      group.add(noseGuard);

      // Riveted trim studs along the brow's front edge - a battered,
      // hand-forged read in place of the Viking helmet's plain smooth
      // rim.
      const rivetGeo = new THREE.BoxGeometry(0.025, 0.025, 0.015);
      [-0.16, -0.08, 0.08, 0.16].forEach(rx => {
        const rivet = new THREE.Mesh(rivetGeo, trimMat);
        rivet.position.set(rx, -0.02, 0.218);
        group.add(rivet);
      });

      // Jagged crown spikes, uneven heights and splayed slightly
      // outward - the Marauder's own signature silhouette in place of
      // the Viking's swept horns or the Dark Knight's smooth crest fin.
      const spikeDefs = [
        { x: -0.09, h: 0.12, tilt: -0.3 },
        { x: 0, h: 0.16, tilt: 0 },
        { x: 0.09, h: 0.12, tilt: 0.3 },
      ];
      spikeDefs.forEach(({ x, h, tilt }) => {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.032, h, 4), spikeMat);
        spike.position.set(x, 0.19 + h / 2, 0.02);
        spike.rotation.z = tilt;
        spike.castShadow = true;
        group.add(spike);
      });

      return group;
    }

    // Marauder's armor - a scavenged, mismatched set of plate rather
    // than the Dark Knight/Paladins' matched breastplate-and-pauldron
    // set: a single rough chest slab, one oversized pauldron on the
    // weapon-arm shoulder with a bare fur pelt slung over the other
    // instead of a matching pauldron, a studded leather waist wrap in
    // place of a clean metal waist-guard, and a crossed leather chest
    // strap - reads as looted battlefield armor bolted together rather
    // than a uniform suit. See createBlockyHumanoid's isMarauder branch.
    function createMarauderArmor(plateColor = 0x4a4238, trimColor = 0x8a1f1f, furColor = 0x5c4a34) {
      const group = new THREE.Group();
      const plateMat = new THREE.MeshLambertMaterial({ color: plateColor });
      const trimMat = new THREE.MeshLambertMaterial({ color: trimColor });
      const furMat = new THREE.MeshLambertMaterial({ color: furColor });
      const strapMat = new THREE.MeshLambertMaterial({ color: 0x2b271f });

      // Rough chest plate - a single slab rather than the smooth curved
      // breastplate a Dark Knight/Paladin wears.
      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.24), plateMat);
      chest.position.set(0, 0.05, 0);
      chest.castShadow = true;
      group.add(chest);

      // Studded leather waist wrap in place of a clean metal waist-guard.
      const waist = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.09, 0.25), strapMat);
      waist.position.y = -0.22;
      group.add(waist);
      const studGeo = new THREE.BoxGeometry(0.03, 0.03, 0.02);
      [-0.14, -0.05, 0.05, 0.14].forEach(sx => {
        const stud = new THREE.Mesh(studGeo, trimMat);
        stud.position.set(sx, -0.22, 0.13);
        group.add(stud);
      });

      // Oversized right pauldron on the weapon-arm shoulder - noticeably
      // bigger than a matched set's, part of the scavenged/mismatched
      // read.
      const pauldronR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.24), plateMat);
      pauldronR.position.set(0.25, 0.2, 0);
      pauldronR.castShadow = true;
      group.add(pauldronR);
      const rimR = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.03, 0.25), trimMat);
      rimR.position.set(0.25, 0.3, 0);
      group.add(rimR);

      // Left shoulder is bare plate-wise - just a slung fur pelt draped
      // over it instead of a matching pauldron, the mismatched-armor
      // tell.
      const pelt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.2), furMat);
      pelt.position.set(-0.2, 0.16, -0.02);
      pelt.rotation.z = 0.15;
      pelt.castShadow = true;
      group.add(pelt);

      // A crossed leather strap over the chest, a battlefield-scavenger
      // detail matching the waist studs above.
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.02), strapMat);
      strap.position.set(0, 0.02, 0.14);
      strap.rotation.z = 0.5;
      group.add(strap);

      return group;
    }

    // Orc helmet - a crude riveted iron cap with a pair of curved tusks
    // jutting out from the brow and a low nose guard, sized to sit right
    // on top of the head with no hair/headband underneath (an Orc has
    // no headwear variant of its own - see createBlockyHumanoid's isOrc
    // branch, which always attaches this). Reuses the Marauder helmet's
    // dome-plus-brow shape for the base, but swaps its crown spikes for
    // tusks curling forward off the sides instead of jagged spikes on
    // top, so the two brutish factions still read as visually distinct.
    function createOrcHelmet(metalColor = 0x4a4a48, tuskColor = 0xe8dcc0) {
      const group = new THREE.Group();
      const metalMat = new THREE.MeshLambertMaterial({ color: metalColor });
      const tuskMat = new THREE.MeshLambertMaterial({ color: tuskColor });
      const rivetMat = new THREE.MeshLambertMaterial({ color: 0x2a2a28 });

      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), metalMat);
      dome.position.y = 0.08;
      dome.castShadow = true;
      group.add(dome);

      const brow = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.06, 10), metalMat);
      brow.position.y = -0.02;
      brow.castShadow = true;
      group.add(brow);

      // Riveted studs around the brow, the same rough-forged detail the
      // Marauder helmet uses.
      const rivetGeo = new THREE.BoxGeometry(0.025, 0.025, 0.015);
      [-0.17, -0.08, 0.08, 0.17].forEach(rx => {
        const rivet = new THREE.Mesh(rivetGeo, rivetMat);
        rivet.position.set(rx, -0.02, 0.222);
        group.add(rivet);
      });

      // A pair of curved tusks sweeping out and forward from the sides
      // of the brow - the Orc's signature silhouette, in place of the
      // Marauder's crown spikes or the Viking's swept horns.
      [-1, 1].forEach(side => {
        const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.16, 6), tuskMat);
        tusk.position.set(side * 0.2, -0.08, 0.1);
        tusk.rotation.z = side * 0.9;
        tusk.rotation.x = -0.5;
        tusk.castShadow = true;
        group.add(tusk);
      });

      return group;
    }

    // Orc pauldrons - a crude, mismatched shoulder guard on each arm,
    // strapped directly onto the bare torso (see createBlockyHumanoid's
    // isOrc branch, which adds this instead of any chest plate) - the
    // only armor an Orc wears over its shirtless green skin. Boxy iron
    // plates with a leather strap underneath, angled outward like the
    // Marauder's oversized pauldron rather than a clean matched-armor
    // curve.
    function createOrcPauldrons(plateColor = 0x4a4a48, strapColor = 0x2b2318) {
      const group = new THREE.Group();
      const plateMat = new THREE.MeshLambertMaterial({ color: plateColor });
      const strapMat = new THREE.MeshLambertMaterial({ color: strapColor });

      [-1, 1].forEach(side => {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.22), strapMat);
        strap.position.set(side * 0.21, 0.19, 0);
        group.add(strap);

        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.24), plateMat);
        plate.position.set(side * 0.24, 0.21, 0);
        plate.rotation.z = side * -0.12;
        plate.castShadow = true;
        group.add(plate);
      });

      return group;
    }

    // Berserker headwear - a wolf or bear pelt worn like a hood, the
    // beast's own head sitting on top of the wearer's skull with its
    // muzzle poking forward and empty eye/ear silhouette, fangs framing
    // the face, and the pelt's hide draping down over the back of the
    // neck. furColor picks wolf-grey or bear-brown per unit (see
    // createBerserkerHumanoid). No metal plate at all, unlike every
    // other helmet in the roster - this is meant to read as savage and
    // improvised rather than forged armor.
    //
    // Sized the same way createVikingHelmet/createMarauderHelmet's domes
    // are: the head underneath is the plain BoxGeometry(0.3, 0.3, 0.3)
    // from createBlockyHumanoid, whose corners sit 0.15*sqrt(2) ≈ 0.212
    // from its center. The cap's old radius (0.19) - and worse, its actual
    // rim width at the cutoff angle below, radius*sin(thetaLength) - came
    // in under that, so the box head's square corners poked out through
    // the fur at the temples/back instead of sitting fully enclosed by it.
    // Sized up past 0.212 with the same headroom the metal domes use so
    // the head stays tucked inside the pelt at every height it covers.
    function createBerserkerPeltHelmet(furColor = 0x6b6b6b) {
      const group = new THREE.Group();
      const furMat = new THREE.MeshLambertMaterial({ color: furColor });
      const darkFurMat = new THREE.MeshLambertMaterial({ color: 0x3a3632 });
      const fangMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc0 });

      // The pelt's skull cap, worn over the crown of the head.
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.235, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.6), furMat);
      cap.position.y = 0.07;
      cap.castShadow = true;
      group.add(cap);

      // The beast's muzzle, jutting forward off the brow - dropped in step
      // with the enlarged cap's now-lower rim so it still reads as resting
      // just beneath it rather than floating apart from the helmet.
      const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.16), furMat);
      muzzle.position.set(0, -0.05, 0.2);
      muzzle.castShadow = true;
      group.add(muzzle);

      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), darkFurMat);
      nose.position.set(0, -0.05, 0.28);
      group.add(nose);

      // A pair of small rounded ears on top of the cap, raised to sit on
      // the now-taller crown instead of sinking partway down its side.
      [-1, 1].forEach(side => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 6), furMat);
        ear.position.set(side * 0.11, 0.26, -0.02);
        ear.rotation.z = side * 0.3;
        ear.castShadow = true;
        group.add(ear);
      });

      // Fangs framing the wearer's own face beneath the empty muzzle.
      const fangGeo = new THREE.ConeGeometry(0.015, 0.06, 4);
      [-0.06, 0.06].forEach(fx => {
        const fang = new THREE.Mesh(fangGeo, fangMat);
        fang.position.set(fx, -0.1, 0.16);
        fang.rotation.x = Math.PI;
        group.add(fang);
      });

      // The hide drapes down the back and shoulders.
      const drape = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.08), furMat);
      drape.position.set(0, -0.1, -0.13);
      drape.castShadow = true;
      group.add(drape);

      return group;
    }

    // Berserker pauldrons - a rough fur-wrapped shoulder guard on each
    // arm, strapped over the bare torso the same way the Orc's crude
    // plate pauldrons are (see createOrcPauldrons) but built from hide
    // and fur instead of scavenged iron, matching a shirtless warrior
    // dressed in pelts rather than armor.
    function createBerserkerPauldrons(furColor = 0x6b6b6b) {
      const group = new THREE.Group();
      const furMat = new THREE.MeshLambertMaterial({ color: furColor });
      const strapMat = new THREE.MeshLambertMaterial({ color: 0x2b1c10 });

      [-1, 1].forEach(side => {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.22), strapMat);
        strap.position.set(side * 0.21, 0.19, 0);
        group.add(strap);

        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.16, 0.25), furMat);
        pad.position.set(side * 0.24, 0.22, 0);
        pad.rotation.z = side * -0.12;
        pad.castShadow = true;
        group.add(pad);
      });

      return group;
    }

    // Steel Revenant's faceless helm - a draped iron hood (an angular
    // cowl with a brow brim, a trailing back point, and side flaps down
    // onto the shoulders, in place of the old round dome) split by a
    // glowing teal "T" visor tucked in the brim's shadow: a horizontal
    // crescent bar and a vertical stem, no eyes or mouth beneath it.
    // A medium crown of sweeping horns and jagged iron pillars is set
    // into the top of the cowl, its base sunk into the hood mesh rather
    // than floating above it - the unit's signature silhouette. See
    // createBlockyHumanoid's isSteelRevenant branch.
    function createRevenantHelmet(plateColor = 0x0d0e12, glowColor = 0x2be8c8) {
      const group = new THREE.Group();
      const plateMat = new THREE.MeshLambertMaterial({ color: plateColor });
      const visorMat = new THREE.MeshBasicMaterial({ color: glowColor });

      // Main cowl - an angular box hood covering the top, back and
      // sides of the medium (0.14-radius) round head beneath it,
      // playing the same role createCultHood's crown box does for the
      // Acolyte, but in dark iron plate instead of cloth.
      const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.26), plateMat);
      cowl.position.set(0, 0.03, -0.03);
      cowl.castShadow = true;
      group.add(cowl);

      // Front brim - drapes down and angles forward over the brow,
      // a low, drawn-down hood edge that shadows the visor beneath it
      // instead of leaving it flush and exposed.
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.07), plateMat);
      brim.position.set(0, 0.05, 0.125);
      brim.rotation.x = -0.25;
      brim.castShadow = true;
      group.add(brim);

      // Angular jaw shard - a small downward-pointing plate closing off
      // the chin beneath the brim with a sharp point instead of leaving
      // it open.
      const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 4), plateMat);
      jaw.rotation.x = Math.PI;
      jaw.position.set(0, -0.14, 0.06);
      jaw.castShadow = true;
      group.add(jaw);

      // The T-visor: a crescent-like horizontal bar over a single narrow
      // stem beneath it, both glowing spectral teal - the only hint of a
      // face this thing has, sized large so it reads clearly even in
      // the shadow the brim above casts.
      const visorBar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.028), visorMat);
      visorBar.position.set(0, 0.025, 0.14);
      group.add(visorBar);
      const visorStem = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, 0.028), visorMat);
      visorStem.position.set(0, -0.075, 0.14);
      group.add(visorStem);

      // Small teal PointLight tucked behind the visor so it actually
      // casts spectral light onto the brim and cowl above it, rather
      // than just being a flat bright shape with no light bleed - short
      // range/low intensity since it only needs to catch the plate
      // immediately around the face.
      const visorLight = new THREE.PointLight(glowColor, 1.2, 0.6, 2);
      visorLight.position.set(0, -0.03, 0.16);
      group.add(visorLight);

      // Trailing point - a hood tail draped down the back of the neck,
      // leaning back and down instead of forward, so the cowl ends in a
      // proper hanging point rather than a flat back panel.
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 4), plateMat);
      tail.rotation.x = 2.7;
      tail.position.set(0, -0.14, -0.17);
      tail.castShadow = true;
      group.add(tail);

      // Side flaps - loose iron-plate drapes hanging past the ears down
      // onto the shoulders, tying the hood visually into the cape below
      // instead of stopping abruptly at the jawline.
      const flapGeo = new THREE.BoxGeometry(0.05, 0.22, 0.18);
      [-1, 1].forEach(side => {
        const flap = new THREE.Mesh(flapGeo, plateMat);
        flap.position.set(side * 0.16, -0.08, -0.02);
        flap.rotation.z = -side * 0.06;
        flap.castShadow = true;
        group.add(flap);
      });

      // Sweeping side horns - two tapered spires flanking the hood,
      // curving outward and back like folded wing-struts rather than
      // standing straight up, with a smaller secondary spur fanning
      // each one out wider at the base. Scaled down to a medium size
      // and set low enough that their base sinks into the cowl's top
      // rather than hovering disconnected above it.
      [-1, 1].forEach(side => {
        const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.045, 0.28, 4), plateMat);
        horn.position.set(side * 0.15, 0.2, -0.05);
        horn.rotation.z = side * 0.55;
        horn.rotation.x = -0.25;
        horn.castShadow = true;
        group.add(horn);

        const spur = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.03, 0.15, 4), plateMat);
        spur.position.set(side * 0.19, 0.13, -0.065);
        spur.rotation.z = side * 0.9;
        spur.rotation.x = -0.15;
        spur.castShadow = true;
        group.add(spur);
      });

      // Crown of pillars between the horns - uneven jagged spires,
      // tallest in the middle and raking backward toward the edges,
      // their base set into the cowl's top the same way the horns are,
      // reading as a crown rather than a symmetrical crest fin.
      const pillarCount = 5;
      for (let i = 0; i < pillarCount; i++) {
        const t = i / (pillarCount - 1); // 0..1 left to right
        const xOff = (t - 0.5) * 0.16;
        const h = 0.12 + Math.sin(t * Math.PI) * 0.16 + Math.random() * 0.03;
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.035, h, 0.035), plateMat);
        pillar.position.set(xOff, 0.12 + h / 2, -0.02 - Math.abs(t - 0.5) * 0.05);
        pillar.rotation.z = (t - 0.5) * -0.3;
        pillar.rotation.x = -0.12;
        pillar.castShadow = true;
        group.add(pillar);
      }

      return group;
    }

    // Steel Revenant's brutalist body armor - hyper-exaggerated trapezoid
    // and triangular silhouettes built entirely from low-poly cylinders
    // (radiusTop != radiusBottom reads as a trapezoid prism) and 3-sided
    // cones (triangular shard prisms), completely ditching the rounded/
    // boxy shapes every other armored raider (Paladin, Dark Knight) uses.
    // See createBlockyHumanoid's isSteelRevenant branch.
    function createRevenantArmor(plateColor = 0x0d0e12, shardColor = 0x24262b, glowColor = 0x2be8c8) {
      const group = new THREE.Group();
      const plateMat = new THREE.MeshLambertMaterial({ color: plateColor });
      const shardMat = new THREE.MeshLambertMaterial({ color: shardColor });
      const glowMat = new THREE.MeshBasicMaterial({ color: glowColor });

      // Trapezoidal chest plate - wide at the shoulders, narrowing sharply
      // toward the waist, instead of a flat rectangular breastplate.
      const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.15, 0.44, 4), plateMat);
      chest.rotation.y = Math.PI / 4;
      chest.castShadow = true;
      group.add(chest);

      // A small glowing teal core set into the chest, echoing the
      // visor's spectral light - the only warmth on an otherwise
      // dead-iron figure.
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), glowMat);
      core.position.set(0, 0.08, 0.19);
      group.add(core);

      // Matching teal PointLight so the core actually casts spectral
      // light onto the chest plate and pauldrons around it, the same
      // way the visor's light catches the hood above.
      const coreLight = new THREE.PointLight(glowColor, 1.3, 0.7, 2);
      coreLight.position.copy(core.position);
      group.add(coreLight);

      // Massive angular pauldrons - each a fan of three overlapping
      // triangular iron shards jutting outward and back like a folded
      // wing, instead of a single spike, widening the whole upper
      // silhouette.
      [-1, 1].forEach(side => {
        const pauldron = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.17, 4), plateMat);
        pauldron.rotation.y = Math.PI / 4;
        pauldron.rotation.z = side * 0.18;
        pauldron.position.set(side * 0.27, 0.19, 0);
        pauldron.castShadow = true;
        group.add(pauldron);

        const wingSpans = [0.3, 0.24, 0.17];
        wingSpans.forEach((len, i) => {
          const shard = new THREE.Mesh(new THREE.ConeGeometry(0.07 - i * 0.01, len, 3), shardMat);
          // Pulled in closer to the pauldron (was side*(0.3+i*0.07), reaching
          // out to 0.44) and shallower on z (was down to -0.12) so the fan
          // stays nested against the shoulder plate instead of jutting out
          // into open space - previously this read as a disconnected black
          // chunk floating beside the arm whenever the shoulder rotated out
          // of its default straight-down pose (e.g. the steelRevenant
          // two-handed mace grip in equipUnit).
          shard.position.set(side * (0.26 + i * 0.045), 0.31 - i * 0.05, -0.01 - i * 0.03);
          // Shallower rotation (was side*(0.35+i*0.22), up to ~59deg) keeps
          // each shard closer to the pauldron cylinder's own angle so the
          // fan reads as one connected plate rather than splayed shards.
          shard.rotation.z = side * (0.22 + i * 0.13);
          shard.rotation.y = Math.PI / 6;
          shard.castShadow = true;
          group.add(shard);
        });
      });

      // Layered iron shards fanning down the chest - overlapping
      // triangular plates in place of a smooth breastplate surface.
      for (let i = 0; i < 3; i++) {
        const shard = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22 - i * 0.04, 3), shardMat);
        shard.position.set(0, 0.12 - i * 0.11, 0.17 - i * 0.01);
        shard.rotation.x = Math.PI / 2.2;
        shard.rotation.z = Math.PI + (i - 1) * 0.15;
        shard.castShadow = true;
        group.add(shard);
      }

      // Trapezoid waist guard, same wedge language as the chest and
      // pauldrons above.
      const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.09, 4), shardMat);
      waist.rotation.y = Math.PI / 4;
      waist.position.y = -0.26;
      group.add(waist);

      // Flared hip wings - a smaller echo of the shoulder wings, jutting
      // out from the waist guard to widen the base of the silhouette to
      // match the broad shoulders above instead of tapering to nothing.
      [-1, 1].forEach(side => {
        const hipShard = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 3), shardMat);
        hipShard.position.set(side * 0.19, -0.28, -0.03);
        hipShard.rotation.z = side * 0.75;
        hipShard.rotation.y = Math.PI / 6;
        hipShard.castShadow = true;
        group.add(hipShard);
      });

      return group;
    }

    // Valkyrie's feathered wings - built as its own standalone attachment
    // (rather than threaded into createBlockyHumanoid's parameter list
    // like the armor sets above) and bolted onto the finished rig in
    // createValkyrieHumanoid below, since nothing about wings needs to
    // interact with the body-part construction the other cosmetics hook
    // into. Each wing is its own pivot group (wingPivots[0]=left,
    // wingPivots[1]=right) so updateUnitAnims can flap them independently
    // of the arms/body.
    function createValkyrieWings(featherColor = 0xf5f2e8, trimColor = 0xf2c14e) {
      const group = new THREE.Group();
      const featherMat = new THREE.MeshLambertMaterial({ color: featherColor });
      const trimMat = new THREE.MeshLambertMaterial({ color: trimColor });
      const wingPivots = [];

      [-1, 1].forEach(side => {
        const wingPivot = new THREE.Group();
        wingPivot.position.set(side * 0.08, 0.15, -0.12);

        // Leading-edge strut - the "bone" of the wing, angled up and out.
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.5, 4), trimMat);
        strut.position.set(side * 0.26, 0.03, -0.02);
        strut.rotation.z = side * 1.0;
        strut.rotation.x = -0.15;
        strut.castShadow = true;
        wingPivot.add(strut);

        // Three overlapping feather fans, longest nearest the body and
        // tapering toward the tip, echoing the same "graduated cone fan"
        // language the Steel Revenant's shoulder wings use.
        const featherSpans = [0.42, 0.32, 0.22];
        featherSpans.forEach((len, i) => {
          const feather = new THREE.Mesh(new THREE.ConeGeometry(0.09 - i * 0.015, len, 3), featherMat);
          feather.position.set(side * (0.2 + i * 0.22), -0.05 - i * 0.1, -0.05 - i * 0.02);
          feather.rotation.z = side * (1.35 - i * 0.12);
          feather.rotation.y = Math.PI / 6;
          feather.castShadow = true;
          wingPivot.add(feather);
        });

        group.add(wingPivot);
        wingPivots.push(wingPivot);
      });

      group.userData.wingPivots = wingPivots;
      return group;
    }

    // Builds one Valkyrie squad member: the same jointed-limb plate rig
    // Paladins/Elite Swordsmen use (isPaladin flag - see
    // createBlockyHumanoid), just in a lighter color scheme, with wings
    // bolted onto the back at the shoulder blades. wingL/wingR are stored
    // on userData so updateUnitAnims can flap them and applyAttackPose's
    // dive can reference the same rig without rebuilding it.
    function createValkyrieHumanoid(color) {
      const unit = createBlockyHumanoid(color, false, 0xf2f2f2, null, false, false, false, true);
      const wings = createValkyrieWings();
      wings.position.set(0, 0.55, 0.05);
      unit.add(wings);
      unit.userData.wingL = wings.userData.wingPivots[0];
      unit.userData.wingR = wings.userData.wingPivots[1];
      return unit;
    }

    // Kitsune Twinblade - Exclusive 2-member paired squad (see CLASS_DEFS'
    // 'kitsuneTwinblade' entry). Member 0 "Ember Fang" is the fast
    // katana striker: long, loose red hair, fox ears/tail dyed a warm
    // orange, red kimono top over a black harness (see equipUnit's
    // matching branch for her low iaijutsu draw stance). Built on the
    // plain single-pivot createBlockyHumanoid rig (no special armor
    // flag) so nothing but the hair/ears/tail bolted on here changes her
    // silhouette. Uses createKitsuneLongHair - the reference art's long,
    // windswept mane - not createSamuraiHair, whose topknot has no
    // crown/fringe piece and read as bald, and not a Valkyrie-style
    // thick double crown slab, which read as a solid helmet.
    function createKitsuneBladeHumanoid(color) {
      // isKitsune (last arg) gives Ember Fang the same jointed elbow/knee
      // limbs as Dragon Ronin/Paladins/Slasher/Steel Revenant (see the
      // isKitsune addition to createBlockyHumanoid's jointed-limb branch)
      // without pulling in any of Dragon Ronin's own cosmetics (robe, hat,
      // topknot) - those are gated on isDragonRonin specifically, not on
      // the jointed rig itself. The extra joints let her Idle/Run/Attack
      // poses below bend at the elbow/knee for a far more dynamic,
      // samurai-caliber read instead of the old stiff single-pivot limbs.
      const kimonoColor = 0xb5202a;
      const unit = createBlockyHumanoid(color, false, 0x1a1a1a, null,
        false, false, false, false, null, false, false, false, false, false,
        false, false, false, false, false, false, false, 0x6b6b6b, false,
        false, false, false, false, false, false, true);
      // Sleeve color - createBlockyHumanoid's isKitsune branch defaults
      // her forearm sleeves to the same black cloth as Slasher's (see
      // that branch's armMat). Recolored here to the kimono's own red so
      // the sleeves read as part of the kimono itself rather than a
      // separate black cuff underneath it. meshArmL/meshArmR and their
      // forearm meshes all share one material instance (see
      // createJointedLimb), so this single color change covers both
      // arms' upper and forearm segments.
      unit.userData.meshArmL.material.color.setHex(kimonoColor);
      // Kimono top - the flowing robe silhouette Dragon Ronin/Acolyte/Lich
      // already wear (createRoninRobe: front/back flaps, shoulder guards,
      // sash), recolored to a deep red with an ember-orange sash so the
      // doc comment above ("red kimono top") is an actual garment instead
      // of just bare shirt color. Attached to the body box, same as every
      // other robed unit, so it leans and sways with her attack/idle pose.
      const kimono = createRoninRobe(kimonoColor, 0xd9722c);
      unit.userData.body.add(kimono);
      const hair = createKitsuneLongHair(0xb5202a);
      unit.userData.head.add(hair);
      // Stored so updateKitsuneTwinbladeAnim can stream it backward at a
      // sprint and sway it at rest, instead of it hanging rigid.
      unit.userData.kitsuneHair = hair;
      unit.userData.head.add(createFoxEars(0xd9722c, 0x2a1a12));
      const tail = createFoxTail(0xd9722c, 0xf2ede0);
      tail.position.set(0, 0.4, -0.1);
      unit.add(tail);
      // Stored so updateKitsuneTwinbladeAnim can wag/sweep it - see that
      // function for the idle sway vs. running streamline.
      unit.userData.kitsuneTail = tail;
      return unit;
    }

    // Kitsune Twinblade member 1 "Frost Warden" - the tall spear
    // guardian: short, tousled silver hair (per the reference art) with
    // a side-swept fringe, fox ears/tail in a cool grey-white, blue
    // kimono top over a black apron skirt (see equipUnit's matching
    // branch for her diagonal spear-guard stance). Uses
    // createKitsuneShortHair rather than Ember Fang's long mane, so the
    // two silhouettes read distinctly at a glance the way they do in the
    // reference art.
    function createKitsuneSpearHumanoid(color) {
      // Frost Warden's palette is themed independently of the squad-wide
      // `color` param (same as her hair/ears/tail below, which already
      // ignore it) so the torso showing at the robe's neckline/shoulder
      // gaps is the same frost blue as the kimono itself, instead of the
      // squad's default red peeking through underneath.
      const kimonoColor = 0x2b4a66;
      // See createKitsuneBladeHumanoid's matching comment above - same
      // isKitsune jointed-limb rig, no Dragon Ronin cosmetics attached.
      const unit = createBlockyHumanoid(kimonoColor, false, 0x14141a, null,
        false, false, false, false, null, false, false, false, false, false,
        false, false, false, false, false, false, false, 0x6b6b6b, false,
        false, false, false, false, false, false, true);
      // Sleeve color - see createKitsuneBladeHumanoid's matching comment
      // above. Recolored from the default black cloth to the kimono's own
      // frost blue so the sleeves read as part of the kimono itself.
      unit.userData.meshArmL.material.color.setHex(kimonoColor);
      // Kimono top - same createRoninRobe silhouette as Ember Fang above,
      // recolored to a cool frost blue with a pale icy sash so her "blue
      // kimono top" reads as an actual garment rather than plain shirt
      // color.
      const kimono = createRoninRobe(kimonoColor, 0xaeeaff);
      unit.userData.body.add(kimono);
      const hair = createKitsuneShortHair(0xd8d8dc);
      unit.userData.head.add(hair);
      // See createKitsuneBladeHumanoid's matching comment above.
      unit.userData.kitsuneHair = hair;
      unit.userData.head.add(createFoxEars(0xc9c9ce, 0x2a2a30));
      const tail = createFoxTail(0xc9c9ce, 0xf2f2f5);
      tail.position.set(0, 0.42, -0.1);
      unit.add(tail);
      unit.userData.kitsuneTail = tail;
      return unit;
    }

    // Builds the awakened Gargoyle raider - same wings-bolted-onto-the-
    // back-at-the-unit-root pattern as createValkyrieHumanoid above (see
    // that function's doc comment for why): wingL/wingR are stored on
    // userData so updateUnitAnims' isGargoyle flight branch can flap
    // them independently of whatever body.rotation the same branch is
    // also driving that frame, rather than the wings being a child of
    // body and getting dragged around by it.
    function createGargoyleHumanoid(color) {
      const unit = createBlockyHumanoid(
        color, true, GARGOYLE_THEME.pants, null,
        false, false, false, false,   // isNinja, isAkuma, isDragonRonin, isPaladin
        null,                         // desertHeadwear
        false, false, false, false, false, // isImmortal, isSkeleton, isAcolyte, isSlasher, isDarkKnight
        false, false, false, false,   // isDemon, isSteelRevenant, isViking, isMarauder
        false, false, false,          // isOrc, isBear, isBerserker
        0x6b6b6b,                     // berserkerFurColor (unused)
        false,                        // isOnryo
        false,                        // isScarecrow
        false,                        // isLich
        false,                        // isGhoul
        true                          // isGargoyle
      );
      const wings = createGargoyleWings(true);
      wings.position.set(0, 0.5, -0.06);
      unit.add(wings);
      unit.userData.wingL = wings.userData.wingPivots[0];
      unit.userData.wingR = wings.userData.wingPivots[1];
      return unit;
    }

    // pantsColor and headbandColor let raider spawns re-skin themselves per
    // Biome Theme (see RAIDER_THEME_CONFIG) without touching player/militia
    // units, which never pass those extra args and keep the old defaults.
    // isNinja marks the model's materials as fade-capable so the Ninja
    // Concealment passive can dim it toward invisible - see concealMats
    // below and the opacity fade in updateCombatSystem. isAkuma builds the
    // Akuma Feral's Oni mask and demon tail instead (see the 'akuma' raider
    // faction) - mutually exclusive with isNinja in practice, since nothing
    // ever passes both. isDragonRonin adds the wizard hat, samurai
    // topknot, and flowing robe/pauldrons cosmetic - always called with
    // headbandColor null, since it wears no hachimaki. isImmortal adds a
    // silver demonic mask (the Immortal raider faction, unique to the
    // Desert biome) - worn together with desertHeadwear='turban' rather
    // than replacing it, so an Immortal reads as a masked swordsman under
    // a wrapped black turban instead of bare-headed. isSkeleton (Shadow
    // Island raiders) swaps the usual tan/peach skin tone for a pale bone
    // white, giving them a Skeleton Warrior look out of the same rig -
    // see createRaiderSquad, which also forces their HP down to 1 and
    // suppresses blood for them elsewhere (applyDamage/createRagdollDeath).
    // isDarkKnight (Shadow Island's other raider warband, alongside the
    // Acolytes) adds a full dark plate armor set, a black cape, and an
    // enclosing helmet - see the isDarkKnight branch below. isSteelRevenant
    // is the player-recruitable Exclusive singleton squad (see CLASS_DEFS'
    // 'steelRevenant' entry) built from brutalist trapezoid/triangle plate
    // armor (createRevenantArmor) and a towering, crowned T-visor helm
    // (createRevenantHelmet), stretched taller than any other unit for a
    // gaunt "ghost" silhouette - see the isSteelRevenant branch below.
    // isViking adds a horned steel helmet and a short beard (the
    // Northernlands biome's raider look - see createRaiderSquad, which
    // sets this whenever selectedBiomeTheme === 'northernlands') in place
    // of the plain hachimaki headband every other biome falls back to.

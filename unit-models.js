    function createBlockyHumanoid(shirtColor = 0x2266bb, isEnemy = false, pantsColor = 0x333333, headbandColor = null, isNinja = false, isAkuma = false, isDragonRonin = false, isPaladin = false, desertHeadwear = null, isImmortal = false, isSkeleton = false, isAcolyte = false, isSlasher = false, isDarkKnight = false, isDemon = false, isSteelRevenant = false, isViking = false, isMarauder = false, isOrc = false, isBear = false, isBerserker = false, berserkerFurColor = 0x6b6b6b, isOnryo = false, isScarecrow = false, isLich = false, isGhoul = false, isGargoyle = false, isAngel = false, isCrimsonGhoul = false, isKitsune = false) {
      const charGroup = new THREE.Group();
      
      // isSkeleton overrides every material to the same bare bone-white
      // (matching boneMat, used by createSkeletonMesh's decayed-corpse
      // prop) instead of the tattered-clothing tint RAIDER_THEME_CONFIG.
      // shadowIsland would otherwise pass in as shirtColor/pantsColor -
      // this rig should read as an actual bare skeleton, not a living
      // raider peeking bone through torn robes.
      const bodyMat = new THREE.MeshLambertMaterial({ color: isSkeleton ? 0xe3dac9 : shirtColor, transparent: !!isSteelRevenant, opacity: isSteelRevenant ? 0.9 : 1 });
      const skinMat = new THREE.MeshLambertMaterial({ color: isSkeleton ? 0xe3dac9 : (isOnryo ? 0xcabfa4 : (isDemon ? 0xb0301c : (isOrc ? ORC_SKIN_COLOR : (isBear ? BEAR_FUR_COLOR : (isGhoul ? GHOUL_SKIN_COLOR : (isGargoyle ? GARGOYLE_STONE_COLOR : (isEnemy ? 0xccaa88 : 0xffcc99))))))) });
      const pantsMat = new THREE.MeshLambertMaterial({ color: isSkeleton ? 0xe3dac9 : pantsColor, transparent: !!isSteelRevenant, opacity: isSteelRevenant ? 0.9 : 1 });
      // Scarecrow - burlap-sack skin on the head and bare arms instead of
      // the tan enemy skin tone.
      if (isScarecrow) skinMat.color.setHex(SCARECROW_BURLAP_COLOR);
      // Crimson Ghoul (Shadow Island's rare Undead Forces warband) - the
      // same rotting-flesh Ghoul rig, recolored a deep blood crimson
      // instead of the pale rare-tier Ghoul's grayish green.
      if (isCrimsonGhoul) skinMat.color.setHex(CRIMSON_GHOUL_SKIN_COLOR);

      // Skeleton torso is a slimmer rib-cage-proportioned box (matching
      // createSkeletonMesh's corpse rib) instead of the normal broad-
      // shouldered torso - height is kept close to the original 0.45 so
      // the head/arm/leg anchor points below don't need to move.
      // Orc cosmetic - shirtless: the torso box itself renders in bare
      // green skinMat instead of the shirt-colored bodyMat every other
      // unit uses, same idea as the arms already defaulting to skinMat
      // below (armMat). Pauldrons (see createOrcPauldrons) still cover
      // the shoulders, so it reads as "shirtless but armored" rather
      // than simply undressed.
      const body = new THREE.Mesh(new THREE.BoxGeometry(isSkeleton ? 0.26 : 0.35, isSkeleton ? 0.4 : 0.45, isSkeleton ? 0.16 : 0.22), (isOrc || isBear || isBerserker || isGhoul || isGargoyle) ? skinMat : bodyMat);
      body.position.y = 0.525;
      body.castShadow = true;
      charGroup.add(body);

      const head = new THREE.Mesh(
        isSlasher
          // Slasher cosmetic - an ovoid (egg-shaped) head instead of the
          // plain cube every other unit uses, so the hood and mask added
          // below can actually be built to hug a rounded skull instead of
          // flat box corners. The ovoid is baked into the geometry itself
          // with BufferGeometry.scale rather than the mesh's own .scale -
          // headwear gets added as children of `head` further down, and
          // a non-uniform mesh.scale would stretch their local position
          // offsets (and their own geometry) right along with it.
          ? (() => { const g = new THREE.SphereGeometry(0.165, 10, 8); g.scale(0.94, 1.08, 0.86); return g; })()
          : isSteelRevenant
            // Steel Revenant's head is the same low-poly round sphere
            // as its helmet's dome (see createRevenantHelmet) rather
            // than the generic box every other unit uses - shrunk a
            // hair smaller so it sits fully hidden inside the helm
            // instead of poking a boxy silhouette out around it.
            ? new THREE.SphereGeometry(0.137, 6, 5)
            : new THREE.BoxGeometry(0.3, 0.3, 0.3),
        // Steel Revenant has no organic head underneath at all - this
        // is just a mounting point for the helm added below, so it's
        // colored to match the dark iron armor (bodyMat) instead of
        // the usual flesh-toned skinMat, in case any of it peeks out.
        isSteelRevenant ? bodyMat : skinMat
      );
      head.position.y = 0.9;
      head.castShadow = true;
      charGroup.add(head);

      // Hollow dark eye sockets - the same skull-face treatment
      // createSkeletonMesh gives the decayed corpse prop - so a living
      // Skeleton Warrior actually reads as a skull rather than just a
      // pale, featureless head. Onryo shares the same hollowed-out look
      // over its own pale, sickly skin tone (see skinMat above) instead
      // of full bone-white, reading as a corpse-priest rather than a
      // bare skeleton.
      if (isSkeleton || isOnryo) {
        const eyeSocketMat = new THREE.MeshLambertMaterial({ color: 0x3d2314 });
        const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), eyeSocketMat);
        eyeL.position.set(-0.06, 0.02, 0.151);
        const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), eyeSocketMat);
        eyeR.position.set(0.06, 0.02, 0.151);
        head.add(eyeL, eyeR);
      }

      // Scarecrow - a stitched burlap-sack face with glowing hellish eyes
      // (see createScarecrowFace; the dormant prop uses the same face
      // without the glow) and a rope tied around the neck.
      if (isScarecrow) {
        head.add(createScarecrowFace(true));
      }

      // Desert-biome raider headwear - a keffiyeh or turban instead of the
      // hachimaki headband below, giving them an Arabian silhouette. Takes
      // priority over the plain headband when set (see createRaiderSquad,
      // which picks a style and cloth tint per-unit for variety).
      let headbandMat = null;
      if (desertHeadwear) {
        const wrap = desertHeadwear === 'turban'
          ? createHeadwrapTurban(headbandColor || 0xe8dcc0)
          : createHeadwrapKeffiyeh(headbandColor || 0xe8dcc0, 0x2a2018);
        headbandMat = wrap.children[0].material;
        head.add(wrap);
      } else if (isViking) {
        // Viking helmet - takes priority over the plain headband below,
        // same as the desert headwrap above. headbandColor doubles as the
        // horn tint here (see RAIDER_THEME_CONFIG.northernlands) instead
        // of a cloth color, since a Viking raider has no bare-headed
        // headband style of its own.
        head.add(createVikingHelmet(0x767b80, headbandColor || 0xd9c9a3));
        head.add(createNordicBeard(0xcfc9bd));
      } else if (isOrc) {
        // Orc helmet - takes priority over the plain headband below,
        // same as the desert headwrap/Viking/Marauder helmets above.
        head.add(createOrcHelmet());
      } else if (isMarauder) {
        // Marauder helmet - takes priority over the plain headband
        // below, same as the desert headwrap/Viking helmet above.
        head.add(createMarauderHelmet());
      } else if (isBerserker) {
        // Berserker pelt helmet - takes priority over the plain
        // headband below, same as the desert headwrap/Viking/Orc/
        // Marauder helmets above.
        head.add(createBerserkerPeltHelmet(berserkerFurColor));
      } else if (isScarecrow) {
        // Scarecrow - the same droopy tattered wide-brim hat the dormant
        // scenery version wears (see createScarecrowHat).
        head.add(createScarecrowHat());
      } else if (isOnryo) {
        // Onryo is a female ghost - no headwear at all, just long black
        // hair (see createGhostHair) framing the face and streaming down
        // the back, plus a wrathful spiked halo floating behind the skull
        // (see createSpikedHalo). The huge gaping mouth splitting its
        // chest is attached to charGroup further down (see
        // createBigMouth) rather than to the head, since it runs from
        // the chin down over the torso.
        head.add(createGhostHair());
        head.add(createSpikedHalo());
      } else if (isAngel) {
        // Angel - a glowing halo (see createAngelHalo) instead of the
        // plain hachimaki headband every other raider variant falls back
        // to, matching the Heavenly Island's holy aesthetic.
        head.add(createAngelHalo());
      } else if (headbandColor !== null) {
        const headband = createHeadband(headbandColor);
        headbandMat = headband.children[0].material;
        head.add(headband);
      }

      // Onryo - the huge gaping mouth splitting down its chest (see
      // createBigMouth), attached to charGroup rather than to head since
      // it runs from the chin down over the torso and shouldn't tilt
      // with head movement the way the spiked halo above does.
      if (isOnryo) {
        charGroup.add(createBigMouth());
      }

      // Scarecrow - patchwork coat with straw spilling from a chest tear
      // and ragged back panels (parented to the torso so they move with
      // it), plus a crow perched on its shoulder (parented to charGroup so
      // it stays put while the arms swing).
      if (isScarecrow) {
        body.add(createScarecrowTorsoDetails());
        const shoulderCrow = createScarecrowCrow();
        shoulderCrow.position.set(-0.19, 0.76, 0);
        shoulderCrow.rotation.y = -0.4;
        charGroup.add(shoulderCrow);
      }

      // Ninja face mask - a dark wrap covering the lower half of the head
      // so a Ninja reads as masked up rather than bare-faced. Purely
      // cosmetic; folds into the same Concealment fade as the rest of the
      // model below.
      let maskMat = null;
      if (isNinja) {
        const mask = createFaceMask(0x1a1a1a);
        maskMat = mask.children[0].material;
        head.add(mask);
      }
      // Akuma Feral Oni mask - a full-face demon plate with horns and
      // tusks, replacing any headband/normal face for this raider variant.
      if (isAkuma) {
        const oniMask = createOniMask(0xb5202a);
        head.add(oniMask);
      }

      // Demon cosmetic - bare curved horns sweeping back off the top of
      // the head, no mask or headwear (its own red skin is the whole
      // silhouette) - see createDemonHorns below.
      if (isDemon) {
        const horns = createDemonHorns(0x1a1210);
        head.add(horns);
      }

      // Bear Warrior cosmetic - rounded ears and a blunt snout, no mask or
      // headwear (see createBearFeatures) - the whole point of its
      // silhouette is reading as a bear rather than a masked/helmeted
      // raider.
      if (isBear) {
        head.add(createBearFeatures());
      }

      // Immortal raider mask - the same demonic mask sculpt as the Oni
      // mask above, recolored gunmetal silver, worn on top of the black
      // turban wrapped by desertHeadwear='turban' rather than in place of
      // it (see createRaiderSquad's isImmortal branch).
      if (isImmortal) {
        const demonMask = createOniMask(0xb0b4ba);
        head.add(demonMask);
      }

      // Dragon Ronin cosmetic - a tall wizard hat worn atop a samurai
      // topknot (see createSamuraiHair, replacing its old hachimaki
      // headband) and a flowing robe with pauldron-like shoulder guards
      // over its shirt, giving the legendary lone swordsman a bolder
      // silhouette than the plain roster.
      if (isDragonRonin) {
        const hair = createSamuraiHair(0x161010, 0xb5202a);
        head.add(hair);

        const hat = createRoninHat(0x1a1512, 0xb5202a);
        // The brim's widest point sits 0.145 above the hat group's own
        // origin (see createRoninHat), and the head box's top face sits
        // 0.15 above the head's origin - so the hat group needs to sit
        // just below that (a slight -0.02 overlap rather than 0) to rest
        // the brim directly on the crown with no floating gap above it.
        hat.position.y = -0.02;
        head.add(hat);

        const robe = createRoninRobe(shirtColor, 0xffd35c);
        body.add(robe);
      }

      // Paladin cosmetic - full plate armor (breastplate, pauldrons, waist
      // guard) worn over the shirt, plus a flowing back cape colored to
      // match the unit's own shirt color (gold for the Leader, blue-grey
      // for the Elite Swordsmen - see createSquad/respawnSquad's per-slot
      // color pick). The knight helmet is NOT added here - only the Elite
      // Swordsmen wear one, attached separately in equipUnit's 'paladins'
      // branch, which is the only place the Leader/Elite distinction
      // actually exists.
      if (isPaladin) {
        const armor = createPaladinArmor();
        body.add(armor);

        const cape = createCape(shirtColor);
        body.add(cape);
      }

      // Acolyte cult cosmetic - a hooded cult robe replacing the plain
      // shirt/pants silhouette, reusing the Dragon Ronin's flowing-robe
      // shape (front/back flaps, shoulder guards, sash) recolored to the
      // Acolyte's own dark violet palette, plus a low-drawn cowl hood
      // shadowing the face instead of any headband/keffiyeh/turban.
      if (isAcolyte) {
        const robe = createRoninRobe(shirtColor, 0x1a1424);
        body.add(robe);

        const hood = createCultHood(shirtColor);
        head.add(hood);
      }

      // Lich cosmetic - a tattered, open-collared robe (reusing the
      // Dragon Ronin/Acolyte's flowing-robe shape, recolored to a dark
      // navy with an icy pale-blue trim) worn over the bone-white
      // isSkeleton body below, left open at the neck rather than hooded
      // so the bare skull stays visible - unlike the Acolyte above,
      // which hoods a still-living face, the Lich has no face left to
      // hide. Topped with a jagged icy crown (see createLichCrown)
      // instead of any headband/keffiyeh/turban/hood.
      if (isLich) {
        const robe = createRoninRobe(0x1c2438, 0x7fe8ff);
        body.add(robe);

        const collar = createVampireCollar(0x1c2438, 0x7fe8ff);
        body.add(collar);

        const crown = createLichCrown();
        head.add(crown);
      }

      // Dark Knight cosmetic - Shadow Island's heavily-armored raider
      // counterpart to the Paladins: full dark plate armor (chest,
      // pauldrons, waist guard) plus a flowing black cape, both reusing
      // the Paladins' shapes just recolored dark (see
      // createDarkKnightArmor/createCape), topped with an always-worn
      // enclosing dark knight helmet with glowing red eye slits (see
      // createDarkKnightHelmet) - unlike the Paladins, where only the
      // Elite Swordsmen get a helmet and that split only exists in
      // equipUnit, every Dark Knight wears one.
      if (isDarkKnight) {
        const armor = createDarkKnightArmor();
        body.add(armor);

        const cape = createCape(0x0d0d10, 0x4a0f18);
        body.add(cape);

        const helmet = createDarkKnightHelmet();
        head.add(helmet);
      }

      // Marauder cosmetic - full scavenged plate armor (see
      // createMarauderArmor) under the jagged, riveted helmet already
      // attached to the head above (see the isMarauder branch in the
      // headwear chain) - no cape, unlike the Dark Knight/Steel
      // Revenant, since a Marauder reads as a rough-and-ready raider
      // rather than a robed elite.
      if (isMarauder) {
        const armor = createMarauderArmor();
        body.add(armor);
      }

      // Orc cosmetic - a crude pauldron strapped to each shoulder (see
      // createOrcPauldrons), the only armor it wears over its bare green
      // torso (see the isOrc branch on `body`'s material above) - no
      // chest plate, no cape, just shoulder guards and the helmet added
      // in the headwear chain above.
      if (isOrc) {
        const pauldrons = createOrcPauldrons();
        body.add(pauldrons);
      }

      // Berserker cosmetic - shirtless torso (see the skinMat branch on
      // `body`'s material above) with a fur-wrapped pauldron strapped to
      // each shoulder (see createBerserkerPauldrons) instead of any
      // chest plate, plus the pelt helmet added in the headwear chain
      // above - the whole silhouette reads as a savage warrior dressed
      // in hides rather than an armored soldier.
      if (isBerserker) {
        const pauldrons = createBerserkerPauldrons(berserkerFurColor);
        body.add(pauldrons);
      }

      // Ghoul cosmetic (Rare) - a feral, hunched undead creature styled
      // after Warcraft 3's Ghoul unit: bare rotting flesh (see the
      // isGhoul branch on skinMat/body above), a permanently hunched
      // predatory stance, sunken glowing eyes instead of a normal face,
      // and clawed fingertips on both hands. No headwear/armor at all -
      // the whole silhouette is meant to read as feral rather than
      // equipped.
      if (isGhoul) {
        // Hunch the torso and head forward into a predatory crouch -
        // baked in as a permanent offset rather than an animation state,
        // so it reads as this creature's natural resting posture under
        // every other pose (idle/walk/attack) layered on top of it.
        body.rotation.x = 0.32;
        head.position.y -= 0.05;
        head.position.z += 0.09;
        head.rotation.x = 0.22;

        // Sunken dark eye sockets with a small pale glowing iris, echoing
        // the skull-face treatment isSkeleton/isOnryo get above but kept
        // feral rather than fleshless.
        const ghoulSocketMat = new THREE.MeshLambertMaterial({ color: 0x1a1f16 });
        const ghoulEyeMat = new THREE.MeshBasicMaterial({ color: isCrimsonGhoul ? CRIMSON_GHOUL_EYE_GLOW : 0xd8f2c8 });
        [-0.07, 0.07].forEach(ex => {
          const socket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.02), ghoulSocketMat);
          socket.position.set(ex, 0.01, 0.151);
          head.add(socket);
          const iris = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), ghoulEyeMat);
          iris.position.set(ex, 0.01, 0.165);
          head.add(iris);
        });

        // Ragged loincloth tatters hanging off the hips - the only
        // clothing this creature wears - reusing pantsMat so it still
        // matches whatever tint CLASS_DEFS passes in.
        const tatterGeo = new THREE.BoxGeometry(0.1, 0.16, 0.02);
        [-0.08, 0.08].forEach((tx, i) => {
          const tatter = new THREE.Mesh(tatterGeo, pantsMat);
          tatter.position.set(tx, 0.22, 0.1 - i * 0.01);
          tatter.rotation.z = tx < 0 ? 0.12 : -0.12;
          body.add(tatter);
        });
      }

      // Gargoyle cosmetic (the awakened form of a Dungeon-variant
      // Gargoyle Statue - see maybeAwakenGargoyles) - stone-gray skin
      // (see skinMat/body above), a pair of curved horns (reusing the
      // Demon's sculpt in a dark stone tint), glowing amber eyes, and a
      // pair of wings unfurled from the same rig the dormant Statue prop
      // uses (see createGargoyleWings), swept back into a flight-ready
      // crouch.
      if (isGargoyle) {
        head.add(createDemonHorns(0x2a2d2f));

        const gargoyleEyeMat = new THREE.MeshBasicMaterial({ color: GARGOYLE_EYE_GLOW });
        [-0.07, 0.07].forEach(ex => {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), gargoyleEyeMat);
          eye.position.set(ex, 0.02, 0.155);
          head.add(eye);
        });

        // Hunched forward into a flight crouch, similar in spirit to the
        // Ghoul's permanent hunch above but shallower, since it's meant
        // to read as airborne rather than feral-on-the-ground. The
        // wings themselves are NOT attached here - they're bolted onto
        // the unit root by createGargoyleHumanoid below, the same way
        // createValkyrieHumanoid does it, so they get their own
        // independent pivot transform instead of inheriting body's
        // walk-cycle sway (which used to drag them around and make them
        // look disconnected from the back - see updateUnitAnims'
        // isGargoyle flight branch for the animation that now drives
        // both body and wings together instead).
        body.rotation.x = 0.18;
        head.rotation.x = 0.1;
      }

      // Steel Revenant cosmetic - the Exclusive singleton squad's imposing
      // look: full brutalist plate (angular trapezoid chest/pauldrons
      // plus layered triangular iron shards - see createRevenantArmor)
      // under a tattered spectral-trimmed cape, capped with a towering,
      // crowned T-visor helm (see createRevenantHelmet) that hides any
      // face entirely - no eyes, no mouth, nothing organic left to see.
      if (isSteelRevenant) {
        const armor = createRevenantArmor();
        body.add(armor);

        const cape = createCape(0x0a0a0d, 0x1a2228);
        body.add(cape);

        const helmet = createRevenantHelmet();
        head.add(helmet);
      }

      // Slasher cosmetic - the dark hood-and-mask combo from the reference
      // art, replacing any headband/mask on the plain shirt/pants body
      // (no robe swap like the Acolyte above - the Slasher reads as a
      // lean assassin silhouette, not a robed cultist).
      if (isSlasher) {
        const slasherMask = createSlasherMask(shirtColor);
        head.add(slasherMask);

        // Assassin clothes - a fitted black tunic over the torso (see
        // createAssassinGarb), paired with the black sleeve material
        // swapped in below for the arms, so the Slasher now reads as a
        // properly clothed assassin instead of a bare-armed silhouette.
        const garb = createAssassinGarb(0x1a1a1a);
        body.add(garb);
      }

      // Ninja passive (Concealment) - these materials get their opacity
      // faded down by updateCombatSystem while the Ninja is hidden near
      // stealth cover, so the model visibly melts into the scenery on
      // top of already being untargetable. Only flagged transparent for
      // Ninjas since it's needless overhead for every other unit.
      if (isNinja) {
        bodyMat.transparent = true;
        skinMat.transparent = true;
        pantsMat.transparent = true;
        if (headbandMat) headbandMat.transparent = true;
        maskMat.transparent = true;
      }

      function createLimb(geometry, material, posX, posY, posZ) {
        const pivot = new THREE.Group();
        pivot.position.set(posX, posY, posZ);

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = -geometry.parameters.height / 2;
        mesh.castShadow = true;
        pivot.add(mesh);

        const hand = new THREE.Group();
        hand.position.set(0, -geometry.parameters.height / 2, 0);
        mesh.add(hand);

        return { pivot, hand, mesh, joint: null, lowerMesh: null };
      }

      // Jointed variant - Dragon Ronin and Paladins (see the isDragonRonin/
      // isPaladin branches below and updateUnitAnims/applyAttackPose for
      // how the extra elbow/knee pivots get posed, plus the hand group
      // itself doubling as a wrist joint for both). Splits the single limb
      // pivot into an upper segment (shoulder/hip -> elbow/knee, "pivot"+
      // "mesh") and a lower segment (elbow/knee -> wrist/ankle, "joint"+
      // "lowerMesh"), with the combined length matching the plain
      // single-box limb above so the stance, weapon grip, and ground
      // contact still line up with every other unit type when the joint
      // is left at rest (rotation 0).
      function createJointedLimb(upperGeo, lowerGeo, material, posX, posY, posZ) {
        const pivot = new THREE.Group();
        pivot.position.set(posX, posY, posZ);

        const mesh = new THREE.Mesh(upperGeo, material);
        mesh.position.y = -upperGeo.parameters.height / 2;
        mesh.castShadow = true;
        pivot.add(mesh);

        const joint = new THREE.Group();
        joint.position.set(0, -upperGeo.parameters.height, 0);
        pivot.add(joint);

        const lowerMesh = new THREE.Mesh(lowerGeo, material);
        lowerMesh.position.y = -lowerGeo.parameters.height / 2;
        lowerMesh.castShadow = true;
        joint.add(lowerMesh);

        const hand = new THREE.Group();
        hand.position.set(0, -lowerGeo.parameters.height / 2, 0);
        lowerMesh.add(hand);

        return { pivot, hand, mesh, joint, lowerMesh };
      }

      // Skeleton limbs are noticeably thinner bone-shaped boxes rather
      // than the normal fleshed-out arm/leg thickness - closer to
      // createSkeletonMesh's corpse limb bones (0.08 thick) - since
      // isSkeleton never combines with isDragonRonin/isPaladin's jointed
      // limbs, only the plain single-pivot branch below needs it.
      const armGeo = new THREE.BoxGeometry(isSkeleton ? 0.08 : 0.12, 0.4, isSkeleton ? 0.08 : 0.12);
      // Slasher sleeves - full black cloth down each arm to the wrist,
      // matching the assassin garb added to the torso above, instead of
      // the bare skin-toned forearms every other jointed-limb unit type
      // (Dragon Ronin, Paladins) keeps. Steel Revenant gets its armor
      // plate's own dark iron tone instead of skin too, since it's a
      // fully-enclosed colossus with no exposed flesh anywhere. Kitsune
      // Twinblade shares this same sleeve material (rather than bare
      // skin) so her limbs match the Slasher's look one-for-one - same
      // arm/leg proportions already (see armWidth below, which only
      // widens for Steel Revenant), just the cloth-covered forearms too.
      const slasherSleeveMat = (isSlasher || isKitsune) ? new THREE.MeshLambertMaterial({ color: 0x1a1a1a }) : null;
      let leftArmData, rightArmData;
      if (isDragonRonin || isPaladin || isSlasher || isSteelRevenant || isKitsune) {
        // Steel Revenant gets noticeably thicker (wider) limbs than the
        // other jointed-limb units - a bulky colossus build instead of
        // the leaner proportions Dragon Ronin/Paladins/Slasher/Kitsune
        // share - while keeping the same upper/forearm lengths so the
        // elbow joint and hand anchor points still line up correctly.
        const armWidth = isSteelRevenant ? 0.22 : 0.12;
        const upperArmGeo = new THREE.BoxGeometry(armWidth, 0.22, armWidth);
        const forearmGeo = new THREE.BoxGeometry(armWidth, 0.18, armWidth);
        const armMat = (isSlasher || isKitsune) ? slasherSleeveMat : (isSteelRevenant ? bodyMat : skinMat);
        // Steel Revenant's shoulder pivots are pulled back behind the
        // torso (negative z) instead of sitting flush with it like the
        // other jointed-limb units, so the arms hang back in a
        // hunched, trailing stance rather than squared to the front.
        const armZ = isSteelRevenant ? -0.05 : 0;
        leftArmData = createJointedLimb(upperArmGeo, forearmGeo, armMat, -0.24, 0.7, armZ);
        rightArmData = createJointedLimb(upperArmGeo, forearmGeo, armMat, 0.24, 0.7, armZ);
      } else {
        leftArmData = createLimb(armGeo, skinMat, -0.24, 0.7, 0);
        rightArmData = createLimb(armGeo, skinMat, 0.24, 0.7, 0);
      }
      charGroup.add(leftArmData.pivot, rightArmData.pivot);

      // Ghoul claws - three small clawed cones fanned out from each
      // hand's wrist joint, reusing skinMat so they read as part of the
      // creature's own flesh rather than an equipped weapon (a Ghoul
      // carries nothing - see equipUnit's 'ghoul' branch, which
      // deliberately equips no weapon mesh).
      if (isGhoul) {
        const clawGeo = new THREE.ConeGeometry(0.018, 0.09, 5);
        [leftArmData.hand, rightArmData.hand].forEach(hand => {
          [-0.045, 0, 0.045].forEach(cx => {
            const claw = new THREE.Mesh(clawGeo, skinMat);
            claw.position.set(cx, -0.05, 0.02);
            claw.rotation.x = Math.PI;
            hand.add(claw);
          });
        });
      }

      const legGeo = new THREE.BoxGeometry(isSkeleton ? 0.09 : 0.14, 0.3, isSkeleton ? 0.09 : 0.14);
      let legLData, legRData;
      if (isDragonRonin || isPaladin || isSlasher || isSteelRevenant || isKitsune) {
        const thighGeo = new THREE.BoxGeometry(0.14, 0.17, 0.14);
        const shinGeo = new THREE.BoxGeometry(0.14, 0.13, 0.14);
        legLData = createJointedLimb(thighGeo, shinGeo, pantsMat, -0.1, 0.3, 0);
        legRData = createJointedLimb(thighGeo, shinGeo, pantsMat, 0.1, 0.3, 0);
      } else {
        legLData = createLimb(legGeo, pantsMat, -0.1, 0.3, 0);
        legRData = createLimb(legGeo, pantsMat, 0.1, 0.3, 0);
      }
      charGroup.add(legLData.pivot, legRData.pivot);

      const backMount = new THREE.Group();
      backMount.position.set(0, 0.55, -0.12);
      charGroup.add(backMount);

      // Hip mount for a sheathed sidearm (currently just the Dragon
      // Ronin's saya - see equipUnit's 'dragonRonin' branch) - sits at
      // the right hip, the same side as the hand that grips the blade
      // once it's drawn, so the resting arm's reach to the hilt stays a
      // short, simple rotation rather than a big cross-body twist this
      // rig's single-pivot arms don't render cleanly. Pushed out past
      // x=0.15/z=0.12 on purpose - the Dragon Ronin's robe front flap
      // (see createRoninRobe) covers roughly that whole box in front of
      // the hips, and a hip mount placed inside it was rendering
      // completely hidden behind the flap.
      const hipMount = new THREE.Group();
      hipMount.position.set(0.22, 0.32, 0.1);
      charGroup.add(hipMount);

      // Akuma Feral demon tail - attached to charGroup itself (not the
      // body box) at hip height, so it stays anchored at the creature's
      // lower back regardless of how the torso leans during animation.
      let tailMesh = null;
      if (isAkuma || isDemon) {
        tailMesh = createDemonTail(isDemon ? 0x6b1414 : 0x3a1620);
        tailMesh.position.set(0, 0.4, -0.08);
        charGroup.add(tailMesh);
      }

      // Create DOM Health Bar
      const hpBg = document.createElement('div');
      hpBg.className = 'hp-bar-bg';
      // Shield overlay first so hp-bar-fill (added next) paints over it -
      // see the .hp-bar-shield CSS comment. Unused (stays 0-width) for
      // every unit type except Chakram Dancers.
      const hpShieldFill = document.createElement('div');
      hpShieldFill.className = 'hp-bar-shield';
      hpBg.appendChild(hpShieldFill);
      const hpFill = document.createElement('div');
      hpFill.className = 'hp-bar-fill' + (isEnemy ? ' enemy' : '');
      hpBg.appendChild(hpFill);
      hpContainer.appendChild(hpBg);

      charGroup.userData = { 
        armL: leftArmData.pivot, 
        armR: rightArmData.pivot, 
        handL: leftArmData.hand, 
        handR: rightArmData.hand,
        meshArmL: leftArmData.mesh,
        meshArmR: rightArmData.mesh,
        meshLegL: legLData.mesh,
        meshLegR: legRData.mesh,
        // Elbow/knee pivots - non-null for Dragon Ronin, Paladins,
        // Slasher, and Steel Revenant (see createJointedLimb above);
        // every other unit type keeps the old single-pivot limbs and
        // these stay null. The hand/foot Group at the end of each limb
        // (leftArmData.hand etc., stored below as handL/handR) doubles
        // as the wrist joint - see equipUnit's 'paladins' branch and
        // applyAttackPose for how it gets posed.
        armLElbow: leftArmData.joint,
        armRElbow: rightArmData.joint,
        legLKnee: legLData.joint,
        legRKnee: legRData.joint,
        body: body,
        head: head,
        shirtColor: shirtColor,
        backMount: backMount,
        hipMount: hipMount,
        tailMesh: tailMesh,
        isAkuma: !!isAkuma,
        isPaladinRig: !!isPaladin,
        // Shadow Island Skeleton Warrior flag - read by applyDamage/
        // createRagdollDeath (no blood) and startDeathSequence (always an
        // instant kill, never the lingering crawl/stagger sequence).
        isSkeleton: !!isSkeleton,
        // Shadow Island Acolyte flag - read by createRagdollDeath/
        // createBloodSplatter call sites to bleed dark violet instead of
        // red (see ACOLYTE_BLOOD_COLOR).
        isAcolyte: !!isAcolyte,
        // Ghoul flag (Rare) - read by processUnitAttack for its melee
        // damage/swing-speed and by triggerGhoulCannibalize for its
        // heal-on-kill passive.
        isGhoul: !!isGhoul,
        // Crimson Ghoul flag (Shadow Island's rare Undead Forces warband) -
        // purely cosmetic on top of isGhoul, read by createRagdollDeath so
        // the corpse keeps its crimson tone instead of the pale rare-tier
        // Ghoul's own skin color.
        isCrimsonGhoul: !!isCrimsonGhoul,
        // Gargoyle flag - read by the movement update to apply
        // GARGOYLE_HOVER_HEIGHT and by processUnitAttack/applyAttackPose
        // via isRaiderGargoyle (raiderWeapon === 'gargoyleBolt' is the
        // actual combat-behavior switch; this flag is just for the
        // visual/movement side).
        isGargoyle: !!isGargoyle,
        // Shadow Island Dark Knight flag - read by applyDamage (immune to
        // any guaranteed-lethal/instant-kill attack - Assassinate,
        // Deathblow, Cavalry Charge's instant-kill half) and by
        // discoverRaiderType (logged under its own Raiders Index entry
        // regardless of the Sword/Mace loadout it rolled).
        isDarkKnight: !!isDarkKnight,
        // Demon flag - read by killUnit/startDeathSequence to force the
        // instant Hellfire Burst explosion (see explodeDemon) in place of
        // the normal ragdoll death, and by equipUnit/applyDamage for its
        // Hell Trident loadout and shield-bypassing explosion damage.
        isDemon: !!isDemon,
        // Orc/Bear Warrior flags - read by createRagdollDeath so a corpse
        // keeps its own green orc skin (or bear fur) instead of falling
        // through to the generic enemy tan the instant it dies (see the
        // skinMat/bodyMesh material picks there). Not stored before this,
        // which is exactly why that check never actually fired.
        isOrc: !!isOrc,
        isBear: !!isBear,
        // Scarecrow flag (Demon faction, Shadow Island Swamp) - read by
        // killUnit/startDeathSequence for its straw-and-crows death, by
        // applyDamage to skip blood, and by findGoddessHost.
        isScarecrow: !!isScarecrow,
        legL: legLData.pivot, 
        legR: legRData.pivot, 
        unitType: 'archers',
        isWalking: false, 
        walkTimer: 0,
        // BAD NORTH COMBAT DATA
        hp: isEnemy ? Math.max(1, Math.round(100 * ENEMY_NERF.hp)) : 100,
        maxHp: isEnemy ? Math.max(1, Math.round(100 * ENEMY_NERF.hp)) : 100,
        attackCooldown: 0,
        isEnemy: isEnemy,
        hpElement: hpBg,
        hpFillElement: hpFill,
        // Chakram Dancers' Spinning Shield passive - a damage-absorbing
        // buffer topped up on every attack (see applyChakramDancerShield)
        // and drained before HP in applyDamage. Stays 0 and inert for
        // every other unit type.
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
        // Which raider faction this unit belongs to - null for the classic
        // warbands, 'wokou' for a Japanese pirate raider (Katana/Sickle/Bow).
        // Set by equipUnit() based on the weapon it's issued.
        raiderFaction: null,
        // Raider passive (Javelin Throw) - a Spear raider's one-time coin
        // flip is only rolled the first time it actually gets to attack;
        // this flag remembers that the roll has already happened so it
        // never re-rolls after re-arming. See processUnitAttack.
        spearThrowResolved: false,
        // Wokou passive (Bomb Throw) - same one-time-coin-flip shape as
        // spearThrowResolved above, but for the Wokou's Bomb Throw passive.
        bombThrowResolved: false,
        // Lets a single attack animation cycle override the normal
        // per-unitType pose lookup in applyAttackPose - used so a Spear
        // raider's javelin throw still reads as a throw even though its
        // weapon has already been swapped to an Axe/Sword by the time
        // the pose is applied.
        attackAnimPoseOverride: null,
        // Pikeman passive (Fortitude) - see applyDamage for the trigger and
        // the defense reduction itself
        fortitudeTimer: 0,
        // Elite Swordsman passive (Last Stand) - see applyDamage for the
        // HP-threshold trigger and the defense reduction itself.
        lastStandTimer: 0,
        // Berserker passive (Rage) - live off current HP each attack
        // (see isBerserkerRaging in processUnitAttack) rather than a
        // timer; this just remembers the last computed state so the
        // "RAGE!" announcement only fires once on the crossing, not on
        // every subsequent enraged swing.
        berserkerRaging: false,
        // Cavalry passive (Bleeding) - see applyBleed for the trigger and
        // the bleedTick handling inside processUnitAttack/applyDamage
        bleedTicksRemaining: 0,
        bleedTickTimer: 0,
        // Dragon Ronin passive (Dragon's Breath) - see applyBurn for the
        // trigger and the burnTick handling inside applyDamage/animate.
        burnTicksRemaining: 0,
        burnTickTimer: 0,
        // War Elephant passive (Venom Arrows) - see applyPoison for the
        // trigger and the poisonTick handling inside applyDamage/animate.
        poisonTicksRemaining: 0,
        poisonTickTimer: 0,
        // Which of a unit type's cosmetic idle stances this unit was
        // randomly assigned - two for the Ninja, two for the Dragon
        // Ronin - see equipUnit's 'ninja' and 'dragonRonin' branches and
        // updateUnitAnims; undefined for every other type.
        idleVariant: undefined,
        // Slasher only - personality timers for its idle animation (a
        // periodic head-scan glance plus an occasional dagger-twirl
        // flourish while standing still) - see the 'slasher' idle branch
        // in animate()'s main pose loop. idleFidgetTimer counts down to
        // the next flourish; idleFidgetAnimTimer counts down through the
        // flourish itself once triggered. Seeded with a random offset in
        // equipUnit's 'slasher' branch so a squad of four doesn't twirl
        // in lockstep.
        idleFidgetTimer: 0,
        idleFidgetAnimTimer: 0,
        // Dragon Ronin only - the hip-mounted sheathed katana, created
        // once at equip time and toggled visible/hidden per idle
        // variant and combat state by updateUnitAnims (alongside
        // weaponMesh, the drawn blade). null for every other unit type.
        sheathMesh: null,
        // Dragon Ronin only - a small healing flask held in the off hand,
        // hidden until the Second Wind passive triggers. See
        // maybeTriggerDragonSecondWind and applyAttackPose's 'drinkPotion'
        // branch. null for every other unit type.
        potionMesh: null,
        // Steel Revenant only - a small cluster of spectral claw-energy
        // shards parented to the left hand, invisible until the Steel
        // Grasp cast plays. See createSteelGraspGlowMesh and
        // applyAttackPose's 'steelGrasp' branch. null for every other
        // unit type.
        graspGlowMesh: null,
        // Steel Revenant only - a spectral glow parented to the torso,
        // invisible until the Unbreakable cast plays. See
        // createUnbreakableGlowMesh and applyAttackPose's 'unbreakable'
        // branch. null for every other unit type.
        unbreakableGlowMesh: null,
        // Steel Revenant only - the short handle segment parented to the
        // left hand for its normal offhand grip, hidden while
        // Unbreakable's cast pose lets go of it to press the hand
        // against the chest instead. null for every other unit type.
        offhandGripMesh: null,
        // Dragon Ronin passive (Second Wind) - true once this unit has
        // dropped to DRAGON_SECOND_WIND_THRESHOLD and healed itself, so
        // it can't re-trigger again the same life. A fresh unit object
        // (spawned/respawned) always starts with this false.
        secondWindUsed: false,
        // Dragon Ronin passive (Sword Dash) - counts down after each dash
        // and blocks the ability from re-triggering until it lapses. See
        // DRAGON_SWORD_DASH_COOLDOWN and triggerDragonSwordDash.
        swordDashCooldown: 0,
        // Dragon Ronin passive (Deflect) - counts successful parries
        // (melee or ranged); reaching DRAGON_RONIN_DEATHBLOW_PARRY_STACKS
        // cashes in for a free Deathblow. See the Deflect branch in
        // applyDamage.
        roninPostureStacks: 0,
        // Dragon Ronin passive (Deflect) - counts down the snap-block pose
        // after a successful parry/deflect (see the Deflect branch in
        // applyDamage and the 'dragonRonin' branch in updateUnitAnims).
        deflectAnimTimer: 0,
        // Slasher passive (Ghost Step) - counts down the dash-flicker pose
        // after a successful projectile deflect (see triggerSlasherGhostStepDeflect
        // and the ghostStepDashAnimTimer branch in updateUnitAnims).
        ghostStepDashAnimTimer: 0,
        // Slasher passive (Rooftop Ambush) - counts down a target's
        // startled/caught-off-guard pose after a Slasher flash-steps onto
        // it from a rooftop/boulder perch. See triggerSlasherAmbush and
        // the shock-pose branch in updateUnitAnims. Applies to whichever
        // unit gets ambushed (any type can be a target), not just Slashers.
        shockAnimTimer: 0,
        // Cavalry - which weapon this particular rider was randomly issued
        // (only meaningful when unitType === 'cavalry')
        cavalryWeapon: null,
        // Ninja passive (Smoke Bomb) - once this unit drops to low HP, it
        // has a chance to drop a Smoke Bomb and vanish outright rather
        // than just getting harder to hit. See applyDamage for the trigger
        // and processUnitAttack for the vanishTimer countdown/reappear.
        vanished: false,
        vanishTimer: 0,
        // Ninja passive (Concealment) - materials whose opacity gets
        // faded by updateCombatSystem while hidden near stealth cover;
        // null for every non-Ninja unit. concealOpacity tracks the
        // current faded value so the fade can lerp smoothly frame to frame.
        concealMats: isNinja ? [bodyMat, skinMat, pantsMat, headbandMat, maskMat].filter(Boolean) : null,
        concealOpacity: 1,
        // Steel Revenant flag - read by equipUnit for its Revenant Mace
        // loadout, and by applySquadLevelStats for its boosted HP pool.
        isSteelRevenant: !!isSteelRevenant
      };

      // Steel Revenant towers over every other unit - a tall, gaunt
      // "ghost" silhouette rather than the normal stocky build. Applied
      // last so it stretches the whole assembled rig uniformly.
      if (isSteelRevenant) charGroup.scale.y = 1.3;

      // Scarecrow - tall, lanky silhouette, with a handful of straw
      // hanging from each wrist.
      if (isScarecrow) {
        charGroup.scale.set(0.95, 1.22, 0.95);
        const strawL = createStrawTuft(6, 0.14, 0.7);
        const strawR = createStrawTuft(6, 0.14, 0.7);
        strawL.position.set(0, -0.05, 0);
        strawR.position.set(0, -0.05, 0);
        leftArmData.hand.add(strawL);
        rightArmData.hand.add(strawR);
      }

      // Bear Warrior - noticeably bigger than every other raider in every
      // direction (not just taller like the Steel Revenant above), so it
      // reads as a hulking beast standing in for a whole warband rather
      // than just a reskinned human. Applied last, same as Steel Revenant,
      // so it scales the whole assembled rig - fur, ears, snout and all -
      // uniformly.
      if (isBear) charGroup.scale.set(1.35, 1.5, 1.35);

      return charGroup;
    }

    function equipUnit(unit, type, raiderWeapon, memberIndex) {
      const uData = unit.userData;
      uData.unitType = type;

      while (uData.handL.children.length > 0) uData.handL.remove(uData.handL.children[0]);
      while (uData.handR.children.length > 0) uData.handR.remove(uData.handR.children[0]);
      while (uData.backMount.children.length > 0) uData.backMount.remove(uData.backMount.children[0]);
      while (uData.hipMount.children.length > 0) uData.hipMount.remove(uData.hipMount.children[0]);

      uData.body.rotation.set(0, 0, 0);
      uData.head.rotation.set(0, 0, 0);
      uData.armL.rotation.set(0, 0, 0);
      uData.armR.rotation.set(0, 0, 0);
      uData.weaponMesh = null;
      uData.sheathMesh = null;
      uData.potionMesh = null;
      uData.graspGlowMesh = null;
      // unbreakableGlowMesh is parented to uData.body rather than
      // handL/handR (it needs to sit on the chest, not track a hand), so
      // it isn't swept up by the handL/handR/backMount/hipMount clears
      // above - remove it explicitly before a possible re-equip re-adds
      // a fresh one.
      if (uData.unbreakableGlowMesh) uData.body.remove(uData.unbreakableGlowMesh);
      uData.unbreakableGlowMesh = null;
      uData.offhandGripMesh = null;
      uData.hasShield = false;
      uData.raiderWeapon = null;
      // Chakram Dancers' off-hand ring - tracked separately from
      // uData.weaponMesh (the right-hand ring) so applyAttackPose can
      // spin both rings independently during the attack pose.
      uData.offhandChakramMesh = null;
      // Reset any leftover Spinning Shield buffer from a previous type
      // (e.g. a re-equip after a squad-type change) and clear its bar.
      uData.absorbShield = 0;
      if (uData.hpShieldFillElement) uData.hpShieldFillElement.style.width = '0%';

      if (type === 'swords') {
        const sword = createSword();
        sword.rotation.x = Math.PI / 2;
        sword.position.set(0, 0, 0.05);
        uData.handR.add(sword);
        uData.weaponMesh = sword;

        const shield = createShield();
        shield.position.set(-0.04, 0.1, 0);
        uData.handL.add(shield);
        uData.hasShield = true;
      } 
      else if (type === 'pikes') {
        const pike = createPike();
        uData.handR.add(pike);
        uData.weaponMesh = pike;

        uData.armR.rotation.x = -Math.PI / 4; 
        uData.armR.rotation.y = -Math.PI / 12;

        uData.armL.rotation.x = -Math.PI / 3;
        uData.armL.rotation.y = Math.PI / 5;
      } 
      else if (type === 'archers') {
        const bow = createRealisticBow();
        // Held nearly upright and out in front, like a Minecraft skeleton
        bow.rotation.x = Math.PI / 2.6;
        bow.rotation.y = 0;
        bow.position.set(0, 0.04, 0.06);
        uData.handL.add(bow);
        uData.weaponMesh = bow;

        const quiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.1), woodMat);
        quiver.rotation.z = -Math.PI / 8;
        uData.backMount.add(quiver);

        // Permanent aiming stance: both arms raised and extended forward at
        // roughly shoulder height, bow arm slightly higher/wider, string arm
        // tucked in close - the classic Minecraft skeleton "always ready" pose.
        uData.armL.rotation.x = -Math.PI / 2;
        uData.armL.rotation.z = -Math.PI / 20;
        uData.armR.rotation.x = -Math.PI / 2.1;
        uData.armR.rotation.z = Math.PI / 14;
      }
      else if (type === 'warElephant') {
        // memberIndex 0 is the War Elephant itself, bare-handed (its
        // Charge & Stomp is a stat-only bonus hit, not a wielded weapon -
        // see the melee damage branch gated on
        // uData.elephantRole==='elephant'); memberIndex 1-2 are its two
        // Desert Warrior archers, using the same bow loadout/aiming
        // stance as the plain Archers branch above so all the existing
        // ranged movement/attack-range/projectile code paths just work
        // unmodified. See createSquad/spawnUnit for where
        // uData.elephantRole itself gets set on each member.
        if (memberIndex === 0) {
          // No weapon mesh here on purpose - the mahout rides bare-handed
          // (the elephant's own Charge & Stomp passive is a stat-only
          // bonus hit, not tied to any held weapon - see
          // triggerWarElephantStomp).
          uData.armL.rotation.x = -Math.PI / 8;
          uData.armR.rotation.x = -Math.PI / 8;
        } else {
          const bow = createRealisticBow();
          bow.rotation.x = Math.PI / 2.6;
          bow.rotation.y = 0;
          bow.position.set(0, 0.04, 0.06);
          uData.handL.add(bow);
          uData.weaponMesh = bow;

          const quiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.1), woodMat);
          quiver.rotation.z = -Math.PI / 8;
          uData.backMount.add(quiver);

          uData.armL.rotation.x = -Math.PI / 2;
          uData.armL.rotation.z = -Math.PI / 20;
          uData.armR.rotation.x = -Math.PI / 2.1;
          uData.armR.rotation.z = Math.PI / 14;
        }
      }
      else if (type === 'crossbow') {
        // Same "always ready" aiming stance as Archers (reuses the
        // ARCHER_READY_ARM poses everywhere else in the codebase), just
        // holding the horizontal crossbow model instead of a longbow.
        const crossbow = createCrossbow();
        crossbow.rotation.x = Math.PI / 2.6;
        crossbow.rotation.y = 0;
        crossbow.position.set(0, 0.04, 0.06);
        uData.handL.add(crossbow);
        uData.weaponMesh = crossbow;

        const boltCase = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.1), steelMat);
        boltCase.rotation.z = -Math.PI / 8;
        uData.backMount.add(boltCase);

        uData.armL.rotation.x = -Math.PI / 2;
        uData.armL.rotation.z = -Math.PI / 20;
        uData.armR.rotation.x = -Math.PI / 2.1;
        uData.armR.rotation.z = Math.PI / 14;
      }
      else if (type === 'berserker') {
        // Rare tier melee brawler - wields the two-headed Double Axe
        // (see createDoubleAxe) two-handed rather than the one-handed
        // Axe/Shield grip other axe-users use: both arms raised into
        // the swing, no shield, matching the shirtless, unarmored
        // silhouette (see createBlockyHumanoid's isBerserker branch).
        const axe = createDoubleAxe();
        axe.rotation.x = Math.PI / 2.3;
        axe.position.set(0, 0, 0.05);
        uData.handR.add(axe);
        uData.weaponMesh = axe;
        uData.armR.rotation.x = -Math.PI / 3;
        uData.armL.rotation.x = -Math.PI / 3.5;
      }
      else if (type === 'ghoul') {
        // Rare tier feral swarm unit - fights bare-clawed with no weapon
        // mesh at all (see createBlockyHumanoid's isGhoul branch, which
        // builds the claws directly onto each hand). weaponMesh is
        // deliberately left null - it has nothing to drop on death (see
        // dropWeapon, which already no-ops when weaponMesh is null).
        // Re-applies the permanent hunched stance baked into the model
        // at creation, since the reset above zeroes out body/head
        // rotation on every equip call.
        uData.body.rotation.x = 0.32;
        uData.head.rotation.x = 0.22;
        uData.armL.rotation.x = -0.15;
        uData.armR.rotation.x = -0.15;
      }
      else if (type === 'mages') {
        const staff = createStaff();
        staff.rotation.x = Math.PI / 2;
        staff.position.set(0, -0.02, 0.03);
        uData.handR.add(staff);
        uData.weaponMesh = staff;

        uData.armR.rotation.x = -Math.PI / 2.4;
        uData.armR.rotation.z = -Math.PI / 20;
        uData.armL.rotation.x = -Math.PI / 6;
      }
      else if (type === 'doctor') {
        // Doctor - carries a Medic Bag instead of any weapon. It never
        // fights (see the 'doctor' early-return in processUnitAttack
        // inside updateCombatSystem, which routes it into
        // updateDoctorSupport instead of any targeting/attack logic), so
        // weaponMesh is deliberately left null - nothing equipped here
        // grants it an attack reach.
        const bag = createMedicBag();
        bag.position.set(0.06, -0.02, 0.05);
        uData.handL.add(bag);

        uData.armL.rotation.x = -Math.PI / 5;
        uData.armR.rotation.x = -Math.PI / 8;
      }
      else if (type === 'siege') {
        // Siege Engineer - carries a Mallet instead of any weapon. Never
        // fights (see the 'siege' early-return in processUnitAttack); its
        // ability is handled in updateSiegeEngineerSupport instead, so
        // weaponMesh is deliberately left null here too.
        const mallet = createSiegeMallet();
        mallet.position.set(0.05, -0.02, 0.04);
        uData.handR.add(mallet);

        uData.armR.rotation.x = -Math.PI / 5;
        uData.armL.rotation.x = -Math.PI / 8;
      }
      else if (type === 'cavalry') {
        const weapon = raiderWeapon || CAVALRY_WEAPON_TYPES[Math.floor(Math.random() * CAVALRY_WEAPON_TYPES.length)];
        uData.cavalryWeapon = weapon;

        if (weapon === 'sword') {
          const sword = createSword();
          sword.rotation.x = Math.PI / 2;
          sword.position.set(0, 0, 0.05);
          uData.handR.add(sword);
          uData.weaponMesh = sword;
          uData.armR.rotation.x = -Math.PI / 3;
          uData.armL.rotation.x = -Math.PI / 6;
        }
        else if (weapon === 'spear') {
          const spear = createPike();
          uData.handR.add(spear);
          uData.weaponMesh = spear;
          uData.armR.rotation.x = -Math.PI / 3.2;
          uData.armR.rotation.y = -Math.PI / 16;
          uData.armL.rotation.x = -Math.PI / 3;
          uData.armL.rotation.y = Math.PI / 5;
        }
        else { // 'bow'
          const bow = createRealisticBow();
          bow.rotation.x = Math.PI / 2.6;
          bow.rotation.y = 0;
          bow.position.set(0, 0.04, 0.06);
          uData.handL.add(bow);
          uData.weaponMesh = bow;

          const quiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.1), woodMat);
          quiver.rotation.z = -Math.PI / 8;
          uData.backMount.add(quiver);

          uData.armL.rotation.x = -Math.PI / 2;
          uData.armL.rotation.z = -Math.PI / 20;
          uData.armR.rotation.x = -Math.PI / 2.1;
          uData.armR.rotation.z = Math.PI / 14;
        }

        // Cavalry always rides - mount it on a horse the same way mounted
        // Militia are, straddled in the saddle rather than standing on
        // the ground.
        const horse = createMilitiaHorse();
        horse.position.set(0, -MILITIA_MOUNT_SEAT_Y, -0.05);
        unit.add(horse);
        uData.horseMesh = horse;
        uData.isMounted = true;
        unit.position.y = MILITIA_MOUNT_SEAT_Y;
        uData.legL.rotation.set(-1.15, 0, 0.22);
        uData.legR.rotation.set(-1.15, 0, -0.22);
      }
      else if (type === 'ninja') {
        // A short kunai (a scaled-down sword) rather than a full blade -
        // the Ninja's real damage comes from thrown Shurikens/Smoke Bombs,
        // this is just a melee-silhouette prop.
        const kunai = createSword();
        kunai.scale.set(0.55, 0.5, 0.55);
        kunai.rotation.x = Math.PI / 2;
        kunai.position.set(0, 0, 0.05);
        uData.handR.add(kunai);
        uData.weaponMesh = kunai;
        uData.armR.rotation.x = -Math.PI / 3;
        uData.armL.rotation.x = -Math.PI / 6;

        // Two idle variants, picked once per unit, so a squad of Ninjas
        // doesn't look like clones standing in lockstep. 0 = low, wide
        // combat crouch with the kunai held ready. 1 = tall, still
        // stealth stance with hands clasped together at the chest in a
        // ninjutsu hand-seal, feet close together - a calmer, more
        // watchful silhouette that reads as "sensing" rather than
        // "about to strike".
        uData.idleVariant = Math.random() < 0.5 ? 0 : 1;

        // Shuriken pouch slung on the back.
        const pouch = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.14, 0.08),
          new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
        );
        pouch.rotation.z = Math.PI / 10;
        uData.backMount.add(pouch);
      }
      else if (type === 'slasher') {
        // A short dagger - see createDagger. No shield or second weapon;
        // the assassin identity here is a bare, empty off-hand rather than
        // a paired dual-wield.
        const dagger = createDagger();
        dagger.rotation.x = -Math.PI / 2;
        dagger.position.set(0, 0, 0.05);
        uData.handR.add(dagger);
        uData.weaponMesh = dagger;

        // Random first countdown to the idle dagger-twirl flourish - see
        // the 'slasher' idle branch in animate() - so a squad of four
        // doesn't all flourish on the same beat.
        uData.idleFidgetTimer = SLASHER_FIDGET_MIN_INTERVAL + Math.random() * SLASHER_FIDGET_INTERVAL_RANGE;
      }
      else if (type === 'kitsuneTwinblade') {
        // Exclusive 2-member paired squad - memberIndex 0 "Ember Fang"
        // draws a katana low and forward (a quick-draw crouch, not a
        // raised guard); memberIndex 1 "Frost Warden" braces a spear
        // diagonally across her body the way a Pikeman guards, just
        // gripped a touch higher/wider to read as a watchful cover
        // stance rather than a bracing wall. See createSquad's
        // kitsuneRole assignment and the melee damage branch below for
        // each one's passive (Quickdraw / Guard the Flank).
        if (memberIndex === 0) {
          const katana = createKatana();
          katana.rotation.x = -Math.PI / 2.4;
          katana.position.set(0, 0, 0.05);
          uData.handR.add(katana);
          uData.weaponMesh = katana;

          uData.body.rotation.x = 0.15;
          uData.armR.rotation.x = -Math.PI / 2.6;
          uData.armR.rotation.z = -Math.PI / 10;
          uData.armL.rotation.x = -Math.PI / 5;
        } else {
          const spear = createPike();
          uData.handR.add(spear);
          uData.weaponMesh = spear;

          uData.armR.rotation.x = -Math.PI / 3.4;
          uData.armR.rotation.y = -Math.PI / 10;
          uData.armL.rotation.x = -Math.PI / 2.8;
          uData.armL.rotation.y = Math.PI / 6;
        }
      }
      else if (type === 'steelRevenant') {
        // Player-recruitable Exclusive singleton squad - a massive
        // two-handed flanged Revenant Mace gripped low and wide, no
        // shield, no ranged option, same rig the enemy warband version
        // used to carry (see createRevenantBlade). A heavier, more
        // raised guard than the Hell Trident's grip, befitting a
        // slower, harder-hitting lone unit.
        const mace = createRevenantBlade();
        // Shifts the whole weapon back along its own haft so the hand
        // grips roughly the middle of the stick instead of right at the
        // base/pommel end - matches the raider-warband version's grip.
        mace.position.set(0, 0, -0.57);
        uData.handR.add(mace);
        uData.weaponMesh = mace;
        uData.armR.rotation.x = -Math.PI / 2.6;
        uData.armR.rotation.y = -Math.PI / 6;
        uData.armL.rotation.x = -Math.PI / 2.8;
        uData.armL.rotation.y = -Math.PI / 8;

        // Off-hand grip - a short handle segment attached to the left
        // hand so it visibly holds the mace instead of an empty fist.
        const offhandGripMat = new THREE.MeshLambertMaterial({ color: 0x1c1d20 });
        const offhandGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.3, 6), offhandGripMat);
        offhandGrip.rotation.x = Math.PI / 2;
        offhandGrip.position.set(0, 0, 0.15);
        offhandGrip.castShadow = true;
        uData.handL.add(offhandGrip);
        // Stored so Unbreakable (applyAttackPose's 'unbreakable' branch)
        // can hide it while the left hand lets go of the mace to press
        // against the chest instead of gripping the offhand handle.
        uData.offhandGripMesh = offhandGrip;

        // Steel Grasp passive - a spectral claw-energy glow parented to
        // the same left hand, invisible until the cast plays. See
        // createSteelGraspGlowMesh and applyAttackPose's 'steelGrasp'
        // branch.
        const graspGlow = createSteelGraspGlowMesh();
        graspGlow.position.set(0, 0.08, 0);
        uData.handL.add(graspGlow);
        uData.graspGlowMesh = graspGlow;

        // Unbreakable passive - a spectral chest-glow parented to the
        // torso, invisible until the cast plays. See
        // createUnbreakableGlowMesh and applyAttackPose's 'unbreakable'
        // branch.
        const unbreakableGlow = createUnbreakableGlowMesh();
        unbreakableGlow.position.set(0, 0.15, 0.15);
        uData.body.add(unbreakableGlow);
        uData.unbreakableGlowMesh = unbreakableGlow;

        // Random first countdown to the idle "Grindstone" heave-and-grind
        // flourish - see the 'steelRevenant' idle branch in animate() -
        // reusing the same fields the Slasher's dagger-twirl uses above.
        uData.idleFidgetTimer = STEEL_REVENANT_FIDGET_MIN_INTERVAL + Math.random() * STEEL_REVENANT_FIDGET_INTERVAL_RANGE;
        // Random first countdown to the second, independent "Spectral
        // Shudder" idle flourish - see the same idle branch.
        uData.shudderTimer = STEEL_REVENANT_SHUDDER_MIN_INTERVAL + Math.random() * STEEL_REVENANT_SHUDDER_INTERVAL_RANGE;
      }
      else if (type === 'goddessOfDeath') {
        // Goddess of Death - one-handed reaping scythe held upright like a
        // staff, off hand free with a faint crimson glow. See
        // createDeathScythe and updateGoddessAnim/applyAttackPose.
        const scythe = createDeathScythe();
        scythe.rotation.x = GODDESS_SCYTHE_REST_TILT;
        uData.handR.add(scythe);
        uData.weaponMesh = scythe;
        uData.armR.rotation.x = -0.35;
        uData.armL.rotation.x = -0.15;
        const handGlow = createGoddessHandGlow();
        uData.handL.add(handGlow);
        uData.goddessHandGlow = handGlow;
      }
      else if (type === 'goddessOfLife') {
        // Goddess of Life - one-handed moon staff held upright like a
        // crook, off hand free with a faint moonlight glow. See
        // createMoonStaff and updateGoddessOfLifeAnim/applyAttackPose.
        const staff = createMoonStaff();
        staff.rotation.x = GOLIFE_STAFF_REST_TILT;
        uData.handR.add(staff);
        uData.weaponMesh = staff;
        uData.armR.rotation.x = -0.35;
        uData.armL.rotation.x = -0.15;
        const lifeGlow = createGoLifeHandGlow();
        uData.handL.add(lifeGlow);
        uData.goLifeHandGlow = lifeGlow;
      }
      else if (type === 'lich') {
        // Player-recruitable Exclusive singleton squad - unlike every
        // other ranged squad (Mages/Acolyte included), it carries no
        // weapon mesh at all: its Frostbolt (see the 'lich' branch in
        // processUnitAttack, which spawns a 'frostbolt' projectile - see
        // spawnProjectile) is conjured directly out of its raised bare
        // hand. A small conjured ice shard hovers just above the open
        // palm as a cosmetic tell that magic is gathering there, rather
        // than a held object - it's parented to handR like a weapon
        // would be, but uData.weaponMesh is deliberately left unset so
        // nothing here grants it any melee reach of its own. Its Frost
        // Nova/Death Coil passives fire independently on top of this in
        // updateLichAbilities below, the same layered pattern Paladins
        // use for Holy Light/Light Shock on top of their own attack.
        const shardMat = new THREE.MeshLambertMaterial({ color: 0xaef2ff, emissive: 0x2ec8e6 });
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), shardMat);
        shard.position.set(0, 0.05, 0.06);
        uData.handR.add(shard);

        uData.armR.rotation.x = -Math.PI / 2.4;
        uData.armR.rotation.z = -Math.PI / 20;
        uData.armL.rotation.x = -Math.PI / 6;
      }
      else if (type === 'raiders') {
        const weapon = raiderWeapon || 'axe';
        uData.raiderWeapon = weapon;
        uData.raiderFaction = uData.isSkeleton ? 'skeleton' : (WOKOU_WEAPON_TYPES.includes(weapon) ? 'wokou' : (AKUMA_WEAPON_TYPES.includes(weapon) ? 'akuma' : (ONRYO_WEAPON_TYPES.includes(weapon) ? 'onryo' : (DESERT_BANDIT_WEAPON_TYPES.includes(weapon) ? 'desertBandit' : (IMMORTAL_WEAPON_TYPES.includes(weapon) ? 'immortal' : (ACOLYTE_WEAPON_TYPES.includes(weapon) ? 'acolyte' : (DARK_KNIGHT_WEAPON_TYPES.includes(weapon) ? 'darkKnight' : (UNDEAD_WEAPON_TYPES.includes(weapon) ? 'undead' : (DEMON_WEAPON_TYPES.includes(weapon) ? 'demon' : (MARAUDER_WEAPON_TYPES.includes(weapon) ? 'marauder' : (ORC_WEAPON_TYPES.includes(weapon) ? 'orc' : (BEAR_WEAPON_TYPES.includes(weapon) ? 'bear' : (WOLF_WARRIOR_WEAPON_TYPES.includes(weapon) ? 'wolfWarrior' : null)))))))))))));
        // Shadow Island's raiders always come back as Skeleton Warriors
        // instead of living Classic Raiders (see isSkeleton in
        // createRaiderSquad) - logged under their own 'skeleton' Raiders
        // Index entry regardless of which melee/ranged loadout they rose
        // with, rather than folding into the plain Axe/Sword/Spear/Bow
        // Raider entries the same loadout would register as elsewhere.
        // Dark Knights get the same treatment - one 'darkKnight' entry
        // regardless of whether this particular unit rolled a Sword or a
        // Mace.
        discoverRaiderType(uData.isSkeleton ? 'skeleton' : (uData.isDarkKnight ? 'darkKnight' : (uData.isDemon ? 'demon' : weapon)), selectedBiomeTheme);

        if (weapon === 'katana') {
          const katana = createKatana();
          katana.rotation.x = Math.PI / 2;
          katana.position.set(0, 0, 0.05);
          uData.handR.add(katana);
          uData.weaponMesh = katana;
          uData.armR.rotation.x = -Math.PI / 3;
          uData.armL.rotation.x = -Math.PI / 6;
        }
        else if (weapon === 'sickle') {
          const sickle = createSickle();
          sickle.rotation.x = Math.PI / 2.3;
          sickle.position.set(0, 0, 0.05);
          uData.handR.add(sickle);
          uData.weaponMesh = sickle;
          uData.armR.rotation.x = -Math.PI / 3;
          uData.armL.rotation.x = -Math.PI / 6;
        }
        else if (weapon === 'onryoStaff') {
          // Onryo - a two-handed ritual staff (see createOnryoStaff),
          // planted upright in the main hand like a player Pike/spear
          // grip, with a purely cosmetic kusarigama hanging from the
          // off hand (see createKusarigamaAccessory) so the raider
          // matches the reference art's two-item silhouette without
          // needing its own separate throw/attack logic - the staff
          // alone is what fights, via the same generic melee swing/
          // damage/cooldown every other unlisted raider weapon uses.
          const staff = createOnryoStaff();
          uData.handR.add(staff);
          uData.weaponMesh = staff;
          uData.armR.rotation.x = -Math.PI / 3.2;
          uData.armR.rotation.y = -Math.PI / 16;
          uData.armL.rotation.x = -Math.PI / 3;
          uData.armL.rotation.y = Math.PI / 5;

          const kusarigama = createKusarigamaAccessory();
          kusarigama.position.set(0, -0.04, 0.02);
          uData.handL.add(kusarigama);
        }
        else if (weapon === 'sword' || weapon === 'swordShield' || weapon === 'banditSword' || weapon === 'immortalSword') {
          const sword = createSword();
          sword.rotation.x = Math.PI / 2;
          sword.position.set(0, 0, 0.05);
          uData.handR.add(sword);
          uData.weaponMesh = sword;
          uData.armR.rotation.x = -Math.PI / 3;

          if (weapon === 'swordShield') {
            const shield = createShield();
            shield.position.set(-0.04, 0.1, 0);
            uData.handL.add(shield);
            uData.hasShield = true;
            uData.armL.rotation.x = -Math.PI / 8; // held up and ready, not hanging loose
          } else {
            uData.armL.rotation.x = -Math.PI / 6;
          }

          // Immortal passives (Tougher + Resurrection) - a bigger HP pool
          // than a normal raider, and a one-time revive-on-death flag reset
          // fresh for every newly-equipped Immortal (see
          // maybeTriggerImmortalResurrection in applyDamage).
          if (weapon === 'immortalSword') {
            uData.maxHp = Math.round(uData.maxHp * IMMORTAL_HP_MULT);
            uData.hp = uData.maxHp;
            uData.immortalResurrected = false;
          }
        }
        else if (weapon === 'spear' || weapon === 'spearShield' || weapon === 'marauderSpear') {
          const spear = createPike();
          uData.handR.add(spear);
          uData.weaponMesh = spear;
          uData.armR.rotation.x = -Math.PI / 3.2;
          uData.armR.rotation.y = -Math.PI / 16;

          if (weapon === 'spearShield') {
            // One-handed grip on the spear so the shield arm is free.
            const shield = createShield();
            shield.position.set(-0.04, 0.1, 0);
            uData.handL.add(shield);
            uData.hasShield = true;
            uData.armL.rotation.x = -Math.PI / 8;
          } else {
            // Two-handed grip, same as a player Pike.
            uData.armL.rotation.x = -Math.PI / 3;
            uData.armL.rotation.y = Math.PI / 5;
          }
        }
        else if (weapon === 'bow' || weapon === 'wokouBow' || weapon === 'banditBow' || weapon === 'orcBow') {
          // Raider Archer loadout - same bow rig as the player Archer/
          // Cavalry bow rider, just re-skinned in raider colors. Wokou,
          // Desert Bandits, and Orcs use the identical rig under their
          // own 'wokouBow'/'banditBow'/'orcBow' loadout keys so the
          // Raiders Index tracks each as its own entry.
          const bow = createRealisticBow();
          bow.rotation.x = Math.PI / 2.6;
          bow.rotation.y = 0;
          bow.position.set(0, 0.04, 0.06);
          uData.handL.add(bow);
          uData.weaponMesh = bow;

          const quiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.1), woodMat);
          quiver.rotation.z = -Math.PI / 8;
          uData.backMount.add(quiver);

          uData.armL.rotation.x = -Math.PI / 2;
          uData.armL.rotation.z = -Math.PI / 20;
          uData.armR.rotation.x = -Math.PI / 2.1;
          uData.armR.rotation.z = Math.PI / 14;
        }
        else if (weapon === 'claws' || weapon === 'bearClaws') {
          // Akuma Feral / Bear Warrior - no held weapon, just bare claws.
          // Held low and wide in a ready-to-pounce stance instead of a
          // normal fighting guard; see applyAttackPose's isAkumaFeral
          // branch for the actual pounce animation (Akuma only - a Bear
          // Warrior uses the plain melee swing pose).
          uData.armL.rotation.set(-0.5, 0, 0.35);
          uData.armR.rotation.set(-0.5, 0, -0.35);

          // Bear Warrior passive (Summon Lightning) - first countdown to
          // its periodic lightning strike, ticked down in
          // processUnitAttack and re-rolled each time the ability fires
          // (see summonBearLightningStrike).
          if (weapon === 'bearClaws') {
            uData.bearLightningCooldown = BEAR_LIGHTNING_COOLDOWN_MIN + Math.random() * BEAR_LIGHTNING_COOLDOWN_RANGE;
          }
        }
        else if (weapon === 'ghoulClaws') {
          // Crimson Ghoul (Shadow Island's Undead Forces warband) - no
          // held weapon, same bare clawed hands the model was built with
          // (see createBlockyHumanoid's isGhoul branch). Re-applies the
          // permanent hunched stance baked into the model at creation,
          // since the reset at the top of equipUnit zeroes out body/head/
          // arm rotation on every equip call (see the player-only 'ghoul'
          // branch further below, which does the same thing).
          uData.body.rotation.x = 0.32;
          uData.head.rotation.x = 0.22;
          uData.armL.rotation.x = -0.15;
          uData.armR.rotation.x = -0.15;
        }
        else if (weapon === 'wolfAxe') {
          // Wolf Warrior - the exact same two-handed Double Axe rig the
          // player-recruitable Berserker Squad uses (see equipUnit's
          // 'berserker' branch/createDoubleAxe), reused here under its own
          // 'wolfAxe' loadout key so the Raiders Index tracks it as its
          // own entry distinct from the Berserker Squad.
          const wolfAxe = createDoubleAxe();
          wolfAxe.rotation.x = Math.PI / 2.3;
          wolfAxe.position.set(0, 0, 0.05);
          uData.handR.add(wolfAxe);
          uData.weaponMesh = wolfAxe;
          uData.armR.rotation.x = -Math.PI / 3;
          uData.armL.rotation.x = -Math.PI / 3.5;
        }
        else if (weapon === 'acolyteBolt') {
          // Shadow Island Acolyte - no held weapon at all; the bolt fires
          // straight out of the raised hand instead (see spawnProjectile's
          // 'darkBolt' type and the isRaiderAcolyte casting pose in
          // applyAttackPose, which reuses the Mage ally's channeling
          // animation). Rest stance mirrors that Mage's staff-free grip
          // angle so the empty hand still reads as an intentional pose.
          uData.armR.rotation.x = -Math.PI / 2.4;
          uData.armR.rotation.z = -Math.PI / 20;
          uData.armL.rotation.x = -Math.PI / 6;
        }
        else if (weapon === 'gargoyleBolt') {
          // Gargoyle (the awakened form of a Dungeon-variant Gargoyle
          // Statue - see maybeAwakenGargoyles) - same bare-handed caster
          // rest pose as the Acolyte above, no weapon mesh; the stone
          // bolt fires straight out of its raised claw (see
          // spawnProjectile's 'gargoyleBolt' type and the
          // isRaiderGargoyle casting pose in applyAttackPose).
          uData.armR.rotation.x = -Math.PI / 2.4;
          uData.armR.rotation.z = -Math.PI / 20;
          uData.armL.rotation.x = -Math.PI / 6;
          // Re-applies the flight crouch baked into the model at
          // creation (see createBlockyHumanoid's isGargoyle branch),
          // since the reset above zeroes out body/head rotation on
          // every equip call.
          uData.body.rotation.x = 0.18;
          uData.head.rotation.x = 0.1;
        }
        else if (weapon === 'mace' || weapon === 'marauderMace') {
          // Desert Bandit ('mace') or Marauder ('marauderMace') loadout -
          // a stubby one-handed flanged mace, gripped and swung the same
          // way as the classic Axe.
          const mace = createMace();
          mace.rotation.x = Math.PI / 2.3;
          mace.position.set(0, 0, 0.05);
          uData.handR.add(mace);
          uData.weaponMesh = mace;
          uData.armR.rotation.x = -Math.PI / 3;
          uData.armL.rotation.x = -Math.PI / 6;
        }
        else if (weapon === 'darkKnightSword' || weapon === 'darkKnightMace') {
          // Dark Knight loadout - always a raised shield paired with
          // either a one-handed sword or mace (see
          // DARK_KNIGHT_WEAPON_TYPES/randomDarkKnightWeapon), never
          // dual-wielded or two-handed like the classic Raider variants.
          const isMace = weapon === 'darkKnightMace';
          const meleeWeapon = isMace ? createMace() : createSword();
          meleeWeapon.rotation.x = isMace ? Math.PI / 2.3 : Math.PI / 2;
          meleeWeapon.position.set(0, 0, 0.05);
          uData.handR.add(meleeWeapon);
          uData.weaponMesh = meleeWeapon;
          uData.armR.rotation.x = -Math.PI / 3;

          const shield = createShield();
          shield.position.set(-0.04, 0.1, 0);
          uData.handL.add(shield);
          uData.hasShield = true;
          uData.armL.rotation.x = -Math.PI / 8; // held up and ready, not hanging loose
        }
        else if (weapon === 'hellTrident') {
          // Demon loadout - a two-handed Hell Trident, gripped the same
          // way a Spear raider holds its pike. No shield, no ranged
          // option - see DEMON_WEAPON_TYPES/createHellTrident.
          const trident = createHellTrident();
          uData.handR.add(trident);
          uData.weaponMesh = trident;
          uData.armR.rotation.x = -Math.PI / 3.2;
          uData.armR.rotation.y = -Math.PI / 16;
          uData.armL.rotation.x = -Math.PI / 3;
          uData.armL.rotation.y = Math.PI / 5;
        }
        else if (weapon === 'scarecrowScythe') {
          // Scarecrow loadout - a rusted farm scythe gripped upright in
          // the main hand, same grip as the Onryo's staff. See
          // createScarecrowScythe.
          const scarecrowScythe = createScarecrowScythe();
          uData.handR.add(scarecrowScythe);
          uData.weaponMesh = scarecrowScythe;
          uData.armR.rotation.x = -Math.PI / 3.2;
          uData.armR.rotation.y = -Math.PI / 16;
          uData.armL.rotation.x = -Math.PI / 3;
          uData.armL.rotation.y = Math.PI / 5;
        }
        else if (weapon === 'orcAxe' || weapon === 'orcAxeShield') {
          // Orc loadout - one-handed axe, either swung two-handed or
          // paired with a shield, same rig/grip logic as the classic
          // Sword & Shield raider above just built around the Axe.
          const axe = createAxe();
          axe.rotation.x = Math.PI / 2.3;
          axe.position.set(0, 0, 0.05);
          uData.handR.add(axe);
          uData.weaponMesh = axe;
          uData.armR.rotation.x = -Math.PI / 3;

          if (weapon === 'orcAxeShield') {
            const shield = createShield();
            shield.position.set(-0.04, 0.1, 0);
            uData.handL.add(shield);
            uData.hasShield = true;
            uData.armL.rotation.x = -Math.PI / 8; // held up and ready, not hanging loose
          } else {
            uData.armL.rotation.x = -Math.PI / 6;
          }
        }
        else { // 'axe' (classic raider loadout) or 'marauderAxe' (Marauder loadout) - same rig either way
          const axe = createAxe();
          axe.rotation.x = Math.PI / 2.3;
          axe.position.set(0, 0, 0.05);
          uData.handR.add(axe);
          uData.weaponMesh = axe;
          uData.armR.rotation.x = -Math.PI / 3;
          uData.armL.rotation.x = -Math.PI / 6;
        }
      }
      else if (type === 'militia' || type === 'skeletonWarriors') {
        // Player-recruitable Militia squad (and the Skeleton Warriors squad,
        // which shares this exact branch - see its CLASS_DEFS entry) - the
        // exact same three weapon rigs the AI Villager Militia uses (see
        // MILITIA_WEAPON_TYPES / randomMilitiaLoadout below), picked
        // randomly per unit. Crucially this is tracked as its own
        // uData.militiaWeapon rather than actually becoming unitType
        // 'swords'/'pikes'/'archers' - so none of those classes' passives
        // (Shield Bash / Fortitude / Piercing Shot) ever trigger for it. By
        // design this squad has no passive ability at all, just a plain,
        // reliable line unit - true for both Militia and Skeleton Warriors.
        const weapon = raiderWeapon || ['sword', 'spear', 'bow'][Math.floor(Math.random() * 3)];
        uData.militiaWeapon = weapon;

        if (weapon === 'sword') {
          const sword = createSword();
          sword.rotation.x = Math.PI / 2;
          sword.position.set(0, 0, 0.05);
          uData.handR.add(sword);
          uData.weaponMesh = sword;

          // Still carries a shield and can block a frontal hit like a real
          // Swordsman - it just never gets the Shield Bash retaliation,
          // since that passive is gated on unitType === 'swords' specifically.
          const shield = createShield();
          shield.position.set(-0.04, 0.1, 0);
          uData.handL.add(shield);
          uData.hasShield = true;
        }
        else if (weapon === 'spear') {
          const pike = createPike();
          uData.handR.add(pike);
          uData.weaponMesh = pike;

          uData.armR.rotation.x = -Math.PI / 4;
          uData.armR.rotation.y = -Math.PI / 12;
          uData.armL.rotation.x = -Math.PI / 3;
          uData.armL.rotation.y = Math.PI / 5;
        }
        else { // 'bow'
          const bow = createRealisticBow();
          bow.rotation.x = Math.PI / 2.6;
          bow.rotation.y = 0;
          bow.position.set(0, 0.04, 0.06);
          uData.handL.add(bow);
          uData.weaponMesh = bow;

          const quiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.1), woodMat);
          quiver.rotation.z = -Math.PI / 8;
          uData.backMount.add(quiver);

          uData.armL.rotation.x = -Math.PI / 2;
          uData.armL.rotation.z = -Math.PI / 20;
          uData.armR.rotation.x = -Math.PI / 2.1;
          uData.armR.rotation.z = Math.PI / 14;
        }
      }
      else if (type === 'desertWarriors') {
        // Common-tier Desert Warriors squad - a fixed 2-melee/2-ranged
        // formation rather than a per-unit random loadout (contrast with
        // Militia above). createSquad/respawnSquad lay members out with
        // slots 0-1 in the front row and slots 2-3 in the back row (see
        // their (i % 2)/(Math.floor(i / 2)) formation math), so keying
        // the loadout off memberIndex here puts the Scimitar-and-Shield
        // fighters up front and the Bows safely behind them.
        const isMelee = memberIndex < 2;
        uData.desertWarriorRole = isMelee ? 'melee' : 'archer';

        if (isMelee) {
          const scimitar = createScimitar();
          scimitar.rotation.x = Math.PI / 2;
          scimitar.position.set(0, 0, 0.05);
          uData.handR.add(scimitar);
          uData.weaponMesh = scimitar;

          const shield = createShield();
          shield.position.set(-0.04, 0.1, 0);
          uData.handL.add(shield);
          uData.hasShield = true;
        } else {
          const bow = createRealisticBow();
          bow.rotation.x = Math.PI / 2.6;
          bow.rotation.y = 0;
          bow.position.set(0, 0.04, 0.06);
          uData.handL.add(bow);
          uData.weaponMesh = bow;

          const quiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.1), woodMat);
          quiver.rotation.z = -Math.PI / 8;
          uData.backMount.add(quiver);

          uData.armL.rotation.x = -Math.PI / 2;
          uData.armL.rotation.z = -Math.PI / 20;
          uData.armR.rotation.x = -Math.PI / 2.1;
          uData.armR.rotation.z = Math.PI / 14;
        }
      }
      else if (type === 'paladins') {
        // Legendary solo unit (memberCount 1) - always the gold-armored
        // Leader loadout, no Elite Swordsmen companions anymore. Kept as
        // its own flag (rather than deleting it) since applyAttackPose/
        // the idle-pose block still key their two-handed swing/carry pose
        // off uData.isPaladinLeader.
        uData.isPaladinLeader = true;

        // Randomly picks a Greatsword or Warhammer once (kept on
        // uData.paladinWeapon so a re-equip - e.g. a Squad Upgrade stat
        // refresh - doesn't silently swap the visible weapon).
        const weaponKind = uData.paladinWeapon || (Math.random() < 0.5 ? 'greatsword' : 'warhammer');
        uData.paladinWeapon = weaponKind;
        const weapon = weaponKind === 'greatsword' ? createGreatsword() : createWarhammer();
        weapon.rotation.x = Math.PI / 2;
        weapon.position.set(0, 0, 0.05);
        uData.handR.add(weapon);
        uData.weaponMesh = weapon;

        // Two-handed grip read: off arm braces up near the haft instead
        // of hanging loose or carrying a shield. Elbows/wrists default
        // to a relaxed bend rather than dead-straight - see
        // applyAttackPose's 'paladins' branch for how the swing/wrist
        // snap animates on top of this rest pose.
        uData.armL.rotation.x = -Math.PI / 5;
        uData.armL.rotation.z = Math.PI / 10;
        uData.armR.rotation.x = -Math.PI / 6;
        uData.armLElbow.rotation.x = 0.35;
        uData.armRElbow.rotation.x = 0.3;
        uData.handL.rotation.x = 0;
        uData.handR.rotation.x = 0;

        // Cropped commander hair - the Paladin wears no knight helmet,
        // so it needs something on the crown to read as bare-headed-by-
        // choice rather than bald. Guarded so a stat-refresh re-equip
        // doesn't stack a second head of hair on top of the first.
        if (!uData.hairMesh) {
          const hair = createCommanderHair();
          uData.head.add(hair);
          uData.hairMesh = hair;
        }
      }
      else if (type === 'eliteSwordsmen') {
        // Epic 4-member squad - every member uses the exact same loadout
        // as a Paladin Elite Swordsman (sword + shield + knight helmet,
        // full plate armor via the isPaladin flag passed into
        // createBlockyHumanoid), just without the Leader/Elite split - see
        // equipUnit's 'paladins' branch for the source of this loadout.
        const sword = createSword();
        sword.rotation.x = Math.PI / 2;
        sword.position.set(0, 0, 0.05);
        uData.handR.add(sword);
        uData.weaponMesh = sword;

        const shield = createShield();
        shield.position.set(-0.04, 0.1, 0);
        uData.handL.add(shield);
        uData.hasShield = true;
        uData.armRElbow.rotation.x = 0.15;
        uData.armLElbow.rotation.x = 0.1;
        uData.handL.rotation.x = 0;
        uData.handR.rotation.x = 0;

        if (!uData.helmetMesh) {
          const helmet = createKnightHelmet();
          uData.head.add(helmet);
          uData.helmetMesh = helmet;
        }
      }
      else if (type === 'valkyrie') {
        // Epic flying squad - same sword+shield loadout as an Elite
        // Swordsman (see above), just bare-headed rather than helmeted so
        // the wings (see createValkyrieHumanoid) stay the clear read on
        // the silhouette instead of competing with an enclosed helm.
        const sword = createSword();
        sword.rotation.x = Math.PI / 2;
        sword.position.set(0, 0, 0.05);
        uData.handR.add(sword);
        uData.weaponMesh = sword;

        const shield = createShield();
        shield.position.set(-0.04, 0.1, 0);
        uData.handL.add(shield);
        uData.hasShield = true;
        uData.armRElbow.rotation.x = 0.15;
        uData.armLElbow.rotation.x = 0.1;
        uData.handL.rotation.x = 0;
        uData.handR.rotation.x = 0;

        if (!uData.hairMesh) {
          const hair = createValkyrieHair();
          uData.head.add(hair);
          uData.hairMesh = hair;
        }
      }
      else if (type === 'chakramDancers') {
        // Epic 4-member squad - a bladed Chakram spins in each hand
        // during the attack pose (see applyAttackPose's 'chakramDancers'
        // branch and updateUnitAnims' idle spin), with a matching spare
        // pair holstered flat against the hips for when they're not
        // swinging. Shares the Desert Warriors' headwrap/robe silhouette
        // (see createSquadMemberVisual) rather than plate armor.
        const chakramR = createChakram();
        chakramR.rotation.x = Math.PI / 2;
        chakramR.position.set(0, 0, 0.05);
        uData.handR.add(chakramR);
        uData.weaponMesh = chakramR;

        const chakramL = createChakram();
        chakramL.rotation.x = Math.PI / 2;
        chakramL.position.set(0, 0, 0.05);
        uData.handL.add(chakramL);
        uData.offhandChakramMesh = chakramL;

        const hipChakramL = createChakram();
        hipChakramL.rotation.y = Math.PI / 2;
        hipChakramL.position.set(-0.11, -0.04, 0);
        const hipChakramR = createChakram();
        hipChakramR.rotation.y = Math.PI / 2;
        hipChakramR.position.set(0.11, -0.04, 0);
        uData.hipMount.add(hipChakramL, hipChakramR);

        uData.armR.rotation.x = -Math.PI / 4;
        uData.armL.rotation.x = -Math.PI / 4;
      }
      else if (type === 'dragonRonin') {
        // Legendary lone blade - a single-member squad wielding an
        // oversized two-handed katana.
        const katana = createKatana();
        katana.scale.set(1.15, 1.2, 1.15);
        katana.rotation.x = Math.PI / 2;
        katana.position.set(0, 0, 0.05);
        uData.handR.add(katana);
        uData.weaponMesh = katana;

        // Sheathed saya worn at the right hip (see hipMount above), set
        // to a -90 degree diagonal (z) from the hip mount so the hilt
        // end stays anchored near the hip and the saya juts out and
        // across at a slant rather than hanging straight down the leg
        // or sweeping diagonally up across the front of the torso (the
        // earlier version of this, which read as the sword resting on
        // the front of the robe instead of sitting at the hip). A
        // 80 degree yaw (y) on top of that swings the whole diagonal
        // around the vertical axis so it reads as lying flatter/more
        // horizontal off the hip instead of jutting straight out to
        // the side. The slight x tilt keeps the angle from looking
        // perfectly flat. Visible only while genuinely idle; swapped
        // out for the drawn uData.weaponMesh the instant the unit
        // walks, attacks, or deflects - see updateUnitAnims.
        const sheath = createKatanaSheath();
        sheath.scale.set(1.1, 1.15, 1.1);
        sheath.rotation.set(0.12, (80 * Math.PI) / 180, -Math.PI / 2);
        uData.hipMount.add(sheath);
        uData.sheathMesh = sheath;

        // Second Wind passive - a healing flask held ready in the off
        // hand, invisible until the heal actually fires. See
        // maybeTriggerDragonSecondWind and applyAttackPose's
        // 'drinkPotion' branch.
        const potion = createHealingPotion();
        potion.visible = false;
        uData.handL.add(potion);
        uData.potionMesh = potion;

        // Only one idle stance now - the settled "Sword Rest" pose
        // (blade sheathed at the hip). Purely cosmetic, no gameplay
        // effect. (A "Meditative Vigil" variant and a "Bamboo Flute"
        // variant used to live here but have both been removed.) See
        // updateUnitAnims.
        uData.idleVariant = 0;

        // Default resting pose (also re-set live every frame while idle
        // in updateUnitAnims) - just avoids a pose pop the instant the
        // unit spawns or re-equips.
        uData.armR.rotation.x = -Math.PI / 6;
        uData.armL.rotation.x = -Math.PI / 6;
        // Idle stances keep the elbow essentially straight (see the
        // idleVariant branches in updateUnitAnims) - the katana is a long,
        // rigidly-attached blade, so any elbow rotation gets amplified way
        // out at its tip and reads as a dislocated arm under the close,
        // static scrutiny of a standing pose. The joint bend is reserved
        // for the walk cycle and the attack swing, where it's brief and
        // in motion instead of sitting still on screen.
        uData.armRElbow.rotation.x = 0;
        uData.armLElbow.rotation.x = 0;
      }
    }

    // =====================================================================
    // GODDESS OF DEATH - Exclusive singleton squad (appearance inspired by
    // Ronova, Ruler of Death, from Genshin Impact: tall and pale, knee-length
    // white hair, a blank faceless head, near-black arms marked with red
    // eyes, eye-shaped red hairpins, and angular crimson wings).
    // Everything specific to her lives in this block plus the small hooks
    // marked "Goddess" elsewhere (CLASS_DEFS entry, createSquadMemberVisual,
    // equipUnit, applyAttackPose, updateUnitAnims, processUnitAttack,
    // killUnit/startDeathSequence/dropWeapon and the Recruit Shop banner).
    // =====================================================================
    const GODDESS_BASE_DMG = 42;              // matches CLASS_DEFS.goddessOfDeath.baseDmg
    const GODDESS_HP_MULT = 4.5;              // 450 HP before squad upgrade level
    const GODDESS_DECREE_THRESHOLD = 0.3;     // Death's Decree: instant kill at/below 30% HP
    const GODDESS_SWEEP_CHANCE = 0.3;         // Reaper's Sweep: chance per swing
    const GODDESS_SWEEP_RADIUS = 2.3;
    const GODDESS_SWEEP_DAMAGE_MULT = 0.7;
    const GODDESS_SWEEP_KNOCKBACK = 1.5;
    const GODDESS_SWEEP_ANIM_DURATION = 0.75;
    const GODDESS_SOUL_HARVEST_HEAL_PCT = 0.15; // Soul Harvest: heal per kill
    const GODDESS_SCYTHE_REST_TILT = 0.45;
    // Soul Vessel: on death she may possess a nearby raider, then burst out of it.
    const GODDESS_POSSESS_CHANCE = 0.35;      // chance on death (needs a raider nearby)
    const GODDESS_POSSESS_RANGE = 8;          // how far away a host can be
    const GODDESS_POSSESS_DURATION = 10;      // seconds until the host explodes
    const GODDESS_POSSESS_BLAST_RADIUS = 2.6;
    const GODDESS_POSSESS_BLAST_DAMAGE = 80;  // before squad upgrade multiplier
    const GODDESS_REVIVE_HP_PCT = 0.6;        // HP she returns with

    function goddessFlowerPupilSvg(cx, cy, r) {
      let out = '';
      for (let i = 0; i < 7; i++) {
        const a = (i * 360 / 7).toFixed(2);
        out += `<ellipse cx='${cx}' cy='${(cy - r * 0.55).toFixed(2)}' rx='${(r * 0.3).toFixed(2)}' ry='${(r * 0.58).toFixed(2)}' transform='rotate(${a} ${cx} ${cy})' fill='#1a0a0e'/>`;
      }
      return out;
    }

    // Squad icon - drawn as an SVG data URI so no external image is needed.
    const GODDESS_ICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
      <defs>
        <radialGradient id='bg' cx='50%' cy='36%' r='78%'><stop offset='0' stop-color='#6a1636'/><stop offset='0.55' stop-color='#26091b'/><stop offset='1' stop-color='#07020a'/></radialGradient>
        <linearGradient id='hair' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffffff'/><stop offset='1' stop-color='#b4aecf'/></linearGradient>
      </defs>
      <rect width='128' height='128' fill='url(#bg)'/>
      <g fill='#160810' stroke='#d0203f' stroke-width='2' stroke-linejoin='round'>
        <path d='M60 74 L4 18 L20 62 L2 68 L22 88 L8 104 L46 98 Z'/>
        <path d='M68 74 L124 18 L108 62 L126 68 L106 88 L120 104 L82 98 Z'/>
      </g>
      <path d='M64 14 C26 16 20 62 28 112 L36 128 L92 128 L100 112 C108 62 102 16 64 14 Z' fill='url(#hair)'/>
      <path d='M32 128 Q40 94 64 90 Q88 94 96 128 Z' fill='#13060f' stroke='#d0203f' stroke-width='1.6'/>
      <ellipse cx='64' cy='58' rx='19' ry='23' fill='#efe6ee'/>
      <path d='M43 52 C44 26 84 26 85 52 C77 41 69 38 64 45 C59 38 51 41 43 52 Z' fill='#ffffff'/>
      <path d='M30 50 Q37 43 44 50 Q37 56 30 50Z' fill='#d21a3a'/><circle cx='37' cy='50' r='2' fill='#12040a'/>
      <path d='M84 50 Q91 43 98 50 Q91 56 84 50Z' fill='#d21a3a'/><circle cx='91' cy='50' r='2' fill='#12040a'/>
    </svg>`;
    const GODDESS_ICON_URI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(GODDESS_ICON_SVG);

    let goddessIrisTex = null;
    let goddessRedEyeTex = null;

    // Golden eye with a dark 7-petal flower-shaped pupil.
    function getGoddessIrisTexture() {
      if (goddessIrisTex) return goddessIrisTex;
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      grad.addColorStop(0, '#fff4b0');
      grad.addColorStop(1, '#d99a1e');
      g.fillStyle = grad;
      g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#7a4d08'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#1a0a0e';
      for (let i = 0; i < 7; i++) {
        g.save();
        g.translate(32, 32);
        g.rotate(i * 2 * Math.PI / 7);
        g.beginPath(); g.ellipse(0, -11, 5.5, 12, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(23, 22, 3.2, 0, Math.PI * 2); g.fill();
      goddessIrisTex = new THREE.CanvasTexture(c);
      return goddessIrisTex;
    }

    // Almond-shaped red eye - used for the arm patterns, hairpins, brooch,
    // wing roots and the scythe ornament.
    function getGoddessRedEyeTexture() {
      if (goddessRedEyeTex) return goddessRedEyeTex;
      const c = document.createElement('canvas');
      c.width = 64; c.height = 40;
      const g = c.getContext('2d');
      g.fillStyle = '#d21a3a';
      g.beginPath();
      g.moveTo(2, 20); g.quadraticCurveTo(32, -6, 62, 20); g.quadraticCurveTo(32, 46, 2, 20);
      g.fill();
      g.strokeStyle = '#2a0610'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#12040a';
      g.beginPath(); g.ellipse(32, 20, 5.5, 11, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(29, 15, 2, 0, Math.PI * 2); g.fill();
      goddessRedEyeTex = new THREE.CanvasTexture(c);
      return goddessRedEyeTex;
    }

    function makeGoddessDecal(w, h, tex) {
      return new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
      );
    }

    // Angular wing built from a fan of dark and crimson blade-feathers.
    // side: +1 = right wing, -1 = left wing.
    function createGoddessWing(side) {
      const wing = new THREE.Group();
      const inner = new THREE.Group();
      wing.add(inner);
      const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a0f18 });
      const crimsonMat = new THREE.MeshLambertMaterial({ color: 0xa3122a });
      const tipMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
      const angles = [16, 36, 56, 76, 98];
      const lengths = [0.64, 0.6, 0.52, 0.42, 0.32];
      angles.forEach((deg, i) => {
        const f = new THREE.Group();
        f.rotation.z = -side * deg * Math.PI / 180;
        const len = lengths[i];
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07 - i * 0.005, len, 0.014), i % 2 === 0 ? darkMat : crimsonMat);
        blade.position.y = len / 2;
        blade.castShadow = true;
        f.add(blade);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.012, len * 0.9, 0.018), i % 2 === 0 ? crimsonMat : darkMat);
        trim.position.y = len / 2;
        f.add(trim);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.09, 4), tipMat);
        tip.position.y = len + 0.04;
        f.add(tip);
        inner.add(f);
      });
      const root = makeGoddessDecal(0.09, 0.056, getGoddessRedEyeTexture());
      root.position.set(side * 0.05, 0.07, -0.012);
      root.rotation.y = Math.PI;
      inner.add(root);
      wing.userData.inner = inner;
      wing.userData.side = side;
      return wing;
    }

    // Death's scythe - built along +Y with the grip at the origin, a long
    // dark shaft, crimson bands and a curved pale blade hooking forward (+Z).
    function createDeathScythe() {
      const scythe = new THREE.Group();
      const shaftMat = new THREE.MeshLambertMaterial({ color: 0x1b1219 });
      const crimsonMat = new THREE.MeshLambertMaterial({ color: 0xb01532 });
      const bladeMat = new THREE.MeshLambertMaterial({ color: 0xdcd6ea, emissive: 0x2a2440 });
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 1.32, 6), shaftMat);
      shaft.position.y = 0.34;
      shaft.castShadow = true;
      scythe.add(shaft);
      [0.55, 0.05, -0.16].forEach(y => {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.025, 6), crimsonMat);
        band.position.y = y;
        scythe.add(band);
      });
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 6), crimsonMat);
      spike.rotation.z = Math.PI;
      spike.position.y = -0.37;
      scythe.add(spike);

      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.06), crimsonMat);
      collar.position.y = 0.97;
      scythe.add(collar);
      const eyeF = makeGoddessDecal(0.09, 0.056, getGoddessRedEyeTexture());
      eyeF.position.set(0, 0.86, 0.03);
      scythe.add(eyeF);
      const eyeB = makeGoddessDecal(0.09, 0.056, getGoddessRedEyeTexture());
      eyeB.position.set(0, 0.86, -0.03);
      eyeB.rotation.y = Math.PI;
      scythe.add(eyeB);

      // Curved blade - a fan of tapering slabs following a circular arc in
      // the Y/Z plane, edge on the inner (concave) side.
      const R = 0.30, top = 1.0, cy = top - R;
      const N = 7, phiMax = 2.0;
      for (let i = 0; i < N; i++) {
        const p0 = i / N * phiMax, p1 = (i + 1) / N * phiMax, pm = (p0 + p1) / 2;
        const segLen = R * (p1 - p0) * 1.08;
        const wdt = 0.085 * (1 - i / N) + 0.014;
        const rMid = R - wdt / 2;
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.014, wdt, segLen), bladeMat);
        seg.position.set(0, cy + rMid * Math.cos(pm), rMid * Math.sin(pm));
        seg.rotation.x = pm;
        seg.castShadow = true;
        scythe.add(seg);
        const spine = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, segLen), crimsonMat);
        spine.position.set(0, cy + (R - 0.006) * Math.cos(pm), (R - 0.006) * Math.sin(pm));
        spine.rotation.x = pm;
        scythe.add(spine);
      }
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.09, 4), glowMat);
      tip.position.set(0, cy + R * Math.cos(phiMax), R * Math.sin(phiMax));
      tip.rotation.x = phiMax + Math.PI / 2;
      scythe.add(tip);
      return scythe;
    }

    function createGoddessHandGlow() {
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.5, depthWrite: false })
      );
      glow.position.set(0, -0.03, 0.04);
      return glow;
    }

    // Builds the Goddess's body: the standard blocky humanoid rig, dressed
    // up with pale skin, hair, no face, red eye hairpins,
    // near-black arms with red eye markings, a flared dress and wings.
    function createGoddessOfDeathHumanoid(isEnemy = false) {
      const unit = createBlockyHumanoid(0x1a1119, isEnemy, 0x1b1420);
      const u = unit.userData;
      const body = u.body, head = u.head;

      const paleMat = new THREE.MeshLambertMaterial({ color: 0xece4ee });
      const hairMat = new THREE.MeshLambertMaterial({ color: 0xf4f2fa });
      const darkMat = new THREE.MeshLambertMaterial({ color: 0x140d15 });
      const crimsonMat = new THREE.MeshLambertMaterial({ color: 0xa3122a });
      const redEyeTex = getGoddessRedEyeTexture();

      // --- head ---
      head.material = paleMat;
      // No face - the head is left blank (pale skin under the hair).

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.336, 0.1, 0.336), hairMat);
      cap.position.set(0, 0.155, 0);
      const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.336, 0.3, 0.04), hairMat);
      backHair.position.set(0, 0.0, -0.165);
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.34), hairMat);
      sideL.position.set(-0.165, 0.03, 0);
      const sideR = sideL.clone();
      sideR.position.x = 0.165;
      const bangL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.03), hairMat);
      bangL.position.set(-0.085, 0.105, 0.16); bangL.rotation.z = 0.18;
      const bangR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.03), hairMat);
      bangR.position.set(0.09, 0.108, 0.16); bangR.rotation.z = -0.15;
      head.add(cap, backHair, sideL, sideR, bangL, bangR);

      // Red eye-shaped hairpins at the temples
      const pinL = makeGoddessDecal(0.075, 0.048, redEyeTex);
      pinL.position.set(-0.182, 0.085, 0.06); pinL.rotation.y = -Math.PI / 2;
      const pinR = makeGoddessDecal(0.075, 0.048, redEyeTex);
      pinR.position.set(0.182, 0.085, 0.06); pinR.rotation.y = Math.PI / 2;
      head.add(pinL, pinR);

      // --- torso ---
      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.006), paleMat);
      chest.position.set(0, 0.165, 0.112);
      body.add(chest);
      [-0.05, -0.12].forEach(y => {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.353, 0.02, 0.223), crimsonMat);
        stripe.position.set(0, y, 0);
        body.add(stripe);
      });
      const brooch = makeGoddessDecal(0.09, 0.056, redEyeTex);
      brooch.position.set(0, 0.06, 0.1135);
      body.add(brooch);
      [-1, 1].forEach(sd => {
        const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.16), darkMat);
        pauldron.position.set(sd * 0.2, 0.225, 0);
        body.add(pauldron);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.012, 0.162), crimsonMat);
        trim.position.set(sd * 0.2, 0.25, 0);
        body.add(trim);
        const lock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.36, 0.03), hairMat);
        lock.position.set(sd * 0.115, 0.03, 0.127);
        body.add(lock);
      });

      // Knee-length hair streaming down the back
      const hairBack = new THREE.Group();
      hairBack.position.set(0, 0.335, -0.14);
      const hUpper = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.40, 0.05), hairMat);
      hUpper.position.y = -0.20;
      const hMid = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.20, 0.045), hairMat);
      hMid.position.y = -0.50;
      const hTip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.04), hairMat);
      hTip.position.y = -0.66;
      hairBack.add(hUpper, hMid, hTip);
      body.add(hairBack);

      // --- arms: near-black with red eye patterns ---
      const armMat = new THREE.MeshLambertMaterial({ color: 0x140d15 });
      [[u.meshArmL, -1], [u.meshArmR, 1]].forEach(([mesh, sd]) => {
        mesh.material = armMat;
        [-0.1, 0.07].forEach(y => {
          const front = makeGoddessDecal(0.075, 0.048, redEyeTex);
          front.position.set(0, y, 0.0615);
          mesh.add(front);
          const side = makeGoddessDecal(0.075, 0.048, redEyeTex);
          side.position.set(sd * 0.0615, y + 0.02, 0);
          side.rotation.y = sd * Math.PI / 2;
          mesh.add(side);
        });
        const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.13), crimsonMat);
        cuff.position.y = -0.18;
        mesh.add(cuff);
      });

      // --- dress skirt (open cone so legs swing freely inside it) ---
      const skirtMat = new THREE.MeshLambertMaterial({ color: 0x140b14, side: THREE.DoubleSide });
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.31, 0.27, 10, 1, true), skirtMat);
      skirt.position.set(0, 0.245, 0);
      unit.add(skirt);
      const hem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.301, 0.313, 0.03, 10, 1, true),
        new THREE.MeshLambertMaterial({ color: 0xa3122a, side: THREE.DoubleSide })
      );
      hem.position.set(0, 0.125, 0);
      unit.add(hem);
      const belt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.195, 0.2, 0.03, 10, 1, true),
        new THREE.MeshLambertMaterial({ color: 0xa3122a, side: THREE.DoubleSide })
      );
      belt.position.set(0, 0.375, 0);
      unit.add(belt);

      // --- wings ---
      const wingL = createGoddessWing(-1);
      const wingR = createGoddessWing(1);
      wingL.position.set(-0.07, 0.66, -0.15);
      wingR.position.set(0.07, 0.66, -0.15);
      wingL.rotation.set(-0.2, -0.55, 0);
      wingR.rotation.set(-0.2, 0.55, 0);
      unit.add(wingL, wingR);

      u.goddess = { wingL, wingR, hairBack };
      u.goddessHandGlow = null;
      unit.scale.y = 1.08;
      return unit;
    }

    // Per-frame animation - walk, idle, wing/hair motion and the attack
    // pose. Called from updateUnitAnims for unitType 'goddessOfDeath'.
    function updateGoddessAnim(unit, time, delta) {
      const u = unit.userData;
      const g = u.goddess;
      const ph = u.idlePhase || 0;
      const attacking = u.attackAnimTimer > 0;
      let cycle = 0;

      if (u.isWalking) {
        u.walkTimer += delta * 9;
        cycle = Math.sin(u.walkTimer);
        const legAngle = cycle * 0.5;
        u.legL.rotation.x = legAngle;
        u.legR.rotation.x = -legAngle;
        if (!attacking) {
          u.armR.rotation.set(-0.35 + cycle * 0.05, 0, -0.06);
          u.armL.rotation.set(-cycle * 0.35, 0, 0.1);
        }
        u.body.rotation.set(0.06, -cycle * 0.06, 0);
        u.head.rotation.set(-0.03, 0, 0);
        const bob = Math.abs(cycle) * 0.02;
        u.body.position.y = 0.525 + bob;
        u.head.position.y = 0.9 + bob;
      } else {
        u.walkTimer = 0;
        u.legL.rotation.x = Math.sin(time * 0.6 + ph) * 0.03;
        u.legR.rotation.x = -Math.sin(time * 0.6 + ph) * 0.03;
        const breath = Math.sin(time * 2 + ph) * 0.02;
        u.body.position.y = 0.525 + breath;
        u.head.position.y = 0.9 + breath;
        u.body.rotation.set(0.02, Math.sin(time * 0.5 + ph) * 0.05, 0);
        u.head.rotation.set(0.03, Math.sin(time * 0.35 + ph) * 0.18, 0);
        if (!attacking) {
          u.armR.rotation.set(-0.35 + breath, 0, -0.06);
          u.armL.rotation.set(-0.15 + Math.sin(time * 0.8 + ph) * 0.05, 0, 0.12);
        }
      }

      // Wings breathe slowly and spread a little wider while moving; hair
      // streams backward on the march and sways gently at rest.
      if (g) {
        const flutter = Math.sin(time * 1.6 + ph);
        const spread = u.isWalking ? 0.12 : 0;
        g.wingR.rotation.y = 0.55 + spread + flutter * 0.04;
        g.wingL.rotation.y = -0.55 - spread - flutter * 0.04;
        g.wingR.userData.inner.rotation.z = -flutter * 0.06;
        g.wingL.userData.inner.rotation.z = flutter * 0.06;
        g.hairBack.rotation.x = (u.isWalking ? 0.2 : 0.04) + Math.sin(time * 1.3 + ph) * 0.03 + cycle * 0.03;
        g.hairBack.rotation.z = Math.sin(time * 0.9 + ph) * 0.03;
      }
      if (u.goddessHandGlow) {
        const pulse = 0.85 + Math.sin(time * 3 + ph) * 0.2;
        u.goddessHandGlow.scale.setScalar(pulse);
      }

      if (attacking) {
        applyAttackPose(unit);
      } else if (u.weaponMesh) {
        u.weaponMesh.rotation.x = GODDESS_SCYTHE_REST_TILT;
        u.weaponMesh.scale.setScalar(1);
        u.handR.rotation.x = 0;
      }
    }

    // --- Goddess passives -------------------------------------------------
    function spawnGoddessRing(pos, facing, inner, outer, arc, duration, grow, opacity, color = 0xff2a55) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
      const geo = arc >= Math.PI * 2
        ? new THREE.RingGeometry(inner, outer, 28)
        : new THREE.RingGeometry(inner, outer, 28, 1, -Math.PI, arc);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      const grp = new THREE.Group();
      grp.add(mesh);
      grp.position.set(pos.x, pos.y + 0.06, pos.z);
      grp.rotation.y = facing;
      scene.add(grp);
      activeGraspFX.push({ mesh: grp, mats: [mat], age: 0, duration, kind: 'ring', grow, baseOpacity: opacity });
    }

    // Soul Harvest - every enemy she kills restores part of her max HP.
    function goddessHarvestSouls(unit, victims, attackerWorldPos) {
      const u = unit.userData;
      if (u.hp <= 0) return;
      let kills = 0;
      victims.forEach(v => { if (v.userData.hp <= 0) kills++; });
      if (!kills) return;
      if (u.hp < u.maxHp) {
        healUnit(unit, u.maxHp * GODDESS_SOUL_HARVEST_HEAL_PCT * kills);
        spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 1.15, 0)), 'SOUL HARVEST!', '#ff88aa');
      }
      for (let i = 0; i < 6 * kills; i++) {
        spawnParticle(attackerWorldPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5)), i % 2 ? 0xffffff : 0xff3355, 0.06, 0.8);
      }
    }

    // Reaper's Sweep - a wide crescent slash that hits everything in a
    // frontal arc. Returns false if nothing was caught so the caller can
    // fall back to a normal single strike.
    function goddessReapersSweep(unit, targets, attackerWorldPos, dmg) {
      const u = unit.userData;
      const facing = unit.rotation.y + unit.parent.rotation.y;
      const fwdX = Math.sin(facing), fwdZ = Math.cos(facing);
      const hit = [];
      targets.forEach(t => {
        if (t.userData.hp <= 0 || t.userData.unitType === 'valkyrie') return;
        const tp = new THREE.Vector3();
        t.getWorldPosition(tp);
        const dx = tp.x - attackerWorldPos.x, dz = tp.z - attackerWorldPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > GODDESS_SWEEP_RADIUS) return;
        if (dx * fwdX + dz * fwdZ < -0.25) return;
        hit.push({ t, tp, dx, dz, dist });
      });
      if (hit.length === 0) return false;

      u.attackAnimPoseOverride = 'reaperSweep';
      u.attackAnimDuration = GODDESS_SWEEP_ANIM_DURATION;
      u.attackAnimTimer = GODDESS_SWEEP_ANIM_DURATION;
      spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), "REAPER'S SWEEP!", '#ff3355');
      spawnGoddessRing(attackerWorldPos, facing, GODDESS_SWEEP_RADIUS * 0.55, GODDESS_SWEEP_RADIUS, Math.PI, 0.45, 0.25, 0.55);

      hit.forEach(h => {
        applyDamage(h.t, dmg * GODDESS_SWEEP_DAMAGE_MULT, 'goddessOfDeath', attackerWorldPos, unit);
        if (h.t.userData.hp > 0) {
          const inv = h.dist > 0.001 ? 1 / h.dist : 0;
          h.t.userData.knockbackVel.add(new THREE.Vector3(h.dx * inv, 0, h.dz * inv).multiplyScalar(GODDESS_SWEEP_KNOCKBACK));
          h.t.userData.stunTimer = Math.max(h.t.userData.stunTimer, 0.3);
        }
        spawnParticle(h.tp.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xff2a55, 0.14, 0.5);
      });
      goddessHarvestSouls(unit, hit.map(h => h.t), attackerWorldPos);
      return true;
    }

    // Main melee entry point, called from processUnitAttack.
    function goddessStrike(unit, targets, bestTarget, attackerWorldPos) {
      const u = unit.userData;
      const dmg = GODDESS_BASE_DMG * (u.dmgMultiplier || 1);
      if (Math.random() < GODDESS_SWEEP_CHANCE && goddessReapersSweep(unit, targets, attackerWorldPos, dmg)) return;

      const td = bestTarget.userData;
      const above = attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0));
      if (td.maxHp && td.hp / td.maxHp <= GODDESS_DECREE_THRESHOLD) {
        // Death's Decree - a wounded enemy simply ceases to be. Uses the same
        // lethal-bypass attacker type as Assassinate/Charge/Deathblow.
        spawnFloatingText(above, "DEATH'S DECREE!", '#ff2255');
        applyDamage(bestTarget, 9999, 'cavalryCharge', attackerWorldPos, unit);
      } else {
        applyDamage(bestTarget, dmg, 'goddessOfDeath', attackerWorldPos, unit);
      }
      goddessHarvestSouls(unit, [bestTarget], attackerWorldPos);
    }

    // Nearest living raider (on land, not a Demon or Scarecrow) within range of a point -
    // the vessel for Soul Vessel. Returns null if there is none.
    function findGoddessHost(pos) {
      let best = null, bestD = GODDESS_POSSESS_RANGE;
      raiderSquads.forEach(sq => sq.members.forEach(m => {
        const md = m.userData;
        if (!md || md.hp <= 0 || md.isDemon || md.isScarecrow || md.goddessPossessed) return;
        if (m.parent && m.parent.userData && m.parent.userData.onBoat) return;
        const mp = new THREE.Vector3();
        m.getWorldPosition(mp);
        const d = Math.hypot(mp.x - pos.x, mp.z - pos.z);
        if (d < bestD) { bestD = d; best = m; }
      }));
      return best;
    }

    // Removes the aura and clears the flag without any explosion - used when a
    // possession is cancelled (run reset, squad already replaced).
    function cancelGoddessPossession(p) {
      if (p.aura && p.host) p.host.remove(p.aura);
      if (p.host && p.host.userData) p.host.userData.goddessPossessed = false;
      if (p.unit && p.unit.userData.hpElement) p.unit.userData.hpElement.remove();
    }

    // Soul Vessel - the Goddess dies, but her soul flows into a nearby raider.
    // For GODDESS_POSSESS_DURATION seconds that raider is possessed (it stops
    // attacking, glowing crimson); then its body explodes and she rises from
    // the blast. If the host is killed early the blast happens right then.
    function beginGoddessPossession(unit, squad, host, pos) {
      const hd = host.userData;
      hd.goddessPossessed = true;
      const aura = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xff2a55, transparent: true, opacity: 0.28, depthWrite: false })
      );
      aura.position.y = 0.5;
      host.add(aura);

      const hostPos = new THREE.Vector3();
      host.getWorldPosition(hostPos);
      spawnFloatingText(pos.clone().add(new THREE.Vector3(0, 1.0, 0)), 'Her soul escapes...', '#ff88aa');
      spawnFloatingText(hostPos.clone().add(new THREE.Vector3(0, 1.0, 0)), 'POSSESSED!', '#ff2a55');
      // A stream of soul-light flowing from where she fell into the host.
      for (let i = 0; i < 18; i++) {
        const f = i / 18;
        spawnParticle(
          new THREE.Vector3(pos.x + (hostPos.x - pos.x) * f, pos.y + 0.6 + Math.sin(f * Math.PI) * 0.6, pos.z + (hostPos.z - pos.z) * f),
          i % 2 ? 0xffffff : 0xff3355, 0.07, 0.6 + f * 0.6
        );
      }
      goddessPossessions.push({
        unit, squad, host, aura,
        timer: GODDESS_POSSESS_DURATION,
        lastPos: hostPos.clone(),
        deathPos: pos.clone(),
        wispTimer: 0,
        lastSecond: -1
      });
    }

    // Per-frame: keep hosts subdued and pulsing, count down, then finish.
    function updateGoddessPossessions(delta, time) {
      for (let i = goddessPossessions.length - 1; i >= 0; i--) {
        const p = goddessPossessions[i];
        const hd = p.host.userData;
        if (!squads.includes(p.squad)) {
          // Run was reset / squads rebuilt - nothing left to revive into.
          cancelGoddessPossession(p);
          goddessPossessions.splice(i, 1);
          continue;
        }
        if (hd.hp > 0 && p.host.parent) {
          p.host.getWorldPosition(p.lastPos);
          hd.attackCooldown = Math.max(hd.attackCooldown || 0, 0.5); // possessed - it will not attack
          p.aura.material.opacity = 0.26 + Math.sin(time * 8) * 0.1;
          p.aura.scale.setScalar(1 + Math.sin(time * 6) * 0.08);
          p.wispTimer -= delta;
          if (p.wispTimer <= 0) {
            p.wispTimer = 0.25;
            spawnParticle(
              p.lastPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4)),
              Math.random() < 0.5 ? 0xff3355 : 0xffffff, 0.06, 0.7
            );
          }
          p.timer -= delta;
          const secLeft = Math.ceil(p.timer);
          if (secLeft <= 3 && secLeft > 0 && secLeft !== p.lastSecond) {
            p.lastSecond = secLeft;
            spawnFloatingText(p.lastPos.clone().add(new THREE.Vector3(0, 1.25, 0)), String(secLeft), '#ff88aa');
          }
          if (p.timer > 0) continue;
        }
        goddessPossessions.splice(i, 1);
        finishGoddessPossession(p);
      }
    }

    // The host's body explodes and the Goddess rises from it.
    function finishGoddessPossession(p) {
      const { unit, squad, host } = p;
      const u = unit.userData;
      const hd = host.userData;
      const pos = p.lastPos.clone();

      if (p.aura) host.remove(p.aura);
      hd.goddessPossessed = false;

      // --- the host's body bursts ---
      const burstCols = [0xff2a55, 0xc81e3c, 0xffffff, 0x1a0f18, 0xaa1122];
      for (let i = 0; i < 34; i++) {
        spawnParticle(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4)),
          burstCols[i % burstCols.length], 0.08 + Math.random() * 0.1, 0.5 + Math.random() * 0.6, i % 3 === 0);
      }
      spawnParticle(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xffffcc, 0.3, 0.15);
      spawnGoddessRing(pos, 0, 0.3, 0.8, Math.PI * 2, 0.6, 3.2, 0.7);
      spawnFloatingText(pos.clone().add(new THREE.Vector3(0, 1.0, 0)), 'SOUL BURST!', '#ff3355');

      if (hd.hp > 0 && host.parent) {
        hd.hp = 0;
        if (hd.hpFillElement) hd.hpFillElement.style.width = '0%';
        if (hd.hpElement) hd.hpElement.remove();
        raiderSquads.forEach(sq => {
          const idx = sq.members.indexOf(host);
          if (idx !== -1) sq.members.splice(idx, 1);
        });
        updateWaveUI();
        awardRaiderKillLoot(pos);
        host.parent.remove(host);
      }

      // --- she rises ---
      if (squad.members.length > 0) {
        // The squad slot was already refilled some other way - no room to return.
        cancelGoddessPossession({ unit });
        return;
      }
      let wp = new THREE.Vector3(pos.x, pos.y, pos.z);
      const surfY = getSurfaceY(pos.x, pos.z);
      if (surfY === null) wp = p.deathPos.clone(); else wp.y = surfY;
      squad.group.updateMatrixWorld(true);
      unit.position.copy(squad.group.worldToLocal(wp.clone()));
      squad.group.add(unit);
      unit.visible = true;

      u.hp = Math.max(1, Math.round(u.maxHp * GODDESS_REVIVE_HP_PCT));
      u.attackCooldown = 0.6;
      u.attackAnimTimer = 0;
      u.attackAnimPoseOverride = null;
      u.stunTimer = 0;
      u.absorbShield = 0;
      if (u.knockbackVel) u.knockbackVel.set(0, 0, 0);
      if (u.hpElement) u.hpElement.style.display = '';
      if (u.hpFillElement) u.hpFillElement.style.width = Math.max(0, (u.hp / u.maxHp) * 100) + '%';
      squad.members.push(unit);
      updateSquadCountUI();
      if (squads[selectedSquadIndex] === squad && squad.ring) squad.ring.visible = true;

      const cols = [0xffffff, 0xf3f1fa, 0xc81e3c, 0x1a0f18];
      for (let i = 0; i < 40; i++) {
        spawnParticle(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.1 + Math.random() * 1.0, (Math.random() - 0.5) * 0.5)),
          cols[i % 4], 0.05 + Math.random() * 0.09, 0.7 + Math.random() * 0.8);
      }
      spawnFloatingText(pos.clone().add(new THREE.Vector3(0, 1.25, 0)), 'THE GODDESS RISES!', '#ff88aa');

      // The soul-blast hurts every raider caught in it; she feeds on any that die.
      const victims = [];
      raiderSquads.forEach(sq => sq.members.slice().forEach(m => {
        if (m.userData.hp <= 0) return;
        const mp = new THREE.Vector3();
        m.getWorldPosition(mp);
        if (mp.distanceTo(pos) <= GODDESS_POSSESS_BLAST_RADIUS) victims.push(m);
      }));
      victims.forEach(m => applyDamage(m, GODDESS_POSSESS_BLAST_DAMAGE * (u.dmgMultiplier || 1), 'goddessOfDeath', pos, unit));
      goddessHarvestSouls(unit, victims, pos);
    }

    // Death - she dissolves into white and crimson petals rather than a
    // ragdoll. With a raider nearby she has a 35% chance to possess it
    // instead (see beginGoddessPossession) and come back. Also removes her
    // from the squad lists, like killUnit does.
    function goddessDeath(unit, attackerWorldPos) {
      const u = unit.userData;
      u.hp = 0;
      const pos = new THREE.Vector3();
      unit.getWorldPosition(pos);

      const squad = isEnemyUnit(unit) ? null : (squads.find(sq => sq.members.includes(unit)) || null);
      const host = (squad && Math.random() < GODDESS_POSSESS_CHANCE) ? findGoddessHost(pos) : null;

      if (host) {
        // Keep her HP bar element alive (hidden) so it can return on revival.
        if (u.hpElement) u.hpElement.style.display = 'none';
        beginGoddessPossession(unit, squad, host, pos);
      } else {
        if (u.hpElement) u.hpElement.remove();
        const cols = [0xffffff, 0xf3f1fa, 0xc81e3c, 0x1a0f18];
        for (let i = 0; i < 46; i++) {
          spawnParticle(
            pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.15 + Math.random() * 0.9, (Math.random() - 0.5) * 0.5)),
            cols[i % 4], 0.05 + Math.random() * 0.1, 0.7 + Math.random() * 0.9
          );
        }
        spawnGoddessRing(pos, 0, 0.2, 0.5, Math.PI * 2, 0.8, 4, 0.6);
        spawnFloatingText(pos.clone().add(new THREE.Vector3(0, 1.0, 0)), 'The Goddess falls...', '#ff88aa');
      }

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

    // =====================================================================
    // GODDESS OF LIFE - Exclusive singleton squad (appearance inspired by
    // Columbina, the Moon Maiden, from Genshin Impact: a pale young
    // goddess with long snow-white hair tipped in pale blue and gathered
    // into one thick braid over her shoulder, dove-wing feathers at the
    // back of her head, a blank faceless head like the Goddess of
    // Death's, a flowing white and indigo gown with long hanging shoulder panels, a
    // blue crescent gem at the chest, white ribbon bows at the wrists and
    // ankles, bare feet and white feathered wings).
    // She is the gentle counterpart of the Goddess of Death above: where
    // that squad reaps, this one heals, shields and raises the fallen.
    // Everything specific to her lives in this block plus the small hooks
    // marked "Goddess of Life" elsewhere (CLASS_DEFS entry,
    // createSquadMemberVisual, equipUnit, applySquadLevelStats,
    // applyAttackPose, processUnitAttack, updateCombatSystem,
    // maybeTriggerImmortalResurrection/applyDamage, killUnit/
    // startDeathSequence/dropWeapon and the Recruit Shop banner lists).
    // =====================================================================
    const GOLIFE_BASE_DMG = 24;               // matches CLASS_DEFS.goddessOfLife.baseDmg
    const GOLIFE_HP_MULT = 4.5;               // 450 HP before squad upgrade level
    const GOLIFE_STAFF_REST_TILT = 0.3;
    // Lightbringer Wave: a wave of holy light that damages, knocks back and stuns
    // every enemy close to her.
    const GOLIFE_WAVE_INTERVAL = 7;           // seconds between waves
    const GOLIFE_WAVE_RADIUS = 3.5;           // world units
    const GOLIFE_WAVE_KNOCKBACK = 2.6;        // shove strength, away from her
    const GOLIFE_WAVE_STUN = 2.0;             // seconds a hit enemy cannot attack
    const GOLIFE_WAVE_DAMAGE = 36;            // damage to each enemy hit, before squad upgrade multiplier
    // Gentle Touch: every staff strike also mends the most wounded ally near her.
    const GOLIFE_TOUCH_PCT = 0.12;            // fraction of that ally's max HP
    const GOLIFE_TOUCH_RANGE = 6.0;           // world units
    // Cradle of Life: raises one fallen member of an allied squad.
    const GOLIFE_CRADLE_INTERVAL = 12;        // seconds between revives
    // Second Dawn: she rises again when she would fall.
    const GOLIFE_REBIRTH_RADIUS = 6.0;        // world units the rebirth burst mends
    const GOLIFE_REBIRTH_HP_PCT = 0.6;        // HP she returns with
    const GOLIFE_REBIRTH_SHIELD_PCT = 0.25;   // moonlight shield on rebirth, as a fraction of max HP
    const GOLIFE_REBIRTH_HEAL_PCT = 0.35;     // heal the rebirth burst gives nearby wounded allies
    const GOLIFE_REBIRTH_COOLDOWN = 90;       // seconds before Second Dawn can trigger again
    const GOLIFE_BLESS_ANIM_DURATION = 0.9;   // arms-raised blessing gesture

    // Squad icon - drawn as an SVG data URI so no external image is needed.
// Thick braid over the right shoulder, drawn as a chain of woven links.
    function goLifeBraidSvg() {
      const pts = [[85, 67], [88, 76], [89, 86], [88, 96], [86, 105]];
      let out = '';
      pts.forEach((p, i) => {
        out += `<ellipse cx='${p[0]}' cy='${p[1]}' rx='${6.4 - i * 0.35}' ry='6' fill='${i % 2 ? '#dfe9ff' : '#ffffff'}' stroke='#8ea6e0' stroke-width='1' transform='rotate(${i % 2 ? -14 : 14} ${p[0]} ${p[1]})'/>`;
      });
      out += `<ellipse cx='85' cy='113' rx='4.6' ry='5.4' fill='#8fc3ff' stroke='#5f93d6' stroke-width='1'/>`;
      out += `<path d='M81 82 L93 92 M93 82 L81 92' stroke='#5f93d6' stroke-width='2.2' stroke-linecap='round'/>`;
      return out;
    }
    // Soft rays of golden light fanning out behind her (Lightbringer Wave).
    function goLifeRaysSvg() {
      let out = '';
      for (let i = 0; i < 12; i++) {
        const a0 = (i * 30 - 6) * Math.PI / 180, a1 = (i * 30 + 6) * Math.PI / 180;
        const r = 110;
        out += `<path d='M64 52 L${(64 + Math.cos(a0) * r).toFixed(1)} ${(52 + Math.sin(a0) * r).toFixed(1)} L${(64 + Math.cos(a1) * r).toFixed(1)} ${(52 + Math.sin(a1) * r).toFixed(1)} Z'/>`;
      }
      return out;
    }
    const GOLIFE_ICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
      <defs>
        <radialGradient id='bg' cx='50%' cy='40%' r='75%'><stop offset='0' stop-color='#3a4cb8'/><stop offset='0.5' stop-color='#171d5c'/><stop offset='1' stop-color='#05071c'/></radialGradient>
        <radialGradient id='glow' cx='50%' cy='40%' r='50%'><stop offset='0' stop-color='#fff2c0' stop-opacity='0.55'/><stop offset='1' stop-color='#fff2c0' stop-opacity='0'/></radialGradient>
        <linearGradient id='wing' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffffff'/><stop offset='1' stop-color='#a9bcf0'/></linearGradient>
        <linearGradient id='hair' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffffff'/><stop offset='0.65' stop-color='#e4edff'/><stop offset='1' stop-color='#8fc3ff'/></linearGradient>
        <mask id='cm'><rect width='128' height='128' fill='white'/><circle cx='113' cy='20' r='13' fill='black'/></mask>
      </defs>
      <rect width='128' height='128' fill='url(#bg)'/>
      <g fill='#fff2c0' opacity='0.13'>${goLifeRaysSvg()}</g>
      <circle cx='64' cy='52' r='50' fill='url(#glow)'/>
      <g fill='#ffffff' opacity='0.85'><circle cx='14' cy='16' r='1.3'/><circle cx='28' cy='8' r='0.9'/><circle cx='118' cy='70' r='1.1'/><circle cx='8' cy='54' r='0.9'/><circle cx='104' cy='100' r='0.9'/><circle cx='20' cy='96' r='1'/></g>
      <circle cx='104' cy='22' r='14' fill='#e6ecff' mask='url(#cm)'/>
      <g fill='none' stroke='#fff2c0' stroke-linecap='round'>
        <circle cx='64' cy='50' r='34' stroke-width='1.8' opacity='0.9'/>
        <circle cx='64' cy='50' r='38.5' stroke-width='0.8' opacity='0.6' stroke-dasharray='2 5'/>
      </g>
      <g fill='url(#wing)' stroke='#7f93dc' stroke-width='1.3' stroke-linejoin='round'>
        <path d='M52 76 C30 74 8 58 4 26 C20 34 34 40 44 54 Z'/>
        <path d='M52 86 C28 90 6 82 2 58 C18 64 34 66 46 70 Z'/>
        <path d='M54 96 C34 106 14 104 8 88 C22 90 36 88 48 84 Z'/>
        <path d='M76 76 C98 74 120 58 124 26 C108 34 94 40 84 54 Z'/>
        <path d='M76 86 C100 90 122 82 126 58 C110 64 94 66 82 70 Z'/>
        <path d='M74 96 C94 106 114 104 120 88 C106 90 92 88 80 84 Z'/>
      </g>
      <path d='M64 14 C30 16 24 62 30 108 L38 128 L90 128 L98 108 C104 62 98 16 64 14 Z' fill='url(#hair)' stroke='#9fb6ea' stroke-width='1.2'/>
      <path d='M34 128 Q40 92 64 88 Q88 92 94 128 Z' fill='#f5f6fd' stroke='#9fb6ea' stroke-width='1'/>
      <path d='M52 92 L46 128 L60 128 L62 94 Z' fill='#2c3a94'/>
      <path d='M76 92 L82 128 L68 128 L66 94 Z' fill='#2c3a94'/>
      <ellipse cx='64' cy='58' rx='18' ry='22' fill='#f8eeeb'/>
      <path d='M45 52 C46 27 82 27 83 52 C77 42 70 38 64 43 C58 38 51 42 45 52 Z' fill='#f4f7ff' stroke='#b9cdf2' stroke-width='0.8'/>
      <path d='M53 34 C51 40 49 44 48 49' stroke='#8fc3ff' stroke-width='2.4' fill='none' stroke-linecap='round'/>
      <path d='M75 34 C77 40 79 44 80 49' stroke='#8fc3ff' stroke-width='2.4' fill='none' stroke-linecap='round'/>
      <g fill='#cfe4ff' stroke='#7f93dc' stroke-width='0.8'>
        <path d='M42 44 L30 28 L47 36 Z'/><path d='M40 50 L26 40 L44 43 Z'/>
        <path d='M86 44 L98 28 L81 36 Z'/><path d='M88 50 L102 40 L84 43 Z'/>
      </g>
      ${goLifeBraidSvg()}
      <ellipse cx='58' cy='88' rx='6' ry='3' fill='#ffffff' stroke='#9aa6e0' stroke-width='0.8'/><ellipse cx='70' cy='88' rx='6' ry='3' fill='#ffffff' stroke='#9aa6e0' stroke-width='0.8'/>
      <circle cx='64' cy='88' r='2.2' fill='#2c3a94'/>
      <path d='M60 98 a6.5 6.5 0 1 0 8.5 6 a5 5 0 1 1 -8.5 -6 Z' fill='#8fd0ff' stroke='#dff2ff' stroke-width='0.8'/>
    </svg>`;
    const GOLIFE_ICON_URI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(GOLIFE_ICON_SVG);

    // Kitsune Twinblade icon - replaces the plain 🦊 emoji everywhere the
    // squad's icon is shown (Gacha, Manage Squad, Squad Info, Raiders-style
    // banners). A fox mask with the pair's two blades crossed behind it -
    // Ember Fang's crimson blade and Frost Warden's icy blade - split-toned
    // to represent both members of this 2-unit squad in one icon.
    const KITSUNE_ICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
      <defs>
        <linearGradient id='kbg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#5a0f1c'/><stop offset='0.5' stop-color='#241018'/><stop offset='1' stop-color='#0c2430'/></linearGradient>
        <linearGradient id='kbladeA' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ffe3c2'/><stop offset='1' stop-color='#e8b06a'/></linearGradient>
        <linearGradient id='kbladeB' x1='0' y1='1' x2='1' y2='0'><stop offset='0' stop-color='#dff2ff'/><stop offset='1' stop-color='#9fd3ec'/></linearGradient>
      </defs>
      <rect width='128' height='128' fill='url(#kbg)'/>
      <g>
        <path d='M6 118 L84 8 L94 14 L18 126 Z' fill='url(#kbladeA)' stroke='#3a0d10' stroke-width='2'/>
        <path d='M6 118 L18 126 L2 128 Z' fill='#b5202a' stroke='#3a0d10' stroke-width='2'/>
        <rect x='2' y='108' width='22' height='9' rx='2' transform='rotate(-42 13 112)' fill='#7a1420' stroke='#3a0d10' stroke-width='2'/>
      </g>
      <g>
        <path d='M122 118 L44 8 L34 14 L110 126 Z' fill='url(#kbladeB)' stroke='#0e2b38' stroke-width='2'/>
        <path d='M122 118 L110 126 L126 128 Z' fill='#3d6fa8' stroke='#0e2b38' stroke-width='2'/>
        <rect x='104' y='108' width='22' height='9' rx='2' transform='rotate(42 115 112)' fill='#294f74' stroke='#0e2b38' stroke-width='2'/>
      </g>
      <path d='M27 40 L49 -2 L68 44 Z' fill='#f2ece2' stroke='#2a1416' stroke-width='2' stroke-linejoin='round'/>
      <path d='M36 36 L49 8 L61 40 Z' fill='#e8899a'/>
      <path d='M101 40 L79 -2 L60 44 Z' fill='#f2ece2' stroke='#16232c' stroke-width='2' stroke-linejoin='round'/>
      <path d='M92 36 L79 8 L67 40 Z' fill='#9fd3ec'/>
      <path d='M64 32 C40 32 32 55 37 77 C40 92 51 104 64 104 C77 104 88 92 91 77 C96 55 88 32 64 32 Z' fill='#f7f1e6' stroke='#2a1416' stroke-width='2'/>
      <path d='M50 79 C50 68 58 62 64 62 C70 62 78 68 78 79 C78 91 70 97 64 97 C58 97 50 91 50 79 Z' fill='#fffaf7'/>
      <path d='M64 83 L57 74 L71 74 Z' fill='#2a1416'/>
      <path d='M36 68 Q28 70 27 78' stroke='#b5202a' stroke-width='3.4' fill='none' stroke-linecap='round'/>
      <path d='M40 74 Q33 77 32 84' stroke='#b5202a' stroke-width='2.6' fill='none' stroke-linecap='round'/>
      <path d='M92 68 Q100 70 101 78' stroke='#3d6fa8' stroke-width='3.4' fill='none' stroke-linecap='round'/>
      <path d='M88 74 Q95 77 96 84' stroke='#3d6fa8' stroke-width='2.6' fill='none' stroke-linecap='round'/>
      <path d='M44 61 Q53 53 61 61 Q53 67 44 61Z' fill='#f7b733' stroke='#7a4d08' stroke-width='1'/>
      <path d='M50 61 L58 58 L56 64Z' fill='#170c08'/>
      <path d='M84 61 Q75 53 67 61 Q75 67 84 61Z' fill='#f7b733' stroke='#7a4d08' stroke-width='1'/>
      <path d='M78 61 L70 58 L72 64Z' fill='#170c08'/>
    </svg>`;
    const KITSUNE_ICON_URI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(KITSUNE_ICON_SVG);

    // Event Shop fragment icons (Goddess of Death / Goddess of Life) -
    // separate from GODDESS_ICON_URI/GOLIFE_ICON_URI above, which stay on
    // the hand-drawn SVG portraits used everywhere else (Gacha, Squad
    // Info, Raiders Index). These are their own supplied artwork, used
    // only for the two Fragment items in the Event Shop (see
    // EVENT_SHOP_ITEMS/renderEventShopPanel below).
    const EVENT_SHOP_DEATH_FRAGMENT_ICON_URI = 'data:image/png;base64,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';
    const EVENT_SHOP_LIFE_FRAGMENT_ICON_URI = 'data:image/png;base64,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';

    let goLifeCrescentTex = null;

    // Glowing blue crescent gem - worn at the chest.
    function getGoLifeCrescentTexture() {
      if (goLifeCrescentTex) return goLifeCrescentTex;
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      g.shadowColor = '#bfe6ff'; g.shadowBlur = 6;
      g.fillStyle = '#6ec3ff';
      g.beginPath(); g.arc(30, 32, 21, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(40, 27, 18, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
      g.beginPath(); g.arc(30, 32, 19, Math.PI * 0.62, Math.PI * 1.38); g.stroke();
      goLifeCrescentTex = new THREE.CanvasTexture(c);
      return goLifeCrescentTex;
    }

    // Feathered white wing - a fan of soft white and pale-blue feathers with
    // indigo tips. side: +1 = right wing, -1 = left wing.
    function createGoLifeWing(side) {
      const wing = new THREE.Group();
      const inner = new THREE.Group();
      wing.add(inner);
      const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf7f8ff });
      const blueMat = new THREE.MeshLambertMaterial({ color: 0xc3d1ff });
      const indigoMat = new THREE.MeshLambertMaterial({ color: 0x2c3a94 });
      const angles = [10, 26, 42, 58, 74, 90, 108];
      const lengths = [0.78, 0.76, 0.7, 0.62, 0.52, 0.42, 0.3];
      angles.forEach((deg, i) => {
        const f = new THREE.Group();
        f.rotation.z = -side * deg * Math.PI / 180;
        const len = lengths[i];
        const w = 0.085 - i * 0.006;
        const feather = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.016), i % 2 === 0 ? whiteMat : blueMat);
        feather.position.y = len / 2;
        feather.castShadow = true;
        f.add(feather);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(w * 0.5, 0.1, 4), indigoMat);
        tip.position.y = len + 0.04;
        tip.rotation.y = Math.PI / 4;
        f.add(tip);
        inner.add(f);
      });
      wing.userData.inner = inner;
      wing.userData.side = side;
      return wing;
    }

    // Moon staff - built along +Y with the grip at the origin: a pale shaft
    // with indigo bands, topped by an open crescent moon cradling a glowing
    // pearl, with two white ribbons trailing from beneath it.
    function createMoonStaff() {
      const staff = new THREE.Group();
      const shaftMat = new THREE.MeshLambertMaterial({ color: 0xf1f2fb });
      const indigoMat = new THREE.MeshLambertMaterial({ color: 0x2c3a94 });
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xc8ecff });

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.2, 6), shaftMat);
      shaft.position.y = 0.3;
      shaft.castShadow = true;
      staff.add(shaft);
      [0.62, 0.04, -0.14].forEach(y => {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.024, 6), indigoMat);
        band.position.y = y;
        staff.add(band);
      });
      const foot = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.09, 6), indigoMat);
      foot.rotation.z = Math.PI;
      foot.position.y = -0.34;
      staff.add(foot);

      // Crescent head - a 280-degree arc of torus with the opening at the top.
      const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.02, 6, 24, Math.PI * 1.55), shaftMat);
      crescent.rotation.z = Math.PI * 0.725;
      crescent.position.y = 1.02;
      crescent.castShadow = true;
      staff.add(crescent);
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), glowMat);
      pearl.position.set(0, 1.03, 0);
      staff.add(pearl);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.3, depthWrite: false })
      );
      halo.position.copy(pearl.position);
      staff.add(halo);
      [-1, 1].forEach(sd => {
        const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.3, 0.004), shaftMat);
        ribbon.position.set(sd * 0.03, 0.76, 0);
        ribbon.rotation.z = sd * 0.12;
        staff.add(ribbon);
      });
      return staff;
    }

    function createGoLifeHandGlow() {
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.5, depthWrite: false })
      );
      glow.position.set(0, -0.03, 0.04);
      return glow;
    }

    // Builds the Goddess of Life's body: the standard blocky humanoid rig,
    // dressed with pale skin, long white hair tipped in pale blue, a blank
    // faceless head, a white and indigo gown, ribbon bows, a halo and wings.
    function createGoddessOfLifeHumanoid(isEnemy = false) {
      const unit = createBlockyHumanoid(0xf5f6fd, isEnemy, 0xf8eeeb);
      const u = unit.userData;
      const body = u.body, head = u.head;

      const skinMat = new THREE.MeshLambertMaterial({ color: 0xf8eeeb });
      const hairMat = new THREE.MeshLambertMaterial({ color: 0xeef2ff });
      const tipMat = new THREE.MeshLambertMaterial({ color: 0xa9d4ff });
      const braidMat = new THREE.MeshLambertMaterial({ color: 0xe0e8ff });
      const featherMat = new THREE.MeshLambertMaterial({ color: 0xcfe4ff });
      const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf5f6fd });
      const indigoMat = new THREE.MeshLambertMaterial({ color: 0x2c3a94 });
      const deepMat = new THREE.MeshLambertMaterial({ color: 0x1a2266 });

      // --- head: pale skin, white hair, pale-blue streaks, no face ---
      head.material = skinMat;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.336, 0.1, 0.336), hairMat);
      cap.position.set(0, 0.155, 0);
      const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.336, 0.3, 0.04), hairMat);
      backHair.position.set(0, 0, -0.165);
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.34), hairMat);
      sideL.position.set(-0.165, 0.11, 0);
      const sideR = sideL.clone();
      sideR.position.x = 0.165;
      const bangC = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.03), hairMat);
      bangC.position.set(0, 0.108, 0.16);
      const bangL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.03), hairMat);
      bangL.position.set(-0.1, 0.105, 0.16); bangL.rotation.z = 0.2;
      const bangR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.03), hairMat);
      bangR.position.set(0.1, 0.105, 0.16); bangR.rotation.z = -0.2;
      const streakL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.032), tipMat);
      streakL.position.set(-0.062, 0.108, 0.161);
      const streakR = streakL.clone();
      streakR.position.x = 0.062;
      head.add(cap, backHair, sideL, sideR, bangC, bangL, bangR, streakL, streakR);

      // No face - the head is left blank (pale skin under the hair), like the
      // Goddess of Death's.

      // Dove-wing feather ornaments at the back of the head.
      [-1, 1].forEach(sd => {
        const orn = new THREE.Group();
        orn.position.set(sd * 0.11, 0.1, -0.19);
        orn.rotation.y = -sd * 0.35;
        [0.16, 0.13, 0.1].forEach((len, k) => {
          const fg = new THREE.Group();
          fg.rotation.z = -sd * (0.25 + k * 0.4);
          const feather = new THREE.Mesh(new THREE.BoxGeometry(0.032, len, 0.008), featherMat);
          feather.position.y = len / 2;
          fg.add(feather);
          orn.add(fg);
        });
        head.add(orn);
      });

      // --- torso: white bodice top, indigo bodice band and sash ---
      const bodice = new THREE.Mesh(new THREE.BoxGeometry(0.356, 0.13, 0.226), indigoMat);
      bodice.position.set(0, -0.02, 0);
      const sash = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.23), deepMat);
      sash.position.set(0, -0.16, 0);
      body.add(bodice, sash);
      const gem = makeGoddessDecal(0.09, 0.09, getGoLifeCrescentTexture());
      gem.position.set(0, 0.115, 0.1135);
      body.add(gem);

      // Ribbon bow at the neck.
      const bowKnot = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.03), indigoMat);
      bowKnot.position.set(0, 0.212, 0.122);
      body.add(bowKnot);
      [-1, 1].forEach(sd => {
        const loop = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.02), whiteMat);
        loop.position.set(sd * 0.05, 0.215, 0.122);
        loop.rotation.z = sd * 0.35;
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.09, 0.012), whiteMat);
        tail.position.set(sd * 0.022, 0.15, 0.124);
        tail.rotation.z = sd * 0.15;
        body.add(loop, tail);
      });

      // One thick braid resting over the right shoulder, tied with a pale-blue
      // X-shaped ribbon and ending in a pale-blue tuft.
      const braid = new THREE.Group();
      braid.position.set(0.17, 0.2, 0.125);
      const braidWidths = [0.09, 0.085, 0.08, 0.07];
      braidWidths.forEach((w, i) => {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(w, 0.085, 0.07), i % 2 === 0 ? hairMat : braidMat);
        seg.position.y = -i * 0.08;
        braid.add(seg);
      });
      const braidTip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), tipMat);
      braidTip.position.y = -4 * 0.08 + 0.01;
      braid.add(braidTip);
      [0.7, -0.7].forEach(rz => {
        const x = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.014, 0.012), tipMat);
        x.position.set(0, -0.12, 0.038);
        x.rotation.z = rz;
        braid.add(x);
      });
      body.add(braid);

      // Long white hair streaming down the back with pale-blue strands and tips.
      const hairBack = new THREE.Group();
      hairBack.position.set(0, 0.335, -0.14);
      const hUpper = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.40, 0.05), hairMat);
      hUpper.position.y = -0.20;
      const hMid = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.045), hairMat);
      hMid.position.y = -0.50;
      const hTip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.04), tipMat);
      hTip.position.y = -0.68;
      hairBack.add(hUpper, hMid, hTip);
      [-0.07, 0.07].forEach(x => {
        const strand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.054), tipMat);
        strand.position.set(x, -0.3, 0);
        hairBack.add(strand);
      });
      body.add(hairBack);

      // --- arms: bare and pale, with short white sleeves and wrist ribbons ---
      [[u.meshArmL, -1], [u.meshArmR, 1]].forEach(([mesh, sd]) => {
        mesh.material = skinMat;
        const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.15, 0.145), whiteMat);
        sleeve.position.y = 0.115;
        const sleeveTrim = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.025, 0.15), indigoMat);
        sleeveTrim.position.y = 0.04;
        const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.028, 0.135), whiteMat);
        wrist.position.y = -0.155;
        mesh.add(sleeve, sleeveTrim, wrist);
        [-1, 1].forEach(k => {
          const loop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.028, 0.012), whiteMat);
          loop.position.set(sd * 0.07, -0.155 + k * 0.025, 0);
          loop.rotation.z = k * 0.6;
          mesh.add(loop);
        });
      });

      // --- legs: bare feet with white ribbon bows at the ankles ---
      [u.meshLegL, u.meshLegR].forEach(mesh => {
        mesh.material = skinMat;
        const ring = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.026, 0.15), whiteMat);
        ring.position.y = -0.1;
        mesh.add(ring);
        [-1, 1].forEach(k => {
          const loop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.028, 0.012), whiteMat);
          loop.position.set(k * 0.035, -0.1, 0.08);
          loop.rotation.z = k * 0.5;
          mesh.add(loop);
        });
      });

      // --- gown skirt (open cone so the legs swing freely inside it) ---
      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.34, 0.30, 12, 1, true),
        new THREE.MeshLambertMaterial({ color: 0xf5f6fd, side: THREE.DoubleSide })
      );
      skirt.position.set(0, 0.235, 0);
      unit.add(skirt);
      const hem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.336, 0.344, 0.05, 12, 1, true),
        new THREE.MeshLambertMaterial({ color: 0x2c3a94, side: THREE.DoubleSide })
      );
      hem.position.set(0, 0.11, 0);
      unit.add(hem);
      const belt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.195, 0.2, 0.03, 12, 1, true),
        new THREE.MeshLambertMaterial({ color: 0x1a2266, side: THREE.DoubleSide })
      );
      belt.position.set(0, 0.375, 0);
      unit.add(belt);

      // Long hanging shoulder panels - indigo with white trim, flaring out
      // over the front of the gown like an elongated shawl.
      function createShoulderPanel(sd) {
        const pivot = new THREE.Group();
        pivot.position.set(sd * 0.075, 0.74, 0.135);
        pivot.rotation.x = -0.4;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.56, 0.014), indigoMat);
        panel.position.y = -0.28;
        pivot.add(panel);
        [-1, 1].forEach(e => {
          const edge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.56, 0.018), whiteMat);
          edge.position.set(e * 0.05, -0.28, 0);
          pivot.add(edge);
        });
        const hemBand = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.03, 0.018), whiteMat);
        hemBand.position.y = -0.55;
        pivot.add(hemBand);
        unit.add(pivot);
        return pivot;
      }
      const panelL = createShoulderPanel(-1);
      const panelR = createShoulderPanel(1);

      // Slowly turning halo of pale moonlight behind the head.
      const halo = new THREE.Group();
      halo.position.set(0, 1.0, -0.22);
      const haloRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.008, 6, 32),
        new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.8 })
      );
      halo.add(haloRing);
      const haloRing2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.245, 0.005, 6, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
      );
      halo.add(haloRing2);
      [0, 1, 2, 3].forEach(k => {
        const a = k * Math.PI / 2;
        const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.02, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        star.position.set(Math.cos(a) * 0.245, Math.sin(a) * 0.245, 0);
        halo.add(star);
      });
      unit.add(halo);

      // --- wings ---
      const wingL = createGoLifeWing(-1);
      const wingR = createGoLifeWing(1);
      wingL.position.set(-0.07, 0.66, -0.15);
      wingR.position.set(0.07, 0.66, -0.15);
      wingL.rotation.set(-0.2, -0.55, 0);
      wingR.rotation.set(-0.2, 0.55, 0);
      unit.add(wingL, wingR);

      u.goddessLife = { wingL, wingR, hairBack, panelL, panelR, halo };
      u.goLifeHandGlow = null;
      unit.scale.y = 1.05;
      return unit;
    }

    // Per-frame animation - walk, idle, wing/hair/panel motion and the
    // attack pose. Called from the unit animation loop for unitType
    // 'goddessOfLife'.
    function updateGoddessOfLifeAnim(unit, time, delta) {
      const u = unit.userData;
      const g = u.goddessLife;
      const ph = u.idlePhase || 0;
      const attacking = u.attackAnimTimer > 0;
      let cycle = 0;

      if (u.isWalking) {
        u.walkTimer += delta * 9;
        cycle = Math.sin(u.walkTimer);
        const legAngle = cycle * 0.5;
        u.legL.rotation.x = legAngle;
        u.legR.rotation.x = -legAngle;
        if (!attacking) {
          u.armR.rotation.set(-0.35 + cycle * 0.05, 0, -0.06);
          u.armL.rotation.set(-cycle * 0.35, 0, 0.1);
        }
        u.body.rotation.set(0.05, -cycle * 0.06, 0);
        u.head.rotation.set(-0.03, 0, 0);
        const bob = Math.abs(cycle) * 0.02;
        u.body.position.y = 0.525 + bob;
        u.head.position.y = 0.9 + bob;
      } else {
        u.walkTimer = 0;
        u.legL.rotation.x = Math.sin(time * 0.6 + ph) * 0.03;
        u.legR.rotation.x = -Math.sin(time * 0.6 + ph) * 0.03;
        const breath = Math.sin(time * 2 + ph) * 0.02;
        u.body.position.y = 0.525 + breath;
        u.head.position.y = 0.9 + breath;
        u.body.rotation.set(0.02, Math.sin(time * 0.5 + ph) * 0.05, 0);
        u.head.rotation.set(0.03, Math.sin(time * 0.35 + ph) * 0.18, 0);
        if (!attacking) {
          u.armR.rotation.set(-0.35 + breath, 0, -0.06);
          u.armL.rotation.set(-0.15 + Math.sin(time * 0.8 + ph) * 0.05, 0, 0.12);
        }
      }

      // Wings breathe slowly and open a little wider on the march; the hair
      // and shoulder panels stream backward when moving and sway at rest.
      if (g) {
        const flutter = Math.sin(time * 1.4 + ph);
        const spread = u.isWalking ? 0.14 : 0;
        g.wingR.rotation.y = 0.55 + spread + flutter * 0.05;
        g.wingL.rotation.y = -0.55 - spread - flutter * 0.05;
        g.wingR.userData.inner.rotation.z = -flutter * 0.06;
        g.wingL.userData.inner.rotation.z = flutter * 0.06;
        g.hairBack.rotation.x = (u.isWalking ? 0.2 : 0.04) + Math.sin(time * 1.3 + ph) * 0.03 + cycle * 0.03;
        g.hairBack.rotation.z = Math.sin(time * 0.9 + ph) * 0.03;
        const panelSway = (u.isWalking ? 0.12 : 0) + Math.sin(time * 1.1 + ph) * 0.03 + cycle * 0.04;
        g.panelL.rotation.x = -0.4 + panelSway;
        g.panelR.rotation.x = -0.4 + panelSway;
        g.halo.rotation.z = time * 0.25 + ph;
        g.halo.position.y = 1.0 + Math.sin(time * 1.5 + ph) * 0.015;
      }
      if (u.goLifeHandGlow) {
        const pulse = 0.85 + Math.sin(time * 3 + ph) * 0.2;
        u.goLifeHandGlow.scale.setScalar(pulse);
      }

      if (attacking) {
        applyAttackPose(unit);
      } else if (u.weaponMesh) {
        u.weaponMesh.rotation.x = GOLIFE_STAFF_REST_TILT;
        u.weaponMesh.scale.setScalar(1);
        u.handR.rotation.x = 0;
      }
    }

    // --- Goddess of Life passives -----------------------------------------
    // A soft expanding ring of moonlight on the ground.
    function spawnGoLifeRing(pos, inner, outer, targetRadius, duration, opacity, color) {
      const mat = new THREE.MeshBasicMaterial({ color: color || 0x9ad8ff, transparent: true, opacity, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 32), mat);
      mesh.rotation.x = -Math.PI / 2;
      const grp = new THREE.Group();
      grp.add(mesh);
      grp.position.set(pos.x, pos.y + 0.06, pos.z);
      scene.add(grp);
      activeGraspFX.push({ mesh: grp, mats: [mat], age: 0, duration, kind: 'ring', grow: Math.max(0.2, targetRadius / outer - 1), baseOpacity: opacity });
    }

    // A drift of white and pale-blue petals rising from a point.
    function spawnGoLifePetals(pos, count, spread) {
      const cols = [0xffffff, 0xdfe6ff, 0x9ad8ff, 0xa9d4ff];
      for (let i = 0; i < count; i++) {
        spawnParticle(
          pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, 0.1 + Math.random() * 0.9, (Math.random() - 0.5) * spread)),
          cols[i % cols.length], 0.05 + Math.random() * 0.08, 0.7 + Math.random() * 0.8
        );
      }
    }

    // Plays the arms-raised blessing gesture unless she is mid-swing.
    function goddessOfLifeBlessGesture(unit) {
      const u = unit.userData;
      if (u.attackAnimTimer > 0) return;
      u.attackAnimPoseOverride = 'moonBless';
      u.attackAnimDuration = GOLIFE_BLESS_ANIM_DURATION;
      u.attackAnimTimer = GOLIFE_BLESS_ANIM_DURATION;
    }

    // Faction-aware ally/enemy lists for the Goddess of Life's support
    // passives (Gentle Touch, Second Dawn, Lightbringer Wave, Cradle of
    // Life) - the playable squad only ever fights alongside the player's
    // own squads/militia, but the Event: Death boss (see
    // createGoddessOfLifeBossSquad) fights alongside the raiders instead,
    // so every heal/revive/damage target list below is picked off
    // isEnemyUnit(unit) rather than hardcoded to the player's side. This
    // is what keeps the boss from ever mending or reviving the player.
    function goLifeAllySquadsFor(unit) {
      return isEnemyUnit(unit) ? raiderSquads : [...squads, ...militiaSquads];
    }
    function goLifeEnemySquadsFor(unit) {
      return isEnemyUnit(unit) ? [...squads, ...militiaSquads] : raiderSquads;
    }

    // Gentle Touch - every staff strike also mends the most wounded ally near her.
    function goddessOfLifeStrike(unit, targets, bestTarget, attackerWorldPos) {
      const u = unit.userData;
      const mult = u.dmgMultiplier || 1;
      applyDamage(bestTarget, GOLIFE_BASE_DMG * mult, 'goddessOfLife', attackerWorldPos, unit);

      let woundedTarget = null, worstPct = 1;
      goLifeAllySquadsFor(unit).forEach(s => s.members.forEach(m => {
        const md = m.userData;
        if (!md || md.hp <= 0 || md.hp >= md.maxHp) return;
        const mp = new THREE.Vector3();
        m.getWorldPosition(mp);
        if (Math.hypot(mp.x - attackerWorldPos.x, mp.z - attackerWorldPos.z) > GOLIFE_TOUCH_RANGE) return;
        const pct = md.hp / md.maxHp;
        if (pct < worstPct) { worstPct = pct; woundedTarget = m; }
      }));
      if (woundedTarget) {
        healUnit(woundedTarget, woundedTarget.userData.maxHp * GOLIFE_TOUCH_PCT * mult);
        const wp = new THREE.Vector3();
        woundedTarget.getWorldPosition(wp);
        spawnGoLifePetals(wp, 6, 0.4);
      }
    }

    // Second Dawn - the moment she would fall she rises again with half her
    // HP and a moonlight shield, and the burst mends nearby allies. Returns
    // true if it triggered (so applyDamage skips the normal death handling).
    // Not available again until GOLIFE_REBIRTH_COOLDOWN has counted down
    // (see updateGoddessOfLifeAbilities).
    function goddessOfLifeRebirth(unit) {
      const u = unit.userData;
      if (u.unitType !== 'goddessOfLife' || u.lifeRebirthCooldown > 0) return false;
      u.lifeRebirthCooldown = GOLIFE_REBIRTH_COOLDOWN;

      u.hp = Math.max(1, Math.round(u.maxHp * GOLIFE_REBIRTH_HP_PCT));
      u.absorbShield = Math.max(u.absorbShield || 0, u.maxHp * GOLIFE_REBIRTH_SHIELD_PCT);
      if (u.hpFillElement) u.hpFillElement.style.width = Math.max(0, (u.hp / u.maxHp) * 100) + '%';
      if (u.hpShieldFillElement) u.hpShieldFillElement.style.width = Math.max(0, (u.absorbShield / u.maxHp) * 100) + '%';
      u.stunTimer = 0.3;
      u.attackCooldown = Math.max(u.attackCooldown || 0, 0.6);

      const pos = new THREE.Vector3();
      unit.getWorldPosition(pos);
      spawnFloatingText(pos.clone().add(new THREE.Vector3(0, 1.1, 0)), 'SECOND DAWN!', '#bfe6ff');
      spawnFloatingText(pos, `+${u.hp}`, '#bfe6ff');
      spawnDivineResurrectionEffect(pos.clone());
      spawnGoLifeRing(pos, 0.3, 0.5, GOLIFE_REBIRTH_RADIUS, 0.8, 0.7, 0xbfe6ff);
      spawnGoLifePetals(pos, 36, 0.6);
      goddessOfLifeBlessGesture(unit);

      // The burst mends every wounded ally around her.
      const mult = u.dmgMultiplier || 1;
      goLifeAllySquadsFor(unit).forEach(s => s.members.forEach(m => {
        if (m === unit || !m.userData || m.userData.hp <= 0) return;
        const mp = new THREE.Vector3();
        m.getWorldPosition(mp);
        if (Math.hypot(mp.x - pos.x, mp.z - pos.z) > GOLIFE_REBIRTH_RADIUS) return;
        healUnit(m, m.userData.maxHp * GOLIFE_REBIRTH_HEAL_PCT * mult);
      }));
      return true;
    }

    // Lightbringer Wave + Cradle of Life. Driven once per frame for every
    // Goddess of Life on the field, independently of her own staff strikes
    // in processUnitAttack (same shape as updateLichAbilities/
    // updateDoctorSupport).
    function updateGoddessOfLifeAbilities(delta) {
      squads.forEach(squad => {
        if (squad.type !== 'goddessOfLife') return;

        squad.members.forEach(goddess => {
          const gd = goddess.userData;
          if (gd.hp <= 0) return;
          if (gd.lifeRebirthCooldown > 0) gd.lifeRebirthCooldown = Math.max(0, gd.lifeRebirthCooldown - delta);

          const gPos = new THREE.Vector3();
          goddess.getWorldPosition(gPos);

          // Lightbringer Wave - once ready it waits for an enemy within range,
          // then sends out a wave of light that damages every enemy in range,
          // shoves it away from her and stuns it (it cannot attack while stunned).
          gd.lifeWaveCooldown = (gd.lifeWaveCooldown || 0) - delta;
          if (gd.lifeWaveCooldown <= 0) {
            const hit = [];
            raiderSquads.forEach(sq => sq.members.forEach(r => {
              const rd = r.userData;
              if (!rd || rd.hp <= 0 || rd.unitType === 'valkyrie') return;
              const rp = new THREE.Vector3();
              r.getWorldPosition(rp);
              const dx = rp.x - gPos.x, dz = rp.z - gPos.z;
              const dist = Math.hypot(dx, dz);
              if (dist > GOLIFE_WAVE_RADIUS) return;
              hit.push({ r, rp, dx, dz, dist });
            }));
            if (hit.length === 0) {
              gd.lifeWaveCooldown = 0.75; // nobody close - look again shortly
            } else {
              gd.lifeWaveCooldown = GOLIFE_WAVE_INTERVAL;
              spawnFloatingText(gPos.clone().add(new THREE.Vector3(0, 1.0, 0)), 'LIGHTBRINGER WAVE!', '#fff2c0');
              spawnGoLifeRing(gPos, 0.5, 0.7, GOLIFE_WAVE_RADIUS, 0.6, 0.7, 0xfff2c0);
              spawnGoLifeRing(gPos, 0.3, 0.45, GOLIFE_WAVE_RADIUS * 0.75, 0.45, 0.5, 0xffffff);
              spawnGoLifePetals(gPos, 14, 0.5);
              const waveDmg = GOLIFE_WAVE_DAMAGE * (gd.dmgMultiplier || 1);
              hit.forEach(h => {
                const rd = h.r.userData;
                // Damage first - an enemy the wave kills is not shoved or stunned.
                applyDamage(h.r, waveDmg, 'goddessOfLife', gPos, goddess);
                if (rd.hp <= 0) return;
                const dir = h.dist > 0.001
                  ? new THREE.Vector3(h.dx / h.dist, 0, h.dz / h.dist)
                  : new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5);
                if (rd.knockbackVel) rd.knockbackVel.add(dir.multiplyScalar(GOLIFE_WAVE_KNOCKBACK));
                rd.stunTimer = Math.max(rd.stunTimer || 0, GOLIFE_WAVE_STUN);
                rd.attackCooldown = Math.max(rd.attackCooldown || 0, GOLIFE_WAVE_STUN);
                spawnFloatingText(h.rp.clone().add(new THREE.Vector3(0, 0.55, 0)), 'STUNNED!', '#fff2c0');
                for (let i = 0; i < 5; i++) {
                  spawnParticle(h.rp.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3)), i % 2 ? 0xffffff : 0xffe680, 0.07, 0.6);
                }
              });
              goddessOfLifeBlessGesture(goddess);
            }
          }

          // Cradle of Life - raises one fallen member of the most depleted
          // allied squad. Same candidate rules as the Doctor's Resurrection
          // (zombie-reanimated allies are never candidates).
          gd.lifeCradleCooldown = (gd.lifeCradleCooldown === undefined ? GOLIFE_CRADLE_INTERVAL : gd.lifeCradleCooldown) - delta;
          if (gd.lifeCradleCooldown <= 0) {
            let target = null, worstFill = 1;
            squads.forEach(s => {
              if (s.isZombieSquad || s.members.some(m => m.userData.isZombie)) return;
              const maxMembers = (squadDef(s.type) || {}).memberCount || 4;
              if (s.members.length >= maxMembers) return;
              const fill = s.members.length / maxMembers;
              if (fill < worstFill) { worstFill = fill; target = s; }
            });
            if (!target) {
              gd.lifeCradleCooldown = 2; // nobody has fallen - look again shortly
            } else {
              gd.lifeCradleCooldown = GOLIFE_CRADLE_INTERVAL;
              const revived = reviveNextSquadMember(target);
              if (revived) {
                const rp = new THREE.Vector3();
                revived.getWorldPosition(rp);
                spawnFloatingText(rp.clone().add(new THREE.Vector3(0, 0.9, 0)), 'REVIVED!', '#bfe6ff');
                spawnDivineResurrectionEffect(rp.clone());
                spawnGoLifePetals(rp, 16, 0.5);
                spawnFloatingText(gPos.clone().add(new THREE.Vector3(0, 1.0, 0)), 'CRADLE OF LIFE!', '#bfe6ff');
                goddessOfLifeBlessGesture(goddess);
                updateSquadCountUI();
              }
            }
          }
        });
      });
    }

    // Death - she fades into a drift of white and pale-blue petals rather
    // than a ragdoll. Also removes her from the squad lists, like killUnit does.

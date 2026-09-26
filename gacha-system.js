    function rollGachaReward(includeExclusives, excludeType) {
      if (Math.random() < 0.5) {
        const amount = 100 + Math.floor(Math.random() * 91) * 10; // 100-1000, step 10
        return { kind: 'gold', amount };
      }
      let pool = includeExclusives
        ? CLASS_DEFS.filter(d => d.rarity === 'epic' || d.rarity === 'legendary' || d.rarity === 'exclusive')
        : CLASS_DEFS.filter(d => !EXCLUSIVE_BANNER_TYPES.includes(d.type));
      if (excludeType) { const excl = String(excludeType).split(','); pool = pool.filter(d => !excl.includes(d.type)); }
      const totalWeight = pool.reduce((sum, d) => sum + (RARITY_PULL_WEIGHT[d.rarity] || RARITY_PULL_WEIGHT.common), 0);
      let roll = Math.random() * totalWeight;
      let def = pool[pool.length - 1];
      for (const d of pool) {
        roll -= (RARITY_PULL_WEIGHT[d.rarity] || RARITY_PULL_WEIGHT.common);
        if (roll <= 0) { def = d; break; }
      }
      return { kind: 'squad', type: def.type, def };
    }

    // Builds the Drop Rates modal from the exact same odds rollGachaReward
    // uses, so this can never drift out of sync with the real pull logic:
    // 50% flat chance of Gold, and the remaining 50% split among every
    // squad type in the relevant pool (locked or not - locked squads are
    // still pullable, and a first pull is what unlocks them) proportional
    // to RARITY_PULL_WEIGHT. includeExclusives matches the flag passed to
    // rollGachaReward - false for Page 1's modal, true for Page 2/3's.
    // excludeType matches the exclusion passed to rollGachaReward too
    // (Slasher's banner passes 'steelRevenant' so its modal doesn't list
    // an odds row for a squad it can never actually hand out).
    function renderGachaRatesModal(includeExclusives, excludeType) {
      const list = document.getElementById('gacha-rates-list');
      list.innerHTML = '';

      const goldRow = document.createElement('div');
      goldRow.className = 'gacha-rates-row';
      goldRow.innerHTML = `
        <div class="gacha-rates-icon" style="background:#8a5a1f;">🪙</div>
        <div class="gacha-rates-info">
          <div class="gacha-rates-name">Gold</div>
          <div class="gacha-rates-rarity">100-1000</div>
        </div>
        <div class="gacha-rates-pct">50%</div>
      `;
      list.appendChild(goldRow);

      // includeExclusives matches the pool rollGachaReward actually rolls
      // against: false (Page 1's modal) excludes Slasher/Steel Revenant
      // since The Recruiter's main pool can't land them; true (Page 2/3's
      // modal) is restricted to Epic/Legendary/Exclusive-tier squads only.
      // Sorted low-to-high tier (Common -> Rare -> Epic -> Legendary ->
      // Exclusive) so the list reads as an ascending rarity ladder instead
      // of whatever order CLASS_DEFS happens to declare each squad in.
      let pool = (includeExclusives
        ? CLASS_DEFS.filter(d => d.rarity === 'epic' || d.rarity === 'legendary' || d.rarity === 'exclusive')
        : CLASS_DEFS.filter(d => !EXCLUSIVE_BANNER_TYPES.includes(d.type))
      );
      if (excludeType) { const excl = String(excludeType).split(','); pool = pool.filter(d => !excl.includes(d.type)); }
      pool = pool.slice().sort((a, b) => (RARITY_SORT_ORDER[a.rarity] ?? 0) - (RARITY_SORT_ORDER[b.rarity] ?? 0));
      const totalWeight = pool.reduce((sum, d) => sum + (RARITY_PULL_WEIGHT[d.rarity] || RARITY_PULL_WEIGHT.common), 0);
      pool.forEach(def => {
        const weight = RARITY_PULL_WEIGHT[def.rarity] || RARITY_PULL_WEIGHT.common;
        const chance = 50 * weight / totalWeight;
        const unlocked = isSquadUnlocked(def.type);
        const pctText = chance < 1 ? chance.toFixed(2) + '%' : chance.toFixed(1) + '%';

        const row = document.createElement('div');
        row.className = 'gacha-rates-row';
        row.innerHTML = `
          <div class="gacha-rates-icon" style="background:${unlocked ? classColorCss(def.type) : '#2a2d30'};">${unlocked ? iconHtml(def) : '🔒'}</div>
          <div class="gacha-rates-info">
            <div class="gacha-rates-name">${def.label}</div>
            <div class="gacha-rates-rarity">${squadRarityLabel(def.rarity)}${unlocked ? '' : ' - Locked'}</div>
          </div>
          <div class="gacha-rates-pct">${pctText}</div>
        `;
        list.appendChild(row);
      });
    }

    function openGachaRates(includeExclusives, excludeType) {
      renderGachaRatesModal(includeExclusives, excludeType);
      document.getElementById('gacha-rates-overlay').classList.add('visible');
    }

    function closeGachaRates() {
      document.getElementById('gacha-rates-overlay').classList.remove('visible');
    }

    function performGachaPull(count) {
      const cost = count === 10 ? GACHA_COST_TEN : GACHA_COST_SINGLE;
      if (playerContractScrolls < cost) return;

      playerContractScrolls -= cost;

      const results = [];
      let unlockedSomething = false;
      for (let i = 0; i < count; i++) {
        const reward = rollGachaReward(false);
        if (reward.kind === 'gold') {
          playerGold += reward.amount;
        } else if (!isSquadUnlocked(reward.type)) {
          // First copy of a still-locked squad type unlocks it outright
          // instead of banking as a duplicate fragment.
          playerSquadUnlocked[reward.type] = true;
          reward.newUnlock = true;
          unlockedSomething = true;
        } else {
          playerSquadTokens[reward.type] = (playerSquadTokens[reward.type] || 0) + 1;
        }
        results.push(reward);
      }

      saveShopCurrencies();
      if (unlockedSomething) saveSquadUnlocked();
      renderRecruitShopPanel();
      showGachaResults(results);
    }

    // Pull for either Exclusive Squads Recruitment banner (Page 2 or 3).
    // Same 50% Gold / 50% weighted
    // squad roll mechanic as performGachaPull above, but at the pricier
    // EXCLUSIVE_GACHA_COST_SINGLE/TEN cost and against rollGachaReward's
    // Epic-to-Exclusive-tier pool (includeExclusives=true). excludeType
    // (passed through from renderExclusiveBannerArea) drops one specific
    // type out of that pool - each banner excludes the other Exclusive-
    // tier squad, so Slasher's banner never hands out Steel Revenant and
    // Steel Revenant's banner never hands out Slasher.
    function performExclusivePull(count, excludeType) {
      const cost = count === 10 ? EXCLUSIVE_GACHA_COST_TEN : EXCLUSIVE_GACHA_COST_SINGLE;
      if (playerContractScrolls < cost) return;

      playerContractScrolls -= cost;

      const results = [];
      let unlockedSomething = false;
      for (let i = 0; i < count; i++) {
        const reward = rollGachaReward(true, excludeType);
        if (reward.kind === 'gold') {
          playerGold += reward.amount;
        } else if (!isSquadUnlocked(reward.type)) {
          playerSquadUnlocked[reward.type] = true;
          reward.newUnlock = true;
          unlockedSomething = true;
        } else {
          playerSquadTokens[reward.type] = (playerSquadTokens[reward.type] || 0) + 1;
        }
        results.push(reward);
      }

      saveShopCurrencies();
      if (unlockedSomething) saveSquadUnlocked();
      renderRecruitShopPanel();
      showGachaResults(results);
    }

    // --- Gacha Summon Animation ---
    // Every pull now plays a short "summoning" animation before the
    // Recruitment Results grid shows: rotating rays + expanding rings +
    // sparkles + a flash, tinted to the pull's best rarity, then (for
    // Legendary/Exclusive hits only) a dedicated spotlight card for that
    // specific reward before the full grid appears. Common/Rare/Epic pulls
    // skip the spotlight and go straight to the results grid after the
    // ambient flash - see playSummonAnimation/revealResultCards below.
    function bestRarityOf(results) {
      let best = 'common';
      results.forEach(r => {
        const rarity = r.kind === 'gold' ? 'common' : r.def.rarity;
        if ((RARITY_SORT_ORDER[rarity] || 0) > (RARITY_SORT_ORDER[best] || 0)) best = rarity;
      });
      return best;
    }

    function showGachaResults(results) {
      const bestRarity = bestRarityOf(results);
      playSummonAnimation(bestRarity, results, (skipAnim) => revealResultCards(results, skipAnim));
    }

    // Holds the reveal callback for whichever summon animation is
    // currently on screen, so the "Tap to Reveal" button (see
    // finishSummonAnimation) knows what to do when tapped - the animation
    // no longer auto-advances into the results grid on its own.
    let pendingSummonOnDone = null;

    // Builds a standalone copy of a squad member's real in-game rig for
    // the spotlight preview - the exact same createSquadMemberVisual +
    // equipUnit pipeline createSquad uses for an actual squad, just never
    // added to the `units` array or the battle scene. createBlockyHumanoid
    // always attaches a combat HP-bar div to the global #hp-container HUD
    // layer regardless of caller, so that gets stripped off immediately
    // since this copy is never simulated/positioned and would otherwise
    // leave a dead, never-updated bar stuck in the corner of the screen.
    function buildSquadPreviewModel(type, color) {
      // Always previews slot 0 - the flagship model for any squad, and
      // specifically the elephant itself (not an archer escort) for the
      // War Elephant (see createSquadMemberVisual's memberIndex handling).
      const model = createSquadMemberVisual(type, color, 0);
      if (model.userData && model.userData.hpElement && model.userData.hpElement.parentNode) {
        model.userData.hpElement.parentNode.removeChild(model.userData.hpElement);
      }
      equipUnit(model, type, null, 0);
      return model;
    }

    // The single currently-running spotlight preview (renderer + rAF
    // handle), or null when none is active. Only one spotlight card is
    // ever on screen at a time, so this never needs to track more than one.
    let spotlightPreviewState = null;

    function stopSpotlightPreview() {
      if (!spotlightPreviewState) return;
      cancelAnimationFrame(spotlightPreviewState.rafId);
      // renderer.dispose() frees the GL context itself, but the preview
      // model's own geometries/materials (fresh ones built by
      // buildSquadPreviewModel on every single pull) aren't tracked by
      // that call and need disposing separately, or they pile up on the
      // GPU over a long play session of repeated pulls.
      if (spotlightPreviewState.model) {
        spotlightPreviewState.model.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
          }
        });
      }
      spotlightPreviewState.renderer.dispose();
      // dispose() alone leaves the WebGL context alive until garbage
      // collection - on phones that pile-up is what starves the main game
      // canvas, so release the context right away.
      try { spotlightPreviewState.renderer.forceContextLoss(); } catch (e) { /* already gone */ }
      spotlightPreviewState = null;
    }

    // Renders the actual in-game model of a Legendary/Exclusive pull's
    // reward into the spotlight card, slowly turning in place, instead of
    // the flat gr-icon every other result card uses - a tiny self-contained
    // THREE.js scene/camera/renderer of its own (separate from the main
    // game's), torn down by stopSpotlightPreview once the card is done
    // with it.
    function startSpotlightPreview(canvasEl, type, color) {
      stopSpotlightPreview();
      if (!canvasEl) return;

      const width = canvasEl.clientWidth || 190;
      const height = canvasEl.clientHeight || 172;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      const previewScene = new THREE.Scene();
      const previewCamera = new THREE.PerspectiveCamera(35, width / height, 0.1, 20);
      // A second live WebGL context is a real cost on phones, so the preview
      // skips antialiasing and simply gives up quietly if the device says no
      // (the result card still shows its normal icon).
      let previewRenderer;
      try {
        previewRenderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: false });
      } catch (e) {
        console.warn('Spotlight preview skipped - no WebGL context available.', e);
        return;
      }
      previewRenderer.setPixelRatio(dpr);
      previewRenderer.setSize(width, height, false);

      previewScene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.15));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(1.2, 2, 1.5);
      previewScene.add(key);

      const model = buildSquadPreviewModel(type, color);
      previewScene.add(model);

      // Frame the camera off the model's own bounding box rather than a
      // hardcoded distance, so every squad type - including the Steel
      // Revenant's taller stretched rig - fills the card consistently.
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      model.position.sub(center);
      const radius = Math.max(size.x, size.y, size.z) * 0.62 || 1;
      const dist = radius / Math.sin((previewCamera.fov * Math.PI / 180) / 2) * 1.05;
      previewCamera.position.set(0, size.y * 0.05, dist);
      previewCamera.lookAt(0, size.y * 0.05, 0);

      let lastT = performance.now();
      const state = { renderer: previewRenderer, rafId: 0, model };
      function tick(now) {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        model.rotation.y += dt * 1.1;
        previewRenderer.render(previewScene, previewCamera);
        state.rafId = requestAnimationFrame(tick);
      }
      spotlightPreviewState = state;
      state.rafId = requestAnimationFrame(tick);
    }

    function playSummonAnimation(bestRarity, results, onDone) {
      const overlay = document.getElementById('gacha-summon-overlay');
      const ringsLayer = document.getElementById('summon-rings-layer');
      const sparklesLayer = document.getElementById('summon-sparkles-layer');
      const flashEl = document.getElementById('summon-flash-el');
      const spotlightSlot = document.getElementById('summon-spotlight-slot');
      const labelEl = document.getElementById('summon-label-el');
      const revealBtn = document.getElementById('summon-reveal-btn');

      // Tear down any still-running 3D preview from a previous spotlight
      // card before wiping it out - the WebGL renderer/rAF loop it owns
      // won't stop on its own just because its canvas gets removed from
      // the DOM by the innerHTML clear below.
      stopSpotlightPreview();
      ringsLayer.innerHTML = '';
      sparklesLayer.innerHTML = '';
      spotlightSlot.innerHTML = '';
      flashEl.classList.remove('pulse');
      labelEl.classList.remove('in');
      revealBtn.classList.remove('ready');
      revealBtn.textContent = 'Tap to Reveal';

      overlay.className = ''; // reset any previous tier/shake classes
      overlay.classList.add('active', 'tier-' + bestRarity);
      const bigHit = bestRarity === 'legendary' || bestRarity === 'exclusive';
      if (bigHit) overlay.classList.add('shake');

      // Expanding rings, staggered a little so they ripple outward instead
      // of firing all at once.
      const ringCount = bigHit ? 4 : 2;
      for (let i = 0; i < ringCount; i++) {
        const ring = document.createElement('div');
        ring.className = 'summon-ring';
        ring.style.animationDelay = (i * 0.18) + 's';
        ringsLayer.appendChild(ring);
      }

      // Sparkles scattered around the center, more of them for a bigger hit.
      const sparkleCount = bigHit ? 14 : 6;
      const sparkleGlyphs = ['✨', '⭐', '💫'];
      for (let i = 0; i < sparkleCount; i++) {
        const sp = document.createElement('span');
        sp.className = 'summon-sparkle';
        sp.textContent = sparkleGlyphs[Math.floor(Math.random() * sparkleGlyphs.length)];
        const angle = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 120;
        sp.style.left = 'calc(50% + ' + (Math.cos(angle) * dist) + 'px)';
        sp.style.top = 'calc(50% + ' + (Math.sin(angle) * dist) + 'px)';
        sp.style.animationDelay = (Math.random() * 0.4) + 's';
        sparklesLayer.appendChild(sp);
      }

      requestAnimationFrame(() => flashEl.classList.add('pulse'));

      if (bigHit) {
        // Find the single reward matching the pull's best rarity to feature
        // in the spotlight (first match is fine - the point is showing
        // that a hit of this tier landed, not every copy of it).
        const spotlightReward = results.find(r => r.kind !== 'gold' && r.def.rarity === bestRarity);
        if (spotlightReward) {
          const card = document.createElement('div');
          card.className = 'summon-spotlight-card gacha-result-card ' + bestRarity + '-result';
          card.style.background = classColorCss(spotlightReward.type);
          card.innerHTML = `
            <div class="summon-spotlight-model"><canvas></canvas></div>
            <span class="gr-label" id="summon-spotlight-name">${spotlightReward.def.label}</span>
          `;
          spotlightSlot.appendChild(card);
          setTimeout(() => card.classList.add('in'), 350);
          // Model reveals as soon as the card pops in; the name is held
          // back and only fades/rises in once that entrance animation has
          // actually finished playing (card entrance starts at 350ms and
          // runs ~900ms), so the sequence reads as: model first, name after.
          const nameEl = card.querySelector('#summon-spotlight-name');
          setTimeout(() => { if (nameEl) nameEl.classList.add('in'); }, 350 + 900);
          startSpotlightPreview(card.querySelector('canvas'), spotlightReward.type, spotlightReward.def.color);
        }
        labelEl.textContent = bestRarity === 'exclusive' ? '✨ Exclusive! ✨' : '★ Legendary! ★';
      } else {
        labelEl.textContent = bestRarity === 'epic' ? 'Epic Find!' : 'Recruiting...';
      }
      setTimeout(() => labelEl.classList.add('in'), 150);

      // Once the ambient burst/spotlight finishes playing, surface the
      // reveal button instead of auto-advancing - the player taps it (or
      // finishSummonAnimation runs) to move on to the results grid.
      pendingSummonOnDone = onDone;
      const readyDelay = bigHit ? 1700 : (bestRarity === 'epic' ? 1150 : 900);
      setTimeout(() => {
        if (pendingSummonOnDone === onDone) revealBtn.classList.add('ready');
      }, readyDelay);
    }

    // Tapped from the "Tap to Reveal" button - hides the summon overlay
    // and hands off to whichever reveal callback playSummonAnimation
    // stashed (revealResultCards for the normal Gacha flow), with its
    // normal staggered flip.
    function finishSummonAnimation() {
      if (!pendingSummonOnDone) return;
      const overlay = document.getElementById('gacha-summon-overlay');
      const revealBtn = document.getElementById('summon-reveal-btn');
      const onDone = pendingSummonOnDone;
      pendingSummonOnDone = null;
      revealBtn.classList.remove('ready');
      overlay.classList.remove('active', 'shake');
      stopSpotlightPreview();
      onDone(false);
    }

    // Tapped from the always-visible Skip button - jumps straight past
    // the burst/spotlight animation (however far it's gotten) to the
    // results grid, and tells revealResultCards to show every card
    // already flipped instead of staggering the reveal.
    function skipSummonAnimation() {
      if (!pendingSummonOnDone) return;
      const overlay = document.getElementById('gacha-summon-overlay');
      const revealBtn = document.getElementById('summon-reveal-btn');
      const onDone = pendingSummonOnDone;
      pendingSummonOnDone = null;
      revealBtn.classList.remove('ready');
      overlay.classList.remove('active', 'shake');
      stopSpotlightPreview();
      onDone(true);
    }

    // Builds the pull results as face-down "?" cards, then flips each one
    // over in a staggered sequence (see the setTimeout loop below) so a
    // ×10 pull reveals its rewards one-by-one like a real gacha animation
    // instead of dumping every card face-up at once. Runs after
    // playSummonAnimation's pre-reveal flash finishes. When skipAnim is
    // true (player hit the Skip button), every card flips at once instead
    // of staggering, so Skip actually lands on the fully-revealed grid.
    function revealResultCards(results, skipAnim) {
      const grid = document.getElementById('gacha-result-grid');
      grid.innerHTML = '';
      results.forEach(reward => {
        const outer = document.createElement('div');
        outer.className = 'gr-card-outer';

        const backEl = document.createElement('div');
        if (reward.kind === 'gold') {
          backEl.className = 'gr-face gr-face-back gacha-result-card gold-result';
          backEl.innerHTML = `<span class="gr-icon">🪙</span><span class="gr-label">+${reward.amount}</span>`;
        } else {
          backEl.className = 'gr-face gr-face-back gacha-result-card'
            + (reward.def.rarity !== 'common' ? ' ' + reward.def.rarity + '-result' : '')
            + (reward.newUnlock ? ' new-unlock' : '');
          backEl.style.background = classColorCss(reward.type);
          backEl.innerHTML = `
            ${reward.newUnlock ? '<span class="gr-new-tag">NEW!</span>' : ''}
            <span class="gr-icon">${iconHtml(reward.def)}</span>
            <span class="gr-label">${reward.def.label}</span>
          `;
        }

        const frontEl = document.createElement('div');
        frontEl.className = 'gr-face gr-face-front';
        frontEl.textContent = '❔';

        const inner = document.createElement('div');
        inner.className = 'gr-flip-inner';
        inner.appendChild(frontEl);
        inner.appendChild(backEl);
        outer.appendChild(inner);
        grid.appendChild(outer);
      });
      document.getElementById('gacha-result-overlay').classList.add('visible');

      // Stagger each card's flip - single pulls feel snappy (one short
      // delay), ×10 pulls reveal in a cascading sequence. Skipped pulls
      // flip every card together with no delay.
      const outers = grid.querySelectorAll('.gr-card-outer');
      const startDelay = skipAnim ? 0 : 250;
      const perCardDelay = skipAnim ? 0 : 180;
      const pulseDelay = skipAnim ? 0 : 300;
      outers.forEach((outer, i) => {
        setTimeout(() => {
          outer.classList.add('flipped');
          const back = outer.querySelector('.gr-face-back');
          setTimeout(() => back.classList.add('gr-pulse'), pulseDelay);
        }, startDelay + i * perCardDelay);
      });
    }

    function closeGachaResults() {
      document.getElementById('gacha-result-overlay').classList.remove('visible');
    }

    // --- Squad Info & Upgrade panel ---
    // Renders one card per squad type: current level, HP/damage stats (base
    // vs. current, so the upgrade's effect is visible at a glance), how many
    // duplicate fragments are banked for it, and an Upgrade button that
    // spends fragments to raise the level - greyed out if short on
    // fragments, and swapped for a "MAX LEVEL" pill once capped.
    const squadInfoOpen = new Set(); // squad types whose description is expanded
    function renderSquadInfoPanel() {
      const list = document.getElementById('squad-info-list');
      const prevScroll = list.scrollTop;
      list.innerHTML = '';

      const toggleOpen = (type, card) => {
        if (squadInfoOpen.has(type)) squadInfoOpen.delete(type); else squadInfoOpen.add(type);
        card.classList.toggle('open', squadInfoOpen.has(type));
      };

      // Lowest tier first, highest last. Array.sort is stable, so squads
      // within the same tier keep their original order.
      const TIER_ORDER = ['common', 'rare', 'epic', 'legendary', 'exclusive', 'raider'];
      const tierRank = r => { const n = TIER_ORDER.indexOf(r); return n < 0 ? TIER_ORDER.length : n; };
      const sortedDefs = CLASS_DEFS.slice().sort((a, b) => tierRank(a.rarity) - tierRank(b.rarity));

      let lastTier = null;
      sortedDefs.forEach(def => {
        if (def.rarity !== lastTier) {
          lastTier = def.rarity;
          const divider = document.createElement('div');
          divider.className = 'squad-info-tier';
          divider.innerHTML = `<span class="squad-rarity-badge ${def.rarity}">${squadRarityLabel(def.rarity)}</span>`;
          list.appendChild(divider);
        }
        const unlocked = isSquadUnlocked(def.type);
        const rarityLabel = squadRarityLabel(def.rarity);

        if (!unlocked) {
          // Not yet unlocked - compact locked placeholder pointing at the Gacha.
          const lockedCard = document.createElement('div');
          lockedCard.className = 'squad-info-card locked';
          lockedCard.innerHTML = `
            <div class="squad-info-head">
              <div class="squad-info-icon" style="background:#2a2d30">🔒</div>
              <div class="squad-info-title">
                <div class="squad-info-name-row">
                  <span class="squad-info-name">${def.label}</span>
                  <span class="squad-rarity-badge ${def.rarity}">${rarityLabel}</span>
                </div>
                <div class="squad-info-desc" style="-webkit-line-clamp:unset;display:block;margin-top:3px">Locked. Pull for this squad in The Recruiter's Gacha.</div>
              </div>
            </div>`;
          list.appendChild(lockedCard);
          return;
        }

        const level = playerSquadLevels[def.type] || 1;
        const fragments = playerSquadTokens[def.type] || 0;
        const mult = squadStatMultiplier(def.type);
        const isMaxed = level >= SQUAD_MAX_LEVEL;
        const cost = squadUpgradeCost(level);
        const canAfford = !isMaxed && fragments >= cost;

        const hp = Math.round(100 * mult);
        const dmg = Math.round(def.baseDmg * mult);
        const pct = isMaxed ? 100 : Math.min(100, Math.round((fragments / cost) * 100));

        const lvlPct = Math.round(((level - 1) / (SQUAD_MAX_LEVEL - 1)) * 100);

        const card = document.createElement('div');
        card.className = 'squad-info-card' + (squadInfoOpen.has(def.type) ? ' open' : '');

        const head = document.createElement('div');
        head.className = 'squad-info-head';

        const icon = document.createElement('div');
        icon.className = 'squad-info-icon';
        icon.style.background = classColorCss(def.type);
        icon.innerHTML = iconHtml(def);
        head.appendChild(icon);

        const title = document.createElement('div');
        title.className = 'squad-info-title';
        title.innerHTML = `
          <div class="squad-info-name-row">
            <span class="squad-info-name">${def.label}</span>
            <span class="squad-rarity-badge ${def.rarity}">${rarityLabel}</span>
          </div>
          <div class="squad-info-stats">
            <span>❤️ ${hp}${level > 1 ? `<span class="stat-up"> +${hp - 100}</span>` : ''}</span>
            <span>⚔️ ${dmg}${level > 1 ? `<span class="stat-up"> +${dmg - def.baseDmg}</span>` : ''}</span>
          </div>`;
        head.appendChild(title);

        const lvl = document.createElement('div');
        lvl.className = 'squad-info-level';
        lvl.innerHTML = `<span>${isMaxed ? 'MAX' : 'Lv. ' + level + '/' + SQUAD_MAX_LEVEL}</span><span class="squad-info-lvbar"><i style="width:${lvlPct}%"></i></span>`;
        head.appendChild(lvl);
        card.appendChild(head);

        const desc = document.createElement('div');
        desc.className = 'squad-info-desc';
        desc.innerHTML = def.desc;
        desc.onclick = () => toggleOpen(def.type, card);
        card.appendChild(desc);

        const foot = document.createElement('div');
        foot.className = 'squad-info-foot';

        const frag = document.createElement('div');
        frag.className = 'squad-info-frag' + (canAfford ? ' ready' : '');
        frag.innerHTML = isMaxed
          ? `<span>Fully upgraded</span><div class="squad-info-bar"><i style="width:100%"></i></div>`
          : `<span>📦 ${fragments} / ${cost} fragments</span><div class="squad-info-bar"><i style="width:${pct}%"></i></div>`;
        foot.appendChild(frag);

        const btn = document.createElement('button');
        if (isMaxed) {
          btn.className = 'squad-upgrade-btn maxed';
          btn.textContent = '★ Max';
          btn.disabled = true;
        } else {
          btn.className = 'squad-upgrade-btn' + (canAfford ? '' : ' disabled');
          btn.textContent = 'Upgrade';
          btn.onclick = () => upgradeSquad(def.type);
        }
        foot.appendChild(btn);
        card.appendChild(foot);

        list.appendChild(card);
      });
      list.scrollTop = prevScroll;
    }

    // Spends duplicate recruit fragments (won from the Gacha whenever a
    // "Squad" pull result rolls a type already owned) to raise that squad
    // type's level by one. New stats apply the next time its units spawn -
    // i.e. the next battle, via applySquadLevelStats() in createSquad /
    // respawnSquad.
    function upgradeSquad(type) {
      const level = playerSquadLevels[type] || 1;
      if (level >= SQUAD_MAX_LEVEL) return;

      const cost = squadUpgradeCost(level);
      if ((playerSquadTokens[type] || 0) < cost) return;

      playerSquadTokens[type] -= cost;
      playerSquadLevels[type] = level + 1;

      saveShopCurrencies();
      saveSquadLevels();
      renderSquadInfoPanel();
    }

    // Tracks whether the in-game HUD is currently showing, so the
    // New Island button can be re-synced when Dev Tools is toggled.
    var gameplayUiVisible = false;

    // The New Island button is a Dev Tools feature: it shows only while
    // gameplay UI is visible AND Dev Tools is ON.
    function updateGenBtnVisibility() {
      const genBtn = document.getElementById('gen-btn');
      if (!genBtn) return;
      let devOn = false;
      try { devOn = !!devToolsEnabled; } catch (e) {}
      genBtn.style.display = (gameplayUiVisible && devOn) ? '' : 'none';
    }

    function setGameplayUiVisible(visible) {
      const display = visible ? '' : 'none';
      gameplayUiVisible = !!visible;
      document.getElementById('hud').style.display = display;
      updateGenBtnVisibility();
      document.getElementById('wave-panel').style.display = display;
      document.getElementById('action-bar').style.display = display;
      document.getElementById('pause-nav-bar').style.display = visible ? '' : 'none';
      document.getElementById('currency-hud').style.display = visible ? '' : 'none';
      if (!visible) closePauseMenu();
    }

    // --- Pause Menu ---
    let gamePaused = false;

    function openPauseMenu() {
      gamePaused = true;
      document.getElementById('pause-overlay').classList.add('visible');
    }

    function closePauseMenu() {
      gamePaused = false;
      document.getElementById('pause-overlay').classList.remove('visible');
      // Prevent a big catch-up jump in game logic for the time spent paused.
      clock.getDelta();
    }

    // --- Options Menu (Corpse Limit + Blood toggle) ---
    // Opened from the Pause Menu; game stays paused underneath it since
    // openPauseMenu already set gamePaused and this doesn't touch that flag.
    function openOptionsMenu() {
      document.getElementById('pause-overlay').classList.remove('visible');
      document.getElementById('options-overlay').classList.add('visible');
    }

    function closeOptionsMenu() {
      document.getElementById('options-overlay').classList.remove('visible');
      document.getElementById('pause-overlay').classList.add('visible');
    }

    // --- Hide GUI toggle (Options menu) ---
    // Hides every in-game HUD/panel via the "gui-hidden" body class (see
    // CSS) while leaving the Pause Nav bar's ☰ Menu button visible, so the
    // player can always come back through Pause Menu -> Options to turn it
    // back on. Persisted across sessions like the other bt_ settings.
    // Deliberately NOT restored from localStorage on load: Hide GUI is a
    // one-off "clean screenshot" toggle (see toggleGuiHidden below), not a
    // setting anyone means to leave on - restoring a stale 'true' from a
    // previous session used to boot straight into a screen with nothing
    // but the (Menu) button, no HUD, no squad bar, and no way to reach
    // Start Wave, which looked exactly like "no enemies spawn, no UI"
    // even though the game itself was working fine underneath it.
    let guiHidden = false;

    function updateHideGuiBtnLabel() {
      const btn = document.getElementById('hide-gui-btn');
      if (btn) btn.textContent = guiHidden ? '👁️ Show GUI' : '🙈 Hide GUI';
    }

    function applyGuiHidden() {
      document.body.classList.toggle('gui-hidden', guiHidden);
      updateHideGuiBtnLabel();
    }

    function toggleGuiHidden() {
      guiHidden = !guiHidden;
      localStorage.setItem('bt_guiHidden', String(guiHidden));
      applyGuiHidden();
    }

    applyGuiHidden();

    // --- Dev Tools Menu (Add Gold / Add Contract Scrolls only) ---
    // Opened from the Pause Menu, same show/hide shape as Options above.
    // Deliberately narrow: this only ever touches playerGold and
    // playerContractScrolls (via saveShopCurrencies, the same path every
    // legitimate gain - raider kills, Gacha, Daily Shop - already goes
    // through, so the HUD/localStorage stay in sync exactly like normal).
    // No squad tokens, no unit/wave/HP manipulation lives here.
    // --- Dev Tools Menu (Add Gold / Add Contract Scrolls only) ---
    // Opened from the Pause Menu, same show/hide shape as Options above.
    // Deliberately narrow: this only ever touches playerGold and
    // playerContractScrolls (via saveShopCurrencies, the same path every
    // legitimate gain - raider kills, Gacha, Daily Shop - already goes
    // through, so the HUD/localStorage stay in sync exactly like normal).
    // No squad tokens, no unit/wave/HP manipulation lives here.
    //
    // Whether the Pause Menu's Dev Tools button even exists is gated by
    // devToolsEnabled - see the Main Menu's corner toggle
    // (toggleDevToolsEnabled/updateDevToolsToggleUI) just below.
    let devToolsEnabled = localStorage.getItem('bt_devToolsEnabled') === 'true';

    // Reflects the current devToolsEnabled value onto both the Main
    // Menu's own toggle button (label + .enabled styling) and the Pause
    // Menu's Dev Tools button (shown only once enabled) - called once at
    // startup below and again every time the toggle is flipped, so the
    // two always agree regardless of which one the player looks at first.
    function updateDevToolsToggleUI() {
      const toggleBtn = document.getElementById('devtools-toggle-btn');
      if (toggleBtn) {
        toggleBtn.textContent = devToolsEnabled ? '🛠️ Dev Tools: ON' : '🛠️ Dev Tools: OFF';
        toggleBtn.classList.toggle('enabled', devToolsEnabled);
      }
      // Pause Menu's Dev Tools button is always available so Dev Tools
      // can be switched back ON from in-game; the panel it opens shows
      // the Gold/Scrolls fields only while Dev Tools is ON.
      const pauseBtn = document.getElementById('pause-devtools-btn');
      if (pauseBtn) pauseBtn.textContent = devToolsEnabled ? '🛠️ Dev Tools' : '🛠️ Dev Tools (Off)';
      const devFields = document.getElementById('devtools-fields');
      if (devFields) devFields.style.display = devToolsEnabled ? '' : 'none';
      const devEnableBtn = document.getElementById('devtools-enable-btn');
      if (devEnableBtn) {
        devEnableBtn.textContent = devToolsEnabled ? '🛠️ Disable Dev Tools' : '🛠️ Enable Dev Tools';
        devEnableBtn.classList.toggle('is-off', !devToolsEnabled);
      }
      // New Island button follows Dev Tools ON/OFF too.
      updateGenBtnVisibility();
      // Recruit Shop's Gold/Contract Scrolls pill - click-to-edit only
      // while Dev Tools is on (see the .shop-currency-input CSS above and
      // devSetGoldFromInput/devSetScrollsFromInput); readonly + plain
      // text look the rest of the time.
      const shopGoldInput = document.getElementById('shop-gold-amount');
      const shopScrollsInput = document.getElementById('shop-scrolls-amount');
      [shopGoldInput, shopScrollsInput].forEach(el => {
        if (!el) return;
        el.readOnly = !devToolsEnabled;
        el.classList.toggle('dev-editable', devToolsEnabled);
      });
    }
    updateDevToolsToggleUI();

    function toggleDevToolsEnabled() {
      devToolsEnabled = !devToolsEnabled;
      localStorage.setItem('bt_devToolsEnabled', String(devToolsEnabled));
      updateDevToolsToggleUI();
      // Refresh the Squad Index so its Lock/Unlock buttons appear/disappear.
      const manageSquadPanel = document.getElementById('menu-panel-manage-squad');
      if (manageSquadPanel && !manageSquadPanel.classList.contains('hidden')) renderManageSquadPanel();
      // The Dev Tools panel stays open when Dev Tools is switched OFF
      // from inside it, so the same button can switch it back ON.
    }

    function openDevToolsMenu() {
      document.getElementById('pause-overlay').classList.remove('visible');
      document.getElementById('devtools-overlay').classList.add('visible');
      // Populate both fields with the current totals every time the panel
      // opens, so they show what you actually have rather than whatever
      // was last typed (or the 0 default) from a previous visit.
      const goldInput = document.getElementById('devtools-gold-input');
      const scrollsInput = document.getElementById('devtools-scrolls-input');
      if (goldInput) goldInput.value = playerGold;
      if (scrollsInput) scrollsInput.value = playerContractScrolls;
    }

    function closeDevToolsMenu() {
      document.getElementById('devtools-overlay').classList.remove('visible');
      document.getElementById('pause-overlay').classList.add('visible');
    }

    // Dev Tools Gold/Contract Scrolls fields - typing a number here SETS
    // the currency to that exact amount (unlike the old Amount field +
    // Add buttons, which added on top of whatever you already had).
    // Applies live on every keystroke that already parses to a valid
    // whole number so the change (and the Gacha/Daily Shop buttons it can
    // unlock - see refreshShopButtonStates) lands immediately rather than
    // waiting for the field to be left. Mid-typing states that don't
    // parse yet (blank, a bare "-") are simply ignored here and resolved
    // on blur by the clamp functions below, mirroring
    // clampCorpseLimitInput's pattern elsewhere in this panel. Shared by
    // both the Dev Tools panel's own Gold/Scrolls fields and the Recruit
    // Shop's click-to-edit currency pill (shop-gold-amount/
    // shop-scrolls-amount, editable only while Dev Tools is on - see
    // updateDevToolsToggleUI) since both are just "a number input that
    // sets this currency" - takes the input element itself rather than a
    // hardcoded id so either caller can pass its own field.
    function devSetGoldFromInput(input) {
      const val = parseInt(input.value, 10);
      if (isNaN(val) || val < 0) return;
      playerGold = val;
      saveShopCurrencies();
    }

    function clampGoldInput(input) {
      let val = parseInt(input.value, 10);
      if (isNaN(val) || val < 0) val = 0;
      input.value = val;
      playerGold = val;
      saveShopCurrencies();
    }

    function devSetScrollsFromInput(input) {
      const val = parseInt(input.value, 10);
      if (isNaN(val) || val < 0) return;
      playerContractScrolls = val;
      saveShopCurrencies();
    }

    function clampScrollsInput(input) {
      let val = parseInt(input.value, 10);
      if (isNaN(val) || val < 0) val = 0;
      input.value = val;
      playerContractScrolls = val;
      saveShopCurrencies();
    }

    // Corpse Limit - live-updates corpseLimit as the player types so a
    // lowered cap takes effect (via the trim in createRagdollDeath) on the
    // very next death, same immediate-effect feel as the toggle buttons.
    function selectCorpseLimitFromInput() {
      const input = document.getElementById('corpse-limit-input');
      // Digits only - strips letters, symbols, spaces, "-", "." etc.
      // (typed or pasted) the moment they land in the field.
      const digits = input.value.replace(/\D/g, '');
      if (digits !== input.value) input.value = digits;
      const val = parseInt(digits, 10);
      if (!isNaN(val) && val >= 0 && val <= 50) corpseLimit = val;
    }

    // Snaps the input back to a valid value on blur, mirroring
    // clampWaveLimitInput's pattern for the Custom Game Wave Limit field.
    function clampCorpseLimitInput() {
      const input = document.getElementById('corpse-limit-input');
      let val = parseInt(input.value, 10);
      if (isNaN(val)) val = 10;
      val = Math.max(0, Math.min(50, val));
      input.value = val;
      corpseLimit = val;
    }

    // Blood toggle - Disable also clears whatever blood decals are already
    // down, so the effect is immediate rather than only applying to future
    // hits (the corpses/ragdolls themselves are untouched either way).
    function selectBloodEnabled(enabled) {
      bloodEnabled = enabled;
      document.querySelectorAll('#blood-toggle-group .count-btn').forEach(btn => {
        btn.classList.toggle('selected', (btn.dataset.blood === 'on') === enabled);
      });
      if (!enabled) {
        bloodDecals.forEach(b => scene.remove(b.mesh));
        bloodDecals.length = 0;
        // Also wipe any blood spray/droplets still in the air (every
        // isGore particle is blood - see createBloodSplatter, the
        // dismemberment fountain and the Slasher kill flourish).
        for (let i = activeParticles.length - 1; i >= 0; i--) {
          if (activeParticles[i].isGore) {
            scene.remove(activeParticles[i].mesh);
            activeParticles.splice(i, 1);
          }
        }
      }
      // Static blood pools (Castle Interior orc corpse dressing).
      scene.traverse(o => {
        if (o.userData && o.userData.isBloodPool) o.visible = enabled;
      });
    }

    // Retreat: leave the run and go back to the Main Menu (same behavior as
    // the old ☰ Menu button).
    function retreatToMainMenu() {
      closePauseMenu();
      returnToMainMenu();
    }

    // New Game: restart the current run from scratch on a freshly generated
    // island, keeping whatever mode (custom/campaign) is active.
    function restartCurrentGame() {
      closePauseMenu();
      generateRandomIsland();
      if (typeof waveNumber !== 'undefined') updateWaveUI();
    }

    function setModeLabel(text) {
      const el = document.getElementById('mode-label');
      if (text) {
        el.textContent = text;
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    }

    // =========================================================================
    // CO-OP LOBBY (Phase 1 of 3) - Supabase Realtime Presence + Broadcast.
    //
    // WHAT THIS DOES: lets up to 4 players find each other in a lobby (host
    // creates a code, others join it), see who's in, ready up, and have the
    // host kick off a game everyone jumps into together with the same
    // settings (biome/island size/wave limit).
    //
    // WHAT THIS DOES NOT DO YET: actually synchronize the live battle.
    // Once "Start Game" fires, every device - host and guests alike - runs
    // its OWN independent simulation (same code path as a normal Custom
    // Game). Each player's raiders, squads, and wave outcome are still
    // calculated locally on their own device, same as always, so islands
    // and battles WILL diverge between players. True shared-simulation
    // co-op (host-authoritative state streamed to guests) is a much larger
    // follow-up - this lobby is the foundation it would be built on, not
    // that feature itself.
    //
    // No database table is used here - a lobby is disposable, so it just
    // lives in a Supabase Realtime channel for as long as players are
    // subscribed to it, and disappears (for that lobby) once everyone
    // leaves. Works for guests too (no account needed), same as local
    // single-player play.
    // =========================================================================
    const COOP_MAX_PLAYERS = 4;
    let coopChannel = null;
    let coopLobbyCode = '';
    let coopIsHost = false;
    let coopMyKey = '';
    let coopReady = false;

    function coopResetMenuError() {
      const err = document.getElementById('coop-menu-error');
      if (err) err.textContent = '';
      const input = document.getElementById('coop-join-code-input');
      if (input) input.value = '';
    }

    function coopGenLobbyCode() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I - easier to read aloud
      let code = '';
      for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
      return code;
    }

    function coopSetMenuError(msg) {
      const err = document.getElementById('coop-menu-error');
      if (err) err.textContent = msg || '';
    }

    function coopHostLobby() {
      if (!sbReady) {
        coopSetMenuError('Co-op needs the Supabase connection - ask the developer to check the setup.');
        return;
      }
      coopJoinChannel(coopGenLobbyCode(), true);
    }

    function coopJoinLobby() {
      if (!sbReady) {
        coopSetMenuError('Co-op needs the Supabase connection - ask the developer to check the setup.');
        return;
      }
      const input = document.getElementById('coop-join-code-input');
      const code = ((input && input.value) || '').trim().toUpperCase();
      if (code.length < 4) {
        coopSetMenuError('Enter the lobby code your friend shared with you.');
        return;
      }
      coopJoinChannel(code, false);
    }

    function coopMyPresencePayload() {
      return {
        username: defaultUsername(),
        avatar: currentAvatar,
        isHost: coopIsHost,
        ready: coopReady,
        // Only the filled slots - squadComposition can contain null for an
        // empty slot (see SQUAD_TYPE_OPTIONS), and there's nothing useful
        // to show anyone for an empty one.
        squads: squadComposition.filter(Boolean)
      };
    }

    function coopJoinChannel(code, isHost) {
      coopLeaveChannelOnly(); // in case we're already in a stale lobby
      coopLobbyCode = code;
      coopIsHost = isHost;
      coopReady = isHost; // host starts pre-readied - it's their lobby
      coopMyKey = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('p' + Math.random().toString(36).slice(2));

      coopChannel = sbClient.channel('lobby-' + code, {
        config: { presence: { key: coopMyKey } }
      });

      coopChannel.on('presence', { event: 'sync' }, coopRenderLobby);
      coopChannel.on('broadcast', { event: 'start' }, (msg) => coopHandleStartBroadcast(msg.payload));
      coopChannel.on('broadcast', { event: 'full' }, (msg) => {
        if (msg.payload && msg.payload.targetKey === coopMyKey) coopHandleLobbyFull();
      });

      coopChannel.subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        await coopChannel.track(coopMyPresencePayload());
        showMenuPanel('coop-lobby');
        coopRenderLobby();
      });
    }

    // If a lobby is already at COOP_MAX_PLAYERS when a new player's
    // presence syncs in, the existing host tells that one player (by
    // their presence key) to back out, rather than everyone else having
    // to police capacity themselves.
    function coopHandleLobbyFull() {
      coopSetMenuError('That lobby is already full (4/4).');
      coopLeaveChannelOnly();
      showMenuPanel('coop');
    }

    function coopRenderLobby() {
      if (!coopChannel) return;
      const state = coopChannel.presenceState();
      const keys = Object.keys(state);
      const players = keys.map(k => ({ key: k, ...state[k][0] }));
      players.sort((a, b) => (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0));

      // Capacity enforcement: only the host (the one player everyone else
      // is guaranteed to trust) tells latecomers past the cap to leave.
      if (coopIsHost && players.length > COOP_MAX_PLAYERS) {
        const overflow = players.slice(COOP_MAX_PLAYERS);
        overflow.forEach(p => {
          coopChannel.send({ type: 'broadcast', event: 'full', payload: { targetKey: p.key } });
        });
      }

      const codeBox = document.getElementById('coop-lobby-code-box');
      if (codeBox) {
        codeBox.innerHTML = coopIsHost
          ? `Share this code with friends<span class="coop-code-value">${coopLobbyCode}</span>`
          : `Lobby Code<span class="coop-code-value">${coopLobbyCode}</span>`;
      }
      const countEl = document.getElementById('coop-lobby-count');
      if (countEl) countEl.textContent = String(Math.min(players.length, COOP_MAX_PLAYERS));

      const list = document.getElementById('coop-lobby-players');
      if (list) {
        list.innerHTML = players.slice(0, COOP_MAX_PLAYERS).map(p => {
          const tags = (p.isHost ? '<span class="coop-player-tag host">Host</span>' : '') +
            `<span class="coop-player-tag ${p.ready ? 'ready' : 'notready'}">${p.ready ? 'Ready' : 'Not Ready'}</span>`;
          const squads = Array.isArray(p.squads) ? p.squads : [];
          const squadIcons = squads.map(type => {
            const def = typeof squadDef === 'function' ? squadDef(type) : null;
            const icon = def ? (typeof iconHtml === 'function' ? iconHtml(def) : def.icon) : '❔';
            const label = def ? def.label : type;
            return `<span class="coop-player-squad-icon" title="${label}">${icon}</span>`;
          }).join('');
          const squadsRow = squads.length
            ? `<div class="coop-player-squads">${squadIcons}</div>`
            : '<div class="coop-player-squads coop-player-squads-empty">No squads equipped</div>';
          const avatarMarkup = typeof avatarIconHtml === 'function' ? avatarIconHtml(p.avatar || 'swords') : (p.avatar || '🙂');
          return `<div class="coop-player-row"><div class="coop-player-row-top"><span>${avatarMarkup}</span>` +
            `<span class="coop-player-name">${p.username || 'Player'}</span>${tags}</div>${squadsRow}</div>`;
        }).join('');
      }

      const startBtn = document.getElementById('coop-start-btn');
      if (startBtn) startBtn.classList.toggle('hidden', !coopIsHost);
      const readyBtn = document.getElementById('coop-ready-btn');
      if (readyBtn) {
        readyBtn.textContent = coopReady ? 'Not Ready' : 'Ready Up';
        readyBtn.classList.toggle('hidden', coopIsHost); // host is always "ready" by starting
      }
      const statusMsg = document.getElementById('coop-lobby-status-msg');
      if (statusMsg) {
        statusMsg.textContent = players.length < 2
          ? 'Waiting for at least one more player to join...'
          : '';
      }
    }

    function coopToggleReady() {
      if (!coopChannel || coopIsHost) return;
      coopReady = !coopReady;
      coopChannel.track(coopMyPresencePayload());
    }

    function coopStartGame() {
      if (!coopChannel || !coopIsHost) return;
      const settings = {
        biomeTheme: selectedBiomeTheme,
        islandSize: selectedIslandSize,
        waveLimit: selectedWaveLimit
      };
      coopChannel.send({ type: 'broadcast', event: 'start', payload: settings });
      coopHandleStartBroadcast(settings); // host starts locally too
    }

    function coopHandleStartBroadcast(settings) {
      if (settings) {
        if (settings.biomeTheme) selectedBiomeTheme = settings.biomeTheme;
        if (settings.islandSize) selectedIslandSize = settings.islandSize;
        if (settings.waveLimit) selectedWaveLimit = settings.waveLimit;
      }
      startCustomGame();
      setModeLabel('Co-op Lobby: ' + coopLobbyCode);
    }

    // Untracks + unsubscribes without touching the menu UI - used both by
    // the explicit Leave Lobby button and internally before joining a
    // different lobby.
    function coopLeaveChannelOnly() {
      if (coopChannel) {
        try { coopChannel.untrack(); } catch (e) {}
        try { sbClient.removeChannel(coopChannel); } catch (e) {}
      }
      coopChannel = null;
      coopLobbyCode = '';
      coopIsHost = false;
      coopReady = false;
    }

    function coopLeaveLobby() {
      coopLeaveChannelOnly();
      showMenuPanel('coop');
    }

    function startCustomGame() {
      eventFactionActive = null;
      activeWaveLimit = selectedWaveLimit;
      document.getElementById('main-menu').classList.add('hidden');
      setGameplayUiVisible(true);
      setModeLabel('');
      applyBiomeTheme(selectedBiomeTheme);
      rebuildPlayerSquads();
      generateRandomIsland();
    }

    // --- Event: Death & Life gamemode ---
    // Faction chosen on the Event lore panel ('death' or 'life'), and
    // which faction the run currently in progress belongs to (used to
    // pick the win/lose framing when a wave-limited run ends). pendingEventFaction
    // is only ever 'death' while the player is on the Manage Squad screen
    // picking their assault force; it's cleared the moment that battle
    // actually starts, or if they back out to the root menu instead.
    function chooseEventFaction(faction) {
      if (faction === 'life') {
        beginEventBattle('life');
        return;
      }
      // Death picks its raiders first, the same way a Clash-of-Clans-style
      // attack lets you choose your army before deploying it - reuses the
      // existing Manage Squad loadout screen rather than a new one.
      pendingEventFaction = 'death';
      showMenuPanel('manage-squad');
    }

    function beginEventBattle(faction) {
      eventFactionActive = faction;
      pendingEventFaction = null;
      selectedBiomeTheme = 'heaven';
      // Death and Life play out as two different fights, not just a
      // reskin of the same one (see the eventFactionActive check in
      // spawnRaiderWave): Death is the assault - the player's squads sail
      // in and must break through the Valkyrie & Angel's stationary guard
      // posts before Wave 5 begins (so it wins on clearing wave 4). Life
      // is the defense - the player starts on their own ground and real
      // Valkyrie/Angel warbands sail in and actively attack each wave, so
      // Life must survive and clear Wave 5 itself.
      activeWaveLimit = faction === 'death' ? 4 : 5;
      document.getElementById('main-menu').classList.add('hidden');
      setGameplayUiVisible(true);
      applyBiomeTheme('heaven');
      setModeLabel(faction === 'death'
        ? '💀 Event: Assault the Heavenly Island'
        : '✨ Event: Defend the Heavenly Island');
      rebuildPlayerSquads();
      generateRandomIsland();
    }

    // Shows/hides the "choose your raiders" banner and Begin Assault
    // button on the Manage Squad screen - only while pendingEventFaction
    // is 'death' (i.e. the player got here via Event: Death), so the
    // screen looks exactly like normal Manage Squad the rest of the time.
    function updateEventAssaultBanner() {
      const banner = document.getElementById('event-assault-banner');
      const btn = document.getElementById('event-begin-assault-btn');
      const inEventFlow = pendingEventFaction === 'death';
      if (banner) banner.classList.toggle('hidden', !inEventFlow);
      if (btn) btn.classList.toggle('hidden', !inEventFlow);
    }

    function startCampaignLevel(levelIndex) {
      eventFactionActive = null;
      const level = CAMPAIGN_LEVELS[levelIndex];
      activeWaveLimit = 'endless';
      document.getElementById('main-menu').classList.add('hidden');
      setGameplayUiVisible(true);
      setModeLabel(level.name);
      applyBiomeTheme(selectedCampaignBiome);
      rebuildPlayerSquads();
      generateRandomIsland();
      // generateRandomIsland() resets waveNumber to 0 - seed it to this
      // level's baseline so the difficulty curve (warband count, raiders
      // per warband) starts wherever this level is meant to begin.
      waveNumber = level.startWave;
      updateWaveUI();
    }

    // Log Out - confirms, then routes through the account system's own
    // authSignOut() (see the "Account System" <script> block in <head>):
    // it signs out of Supabase, clears the cached session flags, and
    // reloads the page, which drops the player back on the #auth-screen
    // login/signup gate instead of the main menu. If no account system is
    // configured (sbReady false, guest-only build), authSignOut() still
    // reloads cleanly - there's just no login screen to return to, so the
    // reload lands back on the main menu exactly like a fresh guest load.
    async function quitGame() {
      if (!confirm('Log out of A Village at Pillage?')) return;
      await authSignOut();
    }

    // Backs out of a run to the Main Menu without tearing down the scene -
    // whatever island/battle is in progress just sits hidden behind the
    // menu until the player starts a new run, which fully resets it anyway.
    function returnToMainMenu() {
      eventFactionActive = null;
      pendingEventFaction = null;
      if (waveCooldownInterval) { clearInterval(waveCooldownInterval); waveCooldownInterval = null; }
      waveCooldownActive = false;
      waveIntermissionActive = false;
      waveInProgress = false;
      setGameplayUiVisible(false);
      showMenuPanel('root');
      document.getElementById('main-menu').classList.remove('hidden');
    }

    function selectSquad(idx, buttonEl) {
      if (!squads[idx] || idx === selectedSquadIndex) return;
      // A wiped-out squad can't be selected until it's revived/replenished.
      if (squads[idx].members.length === 0) return;

      document.querySelectorAll('#action-bar .action-btn').forEach(btn => btn.classList.remove('active'));
      if (buttonEl) buttonEl.classList.add('active');

      if (squads[selectedSquadIndex]) squads[selectedSquadIndex].ring.visible = false;
      selectedSquadIndex = idx;
      squads[selectedSquadIndex].ring.visible = true;
      targetHighlight.visible = false;
    }

    // Runs every frame: a selected squad that gets wiped out is deselected
    // automatically (selectedSquadIndex = -1: no ring, no arrow, no active
    // button), and wiped squads' action buttons are greyed out. They become
    // selectable again as soon as they have members again (Revive/Replenish).
    function enforceSquadSelectionRules() {
      const cur = squads[selectedSquadIndex];
      if (cur && cur.members.length === 0) {
        if (cur.ring) cur.ring.visible = false;
        selectedSquadIndex = -1;
        if (targetHighlight) targetHighlight.visible = false;
      }
      const btns = document.querySelectorAll('#action-bar .action-btn');
      for (let i = 0; i < btns.length; i++) {
        const sq = squads[i];
        const wiped = !!sq && sq.members.length === 0;
        if (btns[i].classList.contains('wiped') !== wiped) btns[i].classList.toggle('wiped', wiped);
        const isSel = i === selectedSquadIndex;
        if (btns[i].classList.contains('active') !== isSel) btns[i].classList.toggle('active', isSel);
      }
    }

    // --- Selected-squad arrow + tap-a-squad-to-select ---
    function updateSquadArrows() {
      enforceSquadSelectionRules();
      const t = performance.now() / 1000;
      for (let i = 0; i < squads.length; i++) {
        const sq = squads[i];
        if (!sq || !sq.arrow) continue;
        const show = i === selectedSquadIndex && sq.members.length > 0 &&
          sq.members.some(m => m.visible !== false && m.userData.hp > 0);
        sq.arrow.visible = show;
        if (show) {
          sq.arrow.position.y = 2.3 + Math.sin(t * 4) * 0.12;
          sq.arrow.rotation.y = t * 1.6;
        }
      }
    }

    // Desktop hotkeys: 1-4 (main row or numpad) select that action-bar squad.
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code || '');
      if (!m) return;
      const mainMenu = document.getElementById('main-menu');
      if (mainMenu && !mainMenu.classList.contains('hidden')) return; // still in the menus
      if (gamePaused) return;
      const idx = parseInt(m[1], 10) - 1;
      if (!squads[idx]) return;
      e.preventDefault();
      selectSquad(idx, document.querySelectorAll('#action-bar .action-btn')[idx]);
    });

    // --- 9. TAP TO MOVE & RAYCASTING ---
    const raycaster = new THREE.Raycaster();
    const touchVector = new THREE.Vector2();

    // The live map's clickable ground/props, nearest first - meshes only.
    // The Castle Interior parents its per-tile movement-grid outlines
    // (THREE.LineLoop) straight into castleInteriorGroup (see
    // buildCastleInteriorMap), and a Raycaster hits lines within a 1-unit
    // threshold of the ray - so every click inside the fortress "hit" some
    // tile-outline edge near the cursor before it ever reached the floor
    // tile itself, and the squad was sent to the tile next to (or beside)
    // the one that was actually clicked. Skipping non-mesh hits makes a
    // click land on exactly the tile under the cursor, inside the castle
    // and out on the island alike.
    function raycastWorld() {
      return raycaster
        .intersectObjects(inCastleInterior ? castleInteriorGroup.children : islandGroup.children)
        .filter(h => h.object.isMesh);
    }

    // Orc Fortress click test. The Fortress keep and its palisade are
    // Groups, and the tile raycast below (raycaster.intersectObjects with no
    // "recursive" flag) never looks inside a Group - so a click on the
    // keep's tower or walls used to go straight THROUGH it and land on
    // whatever ground lay behind it on screen, ordering a move there instead
    // of opening the Fortress panel. This tests the Fortress meshes
    // recursively against the SAME ray (setFromCamera already ran) and
    // counts as a hit only when the Fortress is nearer than the first ground
    // tile, so clicking the grass in front of it still just walks there.
    function hitOrcFortress(groundDist) {
      if (inCastleInterior || !orcFortressTile || orcFortressRazed) return false;
      const meshes = orcFortressPickMeshes.filter(m => m.parent === islandGroup && m.visible !== false);
      if (meshes.length === 0) return false;
      const hits = raycaster.intersectObjects(meshes, true).filter(h => {
        for (let o = h.object; o; o = o.parent) if (o.visible === false) return false;
        return true;
      });
      return hits.length > 0 && hits[0].distance <= groundDist;
    }

    let pointerDownTime = 0;
    let pointerDownPos = { x: 0, y: 0 };
    let pointerDownButton = 0;

    window.addEventListener('pointerdown', (e) => {
      pointerDownTime = performance.now();
      pointerDownPos = { x: e.clientX, y: e.clientY };
      pointerDownButton = e.button;
    });

    window.addEventListener('pointerup', (e) => {
      const moveDistance = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      const pressDuration = performance.now() - pointerDownTime;
      const isMouse = e.pointerType === 'mouse';

      // Desktop: only a plain LEFT click orders a move. The right button
      // pans the camera and the middle button zooms it (OrbitControls), so
      // releasing either one must never send a squad walking.
      if (isMouse && (e.button !== 0 || pointerDownButton !== 0)) return;

      // Small tap tolerance - only a near-stationary press counts as a
      // tap (issuing a select/move order); anything that drifts further is
      // treated as a camera drag/pan instead and ignored here. Touch keeps
      // the strict 4px / 300ms tap rule. A mouse or trackpad click gets a
      // looser 8px drift allowance and NO time limit - a deliberate click
      // that's held a beat, or a trackpad press that wobbles a few pixels,
      // used to be thrown away as a "drag" and the tile looked unclickable.
      if (moveDistance > (isMouse ? 8 : 4)) return;
      if (!isMouse && pressDuration > 300) return;
      if (gamePaused) return;
      const tgt = e.target;
      if (tgt && tgt.closest && (tgt.closest('#action-bar') || tgt.closest('#gen-btn') || tgt.closest('#wave-panel') || tgt.closest('#orc-fortress-panel') || tgt.closest('#siege-tent-panel') || tgt.closest('button, input, select, textarea, a, label'))) return;

      touchVector.x = (e.clientX / window.innerWidth) * 2 - 1;
      touchVector.y = -(e.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(touchVector, camera);

      // Inside the Castle Interior assault, the outer island's own
      // islandGroup is hidden (see enterCastleInterior) and the walled
      // courtyard lives in castleInteriorGroup instead - raycast against
      // whichever one is actually the live, visible map, or a tap on the
      // courtyard ground would never hit anything and squads could never
      // be given a move order while inside.
      const intersects = raycastWorld();

      // Clicking the Orc Fortress itself (keep or palisade) opens its panel -
      // the Siege panel, or the Captured Fortress panel once it's yours - no
      // matter which squad (if any) is selected.
      if (hitOrcFortress(intersects.length > 0 ? intersects[0].distance : Infinity)) {
        if (orcFortressDestroyed) showCapturedFortressPanel(); else showOrcFortressPanel();
        return;
      }

      if (intersects.length > 0) {
        const squad = squads[selectedSquadIndex];
        if (!squad || squad.members.length === 0) return; // No squad selected, or all dead
        if (squad.onBoat) {
          // Event: Death - still sailing in, no orders until it beaches.
          spawnFloatingText(squad.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), '⛵ Still sailing in...', '#ffffff');
          return;
        }

        // Use the world-space hit point rather than the intersected
        // object's own .position - a tap on a House/Barracks/Boulder etc.
        // often hits a child mesh of that group (local coordinates), not
        // the ground tile, so .position there would be wrong.
        const hitPoint = intersects[0].point;
        const goalX = Math.round(hitPoint.x);
        const goalZ = Math.round(hitPoint.z);

        // Orc Fortress - tapping anywhere on the keep's 3x3 footprint
        // (the center tile plus the solid 'orcFortressKeepExtra' tiles
        // around it - see generateRandomIsland's fortress placement
        // block) opens the Siege panel instead of walking the squad
        // there, since the keep itself is unwalkable. ORC_FORTRESS_SIEGE_RANGE
        // (2.3) comfortably covers that whole 3x3 block from its center.
        if (orcFortressTile && !orcFortressDestroyed &&
            Math.hypot(goalX - orcFortressTile.x, goalZ - orcFortressTile.z) <= ORC_FORTRESS_SIEGE_RANGE) {
          showOrcFortressPanel();
          return;
        }

        // Captured Fortress - once orcFortressDestroyed (conquered, see
        // destroyOrcFortress), the keep is yours: tapping the same 3x3
        // footprint instead opens the Captured Fortress panel (Garrison/
        // Heal/Replenish) rather than the old Siege panel, which has
        // nothing left to offer against a keep with no defenders left.
        // Not once raiders have razed it back down, though (orcFortressRazed
        // - see razeCapturedFortress) - a lost keep offers nothing either.
        if (orcFortressTile && orcFortressDestroyed && !orcFortressRazed &&
            Math.hypot(goalX - orcFortressTile.x, goalZ - orcFortressTile.z) <= ORC_FORTRESS_SIEGE_RANGE) {
          showCapturedFortressPanel();
          return;
        }

        // Siege Tent - tapping its exact tile (and only that tile - it's
        // a 1x1 footprint) opens the Heal panel instead of walking the
        // squad onto it (which is solid/unwalkable anyway - see the
        // 'siegeTent' propPlan branch).
        if (siegeTentTile && goalX === siegeTentTile.x && goalZ === siegeTentTile.z) {
          showSiegeTentPanel();
          return;
        }

        // Siege Engineer passive (Watchtower Construction) - the ground
        // tile a Watch Tower stands on is always part of islandGroup
        // (the tower mesh itself lives directly under scene, but the
        // terrain tile beneath it is normal island geometry), so a tap
        // there resolves to goalX/goalZ === that tower's x/z exactly
        // like any other tile tap. Tapping it with that tower's own
        // (currently ejected) operator squad selected sends it back
        // inside to resume operating it, instead of issuing a normal
        // move order onto that tile. Multiple towers can stand at once
        // (one per Siege Engineer squad), so the tower this applies to
        // is whichever one actually sits at the tapped tile.
        const squadIsOperatingTower = squad.members.some(m => m.userData.isOperatingTower);
        const towerAtTile = watchTowers.find(t => goalX === t.x && goalZ === t.z);

        // Instead of snapping straight inside, tapping the tower now sends
        // the squad walking there like a normal move order - the same
        // findPath/currentPath machinery just below handles the walk.
        // pendingTowerEntryTower marks this particular walk as "arrival =
        // climb inside and go hidden", which stepSquadMovement checks
        // once the path actually finishes (see there). Cleared whenever
        // a different order is given so an interrupted or redirected
        // walk never triggers a stale entry later.
        squad.pendingTowerEntryTower = (towerAtTile && towerAtTile.operatorSquad === squad && !squadIsOperatingTower) ? towerAtTile : null;

        // Ejecting (see the squadIsOperatingTower branch below) never
        // actually moves the squad's group - it just un-hides it in
        // place at the tower's own tile - so tapping the tower again
        // right after ejecting has nowhere to walk to: findPath from the
        // tower tile to itself returns nothing, and the squad would sit
        // stuck "pending" forever. Enter immediately in that case instead
        // of falling through to the walking path below.
        if (squad.pendingTowerEntryTower) {
          const enterTower = squad.pendingTowerEntryTower;
          const distToTower = Math.hypot(squad.group.position.x - enterTower.x, squad.group.position.z - enterTower.z);
          if (distToTower < 0.15) {
            squad.pendingTowerEntryTower = null;
            const groundY = getSurfaceY(enterTower.x, enterTower.z) || 0;
            squad.members.forEach(m => {
              if (m.userData.hp <= 0) return;
              m.userData.isOperatingTower = true;
              m.visible = false;
              if (m.userData.hpElement) m.userData.hpElement.style.display = 'none';
            });
            squad.group.position.set(enterTower.x, groundY, enterTower.z);
            squad.isMoving = false;
            squad.currentPath = [];
            spawnFloatingText(new THREE.Vector3(enterTower.x, groundY + 1.2, enterTower.z), 'Enters Watch Tower!', '#ffdd66');
            return;
          }
        }

        // Moving a squad that's currently operating the tower ejects it
        // first - visible and targetable again - and then falls through
        // to the normal move-order logic below, so it visibly steps out
        // and paths off toward wherever was tapped.
        if (squadIsOperatingTower) {
          squad.members.forEach(m => {
            m.userData.isOperatingTower = false;
            m.visible = true;
          });
          const ejectPos = new THREE.Vector3();
          squad.group.getWorldPosition(ejectPos);
          spawnFloatingText(ejectPos.add(new THREE.Vector3(0, 1.2, 0)), 'Exits Watch Tower!', '#ffdd66');
        }

        // Captured Fortress Garrison (see garrisonAllUnitsAtFortress) - a
        // squad hidden inside the keep is parked right on the keep's own
        // solid center tile, which has no walkable neighbor of its own
        // (the whole 3x3 keep block is solid - see ORC_FORTRESS_SIZE), so
        // findPath could never route it anywhere from there. Un-hiding it
        // and stepping it out to the same safe tile just past the gate
        // that garrisonAllUnitsAtFortress used to fan squads across
        // (fortressGateExitTile) before falling through to the normal
        // move order below gives it solid ground to path from immediately,
        // the same "eject, then walk off toward wherever was tapped" shape
        // as the Watch Tower case just above.
        const squadIsGarrisonedAtFortress = squad.members.some(m => m.userData.isGarrisonedAtFortress);
        if (squadIsGarrisonedAtFortress) {
          squad.isGarrisonedAtFortress = false;
          squad.members.forEach(m => { m.userData.isGarrisonedAtFortress = false; m.visible = true; });
          const exitTile = fortressGateExitTile();
          const exitY = getSurfaceY(exitTile.x, exitTile.z) || 0;
          squad.group.position.set(exitTile.x, exitY, exitTile.z);
          spawnFloatingText(new THREE.Vector3(exitTile.x, exitY + 1.2, exitTile.z), 'Leaves the Fortress!', '#ffdd66');
        }

        // Ninja passive (Parkour) / Slasher passive (Parkour) - a Ninja or
        // Slasher squad can path onto and stand on top of House/
        // Marketplace/Barracks/Blacksmith and Boulder tiles; every other
        // squad still routes around them. See canSquadParkour.
        const canParkour = canSquadParkour(squad.type);

        // Smart pathfinding: route around whatever tile every other player
        // squad currently stands on (blockedKeys), rather than walking
        // straight at it and only stopping once already touching it. Props
        // (trees/rocks/bushes) are NOT avoided - a squad walks straight
        // through them, same as raiders. If the tapped tile is another
        // squad's spot, findNearestOpenGoal walks the order back to the
        // closest open tile next to it instead of silently doing nothing.
        const blockedKeys = collidableSquadBlockedKeys(squad);
        const pathGoal = findNearestOpenGoal(goalX, goalZ, true, false, canParkour, blockedKeys) || { x: goalX, z: goalZ };
        const path = findPath(squad.group.position.x, squad.group.position.z, pathGoal.x, pathGoal.z, true, false, canParkour, blockedKeys);

        if (path && path.length > 0) {
          squad.currentPath = path;
          squad.currentWaypoint = 0;
          squad.moveGoal = { x: pathGoal.x, z: pathGoal.z };
          squad.moveGoalCanParkour = canParkour;
          squad.repathCooldown = 0;
          squad.repathFailStreak = 0;

          const firstStep = squad.currentPath[0];
          squad.targetPosition.set(firstStep.x, surfaceYFor(firstStep.x, firstStep.z, canParkour) ?? hitPoint.y + 0.5, firstStep.z);
          squad.isMoving = true;
          squad.group.userData.isMoving = true;
          squad.members.forEach(unit => unit.userData.isWalking = true);

          const startDx = squad.targetPosition.x - squad.group.position.x;
          const startDz = squad.targetPosition.z - squad.group.position.z;
          const startDir = new THREE.Vector3();
          if (Math.abs(startDx) > 0.05) {
            startDir.set(Math.sign(startDx), 0, 0);
          } else {
            startDir.set(0, 0, Math.sign(startDz));
          }
          squad.group.rotation.y = Math.atan2(startDir.x, startDir.z);

          targetHighlight.position.set(pathGoal.x, (surfaceYFor(pathGoal.x, pathGoal.z, canParkour) ?? hitPoint.y) + 0.51, pathGoal.z);
          targetHighlight.visible = true;
          showAttackArea(squad, pathGoal.x, pathGoal.z, surfaceYFor(pathGoal.x, pathGoal.z, canParkour) ?? hitPoint.y);
        }
      }
    });

    // --- Desktop hover feedback: outline the tile under the mouse cursor ---
    // Shows exactly which tile a click will order the selected squad to (and
    // switches to a pointer cursor over it) so tiles read as clickable on a
    // desktop. Mouse only - touch has no hover. White when a squad is
    // selected and ready to take the order, a dim red when none is.
    const hoverTile = new THREE.Group();
    const hoverPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.94, 0.94),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    hoverPlane.rotation.x = -Math.PI / 2;
    const hoverOutline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.47, 0, -0.47), new THREE.Vector3(0.47, 0, -0.47),
        new THREE.Vector3(0.47, 0, 0.47), new THREE.Vector3(-0.47, 0, 0.47)
      ]),
      new THREE.LineBasicMaterial({ color: 0xffffff })
    );
    hoverTile.add(hoverPlane, hoverOutline);
    hoverTile.visible = false;
    scene.add(hoverTile);

    let hoverCoords = null;
    let hoverUpdateQueued = false;

    function hideHoverTile() {
      hoverCoords = null;
      hoverTile.visible = false;
      renderer.domElement.style.cursor = '';
    }

    // Raycasts once per frame at most (not once per mousemove event).
    function updateHoverTile() {
      hoverUpdateQueued = false;
      if (!hoverCoords) return;
      const mainMenu = document.getElementById('main-menu');
      if (gamePaused || (mainMenu && !mainMenu.classList.contains('hidden'))) { hideHoverTile(); return; }

      touchVector.x = (hoverCoords.x / window.innerWidth) * 2 - 1;
      touchVector.y = -(hoverCoords.y / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(touchVector, camera);
      const hits = raycastWorld();
      // Over the Orc Fortress: no tile outline, but the pointer cursor shows
      // it's clickable (see hitOrcFortress).
      if (hitOrcFortress(hits.length > 0 ? hits[0].distance : Infinity)) {
        hoverTile.visible = false;
        renderer.domElement.style.cursor = 'pointer';
        return;
      }
      if (hits.length === 0) { hideHoverTile(); return; }

      const gx = Math.round(hits[0].point.x);
      const gz = Math.round(hits[0].point.z);
      const squad = squads[selectedSquadIndex];
      const canOrder = !!squad && squad.members.length > 0;
      const y = surfaceYFor(gx, gz, canOrder && canSquadParkour(squad.type));
      if (y === null || y === undefined) { hideHoverTile(); return; }

      const tint = canOrder ? 0xffffff : 0xff9a9a;
      hoverPlane.material.color.setHex(tint);
      hoverOutline.material.color.setHex(tint);
      hoverTile.position.set(gx, y + 0.52, gz);
      hoverTile.visible = true;
      renderer.domElement.style.cursor = canOrder ? 'pointer' : '';
    }

    renderer.domElement.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (e.buttons !== 0) { hideHoverTile(); return; } // dragging/panning the camera
      hoverCoords = { x: e.clientX, y: e.clientY };
      if (!hoverUpdateQueued) { hoverUpdateQueued = true; requestAnimationFrame(updateHoverTile); }
    });
    renderer.domElement.addEventListener('pointerleave', hideHoverTile);

    // --- 10. BAD NORTH COMBAT SYSTEM ENGINE & RAGDOLL / GORE SYSTEMS ---

    // Visual FX: Particle System (Enhanced Gore & Blood Droplets)
    function spawnParticle(pos, color, scale = 0.1, duration = 0.4, isGore = false) {
      const pMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const pGeo = new THREE.BoxGeometry(scale, scale, scale);
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.copy(pos);
      
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * (isGore ? 3.5 : 2),
        Math.random() * (isGore ? 3.5 : 2) + 1,
        (Math.random() - 0.5) * (isGore ? 3.5 : 2)
      );

      scene.add(pMesh);
      activeParticles.push({ mesh: pMesh, velocity, duration, age: 0, isGore });
    }

    // Ninja passive (Smoke Bomb) - a billowing gray cloud that puffs out
    // and hangs in the air where the Ninja vanished. Puffs use their own
    // activeSmokePuffs list (not activeParticles) since they need to
    // expand, drift gently, and fade out rather than fall under gravity.
    function spawnSmokeBombEffect(pos) {
      const PUFF_COUNT = 12;
      for (let i = 0; i < PUFF_COUNT; i++) {
        const shade = 0x777777 + Math.floor(Math.random() * 0x303030);
        const pMat = new THREE.MeshBasicMaterial({ color: shade, transparent: true, opacity: 0.75 });
        const startScale = 0.12 + Math.random() * 0.1;
        const pMesh = new THREE.Mesh(new THREE.SphereGeometry(startScale, 6, 5), pMat);
        pMesh.position.copy(pos).add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          Math.random() * 0.3,
          (Math.random() - 0.5) * 0.3
        ));

        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 0.9,
          0.5 + Math.random() * 0.6,
          (Math.random() - 0.5) * 0.9
        );

        scene.add(pMesh);
        activeSmokePuffs.push({
          mesh: pMesh,
          velocity,
          startScale,
          growth: 1.6 + Math.random() * 0.8, // final size = startScale * this
          duration: 1.1 + Math.random() * 0.6,
          age: 0
        });
      }

      // A brighter little flash at the drop point sells the "bomb" part
      // before the cloud takes over.
      spawnParticle(pos.clone(), 0xe8e8e0, 0.16, 0.25);
    }

    // A column of golden light rising out of the ground with an expanding
    // ring at its base - used by the Doctor's Resurrection passive
    // whenever it raises a fallen squad member back into the fight, and
    // reused by the Paladin's Holy Light passive for the ally it heals.
    // Reads as a distinct "holy" event rather than the grey Smoke Bomb
    // puff or a plain gore/impact particle burst.
    function spawnDivineResurrectionEffect(pos, big = false) {
      const scaleMult = big ? 1.6 : 1;

      const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      const beamGeo = new THREE.CylinderGeometry(0.2 * scaleMult, 0.34 * scaleMult, 2.2 * scaleMult, 16, 1, true);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.copy(pos).add(new THREE.Vector3(0, 1.1 * scaleMult, 0));
      scene.add(beam);

      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
      const ringGeo = new THREE.RingGeometry(0.28 * scaleMult, 0.4 * scaleMult, 28);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(pos).add(new THREE.Vector3(0, 0.05, 0));
      scene.add(ring);

      activeHolyBeams.push({ beam, ring, age: 0, duration: big ? 1.3 : 1.0 });

      // Golden sparks drifting/rising rather than tumbling, so the burst
      // reads as "raised up" instead of a normal hit-impact spray.
      const sparkCount = big ? 16 : 9;
      for (let i = 0; i < sparkCount; i++) {
        spawnParticle(
          pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5 * scaleMult, 0.1 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5 * scaleMult)),
          0xffe066, (0.08 + Math.random() * 0.05) * scaleMult, 0.6 + Math.random() * 0.3
        );
      }
    }

    // Bear Warrior passive (Summon Lightning) - a tall electric-blue bolt
    // striking straight down onto the target tile, with an expanding
    // ground ring at its base. Same rise/thin/fade rhythm as the Paladin's
    // Divine Resurrection beam above, just recolored and quicker (see the
    // activeLightningBolts update block), so it reads as a violent strike
    // rather than a slow holy pillar. Also reused by Paladin's Holy Light
    // smite (with a gold-white color instead of the default electric
    // blue) - same "bolt strikes down from above" shape reads just as
    // well as a smite as it does a lightning strike.
    function spawnLightningBoltEffect(pos, boltColor = 0xaef0ff, ringColor = 0xd6f9ff) {
      const boltMat = new THREE.MeshBasicMaterial({ color: boltColor, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
      const boltGeo = new THREE.CylinderGeometry(0.06, 0.16, 3.2, 8, 1, true);
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.copy(pos).add(new THREE.Vector3(0, 1.6, 0));
      scene.add(bolt);

      const ringMat = new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
      const ringGeo = new THREE.RingGeometry(0.22, 0.32, 24);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(pos).add(new THREE.Vector3(0, 0.05, 0));
      scene.add(ring);

      activeLightningBolts.push({ bolt, ring, age: 0, duration: 0.45 });

      const flashLight = new THREE.PointLight(boltColor, 3.5, 5);
      flashLight.position.copy(pos).add(new THREE.Vector3(0, 0.8, 0));
      scene.add(flashLight);
      setTimeout(() => scene.remove(flashLight), 150);

      for (let i = 0; i < 12; i++) {
        spawnParticle(
          pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.1 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6)),
          boltColor, 0.07 + Math.random() * 0.05, 0.4 + Math.random() * 0.2
        );
      }
    }

    // Paladin passive (Light Shock) - a double ring of holy energy that
    // blows outward from the Paladin to the ability's actual damage
    // radius (targetScale, computed from radius below) rather than the
    // small fixed-size rings the other ground effects on this page use -
    // this one needs to visually match where the AoE damage actually
    // lands. See the "Update Paladin Light Shock bursts" block for the
    // scale/fade animation and updatePaladinAbilities for the trigger.
    function spawnLightShockEffect(pos, radius) {
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
      const ringGeo = new THREE.RingGeometry(0.05, 0.16, 32);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(pos).add(new THREE.Vector3(0, 0.06, 0));
      scene.add(ring);

      // A tighter, brighter inner ring right behind the outer one, for a
      // double-pulse look instead of one flat expanding band.
      const ring2Mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
      const ring2Geo = new THREE.RingGeometry(0.02, 0.09, 24);
      const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
      ring2.rotation.x = -Math.PI / 2;
      ring2.position.copy(pos).add(new THREE.Vector3(0, 0.07, 0));
      scene.add(ring2);

      // How many multiples of the ring's own starting radius (0.16) it
      // needs to grow by to reach the ability's actual damage radius.
      const targetScale = Math.max(1, radius / 0.16);
      activeLightShockBursts.push({ ring, ring2, age: 0, duration: 0.55, targetScale });

      const flashLight = new THREE.PointLight(0xfff2c0, 3, 6);
      flashLight.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0));
      scene.add(flashLight);
      setTimeout(() => scene.remove(flashLight), 180);

      for (let i = 0; i < 14; i++) {
        spawnParticle(
          pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.1 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4)),
          0xfff2c0, 0.07 + Math.random() * 0.05, 0.45 + Math.random() * 0.25
        );
      }
    }

    // Kitsune Twinblade attack swings - a bright, camera-facing crescent
    // arc that flashes across the cut at the moment it lands, on top of
    // the ember/frost particle bursts already fired alongside it (see the
    // 'kitsuneTwinblade' branches in applyAttackPose). Built as two
    // concentric partial rings (a wider colored band + a thinner white-hot
    // core band, same "hot core fading to theme color" look the particle
    // fans already use) rather than a sprite, so it needs no texture asset.
    // Billboarded to the camera once at spawn - the swing itself only
    // lasts ~0.2-0.3s, nowhere near long enough for this isometric camera
    // to move far enough to make a static billboard read as wrong.
    // facingDir (optional): a horizontal THREE.Vector3/{x,z} pointing the
    // way the attack itself was thrown/swung (attacker -> target). When
    // given, the arc is turned to visually match that direction instead
    // of always landing in the same fixed camera-facing orientation -
    // used by Kitsune Twinblade's Quickdraw/Twin Strike below so the
    // slash reads as coming from the direction the blade actually swung.
    function spawnSlashArc(pos, { color = 0xffffff, coreColor = 0xffffff, radius = 0.8, arcSpan = Math.PI * 0.55, rotationZ = 0, duration = 0.22, facingDir = null } = {}) {
      const group = new THREE.Group();

      const outerGeo = new THREE.RingGeometry(radius * 0.7, radius, 24, 1, -arcSpan / 2, arcSpan);
      const outerMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
      const outer = new THREE.Mesh(outerGeo, outerMat);

      const innerSpan = arcSpan * 0.8;
      const innerGeo = new THREE.RingGeometry(radius * 0.82, radius * 0.94, 24, 1, -innerSpan / 2, innerSpan);
      const innerMat = new THREE.MeshBasicMaterial({ color: coreColor, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
      const inner = new THREE.Mesh(innerGeo, innerMat);

      group.add(outer, inner);
      group.position.copy(pos);
      group.quaternion.copy(camera.quaternion);
      let facingRotation = 0;
      if (facingDir && (facingDir.x || facingDir.z)) {
        // Approximates the horizontal attack direction as a roll around
        // the camera-facing plane - good enough at this isometric-ish
        // camera angle to visibly point the arc the way the swing went,
        // without needing a full off-billboard 3D orientation.
        facingRotation = Math.atan2(facingDir.x, facingDir.z);
      }
      group.rotateZ(rotationZ + facingRotation);
      group.renderOrder = 999;
      scene.add(group);

      activeSlashArcs.push({ group, outer, inner, age: 0, duration });
    }

    // Wokou passive (Bomb Throw) - a fiery burst of orange/black particles
    // where the thrown bomb lands, distinct from the grey Smoke Bomb puff
    // above so an exploding Wokou bomb reads as damage, not concealment.
    function spawnBombExplosion(pos) {
      const EXPLOSION_COLORS = [0xff8800, 0xffcc33, 0x552200, 0x1a1a1a];
      for (let i = 0; i < 14; i++) {
        const color = EXPLOSION_COLORS[Math.floor(Math.random() * EXPLOSION_COLORS.length)];
        spawnParticle(pos.clone(), color, 0.09 + Math.random() * 0.08, 0.5 + Math.random() * 0.3, false);
      }
      spawnParticle(pos.clone(), 0xffffaa, 0.22, 0.15);
    }

    // Slasher passive (Ghost Step) - a dark violet shockwave ring plus a
    // small core flash and a spray of shadowy shard particles, played
    // right where the Slasher is standing on a successful projectile
    // deflect (see triggerSlasherGhostStepDeflect). Distinct from the
    // fiery Bomb Throw explosion above - this reads as "torn open by shadow"
    // rather than a fiery blast, with one particle color (0x7fe8ff)
    // echoing the existing cyan blink streak/floating text so the two
    // effects still feel like one cohesive ability.
    // Generic colored ring+core burst - the shared shape behind
    // spawnShadowExplosion below (Slasher's Ghost Step) and the Kitsune
    // Twinblade ability bursts further down (spawnKitsuneFrostBurst/
    // spawnKitsuneWardBurst/spawnKitsuneRenewalBurst): an expanding ground
    // ring plus a rising core sphere, both fading out together, with a
    // scatter of particles in the caller's own palette on top. Reuses
    // activeShadowBursts for the ring/core animation regardless of color,
    // since that update loop (see animate()) only ever scales and fades
    // the two meshes - it has no shadow-specific behavior baked in.
    function spawnColorBurst(pos, ringColor, coreColor, particleColors, { ringHeight = 0.05, coreHeight = 0.5, duration = 0.4, particleCount = 14 } = {}) {
      const ringMat = new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
      const ringGeo = new THREE.RingGeometry(0.15, 0.32, 28);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(pos).add(new THREE.Vector3(0, ringHeight, 0));
      scene.add(ring);

      const coreMat = new THREE.MeshBasicMaterial({ color: coreColor, transparent: true, opacity: 0.9 });
      const coreGeo = new THREE.SphereGeometry(0.22, 10, 8);
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.copy(pos).add(new THREE.Vector3(0, coreHeight, 0));
      scene.add(core);

      activeShadowBursts.push({ ring, core, age: 0, duration });

      for (let i = 0; i < particleCount; i++) {
        const color = particleColors[Math.floor(Math.random() * particleColors.length)];
        spawnParticle(pos.clone().add(new THREE.Vector3(0, 0.4, 0)), color, 0.08 + Math.random() * 0.07, 0.35 + Math.random() * 0.25, false);
      }
    }

    function spawnShadowExplosion(pos) {
      spawnColorBurst(pos, 0x1a0a24, 0x2a1440, [0x120818, 0x2a1440, 0x4b2a63, 0x7fe8ff]);
    }

    // Kitsune Twinblade ability bursts - Frost Warden's own three passives
    // (Guard the Flank, Guardian's Ward, Fox Spirit Renewal) previously
    // only showed floating text with no accompanying visual, unlike Ember
    // Fang's Quickdraw/Flame Crescent or every other squad's passives on
    // this page. Each reuses spawnColorBurst above with its own palette so
    // the three read as distinct events at a glance: an icy blue shove, a
    // paler shield-blue ward, and a warm fox-fire renewal glow.
    function spawnKitsuneFrostBurst(pos) {
      spawnColorBurst(pos, 0x8fd0ff, 0xbfe8ff, [0x8fd0ff, 0xbfe8ff, 0xffffff], { duration: 0.35, particleCount: 10 });
    }
    function spawnKitsuneWardBurst(pos) {
      spawnColorBurst(pos, 0x6fb8ff, 0xffffff, [0x6fb8ff, 0x8fd0ff, 0xffffff], { ringHeight: 0.1, coreHeight: 0.9, duration: 0.5, particleCount: 12 });
    }
    function spawnKitsuneRenewalBurst(pos) {
      spawnColorBurst(pos, 0xff9c43, 0x8fffb0, [0xff9c43, 0x8fffb0, 0xffe066], { ringHeight: 0.1, coreHeight: 0.7, duration: 0.6, particleCount: 12 });
    }

    // Realistic Blood Spray & Splatter System
    function createBloodSplatter(impactPos, hitDir, bloodColor) {
      // Options menu - Blood Enabled toggle.
      if (!bloodEnabled) return;
      // Shadow Island Acolytes bleed a dark violet instead of the usual
      // red - callers pass ACOLYTE_BLOOD_COLOR for that victim, otherwise
      // this defaults to the classic red used everywhere else.
      const spriteColor = bloodColor || 0x880000;
      const isCustomColor = !!bloodColor;

      // 1. Particle Blood Spray burst
      for (let i = 0; i < 18; i++) {
        const sprDir = hitDir.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          Math.random() * 1.2,
          (Math.random() - 0.5) * 1.5
        )).normalize();

        const pMat = new THREE.MeshBasicMaterial({ color: spriteColor, transparent: true, opacity: 0.95 });
        const pSize = 0.03 + Math.random() * 0.06;
        const pMesh = new THREE.Mesh(new THREE.BoxGeometry(pSize, pSize, pSize), pMat);
        pMesh.position.copy(impactPos);

        const speed = 2.0 + Math.random() * 3.5;
        activeParticles.push({
          mesh: pMesh,
          velocity: sprDir.multiplyScalar(speed),
          duration: 0.6 + Math.random() * 0.4,
          age: 0,
          isGore: true
        });
        scene.add(pMesh);
      }

      // 2. Blood Decal on the surface beneath the impact (land or water)
      const surfaceY = getSurfaceY(impactPos.x, impactPos.z);
      if (surfaceY !== null) {
        // Land: permanent blood splatter decal (as before)
        if (Math.abs(impactPos.y - surfaceY) < 1.8) {
          const radius = 0.25 + Math.random() * 0.35;
          // Spread out from other land blood decals nearby, so repeated hits
          // in one spot (a chokepoint, a pike wall) pool into a spatter
          // instead of every decal landing exactly on top of the last one.
          const jitteredX = impactPos.x + (Math.random() - 0.5) * 0.2;
          const jitteredZ = impactPos.z + (Math.random() - 0.5) * 0.2;
          const spot = resolveSpacing(
            jitteredX, jitteredZ, BLOOD_DECAL_MIN_SPACING,
            (px, pz) => nearestOverlap(bloodDecals, null, BLOOD_DECAL_MIN_SPACING, px, pz,
              b => b.isWater ? null : b.mesh.position)
          );
          const spotY = getSurfaceY(spot.x, spot.z) ?? surfaceY;
          // Each land decal now gets its own material instance rather than
          // sharing bloodDecalMat, since it needs to fade its own opacity
          // independently over BLOOD_DECAL_LIFETIME (see the "Update Blood
          // Decals" loop) without dimming every other decal placed so far.
          const decalMat = new THREE.MeshLambertMaterial({ color: bloodColor || 0x660000, transparent: true, opacity: 0.8, depthWrite: false });
          const bloodMesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 8), decalMat);
          bloodMesh.rotation.x = -Math.PI / 2;
          bloodMesh.position.set(
            spot.x,
            spotY + 0.016 + bloodDecals.length * 0.0001, // Prevent Z-fighting
            spot.z
          );
          bloodMesh.rotation.z = Math.random() * Math.PI * 2;
          scene.add(bloodMesh);
          bloodDecals.push({ mesh: bloodMesh, isWater: false, age: 0, maxAge: BLOOD_DECAL_LIFETIME, baseOpacity: 0.8 });
        }
      } else if (Math.abs(impactPos.y - WATER_SURFACE_Y) < 2.0) {
        // Water: blood blooms outward, blends toward the water color, then fades away
        const radius = 0.18 + Math.random() * 0.2;
        const waterBloodColor = isCustomColor ? bloodColor : 0x8a0000;
        const waterBloodMat = new THREE.MeshBasicMaterial({
          color: waterBloodColor,
          transparent: true,
          opacity: 0.7,
          depthWrite: false
        });
        const bloodMesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 12), waterBloodMat);
        bloodMesh.rotation.x = -Math.PI / 2;
        bloodMesh.rotation.z = Math.random() * Math.PI * 2;
        bloodMesh.position.set(
          impactPos.x + (Math.random() - 0.5) * 0.2,
          WATER_SURFACE_Y + 0.02,
          impactPos.z + (Math.random() - 0.5) * 0.2
        );
        scene.add(bloodMesh);
        bloodDecals.push({
          mesh: bloodMesh,
          isWater: true,
          age: 0,
          maxAge: BLOOD_DECAL_LIFETIME,
          baseOpacity: 0.7,
          startColor: new THREE.Color(waterBloodColor),
          endColor: waterMat.color.clone(),
          driftDir: new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5)).normalize().multiplyScalar(0.05)
        });
      }
    }

    // Visual FX: Floating Combat Text
    function spawnFloatingText(pos, text, colorStr = '#ffffff') {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.color = colorStr;
      el.style.fontWeight = 'bold';
      el.style.fontSize = '12px';
      el.style.textShadow = '1px 1px 2px #000';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '20';
      el.textContent = text;
      hpContainer.appendChild(el);

      activeFloatingTexts.push({
        element: el,
        pos: pos.clone(),
        age: 0,
        maxAge: 0.6
      });
    }

    // Projectile Spawner (Arrows & Magic Orbs)
    // shooterUnitType records who actually loosed the shot ('archers',
    // 'cavalry', 'raiders', or 'militia' for arrows) so that on impact we
    // can tell a real Archer's arrow apart from a Cavalry/Raider/Militia
    // bow-user's - only the former should ever get Piercing Shot. See the
    // dmgType lookup where activeProjectiles are resolved.
    function spawnProjectile(startPos, targetUnit, type, damageMultiplier, shooterUnitType, poisonOnHit) {
      // Wokou Bomb Throw - a small round powder bomb with a lit fuse,
      // built as its own little Group instead of a single primitive so it
      // reads unmistakably as "bomb" rather than another arrow/orb.
      if (type === 'bomb') {
        const bombMesh = new THREE.Group();
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshLambertMaterial({ color: 0x1c1c1c }));
        const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 5), new THREE.MeshLambertMaterial({ color: 0x5a3a1e }));
        fuse.position.y = 0.11;
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffaa22 }));
        spark.position.y = 0.16;
        bombMesh.add(ball, fuse, spark);
        bombMesh.position.copy(startPos);
        scene.add(bombMesh);

        activeProjectiles.push({
          mesh: bombMesh,
          targetUnit,
          type,
          shooterType: shooterUnitType,
          spinSpeed: 9,
          speed: 7,
          damage: 38 * (damageMultiplier || 1)
        });
        return;
      }

      let geo, mat;
      if (type === 'arrow') {
        geo = new THREE.CylinderGeometry(0.01, 0.01, 0.3);
        // Cylinders are built lying along the Y (vertical) axis by default.
        // Rotate the geometry so its length runs along Z instead - that's
        // the axis mesh.lookAt() points at the target, so the shaft now
        // actually swings around to face its horizontal flight direction
        // instead of always hanging straight up like a vertical peg.
        geo.rotateX(Math.PI / 2);
        mat = new THREE.MeshLambertMaterial({ color: 0x443322 });
      } else if (type === 'bolt') {
        // Crossbow bolt - shorter and noticeably thicker than an arrow
        // shaft, so it reads as a heavier, harder-hitting projectile in
        // flight even at a glance.
        geo = new THREE.CylinderGeometry(0.018, 0.018, 0.2);
        geo.rotateX(Math.PI / 2);
        mat = new THREE.MeshLambertMaterial({ color: 0x2e2e2e });
      } else if (type === 'shuriken') {
        // Flat spinning star - a thin octahedron reads as a spinning
        // 4-point blade at this scale without needing custom geometry.
        geo = new THREE.OctahedronGeometry(0.09, 0);
        geo.scale(1, 0.15, 1);
        mat = new THREE.MeshLambertMaterial({ color: 0xcccccc, emissive: 0x222222 });
      } else if (type === 'spear') {
        // Thrown javelin for the Raider Javelin Throw passive - a slim
        // wooden shaft, thicker and longer than an arrow so it reads as
        // a hefted spear in flight rather than a stray arrow.
        geo = new THREE.CylinderGeometry(0.02, 0.02, 0.55);
        geo.rotateX(Math.PI / 2);
        mat = new THREE.MeshLambertMaterial({ color: 0x8a5a2a });
      } else if (type === 'darkBolt') {
        // Shadow Island Acolyte bolt - same orb shape as a Mage's Magic
        // Missile, recolored to the cult's dark violet so it reads as a
        // different, more sinister casting.
        geo = new THREE.SphereGeometry(0.12, 8, 8);
        mat = new THREE.MeshLambertMaterial({ color: 0x6a2d82, emissive: 0x3d1a52 });
      } else if (type === 'gargoyleBolt') {
        // Gargoyle bolt - hurled from its raised clawed hand (see the
        // isRaiderGargoyle cast-pose branch in applyAttackPose), same
        // conjured-projectile pattern as the Acolyte's Dark Bolt/Lich's
        // Frostbolt above, but a rough jagged stone shard instead of a
        // smooth magic orb.
        geo = new THREE.DodecahedronGeometry(0.1, 0);
        mat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a, emissive: 0x2e2e2e });
      } else if (type === 'throwingAxe') {
        // Wolf Warrior's thrown Double Axe (see the isWolfWarriorRaider
        // branch in processUnitAttack) - a flat wedge of a head reads as
        // a tumbling axe blade in flight, spun fast by spinSpeed below
        // rather than flying arrow-straight like a javelin/bolt.
        geo = new THREE.BoxGeometry(0.22, 0.16, 0.035);
        mat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
      } else if (type === 'frostbolt') {
        // Lich bolt - conjured straight out of its raised hand (see the
        // isLich cast-pose branch below) with no staff or weapon mesh
        // involved. Same orb shape as a Mage's Magic Missile/Acolyte's
        // Dark Bolt, recolored pale icy blue with a brighter cyan-white
        // emissive core so it reads as frost rather than either.
        geo = new THREE.SphereGeometry(0.12, 8, 8);
        mat = new THREE.MeshLambertMaterial({ color: 0xaef2ff, emissive: 0x2ec8e6 });
      } else if (type === 'flameSlash') {
        // Kitsune Twinblade's Flame Crescent (Ember Fang) - a thin,
        // elongated blade of fox-fire thrown diagonally rather than an
        // arrow/orb flying point-first. Built as a flattened box and
        // rotated 45 degrees around its own long axis so the flat face
        // reads as a diagonal slash streak once mesh.lookAt() below turns
        // the whole thing to face its flight direction, same way an
        // arrow's geo.rotateX(Math.PI/2) above re-aims a stock shape onto
        // the flight axis rather than needing bespoke crescent geometry.
        geo = new THREE.BoxGeometry(0.34, 0.07, 0.02);
        geo.rotateZ(Math.PI / 4);
        mat = new THREE.MeshLambertMaterial({ color: 0xff5522, emissive: 0xff8800 });
      } else {
        geo = new THREE.SphereGeometry(0.12, 8, 8);
        mat = new THREE.MeshLambertMaterial({ color: 0x00ffff, emissive: 0x0288d1 });
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(startPos);
      scene.add(mesh);

      activeProjectiles.push({
        mesh,
        targetUnit,
        type,
        shooterType: shooterUnitType,
        // War Elephant passive (Venom Arrows) - set true only for a
        // Desert Warrior's arrow (see the ranged attack call site below,
        // gated on uData.elephantRole==='archer'); resolved into an
        // applyPoison call in the projectile-hit loop once this lands.
        poisonOnHit: !!poisonOnHit,
        spinSpeed: type === 'shuriken' ? 22 : (type === 'throwingAxe' ? 16 : 0),
        speed: type === 'arrow' ? 12 : (type === 'bolt' ? 15 : (type === 'shuriken' ? 14 : (type === 'spear' ? 10 : (type === 'throwingAxe' ? 11 : (type === 'frostbolt' ? 9 : (type === 'gargoyleBolt' ? 10 : (type === 'flameSlash' ? 13 : 8))))))),
        damage: (type === 'arrow' ? 28 : (type === 'bolt' ? 50 : (type === 'shuriken' ? 24 : (type === 'spear' ? 22 : (type === 'throwingAxe' ? BERSERKER_BASE_DMG : (type === 'frostbolt' ? 38 : (type === 'gargoyleBolt' ? 30 : (type === 'flameSlash' ? KITSUNE_FLAME_SLASH_DMG : 45)))))))) * (damageMultiplier || 1)
      });
    }

    // Mage passive - Magic Missile: on any Mage cast, a 5% chance to
    // unleash a rapid 3-shot barrage at the same target instead of the
    // usual single bolt. The first bolt is the normal cast the caller
    // already fires; this just queues the extra shots to loose in quick
    // succession afterward, each dealing full Mage bolt damage.
    const MAGIC_MISSILE_CHANCE = 0.05;
    const MAGIC_MISSILE_BURST_COUNT = 3; // total bolts including the initial cast
    const MAGIC_MISSILE_BURST_INTERVAL = 0.12; // seconds between each extra bolt

    const pendingMagicMissiles = [];

    function queueMagicMissileBarrage(attackerUnit, targetUnit, damageMultiplier) {
      spawnFloatingText(
        attackerUnit.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.9, 0)),
        'MAGIC MISSILE!', '#66e0ff'
      );
      for (let i = 1; i < MAGIC_MISSILE_BURST_COUNT; i++) {
        pendingMagicMissiles.push({
          attackerUnit,
          targetUnit,
          damageMultiplier,
          timer: MAGIC_MISSILE_BURST_INTERVAL * i
        });
      }
    }

    // Fires off any queued barrage bolts whose stagger timer has elapsed.
    // Recomputes the launch position from the caster's CURRENT position
    // each time (rather than one fixed spot from when the barrage was
    // queued) so a moving Mage's follow-up bolts still originate from it.
    function updatePendingMagicMissiles(delta) {
      for (let i = pendingMagicMissiles.length - 1; i >= 0; i--) {
        const m = pendingMagicMissiles[i];
        m.timer -= delta;
        if (m.timer > 0) continue;

        pendingMagicMissiles.splice(i, 1);
        if (!m.attackerUnit || m.attackerUnit.userData.hp <= 0) continue;
        if (!m.targetUnit || m.targetUnit.userData.hp <= 0) continue;

        const startPos = new THREE.Vector3();
        m.attackerUnit.getWorldPosition(startPos);
        startPos.y += 0.5;
        spawnProjectile(startPos, m.targetUnit, 'magic', m.damageMultiplier);
      }
    }

    // Cavalry passive - Volley Fire: a Bow-armed rider never looses just one
    // arrow. Every shot is followed by a couple of extra arrows fired in
    // rapid succession at the same target, queued the same way a Mage's
    // Magic Missile barrage is.
    const CAVALRY_VOLLEY_EXTRA_ARROWS = 2; // arrows beyond the initial shot
    const CAVALRY_VOLLEY_INTERVAL = 0.12; // seconds between each extra arrow

    const pendingCavalryVolleys = [];

    function queueCavalryVolley(attackerUnit, targetUnit, damageMultiplier) {
      spawnFloatingText(
        attackerUnit.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.9, 0)),
        'VOLLEY!', '#e0c060'
      );
      for (let i = 1; i <= CAVALRY_VOLLEY_EXTRA_ARROWS; i++) {
        pendingCavalryVolleys.push({
          attackerUnit,
          targetUnit,
          damageMultiplier,
          timer: CAVALRY_VOLLEY_INTERVAL * i
        });
      }
    }

    // Fires off any queued volley arrows whose stagger timer has elapsed,
    // mirroring updatePendingMagicMissiles below.
    function updatePendingCavalryVolleys(delta) {
      for (let i = pendingCavalryVolleys.length - 1; i >= 0; i--) {
        const v = pendingCavalryVolleys[i];
        v.timer -= delta;
        if (v.timer > 0) continue;

        pendingCavalryVolleys.splice(i, 1);
        if (!v.attackerUnit || v.attackerUnit.userData.hp <= 0) continue;
        if (!v.targetUnit || v.targetUnit.userData.hp <= 0) continue;

        const startPos = new THREE.Vector3();
        v.attackerUnit.getWorldPosition(startPos);
        startPos.y += 0.5;
        spawnProjectile(startPos, v.targetUnit, 'arrow', v.damageMultiplier, v.attackerUnit.userData.unitType);
      }
    }

    // Cavalry passive - Bleeding: a Sword-armed rider's hit doesn't just
    // deal its normal damage, it opens a wound that keeps bleeding for a
    // few seconds afterward. See applyDamage's 'bleedTick' branch for how
    // each tick is actually resolved.
    const BLEED_TICK_INTERVAL = 1; // seconds between bleed ticks
    const BLEED_TICK_COUNT = 3; // number of ticks
    const BLEED_TICK_DAMAGE = 6; // damage per tick

    function applyBleed(targetUnit) {
      const uData = targetUnit.userData;
      if (uData.hp <= 0) return;
      uData.bleedTicksRemaining = BLEED_TICK_COUNT;
      uData.bleedTickTimer = BLEED_TICK_INTERVAL;
      const pos = new THREE.Vector3();
      targetUnit.getWorldPosition(pos);
      spawnFloatingText(pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 'BLEEDING!', '#c0203a');
    }

    // Dragon Ronin passive - Dragon's Breath: every landed katana hit
    // wreathes the target in flame, opening a burn that ticks fire damage
    // for a few seconds afterward - same shape as Cavalry's Bleeding. See
    // applyDamage's 'burnTick' branch for how each tick is resolved.
    const BURN_TICK_INTERVAL = 1; // seconds between burn ticks
    const BURN_TICK_COUNT = 3; // number of ticks
    const BURN_TICK_DAMAGE = 8; // damage per tick

    // "Burning Death" - the lingering-death variant a unit enters when a
    // burn tick (see the 'burnTick' branch in applyDamage) lands the
    // killing blow. Unlike a normal "suspected death" crawl/stagger, it
    // doesn't calmly bleed out - it panics, sprinting in a random,
    // constantly-changing direction and flailing at the flames, until it
    // finally collapses and its corpse settles into a charred, burnt
    // appearance instead of the normal ragdoll skin tones/colors.
    const BURN_DEATH_DURATION = 4;      // seconds spent panicking before it finally collapses
    const BURN_PANIC_SPEED = 0.55;      // faster than a stagger - blind, terrified sprinting
    const BURN_DIR_CHANGE_MIN = 0.25;   // seconds between panicked direction changes (min)
    const BURN_DIR_CHANGE_MAX = 0.6;    // seconds between panicked direction changes (max)
    const BURN_EMBER_INTERVAL = 0.12;   // seconds between flame bursts while ablaze
    const BURN_FLAME_PARTICLES_PER_TICK = 5; // how many flame licks spawn per burst, spread head-to-foot
    const BURN_FLAME_HEIGHT_MIN = 0.05; // lowest flame height (ankles)
    const BURN_FLAME_HEIGHT_MAX = 1.05; // highest flame height (just above the head)
    const BURN_FLAME_RADIUS = 0.2;      // horizontal spread around the body's center
    const BURN_FLAME_COLORS = [0xff6a1a, 0xffcc44, 0xff2200, 0xff9922];
    const BURNT_SKIN_COLOR = 0x2b2420;  // charred flesh
    const BURNT_BODY_COLOR = 0x1c1815;  // charred/blackened clothing & armor
    const BURNT_PANTS_COLOR = 0x171310; // charred pants

    function applyBurn(targetUnit) {
      const uData = targetUnit.userData;
      if (uData.hp <= 0) return;
      uData.burnTicksRemaining = BURN_TICK_COUNT;
      uData.burnTickTimer = BURN_TICK_INTERVAL;
      const pos = new THREE.Vector3();
      targetUnit.getWorldPosition(pos);
      spawnFloatingText(pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 'BURNING!', '#ff6a1a');
    }

    // War Elephant passive - Venom Arrows: every arrow that lands from
    // either Desert Warrior (see the poisonOnHit projectile flag set at
    // the ranged attack call site, and resolved in the projectile-hit
    // loop) opens a venomous wound that keeps ticking for a few seconds
    // afterward - same shape as Cavalry's Bleeding/Dragon Ronin's Dragon's
    // Breath above. See applyDamage's 'poisonTick' branch for how each
    // tick is actually resolved.
    const POISON_TICK_INTERVAL = 1; // seconds between poison ticks
    const POISON_TICK_COUNT = 3; // number of ticks
    const POISON_TICK_DAMAGE = 7; // damage per tick

    function applyPoison(targetUnit) {
      const uData = targetUnit.userData;
      if (uData.hp <= 0) return;
      uData.poisonTicksRemaining = POISON_TICK_COUNT;
      uData.poisonTickTimer = POISON_TICK_INTERVAL;
      const pos = new THREE.Vector3();
      targetUnit.getWorldPosition(pos);
      spawnFloatingText(pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 'POISONED!', '#5fbf3a');
    }

    // Generic heal-over-time buff - same DOT shape as applyBurn/applyPoison
    // above, just restoring HP instead of removing it. totalAmount is
    // split evenly across tickCount ticks, spaced tickInterval seconds
    // apart (see the regenTicksRemaining bookkeeping in the main unit
    // update loop for where each tick actually fires). Currently only
    // used by Kitsune Twinblade's Fox Spirit Renewal passive, but kept
    // generic (not named/keyed to that squad) in case something else
    // wants a heal-over-time later.
    function applyRegen(targetUnit, totalAmount, tickCount, tickInterval) {
      const uData = targetUnit.userData;
      if (uData.hp <= 0) return;
      uData.regenTicksRemaining = tickCount;
      uData.regenTickTimer = tickInterval;
      uData.regenTickInterval = tickInterval;
      uData.regenTickAmount = totalAmount / tickCount;
      const pos = new THREE.Vector3();
      targetUnit.getWorldPosition(pos);
      spawnFloatingText(pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 'REGENERATING', '#8fffb0');
    }

    // Chakram Dancers passive (Spinning Shield) - every attack this unit
    // swings, whether or not it actually lands on anything alive, tops
    // up its own overshield by a slice of its max HP (see the trigger
    // site in the default melee branch below). Capped at the unit's own
    // max HP so it can't stack into permanent invulnerability. The
    // shield is drained before HP on any incoming hit - see
    // applyDamage's absorbShield check - and its bar (hpShieldFillElement)
    // is reset to empty by equipUnit on any re-equip.
    const CHAKRAM_DANCER_SHIELD_PCT = 0.05; // 5% of max HP added per attack

    function applyChakramDancerShield(unit) {
      const uData = unit.userData;
      if (uData.hp <= 0) return;
      uData.absorbShield = Math.min(uData.maxHp, (uData.absorbShield || 0) + uData.maxHp * CHAKRAM_DANCER_SHIELD_PCT);
      if (uData.hpShieldFillElement) {
        uData.hpShieldFillElement.style.width = Math.max(0, (uData.absorbShield / uData.maxHp) * 100) + '%';
      }
      const pos = new THREE.Vector3();
      unit.getWorldPosition(pos);
      spawnFloatingText(pos.clone().add(new THREE.Vector3(0, 0.6, 0)), '+SHIELD', '#46d2ff');
    }

    // Dragon Ronin attack VFX - a small burst of orange/red flame
    // particles at the point of impact, reusing the same particle system
    // as the Wokou Bomb Throw's fiery burst.
    function spawnDragonFlameBurst(pos) {
      const flameColors = [0xff6a00, 0xffb347, 0xff3300];
      for (let i = 0; i < 7; i++) {
        const color = flameColors[Math.floor(Math.random() * flameColors.length)];
        spawnParticle(pos.clone(), color, 0.1 + Math.random() * 0.09, 0.35 + Math.random() * 0.25, false);
      }
    }

    // Dragon Ronin passive - Second Wind: once its HP drops to/below 40%
    // of max, it downs the flask at its hip on the spot, healing 50% of
    // its max HP in one shot - a one-time emergency heal per life, not a
    // repeatable sustain (see uData.secondWindUsed). Layered on top of
    // its already-oversized HP pool (DRAGON_RONIN_HP_MULT), this is what
    // makes the Dragon Ronin such a slow, punishing unit to actually
    // bring down.
    const DRAGON_SECOND_WIND_THRESHOLD = 0.4; // fires once HP falls to/below 40% of max
    const DRAGON_SECOND_WIND_HEAL_PCT = 0.5;  // heals 50% of max HP
    const DRAGON_SECOND_WIND_DRINK_DURATION = 1.1; // seconds the drink animation holds

    function maybeTriggerDragonSecondWind(targetUnit) {
      const uData = targetUnit.userData;
      if (uData.unitType !== 'dragonRonin' || uData.secondWindUsed) return;
      if (uData.hp <= 0 || uData.hp / uData.maxHp > DRAGON_SECOND_WIND_THRESHOLD) return;
      uData.secondWindUsed = true;

      const healAmount = uData.maxHp * DRAGON_SECOND_WIND_HEAL_PCT;
      uData.hp = Math.min(uData.maxHp, uData.hp + healAmount);
      if (uData.hpFillElement) {
        const pct = Math.max(0, (uData.hp / uData.maxHp) * 100);
        uData.hpFillElement.style.width = pct + '%';
      }

      const targetWorldPos = new THREE.Vector3();
      targetUnit.getWorldPosition(targetWorldPos);
      spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'SECOND WIND!', '#66ff88');
      spawnFloatingText(targetWorldPos, `+${Math.round(healAmount)}`, '#66ff88');
      for (let i = 0; i < 6; i++) {
        spawnParticle(
          targetWorldPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3)),
          0x66ff88, 0.1 + Math.random() * 0.08, 0.4
        );
      }

      // Drinking-potion animation - see applyAttackPose's 'drinkPotion'
      // branch, which handles raising the now-visible flask to the mouth
      // and lowering it again once the drink finishes.
      if (uData.potionMesh) uData.potionMesh.visible = true;
      uData.attackAnimPoseOverride = 'drinkPotion';
      uData.attackAnimDuration = DRAGON_SECOND_WIND_DRINK_DURATION;
      uData.attackAnimTimer = uData.attackAnimDuration;
    }

    // Steel Revenant passive - Unbreakable: once its HP drops to/below
    // 20% of max, every hit that leaves it alive and still that low
    // rolls a flat STEEL_REVENANT_UNBREAKABLE_CHANCE shot at instantly
    // healing 80% of its max HP in one burst - unlike the Dragon Ronin's
    // guaranteed, one-time Second Wind above, this is a repeatable
    // gamble that can in principle go off more than once in a fight if
    // it's ever dragged back down under the threshold again. Self-
    // limiting in practice: an 80%-of-max heal from at-or-below 20%
    // almost always lands it back above the threshold, so it naturally
    // stops rolling until it's genuinely back in trouble.
    const STEEL_REVENANT_UNBREAKABLE_HP_THRESHOLD = 0.2; // rolls only at/below 20% HP
    const STEEL_REVENANT_UNBREAKABLE_CHANCE = 0.2;        // 20% chance per qualifying hit
    const STEEL_REVENANT_UNBREAKABLE_HEAL_PCT = 0.8;       // heals 80% of max HP
    const STEEL_REVENANT_UNBREAKABLE_ANIM_DURATION = 1.0;  // seconds the chest-touch cast holds
    const STEEL_REVENANT_UNBREAKABLE_COLOR = 0x33ffcc;     // same spectral teal as the bound soul (createSteelRevenantSoulMesh) - the armor is knitting itself back together with the same energy

    function maybeTriggerSteelRevenantUnbreakable(targetUnit) {
      const uData = targetUnit.userData;
      if (uData.unitType !== 'steelRevenant') return;
      if (uData.hp <= 0 || uData.hp / uData.maxHp > STEEL_REVENANT_UNBREAKABLE_HP_THRESHOLD) return;
      if (Math.random() >= STEEL_REVENANT_UNBREAKABLE_CHANCE) return;

      const healAmount = uData.maxHp * STEEL_REVENANT_UNBREAKABLE_HEAL_PCT;
      uData.hp = Math.min(uData.maxHp, uData.hp + healAmount);
      if (uData.hpFillElement) {
        const pct = Math.max(0, (uData.hp / uData.maxHp) * 100);
        uData.hpFillElement.style.width = pct + '%';
      }

      const targetWorldPos = new THREE.Vector3();
      targetUnit.getWorldPosition(targetWorldPos);
      spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'UNBREAKABLE!', '#33ffcc');
      spawnFloatingText(targetWorldPos, `+${Math.round(healAmount)}`, '#33ffcc');
      for (let i = 0; i < 8; i++) {
        spawnParticle(
          targetWorldPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3)),
          STEEL_REVENANT_UNBREAKABLE_COLOR, 0.1 + Math.random() * 0.08, 0.45
        );
      }

      // Left-hand-to-chest cast pose - see applyAttackPose's
      // 'unbreakable' branch, which drives the arm into place and pulses
      // the chest-glow mesh (uData.unbreakableGlowMesh, parented to the
      // torso at equip time) while it holds.
      uData.attackAnimPoseOverride = 'unbreakable';
      uData.attackAnimDuration = STEEL_REVENANT_UNBREAKABLE_ANIM_DURATION;
      uData.attackAnimTimer = uData.attackAnimDuration;
    }

    // Immortal passive - Resurrection: the first time an Immortal's hp
    // would hit 0, it instead rises back up with half its (already
    // boosted - see IMMORTAL_HP_MULT) max HP restored in a burst of
    // ghostly light, rather than going through the normal
    // killUnit/startDeathSequence path. One-time reprieve per life - a
    // second lethal hit kills it for good (see uData.immortalResurrected,
    // reset fresh on equip). Checked at the exact moment hp would hit 0 in
    // every applyDamage death branch, the same way Desert Bandit's Loot &
    // Flee and Akuma's Instant Vanish are.
    const IMMORTAL_RESURRECT_HEAL_PCT = 0.5; // comes back at 50% of max HP

    function maybeTriggerImmortalResurrection(targetUnit) {
      const uData = targetUnit.userData;
      // Goddess of Life passive - Second Dawn: shares this same "hp would hit
      // 0" checkpoint (see goddessOfLifeRebirth), so every applyDamage death
      // branch that already checks for an Immortal covers her too.
      if (uData.unitType === 'goddessOfLife') return goddessOfLifeRebirth(targetUnit);
      if (uData.raiderFaction !== 'immortal' || uData.immortalResurrected) return false;
      uData.immortalResurrected = true;

      uData.hp = Math.max(1, Math.round(uData.maxHp * IMMORTAL_RESURRECT_HEAL_PCT));
      if (uData.hpFillElement) {
        const pct = Math.max(0, (uData.hp / uData.maxHp) * 100);
        uData.hpFillElement.style.width = pct + '%';
      }

      const targetWorldPos = new THREE.Vector3();
      targetUnit.getWorldPosition(targetWorldPos);
      spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'RESURRECTED!', '#c8d0ff');
      spawnFloatingText(targetWorldPos, `+${uData.hp}`, '#c8d0ff');
      for (let i = 0; i < 8; i++) {
        spawnParticle(
          targetWorldPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.2 + Math.random() * 0.5, (Math.random() - 0.5) * 0.35)),
          0xc8d0ff, 0.1 + Math.random() * 0.09, 0.45
        );
      }

      // A brief hurt-stun as it rises, same read as an ordinary hit rather
      // than snapping straight back into a fighting stance.
      uData.stunTimer = 0.3;

      return true;
    }

    // Dragon Ronin passive - Sword Dash: a small chance, each time it
    // would otherwise land a normal katana swing, to instead flash-step
    // through the target in a dragon-empowered dash - a guaranteed kill
    // (same shield/Fortitude-bypassing instant-kill path as Cavalry's
    // Charge) that also wreathes the target in flame on the way down.
    const DRAGON_SWORD_DASH_CHANCE = 0.08; // 8% chance per katana swing
    const DRAGON_SWORD_DASH_COOLDOWN = 10; // seconds before it can trigger again

    function triggerDragonSwordDash(attackerUnit, targetUnit, attackerWorldPos) {
      attackerUnit.userData.swordDashCooldown = DRAGON_SWORD_DASH_COOLDOWN;

      const targetWorldPos = new THREE.Vector3();
      targetUnit.getWorldPosition(targetWorldPos);

      // Actually teleport the attacker exactly 2 tiles in a straight
      // cardinal line toward the target, rather than just a cosmetic
      // lunge in place - a real flash-step. The Dragon Ronin is always
      // a singleton squad, so its one member's parent group IS its
      // whole on-map position; moving the group (not the member's tiny
      // in-formation offset) is what actually relocates it on the
      // battlefield. The direction toward the target is snapped to
      // whichever single grid axis (X or Z) it's more aligned with, so
      // the dash always reads as one clean straight 2-tile hop instead
      // of a diagonal or an odd fractional distance. Steps one tile at
      // a time so it can't hop clean over a blocker to land past it,
      // and does nothing at all (keeps the normal in-place pose) if
      // even a single tile isn't clear, or if the squad is currently
      // mid-march and shouldn't be yanked off its path.
      const squadGroup = attackerUnit.parent;
      const dx = targetWorldPos.x - attackerWorldPos.x;
      const dz = targetWorldPos.z - attackerWorldPos.z;
      const dist = Math.hypot(dx, dz);
      if (squadGroup && !squadGroup.userData.isMoving && dist > 0.001) {
        // Snap to a single straight cardinal direction - whichever axis
        // has the larger offset to the target - instead of the raw
        // (possibly diagonal) direction vector.
        const straightX = Math.abs(dx) >= Math.abs(dz) ? Math.sign(dx) : 0;
        const straightZ = straightX === 0 ? Math.sign(dz) : 0;
        const originX = squadGroup.position.x, originZ = squadGroup.position.z;
        let landX = Math.round(originX), landZ = Math.round(originZ);
        let tilesMoved = 0;
        for (let step = 1; step <= 2; step++) {
          const nextX = Math.round(originX + straightX * step);
          const nextZ = Math.round(originZ + straightZ * step);
          const clear = isTileWalkable(nextX, nextZ) &&
            !buildingTileKeys.has(nextX + ',' + nextZ) &&
            !propTileKeys.has(nextX + ',' + nextZ);
          if (!clear) break;
          landX = nextX; landZ = nextZ; tilesMoved = step;
        }
        if (tilesMoved > 0) {
          const landY = getSurfaceY(landX, landZ);
          squadGroup.position.set(landX, landY !== null ? landY : squadGroup.position.y, landZ);
        }
        attackerUnit.rotation.y = Math.atan2(straightX, straightZ);
      }

      // Dedicated flash-step pose (see applyAttackPose's 'swordDash'
      // branch) instead of falling through to the normal Spinning
      // Slash - a single fast explosive lunge/thrust rather than the
      // bigger overhead wind-up-and-cut every ordinary swing uses, so
      // the ability reads as its own distinct move. Set after the
      // generic melee branch above already primed attackAnimTimer, so
      // this simply overwrites it with the dash's own faster duration.
      attackerUnit.userData.attackAnimPoseOverride = 'swordDash';
      attackerUnit.userData.attackAnimDuration = 0.35;
      attackerUnit.userData.attackAnimTimer = attackerUnit.userData.attackAnimDuration;

      // A short trail of streak particles between the old attacker spot
      // and the target sells the flash-step covering the distance (and
      // the teleport above) in an instant.
      for (let i = 1; i <= 3; i++) {
        const streakPos = attackerWorldPos.clone().lerp(targetWorldPos, i / 4).add(new THREE.Vector3(0, 0.5, 0));
        spawnParticle(streakPos, 0xffffff, 0.09, 0.25);
      }

      spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'SWORD DASH!', '#ff2222');
      spawnDragonFlameBurst(targetWorldPos.clone().add(new THREE.Vector3(0, 0.5, 0)));

      applyBurn(targetUnit);
      // Guaranteed lethal - bypasses shields and Fortitude entirely, same
      // as Cavalry Charge's instant-kill half.
      applyDamage(targetUnit, 9999, 'cavalryCharge', attackerWorldPos, attackerUnit);
    }

    // Cavalry passive - Charge: a Spear-armed rider has a chance, each time
    // it would otherwise land a normal thrust, to instead lower its lance
    // and charge the full distance into the target - a much more violent
    // hit that either sends the target flying or runs it through outright.
    const CAVALRY_CHARGE_CHANCE = 0.10; // 10% chance per spear attack
    const CAVALRY_CHARGE_INSTANT_KILL_CHANCE = 0.5; // of those, half are instant kills
    const CAVALRY_CHARGE_KNOCKBACK_FORCE = 3.2;
    // How fast (units/sec) a unit walks back toward its formation slot once
    // knockback has fully settled and it has nothing left in range to
    // fight - see the recovery step in processUnitAttack.
    const KNOCKBACK_RECOVERY_SPEED = 1.2;

    // Ninja passive - Shadow Tactics: every attack is a thrown Shuriken.
    // Smoke Bomb is no longer a per-attack coin flip - see below.
    //
    // Ninja passive - Smoke Bomb: once a Ninja is down to
    // NINJA_LOW_HP_THRESHOLD of its max HP, each hit it takes has a
    // NINJA_LOW_HP_SMOKE_CHANCE chance to drop a Smoke Bomb and vanish
    // outright for NINJA_VANISH_DURATION seconds - fully hidden, fully
    // untargetable, and immune to any damage still in flight toward it
    // (see applyDamage and the targeting loop in processUnitAttack).
    const NINJA_LOW_HP_THRESHOLD = 0.1;
    const NINJA_LOW_HP_SMOKE_CHANCE = 0.4;
    const NINJA_VANISH_DURATION = 6;
    // Ninja passive - Concealment: how transparent a Ninja's model fades
    // while standing still near a tree/bush (see isNearStealthCover and
    // the opacity fade in updateCombatSystem). Not fully 0 so a player
    // can still just barely make out where their own hidden unit is.
    const NINJA_CONCEALED_OPACITY = 0.04;

    function triggerCavalryCharge(attackerUnit, targetUnit, attackerWorldPos, dmg) {
      const targetWorldPos = new THREE.Vector3();
      targetUnit.getWorldPosition(targetWorldPos);

      spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'CHARGE!', '#ff6633');
      spawnParticle(targetWorldPos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xffcc66, 0.18);

      if (Math.random() < CAVALRY_CHARGE_INSTANT_KILL_CHANCE) {
        // Guaranteed lethal - bypasses shields and Fortitude entirely,
        // same as an archer's Piercing Shot would, but fatal outright.
        applyDamage(targetUnit, dmg, 'cavalryCharge', attackerWorldPos, attackerUnit);
      } else {
        applyDamage(targetUnit, dmg, 'cavalry', attackerWorldPos, attackerUnit);
        if (targetUnit.userData.hp > 0) {
          spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), 'KNOCKBACK!', '#ffaa33');
          const dir = new THREE.Vector3(targetWorldPos.x - attackerWorldPos.x, 0, targetWorldPos.z - attackerWorldPos.z);
          if (dir.lengthSq() > 0.0001) dir.normalize();
          targetUnit.userData.knockbackVel.add(dir.multiplyScalar(CAVALRY_CHARGE_KNOCKBACK_FORCE));
          targetUnit.userData.stunTimer = Math.max(targetUnit.userData.stunTimer, 0.5);
        }
      }
    }

    // War Elephant passive - Charge & Stomp: some swings trade the
    // elephant's normal hit for a heavier stomp, rearing up and crashing
    // down on its target for bonus damage with a guaranteed knockback -
    // same shape as Cavalry's Charge above, just always a raw (not
    // instant-kill) hit and always knocking back rather than a coin flip
    // between the two.
    const WAR_ELEPHANT_STOMP_CHANCE = 0.25; // chance per swing
    const WAR_ELEPHANT_STOMP_DMG_MULT = 1.8; // bonus damage over a normal hit
    const WAR_ELEPHANT_STOMP_KNOCKBACK = 3.0;

    function triggerWarElephantStomp(attackerUnit, targetUnit, attackerWorldPos, dmg) {
      const targetWorldPos = new THREE.Vector3();
      targetUnit.getWorldPosition(targetWorldPos);

      spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'STOMP!', '#c9973a');
      spawnParticle(targetWorldPos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xc9973a, 0.2);

      applyDamage(targetUnit, dmg * WAR_ELEPHANT_STOMP_DMG_MULT, 'warElephant', attackerWorldPos, attackerUnit);
      if (targetUnit.userData.hp > 0) {
        spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), 'KNOCKBACK!', '#ffaa33');
        const dir = new THREE.Vector3(targetWorldPos.x - attackerWorldPos.x, 0, targetWorldPos.z - attackerWorldPos.z);
        if (dir.lengthSq() > 0.0001) dir.normalize();
        targetUnit.userData.knockbackVel.add(dir.multiplyScalar(WAR_ELEPHANT_STOMP_KNOCKBACK));
        targetUnit.userData.stunTimer = Math.max(targetUnit.userData.stunTimer, 0.5);
      }
    }

    // Kitsune Twinblade passive - Quickdraw: Ember Fang's (memberIndex 0,
    // kitsuneRole 'blade') katana has a chance per swing to land a fast
    // quick-draw cut for bonus damage instead of a normal strike - see
    // the melee damage branch below for where this chance is rolled.
    const KITSUNE_QUICKDRAW_CHANCE = 0.25;
    const KITSUNE_QUICKDRAW_DMG_MULT = 1.8;

    // Kitsune Twinblade passive - Flame Crescent: Ember Fang's own
    // separate per-swing chance (rolled independently of Quickdraw above,
    // so either or neither can trigger on any given swing) to also loose
    // a diagonal arc of fox-fire at her target - see spawnProjectile's
    // 'flameSlash' type for the projectile itself, and applyBurn for the
    // burn-over-time it leaves behind once it lands (resolved in the
    // projectile-hit loop below, same as Venom Arrows' poisonOnHit).
    const KITSUNE_FLAME_CRESCENT_CHANCE = 0.2;
    const KITSUNE_FLAME_SLASH_DMG = 20; // plus BURN_TICK_COUNT * BURN_TICK_DAMAGE burn damage once it lands

    function triggerKitsuneFlameCrescent(attackerUnit, targetUnit, attackerWorldPos) {
      spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'FLAME CRESCENT!', '#ff6a1a');
      const startPos = attackerWorldPos.clone();
      startPos.y += 0.5;
      spawnProjectile(startPos, targetUnit, 'flameSlash', 1, 'kitsuneTwinblade');
    }

    // Kitsune Twinblade passive - Guard the Flank: Frost Warden's
    // (memberIndex 1, kitsuneRole 'spear') spear has a chance per swing
    // to shove its target back - same knockbackVel physics Cavalry
    // Charge/War Elephant Stomp use above, just without any bonus
    // damage or instant-kill roll, since her job is covering her
    // partner's flank rather than landing a killing blow.
    const KITSUNE_GUARD_KNOCKBACK_CHANCE = 0.3;
    const KITSUNE_GUARD_KNOCKBACK_FORCE = 2.6;

    function triggerKitsuneGuardKnockback(attackerUnit, targetUnit, attackerWorldPos) {
      if (targetUnit.userData.hp <= 0) return;
      const targetWorldPos = new THREE.Vector3();
      targetUnit.getWorldPosition(targetWorldPos);
      spawnFloatingText(targetWorldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), 'KNOCKBACK!', '#8fd0ff');
      spawnKitsuneFrostBurst(targetWorldPos);
      const dir = new THREE.Vector3(targetWorldPos.x - attackerWorldPos.x, 0, targetWorldPos.z - attackerWorldPos.z);
      if (dir.lengthSq() > 0.0001) dir.normalize();
      targetUnit.userData.knockbackVel.add(dir.multiplyScalar(KITSUNE_GUARD_KNOCKBACK_FORCE));
      targetUnit.userData.stunTimer = Math.max(targetUnit.userData.stunTimer, 0.4);
    }

    // Kitsune Twinblade passive - Twin Strike: whenever Ember Fang's
    // Quickdraw connects, Frost Warden (if she's still standing) immediately
    // chips in with a bonus spear jab on the same target - the two fighting
    // "as one blade", per the squad's name, rather than as two separate
    // units that merely happen to share a formation slot. Siblings are
    // found via the shared THREE.Group both members are added to in
    // createSquad/respawnSquad/reviveNextSquadMember (unit.parent), the
    // same way updateCarrierEscort-style lookups elsewhere in this file
    // walk a group's children rather than tracking a squad reference
    // directly on each unit. This is a bonus damage tick only - no
    // repositioning, and it doesn't touch Frost Warden's own attack
    // timer/cooldown - same shape as Fox Quick Slash's own follow-up hit.
    const KITSUNE_TWIN_STRIKE_DMG_MULT = 0.6; // Frost Warden's jab, relative to Ember Fang's swing that triggered it
    function triggerKitsuneTwinStrike(bladeUnit, targetUnit, dmg) {
      if (!bladeUnit.parent || targetUnit.userData.hp <= 0) return;
      const partner = bladeUnit.parent.children.find(c =>
        c.userData && c.userData.unitType === 'kitsuneTwinblade' && c.userData.kitsuneRole === 'spear' && c.userData.hp > 0);
      if (!partner) return;
      const partnerWorldPos = new THREE.Vector3();
      partner.getWorldPosition(partnerWorldPos);
      spawnFloatingText(partnerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'TWIN STRIKE!', '#8fd0ff');
      const twinStrikeTargetPos = new THREE.Vector3();
      targetUnit.getWorldPosition(twinStrikeTargetPos);
      twinStrikeTargetPos.y += 0.7;
      const twinStrikeDir = new THREE.Vector3().subVectors(twinStrikeTargetPos, partnerWorldPos);
      spawnSlashArc(twinStrikeTargetPos, { color: 0x8fd0ff, coreColor: 0xffffff, radius: 0.65, arcSpan: Math.PI * 0.5, duration: 0.18, facingDir: twinStrikeDir });
      applyDamage(targetUnit, dmg * KITSUNE_TWIN_STRIKE_DMG_MULT, 'kitsuneTwinblade', partnerWorldPos, partner);
    }

    // Kitsune Twinblade passive - Guardian's Ward: whenever Frost Warden
    // takes a hit, a chance to ward both her and Ember Fang with an
    // overshield worth a slice of their own max HP each - same
    // absorbShield buffer/UI bar as Chakram Dancers' Spinning Shield (see
    // applyChakramDancerShield), just granted on taking damage instead of
    // on dealing it. Rolled from inside applyDamage once Frost Warden's
    // incoming hit has been resolved - see the call site there.
    const KITSUNE_WARD_CHANCE = 0.3;
    const KITSUNE_WARD_SHIELD_PCT = 0.15; // 15% of max HP granted to each of the pair

    function triggerKitsuneGuardianWard(spearUnit) {
      const grantWard = (u) => {
        const ud = u.userData;
        if (ud.hp <= 0) return;
        ud.absorbShield = Math.min(ud.maxHp, (ud.absorbShield || 0) + ud.maxHp * KITSUNE_WARD_SHIELD_PCT);
        if (ud.hpShieldFillElement) {
          ud.hpShieldFillElement.style.width = Math.max(0, (ud.absorbShield / ud.maxHp) * 100) + '%';
        }
        const pos = new THREE.Vector3();
        u.getWorldPosition(pos);
        spawnFloatingText(pos.clone().add(new THREE.Vector3(0, 0.6, 0)), '+WARD', '#8fd0ff');
        spawnKitsuneWardBurst(pos);
      };
      grantWard(spearUnit);
      if (spearUnit.parent) {
        const partner = spearUnit.parent.children.find(c =>
          c.userData && c.userData.unitType === 'kitsuneTwinblade' && c.userData.kitsuneRole === 'blade' && c.userData.hp > 0);
        if (partner) grantWard(partner);
      }
    }

    // Kitsune Twinblade idle/run handling - own dedicated function, same
    // pattern as updateGoddessAnim, dispatched from the main loop instead
    // of falling through to the plain humanoid walk/idle cycle. Attacking
    // is still handled by applyAttackPose's 'kitsuneTwinblade' branch (see
    // below), same as every other type - this function only covers
    // idle/walk and defers to applyAttackPose whenever attackAnimTimer is
    // running, exactly like updateGoddessAnim does for the Goddesses.
    function updateKitsuneTwinbladeAnim(unit, time, delta) {
      const u = unit.userData;
      const ph = u.idlePhase || 0;
      const isBlade = u.kitsuneRole === 'blade';
      const attacking = u.attackAnimTimer > 0;
      const tail = u.kitsuneTail;
      const hair = u.kitsuneHair;

      // applyAttackPose's 'kitsuneTwinblade' branches drive weaponMesh
      // rotation.z (blade's cut) / position.z (spear's jab-slide) only
      // while attacking - reset both back to rest as soon as the swing
      // ends, or they'd stay frozen at whatever the last attack frame left.
      if (!attacking && u.weaponMesh) {
        u.weaponMesh.rotation.z = 0;
        u.weaponMesh.position.z = 0;
      }

      if (u.isWalking) {
        u.walkTimer += delta * (isBlade ? 15 : 10);
        const cycle = Math.sin(u.walkTimer);
        const legAngle = cycle * (isBlade ? 1.15 : 0.75);
        u.legL.rotation.x = legAngle;
        u.legR.rotation.x = -legAngle;
        // Knee-drive: the leg swinging back through its stride folds
        // sharply at the knee, the planted/driving leg stays straighter -
        // real running gait on the jointed rig.
        if (u.legLKnee) u.legLKnee.rotation.x = Math.max(0, -legAngle) * (isBlade ? 0.9 : 0.6);
        if (u.legRKnee) u.legRKnee.rotation.x = Math.max(0, legAngle) * (isBlade ? 0.9 : 0.6);
        const bob = Math.abs(cycle) * (isBlade ? 0.05 : 0.035);
        u.body.position.y = 0.525 + bob;
        u.head.position.y = 0.9 + bob;
        // Hip drive: the torso rides slightly ahead of the planted foot
        // each stride instead of just bobbing in place - a forward
        // surge-and-catch rhythm rather than treadmill motion.
        u.body.position.z = Math.max(0, cycle) * (isBlade ? 0.05 : 0.035);

        if (isBlade) {
          // Authentic samurai sprint (same read as Dragon Ronin's own
          // running gait): a low, driving forward lean with a sharp
          // knee-drive and a torso that twists into each stride, but the
          // katana hand stays disciplined and close to the hip instead
          // of swinging wide - a trained swordsman doesn't windmill a
          // drawn blade at a dead sprint. All the counter-swing/balance
          // work is carried by the off-hand and the hips instead.
          u.body.rotation.x = 0.36 - Math.abs(cycle) * 0.03;
          u.body.rotation.z = -cycle * 0.08;
          u.body.rotation.y = cycle * 0.1;
          u.head.rotation.x = 0.14;
          u.head.rotation.y = -cycle * 0.05;
          if (!attacking) {
            const armSwing = cycle * 0.9;
            u.armL.rotation.set(-0.35 - Math.abs(armSwing) * 0.6, 0, 0.3 + armSwing * 0.22);
            u.armR.rotation.set(-0.15 - Math.abs(armSwing) * 0.1, 0, -0.3 - armSwing * 0.06);
            if (u.armLElbow) u.armLElbow.rotation.x = 0.3 + Math.abs(armSwing) * 0.55;
            if (u.armRElbow) u.armRElbow.rotation.x = 0.4;
          }
        } else {
          // "Spear Shogun" run - an upright, commanding stride rather
          // than a hunched jog: chest stays up and driving forward with
          // real weight behind it, shoulders rolling into a wide,
          // purposeful gait, while the naginata is carried level in a
          // two-handed grip whose tip rides and dips with each footfall -
          // a general closing the distance with real momentum, not a
          // soldier scrambling into position.
          u.body.rotation.x = 0.22 - Math.abs(cycle) * 0.02;
          u.body.rotation.z = cycle * 0.05;
          u.body.rotation.y = -cycle * 0.07;
          u.head.rotation.x = 0.06;
          u.head.rotation.y = cycle * 0.03;
          if (!attacking) {
            u.armR.rotation.set(-0.68 + cycle * 0.14, -0.08, -0.28);
            u.armL.rotation.set(-0.48 - cycle * 0.14, 0.08, 0.32);
            if (u.armRElbow) u.armRElbow.rotation.x = 0.3;
            if (u.armLElbow) u.armLElbow.rotation.x = 0.5;
            // The naginata's head rides the stride, dipping and lifting
            // with each driving step instead of holding dead level.
            if (u.handR) u.handR.rotation.z = cycle * 0.08;
          }
        }
        // Tail streams out low and level behind a running fox instead of
        // swaying at rest; hair whips straight back in the wind.
        if (tail) {
          tail.rotation.x = (isBlade ? -0.35 : -0.2) + Math.abs(cycle) * 0.15;
          tail.rotation.z = cycle * (isBlade ? 0.25 : 0.1);
        }
        if (hair) hair.rotation.x = -0.25 - Math.abs(cycle) * 0.1;
      } else {
        u.walkTimer = 0;
        if (u.legLKnee) u.legLKnee.rotation.x = 0;
        if (u.legRKnee) u.legRKnee.rotation.x = 0;
        const breath = Math.sin(time * 2 + ph) * 0.02;
        u.body.position.y = 0.525 + breath;
        u.body.position.z = 0;
        u.head.position.y = 0.9 + breath;
        if (isBlade) {
          // Samurai "Sword Rest" idle (same calm, settled read Dragon
          // Ronin's own idle uses) rather than the old low fox-quickdraw
          // crouch: an upright, composed stance with a slight forward
          // tip of the head, weight gently shifting foot to foot, and
          // the sword hand resting low near the hip as if the blade
          // were sheathed there, even though Ember Fang's katana stays
          // drawn in hand.
          const weightShift = Math.sin(time * 0.35 + ph);
          const lean = Math.sin(time * 0.7 + ph) * 0.02;
          u.body.rotation.x = 0.08 + lean;
          u.body.rotation.z = 0;
          u.head.rotation.x = 0.12;
          u.legL.rotation.set(0.04 - weightShift * 0.07, 0, 0.04);
          u.legR.rotation.set(0.04 + weightShift * 0.07, 0, -0.04);
          if (!attacking) {
            const settle = Math.sin(time * 1.1 + ph) * 0.02;
            u.armR.rotation.set(-0.22 + settle, -0.08, -0.22);
            u.armL.rotation.set(-0.05 + settle, 0.05, 0.05);
            if (u.armRElbow) u.armRElbow.rotation.x = 0;
            if (u.armLElbow) u.armLElbow.rotation.x = 0;
            // A quick, sharp knuckle-flex twitch on the sword hand every
            // few seconds - the coiled tension of a fighter itching to
            // draw, without breaking the otherwise calm samurai stillness.
            const twitch = Math.sin(time * 6 + ph) > 0.96 ? Math.sin(time * 30 + ph) * 0.2 : 0;
            if (u.handR) u.handR.rotation.x = twitch;
          }
        } else {
          // "Spear Shogun" idle - a tall, dignified two-handed guard:
          // chest out, spear held diagonally across the body in both
          // hands, weight planted evenly on both feet rather than
          // shifting - the still, commanding presence of a battlefield
          // general surveying the field, not a restless duelist's guard.
          u.body.rotation.x = -0.04 + breath * 0.5;
          u.body.rotation.z = 0;
          u.head.rotation.x = -0.02;
          u.legL.rotation.set(0.02, 0, 0.02);
          u.legR.rotation.set(0.02, 0, -0.02);
          if (!attacking) {
            u.armR.rotation.set(-0.58 + breath * 0.3, -0.1, -0.3);
            u.armL.rotation.set(-0.38 + breath * 0.3, 0.1, 0.35);
            if (u.armRElbow) u.armRElbow.rotation.x = 0.3;
            if (u.armLElbow) u.armLElbow.rotation.x = 0.5;
            // The spearhead idly tips and circles on guard rather than
            // held dead still - the only restless element in an
            // otherwise composed, commanding stance.
            u.handR.rotation.z = Math.sin(time * 0.4 + ph) * 0.05;
          }
        }
        // Head scan: Ember Fang's is quick and alert (foxlike); Frost
        // Warden's is slower and more deliberate (a shogun's measured
        // survey of the field) rather than sharing the same cadence.
        u.head.rotation.y = Math.sin(time * (isBlade ? 0.35 : 0.2) + ph) * (isBlade ? 0.15 : 0.1);
        // Ears/tail read as alert rather than a static prop: a lazy sway
        // most of the time with an occasional quicker flick, like a real
        // fox's tail twitching at rest. Frost Warden's flicks less often
        // than Ember Fang's - a controlled, dignified stillness befitting
        // her "Spear Shogun" bearing rather than a foxier restlessness.
        if (tail) {
          const flickChance = isBlade ? 0.92 : 0.97;
          const flick = Math.sin(time * 5 + ph) > flickChance ? Math.sin(time * 20 + ph) * 0.15 : 0;
          tail.rotation.z = Math.sin(time * (isBlade ? 1.8 : 0.7) + ph) * (isBlade ? 0.18 : 0.06) + flick;
          tail.rotation.x = -0.05 + Math.sin(time * 0.9 + ph) * 0.04;
        }
        if (hair) hair.rotation.x = Math.sin(time * 0.6 + ph) * 0.05;
      }

      if (attacking) applyAttackPose(unit);
    }

    // Kitsune Twinblade death has been reverted to the standard unit
    // death handling (ragdoll + the normal crawl/stagger "suspected
    // death" sequence) - see the removed early-return branches that used
    // to route both Ember Fang and Frost Warden through a dedicated
    // honor-collapse/fox-fire dissolve in killUnit and startDeathSequence
    // below; they now fall through to the same generic path every other
    // non-Exclusive unit uses.

    // Steel Revenant passive - Death Slam: some swings trade the normal
    // single-target hit for a heavy, forward-facing slam of the Revenant
    // Mace that crushes every enemy caught in a rectangle directly ahead
    // of it, rather than just whichever one unit it happened to be
    // swinging at. Rolled as an alternative to a normal attack (see the
    // STEEL_REVENANT_SLAM_CHANCE roll in processUnitAttack's melee
    // branch) rather than stacking a bonus hit on top of one.
    const STEEL_REVENANT_SLAM_CHANCE = 0.3;   // chance per swing to Slam instead of a normal hit
    const STEEL_REVENANT_SLAM_WIDTH = 2.0;    // rectangle width, side to side
    const STEEL_REVENANT_SLAM_LENGTH = 1.5;   // rectangle depth, straight ahead
    const STEEL_REVENANT_SLAM_KNOCKBACK = 1.8;
    const STEEL_REVENANT_SLAM_DAMAGE_MULT = 0.8; // Death Slam deals 80% of a normal swing's damage to each enemy it catches
    // A touch longer than the default 0.3s swing so the mace's
    // enlarge-on-impact pulse (see the 'deathSlam' override check inside
    // applyAttackPose's 'steelRevenant' branch) has room to read before
    // easing back down to normal size.
    const STEEL_REVENANT_SLAM_ANIM_DURATION = 0.45;

    // Ghost Of Mace - a fading spectral afterimage of the Revenant Mace
    // itself, left hanging in the air right where Death Slam connects.
    // Clones whatever mesh is currently equipped in uData.weaponMesh and
    // re-skins every submesh with a single shared translucent teal
    // material (same spectral color as Steel Grasp's glow/claw/zone, see
    // STEEL_REVENANT_GRASP_COLOR) so the copy reads as a ghost rather
    // than a second solid weapon. The clone only needs to exist for the
    // life of the fade (see the 'ghostMace' branch in the activeGraspFX
    // update loop), so it's never re-equipped or reused afterward.
    function createSteelRevenantGhostMace(weaponMesh) {
      const ghostMat = new THREE.MeshBasicMaterial({
        color: STEEL_REVENANT_GRASP_COLOR,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ghost = weaponMesh.clone(true);
      ghost.traverse(child => {
        if (child.isMesh) child.material = ghostMat;
      });
      ghost.userData.mats = [ghostMat];
      return ghost;
    }

    function triggerSteelRevenantDeathSlam(attackerUnit, targets, attackerWorldPos, dmg) {
      spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'DEATH SLAM!', '#ff3333');

      // Tags this swing so applyAttackPose's shared 'steelRevenant'
      // overhead-smash pose knows to pulse the mace's scale up through
      // the crash and back down - a normal swing never sets this flag,
      // so only a Death Slam ever grows the weapon.
      attackerUnit.userData.attackAnimPoseOverride = 'deathSlam';
      attackerUnit.userData.attackAnimDuration = STEEL_REVENANT_SLAM_ANIM_DURATION;
      attackerUnit.userData.attackAnimTimer = STEEL_REVENANT_SLAM_ANIM_DURATION;

      // Forward direction the unit is currently facing - it was already
      // turned to face bestTarget a moment earlier in processUnitAttack -
      // used to build a rectangle straight ahead of it rather than a
      // circle around it, so the slam reads as a directional mace swing
      // rather than a burst that hits in every direction at once.
      const facingAngle = attackerUnit.rotation.y + attackerUnit.parent.rotation.y;
      const fwdX = Math.sin(facingAngle);
      const fwdZ = Math.cos(facingAngle);
      const rightX = Math.cos(facingAngle);
      const rightZ = -Math.sin(facingAngle);

      // Rectangular Zone - the same teal ground-flash treatment Steel
      // Grasp uses (createSteelGraspZoneMesh), just sized to Death
      // Slam's shorter, wider rectangle, so both rectangle abilities
      // read as one shared spectral "danger zone" visual language.
      const slamZone = createSteelGraspZoneMesh(STEEL_REVENANT_SLAM_WIDTH, STEEL_REVENANT_SLAM_LENGTH);
      slamZone.position.copy(attackerWorldPos);
      slamZone.rotation.y = facingAngle;
      scene.add(slamZone);
      activeGraspFX.push({ mesh: slamZone, mats: slamZone.userData.mats, age: 0, duration: 0.35, kind: 'zone' });

      // Ghost Of Mace - a fading spectral afterimage of the mace itself,
      // cloned from its current world transform right as the slam
      // connects (see createSteelRevenantGhostMace).
      const slamWeapon = attackerUnit.userData.weaponMesh;
      if (slamWeapon) {
        const ghostPos = new THREE.Vector3();
        const ghostQuat = new THREE.Quaternion();
        const ghostScale = new THREE.Vector3();
        slamWeapon.getWorldPosition(ghostPos);
        slamWeapon.getWorldQuaternion(ghostQuat);
        slamWeapon.getWorldScale(ghostScale);
        const ghostMace = createSteelRevenantGhostMace(slamWeapon);
        ghostMace.position.copy(ghostPos);
        ghostMace.quaternion.copy(ghostQuat);
        ghostMace.scale.copy(ghostScale);
        scene.add(ghostMace);
        activeGraspFX.push({ mesh: ghostMace, mats: ghostMace.userData.mats, age: 0, duration: STEEL_REVENANT_SLAM_ANIM_DURATION, kind: 'ghostMace' });
      }

      let hitAny = false;
      targets.forEach(t => {
        if (t.userData.hp <= 0) return;
        const tPos = new THREE.Vector3();
        t.getWorldPosition(tPos);
        const dx = tPos.x - attackerWorldPos.x;
        const dz = tPos.z - attackerWorldPos.z;
        const forwardDist = dx * fwdX + dz * fwdZ;
        const sideDist = dx * rightX + dz * rightZ;
        if (forwardDist < 0 || forwardDist > STEEL_REVENANT_SLAM_LENGTH) return;
        if (Math.abs(sideDist) > STEEL_REVENANT_SLAM_WIDTH / 2) return;

        hitAny = true;
        applyDamage(t, dmg * STEEL_REVENANT_SLAM_DAMAGE_MULT, 'steelRevenant', attackerWorldPos, attackerUnit);
        if (t.userData.hp > 0) {
          t.userData.knockbackVel.add(new THREE.Vector3(fwdX, 0, fwdZ).multiplyScalar(STEEL_REVENANT_SLAM_KNOCKBACK));
          t.userData.stunTimer = Math.max(t.userData.stunTimer, 0.4);
        }
        spawnParticle(tPos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0x8899aa, 0.16);
      });

      // Safety net - the roll can in principle fire with bestTarget just
      // outside the tuned rectangle (e.g. mid-knockback slide); rather
      // than waste the swing entirely, the caller falls back to a normal
      // single-target hit when nothing landed.
      return hitAny;
    }

    // Steel Revenant passive - Steel Grasp: some swings trade the normal
    // single-target hit for a claw-zone yank instead - a spectral clawed
    // hand punches up under every enemy caught in a rectangle ahead of
    // it (mirroring Death Slam's rectangle above, just reaching further)
    // and drags them back toward the Revenant rather than knocking them
    // away, so a target can't just kite back out of mace range forever.
    // Rolled as its own independent alternative to a normal attack (see
    // the STEEL_REVENANT_GRASP_CHANCE roll in processUnitAttack's melee
    // branch), tried ahead of the Death Slam roll so the two can't both
    // fire off the same swing.
    const STEEL_REVENANT_GRASP_CHANCE = 0.22;    // chance per swing to Grasp instead of a normal hit
    const STEEL_REVENANT_GRASP_WIDTH = 2.4;      // rectangle width, side to side
    const STEEL_REVENANT_GRASP_LENGTH = 3.2;     // rectangle depth, straight ahead - reaches further than Slam
    const STEEL_REVENANT_GRASP_PULL = 3.4;       // pull force applied toward the attacker
    const STEEL_REVENANT_GRASP_STUN = 0.35;
    const STEEL_REVENANT_GRASP_DAMAGE_MULT = 0.4; // Steel Grasp deals 40% of a normal swing's damage to each enemy it grabs
    const STEEL_REVENANT_GRASP_ANIM_DURATION = 0.65;
    const STEEL_REVENANT_GRASP_COLOR = 0x33ffcc; // spectral teal, matches the escaping soul (createSteelRevenantSoulMesh)

    // A compact burst of spectral claw-energy shards, flared onto the
    // Revenant's off hand the instant a Grasp cast begins (see
    // applyAttackPose's 'steelGrasp' branch, which drives this mesh's
    // opacity/scale every frame the cast is playing) and parented
    // directly to handL at equip time (see the 'steelRevenant' branch in
    // equipUnit) so it always tracks the hand regardless of how the arm
    // is posed.
    function createSteelGraspGlowMesh() {
      const glowMat = new THREE.MeshBasicMaterial({
        color: STEEL_REVENANT_GRASP_COLOR,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const group = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), glowMat);
      group.add(core);
      const shardGeo = new THREE.ConeGeometry(0.022, 0.15, 4);
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        const shard = new THREE.Mesh(shardGeo, glowMat);
        shard.position.set(Math.cos(ang) * 0.08, Math.sin(ang) * 0.08, 0);
        shard.rotation.z = ang + Math.PI / 2;
        group.add(shard);
      }
      group.userData.mats = [glowMat];
      return group;
    }

    // A soft pulsing ring of the same spectral teal, flared onto the
    // Revenant's chest the instant Unbreakable fires (see
    // maybeTriggerSteelRevenantUnbreakable and applyAttackPose's
    // 'unbreakable' branch, which drives this mesh's opacity/scale every
    // frame the cast is playing) and parented directly to the torso
    // (uData.body) at equip time so it sits right where the left hand
    // comes to rest against the armor, regardless of how the body is
    // posed.
    function createUnbreakableGlowMesh() {
      const glowMat = new THREE.MeshBasicMaterial({
        color: STEEL_REVENANT_UNBREAKABLE_COLOR,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const group = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), glowMat);
      group.add(core);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.19, 16), glowMat);
      group.add(ring);
      group.userData.mats = [glowMat];
      group.userData.ring = ring;
      return group;
    }

    // A single clawed hand of spectral energy that punches up out of the
    // ground under a grasped target, closes into a fist as it drags the
    // target back toward the Revenant, then sinks and fades - a faster,
    // showier cousin of the pale grasping hands steelRevenantSoulDeath
    // uses to drag a departed soul under (createSoulHandMesh), recolored
    // to the same spectral teal as the hand-glow above so every part of
    // the ability reads as one effect.
    function createSteelGraspClawMesh() {
      const clawMat = new THREE.MeshBasicMaterial({
        color: STEEL_REVENANT_GRASP_COLOR,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const group = new THREE.Group();
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.07), clawMat);
      group.add(palm);
      for (let i = 0; i < 4; i++) {
        const finger = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.2, 5), clawMat);
        finger.position.set((i - 1.5) * 0.055, 0.19, 0);
        finger.rotation.x = Math.PI;
        group.add(finger);
      }
      group.userData.mats = [clawMat];
      return group;
    }

    // A flat rectangular flash marking the Grasp's claw zone on the
    // ground the instant it fires - built in a wrapper Group rotated to
    // the attacker's facing so the plane's own flattening rotation
    // doesn't have to be reasoned about in world space (position offsets
    // are set in the group's local space, before that flattening rotation
    // is applied to the plane itself - see the spawn call in
    // triggerSteelRevenantSteelGrasp).
    function createSteelGraspZoneMesh(width, length) {
      const mat = new THREE.MeshBasicMaterial({
        color: STEEL_REVENANT_GRASP_COLOR,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const group = new THREE.Group();
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, length), mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(0, 0.03, length / 2);
      group.add(plane);
      group.userData.mats = [mat];
      return group;
    }

    function triggerSteelRevenantSteelGrasp(attackerUnit, targets, attackerWorldPos, dmg) {
      spawnFloatingText(attackerWorldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 'STEEL GRASP!', '#33ffcc');

      const facingAngle = attackerUnit.rotation.y + attackerUnit.parent.rotation.y;
      const fwdX = Math.sin(facingAngle);
      const fwdZ = Math.cos(facingAngle);
      const rightX = Math.cos(facingAngle);
      const rightZ = -Math.sin(facingAngle);

      // Left-hand cast pose (see applyAttackPose's 'steelGrasp' branch)
      // instead of the normal two-handed Overhead Smash windup, so the
      // ability reads as a claw-cast rather than another mace swing.
      attackerUnit.userData.attackAnimPoseOverride = 'steelGrasp';
      attackerUnit.userData.attackAnimDuration = STEEL_REVENANT_GRASP_ANIM_DURATION;
      attackerUnit.userData.attackAnimTimer = STEEL_REVENANT_GRASP_ANIM_DURATION;

      // Ground flash across the whole claw zone, fired once regardless
      // of how many targets end up caught inside it.
      const zone = createSteelGraspZoneMesh(STEEL_REVENANT_GRASP_WIDTH, STEEL_REVENANT_GRASP_LENGTH);
      zone.position.copy(attackerWorldPos);
      zone.rotation.y = facingAngle;
      scene.add(zone);
      activeGraspFX.push({ mesh: zone, mats: zone.userData.mats, age: 0, duration: 0.35, kind: 'zone' });

      let grabbedAny = false;
      targets.forEach(t => {
        if (t.userData.hp <= 0) return;
        const tPos = new THREE.Vector3();
        t.getWorldPosition(tPos);
        const dx = tPos.x - attackerWorldPos.x;
        const dz = tPos.z - attackerWorldPos.z;
        const forwardDist = dx * fwdX + dz * fwdZ;
        const sideDist = dx * rightX + dz * rightZ;
        // A small minimum forward distance keeps the pull from ever
        // yanking something already standing right next to the Revenant.
        if (forwardDist < 0.3 || forwardDist > STEEL_REVENANT_GRASP_LENGTH) return;
        if (Math.abs(sideDist) > STEEL_REVENANT_GRASP_WIDTH / 2) return;

        grabbedAny = true;
        applyDamage(t, dmg * STEEL_REVENANT_GRASP_DAMAGE_MULT, 'steelRevenant', attackerWorldPos, attackerUnit);
        // Pulled toward the attacker - the opposite of Death Slam's
        // knockback above - with a short stun so the yank actually lands
        // the target somewhere useful instead of it just sprinting back
        // out again.
        if (t.userData.hp > 0) {
          const pullDir = new THREE.Vector3(-fwdX, 0, -fwdZ);
          t.userData.knockbackVel.add(pullDir.multiplyScalar(STEEL_REVENANT_GRASP_PULL));
          t.userData.stunTimer = Math.max(t.userData.stunTimer, STEEL_REVENANT_GRASP_STUN);
        }

        const claw = createSteelGraspClawMesh();
        claw.position.copy(tPos).add(new THREE.Vector3(0, -0.05, 0));
        claw.rotation.y = facingAngle + Math.PI;
        scene.add(claw);
        activeGraspFX.push({ mesh: claw, mats: claw.userData.mats, age: 0, duration: 0.5, kind: 'claw', baseY: tPos.y - 0.05 });

        spawnParticle(tPos.clone().add(new THREE.Vector3(0, 0.4, 0)), STEEL_REVENANT_GRASP_COLOR, 0.1, 0.3);
      });

      // Safety net matching Death Slam's above - if the roll fires but
      // nothing actually ended up inside the zone, the caller falls back
      // to a normal hit rather than wasting the swing entirely.
      return grabbedAny;
    }

    // Pikeman passive - Fortitude: see the trigger inside applyDamage below.
    const FORTITUDE_DEFENSE_REDUCTION = 0.3; // 30% less damage taken while active
    const FORTITUDE_DURATION = 3; // seconds

    // Elite Swordsman passive - Last Stand: see the trigger inside
    // applyDamage below. Turns on once HP drops to the threshold or
    // below and holds for LAST_STAND_DURATION seconds, refreshing (but
    // not re-announcing) on every hit taken while it's already active.
    const LAST_STAND_HP_THRESHOLD = 0.1; // 10% HP or below
    const LAST_STAND_DEFENSE_REDUCTION = 0.4; // 40% less damage taken while active
    const LAST_STAND_DURATION = 5; // seconds

    // Berserker passive - Rage: once HP drops to the threshold or below,
    // attack cooldown is slashed way down (i.e. attack speed goes way
    // up) for as long as it stays there - checked live off current HP
    // every time the attack cooldown is (re)assigned below, rather than
    // a timed buff like Last Stand, so it turns off again the moment
    // healing brings it back above the threshold.
    const BERSERKER_RAGE_HP_THRESHOLD = 0.3; // 30% HP or below
    const BERSERKER_RAGE_COOLDOWN_MULT = 0.35; // attack cooldown multiplied by this while enraged - roughly triples attack speed
    const BERSERKER_BASE_ATTACK_COOLDOWN = 1.1; // matches the default melee cooldown other plain melee units use
    const BERSERKER_BASE_DMG = 32; // matches CLASS_DEFS.berserker.baseDmg
    const GHOUL_BASE_DMG = 20; // matches CLASS_DEFS.ghoul.baseDmg - hits light, but fast and cheap
    const GHOUL_ATTACK_COOLDOWN = 0.8; // noticeably faster swings than the 1.1s default melee cooldown
    const GHOUL_CANNIBALIZE_HEAL_PCT = 0.25; // fraction of missing HP healed on a killing blow - see triggerGhoulCannibalize

    // Valkyrie passive - Sky Strike: a normal dive-attack deals this much
    // (matches CLASS_DEFS.valkyrie.baseDmg); against any ranged unit type
    // (see isRangedUnitType above) the swing is instead redirected into a
    // guaranteed instant kill, tagged 'cavalryCharge' the same way
    // Assassinate/Deathblow/Charge are, so it bypasses shields and
    // Fortitude and goes through the same Dark Knight Unbreakable
    // immunity check rather than needing its own.
    const VALKYRIE_BASE_DMG = 30;
    const KITSUNE_BASE_DMG = 42; // matches CLASS_DEFS.kitsuneTwinblade.baseDmg
    // How high above the ground a Valkyrie hovers between dives - see the
    // 'valkyrie' early-return block in updateUnitAnims.
    const VALKYRIE_HOVER_HEIGHT = 2.6;

    // Ninja passive (Smoke Bomb) - called right after a Ninja's HP drops
    // from a hit that didn't kill it. Below NINJA_LOW_HP_THRESHOLD, each
    // such hit rolls a NINJA_LOW_HP_SMOKE_CHANCE shot at dropping a Smoke
    // Bomb and vanishing outright (unit hidden, untargetable, and immune
    // - see applyDamage's early return and the targeting loop). Wearing
    // off is handled by the vanishTimer countdown in processUnitAttack.

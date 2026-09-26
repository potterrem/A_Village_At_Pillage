    // =========================================================================
    // ACCOUNT SYSTEM - real accounts (Supabase Auth) + cross-device cloud save
    // (Supabase Postgres table), layered on top of this game's existing
    // bt_* localStorage save keys instead of rewriting every read/write site.
    //
    // SETUP REQUIRED:
    // 1. Create a free project at https://supabase.com.
    // 2. Project Settings -> API: copy the "Project URL" and "anon public"
    //    key into SUPABASE_URL / SUPABASE_ANON_KEY below.
    // 3. Authentication -> Providers: Email is on by default - that's all
    //    you need for email/password accounts. (Authentication -> Settings
    //    lets you turn off "Confirm email" if you don't want a verification
    //    step during testing.)
    // 4. SQL Editor: run this once to create the save-data table with
    //    row-level security so each player can only read/write their own row:
    //
    //      create table players (
    //        id uuid references auth.users on delete cascade primary key,
    //        save_data jsonb not null default '{}'::jsonb,
    //        role text not null default 'user'
    //          check (role in ('user', 'moderator', 'developer')),
    //        username text,
    //        avatar text not null default '🙂',
    //        updated_at timestamptz default now()
    //      );
    //      alter table players enable row level security;
    //      create policy "Users can read own row" on players
    //        for select using (auth.uid() = id);
    //      create policy "Users can upsert own row" on players
    //        for insert with check (auth.uid() = id);
    //      create policy "Users can update own row" on players
    //        for update using (auth.uid() = id);
    //
    //      -- Defense in depth: even though the client's cloud-save upsert
    //      -- (see pushCloudSaveNow below) never sends a role value, this
    //      -- trigger makes it impossible for a normal user to grant
    //      -- themselves moderator/developer access by crafting their own
    //      -- request - any update that tries to change role gets silently
    //      -- reverted unless it's run with the service_role key (which
    //      -- only your own trusted scripts/dashboard have, never the game).
    //      create or replace function lock_player_role()
    //      returns trigger as $$
    //      begin
    //        if auth.role() <> 'service_role' then
    //          new.role := old.role;
    //        end if;
    //        return new;
    //      end;
    //      $$ language plpgsql security definer;
    //      create trigger players_lock_role
    //        before update on players
    //        for each row execute function lock_player_role();
    //
    // 5. To make someone a moderator or developer, run this in the SQL
    //    Editor (SQL Editor runs as an admin, so the trigger above doesn't
    //    block it) - find their user id under Authentication -> Users:
    //
    //      update players set role = 'developer' where id = '<user-uuid>';
    //
    
    // HOW IT WORKS:
    // 1. On page load this script checks Supabase's persisted auth session.
    //    If the player is already logged in on this device, it pulls their
    //    cloud save from the `players` table, writes it into localStorage,
    //    and reloads the page ONCE so the game's existing localStorage-
    //    driven startup code (further down in the file) picks up the synced
    //    values exactly like it already does today. If nobody's logged in,
    //    the login/signup screen is shown.
    // 2. After boot, every write to a bt_* localStorage key is mirrored to
    //    Supabase (debounced) under that user's account, so progress made
    //    on one device shows up on the next device they log into.
    // 3. Guests skip all of this - the game just plays exactly as it did
    //    before, saving locally only.
    // =========================================================================

    const SUPABASE_URL = "https://irfkleatthvouovqxtdi.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_Lu9DAvy74ClETx7NcJjBbQ_u3WU4QoF";

    let sbClient = null;
    let sbReady = false;
    try {
      if (SUPABASE_URL.startsWith('http') && window.supabase) {
        sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        sbReady = true;
      }
    } catch (e) {
      // Supabase not configured yet (placeholder values) or failed to load -
      // fall back to guest-only play rather than blocking the game.
      console.warn('Account system: Supabase not configured, guest-only mode.', e);
    }

    // Every localStorage key this game persists (see the bt_* reads/writes
    // throughout the file below) - this is the full "save data" snapshot
    // that gets pushed to / pulled from each account's Supabase row.
    const BT_SAVE_KEYS = [
      'bt_squadLevels', 'bt_squadUnlocked', 'bt_raidersDiscovered',
      'bt_squadLoadouts', 'bt_squadLoadoutNames', 'bt_gold',
      'bt_contractScrolls', 'bt_squadTokens', 'bt_dailyShopDate',
      'bt_dailyShopStock', 'bt_dailyShopPurchased', 'bt_guiHidden',
      'bt_devToolsEnabled', 'bt_warPoints'
    ];

    let authMode = 'signup'; // 'signup' | 'login'
    const RELOAD_FLAG = 'bt_cloudSyncReloaded';
    const ROLE_FLAG = 'bt_userRole'; // sessionStorage cache of role across the one post-login reload
    let currentUserRole = 'user'; // 'user' | 'moderator' | 'developer'

    function authApplyRoleUI(role) {
      currentUserRole = role || 'user';
      const roleTag = document.getElementById('account-badge-role');
      if (roleTag) {
        if (currentUserRole === 'developer' || currentUserRole === 'moderator') {
          roleTag.textContent = currentUserRole === 'developer' ? 'DEV' : 'MOD';
          roleTag.style.display = 'inline';
          roleTag.classList.toggle('role-developer', currentUserRole === 'developer');
          roleTag.classList.toggle('role-moderator', currentUserRole === 'moderator');
        } else {
          roleTag.style.display = 'none';
        }
      }
      // Dev Tools (free Gold/Scrolls, squad unlock/lock) is a staff-only
      // feature - normal users and guests never see the toggle at all, so
      // there's no way to grant themselves currency. If a normal account
      // had Dev Tools left ON from before this role gate existed, force it
      // back off so the Pause Menu's Dev Tools button also disappears.
      const canUseDevTools = currentUserRole === 'developer' || currentUserRole === 'moderator';
      const devToggleBtn = document.getElementById('devtools-toggle-btn');
      if (devToggleBtn) devToggleBtn.style.display = canUseDevTools ? '' : 'none';
      if (!canUseDevTools && typeof devToolsEnabled !== 'undefined' && devToolsEnabled) {
        devToolsEnabled = false;
        localStorage.setItem('bt_devToolsEnabled', 'false');
        if (typeof updateDevToolsToggleUI === 'function') updateDevToolsToggleUI();
      }
    }

    // --- Player profile (username + avatar) -----------------------------
    // Shown as a tappable badge in the Main Menu's upper-right corner (see
    // #player-badge); tapping it opens the Player Info panel
    // (#menu-panel-player-info). Works for guests too (saved locally
    // only, via bt_guestUsername/bt_guestAvatar) so there's always
    // something to show and edit even without an account.
    const USERNAME_FLAG = 'bt_username'; // sessionStorage cache across the one post-login reload
    const AVATAR_FLAG = 'bt_avatar';
    // Avatars are no longer a fixed emoji set - the picker offers every
    // squad type the player has unlocked (CLASS_DEFS + isSquadUnlocked,
    // defined later in the main game script), so currentAvatar now stores
    // a squad `type` string (e.g. 'swords') rather than a literal emoji.
    // 'swords' is one of the four starter squads (see
    // STARTER_UNLOCKED_TYPES) and is therefore always a valid default.
    // Old accounts/guests may still have a literal emoji saved from before
    // this change - avatarIconHtml() below falls back to rendering that
    // raw value as-is when it doesn't match any known squad type, so those
    // avatars keep displaying exactly as they did.
    let currentUsername = '';
    let currentAvatar = 'swords';

    function defaultUsername() {
      if (currentUsername) return currentUsername;
      if (currentUser && currentUser.email) return currentUser.email.split('@')[0];
      return 'Guest';
    }

    // Resolves a stored avatar value to displayable markup: a squad's icon
    // (iconHtml, which may be an <img> for defs with a custom iconImage)
    // if the value matches a known CLASS_DEFS type, otherwise the raw
    // value itself (legacy plain-emoji avatars from before squad avatars).
    function avatarIconHtml(avatar) {
      if (typeof CLASS_DEFS !== 'undefined') {
        const def = CLASS_DEFS.find(d => d.type === avatar);
        if (def) return typeof iconHtml === 'function' ? iconHtml(def) : def.icon;
      }
      return avatar;
    }

    function updatePlayerBadge() {
      const avatarEl = document.getElementById('player-badge-avatar');
      const nameEl = document.getElementById('player-badge-name');
      const bigAvatarEl = document.getElementById('player-info-avatar-big');
      const iconMarkup = avatarIconHtml(currentAvatar);
      // innerHTML (not textContent) since a squad's icon may be an <img>.
      if (avatarEl) avatarEl.innerHTML = iconMarkup;
      if (nameEl) nameEl.textContent = defaultUsername();
      if (bigAvatarEl) bigAvatarEl.innerHTML = iconMarkup;
    }

    // CLASS_DEFS/isSquadUnlocked/iconHtml aren't defined yet this early in
    // the file, but (like renderSquadShowcaseGrid above) this is only ever
    // called after the player opens the Player Info panel, by which point
    // the rest of the page has already loaded and defined them.
    function renderAvatarPickerGrid() {
      const grid = document.getElementById('avatar-picker-grid');
      if (!grid) return;
      if (typeof CLASS_DEFS === 'undefined') { grid.innerHTML = ''; return; }
      const unlockedDefs = CLASS_DEFS.filter(def => typeof isSquadUnlocked === 'function' && isSquadUnlocked(def.type));
      grid.innerHTML = unlockedDefs.map(def => {
        const icon = typeof iconHtml === 'function' ? iconHtml(def) : def.icon;
        return `<button type="button" class="avatar-option-btn${def.type === currentAvatar ? ' selected' : ''}" title="${def.label}" onclick="selectAvatar('${def.type}')">${icon}</button>`;
      }).join('');
    }

    function selectAvatar(avatar) {
      currentAvatar = avatar;
      updatePlayerBadge();
      renderAvatarPickerGrid();
      persistProfile();
    }

    function renderPlayerInfoPanel() {
      renderAvatarPickerGrid();
      const input = document.getElementById('player-info-username-input');
      if (input) input.value = currentUsername || '';
      const bigAvatarEl = document.getElementById('player-info-avatar-big');
      if (bigAvatarEl) bigAvatarEl.innerHTML = avatarIconHtml(currentAvatar);
      const statusBadge = document.getElementById('player-info-status-badge');
      if (statusBadge) {
        if (currentUserRole === 'developer' || currentUserRole === 'moderator') {
          statusBadge.textContent = currentUserRole === 'developer' ? '🛠️ Developer' : '🛡️ Moderator';
          statusBadge.className = 'status-staff';
        } else if (currentUser) {
          statusBadge.textContent = '🟢 Signed In';
          statusBadge.className = '';
        } else {
          statusBadge.textContent = '⚪ Guest';
          statusBadge.className = 'status-guest';
        }
      }
      const stats = document.getElementById('player-info-stats');
      if (stats) {
        let roleLine = '';
        if (currentUserRole === 'developer') roleLine = '<div>Role: <span style="color:#ff6b6b;">Developer</span></div>';
        else if (currentUserRole === 'moderator') roleLine = '<div>Role: <span style="color:#6bb8ff;">Moderator</span></div>';
        const acctLine = currentUser
          ? `<div>Account: <span>${currentUser.email}</span></div>`
          : '<div>Playing as <span>Guest</span> (no cloud sync)</div>';
        stats.innerHTML = acctLine + roleLine;
      }
      renderSquadShowcaseGrid();
    }

    // --- Squad Showcase --------------------------------------------------
    // A read-only grid of every squad type the game knows about (CLASS_DEFS,
    // defined further down in the main game script) - unlocked squads show
    // their icon and current level, locked ones are dimmed with a lock
    // glyph. CLASS_DEFS/playerSquadUnlocked/playerSquadLevels/isSquadUnlocked
    // aren't defined yet this early in the file, but this function is only
    // ever called after the player opens the Player Info panel, by which
    // point the rest of the page has already loaded and defined them.
    function renderSquadShowcaseGrid() {
      const grid = document.getElementById('squad-showcase-grid');
      if (!grid) return;
      if (typeof CLASS_DEFS === 'undefined') { grid.innerHTML = ''; return; }
      grid.innerHTML = CLASS_DEFS.map(def => {
        const unlocked = typeof isSquadUnlocked === 'function' && isSquadUnlocked(def.type);
        const lvl = (typeof playerSquadLevels !== 'undefined' && playerSquadLevels[def.type]) || 1;
        const icon = typeof iconHtml === 'function' ? iconHtml(def) : def.icon;
        return `<div class="squad-showcase-tile ${unlocked ? 'unlocked' : 'locked'}" title="${def.label}">` +
          (unlocked ? '' : '<span class="squad-showcase-lock">🔒</span>') +
          icon +
          (unlocked ? `<span class="squad-showcase-lvl">Lv${lvl}</span>` : '') +
          `</div>`;
      }).join('');
    }

    function savePlayerProfile() {
      const input = document.getElementById('player-info-username-input');
      const msg = document.getElementById('player-info-save-msg');
      const name = (input && input.value ? input.value : '').trim().slice(0, 20);
      if (!name) {
        if (msg) msg.textContent = 'Enter a username.';
        return;
      }
      currentUsername = name;
      updatePlayerBadge();
      persistProfile().then(() => {
        if (msg) {
          msg.textContent = 'Saved!';
          setTimeout(() => { if (msg) msg.textContent = ''; }, 1500);
        }
      });
    }

    function persistProfile() {
      if (currentUser && sbClient) {
        // Only sends username/avatar - never touches save_data or role, so
        // this can't be used to sneak a role change past the DB trigger.
        return sbClient.from('players')
          .upsert({ id: currentUser.id, username: currentUsername, avatar: currentAvatar })
          .then(({ error }) => { if (error) console.warn('Account system: profile save failed.', error); });
      }
      try {
        localStorage.setItem('bt_guestUsername', currentUsername);
        localStorage.setItem('bt_guestAvatar', currentAvatar);
      } catch (e) {}
      return Promise.resolve();
    }

    // Guest/no-account fallback: load whatever was saved locally last time
    // so the badge shows something sensible even before any auth check
    // resolves.
    try {
      currentUsername = localStorage.getItem('bt_guestUsername') || '';
      currentAvatar = localStorage.getItem('bt_guestAvatar') || 'swords';
    } catch (e) {}

    function authSetError(msg) {
      const el = document.getElementById('auth-error');
      if (el) el.textContent = msg || '';
    }
    function authSetStatus(msg) {
      const el = document.getElementById('auth-status');
      if (el) el.textContent = msg || '';
    }
    function authHideScreen() {
      const el = document.getElementById('auth-screen');
      if (el) el.classList.add('hidden');
    }
    function authShowBadge(email) {
      const badge = document.getElementById('account-badge');
      const emailEl = document.getElementById('account-badge-email');
      if (!badge) return;
      if (email) {
        if (emailEl) emailEl.textContent = email;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    function authToggleMode() {
      authMode = authMode === 'signup' ? 'login' : 'signup';
      document.getElementById('auth-title').textContent = authMode === 'signup' ? 'Create Account' : 'Log In';
      document.getElementById('auth-submit-btn').textContent = authMode === 'signup' ? 'Create Account' : 'Log In';
      document.getElementById('auth-toggle-link').textContent = authMode === 'signup' ? 'Already have an account? Log in' : "Need an account? Sign up";
      authSetError('');
    }

    function authContinueAsGuest() {
      authSetError('');
      authHideScreen();
      authShowBadge(null);
      // Guests have no account/role, so they're treated like a normal
      // user - no Dev Tools access. (If Supabase isn't configured at all,
      // the 'else' branch further down leaves Dev Tools visible instead,
      // since there's no account/privilege system to enforce in that case.)
      if (sbReady) authApplyRoleUI('user');
      updatePlayerBadge();
    }

    // --- Google sign-in ---------------------------------------------------
    // Redirect-based OAuth: sends the player to Google, then back to this
    // same page with an auth code in the URL. supabase-js has
    // detectSessionInUrl on by default, so it exchanges that code for a
    // session automatically on load; the existing getSession()/
    // onAuthStateChange('SIGNED_IN') handling in the DOMContentLoaded
    // block below picks it up exactly like an email/password login does -
    // no extra wiring needed there.
    async function authSignInWithGoogle() {
      if (!sbReady) {
        authSetError('Cloud accounts are not set up yet - ask the developer to add a Supabase config. You can still Play as Guest.');
        return;
      }
      authSetError('');
      authSetStatus('Redirecting to Google...');
      const { error } = await sbClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
      });
      if (error) {
        authSetStatus('');
        authSetError(error.message || 'Something went wrong.');
      }
      // On success the browser navigates away to Google immediately, so
      // there's nothing further to do here.
    }

    async function authSubmit() {
      if (!sbReady) {
        authSetError('Cloud accounts are not set up yet - ask the developer to add a Supabase config. You can still Play as Guest.');
        return;
      }
      const email = (document.getElementById('auth-email').value || '').trim();
      const password = document.getElementById('auth-password').value || '';
      authSetError('');
      if (!email || !password) {
        authSetError('Enter an email and password.');
        return;
      }
      if (password.length < 6) {
        authSetError('Password must be at least 6 characters.');
        return;
      }
      authSetStatus(authMode === 'signup' ? 'Creating account...' : 'Logging in...');
      const { data, error } = authMode === 'signup'
        ? await sbClient.auth.signUp({ email, password })
        : await sbClient.auth.signInWithPassword({ email, password });
      if (error) {
        authSetStatus('');
        authSetError(error.message || 'Something went wrong.');
        return;
      }
      if (authMode === 'signup' && data && data.user && !data.session) {
        // Email confirmation is required (default Supabase setting) - no
        // session yet, so there's nothing to sync/reload until they confirm.
        authSetStatus('');
        authSetError('Check your email to confirm your account, then log in.');
        return;
      }
      // Success with an active session is handled by onAuthStateChange below.
    }

    async function authSignOut() {
      if (sbClient) await sbClient.auth.signOut();
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
        sessionStorage.removeItem(ROLE_FLAG);
        sessionStorage.removeItem(USERNAME_FLAG);
        sessionStorage.removeItem(AVATAR_FLAG);
      } catch (e) {}
      location.reload();
    }

    // --- Cloud save pull (login) ---------------------------------------
    async function pullCloudSaveAndReload(user) {
      let role = 'user';
      let username = '';
      let avatar = 'swords';
      try {
        authSetStatus('Loading your saved progress...');
        const { data, error } = await sbClient
          .from('players')
          .select('save_data, role, username, avatar')
          .eq('id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          role = data.role || 'user';
          username = data.username || '';
          avatar = data.avatar || 'swords';
          if (data.save_data) {
            const saved = data.save_data;
            BT_SAVE_KEYS.forEach(key => {
              if (Object.prototype.hasOwnProperty.call(saved, key) && saved[key] !== undefined && saved[key] !== null) {
                localStorage.setItem(key, saved[key]);
              }
            });
          }
        } else {
          // First login on any device - seed the cloud row from whatever
          // local progress already exists (e.g. they played as guest
          // first, then made an account). New rows default to role='user'
          // in the database. Carry over any local guest username/avatar
          // as their starting profile.
          try {
            username = localStorage.getItem('bt_guestUsername') || '';
            avatar = localStorage.getItem('bt_guestAvatar') || 'swords';
          } catch (e) {}
          currentUsername = username;
          currentAvatar = avatar;
          await pushCloudSaveNow(user.id);
          await persistProfile();
        }
      } catch (e) {
        console.warn('Account system: cloud pull failed, continuing with local save.', e);
      }
      // Cache role/username/avatar so they survive the reload below
      // without another round trip (handleAuthedUser reads these back for
      // the already-reloaded branch).
      try {
        sessionStorage.setItem(ROLE_FLAG, role);
        sessionStorage.setItem(USERNAME_FLAG, username);
        sessionStorage.setItem(AVATAR_FLAG, avatar);
      } catch (e) {}
      // Reload once so the game's own startup code (which reads bt_* keys
      // into its variables as the page first loads) picks up the synced
      // values. Guarded by a sessionStorage flag so it only happens once
      // per login, not on every page load.
      try { sessionStorage.setItem(RELOAD_FLAG, '1'); } catch (e) {}
      location.reload();
    }

    // --- Cloud save push (debounced, on every local save) ---------------
    let pushTimer = null;
    function pushCloudSaveNow(uid) {
      if (!sbClient) return Promise.resolve();
      const snapshot = {};
      BT_SAVE_KEYS.forEach(key => {
        const v = localStorage.getItem(key);
        if (v !== null) snapshot[key] = v;
      });
      return sbClient
        .from('players')
        .upsert({ id: uid, save_data: snapshot, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.warn('Account system: cloud push failed.', error); })
        .catch(e => console.warn('Account system: cloud push failed.', e));
    }
    function queueCloudPush(uid) {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => pushCloudSaveNow(uid), 1500);
    }

    // Wrap localStorage.setItem so every existing bt_* write elsewhere in
    // this file (unchanged) also mirrors to Supabase for a logged-in
    // player, without having to touch each call site individually.
    (function wrapLocalStorage() {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function (key, value) {
        originalSetItem(key, value);
        if (currentUser && BT_SAVE_KEYS.includes(key)) {
          queueCloudPush(currentUser.id);
        }
      };
    })();

    let currentUser = null;

    function handleAuthedUser(user) {
      currentUser = user;
      authShowBadge(user.email);
      let alreadyReloaded = false;
      try { alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1'; } catch (e) {}
      if (alreadyReloaded) {
        // Already synced+reloaded once this session - just show the game.
        // Role/username/avatar were cached by pullCloudSaveAndReload right
        // before that reload, so read them back instead of another
        // network round trip.
        let cachedRole = 'user', cachedUsername = '', cachedAvatar = 'swords';
        try {
          cachedRole = sessionStorage.getItem(ROLE_FLAG) || 'user';
          cachedUsername = sessionStorage.getItem(USERNAME_FLAG) || '';
          cachedAvatar = sessionStorage.getItem(AVATAR_FLAG) || 'swords';
        } catch (e) {}
        authApplyRoleUI(cachedRole);
        currentUsername = cachedUsername;
        currentAvatar = cachedAvatar;
        updatePlayerBadge();
        authHideScreen();
      } else {
        pullCloudSaveAndReload(user);
      }
    }

    // This whole block touches DOM elements (#auth-screen, #player-badge,
    // #devtools-toggle-btn...) that live in <body>, further down in this
    // file, after this <head> script. Deferring to DOMContentLoaded
    // guarantees those elements exist no matter how fast Supabase's
    // (potentially cached/instant) session check resolves, rather than
    // relying on network latency to "win the race" against HTML parsing.
    document.addEventListener('DOMContentLoaded', () => {
      updatePlayerBadge(); // shows the guest/local default immediately
      if (sbReady) {
        sbClient.auth.getSession().then(({ data }) => {
          if (data && data.session && data.session.user) {
            handleAuthedUser(data.session.user);
          }
          // else: no session - the login/signup screen stays visible
          // (#auth-screen is already the default state on load).
        });
        sbClient.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session && session.user && !currentUser) {
            handleAuthedUser(session.user);
          } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            authShowBadge(null);
          }
        });
      } else {
        // No Supabase configured - skip straight past the gate into guest
        // play so the game is never blocked by a missing setup step. With
        // no account system active there's no privilege model to enforce,
        // so Dev Tools stays visible exactly like it did before accounts
        // existed (the CSS default hides it; this un-hides it).
        authHideScreen();
        const devToggleBtn = document.getElementById('devtools-toggle-btn');
        if (devToggleBtn) devToggleBtn.style.display = '';
      }
    });

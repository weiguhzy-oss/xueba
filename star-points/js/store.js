/* ============================================================
   成为学霸 · data layer
   Per-account isolated balances, items and history, persisted to
   localStorage. Points are derived from history, never free-typed,
   so the displayed total can't drift from the log.
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'become-top-student.v1';
  var MAX_HISTORY = 400;           // per account, trimmed oldest-first
  var LEVEL_STEP = 100;            // points per 探险等级

  var AVATAR_GRADIENTS = [
    'linear-gradient(135deg,var(--gold),#ff9e4d)',
    'linear-gradient(135deg,var(--cyan),#3b8cff)',
    'linear-gradient(135deg,var(--violet),#ff6bd0)',
    'linear-gradient(135deg,var(--mint),#2fd3a5)',
    'linear-gradient(135deg,var(--rose),#ff9e4d)'
  ];

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 7);
  }

  /* ---------- seed: the data shown in the design export ---------- */
  function seed() {
    var now = Date.now();
    var acctId = uid('a');
    return {
      activeId: acctId,
      accounts: [{
        id: acctId,
        name: 'Jiamu',
        avatarIndex: 0,
        createdAt: now,
        earn: [
          { id: uid('e'), name: '写日记', note: '每天记录一件小事', icon: '📔', value: 10 },
          { id: uid('e'), name: '读书笔记', note: '读完写几句感想', icon: '📖', value: 10 }
        ],
        spend: [
          { id: uid('s'), name: '看视频', note: '30 分钟动画片', icon: '📺', value: 10 }
        ],
        history: []
      }]
    };
  }

  /* ---------- persistence ---------- */
  function load() {
    var raw;
    try {
      raw = global.localStorage.getItem(KEY);
    } catch (err) {
      // Private mode / storage disabled — run in memory for this session.
      return seed();
    }
    if (!raw) return seed();
    try {
      var data = JSON.parse(raw);
      return valid(data) ? data : seed();
    } catch (err) {
      return seed();
    }
  }

  function valid(d) {
    return d && Array.isArray(d.accounts) && d.accounts.length > 0 &&
      d.accounts.every(function (a) {
        return a && typeof a.id === 'string' && typeof a.name === 'string' &&
          Array.isArray(a.earn) && Array.isArray(a.spend) && Array.isArray(a.history);
      });
  }

  var state = load();

  function save() {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      // Quota or disabled storage: keep the session usable, drop durability.
    }
  }

  /* ---------- accessors ---------- */
  function accounts() { return state.accounts; }

  function active() {
    var found = state.accounts.filter(function (a) { return a.id === state.activeId; })[0];
    if (!found) {
      state.activeId = state.accounts[0].id;
      found = state.accounts[0];
    }
    return found;
  }

  function balanceOf(acct) {
    return acct.history.reduce(function (sum, h) { return sum + h.delta; }, 0);
  }

  function balance() { return balanceOf(active()); }

  function levelOf(points) {
    var p = Math.max(0, points);
    var level = Math.floor(p / LEVEL_STEP) + 1;
    var into = p % LEVEL_STEP;
    return {
      level: level,
      into: into,
      remain: LEVEL_STEP - into,
      percent: Math.round((into / LEVEL_STEP) * 100)
    };
  }

  function avatarGradient(index) {
    return AVATAR_GRADIENTS[(index || 0) % AVATAR_GRADIENTS.length];
  }

  function initialOf(name) {
    return (name || '?').trim().charAt(0).toUpperCase() || '?';
  }

  /* ---------- mutations: scoring ---------- */

  // Records an earn tap. Returns the new balance.
  function score(itemId) {
    var acct = active();
    var item = acct.earn.filter(function (i) { return i.id === itemId; })[0];
    if (!item) return null;
    acct.history.unshift({
      id: uid('h'), at: Date.now(), name: item.name,
      icon: item.icon, delta: item.value, kind: 'earn'
    });
    trim(acct);
    save();
    return balanceOf(acct);
  }

  // Records a redeem tap. Refuses when the balance is short, so the
  // total never goes negative. Returns the new balance, or null.
  function redeem(itemId) {
    var acct = active();
    var item = acct.spend.filter(function (i) { return i.id === itemId; })[0];
    if (!item) return null;
    if (balanceOf(acct) < item.value) return null;
    acct.history.unshift({
      id: uid('h'), at: Date.now(), name: item.name,
      icon: item.icon, delta: -item.value, kind: 'spend'
    });
    trim(acct);
    save();
    return balanceOf(acct);
  }

  function trim(acct) {
    if (acct.history.length > MAX_HISTORY) {
      acct.history.length = MAX_HISTORY;
    }
  }

  /* ---------- mutations: items ---------- */
  function addItem(kind, name, value, icon) {
    var acct = active();
    var item = {
      id: uid(kind === 'earn' ? 'e' : 's'),
      name: name, note: '', icon: icon, value: value
    };
    acct[kind].push(item);
    save();
    return item;
  }

  function removeItem(kind, itemId) {
    var acct = active();
    var list = acct[kind];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === itemId) {
        var gone = list.splice(i, 1)[0];
        save();
        return gone;
      }
    }
    return null;
  }

  // Reorders a list in place: pulls itemId out and reinserts it at `to`.
  // `to` is an index into the list *after* the removal, which is what the
  // drag-reorder UI computes from the gap the card is hovering over.
  function moveItem(kind, itemId, to) {
    var list = active()[kind];
    var from = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === itemId) { from = i; break; }
    }
    if (from < 0) return false;
    if (to < 0) to = 0;
    if (to > list.length - 1) to = list.length - 1;
    if (to === from) return false;
    list.splice(to, 0, list.splice(from, 1)[0]);
    save();
    return true;
  }

  function findItem(itemId) {
    var acct = active();
    var kinds = ['earn', 'spend'];
    for (var k = 0; k < kinds.length; k++) {
      var hit = acct[kinds[k]].filter(function (i) { return i.id === itemId; })[0];
      if (hit) return { kind: kinds[k], item: hit };
    }
    return null;
  }

  /* ---------- mutations: accounts ---------- */
  // photo is an optional data-URL; when absent the gradient initial is used.
  function addAccount(name, photo) {
    var acct = {
      id: uid('a'), name: name,
      avatarIndex: state.accounts.length % AVATAR_GRADIENTS.length,
      photo: photo || null,
      createdAt: Date.now(),
      earn: [], spend: [], history: []
    };
    state.accounts.push(acct);
    save();
    return acct;
  }

  // Renames and/or re-photographs an account. Pass photo === null to clear.
  function updateAccount(id, name, photo) {
    var acct = state.accounts.filter(function (a) { return a.id === id; })[0];
    if (!acct) return false;
    if (name) acct.name = name;
    if (photo !== undefined) acct.photo = photo;
    save();
    return true;
  }

  // Refuses to remove the last account — the app always needs one.
  function removeAccount(id) {
    if (state.accounts.length <= 1) return false;
    var idx = -1;
    for (var i = 0; i < state.accounts.length; i++) {
      if (state.accounts[i].id === id) { idx = i; break; }
    }
    if (idx < 0) return false;
    state.accounts.splice(idx, 1);
    if (state.activeId === id) {
      state.activeId = state.accounts[0].id;
    }
    save();
    return true;
  }

  function switchTo(id) {
    var exists = state.accounts.some(function (a) { return a.id === id; });
    if (!exists) return false;
    state.activeId = id;
    save();
    return true;
  }

  // exceptId lets an account keep its own name while being edited.
  function nameTaken(name, exceptId) {
    var lower = name.trim().toLowerCase();
    return state.accounts.some(function (a) {
      return a.id !== exceptId && a.name.trim().toLowerCase() === lower;
    });
  }

  /* ---------- derived: weekly totals for the history header ---------- */
  function weekTotals() {
    var acct = active();
    var since = Date.now() - 7 * 24 * 3600 * 1000;
    var plus = 0, minus = 0;
    acct.history.forEach(function (h) {
      if (h.at < since) return;
      if (h.delta > 0) plus += h.delta; else minus -= h.delta;
    });
    return { plus: plus, minus: minus };
  }

  global.Store = {
    LEVEL_STEP: LEVEL_STEP,
    uid: uid,
    save: save,
    accounts: accounts,
    active: active,
    balance: balance,
    balanceOf: balanceOf,
    levelOf: levelOf,
    avatarGradient: avatarGradient,
    initialOf: initialOf,
    score: score,
    redeem: redeem,
    addItem: addItem,
    removeItem: removeItem,
    moveItem: moveItem,
    findItem: findItem,
    addAccount: addAccount,
    updateAccount: updateAccount,
    removeAccount: removeAccount,
    switchTo: switchTo,
    nameTaken: nameTaken,
    weekTotals: weekTotals
  };
})(window);

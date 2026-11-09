/* ============================================================
   成为学霸 · UI layer
   Views are routed in-place; one surface visible at a time.
   ============================================================ */
(function () {
  'use strict';

  var S = window.Store;
  var $ = function (id) { return document.getElementById(id); };

  var EARN_ICONS = ['📔', '📖', '✏️', '🎹', '🏃', '🧹', '🦷', '🥦', '🧮', '🎨'];
  var SPEND_ICONS = ['📺', '🎮', '🍦', '🎠', '🧸', '🍿', '🚲', '🎧', '🏀', '🎁'];

  /* ---------- small helpers ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    clearTimeout(toastTimer);
    t.classList.remove('out');
    t.textContent = msg;
    t.hidden = false;
    toastTimer = setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { t.hidden = true; }, 220);
    }, 1800);
  }

  function buzz(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  /* ---------- date formatting for the history log ---------- */

  function startOfDay(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  // "今天 · 11月6日" / "昨天 · 11月5日" / "11月4日"
  function dayLabel(ts) {
    var today = startOfDay(Date.now());
    var day = startOfDay(ts);
    var d = new Date(ts);
    var md = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    var diff = Math.round((today - day) / 86400000);
    if (diff === 0) return '今天 · ' + md;
    if (diff === 1) return '昨天 · ' + md;
    return md;
  }

  // "今天 08:12" / "昨天 20:15" / "周一 08:05" / "11月4日 08:05"
  function timeLabel(ts) {
    var today = startOfDay(Date.now());
    var day = startOfDay(ts);
    var d = new Date(ts);
    var hm = String(d.getHours()).padStart(2, '0') + ':' +
             String(d.getMinutes()).padStart(2, '0');
    var diff = Math.round((today - day) / 86400000);
    if (diff === 0) return '今天 ' + hm;
    if (diff === 1) return '昨天 ' + hm;
    if (diff < 7) return WEEKDAYS[d.getDay()] + ' ' + hm;
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
  }

  /* ---------- routing ---------- */

  var VIEWS = ['home', 'history', 'add', 'accounts', 'settings'];
  var stack = ['home'];

  function show(name) {
    VIEWS.forEach(function (v) {
      $('view-' + v).hidden = (v !== name);
    });
    var view = $('view-' + name);
    view.scrollTop = 0;
    render(name);
  }

  function go(name) {
    if (stack[stack.length - 1] === name) return;
    stack.push(name);
    history.pushState({ view: name }, '');
    show(name);
  }

  // fromBack: the history entry is already gone, don't consume another.
  function back(fromBack) {
    if (stack.length <= 1) return;
    stack.pop();
    show(stack[stack.length - 1]);
    if (!fromBack) consumeEntry();
  }

  /* ---------- avatars ----------
     An account either has a photo (data-URL) or falls back to its
     gradient + initial. Both render at whatever size the class defines. */

  function avatarHtml(acct, cls) {
    if (acct.photo) {
      return '<div class="' + cls + ' has-photo" style="background-image:url(' +
        acct.photo + ')"></div>';
    }
    return '<div class="' + cls + '" style="background:' +
      S.avatarGradient(acct.avatarIndex) + '">' + esc(S.initialOf(acct.name)) + '</div>';
  }

  // Applies an avatar to an existing element (used for the home app bar).
  function paintAvatar(el, acct) {
    if (acct.photo) {
      el.classList.add('has-photo');
      el.textContent = '';
      el.style.background = '';
      el.style.backgroundImage = 'url(' + acct.photo + ')';
    } else {
      el.classList.remove('has-photo');
      el.style.backgroundImage = '';
      el.textContent = S.initialOf(acct.name);
      el.style.background = S.avatarGradient(acct.avatarIndex);
    }
  }

  /* ---------- render: home ---------- */

  function renderHome() {
    var acct = S.active();
    var points = S.balance();
    var lv = S.levelOf(points);

    $('homeName').textContent = acct.name;
    paintAvatar($('homeAvatar'), acct);

    var numEl = $('scoreNum');
    var prev = numEl.textContent;
    numEl.textContent = points;
    if (prev !== String(points)) {
      var big = $('scoreBig');
      big.classList.remove('bump');
      void big.offsetWidth;          // restart the animation
      big.classList.add('bump');
    }

    $('xpFill').style.width = lv.percent + '%';
    $('xpLevel').textContent = '探险等级 Lv.' + lv.level;
    $('xpNext').innerHTML = '再 <b>' + lv.remain + '</b> 升 Lv.' + (lv.level + 1);

    renderItems('earn', acct.earn, points);
    renderItems('spend', acct.spend, points);
  }

  /* ---------- tab switching ---------- */

  function selectTab(kind) {
    var earn = kind === 'earn';
    $('tabEarn').setAttribute('aria-selected', String(earn));
    $('tabSpend').setAttribute('aria-selected', String(!earn));
    $('panelEarn').hidden = !earn;
    $('panelSpend').hidden = earn;
  }

  $('tabEarn').addEventListener('click', function () { selectTab('earn'); });
  $('tabSpend').addEventListener('click', function () { selectTab('spend'); });

  // Left/right arrows move between tabs, per the tablist pattern.
  $('tabEarn').parentNode.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var toEarn = e.key === 'ArrowLeft';
    selectTab(toEarn ? 'earn' : 'spend');
    $(toEarn ? 'tabEarn' : 'tabSpend').focus();
  });

  function renderItems(kind, list, points) {
    var host = $(kind === 'earn' ? 'earnList' : 'spendList');
    if (!list.length) {
      host.innerHTML = '<div class="empty">' +
        '<div class="eic">' + (kind === 'earn' ? '✅' : '🎁') + '</div>' +
        '<div class="et">' + (kind === 'earn' ? '还没有积分项' : '还没有兑换项') + '</div>' +
        '<div class="es">点右上角 ⚙️ → ' +
        (kind === 'earn' ? '「添加积分项」新建任务' : '「添加兑换项」新建奖励') +
        '</div></div>';
      return;
    }
    host.innerHTML = list.map(function (it) {
      var short = kind === 'spend' && points < it.value;
      return '<button class="item' + (kind === 'spend' ? ' spend' : '') + '"' +
        ' type="button" data-item="' + it.id + '" data-kind="' + kind + '"' +
        (short ? ' aria-disabled="true"' : '') +
        ' aria-label="' + esc(it.name) + ' ' + (kind === 'earn' ? '加' : '减') + it.value + '分">' +
        '<span class="ib">' + esc(it.icon) + '</span>' +
        '<span class="txt"><span class="nm">' + esc(it.name) + '</span></span>' +
        '<span class="val ' + (kind === 'earn' ? 'plus' : 'minus') + '">' +
        (kind === 'earn' ? '+' : '−') + it.value + '</span>' +
        '<span class="grip" aria-hidden="true">⠿</span>' +
        '</button>';
    }).join('');
  }

  /* ---------- render: history ---------- */

  function renderHistory() {
    var acct = S.active();
    var w = S.weekTotals();
    $('histSub').textContent = acct.name + ' · 本周 +' + w.plus + ' / −' + w.minus;

    var host = $('histList');
    if (!acct.history.length) {
      host.innerHTML = '<div class="empty">' +
        '<div class="eic">🕐</div><div class="et">还没有记录</div>' +
        '<div class="es">回到主界面点一下任务卡片就会记在这里</div></div>';
      return;
    }

    var html = '';
    var lastDay = null;
    acct.history.forEach(function (h) {
      var day = startOfDay(h.at);
      if (day !== lastDay) {
        html += '<div class="daylabel">' + dayLabel(h.at) + '</div>';
        lastDay = day;
      }
      var earn = h.delta > 0;
      html += '<div class="histrow ' + (earn ? 'earn' : 'spend') + '">' +
        '<div class="hb">' + esc(h.icon) + '</div>' +
        '<div class="txt"><div class="hn">' + esc(h.name) + '</div>' +
        '<div class="ht">' + timeLabel(h.at) + '</div></div>' +
        '<div class="hv ' + (earn ? 'p' : 'm') + '">' +
        (earn ? '+' + h.delta : '−' + (-h.delta)) + '</div></div>';
    });
    host.innerHTML = html;
  }

  /* ---------- render: accounts ---------- */

  function renderAccounts() {
    var all = S.accounts();
    var activeId = S.active().id;
    $('acctCount').textContent = all.length + ' 人';

    $('acctList').innerHTML = all.map(function (a) {
      var pts = S.balanceOf(a);
      var lv = S.levelOf(pts);
      var isActive = a.id === activeId;
      var only = all.length <= 1;
      // The name/avatar area is its own button so tapping the row switches
      // accounts, while edit and delete stay as separate siblings — nesting
      // buttons is invalid HTML and browsers unnest them.
      return '<div class="acctrow' + (isActive ? ' active' : '') + '">' +
        '<button class="apick" type="button" data-switch-acct="' + a.id + '"' +
        (isActive ? ' aria-current="true"' : '') +
        ' aria-label="切换到 ' + esc(a.name) + '">' +
        avatarHtml(a, 'aav') +
        '<span class="txt"><span class="an"><span class="nmtxt">' + esc(a.name) + '</span>' +
        (isActive ? '<span class="abadge">使用中</span>' : '') + '</span>' +
        '<span class="as">' + pts + ' 星 · ' +
        (pts > 0 ? '探险 Lv.' + lv.level : '新伙伴') + '</span></span></button>' +
        '<button class="aedit" type="button" data-edit-acct="' + a.id + '"' +
        ' aria-label="编辑账户 ' + esc(a.name) + '">✏️</button>' +
        '<button class="adel" type="button" data-del-acct="' + a.id + '"' +
        (only ? ' disabled' : '') +
        ' aria-label="删除账户 ' + esc(a.name) + '">🗑</button></div>';
    }).join('');
  }

  /* ---------- render: settings ---------- */

  // Which form the 添加项目 screen shows, set by the settings entry tapped.
  var addMode = 'earn';

  function renderSettings() {
    var acct = S.active();
    $('setSub').textContent = '当前账户 · ' + acct.name;
    $('setAcctCount').textContent = S.accounts().length + ' 个账户';
    $('setEarnCount').textContent = acct.earn.length
      ? '已有 ' + acct.earn.length + ' 个任务' : '新建可加分的任务';
    $('setSpendCount').textContent = acct.spend.length
      ? '已有 ' + acct.spend.length + ' 个奖励' : '新建可兑换的奖励';
  }

  // Shows only the form matching the settings entry that was tapped.
  function renderAdd() {
    var earn = addMode === 'earn';
    $('addTitle').textContent = earn ? '添加积分项' : '添加兑换项';
    $('addSub').textContent = '给 ' + S.active().name +
      (earn ? ' 新增积分任务' : ' 新增兑换奖励');
    $('titleEarn').hidden = !earn;
    $('formEarn').hidden = !earn;
    $('titleSpend').hidden = earn;
    $('formSpend').hidden = earn;
  }

  function render(name) {
    if (name === 'home') renderHome();
    else if (name === 'history') renderHistory();
    else if (name === 'accounts') renderAccounts();
    else if (name === 'settings') renderSettings();
    else if (name === 'add') renderAdd();
  }

  /* ---------- confirm dialog ---------- */

  var confirmCb = null;

  function confirmAsk(title, body, okLabel, cb) {
    $('cfTitle').textContent = title;
    $('cfBody').textContent = body;
    $('cfYes').textContent = okLabel;
    confirmCb = cb;
    $('confirmScrim').hidden = false;
    history.pushState({ layer: 'confirm' }, '');
    $('cfNo').focus();
  }

  function confirmClose(fromBack) {
    $('confirmScrim').hidden = true;
    confirmCb = null;
    if (!fromBack) consumeEntry();
  }

  $('cfNo').addEventListener('click', confirmClose);
  $('cfYes').addEventListener('click', function () {
    var cb = confirmCb;
    confirmClose();
    if (cb) cb();
  });
  $('confirmScrim').addEventListener('click', function (e) {
    if (e.target === this) confirmClose();
  });

  /* ---------- switch-account sheet ---------- */

  function sheetOpen() {
    var activeId = S.active().id;
    $('sheetList').innerHTML = S.accounts().map(function (a) {
      var pts = S.balanceOf(a);
      var isActive = a.id === activeId;
      return '<button class="acctrow' + (isActive ? ' active' : '') + '"' +
        ' type="button" data-switch="' + a.id + '">' +
        avatarHtml(a, 'aav') +
        '<span class="txt"><span class="an"><span class="nmtxt">' + esc(a.name) + '</span>' +
        (isActive ? '<span class="abadge">当前</span>' : '') + '</span>' +
        '<span class="as">' + pts + ' 星</span></span></button>';
    }).join('');
    $('sheetScrim').hidden = false;
    history.pushState({ layer: 'sheet' }, '');
  }

  function sheetClose(fromBack) {
    $('sheetScrim').hidden = true;
    if (!fromBack) consumeEntry();
  }

  $('sheetScrim').addEventListener('click', function (e) {
    if (e.target === this) sheetClose();
  });

  $('sheetList').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-switch]');
    if (!btn) return;
    var id = btn.getAttribute('data-switch');
    if (id !== S.active().id) {
      S.switchTo(id);
      toast('已切换到 ' + S.active().name);
    }
    // Unwind to home: one entry for the sheet, plus one per stacked view.
    var steps = 1 + (stack.length - 1);
    stack = ['home'];
    $('sheetScrim').hidden = true;
    show('home');
    consumeEntry(steps);
  });

  /* ---------- long-press drag to delete ---------- */

  var LONG_PRESS_MS = 420;
  var MOVE_TOLERANCE = 10;          // px of slop before a press becomes a scroll

  var drag = null;                  // active drag session
  var pressTimer = null;
  var pressStart = null;
  var suppressClick = false;        // a finished drag must not also score the card

  function clearPress() {
    clearTimeout(pressTimer);
    pressTimer = null;
    pressStart = null;
  }

  function onPointerDown(e) {
    // Only start drag if the pointer is on the grip handle, not anywhere on the card.
    // This allows the rest of the card surface to remain scrollable.
    var grip = e.target.closest('.grip');
    if (!grip) return;
    var card = grip.closest('.item');
    if (!card || drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // Capture the pointer so move events are delivered even if the finger
    // drifts outside the element during the long press.
    card.setPointerCapture(e.pointerId);

    pressStart = {
      card: card, x: e.clientX, y: e.clientY,
      id: card.getAttribute('data-item'),
      kind: card.getAttribute('data-kind'),
      pointerId: e.pointerId
    };
    pressTimer = setTimeout(function () {
      if (pressStart) beginDrag(pressStart);
    }, LONG_PRESS_MS);
  }

  function beginDrag(p) {
    var card = p.card;
    var rect = card.getBoundingClientRect();
    var appRect = document.querySelector('.app').getBoundingClientRect();

    var ghost = card.cloneNode(true);
    ghost.classList.add('dragging');
    ghost.style.position = 'fixed';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.style.width = rect.width + 'px';
    ghost.style.margin = '0';
    ghost.style.pointerEvents = 'none';

    var tip = document.createElement('span');
    tip.className = 'ghosttip';
    ghost.appendChild(tip);

    document.body.appendChild(ghost);
    card.classList.add('drag-origin');

    drag = {
      id: p.id, kind: p.kind, card: card, ghost: ghost, tip: tip,
      host: card.parentNode,
      name: card.querySelector('.nm').textContent,
      // The card itself stays in the list as the placeholder gap and gets
      // moved among its siblings as the ghost passes their midpoints.
      startIndex: indexOf(card),
      pointerId: p.pointerId,
      dx: p.x - rect.left, dy: p.y - rect.top,
      appRect: appRect, over: false
    };
    setTip();

    // The zone only exists while a drag is in flight.
    $('delzone').hidden = false;
    buzz(14);
    clearPress();
    moveGhost(p.x, p.y);
  }

  function indexOf(card) {
    return Array.prototype.indexOf.call(card.parentNode.children, card);
  }

  // One drag does either reordering or deletion, so the hint tracks whichever
  // the finger is currently over.
  function setTip() {
    if (!drag) return;
    drag.tip.textContent = drag.over
      ? '松手即删除「' + drag.name + '」'
      : '拖到想要的位置后松手';
  }

  // Slides the placeholder to the gap the ghost's centre is sitting in: it goes
  // before the first sibling whose midpoint is below the finger, else last.
  // Measuring the live rects each call keeps one move per pass.
  function reorderTo(y) {
    var card = drag.card;
    var before = null;
    var sibs = Array.prototype.filter.call(drag.host.children, function (el) {
      return el !== card && el.classList.contains('item');
    });
    for (var i = 0; i < sibs.length; i++) {
      var r = sibs[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { before = sibs[i]; break; }
    }
    if (card.nextElementSibling === before && before !== null) return;
    if (before === null && card.nextElementSibling === null) return;
    drag.host.insertBefore(card, before);
    buzz(6);
  }

  function moveGhost(x, y) {
    if (!drag) return;
    drag.ghost.style.left = (x - drag.dx) + 'px';
    drag.ghost.style.top = (y - drag.dy) + 'px';

    var zone = $('delzone').getBoundingClientRect();
    var over = x >= zone.left && x <= zone.right && y >= zone.top && y <= zone.bottom;
    if (over !== drag.over) {
      drag.over = over;
      $('delzone').classList.toggle('hot', over);
      setTip();
      if (over) buzz(10);
    }
    // Over the bin the card is on its way out, so stop shuffling the list.
    if (!over) reorderTo(y - drag.dy + drag.ghost.offsetHeight / 2);
  }

  function onPointerMove(e) {
    if (drag) {
      e.preventDefault();
      moveGhost(e.clientX, e.clientY);
      return;
    }
    if (!pressStart) return;
    // Moved before the long press fired — treat it as a scroll, not a drag.
    if (Math.abs(e.clientX - pressStart.x) > MOVE_TOLERANCE ||
        Math.abs(e.clientY - pressStart.y) > MOVE_TOLERANCE) {
      clearPress();
    }
  }

  function endDrag(dropped) {
    if (!drag) return;
    var d = drag;
    drag = null;
    suppressClick = true;
    setTimeout(function () { suppressClick = false; }, 60);

    d.ghost.remove();
    d.card.classList.remove('drag-origin');
    $('delzone').classList.remove('hot');
    $('delzone').hidden = true;

    if (!d.over) {
      // Dropped back in the list: persist wherever the placeholder ended up.
      // A cancelled drag re-renders too, which snaps the DOM back to the
      // stored order and undoes the preview.
      var to = indexOf(d.card);
      if (dropped && to !== d.startIndex && S.moveItem(d.kind, d.id, to)) {
        renderHome();
        buzz(12);
      } else if (to !== d.startIndex) {
        renderHome();
      }
      return;
    }
    if (!dropped) return;

    var found = S.findItem(d.id);
    if (!found) return;
    confirmAsk('删除「' + found.item.name + '」？',
      '这个' + (d.kind === 'earn' ? '任务' : '奖励') +
      '会从主界面移除。已经记下的历史积分不受影响。',
      '删除',
      function () {
        S.removeItem(d.kind, d.id);
        renderHome();
        toast('已删除「' + found.item.name + '」');
        buzz(18);
      });
  }

  function onPointerUp(e) {
    if (drag) {
      if (e.pointerId !== undefined && e.pointerId !== drag.pointerId) return;
      endDrag(true);
      return;
    }
    clearPress();
  }

  function onPointerCancel() {
    if (drag) endDrag(false);
    clearPress();
  }

  var home = $('view-home');
  // Listen on the tabpanels instead of home, since they are the scroll containers
  // now and pointer events won't bubble through their scroll regions otherwise.
  ['panelEarn', 'panelSpend'].forEach(function (id) {
    var panel = $(id);
    panel.addEventListener('pointerdown', onPointerDown);
    // Don't cancel press on scroll — the scroll listener was interfering with
    // vertical drag gestures because tabpanel scrolling would fire during the
    // long press and cancel it before beginDrag could disable scrolling.
    // panel.addEventListener('scroll', function () { clearPress(); }, { passive: true });
    panel.addEventListener('contextmenu', function (e) {
      if (e.target.closest('.item')) e.preventDefault();
    });
  });
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);

  /* ---------- tap to score / redeem ---------- */

  // Re-finds the card after a re-render and restarts its feedback animation.
  function pulse(itemId, cls) {
    var el = home.querySelector('[data-item="' + itemId + '"]');
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  home.addEventListener('click', function (e) {
    var card = e.target.closest('.item');
    if (!card || drag || suppressClick) return;

    var id = card.getAttribute('data-item');
    var kind = card.getAttribute('data-kind');

    var target = S.findItem(id);
    if (!target) return;

    if (kind === 'earn') {
      S.score(id);
      buzz(12);
      renderHome();
      pulse(id, 'scored');
      toast('+' + target.item.value + ' 星 · ' + target.item.name);
      return;
    }

    if (S.redeem(id) === null) {
      pulse(id, 'denied');
      buzz(24);
      toast('还差 ' + (target.item.value - S.balance()) + ' 星才能兑换');
      return;
    }
    buzz(12);
    renderHome();
    pulse(id, 'scored');
    toast('−' + target.item.value + ' 星 · ' + target.item.name);
  });

  /* ---------- emoji pickers ---------- */

  function buildEmoji(hostId, icons) {
    var host = $(hostId);
    host.innerHTML = icons.map(function (ic, i) {
      return '<button class="eo" type="button" data-icon="' + ic + '"' +
        ' aria-pressed="' + (i === 0 ? 'true' : 'false') + '"' +
        ' aria-label="图标 ' + ic + '">' + ic + '</button>';
    }).join('');
    host.addEventListener('click', function (e) {
      var btn = e.target.closest('.eo');
      if (!btn) return;
      host.querySelectorAll('.eo').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
    });
  }

  function pickedIcon(hostId, fallback) {
    var on = $(hostId).querySelector('.eo[aria-pressed="true"]');
    return on ? on.getAttribute('data-icon') : fallback;
  }

  buildEmoji('earnEmoji', EARN_ICONS);
  buildEmoji('spendEmoji', SPEND_ICONS);

  /* ---------- form validation ---------- */

  function setInvalid(fieldId, invalid, msg) {
    var f = $(fieldId);
    f.classList.toggle('invalid', invalid);
    if (msg) f.querySelector('.err').textContent = msg;
  }

  // Clear the error as soon as the child starts fixing it.
  ['earnName', 'earnVal', 'spendName', 'spendVal', 'acctName'].forEach(function (id) {
    $(id).addEventListener('input', function () {
      var field = $(id).closest('.field');
      if (field) field.classList.remove('invalid');
    });
  });

  function readValue(inputId) {
    var raw = $(inputId).value.trim();
    if (!/^\d+$/.test(raw)) return null;
    var n = parseInt(raw, 10);
    if (n < 1 || n > 999) return null;
    return n;
  }

  function submitItem(kind, nameId, valId, nameField, valField, emojiHost, fallbackIcon) {
    var name = $(nameId).value.trim();
    var value = readValue(valId);
    var ok = true;

    if (!name) { setInvalid(nameField, true, '请输入项目名称'); ok = false; }
    else setInvalid(nameField, false);

    if (value === null) { setInvalid(valField, true, '请输入 1–999 的整数'); ok = false; }
    else setInvalid(valField, false);

    if (!ok) { buzz(24); return; }

    S.addItem(kind, name, value, pickedIcon(emojiHost, fallbackIcon));
    $(nameId).value = '';
    $(valId).value = '';
    $(nameId).blur();
    $(valId).blur();
    toast('已添加「' + name + '」');
    buzz(12);
  }

  $('formEarn').addEventListener('submit', function (e) {
    e.preventDefault();
    submitItem('earn', 'earnName', 'earnVal', 'fEarnName', 'fEarnVal', 'earnEmoji', '✅');
  });

  $('formSpend').addEventListener('submit', function (e) {
    e.preventDefault();
    submitItem('spend', 'spendName', 'spendVal', 'fSpendName', 'fSpendVal', 'spendEmoji', '🎁');
  });

  /* ---------- account form ---------- */

  /* ---------- avatar photo picking ----------
     One hidden <input type=file> serves both the create form and the edit
     sheet; pickTarget records which asked for it. */

  var pickTarget = null;        // 'new' | 'edit'
  var newPhoto = null;          // staged data-URL for the create form
  var editPhoto = null;         // staged data-URL for the edit sheet

  function openPicker(target) {
    pickTarget = target;
    $('photoInput').value = '';   // so re-picking the same file still fires
    $('photoInput').click();
  }

  $('photoInput').addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (!file) return;
    var target = pickTarget;
    window.Photo.fromFile(file, function (err, dataUrl) {
      if (err) {
        toast('这张图片读不出来，换一张试试');
        return;
      }
      if (target === 'new') {
        newPhoto = dataUrl;
        paintPickPreview('acctAv', newPhoto, $('acctName').value);
      } else {
        editPhoto = dataUrl;
        paintPickPreview('editAv', editPhoto, $('editName').value);
      }
      buzz(10);
    });
  });

  // Updates one of the two avatar preview buttons.
  function paintPickPreview(prefix, photo, nameForInitial) {
    var prev = $(prefix + 'Prev');
    var fb = $(prefix + 'Fallback');
    var clear = $(prefix + 'Clear');
    if (photo) {
      prev.classList.add('has-photo');
      prev.style.backgroundImage = 'url(' + photo + ')';
      fb.hidden = true;
      clear.hidden = false;
    } else {
      prev.classList.remove('has-photo');
      prev.style.backgroundImage = '';
      fb.hidden = false;
      fb.textContent = S.initialOf(nameForInitial || '?');
      clear.hidden = true;
    }
  }

  $('acctAvPick').addEventListener('click', function () { openPicker('new'); });
  $('acctAvPrev').addEventListener('click', function () { openPicker('new'); });
  $('acctAvClear').addEventListener('click', function () {
    newPhoto = null;
    paintPickPreview('acctAv', null, $('acctName').value);
  });
  $('editAvPick').addEventListener('click', function () { openPicker('edit'); });
  $('editAvPrev').addEventListener('click', function () { openPicker('edit'); });
  $('editAvClear').addEventListener('click', function () {
    editPhoto = null;
    paintPickPreview('editAv', null, $('editName').value);
  });

  // Keep the fallback initial in step with the name being typed.
  $('acctName').addEventListener('input', function () {
    if (!newPhoto) paintPickPreview('acctAv', null, this.value);
  });

  /* ---------- create account ---------- */

  $('formAcct').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('acctName').value.trim();
    if (!name) {
      setInvalid('fAcctName', true, '请输入名字');
      buzz(24);
      return;
    }
    if (S.nameTaken(name)) {
      setInvalid('fAcctName', true, '已经有同名账户了');
      buzz(24);
      return;
    }
    setInvalid('fAcctName', false);
    S.addAccount(name, newPhoto);
    $('acctName').value = '';
    $('acctName').blur();
    newPhoto = null;
    paintPickPreview('acctAv', null, '');
    renderAccounts();
    toast('已新建账户 ' + name);
    buzz(12);
  });

  /* ---------- edit account ---------- */

  var editingId = null;

  function editOpen(id) {
    var acct = S.accounts().filter(function (a) { return a.id === id; })[0];
    if (!acct) return;
    editingId = id;
    editPhoto = acct.photo || null;
    $('editName').value = acct.name;
    setInvalid('fEditName', false);
    paintPickPreview('editAv', editPhoto, acct.name);
    $('editScrim').hidden = false;
    history.pushState({ layer: 'edit' }, '');
  }

  function editClose(fromBack) {
    $('editScrim').hidden = true;
    editingId = null;
    if (!fromBack) consumeEntry();
  }

  $('editCancel').addEventListener('click', function () { editClose(); });
  $('editScrim').addEventListener('click', function (e) {
    if (e.target === this) editClose();
  });

  $('editName').addEventListener('input', function () {
    if (!editPhoto) paintPickPreview('editAv', null, this.value);
  });

  $('formEdit').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!editingId) return;
    var name = $('editName').value.trim();
    if (!name) {
      setInvalid('fEditName', true, '请输入名字');
      buzz(24);
      return;
    }
    if (S.nameTaken(name, editingId)) {
      setInvalid('fEditName', true, '已经有同名账户了');
      buzz(24);
      return;
    }
    S.updateAccount(editingId, name, editPhoto);
    editClose();
    renderAccounts();
    toast('已保存');
    buzz(12);
  });

  $('acctList').addEventListener('click', function (e) {
    var sw = e.target.closest('[data-switch-acct]');
    if (sw) {
      var sid = sw.getAttribute('data-switch-acct');
      if (sid !== S.active().id) {
        S.switchTo(sid);
        renderAccounts();
        toast('已切换到 ' + S.active().name);
        buzz(10);
      }
      return;
    }

    var ed = e.target.closest('[data-edit-acct]');
    if (ed) { editOpen(ed.getAttribute('data-edit-acct')); return; }

    var btn = e.target.closest('[data-del-acct]');
    if (!btn || btn.disabled) return;
    var id = btn.getAttribute('data-del-acct');
    var acct = S.accounts().filter(function (a) { return a.id === id; })[0];
    if (!acct) return;
    confirmAsk('删除账户「' + acct.name + '」？',
      '该账户的 ' + S.balanceOf(acct) + ' 星积分和全部历史记录会一起清除，无法恢复。',
      '删除账户',
      function () {
        if (S.removeAccount(id)) {
          renderAccounts();
          toast('已删除账户 ' + acct.name);
          buzz(18);
        }
      });
  });

  /* ---------- navigation ---------- */

  $('btnSwitch').addEventListener('click', sheetOpen);
  $('btnHistory').addEventListener('click', function () { go('history'); });
  $('btnSettings').addEventListener('click', function () { go('settings'); });
  $('goAddEarn').addEventListener('click', function () {
    addMode = 'earn';
    go('add');
  });
  $('goAddSpend').addEventListener('click', function () {
    addMode = 'spend';
    go('add');
  });
  $('goAccounts').addEventListener('click', function () { go('accounts'); });

  document.querySelectorAll('[data-back]').forEach(function (b) {
    b.addEventListener('click', back);
  });

  /* ---------- Android back button ----------
     Each forward step (open a view, sheet or dialog) pushes exactly one
     history entry, so one back press undoes exactly one step. At the root
     with nothing open there is no spare entry left, so the WebView exits.
     Closing a layer by tapping instead of pressing back must consume that
     layer's entry, which is what `closing` guards against double-handling. */

  // Counts entries we are discarding ourselves. history.go(-n) emits n
  // popstate events, so a boolean would only absorb the first of them.
  var pendingPops = 0;

  function consumeEntry(n) {
    pendingPops += (n || 1);
    history.go(-(n || 1));
  }

  window.addEventListener('popstate', function () {
    if (pendingPops > 0) { pendingPops--; return; }
    if (!$('confirmScrim').hidden) { confirmClose(true); return; }
    if (!$('editScrim').hidden) { editClose(true); return; }
    if (!$('sheetScrim').hidden) { sheetClose(true); return; }
    if (stack.length > 1) { back(true); return; }
    // Root with nothing open: no entry was pushed, so this never fires.
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('confirmScrim').hidden) confirmClose();
    else if (!$('editScrim').hidden) editClose();
    else if (!$('sheetScrim').hidden) sheetClose();
    else if (stack.length > 1) back();
  });

  /* ---------- boot ---------- */

  show('home');

})();

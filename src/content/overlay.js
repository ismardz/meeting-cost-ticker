/**
 * Meeting Cost Ticker — content script.
 * Injects a draggable overlay showing the live cost of the current meeting.
 */
(() => {
  'use strict';

  const DEFAULTS = {
    attendees: 6,
    hourlyRate: 75,
    currency: 'USD',
    running: true,
    scale: 1,
    autoDetect: true,
    hidden: false,
  };

  let settings = { ...DEFAULTS };
  let elapsedSeconds = 0;
  let costAccumulated = 0; // priced per second, so attendee changes are dynamic
  let liveCount = null; // participants detected in the meeting UI (null = unknown)
  let participantEvents = []; // { at: Date, delta: +1/-1, count }
  let tickInterval = null;

  // After a dev-mode reload the old content script keeps running but its
  // chrome.* APIs are dead. Detect that and self-clean up.
  function isExtensionContextValid() {
    try {
      return Boolean(chrome.runtime && chrome.runtime.id);
    } catch {
      return false; // throws "Extension context invalidated" when dead
    }
  }

  function shutdownStaleInstance() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    if (detectionInterval) clearInterval(detectionInterval);
    participantObserver.disconnect();
    overlay.remove();
  }

  const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', MXN: '$', COP: '$', ARS: '$', BRL: 'R$', PEN: 'S/' };

  const currencySymbol = (code) => CURRENCY_SYMBOLS[code] || code + ' ';

  function formatMoney(value) {
    return currencySymbol(settings.currency) + value.toFixed(2);
  }

  function currentAttendees() {
    // Live count wins when detection is on and has seen at least one participant.
    if (settings.autoDetect && liveCount !== null && liveCount > 0) return liveCount;
    return settings.attendees;
  }

  function costPerSecond() {
    return (currentAttendees() * settings.hourlyRate) / 3600;
  }

  function formatElapsed(totalSeconds) {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function render() {
    const costEl = overlay.querySelector('#mct-cost');
    const timeEl = overlay.querySelector('#mct-time');
    if (costEl) costEl.textContent = formatMoney(costAccumulated);
    if (timeEl) timeEl.textContent = formatElapsed(elapsedSeconds);
  }

  function startTicking() {
    if (tickInterval) return;
    tickInterval = setInterval(() => {
      if (!isExtensionContextValid()) {
        shutdownStaleInstance();
        return;
      }
      if (settings.running) {
        costAccumulated += costPerSecond(); // price each second at the current headcount
        elapsedSeconds += 1;
        render();
      }
    }, 1000);
  }

  function setRunning(running) {
    settings.running = running;
    const btn = overlay.querySelector('#mct-toggle');
    if (btn) btn.textContent = running ? '⏸' : '▶';
    overlay.classList.toggle('mct-paused', !running);
    chrome.storage.sync.set({ running });
  }

  function reset() {
    elapsedSeconds = 0;
    costAccumulated = 0;
    participantEvents = [];
    render();
    updateMeta();
  }

  // ---------- overlay construction ----------

  const overlay = document.createElement('div');
  overlay.id = 'meeting-cost-ticker';
  overlay.innerHTML = `
    <div class="mct-header">
      <span class="mct-title">Meeting cost</span>
      <button class="mct-btn" id="mct-close" title="Hide ticker">×</button>
    </div>
    <div class="mct-body">
      <div class="mct-cost" id="mct-cost">$0.00</div>
      <div class="mct-time" id="mct-time">00:00:00</div>
      <div class="mct-meta">
        <span id="mct-meta-text"></span>
      </div>
      <div class="mct-controls">
        <button class="mct-btn" id="mct-toggle" title="Start / pause">⏸</button>
        <button class="mct-btn" id="mct-reset" title="Reset">↺</button>
        <button class="mct-btn" id="mct-settings" title="Settings">⚙</button>
      </div>
    </div>
    <div class="mct-settings" hidden>
      <label class="mct-toggle-row"><input type="checkbox" id="mct-in-autodetect" /> Auto-detect people</label>
      <label>Attendees <input type="number" id="mct-in-attendees" min="1" max="500" /></label>
      <label>Avg rate / hour <input type="number" id="mct-in-rate" min="0" step="0.5" /></label>
      <label>Currency
        <select id="mct-in-currency">
          <option>USD</option><option>EUR</option><option>GBP</option>
          <option>MXN</option><option>COP</option><option>ARS</option>
          <option>BRL</option><option>PEN</option>
        </select>
      </label>
      <button class="mct-btn mct-save" id="mct-save">Save</button>
    </div>
    <div class="mct-resize-handle" id="mct-resize" title="Drag to resize · double-click to reset"></div>
  `;
  document.documentElement.appendChild(overlay);

  // ---------- inline settings ----------

  const settingsPanel = overlay.querySelector('.mct-settings');
  overlay.querySelector('#mct-settings').addEventListener('click', () => {
    settingsPanel.classList.toggle('mct-open');
  });

  // Manual headcount/rate fields are irrelevant while auto-detect drives the count.
  function syncSettingsFieldsState() {
    overlay.querySelector('#mct-in-attendees').disabled = overlay.querySelector('#mct-in-autodetect').checked;
  }

  overlay.querySelector('#mct-in-autodetect').addEventListener('change', syncSettingsFieldsState);

  overlay.querySelector('#mct-save').addEventListener('click', () => {
    const attendees = parseInt(overlay.querySelector('#mct-in-attendees').value, 10);
    const hourlyRate = parseFloat(overlay.querySelector('#mct-in-rate').value);
    const currency = overlay.querySelector('#mct-in-currency').value;
    const autoDetect = overlay.querySelector('#mct-in-autodetect').checked;
    settings = {
      ...settings,
      attendees: Number.isFinite(attendees) && attendees > 0 ? attendees : settings.attendees,
      hourlyRate: Number.isFinite(hourlyRate) && hourlyRate >= 0 ? hourlyRate : settings.hourlyRate,
      currency,
      autoDetect,
    };
    if (!autoDetect) liveCount = null; // fall back to the manual headcount
    chrome.storage.sync.set(settings);
    updateMeta();
    render();
  });

  // ---------- buttons ----------

  overlay.querySelector('#mct-toggle').addEventListener('click', () => setRunning(!settings.running));
  overlay.querySelector('#mct-reset').addEventListener('click', reset);
  overlay.querySelector('#mct-close').addEventListener('click', () => {
    // Hide instead of remove, so the popup can reopen it later.
    overlay.style.display = 'none';
    chrome.storage.sync.set({ hidden: true });
  });

  // Reopen the ticker when the popup asks for it.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'mct-show') {
      overlay.style.display = '';
      chrome.storage.sync.set({ hidden: false });
      sendResponse({ ok: true }); // acknowledge, so the popup doesn't see lastError
    }
    return false;
  });

  function updateMeta() {
    const meta = overlay.querySelector('#mct-meta-text');
    if (!meta) return;
    const headcount = currentAttendees();
    const source = settings.autoDetect && liveCount !== null && liveCount > 0 ? 'live' : 'manual';
    let text = `${headcount} people (${source}) · ${currencySymbol(settings.currency)}${settings.hourlyRate}/h each`;
    if (participantEvents.length > 0) {
      const joins = participantEvents.filter((event) => event.delta > 0).length;
      const leaves = participantEvents.filter((event) => event.delta < 0).length;
      text += ` · ${joins} joined, ${leaves} left`;
    }
    meta.textContent = text;
  }

  // ---------- dragging ----------

  // ---------- dragging (whole overlay, except interactive elements) ----------

  const INTERACTIVE_SELECTOR = 'button, input, select, label, a';
  let dragging = false;
  let dragHandle = null;
  let offsetX = 0;
  let offsetY = 0;

  overlay.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest(INTERACTIVE_SELECTOR)) return; // don't hijack clicks on controls
    dragging = true;
    dragHandle = event.target;
    dragHandle.setPointerCapture(event.pointerId);
    const rect = overlay.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    event.preventDefault();
  });

  overlay.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    overlay.style.left = `${event.clientX - offsetX}px`;
    overlay.style.top = `${event.clientY - offsetY}px`;
    overlay.style.right = 'auto';
    overlay.style.bottom = 'auto';
  });

  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    if (dragHandle) {
      dragHandle.releasePointerCapture(event.pointerId);
      dragHandle = null;
    }
  };

  overlay.addEventListener('pointerup', endDrag);
  overlay.addEventListener('pointercancel', endDrag);

  // ---------- resizing (drag the corner handle; double-click to reset) ----------

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 2;
  const BASE_WIDTH = 220; // matches the CSS width

  const resizeHandle = overlay.querySelector('#mct-resize');
  let resizing = false;
  let resizeStartX = 0;
  let resizeStartScale = 1;

  function applyScale(scale) {
    overlay.style.width = `${BASE_WIDTH * scale}px`;
    overlay.style.fontSize = `${14 * scale}px`;
  }

  function resetSize() {
    applyScale(1);
    chrome.storage.sync.set({ scale: 1 });
  }

  resizeHandle.addEventListener('pointerdown', (event) => {
    resizing = true;
    resizeHandle.setPointerCapture(event.pointerId);
    resizeStartX = event.clientX;
    resizeStartScale = settings.scale || 1;
    event.preventDefault();
    event.stopPropagation(); // don't start a drag of the overlay
  });

  resizeHandle.addEventListener('pointermove', (event) => {
    if (!resizing) return;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, resizeStartScale + (event.clientX - resizeStartX) / 200));
    settings.scale = scale;
    applyScale(scale);
  });

  const endResize = (event) => {
    if (!resizing) return;
    resizing = false;
    resizeHandle.releasePointerCapture(event.pointerId);
    chrome.storage.sync.set({ scale: settings.scale });
  };

  resizeHandle.addEventListener('pointerup', endResize);
  resizeHandle.addEventListener('pointercancel', endResize);
  resizeHandle.addEventListener('dblclick', resetSize);

  // ---------- live participant detection ----------

  function recordParticipantEvent(delta, count) {
    participantEvents.push({ at: new Date(), delta, count });
    updateMeta();
  }

  function setLiveCount(count) {
    if (count === liveCount) return;
    const previous = liveCount;
    liveCount = count;
    if (previous !== null && previous > 0 && count === 0) {
      // Everyone left: stop accruing cost and show the ended state.
      overlay.classList.add('mct-ended');
      setRunning(false);
    } else if (previous === 0 && count > 0) {
      // Someone rejoined an empty room: resume.
      overlay.classList.remove('mct-ended');
      setRunning(true);
    }
    if (previous !== null && count > previous) recordParticipantEvent(+1, count);
    if (previous !== null && count < previous) recordParticipantEvent(-1, count);
    updateMeta();
    render();
  }

  // Google Meet participants list: each person is a listitem with
  // data-participant-id. Non-person entries (e.g. "Merged audio") have no
  // data-participant-id, so they are excluded automatically. Visitors without
  // a Google account DO carry the attribute, so they are counted.
  // The same person can appear in several places (video tile + list entry),
  // so we count UNIQUE participant ids, not elements.
  function countMeetTiles() {
    const list = document.querySelector('div[role="list"][aria-label="Participants" i]');
    const scope = list || document;
    const ids = new Set();
    for (const element of scope.querySelectorAll('[data-participant-id]')) {
      ids.add(element.getAttribute('data-participant-id'));
    }
    return ids.size;
  }

  // The "People" button exposes the authoritative total in its aria-label,
  // e.g. "People (5)" / "Personas (5)" / "5 participants". This count includes
  // guests even when they have no video tile.
  function countFromPeopleButton() {
    const buttons = document.querySelectorAll('button[aria-label]');
    for (const button of buttons) {
      const label = button.getAttribute('aria-label') || '';
      if (!/people|participant|personas|participantes|pessoas/i.test(label)) continue;
      const match = label.match(/\d+/);
      if (match) return parseInt(match[0], 10);
    }
    return null;
  }

  function detectParticipantCount() {
    if (!isExtensionContextValid()) {
      shutdownStaleInstance();
      return;
    }
    if (!settings.autoDetect) return;
    const tiles = countMeetTiles();
    const fromButton = countFromPeopleButton();
    // Take the larger of the two: tiles can miss guests that aren't rendered.
    const candidates = [tiles, fromButton].filter((value) => value !== null);
    if (candidates.length === 0) return;
    const count = Math.max(...candidates);
    // Zero is meaningful (empty room = meeting ended) once we've seen participants.
    if (count > 0 || (count === 0 && liveCount !== null && liveCount > 0)) {
      setLiveCount(count);
    }
  }

  const participantObserver = new MutationObserver(() => detectParticipantCount());
  participantObserver.observe(document.documentElement, { childList: true, subtree: true });
  const detectionInterval = setInterval(detectParticipantCount, 3000); // safety net if the observer misses UI swaps

  // ---------- init ----------

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...settings, ...stored };
    overlay.querySelector('#mct-in-attendees').value = settings.attendees;
    overlay.querySelector('#mct-in-rate').value = settings.hourlyRate;
    overlay.querySelector('#mct-in-currency').value = settings.currency;
    overlay.querySelector('#mct-in-autodetect').checked = settings.autoDetect;
    applyScale(settings.scale || 1);
    syncSettingsFieldsState();
    if (settings.hidden) overlay.style.display = 'none';
    if (!settings.running) {
      const btn = overlay.querySelector('#mct-toggle');
      if (btn) btn.textContent = '▶';
      overlay.classList.add('mct-paused');
    }
    updateMeta();
    render();
  });

  startTicking();
})();

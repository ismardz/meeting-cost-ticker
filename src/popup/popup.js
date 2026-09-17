/**
 * Meeting Cost Ticker — popup logic.
 * Loads and saves default settings via chrome.storage.sync.
 */
const DEFAULTS = { attendees: 6, hourlyRate: 75, currency: 'USD', autoDetect: true };

const form = document.getElementById('settings-form');
const autoDetectInput = document.getElementById('auto-detect');
const attendeesInput = document.getElementById('attendees');
const rateInput = document.getElementById('hourly-rate');
const currencySelect = document.getElementById('currency');
const statusEl = document.getElementById('status');

// Manual headcount/rate fields are irrelevant while auto-detect drives the count.
function syncFieldsState() {
  attendeesInput.disabled = autoDetectInput.checked;
}

autoDetectInput.addEventListener('change', syncFieldsState);

chrome.storage.sync.get(DEFAULTS, (settings) => {
  autoDetectInput.checked = settings.autoDetect;
  attendeesInput.value = settings.attendees;
  rateInput.value = settings.hourlyRate;
  currencySelect.value = settings.currency;
  syncFieldsState();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const autoDetect = autoDetectInput.checked;
  const attendees = parseInt(attendeesInput.value, 10);
  const hourlyRate = parseFloat(rateInput.value);

  if (!Number.isFinite(attendees) || attendees < 1) {
    statusEl.textContent = 'Attendees must be at least 1.';
    return;
  }
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
    statusEl.textContent = 'Hourly rate cannot be negative.';
    return;
  }

  chrome.storage.sync.set({ attendees, hourlyRate, currency: currencySelect.value, autoDetect }, () => {
    statusEl.textContent = 'Saved ✓';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 2000);
  });
});

// Reopen the ticker in the meeting tab the popup was opened from.
document.getElementById('show-ticker').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id) {
      statusEl.textContent = 'No active tab found.';
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'mct-show' }, () => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = 'No ticker here — open a meeting page first.';
        return;
      }
      statusEl.textContent = 'Ticker shown ✓';
      setTimeout(() => {
        statusEl.textContent = '';
      }, 2000);
    });
  });
});

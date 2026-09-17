/**
 * Meeting Cost Ticker — popup logic.
 * Loads and saves default settings via chrome.storage.sync.
 */
const DEFAULTS = { attendees: 6, hourlyRate: 75, currency: 'USD' };

const form = document.getElementById('settings-form');
const attendeesInput = document.getElementById('attendees');
const rateInput = document.getElementById('hourly-rate');
const currencySelect = document.getElementById('currency');
const statusEl = document.getElementById('status');

chrome.storage.sync.get(DEFAULTS, (settings) => {
  attendeesInput.value = settings.attendees;
  rateInput.value = settings.hourlyRate;
  currencySelect.value = settings.currency;
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
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

  chrome.storage.sync.set({ attendees, hourlyRate, currency: currencySelect.value }, () => {
    statusEl.textContent = 'Saved ✓';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 2000);
  });
});

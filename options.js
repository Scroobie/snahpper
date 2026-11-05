'use strict';
const field = document.getElementById('domains');
const status = document.getElementById('status');
const DEFAULT_DOMAINS = ['fora.snahp.eu'];
const valid = x => x === 'localhost' || (x.length <= 253 && x.includes('.') && x.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)));
chrome.storage.local.get('allowedDomains').then(data => {
  field.value = (Array.isArray(data.allowedDomains) ? data.allowedDomains : DEFAULT_DOMAINS).join('\n');
});
document.getElementById('save').addEventListener('click', async () => {
  const domains = [...new Set(field.value.split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(Boolean))];
  const invalid = domains.filter(d => !valid(d));
  if (invalid.length) { status.textContent = 'Invalid hostname: ' + invalid[0]; status.style.color = '#ae271d'; return; }
  await chrome.storage.local.set({allowedDomains: domains});
  field.value = domains.join('\n');
  status.textContent = 'Saved!'; status.style.color = '#146b31';
});
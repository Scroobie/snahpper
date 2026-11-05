'use strict';

const MENU_ID = 'decode-open-base64';
const MAX_DEPTH = 5;
const MAX_INPUT_LENGTH = 32768;
const STORE_KEY = 'allowedDomains';
const DEFAULT_DOMAINS = ['fora.snahp.eu'];

function normalizeDomain(domain) {
  const input = String(domain || '').trim().toLowerCase();
  if (!input || input.includes('/') || input.includes(':') || input.includes('*') || input.includes(' ')) return null;
  if (input === 'localhost') return input;
  if (input.length > 253 || !input.includes('.') || !input.split('.').every(x => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x))) return null;
  return input;
}

function allowedHost(hostname, domains) {
  const host = hostname.toLowerCase();
  return domains.some(d => host === d || host.endsWith('.' + d));
}

async function getDomains() {
  const data = await chrome.storage.local.get(STORE_KEY);
  const domains = Array.isArray(data[STORE_KEY]) ? data[STORE_KEY] : DEFAULT_DOMAINS;
  return [...new Set(domains.map(normalizeDomain).filter(Boolean))];
}

// Serialize menu updates: installation and storage-change events can arrive together.
let menuRefreshQueue = Promise.resolve();

function refreshMenu() {
  const update = async () => {
    const domains = await getDomains();
    await chrome.contextMenus.removeAll();
    if (!domains.length) return;
    const documentUrlPatterns = domains.flatMap(d => [`*://${d}/*`, `*://*.${d}/*`]);
    await new Promise((resolve, reject) => {
      chrome.contextMenus.create({
        id: MENU_ID,
        title: 'Decode & Open Link',
        contexts: ['selection', 'link'],
        documentUrlPatterns
      }, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve();
      });
    });
  };
  const current = menuRefreshQueue.then(update, update);
  menuRefreshQueue = current.catch(() => {});
  return current;
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const data = await chrome.storage.local.get(STORE_KEY);
    if (!Array.isArray(data[STORE_KEY])) {
      await chrome.storage.local.set({[STORE_KEY]: DEFAULT_DOMAINS});
    }
    await refreshMenu();
  } catch (err) { console.error(err); }
});
chrome.runtime.onStartup.addListener(() => { refreshMenu().catch(console.error); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORE_KEY]) refreshMenu().catch(console.error);
});

function findHttpsUrl(value) {
  const text = value.trim();
  if (!/^https:\/\/\S+$/i.test(text)) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

function decodeBase64(value) {
  let input = value.trim();
  if (/%[0-9a-f]{2}/i.test(input)) {
    try { input = decodeURIComponent(input); } catch { return null; }
  }
  input = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!input || input.length > MAX_INPUT_LENGTH || !/^[A-Za-z0-9+/]*={0,2}$/.test(input)) return null;
  if (input.length % 4 === 1) return null;
  input = input.replace(/=+$/, '');
  const padded = input.padEnd(Math.ceil(input.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch { return null; }
}

function resolveUrl(value) {
  if (!value || value.length > MAX_INPUT_LENGTH) return null;
  let current = value;
  const visited = new Set();
  for (let depth = 0; depth <= MAX_DEPTH; depth++) {
    const url = findHttpsUrl(current);
    if (url) return {url, depth};
    if (depth === MAX_DEPTH || visited.has(current)) break;
    visited.add(current);
    const next = decodeBase64(current);
    if (next === null || next === current) break;
    current = next;
  }
  return null;
}

function notifyFailure() {
  chrome.notifications.create({
    type: 'basic', iconUrl: 'icon128.png', title: 'Snahpper',
    message: 'No valid HTTPS URL found within 5 decoding passes.'
  });
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;
  // Validate again: the tab may have navigated since its menu was rendered.
  let source;
  try { source = new URL(info.pageUrl || info.frameUrl || ''); } catch { return; }
  const domains = await getDomains();
  if (!['http:', 'https:'].includes(source.protocol) || !allowedHost(source.hostname, domains)) return;
  const input = info.selectionText || info.linkUrl;
  const result = resolveUrl(input);
  if (!result) { notifyFailure(); return; }
  try { await chrome.tabs.create({url: result.url, active: true}); }
  catch { notifyFailure(); }
});
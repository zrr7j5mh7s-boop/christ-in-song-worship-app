// src/obs/obs-auth-errors.js
//
// Shared OBS WebSocket authentication error helpers (main process + tests).

'use strict';

const AUTH_MESSAGES = {
  PASSWORD_REQUIRED:
    'OBS requires a WebSocket password. Enter the password from OBS (Tools → WebSocket Server Settings) in Settings → OBS Studio.',
  PASSWORD_REJECTED:
    'OBS WebSocket password was rejected. Check that it matches OBS WebSocket Server Settings exactly.',
  PASSWORD_UNREADABLE:
    'Saved OBS WebSocket password could not be read. Re-enter the password in Settings → OBS Studio.',
};

function formatObsAuthenticationError(message, hasStoredPassword) {
  const raw = String(message || '').trim();
  const lower = raw.toLowerCase();

  if (lower.includes('could not be read') || lower.includes('could not be decrypted')) {
    return raw || AUTH_MESSAGES.PASSWORD_UNREADABLE;
  }
  if (
    lower.includes("missing an 'authentication'")
    || lower.includes('missing authentication')
    || lower.includes('password required')
  ) {
    return AUTH_MESSAGES.PASSWORD_REQUIRED;
  }
  if (lower.includes('authentication') || lower.includes('auth failed')) {
    return hasStoredPassword ? AUTH_MESSAGES.PASSWORD_REJECTED : AUTH_MESSAGES.PASSWORD_REQUIRED;
  }
  return raw;
}

function isAuthenticationError(message, code) {
  const lower = String(message || '').toLowerCase();
  return (
    code === 4009
    || code === 'OBS_PASSWORD_UNREADABLE'
    || lower.includes('authentication')
    || lower.includes('auth failed')
    || lower.includes('password required')
  );
}

function resolveStoredPassword(hasStoredPassword, password) {
  if (!hasStoredPassword) {
    return String(password || '');
  }
  const resolved = String(password || '');
  if (!resolved) {
    const error = new Error(AUTH_MESSAGES.PASSWORD_UNREADABLE);
    error.code = 'OBS_PASSWORD_UNREADABLE';
    throw error;
  }
  return resolved;
}

module.exports = {
  AUTH_MESSAGES,
  formatObsAuthenticationError,
  isAuthenticationError,
  resolveStoredPassword,
};

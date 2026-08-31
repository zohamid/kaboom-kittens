'use strict';

import { createApp } from './app.js';

const app = createApp({
  document,
  window,
  fetch: window.fetch.bind(window),
  EventSource: window.EventSource,
  localStorage,
});

app.start();

// Debug namespace
window.KaboomKittens = {
  getSnapshot: app.getSnapshot,
  submitAction: app.submitAction,
  render: () => {}, // would call app's render
  playCardSound: (type) => {}, // would call audio
  showInsertPicker: (n, cb) => {}, // would call prompts
};
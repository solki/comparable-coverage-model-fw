import { createApp } from './ui.js';

const root = document.querySelector('#app');

if (!root) {
  throw new Error('App root element was not found.');
}

createApp(root);

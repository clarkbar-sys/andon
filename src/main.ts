import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { initServiceWorker } from './lib/pwa.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('#app is missing from index.html');

const app = mount(App, { target });

initServiceWorker();

export default app;

import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';

const root = document.getElementById('root');

createRoot(root).render(createElement(StrictMode, null, createElement(App)));

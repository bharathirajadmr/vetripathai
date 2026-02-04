
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

// Removed manual process.env shim to fix TypeScript error and comply with GenAI guidelines.
// The environment is assumed to provide process.env.API_KEY externally.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

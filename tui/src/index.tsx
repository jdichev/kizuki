import React from 'react';
import { render } from 'ink';
import App from './App.js';
import { ThemeProvider } from './hooks/ThemeContext.js';

render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

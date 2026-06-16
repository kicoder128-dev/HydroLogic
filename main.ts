import React from 'react';
import ReactDOM from 'react-dom/client';
import { HydroGrid } from './HydroGrid';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
      <HydroGrid />
    </div>
  </React.StrictMode>,
);
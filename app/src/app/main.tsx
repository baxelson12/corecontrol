import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App';
import { store } from './store';
import './styles.css';

// The app has no use for the WebView2 context menu; keep it in dev builds
// for inspect-element access.
if (!import.meta.env.DEV) {
  document.addEventListener('contextmenu', (event) => event.preventDefault());
}

const container = document.getElementById('root');
if (!container) throw new Error('root container element is missing');

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);

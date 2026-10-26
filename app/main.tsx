import { createRoot } from 'react-dom/client';
import NotebookApp from './notebook-app';
import './globals.css';
import './journal.css';
createRoot(document.getElementById('app')!).render(<NotebookApp/>);
if('serviceWorker' in navigator){window.addEventListener('load',()=>{void navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{window.dispatchEvent(new Event('offline-cache-error'));});});}

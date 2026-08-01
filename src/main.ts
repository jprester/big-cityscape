import { createApp } from './app/createApp';
import './styles.css';

const host = document.querySelector<HTMLElement>('#app');

if (host === null) {
  throw new Error('City Field could not find its #app mount element.');
}

const app = createApp(host);
app.start();

if (import.meta.hot !== undefined) {
  import.meta.hot.dispose(() => {
    app.dispose();
  });
}

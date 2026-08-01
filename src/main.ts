import { createApp, type CityFieldApp } from './app/createApp';
import './styles.css';

const host = document.querySelector<HTMLElement>('#app');

if (host === null) {
  throw new Error('City Field could not find its #app mount element.');
}

let app: CityFieldApp | undefined;

try {
  app = await createApp(host);
  app.start();
} catch (error) {
  const message = document.createElement('p');
  message.className = 'startup-error';
  message.textContent = 'City Field could not load its processed structural data.';
  host.replaceChildren(message);
  console.error(error);
}

if (import.meta.hot !== undefined) {
  import.meta.hot.dispose(() => {
    app?.dispose();
  });
}

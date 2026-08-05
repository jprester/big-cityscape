import './styles.css';

type AppLifecycle = Readonly<{
  start: () => void;
  dispose: () => void;
}>;

const host = document.querySelector<HTMLElement>('#app');

if (host === null) {
  throw new Error('City Field could not find its #app mount element.');
}

let app: AppLifecycle | undefined;

try {
  if (requestedView(window.location.search) === 'assets') {
    const { createBuildingAssetCatalogApp } = await import(
      './catalog/createBuildingAssetCatalogApp'
    );
    app = await createBuildingAssetCatalogApp(host);
  } else if (requestedView(window.location.search) === 'synthetic') {
    const { createSyntheticDistrictApp } = await import(
      './synthetic/createSyntheticDistrictApp'
    );
    app = await createSyntheticDistrictApp(host);
  } else {
    const { createApp } = await import('./app/createApp');
    app = await createApp(host);
  }

  app.start();
} catch (error) {
  const message = document.createElement('p');
  message.className = 'startup-error';
  message.textContent = 'City Field could not start the requested view.';
  host.replaceChildren(message);
  console.error(error);
}

function requestedView(search: string): string | null {
  return new URLSearchParams(search).get('view');
}

if (import.meta.hot !== undefined) {
  import.meta.hot.dispose(() => {
    app?.dispose();
  });
}

import * as THREE from 'three';
import {
  BUILDING_ASSET_CATALOG,
  ORPHANED_BUILDING_ASSET_OVERRIDE_IDS,
} from '../city/assets/buildingAssetCatalog';
import type { BuildingModelCatalogEntry } from '../city/rendering/buildingModelCatalog';
import {
  loadBuildingModels,
  type LoadedBuildingModel,
} from '../city/rendering/loadBuildingModels';

const THUMBNAIL_SIZE = 256;

export type BuildingAssetCatalogApp = Readonly<{
  start: () => void;
  stop: () => void;
  dispose: () => void;
}>;

export async function createBuildingAssetCatalogApp(
  host: HTMLElement,
): Promise<BuildingAssetCatalogApp> {
  const catalogAssets = BUILDING_ASSET_CATALOG;
  const catalogEntries: readonly BuildingModelCatalogEntry[] = catalogAssets.map(
    (asset) => ({
      id: asset.id,
      category: asset.sourceCategory,
      assetPath: `${asset.assetPath}?revision=${asset.audit.shapeFingerprint}`,
    }),
  );
  const library = await loadBuildingModels(catalogEntries);
  const modelsById = new Map(library.models.map((model) => [model.id, model]));
  const element = document.createElement('main');
  element.className = 'asset-catalog';
  const header = createHeader(
    catalogAssets.length,
    catalogAssets.filter((asset) => asset.enabled).length,
    library.failedAssets.length,
    ORPHANED_BUILDING_ASSET_OVERRIDE_IDS.length,
  );
  const controls = createControls();
  const grid = document.createElement('section');
  grid.className = 'asset-catalog__grid';
  grid.setAttribute('aria-label', 'Building assets');
  const renderer = createThumbnailRenderer();
  const cards: HTMLElement[] = [];

  for (const asset of catalogAssets) {
    const model = modelsById.get(asset.id);

    if (model === undefined) {
      continue;
    }

    const card = document.createElement('article');
    card.className = asset.enabled ? 'asset-card' : 'asset-card asset-card--disabled';
    card.dataset.category = asset.sourceCategory;
    card.dataset.assetId = asset.id;
    card.dataset.use = asset.use;
    card.dataset.heightClass = asset.heightClass;
    const thumbnail = document.createElement('img');
    thumbnail.className = 'asset-card__thumbnail';
    thumbnail.alt = `${asset.id} isometric geometry preview`;
    thumbnail.width = THUMBNAIL_SIZE;
    thumbnail.height = THUMBNAIL_SIZE;
    thumbnail.src = renderThumbnail(renderer, model, asset.sourceCategory);
    const body = document.createElement('div');
    body.className = 'asset-card__body';
    const title = document.createElement('h2');
    title.className = 'asset-card__title';
    title.textContent = asset.id;
    const category = document.createElement('p');
    category.className = `asset-card__category asset-card__category--${asset.sourceCategory}`;
    category.textContent = asset.sourceCategory;
    const classification = document.createElement('p');
    classification.className = 'asset-card__classification';
    classification.textContent = `${asset.use} · ${asset.form} · ${asset.heightClass}`;
    const roles = document.createElement('p');
    roles.className = 'asset-card__roles';
    roles.textContent = `${asset.placementRoles.join(' + ')} · max ${asset.maximumPerCity ?? 'unlimited'} · weight ${asset.selectionWeight}`;
    const dimensions = document.createElement('p');
    dimensions.className = 'asset-card__dimensions';
    dimensions.textContent = `${formatMetres(asset.sourceDimensions.width)} × ${formatMetres(asset.sourceDimensions.depth)} m · ${formatMetres(asset.sourceDimensions.height)} m high`;
    const metrics = document.createElement('p');
    metrics.className = 'asset-card__metrics';
    metrics.textContent = `${asset.geometry.triangles.toLocaleString()} triangles · aspect ${asset.proportions.footprintAspect.toFixed(2)} · slenderness ${asset.proportions.slenderness.toFixed(2)}`;
    body.append(title, category, classification, roles, dimensions, metrics);

    if (!asset.enabled) {
      const disabled = document.createElement('p');
      disabled.className = 'asset-card__disabled';
      disabled.textContent = 'Disabled by default';
      body.append(disabled);
    }

    if (asset.audit.warnings.length > 0) {
      const warning = document.createElement('p');
      warning.className = 'asset-card__warning';
      warning.textContent = asset.audit.warnings.join(', ');
      body.append(warning);
    }

    if (asset.audit.duplicateShapeOf !== null) {
      const duplicate = document.createElement('p');
      duplicate.className = 'asset-card__warning';
      duplicate.textContent = `Exact scaled shape duplicate of ${asset.audit.duplicateShapeOf}`;
      body.append(duplicate);
    }

    if (asset.notes !== undefined) {
      const notes = document.createElement('p');
      notes.className = 'asset-card__notes';
      notes.textContent = asset.notes;
      body.append(notes);
    }

    card.append(thumbnail, body);
    grid.append(card);
    cards.push(card);
  }

  renderer.dispose();
  renderer.domElement.remove();
  element.append(header, controls.element, grid);
  host.replaceChildren(element);
  document.title = 'Building asset catalogue · City Field';

  const applyFilters = (): void => {
    const query = controls.search.value.trim().toLowerCase();
    const selectedCategory = controls.category.value;
    const selectedUse = controls.use.value;
    const selectedHeightClass = controls.heightClass.value;
    let visible = 0;

    for (const card of cards) {
      const category = card.dataset.category ?? '';
      const assetId = card.dataset.assetId ?? '';
      const use = card.dataset.use ?? '';
      const heightClass = card.dataset.heightClass ?? '';
      const matchesCategory =
        selectedCategory === 'all' || category === selectedCategory;
      const matchesUse = selectedUse === 'all' || use === selectedUse;
      const matchesHeightClass =
        selectedHeightClass === 'all' || heightClass === selectedHeightClass;
      const matchesQuery = query.length === 0 || assetId.includes(query);
      const isVisible =
        matchesCategory && matchesUse && matchesHeightClass && matchesQuery;
      card.hidden = !isVisible;
      visible += isVisible ? 1 : 0;
    }

    controls.resultCount.textContent = `${visible} assets shown`;
  };
  controls.search.addEventListener('input', applyFilters);
  controls.category.addEventListener('change', applyFilters);
  controls.use.addEventListener('change', applyFilters);
  controls.heightClass.addEventListener('change', applyFilters);
  applyFilters();

  let isDisposed = false;

  return {
    start: () => undefined,
    stop: () => undefined,
    dispose: () => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      controls.search.removeEventListener('input', applyFilters);
      controls.category.removeEventListener('change', applyFilters);
      controls.use.removeEventListener('change', applyFilters);
      controls.heightClass.removeEventListener('change', applyFilters);
      disposeModels(library.models);
      element.remove();
    },
  };
}

function createHeader(
  assetCount: number,
  enabledCount: number,
  failureCount: number,
  orphanedOverrideCount: number,
): HTMLElement {
  const header = document.createElement('header');
  header.className = 'asset-catalog__header';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'asset-catalog__eyebrow';
  eyebrow.textContent = 'City Field · generated inspection view';
  const title = document.createElement('h1');
  title.className = 'asset-catalog__title';
  title.textContent = 'Building asset catalogue';
  const summary = document.createElement('p');
  summary.className = 'asset-catalog__summary';
  const orphanedOverrideSummary =
    orphanedOverrideCount === 0
      ? ''
      : ` · ${orphanedOverrideCount} stale overrides ignored`;
  summary.textContent = `${assetCount} exported GLBs · ${enabledCount} enabled · ${failureCount} load failures${orphanedOverrideSummary} · nominal dimensions use the reviewed metre scale`;
  header.append(eyebrow, title, summary);
  return header;
}

function createControls(): Readonly<{
  element: HTMLElement;
  search: HTMLInputElement;
  category: HTMLSelectElement;
  use: HTMLSelectElement;
  heightClass: HTMLSelectElement;
  resultCount: HTMLElement;
}> {
  const element = document.createElement('section');
  element.className = 'asset-catalog__controls';
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Filter by asset ID';
  search.setAttribute('aria-label', 'Filter assets by ID');
  const category = document.createElement('select');
  category.setAttribute('aria-label', 'Filter assets by source category');

  for (const [value, label] of [
    ['all', 'All source collections'],
    ['residential', 'Residential'],
    ['high-rise', 'High-rise'],
    ['skyscraper', 'Skyscraper'],
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    category.append(option);
  }

  const use = createSelect(
    'Filter assets by reviewed use',
    [
      ['all', 'All uses'],
      ['residential', 'Residential'],
      ['mixed-use', 'Mixed-use'],
      ['office', 'Office'],
      ['commercial', 'Commercial'],
      ['civic', 'Civic'],
      ['industrial', 'Industrial'],
      ['landmark', 'Landmark'],
    ],
  );
  const heightClass = createSelect(
    'Filter assets by height class',
    [
      ['all', 'All heights'],
      ['low-rise', 'Low-rise'],
      ['mid-rise', 'Mid-rise'],
      ['high-rise', 'High-rise'],
      ['skyscraper', 'Skyscraper'],
    ],
  );

  const resultCount = document.createElement('p');
  resultCount.className = 'asset-catalog__result-count';
  element.append(search, category, use, heightClass, resultCount);
  return { element, search, category, use, heightClass, resultCount };
}

function createSelect(
  label: string,
  options: readonly (readonly [value: string, label: string])[],
): HTMLSelectElement {
  const select = document.createElement('select');
  select.setAttribute('aria-label', label);

  for (const [value, optionLabel] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = optionLabel;
    select.append(option);
  }

  return select;
}

function createThumbnailRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'low-power',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, false);
  return renderer;
}

function renderThumbnail(
  renderer: THREE.WebGLRenderer,
  model: LoadedBuildingModel,
  category: BuildingModelCatalogEntry['category'],
): string {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101820);
  const material = new THREE.MeshLambertMaterial({
    color: categoryColor(category),
    emissive: 0x121416,
  });
  const mesh = new THREE.Mesh(model.geometry, material);
  scene.add(mesh);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x26313a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.003;
  scene.add(ground);
  scene.add(new THREE.HemisphereLight(0xeaf1f5, 0x1f2930, 2.4));
  const keyLight = new THREE.DirectionalLight(0xfff1dd, 3.1);
  keyLight.position.set(-2, 3, 4);
  scene.add(keyLight);

  const maximumDimension = Math.max(
    model.widthMetres,
    model.heightMetres,
    model.depthMetres,
  );
  const normalizationScale = 1.6 / maximumDimension;
  mesh.scale.setScalar(normalizationScale);
  const normalizedHeight = model.heightMetres * normalizationScale;
  const footprintScale =
    Math.max(model.widthMetres, model.depthMetres) * normalizationScale;
  ground.scale.setScalar(Math.max(0.45, footprintScale * 0.75));

  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 20);
  const target = new THREE.Vector3(0, normalizedHeight * 0.46, 0);
  camera.position.set(2.4, 1.8, 2.8);
  camera.lookAt(target);
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');
  ground.geometry.dispose();
  groundMaterial.dispose();
  material.dispose();
  return dataUrl;
}

function categoryColor(
  category: BuildingModelCatalogEntry['category'],
): number {
  switch (category) {
    case 'residential':
      return 0x9db4a5;
    case 'high-rise':
      return 0xc1aa85;
    case 'skyscraper':
      return 0x9aaec5;
  }
}

function formatMetres(value: number): string {
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function disposeModels(models: readonly LoadedBuildingModel[]): void {
  for (const model of models) {
    model.geometry.dispose();
  }
}

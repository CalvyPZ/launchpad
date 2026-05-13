const CONFIG_URL = 'data/config.json';
const USER_CONFIG_KEY = 'calvybots_user_config';

let loaded = false;
let baseConfig = {};
let userConfig = {};
let mergedConfig = {};

function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function readUserOverridesFromStorage() {
  try {
    const raw = localStorage.getItem(USER_CONFIG_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    if ('schemaVersion' in parsed && 'value' in parsed) {
      if (!parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
        return {};
      }

      return parsed.value;
    }

    return parsed;
  } catch {
    return {};
  }
}

function mergeDeep(target, source) {
  const output = clone(target);

  Object.keys(source).forEach((key) => {
    const sourceValue = source[key];
    const targetValue = output[key];

    if (
      sourceValue &&
      targetValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      !Array.isArray(targetValue)
    ) {
      output[key] = mergeDeep(targetValue, sourceValue);
      return;
    }

    output[key] = sourceValue;
  });

  return output;
}

function emitUpdatedConfig(newValue) {
  const event = new CustomEvent('config:updated', {
    detail: {
      config: clone(newValue)
    }
  });

  document.dispatchEvent(event);
}

function setByPath(obj, path, value) {
  if (typeof path !== 'string' || !path) {
    return obj;
  }

  const parts = path.split('.').filter(Boolean);
  if (!parts.length) {
    return obj;
  }

  const next = clone(obj);
  let cursor = next;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const existing = cursor[key];

    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      cursor[key] = {};
    } else {
      cursor[key] = clone(existing);
    }

    cursor = cursor[key];
  }

  cursor[parts[parts.length - 1]] = value;

  return next;
}

function getStorage() {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

async function initialize() {
  if (loaded) {
    return;
  }

  let remoteConfig = {};
  try {
    const response = await fetch(CONFIG_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load config: ${response.status}`);
    }
    remoteConfig = await response.json();
  } catch (error) {
    remoteConfig = {};
    console.error('[config-loader] Falling back to empty config', error);
  }

  baseConfig = remoteConfig || {};
  userConfig = readUserOverridesFromStorage();
  mergedConfig = mergeDeep(baseConfig, userConfig);
  loaded = true;

  const storage = getStorage();
  if (storage) {
    storage.setItem(USER_CONFIG_KEY, JSON.stringify(userConfig));
  }

  emitUpdatedConfig(mergedConfig);
}

export async function getConfig() {
  await initialize();
  return clone(mergedConfig);
}

export async function updateConfig(path, value) {
  await initialize();

  userConfig = setByPath(userConfig, path, value);
  mergedConfig = mergeDeep(baseConfig, userConfig);

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(USER_CONFIG_KEY, JSON.stringify(userConfig));
    } catch {
      // Ignore storage errors on private mode or blocked storage.
    }
  }

  emitUpdatedConfig(mergedConfig);
  return clone(mergedConfig);
}

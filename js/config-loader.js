const CONFIG_URL = 'data/config.json';
const USER_CONFIG_KEY = 'launchpad_user_config';
const USER_CONFIG_KEY_LEGACY = 'calvybots_user_config';

let loaded = false;
let baseConfig = {};
let userConfig = {};
let mergedConfig = {};

function readStorageValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function getStorageString(primaryKey, legacyKey) {
  const parse = (raw) => {
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const primaryRaw = readStorageValue(primaryKey);
  const primaryParsed = parse(primaryRaw);
  if (primaryRaw != null && primaryParsed != null) {
    return { value: primaryRaw, parsed: primaryParsed, key: primaryKey };
  }
  if (!legacyKey) {
    return null;
  }
  const legacyRaw = readStorageValue(legacyKey);
  const legacyParsed = parse(legacyRaw);
  if (legacyRaw != null && legacyParsed != null) {
    return { value: legacyRaw, parsed: legacyParsed, key: legacyKey };
  }
  return null;
}

function persistUserConfig(value) {
  const payload = JSON.stringify(value);
  writeStorageValue(USER_CONFIG_KEY, payload);
  if (USER_CONFIG_KEY_LEGACY && USER_CONFIG_KEY_LEGACY !== USER_CONFIG_KEY) {
    writeStorageValue(USER_CONFIG_KEY_LEGACY, payload);
  }
}

function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function readUserOverridesFromStorage() {
  try {
    const entry = getStorageString(USER_CONFIG_KEY, USER_CONFIG_KEY_LEGACY);
    if (!entry) {
      return {};
    }
    const parsed = entry.parsed ?? null;
    if (!parsed) {
      return {};
    }
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
    persistUserConfig(userConfig);
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
      persistUserConfig(userConfig);
    } catch {
      // Ignore storage errors on private mode or blocked storage.
    }
  }

  emitUpdatedConfig(mergedConfig);
  return clone(mergedConfig);
}

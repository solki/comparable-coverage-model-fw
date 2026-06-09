export function getDomoClient() {
  return globalThis.domo || null;
}

export function isDomoRuntime() {
  const domo = getDomoClient();
  return Boolean(
    typeof window !== 'undefined'
      && window.location
      && !['localhost', '127.0.0.1'].includes(window.location.hostname)
      && domo
      && (typeof domo.get === 'function' || typeof domo.post === 'function')
  );
}

export function getRuntimeLabel() {
  return isDomoRuntime() ? 'Domo runtime' : 'Local mock mode';
}

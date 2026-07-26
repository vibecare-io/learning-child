export function waitFor(selector: string, timeoutMs = 10_000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`timeout waiting for ${selector}`));
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

const preloadedImagePromises = new Map<string, Promise<void>>();

export function preloadImageAsset(assetUrl: string | null | undefined): Promise<void> {
  if (!assetUrl || typeof Image === 'undefined') {
    return Promise.resolve();
  }

  const existingPromise = preloadedImagePromises.get(assetUrl);
  if (existingPromise) {
    return existingPromise;
  }

  const preloadPromise = new Promise<void>((resolve) => {
    const image = new Image();
    let isSettled = false;

    function resolveOnce() {
      if (isSettled) {
        return;
      }

      isSettled = true;
      resolve();
    }

    function handleImageLoaded() {
      if (typeof image.decode === 'function') {
        void image.decode().then(resolveOnce, resolveOnce);
        return;
      }

      resolveOnce();
    }

    image.onload = handleImageLoaded;
    image.onerror = resolveOnce;
    image.src = assetUrl;

    if (image.complete) {
      handleImageLoaded();
    }
  });

  preloadedImagePromises.set(assetUrl, preloadPromise);
  return preloadPromise;
}

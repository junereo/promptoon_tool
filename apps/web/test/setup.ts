type ReactActEnvironmentGlobal = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

(globalThis as ReactActEnvironmentGlobal).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverMock;
}

type TriggerableIntersectionObserverGlobal = typeof globalThis & {
  __triggerIntersection?: (element: Element, ratio?: number) => void;
};

const intersectionObserverInstances: IntersectionObserverMock[] = [];

class IntersectionObserverMock {
  private readonly callback: IntersectionObserverCallback;
  private readonly elements = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    intersectionObserverInstances.push(this);
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  trigger(element: Element, ratio = 1) {
    if (!this.elements.has(element)) {
      return;
    }

    const rect = element.getBoundingClientRect();
    this.callback(
      [
        {
          boundingClientRect: rect,
          intersectionRatio: ratio,
          intersectionRect: rect,
          isIntersecting: ratio > 0,
          rootBounds: null,
          target: element,
          time: Date.now()
        } as IntersectionObserverEntry
      ],
      this as unknown as IntersectionObserver
    );
  }
}

globalThis.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;
(globalThis as TriggerableIntersectionObserverGlobal).__triggerIntersection = (element, ratio = 1) => {
  for (const observer of intersectionObserverInstances) {
    observer.trigger(element, ratio);
  }
};

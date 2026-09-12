// Polifills que o jsdom não fornece e de que dependem componentes reais da app.
// Sem isto, a suite do `command-palette` (cmdk) rebentava em `ResizeObserver is not defined`
// antes de correr uma única asserção.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() { /* noop */ }
    unobserve() { /* noop */ }
    disconnect() { /* noop */ }
  } as unknown as typeof ResizeObserver;
}

if (typeof globalThis.matchMedia === 'undefined') {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => { /* noop (API legada) */ },
      removeListener: () => { /* noop (API legada) */ },
      addEventListener: () => { /* noop */ },
      removeEventListener: () => { /* noop */ },
      dispatchEvent: () => false,
    }),
  });
}

// O jsdom não implementa scrollIntoView; o cmdk chama-o ao mover a selecção.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () { /* noop */ };
}

export {};

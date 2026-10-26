/**
 * Scroll reveal for the editorial sections.
 * Elements with [data-reveal] animate in as they come into view; elements that come in together are staggered.
 *   data-reveal="fade-up" (default) · "fade" · "clip" (a video or image that opens out from the middle)
 * Skipped in the theme editor, for reduced motion, and for anything already on screen when the page loads.
 */
const STAGGER = 90;
const MAX_DELAY = 450;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const observer =
  'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          let index = 0;
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const element = /** @type {HTMLElement} */ (entry.target);
            element.style.setProperty('--reveal-delay', `${Math.min(index * STAGGER, MAX_DELAY)}ms`);
            element.classList.add('is-revealed');
            observer?.unobserve(element);
            index += 1;
          });
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
      )
    : null;

/** @param {ParentNode} root */
function init(root = document) {
  const elements = /** @type {HTMLElement[]} */ ([...root.querySelectorAll('[data-reveal]:not(.reveal-ready)')]);
  const skip = reduceMotion || !observer || window.Shopify?.designMode;

  elements.forEach((element) => {
    // Already in view on load: leave it as it is, so nothing flashes
    const rect = element.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (skip || inView) return;
    element.classList.add('reveal-ready');
    observer.observe(element);
  });
}

init();
document.addEventListener('shopify:section:load', (event) => init(/** @type {HTMLElement} */ (event.target)));

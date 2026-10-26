import { StandardEvents } from '@shopify/events';

/**
 * Stock & personalise block.
 * - "Personalise me" slides the personalisation fields open and closed.
 * - A required field the customer missed opens the panel, so the browser can point to it.
 * - The stock badge follows the selected variant.
 */
class LmhAvailability extends HTMLElement {
  connectedCallback() {
    this.toggle = this.querySelector('[data-lmh-toggle]');
    this.panel = this.querySelector('[data-lmh-panel]');
    this.toggle?.addEventListener('click', this.#onToggle);
    // 'invalid' doesn't bubble, so listen in the capture phase
    this.panel?.addEventListener('invalid', this.#onInvalid, true);

    this.section = this.closest('.shopify-section, dialog');
    this.section?.addEventListener(StandardEvents.productSelect, this.#onProductSelect);
  }

  disconnectedCallback() {
    this.section?.removeEventListener(StandardEvents.productSelect, this.#onProductSelect);
  }

  #onToggle = () => {
    this.setOpen(this.toggle.getAttribute('aria-expanded') !== 'true');
  };

  #onInvalid = () => {
    if (this.panel.hidden) this.setOpen(true, false);
  };

  /**
   * @param {boolean} open
   * @param {boolean} [animate]
   */
  setOpen(open, animate = true) {
    const panel = this.panel;
    if (!panel) return;
    this.toggle?.setAttribute('aria-expanded', String(open));
    panel.getAnimations().forEach((animation) => animation.cancel());

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduce) {
      panel.hidden = !open;
      if (open) panel.querySelector('input, textarea')?.focus({ preventScroll: true });
      return;
    }

    const easing = 'cubic-bezier(0.2, 0, 0, 1)';
    if (open) {
      panel.hidden = false;
      const height = panel.scrollHeight;
      const animation = panel.animate(
        [
          { height: '0px', opacity: 0 },
          { height: `${height}px`, opacity: 1 },
        ],
        { duration: 350, easing }
      );
      animation.onfinish = () => panel.querySelector('input, textarea')?.focus({ preventScroll: true });
    } else {
      const animation = panel.animate(
        [
          { height: `${panel.offsetHeight}px`, opacity: 1 },
          { height: '0px', opacity: 0 },
        ],
        { duration: 280, easing }
      );
      const finish = () => (panel.hidden = this.toggle?.getAttribute('aria-expanded') !== 'true');
      animation.onfinish = finish;
      // Backup: animations can stall in background tabs, so close when the time is up anyway
      setTimeout(finish, 320);
    }
  }

  /** Swap in the stock badge from the section the variant picker fetched */
  #onProductSelect = (event) => {
    if (!(event.target instanceof Element) || event.target.closest('product-card')) return;
    event.promise
      ?.then(({ detail }) => {
        if (!detail?.html) return;
        if (detail.productId && detail.productId !== this.dataset.productId && !detail.newProduct) return;
        const fresh = detail.html.querySelector(`lmh-availability[data-block-id="${this.dataset.blockId}"] [data-lmh-stock]`);
        const current = this.querySelector('[data-lmh-stock]');
        if (fresh && current) current.replaceWith(fresh);
      })
      .catch(() => {});
  };
}

if (!customElements.get('lmh-availability')) {
  customElements.define('lmh-availability', LmhAvailability);
}

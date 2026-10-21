/**
 * Editorial header (Hermès-style): category bar with mega menus, inline predictive search,
 * and a full-screen mobile menu tray. Used by sections/header-editorial.liquid.
 */
class HeaderEditorial extends HTMLElement {
  #controller = new AbortController();
  #searchAbort = null;
  #searchTimer = 0;
  #hoverTimer = 0;
  #openTrigger = null;
  #lastFocus = null;
  #lastPointerType = 'mouse';

  connectedCallback() {
    const { signal } = this.#controller;

    this.bar = this.querySelector('.he__bar');
    this.overlay = this.querySelector('.he__overlay');
    this.tray = this.querySelector('[data-tray]');
    this.searchForm = this.querySelector('[data-search-form]');
    this.searchInput = this.querySelector('[data-search-input]');
    this.searchClear = this.querySelector('[data-action="clear-search"]');
    this.results = this.querySelector('[data-search-results]');
    this.resultsInner = this.querySelector('[data-search-results-inner]');
    this.triggers = [...this.querySelectorAll('[data-mega-trigger]')];

    this.addEventListener('pointerdown', (event) => (this.#lastPointerType = event.pointerType), { signal });
    this.addEventListener('click', this.#onClick, { signal });
    this.addEventListener('keydown', this.#onKeydown, { signal });
    document.addEventListener('click', this.#onDocumentClick, { signal });

    for (const trigger of this.triggers) {
      if (this.dataset.hover === 'true') {
        const item = trigger.parentElement;
        item.addEventListener('pointerenter', (event) => event.pointerType === 'mouse' && this.#hoverOpen(trigger), { signal });
        item.addEventListener('pointerleave', (event) => event.pointerType === 'mouse' && this.#hoverClose(), { signal });
      }
    }

    // Transparent header turns solid while the pointer is over it
    this.bar.addEventListener('mouseenter', () => this.classList.add('he--solid'), { signal });
    this.bar.addEventListener('mouseleave', () => this.#syncSolid(), { signal });

    if (this.searchInput) {
      this.searchInput.addEventListener('focus', () => this.#openSearch(), { signal });
      this.searchInput.addEventListener('input', this.#onSearchInput, { signal });
    }

    this.popularTemplate = this.querySelector('template[data-popular-searches]');

    // "Show when scrolling up": the page scrolls inside .page-wrapper on desktop, the window on mobile
    if (this.classList.contains('he--sticky-scroll-up')) {
      const onScroll = (event) => this.#onScroll(event.currentTarget === window ? window.scrollY : event.currentTarget.scrollTop);
      window.addEventListener('scroll', onScroll, { signal, passive: true });
      document.querySelector('.page-wrapper')?.addEventListener('scroll', onScroll, { signal, passive: true });
    }

    this.#measure();
    this.resizeObserver = new ResizeObserver(() => this.#measure());
    this.resizeObserver.observe(this.bar);
  }

  #lastScroll = 0;

  #onScroll(position) {
    const delta = position - this.#lastScroll;
    this.#lastScroll = position;
    if (Math.abs(delta) < 4) return;
    const busy = Boolean(this.#openTrigger) || this.classList.contains('he--search-open') || (this.tray && !this.tray.hidden);
    const hide = delta > 0 && position > this.bar.offsetHeight && !busy;
    this.classList.toggle('he--hidden', hide);
  }

  disconnectedCallback() {
    this.#controller.abort();
    this.resizeObserver?.disconnect();
  }

  /* ---------- Shared ---------- */

  #onClick = (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const trigger = target.closest('[data-mega-trigger]');
    if (trigger) {
      event.preventDefault();
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      // In hover mode a mouse click must not close the menu the hover just opened
      const hoverMouse = this.dataset.hover === 'true' && this.#lastPointerType === 'mouse';
      if (isOpen && !hoverMouse) this.closeMega();
      else this.openMega(trigger);
      return;
    }

    const action = target.closest('[data-action]')?.getAttribute('data-action');
    switch (action) {
      case 'open-tray':
        return this.openTray();
      case 'close-tray':
        return this.closeTray();
      case 'tray-open':
        return this.#openTrayLevel(target.closest('[data-action]'));
      case 'tray-back':
        return this.#closeTrayLevel();
      case 'open-search':
        this.#openSearch();
        this.searchInput?.focus();
        return;
      case 'clear-search':
        this.searchInput.value = '';
        this.searchClear.hidden = true;
        this.#showPopular();
        this.searchInput.focus();
        return;
      case 'close-all':
        return this.closeAll();
    }
  };

  #onDocumentClick = (event) => {
    if (!this.contains(/** @type {Node} */ (event.target))) this.closeAll();
  };

  #onKeydown = (event) => {
    if (event.key !== 'Escape') return;
    if (this.tray && !this.tray.hidden) return this.closeTray();
    if (this.#openTrigger) {
      const trigger = this.#openTrigger;
      this.closeMega();
      trigger.focus();
      return;
    }
    if (this.classList.contains('he--search-open') || !this.results.hidden) {
      this.#closeSearch();
      this.searchInput?.blur();
    }
  };

  closeAll() {
    this.closeMega();
    this.#closeSearch();
  }

  #syncOverlay() {
    const open = Boolean(this.#openTrigger) || (this.classList.contains('he--search-open') && !this.results.hidden);
    this.overlay.hidden = !open;
    this.#syncSolid();
  }

  #syncSolid() {
    const active =
      Boolean(this.#openTrigger) || this.classList.contains('he--search-open') || this.bar.matches(':hover');
    this.classList.toggle('he--solid', active);
  }

  /** Publishes the header height for the theme's sticky/transparent-header CSS */
  #measure() {
    const height = Math.round(this.bar.getBoundingClientRect().height);
    document.body.style.setProperty('--header-height', `${height}px`);
    const group = this.closest('.shopify-section')?.parentElement;
    let groupHeight = 0;
    group?.querySelectorAll(':scope > .shopify-section-group-header-group, :scope > .shopify-section').forEach((el) => {
      groupHeight += el.getBoundingClientRect().height;
    });
    document.body.style.setProperty('--header-group-height', `${Math.round(groupHeight || height)}px`);
  }

  /* ---------- Mega menu ---------- */

  openMega(trigger) {
    if (this.#openTrigger === trigger) return;
    this.closeMega();
    this.#closeSearch();
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    if (!panel) return;
    trigger.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    this.#openTrigger = trigger;
    this.#syncOverlay();
  }

  closeMega() {
    if (!this.#openTrigger) return;
    const panel = document.getElementById(this.#openTrigger.getAttribute('aria-controls'));
    this.#openTrigger.setAttribute('aria-expanded', 'false');
    if (panel) panel.hidden = true;
    this.#openTrigger = null;
    this.#syncOverlay();
  }

  #hoverOpen(trigger) {
    clearTimeout(this.#hoverTimer);
    this.#hoverTimer = setTimeout(() => this.openMega(trigger), this.#openTrigger ? 0 : 120);
  }

  #hoverClose() {
    clearTimeout(this.#hoverTimer);
    this.#hoverTimer = setTimeout(() => this.closeMega(), 200);
  }

  /* ---------- Search ---------- */

  #openSearch() {
    this.closeMega();
    this.classList.add('he--search-open');
    this.classList.remove('he--hidden');
    if (!this.searchInput?.value.trim()) this.#showPopular();
    this.#syncSolid();
  }

  /** Suggested searches from the section settings, shown before anything is typed */
  #showPopular() {
    if (!this.popularTemplate) return this.#renderResults(null);
    this.resultsInner.replaceChildren(this.popularTemplate.content.cloneNode(true));
    this.results.hidden = false;
    this.searchInput?.setAttribute('aria-expanded', 'true');
    this.#syncOverlay();
  }

  #closeSearch() {
    if (!this.classList.contains('he--search-open') && this.results.hidden) return;
    this.classList.remove('he--search-open');
    this.results.hidden = true;
    this.searchInput?.setAttribute('aria-expanded', 'false');
    this.#syncOverlay();
  }

  #onSearchInput = () => {
    if (!this.classList.contains('he--search-open')) this.#openSearch();
    const query = this.searchInput.value.trim();
    this.searchClear.hidden = query.length === 0;
    clearTimeout(this.#searchTimer);
    if (!query) {
      this.#searchAbort?.abort();
      return this.#showPopular();
    }
    this.#searchTimer = setTimeout(() => this.#fetchResults(query), 200);
  };

  async #fetchResults(query) {
    this.#searchAbort?.abort();
    this.#searchAbort = new AbortController();
    const url = new URL(`${this.dataset.predictiveUrl}.json`, location.origin);
    url.searchParams.set('q', query);
    url.searchParams.set('resources[type]', 'query,product,collection,page');
    url.searchParams.set('resources[limit]', '6');
    url.searchParams.set('resources[options][unavailable_products]', 'last');

    try {
      const response = await fetch(url, { signal: this.#searchAbort.signal });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      if (this.searchInput.value.trim() === query) this.#renderResults(data.resources?.results ?? {}, query);
    } catch (error) {
      if (error.name !== 'AbortError') this.#renderResults({}, query);
    }
  }

  #renderResults(results, query = '') {
    if (!results) {
      this.results.hidden = true;
      this.searchInput.setAttribute('aria-expanded', 'false');
      this.#syncOverlay();
      return;
    }

    const esc = (value) =>
      String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const queries = results.queries ?? [];
    const products = results.products ?? [];
    const links = [...(results.collections ?? []), ...(results.pages ?? [])];
    const searchUrl = `${this.dataset.searchUrl}?q=${encodeURIComponent(query)}&options%5Bprefix%5D=last`;

    let suggestionsHtml = '';
    if (queries.length || links.length) {
      suggestionsHtml = `<div>
        ${
          queries.length
            ? `<p class="he__results-label">Suggested searches</p>
               <ul class="he__results-list list-unstyled">${queries
                 .map((q) => `<li><a href="${esc(q.url)}">${this.#highlight(q.text, query, esc)}</a></li>`)
                 .join('')}</ul>`
            : ''
        }
        ${
          links.length
            ? `<p class="he__results-label"${queries.length ? ' style="margin-top:24px"' : ''}>Collections &amp; pages</p>
               <ul class="he__results-list list-unstyled">${links
                 .map((l) => `<li><a href="${esc(l.url)}">${esc(l.title)}</a></li>`)
                 .join('')}</ul>`
            : ''
        }
      </div>`;
    }

    const productsHtml = products.length
      ? `<div>
          <p class="he__results-label">Products</p>
          <div class="he__results-products">${products
            .slice(0, 4)
            .map((p) => {
              const image = p.featured_image?.url || p.image;
              const src = image ? `${image}${image.includes('?') ? '&' : '?'}width=300` : '';
              return `<a class="he__result-product" href="${esc(p.url)}">
                ${src ? `<img src="${esc(src)}" alt="${esc(p.featured_image?.alt || p.title)}" loading="lazy" width="300" height="375">` : ''}
                <span>${esc(p.title)}</span>
                ${p.price ? `<span class="he__result-price">${esc(this.#formatPrice(p.price))}</span>` : ''}
              </a>`;
            })
            .join('')}</div>
          <p style="margin:24px 0 0"><a class="he__results-all" href="${esc(searchUrl)}">See all results</a></p>
        </div>`
      : '';

    this.resultsInner.innerHTML =
      suggestionsHtml || productsHtml
        ? `${suggestionsHtml || '<div></div>'}${productsHtml}`
        : `<p class="he__results-empty">No results for “${esc(query)}”. <a class="he__results-all" href="${esc(searchUrl)}">Search anyway</a></p>`;

    this.results.hidden = false;
    this.searchInput.setAttribute('aria-expanded', 'true');
    this.#syncOverlay();
  }

  /** Bolds the typed part of a suggestion; everything is escaped first */
  #highlight(text, query, esc) {
    const value = String(text ?? '');
    const index = value.toLowerCase().indexOf(query.toLowerCase());
    if (!query || index === -1) return esc(value);
    return `${esc(value.slice(0, index))}<mark>${esc(value.slice(index, index + query.length))}</mark>${esc(
      value.slice(index + query.length)
    )}`;
  }

  #formatPrice(price) {
    const amount = Number(price);
    if (Number.isNaN(amount)) return price;
    try {
      const currency = window.Shopify?.currency?.active || 'GBP';
      return new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency }).format(amount);
    } catch {
      return price;
    }
  }

  /* ---------- Mobile tray ---------- */

  openTray() {
    if (!this.tray) return;
    this.#lastFocus = document.activeElement;
    this.#closeSearch();
    this.tray.hidden = false;
    this.querySelector('.he__menu-toggle')?.setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';
    this.tray.querySelector('button, a')?.focus();
  }

  closeTray() {
    if (!this.tray || this.tray.hidden) return;
    this.tray.hidden = true;
    this.#closeTrayLevel();
    this.querySelector('.he__menu-toggle')?.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
    /** @type {HTMLElement} */ (this.#lastFocus)?.focus?.();
  }

  #openTrayLevel(button) {
    const level = document.getElementById(button.dataset.target);
    if (!level) return;
    level.hidden = false;
    level.querySelector('[data-action="tray-back"]')?.focus();
  }

  #closeTrayLevel() {
    const open = this.tray?.querySelector('[data-tray-level]:not([hidden])');
    if (!open) return;
    open.hidden = true;
    this.tray.querySelector(`[data-target="${open.id}"]`)?.focus();
  }
}

if (!customElements.get('header-editorial')) customElements.define('header-editorial', HeaderEditorial);

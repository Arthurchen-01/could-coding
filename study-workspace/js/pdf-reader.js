/**
 * pdf-reader.js — Continuous scroll PDF renderer for Study Workspace
 * Each page gets its own canvas inside a scrollable container.
 */
class PDFReader {
  constructor(options = {}) {
    this.container = options.container || null;
    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.5;
    this.minScale = 0.5;
    this.maxScale = 3.0;
    this.scaleStep = 0.25;
    this._renderedPages = new Map(); // pageNum -> { wrapper, canvas, ctx, page }
    this._renderingPages = new Set();
    this._scrollHandler = null;
    this._containerWidth = 0;
  }

  /**
   * Load a PDF file (File object or URL string)
   * Renders all pages at once.
   */
  async loadFile(file) {
    let data;
    if (file instanceof File) {
      data = await file.arrayBuffer();
    } else {
      const resp = await fetch(file);
      data = await resp.arrayBuffer();
    }

    this.pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    this.totalPages = this.pdfDoc.numPages;
    this.currentPage = 1;
    this._renderedPages.clear();
    this._renderingPages.clear();

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }

    // Render all pages
    await this._renderAllPages();

    // Set up scroll tracking
    this._setupScrollTracking();

    // Scroll to page 1
    if (this.container) {
      this.container.scrollTop = 0;
    }

    return this.totalPages;
  }

  /**
   * Lazy-load a range of pages (not yet rendered).
   */
  async loadPages(startPage, endPage) {
    for (let i = startPage; i <= endPage; i++) {
      if (!this._renderedPages.has(i) && !this._renderingPages.has(i)) {
        await this._renderPage(i);
      }
    }
  }

  /**
   * Render all pages at current scale.
   */
  async _renderAllPages() {
    // Measure container width for auto-fit on first load
    this._updateContainerWidth();

    for (let i = 1; i <= this.totalPages; i++) {
      await this._renderPage(i);
    }
  }

  _updateContainerWidth() {
    if (this.container) {
      this._containerWidth = this.container.clientWidth - 32; // padding
    }
  }

  /**
   * Render a single page into its canvas.
   */
  async _renderPage(num) {
    if (!this.pdfDoc || num < 1 || num > this.totalPages) return;
    if (this._renderingPages.has(num)) return;

    this._renderingPages.add(num);

    try {
      const page = await this.pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale: this.scale });

      let entry = this._renderedPages.get(num);

      if (!entry) {
        // Create page wrapper and canvas
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-page';
        wrapper.dataset.page = num;

        const canvas = document.createElement('canvas');
        wrapper.appendChild(canvas);

        if (this.container) {
          this.container.appendChild(wrapper);
        }

        entry = { wrapper, canvas, page };
        this._renderedPages.set(num, entry);
      }

      const { canvas } = entry;
      const ctx = canvas.getContext('2d');

      // Scale canvas to match viewport
      // Round to integers for crisp rendering
      const scaledViewport = page.getViewport({ scale: this.scale });
      canvas.width = Math.round(scaledViewport.width);
      canvas.height = Math.round(scaledViewport.height);

      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport
      }).promise;

      // Update data attribute for reliability
      if (entry.wrapper) {
        entry.wrapper.dataset.page = num;
      }
    } finally {
      this._renderingPages.delete(num);
    }
  }

  /**
   * Set up scroll listener to track which page is in viewport center.
   */
  _setupScrollTracking() {
    if (this._scrollHandler) {
      this.container?.removeEventListener('scroll', this._scrollHandler);
    }

    this._scrollHandler = () => {
      this._updateCurrentPage();
    };

    this.container?.addEventListener('scroll', this._scrollHandler, { passive: true });
    this._updateCurrentPage();
  }

  /**
   * Update currentPage based on scroll position (which page is near viewport center).
   */
  _updateCurrentPage() {
    if (!this.container || this._renderedPages.size === 0) return;

    const containerRect = this.container.getBoundingClientRect();
    const viewportCenter = this.container.scrollTop + containerRect.height / 2;

    let closestPage = 1;
    let closestDist = Infinity;

    for (const [pageNum, entry] of this._renderedPages) {
      if (!entry.wrapper) continue;
      const rect = entry.wrapper.getBoundingClientRect();
      const pageCenter = rect.top + rect.height / 2 - this.container.scrollTop;
      const dist = Math.abs(pageCenter - containerRect.height / 2);
      if (dist < closestDist) {
        closestDist = dist;
        closestPage = pageNum;
      }
    }

    this.currentPage = closestPage;
  }

  // ── Zoom Controls ───────────────────────────────────────────

  zoomIn() {
    this.setZoom(Math.min(this.scale + this.scaleStep, this.maxScale));
  }

  zoomOut() {
    this.setZoom(Math.max(this.scale - this.scaleStep, this.minScale));
  }

  setZoom(newScale) {
    const clamped = Math.max(this.minScale, Math.min(this.maxScale, newScale));
    if (clamped === this.scale) return;
    this.scale = clamped;
    this._reRenderVisiblePages();
  }

  /**
   * Re-render all pages at current scale.
   */
  async _reRenderVisiblePages() {
    // Re-render all pages (update canvas sizes)
    for (const [pageNum, entry] of this._renderedPages) {
      if (entry.page) {
        const scaledViewport = entry.page.getViewport({ scale: this.scale });
        entry.canvas.width = Math.round(scaledViewport.width);
        entry.canvas.height = Math.round(scaledViewport.height);
        await entry.page.render({
          canvasContext: entry.canvas.getContext('2d'),
          viewport: scaledViewport
        }).promise;
      }
    }
  }

  // ── Navigation ──────────────────────────────────────────────

  /**
   * Smooth scroll to a specific page.
   */
  scrollToPage(num) {
    if (!this.container || num < 1 || num > this.totalPages) return Promise.resolve();

    const entry = this._renderedPages.get(num);
    if (!entry || !entry.wrapper) return Promise.resolve();

    entry.wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.currentPage = num;

    // Update after scroll animation
    return new Promise(resolve => {
      setTimeout(() => {
        this._updateCurrentPage();
        resolve();
      }, 400);
    });
  }

  async nextPage() {
    if (this.currentPage < this.totalPages) {
      await this.scrollToPage(this.currentPage + 1);
      return true;
    }
    return false;
  }

  async prevPage() {
    if (this.currentPage > 1) {
      await this.scrollToPage(this.currentPage - 1);
      return true;
    }
    return false;
  }

  // ── Getters ─────────────────────────────────────────────────

  getCurrentPageNum() { return this.currentPage; }
  getTotalPages() { return this.totalPages; }

  getViewport() {
    return { scale: this.scale, currentPage: this.currentPage };
  }

  /**
   * Re-render current page (e.g., after resize).
   */
  async refresh() {
    this._updateContainerWidth();
    for (const [pageNum, entry] of this._renderedPages) {
      if (entry.page) {
        const scaledViewport = entry.page.getViewport({ scale: this.scale });
        entry.canvas.width = Math.round(scaledViewport.width);
        entry.canvas.height = Math.round(scaledViewport.height);
        await entry.page.render({
          canvasContext: entry.canvas.getContext('2d'),
          viewport: scaledViewport
        }).promise;
      }
    }
  }

  /**
   * Get current page as image data URL (for silent reader).
   * Uses the page canvas at current scale.
   */
  getCurrentPageDataURL(quality = 0.8) {
    const entry = this._renderedPages.get(this.currentPage);
    if (!entry) return null;
    return entry.canvas.toDataURL('image/png', quality);
  }

  /**
   * Get current page as blob.
   */
  async getCurrentPageBlob() {
    return new Promise(resolve => {
      const dataUrl = this.getCurrentPageDataURL();
      if (!dataUrl) { resolve(null); return; }
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) { u8arr[n] = bstr.charCodeAt(n); }
      resolve(new Blob([u8arr], { type: mime }));
    });
  }

  /**
   * Get page canvas by number (for silent reader).
   */
  getPageCanvas(num) {
    const entry = this._renderedPages.get(num);
    return entry ? entry.canvas : null;
  }
}

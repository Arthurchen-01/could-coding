/**
 * pdf-reader.js — PDF.js wrapper for Study Workspace
 */
class PDFReader {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.5;
  }

  /**
   * Load a PDF file (File object or URL string)
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
    await this.renderPage(1);
    return this.totalPages;
  }

  /**
   * Render a specific page number (1-indexed)
   */
  async renderPage(num) {
    if (!this.pdfDoc || num < 1 || num > this.totalPages) return;

    const page = await this.pdfDoc.getPage(num);
    const container = this.canvas.parentElement;
    const containerWidth = container.clientWidth - 24; // padding

    // Calculate scale to fit container width
    const viewport = page.getViewport({ scale: 1 });
    this.scale = containerWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale: this.scale });

    this.canvas.width = scaledViewport.width;
    this.canvas.height = scaledViewport.height;

    await page.render({
      canvasContext: this.ctx,
      viewport: scaledViewport
    }).promise;

    this.currentPage = num;
  }

  /**
   * Get current page as image data (for screenshot/silent reading)
   */
  getCurrentPageDataURL(quality = 0.8) {
    return this.canvas.toDataURL('image/png', quality);
  }

  /**
   * Get current page as blob
   */
  async getCurrentPageBlob() {
    return new Promise(resolve => {
      this.canvas.toBlob(resolve, 'image/png');
    });
  }

  /**
   * Navigate to next page
   */
  async nextPage() {
    if (this.currentPage < this.totalPages) {
      await this.renderPage(this.currentPage + 1);
      return true;
    }
    return false;
  }

  /**
   * Navigate to previous page
   */
  async prevPage() {
    if (this.currentPage > 1) {
      await this.renderPage(this.currentPage - 1);
      return true;
    }
    return false;
  }

  getCurrentPageNum() { return this.currentPage; }
  getTotalPages() { return this.totalPages; }

  /**
   * Re-render current page (e.g., after resize)
   */
  async refresh() {
    await this.renderPage(this.currentPage);
  }
}

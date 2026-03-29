/**
 * resizer.js — Drag-to-resize split panel for Study Workspace
 */
class Resizer {
  constructor(containerEl, leftPaneEl, rightPaneEl, resizerEl) {
    this.container = containerEl;
    this.left = leftPaneEl;
    this.right = rightPaneEl;
    this.handle = resizerEl;
    this.isDragging = false;
    this.minWidth = 200;
  }

  /**
   * Initialize drag listeners and restore saved state
   */
  init() {
    this.handle.addEventListener('mousedown', e => this.startDrag(e));
    this.handle.addEventListener('touchstart', e => this.startDrag(e.touches[0]), { passive: true });

    document.addEventListener('mousemove', e => this.onDrag(e));
    document.addEventListener('touchmove', e => {
      if (this.isDragging) {
        e.preventDefault();
        this.onDrag(e.touches[0]);
      }
    }, { passive: false });

    document.addEventListener('mouseup', () => this.endDrag());
    document.addEventListener('touchend', () => this.endDrag());

    this.restoreState();
  }

  startDrag(e) {
    this.isDragging = true;
    this.startX = e.clientX;
    this.startLeftWidth = this.left.offsetWidth;
    this.handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  onDrag(e) {
    if (!this.isDragging) return;
    const dx = e.clientX - this.startX;
    const containerWidth = this.container.offsetWidth;
    let newLeftWidth = this.startLeftWidth + dx;

    // Clamp to min/max
    if (newLeftWidth < this.minWidth) newLeftWidth = this.minWidth;
    if (newLeftWidth > containerWidth - this.minWidth - 6) {
      newLeftWidth = containerWidth - this.minWidth - 6;
    }

    const percentage = (newLeftWidth / containerWidth) * 100;
    this.left.style.width = percentage + '%';
  }

  endDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    this.saveState();
  }

  /**
   * Save layout ratio to localStorage
   */
  saveState() {
    const containerWidth = this.container.offsetWidth;
    const ratio = (this.left.offsetWidth / containerWidth) * 100;
    try {
      localStorage.setItem('study-workspace-layout', JSON.stringify({ leftWidth: ratio }));
    } catch (e) { /* quota exceeded */ }
  }

  /**
   * Restore layout from localStorage
   */
  restoreState() {
    try {
      const saved = localStorage.getItem('study-workspace-layout');
      if (saved) {
        const { leftWidth } = JSON.parse(saved);
        if (leftWidth && leftWidth >= 20 && leftWidth <= 80) {
          this.left.style.width = leftWidth + '%';
        }
      }
    } catch (e) { /* ignore */ }
  }

  /**
   * Reset to 50/50 split
   */
  reset() {
    this.left.style.width = '50%';
    this.saveState();
  }
}

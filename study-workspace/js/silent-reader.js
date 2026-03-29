/**
 * silent-reader.js — Silent page recognition with visual model
 */
class SilentReader {
  constructor(pdfReader) {
    this.pdfReader = pdfReader;
    this.cache = new Map(); // pageNum -> { timestamp, summary, keyConcepts }
    this.isReading = false;
  }

  /**
   * Capture current PDF view as data URL
   */
  async captureCurrentView() {
    const blob = await this.pdfReader.getCurrentPageBlob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Check if a page has been cached
   */
  isCached(pageNum) {
    return this.cache.has(pageNum);
  }

  /**
   * Get cached recognition result
   */
  getCachedResult(pageNum) {
    return this.cache.get(pageNum) || null;
  }

  /**
   * Recognize current page using vision model
   */
  async recognizeCurrentPage() {
    const pageNum = this.pdfReader.getCurrentPageNum();
    if (this.isReading) return null;

    this.isReading = true;
    try {
      const imageData = await this.captureCurrentView();

      // Build multimodal message for vision model
      const message = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this page of educational material. Provide: 1) Main topic/concept 2) Key concepts listed 3) Important formulas or terms 4) Brief summary in plain language. Respond in JSON format: {"topic": "", "keyConcepts": [], "summary": ""}'
          },
          {
            type: 'image_url',
            image_url: {
              url: imageData
            }
          }
        ]
      };

      // Call the AI proxy to get vision response
      let result;
      if (typeof buildMultimodalMessage === 'function') {
        result = await buildMultimodalMessage([imageData], 'Analyze this page');
      } else if (typeof sendToAI === 'function') {
        result = await sendToAI(message);
      } else {
        // Fallback: store raw image data
        result = { topic: 'Page ' + pageNum, summary: 'Vision model not configured', keyConcepts: [] };
      }

      // Parse and cache result
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      const cacheEntry = {
        timestamp: Date.now(),
        topic: parsed.topic || 'Page ' + pageNum,
        keyConcepts: parsed.keyConcepts || [],
        summary: parsed.summary || ''
      };

      this.cache.set(pageNum, cacheEntry);
      this.saveCacheToStorage(pageNum, cacheEntry);
      return cacheEntry;

    } catch (err) {
      console.error('SilentReader error:', err);
      // Cache a fallback entry
      const fallback = {
        timestamp: Date.now(),
        topic: 'Page ' + pageNum,
        keyConcepts: [],
        summary: 'Unable to read this page. Please try again.'
      };
      this.cache.set(pageNum, fallback);
      return fallback;
    } finally {
      this.isReading = false;
    }
  }

  /**
   * Build context-aware prompt for user's question
   */
  buildContextPrompt(userQuestion) {
    const pageNum = this.pdfReader.getCurrentPageNum();
    const cached = this.getCachedResult(pageNum);

    if (!cached) {
      return userQuestion;
    }

    return `[Context from page ${pageNum}]:
Topic: ${cached.topic}
Key Concepts: ${cached.keyConcepts.join(', ')}
Page Summary: ${cached.summary}

[User Question]:
${userQuestion}`;
  }

  /**
   * Save cache entry to localStorage
   */
  saveCacheToStorage(pageNum, entry) {
    try {
      const stored = JSON.parse(localStorage.getItem('silent-read-cache') || '{}');
      stored[`page_${pageNum}`] = entry;
      localStorage.setItem('silent-read-cache', JSON.stringify(stored));
    } catch (e) { /* quota exceeded */ }
  }

  /**
   * Restore cache from localStorage
   */
  restoreFromStorage() {
    try {
      const stored = JSON.parse(localStorage.getItem('silent-read-cache') || '{}');
      for (const [key, value] of Object.entries(stored)) {
        const pageNum = parseInt(key.replace('page_', ''));
        if (!isNaN(pageNum)) {
          this.cache.set(pageNum, value);
        }
      }
    } catch (e) { /* ignore */ }
  }
}

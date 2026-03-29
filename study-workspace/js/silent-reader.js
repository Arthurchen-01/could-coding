/**
 * silent-reader.js — Silent page recognition with visual model
 * Uses html2canvas to capture PDF page → base64 → vision model → cache
 */
class SilentReader {
  constructor(pdfReader) {
    this.pdfReader = pdfReader;
    this.cache = new Map();
    this.isReading = false;
  }

  /**
   * Capture current PDF canvas view as base64 data URL
   * Strategy: html2canvas on the canvas element, fallback to canvas.toDataURL
   */
  async captureCurrentView() {
    const canvas = this.pdfReader.canvas;
    if (!canvas) throw new Error('No PDF canvas found');

    // Try html2canvas first (captures better quality)
    if (typeof html2canvas !== 'undefined') {
      try {
        const rendered = await html2canvas(canvas, {
          scale: 1,
          useCORS: true,
          logging: false
        });
        return rendered.toDataURL('image/png', 0.9);
      } catch (e) {
        console.warn('html2canvas failed, falling back to toDataURL:', e);
      }
    }

    // Fallback: direct canvas toDataURL
    return canvas.toDataURL('image/png', 0.9);
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

      // Build vision request
      const visionPrompt = `Analyze this educational material page. Respond ONLY with valid JSON:
{
  "topic": "main topic of this page",
  "keyConcepts": ["concept1", "concept2", "concept3"],
  "summary": "brief plain-language summary"
}`;

      // Call vision model via existing API infrastructure
      const result = await this.callVisionModel(imageData, visionPrompt);

      // Parse result
      let parsed;
      try {
        // Try to extract JSON from response
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(result);
      } catch (parseErr) {
        // If parsing fails, create a text-based entry
        parsed = {
          topic: 'Page ' + pageNum,
          keyConcepts: [],
          summary: result.substring(0, 500)
        };
      }

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
      const fallback = {
        timestamp: Date.now(),
        topic: 'Page ' + pageNum,
        keyConcepts: [],
        summary: 'Unable to read this page. Check your API key in Settings.'
      };
      this.cache.set(pageNum, fallback);
      return fallback;
    } finally {
      this.isReading = false;
    }
  }

  /**
   * Call vision model with image data
   * Supports: OpenAI (gpt-4o), Gemini (gemini-2.0-flash), Claude (vision)
   */
  async callVisionModel(imageDataUrl, prompt) {
    const config = JSON.parse(localStorage.getItem('api-config') || '{}');
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const apiKey = config.apiKey || '';
    // Use visionModelId if set, otherwise fall back to modelId
    const modelId = config.visionModelId || config.modelId || 'gpt-4o';

    if (!apiKey) {
      throw new Error('API key not configured. Please set up in Settings.');
    }

    // Ensure image data is in correct format for vision API
    let imageUrl = imageDataUrl;
    if (!imageUrl.startsWith('data:')) {
      imageUrl = 'data:image/png;base64,' + imageUrl;
    }

    // Build messages with image
    const messages = [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }];

    // Call API
    const response = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
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

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
   * Capture current PDF page as base64 data URL
   * Supports both old (single canvas) and new (multi-page) PDFReader
   */
  async captureCurrentView() {
    let canvas;

    // New PDFReader API: getPageCanvas(pageNum)
    if (typeof this.pdfReader.getPageCanvas === "function") {
      canvas = this.pdfReader.getPageCanvas(this.pdfReader.getCurrentPageNum());
    } else {
      // Old API: single canvas
      canvas = this.pdfReader.canvas;
    }

    if (!canvas) throw new Error("No PDF canvas found for current page");

    // html2canvas for better quality capture
    if (typeof html2canvas !== "undefined") {
      try {
        const rendered = await html2canvas(canvas, {
          scale: 1,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff"
        });
        return rendered.toDataURL("image/png", 0.9);
      } catch (e) {
        console.warn("html2canvas failed, falling back to toDataURL:", e);
      }
    }

    // Fallback: direct canvas capture
    return canvas.toDataURL("image/png", 0.9);
  }

  isCached(pageNum) { return this.cache.has(pageNum); }
  getCachedResult(pageNum) { return this.cache.get(pageNum) || null; }

  async recognizeCurrentPage() {
    const pageNum = this.pdfReader.getCurrentPageNum();
    if (this.isReading) return null;

    this.isReading = true;
    try {
      const imageData = await this.captureCurrentView();

      const visionPrompt = `Analyze this educational material page. Respond ONLY with valid JSON:
{
  "topic": "main topic of this page",
  "keyConcepts": ["concept1", "concept2", "concept3"],
  "summary": "brief plain-language summary"
}`;

      const result = await this.callVisionModel(imageData, visionPrompt);

      let parsed;
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(result);
      } catch (parseErr) {
        parsed = {
          topic: "Page " + pageNum,
          keyConcepts: [],
          summary: result.substring(0, 500)
        };
      }

      const cacheEntry = {
        timestamp: Date.now(),
        topic: parsed.topic || "Page " + pageNum,
        keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
        summary: parsed.summary || ""
      };

      this.cache.set(pageNum, cacheEntry);
      this.saveCacheToStorage(pageNum, cacheEntry);
      return cacheEntry;

    } catch (err) {
      console.error("SilentReader error:", err);
      const fallback = {
        timestamp: Date.now(),
        topic: "Page " + pageNum,
        keyConcepts: [],
        summary: "Unable to read this page: " + err.message + ". Check your API key in Settings."
      };
      this.cache.set(pageNum, fallback);
      return fallback;
    } finally {
      this.isReading = false;
    }
  }

  /**
   * Call vision model with image data
   */
  async callVisionModel(imageDataUrl, prompt) {
    const config = JSON.parse(localStorage.getItem("ap-tutor-api-config") || "{}");
    const baseUrl = config.baseUrl || "https://api.openai.com/v1";
    const apiKey = config.apiKey || "";
    // Use visionModelId if set, otherwise fall back to modelId
    const modelId = config.visionModelId || config.modelId || "gpt-4o";

    if (!apiKey) {
      throw new Error("API key not configured. Please set up in Settings.");
    }

    // Ensure image data is in correct format
    let imageUrl = imageDataUrl;
    if (!imageUrl.startsWith("data:")) {
      imageUrl = "data:image/png;base64," + imageUrl;
    }

    const messages = [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }];

    const response = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
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
      throw new Error(errData.error?.message || ("API error: " + response.status));
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  buildContextPrompt(userQuestion) {
    const pageNum = this.pdfReader.getCurrentPageNum();
    const cached = this.getCachedResult(pageNum);

    if (!cached) return userQuestion;

    return `[Context from page ${pageNum}]:
Topic: ${cached.topic}
Key Concepts: ${cached.keyConcepts.join(", ")}
Page Summary: ${cached.summary}

[User Question]:
${userQuestion}`;
  }

  saveCacheToStorage(pageNum, entry) {
    try {
      const stored = JSON.parse(localStorage.getItem("silent-read-cache") || "{}");
      stored["page_" + pageNum] = entry;
      localStorage.setItem("silent-read-cache", JSON.stringify(stored));
    } catch (e) {}
  }

  restoreFromStorage() {
    try {
      const stored = JSON.parse(localStorage.getItem("silent-read-cache") || "{}");
      for (const [key, value] of Object.entries(stored)) {
        const pageNum = parseInt(key.replace("page_", ""));
        if (!isNaN(pageNum)) this.cache.set(pageNum, value);
      }
    } catch (e) {}
  }
}


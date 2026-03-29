/**
 * question-logger.js — Question logging with IndexedDB persistence
 */
class QuestionLogger {
  constructor(dbName = 'ap-learning-db', storeName = 'question_logs') {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
  }

  /**
   * Open/initialize the IndexedDB database
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('subject', 'subject', { unique: false });
          store.createIndex('contextId', 'contextId', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Log a question and answer
   */
  async log(entry) {
    if (!this.db) await this.init();

    const record = {
      timestamp: entry.timestamp || Date.now(),
      subject: entry.subject || 'unknown',
      contextId: entry.contextId || '',
      question: entry.question || '',
      response: entry.response || '',
      visionUsed: entry.visionUsed || false,
      pageSummary: entry.pageSummary || '',
      persona: entry.persona || ''
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.add(record);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Query recent logs with optional filters
   */
  async query({ subject, limit = 50, offset = 0 } = {}) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);

      let results = [];
      let skipCount = 0;

      // Use index if filtering by subject
      const cursorRequest = subject
        ? store.index('subject').openCursor(null, 'prev')
        : store.openCursor(null, 'prev');

      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }

        // Filter by subject if needed
        if (!subject || cursor.value.subject === subject) {
          if (skipCount >= offset) {
            results.push(cursor.value);
          }
          skipCount++;
        }
        cursor.continue();
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }

  /**
   * Export all records as JSON string
   */
  async exportAll() {
    if (!this.db) await this.init();

    const records = await this.query({ limit: 999999 });
    return JSON.stringify(records, null, 2);
  }

  /**
   * Export records within a date range
   */
  async exportByDateRange(startDate, endDate) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const index = store.index('timestamp');

      const range = IDBKeyRange.bound(startDate, endDate);
      const results = [];

      const cursorRequest = index.openCursor(range);
      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve(JSON.stringify(results, null, 2));
          return;
        }
        results.push(cursor.value);
        cursor.continue();
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }

  /**
   * Clear all records (use with caution)
   */
  async clearAll() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get count of records
   */
  async count() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

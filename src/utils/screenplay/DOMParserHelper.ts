/**
 * Helper for creating a DOMParser that works in both browser and Node.js
 */
export function createDOMParser() {
  if (typeof window !== 'undefined' && window.DOMParser) {
    return new window.DOMParser();
  } else {
    try {
      // Try to import JSDOM dynamically
      const jsdom = require('jsdom');
      const { JSDOM } = jsdom;
      
      return {
        parseFromString: (markup: string, type: string) => {
          const dom = new JSDOM(markup, { contentType: type });
          return dom.window.document;
        }
      };
    } catch (error) {
      throw new Error('DOMParser not available. Please install jsdom for Node.js environments.');
    }
  }
}

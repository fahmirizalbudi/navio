/**
 * Navio - A lightweight client-side router framework.
 * @class
 */
class Navio {
  /**
   * Creates an instance of Navio.
   * @param {Object} [options] - Configuration options.
   * @param {string} [options.root='/'] - The root path for the router.
   * @param {boolean} [options.hashMode=false] - Whether to use hash-based routing (#/path) instead of History API.
   */
  constructor(options = {}) {
    /**
     * @type {string}
     * @private
     */
    this._root = options.root || '/';

    /**
     * @type {boolean}
     * @private
     */
    this._hashMode = !!options.hashMode;

    /**
     * @type {Array<{path: RegExp, callback: Function, params: string[]}>}
     * @private
     */
    this._routes = [];

    /**
     * @type {Function|null}
     * @private
     */
    this._notFoundHandler = null;

    // Bind methods
    this._onPopState = this._onPopState.bind(this);
    this._handleLinkClick = this._handleLinkClick.bind(this);
  }

  /**
   * Registers a route with a callback.
   * Supports dynamic parameters defined with a colon (e.g., '/user/:id').
   * 
   * @param {string} path - The route path definition.
   * @param {Function} callback - The function to execute when the route matches. Receives parameters as arguments.
   * @returns {Navio} The Navio instance for chaining.
   */
  on(path, callback) {
    const params = [];
    // Convert path to regex and extract parameter names
    const regexPath = path
      .replace(/:(\w+)/g, (_, paramName) => {
        params.push(paramName);
        return '([^\\/]+)';
      })
      .replace(/\//g, '\\/');

    const matcher = new RegExp(`^${regexPath}$`);

    this._routes.push({
      path: matcher,
      callback,
      params
    });

    return this;
  }

  /**
   * Sets a handler for when no route matches.
   * 
   * @param {Function} callback - The function to execute.
   * @returns {Navio} The Navio instance for chaining.
   */
  notFound(callback) {
    this._notFoundHandler = callback;
    return this;
  }

  /**
   * Navigates to a specific path programmatically.
   * 
   * @param {string} path - The path to navigate to.
   */
  navigate(path) {
    if (this._hashMode) {
      window.location.hash = path;
    } else {
      window.history.pushState(null, '', this._root + path.replace(/^\//, ''));
      this._resolve();
    }
  }

  /**
   * Starts the router and listens for changes.
   * Resolves the current route immediately.
   */
  start() {
    if (this._hashMode) {
      window.addEventListener('hashchange', this._onPopState);
    } else {
      window.addEventListener('popstate', this._onPopState);
    }
    
    // Listen for declarative link clicks
    document.addEventListener('click', this._handleLinkClick);
    
    this._resolve();
  }

  /**
   * Handles clicks on anchor tags with 'data-navio' attribute.
   * @param {Event} event 
   * @private
   */
  _handleLinkClick(event) {
    const link = event.target.closest('a[data-navio]');
    if (!link) return;

    event.preventDefault();
    const href = link.getAttribute('href');
    if (href) {
      // If in hash mode but href doesn't have hash, add it manually or handle logic. 
      // Assuming user provides clean paths in href for History mode or '#/path' for Hash mode.
      // If we want to abstract it:
      const targetPath = href.replace(/^#/, '');
      this.navigate(targetPath);
    }
  }

  /**
   * Handles the history popstate or hashchange event.
   * @private
   */
  _onPopState() {
    this._resolve();
  }

  /**
   * Resolves the current URL path against registered routes.
   * @private
   */
  _resolve() {
    let currentPath;

    if (this._hashMode) {
      currentPath = window.location.hash.slice(1) || '/';
    } else {
      currentPath = window.location.pathname.replace(this._root, '').replace(/^\//, '/') || '/';
    }

    let matchFound = false;

    for (const route of this._routes) {
      const match = currentPath.match(route.path);
      
      if (match) {
        matchFound = true;
        // Extract params values (first element is full match, rest are capturing groups)
        const args = match.slice(1);
        
        // Create a context object with named parameters
        const context = {
          path: currentPath,
          params: route.params.reduce((acc, key, index) => {
            acc[key] = args[index];
            return acc;
          }, {}),
          query: this._parseQuery()
        };

        route.callback(context);
        break;
      }
    }

    if (!matchFound && this._notFoundHandler) {
      this._notFoundHandler({ path: currentPath, query: this._parseQuery() });
    }
  }

  /**
   * Parses query string parameters.
   * @returns {Object} Key-value pairs of query parameters.
   * @private
   */
  _parseQuery() {
    const search = window.location.search.substring(1);
    if (!search) return {};
    return search.split('&').reduce((acc, item) => {
      const [key, value] = item.split('=');
      if (key) acc[decodeURIComponent(key)] = decodeURIComponent(value || '');
      return acc;
    }, {});
  }

  /**
   * Fetches an HTML file and extracts the body content.
   * @param {string} url - The URL of the HTML file to fetch.
   * @returns {Promise<string>} A promise that resolves to the inner HTML of the body.
   */
  static async fetchView(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load view: ${response.statusText}`);
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      return doc.body.innerHTML;
    } catch (error) {
      console.error(error);
      return `<h1>Error loading view</h1><p>${error.message}</p>`;
    }
  }
}

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Navio;
} else {
  // Attach to window for browser usage without a bundler
  // @ts-ignore
  window.Navio = Navio;
}

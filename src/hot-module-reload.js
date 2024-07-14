import { HotReload } from "./hot-reload.js";

/** @import { HotReloadCallback } from "./hot-reload.js"; */

/** @typedef {Object} Module */

/** @typedef {{ [key: string]: string }} Attributes */

/** @typedef {(newModule: Module) => Promise<void>} HotModuleReloadCallback */

export class HotModuleReload {
  /** @type {boolean} */
  cache = true;

  /** @type {HotReload} */
  #hotReload;

  /** Maps url+attributes concatenations to promises.
   * @type {Record<string, Promise<Module>>}
   */
  #moduleCache = {};

  /**
   * @param {string} importUrl
   * @param {Object} [options]
   * @param {boolean} [options.fullReloadFallback]
   * @param {boolean} [options.logging]
   * @param {"every" | "some"} [options.acceptMode]
   * @param {boolean} [options.cache]
   */
  constructor(importUrl, options) {
    this.#hotReload = new HotReload(importUrl, options);
    this.cache = options?.cache ?? this.cache;
  }

  /**
   * @overload
   * @param {string} relativePath
   * @param {HotModuleReloadCallback} callback
   * @return {void}
   */

  /**
   * @overload
   * @param {string} relativePath
   * @param {Object} attributes
   * @param {HotModuleReloadCallback} callback
   * @return {void}
   */

  /**
   * @param {string} relativePath
   * @param {HotModuleReloadCallback | Object} attributesOrCallback
   * @param {HotModuleReloadCallback} [callbackOrUndefined]
   * @return {void}
   */
  subscribe(relativePath, attributesOrCallback, callbackOrUndefined) {
    const canonicalPath =  this.#hotReload.getCanonicalUrl(relativePath);

    const attributes = typeof attributesOrCallback !== "function"
      ? attributesOrCallback
      : undefined;

    const callback = typeof attributesOrCallback === "function"
      ? attributesOrCallback
      : callbackOrUndefined;

    /** @type {HotReloadCallback} */
    const wrappedCallback = async (meta) => {
      /** @type {any} */
      const attributes = meta.attributes;
      const newModule = await this.#importModule(canonicalPath, attributes);

      return callback?.(newModule);
    };

    this.#hotReload.subscribe(relativePath, wrappedCallback, {attributes});
  }

  /**
   * @param {string} relativePath
   */
  async trigger(relativePath) {
    const canonicalPath = this.#hotReload.getCanonicalUrl(relativePath);

    // Remove all cache entries that start with the canonical path.
    this.#moduleCache = Object.fromEntries(
      Object.entries(this.#moduleCache)
        .filter(([key]) => !key.startsWith(canonicalPath))
    );

    return this.#hotReload.trigger(canonicalPath);
  }

  /**
   * @param {string} canonicalPath
   * @param {Attributes} attributes
   * @return {Promise<Module>}
   */
  async #importModule(canonicalPath, attributes) {
    const cacheKey = this.#getCacheKey(canonicalPath, attributes);
    const cachedModule = this.#moduleCache[cacheKey];

    if (this.cache && cachedModule) {
      return cachedModule;
    }

    const importPromise = new Promise(async (resolve) => {
      const cacheBuster = `?noCache=${Date.now()}`;
      const newModule = await import(
        `${canonicalPath}${cacheBuster}`,
        attributes ? {with: attributes} : undefined,
        );
      resolve(newModule);
    });


    if (this.cache) {
      const cacheKey = this.#getCacheKey(canonicalPath, attributes);
      this.#moduleCache[cacheKey] = importPromise;
    }

    return await importPromise;
  }

  /**
   * @param {string} canonicalPath
   * @param {Attributes} [attributes]
   * @return {string}
   */
  #getCacheKey(canonicalPath, attributes) {
    return `${canonicalPath}#${JSON.stringify(attributes)}`;
  }
}
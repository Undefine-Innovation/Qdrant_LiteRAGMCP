/**
 * Custom resolver that keeps ts-jest defaults but rewrites relative `.js`
 * imports from project sources (not node_modules) to their `.ts` counterparts.
 * This lets us keep runtime-friendly `.js` extensions while running tests
 * directly against the TypeScript sources.
 */
module.exports = (request, options) => {
  const resolveRequest =
    typeof options.defaultResolver === 'function'
      ? options.defaultResolver
      : undefined;

  if (!resolveRequest) {
    throw new Error('Jest defaultResolver hook is missing in resolver options.');
  }

  const isRelative = request.startsWith('./') || request.startsWith('../');
  const fromNodeModules = options.basedir.includes('node_modules');

  // Handle all relative paths with .js extensions (including deep ones)
  if (isRelative && !fromNodeModules && request.endsWith('.js')) {
    // Replace .js with .ts in the path
    const tsRequest = request.slice(0, -3) + '.ts';
    try {
      return resolveRequest(tsRequest, options);
    } catch (error) {
      // If .ts version doesn't exist, fall back to original request
      try {
        return resolveRequest(request, options);
      } catch {
        // Re-throw the original error from .ts attempt
        throw error;
      }
    }
  }

  // Handle index files without extension
  if (isRelative && !request.includes('.') && !fromNodeModules) {
    // Try to resolve as index.ts first, then index.js
    const indexTsRequest = request + '/index.ts';
    const indexJsRequest = request + '/index.js';
    
    try {
      return resolveRequest(indexTsRequest, options);
    } catch {
      try {
        return resolveRequest(indexJsRequest, options);
      } catch {
        // Fall back to original request
        return resolveRequest(request, options);
      }
    }
  }

  // Handle utils directory specifically
  if (isRelative && !fromNodeModules && request.includes('utils')) {
    // If it's just 'utils', try utils/index.ts
    if (request === '../utils' || request === './utils') {
      const utilsIndexTs = request + '/index.ts';
      try {
        return resolveRequest(utilsIndexTs, options);
      } catch {
        // Fall back to original request
        return resolveRequest(request, options);
      }
    }
    
    // If it's utils/something, try utils/something.ts
    if (request.startsWith('../utils/') || request.startsWith('./utils/')) {
      const utilsFileTs = request + '.ts';
      try {
        return resolveRequest(utilsFileTs, options);
      } catch {
        // Fall back to original request
        return resolveRequest(request, options);
      }
    }
  }

  return resolveRequest(request, options);
};
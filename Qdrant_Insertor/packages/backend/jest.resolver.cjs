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
  const isJsExtension = request.endsWith('.js');
  const fromNodeModules = options.basedir.includes('node_modules');

  if (isRelative && isJsExtension && !fromNodeModules) {
    const tsRequest = request.replace(/\.js$/u, '.ts');
    try {
      return resolveRequest(tsRequest, options);
    } catch {
      // Fall back to resolving the original request if the .ts variant is missing.
    }
  }

  return resolveRequest(request, options);
};

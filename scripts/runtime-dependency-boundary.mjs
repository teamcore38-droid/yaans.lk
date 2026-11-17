export function assertRuntimeModuleBoundary(ids) {
  for(const id of ids)if(/\/node_modules\/(?:picomatch|vite|vitest)(?:\/|$)/.test(id.replaceAll('\\','/'))){
    throw new Error('Development-only dependency entered the production browser bundle; security exception is invalid.');
  }
}

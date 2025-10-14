/**
 * Simple modular logger for the project.
 * Supports error, warn, info logging.
 * Can be extended for log levels, formatting, and output targets.
 */

export function error(...args: any[]) {
  console.error(...args);
}

export function warn(...args: any[]) {
  console.warn(...args);
}

export function info(...args: any[]) {
  console.log(...args);
}
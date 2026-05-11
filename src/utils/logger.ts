import { EventEmitter } from "node:events";

export const logEmitter = new EventEmitter();

function timePrefix(): string {
  return new Date().toISOString();
}

export function info(message: string): void {
  const line = `[${timePrefix()}] INFO  ${message}`;
  console.log(line);
  logEmitter.emit("log", { level: "info", message: message });
}

export function warn(message: string): void {
  const line = `[${timePrefix()}] WARN  ${message}`;
  console.warn(line);
  logEmitter.emit("log", { level: "warn", message: message });
}

export function error(message: string): void {
  const line = `[${timePrefix()}] ERROR ${message}`;
  console.error(line);
  logEmitter.emit("log", { level: "error", message: message });
}

export default {
  info,
  warn,
  error,
  logEmitter,
};

const { EventEmitter } = require("node:events");

const logEmitter = new EventEmitter();

function timePrefix(): string {
  return new Date().toISOString();
}

function info(message: string): void {
  const line = `[${timePrefix()}] INFO  ${message}`;
  console.log(line);
  logEmitter.emit("log", { level: "info", message: message });
}

function warn(message: string): void {
  const line = `[${timePrefix()}] WARN  ${message}`;
  console.warn(line);
  logEmitter.emit("log", { level: "warn", message: message });
}

function error(message: string): void {
  const line = `[${timePrefix()}] ERROR ${message}`;
  console.error(line);
  logEmitter.emit("log", { level: "error", message: message });
}

module.exports = {
  info,
  warn,
  error,
  logEmitter,
};


import type { ConfigResponse, DeployRequest, DeployResponse } from "./types";

const API_BASE =
  typeof window !== "undefined"
    ? localStorage.getItem("custom_api_url") ||
      (window.location.hostname.includes("cloudfront.net") 
        ? "http://localhost:4173" 
        : import.meta.env.VITE_API_URL || "")
    : import.meta.env.VITE_API_URL || "";

export function getApiUrl(path: string) {
  // Ensure the path starts with /
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, init);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }
  return data;
}

export function fetchConfig() {
  return request<ConfigResponse>(`/api/config?t=${Date.now()}`);
}

export function deploy(payload: DeployRequest) {
  return request<DeployResponse>("/api/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function stopProcess() {
  return request<{ success: boolean; killedCount: number }>("/api/stop", {
    method: "POST",
  });
}

export function fetchGameSizes() {
  return request<Record<string, number>>(`/api/game-sizes?t=${Date.now()}`);
}

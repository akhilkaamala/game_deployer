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

export function fetchSshKeys() {
  return request<{ keys: Record<string, { path: string; exists: boolean }> }>(
    "/api/ssh-keys",
  );
}

export function saveSshKey(env: string, keyPath: string) {
  return request<{ message: string; path: string }>(
    `/api/ssh-keys/${encodeURIComponent(env)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: keyPath }),
    },
  );
}

export function removeSshKey(env: string) {
  return request<{ message: string }>(
    `/api/ssh-keys/${encodeURIComponent(env)}`,
    { method: "DELETE" },
  );
}

export function browseSshKey() {
  return fetch(getApiUrl("/api/browse-key")).then(async (response) => {
    const data = (await response.json()) as {
      path?: string;
      cancelled?: boolean;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data?.error || `Browse failed: ${response.status}`);
    }
    return data;
  });
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

export function streamGameSizes(
  env: string,
  onUpdate: (folder: string, size: number, timestamp?: number) => void,
  onDone: () => void,
) {
  const url = getApiUrl(`/api/game-sizes/stream?env=${encodeURIComponent(env)}`);
  const eventSource = new EventSource(url);

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.done) {
        eventSource.close();
        onDone();
      } else if (data.folder) {
        onUpdate(data.folder, data.size, data.timestamp);
      }
    } catch (err) {
      console.error("Failed to parse SSE data", err);
    }
  };

  eventSource.onerror = (err) => {
    console.error("Game size stream error:", err);
    eventSource.close();
    onDone();
  };

  return () => eventSource.close();
}

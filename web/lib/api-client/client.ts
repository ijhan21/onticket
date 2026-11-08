import { ApiClientError, ApiResponseError } from "@/types/api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = `요청 처리에 실패했습니다. (HTTP ${response.status})`;

    try {
      const data = (await response.json()) as ApiResponseError;
      if (data && data.error) {
        errorCode = data.error.code || errorCode;
        errorMessage = data.error.message || errorMessage;
      }
    } catch {
      // JSON 파싱 실패 시 기본 상태 메시지
    }

    throw new ApiClientError(response.status, errorCode, errorMessage);
  }

  return response.json() as Promise<T>;
}

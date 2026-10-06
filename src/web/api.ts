export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let csrf: string | null = null;
export const setCsrf = (value: string | null) => {
  csrf = value;
};
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Keep this condition literal so production builds remove the demo import.
  if (import.meta.env.MODE === 'pages')
    return (await import('./demo/api')).demoApi<T>(path, options);
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
      ...options.headers,
    },
  });
  const body = await response
    .json()
    .catch(() => ({ error: 'The server returned an unexpected response.' }));
  if (!response.ok) throw new ApiError(body.error || 'The request failed.', response.status);
  return body as T;
}
export const send = (method: string, data: unknown): RequestInit => ({
  method,
  body: JSON.stringify(data),
});

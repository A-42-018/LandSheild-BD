export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: "CITIZEN" | "REVIEWER" | "OFFICER" | "ADMIN";
  /** optional mobile number (U3.2 profile) */
  phone?: string | null;
  preferred_language: string;
  /** set for an approved officer: the land office they work in */
  office?: {
    id: string;
    code: string;
    office_type: string;
    name_en: string;
    name_bn: string;
    division_en: string;
    division_bn: string;
    district_en: string;
    district_bn: string;
    upazila_en: string | null;
    upazila_bn: string | null;
  } | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: ApiUser;
}

export interface ApiClientOptions {
  baseUrl?: string;
  xhrFactory?: () => XMLHttpRequest;
  fetchImpl?: typeof fetch;
  onSession?: (session: TokenResponse | null) => void;
}

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** skip bearer + silent refresh (login/refresh/logout) */
  anonymous?: boolean;
  /** Accept header override (binary downloads) */
  accept?: string;
}

const DEFAULT_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export function createApiClient(opts: ApiClientOptions = {}) {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
  const doFetch = (...a: Parameters<typeof fetch>) => (opts.fetchImpl ?? fetch)(...a);
  let token: string | null = null;
  let refreshing: Promise<TokenResponse | null> | null = null;

  async function send(path: string, o: RequestOptions, bearer: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: o.accept ?? "application/json" };
    if (o.body !== undefined) headers["Content-Type"] = "application/json";
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    try {
      return await doFetch(`${baseUrl}${path}`, {
        method: o.method ?? (o.body !== undefined ? "POST" : "GET"),
        headers,
        body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
        credentials: "include",
      });
    } catch {
      throw new ApiError(0, "NETWORK_ERROR", "Network error");
    }
  }

  async function parse<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* empty or non-JSON body */
    }
    if (!res.ok) {
      const e = (data ?? {}) as { code?: string; message?: string; details?: unknown };
      throw new ApiError(res.status, e.code ?? "HTTP_ERROR", e.message ?? res.statusText, e.details);
    }
    return data as T;
  }

  function setSession(s: TokenResponse | null) {
    token = s?.access_token ?? null;
    opts.onSession?.(s);
  }

  /** Single-flight refresh via httpOnly cookie. Returns null if it fails. */
  function refresh(): Promise<TokenResponse | null> {
    refreshing ??= (async () => {
      try {
        const s = await parse<TokenResponse>(await send("/auth/refresh", { method: "POST", body: {} }, null));
        setSession(s);
        return s;
      } catch (e) {
        if (e instanceof ApiError && e.code === "NETWORK_ERROR") throw e;
        setSession(null);
        return null;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function request<T>(path: string, o: RequestOptions = {}): Promise<T> {
    if (o.anonymous) return parse<T>(await send(path, o, null));
    let res = await send(path, o, token);
    if (res.status === 401) {
      const s = await refresh(); // one silent refresh, one retry
      if (s) res = await send(path, o, s.access_token);
    }
    return parse<T>(res);
  }

  /** Authenticated binary GET (bearer cannot be sent by <img>/<iframe>). One silent refresh + retry. */
  async function blob(path: string): Promise<Blob> {
    const o: RequestOptions = { accept: "*/*" };
    let res = await send(path, o, token);
    if (res.status === 401) {
      const s = await refresh();
      if (s) res = await send(path, o, s.access_token);
    }
    if (!res.ok) return parse<never>(res);
    return res.blob();
  }

  /** multipart upload via XHR (fetch has no upload progress). One silent refresh + retry on 401. */
  function sendForm(path: string, form: FormData, bearer: string | null, o: UploadOptions) {
    return new Promise<{ status: number; statusText: string; text: string }>((resolve, reject) => {
      const xhr = opts.xhrFactory ? opts.xhrFactory() : new XMLHttpRequest();
      xhr.open("POST", `${baseUrl}${path}`);
      xhr.withCredentials = true;
      xhr.setRequestHeader("Accept", "application/json");
      if (bearer) xhr.setRequestHeader("Authorization", `Bearer ${bearer}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && o.onProgress) o.onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => resolve({ status: xhr.status, statusText: xhr.statusText, text: xhr.responseText });
      xhr.onerror = () => reject(new ApiError(0, "NETWORK_ERROR", "Network error"));
      xhr.onabort = () => reject(new ApiError(0, "ABORTED", "Upload aborted"));
      o.signal?.addEventListener("abort", () => xhr.abort());
      xhr.send(form);
    });
  }

  async function upload<T>(path: string, form: FormData, o: UploadOptions = {}): Promise<T> {
    let r = await sendForm(path, form, token, o);
    if (r.status === 401) {
      const s = await refresh();
      if (s) r = await sendForm(path, form, s.access_token, o);
    }
    let data: unknown = null;
    try {
      data = r.text ? JSON.parse(r.text) : null;
    } catch {
      /* non-JSON body */
    }
    if (r.status < 200 || r.status >= 300) {
      const e = (data ?? {}) as { code?: string; message?: string; details?: unknown };
      throw new ApiError(r.status, e.code ?? "HTTP_ERROR", e.message ?? r.statusText, e.details);
    }
    return data as T;
  }

  return {
    request,
    upload,
    blob,
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ?? {} }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body ?? {} }),
    del: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
    refresh,
    async login(email: string, password: string): Promise<TokenResponse> {
      const s = await request<TokenResponse>("/auth/login", { body: { email, password }, anonymous: true });
      setSession(s);
      return s;
    },
    async logout(): Promise<void> {
      try {
        await request<void>("/auth/logout", { method: "POST", body: {}, anonymous: true });
      } finally {
        setSession(null);
      }
    },
    getToken: () => token,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

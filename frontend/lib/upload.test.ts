import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "./api";

class FakeXhr {
  static instances: FakeXhr[] = [];
  static plan: Array<{ status: number; body: unknown }> = [];
  headers: Record<string, string> = {};
  upload: { onprogress: ((e: any) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  withCredentials = false;
  status = 0;
  statusText = "";
  responseText = "";
  url = "";
  constructor() {
    FakeXhr.instances.push(this);
  }
  open(_m: string, url: string) {
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  abort() {
    this.onabort?.();
  }
  send() {
    const step = FakeXhr.plan.shift()!;
    queueMicrotask(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
      this.status = step.status;
      this.responseText = JSON.stringify(step.body);
      this.onload?.();
    });
  }
}

function make(fetchImpl?: any) {
  FakeXhr.instances = [];
  return createApiClient({
    baseUrl: "http://api.test/v1",
    xhrFactory: () => new FakeXhr() as unknown as XMLHttpRequest,
    fetchImpl,
  });
}

describe("api.upload", () => {
  it("posts multipart with credentials, reports progress, parses JSON", async () => {
    FakeXhr.plan = [{ status: 201, body: { id: "d1" } }];
    const api = make();
    const onProgress = vi.fn();
    const r = await api.upload<{ id: string }>("/documents/upload", new FormData(), { onProgress });
    expect(r).toEqual({ id: "d1" });
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(FakeXhr.instances[0].url).toBe("http://api.test/v1/documents/upload");
    expect(FakeXhr.instances[0].withCredentials).toBe(true);
    expect(FakeXhr.instances[0].headers["Content-Type"]).toBeUndefined(); // browser sets the boundary
  });

  it("maps error bodies to ApiError", async () => {
    FakeXhr.plan = [{ status: 415, body: { code: "FILE_TYPE_MISMATCH", message: "bad" } }];
    const api = make();
    await expect(api.upload("/documents/upload", new FormData())).rejects.toMatchObject({
      status: 415,
      code: "FILE_TYPE_MISMATCH",
    });
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    FakeXhr.plan = [
      { status: 401, body: { code: "TOKEN_EXPIRED" } },
      { status: 201, body: { id: "d2" } },
    ];
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "new", token_type: "bearer", expires_in: 900, user: { role: "OFFICER" } }),
        { status: 200 },
      ),
    );
    const api = make(fetchImpl);
    const r = await api.upload<{ id: string }>("/documents/upload", new FormData());
    expect(r.id).toBe("d2");
    expect(FakeXhr.instances).toHaveLength(2);
    expect(FakeXhr.instances[1].headers.Authorization).toBe("Bearer new");
  });

  it("surfaces ApiError instances", async () => {
    FakeXhr.plan = [{ status: 500, body: {} }];
    await expect(make().upload("/x", new FormData())).rejects.toBeInstanceOf(ApiError);
  });
});

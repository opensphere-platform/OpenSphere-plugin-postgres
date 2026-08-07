type HostFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const FND_NS = 'opensphere-foundation';

interface HostContext {
  api?: { baseUrl?: string; fetch?: HostFetch };
}

function foundationContext(): HostContext | undefined {
  const w = window as Window & { __OPENSPHERE_HOST_CONTEXTS__?: Record<string, HostContext> };
  return w.__OPENSPHERE_HOST_CONTEXTS__?.foundation;
}

/** PostgreSQL의 인프라 쓰기·감사·DB 관리 API는 Foundation 권한 경계를 사용한다. */
export function apiBase(): string {
  return foundationContext()?.api?.baseUrl ?? '';
}

export function hostFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const mediated = foundationContext()?.api?.fetch;
  return mediated ? mediated(input, init) : fetch(input, init);
}

export function writeHeaders(): Record<string, string> {
  return { 'content-type': 'application/json' };
}

export function isAuthFail(status: number, body?: string): boolean {
  return status === 401 || /token expired|token missing|unauthorized/i.test(String(body || ''));
}

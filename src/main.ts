import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

const TAG = 'osp-foundation-postgres';

interface PluginContext {
  api?: { baseUrl?: string; fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> };
  extensions?: { manual?: { contribute?: (source: unknown) => void } };
}

export async function activate(ctx?: PluginContext): Promise<void> {
  if (!customElements.get(TAG)) {
    const application = await createApplication(appConfig);
    const element = createCustomElement(AppComponent, { injector: application.injector });
    customElements.define(TAG, element);
  }
  if (ctx?.api?.fetch && ctx.extensions?.manual?.contribute) {
    const response = await ctx.api.fetch('/manual/postgresql-operations.ko.md', { cache: 'no-store' });
    if (!response.ok) throw new Error(`PostgreSQL manual HTTP ${response.status}`);
    ctx.extensions.manual.contribute({
      sourceId: 'plugin:postgres', name: 'PostgreSQL', authorityTier: 2, language: 'ko',
      documents: [{
        id: 'postgresql-operations-ko', title: 'OpenSphere PostgreSQL 멀티 인스턴스 설치 및 운영 안내서',
        content: await response.text(), route: '/pfss/postgres', sourcePath: 'docs/postgresql-operations.ko.md',
        documentType: 'howto', tags: ['pfs', 'postgresql', 'stackgres', 'sgcluster', 'data'],
      }],
    });
  }
}

export function deactivate(): void {
  // customElements definitions are page-lifetime contracts. The Extension Host
  // removes mounted elements and contribution registrations on deactivation.
}

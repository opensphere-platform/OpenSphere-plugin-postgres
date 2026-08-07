import { Injectable, signal } from '@angular/core';
import { apiBase, hostFetch, writeHeaders } from '../api-base';

const FM_PATH = 'apis/foundation.opensphere.io/v1alpha1/foundationmodels';

export interface PostgresInstallParameters {
  instances: number;
  imageTag: string;
  namespace: string;
  storageClass: string;
  storageSize: string;
  walStorageSize?: string;
  resourceProfile: string;
  cpuRequest: string;
  memoryRequest: string;
  cpuLimit: string;
  memoryLimit: string;
  poolerEnabled: boolean;
  poolerMode: 'session' | 'transaction';
  poolerInstances: number;
  enableSuperuserAccess: boolean;
  monitoring: boolean;
  extensions: string[];
  backup: {
    enabled: boolean;
    s3Endpoint: string;
    destinationPath: string;
    secretName: string;
    retentionPolicy: string;
  };
}

@Injectable({ providedIn: 'root' })
export class FoundationRegistryService {
  readonly lastError = signal('');
  private readonly parameters = signal<Record<string, unknown>>({});

  private k(path: string): string { return `${apiBase()}/api/k8s/${path}`; }

  async refreshModels(): Promise<void> {
    try {
      const response = await hostFetch(this.k(`${FM_PATH}/data`), { cache: 'no-store' });
      if (!response.ok) return;
      const body = await response.json();
      this.parameters.set(body?.spec?.parameters ?? {});
    } catch { /* operational tabs expose their own status */ }
  }

  parametersOf(): Record<string, unknown> { return this.parameters(); }

  async configurePostgres(parameters: PostgresInstallParameters): Promise<boolean> {
    this.lastError.set('');
    const specPatch = { desiredState: 'Installed', parameters: { ...parameters, engines: { postgres: 'enabled' } } };
    try {
      const response = await hostFetch(this.k(`${FM_PATH}/data`), {
        method: 'PATCH',
        headers: { ...writeHeaders(), 'content-type': 'application/merge-patch+json' },
        body: JSON.stringify({ spec: specPatch }),
      });
      if (response.status === 404) {
        const create = await hostFetch(this.k(FM_PATH), {
          method: 'POST', headers: writeHeaders(),
          body: JSON.stringify({
            apiVersion: 'foundation.opensphere.io/v1alpha1', kind: 'FoundationModel', metadata: { name: 'data' },
            spec: { model: 'data', ...specPatch },
          }),
        });
        if (!create.ok) throw new Error(`PostgreSQL 설치 선언 생성 실패 HTTP ${create.status}`);
      } else if (!response.ok) {
        throw new Error(`PostgreSQL 설치 선언 실패 HTTP ${response.status}`);
      }
      await this.refreshModels();
      return true;
    } catch (error) {
      this.lastError.set(String((error as Error)?.message ?? error));
      return false;
    }
  }
}

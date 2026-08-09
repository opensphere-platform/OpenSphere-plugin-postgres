import { Injectable, computed, signal } from '@angular/core';
import { apiBase, hostFetch, writeHeaders } from '../../api-base';

export interface PostgresFleetCluster {
  id: string; provider: 'stackgres'; namespace: string; name: string;
  displayName: string; alias?: string; mode: 'Dedicated'; phase: string; ready: boolean;
  instances: number; readyInstances: number; postgresVersion: string; storage: string;
  plan: string; bindingSecret: string; uid: string; createdAt: string | null;
  extensions: PostgresExtensionSelection[]; extensionStatus: any[];
}

export interface PostgresExtensionSelection {
  name: string; version?: string; publisher?: string; repository?: string;
}
export interface PostgresExtensionCatalogItem extends PostgresExtensionSelection {
  license: string; abstract: string; description: string; tags: string[]; versions: string[]; channels: Record<string, string>;
}
export interface PostgresExtensionsView {
  postgresVersion: string; catalog: PostgresExtensionCatalogItem[]; desired: PostgresExtensionSelection[];
  observed: any[]; pendingRestart: boolean; refreshedAt: string;
}

export interface PostgresClaimDraft {
  name: string; alias: string; namespace: string; database: string; owner: string; plan: string;
  postgresVersion: string;
  deletionPolicy?: 'Retain' | 'Delete';
  extensions?: PostgresExtensionSelection[];
  storageSize?: string; storageClass?: string;
  profileRefs?: { instanceProfile?: string; postgresConfig?: string; poolingConfig?: string; objectStorage?: string };
}

export type PostgresProfileKind = 'instance' | 'postgres' | 'pooling' | 'objectStorage';
export interface PostgresProfile {
  kind: PostgresProfileKind;
  apiKind: 'SGInstanceProfile' | 'SGPostgresConfig' | 'SGPoolingConfig' | 'SGObjectStorage';
  name: string;
  namespace: string;
  spec: Record<string, any>;
  managed: boolean;
  claimOwned: boolean;
  consumers: string[];
  updatedAt: number;
  resourceVersion: string;
}
export interface PostgresProfileDraft {
  namespace: string;
  kind: PostgresProfileKind;
  name: string;
  spec: Record<string, any>;
}

export interface PostgresRuntime {
  version: string; major: string; patroniVersion: string; lifecycle: 'Available' | 'Deprecated' | 'Disabled'; image: string;
}
export interface PostgresRuntimeCatalog {
  name: string; provider: 'stackgres'; operatorVersion: string; defaultVersion: string; versions: PostgresRuntime[];
}

export interface ExternalBackupTarget {
  id: string;
  name: string;
  provider: string;
  vendor: string;
  endpoint: string;
  region: string;
  bucketName: string;
  pathPrefix: string;
  enabled: boolean;
  healthState: string;
  credential: { configured: boolean; version: number };
  lastTest: { status: string; at: string; errorCode?: string | null } | null;
}

@Injectable({ providedIn: 'root' })
export class PostgresFleetService {
  readonly clusters = signal<PostgresFleetCluster[]>([]);
  readonly plans = signal<any[]>([]);
  readonly claims = signal<any[]>([]);
  readonly profiles = signal<PostgresProfile[]>([]);
  readonly profilesState = signal<'idle' | 'loading' | 'ok' | 'empty' | 'error'>('idle');
  readonly profilesError = signal('');
  readonly runtimeCatalog = signal<PostgresRuntimeCatalog | null>(null);
  readonly runtimesState = signal<'idle' | 'loading' | 'ok' | 'error'>('idle');
  readonly runtimesError = signal('');
  readonly backupTargets = signal<ExternalBackupTarget[]>([]);
  readonly backupTargetsState = signal<'idle' | 'loading' | 'ok' | 'empty' | 'error'>('idle');
  readonly backupTargetsError = signal('');
  readonly operator = signal<any>(null);
  readonly operatorState = signal<'idle' | 'loading' | 'ok' | 'error'>('idle');
  readonly operatorError = signal('');
  readonly namespaces = signal<string[]>(['opensphere-foundation']);
  readonly selectedId = signal('');
  readonly extensions = signal<PostgresExtensionsView | null>(null);
  readonly extensionsState = signal<'idle' | 'loading' | 'ok' | 'error'>('idle');
  readonly extensionsError = signal('');
  readonly state = signal<'loading' | 'ok' | 'empty' | 'error'>('loading');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly selected = computed(() => this.clusters().find((cluster) => cluster.id === this.selectedId()) || this.clusters()[0] || null);

  private api(path: string): string { return `${apiBase()}${path}`; }

  async refresh(): Promise<void> {
    this.busy.set(true); this.error.set('');
    try {
      this.runtimesState.set('loading'); this.runtimesError.set('');
      const [fleet, plans, claims, namespaces, runtimes] = await Promise.all([
        hostFetch(this.api('/api/foundation/postgres/clusters'), { cache: 'no-store' }),
        hostFetch(this.api('/api/k8s/apis/catalog.opensphere.io/v1alpha1/addonplans'), { cache: 'no-store' }),
        hostFetch(this.api('/api/k8s/apis/provisioning.opensphere.io/v1beta1/postgresclaims'), { cache: 'no-store' }),
        hostFetch(this.api('/api/foundation/postgres/namespaces'), { cache: 'no-store' }),
        hostFetch(this.api('/api/foundation/postgres/runtimes'), { cache: 'no-store' }),
      ]);
      const fleetBody = await fleet.json().catch(() => ({}));
      if (!fleet.ok) throw new Error(fleetBody.error || `PostgreSQL fleet HTTP ${fleet.status}`);
      const claimsBody = claims.ok ? await claims.json() : { items: [] };
      const claimRows = (claimsBody.items || []) as any[];
      const clusterRows = ((fleetBody.clusters || []) as PostgresFleetCluster[]).map((cluster) => {
        const claim = claimRows.find((item) => {
          if (item.metadata?.namespace !== cluster.namespace) return false;
          const resourceNames = [
            item.metadata?.name,
            item.status?.clusterName,
            item.status?.resourceName,
            item.status?.clusterRef?.name,
            item.status?.resourceRef?.name,
          ].filter(Boolean);
          return resourceNames.some((name) => cluster.name === name || cluster.name.includes(String(name)));
        });
        const alias = String(claim?.metadata?.annotations?.['opensphere.io/display-name'] || '').trim();
        return alias ? { ...cluster, alias } : cluster;
      });
      this.clusters.set(clusterRows);
      if (!clusterRows.some((cluster) => cluster.id === this.selectedId()) && clusterRows[0]) {
        this.selectedId.set(clusterRows[0].id);
      }
      this.plans.set(plans.ok ? ((await plans.json()).items || []).filter((item: any) => item.spec?.capabilityRef === 'postgresql') : []);
      this.claims.set(claimRows);
      const runtimeBody = await runtimes.json().catch(() => ({}));
      if (!runtimes.ok) throw new Error(runtimeBody.error || `PostgreSQL runtime catalog HTTP ${runtimes.status}`);
      this.runtimeCatalog.set(runtimeBody.catalog as PostgresRuntimeCatalog);
      this.runtimesState.set('ok');
      if (namespaces.ok) {
        const rows: string[] = ((await namespaces.json()).namespaces || [])
          .map((item: any): string => String(item.name || ''))
          .filter((name: string) => Boolean(name));
        const available = rows.length ? rows : ['opensphere-foundation'];
        this.namespaces.set([...new Set<string>(available)]);
      }
      this.state.set(clusterRows.length ? 'ok' : 'empty');
    } catch (error: any) {
      this.error.set(error?.message || String(error)); this.state.set('error');
      if (!this.runtimeCatalog()) { this.runtimesState.set('error'); this.runtimesError.set(error?.message || String(error)); }
    } finally { this.busy.set(false); }
  }

  select(id: string): void { this.selectedId.set(id); }

  async createNamespace(name: string, reason: string): Promise<void> {
    const response = await hostFetch(this.api('/api/foundation/postgres/namespaces'), {
      method: 'POST', headers: writeHeaders(), body: JSON.stringify({ name, reason }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || body.error || `Namespace HTTP ${response.status}`);
    if (!this.namespaces().includes(name)) this.namespaces.update((rows) => [...rows, name].sort());
  }

  async createClaim(draft: PostgresClaimDraft): Promise<void> {
    const spec: any = {
      planRef: { name: draft.plan }, isolation: 'Dedicated', database: draft.database, owner: draft.owner,
      postgresVersion: draft.postgresVersion,
      deletionPolicy: draft.deletionPolicy || 'Retain',
    };
    if (draft.extensions?.length) spec.extensions = draft.extensions;
    if (draft.profileRefs && Object.values(draft.profileRefs).some(Boolean)) spec.profileRefs = draft.profileRefs;
    if (draft.storageSize || draft.storageClass) spec.storage = { size: draft.storageSize || undefined, storageClass: draft.storageClass || undefined };
    const response = await hostFetch(this.api(`/api/k8s/apis/provisioning.opensphere.io/v1beta1/namespaces/${encodeURIComponent(draft.namespace)}/postgresclaims`), {
      method: 'POST', headers: writeHeaders(), body: JSON.stringify({
        apiVersion: 'provisioning.opensphere.io/v1beta1', kind: 'PostgresClaim',
        metadata: {
          name: draft.name,
          namespace: draft.namespace,
          annotations: { 'opensphere.io/display-name': draft.alias.trim() },
        }, spec,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || body.error || `PostgresClaim HTTP ${response.status}`);
    await this.refresh();
  }

  async refreshProfiles(namespace: string): Promise<void> {
    this.profilesState.set('loading'); this.profilesError.set('');
    try {
      const response = await hostFetch(this.api(`/api/foundation/postgres/profiles?namespace=${encodeURIComponent(namespace)}`), { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Profile catalog HTTP ${response.status}`);
      const profiles = (body.profiles || []) as PostgresProfile[];
      this.profiles.set(profiles);
      this.profilesState.set(profiles.length ? 'ok' : 'empty');
    } catch (error: any) {
      this.profiles.set([]); this.profilesState.set('error'); this.profilesError.set(error?.message || String(error));
    }
  }

  async refreshExtensions(input: { cluster?: string; postgresVersion?: string }): Promise<void> {
    this.extensionsState.set('loading'); this.extensionsError.set('');
    try {
      const query = new URLSearchParams();
      if (input.cluster) query.set('cluster', input.cluster);
      if (input.postgresVersion) query.set('postgresVersion', input.postgresVersion);
      const response = await hostFetch(this.api(`/api/foundation/postgres/extensions?${query.toString()}`), { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Extension catalog HTTP ${response.status}`);
      this.extensions.set(body as PostgresExtensionsView); this.extensionsState.set('ok');
    } catch (error: any) {
      this.extensions.set(null); this.extensionsState.set('error'); this.extensionsError.set(error?.message || String(error));
    }
  }

  async previewExtensions(cluster: string, extensions: PostgresExtensionSelection[], reason: string): Promise<any> {
    return this.extensionMutation(cluster, extensions, reason, true);
  }

  async applyExtensions(cluster: string, extensions: PostgresExtensionSelection[], reason: string): Promise<any> {
    const result = await this.extensionMutation(cluster, extensions, reason, false);
    await Promise.all([this.refreshExtensions({ cluster }), this.refresh()]);
    return result;
  }

  private async extensionMutation(cluster: string, extensions: PostgresExtensionSelection[], reason: string, dryRun: boolean): Promise<any> {
    const response = await hostFetch(this.api('/api/foundation/postgres/extensions'), {
      method: 'POST', headers: writeHeaders(), body: JSON.stringify({ cluster, extensions, reason, dryRun }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Extension allocation HTTP ${response.status}`);
    return body;
  }

  async refreshBackupTargets(): Promise<void> {
    this.backupTargetsState.set('loading'); this.backupTargetsError.set('');
    try {
      const response = await hostFetch(this.api('/api/foundation/postgres/backup-targets'), { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `External backup targets HTTP ${response.status}`);
      const targets = (body.items || []) as ExternalBackupTarget[];
      this.backupTargets.set(targets);
      this.backupTargetsState.set(targets.length ? 'ok' : 'empty');
    } catch (error: any) {
      this.backupTargets.set([]); this.backupTargetsState.set('error'); this.backupTargetsError.set(error?.message || String(error));
    }
  }

  async refreshOperator(): Promise<void> {
    this.operatorState.set('loading'); this.operatorError.set('');
    try {
      const response = await hostFetch(this.api('/api/foundation/postgres/operator'), { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `StackGres Operator HTTP ${response.status}`);
      this.operator.set(body); this.operatorState.set('ok');
    } catch (error: any) {
      this.operator.set(null); this.operatorState.set('error'); this.operatorError.set(error?.message || String(error));
    }
  }

  async previewProfile(draft: PostgresProfileDraft): Promise<any> {
    return this.profileMutation('POST', { ...draft, dryRun: true });
  }

  async applyProfile(draft: PostgresProfileDraft): Promise<any> {
    const result = await this.profileMutation('POST', draft);
    await this.refreshProfiles(draft.namespace);
    return result;
  }

  async deleteProfile(namespace: string, kind: PostgresProfileKind, name: string, confirm: string): Promise<any> {
    const result = await this.profileMutation('DELETE', { namespace, kind, name, confirm });
    await this.refreshProfiles(namespace);
    return result;
  }

  private async profileMutation(method: 'POST' | 'DELETE', body: {
    namespace: string; kind: PostgresProfileKind; name: string;
    spec?: Record<string, any>; confirm?: string; dryRun?: boolean;
  }): Promise<any> {
    const namespace = String(body.namespace || '');
    const response = await hostFetch(this.api(`/api/foundation/postgres/profiles?namespace=${encodeURIComponent(namespace)}`), {
      method, headers: writeHeaders(), body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Profile catalog HTTP ${response.status}`);
    return payload;
  }
}

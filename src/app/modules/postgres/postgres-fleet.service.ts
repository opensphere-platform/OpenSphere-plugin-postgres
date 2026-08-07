import { Injectable, computed, signal } from '@angular/core';
import { apiBase, hostFetch, writeHeaders } from '../../api-base';

export interface PostgresFleetCluster {
  id: string; provider: 'stackgres'; namespace: string; name: string;
  displayName: string; mode: 'Dedicated'; phase: string; ready: boolean;
  instances: number; readyInstances: number; postgresVersion: string; storage: string;
  plan: string; bindingSecret: string; uid: string; createdAt: string | null;
}

export interface PostgresClaimDraft {
  name: string; namespace: string; database: string; owner: string; plan: string;
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
  reason: string;
}

@Injectable({ providedIn: 'root' })
export class PostgresFleetService {
  readonly clusters = signal<PostgresFleetCluster[]>([]);
  readonly plans = signal<any[]>([]);
  readonly claims = signal<any[]>([]);
  readonly profiles = signal<PostgresProfile[]>([]);
  readonly profilesState = signal<'idle' | 'loading' | 'ok' | 'empty' | 'error'>('idle');
  readonly profilesError = signal('');
  readonly operator = signal<any>(null);
  readonly operatorState = signal<'idle' | 'loading' | 'ok' | 'error'>('idle');
  readonly operatorError = signal('');
  readonly namespaces = signal<string[]>(['opensphere-foundation']);
  readonly selectedId = signal('');
  readonly state = signal<'loading' | 'ok' | 'empty' | 'error'>('loading');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly selected = computed(() => this.clusters().find((cluster) => cluster.id === this.selectedId()) || this.clusters()[0] || null);

  private api(path: string): string { return `${apiBase()}${path}`; }

  async refresh(): Promise<void> {
    this.busy.set(true); this.error.set('');
    try {
      const [fleet, plans, claims, namespaces] = await Promise.all([
        hostFetch(this.api('/api/foundation/postgres/clusters'), { cache: 'no-store' }),
        hostFetch(this.api('/api/k8s/apis/catalog.opensphere.io/v1alpha1/addonplans'), { cache: 'no-store' }),
        hostFetch(this.api('/api/k8s/apis/provisioning.opensphere.io/v1beta1/postgresclaims'), { cache: 'no-store' }),
        hostFetch(this.api('/api/foundation/postgres/namespaces'), { cache: 'no-store' }),
      ]);
      const fleetBody = await fleet.json().catch(() => ({}));
      if (!fleet.ok) throw new Error(fleetBody.error || `PostgreSQL fleet HTTP ${fleet.status}`);
      const clusterRows = (fleetBody.clusters || []) as PostgresFleetCluster[];
      this.clusters.set(clusterRows);
      if (!clusterRows.some((cluster) => cluster.id === this.selectedId()) && clusterRows[0]) {
        this.selectedId.set(clusterRows[0].id);
      }
      this.plans.set(plans.ok ? ((await plans.json()).items || []).filter((item: any) => item.spec?.capabilityRef === 'postgresql') : []);
      this.claims.set(claims.ok ? ((await claims.json()).items || []) : []);
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
      deletionPolicy: 'Retain',
    };
    if (draft.profileRefs && Object.values(draft.profileRefs).some(Boolean)) spec.profileRefs = draft.profileRefs;
    if (draft.storageSize || draft.storageClass) spec.storage = { size: draft.storageSize || undefined, storageClass: draft.storageClass || undefined };
    const response = await hostFetch(this.api(`/api/k8s/apis/provisioning.opensphere.io/v1beta1/namespaces/${encodeURIComponent(draft.namespace)}/postgresclaims`), {
      method: 'POST', headers: writeHeaders(), body: JSON.stringify({
        apiVersion: 'provisioning.opensphere.io/v1beta1', kind: 'PostgresClaim',
        metadata: { name: draft.name, namespace: draft.namespace }, spec,
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

  async deleteProfile(namespace: string, kind: PostgresProfileKind, name: string, reason: string, confirm: string): Promise<any> {
    const result = await this.profileMutation('DELETE', { namespace, kind, name, reason, confirm });
    await this.refreshProfiles(namespace);
    return result;
  }

  private async profileMutation(method: 'POST' | 'DELETE', body: {
    namespace: string; kind: PostgresProfileKind; name: string; reason: string;
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

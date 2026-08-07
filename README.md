# OpenSphere PostgreSQL Plugin

`OpenSphere-plugin-postgres` is the independent, signed PostgreSQL plugin hosted by the Platform Foundation Service Stack.

- canonical route: `/pfss/postgres`
- host: `foundation`
- custom element: `<osp-foundation-postgres>`
- engine: StackGres-only PostgreSQL Fleet
- UI owner: this repository
- governed infrastructure and database-operation API owner: Foundation

The plugin preserves the namespace-first Fleet, monitoring, lifecycle, topology, configuration, databases and roles, backups, events, claims, upgrade, documentation, and pgAdmin surfaces previously compiled into the Foundation shell.

See [docs/01-architecture.md](docs/01-architecture.md) for the ownership boundary.

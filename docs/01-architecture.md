# Architecture

`OpenSphere-plugin-postgres` is a Foundation-hosted leaf plugin. It is not a top-level shell and is not an iframe. The signed Extension Host loads its ESM entry and Foundation mounts `<osp-foundation-postgres>` at `/pfss/postgres`.

## Plugin ownership

- PostgreSQL namespace and Fleet context UI
- Overview and monitoring UI
- StackGres operator, cluster plan, topology, configuration and upgrade views
- databases, roles, backups, events and claims views
- pgAdmin Object Explorer, Data View and Query Tool
- PostgreSQL manual and runtime observability contribution

## Foundation ownership

- FoundationModel and PostgresClaim/Binding declarations
- StackGres infrastructure reconciliation
- namespace creation policy and audit
- Secret-governed credential resolution
- authenticated PostgreSQL catalog, read-query and typed object-action API
- finalizers and consumer protection

This split keeps infrastructure writes and audit at the Foundation authority boundary while making the PostgreSQL UI, package, image digest, signature, ServiceAccount and lifecycle independently releasable.

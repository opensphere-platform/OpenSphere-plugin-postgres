# PostgreSQL StackGres IA Design QA

## Sources

- Reference hierarchy: `C:/Users/cmars/AppData/Local/Temp/codex-clipboard-ee7de85c-6970-442d-91ae-44679970ca63.png`
- Baseline capture: `C:/Users/cmars/.codex/visualizations/2026/08/09/postgres-stackgres-ia-audit/01-opensphere-postgres-current.png`
- First visible icon implementation: `C:/Users/cmars/.codex/visualizations/2026/08/09/postgres-stackgres-ia-implementation/05-management-icons-restored.png`
- Header hierarchy implementation: `C:/Users/cmars/.codex/visualizations/2026/08/09/postgres-stackgres-ia-implementation/07-management-icons-header.png`
- Final deployed implementation: `C:/Users/cmars/.codex/visualizations/2026/08/09/postgres-stackgres-ia-implementation/09-management-icons-final.png`
- Header overlap report: `C:/Users/cmars/AppData/Local/Temp/codex-clipboard-7e815435-0d1e-4299-a171-6dd724b8cbaa.png`
- Final separated header implementation: `C:/Users/cmars/.codex/visualizations/2026/08/09/postgres-stackgres-ia-implementation/11-header-icons-separated-selects-220.png`

## Verification context

- Viewport: 1422 × 800 CSS pixels
- Device pixel ratio: 0.9
- Density: desktop Console, Foundation navigation expanded
- Comparison intent: adopt the StackGres control hierarchy while retaining OpenSphere's existing visual language and PostgreSQL product identity.

## Comparison history

1. The first implementation placed management actions in the header context and exceeded the visible viewport. This was a P1 layout defect. The actions were temporarily moved to the right edge of the existing operational navigation row without increasing header height.
2. The management controls initially depended only on Angular click handlers. They were changed to native deep links so every workspace has a stable route and browser fallback.
3. The icon glyphs were initially hidden by a descendant selector that also hid the Carbon icon's internal span. The selector was narrowed to the direct accessible-label child and all four Carbon icons became visible.
4. The user-directed hierarchy refinement moved fleet, catalog, creation, and operator administration above the operational tabs into the header's upper-right context. The icon row is absolutely anchored above Namespace and instance selection, while the header height remains unchanged.
5. The generic creation plus was replaced with Carbon `Data add`; the other semantics remain `List boxes`, `Catalog`, and `Settings`.
6. The final visual comparison used the StackGres hierarchy reference, the prior header capture, and the final deployed capture in one review pass.
7. A generic release-header rule overrode the management header spacing and clipped the icon row into the selectors. A higher-specificity PostgreSQL header rule now preserves the separate icon row and visible overflow.
8. Runtime tabs are now conditional: management workspaces hide them, while selecting an instance returns to its overview and restores the operational tabs.

## Final findings

- P0: none.
- P1: none.
- P2: none.
- Operational tabs: Overview, Monitoring, Topology, Database, Data Protection, Operations, Events, Documentation.
- Management workspaces: Fleet, Profile Catalog, PostgreSQL creation, Operator management.
- Creation contract: PostgreSQL major, deletion policy, storage override, StorageClass, reusable profiles, and External Channels-backed Object Storage selection.
- Direct-route verification passed for `/profiles`, `/provisioning`, `/operator`, `/fleet`, `/databases`, `/operations`, and `/events`.
- The selected runtime overview remains full-width and preserves the Namespace/instance context below the separate management icon row.
- Typography: unchanged OpenSphere header scale and label hierarchy; no new competing heading or text label was introduced.
- Spacing and layout: management actions are in the header upper-right, operational tabs remain a separate row, and no action overlaps the context controls.
- Color and tokens: inherited OpenSphere text, hover, focus, active underline, and primary-action tokens; no new palette was introduced.
- Icon fidelity: all four controls render real Carbon SVGs at 16 px; `List boxes`, `Catalog`, `Data add`, and `Settings` match their destinations.
- Context alignment: deployed DOM measurement reports both Namespace and PostgreSQL instance selects at exactly `220px` computed width.
- Vertical separation: the management icon row ends at `225.23px`; both selectors begin at `248.59px`, leaving a clear non-overlapping gap.
- Navigation state: `/profiles` reports zero runtime tab rows; selecting another PostgreSQL instance returns to `/pfss/postgres` with one runtime tab row.
- Copy: accessible names and tooltips are consistent: 전체 클러스터, 설정 카탈로그, PostgreSQL 생성, 엔진 관리.

## Result

final result: passed

The operating-state hierarchy and engine/configuration hierarchy are visibly separated, the management controls sit above the context selectors, both context fields are 220px wide, runtime tabs appear only for an instance workspace, and no unresolved P0/P1/P2 visual issue remains in the verified state.

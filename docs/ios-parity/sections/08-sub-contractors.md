# 08 — Sub contractors

iOS source: `SubcontractorsView.swift`, `SubcontractorModels.swift`.

## Access
`canManageSubcontractors`. Booking onto jobs stays on the job tiles.

## UI
YOUR SUB CONTRACTORS, search firms or trades, trade chips.
Master–detail: firm details + operatives table. Editors: name+trade required; operatives are names only (no logins). Positions: Finance, Contract Manager, Project Manager, Site Manager, Supervisor, Installer.

## Data
`organizations/{orgId}/subcontractors/{UUID}` overwrite, including `contacts[].tradeType`.

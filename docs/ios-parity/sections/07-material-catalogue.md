# 07 — Material Catalogue

iOS source: `MaterialsCatalogueFlow.swift`, `MaterialCatalogCSV.swift`, `MaterialCatalogDuplicateDetection.swift`.

## Access
Not operative; admin or manager.

## UI
CATALOGUE hero, search by name/brand/code, table grouped by category.
Editor: Name, Category (required), Brand, Product code, DEFAULT TYPE, Size, Length + M/MM. Duplicate confirm.
CSV: exact iOS header, `material_catalogue.csv` / template, 5MB / 5,000 rows. Update existing vs replace entire catalogue.

## Data
`organizations/{orgId}/materialCatalogue/{UUID}` overwrite. Empty brand → Custom; empty category → Other.

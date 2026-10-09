# 07 — Material Catalogue

iOS source: `MaterialsCatalogueFlow.swift`, `MaterialCatalogCSV.swift`, `MaterialCatalogDuplicateDetection.swift`.

## Access
Not operative; admin or manager.

## UI
CATALOGUE hero (gradient + brand/category/today stats), token search via `rankMaterialRecords` (name/brand/code/size/length; `2.5mm LS` matches `2.5mm2 … LSZH`), **category disclosure groups** when the box is empty and a ranked flat list while typing. Item cards (name, brand, code, type, size/length).
Editor: Name, Category (required), Brand, Product code, DEFAULT TYPE, Size, Length + M/MM. Duplicate confirm.
CSV: exact iOS header, `material_catalogue.csv` / template, 5MB / 5,000 rows. Update existing vs replace entire catalogue. Empty CSV does **not** wipe the catalogue.

## Data
`organizations/{orgId}/materialCatalogue/{UUID}` overwrite. Empty brand → Custom; empty category → Other.

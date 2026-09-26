-- Building LCA: Statinio gyvavimo ciklo vertinimo sistema
-- PostgreSQL schema

-- ------------------------------------------------------------------
-- Enum types
-- ------------------------------------------------------------------

CREATE TYPE building_type AS ENUM (
    'gyvenamasis',          -- Residential
    'komercinis',           -- Commercial
    'pramoninis',           -- Industrial
    'viesasis',             -- Public
    'mišrus'                -- Mixed-use
);

CREATE TYPE lifecycle_phase AS ENUM (
    'A1-A3',    -- Raw material supply, transport, manufacturing
    'A4-A5',    -- Transport to site, construction
    'B1-B7',    -- Use, maintenance, repair, replacement, refurbishment, energy, water
    'C1-C4',    -- Deconstruction, transport, waste processing, disposal
    'D'         -- Reuse, recycling, energy recovery
);

CREATE TYPE indicator_type AS ENUM (
    'GWP',      -- Global Warming Potential (kg CO2 eq.)
    'ODP',      -- Ozone Depletion Potential (kg CFC-11 eq.)
    'AP',       -- Acidification Potential (kg SO2 eq.)
    'EP',       -- Eutrophication Potential (kg PO4 eq.)
    'PENRT',    -- Primary Energy Non-Renewable Total (MJ)
    'PERT'      -- Primary Energy Renewable Total (MJ)
);

CREATE TYPE material_category AS ENUM (
    'konstrukcinis',        -- Structural
    'izoliacija',           -- Insulation
    'apdaila',              -- Finishing
    'stogo_danga',          -- Roofing
    'langai_durys',         -- Windows & doors
    'inzinerine_sistema',   -- Building services / MEP
    'pamatai',              -- Foundations
    'kita'                  -- Other
);

-- ------------------------------------------------------------------
-- Buildings
-- ------------------------------------------------------------------
CREATE TABLE buildings (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(300) NOT NULL,
    building_type       building_type NOT NULL DEFAULT 'gyvenamasis',
    address             VARCHAR(500),
    city                VARCHAR(100),
    area_m2             NUMERIC(10,2) NOT NULL,
    floors              INTEGER NOT NULL DEFAULT 1,
    construction_year   INTEGER,
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_buildings_type ON buildings(building_type);
CREATE INDEX idx_buildings_city ON buildings(city);

-- ------------------------------------------------------------------
-- Materials
-- ------------------------------------------------------------------
CREATE TABLE materials (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(300) NOT NULL,
    category        material_category NOT NULL,
    density_kg_m3   NUMERIC(10,2),
    unit            VARCHAR(20) NOT NULL DEFAULT 'kg',
    gwp_per_unit    NUMERIC(12,6),   -- kg CO2 eq. per unit
    odp_per_unit    NUMERIC(16,10),  -- kg CFC-11 eq. per unit
    ap_per_unit     NUMERIC(12,6),   -- kg SO2 eq. per unit
    ep_per_unit     NUMERIC(12,6),   -- kg PO4 eq. per unit
    penrt_per_unit  NUMERIC(12,4),   -- MJ per unit
    pert_per_unit   NUMERIC(12,4),   -- MJ per unit
    source          VARCHAR(200),    -- EPD source
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_materials_category ON materials(category);

-- ------------------------------------------------------------------
-- Building-material junction (what materials are in each building)
-- ------------------------------------------------------------------
CREATE TABLE building_materials (
    id              SERIAL PRIMARY KEY,
    building_id     INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    material_id     INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    quantity        NUMERIC(12,4) NOT NULL,
    unit            VARCHAR(20) NOT NULL DEFAULT 'kg',
    lifecycle_phase lifecycle_phase NOT NULL DEFAULT 'A1-A3',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bm_building ON building_materials(building_id);
CREATE INDEX idx_bm_material ON building_materials(material_id);
CREATE INDEX idx_bm_phase ON building_materials(lifecycle_phase);

-- ------------------------------------------------------------------
-- LCA indicators (calculated environmental impact per building)
-- ------------------------------------------------------------------
CREATE TABLE lca_indicators (
    id              SERIAL PRIMARY KEY,
    building_id     INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    indicator_type  indicator_type NOT NULL,
    lifecycle_phase lifecycle_phase NOT NULL,
    value           NUMERIC(16,6) NOT NULL,
    unit            VARCHAR(30) NOT NULL,
    calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    methodology     VARCHAR(100) DEFAULT 'EN 15978',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lca_building ON lca_indicators(building_id);
CREATE INDEX idx_lca_indicator ON lca_indicators(indicator_type);
CREATE INDEX idx_lca_phase ON lca_indicators(lifecycle_phase);
CREATE INDEX idx_lca_date ON lca_indicators(calculation_date);

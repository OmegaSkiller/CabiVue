-- A receipt line can purchase several physical packs. Preserve its original
-- quantity and prices once; never invent per-pack prices by division.
CREATE TABLE purchase_lines (id TEXT PRIMARY KEY, purchase_date TEXT, pharmacy TEXT, purchased_packs REAL, unit_price REAL, line_total REAL, currency TEXT);
INSERT INTO purchase_lines SELECT pack_id,purchase_date,pharmacy,purchased_packs,unit_price,line_total,currency FROM purchases;
CREATE TABLE pack_purchases (pack_id TEXT PRIMARY KEY REFERENCES packs(id) ON DELETE CASCADE, purchase_line_id TEXT NOT NULL REFERENCES purchase_lines(id));
INSERT INTO pack_purchases SELECT pack_id,pack_id FROM purchases;
DROP TABLE purchases;

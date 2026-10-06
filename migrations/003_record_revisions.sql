ALTER TABLE products ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE instance_revision (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
INSERT INTO instance_revision SELECT 1,COALESCE(MAX(version),0) FROM (SELECT version FROM packs UNION ALL SELECT version FROM products);
ALTER TABLE source_facts ADD COLUMN permission TEXT NOT NULL DEFAULT '';
ALTER TABLE source_facts ADD COLUMN reviewed_at TEXT;
ALTER TABLE source_facts ADD COLUMN product_version INTEGER NOT NULL DEFAULT 1;
UPDATE source_facts SET review_status='unreviewed';

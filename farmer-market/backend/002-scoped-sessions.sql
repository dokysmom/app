CREATE TABLE scoped_sessions (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, csrf_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('guest_order','farmer_order','inquiry')),
  order_id TEXT REFERENCES orders(id), group_id TEXT REFERENCES shipment_groups(id),
  inquiry_id TEXT REFERENCES inquiries(id), email TEXT,
  expires_at TEXT NOT NULL, revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK((purpose='guest_order' AND order_id IS NOT NULL AND group_id IS NULL AND inquiry_id IS NULL)
    OR (purpose='farmer_order' AND group_id IS NOT NULL AND order_id IS NULL AND inquiry_id IS NULL)
    OR (purpose='inquiry' AND inquiry_id IS NOT NULL AND order_id IS NULL AND group_id IS NULL))
) STRICT;

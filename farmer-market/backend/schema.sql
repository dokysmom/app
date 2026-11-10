-- Version 1. UTC timestamps, integer KRW amounts, foreign_keys=ON.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','disabled')),
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id), csrf_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, revoked_at TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS farmers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, person TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL, crops TEXT NOT NULL, story TEXT NOT NULL,
  photo_key TEXT, published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
  display_order INTEGER NOT NULL CHECK(display_order>0),
  is_example INTEGER NOT NULL DEFAULT 0 CHECK(is_example IN (0,1)),
  notification_email TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE IF NOT EXISTS shipping_policies (
  farmer_id TEXT PRIMARY KEY REFERENCES farmers(id),
  base_fee INTEGER NOT NULL CHECK(base_fee>=0),
  free_at INTEGER CHECK(free_at IS NULL OR free_at>0),
  rules_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(rules_json)),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0)
) STRICT;
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, farmer_id TEXT NOT NULL REFERENCES farmers(id),
  name TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('vegetable','fruit')),
  status TEXT NOT NULL CHECK(status IN ('draft','on_sale','sold_out','scheduled','archived')),
  origin TEXT NOT NULL, storage_text TEXT NOT NULL, dispatch_text TEXT NOT NULL,
  illustration_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(illustration_json)),
  sale_round INTEGER NOT NULL DEFAULT 1 CHECK(sale_round>0),
  UNIQUE(id,farmer_id)
) STRICT;
CREATE INDEX IF NOT EXISTS products_farmer ON products(farmer_id,status);
CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
  label TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>=0),
  stock INTEGER NOT NULL CHECK(stock>=0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=stock),
  UNIQUE(id,product_id)
) STRICT;
CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id),
  guest_token_hash TEXT UNIQUE, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK((user_id IS NOT NULL AND guest_token_hash IS NULL) OR (user_id IS NULL AND guest_token_hash IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX IF NOT EXISTS carts_user ON carts(user_id) WHERE user_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS cart_items (
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES variants(id), quantity INTEGER NOT NULL CHECK(quantity>0),
  PRIMARY KEY(cart_id,variant_id)
) STRICT;
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, order_number TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id), buyer_email TEXT NOT NULL,
  buyer_name TEXT NOT NULL, buyer_phone TEXT NOT NULL,
  recipient_json TEXT NOT NULL CHECK(json_valid(recipient_json)),
  status TEXT NOT NULL CHECK(status IN ('pending_payment','confirmed','partially_cancelled','cancelled','completed','expired','payment_review')),
  currency TEXT NOT NULL DEFAULT 'KRW' CHECK(currency='KRW'),
  subtotal INTEGER NOT NULL CHECK(subtotal>=0), shipping_total INTEGER NOT NULL CHECK(shipping_total>=0),
  total INTEGER NOT NULL CHECK(total=subtotal+shipping_total),
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE INDEX IF NOT EXISTS orders_owner ON orders(user_id,created_at);
CREATE TABLE IF NOT EXISTS shipment_groups (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
  farmer_id TEXT NOT NULL REFERENCES farmers(id), farmer_name_snapshot TEXT NOT NULL,
  shipping_fee INTEGER NOT NULL CHECK(shipping_fee>=0), policy_snapshot_json TEXT NOT NULL CHECK(json_valid(policy_snapshot_json)),
  status TEXT NOT NULL DEFAULT 'preparing' CHECK(status IN ('preparing','shipped','delivered','cancelled')),
  carrier TEXT, tracking_number TEXT, dispatched_at TEXT, delivered_at TEXT,
  UNIQUE(order_id,farmer_id), UNIQUE(id,farmer_id)
) STRICT;
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY, group_id TEXT NOT NULL, farmer_id TEXT NOT NULL,
  product_id TEXT NOT NULL, variant_id TEXT NOT NULL,
  name_snapshot TEXT NOT NULL, option_snapshot TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK(unit_price>=0), quantity INTEGER NOT NULL CHECK(quantity>0),
  cancelled_quantity INTEGER NOT NULL DEFAULT 0 CHECK(cancelled_quantity>=0 AND cancelled_quantity<=quantity),
  FOREIGN KEY(group_id,farmer_id) REFERENCES shipment_groups(id,farmer_id),
  FOREIGN KEY(product_id,farmer_id) REFERENCES products(id,farmer_id),
  FOREIGN KEY(variant_id,product_id) REFERENCES variants(id,product_id)
) STRICT;
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
  variant_id TEXT NOT NULL REFERENCES variants(id), quantity INTEGER NOT NULL CHECK(quantity>0),
  status TEXT NOT NULL CHECK(status IN ('held','consumed','released')),
  expires_at TEXT NOT NULL, UNIQUE(order_id,variant_id)
) STRICT;
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  provider TEXT NOT NULL, provider_key TEXT UNIQUE,
  amount INTEGER NOT NULL CHECK(amount>=0), refunded_amount INTEGER NOT NULL DEFAULT 0 CHECK(refunded_amount>=0 AND refunded_amount<=amount),
  status TEXT NOT NULL CHECK(status IN ('ready','confirming','paid','failed','partially_refunded','refunded','review')),
  verified_at TEXT
) STRICT;
CREATE TABLE IF NOT EXISTS payment_events (
  provider TEXT NOT NULL, event_id TEXT NOT NULL, payment_id TEXT REFERENCES payments(id),
  payload_hash TEXT NOT NULL, processed_at TEXT,
  PRIMARY KEY(provider,event_id)
) STRICT;
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
  payment_id TEXT NOT NULL REFERENCES payments(id), request_key TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL CHECK(amount>0),
  items_json TEXT NOT NULL CHECK(json_valid(items_json)),
  status TEXT NOT NULL CHECK(status IN ('requested','approved','processing','completed','rejected','review')),
  reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE IF NOT EXISTS access_tokens (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK(purpose IN ('verify_email','reset_password','guest_order','farmer_order','inquiry','alert_confirm','alert_unsubscribe')),
  user_id TEXT REFERENCES users(id), order_id TEXT REFERENCES orders(id),
  group_id TEXT REFERENCES shipment_groups(id), email TEXT,
  resource_id TEXT, expires_at TEXT NOT NULL, used_at TEXT, revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE INDEX IF NOT EXISTS tokens_expiry ON access_tokens(expires_at);
CREATE TABLE IF NOT EXISTS email_jobs (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL,
  recipient TEXT NOT NULL, group_id TEXT REFERENCES shipment_groups(id),
  dedupe_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','accepted','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0), available_at TEXT NOT NULL,
  lease_until TEXT, provider_message_id TEXT, last_error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE INDEX IF NOT EXISTS email_due ON email_jobs(status,available_at);
CREATE TABLE IF NOT EXISTS delivery_attempts (
  id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES email_jobs(id),
  attempt_number INTEGER NOT NULL CHECK(attempt_number>0),
  result TEXT NOT NULL CHECK(result IN ('accepted','failed','unknown')),
  error_code TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id,attempt_number)
) STRICT;
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL UNIQUE REFERENCES order_items(id),
  user_id TEXT REFERENCES users(id), author_email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), body TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)), deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
  user_id TEXT REFERENCES users(id), author_email TEXT NOT NULL, kind TEXT NOT NULL,
  body TEXT NOT NULL, is_private INTEGER NOT NULL DEFAULT 1 CHECK(is_private IN (0,1)),
  answer TEXT, answered_by TEXT REFERENCES users(id), answered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
  user_id TEXT REFERENCES users(id), email TEXT NOT NULL COLLATE NOCASE,
  kind TEXT NOT NULL CHECK(kind IN ('restock','harvest')),
  sale_round INTEGER NOT NULL CHECK(sale_round>0),
  status TEXT NOT NULL CHECK(status IN ('pending','active','sent','unsubscribed')),
  consent_version TEXT NOT NULL, confirmed_at TEXT,
  UNIQUE(product_id,email,kind,sale_round)
) STRICT;
CREATE TABLE IF NOT EXISTS business_quotes (
  id TEXT PRIMARY KEY, company TEXT NOT NULL, contact_name TEXT NOT NULL,
  email TEXT NOT NULL, phone TEXT NOT NULL, requested_items TEXT NOT NULL,
  quantity_text TEXT NOT NULL, desired_date TEXT NOT NULL, destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','reviewing','replied','closed')),
  reply TEXT, consent_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE IF NOT EXISTS content_pages (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('story','notice','faq','policy')),
  title TEXT NOT NULL, body TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)), version INTEGER NOT NULL DEFAULT 1
) STRICT;
CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), order_id TEXT REFERENCES orders(id),
  email TEXT, purpose TEXT NOT NULL, document_version TEXT NOT NULL,
  granted INTEGER NOT NULL CHECK(granted IN (0,1)), recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE IF NOT EXISTS idempotency_keys (
  scope TEXT NOT NULL, key TEXT NOT NULL, actor_hash TEXT NOT NULL,
  request_hash TEXT NOT NULL, response_json TEXT CHECK(response_json IS NULL OR json_valid(response_json)),
  status TEXT NOT NULL CHECK(status IN ('processing','completed','failed')),
  expires_at TEXT NOT NULL, PRIMARY KEY(scope,actor_hash,key)
) STRICT;
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(summary_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

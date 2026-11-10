-- QR Hub: multi-organization QR landing pages ("Digital Hub"), scan/click analytics and settings. Additive only.
-- No IP addresses or full user agents are stored in the analytics tables.
CREATE TABLE qr_organizations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text NOT NULL CONSTRAINT qr_organizations_slug_key UNIQUE
                   CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 2 AND 60),
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  category       text NOT NULL DEFAULT 'Hotel'
                   CHECK (category IN ('Hotel','Restaurant / Dining','Banquet / Weddings','Rooms','Events','Other')),
  description    text CHECK (char_length(description) <= 1000),
  description_hi text CHECK (char_length(description_hi) <= 1000),
  phone          text CHECK (char_length(phone) <= 40),
  whatsapp       text CHECK (char_length(whatsapp) <= 40),
  email          text CHECK (char_length(email) <= 254),
  address        text CHECK (char_length(address) <= 300),
  maps_url       text CHECK (maps_url ~* '^https?://' AND char_length(maps_url) <= 2000),
  website_url    text CHECK (website_url ~* '^https?://' AND char_length(website_url) <= 2000),
  review_url     text CHECK (review_url ~* '^https://' AND char_length(review_url) <= 2000),   -- Tap-One review page; NULL hides the card
  profile_image  text CHECK (char_length(profile_image) <= 2000),
  logo           text CHECK (char_length(logo) <= 2000),
  theme          jsonb NOT NULL DEFAULT '{}'::jsonb,
  wifi_ssid      text CHECK (char_length(wifi_ssid) <= 64),
  wifi_password  text CHECK (char_length(wifi_password) <= 128),
  wifi_visible   boolean NOT NULL DEFAULT false,
  qr_status      text NOT NULL DEFAULT 'draft' CHECK (qr_status IN ('active','inactive','draft')),
  status         text NOT NULL DEFAULT 'published' CHECK (status IN ('published','unpublished','archived')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE qr_links (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES qr_organizations(id) ON DELETE CASCADE,
  title            text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  title_hi         text CHECK (char_length(title_hi) <= 100),
  destination_url  text NOT NULL CHECK (destination_url ~* '^(https?://|tel:|mailto:)' AND char_length(destination_url) <= 2000),
  category         text NOT NULL DEFAULT 'Explore' CHECK (char_length(category) BETWEEN 1 AND 40),
  icon             text CHECK (char_length(icon) <= 40),
  description      text CHECK (char_length(description) <= 300),
  description_hi   text CHECK (char_length(description_hi) <= 300),
  sort_order       integer NOT NULL DEFAULT 0,
  is_featured      boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  show_from        timestamptz,
  show_until       timestamptz,
  hours            jsonb,                          -- {"open":"07:00","close":"23:00"}, Asia/Kolkata
  click_count      integer NOT NULL DEFAULT 0,
  last_clicked_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (show_from IS NULL OR show_until IS NULL OR show_until > show_from)
);
CREATE INDEX qr_links_org_sort_idx ON qr_links (organization_id, sort_order);

CREATE TABLE qr_placements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES qr_organizations(id) ON DELETE CASCADE,
  code             text NOT NULL CHECK (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(code) <= 40),
  label            text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  kind             text NOT NULL DEFAULT 'other' CHECK (kind IN ('room','table','lobby','hall','desk','other')),
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qr_placements_org_code_key UNIQUE (organization_id, code)
);

CREATE TABLE qr_offers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES qr_organizations(id) ON DELETE CASCADE,
  text             text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 300),
  text_hi          text CHECK (char_length(text_hi) <= 300),
  link_url         text CHECK (link_url ~* '^(https?://|tel:|mailto:)' AND char_length(link_url) <= 2000),
  starts_at        timestamptz,                    -- NULL = no start limit
  ends_at          timestamptz,                    -- NULL = no end limit
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX qr_offers_org_idx ON qr_offers (organization_id);

CREATE TABLE qr_visits (
  id               bigserial PRIMARY KEY,
  organization_id  uuid NOT NULL REFERENCES qr_organizations(id) ON DELETE CASCADE,
  placement_id     uuid REFERENCES qr_placements(id) ON DELETE SET NULL,
  source           text NOT NULL CHECK (source IN ('scan','direct')),
  device_type      text NOT NULL DEFAULT 'unknown',
  browser          text NOT NULL DEFAULT 'unknown',
  os               text NOT NULL DEFAULT 'unknown',
  referrer_host    text,
  visited_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX qr_visits_org_time_idx ON qr_visits (organization_id, visited_at DESC);
CREATE INDEX qr_visits_placement_idx ON qr_visits (placement_id);

CREATE TABLE qr_clicks (
  id               bigserial PRIMARY KEY,
  organization_id  uuid NOT NULL REFERENCES qr_organizations(id) ON DELETE CASCADE,
  link_id          uuid REFERENCES qr_links(id) ON DELETE CASCADE,   -- NULL for the "Rate your stay" (review) card
  is_review        boolean NOT NULL DEFAULT false,
  placement_id     uuid REFERENCES qr_placements(id) ON DELETE SET NULL,
  device_type      text NOT NULL DEFAULT 'unknown',
  browser          text NOT NULL DEFAULT 'unknown',
  referrer_host    text,
  clicked_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (is_review = (link_id IS NULL))
);
CREATE INDEX qr_clicks_org_time_idx ON qr_clicks (organization_id, clicked_at DESC);
CREATE INDEX qr_clicks_link_idx ON qr_clicks (link_id);
CREATE INDEX qr_clicks_placement_idx ON qr_clicks (placement_id);

CREATE TABLE qr_settings (
  key    text PRIMARY KEY,
  value  jsonb NOT NULL
);
INSERT INTO qr_settings (key, value) VALUES
  ('baseUrl',   '"http://localhost:5173"'),
  ('timezone',  '"Asia/Kolkata"'),
  ('posterCta', '"Scan to explore"');

-- Seed: TapMenu Grand Resort (sanitized generic demonstration data)
INSERT INTO qr_organizations
  (slug, name, category, description, phone, whatsapp, email, address, maps_url, website_url, profile_image, logo, qr_status, status)
VALUES
  ('hotel-dream-heavens', 'TapMenu Grand Resort', 'Hotel',
   'Rooms, dining, and event spaces for modern hospitality.',
   '+910000000000', '910000000000', 'contact@example.com',
   '100 Hospitality Boulevard, Metropolis',
   'https://maps.google.com', 'http://localhost:5173',
   NULL, NULL, 'active', 'published');

INSERT INTO qr_links (organization_id, title, title_hi, destination_url, category, icon, sort_order, is_featured)
SELECT o.id, v.title, v.title_hi, v.url, v.category, v.icon, v.ord, v.featured
FROM qr_organizations o,
  (VALUES
    ('Book a Stay',        'ठहरने की बुकिंग',  'http://localhost:5173/book',            'Connect', 'calendar-check', 0, true),
    ('WhatsApp',           'व्हाट्सऐप',          'https://wa.me/910000000000',                    'Connect', 'message-circle', 1, true),
    ('Call',               'कॉल करें',          'tel:+910000000000',                             'Connect', 'phone',          2, false),
    ('Instagram',          'इंस्टाग्राम',        'https://instagram.com/example',                 'Connect', 'instagram',      3, false),
    ('Directions',         'रास्ता देखें',       'https://maps.google.com',                       'Connect', 'map-pin',        4, false),
    ('Rooms',              'कमरे',              'http://localhost:5173/rooms',                   'Explore', 'bed',            5, false),
    ('Dining',             'भोजन',              'http://localhost:5173/dining',                  'Explore', 'utensils',       6, false),
    ('Weddings & Events',  'शादी और समारोह',     'http://localhost:5173/weddings-events',         'Explore', 'party-popper',   7, false),
    ('Gallery',            'गैलरी',             'http://localhost:5173/gallery',                 'Explore', 'image',          8, false)
  ) AS v(title, title_hi, url, category, icon, ord, featured)
WHERE o.slug = 'hotel-dream-heavens';

INSERT INTO qr_placements (organization_id, code, label, kind)
SELECT o.id, v.code, v.label, v.kind
FROM qr_organizations o,
  (VALUES
    ('lobby',        'Lobby standee',  'lobby'),
    ('reception',    'Reception desk', 'desk'),
    ('restaurant',   'Restaurant',     'table'),
    ('banquet-hall', 'Banquet Hall',   'hall')
  ) AS v(code, label, kind)
WHERE o.slug = 'hotel-dream-heavens';

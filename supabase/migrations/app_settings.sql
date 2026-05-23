-- ============================================================
-- App-wide settings table (key-value, JSONB)
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Admin-only read/write
CREATE POLICY "settings_admin_all" ON app_settings
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Public read-only for features the app needs to check (e.g. maintenance_mode)
CREATE POLICY "settings_public_read" ON app_settings
  FOR SELECT
  USING (key IN ('features', 'app_hours', 'weather_surcharge', 'night_surcharge'));

-- Seed defaults so the first load always has values
INSERT INTO app_settings (key, value) VALUES
  ('pricing',    '{"food":{"rows":["15000","12000","10000","9000","8000","7500","7000","6500","6000","5500"],"extra":"5000"},"delivery_pkg":{"rows":["18000","15000","12000","10000","9000","8500","8000","7500","7000","6500"],"extra":"6000"},"errand":{"rows":["20000","17000","14000","12000","11000","10000","9000","8500","8000","7500"],"extra":"7000"},"motorbike":{"rows":["10000","8000","7000","6500","6000","5500","5000","4800","4600","4500"],"extra":"4000"},"taxi":{"rows":["15000","13000","11000","10000","9500","9000","8500","8000","7500","7000"],"extra":"6500"}}'),
  ('commission', '{"defaultRate":"15","minRate":"10","maxRate":"25","driverSharePercent":"80","platformSharePercent":"20","loyaltyPointsRate":"1"}'),
  ('features',   '{"maintenance_mode":false,"new_user_register":true,"driver_register":true,"merchant_register":true,"flash_sale":true,"loyalty_program":true,"surge_pricing":false,"ride_service":true,"errand_service":true,"wallet_topup":false}'),
  ('area',       '{"centerLat":"12.6521","centerLng":"108.5073","serviceName":"Phước An, Krông Pắc, Đắk Lắk","coverageRadius":"10"}'),
  ('delivery',   '{"maxRadius":"10","rushHourMultiplier":"1.3","rainMultiplier":"1.2","minDriverRating":"4.0"}'),
  ('app_hours',  '{"open":"07:00","close":"21:00"}'),
  ('weather_surcharge', '{"enabled":false,"type":"percent","value":"20"}'),
  ('night_surcharge',   '{"enabled":false,"start":"22:00","end":"05:00","fee":"5000"}')
ON CONFLICT (key) DO NOTHING;

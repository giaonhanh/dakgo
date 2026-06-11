alter table profiles
  add column if not exists notif_settings jsonb default '{"order":true,"promo":false,"system":true,"driver":true}'::jsonb;

alter table shops
  add column if not exists notif_settings   jsonb default '{"soundNewOrder":true,"vibration":true,"orderPopup":true,"orderUpdates":true,"promotions":true,"systemAlerts":true,"weeklySummary":true}'::jsonb,
  add column if not exists privacy_settings jsonb default '{"showAddress":true,"analytics":true}'::jsonb;

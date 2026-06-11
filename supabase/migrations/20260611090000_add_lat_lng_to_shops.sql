-- Thêm cột lat, lng riêng biệt để đọc tọa độ qua REST API
-- (cột location là PostGIS geometry trả về hex WKB, không parse được qua Supabase client)
alter table shops
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- Điền dữ liệu từ cột location nếu lat/lng đang null
update shops
set
  lat = ST_Y(location::geometry),
  lng = ST_X(location::geometry)
where location is not null
  and (lat is null or lng is null);

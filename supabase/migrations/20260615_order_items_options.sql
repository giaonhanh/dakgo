-- Thêm cột options JSONB vào order_items để lưu size/topping
-- Cấu trúc: { size?: {name, price}, toppings?: [{name, price}] }

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS options JSONB;

-- subtotal field (nếu chưa có)
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS subtotal INT;

-- Tính subtotal từ price × qty cho các row đã có (nếu NULL)
UPDATE order_items SET subtotal = price * qty WHERE subtotal IS NULL;

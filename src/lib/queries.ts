export const PRODUCT_LIST_SELECT =
  "id,name,slug,unit,wholesale_price,retail_price,min_order_qty,images,category_id," +
  "category:categories(id,name,slug)," +
  "product_variants(id,size,color,color_hex,price,is_active,inventory(quantity))";

export const PRODUCT_CARD_SELECT =
  "id,name,slug,unit,wholesale_price,retail_price,min_order_qty,images,is_featured,is_active,created_at,category_id,description,cost_price," +
  "category:categories(id,name,slug)," +
  "product_variants(id,product_id,size,color,color_hex,price,is_active,sku,cost_price,inventory(variant_id,quantity,low_stock_threshold))";

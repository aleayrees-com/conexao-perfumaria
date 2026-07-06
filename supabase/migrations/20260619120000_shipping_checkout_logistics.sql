alter table public.products
  add column if not exists shipping_weight_grams integer not null default 250,
  add column if not exists shipping_height_cm integer not null default 8,
  add column if not exists shipping_width_cm integer not null default 8,
  add column if not exists shipping_length_cm integer not null default 16;

alter table public.products
  drop constraint if exists products_shipping_weight_grams_positive,
  add constraint products_shipping_weight_grams_positive
    check (shipping_weight_grams > 0),
  drop constraint if exists products_shipping_height_cm_positive,
  add constraint products_shipping_height_cm_positive
    check (shipping_height_cm > 0),
  drop constraint if exists products_shipping_width_cm_positive,
  add constraint products_shipping_width_cm_positive
    check (shipping_width_cm > 0),
  drop constraint if exists products_shipping_length_cm_positive,
  add constraint products_shipping_length_cm_positive
    check (shipping_length_cm > 0);

comment on column public.products.shipping_weight_grams is
  'Peso unitário padrão do produto para cotação logística.';
comment on column public.products.shipping_height_cm is
  'Altura unitária padrão do produto para cotação logística.';
comment on column public.products.shipping_width_cm is
  'Largura unitária padrão do produto para cotação logística.';
comment on column public.products.shipping_length_cm is
  'Comprimento unitário padrão do produto para cotação logística.';

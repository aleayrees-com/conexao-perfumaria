create table if not exists public.catalog_card_pricing_settings (
  id boolean primary key default true check (id),
  card_fee_basis_points integer not null default 701
    check (card_fee_basis_points between 0 and 9999),
  card_installment_count integer not null default 3
    check (card_installment_count > 0)
);

insert into public.catalog_card_pricing_settings (
  id,
  card_fee_basis_points,
  card_installment_count
)
values (true, 701, 3)
on conflict (id) do nothing;

alter table public.catalog_card_pricing_settings enable row level security;
revoke all on public.catalog_card_pricing_settings from public, anon, authenticated;
grant select, update on public.catalog_card_pricing_settings to service_role;

create or replace function public.validate_catalog_card_price_input(
  pix_price_cents integer,
  card_fee_basis_points integer
)
returns void
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if pix_price_cents is null or pix_price_cents < 0 then
    raise exception 'Preço PIX "%" inválido; esperado inteiro não negativo.', pix_price_cents;
  end if;

  if card_fee_basis_points is null
    or card_fee_basis_points < 0
    or card_fee_basis_points >= 10000 then
    raise exception 'Taxa "%" inválida; esperado inteiro entre 0 e 9999 pontos-base.', card_fee_basis_points;
  end if;
end;
$$;

create or replace function public.calculate_catalog_card_price_cents(
  pix_price_cents integer,
  card_fee_basis_points integer
)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  calculated_card_price_cents numeric;
begin
  perform public.validate_catalog_card_price_input(
    pix_price_cents,
    card_fee_basis_points
  );

  calculated_card_price_cents := ceil(pix_price_cents * 10000::numeric / (10000 - card_fee_basis_points));

  if calculated_card_price_cents > 2147483647 then
    raise exception 'Preço calculado "%" inválido; esperado até 2147483647 centavos.', calculated_card_price_cents;
  end if;

  return calculated_card_price_cents::integer;
end;
$$;

revoke all on function public.validate_catalog_card_price_input(integer, integer)
  from public, anon, authenticated;
revoke all on function public.calculate_catalog_card_price_cents(integer, integer)
  from public, anon, authenticated;
grant execute on function public.validate_catalog_card_price_input(integer, integer)
  to service_role;
grant execute on function public.calculate_catalog_card_price_cents(integer, integer)
  to service_role;

comment on function public.calculate_catalog_card_price_cents(integer, integer) is
  'Grosses up a PIX price so the merchant receives the same net value after a card fee.';

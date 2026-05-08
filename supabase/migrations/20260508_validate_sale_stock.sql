-- RPC para validar stock antes de procesar una venta
create or replace function public.validate_sale_stock(
    p_items jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_item record;
    v_available numeric;
    v_errors jsonb := '[]'::jsonb;
    v_error jsonb;
begin
    for v_item in select * from jsonb_to_recordset(p_items) as x(product_id bigint, requested_base_qty numeric, name text)
    loop
        -- Obtener stock actual
        select stock into v_available from products where id = v_item.product_id;
        
        if v_available is null then
            v_error := jsonb_build_object(
                'product_id', v_item.product_id,
                'product_name', v_item.name,
                'error', 'Producto no encontrado',
                'available_stock', 0,
                'missing_qty', v_item.requested_base_qty
            );
            v_errors := v_errors || v_error;
        elsif v_available < v_item.requested_base_qty then
            v_error := jsonb_build_object(
                'product_id', v_item.product_id,
                'product_name', v_item.name,
                'available_stock', v_available,
                'requested_qty', v_item.requested_base_qty,
                'missing_qty', (v_item.requested_base_qty - v_available)
            );
            v_errors := v_errors || v_error;
        end if;
    end loop;
    
    return v_errors;
end;
$$;

grant execute on function public.validate_sale_stock(jsonb) to authenticated;

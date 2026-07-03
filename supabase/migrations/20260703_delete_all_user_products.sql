-- =====================================================
-- Función para borrar todo el inventario de un usuario
-- Resuelve foreign key constraints en inventory_movements,
-- purchase_items, sale_return_items y quotation_items
-- =====================================================

-- Función principal: borrar TODOS los productos del usuario
CREATE OR REPLACE FUNCTION public.delete_all_user_products()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_product_ids BIGINT[];
    v_deleted_products INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
    END IF;

    -- Obtener IDs de productos del usuario
    SELECT array_agg(id) INTO v_product_ids
    FROM public.products WHERE user_id = v_user_id;

    IF v_product_ids IS NULL OR array_length(v_product_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', true, 'deletedCount', 0);
    END IF;

    -- Borrar dependencias en orden (sin CASCADE)
    DELETE FROM public.inventory_movements WHERE product_id = ANY(v_product_ids);
    DELETE FROM public.purchase_items WHERE product_id = ANY(v_product_ids);
    DELETE FROM public.sale_return_items WHERE product_id = ANY(v_product_ids);
    DELETE FROM public.quotation_items WHERE product_id = ANY(v_product_ids);

    -- Borrar productos
    DELETE FROM public.products WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_products = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'deletedCount', v_deleted_products);
END;
$$;

-- Función auxiliar: borrar productos por IDs específicos (para borrado individual/masivo)
CREATE OR REPLACE FUNCTION public.delete_products_by_ids(p_ids BIGINT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_deleted_products INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No autenticado');
    END IF;

    IF p_ids IS NULL OR array_length(p_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', true, 'deletedCount', 0);
    END IF;

    -- Solo borrar productos que pertenezcan al usuario (doble seguridad)
    -- Borrar dependencias en orden
    DELETE FROM public.inventory_movements
    WHERE product_id = ANY(p_ids)
    AND product_id IN (SELECT id FROM public.products WHERE user_id = v_user_id);

    DELETE FROM public.purchase_items
    WHERE product_id = ANY(p_ids)
    AND product_id IN (SELECT id FROM public.products WHERE user_id = v_user_id);

    DELETE FROM public.sale_return_items
    WHERE product_id = ANY(p_ids)
    AND product_id IN (SELECT id FROM public.products WHERE user_id = v_user_id);

    DELETE FROM public.quotation_items
    WHERE product_id = ANY(p_ids)
    AND product_id IN (SELECT id FROM public.products WHERE user_id = v_user_id);

    -- Borrar productos (solo los del usuario)
    DELETE FROM public.products
    WHERE id = ANY(p_ids) AND user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_products = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'deletedCount', v_deleted_products);
END;
$$;

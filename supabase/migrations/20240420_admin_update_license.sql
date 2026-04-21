CREATE OR REPLACE FUNCTION admin_update_license(
    p_profile_id uuid,
    p_license_type text,
    p_max_registers int
) RETURNS void AS $$
BEGIN
    -- Check if the current user is a super admin
    IF NOT is_super_admin() THEN
        RAISE EXCEPTION 'Access denied. Must be a super admin.';
    END IF;

    -- Update the profile
    UPDATE public.profiles
    SET license_type = p_license_type,
        max_registers = p_max_registers
    WHERE id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

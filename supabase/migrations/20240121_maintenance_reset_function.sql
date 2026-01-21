-- Function to safely reset the project while preserving inventory
CREATE OR REPLACE FUNCTION public.reset_project_data(
    reset_terminals BOOLEAN DEFAULT TRUE,
    reset_transactions BOOLEAN DEFAULT TRUE,
    reset_non_admin_profiles BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to bypass some RLS if needed
AS $$
DECLARE
    result JSONB;
BEGIN
    -- 1. Reset Transactions (Sales, Sessions, Cuts)
    IF reset_transactions THEN
        TRUNCATE TABLE public.sales RESTART IDENTITY CASCADE;
        TRUNCATE TABLE public.cash_sessions RESTART IDENTITY CASCADE;
        TRUNCATE TABLE public.cash_cuts RESTART IDENTITY CASCADE;
    END IF;

    -- 2. Reset Terminals (Devices)
    IF reset_terminals THEN
        TRUNCATE TABLE public.terminals RESTART IDENTITY CASCADE;
    END IF;

    -- 3. Reset Non-Admin Profiles
    IF reset_non_admin_profiles THEN
        DELETE FROM public.profiles WHERE role != 'admin';
    END IF;

    result := jsonb_build_object(
        'success', true,
        'message', 'Reset completed successfully',
        'timestamp', now()
    );

    RETURN result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', SQLERRM
    );
END;
$$;

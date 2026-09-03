-- 1. Cədvəlin yaradılması
CREATE TABLE IF NOT EXISTS public.threat_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    source_ip text NOT NULL,
    source_country text NOT NULL,
    source_lat float8 NOT NULL,
    source_lng float8 NOT NULL,
    target_country text NOT NULL,
    target_lat float8 NOT NULL,
    target_lng float8 NOT NULL,
    attack_type text NOT NULL,
    severity text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. İndekslər (Performance üçün)
CREATE INDEX IF NOT EXISTS idx_threat_events_created_at ON public.threat_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threat_events_attack_type ON public.threat_events(attack_type);
CREATE INDEX IF NOT EXISTS idx_threat_events_source_country ON public.threat_events(source_country);

-- 3. Row Level Security (RLS)
ALTER TABLE public.threat_events ENABLE ROW LEVEL SECURITY;

-- İcazə: Hər kəs oxuya bilər (SELECT), ancaq service_role xaric heç kim INSERT edə bilməz.
CREATE POLICY "Allow public read-only access"
ON public.threat_events FOR SELECT
USING (true);

-- 4. Supabase Realtime Aktivləşdirilməsi
-- Bu cədvəldə baş verən dəyişiklikləri socket vasitəsilə yayımlayacaq
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.threat_events;

-- ===========================================================================
-- 5. RPC (Remote Procedure Call) Funksiyaları
-- ===========================================================================

-- A: Günlük statistika (Bugünün toplam hücumu və ən çox görülən hücum növü)
CREATE OR REPLACE FUNCTION get_today_stats()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    total_attacks integer;
    top_attack_type text;
BEGIN
    -- Bugün olan bütün hücum sayını tap
    SELECT count(*) INTO total_attacks
    FROM public.threat_events
    WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');

    -- Ən çox rast gəlinən hücumu tap
    SELECT attack_type INTO top_attack_type
    FROM public.threat_events
    WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
    GROUP BY attack_type
    ORDER BY count(*) DESC
    LIMIT 1;

    RETURN json_build_object(
        'totalAttacks', total_attacks,
        'topAttackType', top_attack_type
    );
END;
$$;

-- B: Top source/target ölkələr
CREATE OR REPLACE FUNCTION get_top_countries()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    top_sources json;
    top_targets json;
BEGIN
    SELECT json_agg(row_to_json(t)) INTO top_sources
    FROM (
        SELECT source_country as country, count(*) as count
        FROM public.threat_events
        GROUP BY source_country
        ORDER BY count DESC
        LIMIT 5
    ) t;

    SELECT json_agg(row_to_json(t)) INTO top_targets
    FROM (
        SELECT target_country as country, count(*) as count
        FROM public.threat_events
        GROUP BY target_country
        ORDER BY count DESC
        LIMIT 5
    ) t;

    RETURN json_build_object(
        'topSources', COALESCE(top_sources, '[]'::json),
        'topTargets', COALESCE(top_targets, '[]'::json)
    );
END;
$$;

-- C: Attack Type Breakdown
CREATE OR REPLACE FUNCTION get_attack_type_breakdown()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    breakdown_data json;
BEGIN
    SELECT json_agg(row_to_json(t)) INTO breakdown_data
    FROM (
        SELECT attack_type as "attackType", count(*) as count
        FROM public.threat_events
        GROUP BY attack_type
        ORDER BY count DESC
    ) t;

    RETURN COALESCE(breakdown_data, '[]'::json);
END;
$$;

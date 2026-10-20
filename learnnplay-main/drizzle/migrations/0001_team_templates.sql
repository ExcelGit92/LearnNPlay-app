CREATE TABLE public.team_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  teams jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_templates TO authenticated;
GRANT ALL ON public.team_templates TO service_role;
ALTER TABLE public.team_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage team templates" ON public.team_templates FOR ALL TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE INDEX team_templates_org_idx ON public.team_templates(org_id);
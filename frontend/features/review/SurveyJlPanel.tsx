"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle2, Layers, XCircle } from "lucide-react";
import { ApiError } from "@/lib/api";
import { SURVEYS } from "@/lib/surveys";
import { Button, Card, Input, Select } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { fieldErrorText, toFieldErrors, type useReviewActions } from "./useReviewActions";
import type { ExtractionOut } from "./types";

const val = (data: ExtractionOut, f: string) => data.fields.find((x) => x.field === f)?.value?.trim() ?? "";
const stripZeros = (s: string) => s.trim().replace(/^0+(?=\d)/, "");

/** Check the JL against the mouza registry (GET /gis/mouzas/resolve): ok / wrong JL / cannot check. */
function useJlCheck(data: ExtractionOut, jl: string) {
  const { api } = useAuth();
  const district = val(data, "district");
  const upazila = val(data, "upazila");
  const mouza = val(data, "mouza");
  const jlNo = stripZeros(jl);
  return useQuery<"ok" | "mismatch" | "unknown", ApiError>({
    queryKey: ["jl-check", district, upazila, mouza, jlNo],
    enabled: !!(district && upazila && mouza && jlNo),
    retry: false,
    queryFn: async () => {
      const q = new URLSearchParams({ district, upazila, mouza, jl_no: jlNo });
      try {
        await api.get(`/gis/mouzas/resolve?${q}`);
        return "ok";
      } catch (e) {
        if (e instanceof ApiError && e.code === "JL_MISMATCH") return "mismatch";
        return "unknown"; // MOUZA_NOT_FOUND, outside the demo area, network: not a reason to block
      }
    },
  });
}

/** SJ7: an officer fixes the survey and JL of a khatian / porcha before it is approved and posted. */
export default function SurveyJlPanel({
  data,
  editable,
  actions,
}: {
  data: ExtractionOut;
  editable: boolean;
  actions: ReturnType<typeof useReviewActions>;
}) {
  const t = useTranslations("review");
  const ta = useTranslations("archive");
  const [survey, setSurvey] = useState(data.survey_type ?? "");
  const [jl, setJl] = useState(data.jl_no ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
    setSurvey(data.survey_type ?? "");
    setJl(data.jl_no ?? "");
  }, [data.survey_type, data.jl_no]);
  const check = useJlCheck(data, jl);
  const dirty = survey !== (data.survey_type ?? "") || stripZeros(jl) !== (data.jl_no ?? "");
  const missing = data.validation.errors.some((e) => e.field === "survey_type") && !survey;

  const save = async () => {
    setErrors([]);
    const body: { survey_type?: string; jl_no?: string } = {};
    if (survey !== (data.survey_type ?? "")) body.survey_type = survey;
    if (stripZeros(jl) !== (data.jl_no ?? "")) body.jl_no = stripZeros(jl);
    try {
      await actions.saveSurvey.mutateAsync(body);
    } catch (e) {
      const fe = toFieldErrors(e);
      setErrors(fe.length ? fe.map((x) => fieldErrorText(t as never, x)) : [t("actions.saveFailed")]);
    }
  };

  return (
    <Card title={t("surveyJl.title")} icon={<Layers />}>
      <div className="flex flex-col gap-3" data-testid="survey-jl-panel">
        <p className="text-sm text-ink-muted">{t("surveyJl.hint")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label={t("surveyJl.survey")}
            value={survey}
            onChange={(e) => setSurvey(e.target.value)}
            placeholder={t("surveyJl.pick")}
            disabled={!editable || actions.saveSurvey.isPending}
            error={missing ? t("surveyJl.surveyMissing") : undefined}
            data-testid="input-survey_type"
            options={SURVEYS.map((s) => ({ value: s, label: ta(`surveys.${s}`) }))}
          />
          <Input
            label={t("surveyJl.jl")}
            value={jl}
            onChange={(e) => setJl(e.target.value)}
            disabled={!editable || actions.saveSurvey.isPending}
            data-testid="input-jl_no"
          />
        </div>
        {check.data === "ok" && (
          <p role="status" data-testid="jl-ok" className="flex items-center gap-1 text-sm text-verified">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> {t("surveyJl.jlOk")}
          </p>
        )}
        {check.data === "mismatch" && (
          <p role="alert" data-testid="jl-mismatch" className="flex items-center gap-1 text-sm text-critical">
            <XCircle aria-hidden="true" className="h-4 w-4" /> {t("surveyJl.jlMismatch")}
          </p>
        )}
        {errors.length > 0 && (
          <p role="alert" data-testid="error-survey_jl" className="text-sm text-critical">
            {errors.join(" ")}
          </p>
        )}
        {editable && (
          <div>
            <Button size="sm" onClick={() => void save()} disabled={!dirty || !survey} loading={actions.saveSurvey.isPending} data-testid="save-survey_jl">
              {t("save")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

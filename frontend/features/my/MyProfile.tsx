"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { KeyRound, Save } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import { Button, Input, LoadingState, Select, useToast } from "@/components/ui";
import PasswordInput from "@/features/auth/PasswordInput";
import { useAuth } from "@/features/auth/AuthContext";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ApiError, type ApiUser } from "@/lib/api";
import { localDigits, normalizeDigits } from "@/lib/intl-locale";

// Same rule as the backend (schemas/me.py): 01XXXXXXXXX, optionally +880 / 880 in front.
const BD_MOBILE = /^(?:\+?880|0)1[3-9]\d{8}$/;
const cleanPhone = (v: string) => normalizeDigits(v).replace(/[\s-]/g, "");

function apiErrorKey(e: unknown): string {
  if (e instanceof ApiError && ["WRONG_PASSWORD", "PASSWORD_UNCHANGED", "RATE_LIMITED"].includes(e.code)) return e.code;
  return "generic";
}

function DetailsForm() {
  const t = useTranslations("my.profile");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { api, user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ? localDigits(user.phone, locale) : "");
  const [lang, setLang] = useState(user?.preferred_language === "en" ? "en" : user?.preferred_language === "bn" ? "bn" : locale);
  const [touched, setTouched] = useState(false);

  const nameErr = touched && !name.trim() ? t("errors.nameRequired") : undefined;
  const phoneVal = cleanPhone(phone);
  const phoneErr = touched && phoneVal && !BD_MOBILE.test(phoneVal) ? t("errors.phone") : undefined;

  const m = useMutation({
    mutationFn: (body: Record<string, string>) => api.patch<ApiUser>("/me/profile", body),
    onSuccess: (u, body) => {
      updateUser(u);
      toast("success", t("saved"));
      // only a language the user just picked moves the site; saving the name alone never does
      if (body.preferred_language && body.preferred_language !== locale) router.replace(pathname, { locale: body.preferred_language });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || (phoneVal && !BD_MOBILE.test(phoneVal))) return;
    const body: Record<string, string> = {};
    if (name.trim() !== user?.name) body.name = name.trim();
    if (phoneVal !== (user?.phone ?? "")) body.phone = phoneVal;
    if (lang !== user?.preferred_language) body.preferred_language = lang;
    if (Object.keys(body).length === 0) return toast("success", t("noChange"));
    m.mutate(body);
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="profile-details" className="glass-card flex flex-col gap-4 p-5">
      <h2 id="profile-details" className="text-heading-3 text-ink">{t("details")}</h2>
      <Input label={t("name")} value={name} onChange={(e) => setName(e.target.value)} error={nameErr} required autoComplete="name" maxLength={200} />
      <Input
        label={t("phone")}
        hint={t("phoneHint")}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={phoneErr}
        inputMode="tel"
        autoComplete="tel"
        maxLength={20}
      />
      <Select
        label={t("language")}
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        options={[
          { value: "bn", label: "বাংলা" },
          { value: "en", label: "English" },
        ]}
      />
      <div>
        <p className="text-sm font-medium text-ink">{t("email")}</p>
        <p className="text-ink">{user?.email}</p>
        <p className="text-sm text-ink-muted">{t("emailNote")}</p>
      </div>
      {m.isError && <p role="alert" className="text-sm text-critical">{t("errors.generic")} {t("errors.genericHint")}</p>}
      <Button type="submit" loading={m.isPending} icon={<Save />} className="self-start">{t("save")}</Button>
    </form>
  );
}

function PasswordForm() {
  const t = useTranslations("my.profile");
  const toast = useToast();
  const { api } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [touched, setTouched] = useState(false);

  const errs = {
    current: touched && !current ? t("errors.currentRequired") : undefined,
    next: touched && next.length < 8 ? t("errors.short") : undefined,
    again: touched && next.length >= 8 && again !== next ? t("errors.mismatch") : undefined,
  };

  const m = useMutation({
    mutationFn: () => api.post<void>("/me/password", { current_password: current, new_password: next }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setAgain("");
      setTouched(false);
      toast("success", t("changed"));
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!current || next.length < 8 || again !== next) return;
    m.mutate();
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="profile-password" className="glass-card flex flex-col gap-4 p-5">
      <h2 id="profile-password" className="text-heading-3 text-ink">{t("password")}</h2>
      <PasswordInput label={t("current")} value={current} onChange={(e) => setCurrent(e.target.value)} error={errs.current} autoComplete="current-password" required />
      <PasswordInput label={t("new")} hint={t("newHint")} value={next} onChange={(e) => setNext(e.target.value)} error={errs.next} autoComplete="new-password" required />
      <PasswordInput label={t("confirm")} value={again} onChange={(e) => setAgain(e.target.value)} error={errs.again} autoComplete="new-password" required />
      {m.isError && <p role="alert" className="text-sm text-critical">{t(`errors.${apiErrorKey(m.error)}`)}</p>}
      <Button type="submit" variant="secondary" loading={m.isPending} icon={<KeyRound />} className="self-start">{t("changePassword")}</Button>
    </form>
  );
}

/** প্রোফাইল ও নিরাপত্তা: name, mobile, language, password. */
export default function MyProfile() {
  const t = useTranslations("my.profile");
  const tn = useTranslations("my.nav");
  const { user } = useAuth();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader variant="plain" title={t("title")} purpose={t("purpose")} crumbs={[{ label: tn("dashboard"), href: "/my" }]} />
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        {/* the form starts from the signed-in user's values, so it waits for the session */}
        {user ? <DetailsForm key={user.id} /> : <LoadingState />}
        <PasswordForm />
      </div>
    </div>
  );
}

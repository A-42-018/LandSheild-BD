"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Power, RotateCcw, Search, Users } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  Badge, Button, Card, ErrorState, Input, LoadingState, Modal, Select, Table, type Column, type SortState,
} from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { formatDate } from "@/features/result/format";
import { ADMIN_PAGE_SIZE, ADMIN_ROLES, type AdminUser, type ListParams, type RoleCode, type UserDraft } from "./types";
import { useAdminUsers, useUserMutations, type UserPatch } from "./useAdmin";

const INITIAL: ListParams = { q: "", filter: "", active: "", sort: "created_at", order: "desc", page: 1 };
const EMPTY: UserDraft = { name: "", email: "", password: "", role: "CITIZEN", preferred_language: "en" };

export function userErrorKey(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "EMAIL_TAKEN") return "emailTaken";
    if (e.code === "CANNOT_CHANGE_OWN_ACCESS") return "self";
    if (e.status === 403) return "permission";
    if (e.status === 422) return "invalid";
  }
  return "generic";
}

export default function UsersPanel() {
  const t = useTranslations("admin.console.users");
  const te = useTranslations("admin.console.errors");
  const tr = useTranslations("roles");
  const tc = useTranslations("admin.console");
  const locale = useLocale();
  const { user: me } = useAuth();
  const [params, setParams] = useState<ListParams>(INITIAL);
  const [draft, setDraft] = useState<ListParams>(INITIAL);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<UserDraft>(EMPTY);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [edit, setEdit] = useState<{ name: string; role: RoleCode; is_active: boolean }>({ name: "", role: "CITIZEN", is_active: true });
  const [error, setError] = useState<string | null>(null);
  const q = useAdminUsers(params);
  const { create, update } = useUserMutations();

  const apply = (e: FormEvent) => {
    e.preventDefault();
    setParams({ ...draft, page: 1 });
  };
  const reset = () => {
    setDraft(INITIAL);
    setParams(INITIAL);
  };
  const openCreate = () => {
    setForm(EMPTY);
    setError(null);
    setCreating(true);
  };
  const openEdit = (u: AdminUser) => {
    setEdit({ name: u.name, role: u.role, is_active: u.is_active });
    setError(null);
    setEditing(u);
  };
  const formValid = form.name.trim() !== "" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()) && form.password.length >= 8;

  const submitCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!formValid) return;
    create.mutate(
      { ...form, name: form.name.trim(), email: form.email.trim() },
      { onSuccess: () => setCreating(false), onError: (err) => setError(userErrorKey(err)) },
    );
  };
  const submitEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing || edit.name.trim() === "") return;
    const patch: UserPatch = {};
    if (edit.name.trim() !== editing.name) patch.name = edit.name.trim();
    if (edit.role !== editing.role) patch.role = edit.role;
    if (edit.is_active !== editing.is_active) patch.is_active = edit.is_active;
    if (Object.keys(patch).length === 0) return setEditing(null);
    update.mutate(
      { id: editing.id, patch },
      { onSuccess: () => setEditing(null), onError: (err) => setError(userErrorKey(err)) },
    );
  };
  const toggleActive = (u: AdminUser) => {
    setError(null);
    update.mutate({ id: u.id, patch: { is_active: !u.is_active } }, { onError: (err) => setError(userErrorKey(err)) });
  };

  const columns: Column<AdminUser>[] = [
    { key: "name", header: t("cols.name"), sortable: true, className: "whitespace-nowrap", render: (u) => (<>{u.name}{u.id === me?.id && <span className="ml-2 text-xs text-ink-muted">({t("you")})</span>}</>) },
    { key: "email", header: t("cols.email"), sortable: true, className: "[overflow-wrap:anywhere]" },
    { key: "role", header: t("cols.role"), sortable: true, className: "whitespace-nowrap", render: (u) => tr(u.role) },
    {
      key: "is_active",
      header: t("cols.status"),
      render: (u) => <Badge tone={u.is_active ? "verified" : "pending"}>{u.is_active ? t("active") : t("inactive")}</Badge>,
    },
    { key: "created_at", header: t("cols.created"), sortable: true, className: "whitespace-nowrap", render: (u) => formatDate(u.created_at, locale, "—") },
    {
      key: "actions",
      header: t("cols.actions"),
      render: (u) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={<Pencil />} onClick={() => openEdit(u)} aria-label={t("editUser", { name: u.name })}>
            {t("edit")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Power />}
            disabled={u.id === me?.id || update.isPending}
            onClick={() => toggleActive(u)}
            aria-label={(u.is_active ? t("deactivateUser", { name: u.name }) : t("activateUser", { name: u.name }))}
          >
            {u.is_active ? t("deactivate") : t("activate")}
          </Button>
        </div>
      ),
    },
  ];
  const sort: SortState = { key: params.sort, dir: params.order };

  return (
    <Card title={t("title")} icon={<Users />} accent="primary">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-muted">{t("hint")}</p>
          <Button icon={<Plus />} onClick={openCreate}>{t("add")}</Button>
        </div>
        <form
          onSubmit={apply}
          role="search"
          aria-label={t("filters")}
          className="grid grid-cols-1 gap-3 glass-card p-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Input label={tc("search")} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
          <Select
            label={t("cols.role")}
            value={draft.filter}
            onChange={(e) => setDraft({ ...draft, filter: e.target.value })}
            placeholder={tc("all")}
            options={ADMIN_ROLES.map((r) => ({ value: r, label: tr(r) }))}
          />
          <Select
            label={t("cols.status")}
            value={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.value })}
            placeholder={tc("all")}
            options={[{ value: "true", label: t("active") }, { value: "false", label: t("inactive") }]}
          />
          <div className="flex items-end gap-2">
            <Button type="submit" icon={<Search />}>{tc("apply")}</Button>
            <Button type="button" variant="secondary" icon={<RotateCcw />} onClick={reset}>{tc("reset")}</Button>
          </div>
        </form>

        {error && !creating && !editing && <p role="alert" className="rounded-lg border border-critical/30 bg-critical-soft p-3 text-sm text-critical">{te(error)}</p>}

        {q.isLoading ? (
          <LoadingState />
        ) : q.isError || !q.data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <div aria-busy={q.isFetching} data-testid="users-table">
            <Table
              caption={t("title")}
              columns={columns}
              rows={q.data.items}
              rowKey={(u) => u.id}
              sort={sort}
              onSortChange={(s) => setParams((c) => ({ ...c, sort: s.key, order: s.dir, page: 1 }))}
              page={params.page}
              pageSize={ADMIN_PAGE_SIZE}
              total={q.data.total}
              onPageChange={(page) => setParams((c) => ({ ...c, page }))}
              emptyText={t("empty")}
            />
          </div>
        )}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t("addTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>{tc("cancel")}</Button>
            <Button type="submit" form="user-create-form" loading={create.isPending} disabled={!formValid}>{t("create")}</Button>
          </>
        }
      >
        <form id="user-create-form" onSubmit={submitCreate} className="flex flex-col gap-3">
          <Input label={t("cols.name")} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t("cols.email")} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label={t("password")} type="password" required hint={t("passwordHint")} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select
            label={t("cols.role")}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as RoleCode })}
            options={ADMIN_ROLES.map((r) => ({ value: r, label: tr(r) }))}
          />
          <Select
            label={t("language")}
            value={form.preferred_language}
            onChange={(e) => setForm({ ...form, preferred_language: e.target.value as "en" | "bn" })}
            options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]}
          />
          {error && <p role="alert" className="text-sm text-critical">{te(error)}</p>}
        </form>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={t("editTitle", { name: editing?.name ?? "" })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>{tc("cancel")}</Button>
            <Button type="submit" form="user-edit-form" loading={update.isPending}>{tc("save")}</Button>
          </>
        }
      >
        <form id="user-edit-form" onSubmit={submitEdit} className="flex flex-col gap-3">
          <Input label={t("cols.name")} required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <Select
            label={t("cols.role")}
            value={edit.role}
            disabled={editing?.id === me?.id}
            hint={editing?.id === me?.id ? t("selfHint") : undefined}
            onChange={(e) => setEdit({ ...edit, role: e.target.value as RoleCode })}
            options={ADMIN_ROLES.map((r) => ({ value: r, label: tr(r) }))}
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={edit.is_active}
              disabled={editing?.id === me?.id}
              onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })}
            />
            {t("activeLabel")}
          </label>
          {error && <p role="alert" className="text-sm text-critical">{te(error)}</p>}
        </form>
      </Modal>
    </Card>
  );
}

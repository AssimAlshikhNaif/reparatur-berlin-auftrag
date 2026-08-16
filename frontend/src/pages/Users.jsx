import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { UserPlus, Trash, ShieldCheck, Wrench, User, Copy } from "@phosphor-icons/react";

const inputCls = "bg-background border border-border px-3 py-2.5 text-sm rounded-lg outline-none focus:border-accent transition-colors w-full";
const labelCls = "block text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2";

const ROLE_ICON = { admin: ShieldCheck, techniker: Wrench, mitarbeiter: User };

export default function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "mitarbeiter", branch_id: "", password: "" });

  const load = async () => { const { data } = await api.get("/users"); setUsers(data); };
  useEffect(() => {
    load();
    api.get("/branches").then((r) => setBranches(r.data));
  }, []);

  const branchName = (id) => branches.find((b) => b.id === id)?.name || "—";

  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", { ...form, branch_id: form.branch_id || null });
      toast.success(t("usr.created"));
      setShowAdd(false);
      setForm({ name: "", email: "", role: "mitarbeiter", branch_id: "", password: "" });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || t("toast.error")); }
  };

  const remove = async (u) => {
    try { await api.delete(`/users/${u.id}`); toast.success(t("usr.deleted")); load(); }
    catch (err) { toast.error(err.response?.data?.detail || t("toast.error")); }
  };

  return (
    <div>
      <PageHeader label={t("usr.label")} title={t("usr.title")}>
        <button data-testid="add-user-button" onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg hover:bg-blue-600 hover:text-primary-foreground transition-colors">
          <UserPlus size={16} weight="bold" /> {t("usr.addButton")}
        </button>
      </PageHeader>

      <div className="px-6 md:px-8 py-3 border-b border-border/60">
        <p className="text-xs font-mono text-muted-foreground">{t("usr.noRegisterNote")} <span className="text-foreground">Repair2026!</span></p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="px-6 md:px-8 py-3 font-medium">{t("usr.colName")}</th>
              <th className="px-4 py-3 font-medium">{t("usr.colEmail")}</th>
              <th className="px-4 py-3 font-medium">{t("usr.colRole")}</th>
              <th className="px-4 py-3 font-medium">{t("usr.colBranch")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("usr.colAction")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const Icon = ROLE_ICON[u.role] || User;
              return (
                <tr key={u.id} data-testid={`user-row-${u.email}`} className="border-b border-border/40 hover:bg-muted transition-colors">
                  <td className="px-6 md:px-8 py-3 text-foreground whitespace-nowrap">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <Icon size={14} className={u.role === "admin" ? "text-accent" : u.role === "techniker" ? "text-amber-400" : "text-muted-foreground"} />
                      {t(`roles.${u.role}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.role === "admin" ? t("usr.allBranches") : branchName(u.branch_id)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button data-testid={`copy-user-${u.email}`} onClick={() => { navigator.clipboard?.writeText(u.email); toast.success(t("usr.copied", { email: u.email })); }}
                        className="p-1.5 border border-border rounded-lg hover:bg-muted text-muted-foreground" title={t("usr.copyEmail")}><Copy size={14} /></button>
                      {u.role !== "admin" && (
                        <button data-testid={`del-user-${u.email}`} onClick={() => remove(u)} className="p-1.5 border border-border rounded-lg hover:bg-red-950 text-red-400"><Trash size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={add} className="bg-background border border-border max-w-md w-full p-6 space-y-4">
            <h3 className="font-head font-semibold text-lg">{t("usr.addTitle")}</h3>
            <div>
              <label className={labelCls}>{t("usr.name")}</label>
              <input data-testid="user-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("usr.email")}</label>
              <input data-testid="user-email" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>{t("usr.password")}</label>
              <input data-testid="user-password" required type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t("usr.role")}</label>
                <select data-testid="user-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>
                  <option value="mitarbeiter">{t("roles.mitarbeiter")}</option>
                  <option value="techniker">{t("roles.techniker")}</option>
                  <option value="admin">{t("roles.admin")}</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>{t("usr.branch")}</label>
                <select data-testid="user-branch" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} className={inputCls}>
                  <option value="">{t("usr.branchNone")}</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button data-testid="user-save" type="submit" className="flex-1 bg-primary text-primary-foreground font-head font-semibold text-sm uppercase tracking-wider py-2.5 hover:bg-blue-600 hover:text-primary-foreground transition-colors">{t("usr.create")}</button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-6 border border-border text-muted-foreground hover:text-primary-foreground hover:bg-muted transition-colors">{t("usr.cancel")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

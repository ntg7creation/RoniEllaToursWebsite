import { useEffect, useRef, useState, type FormEvent } from "react";
import type { EditChange, EditorDocument, EditorRequest } from "@roniella/shared/admin";

export default function AdminEditor({ target, onClose, onSaved, onUnauthorized }: {
  target: EditorRequest; onClose: () => void; onSaved: () => void; onUnauthorized: () => void;
}) {
  const modal = useRef<HTMLDialogElement>(null), opener = useRef<HTMLElement | null>(null);
  const [document, setDocument] = useState<EditorDocument | null>(null), [values, setValues] = useState<string[]>([]);
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [discard, setDiscard] = useState<"close" | "reload" | null>(null);
  const [filter, setFilter] = useState('');
  const dirty = document?.fields.some((field, index) => (field.value ?? "") !== values[index]) ?? false;
  const load = async (signal?: AbortSignal) => {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/admin/editor?" + new URLSearchParams(target), { credentials: "same-origin", cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) { if ([401, 403].includes(response.status)) onUnauthorized(); throw Error(result.message); }
      setDocument(result); setValues(result.fields.map((field: { value: string | null }) => field.value ?? "")); setDiscard(null);
    } catch (error) { if (!signal?.aborted) setMessage(error instanceof Error ? error.message : "לא ניתן לטעון את התוכן כרגע."); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => {
    opener.current = window.document.activeElement as HTMLElement;
    modal.current?.showModal();
    const controller = new AbortController(); void load(controller.signal);
    return () => { controller.abort(); modal.current?.close(); if (opener.current?.isConnected) opener.current.focus(); };
  }, [target.scope, target.key]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent); return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const close = () => { if (busy) return; if (dirty) setDiscard("close"); else onClose(); };
  async function save(event: FormEvent) {
    event.preventDefault(); if (!document || busy) return;
    const changes: EditChange[] = document.fields.flatMap((field, index) => {
      if ((field.value ?? "") === values[index]) return [];
      // Nested list/table entries are strings; only optional scalar fields use null.
      const value = !field.required && !field.target.path && !values[index]?.trim() ? null : values[index]!;
      return [{ ...field.target, expected: field.value, value }];
    });
    if (!changes.length) { onClose(); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/admin/editor", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      const result = await response.json();
      if (!response.ok) { if ([401, 403].includes(response.status)) onUnauthorized(); throw Error(result.message); }
      onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "לא ניתן לשמור כרגע."); }
    finally { setBusy(false); }
  }
  return <dialog ref={modal} className="admin-editor" aria-labelledby="admin-editor-title" onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href]')].filter(element => element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <form onSubmit={save}>
      <header className="admin-editor-header"><h2 id="admin-editor-title">{document?.title ?? "עריכת תוכן"}</h2><button type="button" autoFocus onClick={close} disabled={busy}>סגירה × / Close</button></header>
      <div className="admin-editor-body">
        {loading && <p role="status">טוענים את התוכן העדכני… / Loading current content…</p>}
        {message && <p className="admin-message" role="alert">{message}</p>}
        {discard && <div className="admin-discard" role="alert"><p>יש שינויים שלא נשמרו. לבטל אותם? / Discard unsaved edits?</p><button type="button" onClick={() => discard === "reload" ? void load() : onClose()}>{discard === "reload" ? "ביטול השינויים וטעינה מחדש / Discard and reload" : "ביטול השינויים וסגירה / Discard and close"}</button><button type="button" onClick={() => setDiscard(null)}>המשך עריכה / Keep editing</button></div>}
        {!loading && document && document.fields.length > 15 && <div className="admin-field"><label htmlFor="admin-field-search">חיפוש בטקסטים / Search fields and text</label><input id="admin-field-search" type="search" value={filter} onChange={e => setFilter(e.target.value)} /></div>}
        {!loading && document?.fields.map((field, index) => <div className="admin-field" hidden={!!filter && !(field.label + ' ' + (values[index] ?? '')).includes(filter)} key={JSON.stringify(field.target)}>
          <label htmlFor={`admin-field-${index}`}>{field.label}</label>
          {field.multiline ? <textarea id={`admin-field-${index}`} value={values[index] ?? ""} required={field.required} maxLength={field.maxLength} rows={Math.min(8, Math.max(2, Math.ceil((values[index]?.length ?? 0) / 75)))} disabled={busy}
            aria-describedby={field.hint ? `admin-field-${index}-help` : undefined} onChange={event => setValues(current => current.map((value, i) => i === index ? event.target.value : value))} />
            : <input id={`admin-field-${index}`} value={values[index] ?? ""} required={field.required} maxLength={field.maxLength} disabled={busy}
              type={field.target.field === "contact_email" ? "email" : field.target.field === "contact_phone" ? "tel" : "text"}
              dir={["contact_email", "contact_phone"].includes(field.target.field) ? "ltr" : undefined}
              onChange={event => setValues(current => current.map((value, i) => i === index ? event.target.value : value))} />}
          {field.hint && <p id={`admin-field-${index}-help`} className="admin-field-hint">{field.hint}</p>}
        </div>)}
      </div>
      <footer className="admin-editor-footer"><button type="submit" disabled={busy || loading || !document}>{busy ? "שומרים… / Saving…" : "שמירת שינויים / Save changes"}</button>
        <button type="button" disabled={busy || loading} onClick={() => dirty ? setDiscard("reload") : void load()}>טעינת הגרסה העדכנית / Reload saved version</button>
        {dirty && <span>יש שינויים שלא נשמרו / Unsaved edits</span>}
      </footer>
    </form>
  </dialog>;
}

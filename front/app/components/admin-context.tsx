import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useRevalidator } from "react-router";
import type { AdminIdentity, EditorRequest, PhotoSlot } from "@roniella/shared/admin";
import type { SiteBlock, SitePage } from "@roniella/shared/site-content";
import type { WorkspaceTarget } from './admin-workspace';
const Editor = lazy(() => import("./admin-editor"));
const Workspace = lazy(() => import('./admin-workspace'));
const PhotoEditor = lazy(() => import('./admin-photo-editor'));
const AdminContext = createContext({ admin: null as AdminIdentity | null, edit: (_target: EditorRequest) => {}, manage: (_target: WorkspaceTarget) => {}, logout: () => {} });
const EditingPage = createContext<SitePage | null>(null);
export const EditingPageProvider = EditingPage.Provider;
export const BlockPositions = createContext<number[] | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [selected, setSelected] = useState<EditorRequest | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceTarget | null>(null), [version, setVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const location = useLocation(), revalidator = useRevalidator(), navigate = useNavigate();
  const channel = useRef<BroadcastChannel | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    if (!pending.current) pending.current = fetch("/admin/session", { credentials: "same-origin", cache: "no-store" })
      .then(async response => { if (response.ok) { const result = await response.json(); setAdmin(result.admin ?? null); } })
      .catch(() => { /* A transient network failure must not discard an open edit. */ })
      .finally(() => { pending.current = null; });
    return pending.current;
  }, []);
  useEffect(() => {
    void refresh();
    const focus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus);
    const timer = window.setInterval(focus, 60000);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("roniella-admin");
      channel.current.onmessage = event => { if (event.data === "logout") { setAdmin(null); setSelected(null); setWorkspace(null); } };
    }
    return () => { window.clearInterval(timer); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); channel.current?.close(); };
  }, [refresh]);
  useEffect(() => { void refresh(); setSelected(null); setWorkspace(null); }, [location.pathname, refresh]);
  // Keep the submitting form mounted until its native POST navigation completes.
  const logout = () => { channel.current?.postMessage("logout"); };
  return <AdminContext.Provider value={{ admin, edit: target => { if (admin) { setNotice(""); setSelected(target); } }, manage: target => { if (admin) setWorkspace(target); }, logout }}>
    {children}
    {workspace?.photoSlot && <Suspense fallback={<p className="admin-toast" role="status">טוענים את עורך התמונה… / Loading image editor…</p>}><PhotoEditor slot={workspace.photoSlot} onClose={()=>setWorkspace(null)} onUnauthorized={()=>setAdmin(null)} onSaved={()=>{setWorkspace(null);setNotice('התמונה נשמרה. / Photo saved.');void revalidator.revalidate();}}/></Suspense>}
    {workspace && !workspace.photoSlot && <Suspense fallback={<p className="admin-toast" role="status">טוענים את ניהול התוכן… / Loading content…</p>}><Workspace key={workspace.pageId ?? workspace.collection ?? 'trips'} target={workspace} version={version} onNavigate={setWorkspace} onClose={() => setWorkspace(null)} onUnauthorized={() => setAdmin(null)} onSaved={removedPath => {
      if (removedPath === location.pathname) { setWorkspace(null); void navigate('/'); } else void revalidator.revalidate();
    }} /></Suspense>}
    {selected && <Suspense fallback={<p className="admin-toast" role="status">פותחים את העורך… / Opening editor…</p>}>
      <Editor target={selected} onClose={() => setSelected(null)} onUnauthorized={() => setAdmin(null)} onSaved={() => {
        setSelected(null); setVersion(value => value + 1); setNotice("השינויים נשמרו. / Changes saved."); void revalidator.revalidate();
      }} />
    </Suspense>}
    {notice && <div className="admin-toast" role="status">{notice}<button type="button" aria-label="סגירת ההודעה / Dismiss" onClick={() => setNotice("")}>×</button></div>}
  </AdminContext.Provider>;
}
export function AdminManageButton({ pageId, collection, mode, guideAnchor, children, className='' }: WorkspaceTarget & { children?: ReactNode; className?:string }) {
  const { admin, manage } = useContext(AdminContext);
  return admin ? <button type="button" className={`admin-edit-button ${className}`} onClick={() => manage({ pageId, collection, mode, guideAnchor })}>{children ?? (pageId ? 'עריכת תוכן ומבנה / Edit page structure' : 'ניהול טיולים / Manage tours')}</button> : null;
}
export function AdminPhotoButton({slot,children='עריכת תמונה / Edit image'}:{slot:PhotoSlot;children?:ReactNode}){
  const {admin,manage}=useContext(AdminContext);
  return admin?<button type="button" className="admin-edit-button admin-photo-edit" onClick={()=>manage({photoSlot:slot})}>{children}</button>:null;
}
export function AdminBlockButton({ block }: { block: SiteBlock }) {
  const page = useContext(EditingPage);
  const positions = useContext(BlockPositions);
  const {admin} = useContext(AdminContext);
  if (!page || !admin) return null;
  if (block.type === 'image') return <AdminManageButton pageId={page.id}>עריכת התמונה / Edit this image</AdminManageButton>;
  let index = page.blocks.indexOf(block);
  if (index < 0) index = page.blocks.findIndex(b => 'text' in b && 'text' in block ? b.text === block.text || b.text.includes(block.text) : JSON.stringify(b) === JSON.stringify(block));
  if (positions && index >= 0) {
    index = positions[index] ?? -1;
    if (index < 0) return <AdminManageButton pageId={page.id} mode="itinerary">עריכת היום / Edit day</AdminManageButton>;
  }
  return index < 0 ? null : <AdminEditButton scope="block" contentKey={`${page.id}.${index}`}>{block.type === 'heading' ? 'עריכת הכותרת / Edit heading' : 'עריכת הקטע / Edit text block'}</AdminEditButton>;
}
export function AdminEditButton({ scope, contentKey, children = "עריכה / Edit" }: { scope: EditorRequest["scope"]; contentKey: string; children?: ReactNode }) {
  const { admin, edit, manage } = useContext(AdminContext);
  if (!admin) return null;
  return <button type="button" className="admin-edit-button" onClick={() => scope === 'trip' ? manage({pageId:contentKey,collection:'tour',mode:'schedule'}) : edit({ scope, key: contentKey })}>{children}</button>;
}
export function AdminLogout() {
  const { admin, logout } = useContext(AdminContext), location = useLocation();
  if (!admin) return null;
  return <form className="admin-navbar" method="post" action={"/admin/logout?returnTo=" + encodeURIComponent(location.pathname + location.search)} onSubmit={logout}>
    <button type="submit" className="admin-logout" title={admin.email}>התנתקות / Sign out</button>
  </form>;
}

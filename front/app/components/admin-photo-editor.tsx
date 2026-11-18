import { useEffect, useRef, useState } from 'react';
import type { PhotoSlot } from '@roniella/shared/admin';
import { MediaField, type MediaOption } from './admin-photo-picker';
type Document = { slot: PhotoSlot; title: string; mediaId: string | null; revision: string; media: MediaOption[] };
export default function AdminPhotoEditor({ slot, onClose, onSaved, onUnauthorized }: { slot: PhotoSlot; onClose: () => void; onSaved: () => void; onUnauthorized: () => void }) {
  const modal=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(null);
  const [document,setDocument]=useState<Document|null>(null),[value,setValue]=useState<string|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[discard,setDiscard]=useState<'close'|'reload'|null>(null);
  const dirty=!!document&&document.mediaId!==value;
  async function load(signal?:AbortSignal){
    setLoading(true);setMessage('');
    try {const response=await fetch('/admin/manage?'+new URLSearchParams({photoSlot:slot}),{credentials:'same-origin',cache:'no-store',signal});const result=await response.json();
      if(!response.ok){if([401,403].includes(response.status))onUnauthorized();throw Error(result.message);}setDocument(result);setValue(result.mediaId);setDiscard(null);
    }catch(error){if(!signal?.aborted)setMessage(error instanceof Error?error.message:'לא ניתן לטעון את התמונה.');}
    finally{if(!signal?.aborted)setLoading(false);}
  }
  useEffect(()=>{opener.current=window.document.activeElement as HTMLElement;modal.current?.showModal();const controller=new AbortController();void load(controller.signal);return()=>{controller.abort();modal.current?.close();if(opener.current?.isConnected)opener.current.focus();};},[slot]);
  useEffect(()=>{if(!dirty)return;const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);},[dirty]);
  const close=()=>{if(busy)return;if(dirty)setDiscard('close');else onClose();};
  async function save(){
    if(!document||busy)return;setBusy(true);setMessage('');
    try{const response=await fetch('/admin/manage',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'save_photo',slot,expectedRevision:document.revision,mediaId:value})});const result=await response.json();
      if(!response.ok){if([401,403].includes(response.status))onUnauthorized();throw Error(result.message);}onSaved();
    }catch(error){setMessage(error instanceof Error?error.message:'לא ניתן לשמור את התמונה.');}finally{setBusy(false);}
  }
  return <dialog ref={modal} className="admin-editor admin-section-photo-editor" aria-labelledby="admin-section-photo-title" onCancel={event=>{event.preventDefault();close();}}>
    <form onSubmit={event=>{event.preventDefault();void save();}}>
      <header className="admin-editor-header"><h2 id="admin-section-photo-title">{document?.title??'עריכת תמונה / Edit image'}</h2><button type="button" autoFocus disabled={busy} onClick={close}>סגירה × / Close</button></header>
      <div className="admin-editor-body">{loading&&<p role="status">טוענים את התמונה… / Loading photo…</p>}{message&&<p className="admin-message" role="alert">{message}</p>}
        {discard&&<div className="admin-discard" role="alert"><p>יש שינויים שלא נשמרו. לבטל אותם? / Discard unsaved edits?</p><button type="button" onClick={()=>discard==='close'?onClose():void load()}>ביטול השינויים והמשך / Discard and continue</button><button type="button" onClick={()=>setDiscard(null)}>המשך עריכה / Keep editing</button></div>}
        {!loading&&document&&<fieldset disabled={busy} className="admin-photo-fieldset"><legend className="visually-hidden">תמונת האזור / Section image</legend><MediaField label="תמונת האזור" value={value} media={document.media} change={setValue}/></fieldset>}
      </div>
      <footer className="admin-editor-footer"><button type="submit" disabled={busy||loading||!document}>{busy?'שומרים… / Saving…':'שמירת התמונה / Save photo'}</button><button type="button" disabled={busy||loading} onClick={()=>dirty?setDiscard('reload'):void load()}>טעינת הגרסה העדכנית / Reload saved version</button></footer>
    </form>
  </dialog>;
}

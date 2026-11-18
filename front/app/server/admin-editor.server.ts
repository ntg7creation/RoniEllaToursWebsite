import type { EditorDocument, EditorField, EditorRequest, EditTarget } from "@roniella/shared/admin";

type Row = Record<string, unknown>;
const copyLabels: Record<string, string> = { heading: "כותרת ראשית / Main heading", title: "כותרת / Heading", kicker: "כותרת מקדימה / Section introduction label", description: "תיאור / Description", body: "טקסט / Body text", intro: "פתיח / Introduction", tagline: "תיאור קצר / Short description", invitation: "משפט הזמנה / Call to action", stops: "תחנות המסלול — תחנה בכל שורה / Route stops, one per line" };

// Build ordinary labeled text fields from the fixed database read model. Editors
// never have to manipulate JSON, table names, HTML or source selectors.
export function editorDocument(request: EditorRequest, raw: Record<string, unknown>): EditorDocument {
  const fields: EditorField[] = [];
  const add = (target: EditTarget, label: string, value: unknown, required = true, multiline = true, hint?: string) => {
    if (value !== null && typeof value !== "string") throw Error("Invalid editor data");
    fields.push({ target, label, value, required, multiline, maxLength: 20000, hint });
  };
  const rowFields = (scope: EditTarget["scope"], row: Row, labels: Record<string, string>, optional: string[] = []) => {
    for (const [field, label] of Object.entries(labels)) add({ scope, key: request.key, field }, label, row[field], !optional.includes(field), !["title", "display_title", "seo_title", "contact_email", "contact_phone", "business_name"].includes(field));
  };
  const linksHint = (links: unknown) => Array.isArray(links) && links.length
    ? "שמרו את המילים המקושרות / Keep these linked words · " + links.map(link => link.text).join(" · ") : undefined;
  if (["page", "block", "trip"].includes(request.scope)) {
    const page = raw.page as Row;
    const pageKey = String(page.id);
    if (request.scope !== "block") rowFields("page", page, { title: "שם העמוד / Page name", display_title: "כותרת מוצגת / Display heading (optional)" }, ["display_title"]);
    if (request.scope === "trip") {
      rowFields("trip", raw.trip as Row, { summary: "תקציר לכרטיסי הטיול / Tour card summary", dates: "מועדים / Travel dates", duration: "משך הטיול / Duration", price: "מחיר / Price", guide: "הדרכה / Guide", status: "סטטוס הרשמה / Registration status" }, ["summary", "dates", "duration", "price", "guide", "status"]);
      return { title: `פרטי ${page.title}`, fields };
    }
    // The homepage's visible copy has contextual buttons on its actual sections.
    if (page.path !== "/" || request.scope === "block") for (const block of raw.blocks as Row[]) {
      const position = Number(block.position), prefix = `קטע / Block ${position + 1}`;
      const target = (field: string, path?: string[]): EditTarget => ({ scope: "block", key: pageKey, position, field, ...(path ? { path } : {}) });
      if (block.block_type === "heading" || block.block_type === "paragraph") {
        add(target("text"), `${prefix} — ${block.block_type === "heading" ? "כותרת / Heading" : "טקסט / Body text"}`, block.text, true, true, linksHint(block.links));
      } else if (block.block_type === "list") {
        for (const [index, item] of (block.list_items as { text: string; links: unknown[]; children: { items: string[] }[] }[]).entries()) {
          add(target("list_items", [String(index), "text"]), `${prefix} — פריט / Item ${index + 1}`, item.text, false, true, linksHint(item.links));
          for (const [child, list] of item.children.entries()) for (const [nested, text] of list.items.entries())
            add(target("list_items", [String(index), "children", String(child), "items", String(nested)]), `${prefix} — פריט / Item ${index + 1}, סעיף / Subitem ${child + 1}.${nested + 1}`, text, false);
        }
      } else if (block.block_type === "table") {
        add(target("table_caption"), `${prefix} — כותרת הטבלה / Table caption`, block.table_caption, false);
        for (const [row, cells] of (block.table_rows as { text: string; links: unknown[] }[][]).entries()) for (const [column, cell] of cells.entries())
          add(target("table_rows", [String(row), String(column), "text"]), `${prefix} — שורה / Row ${row + 1}, עמודה / Column ${column + 1}`, cell.text, false, true, linksHint(cell.links));
      }
    }
    return { title: `עריכת תוכן / Edit page · ${page.title}`, fields };
  }
  if (request.scope === "copy" || request.scope === "copy_all") {
    for (const row of raw.copy as Row[]) {
      // These old presentation overrides were replaced by shared destination/trip records.
      if (/^(?:home\.(?:china|uzbekistan)\.(?:title|body)|tour\.(?:china|uzbekistan)\.(?:title|body))$/.test(String(row.key))) continue;
      add({ scope: "copy", key: String(row.key), field: "value" }, request.scope === 'copy_all' ? `טקסט / Site copy · ${String(row.value).slice(0,70)}` : (copyLabels[String(row.slot)] ?? "טקסט / Body text"), row.value);
    }
    return { title: "עריכת תוכן באזור זה / Edit section copy", fields };
  }
  if (request.scope === "site") {
    rowFields("site", raw.site as Row, { business_name: "שם העסק / Business name", contact_phone: "טלפון / Phone", contact_email: "דוא״ל / Email", contact_address: "כתובת / Address", notice: "הודעה בראש האתר / Site notice" }, ["contact_address"]);
    return { title: "עריכת פרטי העסק / Edit business details", fields };
  }
  if (request.scope === "cards") {
    for (const row of raw.cards as Row[]) add(row.page_type === 'tour' ? { scope: 'trip', key: String(row.target_page_id), field: 'summary' } : { scope: "card", key: request.key, position: Number(row.position), field: "summary" }, `תקציר / Summary — ${row.title}`, row.editor_summary ?? row.summary, false);
    return { title: "עריכת תקצירי כרטיסים / Edit card summaries", fields };
  }
  if (request.scope === "videos") {
    for (const row of raw.videos as Row[]) for (const field of ["title", "description"]) add({ scope: "video", key: request.key, position: Number(row.position), field }, `סרטון / Video ${Number(row.position) + 1} — ${field === "title" ? "כותרת / Heading" : "תיאור / Description"}`, row[field], false);
    return { title: "עריכת טקסטי הסרטונים / Edit video text", fields };
  }
  if (request.scope === "navigation") {
    for (const row of raw.navigation as Row[]) add({ scope: "navigation", key: String(row.location), position: Number(row.position), field: "label" }, `${row.location === "header" ? "תפריט עליון / Header navigation" : "תפריט תחתון / Footer navigation"} — ${Number(row.position) + 1}`, row.label, true, false);
    return { title: "עריכת שמות בתפריטים / Edit navigation labels", fields };
  }
  if (request.scope === "gallery") {
    rowFields("gallery", raw.gallery as Row, { heading: "כותרת הגלריה / Gallery heading", introduction: "פתיח / Introduction", source_label: "שם האלבום / Album name", shuffle_label: "טקסט כפתור ערבוב התמונות / Shuffle button text", open_album_label: "טקסט הקישור לאלבום / Open album link text" });
    return { title: "עריכת הגלריה / Edit gallery copy", fields };
  }
  rowFields("media", raw.media as Row, { alt: "תיאור התמונה עבור משתמשי קורא מסך / Image alt text for screen readers" });
  return { title: "עריכת תיאור תמונה / Edit image alt text", fields };
}

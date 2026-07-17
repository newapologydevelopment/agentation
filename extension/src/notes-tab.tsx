import { useEffect, useMemo, useState } from "react";
import type { Annotation } from "agentation-src";

const STORAGE_PREFIX = "feedback-annotations-";

type StoredNote = {
  key: string;
  pathname: string;
  annotation: Annotation;
};

function loadNotes(): StoredNote[] {
  const notes: StoredNote[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const storageKey = localStorage.key(index);
      if (!storageKey?.startsWith(STORAGE_PREFIX)) continue;
      const pathname = storageKey.slice(STORAGE_PREFIX.length);
      const annotations = JSON.parse(localStorage.getItem(storageKey) || "[]") as Annotation[];
      for (const annotation of annotations) {
        notes.push({ key: `${pathname}:${annotation.id}`, pathname, annotation });
      }
    }
  } catch { /* The host may block local storage. */ }
  return notes.sort((a, b) => b.annotation.timestamp - a.annotation.timestamp);
}

function updateStoredNote(note: StoredNote, comment: string): void {
  const storageKey = `${STORAGE_PREFIX}${note.pathname}`;
  const annotations = JSON.parse(localStorage.getItem(storageKey) || "[]") as Annotation[];
  localStorage.setItem(storageKey, JSON.stringify(
    annotations.map((annotation) => annotation.id === note.annotation.id ? { ...annotation, comment } : annotation),
  ));
}

function deleteStoredNote(note: StoredNote): void {
  const storageKey = `${STORAGE_PREFIX}${note.pathname}`;
  const annotations = JSON.parse(localStorage.getItem(storageKey) || "[]") as Annotation[];
  const remaining = annotations.filter((annotation) => annotation.id !== note.annotation.id);
  if (remaining.length) localStorage.setItem(storageKey, JSON.stringify(remaining));
  else localStorage.removeItem(storageKey);
}

export function NotesTab({ version, onMutate }: { version: number; onMutate: () => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<StoredNote[]>(() => loadNotes());
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState("");

  useEffect(() => setNotes(loadNotes()), [version, open]);
  const activeNotes = useMemo(
    () => notes.filter(({ annotation }) => annotation.status !== "resolved" && annotation.status !== "dismissed"),
    [notes],
  );

  const mutate = (action: () => void) => {
    action();
    setNotes(loadNotes());
    setEditing(undefined);
    onMutate();
  };

  return (
    <aside data-feedback-toolbar className="pinpoint-notes" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      {open && (
        <section className="pinpoint-notes-panel" aria-label="All notes on this site">
          <header>
            <div><span>Feedback</span><strong>Notes on this site</strong></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close notes">×</button>
          </header>
          <div className="pinpoint-notes-list">
            {activeNotes.length === 0 ? (
              <div className="pinpoint-notes-empty">No notes yet. Use the toolbar to pin feedback.</div>
            ) : activeNotes.map((note, index) => (
              <article key={note.key}>
                <div className="pinpoint-note-meta"><b>{index + 1}</b><span>{note.annotation.element || "Page feedback"}</span><small>{note.pathname}</small></div>
                {editing === note.key ? (
                  <>
                    <textarea value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus />
                    <div className="pinpoint-note-actions">
                      <button type="button" onClick={() => setEditing(undefined)}>Cancel</button>
                      <button className="primary" type="button" disabled={!draft.trim()} onClick={() => mutate(() => updateStoredNote(note, draft.trim()))}>Save</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>{note.annotation.comment}</p>
                    <div className="pinpoint-note-actions">
                      <button type="button" onClick={() => { setEditing(note.key); setDraft(note.annotation.comment); }}>Edit</button>
                      <button className="danger" type="button" onClick={() => mutate(() => deleteStoredNote(note))}>Delete</button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
          {activeNotes.length > 1 && (
            <footer><button type="button" onClick={() => mutate(() => activeNotes.forEach(deleteStoredNote))}>Delete all notes</button></footer>
          )}
        </section>
      )}
      <button className="pinpoint-notes-tab" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>Notes</span><b>{activeNotes.length}</b>
      </button>
    </aside>
  );
}

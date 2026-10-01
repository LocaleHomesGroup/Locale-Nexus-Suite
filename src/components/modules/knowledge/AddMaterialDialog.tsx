"use client";

import * as React from "react";
import { FileText, FileUp, PlayCircle, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { CATEGORIES, type Category, type MaterialKind } from "./data";

/**
 * Add material — the mockup's header button had no handler; here it opens a
 * small form. Nothing is uploaded (static prototype): a chosen file only
 * pre-fills the title and format, and the new material lands at the top of its
 * category marked "New".
 */
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi)$/i;

function titleFromFile(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
}

export function AddMaterialDialog({
  open,
  onClose,
  defaultCategory,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  defaultCategory: Category;
  onAdd: (category: Category, title: string, kind: MaterialKind) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState<Category>(defaultCategory);
  const [kind, setKind] = React.useState<MaterialKind>("doc");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const titleId = React.useId();

  // Fresh form each time it opens, on the category being browsed.
  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setCategory(defaultCategory);
    setKind("doc");
    setFileName(null);
    setDragging(false);
  }, [open, defaultCategory]);

  const takeFile = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    if (VIDEO_EXT.test(file.name) || file.type.startsWith("video/")) setKind("video");
    setTitle((t) => (t.trim() ? t : titleFromFile(file.name)));
  };

  const canAdd = title.trim().length > 0;
  const submit = () => {
    if (!canAdd) return;
    onAdd(category, title.trim(), kind);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add material"
      icon={Upload}
      description="It goes to the top of its category, marked New, and Jarvis can answer from it straight away."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canAdd}>
            <Upload /> Add material
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Title" htmlFor={titleId}>
          <Input
            id={titleId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Resolving a sync conflict"
            data-autofocus
          />
        </Field>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            File <span className="font-normal text-subtle-foreground">· optional</span>
          </p>
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp4,.mov,.m4v,.webm"
            onChange={(e) => takeFile(e.target.files?.[0])}
          />
          {fileName ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-canvas px-3 py-2.5">
              {kind === "video" ? (
                <PlayCircle className="size-4 shrink-0 text-haven-700 dark:text-haven-300" aria-hidden />
              ) : (
                <FileText className="size-4 shrink-0 text-haven-700 dark:text-haven-300" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{fileName}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Remove file"
                onClick={() => {
                  setFileName(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                <X />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                takeFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                dragging
                  ? "border-haven-400 bg-haven-50 dark:border-haven-600 dark:bg-haven-950/40"
                  : "border-input hover:border-haven-300 hover:bg-haven-50/60 dark:hover:border-haven-800 dark:hover:bg-haven-950/25",
              )}
            >
              <FileUp className="size-5 text-subtle-foreground" aria-hidden />
              <span className="text-xs font-medium">Drop a file or choose one</span>
              <span className="text-[11px] text-subtle-foreground">PDF, Word, PowerPoint, Excel or video</span>
            </button>
          )}
        </div>

        <ChipGroup
          label="Category"
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((c) => ({ value: c.name, label: c.name, icon: c.icon }))}
        />

        <ChipGroup
          label="Format"
          value={kind}
          onChange={setKind}
          options={[
            { value: "doc", label: "Document", icon: FileText },
            { value: "video", label: "Video", icon: PlayCircle },
          ]}
        />
        {/* Enter in the title field submits. */}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden />
      </form>
    </Dialog>
  );
}

function ChipGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon: React.ComponentType<{ className?: string }> }[];
}) {
  const labelId = React.useId();
  return (
    <div className="space-y-1.5">
      <Label id={labelId}>{label}</Label>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const checked = o.value === value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(o.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                checked
                  ? "border-haven-400 bg-haven-50 text-haven-900 dark:border-haven-600 dark:bg-haven-950/50 dark:text-haven-100"
                  : "border-border bg-card text-muted-foreground hover:border-haven-300 hover:text-foreground dark:bg-white/[0.03] dark:hover:border-haven-800",
              )}
            >
              <Icon className="size-3" aria-hidden />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

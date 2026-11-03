"use client";
import * as React from "react";
import { Check, Plus, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/*
  A category picker whose presets are suggestions, not the whole world.

  This used to offer the preset list and nothing else. The presets are God's
  Chai's supply cupboard — Chai & Tea, Dairy & Milk, Spices, Syrups & Flavors —
  so a bakery could not file flour anywhere at all. Not "had to pick something
  approximate": there was no way to enter a category the list did not already
  contain, and the field is required.

  So the list stays as a head start and "Add a category…" opens a text box.
  Whatever is typed becomes the value immediately; nothing has to be configured
  first, and the six places that use this — ingredients, recipes, invoices and
  invoice lines — all get it at once.
*/

// Cannot collide with a real category: Select values are compared by string,
// and a business that genuinely names a category this deserves what it gets.
const ADD_NEW = "__add_new_category__";

export function CategorySelect({
  options,
  value,
  onValueChange,
  name,
  id,
  defaultValue,
  placeholder = "Pick a category",
}: {
  options: readonly string[];
  value?: string;
  onValueChange?: (v: string) => void;
  name?: string;
  id?: string;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  const [internal, setInternal] = React.useState<string>(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handle = (v: string) => {
    if (v === ADD_NEW) {
      setDraft("");
      setAdding(true);
      return;
    }
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  };

  const commit = () => {
    const next = draft.trim();
    // An empty box is a cancel, not a category named "".
    if (!next) {
      setAdding(false);
      return;
    }
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
    setAdding(false);
  };

  React.useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  // Anything already saved that is not a preset stays selectable, so an
  // existing value is never silently replaced by one from the list.
  const hasCustom = !!current && !options.includes(current);

  if (adding) {
    return (
      <>
        {name && <input type="hidden" name={name} value={current ?? ""} />}
        <div className="flex items-center gap-1.5">
          <Input
            ref={inputRef}
            id={id}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // This lives inside forms; Enter must add the category, not
                // submit the half-filled form around it.
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            onBlur={commit}
            placeholder="New category name"
            aria-label="New category name"
            maxLength={60}
          />
          <Button type="button" size="icon" variant="ghost" onMouseDown={(e) => e.preventDefault()}
            onClick={commit} aria-label="Save category">
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onMouseDown={(e) => e.preventDefault()}
            onClick={() => setAdding(false)} aria-label="Cancel">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={current ?? ""} />}
      <Select value={current || undefined} onValueChange={handle}>
        <SelectTrigger id={id}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
          {hasCustom && <SelectItem value={current!}>{current}</SelectItem>}
          <SelectItem value={ADD_NEW}>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add a category…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

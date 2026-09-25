import { Link, type LinkProps } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Field, FormSheet } from "@/components/form-sheet";
import { UserAvatar } from "@/components/user-avatar";
import { api, type ClientContact, type CrewInput } from "@/lib/api";
import { keys, useSave } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { CrewMember, Member } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Status: are we on track, and what is blocked or late?
// ---------------------------------------------------------------------------

export type Issue = {
  key: string;
  /** blocked = status-blocked colours; attention = orange (late, over budget); check = neutral. */
  tone: "blocked" | "attention" | "check";
  title: string;
  detail?: string;
  link?: Pick<LinkProps, "to" | "params" | "search" | "hash">;
  onClick?: () => void;
};

const issueIcon = { blocked: "block", attention: "schedule", check: "rule" } as const;
const issueIconClass = {
  blocked: "bg-status-blocked-container text-on-status-blocked-container",
  attention: "bg-attention-container text-attention",
  check: "bg-surface-container-high text-on-surface-variant",
} as const;

export function StatusCard({
  onTrack,
  headline,
  note,
  progress,
  currentStage,
  facts,
  issues,
}: {
  onTrack: boolean;
  headline: string;
  note?: string;
  progress: number;
  currentStage: string | null;
  facts: { label: string; value: string; attention?: boolean }[];
  issues: Issue[];
}) {
  return (
    <Card attention={!onTrack} className="flex flex-col gap-6 p-5 md:p-6" aria-labelledby="status-heading">
      <div className="flex items-start gap-4 pr-4">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full",
            onTrack ? "bg-success-container text-success-text" : "bg-attention-container text-attention",
          )}
        >
          <Icon name={onTrack ? "check_circle" : "schedule"} size={24} />
        </span>
        <div className="min-w-0">
          <p className="text-body-md text-on-surface-variant">Project status</p>
          <h2 id="status-heading" className="text-headline-md">
            {headline}
          </h2>
          <p className="text-body-md text-on-surface-variant">
            {issues.length ? `${issues.length} ${issues.length === 1 ? "thing needs" : "things need"} your attention` : "Nothing is blocked or late."}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-body-md text-on-surface-variant">
            {currentStage ? (
              <>
                Working on <span className="font-medium text-on-surface">{currentStage}</span>
              </>
            ) : (
              "Overall progress"
            )}
          </span>
          <span className="text-title-lg tabular-nums">{progress}%</span>
        </div>
        <ProgressBar value={progress} className="mt-2" />
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-body-sm text-on-surface-variant">{f.label}</dt>
              <dd className={cn("text-title-md", f.attention && "text-attention-text")}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {note && (
        <p className="rounded-lg bg-surface-container-low px-4 py-3 text-body-md text-on-surface-variant">
          <span className="font-medium text-on-surface">Note for the client: </span>
          {note}
        </p>
      )}

      {issues.length > 0 && (
        <section aria-labelledby="issues-heading">
          <h3 id="issues-heading" className="text-title-md">
            Needs attention
          </h3>
          <ul className="mt-2 divide-y divide-outline-variant">
            {issues.map((i) => {
              const body = (
                <>
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", issueIconClass[i.tone])}>
                    <Icon name={issueIcon[i.tone]} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-lg text-on-surface">{i.title}</span>
                    {i.detail && <span className="block text-body-md text-on-surface-variant">{i.detail}</span>}
                  </span>
                  <Icon name="chevron_right" size={22} className="shrink-0 text-on-surface-variant" />
                </>
              );
              const cls =
                "state-layer -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-md px-3 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";
              return (
                <li key={i.key}>
                  {i.link ? (
                    <Link {...i.link} className={cls}>
                      {body}
                    </Link>
                  ) : (
                    <button type="button" onClick={i.onClick} className={cls}>
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shortcuts: the things a manager does every day, one click each.
// ---------------------------------------------------------------------------

export type Shortcut = { label: string; icon: string; onClick?: () => void; link?: Pick<LinkProps, "to" | "params"> };

export function ShortcutsCard({ shortcuts }: { shortcuts: Shortcut[] }) {
  const cls = cn(
    buttonVariants({ variant: "tonal" }),
    // Deep-panel tiles on the tinted card.
    "h-auto min-h-20 flex-col items-start justify-between gap-3 bg-tertiary-container px-4 py-3 text-left whitespace-normal text-on-tertiary-container",
  );
  return (
    <Card variant="tinted" className="p-5 md:p-6" aria-labelledby="shortcuts-heading">
      <h2 id="shortcuts-heading" className="text-title-lg">
        Shortcuts
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
        {shortcuts.map((s) => {
          const body = (
            <>
              <Icon name={s.icon} size={24} />
              {s.label}
            </>
          );
          return s.link ? (
            <Link key={s.label} {...s.link} className={cls}>
              {body}
            </Link>
          ) : (
            <button key={s.label} type="button" onClick={s.onClick} className={cls}>
              {body}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** Round outline icon link for call / email. */
function ContactIcon({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a href={href} aria-label={label} className={buttonVariants({ variant: "outline", size: "icon" })}>
      <Icon name={icon} size={22} />
    </a>
  );
}

function ContactLine({ icon, href, children }: { icon: string; href?: string; children: ReactNode }) {
  const inner = (
    <>
      <Icon name={icon} size={20} className="shrink-0 text-on-surface-variant" />
      <span className="min-w-0 truncate">{children}</span>
    </>
  );
  return href ? (
    <a href={href} className="flex min-h-11 items-center gap-3 rounded-md text-body-lg text-on-surface hover:underline focus-visible:outline-2 focus-visible:outline-primary">
      {inner}
    </a>
  ) : (
    <div className="flex min-h-11 items-center gap-3 text-body-lg text-on-surface-variant">{inner}</div>
  );
}

export function ClientCard({
  projectId,
  clientName,
  contact,
  appUsers,
  onEdit,
}: {
  projectId: string;
  clientName: string;
  contact: ClientContact | undefined;
  appUsers: Member[];
  onEdit: () => void;
}) {
  const name = clientName || appUsers.map((m) => m.profile.full_name).join(" & ") || "Client";
  return (
    <Card className="flex flex-col gap-4 p-5 md:p-6" aria-labelledby="client-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="client-heading" className="text-title-lg">
          Client
        </h2>
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit client contact details" className="-mr-3">
          <Icon name="edit" size={22} />
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <UserAvatar name={name} className="size-12 text-title-md" />
        <div className="min-w-0">
          <div className="truncate text-title-md">{name}</div>
          <div className="truncate text-body-md text-on-surface-variant">
            {appUsers.length ? `In the app: ${appUsers.map((m) => m.profile.full_name).join(", ")}` : "Not invited to the app yet"}
          </div>
        </div>
      </div>
      <div>
        {contact?.client_phone ? (
          <ContactLine icon="call" href={tel(contact.client_phone)}>
            {contact.client_phone}
          </ContactLine>
        ) : (
          <ContactLine icon="call">No phone number yet</ContactLine>
        )}
        {contact?.client_email ? (
          <ContactLine icon="mail" href={`mailto:${contact.client_email}`}>
            {contact.client_email}
          </ContactLine>
        ) : (
          <ContactLine icon="mail">No email yet</ContactLine>
        )}
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        <Link to="/projects/$projectId/chat" params={{ projectId }} className={buttonVariants({ variant: "tonal" })}>
          <Icon name="chat_bubble" size={20} />
          Message
        </Link>
        {contact?.client_phone && (
          <a href={tel(contact.client_phone)} className={buttonVariants({ variant: "outline" })}>
            <Icon name="call" size={20} />
            Call
          </a>
        )}
        {contact?.client_email && (
          <a href={`mailto:${contact.client_email}`} className={buttonVariants({ variant: "outline" })}>
            <Icon name="mail" size={20} />
            Email
          </a>
        )}
      </div>
    </Card>
  );
}

export function TeamCard({
  managers,
  crew,
  onAdd,
  onEdit,
}: {
  managers: Member[];
  crew: CrewMember[];
  onAdd: () => void;
  onEdit: (c: CrewMember) => void;
}) {
  return (
    <Card className="p-5 md:p-6" aria-labelledby="team-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="team-heading" className="text-title-lg">
          Team on this project
        </h2>
        <Button variant="ghost" onClick={onAdd} className="-mr-3">
          <Icon name="person_add" size={20} />
          Add person
        </Button>
      </div>
      <ul className="mt-2 divide-y divide-outline-variant">
        {managers.map((m) => (
          <li key={m.user_id} className="flex min-h-16 items-center gap-3 py-3">
            <UserAvatar name={m.profile.full_name} src={m.profile.avatar_url} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-body-lg">{m.profile.full_name}</div>
              <div className="text-body-md text-on-surface-variant">Project manager</div>
            </div>
            <Badge variant="default" size="compact" icon="verified_user">
              Manager
            </Badge>
          </li>
        ))}
        {crew.map((c) => (
          <li key={c.id} className="flex min-h-16 items-center gap-3 py-3">
            <UserAvatar name={c.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-body-lg">{c.name}</div>
              <div className="truncate text-body-md text-on-surface-variant">
                {[c.trade, c.phone].filter(Boolean).join(" · ") || "No contact details"}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              {c.phone && <ContactIcon href={tel(c.phone)} icon="call" label={`Call ${c.name}`} />}
              {c.email && <ContactIcon href={`mailto:${c.email}`} icon="mail" label={`Email ${c.name}`} />}
              <Button variant="ghost" size="icon" onClick={() => onEdit(c)} aria-label={`Edit ${c.name}`}>
                <Icon name="more_vert" size={22} />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {crew.length === 0 && (
        <p className="mt-2 text-body-md text-on-surface-variant">Add the site lead and trades so their numbers are one tap away.</p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

export function ClientContactSheet({
  projectId,
  open,
  onOpenChange,
  contact,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact: ClientContact | undefined;
}) {
  const [form, setForm] = useState<ClientContact>({ client_phone: "", client_email: "" });
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm({ client_phone: contact?.client_phone ?? "", client_email: contact?.client_email ?? "" });
  }
  const save = useSave(projectId, (c: ClientContact) => api.updateClientContact(projectId, c), {
    invalidate: [keys.internal(projectId)],
    success: "Client contact saved",
  });
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title="Client contact" description="Only managers see these details.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(
            { client_phone: form.client_phone.trim(), client_email: form.client_email.trim() },
            { onSuccess: () => onOpenChange(false) },
          );
        }}
      >
        <Field id="cc-phone" label="Phone">
          <Input id="cc-phone" type="tel" autoComplete="off" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} />
        </Field>
        <Field id="cc-email" label="Email">
          <Input id="cc-email" type="email" autoComplete="off" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
        </Field>
        <Button type="submit" disabled={save.isPending} className="w-full">
          {save.isPending ? "Saving…" : "Save contact"}
        </Button>
      </form>
    </FormSheet>
  );
}

type CrewForm = { name: string; trade: string; phone: string; email: string };

export function CrewSheet({
  projectId,
  person,
  onClose,
}: {
  projectId: string;
  /** "new" to add, a crew member to edit, null when closed. */
  person: CrewMember | "new" | null;
  onClose: () => void;
}) {
  const isNew = person === "new";
  const [form, setForm] = useState<CrewForm>({ name: "", trade: "", phone: "", email: "" });
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = person === null ? null : isNew ? "new" : person.id;
  if (key !== lastKey) {
    setLastKey(key);
    if (person && person !== "new") setForm({ name: person.name, trade: person.trade, phone: person.phone, email: person.email });
    else setForm({ name: "", trade: "", phone: "", email: "" });
  }
  const inv = { invalidate: [keys.crew(projectId)] };
  const save = useSave(projectId, (c: CrewInput) => api.saveCrew(projectId, c), { ...inv, success: (c) => `Saved ${c.name}` });
  const remove = useSave(projectId, (c: CrewMember) => api.deleteCrew(c.id), { ...inv, success: (c) => `Removed ${c.name}` });
  const set = (k: keyof CrewForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <FormSheet
      open={person !== null}
      onOpenChange={(v) => !v && onClose()}
      title={isNew ? "Add a person" : "Edit person"}
      description="Site crew and trades. Only managers see this list."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const values = { name: form.name.trim(), trade: form.trade.trim(), phone: form.phone.trim(), email: form.email.trim() };
          save.mutate(isNew ? values : { id: (person as CrewMember).id, ...values }, { onSuccess: onClose });
        }}
      >
        <Field id="cr-name" label="Name">
          <Input id="cr-name" required autoComplete="off" value={form.name} onChange={set("name")} />
        </Field>
        <Field id="cr-trade" label="Role or trade">
          <Input id="cr-trade" autoComplete="off" value={form.trade} onChange={set("trade")} placeholder="Electrician, site lead…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cr-phone" label="Phone">
            <Input id="cr-phone" type="tel" autoComplete="off" value={form.phone} onChange={set("phone")} />
          </Field>
          <Field id="cr-email" label="Email">
            <Input id="cr-email" type="email" autoComplete="off" value={form.email} onChange={set("email")} />
          </Field>
        </div>
        <Button type="submit" disabled={save.isPending || !form.name.trim()} className="w-full">
          {save.isPending ? "Saving…" : isNew ? "Add person" : "Save changes"}
        </Button>
        {person && person !== "new" && (
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            disabled={remove.isPending}
            onClick={() => confirm(`Remove ${person.name} from this project?`) && remove.mutate(person, { onSuccess: onClose })}
          >
            Remove from project
          </Button>
        )}
      </form>
    </FormSheet>
  );
}

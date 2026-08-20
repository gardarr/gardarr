import { Fragment, useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { Check, Circle, Clock3, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/timepicker";
import { workerService } from "@/services/workers";
import type { BandwidthSchedule, BandwidthScheduleInput, BandwidthSchedulePreview } from "@/types/worker";
import { bytesToSliderIndex, formatBytesPerSecond, sliderIndexToBytes, SPEED_LIMIT_SEGMENTS } from "@/utils/bytes";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_SCHEDULES = 5;
type DropTarget = { id: string; position: "before" | "after" };
const blank = (): BandwidthScheduleInput => ({ name: "", days_of_week: [1, 2, 3, 4, 5], start_time: "08:00", end_time: "18:00", download_limit: 0, upload_limit: 0, enabled: true });

function limits(download: number, upload: number) {
  const display = (value: number) => value === 0 ? "∞" : formatBytesPerSecond(value);
  return `${display(download)} ↓ / ${display(upload)} ↑`;
}

function ScheduleSpeedLimitInput({ label, limit, onChange }: { label: string; limit: number; onChange: (limit: number) => void }) {
  const { t } = useTranslation();
  const display = limit === 0 ? t("workers.limits.unlimited", "Unlimited") : formatBytesPerSecond(limit);
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2"><Label>{label}</Label><span className="text-sm text-muted-foreground">{display}</span></div>
    <Input type="number" min="0" value={limit} onChange={event => onChange(Math.max(0, Number(event.target.value)))} />
    <Slider value={[bytesToSliderIndex(limit)]} min={1} max={SPEED_LIMIT_SEGMENTS.length + 1} step={1} onValueChange={value => onChange(sliderIndexToBytes(value[0]))} />
    <div className="flex justify-between px-1 text-xs text-muted-foreground"><span>{formatBytesPerSecond(SPEED_LIMIT_SEGMENTS[0])}</span><span>{t("workers.limits.unlimited", "Unlimited")}</span></div>
  </div>;
}

export function BandwidthSchedules({ workerId }: { workerId: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<BandwidthSchedule[]>([]);
  const [preview, setPreview] = useState<BandwidthSchedulePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BandwidthSchedule | null | undefined>(undefined);
  const [form, setForm] = useState<BandwidthScheduleInput>(blank());
  const [saving, setSaving] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<BandwidthSchedule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [draggedScheduleId, setDraggedScheduleId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [hoveredScheduleId, setHoveredScheduleId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [schedules, current] = await Promise.all([workerService.listSchedules(workerId), workerService.getSchedulePreview(workerId)]);
    if (schedules.error) toast.error(schedules.error); else setItems(schedules.data ?? []);
    if (current.error) toast.error(current.error); else setPreview(current.data ?? null);
    setLoading(false);
  }, [workerId]);
  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    if (items.length >= MAX_SCHEDULES) { toast.error(t("workers.schedules.maxReached", "Maximum of 5 schedules per worker.")); return; }
    setEditing(null); setForm(blank());
  };
  const openEdit = (item: BandwidthSchedule) => {
    setEditing(item);
    setForm({ name: item.name, days_of_week: item.days_of_week, start_time: item.start_time, end_time: item.end_time, download_limit: item.download_limit, upload_limit: item.upload_limit, enabled: item.enabled });
  };
  const toggleDay = (day: number) => setForm(current => ({ ...current, days_of_week: current.days_of_week.includes(day) ? current.days_of_week.filter(item => item !== day) : [...current.days_of_week, day].sort() }));
  const save = async () => {
    if (!form.name.trim() || form.days_of_week.length === 0) { toast.error(t("workers.schedules.validation", "Choose a name and at least one day.")); return; }
    if (!editing && items.length >= MAX_SCHEDULES) { toast.error(t("workers.schedules.maxReached", "Maximum of 5 schedules per worker.")); return; }
    setSaving(true);
    const response = editing ? await workerService.updateSchedule(workerId, editing.uuid, form) : await workerService.createSchedule(workerId, form);
    setSaving(false);
    if (response.error) { toast.error(response.error); return; }
    toast.success(editing ? t("workers.schedules.updatedToast", "Schedule updated") : t("workers.schedules.createdToast", "Schedule created"));
    setEditing(undefined); await load();
  };
  const remove = async () => {
    if (!scheduleToDelete) return;
    setDeleting(true);
    const response = await workerService.deleteSchedule(workerId, scheduleToDelete.uuid);
    setDeleting(false);
    if (response.error) { toast.error(response.error); return; }
    toast.success(t("workers.schedules.deletedToast", "Schedule deleted"));
    setScheduleToDelete(null);
    await load();
  };
  const reorder = async (targetId: string, position: DropTarget["position"]) => {
    if (!draggedScheduleId || draggedScheduleId === targetId) return;
    const from = items.findIndex(item => item.uuid === draggedScheduleId);
    const to = items.findIndex(item => item.uuid === targetId);
    if (from < 0 || to < 0) return;
    const reordered = [...items];
    const [moved] = reordered.splice(from, 1);
    const insertionIndex = (from < to ? to - 1 : to) + (position === "after" ? 1 : 0);
    reordered.splice(insertionIndex, 0, moved);
    setItems(reordered);
    setReordering(true);
    const response = await workerService.reorderSchedules(workerId, reordered.map(item => item.uuid));
    setReordering(false);
    setDraggedScheduleId(null);
    setDropTarget(null);
    if (response.error) { toast.error(response.error); await load(); return; }
    setItems(response.data ?? reordered);
    toast.success(t("workers.schedules.reorderedToast", "Schedule priority updated"));
    const current = await workerService.getSchedulePreview(workerId);
    if (!current.error) setPreview(current.data ?? null);
  };
  const updateDropTarget = (event: DragEvent<HTMLDivElement>, itemId: string) => {
    event.preventDefault();
    if (!draggedScheduleId || draggedScheduleId === itemId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setDropTarget({ id: itemId, position: event.clientY < bounds.top + bounds.height / 2 ? "before" : "after" });
  };
  const activeName = preview?.schedule?.name;
  const activeScheduleId = preview?.schedule?.uuid;
  const grid = useMemo(() => days.map((day, dayIndex) => ({ day, slots: items.filter(item => item.enabled && item.days_of_week.includes(dayIndex)) })), [items]);

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">{t("workers.schedules.loading", "Loading schedules...")}</div>;
  return <div className="space-y-5 p-4">
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium"><Clock3 className="h-4 w-4" />{activeName ? t("workers.schedules.active", "Active now: {{name}}", { name: activeName }) : t("workers.schedules.noActive", "No schedule is active")}</div>
      <p className="mt-1 text-muted-foreground">{preview?.limits ? limits(preview.limits.download_limit, preview.limits.upload_limit) : t("workers.schedules.unmanaged", "Save limits or create a schedule to establish a baseline.")} {preview?.timezone && `· ${preview.timezone}`}</p>
    </div>

    <div className="flex items-center justify-between"><h3 className="font-semibold">{t("workers.schedules.title", "Speed schedules")}</h3><Button size="sm" onClick={openCreate} disabled={items.length >= MAX_SCHEDULES}><Plus className="mr-1 h-4 w-4" />{t("workers.schedules.add", "Add")}</Button></div>
    <p className="text-xs text-muted-foreground">{t("workers.schedules.reorderHint", "Drag rules to reorder priority.")} {items.length >= MAX_SCHEDULES && t("workers.schedules.maxReached", "Maximum of 5 schedules per worker.")}</p>
    <div className="grid grid-cols-7 gap-1 rounded-lg border p-2 text-center text-[10px]">
      {grid.map(({ day, slots }) => <div key={day} className="min-w-0"><div className="mb-1 font-medium text-muted-foreground">{day}</div>{slots.length === 0 ? <div className="h-12 rounded bg-muted/40" /> : slots.map(slot => <div key={slot.uuid} onMouseEnter={() => setHoveredScheduleId(slot.uuid)} onMouseLeave={() => setHoveredScheduleId(null)} className={`mb-1 min-h-12 cursor-pointer rounded p-1 text-white shadow-sm transition-all ${hoveredScheduleId === slot.uuid ? "relative z-10 scale-[1.03] ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`} style={{ backgroundColor: slot.color }} title={`${slot.start_time}–${slot.end_time}: ${slot.name}`}>{slot.start_time}<br />{slot.end_time}</div>)}</div>)}
    </div>
    <p className="text-xs text-muted-foreground">{t("workers.schedules.gridHelp", "Weekly preview. End time is exclusive; equal start and end means the full day.")}</p>

    {items.length === 0 ? <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">{t("workers.schedules.empty", "No schedules yet.")}</div> : <div className="space-y-2">{items.map((item, index) => {
      const indicatorPosition = dropTarget?.id === item.uuid && draggedScheduleId !== item.uuid ? dropTarget.position : null;
      return <Fragment key={item.uuid}><div draggable={!reordering} onMouseEnter={() => setHoveredScheduleId(item.uuid)} onMouseLeave={() => setHoveredScheduleId(null)} onDragStart={() => setDraggedScheduleId(item.uuid)} onDragOver={event => updateDropTarget(event, item.uuid)} onDrop={event => { const bounds = event.currentTarget.getBoundingClientRect(); void reorder(item.uuid, event.clientY < bounds.top + bounds.height / 2 ? "before" : "after"); }} onDragEnd={() => { setDraggedScheduleId(null); setDropTarget(null); }} className={`relative flex items-center gap-3 rounded-lg border p-3 transition-all ${item.enabled ? "" : "opacity-55"} ${draggedScheduleId === item.uuid ? "opacity-40" : ""} ${hoveredScheduleId === item.uuid ? "z-10 ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}>{indicatorPosition && <span aria-hidden className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-primary ${indicatorPosition === "before" ? "-top-1" : "-bottom-1"}`} />}<GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" aria-label={t("workers.schedules.reorderHint", "Drag rules to reorder priority.")} /><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: item.color }} title={t("workers.schedules.ruleColor", "Rule color")}>{index + 1}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-sm font-medium">{item.name}</span>{activeScheduleId === item.uuid && <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-300">{t("workers.schedules.activeRule", "Active")}</Badge>}</div><p className="text-xs text-muted-foreground">{limits(item.download_limit, item.upload_limit)}</p><p className="text-xs text-muted-foreground">{item.days_of_week.map(day => days[day]).join(", ")} · {item.start_time}–{item.end_time}</p></div><Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setScheduleToDelete(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></Fragment>;
    })}</div>}

    <Dialog open={editing !== undefined} onOpenChange={open => { if (!open && !saving) setEditing(undefined); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader className="pr-28">
          <DialogTitle>{editing ? t("workers.schedules.edit", "Edit schedule") : t("workers.schedules.new", "New schedule")}</DialogTitle>
          <DialogDescription>{t("workers.schedules.formDescription", "Set the rule's times and limits.")}</DialogDescription>
          <p className="text-sm text-muted-foreground">{t("workers.schedules.projectTimezone", "Project timezone: {{timezone}}", { timezone: preview?.timezone ?? "—" })}</p>
        </DialogHeader>
        <div className="absolute right-12 top-4 flex items-center gap-2">
          <Label htmlFor="schedule-enabled" className="text-sm text-muted-foreground">{t("workers.schedules.enabled", "Enabled")}</Label>
          <Switch id="schedule-enabled" checked={form.enabled} onCheckedChange={enabled => setForm({ ...form, enabled })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label>{t("workers.schedules.name", "Name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1"><Label>{t("workers.schedules.start", "Start")}</Label><TimePicker value={form.start_time} onValueChange={start_time => setForm({ ...form, start_time })} aria-label={t("workers.schedules.start", "Start")} /></div>
          <div className="space-y-1"><Label>{t("workers.schedules.end", "End")}</Label><TimePicker value={form.end_time} onValueChange={end_time => setForm({ ...form, end_time })} aria-label={t("workers.schedules.end", "End")} /></div>
          <ScheduleSpeedLimitInput label={t("workers.limits.downloadLimit", "Download Limit")} limit={form.download_limit} onChange={download_limit => setForm({ ...form, download_limit })} />
          <ScheduleSpeedLimitInput label={t("workers.limits.uploadLimit", "Upload Limit")} limit={form.upload_limit} onChange={upload_limit => setForm({ ...form, upload_limit })} />
        </div>
        <div><Label>{t("workers.schedules.days", "Days")}</Label><div className="mt-2 flex flex-wrap gap-1">{days.map((day, index) => { const selected = form.days_of_week.includes(index); return <Button key={day} type="button" size="sm" variant={selected ? "default" : "outline"} onClick={() => toggleDay(index)} aria-pressed={selected}>{selected ? <Check className="mr-1 h-3.5 w-3.5" /> : <Circle className="mr-1 h-3.5 w-3.5" />}{day}</Button>; })}</div></div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditing(undefined)} disabled={saving}>{t("common.cancel", "Cancel")}</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? t("workers.limits.saving", "Saving...") : t("common.save", "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={scheduleToDelete !== null} onOpenChange={open => { if (!open && !deleting) setScheduleToDelete(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("workers.schedules.deleteDialogTitle", "Delete schedule?")}</DialogTitle>
          <DialogDescription>{t("workers.schedules.deleteDialogDescription", "This will permanently remove “{{name}}”.", { name: scheduleToDelete?.name ?? "" })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setScheduleToDelete(null)} disabled={deleting}>{t("common.cancel", "Cancel")}</Button>
          <Button variant="destructive" onClick={() => void remove()} disabled={deleting}>{deleting ? t("workers.schedules.deleting", "Deleting...") : t("common.delete", "Delete")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

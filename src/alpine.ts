import type { Alpine } from "alpinejs";

type Flash = { type: "success" | "error"; message: string } | null;

type PlannerStore = {
  events: Array<Record<string, unknown>>;
  activeFilter: "overview" | "events" | "archived";
  activeEventId: string | null;
  drawers: Record<string, boolean>;
  loading: Record<string, boolean>;
  flash: Flash;
  init(input?: Partial<PlannerStore>): void;
  setFilter(filter: PlannerStore["activeFilter"]): void;
  openDrawer(key: string): void;
  closeDrawer(key: string): void;
  setLoading(key: string, value: boolean): void;
  setFlash(type: "success" | "error", message: string): void;
  clearFlash(): void;
};

export default function initAlpine(Alpine: Alpine) {
  Alpine.store("eventPlanner", {
    events: [],
    activeFilter: "overview",
    activeEventId: null,
    drawers: {},
    loading: {},
    flash: null,
    init(input) {
      this.events = input?.events ?? [];
      this.activeFilter = input?.activeFilter ?? "overview";
      this.activeEventId = input?.activeEventId ?? null;
    },
    setFilter(filter) {
      this.activeFilter = filter;
    },
    openDrawer(key) {
      this.drawers[key] = true;
    },
    closeDrawer(key) {
      this.drawers[key] = false;
    },
    setLoading(key, value) {
      this.loading[key] = value;
    },
    setFlash(type, message) {
      this.flash = { type, message };
      setTimeout(() => {
        if (this.flash?.message === message) this.flash = null;
      }, 2800);
    },
    clearFlash() {
      this.flash = null;
    },
  } satisfies PlannerStore);
}

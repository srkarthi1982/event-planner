import type { ActionAPIContext } from "astro:actions";
import { ActionError } from "astro:actions";
import { asc, db, eq, EventGuests, Events, EventTasks } from "astro:db";

export type EventStatus = "draft" | "planned" | "completed" | "archived" | "cancelled";
export type EventType = "birthday" | "meeting" | "wedding" | "trip" | "party" | "personal" | "other";
export type GuestStatus = "invited" | "confirmed" | "declined" | "maybe";

export function requireUser(context: ActionAPIContext) {
  const user = (context.locals as App.Locals | undefined)?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "Please sign in to continue.",
    });
  }

  return user;
}

export function parseOptionalDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function assertValidRange(startsAt: Date | null, endsAt: Date | null) {
  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    throw new ActionError({
      code: "BAD_REQUEST",
      message: "End date/time must be after start date/time.",
    });
  }
}

export async function getOwnedEvent(userId: string, eventId: string) {
  const event = (await db.select().from(Events).where(eq(Events.id, eventId)))[0];

  if (!event) {
    throw new ActionError({ code: "NOT_FOUND", message: "Event not found." });
  }

  if (event.userId !== userId) {
    throw new ActionError({ code: "FORBIDDEN", message: "You do not have access to this event." });
  }

  return event;
}

export async function listEvents(userId: string) {
  return db.select().from(Events).where(eq(Events.userId, userId)).orderBy(asc(Events.startsAt), asc(Events.createdAt));
}

export async function getEventDetail(userId: string, eventId: string) {
  const event = await getOwnedEvent(userId, eventId);

  const [tasks, guests] = await Promise.all([
    db.select().from(EventTasks).where(eq(EventTasks.eventId, event.id)).orderBy(asc(EventTasks.sortOrder), asc(EventTasks.createdAt)),
    db.select().from(EventGuests).where(eq(EventGuests.eventId, event.id)).orderBy(asc(EventGuests.sortOrder), asc(EventGuests.createdAt)),
  ]);

  return { event, tasks, guests };
}

export async function getTaskForOwnedEvent(userId: string, taskId: string) {
  const task = (await db.select().from(EventTasks).where(eq(EventTasks.id, taskId)))[0];

  if (!task) {
    throw new ActionError({ code: "NOT_FOUND", message: "Task not found." });
  }

  await getOwnedEvent(userId, task.eventId);
  return task;
}

export async function getGuestForOwnedEvent(userId: string, guestId: string) {
  const guest = (await db.select().from(EventGuests).where(eq(EventGuests.id, guestId)))[0];

  if (!guest) {
    throw new ActionError({ code: "NOT_FOUND", message: "Guest not found." });
  }

  await getOwnedEvent(userId, guest.eventId);
  return guest;
}

export async function getNextTaskSortOrder(eventId: string) {
  const tasks = await db.select({ sortOrder: EventTasks.sortOrder }).from(EventTasks).where(eq(EventTasks.eventId, eventId));
  return tasks.length ? Math.max(...tasks.map((task) => task.sortOrder)) + 1 : 1;
}

export async function getNextGuestSortOrder(eventId: string) {
  const guests = await db.select({ sortOrder: EventGuests.sortOrder }).from(EventGuests).where(eq(EventGuests.eventId, eventId));
  return guests.length ? Math.max(...guests.map((guest) => guest.sortOrder)) + 1 : 1;
}


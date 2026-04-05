import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { db, eq, EventGuests, Events, EventTasks } from "astro:db";
import {
  assertValidRange,
  getEventDetail,
  getGuestForOwnedEvent,
  getNextGuestSortOrder,
  getNextTaskSortOrder,
  getOwnedEvent,
  getTaskForOwnedEvent,
  listEvents,
  parseOptionalDate,
  requireUser,
} from "../lib/events";
import { sendHighSignalNotification, syncDashboardSummary } from "../lib/integrations";

const eventStatusSchema = z.enum(["draft", "planned", "completed", "archived", "cancelled"]);
const eventTypeSchema = z.enum(["birthday", "meeting", "wedding", "trip", "party", "personal", "other"]);
const guestStatusSchema = z.enum(["invited", "confirmed", "declined", "maybe"]);

export const server = {
  createEvent: defineAction({
    input: z.object({
      title: z.string().min(1),
      eventType: eventTypeSchema.nullish(),
      location: z.string().max(240).nullish(),
      startsAt: z.string().nullish(),
      endsAt: z.string().nullish(),
      notes: z.string().max(3000).nullish(),
      status: eventStatusSchema.default("planned"),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const startsAt = parseOptionalDate(input.startsAt);
      const endsAt = parseOptionalDate(input.endsAt);
      assertValidRange(startsAt, endsAt);
      const now = new Date();

      const event = {
        id: crypto.randomUUID(),
        ownerUserId: user.id,
        title: input.title.trim(),
        eventType: input.eventType ?? null,
        location: input.location?.trim() || null,
        startsAt,
        endsAt,
        notes: input.notes?.trim() || null,
        status: input.status,
        createdAt: now,
        updatedAt: now,
        archivedAt: input.status === "archived" ? now : null,
      } satisfies typeof Events.$inferInsert;

      await db.insert(Events).values(event);
      await syncDashboardSummary(user.id);
      await sendHighSignalNotification({
        userId: user.id,
        title: "Event created",
        body: `“${event.title}” is now in your planner.`,
      });

      return { success: true, data: event };
    },
  }),

  updateEvent: defineAction({
    input: z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      eventType: eventTypeSchema.nullish(),
      location: z.string().max(240).nullish(),
      startsAt: z.string().nullish(),
      endsAt: z.string().nullish(),
      notes: z.string().max(3000).nullish(),
      status: eventStatusSchema.optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await getOwnedEvent(user.id, input.id);
      const startsAt = input.startsAt === undefined ? existing.startsAt : parseOptionalDate(input.startsAt);
      const endsAt = input.endsAt === undefined ? existing.endsAt : parseOptionalDate(input.endsAt);
      assertValidRange(startsAt, endsAt);
      const now = new Date();

      const updates = {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.eventType !== undefined ? { eventType: input.eventType ?? null } : {}),
        ...(input.location !== undefined ? { location: input.location?.trim() || null } : {}),
        ...(input.startsAt !== undefined ? { startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.status === "archived" ? { archivedAt: now } : {}),
        ...(input.status && input.status !== "archived" ? { archivedAt: null } : {}),
        updatedAt: now,
      } satisfies Partial<typeof Events.$inferInsert>;

      await db.update(Events).set(updates).where(eq(Events.id, input.id));

      if (input.status === "completed" && existing.status !== "completed") {
        await sendHighSignalNotification({
          userId: user.id,
          title: "Event completed",
          body: `Nice work — “${existing.title}” has been marked complete.`,
          level: "success",
        });
      }

      await syncDashboardSummary(user.id);
      return { success: true };
    },
  }),

  archiveEvent: defineAction({
    input: z.object({ id: z.string() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedEvent(user.id, input.id);
      const now = new Date();

      await db
        .update(Events)
        .set({ status: "archived", archivedAt: now, updatedAt: now })
        .where(eq(Events.id, input.id));

      await syncDashboardSummary(user.id);
      return { success: true };
    },
  }),

  restoreEvent: defineAction({
    input: z.object({ id: z.string(), status: eventStatusSchema.default("planned") }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedEvent(user.id, input.id);
      const now = new Date();

      await db
        .update(Events)
        .set({ status: input.status === "archived" ? "planned" : input.status, archivedAt: null, updatedAt: now })
        .where(eq(Events.id, input.id));

      await syncDashboardSummary(user.id);
      return { success: true };
    },
  }),

  createEventTask: defineAction({
    input: z.object({
      eventId: z.string(),
      title: z.string().min(1),
      description: z.string().max(2000).nullish(),
      dueAt: z.string().nullish(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedEvent(user.id, input.eventId);
      const now = new Date();

      await db.insert(EventTasks).values({
        id: crypto.randomUUID(),
        eventId: input.eventId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        isCompleted: false,
        dueAt: parseOptionalDate(input.dueAt),
        sortOrder: await getNextTaskSortOrder(input.eventId),
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      return { success: true };
    },
  }),

  updateEventTask: defineAction({
    input: z.object({
      id: z.string(),
      title: z.string().min(1),
      description: z.string().max(2000).nullish(),
      dueAt: z.string().nullish(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await getTaskForOwnedEvent(user.id, input.id);

      await db
        .update(EventTasks)
        .set({
          title: input.title.trim(),
          description: input.description?.trim() || null,
          dueAt: parseOptionalDate(input.dueAt),
          updatedAt: new Date(),
        })
        .where(eq(EventTasks.id, existing.id));

      return { success: true };
    },
  }),

  toggleEventTaskComplete: defineAction({
    input: z.object({ id: z.string(), isCompleted: z.boolean() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await getTaskForOwnedEvent(user.id, input.id);
      const now = new Date();

      await db
        .update(EventTasks)
        .set({
          isCompleted: input.isCompleted,
          completedAt: input.isCompleted ? now : null,
          updatedAt: now,
        })
        .where(eq(EventTasks.id, existing.id));

      return { success: true };
    },
  }),

  deleteEventTask: defineAction({
    input: z.object({ id: z.string() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await getTaskForOwnedEvent(user.id, input.id);
      await db.delete(EventTasks).where(eq(EventTasks.id, existing.id));
      return { success: true };
    },
  }),

  reorderEventTasks: defineAction({
    input: z.object({ eventId: z.string(), orderedTaskIds: z.array(z.string()).min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedEvent(user.id, input.eventId);

      const tasks = await db.select().from(EventTasks).where(eq(EventTasks.eventId, input.eventId));
      const ids = new Set(tasks.map((task) => task.id));
      if (!input.orderedTaskIds.every((id) => ids.has(id))) {
        return { success: false, message: "Invalid task order payload." };
      }

      await Promise.all(
        input.orderedTaskIds.map((id, index) =>
          db.update(EventTasks).set({ sortOrder: index + 1, updatedAt: new Date() }).where(eq(EventTasks.id, id)),
        ),
      );

      return { success: true };
    },
  }),

  createEventGuest: defineAction({
    input: z.object({
      eventId: z.string(),
      name: z.string().min(1),
      email: z.string().email().nullish(),
      phone: z.string().max(50).nullish(),
      status: guestStatusSchema.default("invited"),
      notes: z.string().max(2000).nullish(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedEvent(user.id, input.eventId);
      const now = new Date();

      await db.insert(EventGuests).values({
        id: crypto.randomUUID(),
        eventId: input.eventId,
        name: input.name.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        status: input.status,
        notes: input.notes?.trim() || null,
        sortOrder: await getNextGuestSortOrder(input.eventId),
        createdAt: now,
        updatedAt: now,
      });

      const guestCount = (
        await db.select({ id: EventGuests.id }).from(EventGuests).where(eq(EventGuests.eventId, input.eventId))
      ).length;

      if (guestCount === 10) {
        await sendHighSignalNotification({
          userId: user.id,
          title: "Guest list milestone",
          body: "You reached 10 guests for this event.",
          level: "success",
        });
      }

      return { success: true };
    },
  }),

  updateEventGuest: defineAction({
    input: z.object({
      id: z.string(),
      name: z.string().min(1),
      email: z.string().email().nullish(),
      phone: z.string().max(50).nullish(),
      status: guestStatusSchema,
      notes: z.string().max(2000).nullish(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await getGuestForOwnedEvent(user.id, input.id);

      await db
        .update(EventGuests)
        .set({
          name: input.name.trim(),
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          status: input.status,
          notes: input.notes?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(EventGuests.id, existing.id));

      return { success: true };
    },
  }),

  deleteEventGuest: defineAction({
    input: z.object({ id: z.string() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await getGuestForOwnedEvent(user.id, input.id);
      await db.delete(EventGuests).where(eq(EventGuests.id, existing.id));
      return { success: true };
    },
  }),

  reorderEventGuests: defineAction({
    input: z.object({ eventId: z.string(), orderedGuestIds: z.array(z.string()).min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedEvent(user.id, input.eventId);

      const guests = await db.select().from(EventGuests).where(eq(EventGuests.eventId, input.eventId));
      const ids = new Set(guests.map((guest) => guest.id));
      if (!input.orderedGuestIds.every((id) => ids.has(id))) {
        return { success: false, message: "Invalid guest order payload." };
      }

      await Promise.all(
        input.orderedGuestIds.map((id, index) =>
          db.update(EventGuests).set({ sortOrder: index + 1, updatedAt: new Date() }).where(eq(EventGuests.id, id)),
        ),
      );

      return { success: true };
    },
  }),

  listEvents: defineAction({
    input: z.object({ includeArchived: z.boolean().default(true) }).optional(),
    handler: async (input, context) => {
      const user = requireUser(context);
      const items = await listEvents(user.id);
      return {
        success: true,
        data: (input?.includeArchived ?? true) ? items : items.filter((item) => item.status !== "archived"),
      };
    },
  }),

  getEventDetail: defineAction({
    input: z.object({ id: z.string() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      return {
        success: true,
        data: await getEventDetail(user.id, input.id),
      };
    },
  }),
};

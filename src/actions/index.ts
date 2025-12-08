import type { ActionAPIContext } from "astro:actions";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { db, eq, and, Events, EventTasks, EventGuests } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

function parseOptionalDate(value?: string | null) {
  return value ? new Date(value) : undefined;
}

async function getEventForUser(userId: string, eventId: string) {
  const event = (
    await db.select().from(Events).where(eq(Events.id, eventId))
  )[0];

  if (!event) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Event not found.",
    });
  }

  if (event.ownerUserId !== userId) {
    throw new ActionError({
      code: "FORBIDDEN",
      message: "You do not have access to this event.",
    });
  }

  return event;
}

const EVENT_STATUSES = ["planning", "confirmed", "done", "cancelled"] as const;
const TASK_STATUSES = ["todo", "in-progress", "done"] as const;
const TASK_PRIORITIES = ["low", "medium", "high"] as const;
const RSVP_STATUSES = ["invited", "going", "maybe", "declined"] as const;

export const server = {
  createEvent: defineAction({
    input: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      startDateTime: z.string().datetime().optional(),
      endDateTime: z.string().datetime().optional(),
      timeZone: z.string().optional(),
      locationName: z.string().optional(),
      locationAddress: z.string().optional(),
      locationMapLink: z.string().url().optional(),
      status: z.enum(EVENT_STATUSES).default("planning"),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const event = {
        id: crypto.randomUUID(),
        ownerUserId: user.id,
        title: input.title,
        description: input.description,
        startDateTime: parseOptionalDate(input.startDateTime),
        endDateTime: parseOptionalDate(input.endDateTime),
        timeZone: input.timeZone,
        locationName: input.locationName,
        locationAddress: input.locationAddress,
        locationMapLink: input.locationMapLink,
        status: input.status ?? "planning",
        createdAt: now,
        updatedAt: now,
      } satisfies typeof Events.$inferSelect;

      await db.insert(Events).values(event);

      return {
        success: true,
        data: { event },
      };
    },
  }),

  updateEvent: defineAction({
    input: z
      .object({
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        startDateTime: z.string().datetime().optional(),
        endDateTime: z.string().datetime().optional(),
        timeZone: z.string().optional(),
        locationName: z.string().optional(),
        locationAddress: z.string().optional(),
        locationMapLink: z.string().url().optional(),
        status: z.enum(EVENT_STATUSES).optional(),
      })
      .refine(
        (value) =>
          value.title !== undefined ||
          value.description !== undefined ||
          value.startDateTime !== undefined ||
          value.endDateTime !== undefined ||
          value.timeZone !== undefined ||
          value.locationName !== undefined ||
          value.locationAddress !== undefined ||
          value.locationMapLink !== undefined ||
          value.status !== undefined,
        {
          message: "At least one field must be provided to update the event.",
        },
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await getEventForUser(user.id, input.id);
      const now = new Date();

      const updates: Partial<typeof Events.$inferSelect> = {
        updatedAt: now,
      };

      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.startDateTime !== undefined)
        updates.startDateTime = parseOptionalDate(input.startDateTime);
      if (input.endDateTime !== undefined)
        updates.endDateTime = parseOptionalDate(input.endDateTime);
      if (input.timeZone !== undefined) updates.timeZone = input.timeZone;
      if (input.locationName !== undefined) updates.locationName = input.locationName;
      if (input.locationAddress !== undefined)
        updates.locationAddress = input.locationAddress;
      if (input.locationMapLink !== undefined)
        updates.locationMapLink = input.locationMapLink;
      if (input.status !== undefined) updates.status = input.status;

      await db.update(Events).set(updates).where(eq(Events.id, input.id));

      return {
        success: true,
        data: { event: { ...existing, ...updates } },
      };
    },
  }),

  deleteEvent: defineAction({
    input: z.object({ id: z.string() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getEventForUser(user.id, input.id);

      await db.delete(Events).where(eq(Events.id, input.id));
      await db.delete(EventTasks).where(eq(EventTasks.eventId, input.id));
      await db.delete(EventGuests).where(eq(EventGuests.eventId, input.id));

      return {
        success: true,
      };
    },
  }),

  listMyEvents: defineAction({
    input: z.object({ status: z.enum(EVENT_STATUSES).optional() }).optional(),
    handler: async (input, context) => {
      const user = requireUser(context);

      const statusFilter = input?.status
        ? and(eq(Events.ownerUserId, user.id), eq(Events.status, input.status))
        : eq(Events.ownerUserId, user.id);

      const events = await db.select().from(Events).where(statusFilter);

      return {
        success: true,
        data: { items: events, total: events.length },
      };
    },
  }),

  getEventWithDetails: defineAction({
    input: z.object({ id: z.string() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const event = await getEventForUser(user.id, input.id);

      const [tasks, guests] = await Promise.all([
        db
          .select()
          .from(EventTasks)
          .where(eq(EventTasks.eventId, input.id)),
        db
          .select()
          .from(EventGuests)
          .where(eq(EventGuests.eventId, input.id)),
      ]);

      return {
        success: true,
        data: { event, tasks, guests },
      };
    },
  }),

  upsertEventTask: defineAction({
    input: z.object({
      id: z.string().optional(),
      eventId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      dueDate: z.string().datetime().optional(),
      status: z.enum(TASK_STATUSES).default("todo"),
      priority: z.enum(TASK_PRIORITIES).optional(),
      userId: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const event = await getEventForUser(user.id, input.eventId);
      const now = new Date();

      if (input.id) {
        const existing = (
          await db
            .select()
            .from(EventTasks)
            .where(eq(EventTasks.id, input.id))
        )[0];

        if (!existing) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Task not found.",
          });
        }

        if (existing.eventId !== event.id) {
          throw new ActionError({
            code: "FORBIDDEN",
            message: "You cannot move tasks to another event.",
          });
        }

        const updates: Partial<typeof EventTasks.$inferSelect> = {
          title: input.title,
          description: input.description,
          dueDate: parseOptionalDate(input.dueDate),
          status: input.status ?? existing.status,
          priority: input.priority,
          userId: input.userId,
          updatedAt: now,
        };

        await db
          .update(EventTasks)
          .set(updates)
          .where(eq(EventTasks.id, input.id));

        return {
          success: true,
          data: { task: { ...existing, ...updates } },
        };
      }

      const task = {
        id: crypto.randomUUID(),
        eventId: event.id,
        userId: input.userId,
        title: input.title,
        description: input.description,
        dueDate: parseOptionalDate(input.dueDate),
        status: input.status ?? "todo",
        priority: input.priority,
        createdAt: now,
        updatedAt: now,
      } satisfies typeof EventTasks.$inferSelect;

      await db.insert(EventTasks).values(task);

      return {
        success: true,
        data: { task },
      };
    },
  }),

  deleteEventTask: defineAction({
    input: z.object({ id: z.string() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = (
        await db.select().from(EventTasks).where(eq(EventTasks.id, input.id))
      )[0];

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Task not found.",
        });
      }

      await getEventForUser(user.id, existing.eventId);

      await db.delete(EventTasks).where(eq(EventTasks.id, input.id));

      return {
        success: true,
      };
    },
  }),

  upsertEventGuest: defineAction({
    input: z.object({
      id: z.string().optional(),
      eventId: z.string(),
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      rsvpStatus: z.enum(RSVP_STATUSES).optional(),
      notes: z.string().optional(),
      invitedAt: z.string().datetime().optional(),
      respondedAt: z.string().datetime().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const event = await getEventForUser(user.id, input.eventId);
      const now = new Date();

      if (input.id) {
        const existing = (
          await db
            .select()
            .from(EventGuests)
            .where(eq(EventGuests.id, input.id))
        )[0];

        if (!existing) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Guest not found.",
          });
        }

        if (existing.eventId !== event.id) {
          throw new ActionError({
            code: "FORBIDDEN",
            message: "You cannot move guests to another event.",
          });
        }

        const updates: Partial<typeof EventGuests.$inferSelect> = {
          name: input.name,
          email: input.email,
          phone: input.phone,
          rsvpStatus: input.rsvpStatus,
          notes: input.notes,
          invitedAt: parseOptionalDate(input.invitedAt),
          respondedAt: parseOptionalDate(input.respondedAt),
        };

        await db
          .update(EventGuests)
          .set(updates)
          .where(eq(EventGuests.id, input.id));

        return {
          success: true,
          data: { guest: { ...existing, ...updates } },
        };
      }

      const guest = {
        id: crypto.randomUUID(),
        eventId: event.id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        rsvpStatus: input.rsvpStatus,
        notes: input.notes,
        invitedAt: parseOptionalDate(input.invitedAt),
        respondedAt: parseOptionalDate(input.respondedAt),
        createdAt: now,
      } satisfies typeof EventGuests.$inferSelect;

      await db.insert(EventGuests).values(guest);

      return {
        success: true,
        data: { guest },
      };
    },
  }),

  deleteEventGuest: defineAction({
    input: z.object({ id: z.string() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = (
        await db.select().from(EventGuests).where(eq(EventGuests.id, input.id))
      )[0];

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Guest not found.",
        });
      }

      await getEventForUser(user.id, existing.eventId);

      await db.delete(EventGuests).where(eq(EventGuests.id, input.id));

      return {
        success: true,
      };
    },
  }),
};

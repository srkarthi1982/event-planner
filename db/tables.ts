/**
 * Event Planner - plan events with tasks and guests.
 *
 * Design goals:
 * - Events with date/time & location.
 * - Tasks for preparation.
 * - Guest list with RSVP status.
 */

import { defineTable, column, NOW } from "astro:db";

export const Events = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    ownerUserId: column.text(),                   // event creator

    title: column.text(),                         // "Birthday Party", "Product Launch"
    description: column.text({ optional: true }),

    startDateTime: column.date({ optional: true }),
    endDateTime: column.date({ optional: true }),
    timeZone: column.text({ optional: true }),    // IANA TZ

    locationName: column.text({ optional: true }),
    locationAddress: column.text({ optional: true }),
    locationMapLink: column.text({ optional: true }),

    status: column.text({ optional: true }),      // "planning", "confirmed", "done", "cancelled"

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const EventTasks = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    eventId: column.text({
      references: () => Events.columns.id,
    }),
    userId: column.text({ optional: true }),      // owner/assignee if logged user

    title: column.text(),
    description: column.text({ optional: true }),
    dueDate: column.date({ optional: true }),
    status: column.text({ optional: true }),      // "todo", "in-progress", "done"
    priority: column.text({ optional: true }),    // "low", "medium", "high"

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const EventGuests = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    eventId: column.text({
      references: () => Events.columns.id,
    }),

    name: column.text(),
    email: column.text({ optional: true }),
    phone: column.text({ optional: true }),

    rsvpStatus: column.text({ optional: true }),  // "invited", "going", "maybe", "declined"
    notes: column.text({ optional: true }),

    invitedAt: column.date({ optional: true }),
    respondedAt: column.date({ optional: true }),

    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  Events,
  EventTasks,
  EventGuests,
} as const;

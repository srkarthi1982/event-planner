import { NOW, column, defineTable } from "astro:db";

export const Events = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    ownerUserId: column.text(),
    title: column.text(),
    description: column.text({ optional: true, deprecated: true }),
    startDateTime: column.text({ optional: true, deprecated: true }),
    endDateTime: column.text({ optional: true, deprecated: true }),
    timeZone: column.text({ optional: true, deprecated: true }),
    locationName: column.text({ optional: true, deprecated: true }),
    locationAddress: column.text({ optional: true, deprecated: true }),
    locationMapLink: column.text({ optional: true, deprecated: true }),
    eventType: column.text({ optional: true }),
    location: column.text({ optional: true }),
    startsAt: column.date({ optional: true }),
    endsAt: column.date({ optional: true }),
    notes: column.text({ optional: true }),
    status: column.text({ default: "draft" }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
    archivedAt: column.date({ optional: true }),
  },
  indexes: [
    { on: ["ownerUserId"] },
    { on: ["ownerUserId", "status"] },
    { on: ["startsAt"] },
  ],
});

export const EventTasks = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    eventId: column.text({ references: () => Events.columns.id }),
    userId: column.text({ optional: true, deprecated: true }),
    title: column.text(),
    description: column.text({ optional: true }),
    dueDate: column.text({ optional: true, deprecated: true }),
    status: column.text({ optional: true, deprecated: true }),
    priority: column.text({ optional: true, deprecated: true }),
    isCompleted: column.boolean({ default: false }),
    dueAt: column.date({ optional: true }),
    sortOrder: column.number({ default: 0 }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
    completedAt: column.date({ optional: true }),
  },
  indexes: [
    { on: ["eventId"] },
    { on: ["eventId", "sortOrder"] },
    { on: ["eventId", "isCompleted"] },
  ],
});

export const EventGuests = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    eventId: column.text({ references: () => Events.columns.id }),
    name: column.text(),
    email: column.text({ optional: true }),
    phone: column.text({ optional: true }),
    rsvpStatus: column.text({ optional: true, deprecated: true }),
    status: column.text({ default: "invited" }),
    notes: column.text({ optional: true }),
    invitedAt: column.text({ optional: true, deprecated: true }),
    respondedAt: column.text({ optional: true, deprecated: true }),
    sortOrder: column.number({ default: 0 }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
  indexes: [{ on: ["eventId"] }, { on: ["eventId", "sortOrder"] }, { on: ["eventId", "status"] }],
});

export const tables = { Events, EventTasks, EventGuests };

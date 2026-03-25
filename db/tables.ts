import { NOW, column, defineTable } from "astro:db";

export const Events = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    title: column.text(),
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
    { on: ["userId"] },
    { on: ["userId", "status"] },
    { on: ["startsAt"] },
  ],
});

export const EventTasks = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    eventId: column.text({ references: () => Events.columns.id }),
    title: column.text(),
    description: column.text({ optional: true }),
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
    status: column.text({ default: "invited" }),
    notes: column.text({ optional: true }),
    sortOrder: column.number({ default: 0 }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
  indexes: [{ on: ["eventId"] }, { on: ["eventId", "sortOrder"] }, { on: ["eventId", "status"] }],
});

export const tables = { Events, EventTasks, EventGuests };

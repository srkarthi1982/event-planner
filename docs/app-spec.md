# App Spec: event-planner

## 1) App Overview
- **App Name:** Event Planner
- **Category:** Planning / Events
- **Version:** V1
- **App Type:** DB-backed
- **Purpose:** Help an authenticated user manage personal events, guests, and event task checklists in a structured workspace.
- **Primary User:** A signed-in user planning and tracking their own events.

## 2) User Stories
- As a user, I want to create an event with dates, status, and notes, so that I can keep plans in one place.
- As a user, I want to add guests and tasks to an event, so that I can manage logistics around that event.
- As a user, I want to archive and restore events, so that I can keep history without deleting records.

## 3) Core Workflow
1. User signs in and opens `/app`.
2. User creates an event from the workspace drawer.
3. App saves the event to the user-scoped database and lists it in active events.
4. User opens the event detail page to add or manage tasks and guests.
5. User archives or restores the event from the workspace as needed.

## 4) Functional Behavior
- Events are stored per authenticated user and include title, type, location, date range, notes, and status.
- Event detail supports task create/update/toggle/delete and guest create/update/delete inside the event context.
- `/app` and event detail routes are protected; unauthenticated access redirects to the parent login flow.
- Current implementation supports archive and restore for events; hard delete for events is not part of V1.

## 5) Data & Storage
- **Storage type:** Astro DB on the app’s isolated Turso database
- **Main entities:** Events, EventTasks, EventGuests
- **Persistence expectations:** Event data persists across refresh and sessions for the authenticated owner.
- **User model:** Multi-user shared infrastructure with per-user isolation

## 6) Special Logic (Optional)
- Start and end datetimes are validated so an event cannot end before it starts.
- Task and guest rows use per-event sort order fields even though the current UI focuses on add/update/delete rather than explicit drag sorting.

## 7) Edge Cases & Error Handling
- Invalid IDs/routes: Missing or invalid event IDs should not expose another user’s data and are expected to fail safely.
- Empty input: Event and task creation require non-empty titles.
- Unauthorized access: Protected routes redirect to the parent login flow.
- Missing records: Non-owned or missing tasks/guests are blocked by ownership checks in the action layer.
- Invalid payload/state: Invalid date ranges are rejected before write.

## 8) Tester Verification Guide
### Core flow tests
- [ ] Create an event, confirm it appears in the workspace, then open its detail page.
- [ ] Add a task and a guest to the event, then toggle task completion and confirm the updated counts.

### Safety tests
- [ ] Try an invalid end date/time earlier than the start and confirm the action is rejected safely.
- [ ] Open a non-owned or missing event detail URL and confirm the app does not expose data or crash.
- [ ] Archive an event, confirm it moves to Archived, then restore it back to the active list.

### Negative tests
- [ ] Confirm events do not support hard delete in V1.
- [ ] Confirm invalid task or guest operations do not produce a server crash.

## 9) Out of Scope (V1)
- Public sharing or guest portals
- Calendar sync or invitation delivery
- Automated event generation or AI planning

## 10) Freeze Notes
- V1 release freeze: this document reflects the current repo implementation before final browser verification.
- This spec was populated conservatively from pages, actions, tables, and task-log context; edge-case behavior should be tightened only after freeze verification confirms runtime details.
- During freeze, only verification fixes and cleanup are allowed; no undocumented feature expansion.

import { db } from "./services/database";
import { eq, desc, and, gte, lte, sql, inArray } from "drizzle-orm";
import {
    appointmentSeries,
    appointmentExceptions,
    appointmentAttendees,
    insertAppointmentSeriesSchema,
    insertAppointmentExceptionSchema,
    users,
    orders,
    cases,
    repairs,
    customers
} from "@shared/schema";
import { requireAuth } from "./routes";

// Helper: expand recurring events in a date range
// Note: For now, simple implementation without full RRULE parsing
// Recurring events will be added in a future iteration
function expandRecurrence(
    series: any,
    timeMin: Date,
    timeMax: Date,
    exceptions: any[]
): any[] {
    const events: any[] = [];

    // For non-recurring events, just check if in range
    const start = new Date(series.startTime);
    if (start >= timeMin && start <= timeMax) {
        events.push({
            id: series.id,
            seriesId: series.id,
            originalStart: series.startTime,
            ...series,
            isRecurring: !!series.recurrenceRule,
        });
    }

    // TODO: Add full RRULE expansion when recurrence picker is implemented
    // For now, recurring events are shown at their original time only

    return events;
}

export function registerAgendaRoutes(app: any) {

    // GET /api/appointments - List with date range and filters
    app.get("/api/appointments", requireAuth, async (req: any, res: any) => {
        try {
            const { timeMin, timeMax, userId, type } = req.query;

            if (!timeMin || !timeMax) {
                return res.status(400).json({ error: "timeMin and timeMax are required" });
            }

            const minDate = new Date(timeMin);
            const maxDate = new Date(timeMax);

            console.log("Fetching appointments:", { timeMin, timeMax, userId, type, minDate: minDate.toISOString(), maxDate: maxDate.toISOString() });

            // Build conditions - include date range filter
            const conditions: any[] = [
                // Event starts before max date AND ends after min date (overlaps)
                lte(appointmentSeries.startTime, maxDate),
                gte(appointmentSeries.endTime, minDate),
            ];

            if (userId) {
                conditions.push(eq(appointmentSeries.assignedTo, userId));
            }

            if (type) {
                conditions.push(eq(appointmentSeries.type, type));
            }

            // Fetch series that might have occurrences in the range
            const seriesResult = await db
                .select()
                .from(appointmentSeries)
                .where(and(...conditions))
                .orderBy(appointmentSeries.startTime);

            console.log("Found series:", seriesResult.length, seriesResult.map(s => ({ id: s.id, title: s.title, startTime: s.startTime })));

            // Fetch all exceptions for these series (skip if no series found)
            const seriesIds = seriesResult.map(s => s.id);
            const exceptionsResult = seriesIds.length > 0
                ? await db
                    .select()
                    .from(appointmentExceptions)
                    .where(inArray(appointmentExceptions.seriesId, seriesIds))
                : [];

            // Expand recurring events (simple pass-through for now)
            const events: any[] = seriesResult.map(series => ({
                id: series.id,
                seriesId: series.id,
                originalStart: series.startTime instanceof Date ? series.startTime.toISOString() : series.startTime,
                ...series,
                startTime: series.startTime instanceof Date ? series.startTime.toISOString() : series.startTime,
                endTime: series.endTime instanceof Date ? series.endTime.toISOString() : series.endTime,
                isRecurring: !!series.recurrenceRule,
            }));

            // Sort by start time
            events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

            console.log("Returning events:", events.length);

            res.json({ events });
        } catch (error) {
            console.error("Error fetching appointments:", error);
            res.status(500).json({ error: "Failed to fetch appointments" });
        }
    });

    // GET /api/appointments/:id - Get single series
    app.get("/api/appointments/:id", requireAuth, async (req: any, res: any) => {
        try {
            const { id } = req.params;

            const [series] = await db
                .select()
                .from(appointmentSeries)
                .where(eq(appointmentSeries.id, id));

            if (!series) {
                return res.status(404).json({ error: "Appointment not found" });
            }

            // Get exceptions
            const exceptions = await db
                .select()
                .from(appointmentExceptions)
                .where(eq(appointmentExceptions.seriesId, id));

            // Get attendees
            const attendees = await db
                .select()
                .from(appointmentAttendees)
                .where(eq(appointmentAttendees.seriesId, id));

            res.json({ series, exceptions, attendees });
        } catch (error) {
            console.error("Error fetching appointment:", error);
            res.status(500).json({ error: "Failed to fetch appointment" });
        }
    });

    // POST /api/appointments - Create new series
    app.post("/api/appointments", requireAuth, async (req: any, res: any) => {
        try {
            console.log("Received appointment data:", JSON.stringify(req.body, null, 2));

            const parsed = insertAppointmentSeriesSchema.safeParse(req.body);

            if (!parsed.success) {
                console.log("Validation error:", parsed.error.message);
                return res.status(400).json({ error: parsed.error.message });
            }

            // Convert string dates to Date objects for Drizzle
            const { startTime, endTime, recurrenceEndDate, ...rest } = parsed.data;
            const data = {
                ...rest,
                startTime: new Date(startTime as string),
                endTime: new Date(endTime as string),
                recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate as string) : null,
                createdBy: req.user.id,
                assignedTo: rest.assignedTo || req.user.id,
            };

            console.log("Processed data:", JSON.stringify({
                ...data,
                startTime: data.startTime.toISOString(),
                endTime: data.endTime.toISOString(),
            }, null, 2));

            const [series] = await db
                .insert(appointmentSeries)
                .values(data)
                .returning();

            // Add creator as owner attendee
            await db.insert(appointmentAttendees).values({
                seriesId: series.id,
                userId: req.user.id,
                role: "owner",
                status: "accepted",
            });

            res.status(201).json(series);
        } catch (error) {
            console.error("Error creating appointment:", error);
            res.status(400).json({ error: "Failed to create appointment" });
        }
    });

    // PATCH /api/appointments/:id - Update series or instance
    app.patch("/api/appointments/:id", requireAuth, async (req: any, res: any) => {
        try {
            const { id } = req.params;
            console.log("PATCH appointment received:", JSON.stringify(req.body, null, 2));

            const { scope = "all", originalStart, data } = req.body;

            // Extract the update data - it's nested in 'data' from the frontend
            const updates = data || {};
            console.log("Updates to apply:", JSON.stringify(updates, null, 2));

            // Convert string dates to Date objects for Drizzle
            const processedUpdates: any = {};

            // Only copy fields that are valid for the appointmentSeries table
            const allowedFields = ['title', 'type', 'startTime', 'endTime', 'allDay', 'description',
                'location', 'isRemote', 'meetingLink', 'recurrenceRule', 'recurrenceEndDate',
                'color', 'assignedTo'];

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    processedUpdates[field] = updates[field];
                }
            }

            // Convert date strings to Date objects
            if (processedUpdates.startTime && typeof processedUpdates.startTime === 'string') {
                processedUpdates.startTime = new Date(processedUpdates.startTime);
            }
            if (processedUpdates.endTime && typeof processedUpdates.endTime === 'string') {
                processedUpdates.endTime = new Date(processedUpdates.endTime);
            }
            if (processedUpdates.recurrenceEndDate && typeof processedUpdates.recurrenceEndDate === 'string') {
                processedUpdates.recurrenceEndDate = new Date(processedUpdates.recurrenceEndDate);
            }

            console.log("Processed updates:", JSON.stringify({
                ...processedUpdates,
                startTime: processedUpdates.startTime?.toISOString?.() || processedUpdates.startTime,
                endTime: processedUpdates.endTime?.toISOString?.() || processedUpdates.endTime,
            }, null, 2));

            if (scope === "all" || !originalStart) {
                // Update the entire series
                const [updated] = await db
                    .update(appointmentSeries)
                    .set({ ...processedUpdates, updatedAt: new Date() })
                    .where(eq(appointmentSeries.id, id))
                    .returning();

                return res.json(updated);
            }

            if (scope === "single") {
                // Create or update exception for this occurrence
                const originalStartTime = new Date(originalStart);

                const [existing] = await db
                    .select()
                    .from(appointmentExceptions)
                    .where(
                        and(
                            eq(appointmentExceptions.seriesId, id),
                            eq(appointmentExceptions.originalStartTime, originalStartTime)
                        )
                    );

                if (existing) {
                    const [updated] = await db
                        .update(appointmentExceptions)
                        .set({
                            overrideStartTime: updates.startTime || null,
                            overrideEndTime: updates.endTime || null,
                            overrideTitle: updates.title || null,
                            overrideType: updates.type || null,
                            overrideLocation: updates.location || null,
                            updatedAt: new Date(),
                        })
                        .where(eq(appointmentExceptions.id, existing.id))
                        .returning();

                    return res.json(updated);
                }

                const [exception] = await db
                    .insert(appointmentExceptions)
                    .values({
                        seriesId: id,
                        originalStartTime,
                        overrideStartTime: updates.startTime || null,
                        overrideEndTime: updates.endTime || null,
                        overrideTitle: updates.title || null,
                        overrideType: updates.type || null,
                        overrideLocation: updates.location || null,
                    })
                    .returning();

                return res.json(exception);
            }

            if (scope === "future") {
                // Split: update UNTIL on current series, create new series for future
                const originalStartTime = new Date(originalStart);

                // Get original series
                const [originalSeries] = await db
                    .select()
                    .from(appointmentSeries)
                    .where(eq(appointmentSeries.id, id));

                if (!originalSeries) {
                    return res.status(404).json({ error: "Series not found" });
                }

                // Update original to end before this occurrence
                const untilDate = new Date(originalStartTime.getTime() - 1);
                await db
                    .update(appointmentSeries)
                    .set({
                        recurrenceEndDate: untilDate,
                        updatedAt: new Date()
                    })
                    .where(eq(appointmentSeries.id, id));

                // Create new series starting from this occurrence
                const [newSeries] = await db
                    .insert(appointmentSeries)
                    .values({
                        ...originalSeries,
                        id: undefined,
                        startTime: updates.startTime || originalStartTime,
                        endTime: updates.endTime || originalSeries.endTime,
                        title: updates.title || originalSeries.title,
                        type: updates.type || originalSeries.type,
                        location: updates.location || originalSeries.location,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .returning();

                return res.json(newSeries);
            }

            res.status(400).json({ error: "Invalid scope" });
        } catch (error) {
            console.error("Error updating appointment:", error);
            res.status(400).json({ error: "Failed to update appointment" });
        }
    });

    // DELETE /api/appointments/:id - Delete series or instance
    app.delete("/api/appointments/:id", requireAuth, async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { scope = "single", originalStart } = req.query;

            console.log("DELETE appointment request:", { id, scope, originalStart });

            if (scope === "all" || !originalStart) {
                // Delete entire series and all exceptions/attendees
                console.log("Deleting entire series:", id);

                const exceptionsResult = await db.delete(appointmentExceptions).where(eq(appointmentExceptions.seriesId, id));
                console.log("Deleted exceptions:", exceptionsResult);

                const attendeesResult = await db.delete(appointmentAttendees).where(eq(appointmentAttendees.seriesId, id));
                console.log("Deleted attendees:", attendeesResult);

                const seriesResult = await db.delete(appointmentSeries).where(eq(appointmentSeries.id, id));
                console.log("Deleted series:", seriesResult);

                return res.json({ message: "Series deleted", deleted: true });
            }

            if (scope === "single") {
                // Mark this occurrence as cancelled
                const originalStartTime = new Date(originalStart as string);

                await db.insert(appointmentExceptions).values({
                    seriesId: id,
                    originalStartTime,
                    isCancelled: true,
                });

                return res.json({ message: "Occurrence cancelled" });
            }

            if (scope === "future") {
                // Set recurrence end date to before this occurrence
                const originalStartTime = new Date(originalStart as string);
                const untilDate = new Date(originalStartTime.getTime() - 1);

                await db
                    .update(appointmentSeries)
                    .set({ recurrenceEndDate: untilDate, updatedAt: new Date() })
                    .where(eq(appointmentSeries.id, id));

                return res.json({ message: "Future occurrences deleted" });
            }

            res.status(400).json({ error: "Invalid scope" });
        } catch (error) {
            console.error("Error deleting appointment:", error);
            res.status(400).json({ error: "Failed to delete appointment" });
        }
    });

    // GET /api/appointments/export.ics - Export as iCal
    app.get("/api/appointments/export.ics", requireAuth, async (req: any, res: any) => {
        try {
            const { userId, type, timeMin, timeMax } = req.query;

            const conditions: any[] = [];
            if (userId) conditions.push(eq(appointmentSeries.assignedTo, userId));
            if (type) conditions.push(eq(appointmentSeries.type, type));
            if (timeMin) conditions.push(gte(appointmentSeries.startTime, new Date(timeMin as string)));
            if (timeMax) conditions.push(lte(appointmentSeries.startTime, new Date(timeMax as string)));

            const series = await db
                .select()
                .from(appointmentSeries)
                .where(conditions.length > 0 ? and(...conditions) : undefined);

            // Build iCal content
            let ical = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//DutchThriftHub//Agenda//NL",
                "CALSCALE:GREGORIAN",
                "METHOD:PUBLISH",
                "X-WR-TIMEZONE:Europe/Amsterdam",
            ];

            for (const s of series) {
                const start = new Date(s.startTime);
                const end = new Date(s.endTime);

                ical.push("BEGIN:VEVENT");
                ical.push(`UID:${s.id}@dutchthrifthub.com`);
                ical.push(`DTSTAMP:${formatICalDate(new Date())}`);
                ical.push(`DTSTART:${formatICalDate(start)}`);
                ical.push(`DTEND:${formatICalDate(end)}`);
                ical.push(`SUMMARY:${escapeICalText(s.title)}`);
                if (s.description) ical.push(`DESCRIPTION:${escapeICalText(s.description)}`);
                if (s.location) ical.push(`LOCATION:${escapeICalText(s.location)}`);
                if (s.recurrenceRule) ical.push(`RRULE:${s.recurrenceRule}`);
                ical.push(`LAST-MODIFIED:${formatICalDate(new Date(s.updatedAt || s.createdAt || new Date()))}`);
                ical.push("END:VEVENT");
            }

            ical.push("END:VCALENDAR");

            res.setHeader("Content-Type", "text/calendar; charset=utf-8");
            res.setHeader("Content-Disposition", "attachment; filename=agenda.ics");
            res.send(ical.join("\r\n"));
        } catch (error) {
            console.error("Error exporting calendar:", error);
            res.status(500).json({ error: "Failed to export calendar" });
        }
    });
}

// Helper functions for iCal
function formatICalDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeICalText(text: string): string {
    return text.replace(/[\\;,\n]/g, (match) => {
        if (match === "\n") return "\\n";
        return "\\" + match;
    });
}

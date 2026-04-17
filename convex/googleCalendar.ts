"use node";

import { google } from 'googleapis'
import { v } from 'convex/values'
import { type Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { action } from './_generated/server'

type DateParts = {
  year: number
  month: number
  day: number
}

type TimeParts = {
  hours: number
  minutes: number
}

function parseDurationMinutes(duration: string) {
  if (duration === '1h') return 60
  if (duration === '2h') return 120
  if (duration === '3h') return 180
  throw new Error(`Unsupported duration: ${duration}`)
}

function parseDate(date: string): DateParts {
  const [year, month, day] = date.split('-').map(Number)

  if (!year || !month || !day) {
    throw new Error('Invalid booking date')
  }

  return { year, month, day }
}

function parseTime(time: string): TimeParts {
  const [hours, minutes] = time.split(':').map(Number)

  if (hours === undefined || minutes === undefined) {
    throw new Error('Invalid booking time')
  }

  return { hours, minutes }
}

function formatDateTime(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

function buildEventWindow(date: string, time: string, duration: string) {
  const dateParts = parseDate(date)
  const timeParts = parseTime(time)
  const durationMinutes = parseDurationMinutes(duration)

  const startUtc = new Date(
    Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      timeParts.hours,
      timeParts.minutes,
      0,
      0,
    ),
  )
  const endUtc = new Date(startUtc.getTime() + durationMinutes * 60 * 1000)

  return {
    startDateTime: formatDateTime(startUtc),
    endDateTime: formatDateTime(endUtc),
  }
}

export const createBookingWithCalendarEvent = action({
  args: {
    name: v.string(),
    email: v.string(),
    date: v.string(),
    time: v.string(),
    duration: v.string(),
    service: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    bookingId: Id<'bookings'>
    googleEventId: string | null
    htmlLink: string | null
  }> => {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
    const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary'
    const timeZone = process.env.GOOGLE_CALENDAR_TIMEZONE ?? 'Australia/Sydney'

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing Google Calendar environment variables')
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const { startDateTime, endDateTime } = buildEventWindow(
      args.date,
      args.time,
      args.duration,
    )

    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `${args.service} - ${args.name}`,
        description: [
          `Name: ${args.name}`,
          `Email: ${args.email}`,
          `Service: ${args.service}`,
          args.notes ? `Notes: ${args.notes}` : undefined,
        ]
          .filter(Boolean)
          .join('\n'),
        start: {
          dateTime: startDateTime,
          timeZone,
        },
        end: {
          dateTime: endDateTime,
          timeZone,
        },
      },
    })

    const bookingId: Id<'bookings'> = await ctx.runMutation(
      internal.bookings.storeBooking,
      {
      name: args.name,
      email: args.email,
      date: args.date,
      time: args.time,
      duration: args.duration,
      service: args.service,
      notes: args.notes,
        googleEventId: event.data.id ?? undefined,
        googleCalendarId: calendarId,
      },
    )

    return {
      bookingId,
      googleEventId: event.data.id ?? null,
      htmlLink: event.data.htmlLink ?? null,
    }
  },
})

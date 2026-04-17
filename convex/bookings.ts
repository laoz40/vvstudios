import { internalMutation, query } from './_generated/server'
import { v } from 'convex/values'

export const storeBooking = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    date: v.string(),
    time: v.string(),
    duration: v.string(),
    service: v.string(),
    notes: v.optional(v.string()),
    googleEventId: v.optional(v.string()),
    googleCalendarId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('bookings', {
      name: args.name,
      email: args.email,
      date: args.date,
      time: args.time,
      duration: args.duration,
      service: args.service,
      notes: args.notes,
      googleEventId: args.googleEventId,
      googleCalendarId: args.googleCalendarId,
      createdAt: Date.now(),
    })
  },
})

export const getBookings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()

    if (!identity) {
      throw new Error('Not authenticated')
    }

    return await ctx.db
      .query('bookings')
      .withIndex('by_createdAt')
      .order('desc')
      .take(100)
  },
})

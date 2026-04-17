import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const createBooking = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    date: v.string(),
    time: v.string(),
    duration: v.string(),
    service: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('bookings', {
      name: args.name,
      email: args.email,
      date: args.date,
      time: args.time,
      duration: args.duration,
      service: args.service,
      notes: args.notes,
      createdAt: Date.now(),
    })

    return null
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
      .collect()
  },
})

import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  bookings: defineTable({
    name: v.string(),
    email: v.string(),
    date: v.string(),
    service: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_createdAt', ['createdAt']),
})

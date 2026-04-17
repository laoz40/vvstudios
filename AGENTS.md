<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->

## Goal

- booking system
- unauthenicated users can't view bookings, but can make bookings. (implemented)
- logged in users can view all bookings from db. (implemented)

## Desired Booking flow

- user submits booking form data to backend
- backend uses google calendar api to create a new event
- once created, return booking id
- then add booking data with id to database
- send confirmation email to user

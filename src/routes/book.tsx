import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { type ComponentProps, useState } from 'react'
import { api } from '../../convex/_generated/api'

const SERVICES = ['Consultation', 'Follow-up', 'Full Service', 'Quick Check']

const INITIAL_FORM = {
  name: '',
  email: '',
  date: '',
  service: SERVICES[0],
  notes: '',
}

export const Route = createFileRoute('/book')({
  component: BookingPage,
})

function BookingPage() {
  const createBooking = useMutation(api.bookings.createBooking)

  const [form, setForm] = useState(INITIAL_FORM)
  const [submittedBooking, setSubmittedBooking] = useState<null | {
    name: string
    date: string
    service: string
  }>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit: NonNullable<ComponentProps<'form'>['onSubmit']> = async (
    event,
  ) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await createBooking({
        name: form.name,
        email: form.email,
        date: form.date,
        service: form.service,
        notes: form.notes || undefined,
      })

      setSubmittedBooking({
        name: form.name,
        date: form.date,
        service: form.service,
      })
      setForm(INITIAL_FORM)
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Something went wrong.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submittedBooking) {
    return (
      <main>
        <h1>Booking confirmed</h1>
        <p>
          Thank you, {submittedBooking.name}. Your booking for{' '}
          <strong>{submittedBooking.service}</strong> on{' '}
          <strong>{submittedBooking.date}</strong> has been received.
        </p>
        <button type="button" onClick={() => setSubmittedBooking(null)}>
          Create another booking
        </button>
      </main>
    )
  }

  return (
    <main>
      <h1>Book</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Name *</label>
          <br />
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            required
          />
        </div>

        <div>
          <label htmlFor="email">Email *</label>
          <br />
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            required
          />
        </div>

        <div>
          <label htmlFor="date">Date *</label>
          <br />
          <input
            id="date"
            type="date"
            value={form.date}
            onChange={(event) =>
              setForm((current) => ({ ...current, date: event.target.value }))
            }
            required
          />
        </div>

        <div>
          <label htmlFor="service">Service *</label>
          <br />
          <select
            id="service"
            value={form.service}
            onChange={(event) =>
              setForm((current) => ({ ...current, service: event.target.value }))
            }
            required
          >
            {SERVICES.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="notes">Notes</label>
          <br />
          <textarea
            id="notes"
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            rows={4}
          />
        </div>

        {error ? <p>{error}</p> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Create booking'}
        </button>
      </form>
    </main>
  )
}

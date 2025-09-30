import { NextApiRequest, NextApiResponse } from 'next'

// In-memory storage for booked slots (in a real app, this would be a database)
// This will reset when the server restarts, which is fine for learning
let bookedSlots: string[] = []

// Response types for our API
type ApiResponse = {
  data: {
    type: 'ask_time' | 'no_slot' | 'booking_confirmed'
    payload: any
  }
}

// Request body type
type MessageRequest = {
  userId: string
  message: string
  requestId: string
  service?: string
}

// Simple regex to extract timestamp in format YYYY-MM-DD HH:mm
const TIME_SLOT_REGEX = /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/g

// Utility to generate nearby time suggestions
function generateSuggestedSlots(requestedSlot: string): string[] {
  try {
    const date = new Date(requestedSlot.replace(' ', 'T'))
    if (isNaN(date.getTime())) {
      return ['2025-01-15 10:00', '2025-01-15 14:00']
    }
    
    // Suggest one hour before and after
    const before = new Date(date.getTime() - 60 * 60 * 1000)
    const after = new Date(date.getTime() + 60 * 60 * 1000)
    
    const formatDateTime = (d: Date) => {
      return d.toISOString().slice(0, 16).replace('T', ' ')
    }
    
    return [formatDateTime(before), formatDateTime(after)]
  } catch {
    return ['2025-01-15 10:00', '2025-01-15 14:00']
  }
}

// Generate simple booking ID
function generateBookingId(): string {
  return 'BK' + Date.now().toString(36).toUpperCase()
}

export default function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse | { error: string }>) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate request body
  const { userId, message, requestId, service } = req.body as MessageRequest
  
  if (!userId || !message || !requestId) {
    return res.status(400).json({ error: 'Missing required fields: userId, message, requestId' })
  }

  console.log(`Processing message from ${userId} for service ${service}:`, message)
  console.log('Currently booked slots:', bookedSlots)

  // Extract time slots from the message using regex
  const matches = message.match(TIME_SLOT_REGEX)
  
  if (!matches || matches.length === 0) {
    // No time slot found in message
    return res.status(200).json({
      data: {
        type: 'ask_time',
        payload: {
          message: "Please specify a date and time for your appointment, for example: '2025-01-15 14:30' or 'January 15th at 2:30 PM'."
        }
      }
    })
  }

  // Use the first time slot found
  const requestedSlot = matches[0]
  
  // Check if slot is already booked
  if (bookedSlots.includes(requestedSlot)) {
    const suggestedSlots = generateSuggestedSlots(requestedSlot)
    
    return res.status(200).json({
      data: {
        type: 'no_slot',
        payload: {
          message: 'Slot already taken',
          requested: requestedSlot,
          suggestedSlots: suggestedSlots
        }
      }
    })
  }

  // Slot is available - book it!
  bookedSlots.push(requestedSlot)
  const bookingId = generateBookingId()
  
  console.log(`Booked slot ${requestedSlot} with ID ${bookingId}`)
  
  return res.status(200).json({
    data: {
      type: 'booking_confirmed',
      payload: {
        bookingId: bookingId,
        slot: requestedSlot,
        userId: userId,
        service: service,
        message: `Appointment confirmed for ${requestedSlot}`
      }
    }
  })
}

/*
TO INTEGRATE WITH N8N OR EXTERNAL WEBHOOK:
1. Replace the logic in this handler with a fetch() call to your n8n webhook
2. Pass along the userId, message, and requestId in the request body
3. Ensure your n8n workflow returns JSON in the shape: { "data": { "type": "...", "payload": {...} } }
4. Handle errors appropriately and return the same response structure

Example:
const response = await fetch('https://your-n8n-instance.com/webhook/booking', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, message, requestId })
})
const result = await response.json()
return res.status(200).json(result)
*/

/*
TO INTEGRATE WITH A REAL DATABASE:
1. Replace the bookedSlots array with actual database queries
2. Use your preferred database client (Prisma, MongoDB, Supabase, etc.)
3. Keep the same response structure for the frontend
4. Add proper error handling for database operations

Example with hypothetical DB:
const existingBooking = await db.bookings.findFirst({ where: { slot: requestedSlot } })
if (existingBooking) { ... }
const booking = await db.bookings.create({ data: { slot: requestedSlot, userId } })
*/
'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { format } from 'date-fns'

export default function SchedulePage() {
  const { organization } = useAuthStore()
  const { bookings, loading, loadBookings } = useBookingStore()

  useEffect(() => {
    if (organization?.id) {
      loadBookings(organization.id)
    }
  }, [organization, loadBookings])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Group bookings by date
  const bookingsByDate = bookings.reduce((acc, booking) => {
    const bookingDate = booking.date instanceof Date ? booking.date : new Date(booking.date)
    const dateKey = format(bookingDate, 'yyyy-MM-dd')
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(booking)
    return acc
  }, {} as Record<string, typeof bookings>)

  const sortedDates = Object.keys(bookingsByDate).sort()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Schedule</h1>
        <p className="text-gray-600 mt-1">View and manage bookings</p>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No bookings found</h3>
          <p className="mt-2 text-gray-500">Bookings will appear here once operatives are scheduled.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const dateBookings = bookingsByDate[dateKey]
            const date = new Date(dateKey)
            
            return (
              <div key={dateKey} className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {format(date, 'EEEE, MMMM d, yyyy')}
                </h2>
                <div className="space-y-3">
                  {dateBookings.map((booking) => {
                    const timeSlot = typeof booking.timeSlot === 'string' ? booking.timeSlot : booking.timeSlot
                    const status = typeof booking.status === 'string' ? booking.status : booking.status
                    return (
                      <div key={booking.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">Operative ID: {booking.operativeId}</p>
                            <p className="text-sm text-gray-600 mt-1">Project ID: {booking.projectId}</p>
                            <p className="text-sm text-gray-600">Time: {timeSlot}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {status}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

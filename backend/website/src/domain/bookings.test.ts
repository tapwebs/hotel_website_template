import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TRANSITIONS, addDays, canCancel, canTransition, daysBetween, isValidDate, newReference, quote, todayIST } from './bookings.ts'

test('quote: nights x rate x rooms, whole rupees', () => {
  assert.deepEqual(quote('deluxe', '2030-01-10', '2030-01-13', 1), { nights: 3, ratePerNight: 1500, roomName: 'Deluxe Room', totalAmount: 4500 })
  assert.equal(quote('super-deluxe', '2030-01-10', '2030-01-12', 1).totalAmount, 4600)
  for (const rooms of [1, 2, 3, 4, 5]) {
    assert.equal(quote('deluxe', '2030-02-27', '2030-03-02', rooms).totalAmount, 3 * 1500 * rooms) // crosses month end
    assert.equal(quote('super-deluxe', '2030-01-01', '2030-01-02', rooms).totalAmount, 2300 * rooms)
  }
})

test('references: format, alphabet, no duplicates in 1000', () => {
  const seen = new Set<string>()
  for (let i = 0; i < 1000; i++) {
    const r = newReference()
    assert.match(r, /^HDH-[A-HJ-NP-Z2-9]{6}$/)
    seen.add(r)
  }
  assert.equal(seen.size, 1000)
})

test('todayIST flips at 18:30 UTC', () => {
  assert.equal(todayIST(new Date('2026-10-16T19:00:00Z')), '2026-10-17')
  assert.equal(todayIST(new Date('2026-10-16T18:29:00Z')), '2026-10-16')
})

test('date helpers', () => {
  assert.equal(isValidDate('2026-02-30'), false)
  assert.equal(isValidDate('2028-02-29'), true)
  assert.equal(isValidDate('2026-2-3'), false)
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3)
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
})

test('transitions and cancellability', () => {
  assert.deepEqual(TRANSITIONS.cancelled, [])
  assert.equal(canTransition('pending', 'confirmed'), true)
  assert.equal(canTransition('pending', 'completed'), false)
  assert.equal(canTransition('confirmed', 'pending'), false)
  assert.equal(canTransition('completed', 'completed'), true) // same value is a no-op
  assert.equal(canTransition('cancelled', 'confirmed'), false)
  assert.equal(canCancel({ status: 'pending', checkIn: '2030-01-02' }, '2030-01-02'), true)
  assert.equal(canCancel({ status: 'confirmed', checkIn: '2030-01-01' }, '2030-01-02'), false)
  assert.equal(canCancel({ status: 'cancelled', checkIn: '2031-01-01' }, '2030-01-02'), false)
})

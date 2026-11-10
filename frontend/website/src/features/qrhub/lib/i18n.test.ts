import { describe, expect, it } from 'vitest'
import { LANG_KEY, pick, readLang, t } from './i18n'

describe('EN / HI', () => {
  it('translates fixed labels', () => {
    expect(t('en', 'bookStay')).toBe('Book a Stay')
    expect(t('hi', 'bookStay')).toBe('कमरा बुक करें')
  })
  it('uses the Hindi value when present, otherwise falls back to English', () => {
    expect(pick('hi', 'Rooms', 'कमरे')).toBe('कमरे')
    expect(pick('hi', 'Rooms', '')).toBe('Rooms')
    expect(pick('hi', 'Rooms', '   ')).toBe('Rooms')
    expect(pick('hi', 'Rooms', null)).toBe('Rooms')
    expect(pick('en', 'Rooms', 'कमरे')).toBe('Rooms')
  })
  it('remembers the language and defaults to English', () => {
    expect(readLang({ getItem: (k) => (k === LANG_KEY ? 'hi' : null) })).toBe('hi')
    expect(readLang({ getItem: () => 'fr' })).toBe('en')
    expect(
      readLang({
        getItem: () => {
          throw new Error('blocked')
        },
      }),
    ).toBe('en')
  })
})

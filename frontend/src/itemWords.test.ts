import { describe, expect, it } from 'vitest'
import { fixItemWords } from './itemWords.ts'

describe('fixItemWords', () => {
  it('corrects a misspelled word to the listed spelling', () => {
    expect(fixItemWords('Great value vineagar')).toBe('Great value vinegar')
    expect(fixItemWords('Chocolate Pretezels')).toBe('Chocolate Pretzels')
    expect(fixItemWords('Scrub dadddy Sponages')).toBe('Scrub daddy Sponges')
  })

  it('corrects a word that is cut short or has a letter too many or too few', () => {
    expect(fixItemWords('Romain hearts lettuce')).toBe('Romaine hearts lettuce')
    expect(fixItemWords('Toosie rolls')).toBe('Tootsie rolls')
    expect(fixItemWords('Tumeric')).toBe('Turmeric')
    expect(fixItemWords('Brocolli')).toBe('Broccoli')
  })

  it('keeps the case the word was typed in', () => {
    expect(fixItemWords('BROCOLLI CROWNS')).toBe('BROCCOLI CROWNS')
    expect(fixItemWords('brocolli crowns')).toBe('broccoli crowns')
  })

  it('leaves a word that is already right, or not close to a listed word, as typed', () => {
    expect(fixItemWords('Broccoli crowns')).toBe('Broccoli crowns')
    expect(fixItemWords('Baby spinach')).toBe('Baby spinach')
    expect(fixItemWords('Romano cheese')).toBe('Romano cheese')
    expect(fixItemWords('Pearl barley')).toBe('Pearl barley')
  })

  it('does not turn a word into its singular, its plural or a longer word', () => {
    expect(fixItemWords('Pretzel sticks')).toBe('Pretzel sticks')
    expect(fixItemWords('Broccolini')).toBe('Broccolini')
  })
})

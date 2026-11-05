/**
 * Card formats for shared roast images.
 * safeTop and safeBottom are the story safe zone in pixels.
 * @type {Readonly<Record<string, { id: string, label: string, width: number, height: number, safeTop: number, safeBottom: number }>>}
 */
export const CARD_FORMATS = Object.freeze({
  post: Object.freeze({
    id: 'post',
    label: 'Post',
    width: 1080,
    height: 1350,
    safeTop: 0,
    safeBottom: 0,
  }),
  story: Object.freeze({
    id: 'story',
    label: 'Story',
    width: 1080,
    height: 1920,
    safeTop: 250,
    safeBottom: 250,
  }),
});
'use client'

import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

/**
 * How a drag starts, for every sortable list in the panel.
 *
 * One place, because the two lists must feel the same and because the touch
 * configuration is the part that is easy to get wrong.
 *
 * ## Why three sensors and not one `PointerSensor`
 *
 * `PointerSensor` covers mouse and touch with the same rule, and the two need
 * different ones:
 *
 * - **Mouse**: a few pixels of travel. A pointer that moves six pixels while
 *   held down is dragging, and nothing else on the page wants that gesture.
 * - **Touch**: a finger that moves is almost always *scrolling*. Using distance
 *   there means the list steals every scroll that happens to begin on a card,
 *   and the host cannot get down the page. So touch waits: press and hold for a
 *   moment, and a little movement during that hold is forgiven as an unsteady
 *   finger rather than treated as a cancel.
 *
 * The handle also needs `touch-action: none` — dnd-kit sets that on its overlay
 * but not on your handle, and without it the browser claims the gesture for
 * scrolling before the sensor ever sees it.
 */
export function useSortableSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

/**
 * The class every drag handle needs.
 *
 * `touch-none` is the load-bearing part: without it a touch drag never starts,
 * because the browser has already decided the gesture is a scroll.
 */
export const DRAG_HANDLE_CLASS = 'touch-none select-none'

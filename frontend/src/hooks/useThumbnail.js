import { useInViewport } from "./useInViewport.js"

// useThumbnail(modGuid) — returns { ref, src }. src is null until the element
// referenced by `ref` enters the viewport. Once visible, src becomes the
// backend thumb URL; browser handles its own caching (the backend sets
// Cache-Control: public, max-age=2592000).
export function useThumbnail(modGuid) {
  const [ref, inView] = useInViewport("200px")
  const src = inView && modGuid ? `/api/workshop/thumb/${modGuid}` : null
  return { ref, src }
}

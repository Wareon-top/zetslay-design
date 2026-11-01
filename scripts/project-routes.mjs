// Hash plugin routes resolve in the cabinet router rather than to HTML ids.
// Only known catalogue entries qualify; misspelled ids still fail validation.
export function missingAppAnchors(anchors,ids,plugins){return [...new Set(anchors.filter(anchor=>!ids.has(anchor)&&!(anchor.startsWith('plugins/')&&ids.has('plugins')&&plugins.has(anchor.slice(8)))))];}

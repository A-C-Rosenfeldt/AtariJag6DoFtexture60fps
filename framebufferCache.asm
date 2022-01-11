; small tris write phrases
; large tris write 4 stacked phrases
;; RWM .. no come on. Don't access phrases outside of triangle in external RAM!
;;; If code blows up, align tiles to the center vertex

;;;;;;;;;;; rasterize large triangles over 8x8 tiles  ( I start with affine .. perspective is later)
;; use bilinear if all corners are inside
;; maybe try 8x4 and 4x8 and 4x4
;; calculate 

; So we still separate in upper and lower triangle
; we floor and ceil the line to tile line
; we floor uper line and lower line of left edge
; we ceil  uper line and lower line of right edge
; loop over tiles. Check for each pixel if inside triangle
; not much space for other code paths, but tips could be done like small tries

;;;;;;; Call into the texture mapper
;;;;;;;;;; See ./transformation.asm for the   Vertex Transformation






;;;;;;  Edge Clipping
;transformed vertices know if they are inside or outside
;Clipping is the exception because we have highly detailed enemies on small screen area  (  cars monsters)

;For each edge in the mesh we can save some linear equations to find the cut with the viewing frustum. We get y on the sides and x on top and bottom. We always get z.
;Division takes 18 cycles an mabe I don't want to divide too much
;The idea is to descirbe the edge as interpolation between Vertices
;now we try to order the points ( t=0 one vertex ), (1=1 other vertex ), ( t solves cut with frustum )
;We use common denominators and just flood the multiplication unit

;Only one DIV needed
;Saturate the result to 160 / 120 respectivly  ( rounding errors in the MAC precalculation step )

;after rounding
;check if edge goes through (0,0,0)  .. truncated frustum. Edges are not supposed to stick through the eye of the player. A water plane and an edge modelling the waves .. somehow. Saturate Z !

;https://en.wikipedia.org/wiki/Line_(geometry)
; Would be cool to have pure Multiplication code to check if edge crosses screen border ( early out if vertices are not on different sides)
; shear transformation using two frustum edges and the edge in question
; CMP vertex position

MOVE B,3 ; backup deltaY   ; todo swap register assignment
JR Z , never render this edge
{
DIV A,B ;x Per y   ;  clear DIV flag
}






;;;;;;;;;;;; Vertex  subPixel

;As is the nature of the mesh, we could reuse the vertex if we pick a vertex and draw all adjoint triangles
;We store this in a vertex buffer
;SubpixelForVertex( x,0 ; y,1 )
MOVE  ; get the fraction
SHQR
AND ,2 
IMULT deltaU, 2
IMAC  deltaV, 3
REASMAC 5  ; for Bresenham






;;;;;;;;; Triangles rasterizer

; A triangle can be visible if only one edge is visble => screen corners become other vertices.
; A triangle may be visible without any edge or vertex on screen .. all corner become vertices.
; Use raytracing to determine [W,U,V] at the corners. Early out if W is behind camera. Multiply with W to get U and V.


;Backface culling
IMULT
IMAC
RESMAC


;EdgeStartingAtVertex .. going to vertex
;Bresenham is quite cheap. Pipeline wants us to do two at a time. No need to reused values for adjacent triangles
;params(
; x -> 8
; deltaX -> A
;delta y ->B
;)

less_jumps:
SUBQ 1,2
JR C, return

{

ADD 8,3
ADD 9,5  ; Bresenham
; pipeline. Maybe do both edges at once like those two z values
JR N,less_jumps  
ADDQ 1,3  ; one px more to the side
ADD 19,5  ; Bresenham

SUBQ 1,2
}
JR C, return



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

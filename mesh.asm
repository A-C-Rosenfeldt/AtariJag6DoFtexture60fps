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
; The edge of the frustum [0,1,2] cross the direction of the edge [4,5,6] gives us a plane with a normal [8,9,A]

{
	{
		NEG 4
		IMULT 0,5
		IMAC  4,1
		RESMAC A
		NEG 5
		IMULT 1,6
		IMAC  5,2
		RESMAC 8
		NEG 4
		NEG 6
		IMULT 2,4
		IMAC  6,0
		RESMAC 9 
		;NEG 9

		; The inner product between normal and vertex [CDE] tells us if the vertex is inside and thus this edge crosses the edge of the screen ; Alternatively the roles of vertex and edge direction can be swapped ( to reduce number of calculations depending of mesh "topology" )
		IMULT 8,C
		IMAC  9,E
		IMAC  A,E
		RESMAC F  ; flags unaffected

		;store
		OR F,F
		XOR 10,10
		BSET 31,10
		AND 10,F   ; sign
		OR F,11    ; store
		RORQ 30,11  ; one wrap around to lower bits

		; next frustum edge
		NEG 0
		; RORQ in delay slot
	}
	JR N,
	NEG 1
	NOP
}
JR N,

;11 has 16 different values. 4 of them mean that the edge is off screen.


; Repeat for all corners

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
; For triangles with textureCount != 1 or with Gouraud  .. we better argue using interpolation (s,t)
; interpolation of the vertices need to result in the same point as frustum corner scaled ( we choose w as variable)
; Matrix inversion gives us s,t,w
;https://en.wikipedia.org/wiki/Invertible_matrix#Inversion_of_3_%C3%97_3_matrices
; Inversion consists of 3 cross products ( I use cross products elsewhere )
; Inner product of last column with cross product ( backup copy) of first two give denominator
;DIV
; Matrix multiplication (MMULT) gives us Gouraud, U, V


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

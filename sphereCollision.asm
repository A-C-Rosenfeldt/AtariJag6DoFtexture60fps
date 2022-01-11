; the game will feature ships with sperical shields shooting sperical fire balls.
; A hit kills the fire ball. If ships hit each other, they are dead.
; BruteFore JRISC speed to check nxn

; each ship has coordinate system

; this 0,1,2
nomalize:
IMULTN 0,0
IMAC 1,1
IMAC 2,2
RESMAC 3
XOR 6,6
BSET 31,6
SUB 6,3 ; Taylor series of DIV aka 1/x
SHRQ 1,3 ; Taylor series of xsqrt(x)
;DIV 3, 6  ; div is mirrored vs common notation   because..dunno
MULT 6,0
MULT 6,0
MULT 6,0

; that 4,5,6
orthogonize: 
IMULTN 0,4
IMAC 

;Taylor again
SUB 4,1  ;  also commuted


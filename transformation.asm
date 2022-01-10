;Params(
; vertex 4,5,6
; camera position 0,1,2
; camera rotation
; 10 11 12
; 14 15 16
; 18 19 1A
;)

; everything is relative
SUB 0,4
SUB 1,5
SUB 2,6

;float with a common exponent .. I plan to use a smart z-buffer
NORM 4, 13
NORM 5, 17
NORM 6, 1B
; shifted right : positive  ( like SH is oriented  |  zeroed out exponent used for overflow ) 
; shifted to the lef: negative  ( camera close to vertex)

;max  simple and stupid .. Maybe reuse for triangle y
CMP 13,17
CMP 17,18 ; pipeline effect
JR N,   
{ ; 13<17
	JR N,  
	{  
		MOVE 18,7 ; delay slot
		JR , behind_else
	}else
	MOVE 17,7 ; delay slot
	JR , behind_else
}else{
	CMP 13,18
	NOP
	JR N
	{ ; 13<18
		MOVE 18,7	
	}else{
		MOVE 13,7
	}
}
behind_else:
; SAT16 17  is TOM only .. I don't like that

ADDQ 5,7 ; I think this is the difference between IEE and fixed point.  ToDo: check
SH 4,7
SH 5,7
SH 6,7

IMULTN 10,4
IMACN  11,5
IMACN  12,6
RESMAC 13

IMULTN 10,4
IMACN  11,5
IMACN  12,6
RESMAC 17

IMULTN 10,4
IMACN  11,5
IMACN  12,6
RESMAC 1B

; fixed point
SHRQ 16,13   ; field of view 90° at 256px. Screen half width 160px . 7 bit suppixel precision
SHRQ 16,14   ; 320 px full width and 240p full height lead to square pixels
SHRQ 16,15   ; z buffer is 16 bit anyway




;; Alternative multiplication. It looks like we have to group 3 vertices to make sense of this.
; Params(
;)

; pack 16 bit factors
MOVE 4,14
SHLQ 16,14
OR 5,14
MOVE 6,15  ; Seems like we can get away with one pack less when we only have 3 registers. Vertices are in the first factor. If packing is along rows .. we have to pack internal of a vertex. No 4 vertex  vertex-buffer.

; core

MOVEI F1A104, 1F   ; DSP Matrix register
MOVEQ 3,1E   ; Matrix width . I don't need this row column thing. I leave bit 4 as zero. Convention over configuration
STORE 1E,1F
ADDQ 1F,4  ; DSP Matrix register   .. So byte addressing after all?
STORE MAtrix address, 1F ; Matrix needs to be 32bit aligned :    2-11 MTXADDR Matrix address.   This is the camera matrix 

MMULT 0 /* Alternative register bank, these vertices */, 13 /* this register bank, this register and following */
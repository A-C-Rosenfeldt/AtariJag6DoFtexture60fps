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

; float into fixed point position ( we don't tell MMULT about the floating stuff )
SHRQ 0x10,13   ; field of view 90° at 256px. Screen half width 160px . 7 bit suppixel precision
SHRQ 10,14   ; 320 px full width and 240p full height lead to square pixels
SHRQ 10,15   ; z buffer is 16 bit anyway




;; Alternative multiplication. It looks like we have to group 3 vertices to make sense of this.
; Params(
;)

; pack 16 bit factors. There is only one Matrix width because it is square ( I don't know why they limit the possiblities )
; pack 3 words looks like this
MOVE 4,14
SHLQ 16,14
OR 5,14
MOVE 6,15  ; Seems like we can get away with one pack less when we only have 3 registers. Vertices are in the first factor. If packing is along rows .. we have to pack internal of a vertex. No 4 vertex  vertex-buffer.

; Here we only care for the vertex itself .. not the attributes. We could store these parts in different phrases and maybe this time don't invoke the blitter
LOADP 14,15
LOAD (A),14
; We got 8 bytes
; We want 9 words
; Then again a lot of level geometry is like Minecraft and does not need a lot of bits
; Escape Codes?
; combine packing with floating can be done like this

; 7 contains the floating value ( propertie of the source )
MOVQ 0x10, 10 ; the shifter  ( target )
ADD 10,7		;  Was: ADDQ 5,7 ; I think this is the difference between IEE and fixed point.  ToDo: check
SH 4,7
SH 6,7
SUB 10,7
NEG 10     ; SH2 has this great combined command
ADQ 4,10   ; but JRISC lacks the swapped sub
ADD 10,7
SH 5,7
OR 5,4     ; pack
; 6 is dangling pack .. https://www.mulle-kybernetik.com/jagdox/risc_doc.html  says that we need to solve this. Unroll loop for two vertices?

; core

MOVEI F1A104, 1F   ; DSP Matrix register
MOVEQ 3,1E   ; Matrix width . I don't need this row column thing. I leave bit 4 as zero. Convention over configuration
STORE 1E,1F
ADDQ 1F,4  ; DSP Matrix register   .. So byte addressing after all?
STORE MAtrix address, 1F ; Matrix needs to be 32bit aligned :    2-11 MTXADDR Matrix address.   This is the camera matrix 

MMULT 0 /* Alternative register bank, these vertices */, 13 /* this register bank, this register and following */






;[13,17,1B] x y z
OR 1B,1B  ;   no nono:  no jump for negative or zero .. like on 6502
JR NZ, outside
;nonsense NEG 1B  ; compensate
XOR 6,6
BSET 16,6
;F0211C = 1  16.16 / 16.16   to keep everything neatly centered if we round anyway
DIV 1B,6  ; Cycle 18: Destination register write   looks like we should do something else now .  DIV;DIV has a bug and the scoreboard cannot avoid any hazard of register reuse
;; 
NOP ;; 16 of that   .. pixel shader? Stagger with next vertex group?
MOVE 13,4
MOVE 17,5
;;
IMULT 6,4
IMULT 6,5
CMP 4, 120px.fraction
JR ~Z ~N , outside
CMP 5, 160px.fraction
JR ~Z ~N , outside

inside:

outside:

; To use the high register for phrase mode is a safe manner, we need to
LoadP , 0
or 0,0 ; wait
Load (hi) ,1
or 1,1
Store 2,(hi)
; ?? 
StoreP 3,
:
LoadP ,0  ; repeat
; now we know that hi register was done

; To operate on packed pixels in a fast manner we need to concentrate on carry bits.
; We use narrow pixel and fill horizontal phrases .. but 4 on top of each other
; we store a large as possible block of texture phrases in GPU ram ( come from blitter) .. ??
; But we have 32 bit registers. So we also rende 2x2 px
; we have different regs, different ror, different jumps for each target px
; So it looks like we have 4x4 = 16 code blocks
; this code is espcially for small (non slither) triangles and near the vertices,
; thus we need ReadModifyWrite and per pixel check before each block?

Move px_in_first_phrase, A

LoadI #FFFF,2
RORQ #16,0
#if on left side of block
{
	move 5,1 ; we may still need the other part
	AND 2,1
}
OR   1,0
SubQ 1, A
J ~C
{
	StoreP ,B
	AddQ  framePitch, B
	moveQ 4, A
}

; but we pull from 2x2 texture
; each positin in this block corresponds to one position in code
{
{
	ADD delta, fractionU
}
JR ~C,
RORQ 16,3  ; move to the left


	ADD delta, fractionV
}
JR ~C,
AddQ 4,7   ; weird memory layout from LoadP


; on the left side of the square
AddQ 8, 7   ; next phrase  check cache?

; on the lower side of the square
moveI pitch, 9
AddQ 9, 7   ; next phrase   check cache 


; Since we cache 4x4 texels and choose MipMap to blow up the texture to no load any unecessary data, we need to draw thick lines ( not scanlines )
; So we need to draw 4x4 px into framebuffer
; right, left, right, left
; For each row we need to check the Deltas ( we interpolate the, and thus they can switch sign) and set UV_flip_mirror and also flip U,V,DeltaU,DeltaV
; Then we can go to the block to the right. 2 assciative and 4 slot cache should not trash itself until our polygons is more wide than about 16 texels .. but do we even care at this point?

; GPU Flags Register F02100 Read/Write
; DSP Flags Register F1A100 Read/Write
; 14:REGPAG  to double buffer the what? The unpacked colors!!! No way.

; Here for easy readablity I place the color data in the upper part of the 16 registers
; C
; [45]
; [67]
; R
; [89]
; [AB]
; Y
; [CD]
; [EF]

MOVEI LoadProcedure, 10

ADD 0,1  ;  Add delta to accumulater
ADD 2,3  ;  for V like for U
JR C   ; pipeline delays the flag setting. so this is for U
{
	ADDQ 1,12 ; Crazy, this split ADD is compatible with the blitter
	JR C ; this is for V
	{
		MOVE PC,11
		ADDQ 8,11  ; no loop wanted here
		async J  , 10
		{
		ADDQ 1,13 ; Crazy, this split ADD is compatible with the blitter
		; diagonal
		MOVE 7,4
		MOVE B,8
		MOVE F,C
		; set some register to indicate the load pattern. I don't want J back and forth. Can I just store addresses in 3 registers ?
		}		
	}else{
		async J  ,  LoadProcedure
		MOVE 5,4
		MOVE 0,8
		MOVE D,C
		MOVE 7,6
		MOVE B,A
		MOVE F,E
		
	}
}else{
	JR C ; this is for V   ;  Really:  J ~C  outOfhere
	{
		J  ,  ./2associativeCache.asm/LoadProcedure( buffer )
		ADDQ 1,13 ; Crazy, this split ADD is compatible with the blitter
		MOVE 6,4
		MOVE A,8
		MOVE E,C
		MOVE 7,5
		MOVE B,9
		MOVE F,D
		
	}
}

unpack:
await LoadProcedure ; await blitter ;  CounterRegister is WriteOnly. So we have exactly two ways to lock on Bliter: IdleBit or Interrupt
;eventually (misaligned reads for the blitter) the LoadProcedure needs to be called multiple time
unpack
call ./bilinear.asm  ( UV_flip_mirror, buffer)




;About all the branches:

00000 0 Jump always
00001 1 NZ Jump if zero flag is clear
00010 2 Z Jump if zero flag is set
00100 4 NC Jump if carry flag is clear
00101 5 NC NZ Jump if carry flag is clear and zero flag is clear
00110 6 NC Z Jump if carry flag is clear and zero flag is set
01000 8 C Jump if carry flag is set
01001 9 C NZ Jump if carry flag is set and zero flag is clear
01010 A C Z Jump if carry flag is set and zero flag is set
10100 14 NN Jump if negative flag is clear
10101 15 NN NZ Jump if negative flag is clear and zero flag is clear
10110 16 NN Z Jump if negative flag is clear and zero flag is set
11000 18 N Jump if negative flag is set
11001 19 N NZ Jump if negative flag is set and zero flag is clear
11010 1A N Z Jump if negative flag is set and zero flag is set
11111 1F Jump never
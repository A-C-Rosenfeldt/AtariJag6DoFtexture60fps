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

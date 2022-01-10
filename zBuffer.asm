; Param: PixelCount, 3

reduceJumps:

SUBQ 1,3
JR C, return    ; I guess that a C compiler will create a while loop in this way. I just was never sure about the number of jumps in while and for loops
{
	; DelaySlot not a big problem if cached and not a jump into subroutine?
	LOAD 0,1  ; load old value from z buffer  
	CMP 1,2 ; compare with our new value	
	JR N, reduceJumps
	; nothing to put in the delay slot
	STORE 2,0  ; Overwrite z value
	STORE 4,5  ; write pixel  ; put in the delay slot
	SUBQ 1,3
}
JR ~C




; How to deal with the pipeline? Look at the blitter! Process two pixels at once
; We could reserve carries inside like we do in the cache. But maybe we want the full 16bit .. and lets just try it
reduceJumps:
JR N, reduceJumps_11
reduceJumps_01

SUBQ 1,3
JR C, return    ; I guess that a C compiler will create a while loop in this way. I just was never sure about the number of jumps in while and for loops
{
	; DelaySlot not a big problem if cached and not a jump into subroutine?
	LOAD 0,1  ; load old values from z buffer
	MOVE 1,6
	AND Low16BitMask,1
	
	CMP 1,2 ; compare with our new low value
	SHRQ 16,6  ; wait for the flags of the low value
	JR N, reduceJumps
	CMP 6,9 ; compare with our new hi value    in delay slot
	NOP ; wait for flags
	JR N, reduceJumps_10
	NOP ; delay slot
	reduceJumps_00:

	; nothing to put in the delay slot
	STORE 2,0  ; Overwrite z value
	STORE 4,5  ; write pixel  ; put in the delay slot
	SUBQ 1,3
}
JR ~C
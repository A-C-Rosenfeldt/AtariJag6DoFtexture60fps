; z compare on GPU  -- compatible to z-buffer
;Even for scanline span rendering and beam trees an effective way to sort two non-intersecting polygons by z is the trace a ray at a pixel covered by both. So we deal with the same z value as calculated by the blitter.
;Delta int pixels on screen have far less than 16 bits
;p=polygon [0,1]  . d=delta . xy along axis


sub common.x,p0.dx
sub common.y,p0.dy

mov common.x,tx ; trash or not?
sub p1.dx,tx  ; need to switch sign for compare . Trash the other register
mov common.y,ty
sub p1.dy,ty 

for i=0,1 {
mov res,pass 
;4 mal
ror 16,pyz ; switch between high and low word. Thanks to quick value this is single cycle. 
imult p0.xz, p0.dx ; use one factor from two lines above
imac p0.yz,p0.dy ; use one factor from two lines above
; bug in JRISC wants me to contiue with imacs. No idea how they thought this works well with interleave?
imac p0.xz, tx
imac p0.yz,ty
resmac res
}
SHR 16,pass
add pass,res
(cond.)

;33 cycles. Bit overlap : still needs to compare 3 with 3







;z overlap (global for whole polygons)
acc_and=1
acc_or=0

sub z00,z10
sub z01,z10
;9 comparisons   times 4 (glue logic) => 28 cycles   -- JRISC really is geared towards crunching numbers, but not logic 
;shr 15 ; sign bit only
and ,accu_and
or ,accu_or

? acc_and.31=1  ; 0 in front
? acc_or=0 ; 1 in front





; 3d check is my pet peeve. It works for static levels, but I already solved that. Anyway, these are even more in need of caching. Ah, JRISC does not like cache.

cmp triangle index
	swap

sub triangle_indices
shr
SHL 16,cx
ror cx,triangle_indices
mul ti,ti ; rem ' LU trianglular matrix packed
and ti, high_word
add triangluar_low_word, bit_pointer
mov
sh ,byte_address
loadb , byte
shl bit_address, byte
btest 1   'Already checked z-relation?
jump
btest 0  ' who is in front?
SHR 15,cx  (from swap above)
xor cx








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
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



;Software SRCSHADE Gouraud + texture
twoCRY two CRY px in one register. Rotated so that on Y is in the high byte
Intensity
Delta

; 16 cycles for two px
ADD Delta,Intensity ; shift one behind and put in branch delay slot?
AND Intensity, IntensityMasked0 ; refresh from mask in some branch delay state / busy waiting
ADD IntensityMasked,twoCRY
Jump if no carry, noCarry0
and/or mask, twoCRY   ; Saturate  self modify code depending on the sign of intensity ( split the polygon )
noCarry0:
ror 16,twoCRY ; rotate other Y in position
ADD Delta,Intensity
AND Intensity, IntensityMasked1
ADD IntensityMasked,twoCRY
Jump if no carry, noCarry1     
and/or mask, twoCRY   ; Saturate  self modify code depending on the sign of intensity ( split the polygon )
noCarry1:
ror 8,twoCRY           
store twoCRY, [blitter] 
addq 4,blitter  ; for the whole phrase

No-branch version, which saturates into both directions
move twoCRY,copy0   ; either have to regenerate Mask, or place a MOVEFA here
move twoCRY,copy1
and colorsOnly, twoCRY
SHRQ 16,copy1
and mask, copy1
and mask, copy0
add intensity, copy0
ADC intensity on the other thread 
add intensity, copy1
SAT8 copy0
SAT8 copy1
SHLQ 16,copy1
or copy0,twoCRY
or copy1,twoCRY





;15 cycle for one px
;Texture coordinates ( for small cache. LowPrecision ). No tricks
ADD u,U
ADD v,V
and U,Umasked
and V,Vmasked ( or copy?)
ROR Umasked  ; get rid of the fraction
ROR Vmasked  ; move to correct postion
OR Umasked, Vmasked ;  R14 or R15
Or/Add baseAddress, Vmasked ; F03000 - F03FFF local RAM
load [Vmasked], texels
BTST lowestIntegerIn,U
branch if zero , little
SHRQ 16,texels
little:
And MaskLowWord, texels

;Texture coordinates with one fraction in different reg
ADD delta, fraction
ADC uV,uV
AND uV, Umasked
mov uV, low
shrq 16, low .. too much shift for base address? F030 00 00 .. byte maybe?
OR low, uMasked
and U, oddEven ( 16=2^4 .. doesn't fit anything)
shlq 12,oddEven
load [uMasked]->texels
ror oddEven, texels

;;;;;;;;;;; OddEven really hurts if I just want to fill a horizontal phrase in the blitter.
;; Skip address synth and load if no carry happens. Put odd even in fraction. Change of fraction => ror . Try to flip texture on load so that we read it in forward direction

; Chain of ordinates. Every previous register has the fraction of the next in its high word
; two px at once ( matching Gouraud above)
; chain breaks here
ADC  ; Jump if carry  to the code path which generates an address ( otherwise we fall through to code which reuses values)
ADC	 ; do it for a whole phrase? Mark .. Doesn't look like ADC chain and on demand address generation go together well 
ADC  ; 
ADC
; chain breaks here. Maybe increase up to phrase? so that I would have two chains here and do not need to interlace with other code?. 8 ordinates + 8 delta = 16 . Intensity also?
  ;Use F02100.14 regpage?
	movetae  so that I don't trash the mask
AND UV, mask .. low byte is in correct position.  one mask for U and V  kinda hmm
MOV mask, copy   
SHRQ 16, copy   ; pack
or copy, mask  
and base,mask
load [mask],value

; I mean, I sure could interleave the chain with store to blitter .. 2 commands .


;On Demand address generation for integer parts=0
ADD fraction_U
jump if carry, addressGeneration0

ADD fraction_V
jump if carry, addressGeneration1

reuse value
continue


addressGeneration0
ADD highBit,UV                 ; nonbranch vesion would be:  ADC 0, flagInReg ; SHLQ 16, flagInReg

ADD fraction_V
addressGeneration1:
ADC 0, UV

load [UV contains base address]value


; noBranch, Base in UV, noWrap
add u,U
adc uv, UV
rorq 16,UV
add v,V  ; also ror to save a register?
adc 0, UV   ; 0 or subtract uv from rotated uv and save a register
rorQ 16,UV

; for wrap the integer part would need to sit on the msb
add
add   no problem with flags .. alternat chain or both this way?
-- swap register page
movfa
movfa
shrq
shrq v
shlq u
or u, v
or base , v 
load [v],value

; intensity would also be just this
add 
--swap page
MOVEFA
shrq
moveta value
and mask,value
add value, intensity
sat 8

one pixel:
movefa value
rem not mask  -> color Mask
or mask, value  .. 
xor intensity, value   ; rem works with all color bits not .. okay, is a hack. Rather use two masks! Or maybe sub intensity, Y ?

other pixel:
movefea
shr  
sat
shl

two pixel:
movefa value   -- or swap page? When doing 4px
and double_colorMask, value
or intensity, value
or intensity1, value


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
;NDC has a cost. The final multiplication for each (X and Y)
MUL x,const_x  ; 2 cycles  .. uh, not sooo expensive
shift x ; this is always needed to get the integer part for the one address generator in the blitter and the fraction for the other


; So after all transformation and occlusion culling using vector multiplication is not too fast
; I need to reload code and data. Vectors need 3 times the data. Rounding compromisses everywhere
; I think that I understand one thing about sky-hammer: Subtract only a 16 bits of the camera from the level so that everything in view distance is on 16 bit coordinates without rounding
; then rotate -> 32 bit. Then add the lower 16 bit of the camera. I don't have snipers, only this wide Doom and Descent FoV. 16 bit rotation is enough
; No that transformation is fast, a 16 bit beam tree becomes interesting. Only one multiplication and then divide to get a scanline.
; This way we can compare different cuts by y position. We don't care about cut order if the both happen between two scanlines
; Then same thing with x.
; Instead of some arbitrary error metric, we here have hard exceptions, or do we? If we round on 16 bit screen coordinates, MUL, MUL, ADD ( not transparent ). Branch on carry ( carry is sing ).
; actually

MUL 1,2
MUL 1,3
shr #16,2
add 3,2
branch on c=1

; With enemies on screen like in Descent or SkyHammer or any racing game, two rotations need to be combined: Our angle and that of the other object.
; Combine these 16 bit rotation matrices before we touch any highly dynamic vertices! We can even use Quaternions for the one multiplication, but then already need to convert to a 3x3 Matrix.
; After rotation the object is shifted using a 32 bit relative position. Ah, I need 32bit multiplication for the center of the object.
; Then convert to floats and then divide. So the vehicle may not be too large (like if we land on a carrier) or we notics the 16bit of the vehicle rotation. 

; since we use the full 16 bit on screen ( or almost , like up to a factor of 2 horizontally, ). Ah yeah, no normalized device coordinates. I need fixed point especially for x.
; In y I could use 32 bit Bresenham to trace the scanline y.
; Since we have 16 bit, I can only cut edges on the final frustum edge.
; Fractions do work: I have the normal of the portal edge ( withoud normalized coordinates, I have to pay for multiplication here, but frusum is still 16 bit, so not that expensive).
; normal | one vertex and the other vertex. Sign different? There is a cut. Measured from v0:  t= v0 / (v0+v1) ( possible)
; How and when do I compare two ts? So this is an exceptions! A corner ray is a cross product. This vector can still be 16 bit.
; Problem is that I don't grasp all the cases. The vertices and the camera span up a plane with a normal and the corner ray can be above or below.
; I the normal x and y components are within 90° the edge has exactly one hidden cut with these edges. Otherwise cuts are both visible or both hidden.

; Now add this shortcut, that a vertex below the frustum cannot be above ( and similar for left and right ) we save some more mul.
; Probably, checking for a vertex behind the camera is so cheap that I need to do this upfront? This branch pays back in the aforementioned cases.
; Ah, this would need me to calcuation a new point on z=0 for yeah, a series of cuts.
; Seems like this optimization does not work. I don't know if a vertex below is not also above.
; Rather have the near plane clipping as exception: Any vertex too close for DIV? Cut those edges. Log it?
; With z-Buffer and the overflow problem (is it real?) I could have mutliple z planes. out of view, far pixel mode, medium phrase mode, near pixel mode, cuts into camera.
; Vertex and edge results need to be reused. Load and Store is still cheaper than all the MUL. The Screen read out gets lower priority. Blitter runs after transformation.
; We use meshes and not per triangle series of cuts!
; I don't know if all code fits into scratchpad. It may actually be faster to process chunks and use the blitter for memory access .. at least write.
; LOADP ( in contrast to StoreP ) works. So and Edge can pull in vertices . Polygons can pull in edges. LoadP; Load; LoadP even runs at burst speed. So hard code for two vertices and max 5 edges?

; With z-buffer we are done here. Left as an exercise to the reader . With beam tree I feel like I need to write out the tree ( like Doom does ), occlude, and then again walk the tree to render.
; Again, scratchpad memory will be full by (perspective correct) rendering alone. GPU is busy with subpixel correction and vertical deltas in texture and shading.
; Some compromise about the direction of pixel mode between perspective and Gouraud is taken. Subspans get their own SRCshade.
; Still better than full quad blending as in SkyHammer or OpenLara on 3do.

; DMA on DSP is quite different from Blitter on GPU
; So the render code has to run on GPU exclusively
; Like in other programs, the DSP only helps with transformations
; So I only use LoadQ 
; DSP and GPU would have a producer consumer relation. Both have their read respectivly write pointer ( atomic memory access of course .. 64 bit).
; Busy wait lock algorithm: both processors are gentlemen and  push the other to do stuff. When denied, they write into common. 

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

;;;;;;;;;; NORM ??

;Floating point. To cater to the 16 bit MUL, the format is not IEEE 754 and also the rounding will not be like it because JRISC is stupid and I rather accept a larger epsilon
;I did wonder how much more precision slows JRISC down .. even if we don't MMULT . MMULT is more for fixed point math. I like 32 bit fixed point.
;At first I could not believe my calcuations, but fixed point with 32 or more bits reduces the glitch count so much that a tester will have a hard time to finde those single bad pixels.
;Whereas with 16 bit mantissa in floats I am not so sure. My demo is not supposed to feature an extraordinary dynamic range
;So, here a version without MMULT

;A * B = C   Inner product
;One word contains signs separated by 0 and exponents seprated by 0
CPY A.signs, C.signs   
ADD B.sgins, C.signs   
AND mask, C.signs     ; restore the 0

;find the largest value of two registers (no vectors)
copy a,c
copy a,d
sub b,c
add b,d
abs c      ;vectorize here? But that would mean copy ror or .. not good
add d,c
nop
shr 1,c


; find largest exp. Looks like I really should hold a copy of one value to keep data aligned to bytes
cpy C.exp_sign, C.exp
AND mask00, C.exp          ; signs to 0
cpy c.exp, r.exp
SHR 20, r.exp 
cpy c.exp, s.exp
SHL 10, s.exp
OR s.exp, r.exp  ; rotate as if word is 30 bits long 
SUB c.exp, r.exp  ; compare
AND Mask_rel, r.exp ; only the signs  .. is this useful yet?
CPY r.exp, rb.exp
SHR 20, r.exp 
cpy c.exp, s.exp
SHL 10, s.exp
OR s.exp, r.exp  ; rotate as if word is 30 bits long 
AND rb.exp, r.exp
NORMI r.exp, shift_count 
; Alternative: Rotate through 3 states, extract 1 for max, imac 
Copy byte
ForEach
ROR 8,
CPY ,this_value
AND mantissa,this_value
CPY ,t
AND 1,t
XOR t,last   ;  SUB last is one step before this. the t already look over two values. Two ts look over all stuff . 
mul last,this_value  ; altenative: SH 0 vs 32   or   SAR spreads a single bit: the sign bit  and then END
OR this_value,chosen
copy t,last

;shift mantissa in all. Some more than others, but leave space to avoid overflow
register shift <= 0
CPY A,C
IMUL B,C  ; 16 bit mantissa works with sign. So not in the exponent
CPY C,C1
SHA shift,C
add 32,shift
SHA shift,C1
ADD C1,CA1
ADC C ,CA

;finnally normalize
NORMI   ; 

;or after each ADC
cpy CA,t
ROL 1,t
AND 1,t
add t,exp 
NEG t
CPY CA,carry
SHL carry,31
SAR t,CA
SAR t,CA1
OR CA1,carry

;ForEach  ( 3 for inner product, 2 for cross product)
;32 bit mantissa without sign
;shift mantissa in all. Some more than others, but leave space to avoid overflow
register shift <= 0
CPY A,C
MUL B,C
CPY C,C1     ; names are flipped?
SH shift,C1
Add 32,shift
SH shift,C

Sub 16,shift
CPY A2,C2
MUL B2,C2
CPY C2,C3
SH shift,C3
SUB 32,shift
SH shift,C2

;non branching version refering to twos-complement ( looks like a hack ). Still better than to correct iMUL or to precompensate for it. I mean, MMULT is iMUL, so no choice. Similar code then actually. See below
cpy sign
ror to position 0
subq 1,complement1
xor complement1,C 
add complement1,complement1 ; sets carry for SUB .. similar to 6502 SBC
addc C,CA 

;branching version
btest sign
branch zero
Add C2,C
adc C3,C1
branch always
sub C2,C
sbc C3,C1
branch end

AND sign_maks,C
ROR
OR
ABS C
ABS C1
NORMI
SUBQ
add ,shift


; For imul . Convert i16:u16 to i16:i16
CPY A,B
AND sign_of_lower_word, B
SHL 1, B
ADD B,A 

IMUL A
IMAC
CPY
SHA   fixedPoint uses Q. Floats also work. Ah floats don't like MAC

RORQ 16,A  select the other word.
;repeat 

;Splitting into 3 parts needs AND
CPY 
ROQQ 12,
AND 
; So it actually may be better to not IMAC.
;How do I sign extend before accumulation?
CPY summand,X
SHL sign,counter
ADD summand,sum
ADC 0, sum0
SUB counter, sum0 

;With bytes I can iMAC over same significiance. Okay, I see no advantage. Slightly more symmetric code? One AND for both? But 4 iterations for 32 bit instead of 3 for 33 bit.
CPY A,A1
SH 8,A1
AND mask,A1
AND mask, A
;same for B
imul A,B
SHL ,A
SHR ,B
imac A,B
imac A1,B1
SHL ,A
SHR ,B
imac A1,B1
resmac C
CPY C,C0
SAR 8,C0
imul 1,C0
; next significiant byte 


;32 bit mantissa with sign split into 12 bit parts based on exponent. Shift before MUL is nonsense
CPY
SH shift
AND mask,
ADDQ 12,shift

CPY
SH shift
AND mask,
ADDQ 12,shift

; convert to signed
; see previous



;float with a common exponent .. I plan to use a smart z-buffer .. I mean, I want to use full precision for W interpolation (exponent of far vertex), and only SH just before CMP; For the packaging maybe even switch sign.
;32bit float has unsigned 8bit exponent  ... Typical interpretation into real world units applies a bias of 127. Not that integer would not need that bias
;IEEE 754 does not use 2s complement ( there is +0  and -0 )
;A sign in front of the exponent steals one bit .. normalization gives one back
;We don't deal with denormalized at -126
MOVE 4, 13
MOVE 5, 17
MOVE 6, 1B
ABS 13
ABS 17
ABS 1B
NORMI 4, 13  ;
NORMI 5, 17
NORMI 6, 1B
ADDQ 8, 13 ; positive bias 
ADDQ 8 17
ADDQ 8 1B
; shifted right : positive  ( like SH is oriented  |  zeroed out exponent used for overflow ) 
; shifted to the lef: negative  ( camera close to vertex)



;; roll your own .. In a scene graph with bounding boxes
{
	;copy backup for comparison
	MOVE 4, 13
	MOVE 5, 17
	MOVE 6, 1B
	; next lsb
	SHLQ 1, 4
	SHLQ 1, 5
	SHLQ 1, 6
	;changed?
	XOR 4,13
	XOR 5,17
	XOR 6,1B
	;any of them I mean
	OR 17,13
	OR 1B,13  ; docs say: N - set if the result is negative=1=changed
}
JR ~N,
[4,5,6] have the shifted values


;;;;;;;;;; }NORM

;;;;;;;;;;;;;;  MAX(3){ 

;;no jumps .. but only works for unsigned 7bit .. 7bit is no problem for shifitng within int32
; not friendly to pipeline
MOVE 13,7  ; is 7 free?
SHLQ 8,7
OR  17,7
SHLQ 8,7
OR  1B,7
SHLQ 8,7
OR  1B,7  ; dupe because 32 cannot be divided by 3
MOVE 7,8  ; is 8 free?
MOVE 7,A  ; Backup to retrive max value ( not key )
RORQ 8,8
SUB 7,8   ; compare and place result in bit7 ( inbetween compared numbers)
XOR 7,7   ; use this constant to fill
BSET 7,7  ; the bubbles in the pipeline
BSET 15,7
BSET 23,7
MOVE 7,9  ; we need this constant again .. just luck
AND 7,8
MOVE 8,7
SHRQ 8,7
NOT 7     ; different direction  .. 1 inbetween will be zerod by 8 in next instruction
AND 8,7   ; both comparison must point to point to the same value
OR 9,7    ; Stop bits
SHLQ 1,9  ;{ decrement to ..
SUB 9,7	  ;} .. trigger carry
AND 7,A   ; Mask out Max value
MOVE A,7  ; copy
RORQ 8,A  ; values
OR A,7    ; in every other place
RORQ 8,A  ; values
OR A,7    ; in every other place
RORQ 8,A  ; values
OR A,7    ; in every other place
SHQ 24,7  ; zero out copies

;;max  simple and stupid .. Maybe reuse for triangle y
CMP 13,17
;CMP 17,18 ; pipeline effect .. no, this will not work
JR N,   
{ ; 13<17
	CMP 17,1 ;NOP ; Jump after jump is not allowed
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
		JR , behind_else
	}else{
		MOVE 13,7
	}
}
behind_else:
; SAT16 17  is TOM only .. I don't like that


;;;;;;;;;;;;;;  }MAX(3)



ADDQ 5,7 ; I think this is the difference between IEE and fixed point.  ToDo: check
SHA 4,7
SHA 5,7
SHA 6,7

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

; Error: SHA for signed and SH for packaging cannot be combined
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

MOVEI F1A104, 1F   ; DSP Matrix register  .. GPU at F02104
MOVEQ 3,1E   ; Matrix width . I don't need this row column thing. I leave bit 4 as zero. Convention over configuration
STORE 1E,1F
ADDQ 1F,4  ;  Matrix Address register   .. So byte addressing after all?
STORE MAtrix address, 1F ; Matrix needs to be 32bit aligned :    2-11 MTXADDR Matrix address.   This is the camera matrix 

MMULT 0 /* Alternative register bank, these vertices */, 13 /* this register bank, this register and following */






;[13,17,1B] x y z
OR 1B,1B  ;   no nono:  no jump for negative or zero .. like on 6502
;
JR NZ, outside
;nonsense NEG 1B  ; compensate
XOR 6,6
BSET 16,6
;F0211C = 1  16.16 / 16.16   to keep everything neatly centered if we round anyway
DIV 1B,6  ; Cycle 18: Destination register write   looks like we should do something else now .  DIV;DIV has a bug and the scoreboard cannot avoid any hazard of register reuse
;; 
NOP ;; 16 of that   .. pixel shader? Stagger with next vertex group?
OR 6,6 ; await DIV
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

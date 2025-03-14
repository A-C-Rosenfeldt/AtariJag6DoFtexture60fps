Rereading about the registers, loading them already takes so much time.
So even if I may want to allow some overdraw, I should really avoid drawing invisible lines.
Beam tree gives visibility values before it gives me visble pixels. Of course then again I would need to check for z-sort. And then blows up code size.
So I should just rest assured that religiously reducing overdraw even for objects like cars or robots in descent will reduce lines on any interesting background ( not fight4life).
I have to remember all the time that I use the beam tree for cache coherence.
With the low number of polygons in my examples, simple sort y of vertices and then x range overlap and then x at same y .. is probably fast. And easier to debug than a tree.
So I really need to sell the tree on a website. Expand all the lines! Still need the baseline from the nxn comparision on rounded to 10bit coordinates.
Let's me stuff 3 vertices in a phrase. x gets one bit more.
Texture may need more precision or even compensation. I don't care because it is independent per polygon. No memory problem.
So if I accept rounding from the visibility test, I need to follow OpenGL and interpolate in screen space. No "the dark project" thief engine ray casting stuff -- infinite precision integers.
Frame to frame coherence comes later. It would be really cool for some more 2d like action.
Bresenham works for overlap checks on screen. When ordinates have on 15 bit, I can calculate determinants fast.
Cannot have quads anymore. Only triangles, but then need to calculate delta matrix only once per triangle.
Clipping becomes a bit akward because at least at corners this means raytracing and what if this is not triangle anymore?
The blitter might not hit the target anyway. I might just have understood guard bands (for perspective correction or VERY tiny affine triangles (span-length parameter)).
Sounds like many special cases like slithers for example. Not great for small code size.
Still only use it for the quad case and small quads. Otherwise zigzag along z =>  triangles!
Or check if the interpolated value from the vertices hits the texture inside the allowed polygon. Only otherwise split. Uh, this sounds like a recepy for jitter.
On the otherhand quads can become triangles on clipping. Nice! We take them like this.


The blitter can have saturation on Gouraud disabled (  To  Top Byte   To Top Nibble ). Then it saturates on the full 16 bit. This should be a rare occurance ( frame rate drop? ).
For anything else this allows us to backdate the phrase values for less blitter calls. F02238.
Of course I then need to clip all color channels in software on the other side.

There is not similar configuration for z buffer. But then again we have so many z buffer bits and planes far away that only a few polygons are affected ( framrate drop?).


It is a bit weird that the Jaguar can only flat shade textured polygons. So lightning is static and shade is used to convey the 3 dimensions. No deep-cueing. Sectors for hard shadows like in Doom?


;Block move for the cache. So always request new data in advance? Double buffer for U and V!
;Params( 1,2,3,4,5,6
;)
XOR 0,0
MOVEI #F02200,A
;MOVE A,B
;BSET 5,B ; 2
;BSET 2,B ; 4
STORE 1,(A) ; destination & ~7 -> A1 base
STORE 2,(A+C); Word address. the add here only costs one cycle and no instruction space !  Only Load has also latency .. but we have the scoreBoard for that probably     ; and   source & ~7 -> A2 base

ADDQ #C,A; (not for cache) (source & 7) >>1 -> X (low)   ; for CRY  So I guess that the target address needs to be phrase aligned to the source ?
STORE 0,A ;; 0 -> Y(high)  ; resonable 

MOVE B,C ; 24
ADDQ 18,C ; 3C  --hmm
STORE 3,C ; lenght/pixel -> inner counter (low) 
          ;; 0 -> outer counter (high)  ;  reasonable

SUBQ 4,C ; 38 command register  --hmm
LOADQ 0b1100,9  ; only use the source  -- no matter what color is in the destination
SHLQ 21,9       ; LFUNC  bits
ADDQ 0b1, 9		; SRCEN   ( but not SRCENZ for texture, and not SRCENCX because we: X=0)
STORE 9,(C) ; Start blitter. F02238

;There is an IDLE bit (0) set (1) in the blitter status register (F02238) which flags true completion, i.e. the last bus transfer is 
;;completely terminated. The interrupt occurs as the IDLE bit is set -- ah, why no busy bit. Would make more sense. 0 default!!!
{
LOAD 1,2
BTST 0,2
}
JR Z,









;Rectangular move for z mostly up vector in figthing games, RPG, race games
; phrasemode -> addres flag registers{ 0
; } 0
; Some values from block move to and from framebuffer ( and z-buffer ) 
; The blitter likes to copy phrases and has a pitch value to jump over the interleaved front buffer
; This should work in internal and external RAM
; Does it copy z values? In the CommandRegister (F02238) there is a SRCENZ and DSTWRZ  .. so?
; But it keeSo we need to space other data in the "columns" left.
; New atributes {
	;   window width; four-bit exponent and a three-bit mantissa, whose top bit is implicit
	;;  in phrase mode I plane to use two phrase wide windows for framebuffer
	;;  1x2^1 = 1 00^0001   oh, exponent comes first in IEEE 0001 00
	; rectangle width 
; }









;;;;;;;;;;;;;;;;;;;;;;; Not much interaction with the other code .. different module? ;;;;;;;;;;;;;;;;;;;


;Pixel mode for long almost const-z runs while GPU is busy anyway





;Jaguar Technical Reference Manual - Revision 8 Page 39
;© 1992,1993 ATARI Corp. SECRET CONFIDENTIAL 28 February, 2001

int_serv:
movei GPU_FLAGS,r30 ; point R30 at flags register F02100 
load (r30),r29 ; get flags
bclr 3,r29 ; clear IMASK
bset 11,r29 ; and interrupt 2 latch
load (r31),r28 ; get last instruction address
addq 2,r28 ; point at next to be executed
addq 4,r31 ; updating the stack pointer
jump (r28) ; and return
store r29,(r30) ; restore flags

Registers R28 and R29 may not be used by the under-lying code as they are corrupted, in addition to 
R30 and R31 which are always for interrupts only

So to use all registers, I need to clear bit 4-8 in the flag register
4 Blitter
3 Object Processor
2 Timing generator
1 DSP interrupt, the interrupt output from Jerry
0 CPU interrupt


;Doom source. Store instruction is one cycle .. and internally probably allowed every cycle
;Load needs 3 cycles ( not only for internal memory, but also for internal regs)
; So 6 cycle granularity for wait .. but in reality only if bus is busy
; 4 cycles to write stuff .. Interleaving fractions takes more time:
regs:[U,-V]
MOVE 0,2
MOVE 1,3

XOR 4,4
BSET 16,4
SUBQ 1,4

AND 4,0    ; And pushes value down to 0
;NOT 4     ; 5
OR 4,3     ; Or pushes value up to -1


SHLQ 16,1
SHARQ 16,2
SUB 0,3    ; provoke a set carry flat
SUBC 1,2   ; use carry to redine 1 as not V instead of -V

MOVE 1,2



;
;=====================
; program blitter
;=====================

;	while ( ! (*(int *)0xf02238 & 1) )			// wait for blitter to finish
mp_wait2:
	load	(mp_blitter+14),scratch
	btst	#0,scratch
	jr		EQ,mp_wait2
	move	mp_count,scratch				; harmless delay slot
	
	store	mp_a1pixel,(mp_blitter+3)		; source location
	bset	#16,scratch						; one outer loop
	store	scratch,(mp_blitter+15)			; count register
	store	mp_blitcommand,(mp_blitter+14)	; command register


;	*(int *)0xf02270 = light;	// iinc   f02270 : Looks like this register cannot only add to the intensity of the last pixel Gouraud, but also to the SourceData of the current pixel
	movei	#$f02270,scratch
	store	mp_light,(scratch)


;;;;;;;;;; Doom code on linux
	// Current texture index in u,v.
	spot = ((yfrac>>(16-6))&(63*64)) + ((xfrac>>16)&63);

	// Lookup pixel from flat texture tile,
	//  re-index using light/colormap.
	*dest++ = ds_colormap[ds_source[spot]];

	// Next step in u,v.
	xfrac += ds_xstep; 
	yfrac += ds_ystep;
	
    } while (count--);


; Also Skyhammer looks verymuch as if you just has to live with 16x16px x 16bit textures ( 256 /2 =128 words in internal RAM). Oh so skyhammer is 32x32px = 512 = half of internal RAM
; move framebuffer around for software on DSP? Move code around? All for a little less splitting?
; At least make cache compatible! It alreay occupies the same memory ( 4x4 blocks x 4 lines x 4 acossiations)
; The diagonale direction is problematic .. switch aspect ratio for others. Place values in empty space
; So Skyhammer has 32x32 texuture and is one of the best looking games ( too dark, but that is art )
; I should also allow 32x32 for the diagonal. I thought about shearing: The blitter is fast at it, but can only do it horizontally ( rasterbar effect ) :-( .
; I would allow 1x2 aspect ratio. Keep a 90° rotated copy as in external RAM cache? Sure not in MinimalViableProduct!
; Likw we only have associative cache to zoom out .. no we block that. GL_Repat and tiles and 2d vector in 3d plane all hate to zoom out too much. Far clipping?
; The Jay allows 3 bit floating point for width 
; Flags Register F02204 Write only
; The width is a six-bit floating point value in pixels, with a four bit unsigned  exponent, and a three bit mantissa, whose top bit is implicit
; 32 implicit +16 + 8 .. Or 16 + 8 + 4  .. So I can choose any number of phrase-page-aligned pixel blocks
; But with fixed 32 bit . I could more easily shift my other data around this line.
; What about scrolling? No wrap around, but scrolling .. means a lot of blitter copy.

; Since there is no wrap around we cannot do better than drawing a quad.
; We can load a triangle out of an atlas and create guards on the fly ( flood fill residual triangular spaces )
; For blitting into the linebuffer we still need lines of texture which could be oriented along the worst case. So render into linebuffer uses 16x16 textures also. Cannot do const-z -- though linebuffer is best for write fill rate.

; Const-z at least is a justification for pixel mode. It works okay on quad ( textures ). We don't want to show our magic ( no popping on roll), so we need subdivision or MipMaps (but MVP don't have and not much memory anyway).
; Span subdivision ( Quake style ) is the way to go here. For large areas without many z variance bilinear wins .. still we need spans for the tips. No really spans because we divide instead of shift
; Blitter in pixel mode uses no phrase alignment .. thus we don't need to align bilinear blocks. We don't align vertically because const-z divs every line. Blitter is faster than GPU, but not too fast for multiple divs per line.
; Span has one div less than aligned bilinear. Bilinear can only win with synergy with padding. On DSP?

; 90° rotation on CPU
; 4x4 block in regs 0..3
; 2x2  *  2x2  rotations
; rough rotation
; Probably needs some MFA
MOVE 0,4
MOVE 2,5
AND lo,0
AND lo,2
AND hi,4
AND hi,5
OR 4,2
OR 5,0

;fine rotation
MOVE 0,4
MOVE 1,5
AND loBytes,0
AND loBytes,1
AND hiBytes,5
AND hiBytes,4
OR 4,1
OR 5,0

;; repeat two times  32 cycles


Doom BlitterCommand
#1+(1<<11)+(1<<13)+(1<<30)+(12<<21),mp_blitcommand
SRCEN
destinationA2
GourZ
SRCSHADE
21-24 LFUFUNC

;;
Lines wrapping around in x
The address itself is generated from a window pointer. This has an X and Y value, and again is in pixels. The 
pointer may point to areas outside the window

7 cycles is the fastest real games went, indeed using that Atari-recommended trick where src=RISC SRAM and dest=DRAM.
That's 5 cycle/pixel texture-mapping blit and a 2 cycle/pixel copy blit.


The RAMs in the jaguar are organized in 1024 rows of 2K per column
(in the 2MB model). 

The manual says : "blitter to copy data into the GPU space" .
The blitter is slower than the object processor because it is not a pipeline from start to finish like the object processor.
It uses the bus and needs separate bus cycles to read data and write data.
The 32 bit GPU RAM needs two cycles to accept the 64 bits from the blitter .. I hope that there is an internal latch.
External memory runs at half the clock cycle so it should be possible to copy at full speed from external to internal memory for code snippets, data, and graphics.
"One-tick overhead when turning round from a read to a write transfer" makes me think that on should use
SourceEnable
SourceEnableZ
...
DestinationWriteZ

To read two phrases at once. External memory is not synchron .. we only loose a system cycle not a "memory cycle".
set (Destination Z Register F02250 Write only) zMODE correctly.

Neither Doom not FFLife need to read the destination for pixel mode, so the blitter can mark bytes on the system data bus as "don't care".
I would think that a pixel takes 3 cycles to copy. Here they say that it takes 5 cycles : https://forum.beyond3d.com/threads/atari-jaguar-architecture-discussion.58306/page-2
I guess that the blitter tries to fill up its 64 bit SourceRegister by two reads into internal SRAM.


GPU RAM can be read as 16 bit RAM by the blitter. Thus CRY ( but not true color ) blitting out of internal RAM is possible in pixel mode. 

The GPU internal address space is accessible by any other Jaguar bus master.
By adding 8000 hex to the addresses it is also available as 32-bit write only memory.  Specifically, this allows the blitter to copy data into the GPU space.
Blitter accesses memory through the 64-bit co-processor bus
One-tick overhead when turning round from a read to a write transfer
Bits 0-5 enable corresponding memory cycles within the inner loop. Destination write cycles are always performed (subject to comparator control), but all other cycle types are optional.

Blitting into the linebuffer probably also takes 2 cycles because it is 32 bit.
By adding 8000h to the above address ranges 32-bit writes can be made to the line buffer. This is mainly to 
accelerate the Blitter. ; So again, don't care bits at 8 bit granularity ?

Since the blitter trashes its tables anyway, we could just as well use the GPU to read and write, too.


https://forum.beyond3d.com/threads/atari-jaguar-architecture-discussion.58306/page-2
When you mention the blitter halting the GPU this mean for the entire duration of the blit, or just for the 1 out of 5 cycles per pixel where it should be accessing the SRAM?
It's software-halted for each line blitted. The blitter is slowed down while the GPU is running (since it adds cycles in bus arbitration), so somebody must have concluded it was better to avoid arbitration.


>There's a bottleneck in getting the data in and out of the DSP over its slow 16-bit bus
So cannot be used for pixel pushing? Pinout shows 32bit for data and 24 for address. That matches the instruction set.
>Because Tom treats Jerry the same way as the microprocessor Jerry may only use the lower 16 bits of the data bus if the microprocessor is 16 bits
>> Ah, a MIPS CPU is so much better!

My Idea: Know what is free in the framebuffer and store texture next to it. Texture copy using source and zbuffer ( 128 bit) page miss 2 times so 8 cycles for 8 texel.



; Funny games with the Blitter, pages and OP. We need a Beam tree for this. It tells us how much area a texture covers and thus with which texture to start where on the screen.
Philip Wood Now I have an OP use: I could not find an efficent way to read back the z-buffer. So I drop it from my concept. Now I only need a single buffer in each of the 2kib == 1kiPx pages. Now I propose to put a 16x16px texture at the end of the page and to use the OP to assemble the rest as 48x16px tiles. Now for skinning ( fight for life fighters, battleSphere ships ), I find the position where the texture will be used, align it on phrase. If Tiles overlap, both go back equal lenght of px. Then they grow to fill seams, especially horizontally to speed up OP.

This way the Blitter can texturemap within a page. I think that this will be relative fast because internal SRAM needs 4 cycles for access because they saved a transistor or two. So two cycle extern DRAM wins. Of course there is cost for OP.

I don't get why OP can reflect, but there is no way to flip ( bottom up ). The blitter also cannot do that in phrase mode. We could cache rotated values. My idea was to find a spot in a texture where 3,4 or more px match the 90° textures. Then for a zoomed texture we come from outside and pull the texture using pixel mode. Pixel mode allows us for example to go forward like written english until we hit the center. And then we go the end and go backwards. So pixel mode would happen inside a page. Only the initial copy would be trans page. But since we have no z-buffer, we can abuse zread and write flags to read two phrases , page flip , write two phrases , page flip .


So the blitter in phrase mode is only useful for block copy with {pixel, z-buffer} copy ( double phrase aligned).
If we need the same texuture in different tiles, we duplicate it and the duplicates are cached.
A rectangular tile on a triangle will almost certainly not cover the tips .. but we could try to snap on. With large triangles we want splits for perspective correction .. uh but not show the OP!
For the OP we want wide tiles .. but 4px high? So it is better than with the line buffer at least. We could try to cut out thick lines out of the texture almost like I've planned for texture cache.
We still have that wrap around problem for diagonal slicies. Ah, we already feel lucky.
We can use the full 2kB page to copy a slice of our texture to. I think horizontal pull coordinate is just added to the vertical pull ordinate, so we have at leas one wrap around.
We make the source buffer as small as possible to save on memory. We will the texture from the high address to low (roughly). We render from low to high using the free choice of delta (y|x) = (1-|0|+1).
We'd rather also cache this.
A different idea woud be spill over: The texture is stored in the center of the page, and the OP is instructed to pull a little from the outside, if this makes our triangle just fit in.
Or really we can make a chain so that neighboring tiles on screen are aligned in memory ( same width, same x) so that the rasterize can just go over each triangle individually and just be happy with faster memory access.
Unfortunately this does not work in horizontal direction. Instead it leads to thick columns.
The horizontal direction profits from a split of the triangle in 3 rectangles. We would have the wide center section and then the aligned ( to our top and bottom neighbor ) top and bottom section which are narrower.

scrap that: Object clipPixel   (and reflect ( compensated in blitter ) )
allows us unaligned width, and thus there is no need to align position.
Thus every vertex creates a cross of tiles. The rays of the cross grow until the hit other rays.
Triangles whose middle vertex is on a cross are rendered above and below because the OP cannot flip an object. We can have overspill on both sides.
Rectangles to thin are assigned to a neighbour with memory left. 

Bus Hog for GPU (for vertex data) and blitter. The OP has a lot to do to assemble or those objects back together. At 60fps I think that is okay.
With lower framerate I guess we could live with some branch objects and manipulation and still have 2 scanlines assigned their main texture. If we branch, hey at least have two objects with 4 scanlines.

Seems like zoo of techniques is still needed. The OP can load the current page with two objects and two data.
One is the original texture which is loaded in the hidden rear part of the line buffer and then used by the blitter to blit to other pages.
One is an already mapped part on the current frame. Everytime the blitter is finished we look if we have enough time to use the data in the line buffer. And we need to check afterwards.
Only when we used the texture to its full extent, we can insert a new one in the object list. We always have two textures due to the two buffers. So lots of variables we cannot all keep in the register (nor do we want).
With blitter hog it may take a large part of the scanline until we can use our texture. With lots of objects it probably takes the full scanline. So swap out of texture costs one scanline. We use CLUT texture then.
So really I need a pointer to the texture source. The scheduler decides based on horizontal scanline position, which to use right now. BeamTree asigns larges area to CLUT. Then triangles grab their objects.
I use the object processor to draw the parts outside. What if a texture was not visble in the last frame? Loads into linebuffer have to be independent of contents on current frame.
Spreadsheet timing for a pixel are anywhere from 5 to 11 cycles. Linebuffer is 16bit and if using the object processor or if rendering just in time, we only access it once per pixel , so max 4 cycles
if 16 bit is really expanded in 16 indentical 16 bits. It is like a page miss in DRAM and Doom had two of those. Really let people test it. Anyway: Max 2 cycles more than page to page.
It might be interesting to fill in the foreign triangles here ( after OP has finished).

Though for the same effort I could shift the individual scanlines of objects ( and clip or render left to right ) and have no foreign px. This does not fly with the blitter address generator for const-z.
Const-z is in danger :-(
Maybe at least store two textures every scanline. I can shift both and I can clip the second on ( or even reflect the first and also clip ). So there is one edge every scanline with a page change.
There are two important triangles every scanline. I mean, this could still work with const z. Generally const z still works when we overwrite with the clip edge ( render right to left )

Even if we only have one object per scanline, we should place the most common texture into the invisible border. All textures live right of the screen over two buffers. I've not seen a Jag game with so many textures.

So it would be really cool to have a demo where you can shift around the workload over those different methods.
I feel that like with the beamtree there needs to be an instant version, but inter frame coherence as an option.
For example we see that in the next frame some textures are needed more, so we do the delta copies. Any extreme change goes to the other techniques.
Extreme zooming is so inefficent on the blitter, that this may be better implemented as spans in ObjectSpace. Find integer scale sequence? Pull in so that remainder matches!
This was for cross. For criss ( less dominant ), there is 1:1 OP of a 16 color bitmap rendered on CPU. Texel color stored in CLUT. So there may be a better use for CLUT then as source for blitter!
The second layer may even hide the exact pixel borders. Now almost horizontal becomes the problem. Find the problem with smallest remeinder .. OP.render to both sides by means of reflection. Blitt to match with pixel precision.

Two OP reads and writes and two dummy data reads of 1 bit sprite (optional zoom) may be justfied starting with 8px spans. No shift on GPU. A queue to StoreQ into.

Diagonal squares: Texels are rendered in this way:  opaque transparent transparent transparent  ( clear + pitch ). The to vary the width of a texel to objects are shifted over each other.
The gaps behind are rendered into the linebuffer first.
I guess that this may work with three layers? Widest spans last .. second widest before .. the rest 
Or basically we render the texture at low res ( blitter galore ) and then draw thick lines over the jaggies to make it look nice.
Or we have pre-rotated/zoomed index patterns (long0, short1, long2, short3 ) and shift around the colors in the CLUT .
We save on CLUT by having the short parts in a zoomed texture behind.

Patterns needed: So we need to combine criss and cross. Both have an integer part and a bit pattern for carry. With all that effort we could go per correct and just allow all patterns ( no continued fractions?? )
With eight borders, we have .. uh too much.
So max 4 borders allowed for criss and cross for 256 carry combinations. 8*8 base length combinations: 16 . 4 relative shifts ( we can swap roles )
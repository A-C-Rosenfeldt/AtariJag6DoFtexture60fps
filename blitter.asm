;Block move for the cache. So always request new data in advance? Double buffer for U and V!
;Params( 1,2,3,4,5,6
;)
XOR 0,0
MOVEI 'F02200',A
MOVE A,B
BSET 5,B ; 2
BSET 2,B ; 4
STORE 1,(A) ; destination & ~7 -> A1 base
STORE 2,(B); source & ~7 -> A2 base

ADDQ 'C',A; (not for cache) (source & 7) >>1 -> X (low)   ; for CRY  So I guess that the target address needs to be phrase aligned to the source ?
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


;Doom source
;=====================
; program blitter
;=====================

;	while ( ! (*(int *)0xf02238 & 1) )			// wait for blitter to finish

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
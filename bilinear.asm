; edit in notepad++ 2022
; funciton syntax as opposed to 0x86 assembler
; <Op code name> <source>,<destination>
; 32 registers * 2 pages * 32 bit. I just use hexaDecimal to name them

; I need these. Bilinear dosn't test anything and interpolation can not overflow

imultn r8,r9 ; compute the first product, into the result 
imacn r10,r11 ; second product, added to first
imacn r12,r13 ; third product, accumulated in result
resmac r2 ; sum of products is written to r2

ADD Rn,Rn ; Cycle 3: Destination register write
LOAD (Rn),Rn ; Destination register write internal memory at cycle 3 or 4
LOADP (Rn),Rn ; external memory subject to bus latency ;High Data Register F02118
	MOVEI F02118,9
MULT Rn,Rn ; product trashes the color factor I guess. I need the other for interpolation
PACK Rn ; Takes an unpacked pixel value and packs it into a 16-bit CRY 
 ;onto bits 12 to 15; 
 ;onto bits 8 to 11;
 
STORE Rn,(Rn) ; internal .. 
STOREP Rn,(Rn) ; external
UNPACK Rn



;;;;;;;;;;;; trying to order stuff


;I have U,V as fixed point in two registers for the add. Now I need to separate them ( or ADC on a 32 bit system? )
MOVE 0,1
SHLQ 16,0
SHRQ 16,0
SHRQ 16,1

called from ./sampler.asm
call to ./2associativeCache.asm(  integerPart U  : integerPart V )  ; no comb on this level because I only burst inside of cachelines and probalby lose to other memory users in between anyway


; Pack doesn't help me, I need
SHLQ n,Rn ; pack from multiple registers
SHRQ n,Rn ; unpack into mutliple registers
MOVE Rn,Rn  ; Multiple registes !
;=>
; Unpack .. 3 registers, 12 cycles 
MOVE 0,1
MOVE 0,2
SHLQ 32-8,0
SHLQ 32-12,1
SHLQ 32-16,2
SHRQ 32-8,0
SHRQ 32-4,1
SHRQ 32-4,2
; Pack
;SHLQ 8,1
;SHLQ 12,2
;OR 1,0
;OR 2,0

;; some caching for the unpacked pixels ?

;Linear Interpolation an pack. 35 cycles and 18 registers
; There is no MULTN 
;We have 3 channels and rather to 4 macs instead of 3 if we could prolong the MAC grop
;We need all combinations of  [ U , ~U ]^T * [ V , ~V ]
; copy U =[0]
MOVE 0,1
MOVE 0,2
NOT 2
MOVE 2,3
; V = [4]
MULT 4,0
MULT 4,2
NOT 4
MULT 4,1
MULT 4,3

; We are only interested in the fractional part
SHRQ 16,0
SHRQ 16,1
SHRQ 16,2
SHRQ 16,3

; [ 9 A ]
; [ B C ]
IMULTN 9,0 ; compute the first product, into the result 
IMACN A,1 ; second product, added to first
IMACN B,2
IMACN C,3
RESMAC 4
SHRQ 4,16 ; factors are fixed point
SHLQ 4,8
; [ E F ]
; [10 11]
IMULTN E,0 ; compute the first product, into the result 
IMACN F,1 ; second product, added to first
IMACN 10,2
IMACN 11,3
RESMAC D
SHRQ D,16 ; factors are fixed point
SHLQ D,12
OR 4,D

; Pixel Data .. on Color channel
; [ 5 6 ]
; [ 7 8 ]
IMULTN 5,0 ; compute the first product, into the result 
IMACN 6,1 ; second product, added to first
IMACN 7,2
IMACN 8,3
RESMAC D ; we reuse 4
SHRQ D,16 ; factors are fixed point
OR 4,D


; now comes some code to collect a phrase
JUMP , pixelCounterLow
{
	0: MOVE D, 1F  ; This needs to become ReadModifyWrite  ( AND, OR ) so that we can draw edges.
	1: {
		SHLQ 16,1F
	}
	OR D,1F
	2: MOVE D, 1E
	3: {
		SHLQ 16,1E
	}
	OR D,1E
	STOREP 1D, 1E:1F
	ADDQ 8,1D  ; aaarg why do we need all addressing granualirities there are ?
	XOR pixelCounterLow,pixelCounterLow
}






;;;;;;;;;;;;;;;;; Old stuff

IMULTN 0,1 ; compute the first product, into the result 
NOT 1
IMACN 2,1 ; second product, added to first
RESMAC 4 ; sum of products is written to r2

; interpolation along x in the second row [6,5]
IMULTN 5,1 ; compute the first product, into the result 
NOT 1
IMACN 6,1 ; second product, added to first
RESMAC 7 ; sum of products is written to r2

; interpolation along y
IMULTN 4,8 ; compute the first product, into the result 
NOT 8
IMACN 7,8 ; second product, added to first
RESMAC 4 ; we don't need 4 anymore ( and 7 for that matter )


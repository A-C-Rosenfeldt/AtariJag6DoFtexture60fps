MOVEI F02118,A  ; Phrase Highword
; parameter: B has texture base address 
; parameter 0 has texture address
; parameter 1D: iterations for bilinear interpolation which often needs 2, sometimes 3 more values
; parameter mirror_flip_mask   -- is fed through bilinear and comes from the outer block for the subdivision. The signs of the Delta U and Delta V values expanded onto the bits into the texture

; 14 : position of internal cache keys
; 15 : position of internal cache values (15=14+'8' ?)


;Filter for position inside cachline
MOVE 0,11
SHLQ 32-4,11
SHRQ 32-3,11

;Filter for packed high / low word
XOR 10,10
ADDQ 1,10  filter LSB
MOVE 0,2 copy parameter
AND 10,2
RORQ 1,2
SHARQ 4,2
SHRQ 32-4,2

; Filter for the part which is looked up and translated to position in SRAM  
XOR 5,5
NOT 5
SHLQ 16,5
MOVE 0,1
MOV 1,2    ; copy all bits to the high word to match the key table in internal RAM
SHLQ 16,2
OR 2,1  
XOR 1F,1F
BSET 0,1F
BSET 16,1F

;LOADQ 7,2
;MOVE 0,1 ; copy
;AND 2,1 ; get position in local ram based on 3LSBs ;I now try to do less shift

;Register 9 has most recently used data
;MOVE 9,8
;SHRQ 1,8   ;  Todo remove offset of 1

;ADD 7,1  

SHRQ 3, 0 ; Oh, more shift

{ ; batch
	AND 5,1	--  GL_REPEAT  for the sampler and for our batch

	LOAD (14+1),3  ; position of cache in internal RAM
	MOVE 3,1E ; backup copy for MostRecentlyUsed
	AND 1F,3 ; clear MRU bits
	XOR 1,3   ; words are both used. Bit 15 of each word needs to be zero
	SUB 1F,3  ; combine XOR and SUB after debugging
	SHLQ 16,1F
	AND 1F,3  ; Just brainstorming at the moment
	OR 1F,3 ; set MRU flags  Flag is set one cycle later for JR
	JR ~Z
	{
		; no cache hit
		; this block is too long
		; I should leave it at the end anyway because misses should be the exception
		; load data
		;LOADP (Rn),Rn ; external memory subject to bus latency ;High Data Register F02118

		; we need to mirror and flip data here to keep the hitting logic free of branches and easy to interleave.
		XOR mirror_flip_mask,0

		ADD B,0 ; add base address:  internal -> external
		MOVE 0,10  ; creata phrase spaced addresses in byte address space
		ADDQ 8,0   ; external memory has byte addresses
		MOVE 0,12  ; Maybe use MOVETA 
		ADDQ 8,0
		MOVE 0,14  ; And later swap bit 14 of (F02100)
		ADDQ 8,0
		MOVE 0,16  ; And do the ADDQ without pipeline stall

		; page mode RAM
		LOADP 10,11
		LOAD (A),10
		LOADP 12,13
		LOAD (A),12
		LOADP 14,15
		LOAD (A),14
		LOADP 16,17
		LOAD (A),16

		SUB B,0 ; back  external -> internal
		STORE 10,(B)
		ADDQ 1,B ; word addresses
		STORE 11,(B)
		ADDQ 1,B ; word addresses
		STORE 12,(B)
		ADDQ 1,B ; word addresses
		STORE 13,(B)
		ADDQ 1,B ; word addresses
		STORE 14,(B)
		ADDQ 1,B ; word addresses
		STORE 15,(B)
		ADDQ 1,B ; word addresses
		STORE 16,(B)
		ADDQ 1,B ; word addresses
		STORE 17,(B)
		ADDQ 1,B ; word addresses
	}
	SHLQ 4,1 ; keys are spaced phrases apart {
	ADD 15,1 ; position of values

	do{
		;We have to throw away the "current" position to get a consistent loop
		SHLQ 2,1D ; The trace needed by bilinear
		; We push the results through 3 registers
		MOV 13,16  ; avoid addresse registers. These are values!
		MOV 3,13
		
		LOAD 1,3
		; not needed anymore: SHRQ 4,1 ; keys are spaced phrases apart }
		NEG 2 ; I think for left
		ROR 2,3   ; select high or low word .. 


		; The ./sampler.asm needs 2 or 3 values .. Maybe we can reuse some stuff above
		If ( BTST 0,1D) { // proceed_horizontally
			NOT 2 ; move to next position 
			JR ~Z{  
				MOV 3,13
				ROR 2,13   ; or something like this
				JUMP ,break
			}
			ADDQ '1',11; carry into word address
			BTST 0,11
			JUMP ~Z,continue
			SUBQ '2',11; wrap around
			ADDQ '1',1; carry into next cache line
			ADDQ '1',0; and original address
		}
		If ( BTST 1,1D) { // proceed vertically -- there is no diagonal here ( unlike in sampler )
			ADDQ '4',11; carry into word address
			CMPQ '16',11
			JUMP N,continue
			SUBQ '16',11 ; wrap around
			ADDQ '2',1   ; carry into next cache line. So we have 4x4px per cacheline. So 4 phrases, 8 words. With 4 cachelines we use 32 words of 1k already 
			ADDQ '16',0; and original address. Texture is 16 bytes wide ?
		}
	}while(false);     || 1D&3=0/*proceed_horizontally*/ &&   ) ; we_stay_in_cache_line

	CMPQ '0',1D
}JUMP ~Z  ;
return to unpack




;;;;; old stuff

;ADDQ 8,1 ; post increment into value block
SHLQ 4,1 ; Values are 16 times the size of the key

MOVE 3,4
SHRQ 16, 4 ; Oh, more shift to unpack one of the addresses
AND 5,3  ; set high word to zero
XOR 0,1
JR ~Z,
{
	LOAD 1,3
	AND 5,3  ; set high word to zero ;  So this is stupid. I maybe really should cater to bilinear interpolation and load a phrase after all this work
	JUMP ,6 ;  return from sub
}
XOR 0,3
JR ~Z
{
	LOAD 1,3  ; dupe into local SRAM .. so?
	SHRQ 16, 4; get high word
	JUMP ,6 ;  return from sub
}



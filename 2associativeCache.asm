MOVEI F02118,A  ; Phrase Highword
; parameter: B has texture base address

;;;;
XOR 5,5
NOT 5
SHLQ 16,5

LOADQ 7,2
MOVE 0,1 ; copy
AND 2,1 ; get position in local ram based on 3LSBs ;I now try to do less shift

;Register 9 has most recently used data
MOVE 9,8
SH 1,8   ;  Todo remove offset of 1

ADD 7,1  ; position of cache in internal RAM

SHRQ 3, 0 ; Oh, more shift

LOAD (1),3
ADDQ 8,1 ; post increment into value block

MOVE 3,4
SHRQ 16, 4 ; Oh, more shift to unpack one of the addresses
AND 5,3  ; set high word to zero
XOR 0,1
JR NZ,
{
	LOAD 1,3
	AND 5,3  ; set high word to zero ;  So this is stupid. I maybe really should cater to bilinear interpolation and load a phrase after all this work
	JUMP ,6 ;  return from sub
}
XOR 0,3
JR NZ
{
	LOAD 1,3  ; dupe into local SRAM .. so?
	SHRQ 16, 4; get high word
	JUMP ,6 ;  return from sub
}

; load data
;LOADP (Rn),Rn ; external memory subject to bus latency ;High Data Register F02118

ADD B,0 ; add base address:  internal -> external
MOVE 0,10  ; creata phrase spaced addresses in byte address space
ADDQ 8,0   ; external memory has byte addresses
MOVE 0,12  ; Maybe use MOVETA
ADDQ 8,0
MOVE 0,14  ; And later swap bit 14 of (F02100)
ADDQ 8,0
MOVE 0,16

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

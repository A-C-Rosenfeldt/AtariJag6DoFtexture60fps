MOVEI F02118,A  ; Phrase Highword

;;;;
XOR 5,5
NOT 5
SHLQ 16,5

LOADQ 7,2
MOVE 0,1 ; copy
AND 2,1 ; I now try to do less shift

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
	AND 5,3  ; set high word to zero
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
LOADP (Rn),Rn ; external memory subject to bus latency ;High Data Register F02118
	
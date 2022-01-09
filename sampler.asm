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


ADD 0,1  ;  Add delta to accumulater
ADD 2,3  ;  for V like for U
JR C   ; pipeline delays the flag setting. so this is for U
{
	ADDQ 1,12 ; Crazy, this split ADD is compatible with the blitter
	JR C ; this is for V
	{
		ADDQ 1,13 ; Crazy, this split ADD is compatible with the blitter
		; diagonal
		MOVE 7,4
		MOVE B,8
		MOVE F,C
		; set some register to indicate the load pattern. I don't want J back and forth. Can I just store addresses in 3 registers ?
		J  ,  LoadProcedure
	}else{
		MOVE 5,4
		MOVE 0,8
		MOVE D,C
		MOVE 7,6
		MOVE B,A
		MOVE F,E
		J  ,  LoadProcedure
	}
}else{
	JR C ; this is for V   ;  Really:  J ~C  outOfhere
	{
		ADDQ 1,13 ; Crazy, this split ADD is compatible with the blitter
		MOVE 6,4
		MOVE A,8
		MOVE E,C
		MOVE 7,5
		MOVE B,9
		MOVE F,D
		J  ,  LoadProcedure
	}
}


